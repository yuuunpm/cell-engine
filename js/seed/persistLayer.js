/**
 * 持久化层 (persistLayer.js)
 * 使用 IndexedDB 存储游戏数据，包括基圆数据、世界状态、AI提供者配置和用户设置
 * 无依赖，第一个加载
 */

const PersistLayer = (() => {
  const DB_NAME = 'CellEngineDB';
  const DB_VERSION = 2; // v2: 增加 files 对象存储用于 Folder/File 代码模式
  let db = null;
  let _dirtyCells = new Set();
  let _autoSaveTimer = null;
  let _cellCoreRef = null; // 与 CellCore 共享脏位引用
  const AUTO_SAVE_INTERVAL = 30000; // 30秒自动保存

  // 打开/创建数据库
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        // 基圆数据存储
        if (!database.objectStoreNames.contains('cells')) {
          const cellStore = database.createObjectStore('cells', { keyPath: 'id' });
          cellStore.createIndex('kind', 'kind', { unique: false });
          cellStore.createIndex('parentId', 'parentId', { unique: false });
        }
        // 世界快照存储
        if (!database.objectStoreNames.contains('worlds')) {
          const worldStore = database.createObjectStore('worlds', { keyPath: 'id' });
          worldStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        // 设置存储
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'key' });
        }
        // 文件内容存储（用于 Folder / File 代码模式）
        if (!database.objectStoreNames.contains('files')) {
          const fileStore = database.createObjectStore('files', { keyPath: 'path' });
          fileStore.createIndex('cellId', 'cellId', { unique: false });
        }
      };
      request.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };
      request.onerror = (e) => {
        console.error('[PersistLayer] IndexedDB打开失败:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  // 通用事务操作
  function _transaction(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      if (!db) { reject(new Error('数据库未初始化')); return; }
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = callback(store);
      if (result && result.onsuccess !== undefined) {
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error);
      } else {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }
    });
  }

  // ===== 基圆数据操作 =====
  async function saveCell(cellData) {
    return _transaction('cells', 'readwrite', (store) => store.put(cellData));
  }

  async function saveCells(cellsArray) {
    return new Promise((resolve, reject) => {
      if (!db) { reject(new Error('数据库未初始化')); return; }
      const tx = db.transaction('cells', 'readwrite');
      const store = tx.objectStore('cells');
      for (const cell of cellsArray) {
        store.put(cell);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadCell(id) {
    return _transaction('cells', 'readonly', (store) => store.get(id));
  }

  async function loadAllCells() {
    return _transaction('cells', 'readonly', (store) => store.getAll());
  }

  async function deleteCell(id) {
    return _transaction('cells', 'readwrite', (store) => store.delete(id));
  }

  async function queryCellsByKind(kind) {
    return new Promise((resolve, reject) => {
      if (!db) { reject(new Error('数据库未初始化')); return; }
      const tx = db.transaction('cells', 'readonly');
      const store = tx.objectStore('cells');
      const index = store.index('kind');
      const request = index.getAll(kind);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ===== 世界快照操作 =====
  async function saveWorld(worldData) {
    return _transaction('worlds', 'readwrite', (store) => store.put(worldData));
  }

  async function loadWorld(id) {
    return _transaction('worlds', 'readonly', (store) => store.get(id));
  }

  async function loadLatestWorld() {
    return new Promise((resolve, reject) => {
      if (!db) { reject(new Error('数据库未初始化')); return; }
      const tx = db.transaction('worlds', 'readonly');
      const store = tx.objectStore('worlds');
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev');
      let result = null;
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && !result) {
          result = cursor.value;
          resolve(result);
        } else if (!result) {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ===== 设置操作 =====
  async function saveSetting(key, value) {
    return _transaction('settings', 'readwrite', (store) => store.put({ key, value }));
  }

  async function loadSetting(key) {
    const result = await _transaction('settings', 'readonly', (store) => store.get(key));
    return result ? result.value : null;
  }

  async function loadAllSettings() {
    return _transaction('settings', 'readonly', (store) => store.getAll());
  }

  // ===== 文件内容操作（Folder / File 代码模式）=====
  async function saveFile(path, content, cellId) {
    if (!path || typeof content !== 'string') return;
    return _transaction('files', 'readwrite', (store) =>
      store.put({ path, content, cellId: cellId || null, updatedAt: Date.now() })
    );
  }

  async function loadFile(path) {
    if (!path) return null;
    const record = await _transaction('files', 'readonly', (store) => store.get(path));
    return record ? record.content : null;
  }

  async function deleteFile(path) {
    if (!path) return;
    return _transaction('files', 'readwrite', (store) => store.delete(path));
  }

  async function listFilesByCellId(cellId) {
    if (!cellId) return [];
    return new Promise((resolve, reject) => {
      if (!db) { reject(new Error('数据库未初始化')); return; }
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const index = store.index('cellId');
      const request = index.getAll(cellId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ===== API Key 安全存储 =====
  async function saveApiKey(providerId, apiKey) {
    // 使用 IndexedDB 加密存储（简单XOR混淆，非真正加密）
    const encoded = btoa(apiKey.split('').map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ (i % 256))
    ).join(''));
    return saveSetting(`apikey_${providerId}`, encoded);
  }

  async function loadApiKey(providerId) {
    const encoded = await loadSetting(`apikey_${providerId}`);
    if (!encoded) return null;
    try {
      const decoded = atob(encoded);
      return decoded.split('').map((c, i) =>
        String.fromCharCode(c.charCodeAt(0) ^ (i % 256))
      ).join('');
    } catch (e) {
      return null;
    }
  }

  // ===== 自动保存 =====
  // 绑定 CellCore：两套脏位共享，避免"基圆变更未持久化"
  function bindCellCore(cellCore) {
    _cellCoreRef = cellCore;
  }

  function markDirty(cellId) {
    _dirtyCells.add(cellId);
    // 注意：不再反向调用 cellCoreRef.markDirty，避免与 CellCore._markDirty 形成互相调用的死循环
    // CellCore._markDirty 已经在调用本函数，不要再回去
  }

  function _startAutoSave(getCellData) {
    if (_autoSaveTimer) clearInterval(_autoSaveTimer);
    _autoSaveTimer = setInterval(async () => {
      if (_dirtyCells.size === 0) return;
      const dirtyIds = [..._dirtyCells];
      _dirtyCells.clear();
      try {
        const cellsToSave = [];
        for (const id of dirtyIds) {
          const data = getCellData(id);
          if (data) cellsToSave.push(data);
        }
        if (cellsToSave.length > 0) {
          await saveCells(cellsToSave);
          console.log(`[PersistLayer] 自动保存 ${cellsToSave.length} 个基圆`);
        }
      } catch (e) {
        console.error('[PersistLayer] 自动保存失败:', e);
      }
    }, AUTO_SAVE_INTERVAL);
  }

  function _stopAutoSave() {
    if (_autoSaveTimer) {
      clearInterval(_autoSaveTimer);
      _autoSaveTimer = null;
    }
  }

  // ===== 全量快照保存 =====
  async function saveFullSnapshot(getAllCellData, cameraState) {
    try {
      const cells = getAllCellData();
      await saveCells(cells);
      const worldData = {
        id: 'world_' + Date.now(),
        timestamp: Date.now(),
        cameraState,
        cellIds: cells.map(c => c.id)
      };
      await saveWorld(worldData);
      _dirtyCells.clear();
      console.log(`[PersistLayer] 全量快照保存完成，${cells.length} 个基圆`);
    } catch (e) {
      console.error('[PersistLayer] 全量快照保存失败:', e);
    }
  }

  // ===== 预设示例世界数据 =====
  // 默认世界：蚁巢 + 蚁后 + 工蚁 + 兵蚁 + 植物（可作为一键开始游戏的基础数据）
  function getDefaultWorldCells() {
    const now = Date.now();
    const cells = [];
    // ---------- 蚁巢（static，sceneType=nest）----------
    cells.push({
      id: 'nest_A',
      name: '蚁巢',
      kind: 'static',
      x: 0, y: 0,
      radius: 40,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      color: '#8b5a2b',
      shape: 'circle',
      selectable: true,
      visible: true,
      parentId: null,
      childrenIds: [],
      description: '蚁群的家：工蚁存放食物、兵蚁回血的地方。',
      code: '// 蚁巢 — 场景基圆代码（v5.0）\n// 工蚁将食物搬运至此存入 foodStorage；兵蚁受伤后来此回血\n\nif (!api.getProperty("initialized")) {\n  api.setProperty("initialized", true);\n  api.setProperty("name", "蚁巢");\n  api.setProperty("sceneType", "nest");\n  api.setKind("static");\n  api.setColor("#8b5a2b");\n  api.setProperty("isNest", true);\n  api.setProperty("colonyId", "A");\n  api.setProperty("foodStorage", 0);\n  api.setProperty("population", 0);\n}\n\nif (!api.getProperty("_drawRegistered")) {\n  api.setProperty("_drawRegistered", true);\n  api.registerDraw(function (ctx, r) {\n    const shade = (hex, p) => {\n      if (!hex) return "#888";\n      if (hex.length === 4) hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];\n      if (hex.length !== 7) return hex;\n      const n = parseInt(hex.slice(1), 16);\n      let rr = (n >> 16) + p * 2.55, gg = ((n >> 8) & 0xff) + p * 2.55, bb = (n & 0xff) + p * 2.55;\n      rr = Math.max(0, Math.min(255, Math.round(rr)));\n      gg = Math.max(0, Math.min(255, Math.round(gg)));\n      bb = Math.max(0, Math.min(255, Math.round(bb)));\n      return "#" + ((rr << 16) | (gg << 8) | bb).toString(16).padStart(6, "0");\n    };\n    const c = api.getProperty("color") || "#8b5a2b";\n    ctx.save();\n    ctx.fillStyle = shade(c, -35);\n    ctx.beginPath();\n    ctx.ellipse(0, 0, r * 1.05, r * 0.78, 0, 0, Math.PI * 2);\n    ctx.fill();\n    const grad = ctx.createRadialGradient(-r * 0.1, -r * 0.15, r * 0.1, 0, 0, r * 0.92);\n    grad.addColorStop(0, shade(c, 25));\n    grad.addColorStop(0.55, c);\n    grad.addColorStop(1, shade(c, -25));\n    ctx.fillStyle = grad;\n    ctx.beginPath();\n    ctx.ellipse(0, 0, r * 0.92, r * 0.7, 0, 0, Math.PI * 2);\n    ctx.fill();\n    ctx.fillStyle = "#1a0e05";\n    ctx.beginPath();\n    ctx.ellipse(0, -r * 0.05, r * 0.18, r * 0.12, 0, 0, Math.PI * 2);\n    ctx.fill();\n    ctx.fillStyle = "rgba(0,0,0,0.45)";\n    ctx.beginPath();\n    ctx.ellipse(r * 0.04, -r * 0.02, r * 0.08, r * 0.05, 0, 0, Math.PI * 2);\n    ctx.fill();\n    ctx.fillStyle = shade(c, -20);\n    const spk = [[-0.55, -0.15, 1.8], [0.45, -0.1, 1.6], [-0.4, 0.35, 1.6], [0.35, 0.3, 1.4], [-0.15, -0.45, 1.3], [0.18, -0.4, 1.2], [-0.6, 0.15, 1.2], [0.55, 0.1, 1.3], [-0.2, 0.45, 1.3], [0.22, 0.48, 1.2]];\n    for (let i = 0; i < spk.length; i++) {\n      ctx.beginPath();\n      ctx.arc(spk[i][0] * r, spk[i][1] * r, spk[i][2], 0, Math.PI * 2);\n      ctx.fill();\n    }\n    ctx.fillStyle = "rgba(255,235,180,0.35)";\n    ctx.beginPath();\n    ctx.ellipse(-r * 0.18, -r * 0.35, r * 0.3, r * 0.08, -0.2, 0, Math.PI * 2);\n    ctx.fill();\n    const food = api.getProperty("foodStorage") || 0;\n    if (food > 0) {\n      ctx.fillStyle = "#7ac050";\n      ctx.beginPath();\n      ctx.arc(r * 0.55, -r * 0.55, 4, 0, Math.PI * 2);\n      ctx.fill();\n      ctx.strokeStyle = "#2a4a20";\n      ctx.lineWidth = 1;\n      ctx.stroke();\n    }\n    ctx.restore();\n  });\n}\n',
      compiledFn: null,
      attributes: { isNest: true, sceneType: 'nest', colonyId: 'A', foodStorage: 0, population: 0 },
      triggerConfig: { mode: 'event', threshold: 60, accumulator: 0, pulseDecay: 0, eventMask: [], wakeConditions: [] },
      tags: ['nest', 'colony-A'],
      createdAt: now,
      updatedAt: now,
      state: 'normal',
      errorInfo: null
    });
    // ---------- 蚁后（creature，角色 queen，携带觅食循环与产卵行为）----------
    cells.push({
      id: 'queen_A',
      name: '蚁后',
      kind: 'creature',
      x: 0, y: 10,
      radius: 12,
      rotation: 0,
      opacity: 1,
      zIndex: 2,
      color: '#4a2818',
      shape: 'circle',
      selectable: true,
      visible: true,
      parentId: 'nest_A',
      childrenIds: [],
      description: '花园黑蚁蚁后：蚁群的核心，会缓慢繁殖并维持种群数量。',
      code: '// 花园黑蚁 · 蚁后 — 行为代码（v4.0 角色分工）\n// 每 3600 帧（约 60 秒）产一只新工蚁基圆；不会远离巢穴\n\nif (!api.getProperty("initialized")) {\n  api.setProperty("initialized", true);\n  api.setProperty("name", "蚁后");\n  api.setProperty("species", "lasius_niger");\n  api.setProperty("role", "queen");\n  api.setColor("#4a2818");\n  api.setKind("creature");\n  api.setRadius(12);\n  api.setProperty("speed", 0.35);\n  api.setProperty("attackPower", 1);\n  api.setProperty("defense", 0.5);\n  api.setProperty("hp", 80);\n  api.setProperty("maxHp", 80);\n  api.setProperty("energy", 100);\n  api.setProperty("flying", false);\n  api.setProperty("antId", true);\n  api.setProperty("colonyId", "A");\n  api.setProperty("direction", 0);\n  api.setProperty("nestX", api.getX());\n  api.setProperty("nestY", api.getY());\n  api.setProperty("layTimer", 0);\n}\n\n// ---------- 感知：敌人/巢穴 ----------\nconst nearby = api.findAllWithinRadius(api.getX(), api.getY(), 120);\nlet nearestHostile = null;\nlet nestEntity = null;\nfor (let i = 0; i < nearby.length; i++) {\n  const n = nearby[i];\n  const attr = n.attributes || {};\n  if (attr.hostile) nearestHostile = n;\n  else if (attr.antId && attr.colonyId && attr.colonyId !== (api.getProperty("colonyId") || "A")) nearestHostile = nearestHostile || n;\n  else if (attr.isNest && (attr.colonyId || "A") === (api.getProperty("colonyId") || "A")) nestEntity = n;\n}\nlet nestX = api.getProperty("nestX") || api.getX();\nlet nestY = api.getProperty("nestY") || api.getY();\nif (nestEntity) { nestX = nestEntity.x; nestY = nestEntity.y; }\n\n// ---------- 移动：围绕巢穴小幅徘徊，遇到敌人轻微撤退 ----------\nlet dx = 0, dy = 0;\nconst distToNest = Math.hypot(api.getX() - nestX, api.getY() - nestY);\nif (nearestHostile) {\n  dx = api.getX() - nearestHostile.x;\n  dy = api.getY() - nearestHostile.y;\n} else if (distToNest > 60) {\n  dx = nestX - api.getX();\n  dy = nestY - api.getY();\n} else {\n  let dir = api.getProperty("direction") || 0;\n  dir += (Math.random() - 0.5) * 0.05;\n  dx = Math.cos(dir) * 0.3; dy = Math.sin(dir) * 0.3;\n  api.setProperty("direction", dir);\n}\nconst spd = api.getProperty("speed") || 0.35;\nconst dist = Math.sqrt(dx * dx + dy * dy) || 1;\napi.setPosition(api.getX() + (dx / dist) * spd, api.getY() + (dy / dist) * spd);\n\n// ---------- 产卵：每 3600 帧创建一只新工蚁 ----------\nlet layTimer = api.getProperty("layTimer") || 0;\nlayTimer++;\napi.setProperty("layTimer", layTimer);\nif (layTimer >= 3600) {\n  api.setProperty("layTimer", 0);\n  if (window.CellCore && window.CellCore.createCell) {\n    const antX = nestX + (Math.random() - 0.5) * 40;\n    const antY = nestY + (Math.random() - 0.5) * 40;\n    const newAnt = window.CellCore.createCell("creature", antX, antY);\n    if (newAnt) {\n      window.CellCore.updateCell(newAnt.id, { name: "新工蚁", radius: 6, color: "#2a1a0e" });\n      window.CellCore.setAttribute(newAnt.id, "species", "lasius_niger");\n      window.CellCore.setAttribute(newAnt.id, "role", "worker");\n      window.CellCore.setAttribute(newAnt.id, "antId", true);\n      window.CellCore.setAttribute(newAnt.id, "colonyId", "A");\n      window.CellCore.setAttribute(newAnt.id, "nestX", nestX);\n      window.CellCore.setAttribute(newAnt.id, "nestY", nestY);\n      window.CellCore.setAttribute(newAnt.id, "flying", false);\n    }\n  }\n}\n\n// ---------- 饱食度 ----------\nif (api.getFrame() % 600 === 0) {\n  api.setProperty("energy", Math.max(0, (api.getProperty("energy") || 100) - 1));\n}\n',
      compiledFn: null,
      attributes: { species: 'lasius_niger', role: 'queen', antId: true, colonyId: 'A', hp: 80, maxHp: 80, speed: 0.35, energy: 100, flying: false },
      triggerConfig: { mode: 'pulse', threshold: 6, accumulator: 0, pulseDecay: 0, eventMask: ['onUpdate'], wakeConditions: [] },
      tags: ['ant', 'colony-A'],
      createdAt: now,
      updatedAt: now,
      state: 'normal',
      errorInfo: null
    });
    // ---------- 工蚁（6 只）----------
    const workerPositions = [
      { x: -40, y: -30 }, { x: 40, y: -25 }, { x: -50, y: 35 },
      { x: 50, y: 30 }, { x: -20, y: -60 }, { x: 25, y: 65 }
    ];
    for (let i = 0; i < workerPositions.length; i++) {
      const p = workerPositions[i];
      cells.push({
        id: 'worker_A_' + (i + 1),
        name: '工蚁',
        kind: 'creature',
        x: p.x, y: p.y,
        radius: 6,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        color: '#2a1a0e',
        shape: 'circle',
        selectable: true,
        visible: true,
        parentId: 'nest_A',
        childrenIds: [],
        description: '花园黑蚁工蚁：负责寻找并搬运食物回巢。',
        code: '// 花园黑蚁 · 工蚁 — 行为代码（v4.0 角色分工）\n// 觅食循环：idle → foraging → returning → idle\n// 发现植物/草籽后拾取；到达巢穴后将食物加到 nest.foodStorage\n\nif (!api.getProperty("initialized")) {\n  api.setProperty("initialized", true);\n  api.setProperty("name", "工蚁");\n  api.setProperty("species", "lasius_niger");\n  api.setProperty("role", "worker");\n  api.setColor("#2a1a0e");\n  api.setKind("creature");\n  api.setRadius(6);\n  api.setProperty("speed", 0.7);\n  api.setProperty("attackPower", 1);\n  api.setProperty("defense", 0.3);\n  api.setProperty("maxCarry", 15);\n  api.setProperty("hp", 30);\n  api.setProperty("maxHp", 30);\n  api.setProperty("energy", 100);\n  api.setProperty("flying", false);\n  api.setProperty("antId", true);\n  api.setProperty("colonyId", "A");\n  api.setProperty("direction", Math.random() * Math.PI * 2);\n  api.setProperty("state", "idle");\n  api.setProperty("foodCarried", 0);\n  api.setProperty("nestX", 0);\n  api.setProperty("nestY", 0);\n  api.setProperty("layTimer", 0);\n}\n\n// ---------- 感知：敌人/食物/巢穴 ----------\nconst nearby = api.findAllWithinRadius(api.getX(), api.getY(), 120);\nlet nearestFood = null, nearestHostile = null;\nlet nestEntity = null;\nconst myColony = api.getProperty("colonyId") || "A";\nfor (let i = 0; i < nearby.length; i++) {\n  const n = nearby[i];\n  const attr = n.attributes || {};\n  if (attr.hostile) nearestHostile = n;\n  else if (attr.antId && attr.colonyId && attr.colonyId !== myColony) nearestHostile = nearestHostile || n;\n  else if (attr.seedEnergy > 0 || attr.energyValue > 0) nearestFood = nearestFood || n;\n  if (attr.isNest && (attr.colonyId || "A") === myColony) nestEntity = n;\n}\nlet dx = 0, dy = 0;\nconst spd = api.getProperty("speed") || 0.7;\nconst state = api.getProperty("state") || "idle";\nlet nestX = api.getProperty("nestX") || 0;\nlet nestY = api.getProperty("nestY") || 0;\nif (nestEntity) { nestX = nestEntity.x; nestY = nestEntity.y; }\nconst carried = api.getProperty("foodCarried") || 0;\nconst maxCarry = api.getProperty("maxCarry") || 15;\n\n// ---------- 状态切换 ----------\nif (state === "idle") {\n  if ((api.getProperty("energy") || 100) > 60) api.setProperty("state", "foraging");\n} else if (state === "foraging") {\n  if (carried >= maxCarry) api.setProperty("state", "returning");\n} else if (state === "returning") {\n  const distToNest = Math.hypot(api.getX() - nestX, api.getY() - nestY);\n  if (distToNest < 20) {\n    if (carried > 0 && nestEntity && nestEntity.id) {\n      if (window.CellCore && window.CellCore.setAttribute) {\n        const cur = (nestEntity.attributes && nestEntity.attributes.foodStorage) || 0;\n        window.CellCore.setAttribute(nestEntity.id, "foodStorage", cur + carried);\n      }\n      api.setProperty("foodCarried", 0);\n    } else {\n      api.setProperty("foodCarried", 0);\n    }\n    api.setProperty("energy", Math.min(100, (api.getProperty("energy") || 100) + 30));\n    api.setProperty("state", "idle");\n  }\n}\n\n// ---------- 移动/捡拾 ----------\nif (nearestHostile) {\n  dx = api.getX() - nearestHostile.x;\n  dy = api.getY() - nearestHostile.y;\n} else if (api.getProperty("state") === "returning") {\n  dx = nestX - api.getX();\n  dy = nestY - api.getY();\n} else if (nearestFood && carried < maxCarry) {\n  dx = nearestFood.x - api.getX();\n  dy = nearestFood.y - api.getY();\n  const foodDist = Math.hypot(nearestFood.x - api.getX(), nearestFood.y - api.getY());\n  if (foodDist < 15 && api.getFrame() % 120 === 0) {\n    const energy = nearestFood.attributes ? (nearestFood.attributes.seedEnergy || 8) : 8;\n    api.setProperty("foodCarried", carried + energy);\n    if (window.CellCore && nearestFood.attributes && nearestFood.attributes.seedEnergy && nearestFood.id) {\n      // 拾取草籽后销毁草籽基圆\n      if (nearestFood.attributes.seedEnergy) window.CellCore.destroyCell(nearestFood.id);\n    }\n  }\n} else {\n  let dir = api.getProperty("direction") || 0;\n  dir += (Math.random() - 0.5) * 0.2;\n  dx = Math.cos(dir); dy = Math.sin(dir);\n  api.setProperty("direction", dir);\n}\nconst dist = Math.sqrt(dx * dx + dy * dy) || 1;\napi.setPosition(api.getX() + (dx / dist) * spd, api.getY() + (dy / dist) * spd);\n\n// ---------- 饱食度 ----------\nif (api.getFrame() % 600 === 0) {\n  api.setProperty("energy", Math.max(0, (api.getProperty("energy") || 100) - 1));\n}\n',
        compiledFn: null,
        attributes: { species: 'lasius_niger', role: 'worker', antId: true, colonyId: 'A', hp: 30, maxHp: 30, speed: 0.7, energy: 100, flying: false, foodCarried: 0, state: 'idle' },
        triggerConfig: { mode: 'pulse', threshold: 6, accumulator: 0, pulseDecay: 0, eventMask: ['onUpdate'], wakeConditions: [] },
        tags: ['ant', 'colony-A'],
        createdAt: now,
        updatedAt: now,
        state: 'normal',
        errorInfo: null
      });
    }
    // ---------- 兵蚁（2 只）----------
    const soldierPositions = [{ x: -30, y: 0 }, { x: 30, y: 0 }];
    for (let i = 0; i < soldierPositions.length; i++) {
      const p = soldierPositions[i];
      cells.push({
        id: 'soldier_A_' + (i + 1),
        name: '兵蚁',
        kind: 'creature',
        x: p.x, y: p.y,
        radius: 8,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        color: '#1a0e06',
        shape: 'circle',
        selectable: true,
        visible: true,
        parentId: 'nest_A',
        childrenIds: [],
        description: '花园黑蚁兵蚁：主动攻击异群蚂蚁与敌对昆虫，受伤后回巢。',
        code: '// 花园黑蚁 · 兵蚁 — 行为代码（v4.0 角色分工）\n// 主动巡逻并追击敌对目标；hp 低于 30% 时回巢缓慢回血\n\nif (!api.getProperty("initialized")) {\n  api.setProperty("initialized", true);\n  api.setProperty("name", "兵蚁");\n  api.setProperty("species", "lasius_niger");\n  api.setProperty("role", "soldier");\n  api.setColor("#1a0e06");\n  api.setKind("creature");\n  api.setRadius(8);\n  api.setProperty("speed", 0.55);\n  api.setProperty("attackPower", 3);\n  api.setProperty("defense", 0.4);\n  api.setProperty("hp", 50);\n  api.setProperty("maxHp", 50);\n  api.setProperty("energy", 100);\n  api.setProperty("flying", false);\n  api.setProperty("antId", true);\n  api.setProperty("colonyId", "A");\n  api.setProperty("direction", Math.random() * Math.PI * 2);\n  api.setProperty("nestX", 0);\n  api.setProperty("nestY", 0);\n}\n\n// ---------- 感知 ----------\nconst nearby = api.findAllWithinRadius(api.getX(), api.getY(), 150);\nlet nearestHostile = null;\nlet nestEntity = null;\nconst myColony = api.getProperty("colonyId") || "A";\nfor (let i = 0; i < nearby.length; i++) {\n  const n = nearby[i];\n  const attr = n.attributes || {};\n  if (attr.hostile) nearestHostile = nearestHostile || n;\n  else if (attr.antId && attr.colonyId && attr.colonyId !== myColony) nearestHostile = nearestHostile || n;\n  if (attr.isNest && (attr.colonyId || "A") === myColony) nestEntity = n;\n}\nlet nestX = api.getProperty("nestX") || 0;\nlet nestY = api.getProperty("nestY") || 0;\nif (nestEntity) { nestX = nestEntity.x; nestY = nestEntity.y; }\n\n// ---------- 行为：追击 / 回巢回血 / 巡逻 ----------\nlet dx = 0, dy = 0;\nconst spd = api.getProperty("speed") || 0.55;\nconst hp = api.getProperty("hp") || 50;\nconst maxHp = api.getProperty("maxHp") || 50;\n\nif (nearestHostile && hp > maxHp * 0.3) {\n  dx = nearestHostile.x - api.getX();\n  dy = nearestHostile.y - api.getY();\n  const d = Math.sqrt(dx * dx + dy * dy) || 1;\n  if (d < 15 && api.getFrame() % 120 === 0) {\n    const atk = api.getProperty("attackPower") || 3;\n    api.emitCellEvent(nearestHostile.id, "attack", { damage: atk, sourceId: api.getProperty("id") });\n  }\n} else if (hp < maxHp * 0.3) {\n  if (nestEntity) {\n    dx = nestEntity.x - api.getX();\n    dy = nestEntity.y - api.getY();\n    if (Math.hypot(nestEntity.x - api.getX(), nestEntity.y - api.getY()) < 15) {\n      if (api.getFrame() % 60 === 0) {\n        api.setProperty("hp", Math.min(maxHp, (api.getProperty("hp") || 0) + 1));\n      }\n    }\n  } else {\n    let dir = api.getProperty("direction") || 0;\n    dir += (Math.random() - 0.5) * 0.1;\n    dx = Math.cos(dir); dy = Math.sin(dir);\n    api.setProperty("direction", dir);\n  }\n} else {\n  let dir = api.getProperty("direction") || 0;\n  dir += (Math.random() - 0.5) * 0.15;\n  dx = Math.cos(dir); dy = Math.sin(dir);\n  api.setProperty("direction", dir);\n}\nconst dist = Math.sqrt(dx * dx + dy * dy) || 1;\napi.setPosition(api.getX() + (dx / dist) * spd, api.getY() + (dy / dist) * spd);\n\n// ---------- 被攻击：减伤 + 死亡 ----------\napi.on("attack", function (data) {\n  if (!data || !data.damage) return;\n  const def = api.getProperty("defense") || 0;\n  const actualDamage = Math.round(data.damage * (1 - def));\n  const newHp = Math.max(0, (api.getProperty("hp") || 50) - actualDamage);\n  api.setProperty("hp", newHp);\n  if (newHp <= 0) api.destroyCell(api.getProperty("id"));\n});\n\n// ---------- 饱食度 ----------\nif (api.getFrame() % 600 === 0) {\n  api.setProperty("energy", Math.max(0, (api.getProperty("energy") || 100) - 1));\n}\n',
        compiledFn: null,
        attributes: { species: 'lasius_niger', role: 'soldier', antId: true, colonyId: 'A', hp: 50, maxHp: 50, speed: 0.55, energy: 100, flying: false },
        triggerConfig: { mode: 'pulse', threshold: 6, accumulator: 0, pulseDecay: 0, eventMask: ['onUpdate'], wakeConditions: [] },
        tags: ['ant', 'colony-A'],
        createdAt: now,
        updatedAt: now,
        state: 'normal',
        errorInfo: null
      });
    }
    // ---------- 植物（5 株：狗尾草 3 + 蒲公英 2）----------
    const plantData = [
      { id: 'plant_1', key: 'setaria_viridis', name: '狗尾草', x: -120, y: -80, color: '#6ba84f', size: 20, seedEnergy: 10, seedsPerCycle: 3 },
      { id: 'plant_2', key: 'setaria_viridis', name: '狗尾草', x: 130, y: -90, color: '#6ba84f', size: 20, seedEnergy: 10, seedsPerCycle: 3 },
      { id: 'plant_3', key: 'setaria_viridis', name: '狗尾草', x: 0, y: -160, color: '#6ba84f', size: 22, seedEnergy: 10, seedsPerCycle: 3 },
      { id: 'plant_4', key: 'taraxacum_officinale', name: '蒲公英', x: -150, y: 80, color: '#5fa03e', size: 22, seedEnergy: 6, seedsPerCycle: 2 },
      { id: 'plant_5', key: 'taraxacum_officinale', name: '蒲公英', x: 160, y: 90, color: '#5fa03e', size: 22, seedEnergy: 6, seedsPerCycle: 2 }
    ];
    for (let i = 0; i < plantData.length; i++) {
      const p = plantData[i];
      cells.push({
        id: p.id,
        name: p.name,
        kind: 'plant',
        x: p.x, y: p.y,
        radius: p.size,
        rotation: 0,
        opacity: 1,
        zIndex: 0,
        color: p.color,
        shape: 'circle',
        selectable: true,
        visible: true,
        parentId: null,
        childrenIds: [],
        description: p.name + '：工蚁的重要食物来源，每周期散出若干草籽。',
        code: '// ' + p.name + '（' + p.key + '）— 植物基圆代码（v5.0）\n// 缓慢生长；每 1200 帧散出一颗草籽（若 seedsRemaining > 0）\n\nif (!api.getProperty("initialized")) {\n  api.setProperty("initialized", true);\n  api.setProperty("name", "' + p.name + '");\n  api.setProperty("species", "' + p.key + '");\n  api.setKind("plant");\n  api.setProperty("type", "grass");\n  api.setColor("' + p.color + '");\n  api.setRadius(' + p.size + ');\n  api.setProperty("seedEnergy", ' + p.seedEnergy + ');\n  api.setProperty("seedsRemaining", ' + p.seedsPerCycle + ');\n  api.setProperty("growth", 0);\n  api.setProperty("preferred", 0.9);\n  api.setProperty("nutrients", 5);\n}\n\nif (api.getFrame() % 600 === 0) {\n  const g = Math.min(1, (api.getProperty("growth") || 0) + 0.03);\n  api.setProperty("growth", g);\n  api.setRadius(' + p.size + ' * (0.6 + g * 0.4));\n}\n\nif (api.getFrame() % 1200 === 0 && (api.getProperty("seedsRemaining") || 0) > 0) {\n  api.setProperty("seedsRemaining", (api.getProperty("seedsRemaining") || 0) - 1);\n  var sx = api.getX() + (Math.random() - 0.5) * 30;\n  var sy = api.getY() + (Math.random() - 0.5) * 30;\n  if (window.CellCore && window.CellCore.createCell) {\n    var sd = window.CellCore.createCell("plant", sx, sy);\n    if (sd) {\n      window.CellCore.updateCell(sd.id, { name: "草籽", color: "#c8b050", radius: 3 });\n      window.CellCore.setAttribute(sd.id, "seedEnergy", ' + p.seedEnergy + ');\n      window.CellCore.setAttribute(sd.id, "type", "seed");\n      window.CellCore.setAttribute(sd.id, "species", "' + p.key + '");\n    }\n  }\n}\n',
        compiledFn: null,
        attributes: { species: p.key, type: 'grass', seedEnergy: p.seedEnergy, seedsRemaining: p.seedsPerCycle, growth: 0, preferred: 0.9, nutrients: 5 },
        triggerConfig: { mode: 'event', threshold: 60, accumulator: 0, pulseDecay: 0, eventMask: ['onUpdate'], wakeConditions: [] },
        tags: ['plant'],
        createdAt: now,
        updatedAt: now,
        state: 'normal',
        errorInfo: null
      });
    }
    return cells;
  }

  // ===== 初始化 =====
  async function init() {
    try {
      await openDB();
      console.log('[PersistLayer] 初始化完成');
      return true;
    } catch (e) {
      console.error('[PersistLayer] 初始化失败:', e);
      return false;
    }
  }

  return {
    init,
    saveCell, saveCells, loadCell, loadAllCells, deleteCell, queryCellsByKind,
    saveWorld, loadWorld, loadLatestWorld,
    saveSetting, loadSetting, loadAllSettings,
    saveFile, loadFile, deleteFile, listFilesByCellId,
    saveApiKey, loadApiKey,
    markDirty,
    bindCellCore,
    startAutoSave: _startAutoSave,
    stopAutoSave: _stopAutoSave,
    saveFullSnapshot,
    getDefaultWorldCells
  };
})();

// 挂载到 window 以便其他模块通过 window.PersistLayer 访问
if (typeof window !== 'undefined') {
  window.PersistLayer = PersistLayer;
}
