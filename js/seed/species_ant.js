// ================================================================
// species_ant.js - 蚂蚁行为 + 外观绘制代码生成器
// 依赖: species_core.js (提供 ANT_SPECIES, ANT_PERSONALITIES 等)
// ================================================================
(function (global) {
  'use strict';

  // 访问 core 模块的数据和工具函数
  const D = global._SpeciesData;
  const F = global._SpeciesFns;
  const ANT_SPECIES = D.ANT_SPECIES;
  const ANT_PERSONALITIES = D.ANT_PERSONALITIES;

  // ===== _getRoleBehavior =====
  function _getRoleBehavior(roleKey, sp) {
    const role = roleKey || 'worker';

    // ------ 通用感知与饱食消耗 ------（所有角色共享）
    const sharedCode =
      '// ========== 通用感知：搜索食物/敌人/异群蚂蚁 ==========\n' +
      'const nearby = api.findAllWithinRadius(api.getX(), api.getY(), 120);\n' +
      'let nearestFood = null, nearestHostile = null;\n' +
      'const myColony = api.getProperty("colonyId") || "A";\n' +
      'for (let i = 0; i < nearby.length; i++) {\n' +
      '  const n = nearby[i];\n' +
      '  const attr = n.attributes || {};\n' +
      '  if (attr.hostile) nearestHostile = n;\n' +
      '  else if (attr.antId && attr.colonyId && attr.colonyId !== myColony) nearestHostile = nearestHostile || n; // 异群蚂蚁\n' +
      '  else if ((attr.type === "seed" && attr.seedEnergy > 0) || attr.energyValue > 0) nearestFood = nearestFood || n;\n' +
      '}\n' +
      '\n' +
      '// --- 扫描附近信息素标记（同群同伴留下）---\n' +
      'let pheromoneHint = null;\n' +
      'let pheroCount = 0;\n' +
      'for (let i = 0; i < nearby.length; i++) {\n' +
      '  const np = nearby[i];\n' +
      '  if (np.attributes && np.attributes.pheromone && np.attributes.colonyId === myColony) {\n' +
      '    pheroCount++;\n' +
      '    if (!pheromoneHint || (np.attributes.strength || 0) > (pheromoneHint.attributes ? (pheromoneHint.attributes.strength || 0) : 0)) {\n' +
      '      pheromoneHint = np;\n' +
      '    }\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      '// --- 通用：信息素释放（留一条可被同伴跟随的轨迹）---\n' +
      '// 用法：api.setProperty("emitPheromone", true) 即表示当前帧需要在当前位置释放一个\n' +
      'if (api.getProperty("emitPheromone") && api.getFrame() % 45 === 0) {\n' +
      '  api.createCell({\n' +
      '    kind: "effect",\n' +
      '    x: api.getX(),\n' +
      '    y: api.getY(),\n' +
      '    name: "信息素",\n' +
      '    color: "#ffcc66",\n' +
      '    radius: 3,\n' +
      '    attributes: { pheromone: true, colonyId: myColony, strength: 100, isPheromone: true },\n' +
      '    code: "if (!api.getProperty(\\"_pInit\\")) { api.setProperty(\\"_pInit\\", true); api.setProperty(\\"strength\\", 100); }\\n" +\n' +
      '          "if (api.getFrame() % 60 === 0) {\\n" +\n' +
      '          "  let s = (api.getProperty(\\"strength\\") || 100) - 2;\\n" +\n' +
      '          "  api.setProperty(\\"strength\\", s);\\n" +\n' +
      '          "  api.setRadius(Math.max(1.2, 3 * s / 100));\\n" +\n' +
      '          "  if (s <= 0) { api.destroyCell(api.getProperty(\\"id\\")); }\\n" +\n' +
      '          "}\\n" +\n' +
      '          "if (api.getFrame() % 60 === 30) {\\n" +\n' +
      '          "  api.updateCellAttribute(api.getProperty(\\"id\\"), \\"strength\\", api.getProperty(\\"strength\\") || 0);\\n" +\n' +
      '          "}\\n",\n' +
      '    mode: "continuous"\n' +
      '  });\n' +
      '  api.setProperty("emitPheromone", false);\n' +
      '}\n' +
      '\n' +
      '// ========== 饱食度消耗 ==========\n' +
      'if (api.getFrame() % 600 === 0) {\n' +
      '  api.setProperty("energy", Math.max(0, (api.getProperty("energy") || 100) - 1));\n' +
      '}\n' +
      '\n' +
      'if ((api.getProperty("energy") || 100) <= 0) {\n' +
      '  api.destroyCell(api.getProperty("id"));\n' +
      '}\n' +
      '\n';

    // ------ 工蚁：觅食循环 + 信息素引导同伴 ------
    const workerCode =
      '// ========== 工蚁行为：觅食循环（含信息素引导）==========\n' +
      '// 寻找巢穴基圆（isNest=true）\n' +
      'let nestEntity = null;\n' +
      'for (let i = 0; i < nearby.length; i++) {\n' +
      '  const n = nearby[i];\n' +
      '  if (n.attributes && n.attributes.isNest && (!nestEntity || Math.hypot(n.x - api.getX(), n.y - api.getY()) < Math.hypot(nestEntity.x - api.getX(), nestEntity.y - api.getY()))) {\n' +
      '    nestEntity = n;\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'let dx = 0, dy = 0;\n' +
      'const spd = api.getProperty("speed") || 0.7;\n' +
      'const state = api.getProperty("antState") || "idle";\n' +
      'let nestX = api.getProperty("nestX") || 0;\n' +
      'let nestY = api.getProperty("nestY") || 0;\n' +
      '// 如果找到了巢穴基圆，以它为目标\n' +
      'if (nestEntity) { nestX = nestEntity.x; nestY = nestEntity.y; }\n' +
      'const carried = api.getProperty("foodCarried") || 0;\n' +
      'const maxCarry = api.getProperty("maxCarry") || 15;\n' +
      '\n' +
      '// 状态切换\n' +
      'if (state === "idle") {\n' +
      '  if ((api.getProperty("energy") || 100) > 60) {\n' +
      '    api.setProperty("antState", "foraging");\n' +
      '  }\n' +
      '} else if (state === "foraging") {\n' +
      '  if (carried >= maxCarry) {\n' +
      '    api.setProperty("antState", "returning");\n' +
      '    api.setProperty("emitPheromone", true);\n' +
      '  } else if ((api.getProperty("energy") || 100) < 30) {\n' +
      '    api.setProperty("antState", "returning");\n' +
      '    api.setProperty("emitPheromone", true);\n' +
      '  }\n' +
      '} else if (state === "returning") {\n' +
      '  const distToNest = Math.hypot(api.getX() - nestX, api.getY() - nestY);\n' +
      '  if (api.getFrame() % 45 === 0) {\n' +
      '    api.setProperty("emitPheromone", true);\n' +
      '  }\n' +
      '  if (distToNest < 20) {\n' +
      '    if (carried > 0 && nestEntity && nestEntity.id) {\n' +
      '      api.updateCellAttribute(nestEntity.id, "foodStorage", ((nestEntity.attributes && nestEntity.attributes.foodStorage) || 0) + carried);\n' +
      '      api.setProperty("foodCarried", 0);\n' +
      '    } else {\n' +
      '      api.setProperty("foodCarried", 0);\n' +
      '    }\n' +
      '    api.setProperty("energy", Math.min(100, (api.getProperty("energy") || 100) + 30));\n' +
      '    api.setProperty("emitPheromone", false);\n' +
      '    api.setProperty("antState", "idle");\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      '// 决策与移动\n' +
      'if (nearestHostile) {\n' +
      '  dx = api.getX() - nearestHostile.x; dy = api.getY() - nearestHostile.y;\n' +
      '} else if (api.getProperty("antState") === "returning") {\n' +
      '  dx = nestX - api.getX(); dy = nestY - api.getY();\n' +
      '} else if (nearestFood && carried < maxCarry) {\n' +
      '  dx = nearestFood.x - api.getX(); dy = nearestFood.y - api.getY();\n' +
      '  const foodDist = Math.hypot(nearestFood.x - api.getX(), nearestFood.y - api.getY());\n' +
      '  if (foodDist < 15 && api.getFrame() % 120 === 0) {\n' +
      '    const energy = nearestFood.attributes ? (nearestFood.attributes.seedEnergy || 8) : 8;\n' +
      '    api.setProperty("foodCarried", Math.min(maxCarry, carried + energy));\n' +
      '    if (nearestFood && nearestFood.id) {\n' +
      '      api.destroyCell(nearestFood.id);\n' +
      '    }\n' +
      '  }\n' +
      '} else if (pheromoneHint) {\n' +
      '  // 没找到食物但同伴留下了信息素 → 朝信息素方向走\n' +
      '  dx = pheromoneHint.x - api.getX();\n' +
      '  dy = pheromoneHint.y - api.getY();\n' +
      '} else {\n' +
      '  let dir = api.getProperty("direction") || 0;\n' +
      '  dir += (Math.random() - 0.5) * 0.2;\n' +
      '  dx = Math.cos(dir); dy = Math.sin(dir);\n' +
      '  api.setProperty("direction", dir);\n' +
      '}\n' +
      '\n' +
      'const dist = Math.sqrt(dx*dx + dy*dy) || 1;\n' +
      'api.setPosition(api.getX() + dx/dist * spd, api.getY() + dy/dist * spd);\n';

    // ------ 兵蚁：主动战斗 + 协同作战 ------
    const soldierCode =
      '// ========== 兵蚁行为：主动战斗（协同 + 低血量撤退）==========\n' +
      '// 寻找巢穴基圆（HP低时撤退用）\n' +
      'let nestEntity = null;\n' +
      'for (let i = 0; i < nearby.length; i++) {\n' +
      '  const n = nearby[i];\n' +
      '  if (n.attributes && n.attributes.isNest) { nestEntity = n; break; }\n' +
      '}\n' +
      '\n' +
      'let dx = 0, dy = 0;\n' +
      'const spd = api.getProperty("speed") || 0.7;\n' +
      'const hp = api.getProperty("hp") || 30;\n' +
      'const maxHp = api.getProperty("maxHp") || ' + sp.hp + ';\n' +
      '\n' +
      '// 协同战斗：扫描是否有其他兵蚁正在靠近某个目标\n' +
      'let allyTarget = null;\n' +
      'let allyTargetDist = Infinity;\n' +
      'let soldierCount = 0;\n' +
      'for (let i = 0; i < nearby.length; i++) {\n' +
      '  const n = nearby[i];\n' +
      '  if (n.attributes && n.attributes.antId && n.attributes.role === "soldier" && n.attributes.colonyId === myColony) {\n' +
      '    soldierCount++;\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'if (nearestHostile) {\n' +
      '  // 有敌人 → 追击并战斗\n' +
      '  dx = nearestHostile.x - api.getX();\n' +
      '  dy = nearestHostile.y - api.getY();\n' +
      '  const d = Math.sqrt(dx*dx + dy*dy) || 1;\n' +
      '  // 协同加速：附近同伴越多，攻击越快（最短 80 帧/次）\n' +
      '  const cooldown = Math.max(80, 120 - soldierCount * 10);\n' +
      '  if (d < 20 && api.getFrame() % cooldown === 0) {\n' +
      '    const atk = api.getProperty("attackPower") || 2;\n' +
      '    api.emitCellEvent(nearestHostile.id, "attack", { damage: atk, sourceId: api.getProperty("id") });\n' +
      '  }\n' +
      '} else if (hp < maxHp * 0.3) {\n' +
      '  // HP过低 → 撤退回巢回血\n' +
      '  if (nestEntity) {\n' +
      '    dx = nestEntity.x - api.getX();\n' +
      '    dy = nestEntity.y - api.getY();\n' +
      '    if (Math.hypot(nestEntity.x - api.getX(), nestEntity.y - api.getY()) < 15) {\n' +
      '      if (api.getFrame() % 60 === 0) {\n' +
      '        api.setProperty("hp", Math.min(maxHp, (api.getProperty("hp") || 0) + 2));  // 加快回血\n' +
      '      }\n' +
      '    }\n' +
      '  } else {\n' +
      '    let dir = api.getProperty("direction") || 0;\n' +
      '    dir += (Math.random() - 0.5) * 0.1;\n' +
      '    dx = Math.cos(dir); dy = Math.sin(dir);\n' +
      '    api.setProperty("direction", dir);\n' +
      '  }\n' +
      '} else {\n' +
      '  // 巡逻：主动搜索敌人\n' +
      '  const searchRadius = 180;\n' +
      '  const patrolNearby = api.findAllWithinRadius(api.getX(), api.getY(), searchRadius);\n' +
      '  let foundEnemy = null;\n' +
      '  for (let i = 0; i < patrolNearby.length; i++) {\n' +
      '    const n = patrolNearby[i];\n' +
      '    if (n.attributes && (n.attributes.hostile || (n.attributes.antId && n.attributes.colonyId && n.attributes.colonyId !== myColony))) {\n' +
      '      foundEnemy = n; break;\n' +
      '    }\n' +
      '  }\n' +
      '  if (foundEnemy) {\n' +
      '    dx = foundEnemy.x - api.getX(); dy = foundEnemy.y - api.getY();\n' +
      '  } else if (pheromoneHint) {\n' +
      '    // 信息素提示有同伴发现食物 → 兵蚁顺路巡逻保护觅食区域\n' +
      '    dx = pheromoneHint.x - api.getX();\n' +
      '    dy = pheromoneHint.y - api.getY();\n' +
      '  } else {\n' +
      '    let dir = api.getProperty("direction") || 0;\n' +
      '    dir += (Math.random() - 0.5) * 0.15;\n' +
      '    dx = Math.cos(dir); dy = Math.sin(dir);\n' +
      '    api.setProperty("direction", dir);\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'const dist = Math.sqrt(dx*dx + dy*dy) || 1;\n' +
      'api.setPosition(api.getX() + dx/dist * spd, api.getY() + dy/dist * spd);\n';

    // ------ 侦察蚁：广域巡逻 ------
    const scoutCode =
      '// ========== 侦察蚁行为：广域巡逻 ==========\n' +
      'let dx = 0, dy = 0;\n' +
      'const spd = (api.getProperty("speed") || 0.7) * 1.2;  // 侦察蚁更快\n' +
      '\n' +
      'if (nearestHostile) {\n' +
      '  dx = nearestHostile.x - api.getX();\n' +
      '  dy = nearestHostile.y - api.getY();\n' +
      '} else {\n' +
      '  let dir = api.getProperty("direction") || 0;\n' +
      '  dir += (Math.random() - 0.5) * 0.25;\n' +
      '  dx = Math.cos(dir); dy = Math.sin(dir);\n' +
      '  api.setProperty("direction", dir);\n' +
      '}\n' +
      '\n' +
      'const dist = Math.sqrt(dx*dx + dy*dy) || 1;\n' +
      'api.setPosition(api.getX() + dx/dist * spd, api.getY() + dy/dist * spd);\n';

    // ------ 蚁后：探索→建巢→产蚁（全新流程，玩家通过控制台创建）------
    // 状态机：explore → digesting → building → nesting
    // - explore: 寻找敌人少+植物多的安全区域，有敌人会逃跑
    // - digesting: 在安全点停留，消化能量准备建巢
    // - building: 创建蚁巢，完成后进入 nesting
    // - nesting: 固定在蚁巢内，根据 foodStorage 产不同角色的蚂蚁
    const queenCode =
      '// ========== 蚁后行为：探索→建巢→产蚁（简化版）==========\n' +
      '(function() {\n' +
      '  const _qs = api.getProperty("queenState");\n' +
      '  const _valid = ["explore", "building", "nesting"];\n' +
      '  if (_valid.indexOf(_qs) < 0) {\n' +
      '    api.setProperty("queenState", "explore");\n' +
      '    api.setProperty("exploreTimer", 0);\n' +
      '    if ((api.getProperty("energy") || 0) < 100) api.setProperty("energy", 150);\n' +
      '  }\n' +
      '})();\n' +
      '\n' +
      '// ========== 阶段1：探索（随机漫游+寻找安全点建巢）==========\n' +
      'const qState = api.getProperty("queenState");\n' +
      'if (qState === "explore") {\n' +
      '  let qDir = api.getProperty("direction") || 0;\n' +
      '  if (api.getFrame() % 15 === 0) qDir += (Math.random() - 0.5) * 0.8;\n' +
      '  api.setProperty("direction", qDir);\n' +
      '  const qSpd = api.getProperty("speed") || 0.5;\n' +
      '  api.setPosition(api.getX() + Math.cos(qDir) * qSpd, api.getY() + Math.sin(qDir) * qSpd);\n' +
      '\n' +
      '  let qTimer = (api.getProperty("exploreTimer") || 0) + 1;\n' +
      '  api.setProperty("exploreTimer", qTimer);\n' +
      '\n' +
      '  // 每120帧检查：半径100px内无静态物/蚁巢+无其他昆虫就建巢\n' +
      '  let hasStatic = false;\n' +
      '  let hasInsect = false;\n' +
      '  const qCol = api.getProperty("colonyId") || "A";\n' +
      '  for (let i = 0; i < nearby.length; i++) {\n' +
      '    const n = nearby[i];\n' +
      '    const d = Math.hypot(n.x - api.getX(), n.y - api.getY());\n' +
      '    if (d < 100) {\n' +
      '      if (n.kind === "static" || (n.attributes && (n.attributes.isNest || n.attributes.type === "nest"))) hasStatic = true;\n' +
      '      if (n.kind === "creature" && (!n.attributes || n.attributes.colonyId !== qCol)) hasInsect = true;\n' +
      '    }\n' +
      '  }\n' +
      '\n' +
      '  if ((!hasStatic && !hasInsect && qTimer % 120 === 0) || qTimer > 1200) {\n' +
      '    api.setProperty("queenState", "building");\n' +
      '    api.setProperty("buildTimer", 0);\n' +
      '    console.log("[Queen] 开始建巢 | Pos:(", api.getX().toFixed(1), ",", api.getY().toFixed(1), ")");\n' +
      '  }\n' +
      '\n' +
      '  if (api.getFrame() % 60 === 0) {\n' +
      '    console.log("[Queen] explore | Pos:(", api.getX().toFixed(1), ",", api.getY().toFixed(1), ") | Timer:", qTimer);\n' +
      '  }\n' +
      '\n' +
      '// ========== 阶段2：建造蚁巢（5秒后生成蚁巢）==========\n' +
      '} else if (qState === "building") {\n' +
      '  let qBT = (api.getProperty("buildTimer") || 0) + 1;\n' +
      '  api.setProperty("buildTimer", qBT);\n' +
      '  if (qBT > 300) {\n' +
      '    const qColony = api.getProperty("colonyId") || "A";\n' +
      '    // 简化的蚁巢绘制代码\n' +
      '    const nestDraw = "api.registerDraw(function(ctx,r){ctx.fillStyle=\\"#5a3a1a\\";ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.fillStyle=\\"#8b5a2b\\";ctx.beginPath();ctx.arc(0,0,r*0.85,0,Math.PI*2);ctx.fill();});";\n' +
      '    api.createCell({\n' +
      '      kind: "static",\n' +
      '      x: api.getX(),\n' +
      '      y: api.getY(),\n' +
      '      name: "蚁巢",\n' +
      '      color: "#8b5a2b",\n' +
      '      radius: 40,\n' +
      '      shape: "circle",\n' +
      '      code: nestDraw,\n' +
      '      attributes: {\n' +
      '        type: "nest",\n' +
      '        sceneType: "nest",\n' +
      '        isNest: true,\n' +
      '        immovable: true,\n' +
      '        softRadius: 0,  // 蚁巢不推走同巢蚂蚁，让蚂蚁可以待在巢内\n' +
      '        colonyId: qColony,\n' +
      '        foodStorage: 30,\n' +
      '        population: 0,\n' +
      '        maxPopulation: 50\n' +
      '      }\n' +
      '    });\n' +
      '    api.setProperty("nestX", api.getX());\n' +
      '    api.setProperty("nestY", api.getY());\n' +
      '    api.setProperty("queenState", "nesting");\n' +
      '    api.setProperty("layTimer", 0);\n' +
      '    console.log("[Queen] 蚁巢建造完成");\n' +
      '  }\n' +
      '  if (api.getFrame() % 60 === 0) {\n' +
      '    console.log("[Queen] building | BuildTimer:", qBT, "/ 300");\n' +
      '  }\n' +
      '\n' +
      '// ========== 阶段3：安居蚁巢（待在中心+孵化+产蚁）==========\n' +
      '} else if (qState === "nesting") {\n' +
      '  let qNestEntity = null;\n' +
      '  const qCol2 = api.getProperty("colonyId") || "A";\n' +
      '  for (let i = 0; i < nearby.length; i++) {\n' +
      '    const n = nearby[i];\n' +
      '    if (n.attributes && n.attributes.isNest && n.attributes.colonyId === qCol2) { qNestEntity = n; break; }\n' +
      '  }\n' +
      '  const qNestX = (qNestEntity && qNestEntity.x) || api.getProperty("nestX") || api.getX();\n' +
      '  const qNestY = (qNestEntity && qNestEntity.y) || api.getProperty("nestY") || api.getY();\n' +
      '\n' +
      '  // 进入 nesting 的第一帧：把蚁后一次性放到巢穴正中心，之后不再移动（softRadius:0 保证不会被推）\n' +
      '  if (!api.getProperty("nestArrived")) {\n' +
      '    api.setPosition(qNestX, qNestY);\n' +
      '    api.setProperty("nestX", qNestX);\n' +
      '    api.setProperty("nestY", qNestY);\n' +
      '    api.setProperty("nestArrived", true);\n' +
      '    // 蚁后从巢穴取食，不依赖外部觅食，初始给满能量\n' +
      '    const qMaxE = api.getProperty("maxEnergy") || 300;\n' +
      '    api.setProperty("energy", qMaxE);\n' +
      '  }\n' +
      '\n' +
      '  // 从巢中取食物：消耗 1 食物，蚁后自身 +5 能量（工蚁喂食逻辑）\n' +
      '  const qStorage = (qNestEntity && qNestEntity.attributes && qNestEntity.attributes.foodStorage) || 0;\n' +
      '  if (api.getFrame() % 300 === 0) {\n' +
      '    if (qStorage > 0 && qNestEntity && qNestEntity.id) {\n' +
      '      api.updateCellAttribute(qNestEntity.id, "foodStorage", Math.max(0, qStorage - 1));\n' +
      '      const qMaxE2 = api.getProperty("maxEnergy") || 300;\n' +
      '      api.setProperty("energy", Math.min(qMaxE2, (api.getProperty("energy") || 0) + 5));\n' +
      '    }\n' +
      '  }\n' +
      '\n' +
      '  // 产蚁间隔（按食物量）\n' +
      '  let qLayInterval = 0;\n' +
      '  if (qStorage > 80) qLayInterval = 900;\n' +
      '  else if (qStorage > 20) qLayInterval = 1800;\n' +
      '  else if (qStorage > 0) qLayInterval = 3600;\n' +
      '\n' +
      '  if (qLayInterval > 0) {\n' +
      '    let qLT = (api.getProperty("layTimer") || 0) + 1;\n' +
      '    api.setProperty("layTimer", qLT);\n' +
      '    if (qLT >= qLayInterval) {\n' +
      '      api.setProperty("layTimer", 0);\n' +
      '      if (qNestEntity && qNestEntity.id) {\n' +
      '        api.updateCellAttribute(qNestEntity.id, "foodStorage", Math.max(0, qStorage - 5));\n' +
      '      }\n' +
      '      const qSpecies = api.getProperty("species") || "lasius_niger";\n' +
      '      let qPop = api.getProperty("population") || 0;\n' +
      '      let qRole = "worker";\n' +
      '      if (qPop >= 2 && qStorage > 80 && Math.random() < 0.3) qRole = "soldier";\n' +
      '      qPop++;\n' +
      '      api.setProperty("population", qPop);\n' +
      '      if (qNestEntity && qNestEntity.id) {\n' +
      '        api.updateCellAttribute(qNestEntity.id, "population", qPop);\n' +
      '      }\n' +
      '      const qAng = Math.random() * Math.PI * 2;\n' +
      '      const qAntX = qNestX + Math.cos(qAng) * 30;\n' +
      '      const qAntY = qNestY + Math.sin(qAng) * 30;\n' +
      '      // baby 数据（嵌套字符串，双引号格式）\n' +
      '      const bName = qRole === "soldier" ? "兵蚁" : "工蚁";\n' +
      '      const bSpd = qRole === "soldier" ? "0.75" : "0.7";\n' +
      '      const bAtk = qRole === "soldier" ? "3" : "1";\n' +
      '      const bHp = qRole === "soldier" ? "40" : "30";\n' +
      '      const bNX = qNestX.toFixed(1);\n' +
      '      const bNY = qNestY.toFixed(1);\n' +
      '      // baby init: 用双引号包裹，内部引号需转义\n' +
      '      let bInit = "if(!api.getProperty(\\\"initialized\\\")){api.setProperty(\\\"initialized\\\",true);" +\n' +
      '        "api.setProperty(\\\"name\\\",\\\"" + bName + "\\\");" +\n' +
      '        "api.setProperty(\\\"species\\\",\\\"" + qSpecies + "\\\");" +\n' +
      '        "api.setProperty(\\\"antId\\\",true);" +\n' +
      '        "api.setProperty(\\\"role\\\",\\\"" + qRole + "\\\");" +\n' +
      '        "api.setProperty(\\\"colonyId\\\",\\\"" + qCol2 + "\\\");" +\n' +
      '        "api.setProperty(\\\"speed\\"," + bSpd + ");" +\n' +
      '        "api.setColor(\\\"#2a1a0e\\\");api.setKind(\\\"creature\\\");api.setRadius(4);" +\n' +
      '        "api.setProperty(\\"energy\\",100);api.setProperty(\\"maxCarry\\",15);" +\n' +
      '        "api.setProperty(\\"attackPower\\"," + bAtk + ");" +\n' +
      '        "api.setProperty(\\"hp\\"," + bHp + ");" +\n' +
      '        "api.setProperty(\\"softRadius\\",0);" +\n' +
      '        "api.setProperty(\\"nestX\\"," + bNX + ");" +\n' +
      '        "api.setProperty(\\"nestY\\"," + bNY + ");" +\n' +
      '        "api.setProperty(\\"direction\\",Math.random()*Math.PI*2);" +\n' +
      '        "api.registerDraw(function(ctx,r){ctx.fillStyle=\\"#2a1a0e\\";ctx.beginPath();ctx.arc(0,0,r*0.5,0,Math.PI*2);ctx.fill();});}";\n' +
      '      // baby behavior\n' +
      '      let bBehav;\n' +
      '      if (qRole === "soldier") {\n' +
      '        bBehav = "var nb=api.findAllWithinRadius(api.getX(),api.getY(),120);var foe=null,fd=1e9;for(var i=0;i<nb.length;i++){var c=nb[i];if(c.attributes&&(c.attributes.hostile||(c.attributes.antId&&c.attributes.colonyId&&c.attributes.colonyId!==\\\""+qCol2+"\\\"))){var dd=Math.hypot(c.x-api.getX(),c.y-api.getY());if(dd<fd){fd=dd;foe=c;}}}" +\n' +
      '          "var dx=0,dy=0,dir=api.getProperty(\\\"direction\\\")||0;if(foe){dx=foe.x-api.getX();dy=foe.y-api.getY();if(fd<20&&api.getFrame()%120===0)api.emitCellEvent(foe.id,\\\"attack\\\",{damage:api.getProperty(\\\"attackPower\\\")||"+bAtk+",sourceId:api.getProperty(\\\"id\\\")});}else{if(api.getFrame()%60===0)dir+=(Math.random()-0.5)*0.25;dx=Math.cos(dir);dy=Math.sin(dir);api.setProperty(\\\"direction\\\",dir);}" +\n' +
      '          "var mv=Math.sqrt(dx*dx+dy*dy)||1;api.setPosition(api.getX()+dx/mv*0.75,api.getY()+dy/mv*0.75);if(api.getFrame()%600===0)api.setProperty(\\\"energy\\\",Math.max(0,(api.getProperty(\\\"energy\\\")||100)-1));";\n' +
      '      } else {\n' +
      '        bBehav = "var nb=api.findAllWithinRadius(api.getX(),api.getY(),120);var foe=null,fd=1e9,food=null,fd2=1e9;for(var i=0;i<nb.length;i++){var c=nb[i];if(c.attributes&&c.attributes.hostile){var dd=Math.hypot(c.x-api.getX(),c.y-api.getY());if(dd<fd){fd=dd;foe=c;}}else if(c.attributes&&((c.attributes.type===\\\"seed\\\"&&c.attributes.seedEnergy>0)||c.attributes.energyValue>0)){var dd2=Math.hypot(c.x-api.getX(),c.y-api.getY());if(dd2<fd2){fd2=dd2;food=c;}}}" +\n' +
      '          "var dx=0,dy=0,dir=api.getProperty(\\"direction\\")||0,carry=api.getProperty(\\"foodCarried\\")||0;if(carry>0){dx=(api.getProperty(\\"nestX\\")||0)-api.getX();dy=(api.getProperty(\\"nestY\\")||0)-api.getY();var dn=Math.sqrt(dx*dx+dy*dy);if(dn<45){api.setProperty(\\"foodCarried\\",0);}}else if(food){dx=food.x-api.getX();dy=food.y-api.getY();if(fd2<12&&api.getFrame()%60===0){api.setProperty(\\"foodCarried\\",15);api.destroyCell(food.id);}}else if(foe){dx=api.getX()-foe.x;dy=api.getY()-foe.y;}else{if(api.getFrame()%60===0)dir+=(Math.random()-0.5)*0.3;dx=Math.cos(dir);dy=Math.sin(dir);api.setProperty(\\"direction\\",dir);}" +\n' +
      '          "var mv=Math.sqrt(dx*dx+dy*dy)||1;api.setPosition(api.getX()+dx/mv*0.7,api.getY()+dy/mv*0.7);if(api.getFrame()%600===0)api.setProperty(\\"energy\\",Math.max(0,(api.getProperty(\\"energy\\")||100)-1));if((api.getProperty(\\"energy\\")||100)<=0)api.destroyCell(api.getProperty(\\"id\\"));";\n' +
      '      }\n' +
      '      api.createCell({\n' +
      '        kind: "creature",\n' +
      '        x: qAntX,\n' +
      '        y: qAntY,\n' +
      '        code: bInit + "\\n" + bBehav,\n' +
      '        mode: "continuous"\n' +
      '      });\n' +
      '      console.log("[Queen] 产下 " + bName + " | Pop:" + qPop + " | Food:" + qStorage);\n' +
      '    }\n' +
      '  }\n' +
      '  if (api.getFrame() % 300 === 0) {\n' +
      '    console.log("[Queen] nesting | Pop:", api.getProperty("population"), "| NestFood:", qStorage, "| Energy:", api.getProperty("energy"));\n' +
      '  }\n' +
      '}\n';

    // ------ 牧蚜蚁：黄墩蚁特有 · 搜索蚜虫→守护→收集蜜露→运回蚁巢 ------
    const farmerCode =
      '// ========== 牧蚜蚁行为：放牧蚜虫获取蜜露 + 运回蚁巢 ==========\n' +
      'let dx = 0, dy = 0;\n' +
      'const spd = api.getProperty("speed") || 0.7;\n' +
      'let nestX = api.getProperty("nestX") || 0;\n' +
      'let nestY = api.getProperty("nestY") || 0;\n' +
      'let nestEntity = null;\n' +
      'for (let i = 0; i < nearby.length; i++) {\n' +
      '  const n = nearby[i];\n' +
      '  if (n.attributes && n.attributes.isNest) { nestEntity = n; nestX = n.x; nestY = n.y; break; }\n' +
      '}\n' +
      '\n' +
      '// 搜索附近的蚜虫（蜜露来源）\n' +
      'let nearestAphid = null;\n' +
      'let aphidDist = Infinity;\n' +
      'for (let i = 0; i < nearby.length; i++) {\n' +
      '  const n = nearby[i];\n' +
      '  if (n.attributes && n.attributes.species === "aphid") {\n' +
      '    const d = Math.hypot(n.x - api.getX(), n.y - api.getY());\n' +
      '    if (d < aphidDist) { aphidDist = d; nearestAphid = n; }\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'const carried = api.getProperty("foodCarried") || 0;\n' +
      'const maxCarry = api.getProperty("maxCarry") || 15;\n' +
      '\n' +
      '// 状态机：有携带食物 → 回巢交付；有蚜虫 → 守护收集蜜露；有敌人 → 逃跑；有食物 → 取；否则随机走\n' +
      'if (nearestHostile) {\n' +
      '  dx = api.getX() - nearestHostile.x; dy = api.getY() - nearestHostile.y;\n' +
      '} else if (carried >= maxCarry) {\n' +
      '  // 满载 → 回巢交付食物\n' +
      '  dx = nestX - api.getX(); dy = nestY - api.getY();\n' +
      '  const distToNest = Math.hypot(api.getX() - nestX, api.getY() - nestY);\n' +
      '  if (distToNest < 20) {\n' +
      '    if (carried > 0 && nestEntity && nestEntity.id) {\n' +
      '      api.updateCellAttribute(nestEntity.id, "foodStorage", ((nestEntity.attributes && nestEntity.attributes.foodStorage) || 0) + carried);\n' +
      '    }\n' +
      '    api.setProperty("foodCarried", 0);\n' +
      '    api.setProperty("energy", Math.min(100, (api.getProperty("energy") || 100) + 20));\n' +
      '  }\n' +
      '} else if (nearestAphid) {\n' +
      '  // 有蚜虫 → 先检查附近是否有天敌（瓢虫），有则驱赶；无则守护收集蜜露\n' +
      '  let nearestAphidPredator = null; let predatorDist = Infinity;\n' +
      '  for (let i = 0; i < nearby.length; i++) {\n' +
      '    const n = nearby[i]; const attr = n.attributes || {};\n' +
      '    if (attr.species === "coccinella_septempunctata" || (attr.hostile && attr.species !== "aphid")) {\n' +
      '      const d = Math.hypot(n.x - api.getX(), n.y - api.getY());\n' +
      '      if (d < predatorDist) { predatorDist = d; nearestAphidPredator = n; }\n' +
      '    }\n' +
      '  }\n' +
      '  if (nearestAphidPredator && predatorDist < 80) {\n' +
      '    dx = nearestAphidPredator.x - api.getX(); dy = nearestAphidPredator.y - api.getY();\n' +
      '    if (Math.sqrt(dx*dx+dy*dy) < 15 && api.getFrame() % 120 === 0) {\n' +
      '      api.emitCellEvent(nearestAphidPredator.id, "attack", { damage: api.getProperty("attackPower") || 1, sourceId: api.getProperty("id") });\n' +
      '    }\n' +
      '  } else {\n' +
      '    dx = nearestAphid.x - api.getX(); dy = nearestAphid.y - api.getY();\n' +
      '    const d = Math.hypot(dx, dy);\n' +
      '    if (d < 15 && api.getFrame() % 240 === 0) {\n' +
      '      api.setProperty("foodCarried", Math.min(maxCarry, carried + 6));\n' +
      '    }\n' +
      '  }\n' +
      '} else if (nearestFood) {\n' +
      '  dx = nearestFood.x - api.getX(); dy = nearestFood.y - api.getY();\n' +
      '  const foodDist = Math.hypot(nearestFood.x - api.getX(), nearestFood.y - api.getY());\n' +
      '  if (foodDist < 15 && api.getFrame() % 120 === 0) {\n' +
      '    const energy = nearestFood.attributes ? (nearestFood.attributes.seedEnergy || 8) : 8;\n' +
      '    api.setProperty("foodCarried", Math.min(maxCarry, carried + energy));\n' +
      '    api.destroyCell(nearestFood.id);\n' +
      '  }\n' +
      '} else {\n' +
      '  let dir = api.getProperty("direction") || 0;\n' +
      '  dir += (Math.random() - 0.5) * 0.15;\n' +
      '  dx = Math.cos(dir); dy = Math.sin(dir);\n' +
      '  api.setProperty("direction", dir);\n' +
      '}\n' +
      '\n' +
      'const dist = Math.sqrt(dx*dx + dy*dy) || 1;\n' +
      'api.setPosition(api.getX() + dx/dist * spd, api.getY() + dy/dist * spd);\n';

    // ------ 储粮蚁：守巢+从工蚁接收食物 ------
    const repleteCode =
      '// ========== 储粮蚁行为：守巢+储存食物 ==========\n' +
      'const nestX = api.getProperty("nestX") || 0;\n' +
      'const nestY = api.getProperty("nestY") || 0;\n' +
      'const spd = (api.getProperty("speed") || 0.7) * 0.3;  // 几乎不动\n' +
      '\n' +
      'let dx = 0, dy = 0;\n' +
      'const distToNest = Math.hypot(api.getX() - nestX, api.getY() - nestY);\n' +
      '\n' +
      'if (distToNest > 15) {\n' +
      '  dx = nestX - api.getX();\n' +
      '  dy = nestY - api.getY();\n' +
      '} else if (nearestHostile) {\n' +
      '  // 保护巢穴，战斗\n' +
      '  dx = nearestHostile.x - api.getX();\n' +
      '  dy = nearestHostile.y - api.getY();\n' +
      '  const d = Math.sqrt(dx*dx + dy*dy) || 1;\n' +
      '  if (d < 20 && api.getFrame() % 120 === 0) {\n' +
      '    const atk = api.getProperty("attackPower") || 1;\n' +
      '    api.emitCellEvent(nearestHostile.id, "attack", { damage: atk, sourceId: api.getProperty("id") });\n' +
      '  }\n' +
      '} else {\n' +
      '  // 原地守护\n' +
      '  let dir = api.getProperty("direction") || 0;\n' +
      '  dir += (Math.random() - 0.5) * 0.05;\n' +
      '  api.setProperty("direction", dir);\n' +
      '}\n' +
      '\n' +
      'const dist = Math.sqrt(dx*dx + dy*dy) || 1;\n' +
      'api.setPosition(api.getX() + dx/dist * spd, api.getY() + dy/dist * spd);\n';

    // ------ 默认工蚁行为 ------
    // 根据角色 key 选择行为代码
    switch (role) {
      case 'soldier':
      case 'soldado':
        return sharedCode + soldierCode;
      case 'queen':
      case 'reina':
        return sharedCode + queenCode;
      case 'scout':
      case 'explorador':
        return sharedCode + scoutCode;
      case 'farmer':
      case 'agricultor':
      case 'nurse':
        return sharedCode + farmerCode;
      case 'replete':
      case 'storage':
        return sharedCode + repleteCode;
      default:
        // worker_minor / worker_major / worker 等默认工蚁
        return sharedCode + workerCode;
    }
  }

  // ===== getAntBehaviorCode =====
  function getAntBehaviorCode(speciesKey, roleKey) {
    const sp = ANT_SPECIES[speciesKey];
    if (!sp) return '';
    const role = sp.roles[roleKey] || sp.roles[Object.keys(sp.roles)[0]];

    // ------ 外观绘制代码（通过 api.registerDraw 注册到渲染系统）------
    const drawBody = _getAntDrawCode(speciesKey, roleKey || Object.keys(sp.roles)[0]);
    const drawCode =
      '// =================== 外观绘制 ===================\n' +
      '// 以下代码通过 api.registerDraw 注册到渲染系统\n' +
      '// 只要复制这段代码，新基圆就会呈现同样的蚂蚁外观\n' +
      'api.registerDraw(function(ctx, r) {\n' +
      drawBody.split('\n').map(l => '  ' + l).join('\n') + '\n' +
      '});\n' +
      '\n';

    // ------ 行为逻辑代码 ------
    // 角色行为映射表（控制行为分支）
    const roleBehavior = _getRoleBehavior(roleKey, sp);

    const behaviorCode =
      '// ' + sp.name + ' · ' + role.name + ' — 行为代码（60fps · v4.0 角色分工）\n' +
      '// 每帧移动 ' + sp.speed.toFixed(2) + 'px · 攻击 ' + sp.attackPower.toFixed(1) + '伤害/120帧(2秒) · HP ' + sp.hp + '\n' +
      '// 饱食度 100，每600帧(10秒)-1 → 不觅食约17分钟饿死 · 自然寿命 60-120分钟\n' +
      '\n' +
      'if (!api.getProperty("initialized")) {\n' +
      '  api.setProperty("initialized", true);\n' +
      '  api.setProperty("name", "' + sp.name + '");                 // 名称\n' +
      '  api.setProperty("species", "' + speciesKey + '");            // 物种key\n' +
      '  api.setProperty("role", "' + (roleKey || Object.keys(sp.roles)[0]) + '");  // 角色\n' +
      '  api.setColor("' + (role.color || sp.color) + '");\n' +
      '  api.setKind("creature");                                    // 基圆种类：生物\n' +
      '  api.setRadius(' + (sp.size * role.sizeMul).toFixed(1) + ');\n' +
      '  api.setProperty("speed", ' + (sp.speed * role.speedMul).toFixed(2) + ');\n' +
      '  api.setProperty("attackPower", ' + (sp.attackPower * role.attackMul).toFixed(1) + ');\n' +
      '  api.setProperty("defense", ' + (sp.defense * role.defenseMul).toFixed(2) + ');\n' +
      '  api.setProperty("aggression", ' + sp.aggression + ');\n' +
      '  api.setProperty("maxCarry", ' + Math.round(sp.maxCarry * role.carryMul) + ');\n' +
      '  api.setProperty("hp", ' + sp.hp + ');\n' +
      '  api.setProperty("maxHp", ' + sp.hp + ');\n' +
      '  api.setProperty("energy", 100);  // 饱食度\n' +
      '  api.setProperty("flying", false); // 蚂蚁是地面生物\n' +
      '  api.setProperty("antId", true);     // 标记为蚂蚁（敌对昆虫识别用）\n' +
      '  api.setProperty("colonyId", "A");  // 所属蚁群（不同群为敌对）\n' +
      '  api.setProperty("direction", Math.random() * Math.PI * 2);\n' +
      '  // 角色分工状态\n' +
      '  api.setProperty("antState", "idle");\n' +
      '  api.setProperty("foodCarried", 0);\n' +
      '  api.setProperty("nestX", api.getX());\n' +
      '  api.setProperty("nestY", api.getY());\n' +
      '  api.setProperty("layTimer", 0);\n' +
      '}\n' +
      '\n' +
      '// --- 被攻击：接收伤害并处理死亡 ---\n' +
      'api.on("attack", function(data) {\n' +
      '  if (!data || !data.damage) return;\n' +
      '  const def = api.getProperty("defense") || 0;\n' +
      '  const actualDamage = Math.round(data.damage * (1 - def));\n' +
      '  const newHp = Math.max(0, (api.getProperty("hp") || 30) - actualDamage);\n' +
      '  api.setProperty("hp", newHp);\n' +
      '  if (newHp <= 0) {\n' +
      '    api.destroyCell(api.getProperty("id"));\n' +
      '  }\n' +
      '});\n' +
      '\n' +
      roleBehavior +
      '\n';

    return drawCode + behaviorCode;
  }

  // ===== _getAntDrawCode =====
  function _getAntDrawCode(speciesKey, roleKey) {
    const sp = ANT_SPECIES[speciesKey] || Object.values(ANT_SPECIES)[0];
    const role = roleKey || 'worker';
    const roleDef = sp.roles && sp.roles[role] ? sp.roles[role] : null;
    const bodyColor = sp.color || '#2a1a0e';
    const finalColor = roleDef ? (roleDef.color || bodyColor) : bodyColor;

    // --- shadeColor 内联辅助 ---
    const shadeFn = 'const _sh=function(h,p){if(!h)return"#555";if(h.length===4)h="#"+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];if(h.length!==7)return h;const n=parseInt(h.slice(1),16);let r=(n>>16)+p*2.55,g=((n>>8)&0xff)+p*2.55,b=(n&0xff)+p*2.55;r=Math.max(0,Math.min(255,Math.round(r)));g=Math.max(0,Math.min(255,Math.round(g)));b=Math.max(0,Math.min(255,Math.round(b)));return"#"+((r<<16)|(g<<8)|b).toString(16).padStart(6,"0");};';

    // --- 绘制一条完整蚂蚁腿的辅助函数（内联为函数字符串）---
    const drawLegFn =
      'function drawAntLeg(startX,startY,angle,lenScale,side){\n' +
      '  const s=side<0?-1:1;const baseAngle=angle*s;\n' +
      '  const femurLen=legLen*0.4*lenScale;const femurAngle=baseAngle+s*0.4;\n' +
      '  const femurEndX=startX+Math.cos(femurAngle)*femurLen;const femurEndY=startY+Math.sin(femurAngle)*femurLen;\n' +
      '  ctx.strokeStyle=legColor;ctx.lineWidth=Math.max(1.0,r*0.055);ctx.lineCap="round";\n' +
      '  ctx.beginPath();ctx.moveTo(startX,startY);ctx.lineTo(femurEndX,femurEndY);ctx.stroke();\n' +
      '  ctx.fillStyle=_sh(legColor,-15);\n' +
      '  ctx.beginPath();ctx.arc(femurEndX,femurEndY,jointR*0.8,0,Math.PI*2);ctx.fill();\n' +
      '  const tibiaLen=legLen*0.45*lenScale;const tibiaAngle=baseAngle+s*(0.9+lenScale*0.2);\n' +
      '  const tibiaEndX=femurEndX+Math.cos(tibiaAngle)*tibiaLen;const tibiaEndY=femurEndY+Math.sin(tibiaAngle)*tibiaLen;\n' +
      '  ctx.strokeStyle=_sh(legColor,-10);ctx.lineWidth=Math.max(0.8,r*0.045);\n' +
      '  ctx.beginPath();ctx.moveTo(femurEndX,femurEndY);ctx.lineTo(tibiaEndX,tibiaEndY);ctx.stroke();\n' +
      '  const tarsusLen=legLen*0.2*lenScale;\n' +
      '  const t1Angle=tibiaAngle+s*0.15;const t2Angle=t1Angle+s*0.1;const t3Angle=t2Angle+s*0.15;\n' +
      '  const t1X=tibiaEndX+Math.cos(t1Angle)*tarsusLen*0.4;const t1Y=tibiaEndY+Math.sin(t1Angle)*tarsusLen*0.4;\n' +
      '  const t2X=t1X+Math.cos(t2Angle)*tarsusLen*0.3;const t2Y=t1Y+Math.sin(t2Angle)*tarsusLen*0.3;\n' +
      '  const t3X=t2X+Math.cos(t3Angle)*tarsusLen*0.3;const t3Y=t2Y+Math.sin(t3Angle)*tarsusLen*0.3;\n' +
      '  ctx.strokeStyle=_sh(legColor,-20);ctx.lineWidth=Math.max(0.6,r*0.03);\n' +
      '  ctx.beginPath();ctx.moveTo(tibiaEndX,tibiaEndY);ctx.lineTo(t1X,t1Y);ctx.lineTo(t2X,t2Y);ctx.lineTo(t3X,t3Y);ctx.stroke();\n' +
      '  const clawAngle1=t3Angle+s*0.3;const clawAngle2=t3Angle-s*0.3;const clawLen=tarsusLen*0.25;\n' +
      '  ctx.strokeStyle="#1a1a1a";ctx.lineWidth=Math.max(0.5,r*0.025);\n' +
      '  ctx.beginPath();ctx.moveTo(t3X,t3Y);ctx.lineTo(t3X+Math.cos(clawAngle1)*clawLen,t3Y+Math.sin(clawAngle1)*clawLen);\n' +
      '  ctx.moveTo(t3X,t3Y);ctx.lineTo(t3X+Math.cos(clawAngle2)*clawLen,t3Y+Math.sin(clawAngle2)*clawLen);ctx.stroke();\n' +
      '}\n';

    // --- 角色标志（兵蚁/侦察蚁有明显颚刺）---
    let jawCode = '';
    if (role === 'soldier' || role === 'scout') {
      jawCode =
        'ctx.strokeStyle=_sh("' + finalColor + '",-50);ctx.lineWidth=Math.max(1.0,r*0.07);\n' +
        'ctx.beginPath();ctx.moveTo(-headR*1.5,-headR*0.15);ctx.lineTo(-headR*2.3,-headR*0.5);ctx.stroke();\n' +
        'ctx.beginPath();ctx.moveTo(-headR*1.5,headR*0.15);ctx.lineTo(-headR*2.3,headR*0.5);ctx.stroke();\n';
    }

    // --- 组装绘制代码 ---
    const body =
      shadeFn +
      '// ------ 蚂蚁外观：3对足 + 头+胸+腹 + 触角 + 眼睛 ------\n' +
      'const bodyColor="' + bodyColor + '";const legColor=bodyColor;\n' +
      'const headR=r*0.35;const thoraxR=r*0.30;const abdomenR=r*0.45;const gap=r*0.15;\n' +
      'const jointR=Math.max(1.2,r*0.06);\n' +
      // 外阴影
      'ctx.save();ctx.globalAlpha=0.25;ctx.fillStyle="#000";\n' +
      'ctx.beginPath();ctx.ellipse(0,r*0.15,r*1.1,r*0.45,0,0,Math.PI*2);ctx.fill();ctx.restore();\n' +
      // drawAntLeg 辅助函数
      drawLegFn +
      'const legLen=r*0.85;\n' +
      // 前足
      'drawAntLeg(gap*0.1,-r*0.05,-Math.PI/3,0.7,-1);\n' +
      'drawAntLeg(gap*0.1,r*0.05,Math.PI/3,0.7,1);\n' +
      // 中足
      'drawAntLeg(gap*0.3,-r*0.05,-Math.PI/2.5,0.85,-1);\n' +
      'drawAntLeg(gap*0.3,r*0.05,Math.PI/2.5,0.85,1);\n' +
      // 后足
      'drawAntLeg(gap*0.5,-r*0.05,-Math.PI/2.2,1.0,-1);\n' +
      'drawAntLeg(gap*0.5,r*0.05,Math.PI/2.2,1.0,1);\n' +
      // 腹部
      'ctx.fillStyle="' + finalColor + '";\n' +
      'ctx.beginPath();ctx.ellipse(gap*0.8,0,abdomenR,abdomenR*0.82,0,0,Math.PI*2);ctx.fill();\n' +
      'ctx.strokeStyle=_sh("' + finalColor + '",-35);ctx.lineWidth=Math.max(0.8,r*0.04);\n' +
      'for(let i=1;i<=3;i++){const segX=gap*0.8-abdomenR*0.5+(i-1)*abdomenR*0.3;\n' +
      '  ctx.beginPath();ctx.moveTo(segX,-abdomenR*0.6);ctx.lineTo(segX,abdomenR*0.6);ctx.stroke();\n' +
      '}\n' +
      // 胸部
      'ctx.fillStyle=_sh("' + finalColor + '",-20);\n' +
      'ctx.beginPath();ctx.arc(gap*0.15,0,thoraxR,0,Math.PI*2);ctx.fill();\n' +
      // 头部
      'ctx.fillStyle="' + finalColor + '";\n' +
      'ctx.beginPath();ctx.arc(-headR*0.9,0,headR,0,Math.PI*2);ctx.fill();\n' +
      // 触角
      'ctx.strokeStyle=_sh("' + finalColor + '",-30);ctx.lineWidth=Math.max(0.8,r*0.04);\n' +
      'ctx.beginPath();ctx.moveTo(-headR*1.1,-headR*0.4);\n' +
      'ctx.quadraticCurveTo(-headR*1.8,-headR*0.9,-headR*2.1,-headR*1.3);ctx.stroke();\n' +
      'ctx.beginPath();ctx.moveTo(-headR*1.1,headR*0.4);\n' +
      'ctx.quadraticCurveTo(-headR*1.8,headR*0.9,-headR*2.1,headR*1.3);ctx.stroke();\n' +
      // 眼睛
      'ctx.fillStyle="#ffffff";\n' +
      'ctx.beginPath();ctx.arc(-headR*0.8,-headR*0.35,r*0.05,0,Math.PI*2);ctx.fill();\n' +
      'ctx.beginPath();ctx.arc(-headR*0.8,headR*0.35,r*0.05,0,Math.PI*2);ctx.fill();\n' +
      // 颚刺
      jawCode +
      // 边缘高光
      'ctx.strokeStyle="rgba(255,255,255,0.15)";ctx.lineWidth=0.8;\n' +
      'ctx.beginPath();ctx.ellipse(gap*0.8,0,abdomenR*0.95,abdomenR*0.78,0,0,Math.PI*2);ctx.stroke();\n';

    return body;
  }

  // ===== 导出蚂蚁相关 API =====
  F.getAntBehaviorCode = getAntBehaviorCode;
  F._getRoleBehavior = _getRoleBehavior;
  F._getAntDrawCode = _getAntDrawCode;

  // 兼容顶层调用
  global.getAntBehaviorCode = getAntBehaviorCode;

})(typeof window !== 'undefined' ? window : globalThis);
