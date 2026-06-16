/**
 * 沙箱执行器 (sandbox.js)
 * 在 Web Worker 中安全执行用户和AI生成的代码
 * V4.0 新增：支持CellContext接口和端口系统
 * 依赖：基圆核心、事件循环、CellContext
 */

const Sandbox = (() => {
  const WORKER_VERSION = 'v4.0.9';
  let _cellCore = null;
  let _gameLoop = null;
  let _workerA = null; // 连续模式Worker
  let _workerB = null; // 事件驱动/脉冲模式Worker
  let _workerCode = null; // Worker代码Blob URL
  let _wireRegistry = null; // 线缆注册表
  let _renderBridge = null; // 渲染桥接

  // 行为代码注册表
  let _codeRegistry = new Map(); // cellId -> { code, mode }
  
  // 自定义绘制函数注册表
  let _customDrawFunctions = new Map(); // cellId -> drawFn

  // 命令队列
  let _commandQueue = [];

  // 健康检查
  let _healthCheckTimer = null;
  const HEALTH_CHECK_INTERVAL = 2000;
  const HEALTH_CHECK_TIMEOUT = 1000;
  let _workerAPending = false;
  let _workerBPending = false;

  // 执行超时
  const EXECUTION_TIMEOUT_MS = 100;

  function init(cellCore, gameLoop, wireRegistry, renderBridge) {
    _cellCore = cellCore;
    _gameLoop = gameLoop;
    _wireRegistry = wireRegistry;
    _renderBridge = renderBridge || window.RenderBridge;

    // 终止旧的Worker
    if (_workerA) { _workerA.terminate(); _workerA = null; }
    if (_workerB) { _workerB.terminate(); _workerB = null; }

    // 创建Worker代码
    _createWorkerCode();

    // 启动双Worker
    _workerA = _createWorker('A');
    _workerB = _createWorker('B');

    // 启动健康检查
    _startHealthCheck();

    console.log('[Sandbox] 初始化完成，双Worker架构');
  }

  // ===== 创建Worker代码 =====
  function _createWorkerCode() {
    // V4.0.8 - 添加 createCell/destroyCell API
    
    console.log('[Sandbox] 创建Worker代码，版本:', WORKER_VERSION);
    
    // 先撤销旧的 Blob URL
    if (_workerCode) {
      URL.revokeObjectURL(_workerCode);
    }
    
    const workerScript = `
      // 基圆沙箱Worker - V4.0.7 CellContext接口
      // 版本: ${WORKER_VERSION}
      console.log('[Worker] Worker脚本已加载，版本:', '${WORKER_VERSION}');
      
      const behaviorRegistry = {}; // cellId -> { fn, api }
      const eventListeners = {};  // cellId -> { eventName -> [callbacks] }
      const animationQueue = [];  // 动画队列
      const cellContexts = {};    // cellId -> CellContext API
      const cellPropertyCache = {}; // cellId -> { 属性缓存 }
      const _queryResultCache = {}; // cellId -> [{ id, kind, name, x, y, radius }]
      const _frameCounter = {};   // cellId -> number（帧计数，用于 api.getFrame()）
      let _globalFrame = 0;       // 全局帧计数（无 cellId 时）

      // 创建CellContext兼容的API对象
      function createCellContext(cellId, postCommand) {
        console.log('[Worker] createCellContext for', cellId);
        // 初始化属性缓存
        if (!cellPropertyCache[cellId]) cellPropertyCache[cellId] = {};
        const context = {
          cellId,
          kind: '',

          // 属性访问
          getProperty(key) {
            const cache = cellPropertyCache[cellId] || {};
            if (key in cache) {
              const val = cache[key];
              if (typeof val === 'number' && (!isFinite(val) || Number.isNaN(val))) {
                postCommand(cellId, 'getProperty', { key });
                return 0;
              }
              if (val === undefined || val === null) {
                postCommand(cellId, 'getProperty', { key });
                return key === 'x' || key === 'y' || key === 'radius' || key === 'speed' ||
                       key === 'angle' || key === 'hunger' || key === 'health' || key === 'energy' ? 0 : undefined;
              }
              return val;
            }
            postCommand(cellId, 'getProperty', { key });
            return key === 'x' || key === 'y' || key === 'radius' || key === 'speed' ||
                   key === 'angle' || key === 'hunger' || key === 'health' || key === 'energy' ? 0 : undefined;
          },
          setProperty(key, value) {
            // NaN/Infinity 防御
            if (typeof value === 'number' && (!isFinite(value) || Number.isNaN(value))) {
              console.warn('[Worker] setProperty 被写入无效数值，已拒绝:', cellId, key, value);
              return;
            }
            if (!cellPropertyCache[cellId]) cellPropertyCache[cellId] = {};
            cellPropertyCache[cellId][key] = value;
            postCommand(cellId, 'setProperty', { key, value });
          },

          // 端口操作 - V4.0 新增
          defineInput(name, type) {
            postCommand(cellId, 'defineInput', { name, type: type || 'any' });
          },
          defineOutput(name, type) {
            postCommand(cellId, 'defineOutput', { name, type: type || 'any' });
          },
          connect(targetId, outputName, inputName) {
            postCommand(cellId, 'connectPorts', { targetId, outputName, inputName });
          },
          connectPorts(fromCellId, fromPortName, toCellId, toPortName) {
            postCommand(cellId, 'connectPortsExplicit', { fromCellId, fromPortName, toCellId, toPortName });
          },
          disconnect(targetId) {
            postCommand(cellId, 'disconnectPorts', { targetId });
          },
          disconnectPort(wireId) {
            postCommand(cellId, 'disconnectPort', { wireId });
          },
          sendPortData(portName, value) {
            postCommand(cellId, 'sendPortData', { portName, value });
          },
          getPortValue(direction, portName) {
            postCommand(cellId, 'getPortValue', { direction, portName });
            return undefined;
          },

          // 事件操作
          on(eventName, callback) {
            if (!eventListeners[cellId]) eventListeners[cellId] = {};
            if (!eventListeners[cellId][eventName]) eventListeners[cellId][eventName] = [];
            eventListeners[cellId][eventName].push(callback);
          },
          once(eventName, callback) {
            const wrapper = (data) => {
              callback(data);
              const listeners = eventListeners[cellId]?.[eventName];
              if (listeners) {
                const idx = listeners.indexOf(wrapper);
                if (idx !== -1) listeners.splice(idx, 1);
              }
            };
            this.on(eventName, wrapper);
          },
          off(eventName, callback) {
            const listeners = eventListeners[cellId]?.[eventName];
            if (listeners) {
              const idx = listeners.indexOf(callback);
              if (idx !== -1) listeners.splice(idx, 1);
            }
          },
          emit(eventName, data) {
            postCommand(cellId, 'emit', { eventName, data });
          },
          emitCellEvent(targetId, eventName, data) {
            postCommand(cellId, 'emitCellEvent', { targetId, eventName, data });
          },
          sendCommand(cmd, args) {
            postCommand(cellId, cmd, args);
          },

          // 生命周期
          init() {
            postCommand(cellId, 'lifecycle', { phase: 'init' });
          },
          update(dt) {
            postCommand(cellId, 'lifecycle', { phase: 'update', dt });
          },
          render(ctx) {
            postCommand(cellId, 'lifecycle', { phase: 'render' });
          },
          destroy() {
            postCommand(cellId, 'lifecycle', { phase: 'destroy' });
          },

          // 查询 - 同步版本
          queryCells(filter) {
            const cache = _queryResultCache[cellId] || [];
            if (filter && filter.kind) {
              return cache.filter(c => c.kind === filter.kind);
            }
            return cache;
          },

          // ===== v3.0 行为代码兼容性 API =====
          // 颜色 / 大小
          setColor(color) {
            if (!cellPropertyCache[cellId]) cellPropertyCache[cellId] = {};
            cellPropertyCache[cellId].color = color;
            postCommand(cellId, 'setProperty', { key: 'color', value: color });
          },
          setRadius(r) {
            if (!cellPropertyCache[cellId]) cellPropertyCache[cellId] = {};
            cellPropertyCache[cellId].radius = r;
            postCommand(cellId, 'setProperty', { key: 'radius', value: r });
          },
          // 设置基圆种类（cell.kind），有效值：empty/creature/plant/insect/static/ui/effect/engine/trigger
          setKind(kind) {
            const validKinds = ['empty', 'creature', 'plant', 'insect', 'static', 'ui', 'effect', 'engine', 'trigger'];
            if (!validKinds.includes(kind)) {
              console.warn('[Sandbox] setKind 收到无效种类 "' + kind + '"，有效值：' + validKinds.join('/'));
              return;
            }
            postCommand(cellId, 'setKind', { kind });
          },

          // 坐标
          getX() {
            const cache = cellPropertyCache[cellId] || {};
            if (typeof cache.x === 'number') {
              return cache.x;
            }
            // 如果缓存中没有坐标，请求主线程获取
            postCommand(cellId, 'getProperty', { key: 'x' });
            return 0;
          },
          getY() {
            const cache = cellPropertyCache[cellId] || {};
            if (typeof cache.y === 'number') {
              return cache.y;
            }
            // 如果缓存中没有坐标，请求主线程获取
            postCommand(cellId, 'getProperty', { key: 'y' });
            return 0;
          },
          setPosition(x, y) {
            if (!cellPropertyCache[cellId]) cellPropertyCache[cellId] = {};
            if (typeof x === 'number' && isFinite(x)) {
              cellPropertyCache[cellId].x = x;
              postCommand(cellId, 'setProperty', { key: 'x', value: x });
            }
            if (typeof y === 'number' && isFinite(y)) {
              cellPropertyCache[cellId].y = y;
              postCommand(cellId, 'setProperty', { key: 'y', value: y });
            }
          },

          // 帧计数
          getFrame() {
            return _frameCounter[cellId] || 0;
          },

          // 范围内查询
          findAllWithinRadius(x, y, r) {
            const cache = _queryResultCache[cellId] || [];
            const results = [];
            const r2 = r * r;
            for (let i = 0; i < cache.length; i++) {
              const c = cache[i];
              if (c.id === cellId) continue;
              const dx = c.x - x;
              const dy = c.y - y;
              if (dx * dx + dy * dy <= r2) results.push(c);
            }
            return results;
          },

          // 创建基圆
          createCell(options) {
            postCommand(cellId, 'createCell', options);
            return undefined;
          },

          // 删除基圆
          destroyCell(targetId) {
            postCommand(cellId, 'destroyCell', { targetId });
          },

          // 更新其他基圆的属性
          updateCellAttribute(targetId, key, value) {
            postCommand(cellId, 'updateCellAttribute', { targetId, key, value });
          },

          // 动画
          animate(prop, target, duration, easing) {
            postCommand(cellId, 'animate', { prop, target, duration, easing: easing || 'linear' });
          },

          // 触发模式
          setTriggerMode(mode, config) {
            postCommand(cellId, 'setTriggerMode', { mode, config });
          },

          // 自定义绘制
          registerDraw(drawFn) {
            postCommand(cellId, 'registerDraw', { drawFn: drawFn.toString() });
          },

          // ===== 开发者控制台相关 API =====
          openDevConsole() {
            postCommand(cellId, 'openDevConsole', {});
          },

          // ===== 游戏时间系统 API =====
          setTimeSpeed(speed) {
            postCommand(cellId, 'setTimeSpeed', { speed });
          },

          // 日志
          log(message) {
            postCommand(cellId, 'log', { message });
          },

          // 端口数据操作 - V4.0 新增
          sendOutput(name, value) {
            postCommand(cellId, 'sendOutput', { name, value });
          },
          getInputValue(name) {
            postCommand(cellId, 'getInputValue', { name });
            return undefined;
          }
        };

        return context;
      }

      // ===== Worker代码中的加载函数（含超时保护 + AST验证） =====
      function loadCode(cellId, code, kind, initialProperties, allCells) {
        
        // postCommand 必须在最开始定义，用于给主线程发消息
        const postCommand = (cid, cmd, args) => {
          self.postMessage({ type: 'command', cellId: cid, command: cmd, args });
        };
        
        // ============================================
        // 彻底清理旧上下文：防止重复加载导致多重回调
        // ============================================
        delete behaviorRegistry[cellId];   // 清除旧函数注册
        delete eventListeners[cellId];     // 清除旧事件监听（onUpdate等）
        delete cellContexts[cellId];       // 清除旧上下文对象
        delete cellPropertyCache[cellId];  // 清除旧属性缓存
        delete _queryResultCache[cellId];  // 清除旧查询缓存
        _frameCounter[cellId] = 1;         // 重置帧计数，使新代码的 api.getFrame() 从 1 开始（代码中的初始化判断生效）
        
        // 初始化属性缓存（清理 NaN/无效数值）
        if (initialProperties) {
          const clean = {};
          for (const [k, v] of Object.entries(initialProperties)) {
            if (typeof v === 'number' && (!isFinite(v) || Number.isNaN(v))) {
              // NaN 替换为默认值 0，同时请求主线程刷新
              clean[k] = 0;
              postCommand(cellId, 'getProperty', { key: k });
            } else {
              clean[k] = v;
            }
          }
          cellPropertyCache[cellId] = clean;
        }
        
        // 初始化查询结果缓存（用于同步queryCells）
        if (allCells) {
          _queryResultCache[cellId] = allCells;
        } else {
          _queryResultCache[cellId] = [];
        }
        
        // AST验证
        try {
          new Function(code);
        } catch (e) {
          self.postMessage({ type: 'error', cellId, message: '语法验证失败: ' + e.message });
          return;
        }
        
        try {
          // 清除旧的绘制函数（通过命令让主线程处理）
          postCommand(cellId, 'clearDraw', {});
          
          const ctx = createCellContext(cellId, postCommand);
          ctx.kind = kind;
          cellContexts[cellId] = ctx;
          
          // 使用Function构造器创建沙箱函数（100ms超时保护）
          const execStart = Date.now();
          const fn = new Function('api', code);
          fn(ctx);
          
          // 超时检测
          if (Date.now() - execStart > 100) {
            self.postMessage({ type: 'warning', cellId, message: '代码执行超过100ms，可能影响帧率' });
          }
          
          behaviorRegistry[cellId] = { fn, ctx, code, kind };
          self.postMessage({ type: 'loaded', cellId });
        } catch (e) {
          console.error('[Worker] Error loading code for', cellId, ':', e);
          self.postMessage({ type: 'error', cellId, message: '执行错误: ' + e.message });
        }
      }

      // 卸载行为代码（彻底清理所有与cellId相关的数据）
      function unloadCode(cellId) {
        delete behaviorRegistry[cellId];
        delete eventListeners[cellId];
        delete cellContexts[cellId];
        delete cellPropertyCache[cellId];
        delete _queryResultCache[cellId];
      }

      // 处理事件
      function handleEvent(cellId, eventName, data, allCells) {
        // 帧计数递增（用于 api.getFrame()）
        _globalFrame++;
        _frameCounter[cellId] = (_frameCounter[cellId] || 0) + 1;
        // 对于 onUpdate 事件，同步所有基圆的位置信息（让 queryCells 能看到新创建的基圆）
        if (eventName === 'onUpdate' && allCells) {
          _queryResultCache[cellId] = allCells;
        }
        
        const listeners = eventListeners[cellId]?.[eventName];
        if (listeners) {
          for (const cb of listeners) {
            try {
              cb(data);
            } catch (e) {
              self.postMessage({ type: 'error', cellId, message: e.message });
            }
          }
        }

        // continuous 模式：每帧重新执行完整行为代码（兼容 v3.0 模板写法）
        if (eventName === 'onUpdate') {
          const entry = behaviorRegistry[cellId];
          if (entry) {
            try {
              const fn = entry.fn;
              if (typeof fn === 'function') fn(entry.ctx);
            } catch (e) {
              self.postMessage({ type: 'error', cellId, message: e.message });
            }
          }
        }

        // 端口变更事件特殊处理
        if (eventName === 'portChange') {
          const ctx = cellContexts[cellId];
          if (ctx && typeof ctx.onPortChange === 'function') {
            try {
              ctx.onPortChange(data);
            } catch (e) {
              self.postMessage({ type: 'error', cellId, message: e.message });
            }
          }
        }
      }

      // 消息处理
      self.onmessage = function(e) {
        const msg = e.data;
        switch (msg.type) {
          case 'loadCode':
            loadCode(msg.cellId, msg.code, msg.kind, msg.initialProperties, msg.allCells);
            break;
          case 'unloadCode':
            unloadCode(msg.cellId);
            break;
          case 'event':
            // propertyResponse 通过 event 消息传递
            if (msg.eventName === 'propertyResponse') {
              if (!cellPropertyCache[msg.cellId]) cellPropertyCache[msg.cellId] = {};
              cellPropertyCache[msg.cellId][msg.data.key] = msg.data.value;
            } else {
              handleEvent(msg.cellId, msg.eventName, msg.data, msg.allCells);
            }
            break;
          case 'ping':
            self.postMessage({ type: 'pong' });
            break;
        }
      };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    _workerCode = URL.createObjectURL(blob);
  }

  // ===== 创建Worker =====
  function _createWorker(name) {
    const worker = new Worker(_workerCode);
    worker.onmessage = (e) => _handleWorkerMessage(name, e.data);
    worker.onerror = (e) => {
      console.error(`[Sandbox] Worker-${name} 错误:`, e.message);
    };
    return worker;
  }

  // ===== 处理Worker消息 =====
  function _handleWorkerMessage(workerName, data) {
    // 健康检查响应
    if (data.type === 'pong') {
      if (workerName === 'A') _workerAPending = false;
      else _workerBPending = false;
      return;
    }

    if (data.type === 'loaded') {
      console.log(`[Sandbox] 基圆 ${data.cellId} 代码加载成功`);
      _cellCore.clearCellError(data.cellId);
      // 立即处理代码执行期间发送的所有属性更新命令
      processCommands();
      // 然后通知属性面板刷新
      _cellCore.emit('cell:codeLoaded', { cellId: data.cellId });
      return;
    }

    if (data.type === 'error') {
      console.error(`[Sandbox] 基圆 ${data.cellId} 执行错误:`, data.message);
      _cellCore.setCellError(data.cellId, data.message);
      return;
    }

    if (data.type === 'command') {
      _commandQueue.push(data);
    }
  }

  // ===== 加载行为代码 =====
  function loadBehaviorCode(cellId, code, mode) {
    // 检查代码是否是字符串，防止非字符串代码导致的错误
    if (typeof code !== 'string') {
      console.warn(`[Sandbox] 基圆 ${cellId} 的代码不是字符串，跳过加载`);
      return;
    }
    
    // 跳过空代码
    if (!code.trim()) {
      unloadBehaviorCode(cellId);
      return;
    }
    
    const cell = _cellCore.getCell(cellId);
    const kind = cell?.kind || 'empty';
    const worker = (mode === 'continuous') ? _workerA : _workerB;
    
    // 检查是否已有注册的代码，如果模式变化需要先从旧Worker卸载
    const existingEntry = _codeRegistry.get(cellId);
    if (existingEntry) {
      const oldWorker = (existingEntry.mode === 'continuous') ? _workerA : _workerB;
      if (oldWorker !== worker) {
        // 模式变化，从旧Worker卸载
        oldWorker.postMessage({ type: 'unloadCode', cellId });
      } else {
        // 同一Worker，先卸载旧代码，彻底清理
        oldWorker.postMessage({ type: 'unloadCode', cellId });
      }
    }

    // 清理主线程中的自定义绘制函数（防止重影）
    _customDrawFunctions.delete(cellId);
    if (_renderBridge && typeof _renderBridge.unregisterCustomDraw === 'function') {
      _renderBridge.unregisterCustomDraw(cellId);
    }
    
    _codeRegistry.set(cellId, { code, mode, kind });

    // 收集初始属性（cell 自身属性 + attributes）
    const initialProperties = {};
    if (cell) {
      for (const [k, v] of Object.entries(cell)) {
        // 跳过非基本类型的属性，避免序列化问题
        if (['string', 'number', 'boolean'].includes(typeof v) || v === null || v === undefined) {
          initialProperties[k] = v;
        }
      }
      // 合并 attributes
      if (cell.attributes) {
        for (const [k, v] of Object.entries(cell.attributes)) {
          if (['string', 'number', 'boolean'].includes(typeof v) || v === null || v === undefined) {
            initialProperties[k] = v;
          }
        }
        // 重置代码初始化标记，使新代码有机会重新初始化
        delete cell.attributes.initialized;
        delete cell.attributes._drawRegistered;
      }
    }
    // 确保不把旧的初始化标记传给新代码
    delete initialProperties.initialized;
    delete initialProperties._drawRegistered;

    // 收集所有基圆数据（用于queryCells同步查询）
    const allCells = [];
    for (const cell of _cellCore.getAllCells()) {
      allCells.push({
        id: cell.id,
        kind: cell.kind,
        name: cell.name,
        x: typeof cell.x === 'number' ? cell.x : 0,
        y: typeof cell.y === 'number' ? cell.y : 0,
        radius: typeof cell.radius === 'number' ? cell.radius : 25,
        attributes: cell.attributes || {}
      });
    }

    worker.postMessage({
      type: 'loadCode',
      cellId,
      code,
      kind,
      initialProperties,
      allCells
    });
  }

  function unloadBehaviorCode(cellId) {
    const entry = _codeRegistry.get(cellId);
    if (!entry) return;

    const worker = (entry.mode === 'continuous') ? _workerA : _workerB;
    if (worker) worker.postMessage({ type: 'unloadCode', cellId });
    _codeRegistry.delete(cellId);

    _customDrawFunctions.delete(cellId);
    if (_renderBridge && typeof _renderBridge.unregisterCustomDraw === 'function') {
      _renderBridge.unregisterCustomDraw(cellId);
    }
  }

  // ===== 发送事件到Worker =====
  function sendEvent(cellId, eventName, data) {
    const entry = _codeRegistry.get(cellId);
    if (!entry) return;

    const worker = (entry.mode === 'continuous') ? _workerA : _workerB;
    
    // 对于 onUpdate 事件，先处理所有待处理的命令，确保属性已更新
    if (eventName === 'onUpdate') {
      processCommands();
    }
    
    // 对于 onUpdate 事件，同步所有基圆的位置信息到 Worker（让 queryCells 能看到新创建的基圆）
    let allCells = null;
    if (eventName === 'onUpdate') {
      allCells = [];
      for (const cell of _cellCore.getAllCells()) {
        allCells.push({
          id: cell.id,
          kind: cell.kind,
          name: cell.name,
          x: typeof cell.x === 'number' ? cell.x : 0,
          y: typeof cell.y === 'number' ? cell.y : 0,
          radius: typeof cell.radius === 'number' ? cell.radius : 25,
          attributes: cell.attributes || {}
        });
      }
    }
    
    worker.postMessage({
      type: 'event',
      cellId,
      eventName,
      data,
      allCells
    });
  }

  // ===== 处理Worker返回的命令 =====
  function processCommands() {
    while (_commandQueue.length > 0) {
      const cmd = _commandQueue.shift();
      _executeCommand(cmd);
    }
  }

  function _executeCommand(cmd) {
    const { cellId, command, args } = cmd;

    try {
      switch (command) {
        case 'setProperty': {
          // 防御性检查：不允许 NaN/无穷大，处理字符串数字
          let value = args.value;
          if (typeof value === 'string' && value !== '' && !isNaN(Number(value))) {
            value = Number(value);
          }
          if (typeof value === 'number' && (!isFinite(value) || Number.isNaN(value))) {
            console.warn('[Sandbox] setProperty 收到无效数值，已拒绝:', cellId, args.key, args.value);
            return;
          }
          if (args.key === 'attributes') {
            const subKey = Object.keys(args.value)[0];
            let subValue = Object.values(args.value)[0];
            if (typeof subValue === 'string' && subValue !== '' && !isNaN(Number(subValue))) {
              subValue = Number(subValue);
            }
            _cellCore.setAttribute(cellId, subKey, subValue);
          } else {
            // 尝试更新 cell 属性，如果属性不存在，则写入 attributes
            const cell = _cellCore.getCell(cellId);
            if (cell && args.key in cell) {
              _cellCore.updateCell(cellId, { [args.key]: value });
            } else {
              _cellCore.setAttribute(cellId, args.key, value);
            }
          }
          break;
        }

        case 'setKind': {
          const validKinds = ['empty', 'creature', 'plant', 'insect', 'static', 'ui', 'effect', 'engine', 'trigger'];
          if (validKinds.includes(args.kind)) {
            _cellCore.updateCell(cellId, { kind: args.kind });
          }
          break;
        }

        case 'getProperty':
          const cell = _cellCore.getCell(cellId);
          if (cell) {
            let value;
            if (args.key in cell) {
              value = cell[args.key];
            } else if (args.key in cell.attributes) {
              value = cell.attributes[args.key];
            }
            sendEvent(cellId, 'propertyResponse', { key: args.key, value });
          }
          break;

        case 'emit':
          _cellCore.emit(args.eventName, { sourceCellId: cellId, ...args.data });
          break;

        case 'emitCellEvent':
          // 定向事件：发送给指定基圆（如 attack 事件）
          _cellCore.emitCellEvent(args.targetId, args.eventName, { sourceCellId: cellId, ...args.data });
          break;

        case 'animate':
          _handleAnimation(cellId, args);
          break;

        case 'clearDraw':
          _customDrawFunctions.delete(cellId);
          if (_renderBridge && typeof _renderBridge.unregisterCustomDraw === 'function') {
            _renderBridge.unregisterCustomDraw(cellId);
          }
          break;

        case 'registerDraw':
          try {
            _customDrawFunctions.delete(cellId);
            if (_renderBridge && typeof _renderBridge.unregisterCustomDraw === 'function') {
              _renderBridge.unregisterCustomDraw(cellId);
            }
            const fnStr = args.drawFn;
            const match = fnStr.match(/^function\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/);
            if (match) {
              const params = match[1].split(',').map(p => p.trim()).filter(p => p);
              const body = 'const api = this;\n' + match[2];
              const drawFn = new Function(...params, body);
              _customDrawFunctions.set(cellId, drawFn);
              if (_renderBridge && typeof _renderBridge.registerCustomDraw === 'function') {
                _renderBridge.registerCustomDraw(cellId, (ctx, radius) => {
                  const drawFn = _customDrawFunctions.get(cellId);
                  if (drawFn) {
                    const cell = _cellCore.getCell(cellId);
                    const drawApi = {
                      getProperty: (key) => {
                        if (cell && key in cell) return cell[key];
                        if (cell && cell.attributes && key in cell.attributes) return cell.attributes[key];
                        return undefined;
                      },
                      cell: cell
                    };
                    try {
                      drawFn.call(drawApi, ctx, radius);
                    } catch (e) {
                      console.error('[Sandbox] drawFn error:', e);
                    }
                  }
                });
              }
            } else {
              console.warn('[Sandbox] registerDraw: 函数格式无法解析，已跳过');
            }
          } catch (e) {
            console.error('[Sandbox] registerDraw error:', e);
          }
          break;

        case 'sendMessage':
          _cellCore.emitCellEvent(args.targetId, 'onMessage', {
            fromId: cellId,
            data: args.data
          });
          break;

        case 'queryCells':
          const results = _cellCore.queryCells(args.filter || {});
          sendEvent(cellId, 'queryResult', { cells: results.map(c => ({ id: c.id, kind: c.kind, name: c.name })) });
          break;

        case 'queryNearby':
          const nearby = _cellCore.queryCells({
            near: {
              x: _cellCore.getCell(cellId)?.x || 0,
              y: _cellCore.getCell(cellId)?.y || 0,
              radius: args.radius || 100
            }
          });
          sendEvent(cellId, 'queryResult', { cells: nearby.map(c => ({ id: c.id, kind: c.kind, name: c.name })) });
          break;

        case 'createCell':
          // 创建新基圆，支持选项：kind, x, y, parentId, code, mode, name, color, radius, attributes
          const newCell = _cellCore.createCell(
            args.kind || 'empty',
            args.x || 0,
            args.y || 0,
            args.parentId || null
          );
          if (newCell) {
            // 应用可选属性：name/color/radius
            const cellUpdates = {};
            if (args.name !== undefined) cellUpdates.name = args.name;
            if (args.color !== undefined) cellUpdates.color = args.color;
            if (typeof args.radius === 'number') cellUpdates.radius = args.radius;
            if (Object.keys(cellUpdates).length > 0) {
              _cellCore.updateCell(newCell.id, cellUpdates);
            }
            // 应用自定义 attributes
            if (args.attributes && typeof args.attributes === 'object') {
              for (const [ak, av] of Object.entries(args.attributes)) {
                _cellCore.setAttribute(newCell.id, ak, av);
              }
            }
            // 如果有代码，加载代码
            if (args.code) {
              const mode = args.mode || 'event';
              loadBehaviorCode(newCell.id, args.code, mode);
              _cellCore.updateCell(newCell.id, { code: args.code });
            }
          }
          // 发送创建成功事件
          sendEvent(cellId, 'cellCreated', { cellId: newCell?.id });
          break;

        case 'destroyCell':
          // 删除指定基圆
          console.log('[Sandbox] destroyCell called for:', args.targetId, 'from worker cellId:', cellId);
          _cellCore.destroyCell(args.targetId);
          // 卸载代码
          unloadBehaviorCode(args.targetId);
          break;

        case 'updateCellAttribute': {
          // 更新其他基圆的属性
          if (!args.targetId) return;
          const targetCell = _cellCore.getCell(args.targetId);
          if (!targetCell) return;
          // 处理字符串形式的数字（从属性面板输入的数字可能是字符串）
          let value = args.value;
          if (typeof value === 'string' && value !== '' && !isNaN(Number(value))) {
            value = Number(value);
          }
          if (typeof value === 'number' && (!isFinite(value) || Number.isNaN(value))) {
            console.warn('[Sandbox] updateCellAttribute 收到无效数值，已拒绝:', args.targetId, args.key, args.value);
            return;
          }
          _cellCore.setAttribute(args.targetId, args.key, value);
          break;
        }

        case 'log':
          console.log(`[Cell:${cellId}]`, args.message);
          break;

        // ===== 开发者控制台命令 =====
        case 'openDevConsole': {
          // Worker 请求主线程打开开发者对话框
          if (typeof window !== 'undefined' && window.DevConsole && typeof window.DevConsole.open === 'function') {
            window.DevConsole.open(cellId);
          } else {
            console.log('[Sandbox] DevConsole 未初始化');
          }
          break;
        }

        // ===== 游戏时间系统命令 =====
        case 'setTimeSpeed': {
          if (typeof window !== 'undefined' && window.DevConsole && typeof window.DevConsole.setTimeSpeed === 'function') {
            window.DevConsole.setTimeSpeed(args.speed);
          } else if (typeof window !== 'undefined' && window.GameLoop && typeof window.GameLoop.setTimeScale === 'function') {
            window.GameLoop.setTimeScale(args.speed);
          }
          break;
        }

        // V4.0 端口系统命令
        case 'defineInput':
          _cellCore.defineInputPort(cellId, args.name, args.type);
          break;

        case 'defineOutput':
          _cellCore.defineOutputPort(cellId, args.name, args.type);
          break;

        case 'connectPorts':
          _cellCore.connectPorts(cellId, args.outputName, args.targetId, args.inputName);
          break;

        case 'connectPortsExplicit':
          _cellCore.connectPorts(args.fromCellId, args.fromPortName, args.toCellId, args.toPortName);
          break;

        case 'disconnectPorts':
          const wires = _cellCore.getCellWires(cellId);
          for (const wire of wires) {
            if (wire.toCellId === args.targetId || wire.fromCellId === args.targetId) {
              _cellCore.disconnectPort(wire.id);
            }
          }
          break;

        case 'disconnectPort':
          _cellCore.disconnectPort(args.wireId);
          break;

        case 'sendOutput':
          _cellCore.sendPortData(cellId, args.name, args.value);
          break;

        case 'sendPortData':
          _cellCore.sendPortData(cellId, args.portName, args.value);
          break;

        case 'getInputValue':
          const inputValue = _cellCore.getPortValue(cellId, 'inputs', args.name);
          sendEvent(cellId, 'inputValueResponse', { name: args.name, value: inputValue });
          break;

        case 'getPortValue':
          const portValue = _cellCore.getPortValue(cellId, args.direction, args.portName);
          sendEvent(cellId, 'portValueResponse', { direction: args.direction, name: args.portName, value: portValue });
          break;

        case 'setTriggerMode': {
          _cellCore.setTriggerMode(cellId, args.mode, args.config);
          // 同步更新 _codeRegistry 的 mode，并移动代码到正确的 Worker
          const entry = _codeRegistry.get(cellId);
          if (entry && entry.mode !== args.mode) {
            const oldWorker = (entry.mode === 'continuous') ? _workerA : _workerB;
            const newWorker = (args.mode === 'continuous') ? _workerA : _workerB;
            if (oldWorker !== newWorker) {
              entry.mode = args.mode;
              oldWorker.postMessage({ type: 'unloadCode', cellId });
              _customDrawFunctions.delete(cellId);
              if (_renderBridge && typeof _renderBridge.unregisterCustomDraw === 'function') {
                _renderBridge.unregisterCustomDraw(cellId);
              }
              const cell = _cellCore.getCell(cellId);
              const initialProperties = {};
              if (cell) {
                for (const [k, v] of Object.entries(cell)) {
                  if (['string', 'number', 'boolean'].includes(typeof v) || v === null || v === undefined) {
                    initialProperties[k] = v;
                  }
                }
                if (cell.attributes) {
                  for (const [k, v] of Object.entries(cell.attributes)) {
                    if (['string', 'number', 'boolean'].includes(typeof v) || v === null || v === undefined) {
                      initialProperties[k] = v;
                    }
                  }
                }
              }
              const allCells = [];
              for (const c of _cellCore.getAllCells()) {
                allCells.push({
                  id: c.id,
                  kind: c.kind,
                  name: c.name,
                  x: typeof c.x === 'number' ? c.x : 0,
                  y: typeof c.y === 'number' ? c.y : 0,
                  radius: typeof c.radius === 'number' ? c.radius : 25,
                  attributes: c.attributes || {}
                });
              }
              newWorker.postMessage({
                type: 'loadCode',
                cellId,
                code: entry.code,
                kind: entry.kind,
                initialProperties,
                allCells
              });
            } else {
              entry.mode = args.mode;
            }
          }
          break;
        }

        case 'lifecycle':
          // 生命周期命令处理
          sendEvent(cellId, `on${args.phase.charAt(0).toUpperCase() + args.phase.slice(1)}`, args);
          break;

        default:
          console.warn(`[Sandbox] 未知命令: ${command}`);
      }
    } catch (e) {
      console.error(`[Sandbox] 命令执行错误:`, e);
    }
  }

  // ===== 动画处理 =====
  let _activeAnimations = new Map();

  function _handleAnimation(cellId, args) {
    const { prop, target, duration, easing } = args;
    const cell = _cellCore.getCell(cellId);
    if (!cell) return;
    if (typeof target === 'number' && (!isFinite(target) || Number.isNaN(target))) {
      console.warn('[Sandbox] _handleAnimation 收到无效目标值，已拒绝:', cellId, prop, target);
      return;
    }
    let startValue = cell[prop] !== undefined ? cell[prop] : (cell.attributes && cell.attributes[prop]);
    if (startValue === undefined || startValue === null ||
        (typeof startValue === 'number' && (!isFinite(startValue) || Number.isNaN(startValue)))) {
      startValue = 0;
    }
    const startTime = performance.now();

    _activeAnimations.set(cellId + '_' + prop, {
      cellId,
      prop,
      startValue,
      target,
      duration: duration || 300,
      easing: easing || 'linear',
      startTime
    });
  }

  function updateAnimations() {
    const now = performance.now();
    for (const [key, anim] of _activeAnimations) {
      const elapsed = now - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);
      const easedProgress = _ease(progress, anim.easing);
      const currentValue = anim.startValue + (anim.target - anim.startValue) * easedProgress;

      _cellCore.updateCell(anim.cellId, { [anim.prop]: currentValue });

      if (progress >= 1) {
        _activeAnimations.delete(key);
      }
    }
  }

  function _ease(t, type) {
    switch (type) {
      case 'linear': return t;
      case 'easeIn': return t * t;
      case 'easeOut': return t * (2 - t);
      case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default: return t;
    }
  }

  // ===== 健康检查 =====
  function _startHealthCheck() {
    _healthCheckTimer = setInterval(() => {
      if (_workerA) {
        _workerAPending = true;
        _workerA.postMessage({ type: 'ping' });
        setTimeout(() => {
          if (_workerAPending) {
            console.warn('[Sandbox] Worker-A 无响应，重启');
            _restartWorker('A');
          }
        }, HEALTH_CHECK_TIMEOUT);
      }
      if (_workerB) {
        _workerBPending = true;
        _workerB.postMessage({ type: 'ping' });
        setTimeout(() => {
          if (_workerBPending) {
            console.warn('[Sandbox] Worker-B 无响应，重启');
            _restartWorker('B');
          }
        }, HEALTH_CHECK_TIMEOUT);
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  function _restartWorker(name) {
    const oldWorker = (name === 'A') ? _workerA : _workerB;
    if (oldWorker) {
      oldWorker.terminate();
    }

    const newWorker = _createWorker(name);
    if (name === 'A') _workerA = newWorker;
    else _workerB = newWorker;

    // 收集所有基圆数据
    const allCells = [];
    for (const cell of _cellCore.getAllCells()) {
      allCells.push({
        id: cell.id,
        kind: cell.kind,
        name: cell.name,
        x: typeof cell.x === 'number' ? cell.x : 0,
        y: typeof cell.y === 'number' ? cell.y : 0,
        radius: typeof cell.radius === 'number' ? cell.radius : 25,
        attributes: cell.attributes || {}
      });
    }

    // 重新加载所有行为代码
    for (const [cellId, entry] of _codeRegistry) {
      const worker = (entry.mode === 'continuous') ? _workerA : _workerB;
      worker.postMessage({ type: 'loadCode', cellId, code: entry.code, kind: entry.kind, allCells });
    }

    console.log(`[Sandbox] Worker-${name} 已重启并重新加载代码`);
  }

  // ===== 重启Workers（用于热更新沙箱代码） =====
  function restartWorkers() {
    console.log('[Sandbox] 重启Workers，版本:', WORKER_VERSION);
    // 终止旧Worker
    if (_workerA) { _workerA.terminate(); _workerA = null; }
    if (_workerB) { _workerB.terminate(); _workerB = null; }
    // 重新创建Worker代码
    _createWorkerCode();
    // 创建新Worker
    _workerA = _createWorker('A');
    _workerB = _createWorker('B');
    // 重新加载所有行为代码
    reloadAllCode();
    console.log('[Sandbox] Workers重启完成');
  }

  // ===== 重新加载所有代码 =====
  function reloadAllCode() {
    // 收集所有基圆数据
    const allCells = [];
    for (const cell of _cellCore.getAllCells()) {
      allCells.push({
        id: cell.id,
        kind: cell.kind,
        name: cell.name,
        x: typeof cell.x === 'number' ? cell.x : 0,
        y: typeof cell.y === 'number' ? cell.y : 0,
        radius: typeof cell.radius === 'number' ? cell.radius : 25,
        attributes: cell.attributes || {}
      });
    }

    // 重新加载所有行为代码
    for (const [cellId, entry] of _codeRegistry) {
      const worker = (entry.mode === 'continuous') ? _workerA : _workerB;
      worker.postMessage({ type: 'loadCode', cellId, code: entry.code, kind: entry.kind, allCells });
    }
  }

  // ===== 设置WireRegistry =====
  function setWireRegistry(wireRegistry) {
    _wireRegistry = wireRegistry;
  }

  // ===== 销毁 =====
  function destroy() {
    if (_healthCheckTimer) clearInterval(_healthCheckTimer);
    if (_workerA) _workerA.terminate();
    if (_workerB) _workerB.terminate();
    if (_workerCode) URL.revokeObjectURL(_workerCode);
    _codeRegistry.clear();
    _commandQueue = [];
    _activeAnimations.clear();
  }

  return {
    init,
    loadBehaviorCode, unloadBehaviorCode,
    sendEvent, processCommands,
    updateAnimations, reloadAllCode, restartWorkers,
    setWireRegistry,
    destroy
  };
})();

// 挂载到 window 以便其他模块通过 window.Sandbox 访问
if (typeof window !== 'undefined') {
  window.Sandbox = Sandbox;
}
