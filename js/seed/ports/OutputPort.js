/**
 * OutputPort.js - 输出端口
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.OutputPort
 */

(function (global) {
  'use strict';

  const Port = global.Port;
  const Types = global.Types || global.CellEngineTypes;

  class OutputPort extends Port {
    constructor(cellId, name, type) {
      super(cellId, name, type, Types.PortDirection.OUTPUT);
      this._autoSend = true; // 是否自动发送值变化
    }

    /**
     * 设置是否自动发送
     */
    set autoSend(value) {
      this._autoSend = !!value;
    }

    get autoSend() {
      return this._autoSend;
    }

    /**
     * 发送数据到所有连接的输入端口
     * @param {any} value - 要发送的值
     */
    send(value) {
      if (!this._validateType(value)) {
        console.warn(`[OutputPort] Type mismatch on ${this.name}: expected ${this.type}, got ${typeof value}`);
        return false;
      }

      this.value = value;

      // 如果没有连接，直接返回
      if (this.connections.length === 0) {
        return true;
      }

      // 发送到所有连接的输入端口
      let success = true;
      for (const wire of this.connections) {
        // 通过WireRegistry发送（解耦）
        if (wire.active && typeof wire.send === 'function') {
          try {
            wire.send(value);
          } catch (e) {
            console.error(`[OutputPort] Failed to send via wire ${wire.id}:`, e);
            success = false;
          }
        }
      }

      return success;
    }

    /**
     * 设置值（如果autoSend启用则自动发送）
     */
    setValue(value) {
      if (super.setValue(value) && this._autoSend) {
        this.send(value);
        return true;
      }
      return false;
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
    }

    /**
     * 获取所有连接的线缆ID
     */
    getConnectionIds() {
      return this.connections.map(c => c.id);
    }

    /**
     * 获取连接的目标端口信息
     */
    getTargetPorts() {
      return this.connections.map(wire => ({
        cellId: wire.toCellId,
        portId: wire.toPortId
      }));
    }

    /**
     * 序列化
     */
    toJSON() {
      return {
        ...super.toJSON(),
        autoSend: this._autoSend
      };
    }

    /**
     * 从JSON反序列化
     */
    static fromJSON(cellId, json) {
      const port = new OutputPort(cellId, json.name, json.type);
      port.id = json.id;
      port.description = json.description || '';
      port._autoSend = json.autoSend !== undefined ? json.autoSend : true;
      return port;
    }
  }

  // 暴露到全局
  global.OutputPort = OutputPort;

})(typeof window !== 'undefined' ? window : this);
