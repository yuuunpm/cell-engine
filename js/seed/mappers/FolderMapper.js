/**
 * FolderMapper.js - 文件夹映射器
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.FolderMapper
 */

(function (global) {
  'use strict';

  const Types = global.Types || global.CellEngineTypes;

  class FolderMapper {
    constructor(cellCore, persistLayer) {
      this._cellCore = cellCore;
      this._persistLayer = persistLayer;
      this._folderCache = new Map(); // cellId -> Map(filename, code)
    }

    /**
     * 标准的生命周期文件列表
     */
    static get LIFE_CYCLE_FILES() {
      return ['init', 'update', 'render', 'onClick', 'onCollision', 'onMessage'];
    }

    /**
     * 获取模式名称
     */
    getMode() {
      return Types.CodeMappingMode.FOLDER;
    }

    /**
     * 从基圆数据加载代码文件夹
     * code字段存储文件夹路径或标记
     */
    loadFromCell(cell) {
      if (!cell) return { files: {}, folderRef: null };

      const folderRef = this._extractFolderRef(cell);
      const files = {};

      // 尝试从持久化层加载各个文件
      for (const lifeCycle of FolderMapper.LIFE_CYCLE_FILES) {
        const filePath = this._getFilePath(folderRef || `cells/${cell.id}`, lifeCycle);
        const code = this._loadFileContent(filePath);
        if (code !== null && code.trim()) {
          files[lifeCycle] = code;
        }
      }

      // 缓存
      const fileMap = new Map();
      for (const [name, code] of Object.entries(files)) {
        fileMap.set(name, code);
      }
      this._folderCache.set(cell.id, fileMap);

      return {
        files,
        folderRef: folderRef || `cells/${cell.id}`
      };
    }

    /**
     * 保存单个生命周期代码文件
     */
    saveLifeCycleCode(cellId, lifeCycleName, code) {
      const cell = this._cellCore.getCell(cellId);
      if (!cell) return false;

      const folderRef = this._extractFolderRef(cell) || `cells/${cellId}`;
      const filePath = this._getFilePath(folderRef, lifeCycleName);

      // 缓存
      if (!this._folderCache.has(cellId)) {
        this._folderCache.set(cellId, new Map());
      }
      this._folderCache.get(cellId).set(lifeCycleName, code);

      // 保存文件内容
      this._saveFileContent(filePath, code);

      // 更新基圆的code字段为文件夹标记
      this._cellCore.updateCell(cellId, {
        code: {
          mode: Types.CodeMappingMode.FOLDER,
          folder: folderRef,
          files: this._getCachedFileList(cellId)
        }
      });

      if (this._persistLayer) {
        this._persistLayer.markDirty(cellId);
      }

      return true;
    }

    /**
     * 获取单个生命周期代码
     */
    getLifeCycleCode(cellId, lifeCycleName) {
      const cached = this._folderCache.get(cellId);
      if (cached && cached.has(lifeCycleName)) {
        return cached.get(lifeCycleName);
      }

      // 尝试从持久化层加载
      const cell = this._cellCore.getCell(cellId);
      if (!cell) return '';

      const folderRef = this._extractFolderRef(cell) || `cells/${cell.id}`;
      const filePath = this._getFilePath(folderRef, lifeCycleName);
      return this._loadFileContent(filePath) || '';
    }

    /**
     * 获取所有生命周期代码
     */
    getAllLifeCycleCodes(cellId) {
      const result = {};
      for (const lifeCycle of FolderMapper.LIFE_CYCLE_FILES) {
        const code = this.getLifeCycleCode(cellId, lifeCycle);
        if (code && code.trim()) {
          result[lifeCycle] = code;
        }
      }
      return result;
    }

    /**
     * 合并所有生命周期代码为可执行代码
     */
    mergeCode(cellId) {
      const codes = this.getAllLifeCycleCodes(cellId);
      const parts = [];

      for (const name of FolderMapper.LIFE_CYCLE_FILES) {
        if (codes[name]) {
          parts.push(`// ===== ${name} =====`);
          parts.push(codes[name]);
          parts.push('');
        }
      }

      return parts.join('\n');
    }

    /**
     * 删除单个文件
     */
    deleteLifeCycleCode(cellId, lifeCycleName) {
      const cached = this._folderCache.get(cellId);
      if (cached) {
        cached.delete(lifeCycleName);
      }

      const cell = this._cellCore.getCell(cellId);
      if (cell) {
        const folderRef = this._extractFolderRef(cell) || `cells/${cell.id}`;
        const filePath = this._getFilePath(folderRef, lifeCycleName);
        this._deleteFile(filePath);

        // 更新基圆的code字段
        this._cellCore.updateCell(cellId, {
          code: {
            mode: Types.CodeMappingMode.FOLDER,
            folder: folderRef,
            files: this._getCachedFileList(cellId)
          }
        });

        if (this._persistLayer) {
          this._persistLayer.markDirty(cellId);
        }
      }

      return true;
    }

    /**
     * 删除整个文件夹
     */
    deleteFolder(cellId) {
      const cell = this._cellCore.getCell(cellId);
      if (cell) {
        const folderRef = this._extractFolderRef(cell) || `cells/${cell.id}`;

        // 删除所有生命周期文件
        for (const lifeCycle of FolderMapper.LIFE_CYCLE_FILES) {
          const filePath = this._getFilePath(folderRef, lifeCycle);
          this._deleteFile(filePath);
        }

        // 删除元数据文件
        this._deleteFile(`${folderRef}/cell.json`);
      }

      this._folderCache.delete(cellId);
      this._cellCore.updateCell(cellId, { code: '' });

      if (this._persistLayer) {
        this._persistLayer.markDirty(cellId);
      }

      return true;
    }

    /**
     * 检测模式是否适用
     */
    static detect(cell) {
      if (!cell || !cell.code) return false;

      // code字段包含mode标记
      if (cell.code && typeof cell.code === 'object' &&
          cell.code.mode === Types.CodeMappingMode.FOLDER) {
        return true;
      }

      // 或者code字段是文件夹路径
      if (typeof cell.code === 'string' &&
          cell.code.startsWith('cells/') && !cell.code.endsWith('.js')) {
        return true;
      }

      return false;
    }

    /**
     * 获取文件夹引用
     */
    _extractFolderRef(cell) {
      if (!cell.code) return null;

      if (typeof cell.code === 'object' && cell.code.folder) {
        return cell.code.folder;
      }

      if (typeof cell.code === 'string' &&
          cell.code.startsWith('cells/') && !cell.code.endsWith('.js')) {
        return cell.code;
      }

      return null;
    }

    /**
     * 获取文件路径
     */
    _getFilePath(folderRef, lifeCycleName) {
      return `${folderRef}/${lifeCycleName}.js`;
    }

    /**
     * 获取缓存的文件列表
     */
    _getCachedFileList(cellId) {
      const cached = this._folderCache.get(cellId);
      if (!cached) return [];
      return Array.from(cached.keys());
    }

    /**
     * 从存储加载文件内容
     */
    _loadFileContent(filePath) {
      try {
        if (this._persistLayer && typeof this._persistLayer.loadFile === 'function') {
          const result = this._persistLayer.loadFile(filePath);
          if (result && typeof result === 'string') {
            return result;
          }
        }

        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(`cell_folder:${filePath}`);
        }

        return null;
      } catch (e) {
        console.warn('[FolderMapper] 加载失败:', filePath, e);
        return null;
      }
    }

    /**
     * 保存文件内容
     */
    _saveFileContent(filePath, code) {
      try {
        if (this._persistLayer && typeof this._persistLayer.saveFile === 'function') {
          this._persistLayer.saveFile(filePath, code);
          return true;
        }

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`cell_folder:${filePath}`, code);
          return true;
        }

        return false;
      } catch (e) {
        console.warn('[FolderMapper] 保存失败:', filePath, e);
        return false;
      }
    }

    /**
     * 删除文件
     */
    _deleteFile(filePath) {
      try {
        if (this._persistLayer && typeof this._persistLayer.deleteFile === 'function') {
          this._persistLayer.deleteFile(filePath);
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(`cell_folder:${filePath}`);
        }
      } catch (e) {
        console.warn('[FolderMapper] 删除失败:', filePath, e);
      }
    }

    /**
     * 导出文件夹（用于备份）
     */
    exportFolder(cellId) {
      return this.getAllLifeCycleCodes(cellId);
    }

    /**
     * 导入文件夹
     */
    importFolder(cellId, files) {
      if (!files || typeof files !== 'object') return false;

      for (const [name, code] of Object.entries(files)) {
        if (FolderMapper.LIFE_CYCLE_FILES.includes(name)) {
          this.saveLifeCycleCode(cellId, name, code);
        }
      }

      return true;
    }

    /**
     * 清理缓存
     */
    clearCache(cellId) {
      if (cellId) {
        this._folderCache.delete(cellId);
      } else {
        this._folderCache.clear();
      }
    }
  }

  // 暴露到全局
  global.FolderMapper = FolderMapper;

})(typeof window !== 'undefined' ? window : this);
