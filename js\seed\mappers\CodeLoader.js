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
     * 自动检测：优先显式标记，其次智能推断（基于代码大小和复杂度）
     */
    getMode(cellId) {
      // 缓存优先
      if (this._cellModeCache.has(cellId)) {
        return this._cellModeCache.get(cellId);
      }

      // 检测模式
      const cell = this._cellCore.getCell(cellId);
      if (!cell) return Types.CodeMappingMode.SEGMENT;

      // 1. 优先检测显式标记（文件夹/文件路径）
      if (FolderMapper.detect(cell)) {
        this._cellModeCache.set(cellId, Types.CodeMappingMode.FOLDER);
        return Types.CodeMappingMode.FOLDER;
      }

      if (FileMapper.detect(cell)) {
        this._cellModeCache.set(cellId, Types.CodeMappingMode.FILE);
        return Types.CodeMappingMode.FILE;
      }

      // 2. 智能推断：根据代码大小和复杂度自动选择
      const codeStr = typeof cell.code === 'string' ? cell.code : '';
      const { lineCount, complexityScore } = this._analyzeCodeComplexity(codeStr);

      let autoMode;
      // 复杂度极高（>1000行 或 复杂度>9）→ 文件夹模式
      if (lineCount > 1000 || complexityScore > 9) {
        autoMode = Types.CodeMappingMode.FOLDER;
      }
      // 中等以上复杂度（>50行 或 复杂度>4）→ 文件模式
      else if (lineCount > 50 || complexityScore > 4) {
        autoMode = Types.CodeMappingMode.FILE;
      }
      // 简单代码（≤50行）→ 片段模式
      else {
        autoMode = Types.CodeMappingMode.SEGMENT;
      }

      this._cellModeCache.set(cellId, autoMode);
      return autoMode;
    }

    /**
     * 分析代码复杂度
     * @param {string} code - 代码字符串
     * @returns {{ lineCount: number, complexityScore: number }}
     */
    _analyzeCodeComplexity(code) {
      if (!code || typeof code !== 'string') {
        return { lineCount: 0, complexityScore: 0 };
      }

      // 行数统计
      const lines = code.split('\n');
      const nonEmptyLines = lines.filter(l => l.trim().length > 0);
      const lineCount = nonEmptyLines.length;

      // 复杂度评分（0-10）
      let score = 0;

      // 评分维度：
      // 1. 嵌套深度（函数/if/for 嵌套层数）
      const maxIndent = Math.max(...nonEmptyLines.map(l => {
        const trimmed = l.replace(/\t/g, '  ');
        return trimmed.search(/\S/);
      }).filter(v => v >= 0));
      if (maxIndent > 30) score += 2;  // 深缩进 → 高嵌套
      else if (maxIndent > 15) score += 1;

      // 2. 函数数量
      const funcCount = (code.match(/\bfunction\s+\w+|\b\w+\s*=\s*(?:function|\(|=>)/g) || []).length;
      if (funcCount > 5) score += 2;
      else if (funcCount > 2) score += 1;

      // 3. 循环和条件数量
      const loopCount = (code.match(/\b(for|while|do)\b/g) || []).length;
      const condCount = (code.match(/\b(if|else|switch|case)\b/g) || []).length;
      score += Math.min(2, Math.floor((loopCount + condCount) / 5));

      // 4. 字符串模板/拼接复杂度
      const templateCount = (code.match(/`[^`]*\$\{[^}]+\}[^`]*`/g) || []).length;
      const concatCount = (code.match(/\+\s*['"`]/g) || []).length;
      if (templateCount > 3 || concatCount > 10) score += 1;

      // 5. 动态代码执行（eval/new Function/Function 构造）
      if (/\b(eval|new\s+Function|Function)\s*\(/g.test(code)) score += 1;

      // 6. API 调用数量
      const apiCalls = (code.match(/\bapi\.\w+\(/g) || []).length;
      if (apiCalls > 20) score += 1;
      else if (apiCalls > 10) score += 0.5;

      return {
        lineCount,
        complexityScore: Math.min(10, score)  // 最高10分
      };
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
