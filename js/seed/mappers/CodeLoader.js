/**
 * CodeLoader.js - 代码加载器
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.CodeLoader
 */

(function (global) {
  'use strict';

  const Types = global.Types || global.CellEngineTypes;
  const SegmentMapper = global.SegmentMapper;
  const FileMapper = global.FileMapper;
  const FolderMapper = global.FolderMapper;

  class CodeLoader {
    constructor(cellCore, persistLayer) {
      this._cellCore = cellCore;
      this._persistLayer = persistLayer;

      // 初始化各个mapper
      this._segmentMapper = new SegmentMapper(cellCore, persistLayer);
      this._fileMapper = new FileMapper(cellCore, persistLayer);
      this._folderMapper = new FolderMapper(cellCore, persistLayer);

      // 基圆到模式的映射缓存
      this._cellModeCache = new Map(); // cellId -> mode
    }

    /**
     * 初始化：从持久化层恢复模式信息
     */
    async init() {
      console.log('[CodeLoader] 初始化完成');
      return true;
    }

    /**
     * 获取基圆的代码映射模式
     * 自动检测
     */
    getMode(cellId) {
      // 缓存优先
      if (this._cellModeCache.has(cellId)) {
        return this._cellModeCache.get(cellId);
      }

      // 检测模式
      const cell = this._cellCore.getCell(cellId);
      if (!cell) return Types.CodeMappingMode.SEGMENT;

      // 按优先级检测
      if (FolderMapper.detect(cell)) {
        this._cellModeCache.set(cellId, Types.CodeMappingMode.FOLDER);
        return Types.CodeMappingMode.FOLDER;
      }

      if (FileMapper.detect(cell)) {
        this._cellModeCache.set(cellId, Types.CodeMappingMode.FILE);
        return Types.CodeMappingMode.FILE;
      }

      // 默认segment模式
      this._cellModeCache.set(cellId, Types.CodeMappingMode.SEGMENT);
      return Types.CodeMappingMode.SEGMENT;
    }

    /**
     * 切换基圆的代码映射模式
     */
    setMode(cellId, mode) {
      const cell = this._cellCore.getCell(cellId);
      if (!cell) return false;

      // 保存当前代码
      const currentCode = this.loadCode(cellId);

      // 设置新模式
      this._cellModeCache.set(cellId, mode);

      // 迁移代码到新模式
      switch (mode) {
        case Types.CodeMappingMode.SEGMENT:
          this._segmentMapper.saveSegment(cellId, 'init', currentCode);
          break;
        case Types.CodeMappingMode.FILE:
          this._fileMapper.saveCode(cellId, currentCode);
          break;
        case Types.CodeMappingMode.FOLDER:
          // 将当前代码作为init片段，其他为空
          this._folderMapper.saveLifeCycleCode(cellId, 'init', currentCode);
          break;
      }

      return true;
    }

    /**
     * 获取合适的mapper
     */
    _getMapperForCell(cellId) {
      const mode = this.getMode(cellId);

      switch (mode) {
        case Types.CodeMappingMode.FOLDER:
          return this._folderMapper;
        case Types.CodeMappingMode.FILE:
          return this._fileMapper;
        case Types.CodeMappingMode.SEGMENT:
        default:
          return this._segmentMapper;
      }
    }

    /**
     * 加载基圆的代码
     */
    loadCode(cellId) {
      const mode = this.getMode(cellId);

      switch (mode) {
        case Types.CodeMappingMode.FOLDER:
          return this._folderMapper.mergeCode(cellId);
        case Types.CodeMappingMode.FILE:
          return this._fileMapper.getCode(cellId);
        case Types.CodeMappingMode.SEGMENT:
        default:
          return this._segmentMapper.mergeCode(cellId);
      }
    }

    /**
     * 保存代码到基圆
     */
    saveCode(cellId, code) {
      const mode = this.getMode(cellId);

      switch (mode) {
        case Types.CodeMappingMode.FOLDER:
          // 文件夹模式：将整体代码拆分为init
          return this._folderMapper.saveLifeCycleCode(cellId, 'init', code);
        case Types.CodeMappingMode.FILE:
          return this._fileMapper.saveCode(cellId, code);
        case Types.CodeMappingMode.SEGMENT:
        default:
          return this._segmentMapper.saveSegment(cellId, 'init', code);
      }
    }

    /**
     * 保存特定生命周期代码（仅folder和segment模式有效）
     */
    saveLifeCycleCode(cellId, lifeCycleName, code) {
      const mode = this.getMode(cellId);

      switch (mode) {
        case Types.CodeMappingMode.FOLDER:
          return this._folderMapper.saveLifeCycleCode(cellId, lifeCycleName, code);
        case Types.CodeMappingMode.SEGMENT:
          return this._segmentMapper.saveSegment(cellId, lifeCycleName, code);
        case Types.CodeMappingMode.FILE:
        default:
          // file模式：将所有生命周期合并为一个文件
          const existingCode = this.loadCode(cellId);
          const newCode = existingCode
            ? existingCode + '\n\n// ===== ' + lifeCycleName + ' =====\n' + code
            : code;
          return this._fileMapper.saveCode(cellId, newCode);
      }
    }

    /**
     * 获取特定生命周期代码
     */
    getLifeCycleCode(cellId, lifeCycleName) {
      const mode = this.getMode(cellId);

      switch (mode) {
        case Types.CodeMappingMode.FOLDER:
          return this._folderMapper.getLifeCycleCode(cellId, lifeCycleName);
        case Types.CodeMappingMode.SEGMENT:
          return this._segmentMapper.getSegment(cellId, lifeCycleName);
        case Types.CodeMappingMode.FILE:
        default:
          // file模式：返回完整代码
          return this.loadCode(cellId);
      }
    }

    /**
     * 获取所有生命周期代码名称（用于UI展示）
     */
    getLifeCycleNames(cellId) {
      const mode = this.getMode(cellId);

      switch (mode) {
        case Types.CodeMappingMode.FOLDER:
          return FolderMapper.LIFE_CYCLE_FILES;
        case Types.CodeMappingMode.SEGMENT:
          return this._segmentMapper.getSegmentNames(cellId);
        case Types.CodeMappingMode.FILE:
        default:
          return ['code'];
      }
    }

    /**
     * 批量加载世界中所有基圆的代码
     */
    loadAllCells() {
      const cells = this._cellCore.getAllCells();
      const result = {};

      for (const cell of cells) {
        if (cell.code) {
          result[cell.id] = {
            code: this.loadCode(cell.id),
            mode: this.getMode(cell.id)
          };
        }
      }

      return result;
    }

    /**
     * 清空基圆代码
     */
    clearCode(cellId) {
      const mode = this.getMode(cellId);

      switch (mode) {
        case Types.CodeMappingMode.FOLDER:
          return this._folderMapper.deleteFolder(cellId);
        case Types.CodeMappingMode.FILE:
          return this._fileMapper.deleteCode(cellId);
        case Types.CodeMappingMode.SEGMENT:
        default:
          return this._segmentMapper.saveSegment(cellId, 'init', '');
      }
    }

    /**
     * 导出代码（用于备份/迁移）
     */
    exportCode(cellId) {
      const mode = this.getMode(cellId);

      switch (mode) {
        case Types.CodeMappingMode.FOLDER:
          return {
            mode,
            data: this._folderMapper.exportFolder(cellId)
          };
        case Types.CodeMappingMode.FILE:
          return {
            mode,
            data: { code: this._fileMapper.getCode(cellId) }
          };
        case Types.CodeMappingMode.SEGMENT:
        default:
          return {
            mode,
            data: this._segmentMapper.exportSegments(cellId)
          };
      }
    }

    /**
     * 导入代码
     */
    importCode(cellId, exportData) {
      if (!exportData) return false;

      const { mode, data } = exportData;

      // 切换到目标模式
      this._cellModeCache.set(cellId, mode);

      switch (mode) {
        case Types.CodeMappingMode.FOLDER:
          return this._folderMapper.importFolder(cellId, data);
        case Types.CodeMappingMode.SEGMENT:
          return this._segmentMapper.importSegments(cellId, data);
        case Types.CodeMappingMode.FILE:
        default:
          return this._fileMapper.saveCode(cellId, data.code || '');
      }
    }

    /**
     * 获取所有可用模式
     */
    getAvailableModes() {
      return [
        { mode: Types.CodeMappingMode.SEGMENT, label: '代码片段（默认）', desc: '简单、轻量' },
        { mode: Types.CodeMappingMode.FILE, label: '单文件模式', desc: '外部文件存储' },
        { mode: Types.CodeMappingMode.FOLDER, label: '文件夹模式', desc: '按生命周期分离' }
      ];
    }

    /**
     * 清理缓存
     */
    clearCache(cellId) {
      if (cellId) {
        this._cellModeCache.delete(cellId);
        this._segmentMapper.clearCache(cellId);
        this._fileMapper.clearCache(cellId);
        this._folderMapper.clearCache(cellId);
      } else {
        this._cellModeCache.clear();
        this._segmentMapper.clearCache();
        this._fileMapper.clearCache();
        this._folderMapper.clearCache();
      }
    }

    /**
     * 获取统计信息
     */
    getStats() {
      const cells = this._cellCore.getAllCells();
      const stats = {
        total: cells.length,
        withCode: 0,
        segmentMode: 0,
        fileMode: 0,
        folderMode: 0
      };

      for (const cell of cells) {
        if (cell.code) {
          stats.withCode++;
          const mode = this.getMode(cell.id);
          if (mode === Types.CodeMappingMode.SEGMENT) stats.segmentMode++;
          else if (mode === Types.CodeMappingMode.FILE) stats.fileMode++;
          else if (mode === Types.CodeMappingMode.FOLDER) stats.folderMode++;
        }
      }

      return stats;
    }
  }

  // 暴露到全局
  global.CodeLoader = CodeLoader;

})(typeof window !== 'undefined' ? window : this);
