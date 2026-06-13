/**
 * StandaloneCellContext.js - 独立运行的基圆上下文
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.StandaloneCellContext
 */

(function (global) {
  'use strict';

  const CellContext = global.CellContext;
  const Types = global.Types || global.CellEngineTypes;
  const InputPort = global.InputPort;
  const OutputPort = global.OutputPort;

  class StandaloneCellContext extends CellContext {
    constructor(cellData = {}) {
      super(cellData.id || `standalone_${Date.now()}`, cellData.kind || 'empty');

      // 模拟基圆数据
      this._cellData = {
        id: this.cellId,
        name: cellData.name || 'Standalone Cell',
        kind: this.kind,
        x: cellData.x || 0,
        y: cellData.y || 0,
        radius: cellData.radius || 25,
        rotation: cellData.rotation || 0,
        opacity: cellData.opacity || 1,
        zIndex: cellData.zIndex || 0,
        color: cellData.color || '#888888',
        shape: cellData.shape || 'circle',
        visible: true,
        selectable: true,
        parentId: null,
        childrenIds: [],
        description: '',
        code: cellData.code || '',
        attributes: { ...(cellData.attributes || {}) },
        triggerConfig: {
          mode: cellData.triggerMode || 'event',
          threshold: 60,
          accumulator: 0,
          pulseDecay: 0
        },
        ports: { inputs: {}, outputs: {} },
        state: 'normal',
        errorInfo: null
      };

      // 模拟附近基圆（用于测试）
      this._nearbyCells = [];

      // 动画队列
      this._animationQueue = [];

      // 运行状态
      this._running = false;
      this._lastTime = 0;
      this._frameCount = 0;
      this._fps = 0;
    }

    /**
     * 获取属性
     */
    getProperty(key) {
      if (key in this._cellData) {
        return this._cellData[key];
      } else if (key in this._cellData.attributes) {
        return this._cellData.attributes[key];
      }
      return undefined;
    }

    /**
     * 设置属性
     */
    setProperty(key, value) {
      const oldValue = this.getProperty(key);

      if (key in this._cellData) {
        this._cellData[key] = value;
      } else {
        this._cellData.attributes[key] = value;
      }

      this._notifyPropertyChange(key, oldValue, value);
      return true;
    }

    /**
     * 定义输入端口
     */
    defineInput(name, type = Types.PortType.ANY) {
      if (this._cellData.ports.inputs[name]) {
        this._cellData.ports.inputs[name].type = type;
        return this._cellData.ports.inputs[name];
      }

      const port = new InputPort(this.cellId, name, type);
      port.onChange = (value, oldValue, wireId) => {
        this.emit('portChange', {
          portName: name,
          portType: 'input',
          value,
          oldValue,
          wireId
        });
      };

      this._cellData.ports.inputs[name] = port;
      this._ports.inputs[name] = port;
      return port;
    }

    /**
     * 定义输出端口
     */
    defineOutput(name, type = Types.PortType.ANY) {
      if (this._cellData.ports.outputs[name]) {
        this._cellData.ports.outputs[name].type = type;
        return this._cellData.ports.outputs[name];
      }

      const port = new OutputPort(this.cellId, name, type);
      this._cellData.ports.outputs[name] = port;
      this._ports.outputs[name] = port;
      return port;
    }

    /**
     * 连接（在独立模式下，输出端口的值变化会触发事件）
     */
    connect(targetId, outputName, inputName) {
      console.log(`[StandaloneCellContext] Connect ${this.cellId}.${outputName} -> ${targetId}.${inputName}`);

      // 在独立模式下，我们记录连接关系但不实际连接
      if (!this._connections) {
        this._connections = [];
      }

      this._connections.push({
        fromCellId: this.cellId,
        fromPortName: outputName,
        toCellId: targetId,
        toPortName: inputName
      });

      return true;
    }

    /**
     * 断开连接
     */
    disconnect(targetId) {
      if (this._connections) {
        this._connections = this._connections.filter(
          c => c.toCellId !== targetId && c.fromCellId !== targetId
        );
      }
      return true;
    }

    /**
     * 查询基圆（模拟）
     */
    queryCells(filter) {
      let results = [{
        id: this.cellId,
        name: this._cellData.name,
        kind: this._cellData.kind,
        x: this._cellData.x,
        y: this._cellData.y,
        radius: this._cellData.radius,
        zIndex: this._cellData.zIndex,
        hasCode: !!this._cellData.code,
        triggerMode: this._cellData.triggerConfig.mode
      }];

      // 添加模拟的附近基圆
      results = results.concat(this._nearbyCells);

      // 应用过滤
      if (filter.kind) {
        results = results.filter(c => c.kind === filter.kind);
      }
      if (filter.near) {
        const { x, y, radius } = filter.near;
        results = results.filter(c => {
          const dx = c.x - x;
          const dy = c.y - y;
          return Math.sqrt(dx * dx + dy * dy) <= radius;
        });
      }

      return results;
    }

    /**
     * 查询附近基圆
     */
    queryNearby(radius) {
      return this.queryCells({
        near: { x: this._cellData.x, y: this._cellData.y, radius }
      }).filter(c => c.id !== this.cellId);
    }

    /**
     * 添加模拟的附近基圆
     */
    addNearbyCell(cell) {
      this._nearbyCells.push({
        id: cell.id || `cell_${Date.now()}`,
        name: cell.name || 'Nearby Cell',
        kind: cell.kind || 'empty',
        x: cell.x || 100,
        y: cell.y || 0,
        radius: cell.radius || 20,
        zIndex: 0,
        hasCode: false,
        triggerMode: 'event'
      });
    }

    /**
     * 动画
     */
    animate(prop, target, duration, easing = 'linear') {
      const startValue = this.getProperty(prop) || 0;
      const startTime = performance.now();

      const animation = {
        cellId: this.cellId,
        prop,
        startValue,
        target,
        duration: duration || 300,
        easing,
        startTime
      };

      this._animationQueue.push(animation);
      return true;
    }

    /**
     * 设置触发模式
     */
    setTriggerMode(mode, config = {}) {
      this._cellData.triggerConfig.mode = mode;
      if (config.threshold !== undefined) {
        this._cellData.triggerConfig.threshold = config.threshold;
      }
      if (config.eventMask !== undefined) {
        this._cellData.triggerConfig.eventMask = config.eventMask;
      }
      return true;
    }

    /**
     * 注册自定义绘制函数（独立模式下不支持）
     */
    registerDraw(drawFn) {
      console.log('[StandaloneCellContext] registerDraw not supported in standalone mode');
      return false;
    }

    /**
     * 更新动画
     */
    _updateAnimations(dt) {
      const now = performance.now();
      const completed = [];

      for (const anim of this._animationQueue) {
        const elapsed = now - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);
        const easedProgress = this._ease(progress, anim.easing);
        const currentValue = anim.startValue + (anim.target - anim.startValue) * easedProgress;

        this.setProperty(anim.prop, currentValue);

        if (progress >= 1) {
          completed.push(anim);
        }
      }

      for (const anim of completed) {
        const idx = this._animationQueue.indexOf(anim);
        if (idx !== -1) {
          this._animationQueue.splice(idx, 1);
        }
      }
    }

    /**
     * 缓动函数
     */
    _ease(t, type) {
      switch (type) {
        case 'linear': return t;
        case 'easeIn': return t * t;
        case 'easeOut': return t * (2 - t);
        case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default: return t;
      }
    }

    /**
     * 设置输出端口值
     */
    setOutputPort(name, value) {
      const port = this.getPort('outputs', name);
      if (port && port.send) {
        port.send(value);

        // 在独立模式下，触发模拟事件
        this.emit('outputChange', {
          portName: name,
          value
        });

        return true;
      }
      return false;
    }

    /**
     * 获取端口值
     */
    getPortValue(direction, name) {
      const port = this.getPort(direction, name);
      return port?.value;
    }

    /**
     * 获取当前基圆数据
     */
    getCell() {
      return { ...this._cellData };
    }

    /**
     * 模拟帧更新
     */
    simulateUpdate(dt = 16.67) {
      this._updateAnimations(dt);

      // 更新脉冲累积器（如果是脉冲模式）
      if (this._cellData.triggerConfig.mode === 'pulse') {
        this._cellData.triggerConfig.accumulator += 1;
        if (this._cellData.triggerConfig.pulseDecay > 0) {
          const deltaSeconds = dt / 1000;
          this._cellData.triggerConfig.accumulator *=
            (1 - this._cellData.triggerConfig.pulseDecay * deltaSeconds);
        }
      }

      // 如果是连续模式或脉冲触发，调用update
      if (this._cellData.triggerConfig.mode === 'continuous' ||
          (this._cellData.triggerConfig.mode === 'pulse' &&
           this._cellData.triggerConfig.accumulator >= this._cellData.triggerConfig.threshold)) {

        this.emit('onUpdate', { dt });

        if (this._cellData.triggerConfig.mode === 'pulse') {
          this._cellData.triggerConfig.accumulator = 0;
        }
      }
    }

    /**
     * 获取运行状态
     */
    isRunning() {
      return this._running;
    }

    /**
     * 获取FPS
     */
    getFPS() {
      return this._fps;
    }

    /**
     * 销毁
     */
    destroy() {
      super.destroy();
      this._animationQueue = [];
      this._nearbyCells = [];
      this._cellData = null;
    }

    /**
     * 获取上下文摘要（用于测试报告）
     */
    getTestSummary() {
      return {
        cellId: this.cellId,
        kind: this.kind,
        name: this._cellData.name,
        triggerMode: this._cellData.triggerConfig.mode,
        inputs: Object.keys(this._cellData.ports.inputs),
        outputs: Object.keys(this._cellData.ports.outputs),
        attributes: Object.keys(this._cellData.attributes),
        hasCode: !!this._cellData.code
      };
    }
  }

  // 暴露到全局
  global.StandaloneCellContext = StandaloneCellContext;

})(typeof window !== 'undefined' ? window : this);
