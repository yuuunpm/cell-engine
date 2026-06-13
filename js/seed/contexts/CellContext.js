/**
 * CellContext.js - 基圆上下文接口
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.CellContext
 */

(function (global) {
  'use strict';

  const Types = global.Types || global.CellEngineTypes;

  class CellContext {
    constructor(cellId, kind) {
      this.cellId = cellId;
      this.kind = kind;
      this._eventListeners = {};
      this._ports = { inputs: {}, outputs: {} };
      this._wireRegistry = null;
    }

    // ===== 属性访问 =====

    getProperty(key) {
      throw new Error('getProperty must be implemented');
    }

    setProperty(key, value) {
      throw new Error('setProperty must be implemented');
    }

    // ===== 端口操作 =====

    defineInput(name, type = Types.PortType.ANY) {
      throw new Error('defineInput must be implemented');
    }

    defineOutput(name, type = Types.PortType.ANY) {
      throw new Error('defineOutput must be implemented');
    }

    connect(targetId, outputName, inputName) {
      throw new Error('connect must be implemented');
    }

    disconnect(targetId) {
      throw new Error('disconnect must be implemented');
    }

    // ===== 事件操作 =====

    on(event, callback) {
      if (!this._eventListeners[event]) {
        this._eventListeners[event] = [];
      }
      this._eventListeners[event].push(callback);
    }

    once(event, callback) {
      const wrapper = (...args) => {
        callback(...args);
        this.off(event, wrapper);
      };
      this.on(event, wrapper);
    }

    off(event, callback) {
      if (!this._eventListeners[event]) return;
      const idx = this._eventListeners[event].indexOf(callback);
      if (idx !== -1) {
        this._eventListeners[event].splice(idx, 1);
      }
    }

    emit(event, data) {
      if (!this._eventListeners[event]) return;
      for (const cb of this._eventListeners[event]) {
        try {
          cb(data, event);
        } catch (e) {
          console.error(`[CellContext] Event callback error for ${event}:`, e);
        }
      }
    }

    // ===== 生命周期 =====

    init() {
      // 默认空实现
    }

    update(dt) {
      // 默认空实现
    }

    render(ctx) {
      // 默认空实现
    }

    destroy() {
      this._eventListeners = {};
      this._ports = { inputs: {}, outputs: {} };
    }

    // ===== 查询 =====

    queryCells(filter) {
      throw new Error('queryCells must be implemented');
    }

    queryNearby(radius) {
      throw new Error('queryNearby must be implemented');
    }

    // ===== 动画 =====

    animate(prop, target, duration, easing = 'linear') {
      throw new Error('animate must be implemented');
    }

    // ===== 触发模式 =====

    setTriggerMode(mode, config) {
      throw new Error('setTriggerMode must be implemented');
    }

    // ===== 自定义绘制 =====

    registerDraw(drawFn) {
      throw new Error('registerDraw must be implemented');
    }

    // ===== 日志 =====

    log(message) {
      console.log(`[Cell:${this.cellId}]`, message);
    }

    // ===== 辅助方法 =====

    /**
     * 获取端口
     */
    getPort(direction, name) {
      return this._ports[direction]?.[name];
    }

    /**
     * 获取所有端口
     */
    getPorts() {
      return { ...this._ports };
    }

    /**
     * 设置WireRegistry
     */
    setWireRegistry(registry) {
      this._wireRegistry = registry;
    }

    getWireRegistry() {
      return this._wireRegistry;
    }

    /**
     * 触发属性变更事件
     */
    _notifyPropertyChange(key, oldValue, newValue) {
      this.emit('propertyChange', { key, oldValue, newValue });
    }

    /**
     * 获取上下文摘要
     */
    getSummary() {
      return {
        cellId: this.cellId,
        kind: this.kind,
        inputs: Object.keys(this._ports.inputs || {}),
        outputs: Object.keys(this._ports.outputs || {})
      };
    }
  }

  // 暴露到全局
  global.CellContext = CellContext;

})(typeof window !== 'undefined' ? window : this);
