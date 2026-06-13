/**
 * InputPort.js - 输入端口
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.InputPort
 */

(function (global) {
  'use strict';

  const Port = global.Port;
  const Types = global.Types || global.CellEngineTypes;

  class InputPort extends Port {
    constructor(cellId, name, type) {
      super(cellId, name, type, Types.PortDirection.INPUT);
      this._onChange = null;
      this._defaultValue = null;
    }

    /**
     * 设置变更回调
     */
    set onChange(callback) {
      if (typeof callback === 'function') {
        this._onChange = callback;
      }
    }

    get onChange() {
      return this._onChange;
    }

    /**
     * 设置默认值
     */
    set defaultValue(value) {
      if (this._validateType(value)) {
        this._defaultValue = value;
        this.value = value;
      }
    }

    get defaultValue() {
      return this._defaultValue;
    }

    /**
     * 接收数据
     * @param {any} value - 接收到的值
     * @param {string} wireId - 发送数据的线缆ID
     */
    receive(value, wireId) {
      if (!this._validateType(value)) {
        console.warn(`[InputPort] Type mismatch on ${this.name}: expected ${this.type}, got ${typeof value}`);
        return false;
      }

      const oldValue = this.value;
      this.value = value;

      // 触发变更回调
      if (this._onChange && oldValue !== value) {
        try {
          this._onChange(value, oldValue, wireId);
        } catch (e) {
          console.error(`[InputPort] onChange callback error:`, e);
        }
      }

      return true;
    }

    /**
     * 添加连接
     */
    connect(wire) {
      const existing = this.connections.find(c => c.id === wire.id);
      if (!existing) {
        this.connections.push(wire);
      }
    }

    /**
     * 断开连接
     */
    disconnect(wireId) {
      this.connections = this.connections.filter(c => c.id !== wireId);

      // 如果没有连接了，恢复默认值
      if (this.connections.length === 0 && this._defaultValue !== null) {
        this.value = this._defaultValue;
      }
    }

    /**
     * 获取所有连接的线缆ID
     */
    getConnectionIds() {
      return this.connections.map(c => c.id);
    }

    /**
     * 重置为默认值
     */
    reset() {
      this.value = this._defaultValue;
    }

    /**
     * 序列化
     */
    toJSON() {
      return {
        ...super.toJSON(),
        defaultValue: this._defaultValue
      };
    }

    /**
     * 从JSON反序列化
     */
    static fromJSON(cellId, json) {
      const port = new InputPort(cellId, json.name, json.type);
      port.id = json.id;
      port.description = json.description || '';
      port._defaultValue = json.defaultValue;
      port.value = json.defaultValue;
      return port;
    }
  }

  // 暴露到全局
  global.InputPort = InputPort;

})(typeof window !== 'undefined' ? window : this);
