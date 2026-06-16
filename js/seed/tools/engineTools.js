/**
 * 引擎工具注册表 (engineTools.js)
 *
 * AI 操作员与基圆引擎之间的桥梁。
 * 把自然语言描述的操作变成对 CellCore / AiBridge / Sandbox 的实际调用。
 *
 * 使用方式：
 *   EngineTools.init(CellCore, AiBridge, Sandbox, PersistLayer);
 *   const result = EngineTools.dispatch({ name: 'create_cell', params: { kind: 'plant', x: 0, y: 0 } });
 */

(function (global) {
  'use strict';

  const EngineTools = (function () {
    let _cellCore = null;
    let _aiBridge = null;
    let _sandbox = null;
    let _persistLayer = null;
    let _initialized = false;

    // ===== 工具定义表 =====
    // 每个工具包含: description(给人看), usage(给 LLM 看的字符串签名), fn(params) 实现
    const _tools = {
      get_world_state: {
        description: '获取当前世界的摘要：基圆总数、分类数量、游戏时间等',
        usage: 'get_world_state()',
        fn: function (params) {
          if (!_cellCore) return { ok: false, error: 'CellCore 未初始化' };
          const cells = _cellCore.getAllCells();
          const kinds = {};
          for (let i = 0; i < cells.length; i++) {
            const k = cells[i].kind || 'unknown';
            kinds[k] = (kinds[k] || 0) + 1;
          }

          // 尝试获取时间系统（可能挂在 DevConsole / GameLoop）
          let timeInfo = null;
          if (global.DevConsole && typeof global.DevConsole.getGameTime === 'function') {
            try {
              timeInfo = global.DevConsole.getGameTime();
            } catch (e) { /* 忽略 */ }
          }

          // 尝试获取提供者状态
          let providers = null;
          if (_aiBridge && typeof _aiBridge.getProviderStats === 'function') {
            try { providers = _aiBridge.getProviderStats(); } catch (e) { /* 忽略 */ }
          }

          return {
            ok: true,
            totalCells: cells.length,
            byKind: kinds,
            gameTime: timeInfo,
            fps: (function () {
              const el = document.getElementById('fpsDisplay');
              return el && el.textContent ? el.textContent : null;
            })(),
            aiProviders: providers
          };
        }
      },

      list_cells: {
        description: '列出/查询基圆（可选按 kind 过滤）',
        usage: 'list_cells({ kind, limit, offset })',
        fn: function (params) {
          if (!_cellCore) return { ok: false, error: 'CellCore 未初始化' };
          const p = params || {};
          let cells = _cellCore.getAllCells();
          if (p.kind) {
            cells = cells.filter(function (c) { return c.kind === p.kind; });
          }
          const total = cells.length;
          const limit = typeof p.limit === 'number' ? Math.min(p.limit, 50) : Math.min(total, 50);
          const offset = typeof p.offset === 'number' ? p.offset : 0;
          const slice = cells.slice(offset, offset + limit);
          const items = slice.map(function (c) {
            return {
              id: c.id,
              name: c.name,
              kind: c.kind,
              x: (typeof c.x === 'number') ? Math.round(c.x) : null,
              y: (typeof c.y === 'number') ? Math.round(c.y) : null,
              radius: c.radius,
              color: c.color,
              hasCode: !!(typeof c.code === 'string' && c.code.length > 0),
              triggerMode: (c.triggerConfig && c.triggerConfig.mode) || null
            };
          });
          return {
            ok: true,
            total: total,
            returned: items.length,
            cells: items
          };
        }
      },

      create_cell: {
        description: '创建一个基圆',
        usage: 'create_cell({ kind, x, y, name, radius, color, attributes })',
        fn: function (params) {
          if (!_cellCore) return { ok: false, error: 'CellCore 未初始化' };
          const p = params || {};
          const kind = p.kind || 'empty';
          const x = typeof p.x === 'number' ? p.x : (Math.random() - 0.5) * 200;
          const y = typeof p.y === 'number' ? p.y : (Math.random() - 0.5) * 200;

          const cell = _cellCore.createCell(kind, x, y);
          if (!cell) return { ok: false, error: '创建失败' };

          const updates = {};
          if (typeof p.name === 'string' && p.name.length > 0) updates.name = p.name;
          if (typeof p.radius === 'number') updates.radius = p.radius;
          if (typeof p.color === 'string' && p.color.length > 0) updates.color = p.color;
          if (typeof p.shape === 'string' && p.shape.length > 0) updates.shape = p.shape;
          if (typeof p.opacity === 'number') updates.opacity = p.opacity;

          let applied = false;
          if (Object.keys(updates).length > 0) {
            _cellCore.updateCell(cell.id, updates);
            applied = true;
          }

          // attributes（扩展属性，需要单独 setAttribute 调用）
          const attrs = p.attributes;
          let setAttr = 0;
          if (attrs && typeof attrs === 'object') {
            const keys = Object.keys(attrs);
            for (let i = 0; i < keys.length; i++) {
              try {
                _cellCore.setAttribute(cell.id, keys[i], attrs[keys[i]]);
                setAttr++;
              } catch (e) { /* 忽略单项错误 */ }
            }
          }

          return {
            ok: true,
            cell: {
              id: cell.id,
              kind: cell.kind,
              name: cell.name,
              x: Math.round(cell.x),
              y: Math.round(cell.y),
              radius: cell.radius
            },
            appliedPropertyUpdates: applied,
            attributesSet: setAttr
          };
        }
      },

      update_cell: {
        description: '修改基圆的属性（name / radius / color 等）',
        usage: 'update_cell(id, { name, radius, color, shape, opacity })',
        fn: function (params) {
          if (!_cellCore) return { ok: false, error: 'CellCore 未初始化' };
          const p = params || {};
          const id = p.id;
          if (!id) return { ok: false, error: '缺少参数 id' };
          const cell = _cellCore.getCell(id);
          if (!cell) return { ok: false, error: '未找到基圆 id=' + id };

          const props = {};
          ['name', 'radius', 'color', 'shape', 'opacity'].forEach(function (k) {
            if (p[k] !== undefined && p[k] !== null) props[k] = p[k];
          });
          if (Object.keys(props).length === 0) {
            return { ok: true, cell: { id: id, name: cell.name }, appliedCount: 0 };
          }
          _cellCore.updateCell(id, props);
          return { ok: true, cell: { id: id, name: cell.name }, appliedCount: Object.keys(props).length, applied: props };
        }
      },

      delete_cell: {
        description: '删除基圆。可以按 id / kind 或 all:true 清空整个世界',
        usage: 'delete_cell({ id, kind, all })',
        fn: function (params) {
          if (!_cellCore) return { ok: false, error: 'CellCore 未初始化' };
          const p = params || {};
          if (p.id) {
            const existed = _cellCore.getCell(p.id) !== null;
            if (!existed) return { ok: false, error: '未找到基圆 id=' + p.id };
            _cellCore.destroyCell(p.id);
            return { ok: true, removed: 1, by: 'id' };
          }
          if (p.kind) {
            const all = _cellCore.getAllCells();
            const targets = all.filter(function (c) { return c.kind === p.kind; });
            for (let i = 0; i < targets.length; i++) _cellCore.destroyCell(targets[i].id);
            return { ok: true, removed: targets.length, by: 'kind', kind: p.kind };
          }
          if (p.all) {
            const all = _cellCore.getAllCells();
            for (let i = 0; i < all.length; i++) _cellCore.destroyCell(all[i].id);
            return { ok: true, removed: all.length, by: 'all' };
          }
          return { ok: false, error: 'delete_cell 需要提供 id / kind / all:true 之一' };
        }
      },

      set_time_speed: {
        description: '设置游戏时间流速（0=暂停，1=正常，5=五倍速，最高10）',
        usage: 'set_time_speed(speed)',
        fn: function (params) {
          const p = params || {};
          const speed = typeof p.speed === 'number' ? p.speed : 1;
          const fn = global.DevConsole && typeof global.DevConsole.setTimeSpeed === 'function'
            ? global.DevConsole.setTimeSpeed
            : null;
          if (!fn) return { ok: false, error: '时间系统未加载' };
          fn(speed);
          return { ok: true, speed: speed };
        }
      },

      generate_code_for: {
        description: '为指定基圆生成行为代码并加载',
        usage: 'generate_code_for({ cellId, description })',
        fn: async function (params) {
          if (!_aiBridge) return { ok: false, error: 'AiBridge 未初始化' };
          const p = params || {};
          const cellId = p.cellId || p.cell_id || p.id;
          const description = p.description || p.desc || '';
          if (!cellId) return { ok: false, error: '缺少参数 cellId' };
          if (!description) return { ok: false, error: '缺少代码生成描述 description' };

          try {
            const code = await _aiBridge.generateCode(cellId, description);
            _aiBridge.confirmAndLoadCode(cellId, typeof code === 'string' ? code : (code && code.code ? code.code : ''), {});
            return { ok: true, cellId: cellId, description: description, codeLoaded: true };
          } catch (e) {
            return { ok: false, error: e.message || '代码生成失败' };
          }
        }
      },

      list_providers: {
        description: '列出所有已配置的 AI 提供者（模型）及状态',
        usage: 'list_providers()',
        fn: function (params) {
          if (!_aiBridge) return { ok: false, error: 'AiBridge 未初始化' };
          let stats = null;
          if (typeof _aiBridge.getProviderStats === 'function') {
            try { stats = _aiBridge.getProviderStats(); } catch (e) { /* 忽略 */ }
          }
          if (!stats && typeof _aiBridge.getProviders === 'function') {
            try { stats = _aiBridge.getProviders(); } catch (e) { /* 忽略 */ }
          }
          return {
            ok: true,
            totalCount: (stats && stats.length) || 0,
            enabledCount: stats ? stats.filter(function (x) { return x.enabled && x.hasKey; }).length : 0,
            providers: stats
          };
        }
      },

      test_providers: {
        description: '对每个已启用的 AI 提供者测速 ping',
        usage: 'test_providers()',
        fn: async function (params) {
          if (!_aiBridge || typeof _aiBridge.benchmarkProviders !== 'function') {
            return { ok: false, error: 'AiBridge 未初始化或不支持测速' };
          }
          try {
            const results = await _aiBridge.benchmarkProviders({});
            return { ok: true, results: results };
          } catch (err) {
            return { ok: false, error: err.message || String(err) };
          }
        }
      },

      emit_event: {
        description: '向引擎发射一个事件',
        usage: 'emit_event({ eventName, data })',
        fn: function (params) {
          if (!_cellCore) return { ok: false, error: 'CellCore 未初始化' };
          const p = params || {};
          const eventName = p.eventName || p.name;
          if (!eventName) return { ok: false, error: '缺少参数 eventName' };
          _cellCore.emit(eventName, p.data || {});
          return { ok: true, eventName: eventName, data: p.data || null };
        }
      },

      // ========== 语义化物种工具 ==========

      create_ant: {
        description: '创建一只蚂蚁（自动加载行为代码：觅食+躲避+移动）',
        usage: 'create_ant({ species, role, x, y, name, colonyId })',
        fn: function (params) {
          if (!_cellCore || !_sandbox) return { ok: false, error: 'CellCore/Sandbox 未初始化' };
          const p = params || {};
          const roleKey = p.role || 'worker';

          const registry = window.SpeciesRegistry;
          if (!registry || !registry.getAntBehaviorCode) {
            return { ok: false, error: 'SpeciesRegistry 未加载' };
          }

          // 构建中文名→key 反向查找
          const ants = registry.getAllAnts ? registry.getAllAnts() : {};
          const nameToKey = {};
          Object.keys(ants).forEach(function (k) {
            if (ants[k].name) nameToKey[ants[k].name] = k;
          });

          let speciesKey = p.species || 'lasius_niger';
          if (!ants[speciesKey] && nameToKey[speciesKey]) speciesKey = nameToKey[speciesKey];

          const sp = ants[speciesKey];
          if (!sp) return { ok: false, error: '未知蚂蚁物种: ' + speciesKey + '（可用：' + Object.keys(ants).join(', ') + '）' };

          const role = sp.roles && sp.roles[roleKey] ? sp.roles[roleKey] : null;
          if (!role) return { ok: false, error: '未知角色: ' + roleKey + '（可用：' + Object.keys(sp.roles).join(', ') + '）' };

          const behaviorCode = registry.getAntBehaviorCode(speciesKey, roleKey);
          if (!behaviorCode) return { ok: false, error: '无法加载蚂蚁行为代码' };

          const x = typeof p.x === 'number' ? p.x : (Math.random() - 0.5) * 200;
          const y = typeof p.y === 'number' ? p.y : (Math.random() - 0.5) * 200;
          const colonyId = p.colonyId || 'A';

          // 丰富属性（用于属性面板中的"第二页：物种科普"）
          const antAttrs = (typeof registry.buildAntAttributes === 'function')
            ? registry.buildAntAttributes(speciesKey, roleKey, { colonyId: colonyId, generation: 1 })
            : {};
          // 额外字段（兼容 getAntRoles/getSpeciesDescription 的调用）
          antAttrs.species = speciesKey;
          antAttrs.antId = antAttrs.antId || 'ant_' + Math.floor(Math.random() * 1e9).toString(36);
          antAttrs.antRole = roleKey;
          antAttrs.category = 'ant';
          antAttrs.colonyId = colonyId;

          const cell = _cellCore.createCell('creature', x, y);
          if (!cell) return { ok: false, error: '创建失败' };

          // 将代码写入基圆（让代码页可查看）并指定 continuous 模式作为默认
          const updates = {
            name: (typeof p.name === 'string' && p.name.length > 0) ? p.name : sp.name + '·' + role.name,
            color: role.color || sp.color,
            radius: sp.size * role.sizeMul,
            code: behaviorCode,
            codeMode: 'continuous',
            attributes: antAttrs,
            description: (sp.description || '') + '\n[物种ID] ' + speciesKey
          };
          _cellCore.updateCell(cell.id, updates);

          // 沙箱实际执行
          _sandbox.loadBehaviorCode(cell.id, behaviorCode, 'continuous');

          return {
            ok: true,
            cell: { id: cell.id, kind: cell.kind, x: Math.round(x), y: Math.round(y), species: speciesKey, role: roleKey, colonyId: colonyId },
            description: (typeof registry.getSpeciesDescription === 'function') ? registry.getSpeciesDescription(speciesKey, 'ant') : sp.name
          };
        }
      },

      create_queen: {
        description: '创建一只蚁后（自动加载探索→建巢→产蚁的完整行为代码，视口会跟随到蚁后位置）。蚁后会寻找安全区域建巢，按食物存量产下工蚁和兵蚁。',
        usage: 'create_queen({ species, x, y, colonyId })',
        fn: function (params) {
          if (!_cellCore || !_sandbox) return { ok: false, error: 'CellCore/Sandbox 未初始化' };
          const p = params || {};

          const registry = window.SpeciesRegistry;
          if (!registry || !registry.getAntBehaviorCode) {
            return { ok: false, error: 'SpeciesRegistry 未加载' };
          }

          const ants = registry.getAllAnts ? registry.getAllAnts() : {};

          let speciesKey = p.species || 'lasius_niger';
          if (!ants[speciesKey]) {
            const nameToKey = {};
            Object.keys(ants).forEach(function (k) {
              if (ants[k].name) nameToKey[ants[k].name] = k;
            });
            if (nameToKey[speciesKey]) speciesKey = nameToKey[speciesKey];
          }

          const sp = ants[speciesKey];
          if (!sp) return { ok: false, error: '未知蚂蚁物种: ' + speciesKey };

          const queenRole = sp.roles && sp.roles.queen ? sp.roles.queen : null;
          if (!queenRole) {
            const availableSpecies = Object.keys(ants).filter(function (k) {
              return ants[k].roles && ants[k].roles.queen;
            });
            return { ok: false, error: speciesKey + ' 没有蚁后角色，可选: ' + availableSpecies.join(', ') };
          }

          const behaviorCode = registry.getAntBehaviorCode(speciesKey, 'queen');
          if (!behaviorCode) return { ok: false, error: '无法加载蚁后行为代码' };

          let qx = typeof p.x === 'number' ? p.x : 0;
          let qy = typeof p.y === 'number' ? p.y : 0;
          if (typeof p.x !== 'number' && typeof p.y !== 'number') {
            qx = (Math.random() - 0.5) * 40;
            qy = (Math.random() - 0.5) * 40;
          }
          const colonyId = p.colonyId || 'A';

          const cell = _cellCore.createCell('creature', qx, qy);
          if (!cell) return { ok: false, error: '创建失败' };

          const antAttrs = (typeof registry.buildAntAttributes === 'function')
            ? registry.buildAntAttributes(speciesKey, 'queen', { colonyId: colonyId, generation: 0 })
            : {};
          antAttrs.species = speciesKey;
          antAttrs.antId = antAttrs.antId || 'queen_' + colonyId + '_' + Math.floor(Math.random() * 1e9).toString(36);
          antAttrs.antRole = 'queen';
          antAttrs.category = 'ant';
          antAttrs.colonyId = colonyId;
          antAttrs.queenId = true;
          antAttrs.queenState = antAttrs.queenState || 'explore';
          antAttrs.isQueen = true;
          antAttrs.speed = antAttrs.speed || 0.5;
          antAttrs.energy = antAttrs.energy || 150;
          antAttrs.maxEnergy = antAttrs.maxEnergy || 300;
          antAttrs.hp = antAttrs.hp || 50;
          antAttrs.maxHp = antAttrs.maxHp || 50;
          antAttrs.direction = Math.random() * Math.PI * 2;
          antAttrs.layTimer = 0;
          antAttrs.digestTimer = 0;
          antAttrs.buildTimer = 0;
          antAttrs.exploreTimer = 0;
          antAttrs.nestX = qx;
          antAttrs.nestY = qy;
          // 蚁后自身不参与碰撞推挤，避免被推到巢穴边缘或被工蚁撞飞
          antAttrs.softRadius = 0;

          _cellCore.updateCell(cell.id, {
            name: '蚁后（' + (sp.name || speciesKey) + '）',
            color: queenRole.color || '#5c3a0a',
            radius: (sp.size || 5) * (queenRole.sizeMul || 1.6),
            code: behaviorCode,
            codeMode: 'continuous',
            attributes: antAttrs
          });

          // 关键修复：必须设置 triggerConfig.mode = 'continuous'
          // 否则 gameLoop.getContinuousCells() 不会返回此基圆，代码永远不会执行
          if (typeof _cellCore.setTriggerMode === 'function') {
            _cellCore.setTriggerMode(cell.id, 'continuous');
          } else {
            const rawCell = _cellCore.getCell(cell.id);
            if (rawCell && rawCell.triggerConfig) {
              rawCell.triggerConfig.mode = 'continuous';
            }
          }

          _sandbox.loadBehaviorCode(cell.id, behaviorCode, 'continuous');

          if (typeof window.RenderBridge !== 'undefined' &&
              typeof window.RenderBridge.setCamera === 'function') {
            window.RenderBridge.setCamera({ x: qx, y: qy });
          }

          return {
            ok: true,
            cell: { id: cell.id, kind: cell.kind, x: Math.round(qx), y: Math.round(qy), species: speciesKey, role: 'queen', colonyId: colonyId },
            message: '🐜 已创建一只蚁后（' + (sp.name || speciesKey) + '）！\n' +
                     '位置: (' + Math.round(qx) + ', ' + Math.round(qy) + ')\n' +
                     '视口已跟随。蚁后将：\n' +
                     '  阶段1：探索（寻找敌人少+植物多的区域）\n' +
                     '  阶段2：消化（停留消耗能量准备建巢）\n' +
                     '  阶段3：建造蚁巢（静态基圆）\n' +
                     '  阶段4：安居蚁巢，按 foodStorage 产工蚁/兵蚁\n\n' +
                     '💡 提示：先建一张地图（沙漠/草原/雨林），再创建蚁后。\n' +
                     '⚠️ 天敌昆虫会避开蚁巢范围（60px内不进入），\n' +
                     '   但蚁后在建巢前暴露在外，可能被攻击！'
          };
        }
      },

      create_plant: {
        description: '创建一株植物',
        usage: 'create_plant({ species, x, y, name })',
        fn: function (params) {
          if (!_cellCore || !_sandbox) return { ok: false, error: 'CellCore/Sandbox 未初始化' };
          const p = params || {};

          const registry = window.SpeciesRegistry;
          if (!registry || !registry.getPlantBehaviorCode) {
            return { ok: false, error: 'SpeciesRegistry 未加载' };
          }

          const plants = registry.getAllPlants ? registry.getAllPlants() : {};
          const nameToKey = {};
          Object.keys(plants).forEach(function (k) {
            if (plants[k].name) nameToKey[plants[k].name] = k;
          });

          let speciesKey = p.species || 'grass_green';
          if (!plants[speciesKey] && nameToKey[speciesKey]) speciesKey = nameToKey[speciesKey];

          const behaviorCode = registry.getPlantBehaviorCode(speciesKey);
          if (!behaviorCode) return { ok: false, error: '未知植物物种: ' + speciesKey + '（可用：' + Object.keys(plants).join(', ') + '）' };

          const x = typeof p.x === 'number' ? p.x : (Math.random() - 0.5) * 200;
          const y = typeof p.y === 'number' ? p.y : (Math.random() - 0.5) * 200;

          const cell = _cellCore.createCell('plant', x, y);
          if (!cell) return { ok: false, error: '创建失败' };

          if (typeof p.name === 'string' && p.name.length > 0) {
            _cellCore.updateCell(cell.id, { name: p.name });
          }

          _cellCore.setAttribute(cell.id, 'species', speciesKey);
          _cellCore.setAttribute(cell.id, 'category', 'plant');

          // 植物需要 pulse 模式才能执行定时逻辑（生长、散播种子）
          if (typeof _cellCore.setTriggerMode === 'function') {
            _cellCore.setTriggerMode(cell.id, 'pulse');
          } else {
            const rawCell = _cellCore.getCell(cell.id);
            if (rawCell && rawCell.triggerConfig) {
              rawCell.triggerConfig.mode = 'pulse';
            }
          }
          _sandbox.loadBehaviorCode(cell.id, behaviorCode, 'pulse');

          return {
            ok: true,
            cell: { id: cell.id, kind: cell.kind, x: Math.round(x), y: Math.round(y), species: speciesKey },
            description: registry.getSpeciesDescription ? registry.getSpeciesDescription(speciesKey, 'plant') : speciesKey
          };
        }
      },

      create_insect: {
        description: '创建一只昆虫',
        usage: 'create_insect({ species, x, y, name })',
        fn: function (params) {
          if (!_cellCore || !_sandbox) return { ok: false, error: 'CellCore/Sandbox 未初始化' };
          const p = params || {};

          const registry = window.SpeciesRegistry;
          if (!registry || !registry.getInsectBehaviorCode) {
            return { ok: false, error: 'SpeciesRegistry 未加载' };
          }

          // 构建中文名→key 的反向查找表
          const insects = registry.getAllInsects ? registry.getAllInsects() : {};
          const nameToKey = {};
          Object.keys(insects).forEach(function (k) {
            const sp = insects[k];
            if (sp.name) nameToKey[sp.name] = k;
          });

          // 解析 species：优先当 key 用，否则反向查找中文名
          let speciesKey = p.species || 'ladybug';
          if (!insects[speciesKey]) {
            // 尝试用中文名查找
            const foundKey = nameToKey[speciesKey];
            if (foundKey) speciesKey = foundKey;
          }

          const behaviorCode = registry.getInsectBehaviorCode(speciesKey);
          if (!behaviorCode) return { ok: false, error: '未知昆虫物种: ' + speciesKey + '（可用：' + Object.keys(insects).join(', ') + '）' };

          const x = typeof p.x === 'number' ? p.x : (Math.random() - 0.5) * 200;
          const y = typeof p.y === 'number' ? p.y : (Math.random() - 0.5) * 200;

          const cell = _cellCore.createCell('insect', x, y);
          if (!cell) return { ok: false, error: '创建失败' };

          if (typeof p.name === 'string' && p.name.length > 0) {
            _cellCore.updateCell(cell.id, { name: p.name });
          }

          _cellCore.setAttribute(cell.id, 'species', speciesKey);
          _cellCore.setAttribute(cell.id, 'category', 'insect');

          _sandbox.loadBehaviorCode(cell.id, behaviorCode, 'event');

          return {
            ok: true,
            cell: { id: cell.id, kind: cell.kind, x: Math.round(x), y: Math.round(y), species: speciesKey },
            description: registry.getSpeciesDescription ? registry.getSpeciesDescription(speciesKey, 'insect') : speciesKey
          };
        }
      },

      list_creatures: {
        description: '查询所有生物（蚂蚁/植物/昆虫），可按种类过滤',
        usage: 'list_creatures({ category, species, limit, offset })',
        fn: function (params) {
          if (!_cellCore) return { ok: false, error: 'CellCore 未初始化' };
          const p = params || {};
          let cells = _cellCore.getAllCells();

          // 过滤出有 category 属性的基圆
          cells = cells.filter(function (c) {
            return c.attributes && c.attributes.category;
          });

          if (p.category) {
            cells = cells.filter(function (c) { return c.attributes.category === p.category; });
          }
          if (p.species) {
            cells = cells.filter(function (c) { return c.attributes.species === p.species; });
          }

          const total = cells.length;
          const limit = typeof p.limit === 'number' ? Math.min(p.limit, 50) : Math.min(total, 50);
          const offset = typeof p.offset === 'number' ? p.offset : 0;
          const slice = cells.slice(offset, offset + limit);

          const items = slice.map(function (c) {
            return {
              id: c.id,
              name: c.name,
              category: c.attributes.category,
              species: c.attributes.species,
              antRole: c.attributes.antRole || null,
              x: Math.round(c.x),
              y: Math.round(c.y),
              radius: c.radius,
              color: c.color,
              hasCode: !!(typeof c.code === 'string' && c.code.length > 0)
            };
          });

          return { ok: true, total: total, returned: items.length, creatures: items };
        }
      },

      get_species_list: {
        description: '列出所有可用的物种（按 category）',
        usage: 'get_species_list({ category })',
        fn: function (params) {
          const registry = window.SpeciesRegistry;
          if (!registry) return { ok: false, error: 'SpeciesRegistry 未加载' };
          const p = params || {};
          const rawCat = p.category;
          // 支持中文类别名
          const catMap = { '蚂蚁': 'ant', '蚁': 'ant', '植物': 'plant', '草': 'plant', '昆虫': 'insect', '虫': 'insect', '场景': 'scene' };
          const category = catMap[rawCat] || rawCat;
          const result = {};

          if (!category || category === 'ant') {
            const ants = registry.getAllAnts ? registry.getAllAnts() : {};
            result.ant = Object.keys(ants).map(function (k) {
              const sp = ants[k];
              return {
                key: k,
                name: sp.name || k,
                roles: sp.roles ? Object.keys(sp.roles) : []
              };
            });
          }
          if (!category || category === 'plant') {
            const plants = registry.getAllPlants ? registry.getAllPlants() : {};
            result.plant = Object.keys(plants).map(function (k) {
              const sp = plants[k];
              return { key: k, name: sp.name || k };
            });
          }
          if (!category || category === 'insect') {
            const insects = registry.getAllInsects ? registry.getAllInsects() : {};
            result.insect = Object.keys(insects).map(function (k) {
              const sp = insects[k];
              return { key: k, name: sp.name || k };
            });
          }

          return { ok: true, species: result };
        }
      },

      create_map_scene: {
        description: '根据自然语言描述创建或切换地图场景（清空世界并生成地形、植物、昆虫等）',
        usage: 'create_map_scene({ description, preset, clearWorld, density })',
        fn: function (params) {
          const p = params || {};
          const registry = window.SpeciesRegistry;
          if (!registry || !registry.getMapPresets) {
            return { ok: false, error: 'SpeciesRegistry 未加载' };
          }

          const presets = registry.getMapPresets();
          let presetKey = p.preset || '';
          const desc = (p.description || '').toLowerCase();

          // 通过自然语言描述智能匹配 preset
          if (!presetKey && desc) {
            const aliases = {
              '沙漠': 'desert', '戈壁': 'desert', '干旱': 'desert', '沙地': 'desert',
              '草原': 'grassland', '草地': 'grassland', '温带': 'grassland',
              '森林': 'deciduous', '落叶林': 'deciduous', '阔叶林': 'deciduous', '树林': 'deciduous',
              '雨林': 'rainforest', '热带雨林': 'rainforest', '热带': 'rainforest',
              '随机': Object.keys(presets)[Math.floor(Math.random() * Object.keys(presets).length)]
            };
            for (const [keyword, key] of Object.entries(aliases)) {
              if (desc.includes(keyword)) { presetKey = key; break; }
            }
          }

          // 尝试精确匹配 preset key
          if (!presetKey || !presets[presetKey]) {
            const available = Object.keys(presets).join(', ');
            return { ok: false, error: '未找到匹配地图，可用: ' + available };
          }

          const result = registry.buildMapScene(presetKey, {
            clearWorld: p.clearWorld !== false,
            density: typeof p.density === 'number' ? p.density : 1.0
          });

          if (result.error) return { ok: false, error: result.error };

          // 更新画布背景色
          const preset = presets[presetKey];
          const canvas = document.getElementById('gameCanvas');
          if (canvas) canvas.style.background = preset.backgroundColor;
          document.body.style.background = preset.backgroundColor;

          return {
            ok: true,
            preset: presetKey,
            name: preset.name,
            background: preset.backgroundColor,
            nests: result.nests || 0,
            ants: result.ants || 0,
            summary: '创建了 ' + result.total + ' 个实体（植物 ' + result.plants + ' / 昆虫 ' + result.insects + ' / 地物 ' + (result.rocks + result.waters) + (result.nests ? ' / 蚁巢 ' + result.nests : '') + (result.ants ? ' / 蚂蚁 ' + result.ants : '') + '）'
          };
        }
      },

      create_nest: {
        description: '创建一个蚁巢（作为整个蚁群的核心），可指定位置和名称',
        usage: 'create_nest({ x, y, name, colonyId })',
        fn: function (params) {
          if (!_cellCore) return { ok: false, error: 'CellCore 未初始化' };
          const p = params || {};
          const registry = window.SpeciesRegistry;

          const nestCode = (registry && typeof registry.getSceneObjectBehaviorCode === 'function')
            ? registry.getSceneObjectBehaviorCode('nest')
            : '';

          const x = typeof p.x === 'number' ? p.x : 0;
          const y = typeof p.y === 'number' ? p.y : 0;

          const cell = _cellCore.createCell('static', x, y);
          if (!cell) return { ok: false, error: '创建失败' };

          _cellCore.updateCell(cell.id, {
            name: p.name || '蚁巢',
            color: '#8b5a2b',
            radius: 40,
            shape: 'circle',
            code: nestCode,
            codeMode: 'continuous',
            attributes: {
              type: 'nest',
              sceneType: 'nest',
              isNest: true,
              colonyId: p.colonyId || 'A',
              foodStorage: 0,
              population: 0
            }
          });

          if (_sandbox && typeof _sandbox.loadBehaviorCode === 'function') {
            try { _sandbox.loadBehaviorCode(cell.id, nestCode, 'continuous'); } catch (e) { /* 忽略 */ }
          }

          return {
            ok: true,
            cell: { id: cell.id, kind: cell.kind, x: Math.round(x), y: Math.round(y), colonyId: p.colonyId || 'A' }
          };
        }
      }

    };

    // ===== 初始化 =====
    function init(cellCore, aiBridge, sandbox, persistLayer) {
      _cellCore = cellCore || (typeof global.CellCore !== 'undefined' ? global.CellCore : null);
      _aiBridge = aiBridge || (typeof global.AiBridge !== 'undefined' ? global.AiBridge : null);
      _sandbox = sandbox || (typeof global.Sandbox !== 'undefined' ? global.Sandbox : null);
      _persistLayer = persistLayer || (typeof global.PersistLayer !== 'undefined' ? global.PersistLayer : null);
      _initialized = true;
      return true;
    }

    function isReady() {
      return _initialized && !!_cellCore;
    }

    // ===== 列出所有工具（供 UI 或 LLM 参考） =====
    function listTools() {
      const names = Object.keys(_tools);
      return names.map(function (n) {
        return {
          name: n,
          usage: _tools[n].usage,
          description: _tools[n].description
        };
      });
    }

    // ===== 解析 __TOOL_CALL__ 标记 =====
    // 支持两种写法：
    //   __TOOL_CALL__[{"name":"...","params":{...}}]        （推荐）
    //   __TOOL_CALL__ [ { "name": "...", "params": {...} } ] （允许空格/换行）
    // 返回数组 [{ name, params }]；没有标记时返回 null
    function parseToolCalls(rawText) {
      if (typeof rawText !== 'string') return null;
      const idx = rawText.indexOf('__TOOL_CALL__');
      if (idx === -1) return null;

      // 找到第一个 '['（跳过空格/换行）
      let start = idx + '__TOOL_CALL__'.length;
      while (start < rawText.length && /\s/.test(rawText.charAt(start))) start++;
      if (start >= rawText.length || rawText.charAt(start) !== '[') return null;

      // 找到匹配的 ']'（从 start 起）
      let depth = 0;
      let end = -1;
      let inString = false;
      let stringChar = '';
      for (let i = start; i < rawText.length; i++) {
        const ch = rawText.charAt(i);
        if (inString) {
          if (ch === stringChar && rawText.charAt(i - 1) !== '\\') inString = false;
          continue;
        }
        if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
        if (ch === '[') depth++;
        else if (ch === ']') {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      if (end === -1) return null;

      const jsonStr = rawText.substring(start, end + 1);
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') return [parsed];
        return null;
      } catch (e) {
        return null;
      }
    }

    // ===== 执行单个工具调用 =====
    // 调用 { name, params }，返回 { ok, ... } 或 Promise<{ ok, ... }>
    function callOne(call) {
      if (!call || typeof call.name !== 'string') {
        return { ok: false, error: '无效的调用格式（缺少 name）' };
      }
      const tool = _tools[call.name];
      if (!tool) {
        return { ok: false, error: '未知工具: ' + call.name };
      }
      try {
        const result = tool.fn(call.params || {});
        if (result && typeof result.then === 'function') {
          return result.then(function (r) {
            return { tool: call.name, params: call.params, result: r };
          }).catch(function (err) {
            return { tool: call.name, params: call.params, ok: false, error: err && err.message ? err.message : String(err) };
          });
        }
        return { tool: call.name, params: call.params, result: result };
      } catch (e) {
        return { tool: call.name, params: call.params, ok: false, error: e.message || String(e) };
      }
    }

    // ===== 执行一组调用（按顺序） =====
    async function dispatchAll(calls) {
      if (!Array.isArray(calls)) calls = [calls];
      const results = [];
      for (let i = 0; i < calls.length; i++) {
        const r = callOne(calls[i]);
        if (r && typeof r.then === 'function') {
          results.push(await r);
        } else {
          results.push(r);
        }
      }
      return results;
    }

    // ===== 对外简化入口 =====
    // dispatch(callOrArray) -> 返回 Promise<Array>；同步调用也包装成 Promise
    function dispatch(calls) {
      return Promise.resolve().then(function () { return dispatchAll(calls); });
    }

    // ===== 简易版本（不返回 Promise） =====
    function dispatchSync(calls) {
      if (!Array.isArray(calls)) calls = [calls];
      const results = [];
      for (let i = 0; i < calls.length; i++) {
        const r = callOne(calls[i]);
        if (r && typeof r.then === 'function') {
          // 异步工具在同步入口里返回 promise 原样
          results.push(r);
        } else {
          results.push(r);
        }
      }
      return results;
    }

    return {
      init: init,
      isReady: isReady,
      listTools: listTools,
      parseToolCalls: parseToolCalls,
      callOne: callOne,
      dispatch: dispatch,
      dispatchSync: dispatchSync
    };
  })();

  // 暴露到全局
  global.EngineTools = EngineTools;

})(typeof window !== 'undefined' ? window : this);
