/**
 * 输入桥接 (inputBridge.js)
 * 封装触屏事件，将原始触摸事件转化为高级手势
 * 依赖：基圆核心、渲染桥接
 */

const InputBridge = (() => {
  let _canvas = null;
  let _cellCore = null;
  let _renderBridge = null;

  // 手势状态机
  const MODE_NORMAL = 'normal';
  const MODE_EDIT = 'edit';
  const MODE_NAVIGATE = 'navigate';

  let _currentMode = MODE_NORMAL;

  // 触摸状态
  let _touchState = {
    startTime: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    isDragging: false,
    isPinching: false,
    longPressTimer: null,
    selectedCellId: null,
    dragCellId: null,
    initialPinchDist: 0,
    initialZoom: 1,
    _startHitCellId: null, // 记录pointerDown时命中的基圆ID，拖拽开始时使用
    // 连线拖拽状态
    isWireDragging: false,
    wireDragStart: null, // { cellId, portName, direction }
    wireDragCurrent: null // 当前鼠标位置（屏幕坐标）
  };

  // 事件队列
  let _eventQueue = [];

  // 上下文菜单状态
  let _contextMenuOpen = false;
  let _contextMenuWorldPos = null; // 上下文菜单打开时的世界坐标位置

  // 长按阈值
  const LONG_PRESS_MS = 500;
  const TAP_MAX_MS = 300;
  const DRAG_THRESHOLD_PX = 10;

  function init(cellCore, renderBridge) {
    _cellCore = cellCore;
    _renderBridge = renderBridge;
    _canvas = document.getElementById('gameCanvas');

    // 绑定触屏事件
    _canvas.addEventListener('touchstart', _onTouchStart, { passive: false });
    _canvas.addEventListener('touchmove', _onTouchMove, { passive: false });
    _canvas.addEventListener('touchend', _onTouchEnd, { passive: false });
    _canvas.addEventListener('touchcancel', _onTouchCancel, { passive: false });

    // 鼠标事件（桌面端兼容）
    // mousedown 绑定在 canvas 上，mousemove/mouseup 绑定在 document 上
    // 这样鼠标移到菜单等覆盖元素上松开时也能正确捕获
    _canvas.addEventListener('mousedown', _onMouseDown);
    document.addEventListener('mousemove', _onMouseMove);
    document.addEventListener('mouseup', _onMouseUp);
    _canvas.addEventListener('wheel', _onWheel, { passive: false });

    // 上下文菜单阻止
    _canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    console.log('[InputBridge] 初始化完成');
  }

  // ===== 模式管理 =====
  function setMode(mode) {
    const prevMode = _currentMode;
    _currentMode = mode;
    // 模式切换时清除选中状态，并通知外部（Loader）隐藏属性面板
    const prevSelectedId = _touchState.selectedCellId;
    _touchState.selectedCellId = null;
    _touchState.dragCellId = null;
    _touchState._startHitCellId = null;
    if (prevSelectedId) {
      _cellCore.emit('cell:deselect', { cellId: prevSelectedId });
    }
    // 通知渲染桥接编辑模式状态（用于透明度0基圆描边等）
    _renderBridge.setEditMode(mode === MODE_EDIT);

    // 从编辑模式切换到普通模式时，冻结屏幕固定基圆的屏幕位置
    if (prevMode === MODE_EDIT && mode !== MODE_EDIT) {
      _freezeScreenFixedCells();
    }
    // 从普通模式切换到编辑模式时，解冻屏幕固定基圆（恢复为普通基圆）
    if (prevMode !== MODE_EDIT && mode === MODE_EDIT) {
      _unfreezeScreenFixedCells();
    }

    _cellCore.emit('mode:change', { mode });
  }

  // 冻结屏幕固定基圆：记录当前屏幕位置
  function _freezeScreenFixedCells() {
    const parentId = _cellCore.getCurrentParentId();
    const cells = _cellCore.getAllCells()
      .filter(c => c.visible && c.parentId === parentId && c.attributes && c.attributes.screenFixed);
    for (const cell of cells) {
      const screenPos = _renderBridge.worldToScreen(cell.x, cell.y);
      _cellCore.setAttribute(cell.id, '_frozenScreenX', screenPos.x);
      _cellCore.setAttribute(cell.id, '_frozenScreenY', screenPos.y);
    }
  }

  // 解冻屏幕固定基圆
  function _unfreezeScreenFixedCells() {
    const parentId = _cellCore.getCurrentParentId();
    const cells = _cellCore.getAllCells()
      .filter(c => c.visible && c.parentId === parentId && c.attributes && c.attributes.screenFixed);
    for (const cell of cells) {
      if (cell.attributes._frozenScreenX !== undefined && cell.attributes._frozenScreenY !== undefined) {
        // 将冻结的屏幕位置转回世界坐标
        const worldPos = _renderBridge.screenToWorld(cell.attributes._frozenScreenX, cell.attributes._frozenScreenY);
        _cellCore.updateCell(cell.id, { x: worldPos.x, y: worldPos.y });
      }
    }
  }

  function getMode() {
    return _currentMode;
  }

  // ===== 触屏事件处理 =====
  function _onTouchStart(e) {
    e.preventDefault();
    const touches = e.touches;

    // 上下文菜单打开时，额外的触摸关闭菜单
    if (_contextMenuOpen && touches.length > 1) {
      hideContextMenu();
      return;
    }

    if (touches.length === 1) {
      const touch = touches[0];
      _handlePointerDown(touch.clientX, touch.clientY);
    } else if (touches.length === 2) {
      // 双指缩放开始
      _cancelLongPress();
      _touchState.isPinching = true;
      _touchState.isDragging = false;
      _touchState.initialPinchDist = _getPinchDistance(touches[0], touches[1]);
      _touchState.initialZoom = _renderBridge.getCamera().zoom;
    }
  }

  function _onTouchMove(e) {
    e.preventDefault();
    const touches = e.touches;

    if (_touchState.isPinching && touches.length === 2) {
      // 双指缩放
      const dist = _getPinchDistance(touches[0], touches[1]);
      const scale = dist / _touchState.initialPinchDist;
      const centerX = (touches[0].clientX + touches[1].clientX) / 2;
      const centerY = (touches[0].clientY + touches[1].clientY) / 2;
      _renderBridge.setCamera({ zoom: _touchState.initialZoom * scale });
    } else if (touches.length === 1) {
      const touch = touches[0];
      _handlePointerMove(touch.clientX, touch.clientY);
    }
  }

  function _onTouchEnd(e) {
    e.preventDefault();
    if (_touchState.isPinching && e.touches.length < 2) {
      _touchState.isPinching = false;
      return;
    }
    if (e.touches.length === 0) {
      _handlePointerUp();
    }
  }

  function _onTouchCancel(e) {
    _cancelLongPress();
    _touchState.isDragging = false;
    _touchState.isPinching = false;
    _touchState._startHitCellId = null;
  }

  // ===== 鼠标事件处理（桌面端） =====
  let _mouseDown = false;

  function _onMouseDown(e) {
    _mouseDown = true;
    _handlePointerDown(e.clientX, e.clientY);
  }

  function _onMouseMove(e) {
    if (!_mouseDown) return;
    _handlePointerMove(e.clientX, e.clientY);
  }

  function _onMouseUp(e) {
    _mouseDown = false;
    _handlePointerUp();
  }

  function _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    _renderBridge.zoomCamera(factor, e.clientX, e.clientY);
  }

  // ===== 统一指针处理 =====
  function _handlePointerDown(x, y) {
    _touchState.startTime = Date.now();
    _touchState.startX = x;
    _touchState.startY = y;
    _touchState.lastX = x;
    _touchState.lastY = y;
    _touchState.isDragging = false;
    _touchState.isWireDragging = false;
    _touchState.wireDragStart = null;

    // 编辑模式下不检测屏幕固定基圆（按普通基圆处理，可拖拽）
    if (_currentMode !== MODE_EDIT) {
      const screenHit = _hitTestScreen(x, y);
      _touchState._startHitCellId = screenHit ? screenHit.id : null;
      if (screenHit) {
        _startLongPress(x, y);
        return;
      }
    }

    // 记录 pointerDown 时命中的基圆（用于拖拽开始的 hitTest）
    const worldPos = _renderBridge.screenToWorld(x, y);
    const startHit = _hitTest(worldPos.x, worldPos.y);
    _touchState._startHitCellId = startHit ? startHit.id : null;

    // 检查是否点击了端口（输出端口才能开始连线）
    const hitPort = _hitTestPort(worldPos.x, worldPos.y);
    if (hitPort && hitPort.direction === 'output') {
      _touchState.wireDragStart = hitPort;
    }

    // 启动长按计时器
    _startLongPress(x, y);
  }

  function _handlePointerMove(x, y) {
    // 上下文菜单打开时，跳过拖拽检测（手指在菜单项上滑动选择）
    if (_contextMenuOpen) {
      _touchState.lastX = x;
      _touchState.lastY = y;
      return;
    }

    // 处理连线拖拽
    if (_touchState.wireDragStart) {
      _touchState.isWireDragging = true;
      _touchState.wireDragCurrent = { x, y };
      _touchState.lastX = x;
      _touchState.lastY = y;
      // 更新渲染桥接的拖拽状态以显示预览
      _renderBridge.setWireDrag(_touchState.wireDragStart, _touchState.wireDragCurrent);
      return;
    }

    const dx = x - _touchState.startX;
    const dy = y - _touchState.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > DRAG_THRESHOLD_PX) {
      _cancelLongPress();

      if (!_touchState.isDragging) {
        _touchState.isDragging = true;
        _onDragStart(x, y);
      }

      _onDragMove(x, y);
    }

    _touchState.lastX = x;
    _touchState.lastY = y;
  }

  function _handlePointerUp() {
    _cancelLongPress();

    // 上下文菜单打开时，检测手指是否在菜单项上松开
    if (_contextMenuOpen) {
      const lx = _touchState.lastX;
      const ly = _touchState.lastY;
      const target = document.elementFromPoint(lx, ly);
      const menuItem = target ? target.closest('.menu-item') : null;
      if (menuItem) {
        // 触发菜单项的 click 事件（由 loader.js 中的监听器处理）
        menuItem.click();
      } else {
        // 未命中任何菜单项，关闭菜单
        hideContextMenu();
      }
      _touchState.isDragging = false;
      _touchState._startHitCellId = null;
      return;
    }

    const elapsed = Date.now() - _touchState.startTime;

    if (!_touchState.isDragging && elapsed < TAP_MAX_MS) {
      _onTap(_touchState.startX, _touchState.startY);
    }

    if (_touchState.isDragging) {
      _onDragEnd();
    }

    _touchState.isDragging = false;
    _touchState._startHitCellId = null;

    // 处理连线拖拽结束
    if (_touchState.isWireDragging && _touchState.wireDragStart) {
      const worldPos = _renderBridge.screenToWorld(_touchState.wireDragCurrent.x, _touchState.wireDragCurrent.y);
      const hitPort = _hitTestPort(worldPos.x, worldPos.y);

      // 如果拖拽到有效的输入端口，创建连线
      if (hitPort && hitPort.direction === 'input') {
        const fromCellId = _touchState.wireDragStart.cellId;
        const fromPortName = _touchState.wireDragStart.portName;
        const toCellId = hitPort.cellId;
        const toPortName = hitPort.portName;

        // 验证类型兼容性
        const fromPortType = _touchState.wireDragStart.port.type;
        const toPortType = hitPort.port.type;
        if (fromPortType === 'any' || toPortType === 'any' || fromPortType === toPortType) {
          try {
            _cellCore.connectPorts(fromCellId, fromPortName, toCellId, toPortName);
          } catch (e) {
            console.warn('[InputBridge] 连线创建失败:', e.message);
          }
        }
      }
    }

    _touchState.isWireDragging = false;
    _touchState.wireDragStart = null;
    _touchState.wireDragCurrent = null;
  }

  // ===== 手势识别 =====
  function _onTap(x, y) {
    // 先检测屏幕固定位置的基圆（仅普通模式，编辑模式下按普通基圆处理）
    if (_currentMode !== MODE_EDIT) {
      const screenHit = _hitTestScreen(x, y);
      if (screenHit) {
        // 计算相对于基圆中心的偏移（用于基圆内部按钮点击检测）
        let sx = screenHit.attributes._frozenScreenX;
        let sy = screenHit.attributes._frozenScreenY;
        if (sx === undefined || sy === undefined) {
          const sp = _renderBridge.worldToScreen(screenHit.x, screenHit.y);
          sx = sp.x;
          sy = sp.y;
        }
        const relX = x - sx;
        const relY = y - sy;
        _eventQueue.push({
          type: 'cellClick',
          cellId: screenHit.id,
          worldX: relX,
          worldY: relY
        });
        _cellCore.emitCellEvent(screenHit.id, 'onClick', { worldX: relX, worldY: relY });
        _cellCore.emit('cell:click', { cellId: screenHit.id, worldX: relX, worldY: relY });
        return;
      }
    }

    const worldPos = _renderBridge.screenToWorld(x, y);
    const hitCell = _hitTest(worldPos.x, worldPos.y);

    if (_currentMode === MODE_EDIT) {
      if (hitCell) {
        _selectCell(hitCell.id);
      } else {
        _deselectCell();
      }
    } else {
      // 正常模式：点击基圆触发onClick
      if (hitCell) {
        _eventQueue.push({
          type: 'cellClick',
          cellId: hitCell.id,
          worldX: worldPos.x,
          worldY: worldPos.y
        });
        _cellCore.emitCellEvent(hitCell.id, 'onClick', { worldX: worldPos.x, worldY: worldPos.y });
        _cellCore.emit('cell:click', { cellId: hitCell.id, worldX: worldPos.x, worldY: worldPos.y });
      }
    }
  }

  function _onDragStart(x, y) {
    if (_currentMode === MODE_EDIT) {
      // 编辑模式：使用 pointerDown 时记录的命中基圆
      // 【关键】只设置 dragCellId 用于移动基圆，不调用 _selectCell
      // 这样拖动基圆时不会打开属性面板，只有真正的 tap 单击才会打开
      const startHitId = _touchState._startHitCellId;
      if (startHitId) {
        const hitCell = _cellCore.getCell(startHitId);
        if (hitCell && hitCell.selectable) {
          _touchState.dragCellId = hitCell.id;
        }
      }
    }
    // 导航模式拖拽在 _onDragMove 中处理
  }

  function _onDragMove(x, y) {
    const dx = x - _touchState.lastX;
    const dy = y - _touchState.lastY;

    if (_currentMode === MODE_NAVIGATE || !_touchState.dragCellId) {
      // 导航模式 / 任意模式下未抓到拖拽的基圆：平移视口
      _renderBridge.panCamera(dx, dy);
    } else if (_touchState.dragCellId) {
      // 编辑模式：移动基圆（只要是可选的基圆都可以移动）
      const dragCell = _cellCore.getCell(_touchState.dragCellId);
      if (dragCell && dragCell.selectable) {
        const worldPos = _renderBridge.screenToWorld(x, y);
        let newX = worldPos.x;
        let newY = worldPos.y;
        
        // 如果在基圆层内部，需要转换为相对坐标
        const parentId = _cellCore.getCurrentParentId();
        if (parentId) {
          const parent = _cellCore.getCell(parentId);
          if (parent) {
            newX = newX - parent.x;
            newY = newY - parent.y;
          }
        }
        
        _cellCore.updateCell(_touchState.dragCellId, { x: newX, y: newY });
      }
    }
  }

  function _onDragEnd() {
    _touchState.dragCellId = null;
  }

  // ===== 长按处理 =====
  function _startLongPress(x, y) {
    _cancelLongPress();
    _touchState.longPressTimer = setTimeout(() => {
      _onLongPress(x, y);
    }, LONG_PRESS_MS);
  }

  function _cancelLongPress() {
    if (_touchState.longPressTimer) {
      clearTimeout(_touchState.longPressTimer);
      _touchState.longPressTimer = null;
    }
  }

  function _onLongPress(x, y) {
    const worldPos = _renderBridge.screenToWorld(x, y);
    const hitCell = _hitTest(worldPos.x, worldPos.y);

    _cellCore.emit('cell:longpress', {
      screenX: x,
      screenY: y,
      worldX: worldPos.x,
      worldY: worldPos.y,
      hitCellId: hitCell ? hitCell.id : null
    });

    // 显示上下文菜单
    _showContextMenu(x, y, hitCell);
  }

  // ===== 基圆点击检测 =====
  function _hitTest(worldX, worldY) {
    // 如果在基圆层内部，需要将世界坐标转换为相对坐标
    let testX = worldX;
    let testY = worldY;
    const parentId = _cellCore.getCurrentParentId();
    if (parentId) {
      const parent = _cellCore.getCell(parentId);
      if (parent) {
        testX = worldX - parent.x;
        testY = worldY - parent.y;
      }
    }
    
    const cells = _cellCore.getAllCells()
      .filter(c => c.visible && c.selectable && c.parentId === parentId)
      .sort((a, b) => b.zIndex - a.zIndex); // 从上层开始检测

    for (const cell of cells) {
      const dx = testX - cell.x;
      const dy = testY - cell.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= cell.radius * 1.2) { // hitboxRadius = radius * 1.2
        return cell;
      }
    }
    return null;
  }

  // 屏幕坐标命中检测（用于固定屏幕位置的基圆）
  function _hitTestScreen(screenX, screenY) {
    const parentId = _cellCore.getCurrentParentId();
    const cells = _cellCore.getAllCells()
      .filter(c => c.visible && c.selectable && c.parentId === parentId && c.attributes && c.attributes.screenFixed)
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const cell of cells) {
      let sx = cell.attributes._frozenScreenX;
      let sy = cell.attributes._frozenScreenY;
      if (sx === undefined || sy === undefined) {
        const screenPos = _renderBridge.worldToScreen(cell.x, cell.y);
        sx = screenPos.x;
        sy = screenPos.y;
      }
      const dx = screenX - sx;
      const dy = screenY - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= cell.radius * 1.2) {
        return cell;
      }
    }
    return null;
  }

  function _hitTestPort(worldX, worldY) {
    // 如果在基圆层内部，需要将世界坐标转换为相对坐标
    let testX = worldX;
    let testY = worldY;
    const parentId = _cellCore.getCurrentParentId();
    if (parentId) {
      const parent = _cellCore.getCell(parentId);
      if (parent) {
        testX = worldX - parent.x;
        testY = worldY - parent.y;
      }
    }
    
    const cells = _cellCore.getAllCells()
      .filter(c => c.visible && c.selectable && c.parentId === parentId)
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const cell of cells) {
      const portsObj = cell.ports || {};
      
      // 检查输出端口
      const outputs = portsObj.outputs || {};
      for (const [portName, port] of Object.entries(outputs)) {
        const portPos = _getPortPosition(cell, portName, 'output');
        const dx = testX - portPos.x;
        const dy = testY - portPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= 10) { // 端口点击半径
          return { cellId: cell.id, portName, direction: 'output', port };
        }
      }

      // 检查输入端口
      const inputs = portsObj.inputs || {};
      for (const [portName, port] of Object.entries(inputs)) {
        const portPos = _getPortPosition(cell, portName, 'input');
        const dx = testX - portPos.x;
        const dy = testY - portPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= 10) { // 端口点击半径
          return { cellId: cell.id, portName, direction: 'input', port };
        }
      }
    }
    return null;
  }

  function _getPortPosition(cell, portName, direction) {
    if (!cell || !portName) return { x: cell.x, y: cell.y };

    const portsObj = direction === 'input' ? cell.ports?.inputs : cell.ports?.outputs;
    if (!portsObj) return { x: cell.x, y: cell.y };

    const portNames = Object.keys(portsObj);
    if (portNames.length === 0) return { x: cell.x, y: cell.y };

    const sortedNames = portNames.slice().sort();
    const index = sortedNames.indexOf(portName);
    const total = sortedNames.length;

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
      x: cell.x + Math.cos(angle) * radius,
      y: cell.y + Math.sin(angle) * radius
    };
  }

  // ===== 选择基圆 =====
  function _selectCell(cellId) {
    // 先取消之前的选中，确保属性面板刷新
    if (_touchState.selectedCellId && _touchState.selectedCellId !== cellId) {
      const prevId = _touchState.selectedCellId;
      _touchState.selectedCellId = null;
      _cellCore.emit('cell:deselect', { cellId: prevId });
    }
    _touchState.selectedCellId = cellId;
    _cellCore.emit('cell:select', { cellId });
  }

  function _deselectCell() {
    const prevId = _touchState.selectedCellId;
    _touchState.selectedCellId = null;
    if (prevId) {
      _cellCore.emit('cell:deselect', { cellId: prevId });
    }
  }

  function getSelectedCellId() {
    return _touchState.selectedCellId;
  }

  // ===== 上下文菜单 =====
  let _contextMenuCellId = null; // 保存上下文菜单打开时点击的基圆 ID

  function _showContextMenu(x, y, hitCell) {
    _contextMenuOpen = true;
    _contextMenuCellId = hitCell ? hitCell.id : null; // 保存点击的基圆 ID
    const worldPos = _renderBridge.screenToWorld(x, y);
    _contextMenuWorldPos = worldPos; // 保存世界坐标位置
    const menu = document.getElementById('contextMenu');
    menu.classList.remove('hidden');
    menu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 150) + 'px';

    // 获取所有菜单项
    const items = menu.querySelectorAll('.menu-item');
    
    // 检查是否在基圆层内部
    const inCellLayer = _cellCore.getCurrentParentId() !== null;
    
    // 根据是否在基圆层内部调整菜单项
    if (inCellLayer) {
      // 在基圆层内部：显示返回选项
      items[0].textContent = '创建基圆';
      items[0].dataset.action = 'create';
      items[1].textContent = '返回';
      items[1].dataset.action = 'exitLayer';
      // 第三个菜单项（编辑模式）保持不变
    } else {
      // 在根层：正常显示
      if (hitCell) {
        items[0].textContent = '编辑基圆';
        items[0].dataset.action = 'editCell';
      } else {
        items[0].textContent = '创建基圆';
        items[0].dataset.action = 'create';
      }
      items[1].textContent = '导航模式';
      items[1].dataset.action = 'navigate';
    }
  }

  function getContextMenuWorldPos() {
    return _contextMenuWorldPos;
  }

  function getContextMenuCellId() {
    return _contextMenuCellId;
  }

  function hideContextMenu() {
    _contextMenuOpen = false;
    document.getElementById('contextMenu').classList.add('hidden');
  }

  // ===== 事件队列处理 =====
  function processQueue() {
    while (_eventQueue.length > 0) {
      const event = _eventQueue.shift();
      // 事件已在 _onTap 中处理
    }
  }

  // ===== 辅助函数 =====
  function _getPinchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  return {
    init,
    setMode, getMode,
    getSelectedCellId,
    hideContextMenu,
    getContextMenuWorldPos,
    getContextMenuCellId,
    processQueue
  };
})();

// 挂载到 window 以便其他模块通过 window.InputBridge 访问
if (typeof window !== 'undefined') {
  window.InputBridge = InputBridge;
}
