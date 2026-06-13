/**
 * SegmentMapper.js - 代码片段映射器
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.SegmentMapper
 */

(function (global) {
  'use strict';

  const Types = global.Types || global.CellEngineTypes;

  class SegmentMapper {
    constructor(cellCore, persistLayer) {
      this._cellCore = cellCore;
      this._persistLayer = persistLayer;
      this._segments = new Map(); // cellId -> Map(segmentName, code)
    }

    /**
     * 获取模式名称
     */
    getMode() {
      return Types.CodeMappingMode.SEGMENT;
    }

    /**
     * 从基圆数据加载代码片段
     * @param {Object} cell - 基圆对象
     * @returns {Object} { segments, main } - 代码片段集合和主片段名称
     */
    loadFromCell(cell) {
      if (!cell) return { segments: {}, main: null };

      // 从code字段解析（可能是单个字符串，也可能是结构化对象）
      const codeData = cell.code || '';
      const segments = {};

      if (typeof codeData === 'string') {
        // V3.0兼容：单个代码字符串
        segments['init'] = codeData;
        segments['update'] = '';
        segments['render'] = '';
      } else if (typeof codeData === 'object' && codeData !== null) {
        // V4.0结构化代码片段
        Object.assign(segments, codeData);
      }

      // 缓存代码片段
      const cellSegments = new Map();
      for (const [name, code] of Object.entries(segments)) {
        cellSegments.set(name, code);
      }
      this._segments.set(cell.id, cellSegments);

      return {
        segments,
        main: codeData && typeof codeData === 'object' ? codeData.main || 'init' : 'init'
      };
    }

    /**
     * 保存代码片段到基圆
     * @param {string} cellId - 基圆ID
     * @param {string} segmentName - 片段名称
     * @param {string} code - 代码内容
     */
    saveSegment(cellId, segmentName, code) {
      const cell = this._cellCore.getCell(cellId);
      if (!cell) return false;

      // 更新缓存
      if (!this._segments.has(cellId)) {
        this._segments.set(cellId, new Map());
      }
      this._segments.get(cellId).set(segmentName, code);

      // 序列化存储到code字段
      const segments = this._segments.get(cellId);
      const codeObject = {};
      for (const [name, c] of segments) {
        codeObject[name] = c;
      }

      this._cellCore.updateCell(cellId, { code: codeObject });

      if (this._persistLayer) {
        this._persistLayer.markDirty(cellId);
      }

      return true;
    }

    /**
     * 获取代码片段
     */
    getSegment(cellId, segmentName) {
      const cellSegments = this._segments.get(cellId);
      return cellSegments ? cellSegments.get(segmentName) || '' : '';
    }

    /**
     * 获取所有代码片段名称
     */
    getSegmentNames(cellId) {
      const cellSegments = this._segments.get(cellId);
      return cellSegments ? Array.from(cellSegments.keys()) : [];
    }

    /**
     * 合并代码片段为可执行代码
     * 逻辑：按生命周期顺序合并
     */
    mergeCode(cellId) {
      const cellSegments = this._segments.get(cellId);
      if (!cellSegments) return '';

      // 定义合并顺序
      const order = ['init', 'update', 'render', 'onClick', 'onCollision', 'onMessage'];
      const allNames = Array.from(cellSegments.keys());
      const ordered = order.filter(name => allNames.includes(name));
      const others = allNames.filter(name => !order.includes(name));

      // 合并代码
      const parts = [];
      for (const name of ordered.concat(others)) {
        const code = cellSegments.get(name);
        if (code && code.trim()) {
          parts.push(`// ===== ${name} =====`);
          parts.push(code);
          parts.push('');
        }
      }

      return parts.join('\n');
    }

    /**
     * 删除代码片段
     */
    deleteSegment(cellId, segmentName) {
      const cellSegments = this._segments.get(cellId);
      if (cellSegments) {
        cellSegments.delete(segmentName);
      }

      const cell = this._cellCore.getCell(cellId);
      if (cell && typeof cell.code === 'object' && cell.code !== null) {
        delete cell.code[segmentName];
        this._cellCore.updateCell(cellId, { code: cell.code });
        if (this._persistLayer) {
          this._persistLayer.markDirty(cellId);
        }
      }

      return true;
    }

    /**
     * 检测模式是否适用
     */
    static detect(cell) {
      if (!cell || !cell.code) return false;
      // 单个字符串代码或对象结构都属于segment模式
      return true;
    }

    /**
     * 导出代码片段（用于备份/迁移）
     */
    exportSegments(cellId) {
      const cellSegments = this._segments.get(cellId);
      if (!cellSegments) return {};

      const result = {};
      for (const [name, code] of cellSegments) {
        result[name] = code;
      }
      return result;
    }

    /**
     * 导入代码片段
     */
    importSegments(cellId, segments) {
      if (!segments || typeof segments !== 'object') return false;

      const cell = this._cellCore.getCell(cellId);
      if (!cell) return false;

      const cellSegments = new Map();
      for (const [name, code] of Object.entries(segments)) {
        cellSegments.set(name, code);
      }
      this._segments.set(cellId, cellSegments);

      // 保存到基圆
      this._cellCore.updateCell(cellId, { code: segments });
      if (this._persistLayer) {
        this._persistLayer.markDirty(cellId);
      }

      return true;
    }

    /**
     * 清理缓存
     */
    clearCache(cellId) {
      if (cellId) {
        this._segments.delete(cellId);
      } else {
        this._segments.clear();
      }
    }
  }

  // 暴露到全局
  global.SegmentMapper = SegmentMapper;

})(typeof window !== 'undefined' ? window : this);
