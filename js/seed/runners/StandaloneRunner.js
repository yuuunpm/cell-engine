/**
 * StandaloneRunner.js - 独立运行器
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.StandaloneRunner
 */

(function (global) {
  'use strict';

  const Types = global.Types || global.CellEngineTypes;
  const StandaloneCellContext = global.StandaloneCellContext;

  class StandaloneRunner {
    constructor(cellCore, sandbox) {
      this._cellCore = cellCore;
      this._sandbox = sandbox;
      this._runningSessions = new Map(); // sessionId -> { cellId, context, running, interval }
      this._breakpoints = new Map(); // sessionId -> [breakpoints]
      this._listeners = new Map(); // sessionId -> event listeners
    }

    /**
     * 创建独立测试会话
     * @param {string} cellId - 要测试的基圆ID
     * @param {Object} options - 测试选项
     * @returns {string} sessionId
     */
    createSession(cellId, options = {}) {
      const cell = this._cellCore.getCell(cellId);
      if (!cell) {
        console.error('[StandaloneRunner] 基圆不存在:', cellId);
        return null;
      }

      // 创建CellContext
      const ctx = new StandaloneCellContext({
        ...cell,
        id: cell.id,
        kind: cell.kind,
        x: options.startX !== undefined ? options.startX : cell.x || 0,
        y: options.startY !== undefined ? options.startY : cell.y || 0,
        radius: options.radius || cell.radius || 25,
        triggerMode: options.triggerMode || cell.triggerConfig?.mode || 'event',
        attributes: { ...(cell.attributes || {}), ...(options.initialAttributes || {}) }
      });

      // 添加模拟的附近基圆
      if (options.nearbyCells) {
        for (const nearby of options.nearbyCells) {
          ctx.addNearbyCell(nearby);
        }
      }

      const sessionId = `session_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;

      const session = {
        id: sessionId,
        cellId,
        cell: { ...cell },
        context: ctx,
        running: false,
        frameCount: 0,
        lastFrameTime: 0,
        fps: 0,
        breakpoints: [],
        paused: false,
        logs: [],
        properties: [],
        error: null,
        options
      };

      this._runningSessions.set(sessionId, session);

      console.log(`[StandaloneRunner] 创建会话 ${sessionId} 用于基圆 ${cellId}`);

      return sessionId;
    }

    /**
     * 加载并执行基圆代码
     */
    async loadCode(sessionId, code) {
      const session = this._runningSessions.get(sessionId);
      if (!session) {
        console.error('[StandaloneRunner] 会话不存在:', sessionId);
        return false;
      }

      // 清理旧代码执行环境
      session.logs = [];
      session.properties = [];
      session.error = null;
      session.frameCount = 0;

      // 在沙箱中执行代码
      try {
        // 创建沙箱环境函数
        const sandboxFn = new Function('ctx', code || '');

        // 在CellContext中执行
        sandboxFn(session.context);

        // 调用init生命周期
        if (typeof session.context.init === 'function') {
          session.context.init();
        }

        // 记录初始化状态
        this._captureSessionState(session, 'init');

        return true;
      } catch (e) {
        session.error = e.message;
        session.logs.push({
          type: 'error',
          message: e.message,
          stack: e.stack,
          time: Date.now()
        });
        console.error('[StandaloneRunner] 代码执行错误:', e);
        return false;
      }
    }

    /**
     * 启动模拟循环
     */
    start(sessionId, options = {}) {
      const session = this._runningSessions.get(sessionId);
      if (!session) {
        console.error('[StandaloneRunner] 会话不存在:', sessionId);
        return false;
      }

      if (session.running) {
        console.warn('[StandaloneRunner] 会话已在运行中');
        return false;
      }

      session.running = true;
      session.paused = false;
      session.lastFrameTime = performance.now();
      const targetFps = options.fps || 30;
      const frameInterval = 1000 / targetFps;

      session.interval = setInterval(() => {
        if (session.paused) return;

        // 检查断点
        if (this._checkBreakpoints(session)) {
          session.paused = true;
          this._notifyListeners(session, 'breakpoint', {
            frameCount: session.frameCount,
            breakpoints: session.breakpoints.filter(bp => bp.hit).map(bp => bp.name)
          });
          return;
        }

        // 执行帧更新
        try {
          session.context.simulateUpdate(frameInterval);
          session.frameCount++;
          session.fps = 1000 / (performance.now() - session.lastFrameTime);
          session.lastFrameTime = performance.now();

          // 调用update生命周期（如果有）
          if (typeof session.context.update === 'function') {
            session.context.update(frameInterval);
          }

          // 记录状态
          if (session.frameCount % 10 === 0) {
            this._captureSessionState(session, 'update');
          }

          // 检查是否达到最大帧数
          if (options.maxFrames && session.frameCount >= options.maxFrames) {
            this.stop(sessionId);
            this._notifyListeners(session, 'complete', {
              frameCount: session.frameCount,
              reason: 'max_frames'
            });
          }
        } catch (e) {
          session.error = e.message;
          session.logs.push({
            type: 'error',
            message: e.message,
            stack: e.stack,
            time: Date.now(),
            frame: session.frameCount
          });
          console.error('[StandaloneRunner] 模拟错误:', e);
          this.stop(sessionId);
          this._notifyListeners(session, 'error', { error: e.message });
        }
      }, frameInterval);

      this._notifyListeners(session, 'start', { frameInterval });
      return true;
    }

    /**
     * 暂停模拟
     */
    pause(sessionId) {
      const session = this._runningSessions.get(sessionId);
      if (!session) return false;
      session.paused = true;
      this._notifyListeners(session, 'pause', {});
      return true;
    }

    /**
     * 恢复模拟
     */
    resume(sessionId) {
      const session = this._runningSessions.get(sessionId);
      if (!session) return false;
      session.paused = false;
      this._notifyListeners(session, 'resume', {});
      return true;
    }

    /**
     * 执行单步
     */
    step(sessionId, frames = 1) {
      const session = this._runningSessions.get(sessionId);
      if (!session) return false;

      const wasRunning = session.running;
      const wasPaused = session.paused;

      // 执行指定帧数
      for (let i = 0; i < frames; i++) {
        try {
          session.context.simulateUpdate(16.67);
          session.frameCount++;
          if (typeof session.context.update === 'function') {
            session.context.update(16.67);
          }
        } catch (e) {
          session.error = e.message;
          session.logs.push({
            type: 'error',
            message: e.message,
            stack: e.stack,
            time: Date.now(),
            frame: session.frameCount
          });
        }
      }

      this._captureSessionState(session, 'step');
      return true;
    }

    /**
     * 停止模拟
     */
    stop(sessionId) {
      const session = this._runningSessions.get(sessionId);
      if (!session) return false;

      session.running = false;
      if (session.interval) {
        clearInterval(session.interval);
        session.interval = null;
      }

      this._notifyListeners(session, 'stop', {
        frameCount: session.frameCount,
        error: session.error
      });

      return true;
    }

    /**
     * 销毁会话
     */
    destroySession(sessionId) {
      const session = this._runningSessions.get(sessionId);
      if (!session) return false;

      this.stop(sessionId);

      // 销毁上下文
      if (session.context && typeof session.context.destroy === 'function') {
        session.context.destroy();
      }

      this._runningSessions.delete(sessionId);
      this._listeners.delete(sessionId);

      console.log(`[StandaloneRunner] 销毁会话 ${sessionId}`);
      return true;
    }

    /**
     * 添加断点
     * 断点条件：当属性值满足条件时暂停
     */
    addBreakpoint(sessionId, breakpoint) {
      const session = this._runningSessions.get(sessionId);
      if (!session) return false;

      const bp = {
        id: `bp_${Date.now().toString(36)}`,
        name: breakpoint.name || 'breakpoint',
        type: breakpoint.type || 'property', // property | frame | event
        property: breakpoint.property,
        condition: breakpoint.condition, // (value) => bool
        targetFrame: breakpoint.targetFrame,
        eventName: breakpoint.eventName,
        hit: false
      };

      session.breakpoints.push(bp);
      return bp.id;
    }

    /**
     * 移除断点
     */
    removeBreakpoint(sessionId, breakpointId) {
      const session = this._runningSessions.get(sessionId);
      if (!session) return false;
      session.breakpoints = session.breakpoints.filter(bp => bp.id !== breakpointId);
      return true;
    }

    /**
     * 清除所有断点
     */
    clearBreakpoints(sessionId) {
      const session = this._runningSessions.get(sessionId);
      if (!session) return false;
      session.breakpoints = [];
      return true;
    }

    /**
     * 检查断点
     */
    _checkBreakpoints(session) {
      const cell = session.context.getCell ? session.context.getCell() : null;

      for (const bp of session.breakpoints) {
        if (bp.type === 'property' && bp.property && cell) {
          const value = cell[bp.property] ||
                        (cell.attributes ? cell.attributes[bp.property] : undefined);

          if (value !== undefined) {
            if (typeof bp.condition === 'function') {
              try {
                if (bp.condition(value)) {
                  bp.hit = true;
                  return true;
                }
              } catch (e) {
                console.warn('[StandaloneRunner] 断点条件错误:', e);
              }
            } else if (bp.condition === value) {
              bp.hit = true;
              return true;
            }
          }
        }

        if (bp.type === 'frame' && bp.targetFrame && session.frameCount >= bp.targetFrame) {
          bp.hit = true;
          return true;
        }
      }

      return false;
    }

    /**
     * 添加事件监听器
     */
    on(sessionId, event, callback) {
      if (!this._listeners.has(sessionId)) {
        this._listeners.set(sessionId, {});
      }
      const listeners = this._listeners.get(sessionId);
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    }

    /**
     * 移除事件监听器
     */
    off(sessionId, event, callback) {
      const listeners = this._listeners.get(sessionId);
      if (listeners && listeners[event]) {
        const idx = listeners[event].indexOf(callback);
        if (idx !== -1) listeners[event].splice(idx, 1);
      }
    }

    /**
     * 通知监听器
     */
    _notifyListeners(session, event, data) {
      const listeners = this._listeners.get(session.id);
      if (listeners && listeners[event]) {
        for (const cb of listeners[event]) {
          try { cb({ sessionId: session.id, ...data }); } catch (e) { console.error(e); }
        }
      }
    }

    /**
     * 捕获会话状态
     */
    _captureSessionState(session, phase) {
      const cell = session.context.getCell ? session.context.getCell() : null;
      if (cell) {
        session.properties.push({
          frame: session.frameCount,
          phase,
          time: Date.now(),
          x: cell.x,
          y: cell.y,
          radius: cell.radius,
          attributes: { ...cell.attributes },
          triggerAccumulator: cell.triggerConfig?.accumulator || 0
        });
      }
    }

    /**
     * 获取会话状态
     */
    getSessionState(sessionId) {
      const session = this._runningSessions.get(sessionId);
      if (!session) return null;

      const cell = session.context.getCell ? session.context.getCell() : null;

      return {
        id: sessionId,
        cellId: session.cellId,
        running: session.running,
        paused: session.paused,
        frameCount: session.frameCount,
        fps: session.fps,
        error: session.error,
        cell: cell,
        logs: session.logs.slice(-50), // 最近50条日志
        properties: session.properties.slice(-20), // 最近20个状态快照
        breakpoints: session.breakpoints.map(bp => ({
          id: bp.id,
          name: bp.name,
          type: bp.type,
          hit: bp.hit
        }))
      };
    }

    /**
     * 获取所有会话
     */
    getSessions() {
      return Array.from(this._runningSessions.keys()).map(sessionId => {
        const session = this._runningSessions.get(sessionId);
        return {
          id: sessionId,
          cellId: session.cellId,
          running: session.running,
          paused: session.paused,
          frameCount: session.frameCount
        };
      });
    }

    /**
     * 获取测试报告
     */
    getTestReport(sessionId) {
      const state = this.getSessionState(sessionId);
      if (!state) return null;

      return {
        sessionId: state.id,
        cellId: state.cellId,
        summary: {
          totalFrames: state.frameCount,
          averageFps: state.fps,
          errorCount: state.logs.filter(l => l.type === 'error').length,
          hasError: !!state.error
        },
        logs: state.logs,
        propertyHistory: state.properties,
        breakpoints: state.breakpoints,
        finalState: state.cell
      };
    }

    /**
     * 销毁所有会话
     */
    destroy() {
      for (const sessionId of this._runningSessions.keys()) {
        this.destroySession(sessionId);
      }
    }
  }

  // 暴露到全局
  global.StandaloneRunner = StandaloneRunner;

})(typeof window !== 'undefined' ? window : this);
