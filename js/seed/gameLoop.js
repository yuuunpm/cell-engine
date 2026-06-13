/**
 * 事件循环 (gameLoop.js)
 * 引擎的心跳，使用 requestAnimationFrame 驱动
 * 依赖：持久化层
 */

const GameLoop = (() => {
  let _running = false;
  let _rafId = null;
  let _lastTime = 0;
  let _dt = 0;
  let _fps = 0;
  let _frameCount = 0;
  let _fpsTimer = 0;
  let _persistLayer = null;
  let _cellCore = null;
  let _sandbox = null;
  let _renderBridge = null;
  let _inputBridge = null;

  // 帧率自适应
  const TARGET_FPS = 60;
  const LOW_FPS_THRESHOLD = 30;
  let _adaptiveMode = false;
  let _skipFrameCounter = 0;

  // 时间缩放（默认1.0，正常速度）
  let _timeScale = 1.0;

  // 更新回调列表
  let _updateCallbacks = [];
  let _postUpdateCallbacks = [];

  function init(persistLayer) {
    _persistLayer = persistLayer;
    console.log('[GameLoop] 初始化完成');
  }

  function setDependencies(cellCore, sandbox, renderBridge, inputBridge) {
    _cellCore = cellCore;
    _sandbox = sandbox;
    _renderBridge = renderBridge;
    _inputBridge = inputBridge;
  }

  function onUpdate(callback) {
    _updateCallbacks.push(callback);
  }

  function onPostUpdate(callback) {
    _postUpdateCallbacks.push(callback);
  }

  function _tick(timestamp) {
    if (!_running) return;

    // 计算 dt，限制最大值100ms防止跳帧，并应用时间缩放
    if (_lastTime === 0) _lastTime = timestamp;
    _dt = Math.min(timestamp - _lastTime, 100) * _timeScale;
    _lastTime = timestamp;

    // 帧率计算
    _frameCount++;
    _fpsTimer += _dt;
    if (_fpsTimer >= 1000) {
      _fps = Math.round(_frameCount * 1000 / _fpsTimer);
      _frameCount = 0;
      _fpsTimer = 0;

      // 帧率自适应
      if (_fps < LOW_FPS_THRESHOLD && !_adaptiveMode) {
        _adaptiveMode = true;
        console.log('[GameLoop] 帧率过低，启用自适应模式');
      } else if (_fps >= LOW_FPS_THRESHOLD + 10 && _adaptiveMode) {
        _adaptiveMode = false;
        _skipFrameCounter = 0;
        console.log('[GameLoop] 帧率恢复，关闭自适应模式');
      }
    }

    // 自适应模式下跳过部分非关键更新
    _skipFrameCounter++;
    const shouldSkipNonCritical = _adaptiveMode && (_skipFrameCounter % 2 === 0);

    // 处理输入事件队列
    if (_inputBridge) {
      _inputBridge.processQueue();
    }

    // 更新脉冲累积器（含衰减）
    if (_cellCore) {
      _cellCore.updateAccumulators(_dt);
    }

    // 向Worker发送待更新基圆的事件
    if (_sandbox && _cellCore) {
      const continuousCells = _cellCore.getContinuousCells();
      const pulseCells = _cellCore.getPulseReadyCells();

      if (!shouldSkipNonCritical) {
        // 连续模式基圆
        for (const cell of continuousCells) {
          _sandbox.sendEvent(cell.id, 'onUpdate', { dt: _dt });
        }
      }

      // 脉冲模式基圆（始终处理）
      for (const cell of pulseCells) {
        _sandbox.sendEvent(cell.id, 'onUpdate', { dt: cell.triggerConfig.threshold * 16.67 });
        _cellCore.resetAccumulator(cell.id);
      }
    }

    // 处理Worker返回的命令
    if (_sandbox) {
      _sandbox.processCommands();
    }

    // 执行更新回调
    for (const cb of _updateCallbacks) {
      try { cb(_dt); } catch (e) { console.error('[GameLoop] 更新回调错误:', e); }
    }

    // 触发渲染
    if (_renderBridge) {
      _renderBridge.render();
    }

    // 执行后更新回调
    for (const cb of _postUpdateCallbacks) {
      try { cb(_dt); } catch (e) { console.error('[GameLoop] 后更新回调错误:', e); }
    }

    _rafId = requestAnimationFrame(_tick);
  }

  function start() {
    if (_running) return;
    _running = true;
    _lastTime = 0;
    _rafId = requestAnimationFrame(_tick);
    console.log('[GameLoop] 启动');
  }

  function stop() {
    _running = false;
    if (_rafId) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
    console.log('[GameLoop] 停止');
  }

  function getFPS() {
    return _fps;
  }

  function getDt() {
    return _dt;
  }

  function getTimeScale() {
    return _timeScale;
  }

  function setTimeScale(scale) {
    _timeScale = Math.max(0, Math.min(10, scale));
    console.log('[GameLoop] 时间缩放: x' + _timeScale.toFixed(1));
  }

  function isRunning() {
    return _running;
  }

  function isAdaptiveMode() {
    return _adaptiveMode;
  }

  return {
    init, setDependencies, start, stop,
    onUpdate, onPostUpdate,
    getFPS, getDt, isRunning, isAdaptiveMode,
    getTimeScale, setTimeScale
  };
})();

// 挂载到 window 以便其他模块通过 window.GameLoop 访问
if (typeof window !== 'undefined') {
  window.GameLoop = GameLoop;
}
