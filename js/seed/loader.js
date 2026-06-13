/**
 * 模块加载器 (loader.js)
 * 引擎的启动入口，负责按顺序加载和初始化其他七个模块
 * 最后加载，负责编排所有模块
 * V4.0 新增：WireRegistry、CodeLoader、StandaloneRunner 初始化；端口/连线属性面板
 */

const Loader = (() => {
  let _modules = new Map();
  let _initialized = false;
  let _selectedCellId = null;
  let _editingCellId = null;

  // ===== 获取模块 =====
  function getModule(name) {
    return _modules.get(name);
  }

  // ===== 初始化所有模块 =====
  async function init() {
    try {
      console.log('[Loader] 开始加载基圆引擎...');

      // 按依赖顺序初始化
      // 1. 持久化层（无依赖）
      const persistOk = await PersistLayer.init();
      if (!persistOk) console.warn('[Loader] 持久化层初始化失败，继续加载');
      _modules.set('persistLayer', PersistLayer);

      // 2. 事件循环（依赖持久化层）
      GameLoop.init(PersistLayer);
      _modules.set('gameLoop', GameLoop);

      // 3. V4.0 新增模块初始化（先于CellCore）
      // 线缆注册表
      const wireRegistry = new window.WireRegistry(CellCore);
      _modules.set('wireRegistry', wireRegistry);

      // 代码映射加载器
      let codeLoader = null;
      if (typeof window.CodeLoader === 'function') {
        codeLoader = new window.CodeLoader(CellCore, PersistLayer);
        _modules.set('codeLoader', codeLoader);
      }

      // 独立执行器
      if (typeof window.StandaloneRunner === 'function') {
        const standaloneRunner = new window.StandaloneRunner(CellCore, Sandbox);
        _modules.set('standaloneRunner', standaloneRunner);
      }

      // 3.5 基圆核心（依赖事件循环、持久化层、WireRegistry和CodeLoader）
      CellCore.init(GameLoop, PersistLayer, wireRegistry, codeLoader);
      // 绑定 PersistLayer 与 CellCore 的脏位共享，避免"基圆变更未持久化"
      if (typeof PersistLayer.bindCellCore === 'function') {
        PersistLayer.bindCellCore(CellCore);
      }
      _modules.set('cellCore', CellCore);

      // 4. 渲染桥接（依赖基圆核心）
      RenderBridge.init(CellCore);
      _modules.set('renderBridge', RenderBridge);

      // 5. 输入桥接（依赖基圆核心、渲染桥接）
      InputBridge.init(CellCore, RenderBridge);
      _modules.set('inputBridge', InputBridge);

      // 6. 沙箱执行器（依赖基圆核心、事件循环、渲染桥接）
      Sandbox.init(CellCore, GameLoop, null, RenderBridge);
      _modules.set('sandbox', Sandbox);

      // 7. AI通信层（依赖沙箱执行器、基圆核心、持久化层）
      await AiBridge.init(Sandbox, CellCore, PersistLayer);
      AiMemory.init(CellCore, PersistLayer);
      _modules.set('aiBridge', AiBridge);

      // 8. 开发者控制台（依赖基圆核心、沙箱、AI 通信层）
      if (typeof window.DevConsole !== 'undefined') {
        DevConsole.init(CellCore, Sandbox, AiBridge);
        _modules.set('devConsole', DevConsole);
      }

      // 8.5 引擎工具集（依赖基圆核心、沙箱、AI 通信层、持久化层）
      if (typeof window.EngineTools !== 'undefined') {
        EngineTools.init(CellCore, AiBridge, Sandbox, PersistLayer);
        _modules.set('engineTools', EngineTools);
      }

      // 设置GameLoop的依赖
      GameLoop.setDependencies(CellCore, Sandbox, RenderBridge, InputBridge);

      // 加载世界数据
      await _loadWorld();

      // 绑定UI事件
      _bindUIEvents();

      // 注册游戏循环回调
      _registerLoopCallbacks();

      // 启动游戏循环
      GameLoop.start();

      // 启动自动保存
      PersistLayer.startAutoSave((id) => CellCore.getCellDataForSave(id));

      // 隐藏加载画面
      _hideLoadingScreen();

      // 检查是否需要显示教程
      _checkTutorial();

      _initialized = true;
      console.log('[Loader] 基圆引擎加载完成！CellEngine loaded.');

    } catch (e) {
      console.error('[Loader] 加载失败:', e);
      _showError('引擎加载失败: ' + e.message);
    }
  }

  // ===== 加载世界数据 =====
  async function _loadWorld() {
    try {
      // 尝试从持久化层加载
      const savedCells = await PersistLayer.loadAllCells();

      if (savedCells && savedCells.length > 0) {
        CellCore.loadCells(savedCells);
        console.log(`[Loader] 从存档加载了 ${savedCells.length} 个基圆`);

        // 恢复行为代码到沙箱
        for (const cell of savedCells) {
          if (cell.code && cell.state === 'normal') {
            Sandbox.loadBehaviorCode(cell.id, cell.code, cell.triggerConfig.mode);
          }
        }
      } else {
        // 加载默认示例世界
        const defaultCells = PersistLayer.getDefaultWorldCells();
        CellCore.loadCells(defaultCells);
        console.log(`[Loader] 加载默认示例世界，${defaultCells.length} 个基圆`);

        // 加载行为代码到沙箱
        for (const cell of defaultCells) {
          if (cell.code) {
            Sandbox.loadBehaviorCode(cell.id, cell.code, cell.triggerConfig.mode);
          }
        }

        // 保存默认世界
        await PersistLayer.saveCells(defaultCells);
      }
    } catch (e) {
      console.error('[Loader] 世界加载失败:', e);
      // 使用默认世界
      const defaultCells = PersistLayer.getDefaultWorldCells();
      CellCore.loadCells(defaultCells);
    }
  }

  // ===== 注册游戏循环回调 =====
  function _registerLoopCallbacks() {
    // 碰撞检测（每帧）
    GameLoop.onUpdate((dt) => {
      const collisions = CellCore.checkCollisions();
      for (const { idA, idB, kindA, kindB } of collisions) {
        Sandbox.sendEvent(idA, 'onCollision', { otherId: idB, otherKind: kindB });
        Sandbox.sendEvent(idB, 'onCollision', { otherId: idA, otherKind: kindA });
      }
    });

    // 动画更新
    GameLoop.onUpdate((dt) => {
      Sandbox.updateAnimations();
    });

    // 视口联动休眠
    GameLoop.onPostUpdate((dt) => {
      const cells = CellCore.getAllCells();
      for (const cell of cells) {
        if (cell.triggerConfig.mode === 'dormant') {
          if (RenderBridge.isInViewport(cell)) {
            CellCore.wakeCell(cell.id);
          }
        } else if (cell.triggerConfig.mode === 'continuous' || cell.triggerConfig.mode === 'pulse') {
          if (!RenderBridge.isInViewport(cell) && cell.kind !== 'engine') {
            CellCore.setCellDormant(cell.id);
          }
        }
      }
    });

    // 帧率显示 + 选择框渲染
    GameLoop.onPostUpdate((dt) => {
      _updateStatusBar();
      if (_selectedCellId) {
        RenderBridge.drawSelection(_selectedCellId);
      }
    });

    // 事件监听
    CellCore.on('cell:click', (data) => {
      Sandbox.sendEvent(data.cellId, 'onClick', { worldX: data.worldX, worldY: data.worldY });
    });

    CellCore.on('cell:longpress', (data) => {
      // 长按事件已由InputBridge处理菜单显示
    });

    CellCore.on('cell:select', (data) => {
      _selectedCellId = data.cellId;
      _currentTab = 'basic'; // 选中基圆时重置到基本属性页
      const panel = document.getElementById('propertyPanel');
      panel.querySelectorAll('.panel-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === 'basic');
      });
      _showPropertyPanel(data.cellId);
    });

    CellCore.on('cell:deselect', (data) => {
      _selectedCellId = null;
      _hidePropertyPanel();
    });

    CellCore.on('game:message', (data) => {
      _showToast(data.text || JSON.stringify(data));
    });
  }

  // ===== 绑定UI事件 =====
  function _bindUIEvents() {
    // 监听基圆属性变化，实时更新面板
    CellCore.on('attribute:changed', (data) => {
      if (_selectedCellId === data.cellId) {
        const cell = CellCore.getCell(data.cellId);
        if (cell && cell.attributes && data.key in cell.attributes) {
          const input = document.querySelector(`input[data-attr="${data.key}"]`);
          if (input) {
            input.value = data.value;
          }
        }
      }
    });

    // 监听基圆代码加载完成，完整刷新面板
    CellCore.on('cell:codeLoaded', (data) => {
      if (_editingCellId === data.cellId) {
        // 完整刷新面板（包括标题、基本属性、扩展属性）
        const panel = document.getElementById('propertyPanel');
        if (panel && !panel.classList.contains('hidden')) {
          const cell = CellCore.getCell(_editingCellId);
          if (cell) {
            panel.querySelector('.panel-title').textContent = cell.name || '属性';
          }
          _renderTab(_currentTab, _editingCellId,
            cell && cell.kind === 'engine' && cell.builtIn);
        }
      }
    });

    // 监听基圆属性更新，实时更新面板输入框
    CellCore.on('cell:updated', (data) => {
      if (_editingCellId === data.cellId) {
        const cell = CellCore.getCell(data.cellId);
        if (!cell) return;

        // 更新标题
        const title = document.querySelector('#propertyPanel .panel-title');
        if (title) title.textContent = cell.name || '属性';

        // 更新基本属性输入框
        const basicProps = {
          'name': cell.name || '',
          'kind': cell.kind,
          'role': cell.role || '',
          'x': cell.x != null ? cell.x.toFixed(1) : '0',
          'y': cell.y != null ? cell.y.toFixed(1) : '0',
          'radius': cell.radius != null ? cell.radius : 25,
          'rotation': cell.rotation != null ? cell.rotation.toFixed(1) : '0.0',
          'opacity': cell.opacity != null ? cell.opacity : 1,
          'zIndex': cell.zIndex != null ? cell.zIndex : 0,
          'color': cell.color || '#ffffff',
          'shape': cell.shape || 'circle',
        };
        for (const [key, value] of Object.entries(basicProps)) {
          const input = document.querySelector(`[data-prop="${key}"]`);
          if (input) {
            if (input.tagName === 'SELECT') {
              input.value = value;
            } else {
              input.value = value;
            }
          }
        }

        // 更新扩展属性
        const attrs = cell.attributes || {};
        for (const [key, value] of Object.entries(attrs)) {
          const input = document.querySelector(`input[data-attr="${key}"]`);
          if (input) {
            input.value = value;
          }
        }
      }
    });

    // 上下文菜单项点击
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        _handleMenuAction(action);
        InputBridge.hideContextMenu();
      });
    });

    // 点击其他区域关闭菜单
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu') && !e.target.closest('.menu-item')) {
        InputBridge.hideContextMenu();
      }
    });

    // 属性面板关闭
    document.getElementById('panelClose').addEventListener('click', () => {
      _hidePropertyPanel();
      _selectedCellId = null;
    });

    // AI输入关闭
    document.getElementById('aiInputClose').addEventListener('click', () => {
      document.getElementById('aiInput').classList.add('hidden');
    });

    // AI生成按钮
    document.getElementById('aiGenerate').addEventListener('click', async () => {
      await _handleAiGenerate();
    });

    // AI代码确认
    document.getElementById('aiCodeAccept').addEventListener('click', () => {
      _handleAiCodeAccept();
    });

    // AI代码拒绝
    document.getElementById('aiCodeReject').addEventListener('click', () => {
      document.getElementById('aiCodePreview').classList.add('hidden');
    });

    // 提供者配置面板（与地图设置按钮一样，如果元素存在才绑定）
    const addProviderBtn = document.getElementById('addProvider');
    if (addProviderBtn) {
      addProviderBtn.addEventListener('click', () => {
        _addProviderCard();
      });
    }

    const providerClose = document.getElementById('providerClose');
    if (providerClose) {
      providerClose.addEventListener('click', () => {
        document.getElementById('providerConfig').classList.add('hidden');
      });
    }

    // 教程
    const tutorialNext = document.getElementById('tutorialNext');
    if (tutorialNext) {
      tutorialNext.addEventListener('click', () => {
        _nextTutorial();
      });
    }

    // AI提供者配置按钮（2025-06-13 已从顶部栏移除，相关入口统一迁移到开发者控制台）
    const btnProviderCfg = document.getElementById('btnProviderConfig');
    if (btnProviderCfg) {
      btnProviderCfg.addEventListener('click', () => {
        _showProviderConfig();
      });
    }

    // 开发者控制台按钮
    const btnDev = document.getElementById('btnDevConsole');
    if (btnDev) {
      btnDev.addEventListener('click', () => {
        if (typeof window.DevConsole !== 'undefined') {
          DevConsole.toggle(_selectedCellId);
        }
      });
    }

    // 手动保存按钮（2025-06-13 已从顶部栏移除，入口统一在开发者控制台输入"保存"）
    const btnSave = document.getElementById('btnSave');
    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        await PersistLayer.saveFullSnapshot(
          () => CellCore.getAllCellDataForSave(),
          RenderBridge.getCamera()
        );
        _showToast('保存成功');
      });
    }
  }

  // ===== 菜单动作处理 =====
  function _handleMenuAction(action) {
    switch (action) {
      case 'create':
        _showCreateDialog();
        break;
      case 'navigate':
        InputBridge.setMode('navigate');
        break;
      case 'edit':
        InputBridge.setMode('edit');
        break;
      case 'exitLayer':
        exitCellLayer();
        break;
      case 'editCell':
        // 使用上下文菜单打开时点击的基圆 ID，而不是 _selectedCellId
        const cellId = InputBridge.getContextMenuCellId();
        if (cellId) {
          _selectedCellId = cellId;
          _showPropertyPanel(cellId);
        }
        break;
    }
  }

  // ===== 创建基圆对话框 =====
  function _showCreateDialog() {
    // 获取上下文菜单打开时的鼠标世界坐标
    const worldPos = InputBridge.getContextMenuWorldPos();
    const camera = RenderBridge.getCamera();
    
    // 获取当前位置（绝对坐标）
    let absX = worldPos ? worldPos.x : camera.x;
    let absY = worldPos ? worldPos.y : camera.y;
    
    // 如果在某个基圆层内部，需要转换为相对坐标
    const parentId = CellCore.getCurrentParentId();
    if (parentId) {
      const parent = CellCore.getCell(parentId);
      if (parent) {
        // 转换为相对于父基圆的坐标
        absX = absX - parent.x;
        absY = absY - parent.y;
      }
    }
    
    const cell = CellCore.createCell('empty', absX, absY, parentId);
    _selectedCellId = cell.id;
    InputBridge.setMode('edit');
    _showPropertyPanel(cell.id);
    _showToast('已创建新基圆');
  }

  // ===== 属性面板 =====
  let _currentTab = 'basic'; // 当前激活的tab
  let _currentMapPreset = 'grassland'; // 当前地图预设

  function _showPropertyPanel(cellId) {
    const cell = CellCore.getCell(cellId);
    if (!cell) return;

    const panel = document.getElementById('propertyPanel');
    panel.classList.remove('hidden');

    const isBuiltInEngine = cell.kind === 'engine' && cell.builtIn;

    // 更新标题
    panel.querySelector('.panel-title').textContent = cell.name || '属性';

    // 渲染当前tab内容
    _renderTab(_currentTab, cellId, isBuiltInEngine);

    // 绑定tab切换
    panel.querySelectorAll('.panel-tab').forEach(tab => {
      tab.onclick = () => {
        _currentTab = tab.dataset.tab;
        panel.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const cid = _editingCellId;
        if (!cid) return;
        const c = CellCore.getCell(cid);
        _renderTab(_currentTab, cid, c && c.kind === 'engine' && c.builtIn);
      };
    });

    _editingCellId = cellId;
  }

  function _renderTab(tabName, cellId, isBuiltInEngine) {
    const cell = CellCore.getCell(cellId);
    if (!cell) return;
    const body = document.getElementById('panelBody');

    switch (tabName) {
      case 'basic':
        const basicHtml = _renderBasicTab(cell, isBuiltInEngine);
        body.innerHTML = basicHtml;
        _bindBasicTabEvents(cellId, isBuiltInEngine);
        break;
      case 'ai':
        body.innerHTML = _renderAiTab(cell, isBuiltInEngine);
        _bindAiTabEvents(cellId);
        break;
      case 'code':
        body.innerHTML = _renderCodeTab(cell, isBuiltInEngine);
        _bindCodeTabEvents(cellId);
        break;
      case 'ports':
        body.innerHTML = _renderPortsTab(cell);
        _bindPortsTabEvents(cellId);
        break;
      case 'runner':
        body.innerHTML = _renderRunnerTab(cell);
        _bindRunnerTabEvents(cellId);
        break;
      case 'map':
        // 地图面板已迁移到开发者控制台（输入"地图"/"建一张沙漠地图"即可）
        body.innerHTML = '<div style="padding:20px;color:#888;text-align:center;">🗺️ 地图功能已迁移到控制台<br><br>请打开💬开发者控制台，输入「地图」查看预设，或「建一张沙漠地图」自动生成场景。</div>';
        break;
      default:
        // 未知tab，不处理
    }
  }

  // ===== 物种详细卡片 =====
  function _renderSpeciesCard(cell) {
    const a = cell.attributes || {};
    const kind = cell.kind;
    // 判断该基圆是否有物种信息
    const hasSpecies = a.speciesName || a.species || (a.speciesLatin);
    if (!hasSpecies) return null;

    let title = '生物详情';
    let subtitle = '';
    let rows = [];

    // 蚂蚁特有字段
    if (a.antId) {
      title = '蚂蚁个体档案';
      subtitle = `${a.speciesName || '未知蚁种'} · ${a.roleName || ''}`;
      rows = [
        ['学名', a.speciesLatin || '-'],
        ['性格', a.personalityName || '普通'],
        ['所属蚁群', a.colonyId || '未编组'],
        ['世代', (a.generation || '1') + ' 代'],
        ['攻击力', a.attackPower || '-'],
        ['防御力', a.defense || '-'],
        ['最大负重', (a.maxCarry || '-') + ' 能量'],
        ['个体变异', '大小 ' + (a.sizeVar ? parseFloat(a.sizeVar).toFixed(2) + 'x' : '-') + ' ｜速度 ' + (a.speedVar ? parseFloat(a.speedVar).toFixed(2) + 'x' : '-')],
        ['当前状态', _translateAntState(a.state)],
    // 角色详解
      ];
    }
    // 植物特有字段
    else if (kind === 'plant' || a.type === 'grass' || a.type === 'herb' || a.type === 'fruit' || a.type === 'mushroom') {
      title = '植物档案';
      subtitle = `${a.speciesName || '未知植物'}`;
      rows = [
        ['学名', a.speciesLatin || '-'],
        ['类型', _translatePlantType(a.type)],
        ['生长阶段', _translateGrowthStage(a.growthStage)],
        ['成熟高度', (a.maxHeight || '-') + ' px'],
        ['当前叶片数', a.leaves || '-'],
        ['剩余草籽', (a.seedsRemaining || 0) + ' 粒'],
        ['草籽能量', (a.seedEnergy || '-') + ' /粒'],
        ['蚂蚁偏好', a.preferred != null ? (a.preferred * 100).toFixed(0) + '%' : '-'],
        ['湿度', a.moisture != null ? (a.moisture * 100).toFixed(0) + '%' : '-']
      ];
    }
    // 昆虫特有字段
    else if (kind === 'insect' || a.kind === 'flying' || a.kind === 'ground') {
      title = a.hostile ? '⚠ 敌对昆虫档案' : '昆虫档案';
      subtitle = `${a.speciesName || '未知昆虫'}`;
      rows = [
        ['学名', a.speciesLatin || '-'],
        ['习性', a.flying ? '飞行' : '地面爬行'],
        ['攻击性', a.aggression != null ? (a.aggression * 100).toFixed(0) + '%' : '-'],
        ['攻击力', a.attackPower || 0],
        ['防御力', a.defense || 0],
        ['移动速度', a.speed || '-'],
        ['能量值', a.energyValue || '-'],
        ['当前HP', a.hp || '-']
      ];
    }

    // 没有匹配的类型
    else return null;

    // 组装卡片
    let html = '<div class="species-card" style="margin:8px 12px 8px 12px;padding:10px 12px;border:1px solid #3a3a4a;border-radius:6px;background:#1a1a22;">';
    html += `<div style="font-weight:bold;color:#dcc;color:#d8d8f0;font-size:13px;margin-bottom:4px;">${title}</div>`;
    html += `<div style="font-size:11px;color:#888;margin-bottom:8px;">${subtitle}</div>`;

    for (const [label, value] of rows) {
      html += `<div style="display:flex;font-size:11px;line-height:1.5;margin:2px 0;"><span style="min-width:60px;color:#78909c;">${label}:</span><span style="flex:1;color:#cfd8dc;">${value}</span></div>`;
    }

    // 描述文本
    if (a.description_text) {
      html += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #333344;font-size:10px;color:#b0bec5;line-height:1.5;">${_escapeHtml(a.description_text)}</div>`;
    }

    html += '</div>';
    return html;
  }

  function _translateAntState(state) {
    const map = {
      idle: '休息中',
      foraging: '觅食中',
      returning: '回巢中',
      carrying: '搬运中',
      attacking: '战斗中',
      fleeing: '逃跑中',
      exploring: '探索中',
      dead: '已死亡'
    };
    return map[state] || (state || '—');
  }

  function _translatePlantType(type) {
    const map = { grass: '禾草', herb: '阔叶草本', fruit: '野果植物', mushroom: '菌类', moss: '苔藓类' };
    return map[type] || (type || '植物');
  }

  function _translateGrowthStage(stage) {
    const map = {
      seedling: '幼苗期', mature: '成熟期', flowering: '开花结籽期', decaying: '衰老期' };
    return map[stage] || (stage || '—');
  }

  // ===== P1: 基本属性页 =====
  function _renderBasicTab(cell, isBuiltInEngine) {
    let html = '';

    try {
    // 基础属性
    html += '<div class="prop-group">';
    html += '<div class="prop-group-title">基础属性</div>';
    html += `<div class="prop-row"><span class="prop-label">名称</span><input class="prop-input" data-prop="name" value="${_escapeHtml(cell.name || '')}"></div>`;
    html += `<div class="prop-row"><span class="prop-label">种类</span><select class="prop-select" data-prop="kind">`;
    for (const k of CellCore.getAllKinds()) {
      html += `<option value="${k.kind}" ${k.kind === cell.kind ? 'selected' : ''}>${k.name}</option>`;
    }
    html += '</select></div>';
    html += `<div class="prop-row"><span class="prop-label">角色</span><input class="prop-input" data-prop="role" value="${_escapeHtml(cell.role || '')}"></div>`;
    html += `<div class="prop-row"><span class="prop-label">X</span><input class="prop-input" type="number" data-prop="x" value="${(cell.x != null ? cell.x.toFixed(1) : '0')}" ${isBuiltInEngine ? 'disabled' : ''}></div>`;
    html += `<div class="prop-row"><span class="prop-label">Y</span><input class="prop-input" type="number" data-prop="y" value="${(cell.y != null ? cell.y.toFixed(1) : '0')}" ${isBuiltInEngine ? 'disabled' : ''}></div>`;
    html += `<div class="prop-row"><span class="prop-label">半径</span><input class="prop-input" type="range" data-prop="radius" min="5" max="100" value="${cell.radius != null ? cell.radius : 25}"></div>`;
    html += `<div class="prop-row"><span class="prop-label">旋转</span><input class="prop-input" type="range" data-prop="rotation" min="0" max="6.28" step="0.1" value="${(cell.rotation != null ? cell.rotation.toFixed(1) : '0.0')}"></div>`;
    html += `<div class="prop-row"><span class="prop-label">透明度</span><input class="prop-input" type="range" data-prop="opacity" min="0" max="1" step="0.05" value="${cell.opacity != null ? cell.opacity : 1}"></div>`;
    html += `<div class="prop-row"><span class="prop-label">层级</span><input class="prop-input" type="number" data-prop="zIndex" value="${cell.zIndex != null ? cell.zIndex : 0}"></div>`;
    html += `<div class="prop-row"><span class="prop-label">颜色</span><input class="prop-input" type="color" data-prop="color" value="${cell.color || '#ffffff'}"></div>`;
    html += `<div class="prop-row"><span class="prop-label">形状</span><select class="prop-select" data-prop="shape">`;
    const shapes = ['circle', 'rect', 'triangle', 'polygon', 'sprite'];
    for (const s of shapes) {
      html += `<option value="${s}" ${s === (cell.shape || 'circle') ? 'selected' : ''}>${s}</option>`;
    }
    html += '</select></div>';
    html += '</div>';

    // 触发模式
    const triggerConfig = cell.triggerConfig || { mode: 'event', threshold: 60 };
    html += '<div class="prop-group">';
    html += '<div class="prop-group-title">触发模式</div>';
    html += `<div class="prop-row"><span class="prop-label">模式</span><select class="prop-select" data-prop="triggerMode">`;
    const modes = [
      { value: 'continuous', label: '连续' },
      { value: 'event', label: '事件驱动' },
      { value: 'pulse', label: '脉冲' },
      { value: 'dormant', label: '休眠' }
    ];
    for (const m of modes) {
      html += `<option value="${m.value}" ${m.value === triggerConfig.mode ? 'selected' : ''}>${m.label}</option>`;
    }
    html += '</select></div>';
    if (triggerConfig.mode === 'pulse') {
      html += `<div class="prop-row"><span class="prop-label">阈值</span><input class="prop-input" type="number" data-prop="triggerThreshold" min="1" max="600" value="${triggerConfig.threshold}"></div>`;
    }
    html += '</div>';

    // 扩展属性（始终显示，包含energy）
    html += '<div class="prop-group">';
    html += '<div class="prop-group-title">扩展属性</div>';
    const attrs = cell.attributes || {};
    const displayedAttrs = { ...attrs };
    if (!('energy' in displayedAttrs) || displayedAttrs.energy === undefined || displayedAttrs.energy === null) {
      displayedAttrs.energy = 100;
    }
    for (const [key, value] of Object.entries(displayedAttrs)) {
      const inputType = typeof value === 'number' ? 'number' : 'text';
      html += `<div class="prop-row"><span class="prop-label">${_escapeHtml(key)}</span><input class="prop-input" type="${inputType}" data-attr="${_escapeHtml(key)}" value="${_escapeHtml(String(value))}"></div>`;
    }
    html += '</div>';

    // 嵌套操作
    html += '<div class="prop-group">';
    html += '<div class="prop-group-title">嵌套</div>';
    html += `<button class="btn-primary" onclick="Loader.enterCellLayer('${cell.id}')" style="width:100%;margin-bottom:8px">进入基圆层</button>`;
    if (cell.parentId) {
      html += `<button class="btn-secondary" onclick="Loader.exitCellLayer()" style="width:100%">返回上层</button>`;
    }
    html += '</div>';

    // 删除按钮（非内置引擎基圆可删除）
    if (!isBuiltInEngine) {
      html += `<button class="btn-delete" onclick="Loader.deleteCell('${cell.id}')">删除基圆</button>`;
    } else {
      html += '<div style="padding:10px;color:#888;font-size:12px;text-align:center">内置引擎基圆不可删除</div>';
    }

    } catch (e) {
      console.error('[DEBUG _renderBasicTab] render error:', e, 'cell:', cell);
      html = '<div style="color:red;padding:20px;">渲染错误: ' + e.message + '</div>';
    }

    return html;
  }

  function _bindBasicTabEvents(cellId, isBuiltInEngine) {
    const body = document.getElementById('panelBody');
    body.querySelectorAll('[data-prop]').forEach(input => {
      input.addEventListener('change', (e) => {
        const cid = _editingCellId;
        if (!cid) return;
        _handlePropChange(cid, e.target);
      });
    });
    body.querySelectorAll('[data-attr]').forEach(input => {
      input.addEventListener('change', (e) => {
        const cid = _editingCellId;
        if (!cid) return;
        const key = e.target.dataset.attr;
        let value = e.target.value;
        const cell = CellCore.getCell(cid);
        if (cell && typeof cell.attributes[key] === 'number') {
          value = parseFloat(value) || 0;
        }
        CellCore.setAttribute(cid, key, value);
      });
    });
  }

  // ===== P2: AI 描述页（物种科普信息 + AI行为描述）=====
  function _renderAiTab(cell, isBuiltInEngine) {
    let html = '';

    // === 检测物种信息，显示科普描述 ===
    const attrs = cell.attributes || {};
    const hasSpecies = attrs.speciesName || attrs.species || attrs.antId;
    const isAnt = !!attrs.antId;
    const isPlant = cell.kind === 'plant' || attrs.type === 'grass' || attrs.type === 'herb' || attrs.type === 'fruit' || attrs.type === 'mushroom';
    const isInsect = cell.kind === 'insect' || attrs.flying !== undefined || attrs.hostile !== undefined;

    if (hasSpecies) {
      // 物种科普卡片（第二页核心内容）
      html += '<div class="prop-group">';
      html += '<div class="prop-group-title">📚 物种科普 · 时间系统 v3.0</div>';

      if (isAnt) {
        // 蚂蚁科普
        html += '<div class="species-desc-card" style="background:#1a1a22;border:1px solid #3a3a4a;border-radius:6px;padding:10px 12px;margin-bottom:8px;">';
        html += `<div style="font-weight:bold;color:#d8d8f0;font-size:13px;margin-bottom:4px;">🐜 ${_escapeHtml(attrs.speciesName || '未知蚂蚁')} · ${_escapeHtml(attrs.roleName || '工蚁')}</div>`;
        html += `<div style="font-size:11px;color:#888;margin-bottom:8px;">${_escapeHtml(attrs.speciesLatin || '')}</div>`;
        html += '<div style="font-size:11px;color:#b0bec5;line-height:1.8;">';
        html += `性格：${_escapeHtml(attrs.personalityName || '普通')}<br>`;
        html += `所属蚁群：${_escapeHtml(attrs.colonyId || '未编组')} · 第 ${attrs.generation || 1} 代<br>`;
        html += `饱食度：${attrs.energy || 100}/100（每 10 秒 -1，不觅食约 17 分钟饿死）<br>`;
        html += `自然寿命：约 60-120 分钟（游戏时间）`;
        html += '</div>';
        if (attrs.description_text) {
          html += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #333344;font-size:10px;color:#90a4ae;line-height:1.5;">${_escapeHtml(attrs.description_text).substring(0, 300)}...</div>`;
        }
        html += '</div>';

        // 游戏参数预览（v3.0 校准后）
        html += '<div style="font-size:11px;color:#78909c;line-height:1.8;">';
        html += `速度：${(attrs.speed || 0.7).toFixed(2)} px/帧 ≈ ${((attrs.speed || 0.7) * 60).toFixed(1)} px/秒<br>`;
        html += `HP：${attrs.hp || 30} | 攻击：${attrs.attackPower || 2}（每 2 秒一次）<br>`;
        html += `防御：${((attrs.defense || 0) * 100).toFixed(0)}% | 负重：${attrs.maxCarry || 15} 能量`;
        html += '</div>';

      } else if (isPlant) {
        // 植物科普
        html += '<div class="species-desc-card" style="background:#1a1a22;border:1px solid #3a3a4a;border-radius:6px;padding:10px 12px;margin-bottom:8px;">';
        html += `<div style="font-weight:bold;color:#8bc34a;font-size:13px;margin-bottom:4px;">🌿 ${_escapeHtml(attrs.speciesName || '未知植物')}</div>`;
        html += `<div style="font-size:11px;color:#888;margin-bottom:8px;">${_escapeHtml(attrs.speciesLatin || '')}</div>`;
        html += '<div style="font-size:11px;color:#b0bec5;line-height:1.8;">';
        html += `类型：${_translatePlantType(attrs.type)}<br>`;
        html += `草籽能量：${attrs.seedEnergy || '-'} 能量/粒<br>`;
        html += `剩余草籽：${attrs.seedsRemaining || 0} 粒（每 20 秒散 1 粒）<br>`;
        html += `蚂蚁偏好：${Math.round((attrs.preferred || 0.5) * 100)}%（决定蚂蚁觅食优先级）`;
        html += '</div>';
        if (attrs.description_text) {
          html += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #333344;font-size:10px;color:#90a4ae;line-height:1.5;">${_escapeHtml(attrs.description_text).substring(0, 300)}...</div>`;
        }
        html += '</div>';

      } else if (isInsect) {
        // 昆虫科普
        html += '<div class="species-desc-card" style="background:#1a1a22;border:1px solid #3a3a4a;border-radius:6px;padding:10px 12px;margin-bottom:8px;">';
        const hostileMark = attrs.hostile ? '⚠️ 敌对' : '';
        html += `<div style="font-weight:bold;color:#ff7043;font-size:13px;margin-bottom:4px;">🦋 ${_escapeHtml(attrs.speciesName || '未知昆虫')} ${hostileMark}</div>`;
        html += `<div style="font-size:11px;color:#888;margin-bottom:8px;">${_escapeHtml(attrs.speciesLatin || '')}</div>`;
        html += '<div style="font-size:11px;color:#b0bec5;line-height:1.8;">';
        html += `习性：${attrs.flying ? '飞行' : '地面爬行'}<br>`;
        html += `速度：${(attrs.speed || 0.5).toFixed(2)} px/帧 ≈ ${((attrs.speed || 0.5) * 60).toFixed(1)} px/秒<br>`;
        html += `HP：${attrs.hp || 30}<br>`;
        html += `能量值：${attrs.energyValue || 10}（蚂蚁捕食后蚂蚁可吸取）<br>`;
        if (attrs.hostile) {
          html += `攻击力：${attrs.attackPower || 3}（每 2 秒一次，对蚂蚁构成威胁）`;
        }
        html += '</div>';
        if (attrs.description_text) {
          html += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #333344;font-size:10px;color:#90a4ae;line-height:1.5;">${_escapeHtml(attrs.description_text).substring(0, 300)}...</div>`;
        }
        html += '</div>';
      }
      html += '</div>';
    }

    // === AI 行为描述 ===
    html += '<div class="prop-group">';
    html += '<div class="prop-group-title">AI 行为描述</div>';
    html += `<textarea class="prop-textarea" id="aiDescInput" style="min-height:80px" placeholder="用自然语言描述这个基圆的行为，例如：&#10;- 每帧向右移动2像素&#10;- 被点击时变色&#10;- 碰到其他生物时逃跑">${_escapeHtml(cell.description)}</textarea>`;
    html += `<button class="btn-primary" id="aiGenerateBtn" style="width:100%;margin-top:8px">AI 生成代码</button>`;
    html += '</div>';

    // AI 生成结果预览
    html += '<div class="prop-group" id="aiResultGroup" style="display:none">';
    html += '<div class="prop-group-title">生成结果</div>';
    html += '<div class="code-preview"><pre><code id="aiResultCode"></code></pre></div>';
    html += '<div class="code-actions">';
    html += '<button class="btn-primary" id="aiAcceptBtn">确认加载</button>';
    html += '<button class="btn-secondary" id="aiRejectBtn">重新生成</button>';
    html += '</div>';
    html += '</div>';

    // 世界信息摘要（AI上下文参考）
    html += '<div class="prop-group">';
    html += '<div class="prop-group-title">AI 上下文</div>';
    const allCells = CellCore.getAllCells();
    const kindCounts = {};
    for (const c of allCells) kindCounts[c.kind] = (kindCounts[c.kind] || 0) + 1;
    html += `<div style="font-size:11px;color:#888;line-height:1.6">`;
    html += `世界: ${allCells.length} 个基圆<br>`;
    html += Object.entries(kindCounts).map(([k,v]) => `${k}×${v}`).join(' | ');
    const nearbyCells = CellCore.queryCells({ near: { x: cell.x, y: cell.y, radius: 300 } })
      .filter(c => c.id !== cell.id).slice(0, 5);
    if (nearbyCells.length > 0) {
      html += '<br>附近: ' + nearbyCells.map(c => `${c.name}(${c.kind})`).join(', ');
    }
    html += '</div></div>';

    return html;
  }

  function _bindAiTabEvents(cellId) {
    const genBtn = document.getElementById('aiGenerateBtn');
    const descInput = document.getElementById('aiDescInput');

    if (genBtn) {
      genBtn.addEventListener('click', async () => {
        const cid = _editingCellId;
        if (!cid) return;
        const description = descInput.value.trim();
        if (!description) {
          _showToast('请输入描述');
          return;
        }
        CellCore.updateCell(cid, { description });
        try {
          genBtn.textContent = '生成中...';
          genBtn.disabled = true;
          const result = await AiBridge.generateCode(cid, description);
          // result 可能是字符串（旧兼容）或对象（新格式）
          const code = typeof result === 'string' ? result : result.code;
          const propertyUpdates = typeof result === 'object' ? result.propertyUpdates : {};
          document.getElementById('aiResultCode').textContent = code;
          document.getElementById('aiResultGroup').style.display = '';
          document.getElementById('aiResultGroup').dataset.generatedCode = code;
          document.getElementById('aiResultGroup').dataset.propertyUpdates = JSON.stringify(propertyUpdates);
          genBtn.textContent = 'AI 生成代码';
          genBtn.disabled = false;
        } catch (e) {
          _showToast('生成失败: ' + e.message);
          genBtn.textContent = 'AI 生成代码';
          genBtn.disabled = false;
        }
      });
    }

    const acceptBtn = document.getElementById('aiAcceptBtn');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => {
        const cid = _editingCellId;
        if (!cid) return;
        const code = document.getElementById('aiResultGroup')?.dataset.generatedCode;
        if (!code) return;
        const propertyUpdatesStr = document.getElementById('aiResultGroup')?.dataset.propertyUpdates;
        const propertyUpdates = propertyUpdatesStr ? JSON.parse(propertyUpdatesStr) : {};
        const cell = CellCore.getCell(cid);
        AiBridge.confirmAndLoadCode(cid, code, propertyUpdates);
        if (cell && cell.description) {
          AiMemory.addPattern(cid, cell.description, code, cell.kind);
        }
        _showToast('代码已加载');
        _currentTab = 'code';
        const panel = document.getElementById('propertyPanel');
        panel.querySelectorAll('.panel-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.tab === 'code');
        });
        _renderTab('code', cid, CellCore.getCell(cid)?.kind === 'engine' && CellCore.getCell(cid)?.builtIn);
      });
    }

    const rejectBtn = document.getElementById('aiRejectBtn');
    if (rejectBtn) {
      rejectBtn.addEventListener('click', () => {
        document.getElementById('aiResultGroup').style.display = 'none';
        genBtn?.click();
      });
    }

    if (descInput) {
      descInput.addEventListener('change', () => {
        const cid = _editingCellId;
        if (!cid) return;
        CellCore.updateCell(cid, { description: descInput.value });
      });
    }
  }

  // ===== P3: 代码页（物种行为代码模板）=====
  function _renderCodeTab(cell, isBuiltInEngine) {
    let html = '';

    // === 物种代码模板选择（如果有物种信息）===
    const attrs = cell.attributes || {};
    const hasSpecies = attrs.speciesName || attrs.antId;
    const isAnt = !!attrs.antId;
    const isPlant = cell.kind === 'plant' || attrs.type === 'grass' || attrs.type === 'herb' || attrs.type === 'fruit' || attrs.type === 'mushroom';
    const isInsect = cell.kind === 'insect' || attrs.flying !== undefined;

    if (hasSpecies && window.SpeciesRegistry) {
      html += '<div class="prop-group">';
      html += '<div class="prop-group-title">🎯 物种行为代码模板</div>';

      if (isAnt) {
        // 蚂蚁物种选择
        const antSpecies = window.SpeciesRegistry.getAllAnts();
        const roles = attrs.species ? window.SpeciesRegistry.getAntRoles(attrs.species) : null;
        html += '<div style="margin-bottom:8px;">';
        html += '<label style="font-size:11px;color:#888;">蚂蚁物种：</label><br>';
        html += '<select id="speciesSelectAnt" style="width:100%;padding:4px;font-size:12px;margin-top:4px;">';
        html += `<option value="">-- 选择物种 --</option>`;
        for (const [key, sp] of Object.entries(antSpecies)) {
          const sel = attrs.species === key ? 'selected' : '';
          html += `<option value="${key}" ${sel}>${sp.name} (${sp.latin})</option>`;
        }
        html += '</select>';
        html += '</div>';

        // 角色选择
        if (roles) {
          html += '<div style="margin-bottom:8px;">';
          html += '<label style="font-size:11px;color:#888;">蚁种角色：</label><br>';
          html += '<select id="roleSelect" style="width:100%;padding:4px;font-size:12px;margin-top:4px;">';
          html += `<option value="">-- 选择角色 --</option>`;
          for (const [key, role] of Object.entries(roles)) {
            const sel = attrs.role === key ? 'selected' : '';
            html += `<option value="${key}" ${sel}>${role.name}</option>`;
          }
          html += '</select>';
          html += '</div>';
        }

        html += `<button class="btn-secondary" id="loadAntCodeBtn" style="width:100%;">📋 加载蚂蚁行为代码</button>`;
        html += '<div id="antCodePreview" style="display:none;margin-top:8px;">';
        html += '<div style="font-size:11px;color:#78909c;margin-bottom:4px;">代码预览：</div>';
        html += '<textarea id="antCodeTemplate" class="code-editor" style="min-height:150px;font-size:10px;" readonly></textarea>';
        html += '</div>';

      } else if (isPlant) {
        // 植物物种选择
        const plantSpecies = window.SpeciesRegistry.getAllPlants();
        html += '<div style="margin-bottom:8px;">';
        html += '<label style="font-size:11px;color:#888;">植物物种：</label><br>';
        html += '<select id="speciesSelectPlant" style="width:100%;padding:4px;font-size:12px;margin-top:4px;">';
        html += `<option value="">-- 选择物种 --</option>`;
        for (const [key, sp] of Object.entries(plantSpecies)) {
          const sel = attrs.species === key ? 'selected' : '';
          html += `<option value="${key}" ${sel}>${sp.name} (${sp.latin})</option>`;
        }
        html += '</select>';
        html += '</div>';
        html += `<button class="btn-secondary" id="loadPlantCodeBtn" style="width:100%;">📋 加载植物行为代码</button>`;
        html += '<div id="plantCodePreview" style="display:none;margin-top:8px;">';
        html += '<textarea id="plantCodeTemplate" class="code-editor" style="min-height:150px;font-size:10px;" readonly></textarea>';
        html += '</div>';

      } else if (isInsect) {
        // 昆虫物种选择
        const insectSpecies = window.SpeciesRegistry.getAllInsects();
        html += '<div style="margin-bottom:8px;">';
        html += '<label style="font-size:11px;color:#888;">昆虫物种：</label><br>';
        html += '<select id="speciesSelectInsect" style="width:100%;padding:4px;font-size:12px;margin-top:4px;">';
        html += `<option value="">-- 选择物种 --</option>`;
        for (const [key, sp] of Object.entries(insectSpecies)) {
          const sel = attrs.species === key ? 'selected' : '';
          html += `<option value="${key}" ${sel}>${sp.name} (${sp.latin})</option>`;
        }
        html += '</select>';
        html += '</div>';
        html += `<button class="btn-secondary" id="loadInsectCodeBtn" style="width:100%;">📋 加载昆虫行为代码</button>`;
        html += '<div id="insectCodePreview" style="display:none;margin-top:8px;">';
        html += '<textarea id="insectCodeTemplate" class="code-editor" style="min-height:150px;font-size:10px;" readonly></textarea>';
        html += '</div>';
      }
      html += '</div>';
    }

    html += '<div class="prop-group">';
    html += '<div class="prop-group-title">行为代码';
    if (!isBuiltInEngine) {
      html += `
        <div style="float:right;font-size:11px;margin-top:2px">
          代码模式:
          <select id="codeModeSelect" style="font-size:11px;padding:2px">
            <option value="segment" ${(cell.codeMode || 'segment') === 'segment' ? 'selected' : ''}>片段模式</option>
            <option value="file" ${(cell.codeMode || 'segment') === 'file' ? 'selected' : ''}>文件模式</option>
            <option value="folder" ${(cell.codeMode || 'segment') === 'folder' ? 'selected' : ''}>文件夹模式</option>
          </select>
        </div>`;
    }
    html += '</div>';
    html += `<textarea class="code-editor" id="codeEditor" spellcheck="false" ${isBuiltInEngine ? 'disabled' : ''}>${_escapeHtml(cell.code || '')}</textarea>`;

    // 代码状态
    const statusClass = cell.state === 'error' ? 'has-error' : '';
    const statusText = cell.state === 'error'
      ? `错误: ${cell.errorInfo || '未知'}`
      : cell.code ? '代码已加载' : '暂无代码';
    html += `<div class="code-status ${statusClass}">${statusText}</div>`;

    if (!isBuiltInEngine) {
      html += '<div style="display:flex;gap:8px;margin-top:10px">';
      html += '<button class="btn-primary" id="codeSaveBtn" style="flex:1">保存并运行</button>';
      html += '<button class="btn-secondary" id="codeStopBtn" style="flex:1">停止使用</button>';
      html += '<button class="btn-secondary" id="codeFindBtn" style="flex:1">查找基圆</button>';
      html += '</div>';
    }
    html += '</div>';

    // 代码参考
    html += '<div class="prop-group">';
    html += '<div class="prop-group-title">API 参考</div>';
    html += '<div style="font-size:11px;color:#888;line-height:1.8">';
    html += 'api.on(event, cb)<br>';
    html += 'api.emit(event, data)<br>';
    html += 'api.setProperty(key, val)<br>';
    html += 'api.getProperty(key)<br>';
    html += 'api.setTriggerMode(mode, cfg)<br>';
    html += 'api.animate(prop, target, ms)<br>';
    html += 'api.sendMessage(targetId, data)<br>';
    html += 'api.queryCells(filter)<br>';
    html += 'api.log(msg)<br>';
    html += '</div>';
    html += '</div>';

    return html;
  }

  function _bindCodeTabEvents(cellId) {
    const saveBtn = document.getElementById('codeSaveBtn');
    const stopBtn = document.getElementById('codeStopBtn');
    const findBtn = document.getElementById('codeFindBtn');
    const editor = document.getElementById('codeEditor');

    if (saveBtn && editor && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = '1';
      saveBtn.addEventListener('click', () => {
        const cid = _editingCellId;
        if (!cid) return;
        const code = editor.value;
        if (code.trim()) {
          AiBridge.confirmAndLoadCode(cid, code, {});
          CellCore.updateCell(cid, { code });
          _showToast('代码已保存并运行');
        } else {
          _showToast('代码为空');
        }
      });
    }

    if (stopBtn && !stopBtn.dataset.bound) {
      stopBtn.dataset.bound = '1';
      stopBtn.addEventListener('click', () => {
        const cid = _editingCellId;
        if (!cid) return;
        Sandbox.unloadBehaviorCode(cid);
        _showToast('代码已停止执行');
      });
    }

    if (findBtn && !findBtn.dataset.bound) {
      findBtn.dataset.bound = '1';
      findBtn.addEventListener('click', () => {
        const cells = CellCore.getAllCells();
        if (cells.length === 0) {
          _showToast('没有找到基圆');
          return;
        }
        
        let listHtml = '<div style="max-height:300px;overflow-y:auto">';
        cells.forEach((cell) => {
          const hasCode = cell.code && cell.code.trim();
          const isSelected = cell.id === _editingCellId;
          listHtml += `
            <div style="padding:8px;border-bottom:1px solid #eee;cursor:pointer;background:${isSelected ? '#e3f2fd' : 'transparent'}" 
                 onclick="window._selectCell('${cell.id}')">
              <div style="font-weight:bold;color:#333">${cell.name || '无名基圆'}</div>
              <div style="font-size:12px;color:#666">种类: ${cell.kind} | ID: ${cell.id.slice(-8)}</div>
              <div style="font-size:12px;color:#888">位置: (${Math.round(cell.x)}, ${Math.round(cell.y)})</div>
              ${hasCode ? '<div style="font-size:12px;color:#4CAF50">✓ 有代码</div>' : ''}
            </div>
          `;
        });
        listHtml += '</div>';

        const dialog = document.createElement('div');
        dialog.style.cssText = `
          position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
          background:white;padding:20px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.2);
          z-index:1000;width:400px;max-width:90vw;
        `;
        dialog.innerHTML = `
          <h3 style="margin:0 0 15px 0">查找基圆 (共 ${cells.length} 个)</h3>
          ${listHtml}
          <button onclick="this.parentElement.remove()" 
                  style="margin-top:15px;width:100%;padding:8px;background:#f0f0f0;border:none;border-radius:4px">
            关闭
          </button>
        `;
        document.body.appendChild(dialog);

        window._selectCell = function(cellId) {
          const cell = cells.find(c => c.id === cellId);
          if (cell) {
            _selectedCellId = cellId;
            _showPropertyPanel(cellId);
            CellCore.emit('cell:select', { cellId });
            if (window._renderBridge && typeof window._renderBridge.centerOnCell === 'function') {
              window._renderBridge.centerOnCell(cellId);
            } else if (window._camera && typeof window._camera.focus === 'function') {
              window._camera.focus(cell.x, cell.y);
            }
            _showToast(`已选中: ${cell.name || '无名基圆'}`);
          }
          dialog.remove();
        };
      });
    }

    // Tab键支持
    if (editor) {
      editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = editor.selectionStart;
          const end = editor.selectionEnd;
          editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
          editor.selectionStart = editor.selectionEnd = start + 2;
        }
      });
    }

    // 代码模式切换
    const modeSelect = document.getElementById('codeModeSelect');
    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        const cid = _editingCellId || cellId;
        const mode = modeSelect.value;
        CellCore.setCellCodeMode(cid, mode);
        CellCore.updateCell(cid, { codeMode: mode });
        _showToast(`代码模式已切换为: ${mode === 'segment' ? '片段模式' : mode === 'file' ? '文件模式' : '文件夹模式'}`);
      });
    }

    // === 物种代码模板事件绑定 ===
    const loadAntBtn = document.getElementById('loadAntCodeBtn');
    if (loadAntBtn) {
      loadAntBtn.addEventListener('click', () => {
        const speciesSel = document.getElementById('speciesSelectAnt');
        const roleSel = document.getElementById('roleSelect');
        const speciesKey = speciesSel?.value || (cell.attributes?.species || '');
        const roleKey = roleSel?.value || (cell.attributes?.role || '');
        if (!speciesKey) { _showToast('请先选择蚂蚁物种'); return; }

        const preview = document.getElementById('antCodePreview');
        const codeArea = document.getElementById('antCodeTemplate');
        if (window.SpeciesRegistry) {
          const code = window.SpeciesRegistry.getAntBehaviorCode(speciesKey, roleKey);
          if (codeArea) codeArea.value = code;
          if (preview) preview.style.display = '';
        }
      });
    }

    const loadPlantBtn = document.getElementById('loadPlantCodeBtn');
    if (loadPlantBtn) {
      loadPlantBtn.addEventListener('click', () => {
        const speciesSel = document.getElementById('speciesSelectPlant');
        const speciesKey = speciesSel?.value || (cell.attributes?.species || '');
        if (!speciesKey) { _showToast('请先选择植物物种'); return; }

        const preview = document.getElementById('plantCodePreview');
        const codeArea = document.getElementById('plantCodeTemplate');
        if (window.SpeciesRegistry) {
          const code = window.SpeciesRegistry.getPlantBehaviorCode(speciesKey);
          if (codeArea) codeArea.value = code;
          if (preview) preview.style.display = '';
        }
      });
    }

    const loadInsectBtn = document.getElementById('loadInsectCodeBtn');
    if (loadInsectBtn) {
      loadInsectBtn.addEventListener('click', () => {
        const speciesSel = document.getElementById('speciesSelectInsect');
        const speciesKey = speciesSel?.value || (cell.attributes?.species || '');
        if (!speciesKey) { _showToast('请先选择昆虫物种'); return; }

        const preview = document.getElementById('insectCodePreview');
        const codeArea = document.getElementById('insectCodeTemplate');
        if (window.SpeciesRegistry) {
          const code = window.SpeciesRegistry.getInsectBehaviorCode(speciesKey);
          if (codeArea) codeArea.value = code;
          if (preview) preview.style.display = '';
        }
      });
    }
  }

  // ===== P4: 端口/连线页 =====
  function _renderPortsTab(cell) {
    let html = '';
    const cellId = cell.id;

    try {
      // 获取端口信息
      const ports = CellCore.getCellPorts(cellId);
      const inputPorts = ports.inputs || {};
      const outputPorts = ports.outputs || {};
      const inputPortNames = Object.keys(inputPorts);
      const outputPortNames = Object.keys(outputPorts);

      // 获取该基圆的连线
      const wires = CellCore.getCellWires(cellId);
      const allCells = CellCore.getAllCells();
      const otherCells = allCells.filter(c => c.id !== cellId);

      // ========== 输入端口列表 ==========
      html += '<div class="prop-group">';
      html += '<div class="prop-group-title">输入端口';
      if (inputPortNames.length > 0) {
        html += ` <button id="copyInputPortsBtn" style="font-size:11px;padding:2px 6px;margin-left:8px" title="复制所有输入端口">复制</button>`;
      }
      html += '</div>';
      if (inputPortNames.length === 0) {
        html += '<div style="padding:8px;color:#888;font-size:12px;text-align:center">暂无输入端口</div>';
      } else {
        for (const name of inputPortNames) {
          const port = inputPorts[name];
          const portType = port.type || 'any';
          const portValue = port.value !== undefined ? port.value : 'null';
          html += `<div class="prop-row" style="align-items:center">
            <span class="prop-label" style="flex:1">
              <strong>${_escapeHtml(name)}</strong>
              <span style="color:#888;font-size:11px">(${_escapeHtml(portType)})</span>
              <br><span style="font-size:11px;color:#6af">值: ${_escapeHtml(String(portValue))}</span>
            </span>
            <button class="btn-delete" data-action="delete-input-port" data-port-name="${_escapeHtml(name)}" style="padding:4px 10px;font-size:11px">删除</button>
          </div>`;
        }
      }

      // 新增输入端口表单
      html += '<div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:4px">';
      html += '<div style="font-size:11px;color:#888;margin-bottom:6px">新增输入端口';
      html += ` <button id="pasteInputPortsBtn" style="font-size:11px;padding:2px 6px;margin-left:8px;display:none" class="paste-btn">粘贴</button>`;
      html += '</div>';
      html += '<div style="display:flex;gap:6px;align-items:center">';
      html += '<input type="text" id="newInputPortName" placeholder="端口名" style="flex:1;padding:4px;font-size:12px">';
      html += '<select id="newInputPortType" style="padding:4px;font-size:12px">';
      html += '<option value="any">any</option>';
      html += '<option value="number">number</option>';
      html += '<option value="string">string</option>';
      html += '<option value="boolean">boolean</option>';
      html += '</select>';
      html += '<button class="btn-primary" id="addInputPortBtn" style="padding:4px 10px;font-size:12px">添加</button>';
      html += '</div>';
      html += '</div>';
      html += '</div>';

      // ========== 输出端口列表 ==========
      html += '<div class="prop-group">';
      html += '<div class="prop-group-title">输出端口';
      if (outputPortNames.length > 0) {
        html += ` <button id="copyOutputPortsBtn" style="font-size:11px;padding:2px 6px;margin-left:8px" title="复制所有输出端口">复制</button>`;
      }
      html += '</div>';

      if (outputPortNames.length === 0) {
        html += '<div style="padding:8px;color:#888;font-size:12px;text-align:center">暂无输出端口</div>';
      } else {
        for (const name of outputPortNames) {
          const port = outputPorts[name];
          const portType = port.type || 'any';
          const portValue = port.value !== undefined ? port.value : 'null';
          html += `<div class="prop-row" style="align-items:center">
            <span class="prop-label" style="flex:1">
              <strong>${_escapeHtml(name)}</strong>
              <span style="color:#888;font-size:11px">(${_escapeHtml(portType)})</span>
              <br><span style="font-size:11px;color:#f6a">值: ${_escapeHtml(String(portValue))}</span>
            </span>
            <button class="btn-delete" data-action="delete-output-port" data-port-name="${_escapeHtml(name)}" style="padding:4px 10px;font-size:11px">删除</button>
          </div>`;
        }
      }

      // 新增输出端口表单
      html += '<div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:4px">';
      html += '<div style="font-size:11px;color:#888;margin-bottom:6px">新增输出端口</div>';
      html += '<div style="display:flex;gap:6px;align-items:center">';
      html += '<input type="text" id="newOutputPortName" placeholder="端口名" style="flex:1;padding:4px;font-size:12px">';
      html += '<select id="newOutputPortType" style="padding:4px;font-size:12px">';
      html += '<option value="any">any</option>';
      html += '<option value="number">number</option>';
      html += '<option value="string">string</option>';
      html += '<option value="boolean">boolean</option>';
      html += '</select>';
      html += '<button class="btn-primary" id="addOutputPortBtn" style="padding:4px 10px;font-size:12px">添加</button>';
      html += '</div>';
      html += '</div>';
      html += '</div>';

      // ========== 现有连线列表 ==========
      html += '<div class="prop-group">';
      html += '<div class="prop-group-title">现有连线</div>';

      if (!wires || wires.length === 0) {
        html += '<div style="padding:8px;color:#888;font-size:12px;text-align:center">暂无连线</div>';
      } else {
        for (const wire of wires) {
          const fromCell = CellCore.getCell(wire.fromCellId);
          const toCell = CellCore.getCell(wire.toCellId);
          const fromName = fromCell ? fromCell.name : wire.fromCellId;
          const toName = toCell ? toCell.name : wire.toCellId;
          html += `<div class="prop-row" style="align-items:center">
            <span class="prop-label" style="flex:1;font-size:11px;line-height:1.5">
              <span style="color:#f6a">${_escapeHtml(fromName)}</span>
              .<span style="color:#f6a">${_escapeHtml(wire.fromPortId)}</span>
              <span style="color:#888"> → </span>
              <span style="color:#6af">${_escapeHtml(toName)}</span>
              .<span style="color:#6af">${_escapeHtml(wire.toPortId)}</span>
              <br><span style="color:#888;font-size:10px">类型: ${_escapeHtml(wire.dataType || 'any')}${wire.active === false ? ' (未激活)' : ''}</span>
            </span>
            <button class="btn-delete" data-action="delete-wire" data-wire-id="${_escapeHtml(wire.id)}" style="padding:4px 10px;font-size:11px">断开</button>
          </div>`;
        }
      }
      html += '</div>';

      // ========== 新增连线表单 ==========
      html += '<div class="prop-group">';
      html += '<div class="prop-group-title">创建连线</div>';

      if (otherCells.length === 0) {
        html += '<div style="padding:8px;color:#888;font-size:12px;text-align:center">世界中只有当前基圆，无法创建连线</div>';
      } else {
        // 选项：从当前基圆输出端口连接到其他基圆输入端口
        html += '<div style="padding:8px;background:rgba(255,255,255,0.03);border-radius:4px">';
        html += '<div style="font-size:11px;color:#f6a;margin-bottom:6px">方向1: 当前基圆(输出) → 其他基圆(输入)</div>';

        // 选择当前基圆的输出端口
        html += '<div style="margin-bottom:6px">';
        html += '<span style="font-size:11px;color:#888">当前输出端口:</span> ';
        html += '<select id="wireFromOutputPort" style="padding:3px;font-size:11px;max-width:120px">';
        if (outputPortNames.length === 0) {
          html += '<option value="">(无输出端口)</option>';
        } else {
          for (const name of outputPortNames) {
            html += `<option value="${_escapeHtml(name)}">${_escapeHtml(name)}</option>`;
          }
        }
        html += '</select>';
        html += '</div>';

        // 选择目标基圆
        html += '<div style="margin-bottom:6px">';
        html += '<span style="font-size:11px;color:#888">目标基圆:</span> ';
        html += '<select id="wireToCellA" style="padding:3px;font-size:11px;max-width:120px">';
        for (const c of otherCells) {
          html += `<option value="${_escapeHtml(c.id)}">${_escapeHtml(c.name || c.id)}</option>`;
        }
        html += '</select>';
        html += '</div>';

        // 选择目标基圆的输入端口（动态填充）
        html += '<div style="margin-bottom:6px">';
        html += '<span style="font-size:11px;color:#888">目标输入端口:</span> ';
        html += '<select id="wireToInputPortA" style="padding:3px;font-size:11px;max-width:120px">';
        html += '<option value="">(请先选择基圆)</option>';
        html += '</select>';
        html += '</div>';

        html += '<button class="btn-primary" id="createWireBtnA" style="padding:4px 12px;font-size:11px">连接 →</button>';
        html += '</div>';

        // 方向2：从其他基圆输出端口连接到当前基圆输入端口
        html += '<div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:4px">';
        html += '<div style="font-size:11px;color:#6af;margin-bottom:6px">方向2: 其他基圆(输出) → 当前基圆(输入)</div>';

        // 选择源基圆
        html += '<div style="margin-bottom:6px">';
        html += '<span style="font-size:11px;color:#888">源基圆:</span> ';
        html += '<select id="wireFromCellB" style="padding:3px;font-size:11px;max-width:120px">';
        for (const c of otherCells) {
          html += `<option value="${_escapeHtml(c.id)}">${_escapeHtml(c.name || c.id)}</option>`;
        }
        html += '</select>';
        html += '</div>';

        // 选择源基圆的输出端口
        html += '<div style="margin-bottom:6px">';
        html += '<span style="font-size:11px;color:#888">源输出端口:</span> ';
        html += '<select id="wireFromOutputPortB" style="padding:3px;font-size:11px;max-width:120px">';
        html += '<option value="">(请先选择基圆)</option>';
        html += '</select>';
        html += '</div>';

        // 选择当前基圆的输入端口
        html += '<div style="margin-bottom:6px">';
        html += '<span style="font-size:11px;color:#888">当前输入端口:</span> ';
        html += '<select id="wireToInputPortB" style="padding:3px;font-size:11px;max-width:120px">';
        if (inputPortNames.length === 0) {
          html += '<option value="">(无输入端口)</option>';
        } else {
          for (const name of inputPortNames) {
            html += `<option value="${_escapeHtml(name)}">${_escapeHtml(name)}</option>`;
          }
        }
        html += '</select>';
        html += '</div>';

        html += '<button class="btn-primary" id="createWireBtnB" style="padding:4px 12px;font-size:11px">连接 →</button>';
        html += '</div>';
      }

      html += '</div>';

    } catch (e) {
      console.error('[DEBUG _renderPortsTab] render error:', e);
      html = '<div style="color:red;padding:20px;">渲染错误: ' + e.message + '</div>';
    }

    return html;
  }

  function _bindPortsTabEvents(cellId) {
    const body = document.getElementById('panelBody');

    // ========== 添加输入端口 ==========
    const addInputBtn = document.getElementById('addInputPortBtn');
    if (addInputBtn) {
      addInputBtn.addEventListener('click', () => {
        const cid = _editingCellId || cellId;
        const nameInput = document.getElementById('newInputPortName');
        const typeSelect = document.getElementById('newInputPortType');
        const name = nameInput.value.trim();
        const type = typeSelect.value;
        if (!name) {
          _showToast('请输入端口名');
          return;
        }
        CellCore.defineInputPort(cid, name, type);
        _showToast(`输入端口 "${name}" 已创建`);
        // 重新渲染
        const cell = CellCore.getCell(cid);
        body.innerHTML = _renderPortsTab(cell);
        _bindPortsTabEvents(cid);
      });
    }

    // ========== 添加输出端口 ==========
    const addOutputBtn = document.getElementById('addOutputPortBtn');
    if (addOutputBtn) {
      addOutputBtn.addEventListener('click', () => {
        const cid = _editingCellId || cellId;
        const nameInput = document.getElementById('newOutputPortName');
        const typeSelect = document.getElementById('newOutputPortType');
        const name = nameInput.value.trim();
        const type = typeSelect.value;
        if (!name) {
          _showToast('请输入端口名');
          return;
        }
        CellCore.defineOutputPort(cid, name, type);
        _showToast(`输出端口 "${name}" 已创建`);
        const cell = CellCore.getCell(cid);
        body.innerHTML = _renderPortsTab(cell);
        _bindPortsTabEvents(cid);
      });
    }

    // ========== 删除输入端口 ==========
    body.querySelectorAll('[data-action="delete-input-port"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cid = _editingCellId || cellId;
        const portName = e.target.dataset.portName;
        const cell = CellCore.getCell(cid);
        if (cell && cell.ports && cell.ports.inputs) {
          delete cell.ports.inputs[portName];
          CellCore.updateCell(cid, { ports: cell.ports });
          _showToast(`输入端口 "${portName}" 已删除`);
          const refreshedCell = CellCore.getCell(cid);
          body.innerHTML = _renderPortsTab(refreshedCell);
          _bindPortsTabEvents(cid);
        }
      });
    });

    // ========== 删除输出端口 ==========
    body.querySelectorAll('[data-action="delete-output-port"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cid = _editingCellId || cellId;
        const portName = e.target.dataset.portName;
        const cell = CellCore.getCell(cid);
        if (cell && cell.ports && cell.ports.outputs) {
          delete cell.ports.outputs[portName];
          CellCore.updateCell(cid, { ports: cell.ports });
          _showToast(`输出端口 "${portName}" 已删除`);
          const refreshedCell = CellCore.getCell(cid);
          body.innerHTML = _renderPortsTab(refreshedCell);
          _bindPortsTabEvents(cid);
        }
      });
    });

    // ========== 删除连线 ==========
    body.querySelectorAll('[data-action="delete-wire"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const wireId = e.target.dataset.wireId;
        const ok = CellCore.disconnectPort(wireId);
        if (ok) {
          _showToast('连线已断开');
        } else {
          _showToast('断开失败');
        }
        const cid = _editingCellId || cellId;
        const cell = CellCore.getCell(cid);
        body.innerHTML = _renderPortsTab(cell);
        _bindPortsTabEvents(cid);
      });
    });

    // ========== 创建连线方向1: 当前输出 → 其他输入 ==========
    const wireToCellSelectA = document.getElementById('wireToCellA');
    const wireToInputPortSelectA = document.getElementById('wireToInputPortA');
    if (wireToCellSelectA && wireToInputPortSelectA) {
      // 动态更新目标基圆的输入端口下拉
      const updateTargetInputPorts = () => {
        const targetCellId = wireToCellSelectA.value;
        const targetCell = CellCore.getCell(targetCellId);
        wireToInputPortSelectA.innerHTML = '';
        if (targetCell && targetCell.ports && targetCell.ports.inputs) {
          const inputNames = Object.keys(targetCell.ports.inputs);
          if (inputNames.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '(无输入端口)';
            wireToInputPortSelectA.appendChild(opt);
          } else {
            for (const name of inputNames) {
              const opt = document.createElement('option');
              opt.value = name;
              opt.textContent = name;
              wireToInputPortSelectA.appendChild(opt);
            }
          }
        } else {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = '(无输入端口)';
          wireToInputPortSelectA.appendChild(opt);
        }
      };
      wireToCellSelectA.addEventListener('change', updateTargetInputPorts);
      updateTargetInputPorts(); // 初始化

      const createWireBtnA = document.getElementById('createWireBtnA');
      if (createWireBtnA) {
        createWireBtnA.addEventListener('click', () => {
          const cid = _editingCellId || cellId;
          const fromPort = document.getElementById('wireFromOutputPort').value;
          const toCellId = wireToCellSelectA.value;
          const toPort = wireToInputPortSelectA.value;
          if (!fromPort) {
            _showToast('请选择输出端口');
            return;
          }
          if (!toPort) {
            _showToast('请选择目标输入端口');
            return;
          }
          const ok = CellCore.connectPorts(cid, fromPort, toCellId, toPort);
          if (ok) {
            _showToast('连线已创建');
          } else {
            _showToast('连线失败（可能类型不匹配或已存在）');
          }
          const cell = CellCore.getCell(cid);
          body.innerHTML = _renderPortsTab(cell);
          _bindPortsTabEvents(cid);
        });
      }
    }

    // ========== 创建连线方向2: 其他输出 → 当前输入 ==========
    const wireFromCellSelectB = document.getElementById('wireFromCellB');
    const wireFromOutputPortSelectB = document.getElementById('wireFromOutputPortB');
    if (wireFromCellSelectB && wireFromOutputPortSelectB) {
      // 动态更新源基圆的输出端口下拉
      const updateSourceOutputPorts = () => {
        const sourceCellId = wireFromCellSelectB.value;
        const sourceCell = CellCore.getCell(sourceCellId);
        wireFromOutputPortSelectB.innerHTML = '';
        if (sourceCell && sourceCell.ports && sourceCell.ports.outputs) {
          const outputNames = Object.keys(sourceCell.ports.outputs);
          if (outputNames.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '(无输出端口)';
            wireFromOutputPortSelectB.appendChild(opt);
          } else {
            for (const name of outputNames) {
              const opt = document.createElement('option');
              opt.value = name;
              opt.textContent = name;
              wireFromOutputPortSelectB.appendChild(opt);
            }
          }
        } else {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = '(无输出端口)';
          wireFromOutputPortSelectB.appendChild(opt);
        }
      };
      wireFromCellSelectB.addEventListener('change', updateSourceOutputPorts);
      updateSourceOutputPorts(); // 初始化

      const createWireBtnB = document.getElementById('createWireBtnB');
      if (createWireBtnB) {
        createWireBtnB.addEventListener('click', () => {
          const cid = _editingCellId || cellId;
          const fromCellId = wireFromCellSelectB.value;
          const fromPort = wireFromOutputPortSelectB.value;
          const toPort = document.getElementById('wireToInputPortB').value;
          if (!fromPort) {
            _showToast('请选择源输出端口');
            return;
          }
          if (!toPort) {
            _showToast('请选择输入端口');
            return;
          }
          const ok = CellCore.connectPorts(fromCellId, fromPort, cid, toPort);
          if (ok) {
            _showToast('连线已创建');
          } else {
            _showToast('连线失败（可能类型不匹配或已存在）');
          }
          const cell = CellCore.getCell(cid);
          body.innerHTML = _renderPortsTab(cell);
          _bindPortsTabEvents(cid);
        });
      }
    }

    // ========== 复制输入端口 ==========
    const copyInputBtn = document.getElementById('copyInputPortsBtn');
    if (copyInputBtn) {
      copyInputBtn.addEventListener('click', () => {
        const cid = _editingCellId || cellId;
        const ports = CellCore.getCellPorts(cid);
        const inputPorts = ports.inputs || {};
        localStorage.setItem('copiedPorts', JSON.stringify({ type: 'input', ports: inputPorts }));
        _showToast('输入端口已复制到剪贴板');
      });
    }

    // ========== 复制输出端口 ==========
    const copyOutputBtn = document.getElementById('copyOutputPortsBtn');
    if (copyOutputBtn) {
      copyOutputBtn.addEventListener('click', () => {
        const cid = _editingCellId || cellId;
        const ports = CellCore.getCellPorts(cid);
        const outputPorts = ports.outputs || {};
        localStorage.setItem('copiedPorts', JSON.stringify({ type: 'output', ports: outputPorts }));
        _showToast('输出端口已复制到剪贴板');
      });
    }

    // ========== 粘贴输入端口 ==========
    const pasteInputBtn = document.getElementById('pasteInputPortsBtn');
    if (pasteInputBtn) {
      const copiedPorts = localStorage.getItem('copiedPorts');
      if (copiedPorts) {
        const data = JSON.parse(copiedPorts);
        if (data.type === 'input' && Object.keys(data.ports).length > 0) {
          pasteInputBtn.style.display = 'inline';
        }
      }
      pasteInputBtn.addEventListener('click', () => {
        const copiedPorts = localStorage.getItem('copiedPorts');
        if (!copiedPorts) {
          _showToast('没有可粘贴的端口');
          return;
        }
        const data = JSON.parse(copiedPorts);
        if (data.type !== 'input') {
          _showToast('剪贴板中是输出端口，请切换到输出端口面板粘贴');
          return;
        }
        const cid = _editingCellId || cellId;
        let count = 0;
        for (const [name, port] of Object.entries(data.ports)) {
          CellCore.defineInputPort(cid, name, port.type || 'any');
          count++;
        }
        _showToast(`已粘贴 ${count} 个输入端口`);
        const cell = CellCore.getCell(cid);
        body.innerHTML = _renderPortsTab(cell);
        _bindPortsTabEvents(cid);
      });
    }

    // ========== 粘贴输出端口 ==========
    const pasteOutputBtn = document.getElementById('pasteOutputPortsBtn');
    if (pasteOutputBtn) {
      const copiedPorts = localStorage.getItem('copiedPorts');
      if (copiedPorts) {
        const data = JSON.parse(copiedPorts);
        if (data.type === 'output' && Object.keys(data.ports).length > 0) {
          pasteOutputBtn.style.display = 'inline';
        }
      }
      pasteOutputBtn.addEventListener('click', () => {
        const copiedPorts = localStorage.getItem('copiedPorts');
        if (!copiedPorts) {
          _showToast('没有可粘贴的端口');
          return;
        }
        const data = JSON.parse(copiedPorts);
        if (data.type !== 'output') {
          _showToast('剪贴板中是输入端口，请切换到输入端口面板粘贴');
          return;
        }
        const cid = _editingCellId || cellId;
        let count = 0;
        for (const [name, port] of Object.entries(data.ports)) {
          CellCore.defineOutputPort(cid, name, port.type || 'any');
          count++;
        }
        _showToast(`已粘贴 ${count} 个输出端口`);
        const cell = CellCore.getCell(cid);
        body.innerHTML = _renderPortsTab(cell);
        _bindPortsTabEvents(cid);
      });
    }
  }

  function _hidePropertyPanel() {
    document.getElementById('propertyPanel').classList.add('hidden');
    _editingCellId = null;
  }

  function _handlePropChange(cellId, input) {
    const prop = input.dataset.prop;
    let value = input.value;

    // 使用 _editingCellId 作为权威来源，防止closure捕获的cellId过期
    const cid = _editingCellId || cellId;
    const cell = CellCore.getCell(cid);
    if (!cell) return;

    // 类型转换
    if (['x', 'y', 'radius', 'rotation', 'opacity', 'zIndex'].includes(prop)) {
      value = parseFloat(value) || 0;
    }

    if (prop === 'triggerMode') {
      CellCore.setTriggerMode(cid, value, {});
      // 触发模式变化时重新加载代码到正确的Worker
      const currentCell = CellCore.getCell(cid);
      if (currentCell && currentCell.code && currentCell.code.trim()) {
        Sandbox.unloadBehaviorCode(cid);
        Sandbox.loadBehaviorCode(cid, currentCell.code, value);
      }
      _renderTab('basic', cid, cell.kind === 'engine' && cell.builtIn);
      return;
    }

    if (prop === 'triggerThreshold') {
      const cell2 = CellCore.getCell(cid);
      CellCore.setTriggerMode(cid, cell2.triggerConfig.mode, { threshold: parseInt(value) || 60 });
      return;
    }

    if (prop === 'kind') {
      // 种类变更时重新初始化默认属性
      const kindDef = CellCore.getKindDefinition(value);
      if (kindDef) {
        CellCore.updateCell(cid, {
          kind: value,
          color: kindDef.defaultColor,
          attributes: { ...kindDef.defaultAttributes }
        });
        CellCore.setTriggerMode(cid, kindDef.defaultTriggerMode, {
          threshold: kindDef.defaultTriggerThreshold || 60
        });
        // 刷新面板标题和内容
        const updatedCell = CellCore.getCell(cid);
        document.querySelector('.panel-title').textContent = updatedCell.name || '属性';
        _renderTab('basic', cid, updatedCell.kind === 'engine' && updatedCell.builtIn);
        return;
      }
    }

    CellCore.updateCell(cid, { [prop]: value });
  }

  // ===== AI输入 =====
  function _showAiInput(cellId, description) {
    const aiInput = document.getElementById('aiInput');
    const textarea = document.getElementById('aiDescription');
    aiInput.classList.remove('hidden');
    textarea.value = description;
    document.getElementById('aiCodePreview').classList.add('hidden');
    aiInput.dataset.cellId = cellId;
  }

  async function _handleAiGenerate() {
    const aiInput = document.getElementById('aiInput');
    const cellId = aiInput.dataset.cellId;
    const description = document.getElementById('aiDescription').value.trim();

    if (!description) {
      _showToast('请输入描述');
      return;
    }

    if (!cellId) return;

    // 更新基圆描述
    CellCore.updateCell(cellId, { description });

    try {
      _showToast('正在生成代码...');
      const result = await AiBridge.generateCode(cellId, description);
      // result 可能是字符串（旧兼容）或对象（新格式）
      const code = typeof result === 'string' ? result : result.code;

      // 显示代码预览
      document.getElementById('aiCodeContent').textContent = code;
      document.getElementById('aiCodePreview').classList.remove('hidden');
      aiInput.dataset.generatedCode = code;
    } catch (e) {
      _showToast('生成失败: ' + e.message);
    }
  }

  function _handleAiCodeAccept() {
    const aiInput = document.getElementById('aiInput');
    const cellId = _editingCellId || aiInput.dataset.cellId;
    const code = aiInput.dataset.generatedCode;

    if (!cellId || !code) return;

    const cell = CellCore.getCell(cellId);
    AiBridge.confirmAndLoadCode(cellId, code, {});
    // 保存成功模式到AI记忆
    if (cell && cell.description) {
      AiMemory.addPattern(cellId, cell.description, code, cell.kind);
    }
    aiInput.classList.add('hidden');
    _showToast('代码已加载');

    // 刷新属性面板
    if (_editingCellId === cellId) {
      _showPropertyPanel(cellId);
    }
  }

  // ===== 提供者配置 =====
  function _showProviderConfig() {
    const config = document.getElementById('providerConfig');
    const body = document.getElementById('providerBody');
    config.classList.remove('hidden');

    const providers = AiBridge.getProvidersFull();
    body.innerHTML = '';

    for (const provider of providers) {
      body.innerHTML += _createProviderCardHtml(provider);
    }

    // 绑定事件
    body.querySelectorAll('.provider-card').forEach(card => {
      const pid = card.dataset.providerId;
      card.querySelectorAll('input, select').forEach(elem => {
        elem.addEventListener('change', (e) => {
          const field = e.target.dataset.field;
          let value = e.target.value;
          if (field === 'enabled') value = e.target.checked;
          if (field === 'priority') value = parseInt(value) || 1;
          AiBridge.updateProvider(pid, { [field]: value });
        });
      });
      card.querySelector('.btn-delete')?.addEventListener('click', () => {
        AiBridge.removeProvider(pid);
        _showProviderConfig();
      });
    });
  }

  function _createProviderCardHtml(provider) {
    return `
      <div class="provider-card" data-provider-id="${provider.id}">
        <div class="prop-row">
          <span class="prop-label">名称</span>
          <input class="prop-input" data-field="name" value="${_escapeHtml(provider.name)}">
        </div>
        <div class="prop-row">
          <span class="prop-label">类型</span>
          <select class="prop-select" data-field="type">
            <option value="openai" ${provider.type === 'openai' ? 'selected' : ''}>OpenAI</option>
            <option value="openai_compatible" ${provider.type === 'openai_compatible' ? 'selected' : ''}>OpenAI兼容</option>
            <option value="ollama" ${provider.type === 'ollama' ? 'selected' : ''}>Ollama</option>
          </select>
        </div>
        <div class="prop-row">
          <span class="prop-label">端点</span>
          <input class="prop-input" data-field="endpoint" value="${_escapeHtml(provider.endpoint)}">
        </div>
        <div class="prop-row">
          <span class="prop-label">模型</span>
          <input class="prop-input" data-field="model" value="${_escapeHtml(provider.model)}">
        </div>
        <div class="prop-row">
          <span class="prop-label">API Key</span>
          <input class="prop-input" type="password" data-field="apiKey" value="${_escapeHtml(provider.apiKey)}" placeholder="输入API Key">
        </div>
        <div class="prop-row">
          <span class="prop-label">启用</span>
          <input type="checkbox" data-field="enabled" ${provider.enabled ? 'checked' : ''}>
        </div>
        <button class="btn-delete">删除</button>
      </div>
    `;
  }

  function _addProviderCard() {
    AiBridge.addProvider({
      name: '新提供者',
      type: 'openai_compatible',
      endpoint: '',
      model: '',
      apiKey: '',
      enabled: false,
      priority: _providers_count() + 1
    }).then(() => {
      _showProviderConfig();
    });
  }

  function _providers_count() {
    return AiBridge.getProviders().length;
  }

  // ===== 嵌套操作 =====
  function enterCellLayer(cellId) {
    const cell = CellCore.enterCell(cellId);
    if (cell) {
      // 缩放视口到基圆范围
      RenderBridge.setCamera({
        x: cell.x,
        y: cell.y,
        zoom: Math.min(2, 200 / cell.radius)
      });
      _hidePropertyPanel();
      _showToast(`进入 ${cell.name} 内部`);
    }
  }

  function exitCellLayer() {
    const cell = CellCore.exitCell();
    if (cell) {
      RenderBridge.setCamera({ x: 0, y: 0, zoom: 1 });
      _showToast('返回上层');
    } else {
      RenderBridge.setCamera({ x: 0, y: 0, zoom: 1 });
    }
  }

  // ===== 删除基圆 =====
  function deleteCell(cellId) {
    if (confirm('确定要删除此基圆及其所有子基圆吗？')) {
      Sandbox.unloadBehaviorCode(cellId);
      CellCore.destroyCell(cellId);
      _hidePropertyPanel();
      _selectedCellId = null;
      _showToast('基圆已删除');
    }
  }

  // ===== 状态栏更新 =====
  function _updateStatusBar() {
    const fps = GameLoop.getFPS();
    document.getElementById('fpsDisplay').textContent = `FPS: ${fps}`;
    document.getElementById('cellCount').textContent = `基圆: ${CellCore.getCellCount()}`;
    document.getElementById('modeDisplay').textContent = `模式: ${
      InputBridge.getMode() === 'normal' ? '正常' :
      InputBridge.getMode() === 'edit' ? '编辑' : '导航'
    }`;
  }

  // ===== 提示消息 =====
  function _showToast(message) {
    const toast = document.getElementById('errorToast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  function _showError(message) {
    _showToast(message);
  }

  // ===== 加载画面 =====
  function _hideLoadingScreen() {
    const screen = document.getElementById('loadingScreen');
    screen.style.opacity = '0';
    setTimeout(() => screen.classList.add('hidden'), 500);
  }

  // ===== 教程 =====
  const TUTORIAL_STEPS = [
    { title: '欢迎来到基圆世界！', text: '这是一个自举式游戏引擎，世界中只有基圆一种实体。一切——UI、角色、道具、特效、逻辑——都是基圆。' },
    { title: '长按屏幕', text: '在空白区域长按屏幕，可以唤起创造菜单，创建新的基圆。' },
    { title: '编辑基圆', text: '点击基圆可以选中它，在右侧属性面板中编辑属性、填写描述，让AI生成行为代码。' },
    { title: '导航世界', text: '拖拽可以平移视口，双指缩放可以调整视口大小。长按菜单中可以切换导航模式。' },
    { title: '开始创造！', text: '现在你可以自由探索和创造了。试试编辑现有的基圆，或者创建新的基圆吧！' }
  ];
  let _tutorialStep = 0;

  async function _checkTutorial() {
    if (PersistLayer) {
      const shown = await PersistLayer.loadSetting('tutorial_shown');
      if (shown) return;
    }
    _showTutorial();
  }

  function _showTutorial() {
    const tutorial = document.getElementById('tutorial');
    tutorial.classList.remove('hidden');
    _tutorialStep = 0;
    _updateTutorialContent();
  }

  function _updateTutorialContent() {
    const step = TUTORIAL_STEPS[_tutorialStep];
    document.getElementById('tutorialTitle').textContent = step.title;
    document.getElementById('tutorialText').textContent = step.text;
    document.getElementById('tutorialNext').textContent =
      _tutorialStep === TUTORIAL_STEPS.length - 1 ? '开始' : '下一步';
  }

  function _nextTutorial() {
    _tutorialStep++;
    if (_tutorialStep >= TUTORIAL_STEPS.length) {
      document.getElementById('tutorial').classList.add('hidden');
      if (PersistLayer) {
        PersistLayer.saveSetting('tutorial_shown', true);
      }
    } else {
      _updateTutorialContent();
    }
  }

  // ===== 辅助函数 =====
  function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== 渲染选择框（在start后通过回调注册） =====

  // ===== P5: 独立运行器页 =====
  function _renderRunnerTab(cell) {
    const standaloneRunner = _modules.get('standaloneRunner');
    const isRunning = standaloneRunner && standaloneRunner.isSessionRunning && standaloneRunner.isSessionRunning(cell.id);

    let html = `
      <div class="runner-panel">
        <h3>独立运行器</h3>
        <p class="runner-desc">在隔离环境中测试单个基圆的行为，支持断点调试和状态快照。</p>
        
        ${!standaloneRunner ? `
          <div class="runner-not-available">
            <p>⚠️ 独立运行器未加载</p>
            <p>StandaloneRunner 模块不可用，无法使用独立运行功能。</p>
          </div>
        ` : `
          <div class="runner-controls">
            <button id="runnerStart" ${isRunning ? 'disabled' : ''}>
              ${isRunning ? '运行中...' : '启动运行'}
            </button>
            <button id="runnerPause" ${!isRunning ? 'disabled' : ''}>暂停</button>
            <button id="runnerStop">停止</button>
          </div>

          <div class="runner-status">
            <span class="status-label">状态:</span>
            <span class="status-value ${isRunning ? 'running' : 'stopped'}">
              ${isRunning ? '运行中' : '已停止'}
            </span>
          </div>

          <div class="runner-breakpoints">
            <h4>断点设置</h4>
            <div class="breakpoint-item">
              <label>
                <input type="checkbox" id="breakOnInit"> 初始化时暂停
              </label>
            </div>
            <div class="breakpoint-item">
              <label>
                <input type="checkbox" id="breakOnUpdate"> 更新时暂停
              </label>
            </div>
            <div class="breakpoint-item">
              <label>
                <input type="checkbox" id="breakOnEvent"> 事件触发时暂停
              </label>
            </div>
          </div>

          <div class="runner-snapshot">
            <h4>状态快照</h4>
            <button id="runnerSnapshot">保存快照</button>
            <button id="runnerRestore">恢复快照</button>
            <div id="snapshotInfo" class="snapshot-info"></div>
          </div>

          <div class="runner-output">
            <h4>输出日志</h4>
            <div id="runnerLog" class="runner-log"></div>
          </div>
        `}
      </div>
    `;

    return html;
  }

  function _bindRunnerTabEvents(cellId) {
    const standaloneRunner = _modules.get('standaloneRunner');
    if (!standaloneRunner) return;

    const runnerStart = document.getElementById('runnerStart');
    const runnerPause = document.getElementById('runnerPause');
    const runnerStop = document.getElementById('runnerStop');
    const runnerSnapshot = document.getElementById('runnerSnapshot');
    const runnerRestore = document.getElementById('runnerRestore');
    const runnerLog = document.getElementById('runnerLog');
    const snapshotInfo = document.getElementById('snapshotInfo');

    let _currentSessionId = null;

    if (runnerStart) {
      runnerStart.addEventListener('click', async () => {
        const breakpoints = {
          onInit: document.getElementById('breakOnInit')?.checked || false,
          onUpdate: document.getElementById('breakOnUpdate')?.checked || false,
          onEvent: document.getElementById('breakOnEvent')?.checked || false
        };

        try {
          _currentSessionId = await standaloneRunner.createSession(cellId, { breakpoints });
          if (_currentSessionId) {
            await standaloneRunner.start(_currentSessionId);
            runnerStart.disabled = true;
            runnerPause.disabled = false;
            runnerLog.innerHTML += `<p class="log-success">✅ 会话已启动</p>`;
          } else {
            runnerLog.innerHTML += `<p class="log-error">❌ 创建会话失败</p>`;
          }
        } catch (e) {
          runnerLog.innerHTML += `<p class="log-error">❌ 启动失败: ${e.message}</p>`;
        }
      });
    }

    if (runnerPause) {
      runnerPause.addEventListener('click', async () => {
        try {
          if (_currentSessionId) {
            await standaloneRunner.pause(_currentSessionId);
            runnerStart.disabled = false;
            runnerPause.disabled = true;
            runnerLog.innerHTML += `<p class="log-warning">⏸️ 已暂停</p>`;
          }
        } catch (e) {
          runnerLog.innerHTML += `<p class="log-error">❌ 暂停失败: ${e.message}</p>`;
        }
      });
    }

    if (runnerStop) {
      runnerStop.addEventListener('click', async () => {
        try {
          if (_currentSessionId) {
            await standaloneRunner.stop(_currentSessionId);
            _currentSessionId = null;
            runnerStart.disabled = false;
            runnerPause.disabled = true;
            runnerLog.innerHTML += `<p class="log-info">⏹️ 已停止</p>`;
          }
        } catch (e) {
          runnerLog.innerHTML += `<p class="log-error">❌ 停止失败: ${e.message}</p>`;
        }
      });
    }

    if (runnerSnapshot) {
      runnerSnapshot.addEventListener('click', async () => {
        try {
          if (_currentSessionId) {
            const snapshot = await standaloneRunner.getSessionState(_currentSessionId);
            localStorage.setItem(`runner_snapshot_${cellId}`, JSON.stringify(snapshot));
            snapshotInfo.innerHTML = `<p>✅ 快照已保存</p>`;
            runnerLog.innerHTML += `<p class="log-info">📸 状态快照已保存</p>`;
          }
        } catch (e) {
          runnerLog.innerHTML += `<p class="log-error">❌ 保存快照失败: ${e.message}</p>`;
        }
      });
    }

    if (runnerRestore) {
      runnerRestore.addEventListener('click', async () => {
        const saved = localStorage.getItem(`runner_snapshot_${cellId}`);
        if (!saved) {
          runnerLog.innerHTML += `<p class="log-warning">⚠️ 没有保存的快照</p>`;
          return;
        }
        try {
          const snapshot = JSON.parse(saved);
          if (_currentSessionId) {
            await standaloneRunner.destroySession(_currentSessionId);
          }
          _currentSessionId = await standaloneRunner.createSession(cellId, {});
          if (_currentSessionId && typeof standaloneRunner.loadCode === 'function') {
            const cell = CellCore.getCell(cellId);
            await standaloneRunner.loadCode(_currentSessionId, cell?.code || '');
          }
          snapshotInfo.innerHTML = `<p>✅ 快照已恢复</p>`;
          runnerLog.innerHTML += `<p class="log-info">🔄 状态已恢复</p>`;
        } catch (e) {
          runnerLog.innerHTML += `<p class="log-error">❌ 恢复快照失败: ${e.message}</p>`;
        }
      });
    }
  }

  // ===== 地图预设页 =====
  function _renderMapTab() {
    const presets = (window.SpeciesRegistry && SpeciesRegistry.getMapPresets) ? SpeciesRegistry.getMapPresets() : {};
    const current = _currentMapPreset;

    let html = `
      <div class="prop-group">
        <h3 style="margin:4px 0 12px 0;">🗺️ 地图预设</h3>
        <p style="color:#999;font-size:12px;margin:0 0 12px 0;">选择不同地图环境，模拟真实世界生态群落。</p>

        <div style="margin-bottom:12px;">
          <label style="font-size:13px;color:#bbb;">当前地图</label>
          <select id="mapPresetSelect" style="width:100%;padding:8px;margin-top:6px;background:#1a1a22;color:#e0e0e0;border:1px solid #3a3a4a;border-radius:6px;font-size:13px;">
    `;

    for (const [id, preset] of Object.entries(presets)) {
      const selected = (id === current) ? ' selected' : '';
      html += `<option value="${id}"${selected}>${preset.name}</option>`;
    }

    html += `
          </select>
        </div>
    `;

    // 显示当前地图详情
    const cur = presets[current];
    if (cur) {
      html += `
        <div class="species-desc-card" style="background:#1a1a22;border:1px solid #3a3a4a;border-radius:6px;padding:12px;margin-bottom:12px;">
          <h4 style="margin:0 0 8px 0;color:#c8c8ff;">${cur.name}</h4>
          <p style="margin:0 0 10px 0;font-size:12px;color:#bbb;">${cur.description || ''}</p>
          <div style="display:inline-block;width:40px;height:40px;border-radius:8px;border:1px solid #555;vertical-align:middle;background:${cur.backgroundColor};"></div>
          <span style="font-size:12px;color:#999;margin-left:8px;vertical-align:middle;">背景: ${cur.backgroundColor}</span>
        </div>

        <div class="species-desc-card" style="background:#1a1a22;border:1px solid #3a3a4a;border-radius:6px;padding:12px;margin-bottom:12px;">
          <h4 style="margin:0 0 8px 0;color:#c8c8ff;">环境参数</h4>
          <ul style="margin:0;padding-left:16px;font-size:12px;color:#ccc;line-height:1.8;">
            <li>食物密度倍率: <b>${cur.foodMultiplier}</b></li>
            <li>能量消耗倍率: <b>${cur.energyConsumption}</b></li>
            <li>天敌频率倍率: <b>${cur.enemyMultiplier}</b></li>
          </ul>
        </div>

        <div class="species-desc-card" style="background:#1a1a22;border:1px solid #3a3a4a;border-radius:6px;padding:12px;margin-bottom:12px;">
          <h4 style="margin:0 0 8px 0;color:#c8c8ff;">主要物种</h4>
          <div style="font-size:12px;color:#ccc;line-height:1.7;">
            <p style="margin:4px 0;"><b style="color:#9c9cff;">蚂蚁:</b> ${(cur.antSpecies || []).map(s => _getAntDisplayName(s)).join(' · ') || '-'}</p>
            <p style="margin:4px 0;"><b style="color:#8cdd8c;">植物:</b> ${(cur.plantSpecies || []).map(s => _getPlantDisplayName(s)).join(' · ') || '-'}</p>
            <p style="margin:4px 0;"><b style="color:#dd8c8c;">生物:</b> ${(cur.insectSpecies || []).map(s => _getInsectDisplayName(s)).join(' · ') || '-'}</p>
          </div>
        </div>

        <button id="applyMapBtn" class="btn-primary" style="width:100%;padding:10px;margin-top:4px;background:#6464c8;border:none;border-radius:6px;color:white;font-size:13px;cursor:pointer;">应用当前地图</button>

        <p style="color:#888;font-size:11px;margin:12px 0 0 0;text-align:center;">切换地图会改变画布背景色。物种分布机制需要由创建逻辑调用 getMapPreset() 获取。</p>
      </div>
    `;
    }

    return html;
  }

  // 辅助函数：通过物种ID获取中文名
  function _getAntDisplayName(id) {
    try {
      const sp = window.SpeciesRegistry.getAnt(id);
      return sp ? (sp.name || id) : id;
    } catch (e) { return id; }
  }
  function _getPlantDisplayName(id) {
    try {
      const sp = window.SpeciesRegistry.getPlant(id);
      return sp ? (sp.name || id) : id;
    } catch (e) { return id; }
  }
  function _getInsectDisplayName(id) {
    try {
      const sp = window.SpeciesRegistry.getInsect(id);
      return sp ? (sp.name || id) : id;
    } catch (e) { return id; }
  }

  function _bindMapTabEvents() {
    const select = document.getElementById('mapPresetSelect');
    const applyBtn = document.getElementById('applyMapBtn');

    if (select) {
      select.addEventListener('change', () => {
        _currentMapPreset = select.value;
        // 切换地图后，重新渲染 tab 以更新详情显示
        const body = document.getElementById('panelBody');
        body.innerHTML = _renderMapTab();
        _bindMapTabEvents();
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const preset = window.SpeciesRegistry.getMapPreset(_currentMapPreset);
        if (!preset) return;

        // 改变画布背景色
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
          canvas.style.background = preset.backgroundColor;
        }
        document.body.style.background = preset.backgroundColor;

        // 生成新地图的植物和昆虫（保留现有蚂蚁）
        if (window.SpeciesRegistry && window.SpeciesRegistry.buildMapScene) {
          const result = window.SpeciesRegistry.buildMapScene(_currentMapPreset, {
            clearWorld: false,
            density: 1.0
          });
          if (result.error) {
            _showToast('生成地图失败: ' + result.error);
          } else {
            _showToast(`已切换地图: ${preset.name}（+${result.total}个新实体）`);
          }
        } else {
          _showToast(`已切换地图: ${preset.name}`);
        }
      });
    }
  }

  // ===== 重置视野到能看到所有基圆 =====
  function resetCameraToSeeAll() {
    const cells = CellCore.getAllCells();
    if (cells.length === 0) {
      _showToast('没有基圆');
      return;
    }
    
    // 计算所有基圆的边界
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let validCount = 0;
    for (const cell of cells) {
      const absPos = getAbsolutePosition(cell);
      // 跳过坐标异常的基圆（防止远距离基圆干扰视野计算）
      if (!isFinite(absPos.x) || !isFinite(absPos.y)) continue;
      if (Math.abs(absPos.x) > 100000 || Math.abs(absPos.y) > 100000) continue;
      validCount++;
      minX = Math.min(minX, absPos.x - cell.radius);
      minY = Math.min(minY, absPos.y - cell.radius);
      maxX = Math.max(maxX, absPos.x + cell.radius);
      maxY = Math.max(maxY, absPos.y + cell.radius);
    }
    
    if (validCount === 0) {
      _showToast('没有有效基圆');
      return;
    }
    
    // 计算中心和范围
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const range = Math.max(rangeX, rangeY, 200);
    
    // 设置相机视野（限制缩放范围，避免过远或过近）
    const camera = RenderBridge.getCamera();
    const zoom = Math.max(0.1, Math.min(2.0, 400 / range));
    RenderBridge.setCamera({ x: centerX, y: centerY, zoom });
    
    _showToast(`已重置视野 (${validCount}/${cells.length}个基圆)`);
  }
  
  // 获取基圆的绝对位置（考虑父基圆）
  function getAbsolutePosition(cell) {
    let x = cell.x;
    let y = cell.y;
    let parent = cell.parentId ? CellCore.getCell(cell.parentId) : null;
    while (parent) {
      x += parent.x;
      y += parent.y;
      parent = parent.parentId ? CellCore.getCell(parent.parentId) : null;
    }
    return { x, y };
  }

  return {
    init, getModule,
    enterCellLayer, exitCellLayer, deleteCell,
    showProviderConfig: _showProviderConfig,
    showToast: _showToast,
    resetCameraToSeeAll,
    getAbsolutePosition
  };
})();

// 暴露到全局（用于调试）
window.Loader = Loader;

// 调试工具：列出所有基圆的状态
window.dumpCells = function() {
  const cells = CellCore.getAllCells();
  console.log('=== 基圆列表 (' + cells.length + ') ===');
  for (const cell of cells) {
    const abs = (Loader && Loader.getAbsolutePosition) ? Loader.getAbsolutePosition(cell) : {x:cell.x, y:cell.y};
    console.log(`[${cell.name || 'unnamed'}] id=${cell.id}, kind=${cell.kind}, pos=(${Math.round(cell.x)},${Math.round(cell.y)}), abs=(${Math.round(abs.x)},${Math.round(abs.y)}), radius=${cell.radius}, visible=${cell.visible}, opacity=${cell.opacity}`);
  }
};

// 调试工具：显示指定基圆
window.focusCell = function(nameOrId) {
  const cells = CellCore.getAllCells();
  let found = cells.find(c => c.id === nameOrId || c.name === nameOrId);
  if (!found) {
    console.log('找不到基圆:', nameOrId);
    return;
  }
  RenderBridge.setCamera({ x: found.x, y: found.y, zoom: 1.5 });
  console.log('已聚焦到基圆:', found.name || found.id);
};

// 启动引擎
window.addEventListener('DOMContentLoaded', () => {
  Loader.init();
});
