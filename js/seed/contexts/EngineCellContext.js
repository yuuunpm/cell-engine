/**
 * EngineCellContext.js - 引擎环境中的基圆上下文
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.EngineCellContext
 */

(function (global) {
  'use strict';

  const CellContext = global.CellContext;
  const Types = global.Types || global.CellEngineTypes;
  const InputPort = global.InputPort;
  const OutputPort = global.OutputPort;

  class EngineCellContext extends CellContext {
    constructor(cellCore, cellId) {
      const cell = cellCore.getCell(cellId);
      super(cellId, cell?.kind || 'empty');

      this._cellCore = cellCore;
      this._cell = cell;
      this._animationQueue = [];
    }

    /**
     * 获取属性
     */
    getProperty(key) {
      const cell = this._cellCore.getCell(this.cellId);
      if (!cell) return undefined;

      if (key in cell) {
        return cell[key];
      } else if (key in cell.attributes) {
        return cell.attributes[key];
      }
      return undefined;
    }

    /**
     * 设置属性
     */
    setProperty(key, value) {
      const cell = this._cellCore.getCell(this.cellId);
      if (!cell) return false;

      const oldValue = this.getProperty(key);

      if (key in cell) {
        this._cellCore.updateCell(this.cellId, { [key]: value });
      } else {
        this._cellCore.setAttribute(this.cellId, key, value);
      }

      this._notifyPropertyChange(key, oldValue, value);
      return true;
    }

    /**
     * 定义输入端口
     */
    defineInput(name, type = Types.PortType.ANY) {
      // 获取当前基圆
      const cell = this._cellCore.getCell(this.cellId);
      if (!cell) return null;

      // 确保ports对象存在
      if (!cell.ports) {
        cell.ports = { inputs: {}, outputs: {} };
      }

      // 如果端口已存在，更新类型
      if (cell.ports.inputs[name]) {
        cell.ports.inputs[name].type = type;
        return cell.ports.inputs[name];
      }

      // 创建新端口
      const port = new InputPort(this.cellId, name, type);

      // 设置变更回调
      port.onChange = (value, oldValue, wireId) => {
        this.emit('portChange', {
          portName: name,
          portType: 'input',
          value,
          oldValue,
          wireId
        });
      };

      cell.ports.inputs[name] = port;
      this._ports.inputs[name] = port;

      return port;
    }

    /**
     * 定义输出端口
     */
    defineOutput(name, type = Types.PortType.ANY) {
      const cell = this._cellCore.getCell(this.cellId);
      if (!cell) return null;

      if (!cell.ports) {
        cell.ports = { inputs: {}, outputs: {} };
      }

      if (cell.ports.outputs[name]) {
        cell.ports.outputs[name].type = type;
        return cell.ports.outputs[name];
      }

      const port = new OutputPort(this.cellId, name, type);
      cell.ports.outputs[name] = port;
      this._ports.outputs[name] = port;

      return port;
    }

    /**
     * 连接到另一个基圆的输入端口
     */
    connect(targetId, outputName, inputName) {
      const cell = this._cellCore.getCell(this.cellId);
      if (!cell?.ports?.outputs?.[outputName]) {
        console.warn('[EngineCellContext] Output port not found:', outputName);
        return false;
      }

      const targetCell = this._cellCore.getCell(targetId);
      if (!targetCell?.ports?.inputs?.[inputName]) {
        console.warn('[EngineCellContext] Target input port not found:', inputName);
        return false;
      }

      // 通过WireRegistry创建连接（传入端口名，WireRegistry 内部按名索引）
      const wireRegistry = this._cellCore.getWireRegistry();
      if (!wireRegistry) {
        console.warn('[EngineCellContext] WireRegistry not available');
        return false;
      }

      const wire = wireRegistry.connect(
        this.cellId,
        outputName,
        targetId,
        inputName
      );

      return wire !== null;
    }

    /**
     * 断开连接
     */
    disconnect(targetId) {
      const wireRegistry = this._cellCore.getWireRegistry();
      if (!wireRegistry) return false;

      const wires = wireRegistry.getWiresByCell(this.cellId);
      let disconnected = false;

      for (const wire of wires) {
        if (wire.toCellId === targetId || wire.fromCellId === targetId) {
          wireRegistry.disconnect(wire.id);
          disconnected = true;
        }
      }

      return disconnected;
    }

    /**
     * 查询基圆
     */
    queryCells(filter) {
      const cells = this._cellCore.queryCells(filter);
      return cells.map(c => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        x: c.x,
        y: c.y,
        radius: c.radius,
        zIndex: c.zIndex,
        hasCode: !!c.code,
        triggerMode: c.triggerConfig?.mode || 'event'
      }));
    }

    /**
     * 查询附近基圆
     */
    queryNearby(radius) {
      const cell = this._cellCore.getCell(this.cellId);
      if (!cell) return [];

      return this.queryCells({
        near: { x: cell.x, y: cell.y, radius }
      });
    }

    /**
     * 动画
     */
    animate(prop, target, duration, easing = 'linear') {
      const cell = this._cellCore.getCell(this.cellId);
      if (!cell) return false;

      const startValue = cell[prop] !== undefined ? cell[prop] : (cell.attributes[prop] || 0);
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
      if (this._cellCore && typeof this._cellCore.setTriggerMode === 'function') {
        this._cellCore.setTriggerMode(this.cellId, mode, config);
        return true;
      }
      return false;
    }

    /**
     * 注册自定义绘制函数
     */
    registerDraw(drawFn) {
      if (window.RenderBridge && typeof window.RenderBridge.registerCustomDraw === 'function') {
        window.RenderBridge.registerCustomDraw(this.cellId, drawFn);
        return true;
      }
      return false;
    }

    /**
     * 更新动画
     */
    updateAnimations() {
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

      // 移除完成的动画
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
     * 获取端口值
     */
    getPortValue(direction, name) {
      const port = this.getPort(direction, name);
      return port?.value;
    }

    /**
     * 设置输出端口值（会自动发送）
     */
    setOutputPort(name, value) {
      const port = this.getPort('outputs', name);
      if (port && port.send) {
        return port.send(value);
      }
      return false;
    }

    /**
     * 获取当前基圆数据
     */
    getCell() {
      return this._cellCore.getCell(this.cellId);
    }

    /**
     * 更新引用的基圆对象
     */
    refreshCell() {
      this._cell = this._cellCore.getCell(this.cellId);
    }

    /**
     * 销毁
     */
    destroy() {
      super.destroy();
      this._animationQueue = [];
      this._cellCore = null;
      this._cell = null;
    }
  }

  // 暴露到全局
  global.EngineCellContext = EngineCellContext;

})(typeof window !== 'undefined' ? window : this);
