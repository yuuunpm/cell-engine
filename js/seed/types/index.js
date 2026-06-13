/**
 * V4.0 类型定义
 * 集中管理所有类型接口定义
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.CellEngineTypes
 */

(function (global) {
  'use strict';

  // ===== 端口类型 =====
  const PortType = {
    BOOLEAN: 'boolean',
    NUMBER: 'number',
    STRING: 'string',
    ANY: 'any'
  };

  const PortDirection = {
    INPUT: 'input',
    OUTPUT: 'output'
  };

  // ===== 代码映射模式 =====
  const CodeMappingMode = {
    FOLDER: 'folder',
    FILE: 'file',
    SEGMENT: 'segment'
  };

  // ===== 接口定义 =====
  const Interfaces = {
    Port: `
interface Port {
  id: string;
  name: string;
  type: PortType;
  direction: PortDirection;
  cellId: string;
  value: any;
  description: string;
}
    `.trim(),

    InputPort: `
interface InputPort extends Port {
  connections: Wire[];
  onChange: (value: any) => void;
  connect(wire: Wire): void;
  disconnect(wireId: string): void;
  receive(value: any): void;
}
    `.trim(),

    OutputPort: `
interface OutputPort extends Port {
  connections: Wire[];
  send(value: any): void;
  connect(targetInputPortId: string): Wire;
  disconnect(targetInputPortId: string): void;
}
    `.trim(),

    Wire: `
interface Wire {
  id: string;
  fromCellId: string;
  fromPortId: string;
  toCellId: string;
  toPortId: string;
  active: boolean;
  dataType: PortType;
}
    `.trim(),

    CellSummary: `
interface CellSummary {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  radius: number;
  zIndex: number;
  hasCode: boolean;
  triggerMode: string;
}
    `.trim(),

    CellContext: `
interface CellContext {
  cellId: string;
  kind: string;

  // 属性访问
  getProperty(key: string): any;
  setProperty(key: string, value: any): void;

  // 端口操作
  defineInput(name: string, type: PortType): InputPort;
  defineOutput(name: string, type: PortType): OutputPort;
  connect(targetId: string, outputName: string, inputName: string): void;
  disconnect(targetId: string): void;

  // 事件操作
  on(event: string, callback: Function): void;
  once(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
  emit(event: string, data: any): void;

  // 生命周期
  init(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  destroy(): void;

  // 查询
  queryCells(filter: any): CellSummary[];
  queryNearby(radius: number): CellSummary[];

  // 动画
  animate(prop: string, target: any, duration: number, easing?: string): void;

  // 日志
  log(message: string): void;
}
    `.trim(),

    WireRegistry: `
interface WireRegistry {
  connect(fromCellId: string, fromPortId: string, toCellId: string, toPortId: string): Wire | null;
  disconnect(wireId: string): boolean;
  disconnectCell(cellId: string): void;
  getWiresByCell(cellId: string): Wire[];
  getWires(): Wire[];
  getWire(id: string): Wire | undefined;
  updateWire(wireId: string, updates: Partial<Wire>): void;
  validateConnection(fromPort: Port, toPort: Port): boolean;
}
    `.trim()
  };

  // ===== 类型验证 =====
  function validatePortType(type) {
    return Object.values(PortType).includes(type);
  }

  function validatePortDirection(direction) {
    return Object.values(PortDirection).includes(direction);
  }

  function validateMappingMode(mode) {
    return Object.values(CodeMappingMode).includes(mode);
  }

  const CellEngineTypes = {
    // 枚举类型
    PortType,
    PortDirection,
    CodeMappingMode,

    // 接口定义
    Interfaces,

    // 验证函数
    validatePortType,
    validatePortDirection,
    validateMappingMode
  };

  // 暴露到全局
  global.CellEngineTypes = CellEngineTypes;

  // 兼容旧的变量名（loader等地方可能会引用）
  global.Types = CellEngineTypes;

})(typeof window !== 'undefined' ? window : this);
