/**
 * 基圆核心 (cellCore.js)
 * 最复杂的种子层模块，负责基圆的创建、删除、属性管理、嵌套关系、种类系统和触发模式管理
 * V4.0 新增：端口系统、线缆注册表、代码映射支持
 * 依赖：事件循环、持久化层、端口模块、线缆注册表（通过全局 window 对象引用）
 */

const Types = window.Types || window.CellEngineTypes;
const WireRegistry = window.WireRegistry;
const InputPort = window.InputPort;
const OutputPort = window.OutputPort;

const CellCore = (() => {
  let _cells = new Map();
  let _kindRegistry = new Map();
  let _eventListeners = new Map();
  let _globalListeners = new Map();
  let _gameLoop = null;
  let _persistLayer = null;
  let _dirtyCells = new Set();
  let _currentParentId = null;
  let _wireRegistry = null;

  const DEFAULT_KINDS = {
    empty: {
      name: '空基圆',
      defaultTriggerMode: 'event',
      defaultColor: '#ffffff',
      defaultRadius: 25,
      defaultOpacity: 1,
      defaultShape: 'circle',
      defaultAttributes: { energy: 100 },
      renderStyle: 'circle-border'
    },
    creature: {
      name: '生物',
      defaultTriggerMode: 'continuous',
      defaultColor: '#e8a040',
      defaultRadius: 20,
      defaultOpacity: 1,
      defaultShape: 'circle',
      defaultAttributes: { hp: 100, speed: 1, direction: 0, energy: 100 },
      renderStyle: 'circle-direction'
    },
    plant: {
      name: '植物',
      defaultTriggerMode: 'pulse',
      defaultTriggerThreshold: 120,
      defaultColor: '#40a860',
      defaultRadius: 25,
      defaultOpacity: 1,
      defaultShape: 'circle',
      defaultAttributes: { growthRate: 0.03, maxSize: 50, energy: 30 },
      renderStyle: 'circle-wave'
    },
    insect: {
      name: '昆虫',
      defaultTriggerMode: 'continuous',
      defaultColor: '#a85050',
      defaultRadius: 8,
      defaultOpacity: 1,
      defaultShape: 'circle',
      defaultAttributes: { hp: 50, speed: 1.0, direction: 0, energy: 80, flying: false, hostile: false },
      renderStyle: 'circle-direction'
    },
    static: {
      name: '静态物',
      defaultTriggerMode: 'event',
      defaultColor: '#888899',
      defaultRadius: 30,
      defaultOpacity: 1,
      defaultShape: 'circle',
      defaultAttributes: { weight: 100, energy: 100 },
      renderStyle: 'circle-solid'
    },
    ui: {
      name: 'UI组件',
      defaultTriggerMode: 'event',
      defaultColor: '#5050a0',
      defaultRadius: 30,
      defaultOpacity: 1,
      defaultShape: 'rect',
      defaultAttributes: { textContent: '', fontSize: 14, bgColor: '#303060', energy: 100 },
      renderStyle: 'rounded-rect'
    },
    effect: {
      name: '特效',
      defaultTriggerMode: 'pulse',
      defaultTriggerThreshold: 2,
      defaultColor: '#ff8080',
      defaultRadius: 15,
      defaultOpacity: 0.6,
      defaultShape: 'circle',
      defaultAttributes: { lifetime: 60, age: 0, energy: 100 },
      renderStyle: 'circle-glow'
    },
    engine: {
      name: '引擎模块',
      defaultTriggerMode: 'event',
      defaultColor: '#4a4a6a',
      defaultRadius: 40,
      defaultOpacity: 0.8,
      defaultShape: 'circle',
      defaultAttributes: { energy: 100 },
      renderStyle: 'circle-gear'
    },
    trigger: {
      name: '触发器',
      defaultTriggerMode: 'event',
      defaultColor: '#c060c0',
      defaultRadius: 50,
      defaultOpacity: 0.4,
      defaultShape: 'circle',
      defaultAttributes: { message: '', energy: 100 },
      renderStyle: 'circle-dashed'
    }
  };

  function _generateId() {
    return 'cell_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  function init(gameLoop, persistLayer, wireRegistry, codeLoader) {
    _gameLoop = gameLoop;
    _persistLayer = persistLayer;
    _wireRegistry = wireRegistry || (WireRegistry ? new WireRegistry(publicApi) : null);
    _codeLoader = codeLoader || (window.CodeLoader ? new window.CodeLoader(publicApi, persistLayer) : null);

    for (const [kind, def] of Object.entries(DEFAULT_KINDS)) {
      _kindRegistry.set(kind, def);
    }

    if (_codeLoader) {
      _codeLoader.init();
    }

    console.log('[CellCore] 初始化完成，注册了 ' + _kindRegistry.size + ' 种基圆种类');
  }

  function setWireRegistry(wireRegistry) {
    _wireRegistry = wireRegistry;
  }

  function getWireRegistry() {
    return _wireRegistry;
  }

  function setCodeLoader(codeLoader) {
    _codeLoader = codeLoader;
  }

  function getCodeLoader() {
    return _codeLoader;
  }

  function loadCellCode(cellId) {
    if (!_codeLoader) {
      const cell = _cells.get(cellId);
      return cell ? cell.code || '' : '';
    }
    return _codeLoader.loadCode(cellId);
  }

  function saveCellCode(cellId, code) {
    const cell = _cells.get(cellId);
    if (!cell) return false;

    if (_codeLoader) {
      _codeLoader.saveCode(cellId, code);
    }

    cell.code = code;
    _markDirty(cellId);

    _emitInternal('cell:codeUpdated', { cellId, code });
    return true;
  }

  function getCellCodeMode(cellId) {
    if (!_codeLoader) {
      return Types ? Types.CodeMappingMode.SEGMENT : 'segment';
    }
    return _codeLoader.getMode(cellId);
  }

  function setCellCodeMode(cellId, mode) {
    if (!_codeLoader) return false;
    return _codeLoader.setMode(cellId, mode);
  }

  function registerKind(kindDef) {
    if (_kindRegistry.has(kindDef.kind)) {
      console.warn('[CellCore] 种类已存在，覆盖:', kindDef.kind);
    }
    _kindRegistry.set(kindDef.kind, kindDef);
  }

  function getKindDefinition(kind) {
    return _kindRegistry.get(kind);
  }

  function getAllKinds() {
    return [..._kindRegistry.entries()].map(([k, v]) => ({ kind: k, ...v }));
  }

  function createCell(kind = 'empty', x = 0, y = 0, parentId = null) {
    const kindDef = _kindRegistry.get(kind) || _kindRegistry.get('empty');
    const id = _generateId();

    const now = Date.now();
    const cell = {
      id,
      name: kindDef.name || kind,
      kind,
      role: '',
      x,
      y,
      radius: kindDef.defaultRadius || 25,
      rotation: 0,
      opacity: kindDef.defaultOpacity || 1,
      zIndex: 0,
      color: kindDef.defaultColor || '#ffffff',
      shape: kindDef.defaultShape || 'circle',
      selectable: true,
      visible: true,
      parentId,
      childrenIds: [],
      description: '',
      code: '',
      compiledFn: null,
      builtIn: false,
      attributes: { ...(kindDef.defaultAttributes || {}) },
      triggerConfig: {
        mode: kindDef.defaultTriggerMode || 'event',
        threshold: kindDef.defaultTriggerThreshold || 60,
        accumulator: 0,
        pulseDecay: 0,
        eventMask: [],
        wakeConditions: [],
        _originalMode: null
      },
      ports: {
        inputs: {},
        outputs: {}
      },
      tags: [],
      createdAt: now,
      updatedAt: now,
      state: 'normal',
      errorInfo: null
    };

    _cells.set(id, cell);
    _markDirty(id);

    if (parentId && _cells.has(parentId)) {
      const parent = _cells.get(parentId);
      if (!parent.childrenIds.includes(id)) {
        parent.childrenIds.push(id);
        _markDirty(parentId);
      }
    }

    if (_persistLayer) {
      _persistLayer.saveCell(cell);
    }

    _emitInternal('cell:created', { cellId: id, kind, x, y });

    return cell;
  }

  function destroyCell(id) {
    const cell = _cells.get(id);
    if (!cell) return false;

    if (cell.kind === 'engine' && cell.builtIn) {
      console.warn('[CellCore] 内置引擎基圆不可删除:', id);
      return false;
    }

    // 迭代式收集所有待删除的ID（包括子孙节点），避免递归爆栈
    const idsToDestroy = [id];
    const processed = new Set();
    let head = 0;
    while (head < idsToDestroy.length) {
      const curId = idsToDestroy[head++];
      if (processed.has(curId)) continue;
      processed.add(curId);
      const cur = _cells.get(curId);
      if (cur && cur.childrenIds && cur.childrenIds.length) {
        for (let i = 0; i < cur.childrenIds.length; i++) {
          const cid = cur.childrenIds[i];
          if (!processed.has(cid)) {
            const child = _cells.get(cid);
            if (child && !(child.kind === 'engine' && child.builtIn)) {
              idsToDestroy.push(cid);
            }
          }
        }
      }
    }

    // 从叶子到根逆序删除（避免父节点先删后子节点查找不到）
    for (let i = idsToDestroy.length - 1; i >= 0; i--) {
      const cid = idsToDestroy[i];
      const c = _cells.get(cid);
      if (!c) continue;

      if (_wireRegistry && typeof _wireRegistry.disconnectCell === 'function') {
        try { _wireRegistry.disconnectCell(cid); } catch (e) {}
      }

      // 从父节点的 childrenIds 中移除
      if (c.parentId && _cells.has(c.parentId)) {
        const parent = _cells.get(c.parentId);
        if (parent && parent.childrenIds) {
          parent.childrenIds = parent.childrenIds.filter(x => x !== cid);
          _markDirty(c.parentId);
        }
      }

      _removeAllCellListeners(cid);
      _cells.delete(cid);
      _dirtyCells.delete(cid);

      if (_persistLayer && typeof _persistLayer.deleteCell === 'function') {
        try { _persistLayer.deleteCell(cid); } catch (e) {}
      }

      _emitInternal('cell:destroyed', { cellId: cid });
    }

    return true;
  }

  // ===== 批量清空世界（保留 engine 基圆）— 迭代式，避免爆栈 =====
  function destroyAllNonEngineCells() {
    const toDelete = [];
    for (const [id, cell] of _cells) {
      if (cell.kind === 'engine' && cell.builtIn) continue;
      toDelete.push(id);
    }
    if (toDelete.length === 0) {
      _emitInternal('world:cleared', { clearedCount: 0 });
      return 0;
    }

    // 先处理父子关系：把所有待删除节点从它们的父节点 childrenIds 中移除
    for (let i = 0; i < toDelete.length; i++) {
      const c = _cells.get(toDelete[i]);
      if (c && c.parentId && _cells.has(c.parentId)) {
        const parent = _cells.get(c.parentId);
        if (parent && parent.childrenIds) {
          parent.childrenIds = parent.childrenIds.filter(x => {
            // 快速判断：如果x也在toDelete里则直接跳过（避免逐个查找，但简单写法够用）
            return !c || x !== toDelete[i];
          });
        }
      }
    }

    // 断开连线
    if (_wireRegistry && typeof _wireRegistry.disconnectCell === 'function') {
      for (let i = 0; i < toDelete.length; i++) {
        try { _wireRegistry.disconnectCell(toDelete[i]); } catch (e) {}
      }
    }

    // 清除事件监听
    for (let i = 0; i < toDelete.length; i++) {
      _removeAllCellListeners(toDelete[i]);
    }

    // 从 _cells 中删除所有目标基圆（非递归单步删除，最安全）
    let count = 0;
    for (let i = 0; i < toDelete.length; i++) {
      if (_cells.has(toDelete[i])) {
        _cells.delete(toDelete[i]);
        _dirtyCells.delete(toDelete[i]);
        count++;
      }
    }

    // 持久化层也批量删除（简单逐个调用）
    if (_persistLayer && typeof _persistLayer.deleteCell === 'function') {
      for (let i = 0; i < toDelete.length; i++) {
        try { _persistLayer.deleteCell(toDelete[i]); } catch (e) {}
      }
    }

    // 只发射一次 world:cleared，不发射单个 cell:destroyed 事件
    _emitInternal('world:cleared', { clearedCount: count });
    return count;
  }

  // ===== 获取当前世界边界（用于在视口范围内生成场景） =====
  function estimateWorldBounds(paddingFactor) {
    const cells = [..._cells.values()].filter(c => c.kind !== 'engine');
    if (cells.length === 0) {
      const half = 800;
      return { minX: -half, maxX: half, minY: -half, maxY: half };
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of cells) {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
    }
    const pad = (paddingFactor || 0.2) * Math.max(maxX - minX, maxY - minY, 200);
    return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
  }

  function updateCell(id, props) {
    const cell = _cells.get(id);
    if (!cell) return null;

    if (cell.kind === 'engine' && cell.builtIn) {
      const protectedProps = ['kind', 'parentId', 'code', 'builtIn'];
      for (const key of protectedProps) {
        if (props.hasOwnProperty(key)) {
          delete props[key];
        }
      }
    }

    let hasChanges = false;
    for (const [key, value] of Object.entries(props)) {
      // NaN/Infinity 防御：防止无效数值污染坐标等属性
      if (typeof value === 'number' && (!isFinite(value) || Number.isNaN(value))) {
        console.warn('[CellCore] updateCell 收到无效数值，已拒绝:', id, key, value);
        continue;
      }
      if (key === 'attributes') {
        if (!cell.attributes) cell.attributes = {};
        Object.assign(cell.attributes, value);
        hasChanges = true;
      } else if (key in cell) {
        if (cell[key] !== value) {
          cell[key] = value;
          hasChanges = true;
        }
      } else {
        // 自定义属性存储到 attributes 中
        if (!cell.attributes) cell.attributes = {};
        if (cell.attributes[key] !== value) {
          cell.attributes[key] = value;
          hasChanges = true;
        }
      }
    }

    if (!hasChanges) return cell;

    cell.updatedAt = Date.now();

    _markDirty(id);

    _emitInternal('cell:updated', { cellId: id });

    return cell;
  }

  function setAttribute(id, key, value) {
    const cell = _cells.get(id);
    if (!cell) return;
    // NaN/Infinity 防御
    if (typeof value === 'number' && (!isFinite(value) || Number.isNaN(value))) {
      console.warn('[CellCore] setAttribute 收到无效数值，已拒绝:', id, key, value);
      return;
    }
    if (!cell.attributes) cell.attributes = {};
    // 值未变化时跳过，避免不必要的UI更新
    if (cell.attributes[key] === value) return;
    cell.attributes[key] = value;
    cell.updatedAt = Date.now();
    _markDirty(id);
    // 触发属性更新事件，让UI可以响应
    _emitInternal('attribute:changed', { cellId: id, key, value });
  }

  function getCell(id) {
    return _cells.get(id) || null;
  }

  function getAllCells() {
    return [..._cells.values()];
  }

  function getCellCount() {
    return _cells.size;
  }

  function queryCells(filter) {
    let results = [..._cells.values()];
    if (filter.kind) results = results.filter(c => c.kind === filter.kind);
    if (filter.role) results = results.filter(c => c.role === filter.role);
    if (filter.parentId !== undefined) results = results.filter(c => c.parentId === filter.parentId);
    if (filter.visible !== undefined) results = results.filter(c => c.visible === filter.visible);
    if (filter.state) results = results.filter(c => c.state === filter.state);
    if (filter.near) {
      const { x, y, radius } = filter.near;
      results = results.filter(c => {
        const dx = c.x - x, dy = c.y - y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
      });
    }
    return results;
  }

  function enterCell(parentId) {
    const cell = _cells.get(parentId);
    if (!cell) return null;
    _currentParentId = parentId;
    _emitInternal('cell:enter', { cellId: parentId });
    return cell;
  }

  function exitCell() {
    if (!_currentParentId) return null;
    const cell = _cells.get(_currentParentId);
    const parentId = _currentParentId;
    _currentParentId = cell ? cell.parentId : null;
    _emitInternal('cell:exit', { cellId: parentId });
    return cell;
  }

  function getCurrentParentId() {
    return _currentParentId;
  }

  function _markDirty(id) {
    _dirtyCells.add(id);
    // 自动同步到 PersistLayer 脏位，避免"基圆变更未持久化"
    if (_persistLayer && typeof _persistLayer.markDirty === 'function') {
      _persistLayer.markDirty(id);
    }
  }

  function isDirty(id) {
    return _dirtyCells.has(id);
  }

  function clearDirty(id) {
    _dirtyCells.delete(id);
  }

  function getDirtyCells() {
    return [..._dirtyCells];
  }

  function clearAllDirty() {
    _dirtyCells.clear();
  }

  function updateAccumulators(dt) {
    if (typeof dt !== 'number' || !isFinite(dt) || dt <= 0) return;
    for (const [id, cell] of _cells) {
      if (cell?.triggerConfig?.mode === 'pulse') {
        cell.triggerConfig.accumulator = (cell.triggerConfig.accumulator || 0) + 1;
        if (cell.triggerConfig.pulseDecay > 0) {
          const deltaSeconds = dt / 1000;
          cell.triggerConfig.accumulator *= (1 - cell.triggerConfig.pulseDecay * deltaSeconds);
          if (cell.triggerConfig.accumulator < 0) cell.triggerConfig.accumulator = 0;
        }
      }
    }
  }

  function getPulseReadyCells() {
    const result = [];
    for (const [id, cell] of _cells) {
      if (cell?.triggerConfig?.mode === 'pulse' &&
          (cell.triggerConfig.accumulator || 0) >= (cell.triggerConfig.threshold || 60)) {
        result.push(cell);
      }
    }
    return result;
  }

  function getContinuousCells() {
    const result = [];
    for (const [id, cell] of _cells) {
      if (cell?.triggerConfig?.mode === 'continuous' && cell.state === 'normal') {
        result.push(cell);
      }
    }
    return result;
  }

  function resetAccumulator(id) {
    const cell = _cells.get(id);
    if (cell) {
      cell.triggerConfig.accumulator = 0;
    }
  }

  function setTriggerMode(id, mode, config = {}) {
    const cell = _cells.get(id);
    if (!cell) return;
    if (!cell.triggerConfig) {
      cell.triggerConfig = { mode: 'event', threshold: 60, accumulator: 0, pulseDecay: 0, eventMask: [], wakeConditions: [], _originalMode: null };
    }

    if (cell.triggerConfig.mode === 'dormant' && mode !== 'dormant') {
      const accumulatedDt = cell.triggerConfig.accumulator * 16.67;
      cell.triggerConfig.mode = mode;
      cell.triggerConfig.accumulator = 0;
      if (config.threshold) cell.triggerConfig.threshold = config.threshold;
      if (config.eventMask) cell.triggerConfig.eventMask = config.eventMask;
      _emitInternal('cell:wake', { cellId: id, accumulatedDt });
    } else {
      cell.triggerConfig.mode = mode;
      if (config.threshold) cell.triggerConfig.threshold = config.threshold;
      if (config.eventMask) cell.triggerConfig.eventMask = config.eventMask;
    }

    _markDirty(id);
  }

  function setCellDormant(id) {
    const cell = _cells.get(id);
    if (!cell || !cell.triggerConfig) return;
    if (cell.triggerConfig.mode === 'dormant') return;
    if (cell.triggerConfig.mode === 'continuous' || cell.triggerConfig.mode === 'pulse') {
      cell.triggerConfig._originalMode = cell.triggerConfig.mode;
      cell.triggerConfig.mode = 'dormant';
      _markDirty(id);
    }
  }

  function wakeCell(id) {
    const cell = _cells.get(id);
    if (!cell || !cell.triggerConfig || cell.triggerConfig.mode !== 'dormant') return;
    const originalMode = cell.triggerConfig._originalMode || 'event';
    const accumulatedDt = (cell.triggerConfig.accumulator || 0) * 16.67;
    cell.triggerConfig.mode = originalMode;
    cell.triggerConfig._originalMode = null;
    cell.triggerConfig.accumulator = 0;
    _markDirty(id);
    _emitInternal('cell:wake', { cellId: id, accumulatedDt });
  }

  // ========== V4.0 端口系统（完全重写，使用全局端口类和线缆注册表） ==========

  function defineInputPort(cellId, name, type) {
    const cell = _cells.get(cellId);
    if (!cell) return null;

    if (!cell.ports) {
      cell.ports = { inputs: {}, outputs: {} };
    }

    if (cell.ports.inputs[name]) {
      cell.ports.inputs[name].type = type;
      return cell.ports.inputs[name];
    }

    const port = new InputPort(cellId, name, type);
    port.onChange = (value, oldValue, wireId) => {
      _emitInternal('cell:portChange', {
        cellId,
        portName: name,
        portType: 'input',
        value,
        oldValue,
        wireId
      });
    };

    cell.ports.inputs[name] = port;
    _markDirty(cellId);

    return port;
  }

  function defineOutputPort(cellId, name, type) {
    const cell = _cells.get(cellId);
    if (!cell) return null;

    if (!cell.ports) {
      cell.ports = { inputs: {}, outputs: {} };
    }

    if (cell.ports.outputs[name]) {
      cell.ports.outputs[name].type = type;
      return cell.ports.outputs[name];
    }

    const port = new OutputPort(cellId, name, type);
    cell.ports.outputs[name] = port;
    _markDirty(cellId);

    return port;
  }

  function connectPorts(fromCellId, fromPortName, toCellId, toPortName) {
    if (!_wireRegistry) {
      console.warn('[CellCore] WireRegistry not initialized');
      return false;
    }

    const fromCell = _cells.get(fromCellId);
    const toCell = _cells.get(toCellId);

    if (!fromCell || !toCell) {
      console.warn('[CellCore] Cell not found');
      return false;
    }

    const fromPort = fromCell.ports?.outputs?.[fromPortName];
    const toPort = toCell.ports?.inputs?.[toPortName];

    if (!fromPort || !toPort) {
      console.warn('[CellCore] Port not found:', fromPortName, toPortName);
      return false;
    }

    const wire = _wireRegistry.connect(
      fromCellId,
      fromPortName,
      toCellId,
      toPortName
    );

    if (wire) {
      _emitInternal('cell:portConnected', {
        fromCellId,
        fromPortName,
        toCellId,
        toPortName,
        wireId: wire.id
      });
    }

    return wire !== null;
  }

  function disconnectPort(wireId) {
    if (!_wireRegistry) return false;

    const result = _wireRegistry.disconnect(wireId);

    if (result) {
      _emitInternal('cell:portDisconnected', { wireId });
    }

    return result;
  }

  function getCellPorts(cellId) {
    const cell = _cells.get(cellId);
    if (!cell) return { inputs: {}, outputs: {} };

    const result = { inputs: {}, outputs: {} };

    if (cell.ports?.inputs) {
      for (const [name, port] of Object.entries(cell.ports.inputs)) {
        result.inputs[name] = port.getInfo ? port.getInfo() : {
          id: port.id,
          name: port.name,
          type: port.type,
          direction: 'input',
          value: port.value
        };
      }
    }

    if (cell.ports?.outputs) {
      for (const [name, port] of Object.entries(cell.ports.outputs)) {
        result.outputs[name] = port.getInfo ? port.getInfo() : {
          id: port.id,
          name: port.name,
          type: port.type,
          direction: 'output',
          value: port.value
        };
      }
    }

    return result;
  }

  function getCellWires(cellId) {
    if (!_wireRegistry) return [];
    return _wireRegistry.getWiresByCell(cellId);
  }

  function getAllWires() {
    if (!_wireRegistry) return [];
    return _wireRegistry.getWires();
  }

  function sendPortData(cellId, portName, value) {
    const cell = _cells.get(cellId);
    if (!cell) return false;

    const port = cell.ports?.outputs?.[portName];
    if (!port) {
      console.warn('[CellCore] Output port not found:', portName);
      return false;
    }

    const success = port.send(value);

    _emitInternal('cell:portSend', { cellId, portName, value });
    return success;
  }

  function getPortValue(cellId, portDirection, portName) {
    const cell = _cells.get(cellId);
    if (!cell) return undefined;

    const port = cell.ports?.[portDirection]?.[portName];
    return port?.value;
  }

  // ========== 碰撞检测 ==========

  const SPATIAL_GRID_SIZE = 100;
  let _spatialGrid = new Map();

  function _getGridKey(x, y) {
    const gx = Math.floor(x / SPATIAL_GRID_SIZE);
    const gy = Math.floor(y / SPATIAL_GRID_SIZE);
    return `${gx},${gy}`;
  }

  function _updateSpatialGrid() {
    _spatialGrid.clear();
    for (const [id, cell] of _cells) {
      if (!cell.visible || cell.kind === 'engine') continue;
      const key = _getGridKey(cell.x, cell.y);
      if (!_spatialGrid.has(key)) {
        _spatialGrid.set(key, []);
      }
      _spatialGrid.get(key).push(id);
    }
  }

  function checkCollisions() {
    _updateSpatialGrid();
    const collisions = [];

    for (const [key, cellIds] of _spatialGrid) {
      const [gx, gy] = key.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const neighborKey = `${gx + dx},${gy + dy}`;
          const neighborIds = _spatialGrid.get(neighborKey);
          if (!neighborIds) continue;

          for (const idA of cellIds) {
              for (const idB of neighborIds) {
                if (idA >= idB) continue;
                const cellA = _cells.get(idA);
                const cellB = _cells.get(idB);
                if (!cellA || !cellB) continue;

                // 坐标和半径有效性检查
                if (!isFinite(cellA.x) || !isFinite(cellA.y) || !isFinite(cellA.radius) ||
                    !isFinite(cellB.x) || !isFinite(cellB.y) || !isFinite(cellB.radius)) {
                  continue;
                }

                const distX = cellA.x - cellB.x;
                const distY = cellA.y - cellB.y;
                const dist = Math.sqrt(distX * distX + distY * distY);
                if (!isFinite(dist)) continue;

                // ===== 重叠预防（分离于事件触发）=====
                // 飞行生物跳过；引擎基圆跳过
                const isEngineA = cellA.kind === 'engine';
                const isEngineB = cellB.kind === 'engine';
                const flyingA = cellA.attributes && cellA.attributes.flying;
                const flyingB = cellB.attributes && cellB.attributes.flying;
                const bothFlying = flyingA && flyingB;
                const oneFlying = flyingA || flyingB;

                // softRadius 属性：自定义碰撞半径（视觉半径不改变）
                // 若 softRadius 存在 → 直接使用该值作为碰撞半径
                // 否则 → 使用 radius * 0.85（可以接触但不会完全重叠）
                const getSoftRadius = (cell) => {
                  if (cell && cell.attributes && typeof cell.attributes.softRadius === 'number') {
                    return cell.attributes.softRadius;
                  }
                  return cell.radius * 0.85;
                };
                const collRadiusA = getSoftRadius(cellA);
                const collRadiusB = getSoftRadius(cellB);
                const minOverlapDist = collRadiusA + collRadiusB;

                if (!bothFlying && !isEngineA && !isEngineB) {
                  // 一个飞行一个地面：飞行的在上方不受限，只处理地面一方
                  if (oneFlying) {
                    // 飞行生物在"上方"，不与地面发生物理碰撞
                  } else if (dist < minOverlapDist && dist > 0) {
                    const nx = distX / dist;
                    const ny = distY / dist;
                    const totalPush = minOverlapDist - dist;

                    // ===== 不可移动判定 =====
                    // 静态物(石头/水塘/蚁巢) 和 植物 不可被推动
                    const Aimmovable = (cellA.kind === 'static' || cellA.kind === 'plant' ||
                                        (cellA.attributes && cellA.attributes.immovable));
                    const Bimmovable = (cellB.kind === 'static' || cellB.kind === 'plant' ||
                                        (cellB.attributes && cellB.attributes.immovable));

                    // ===== 根据移动性分配推力 =====
                    if (Aimmovable && Bimmovable) {
                      // 两者都不可动 → 不做物理分离
                    } else if (Aimmovable) {
                      // A 不可动 → 只把 B 推离 A
                      cellB.x -= nx * totalPush;
                      cellB.y -= ny * totalPush;
                      _markDirty(idB);
                    } else if (Bimmovable) {
                      // B 不可动 → 只把 A 推离 B
                      cellA.x += nx * totalPush;
                      cellA.y += ny * totalPush;
                      _markDirty(idA);
                    } else {
                      // 两者都可动 → 均分推力（原逻辑）
                      const halfPush = totalPush / 2;
                      cellA.x += nx * halfPush;
                      cellA.y += ny * halfPush;
                      cellB.x -= nx * halfPush;
                      cellB.y -= ny * halfPush;
                      _markDirty(idA);
                      _markDirty(idB);
                    }
                  }
                }

                // ===== 事件触发（保留原有逻辑）=====
                const maskA = cellA.triggerConfig?.eventMask || [];
                const maskB = cellB.triggerConfig?.eventMask || [];
                const aNeedsCollision = maskA.includes('onCollision');
                const bNeedsCollision = maskB.includes('onCollision');

                if ((aNeedsCollision || bNeedsCollision) && dist < (cellA.radius + cellB.radius) * 1.2) {
                  collisions.push({ idA, idB, kindA: cellA.kind, kindB: cellB.kind });
                }
              }
            }
        }
      }
    }

    return collisions;
  }

  // ========== 事件总线 ==========

  function _emitInternal(eventName, data) {
    const listeners = _globalListeners.get(eventName);
    if (listeners) {
      for (const cb of listeners) {
        try { cb(data); } catch (e) { console.error('[CellCore] 事件回调错误:', e); }
      }
    }
  }

  function emit(eventName, data) {
    _emitInternal(eventName, data);
  }

  function on(eventName, callback) {
    if (!_globalListeners.has(eventName)) {
      _globalListeners.set(eventName, []);
    }
    _globalListeners.get(eventName).push(callback);
  }

  function once(eventName, callback) {
    const wrapper = (data) => {
      callback(data);
      off(eventName, wrapper);
    };
    on(eventName, wrapper);
  }

  function off(eventName, callback) {
    const listeners = _globalListeners.get(eventName);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx !== -1) listeners.splice(idx, 1);
    }
  }

  function addCellListener(cellId, eventName, callback) {
    const key = `${cellId}:${eventName}`;
    if (!_eventListeners.has(key)) {
      _eventListeners.set(key, []);
    }
    _eventListeners.get(key).push(callback);
  }

  function removeCellListener(cellId, eventName, callback) {
    const key = `${cellId}:${eventName}`;
    const listeners = _eventListeners.get(key);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx !== -1) listeners.splice(idx, 1);
    }
  }

  function emitCellEvent(cellId, eventName, data) {
    const key = `${cellId}:${eventName}`;
    const listeners = _eventListeners.get(key);
    if (listeners) {
      for (const cb of listeners) {
        try { cb(data); } catch (e) { console.error('[CellCore] 基圆事件回调错误:', e); }
      }
    }
  }

  function _removeAllCellListeners(cellId) {
    for (const [key] of _eventListeners) {
      if (key.startsWith(cellId + ':')) {
        _eventListeners.delete(key);
      }
    }
  }

  // ========== 批量加载（从持久化层恢复） ==========

  function loadCells(cellsArray) {
    for (const cellData of cellsArray) {
      // 确保关键字段存在（避免后续操作不会报错
      if (!cellData.ports) {
        cellData.ports = { inputs: {}, outputs: {} };
      }
      if (!cellData.attributes) {
        cellData.attributes = {};
      }
      if (!cellData.triggerConfig) {
        cellData.triggerConfig = {
          mode: 'event', threshold: 60, accumulator: 0, pulseDecay: 0, eventMask: [], wakeConditions: [], _originalMode: null };
      }
      if (!cellData.childrenIds) {
        cellData.childrenIds = [];
      }
      if (cellData.x === undefined || cellData.x === null) cellData.x = 0;
      if (cellData.y === undefined || cellData.y === null) cellData.y = 0;
      if (cellData.radius === undefined || cellData.radius === null) cellData.radius = 25;
      _cells.set(cellData.id, cellData);
    }
    console.log(`[CellCore] 加载了 ${cellsArray.length} 个基圆`);
  }

  function getCellDataForSave(id) {
    const cell = _cells.get(id);
    if (!cell) return null;

    const serializableCell = { ...cell };
    if (cell.ports) {
      serializableCell.ports = {
        inputs: {},
        outputs: {}
      };
      for (const [name, port] of Object.entries(cell.ports.inputs || {})) {
        serializableCell.ports.inputs[name] = port.toJSON ? port.toJSON() : {
          id: port.id, name: port.name, type: port.type, direction: 'input'
        };
      }
      for (const [name, port] of Object.entries(cell.ports.outputs || {})) {
        serializableCell.ports.outputs[name] = port.toJSON ? port.toJSON() : {
          id: port.id, name: port.name, type: port.type, direction: 'output'
        };
      }
    }

    return serializableCell;
  }

  function getAllCellDataForSave() {
    return [..._cells.values()].map(c => getCellDataForSave(c.id));
  }

  // ========== 错误状态管理 ==========

  function setCellError(id, errorInfo) {
    const cell = _cells.get(id);
    if (!cell) return;
    cell.state = 'error';
    cell.errorInfo = errorInfo;
    _markDirty(id);
  }

  function clearCellError(id) {
    const cell = _cells.get(id);
    if (!cell) return;
    cell.state = 'normal';
    cell.errorInfo = null;
    _markDirty(id);
  }

  const publicApi = {
    init,
    registerKind, getKindDefinition, getAllKinds,
    createCell, destroyCell, destroyAllNonEngineCells, estimateWorldBounds,
    updateCell, setAttribute,
    getCell, getAllCells, getCellCount, queryCells,
    enterCell, exitCell, getCurrentParentId,
    markDirty: _markDirty,
    isDirty, clearDirty, getDirtyCells, clearAllDirty,
    updateAccumulators, getPulseReadyCells, getContinuousCells, resetAccumulator,
    setTriggerMode, setCellDormant, wakeCell,
    checkCollisions,
    emit, on, once, off,
    addCellListener, removeCellListener, emitCellEvent,
    loadCells, getCellDataForSave, getAllCellDataForSave,
    setCellError, clearCellError,
    setWireRegistry, getWireRegistry,
    setCodeLoader, getCodeLoader,
    loadCellCode, saveCellCode, getCellCodeMode, setCellCodeMode,
    defineInputPort, defineOutputPort,
    connectPorts, disconnectPort,
    getCellPorts, getCellWires, getAllWires,
    sendPortData, getPortValue
  };

  return publicApi;
})();

// 暴露到全局
if (typeof window !== 'undefined') {
  window.CellCore = CellCore;
}
