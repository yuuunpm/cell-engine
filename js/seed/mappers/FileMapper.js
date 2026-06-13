/**
 * FileMapper.js - 单文件映射器
 * 浏览器兼容版本：使用 IIFE 模式挂载到全局 window.FileMapper
 */

(function (global) {
  'use strict';

  const Types = global.Types || global.CellEngineTypes;

  class FileMapper {
    constructor(cellCore, persistLayer) {
      this._cellCore = cellCore;
      this._persistLayer = persistLayer;
      this._fileCache = new Map(); // cellId -> code content
    }

    /**
     * 获取模式名称
     */
    getMode() {
      return Types.CodeMappingMode.FILE;
    }

    /**
     * 从基圆数据加载代码文件
     * 基圆的code字段存储文件路径/引用
     */
    loadFromCell(cell) {
      if (!cell) return { code: '', fileRef: null };

      // code字段存储文件引用
      const fileRef = typeof cell.code === 'string' ? cell.code :
                      (cell.code && cell.code.fileRef ? cell.code.fileRef : null);

      if (!fileRef) {
        // 没有外部文件引用，使用code字段中的代码
        return {
          code: typeof cell.code === 'string' ? cell.code : '',
          fileRef: null
        };
      }

      // 从缓存读取
      if (this._fileCache.has(cell.id)) {
        return {
          code: this._fileCache.get(cell.id),
          fileRef
        };
      }

      // 尝试从持久化层加载
      const code = this._loadFromStorage(fileRef);
      if (code !== null) {
        this._fileCache.set(cell.id, code);
      }

      return {
        code: code || '',
        fileRef
      };
    }

    /**
     * 保存代码到外部文件
     */
    saveCode(cellId, code, fileRef) {
      const cell = this._cellCore.getCell(cellId);
      if (!cell) return false;

      const ref = fileRef || this._generateFileRef(cellId);

      // 缓存代码
      this._fileCache.set(cellId, code);

      // 保存到持久化层
      this._saveToStorage(ref, code);

      // 在基圆的code字段存储引用
      this._cellCore.updateCell(cellId, { code: ref });

      if (this._persistLayer) {
        this._persistLayer.markDirty(cellId);
      }

      return ref;
    }

    /**
     * 获取代码
     */
    getCode(cellId) {
      const cell = this._cellCore.getCell(cellId);
      if (!cell) return '';

      const result = this.loadFromCell(cell);
      return result.code || '';
    }

    /**
     * 获取文件引用
     */
    getFileRef(cellId) {
      const cell = this._cellCore.getCell(cellId);
      if (!cell) return null;

      const result = this.loadFromCell(cell);
      return result.fileRef;
    }

    /**
     * 生成文件引用
     */
    _generateFileRef(cellId) {
      return `cells/${cellId}_code.js`;
    }

    /**
     * 从存储加载代码（浏览器环境使用localStorage作为后备）
     */
    _loadFromStorage(fileRef) {
      try {
        // 优先使用持久化层
        if (this._persistLayer && typeof this._persistLayer.loadFile === 'function') {
          const result = this._persistLayer.loadFile(fileRef);
          if (result && typeof result === 'string') {
            return result;
          }
        }

        // 后备：从localStorage读取
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(`cell_file:${fileRef}`);
        }

        return null;
      } catch (e) {
        console.warn('[FileMapper] 加载失败:', fileRef, e);
        return null;
      }
    }

    /**
     * 保存到存储
     */
    _saveToStorage(fileRef, code) {
      try {
        // 优先使用持久化层
        if (this._persistLayer && typeof this._persistLayer.saveFile === 'function') {
          this._persistLayer.saveFile(fileRef, code);
          return true;
        }

        // 后备：存入localStorage
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`cell_file:${fileRef}`, code);
          return true;
        }

        return false;
      } catch (e) {
        console.warn('[FileMapper] 保存失败:', fileRef, e);
        return false;
      }
    }

    /**
     * 删除代码文件
     */
    deleteCode(cellId) {
      const cell = this._cellCore.getCell(cellId);
      if (!cell) return false;

      const fileRef = this.getFileRef(cellId);
      if (fileRef) {
        try {
          if (this._persistLayer && typeof this._persistLayer.deleteFile === 'function') {
            this._persistLayer.deleteFile(fileRef);
          }
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(`cell_file:${fileRef}`);
          }
        } catch (e) {
          console.warn('[FileMapper] 删除失败:', e);
        }
      }

      this._fileCache.delete(cellId);

      // 清空基圆的code字段
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
      // 当code字段形如文件路径时，使用file模式
      if (typeof cell.code === 'string' &&
          (cell.code.startsWith('cells/') || cell.code.endsWith('.js'))) {
        return true;
      }
      // 或者code是包含fileRef的对象
      if (cell.code && typeof cell.code === 'object' && cell.code.fileRef) {
        return true;
      }
      return false;
    }

    /**
     * 导出所有代码（用于备份）
     */
    exportAll() {
      const result = {};
      for (const [cellId, code] of this._fileCache) {
        result[cellId] = {
          code,
          fileRef: this._generateFileRef(cellId)
        };
      }
      return result;
    }

    /**
     * 清理缓存
     */
    clearCache(cellId) {
      if (cellId) {
        this._fileCache.delete(cellId);
      } else {
        this._fileCache.clear();
      }
    }
  }

  // 暴露到全局
  global.FileMapper = FileMapper;

})(typeof window !== 'undefined' ? window : this);
