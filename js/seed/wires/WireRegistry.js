/**
 * WireRegistry.js - 线缆注册表
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.WireRegistry
 */

(function (global) {
  'use strict';

  const Types = global.Types || global.CellEngineTypes;

  class WireRegistry {
    constructor(cellCore) {
      this._wires = new Map(); // wireId -> Wire
      this._cellCore = cellCore;
      this._onWireChange = null;
    }

    /**
     * 设置线缆变更回调
     */
    set onWireChange(callback) {
      if (typeof callback === 'function') {
        this._onWireChange = callback;
      }
    }

    get onWireChange() {
      return this._onWireChange;
    }

    /**
     * 创建线缆连接
     * @param {string} fromCellId - 源基圆ID
     * @param {string} fromPortId - 源端口ID
     * @param {string} toCellId - 目标基圆ID
     * @param {string} toPortId - 目标端口ID
     * @returns {Wire|null} - 创建的线缆，如果验证失败返回null
     */
    connect(fromCellId, fromPortId, toCellId, toPortId) {
      // 获取端口
      const fromCell = this._cellCore.getCell(fromCellId);
      const toCell = this._cellCore.getCell(toCellId);

      if (!fromCell || !toCell) {
        console.warn('[WireRegistry] Cell not found');
        return null;
      }

      const fromPort = fromCell.ports?.outputs?.[fromPortId];
      const toPort = toCell.ports?.inputs?.[toPortId];

      if (!fromPort || !toPort) {
        console.warn('[WireRegistry] Port not found');
        return null;
      }

      // 验证连接
      if (!this.validateConnection(fromPort, toPort)) {
        return null;
      }

      // 检查是否已存在相同连接
      const existingWire = this._findExistingWire(fromCellId, fromPortId, toCellId, toPortId);
      if (existingWire) {
        console.warn('[WireRegistry] Connection already exists');
        return existingWire;
      }

      // 创建线缆
      const wire = this._createWire(fromCellId, fromPortId, toCellId, toPortId, fromPort.type);

      // 添加到端口的连接列表
      fromPort.connect(wire);
      toPort.connect(wire);

      // 触发变更回调
      this._notifyChange('connect', wire);

      return wire;
    }

    /**
     * 创建线缆对象
     */
    _createWire(fromCellId, fromPortId, toCellId, toPortId, dataType) {
      const wireId = `wire_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;

      const wire = {
        id: wireId,
        fromCellId,
        fromPortId,
        toCellId,
        toPortId,
        active: true,
        dataType,

        // 发送数据方法
        send: (value) => {
          if (!wire.active) return;
          const toCell = this._cellCore.getCell(toCellId);
          if (toCell && toCell.ports?.inputs?.[toPortId]) {
            toCell.ports.inputs[toPortId].receive(value, wireId);
          }
        }
      };

      this._wires.set(wireId, wire);
      return wire;
    }

    /**
     * 查找已存在的相同连接
     */
    _findExistingWire(fromCellId, fromPortId, toCellId, toPortId) {
      for (const [, wire] of this._wires) {
        if (wire.fromCellId === fromCellId &&
            wire.fromPortId === fromPortId &&
            wire.toCellId === toCellId &&
            wire.toPortId === toPortId) {
          return wire;
        }
      }
      return null;
    }

    /**
     * 验证连接是否有效
     */
    validateConnection(fromPort, toPort) {
      // 方向检查
      if (fromPort.direction !== Types.PortDirection.OUTPUT) {
        console.warn('[WireRegistry] From port must be output');
        return false;
      }

      if (toPort.direction !== Types.PortDirection.INPUT) {
        console.warn('[WireRegistry] To port must be input');
        return false;
      }

      // 类型检查（允许any类型连接到任何类型）
      if (fromPort.type !== Types.PortType.ANY &&
          toPort.type !== Types.PortType.ANY &&
          fromPort.type !== toPort.type) {
        console.warn(`[WireRegistry] Type mismatch: ${fromPort.type} -> ${toPort.type}`);
        return false;
      }

      // 自连接检查
      if (fromPort.cellId === toPort.cellId) {
        console.warn('[WireRegistry] Cannot connect to self');
        return false;
      }

      return true;
    }

    /**
     * 断开线缆
     */
    disconnect(wireId) {
      const wire = this._wires.get(wireId);
      if (!wire) return false;

      // 从端口移除
      const fromCell = this._cellCore.getCell(wire.fromCellId);
      const toCell = this._cellCore.getCell(wire.toCellId);

      if (fromCell?.ports?.outputs?.[wire.fromPortId]) {
        fromCell.ports.outputs[wire.fromPortId].disconnect(wireId);
      }
      if (toCell?.ports?.inputs?.[wire.toPortId]) {
        toCell.ports.inputs[wire.toPortId].disconnect(wireId);
      }

      // 移除线缆
      this._wires.delete(wireId);

      // 触发变更回调
      this._notifyChange('disconnect', wire);

      return true;
    }

    /**
     * 断开某个基圆的所有连接
     */
    disconnectCell(cellId) {
      const wiresToRemove = [];

      for (const [wireId, wire] of this._wires) {
        if (wire.fromCellId === cellId || wire.toCellId === cellId) {
          wiresToRemove.push(wireId);
        }
      }

      for (const wireId of wiresToRemove) {
        this.disconnect(wireId);
      }
    }

    /**
     * 获取某个基圆的所有线缆
     */
    getWiresByCell(cellId) {
      const result = [];
      for (const wire of this._wires.values()) {
        if (wire.fromCellId === cellId || wire.toCellId === cellId) {
          result.push({ ...wire });
        }
      }
      return result;
    }

    /**
     * 获取所有线缆
     */
    getWires() {
      return Array.from(this._wires.values()).map(w => ({ ...w }));
    }

    /**
     * 获取单个线缆
     */
    getWire(id) {
      const wire = this._wires.get(id);
      return wire ? { ...wire } : undefined;
    }

    /**
     * 更新线缆属性
     */
    updateWire(wireId, updates) {
      const wire = this._wires.get(wireId);
      if (!wire) return false;

      Object.assign(wire, updates);
      this._notifyChange('update', wire);
      return true;
    }

    /**
     * 获取某个基圆的输入连接
     */
    getInputWires(cellId) {
      const result = [];
      for (const wire of this._wires.values()) {
        if (wire.toCellId === cellId) {
          result.push({ ...wire });
        }
      }
      return result;
    }

    /**
     * 获取某个基圆的输出连接
     */
    getOutputWires(cellId) {
      const result = [];
      for (const wire of this._wires.values()) {
        if (wire.fromCellId === cellId) {
          result.push({ ...wire });
        }
      }
      return result;
    }

    /**
     * 通知变更
     */
    _notifyChange(action, wire) {
      if (this._onWireChange) {
        try {
          this._onWireChange(action, wire);
        } catch (e) {
          console.error('[WireRegistry] onWireChange callback error:', e);
        }
      }
    }

    /**
     * 序列化所有线缆
     */
    toJSON() {
      const wires = [];
      for (const wire of this._wires.values()) {
        wires.push({
          id: wire.id,
          fromCellId: wire.fromCellId,
          fromPortId: wire.fromPortId,
          toCellId: wire.toCellId,
          toPortId: wire.toPortId,
          active: wire.active,
          dataType: wire.dataType
        });
      }
      return wires;
    }

    /**
     * 从JSON加载线缆
     */
    fromJSON(wiresData) {
      for (const wireData of wiresData) {
        const wire = this._createWire(
          wireData.fromCellId,
          wireData.fromPortId,
          wireData.toCellId,
          wireData.toPortId,
          wireData.dataType
        );
        wire.active = wireData.active;
      }
    }

    /**
     * 获取线缆数量
     */
    get count() {
      return this._wires.size;
    }
  }

  // 暴露到全局
  global.WireRegistry = WireRegistry;

})(typeof window !== 'undefined' ? window : this);
