/**
 * Port.js - 端口基类
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.Port
 */

(function (global) {
  'use strict';

  // 引用全局类型
  const Types = global.Types || global.CellEngineTypes;

  class Port {
    constructor(cellId, name, type, direction) {
      this.id = `port_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
      this.cellId = cellId;
      this.name = name;
      this.type = type;
      this.direction = direction;
      this.value = null;
      this.description = '';
      this.connections = [];

      // 验证类型
      if (Types && !Types.validatePortType(type)) {
        console.warn(`[Port] Invalid port type: ${type}`);
      }
      if (Types && !Types.validatePortDirection(direction)) {
        console.warn(`[Port] Invalid port direction: ${direction}`);
      }
    }

    /**
     * 获取端口的显示信息
     */
    getInfo() {
      return {
        id: this.id,
        name: this.name,
        type: this.type,
        direction: this.direction,
        cellId: this.cellId,
        value: this.value,
        description: this.description
      };
    }

    /**
     * 设置端口值（带类型检查）
     */
    setValue(value) {
      if (this._validateType(value)) {
        this.value = value;
        return true;
      }
      return false;
    }

    /**
     * 类型验证
     */
    _validateType(value) {
      if (!Types) return true;
      if (this.type === Types.PortType.ANY) return true;
      if (this.type === Types.PortType.BOOLEAN) return typeof value === 'boolean';
      if (this.type === Types.PortType.NUMBER) return typeof value === 'number';
      if (this.type === Types.PortType.STRING) return typeof value === 'string';
      return false;
    }

    /**
     * 获取端口在画布上的位置
     * @param {Object} cell - 基圆数据
     * @returns {Object} { x, y }
     */
    getPosition(cell) {
      const angle = this._getPortAngle(cell);
      const radius = cell.radius + 8;
      return {
        x: cell.x + Math.cos(angle) * radius,
        y: cell.y + Math.sin(angle) * radius
      };
    }

    /**
     * 根据端口名称计算角度（输入端口在左侧，输出端口在右侧）
     */
    _getPortAngle(cell) {
      if (!cell) return 0;

      // 根据端口方向选择端口列表
      let ports;
      if (Types && this.direction === Types.PortDirection.INPUT) {
        ports = Object.values(cell.ports?.inputs || {});
      } else {
        ports = Object.values(cell.ports?.outputs || {});
      }

      const portNames = ports.map(p => p.name).sort();
      const index = portNames.indexOf(this.name);
      const total = portNames.length || 1;

      // 输入端口在左侧（角度 PI），输出端口在右侧（角度 0）
      let baseAngle;
      if (Types && this.direction === Types.PortDirection.INPUT) {
        baseAngle = Math.PI;
      } else {
        baseAngle = 0;
      }

      const spread = Math.PI * 0.6;

      if (total === 1) return baseAngle;
      return baseAngle + (index - (total - 1) / 2) * (spread / (total - 1));
    }

    /**
     * 序列化
     */
    toJSON() {
      return {
        id: this.id,
        name: this.name,
        type: this.type,
        direction: this.direction,
        description: this.description
      };
    }

    /**
     * 从JSON反序列化
     */
    static fromJSON(cellId, json) {
      const port = new Port(cellId, json.name, json.type, json.direction);
      port.id = json.id;
      port.description = json.description || '';
      return port;
    }
  }

  // 暴露到全局
  global.Port = Port;

})(typeof window !== 'undefined' ? window : this);
