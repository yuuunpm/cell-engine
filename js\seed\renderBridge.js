/**
 * 渲染桥接 (renderBridge.js)
 * 负责将基圆的数据状态转化为 Canvas 2D 的绘制指令
 * 依赖：基圆核心
 */

const RenderBridge = (() => {
  let _canvas = null;
  let _ctx = null;
  let _cellCore = null;
  let _wireRegistry = null;
  let _width = 0;
  let _height = 0;

  // 相机状态
  let _camera = {
    x: 0,      // 视口中心世界坐标X
    y: 0,      // 视口中心世界坐标Y
    zoom: 1,   // 缩放级别
    minZoom: 0.1,
    maxZoom: 5
  };

  // 自定义绘制函数注册表
  let _customDrawFunctions = new Map();

  // 编辑模式标识（编辑模式下透明度为0的基圆用虚线描边可见）
  let _isEditMode = false;

  // 选中的基圆ID（用于高亮其连线）
  let _selectedCellId = null;

  // 连线拖拽状态
  let _wireDragStart = null; // { cellId, portName, port }
  let _wireDragCurrent = null; // { x, y } 屏幕坐标

  // 地图背景色（可通过 setBackgroundColor 动态切换场景）
  let _backgroundColor = '#f5f5f0';

  function init(cellCore) {
    _cellCore = cellCore;
    _wireRegistry = cellCore.getWireRegistry ? cellCore.getWireRegistry() : null;
    _canvas = document.getElementById('gameCanvas');
    _ctx = _canvas.getContext('2d');

    // polyfill ctx.roundRect (兼容较旧的浏览器)
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') r = [r, r, r, r];
        this.beginPath();
        this.moveTo(x + r[0], y);
        this.lineTo(x + w - r[1], y);
        this.quadraticCurveTo(x + w, y, x + w, y + r[1]);
        this.lineTo(x + w, y + h - r[2]);
        this.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
        this.lineTo(x + r[3], y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r[3]);
        this.lineTo(x, y + r[0]);
        this.quadraticCurveTo(x, y, x + r[0], y);
        this.closePath();
        return this;
      };
    }

    _resizeCanvas();
    window.addEventListener('resize', _resizeCanvas);

    console.log('[RenderBridge] 初始化完成');
  }

  function _resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    _width = window.innerWidth;
    _height = window.innerHeight;
    _canvas.width = _width * dpr;
    _canvas.height = _height * dpr;
    _canvas.style.width = _width + 'px';
    _canvas.style.height = _height + 'px';
    _ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ===== 相机操作 =====
  function getCamera() {
    return { ..._camera };
  }

  function setCamera(props) {
    Object.assign(_camera, props);
    _camera.zoom = Math.max(_camera.minZoom, Math.min(_camera.maxZoom, _camera.zoom));
  }

  function panCamera(dx, dy) {
    _camera.x -= dx / _camera.zoom;
    _camera.y -= dy / _camera.zoom;
  }

  function zoomCamera(factor, centerX, centerY) {
    const oldZoom = _camera.zoom;
    _camera.zoom = Math.max(_camera.minZoom, Math.min(_camera.maxZoom, _camera.zoom * factor));
    // 以缩放中心为基准调整相机位置
    if (centerX !== undefined && centerY !== undefined) {
      const zoomRatio = _camera.zoom / oldZoom;
      const worldCenterX = _camera.x + (centerX - _width / 2) / oldZoom;
      const worldCenterY = _camera.y + (centerY - _height / 2) / oldZoom;
      _camera.x = worldCenterX - (centerX - _width / 2) / _camera.zoom;
      _camera.y = worldCenterY - (centerY - _height / 2) / _camera.zoom;
    }
  }

  // ===== 坐标变换 =====
  function worldToScreen(wx, wy) {
    return {
      x: (wx - _camera.x) * _camera.zoom + _width / 2,
      y: (wy - _camera.y) * _camera.zoom + _height / 2
    };
  }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - _width / 2) / _camera.zoom + _camera.x,
      y: (sy - _height / 2) / _camera.zoom + _camera.y
    };
  }

  // ===== 视口裁剪 =====
  function isInViewport(cell) {
    const margin = cell.radius * 2;
    const screenPos = worldToScreen(cell.x, cell.y);
    const screenRadius = cell.radius * _camera.zoom;
    return (
      screenPos.x + screenRadius + margin > 0 &&
      screenPos.x - screenRadius - margin < _width &&
      screenPos.y + screenRadius + margin > 0 &&
      screenPos.y - screenRadius - margin < _height
    );
  }

  // ===== 注册自定义绘制 =====
  function registerCustomDraw(cellId, drawFn) {
    _customDrawFunctions.set(cellId, drawFn);
  }

  function unregisterCustomDraw(cellId) {
    _customDrawFunctions.delete(cellId);
  }

  // ===== 编辑模式 =====
  function setEditMode(isEdit) {
    _isEditMode = isEdit;
  }

  function isEditMode() {
    return _isEditMode;
  }

  // ===== 地图背景色（用于动态切换场景） =====
  function setBackgroundColor(color) {
    _backgroundColor = color || '#f5f5f0';
    if (_canvas) {
      _canvas.style.backgroundColor = _backgroundColor;
    }
  }
  function getBackgroundColor() {
    return _backgroundColor;
  }

  // ===== 主渲染流程 =====
  function render() {
    if (!_ctx || !_cellCore) return;

    const ctx = _ctx;
    // 清除画布
    ctx.clearRect(0, 0, _width, _height);

    // 填充地图背景色（可根据地图预设动态切换）
    if (_backgroundColor) {
      ctx.fillStyle = _backgroundColor;
      ctx.fillRect(0, 0, _width, _height);
    }

    // 绘制背景网格
    _drawGrid(ctx);

    // 保存上下文
    ctx.save();

    // 应用相机变换
    ctx.translate(_width / 2, _height / 2);
    ctx.scale(_camera.zoom, _camera.zoom);
    ctx.translate(-_camera.x, -_camera.y);

    // 获取所有可见基圆并按zIndex排序
    const cells = _cellCore.getAllCells()
      .filter(c => c.visible)
      .filter(c => c.parentId === _cellCore.getCurrentParentId())
      .sort((a, b) => a.zIndex - b.zIndex);

    // 分离：普通基圆 vs 固定屏幕基圆（编辑模式下固定基圆按普通基圆渲染，可拖拽移动）
    const normalCells = [];
    const fixedCells = [];
    for (const cell of cells) {
      if (cell.attributes && cell.attributes.screenFixed && !_isEditMode) {
        fixedCells.push(cell);
      } else {
        normalCells.push(cell);
      }
    }

    // 视口裁剪后绘制普通基圆
    for (const cell of normalCells) {
      if (isInViewport(cell)) {
        _drawCell(ctx, cell);
      }
    }

    // 绘制连线（在基圆之后，恢复上下文之前）
    _drawWires(ctx, normalCells);

    ctx.restore();

    // 绘制固定屏幕位置的基圆（不受相机变换影响）
    _drawFixedScreenCells(ctx, fixedCells);

    // 绘制UI层（不受相机变换影响）
    _drawUIOverlay(ctx);
  }

  // ===== 绘制背景网格 =====
  function _drawGrid(ctx) {
    const gridSize = 100;
    const zoom = _camera.zoom;

    // 计算可见区域的世界坐标范围
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(_width, _height);

    const startX = Math.floor(topLeft.x / gridSize) * gridSize;
    const startY = Math.floor(topLeft.y / gridSize) * gridSize;
    const endX = Math.ceil(bottomRight.x / gridSize) * gridSize;
    const endY = Math.ceil(bottomRight.y / gridSize) * gridSize;

    ctx.strokeStyle = 'rgba(60, 60, 100, 0.3)';
    ctx.lineWidth = 0.5 / zoom;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      const screen = worldToScreen(x, 0);
      ctx.moveTo(screen.x, 0);
      ctx.lineTo(screen.x, _height);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      const screen = worldToScreen(0, y);
      ctx.moveTo(0, screen.y);
      ctx.lineTo(_width, screen.y);
    }
    ctx.stroke();

    // 绘制原点
    const origin = worldToScreen(0, 0);
    ctx.fillStyle = 'rgba(100, 100, 200, 0.5)';
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== 计算基圆的绝对坐标（考虑父基圆的位置） =====
  function _getAbsolutePosition(cell) {
    let x = cell.x;
    let y = cell.y;
    let rotation = cell.rotation;
    
    let parent = cell.parentId ? _cellCore.getCell(cell.parentId) : null;
    while (parent) {
      // 应用父基圆的旋转和位置
      const cos = Math.cos(parent.rotation);
      const sin = Math.sin(parent.rotation);
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      
      x = rx + parent.x;
      y = ry + parent.y;
      rotation += parent.rotation;
      
      parent = parent.parentId ? _cellCore.getCell(parent.parentId) : null;
    }
    
    return { x, y, rotation };
  }

  // ===== 绘制单个基圆 =====
  function _drawCell(ctx, cell) {
    ctx.save();
    
    // 获取绝对坐标（考虑嵌套关系）
    const absPos = _getAbsolutePosition(cell);
    
    // 防御性检查：NaN 坐标不渲染，重置到原点
    const renderX = isFinite(absPos.x) ? absPos.x : 0;
    const renderY = isFinite(absPos.y) ? absPos.y : 0;
    if (!isFinite(absPos.x) || !isFinite(absPos.y)) {
      console.warn('[Render] 基圆坐标无效，已重置到原点:', cell.id, cell.name);
    }
    ctx.translate(renderX, renderY);
    ctx.rotate(isFinite(absPos.rotation) ? absPos.rotation : 0);

    // 编辑模式下透明度为0的基圆：用虚线描边显示，确保可编辑
    const isGhostCell = _isEditMode && cell.opacity <= 0.01;
    const effectiveOpacity = isGhostCell ? 0.5 : cell.opacity;
    ctx.globalAlpha = effectiveOpacity;

    if (isGhostCell) {
      // 虚线圈描边 + 半透明填充（编辑模式下透明度0基圆可见）
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = cell.color;
      ctx.lineWidth = 2;
      ctx.fillStyle = cell.color + '20';
      ctx.beginPath();
      ctx.arc(0, 0, cell.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
      ctx.setLineDash([]);
    } else {
      // 检查自定义绘制
      const customDraw = _customDrawFunctions.get(cell.id);
      if (customDraw) {
        try {
          customDraw(ctx, cell.radius);
        } catch (e) {
          _drawDefaultCell(ctx, cell);
        }
      } else {
        _drawDefaultCell(ctx, cell);
      }
    }

    // 选中状态：蓝色虚线圈（仅当点击选中时显示）
    if (_selectedCellId !== null && cell.id === _selectedCellId) {
      ctx.strokeStyle = '#6464ff';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, cell.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 错误状态边框
    if (cell.state === 'error') {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, cell.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 绘制名称（特效基圆不显示名称，避免视觉杂乱）
    if (cell.name && _camera.zoom > 0.5 && cell.kind !== 'effect') {
      ctx.globalAlpha = (isGhostCell ? 0.6 : cell.opacity * 0.8);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.max(10, 12 / _camera.zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(cell.name, 0, cell.radius + 6);
    }

    ctx.restore();

    // 绘制端口节点
    _drawCellPorts(ctx, cell);
  }

  // ===== 场景对象内联绘制（rock/water/wood/sand）=====
  function _shadeColor(hex, percent) {
    if (!hex) return '#888888';
    if (hex.length === 4) hex = '#' + hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
    if (hex.length !== 7) return hex;
    const num = parseInt(hex.slice(1), 16);
    let r = (num >> 16) + percent * 2.55;
    let g = ((num >> 8) & 0xff) + percent * 2.55;
    let b = (num & 0xff) + percent * 2.55;
    r = Math.max(0, Math.min(255, Math.round(r)));
    g = Math.max(0, Math.min(255, Math.round(g)));
    b = Math.max(0, Math.min(255, Math.round(b)));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  function _drawSceneObjectInline(ctx, r, attr) {
    const sceneType = attr.sceneType;
    const color = attr.color || '#888888';
    switch (sceneType) {
      case 'rock': {
        // 不规则岩石：多段贝塞尔曲线构成的凹凸形状 + 深色边缘 + 高光 + 裂纹
        const c = color;
        ctx.save();
        // 外轮廓（不规则多边形，使用固定扰动参数避免每帧抖动）
        ctx.fillStyle = c;
        ctx.strokeStyle = _shadeColor(c, -45);
        ctx.lineWidth = 2;
        ctx.beginPath();
        const points = 14;
        const baseAngles = [0.9, 1.1, 0.85, 1.15, 0.95, 1.05, 0.88, 1.12, 0.92, 1.08, 0.86, 1.1, 0.94, 1.02];
        for (let i = 0; i < points; i++) {
          const ang = (i / points) * Math.PI * 2;
          const rr = r * baseAngles[i] * 0.92;
          const px = Math.cos(ang) * rr;
          const py = Math.sin(ang) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 左侧阴影（增加立体感）
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        for (let i = 0; i < points; i++) {
          const ang = (i / points) * Math.PI * 2;
          const rr = r * baseAngles[i] * 0.92;
          const px = Math.cos(ang) * rr * 0.95 + r * 0.08;
          const py = Math.sin(ang) * rr * 0.92 + r * 0.1;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // 顶部高光（不规则斑块）
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.2, -r * 0.35, r * 0.38, r * 0.18, -0.35, 0, Math.PI * 2);
        ctx.fill();
        // 次级高光
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.ellipse(r * 0.15, -r * 0.2, r * 0.2, r * 0.1, 0.2, 0, Math.PI * 2);
        ctx.fill();
        // 裂纹（3 条深色细线，固定位置）
        ctx.strokeStyle = _shadeColor(c, -55);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, -r * 0.1);
        ctx.lineTo(r * 0.05, r * 0.25);
        ctx.lineTo(r * 0.3, r * 0.1);
        ctx.moveTo(-r * 0.5, r * 0.15);
        ctx.lineTo(-r * 0.15, r * 0.4);
        ctx.lineTo(r * 0.1, r * 0.55);
        ctx.moveTo(-r * 0.05, -r * 0.5);
        ctx.lineTo(r * 0.05, -r * 0.05);
        ctx.stroke();
        // 小颗粒（表面颗粒感）
        ctx.fillStyle = _shadeColor(c, -25);
        const specklePositions = [
          [-r * 0.25, -r * 0.05], [r * 0.3, r * 0.2], [-r * 0.4, -r * 0.2],
          [r * 0.2, -r * 0.4], [-r * 0.1, r * 0.35], [r * 0.45, -r * 0.1]
        ];
        for (const [sx, sy] of specklePositions) {
          ctx.beginPath();
          ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'water': {
        // 水塘：不规则形状 + 青蓝色调 + 同心水纹 + 反光 + 浅水边缘
        ctx.save();
        // 外层深色边（湿地土）
        ctx.fillStyle = 'rgba(60,75,65,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.02, r * 0.78, 0.1, 0, Math.PI * 2);
        ctx.fill();
        // 水体主色（径向渐变 - 中心浅，边缘深）
        const mainGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.15, r * 0.1, 0, 0, r * 0.95);
        mainGrad.addColorStop(0, '#7fb8c4');
        mainGrad.addColorStop(0.5, '#4a8ea5');
        mainGrad.addColorStop(1, '#2f5f75');
        ctx.fillStyle = mainGrad;
        // 不规则椭圆水体
        ctx.beginPath();
        const waterPts = 12;
        const waterRatios = [1.0, 0.95, 0.92, 0.98, 1.02, 0.94, 0.96, 1.0, 0.97, 0.93, 1.01, 0.98];
        for (let i = 0; i < waterPts; i++) {
          const ang = (i / waterPts) * Math.PI * 2 + 0.1;
          const rr = r * waterRatios[i] * 0.93;
          const px = Math.cos(ang) * rr;
          const py = Math.sin(ang) * rr * 0.72;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // 高光反射（模拟天空反光的水平条带）
        ctx.fillStyle = 'rgba(200,230,240,0.35)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.25, -r * 0.35, r * 0.3, r * 0.06, 0.1, 0, Math.PI * 2);
        ctx.fill();
        // 小反光
        ctx.fillStyle = 'rgba(180,210,225,0.25)';
        ctx.beginPath();
        ctx.ellipse(r * 0.2, -r * 0.15, r * 0.15, r * 0.04, -0.1, 0, Math.PI * 2);
        ctx.fill();
        // 同心水纹（同心椭圆线）
        ctx.strokeStyle = 'rgba(200,220,230,0.35)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.ellipse(0, 0, r * i * 0.28, r * i * 0.2, 0.1, 0, Math.PI * 2);
          ctx.stroke();
        }
        // 水波纹亮点
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        const sparklePositions = [
          [-r * 0.35, -r * 0.2, 2], [r * 0.25, -r * 0.3, 1.5],
          [-r * 0.1, r * 0.15, 1.5], [r * 0.4, r * 0.25, 2]
        ];
        for (const [sx, sy, sr] of sparklePositions) {
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'wood': {
        // 朽木：横向椭圆 + 年轮 + 裂纹
        const c = color;
        ctx.fillStyle = c;
        ctx.strokeStyle = _shadeColor(c, -40);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.0, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 年轮
        ctx.strokeStyle = _shadeColor(c, -25);
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
          ctx.beginPath();
          ctx.ellipse(0, 0, r * (1 - i * 0.18), r * (0.45 - i * 0.08), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        // 中央裂纹
        ctx.strokeStyle = _shadeColor(c, -55);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, 0);
        ctx.lineTo(r * 0.7, 0);
        ctx.stroke();
        break;
      }
      case 'sand': {
        // 沙地：淡黄椭圆 + 散沙粒
        const c = color;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.95, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        // 散沙粒（深色）
        ctx.fillStyle = _shadeColor(c, -30);
        for (let i = 0; i < 25; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() * r * 0.8;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 1.0, 0, Math.PI * 2);
          ctx.fill();
        }
        // 高光沙粒
        ctx.fillStyle = 'rgba(255,235,180,0.5)';
        for (let i = 0; i < 8; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() * r * 0.7;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default: break;
    }
    return;
  }

  // ===== 默认绘制（按种类 + shape回退） =====
  function _drawDefaultCell(ctx, cell) {
    const r = cell.radius;
    const attr = cell.attributes || {};

    // --- 场景对象直接绘制（不依赖 SpeciesRegistry，兜底方案）---
    if (attr.sceneType) {
      _drawSceneObjectInline(ctx, r, attr);
      return;
    }

    // --- 物种定制绘制：优先使用物种注册表中的详细外观（昆虫/植物/蚂蚁）---
    const sr = window.SpeciesRegistry;
    const hasSpecies = !!attr.species;
    if (sr && typeof sr.drawSpeciesAppearance === 'function' && hasSpecies) {
      try {
        const ok = sr.drawSpeciesAppearance(ctx, r, cell);
        if (ok) return; // 绘制成功，不再走默认
      } catch (e) {
        // SpeciesRegistry 绘制出错，静默使用默认渲染
      }
    }

    const kindDef = _cellCore.getKindDefinition(cell.kind);
    const style = kindDef ? kindDef.renderStyle : 'circle-border';

    // 如果 cell 有明确的 shape 属性且不是默认 circle，按shape绘制
    if (cell.shape && cell.shape !== 'circle' && !['circle-border','circle-direction','circle-wave','circle-solid','circle-glow','circle-gear','circle-dashed','rounded-rect'].includes(style)) {
      _drawByShape(ctx, cell, r);
      return;
    }

    switch (style) {
      case 'circle-border': // empty
        ctx.strokeStyle = cell.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = cell.color + '20';
        ctx.fill();
        break;

      case 'circle-direction': // creature
        ctx.fillStyle = cell.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        // 方向指示器
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * 0.8, 0);
        ctx.stroke();
        // 眼睛
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(r * 0.3, -r * 0.2, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r * 0.3, r * 0.2, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'circle-wave': // plant
        ctx.fillStyle = cell.color;
        ctx.beginPath();
        const wavePoints = 12;
        for (let i = 0; i <= wavePoints; i++) {
          const angle = (i / wavePoints) * Math.PI * 2;
          const waveR = r + Math.sin(angle * 3 + Date.now() * 0.002) * r * 0.1;
          const px = Math.cos(angle) * waveR;
          const py = Math.sin(angle) * waveR;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // 中心点
        ctx.fillStyle = '#80e080';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'circle-solid': // static
        ctx.fillStyle = cell.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        // 纹理线
        ctx.strokeStyle = cell.color + '80';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.3);
        ctx.lineTo(r * 0.3, r * 0.5);
        ctx.stroke();
        break;

      case 'rounded-rect': // ui
        const w = r * 2;
        const h = r * 1.4;
        const cornerR = 8;
        ctx.fillStyle = cell.attributes.bgColor || cell.color + '40';
        _roundRect(ctx, -w / 2, -h / 2, w, h, cornerR);
        ctx.fill();
        ctx.strokeStyle = cell.color;
        ctx.lineWidth = 1.5;
        _roundRect(ctx, -w / 2, -h / 2, w, h, cornerR);
        ctx.stroke();
        // 文本内容
        if (cell.attributes.textContent) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `${cell.attributes.fontSize || 14}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cell.attributes.textContent, 0, 0);
        }
        break;

      case 'circle-glow': // effect
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        gradient.addColorStop(0, cell.color);
        gradient.addColorStop(1, cell.color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'circle-gear': // engine
        ctx.fillStyle = cell.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        // 齿轮图标
        ctx.strokeStyle = '#8888aa';
        ctx.lineWidth = 2;
        const teeth = 8;
        for (let i = 0; i < teeth; i++) {
          const angle = (i / teeth) * Math.PI * 2;
          const innerR = r * 0.5;
          const outerR = r * 0.75;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
          ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
          ctx.stroke();
        }
        // 中心圆
        ctx.fillStyle = '#606080';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'circle-dashed': // trigger
        ctx.strokeStyle = cell.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = cell.color + '15';
        ctx.fill();
        break;

      default:
        _drawByShape(ctx, cell, r);
    }
  }

  // ===== 基于shape属性绘制 =====
  function _drawByShape(ctx, cell, r) {
    switch (cell.shape) {
      case 'rect':
        ctx.fillStyle = cell.color;
        ctx.fillRect(-r, -r * 0.7, r * 2, r * 1.4);
        ctx.strokeStyle = cell.color + '80';
        ctx.lineWidth = 1;
        ctx.strokeRect(-r, -r * 0.7, r * 2, r * 1.4);
        break;
      case 'triangle':
        ctx.fillStyle = cell.color;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(-r, r * 0.7);
        ctx.lineTo(r, r * 0.7);
        ctx.closePath();
        ctx.fill();
        break;
      case 'polygon':
        ctx.fillStyle = cell.color;
        ctx.beginPath();
        const sides = Math.max(3, cell.attributes.sides || 6);
        for (let i = 0; i < sides; i++) {
          const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'sprite':
        // 精灵渲染：绘制占位框
        ctx.fillStyle = cell.color + '40';
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.strokeStyle = cell.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        // 标签
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('sprite', 0, 0);
        break;
      default: // circle
        ctx.fillStyle = cell.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
    }
  }

  // ===== 圆角矩形辅助 =====
  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ===== 端口颜色映射 =====
  function _getPortColor(type) {
    switch (type) {
      case 'number': return '#4a9eff';
      case 'string': return '#4aff6e';
      case 'boolean': return '#ff4a4a';
      case 'any': return '#ffdc4a';
      default: return '#888888';
    }
  }

  // ===== 获取端口相对于基圆中心的坐标 =====
  function _getPortPosition(cell, portName, direction) {
    if (!cell || !portName) return { x: 0, y: 0 };

    // 获取对应方向的端口列表
    const portsObj = direction === 'input' ? cell.ports?.inputs : cell.ports?.outputs;
    if (!portsObj) return { x: 0, y: 0 };

    const portNames = Object.keys(portsObj);
    if (portNames.length === 0) return { x: 0, y: 0 };

    // 按名称排序，确保索引一致
    const sortedNames = portNames.slice().sort();
    const index = sortedNames.indexOf(portName);
    const total = sortedNames.length;

    // 输入端口：角度范围 90°~270°（左侧半圆）
    // 输出端口：角度范围 -90°~90°（右侧半圆）
    let angle;
    const startAngle = direction === 'input' ? Math.PI / 2 : -Math.PI / 2;
    const endAngle = direction === 'input' ? Math.PI * 1.5 : Math.PI / 2;

    if (total === 1) {
      angle = (startAngle + endAngle) / 2;
    } else {
      angle = startAngle + (index / (total - 1)) * (endAngle - startAngle);
    }

    const radius = cell.radius + 12;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    };
  }

  // ===== 绘制基圆端口节点 =====
  function _drawCellPorts(ctx, cell) {
    if (!cell.ports) return;

    const zoom = _camera.zoom;
    const showLabels = zoom > 0.3;

    // 绘制输入端口
    const inputs = cell.ports.inputs || {};
    for (const [portName, port] of Object.entries(inputs)) {
      const pos = _getPortPosition(cell, portName, 'input');
      const color = _getPortColor(port.type);

      // 空心圆（输入端口）- 使用相对坐标
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / Math.max(zoom, 1);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.stroke();

      // 端口标签
      if (showLabels) {
        ctx.fillStyle = color;
        ctx.font = `${Math.max(8, 10 / Math.max(zoom, 1))}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const labelText = portName + (port.value !== undefined && port.value !== null ? `: ${String(port.value).substr(0, 10)}` : '');
        ctx.fillText(labelText, pos.x - 8, pos.y);
      }
    }

    // 绘制输出端口
    const outputs = cell.ports.outputs || {};
    for (const [portName, port] of Object.entries(outputs)) {
      const pos = _getPortPosition(cell, portName, 'output');
      const color = _getPortColor(port.type);

      // 实心圆（输出端口）- 使用相对坐标
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // 端口标签
      if (showLabels) {
        ctx.fillStyle = color;
        ctx.font = `${Math.max(8, 10 / Math.max(zoom, 1))}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const labelText = portName + (port.value !== undefined && port.value !== null ? `: ${String(port.value).substr(0, 10)}` : '');
        ctx.fillText(labelText, pos.x + 8, pos.y);
      }
    }
  }

  // ===== 绘制所有连线 =====
  function _drawWires(ctx, cells) {
    let wires = [];

    // 从 WireRegistry 或 CellCore 获取所有线缆
    if (_wireRegistry && typeof _wireRegistry.getWires === 'function') {
      wires = _wireRegistry.getWires();
    } else if (_cellCore && typeof _cellCore.getAllWires === 'function') {
      wires = _cellCore.getAllWires();
    }

    if (!wires || wires.length === 0) return;

    const zoom = _camera.zoom;

    for (const wire of wires) {
      // 查找 fromCell 和 toCell
      const fromCell = _cellCore.getCell(wire.fromCellId);
      const toCell = _cellCore.getCell(wire.toCellId);

      if (!fromCell || !toCell) {
        continue; // 跳过找不到基圆的线缆
      }

      // 查找端口
      const fromPort = fromCell.ports?.outputs?.[wire.fromPortId];
      const toPort = toCell.ports?.inputs?.[wire.toPortId];

      if (!fromPort || !toPort) {
        continue; // 跳过找不到端口的线缆
      }

      // 获取基圆的绝对坐标（考虑嵌套关系）
      const fromAbs = _getAbsolutePosition(fromCell);
      const toAbs = _getAbsolutePosition(toCell);

      // 计算端口绝对坐标（基圆绝对坐标 + 端口相对坐标）
      const fromRel = _getPortPosition(fromCell, wire.fromPortId, 'output');
      const toRel = _getPortPosition(toCell, wire.toPortId, 'input');

      // 应用基圆旋转到端口相对坐标
      const fromCos = Math.cos(fromAbs.rotation);
      const fromSin = Math.sin(fromAbs.rotation);
      const fromPosX = fromAbs.x + fromRel.x * fromCos - fromRel.y * fromSin;
      const fromPosY = fromAbs.y + fromRel.x * fromSin + fromRel.y * fromCos;

      const toCos = Math.cos(toAbs.rotation);
      const toSin = Math.sin(toAbs.rotation);
      const toPosX = toAbs.x + toRel.x * toCos - toRel.y * toSin;
      const toPosY = toAbs.y + toRel.x * toSin + toRel.y * toCos;

      // 确定颜色（按端口类型）
      const color = _getPortColor(wire.dataType || fromPort.type);

      // 判断是否为选中基圆的连线
      const isSelectedWire = _selectedCellId !== null &&
        (wire.fromCellId === _selectedCellId || wire.toCellId === _selectedCellId);

      // 绘制贝塞尔曲线
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = (isSelectedWire ? 4 : 2) / Math.max(zoom, 1);

      if (isSelectedWire) {
        ctx.setLineDash([8 / zoom, 4 / zoom]);
      }

      // 计算贝塞尔控制点
      const dx = toPosX - fromPosX;
      const dy = toPosY - fromPosY;
      const offsetX = Math.abs(dx) * 0.5;
      const cp1x = fromPosX + offsetX;
      const cp1y = fromPosY;
      const cp2x = toPosX - offsetX;
      const cp2y = toPosY;

      ctx.beginPath();
      ctx.moveTo(fromPosX, fromPosY);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, toPosX, toPosY);
      ctx.stroke();

      ctx.setLineDash([]);

      // 在线的中点绘制一个小圆点表示数据流节点
      const midX = (fromPosX + toPosX) / 2;
      const midY = (fromPosY + toPosY) / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(midX, midY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ===== 绘制拖拽中的连线预览 =====
  function _drawWireDragPreview(ctx) {
    if (!_wireDragStart || !_wireDragCurrent) return;

    const fromCell = _cellCore.getCell(_wireDragStart.cellId);
    if (!fromCell) return;

    const fromAbs = _getAbsolutePosition(fromCell);
    const fromRel = _getPortPosition(fromCell, _wireDragStart.portName, 'output');
    const fromCos = Math.cos(fromAbs.rotation);
    const fromSin = Math.sin(fromAbs.rotation);
    const fromX = fromAbs.x + fromRel.x * fromCos - fromRel.y * fromSin;
    const fromY = fromAbs.y + fromRel.x * fromSin + fromRel.y * fromCos;

    const toWorld = screenToWorld(_wireDragCurrent.x, _wireDragCurrent.y);
    const toX = toWorld.x;
    const toY = toWorld.y;

    const color = _getPortColor(_wireDragStart.port.type);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.globalAlpha = 0.7;

    const dx = toX - fromX;
    const offsetX = Math.abs(dx) * 0.5;
    const cp1x = fromX + offsetX;
    const cp1y = fromY;
    const cp2x = toX - offsetX;
    const cp2y = toY;

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, toX, toY);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ===== 绘制固定屏幕位置的基圆 =====
  function _drawFixedScreenCells(ctx, fixedCells) {
    for (const cell of fixedCells) {
      ctx.save();

      // 使用冻结的屏幕坐标
      let sx = cell.attributes._frozenScreenX;
      let sy = cell.attributes._frozenScreenY;

      // 如果没有冻结坐标，立即计算并冻结
      if (sx === undefined || sy === undefined) {
        const absPos = _getAbsolutePosition(cell);
        const screenPos = worldToScreen(absPos.x, absPos.y);
        sx = screenPos.x;
        sy = screenPos.y;
        _cellCore.setAttribute(cell.id, '_frozenScreenX', sx);
        _cellCore.setAttribute(cell.id, '_frozenScreenY', sy);
      }

      ctx.translate(sx, sy);

      const isGhostCell = _isEditMode && cell.opacity <= 0.01;
      const effectiveOpacity = isGhostCell ? 0.5 : cell.opacity;
      ctx.globalAlpha = effectiveOpacity;

      if (isGhostCell) {
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = cell.color;
        ctx.lineWidth = 2;
        ctx.fillStyle = cell.color + '20';
        ctx.beginPath();
        ctx.arc(0, 0, cell.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
        ctx.setLineDash([]);
      } else {
        const customDraw = _customDrawFunctions.get(cell.id);
        if (customDraw) {
          try {
            customDraw(ctx, cell.radius);
          } catch (e) {
            _drawDefaultCell(ctx, cell);
          }
        } else {
          _drawDefaultCell(ctx, cell);
        }
      }

      // 选中状态：蓝色虚线圈（仅当点击选中时显示）
      if (_selectedCellId !== null && cell.id === _selectedCellId) {
        ctx.strokeStyle = '#6464ff';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, cell.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (cell.state === 'error') {
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, cell.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  // ===== UI覆盖层 =====
  function _drawUIOverlay(ctx) {
    // 绘制拖拽连线预览
    _drawWireDragPreview(ctx);

    // 当前层级指示
    const parentId = _cellCore.getCurrentParentId();
    if (parentId) {
      const parent = _cellCore.getCell(parentId);
      if (parent) {
        ctx.fillStyle = 'rgba(100, 100, 200, 0.7)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`📍 ${parent.name} 内部`, 10, 46);
      }
    }
  }

  // ===== 绘制选择框 =====
  function drawSelection(cellId) {
    _selectedCellId = cellId;
    const cell = _cellCore.getCell(cellId);
    if (!cell) return;

    const ctx = _ctx;
    // 使用绝对坐标（考虑父基圆偏移）
    const absPos = _getAbsolutePosition(cell);
    const screen = worldToScreen(absPos.x, absPos.y);
    const screenR = cell.radius * _camera.zoom;

    ctx.save();
    ctx.strokeStyle = '#6464ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, screenR + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 缩放手柄
    const handleAngle = -Math.PI / 4;
    const handleX = screen.x + Math.cos(handleAngle) * (screenR + 6);
    const handleY = screen.y + Math.sin(handleAngle) * (screenR + 6);
    ctx.fillStyle = '#6464ff';
    ctx.beginPath();
    ctx.arc(handleX, handleY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function setWireDrag(start, current) {
    _wireDragStart = start;
    _wireDragCurrent = current;
  }

  return {
    init, render,
    getCamera, setCamera, panCamera, zoomCamera,
    worldToScreen, screenToWorld, isInViewport,
    registerCustomDraw, unregisterCustomDraw,
    setEditMode, isEditMode,
    drawSelection,
    setWireDrag,
    setBackgroundColor, getBackgroundColor,
    getWidth: () => _width,
    getHeight: () => _height
  };
})();

// 挂载到 window 以便其他模块通过 window.RenderBridge 访问
if (typeof window !== 'undefined') {
  window.RenderBridge = RenderBridge;
}
