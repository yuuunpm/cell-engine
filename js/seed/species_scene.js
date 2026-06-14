// ================================================================
// species_scene.js - 场景对象 + 地图预设 + 外观绘制
// 依赖: species_core.js (提供 ANT_SPECIES, PLANT_SPECIES, INSECT_SPECIES, SCENE_OBJECT_TYPES)
// ================================================================
(function (global) {
  'use strict';

  const D = global._SpeciesData;
  const F = global._SpeciesFns;
  const ANT_SPECIES = D.ANT_SPECIES;
  const PLANT_SPECIES = D.PLANT_SPECIES;
  const INSECT_SPECIES = D.INSECT_SPECIES;
  const SCENE_OBJECT_TYPES = D.SCENE_OBJECT_TYPES;

  // ===== getSceneObjectBehaviorCode =====
  function getSceneObjectBehaviorCode(sceneType) {
    const meta = SCENE_OBJECT_TYPES[sceneType];
    const name = meta ? meta.name : '场景';
    const color = meta ? meta.color : '#888888';

    if (sceneType === 'nest') {
      return '// =================== 基本属性（属性面板参数定义）===================\n'
        + '// 蚁巢 — 场景基圆代码（v5.0）\n'
        + '// 工蚁将食物搬运至此存入 foodStorage；兵蚁受伤后来此回血\n'
        + '\n'
        + 'if (!api.getProperty("initialized")) {\n'
        + '  api.setProperty("initialized", true);\n'
        + '  api.setProperty("name", "蚁巢");\n'
        + '  api.setProperty("sceneType", "nest");\n'
        + '  api.setKind("static");\n'
        + '  api.setColor("#8b5a2b");\n'
        + '  api.setProperty("isNest", true);          // 工蚁/兵蚁/蚁后识别标记\n'
        + '  api.setProperty("colonyId", "A");         // 所属蚁群\n'
        + '  api.setProperty("foodStorage", 0);        // 累积存储的食物能量\n'
        + '  api.setProperty("population", 0);         // 本巢蚂蚁数量\n'
        + '}\n'
        + '\n'
        + '// =================== 外观绘制 ===================\n'
        + 'if (!api.getProperty("_drawRegistered")) {\n'
        + '  api.setProperty("_drawRegistered", true);\n'
        + '  api.registerDraw(function (ctx, r) {\n'
        + '    const shade = (hex, p) => {\n'
        + '      if (!hex) return "#888";\n'
        + '      if (hex.length === 4) hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];\n'
        + '      if (hex.length !== 7) return hex;\n'
        + '      const n = parseInt(hex.slice(1), 16);\n'
        + '      let rr = (n >> 16) + p * 2.55, gg = ((n >> 8) & 0xff) + p * 2.55, bb = (n & 0xff) + p * 2.55;\n'
        + '      rr = Math.max(0, Math.min(255, Math.round(rr)));\n'
        + '      gg = Math.max(0, Math.min(255, Math.round(gg)));\n'
        + '      bb = Math.max(0, Math.min(255, Math.round(bb)));\n'
        + '      return "#" + ((rr << 16) | (gg << 8) | bb).toString(16).padStart(6, "0");\n'
        + '    };\n'
        + '    const c = api.getProperty("color") || "#8b5a2b";\n'
        + '    ctx.save();\n'
        + '    ctx.fillStyle = shade(c, -35);\n'
        + '    ctx.beginPath();\n'
        + '    ctx.ellipse(0, 0, r * 1.05, r * 0.78, 0, 0, Math.PI * 2);\n'
        + '    ctx.fill();\n'
        + '    const grad = ctx.createRadialGradient(-r * 0.1, -r * 0.15, r * 0.1, 0, 0, r * 0.92);\n'
        + '    grad.addColorStop(0, shade(c, 25));\n'
        + '    grad.addColorStop(0.55, c);\n'
        + '    grad.addColorStop(1, shade(c, -25));\n'
        + '    ctx.fillStyle = grad;\n'
        + '    ctx.beginPath();\n'
        + '    ctx.ellipse(0, 0, r * 0.92, r * 0.7, 0, 0, Math.PI * 2);\n'
        + '    ctx.fill();\n'
        + '    ctx.fillStyle = "#1a0e05";\n'
        + '    ctx.beginPath();\n'
        + '    ctx.ellipse(0, -r * 0.05, r * 0.18, r * 0.12, 0, 0, Math.PI * 2);\n'
        + '    ctx.fill();\n'
        + '    ctx.fillStyle = "rgba(0,0,0,0.45)";\n'
        + '    ctx.beginPath();\n'
        + '    ctx.ellipse(r * 0.04, -r * 0.02, r * 0.08, r * 0.05, 0, 0, Math.PI * 2);\n'
        + '    ctx.fill();\n'
        + '    ctx.fillStyle = shade(c, -20);\n'
        + '    const spk = [[-0.55, -0.15, 1.8], [0.45, -0.1, 1.6], [-0.4, 0.35, 1.6], [0.35, 0.3, 1.4], [-0.15, -0.45, 1.3], [0.18, -0.4, 1.2], [-0.6, 0.15, 1.2], [0.55, 0.1, 1.3], [-0.2, 0.45, 1.3], [0.22, 0.48, 1.2]];\n'
        + '    for (let i = 0; i < spk.length; i++) {\n'
        + '      ctx.beginPath();\n'
        + '      ctx.arc(spk[i][0] * r, spk[i][1] * r, spk[i][2], 0, Math.PI * 2);\n'
        + '      ctx.fill();\n'
        + '    }\n'
        + '    ctx.fillStyle = "rgba(255,235,180,0.35)";\n'
        + '    ctx.beginPath();\n'
        + '    ctx.ellipse(-r * 0.18, -r * 0.35, r * 0.3, r * 0.08, -0.2, 0, Math.PI * 2);\n'
        + '    ctx.fill();\n'
        + '    const food = api.getProperty("foodStorage") || 0;\n'
        + '    if (food > 0) {\n'
        + '      ctx.fillStyle = "#7ac050";\n'
        + '      ctx.beginPath();\n'
        + '      ctx.arc(r * 0.55, -r * 0.55, 4, 0, Math.PI * 2);\n'
        + '      ctx.fill();\n'
        + '      ctx.strokeStyle = "#2a4a20";\n'
        + '      ctx.lineWidth = 1;\n'
        + '      ctx.stroke();\n'
        + '    }\n'
        + '    ctx.restore();\n'
        + '  });\n'
        + '}\n';
    }
    if (sceneType === 'rock') {
      return '// =================== 基本属性（属性面板参数定义）===================\n'
        + '// 岩石/石块 — 场景基圆代码（v5.0）\n'
        + '// 以下属性定义同步更新属性面板的基本信息\n'
        + '\n'
        + 'if (api.getFrame() === 1) {\n'
        + '  api.setProperty("name", "岩石");          // 名称\n'
        + '  api.setProperty("sceneType", "rock");    // 场景类型\n'
        + '  api.setKind("static");                   // 基圆种类：静态物体\n'
        + '  api.setProperty("hardness", 0.8);        // 硬度（影响蚂蚁能否挖掘）\n'
        + '  api.setColor("' + color + '");          // 颜色\n'
        + '}\n'
        + '\n'
        + '// =================== 外观绘制 ===================\n'
        + 'if (!api.getProperty("_drawRegistered")) {\n'
        + '  api.setProperty("_drawRegistered", true);\n'
        + '  api.registerDraw(function(ctx, r) {\n'
        + '    const c = api.getProperty("color") || "' + color + '";\n'
        + '    const shade = (hex, p) => {\n'
        + '      if (!hex) return "#555";\n'
        + '      if (hex.length === 4) hex = "#" + hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];\n'
        + '      if (hex.length !== 7) return hex;\n'
        + '      const n = parseInt(hex.slice(1), 16);\n'
        + '      let rr = (n >> 16) + p * 2.55, gg = ((n >> 8) & 0xff) + p * 2.55, bb = (n & 0xff) + p * 2.55;\n'
        + '      rr = Math.max(0, Math.min(255, Math.round(rr))); gg = Math.max(0, Math.min(255, Math.round(gg))); bb = Math.max(0, Math.min(255, Math.round(bb)));\n'
        + '      return "#" + ((rr << 16) | (gg << 8) | bb).toString(16).padStart(6, "0");\n'
        + '    };\n'
        + '    ctx.save();\n'
        + '    const points = 14;\n'
        + '    const baseAngles = [0.9, 1.1, 0.85, 1.15, 0.95, 1.05, 0.88, 1.12, 0.92, 1.08, 0.86, 1.1, 0.94, 1.02];\n'
        + '    ctx.fillStyle = c;\n'
        + '    ctx.strokeStyle = shade(c, -45);\n'
        + '    ctx.lineWidth = 2;\n'
        + '    ctx.beginPath();\n'
        + '    for (let i = 0; i < points; i++) {\n'
        + '      const ang = (i / points) * Math.PI * 2;\n'
        + '      const rr = r * baseAngles[i] * 0.92;\n'
        + '      const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;\n'
        + '      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);\n'
        + '    }\n'
        + '    ctx.closePath();\n'
        + '    ctx.fill();\n'
        + '    ctx.stroke();\n'
        + '    // 左侧阴影\n'
        + '    ctx.fillStyle = "rgba(0,0,0,0.18)";\n'
        + '    ctx.beginPath();\n'
        + '    for (let i = 0; i < points; i++) {\n'
        + '      const ang = (i / points) * Math.PI * 2;\n'
        + '      const rr = r * baseAngles[i] * 0.92;\n'
        + '      const px = Math.cos(ang) * rr * 0.95 + r * 0.08, py = Math.sin(ang) * rr * 0.92 + r * 0.1;\n'
        + '      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);\n'
        + '    }\n'
        + '    ctx.closePath();\n'
        + '    ctx.fill();\n'
        + '    // 顶部高光\n'
        + '    ctx.fillStyle = "rgba(255,255,255,0.25)";\n'
        + '    ctx.beginPath();\n'
        + '    ctx.ellipse(-r * 0.2, -r * 0.35, r * 0.38, r * 0.18, -0.35, 0, Math.PI * 2);\n'
        + '    ctx.fill();\n'
        + '    // 次级高光\n'
        + '    ctx.fillStyle = "rgba(255,255,255,0.12)";\n'
        + '    ctx.beginPath();\n'
        + '    ctx.ellipse(r * 0.15, -r * 0.2, r * 0.2, r * 0.1, 0.2, 0, Math.PI * 2);\n'
        + '    ctx.fill();\n'
        + '    // 裂纹\n'
        + '    ctx.strokeStyle = shade(c, -55);\n'
        + '    ctx.lineWidth = 1.3;\n'
        + '    ctx.beginPath();\n'
        + '    ctx.moveTo(-r * 0.3, -r * 0.1); ctx.lineTo(r * 0.05, r * 0.25); ctx.lineTo(r * 0.3, r * 0.1);\n'
        + '    ctx.moveTo(-r * 0.5, r * 0.15); ctx.lineTo(-r * 0.15, r * 0.4); ctx.lineTo(r * 0.1, r * 0.55);\n'
        + '    ctx.moveTo(-r * 0.05, -r * 0.5); ctx.lineTo(r * 0.05, -r * 0.05);\n'
        + '    ctx.stroke();\n'
        + '    // 表面颗粒\n'
        + '    ctx.fillStyle = shade(c, -25);\n'
        + '    const spk = [[-0.25, -0.05], [0.3, 0.2], [-0.4, -0.2], [0.2, -0.4], [-0.1, 0.35], [0.45, -0.1]];\n'
        + '    for (const [sx, sy] of spk) { ctx.beginPath(); ctx.arc(sx * r, sy * r, 1.8, 0, Math.PI * 2); ctx.fill(); }\n'
        + '    ctx.restore();\n'
        + '  });\n'
        + '}\n';
    }

    if (sceneType === 'water') {
      return '// =================== 基本属性（属性面板参数定义）===================\n'
        + '// 小水塘/水源 — 场景基圆代码（v5.0）\n'
        + '// 以下属性定义同步更新属性面板的基本信息\n'
        + '\n'
        + 'if (api.getFrame() === 1) {\n'
        + '  api.setProperty("name", "水源");           // 名称\n'
        + '  api.setProperty("sceneType", "water");     // 场景类型\n'
        + '  api.setKind("static");                     // 基圆种类：静态物体\n'
        + '  api.setProperty("hydration", 100);        // 水分值（蚂蚁补充用）\n'
        + '  api.setProperty("energy", 200);           // 能量值\n'
        + '  api.setColor("' + color + '");           // 颜色\n'
        + '}\n'
        + '\n'
        + '// =================== 外观绘制 ===================\n'
        + 'if (!api.getProperty("_drawRegistered")) {\n'
        + '  api.setProperty("_drawRegistered", true);\n'
        + '  api.registerDraw(function(ctx, r) {\n'
        + '    ctx.save();\n'
        + '    // 外层湿土边\n'
        + '    ctx.fillStyle = "rgba(60,75,65,0.4)";\n'
        + '    ctx.beginPath();\n'
        + '    ctx.ellipse(0, 0, r * 1.02, r * 0.78, 0.1, 0, Math.PI * 2);\n'
        + '    ctx.fill();\n'
        + '    // 水体径向渐变\n'
        + '    const mainGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.15, r * 0.1, 0, 0, r * 0.95);\n'
        + '    mainGrad.addColorStop(0, "#7fb8c4");\n'
        + '    mainGrad.addColorStop(0.5, "#4a8ea5");\n'
        + '    mainGrad.addColorStop(1, "#2f5f75");\n'
        + '    ctx.fillStyle = mainGrad;\n'
        + '    // 不规则椭圆水体\n'
        + '    ctx.beginPath();\n'
        + '    const waterPts = 12;\n'
        + '    const ratios = [1.0, 0.95, 0.92, 0.98, 1.02, 0.94, 0.96, 1.0, 0.97, 0.93, 1.01, 0.98];\n'
        + '    for (let i = 0; i < waterPts; i++) {\n'
        + '      const ang = (i / waterPts) * Math.PI * 2 + 0.1;\n'
        + '      const rr = r * ratios[i] * 0.93;\n'
        + '      const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr * 0.72;\n'
        + '      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);\n'
        + '    }\n'
        + '    ctx.closePath();\n'
        + '    ctx.fill();\n'
        + '    // 天空反光\n'
        + '    ctx.fillStyle = "rgba(200,230,240,0.35)";\n'
        + '    ctx.beginPath();\n'
        + '    ctx.ellipse(-r * 0.25, -r * 0.35, r * 0.3, r * 0.06, 0.1, 0, Math.PI * 2);\n'
        + '    ctx.fill();\n'
        + '    ctx.fillStyle = "rgba(180,210,225,0.25)";\n'
        + '    ctx.beginPath();\n'
        + '    ctx.ellipse(r * 0.2, -r * 0.15, r * 0.15, r * 0.04, -0.1, 0, Math.PI * 2);\n'
        + '    ctx.fill();\n'
        + '    // 同心水纹\n'
        + '    ctx.strokeStyle = "rgba(200,220,230,0.35)";\n'
        + '    ctx.lineWidth = 1;\n'
        + '    for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r * i * 0.28, r * i * 0.2, 0.1, 0, Math.PI * 2); ctx.stroke(); }\n'
        + '    // 波纹亮点\n'
        + '    ctx.fillStyle = "rgba(255,255,255,0.4)";\n'
        + '    const spk = [[-0.35, -0.2, 2], [0.25, -0.3, 1.5], [-0.1, 0.15, 1.5], [0.4, 0.25, 2]];\n'
        + '    for (const [sx, sy, sr] of spk) { ctx.beginPath(); ctx.arc(sx * r, sy * r, sr, 0, Math.PI * 2); ctx.fill(); }\n'
        + '    ctx.restore();\n'
        + '  });\n'
        + '}\n';
    }

    if (sceneType === 'wood') {
      return '// =================== 基本属性（属性面板参数定义）===================\n'
        + '// 朽木/枯木 — 场景基圆代码（v5.0）\n'
        + '// 以下属性定义同步更新属性面板的基本信息\n'
        + '\n'
        + 'if (api.getFrame() === 1) {\n'
        + '  api.setProperty("name", "朽木");          // 名称\n'
        + '  api.setProperty("sceneType", "wood");     // 场景类型\n'
        + '  api.setKind("static");                    // 基圆种类：静态物体\n'
        + '  api.setProperty("hardness", 0.4);        // 硬度\n'
        + '  api.setColor("' + color + '");          // 颜色\n'
        + '}\n'
        + '\n'
        + '// =================== 外观绘制 ===================\n'
        + 'if (!api.getProperty("_drawRegistered")) {\n'
        + '  api.setProperty("_drawRegistered", true);\n'
        + '  api.registerDraw(function(ctx, r) {\n'
        + '    const c = api.getProperty("color") || "' + color + '";\n'
        + '    const shade = (hex, p) => {\n'
        + '      if (!hex) return "#555";\n'
        + '      if (hex.length === 4) hex = "#" + hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];\n'
        + '      if (hex.length !== 7) return hex;\n'
        + '      const n = parseInt(hex.slice(1), 16);\n'
        + '      let rr = (n >> 16) + p * 2.55, gg = ((n >> 8) & 0xff) + p * 2.55, bb = (n & 0xff) + p * 2.55;\n'
        + '      rr = Math.max(0, Math.min(255, Math.round(rr))); gg = Math.max(0, Math.min(255, Math.round(gg))); bb = Math.max(0, Math.min(255, Math.round(bb)));\n'
        + '      return "#" + ((rr << 16) | (gg << 8) | bb).toString(16).padStart(6, "0");\n'
        + '    };\n'
        + '    ctx.fillStyle = c;\n'
        + '    ctx.strokeStyle = shade(c, -40);\n'
        + '    ctx.lineWidth = 2;\n'
        + '    ctx.beginPath();\n'
        + '    ctx.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);\n'
        + '    ctx.fill();\n'
        + '    ctx.stroke();\n'
        + '    // 年轮\n'
        + '    ctx.strokeStyle = shade(c, -25);\n'
        + '    ctx.lineWidth = 1;\n'
        + '    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r * (1 - i * 0.18), r * (0.45 - i * 0.08), 0, 0, Math.PI * 2); ctx.stroke(); }\n'
        + '    // 中央裂纹\n'
        + '    ctx.strokeStyle = shade(c, -55);\n'
        + '    ctx.lineWidth = 1.5;\n'
        + '    ctx.beginPath();\n'
        + '    ctx.moveTo(-r * 0.85, 0); ctx.lineTo(r * 0.7, 0);\n'
        + '    ctx.stroke();\n'
        + '  });\n'
        + '}\n';
    }

    if (sceneType === 'sand') {
      return '// =================== 基本属性（属性面板参数定义）===================\n'
        + '// 沙地凹陷/蚁狮陷阱 — 场景基圆代码（v5.0）\n'
        + '// 以下属性定义同步更新属性面板的基本信息\n'
        + '\n'
        + 'if (api.getFrame() === 1) {\n'
        + '  api.setProperty("name", "沙地陷阱");     // 名称\n'
        + '  api.setProperty("sceneType", "sand");      // 场景类型\n'
        + '  api.setKind("static");                   // 基圆种类：静态物体\n'
        + '  api.setProperty("hardness", 0.1);        // 沙质松软\n'
        + '  api.setColor("' + color + '");          // 颜色\n'
        + '}\n'
        + '\n'
        + '// =================== 外观绘制 ===================\n'
        + 'if (!api.getProperty("_drawRegistered")) {\n'
        + '  api.setProperty("_drawRegistered", true);\n'
        + '  api.registerDraw(function(ctx, r) {\n'
        + '    const c = api.getProperty("color") || "' + color + '";\n'
        + '    const shade = (hex, p) => {\n'
        + '      if (!hex) return "#aa8855";\n'
        + '      if (hex.length === 4) hex = "#" + hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];\n'
        + '      if (hex.length !== 7) return hex;\n'
        + '      const n = parseInt(hex.slice(1), 16);\n'
        + '      let rr = (n >> 16) + p * 2.55, gg = ((n >> 8) & 0xff) + p * 2.55, bb = (n & 0xff) + p * 2.55;\n'
        + '      rr = Math.max(0, Math.min(255, Math.round(rr))); gg = Math.max(0, Math.min(255, Math.round(gg))); bb = Math.max(0, Math.min(255, Math.round(bb)));\n'
        + '      return "#" + ((rr << 16) | (gg << 8) | bb).toString(16).padStart(6, "0");\n'
        + '    };\n'
        + '    // 固定散沙粒位置（避免每帧抖动）\n'
        + '    const seed = 42;\n'
        + '    const rand = (i) => {\n'
        + '      const x = Math.sin(i * 12.9898 + seed) * 43758.5453;\n'
        + '      return x - Math.floor(x);\n'
        + '    };\n'
        + '    ctx.fillStyle = c;\n'
        + '    ctx.beginPath();\n'
        + '    ctx.ellipse(0, 0, r * 0.95, r * 0.7, 0, 0, Math.PI * 2);\n'
        + '    ctx.fill();\n'
        + '    // 深色沙粒\n'
        + '    ctx.fillStyle = shade(c, -30);\n'
        + '    for (let i = 0; i < 25; i++) {\n'
        + '      const ang = rand(i + 1) * Math.PI * 2;\n'
        + '      const dist = rand(i + 100) * r * 0.8;\n'
        + '      ctx.beginPath();\n'
        + '      ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 1.0, 0, Math.PI * 2);\n'
        + '      ctx.fill();\n'
        + '    }\n'
        + '    // 高光沙粒\n'
        + '    ctx.fillStyle = "rgba(255,235,180,0.5)";\n'
        + '    for (let i = 0; i < 8; i++) {\n'
        + '      const ang = rand(i + 200) * Math.PI * 2;\n'
        + '      const dist = rand(i + 300) * r * 0.7;\n'
        + '      ctx.beginPath();\n'
        + '      ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 1.2, 0, Math.PI * 2);\n'
        + '      ctx.fill();\n'
        + '    }\n'
        + '  });\n'
        + '}\n';
    }

    return '// =================== 基本属性（属性面板参数定义）===================\n'
      + '// ' + name + ' — 场景基圆代码\n'
      + 'if (api.getFrame() === 1) {\n'
      + '  api.setProperty("name", "' + name + '");\n'
      + '  api.setProperty("sceneType", "' + sceneType + '");\n'
      + '  api.setKind("static");                   // 基圆种类：静态物体\n'
      + '  api.setColor("' + color + '");\n'
      + '}\n';
  }

  // ===== drawSpeciesAppearance =====
  function drawSpeciesAppearance(ctx, r, cell) {
    const attr = cell.attributes || {};
    const speciesKey = attr.species || '';
    const kind = attr.kind || cell.kind || '';

    // 1. 昆虫（含蚂蚁？）— 先查 INSECT_SPECIES
    if (INSECT_SPECIES[speciesKey]) {
      _drawInsectAppearance(ctx, r, cell, speciesKey);
      return true;
    }
    // 2. 植物 — PLANT_SPECIES
    if (PLANT_SPECIES[speciesKey]) {
      _drawPlantAppearance(ctx, r, cell, speciesKey);
      return true;
    }
    // 3. 蚂蚁（ant）— 绘制"蚂蚁抽象形状"（分节身体+ 腿+触角）
    if (kind === 'ant' || attr.antId || ANT_SPECIES[speciesKey]) {
      _drawAntAppearance(ctx, r, cell, speciesKey);
      return true;
    }
    // 4. 场景对象（岩石/水/木头）
    if (attr.sceneType || SCENE_OBJECT_TYPES[attr.sceneType]) {
      _drawSceneObject(ctx, r, cell, attr.sceneType);
      return true;
    }
    return false; // 交给 renderBridge 的默认绘制
  }

  // ===== _drawAntAppearance =====
  function _drawAntAppearance(ctx, r, cell, speciesKey) {
    const sp = ANT_SPECIES[speciesKey] || Object.values(ANT_SPECIES)[0];
    const attr = cell.attributes || {};
    const bodyColor = attr.color || sp.color || '#2a1a0e';
    const role = attr.role || 'worker';
    const roleDef = sp.roles && sp.roles[role] ? sp.roles[role] : null;
    const finalColor = roleDef ? (roleDef.color || bodyColor) : bodyColor;

    // 身体从左（头）到右（腹）—— 基圆朝向：+X 方向为前方
    const headR = r * 0.35;
    const thoraxR = r * 0.30;
    const abdomenR = r * 0.45;
    const gap = r * 0.15;

    // 外阴影（轻微投影感）
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.15, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- 3 对足（每条腿：髋+股+胫+跗节+爪，更逼真的蚂蚁腿部结构） ---
    const legColor = bodyColor;
    const jointR = Math.max(1.2, r * 0.06);

    // 绘制一条完整蚂蚁腿的辅助函数
    function drawAntLeg(startX, startY, angle, lenScale, side) {
      const s = side < 0 ? -1 : 1;
      const baseAngle = angle * s;

      // 股骨（前足较短，后足最长）
      const femurLen = legLen * 0.4 * lenScale;
      const femurAngle = baseAngle + s * 0.4;
      const femurEndX = startX + Math.cos(femurAngle) * femurLen;
      const femurEndY = startY + Math.sin(femurAngle) * femurLen;

      ctx.strokeStyle = legColor;
      ctx.lineWidth = Math.max(1.0, r * 0.055);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(femurEndX, femurEndY);
      ctx.stroke();

      // 膝关节（弯折点）
      ctx.fillStyle = _shadeColor(legColor, -15);
      ctx.beginPath();
      ctx.arc(femurEndX, femurEndY, jointR * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // 胫骨（倾斜向后）
      const tibiaLen = legLen * 0.45 * lenScale;
      const tibiaAngle = baseAngle + s * (0.9 + lenScale * 0.2);
      const tibiaEndX = femurEndX + Math.cos(tibiaAngle) * tibiaLen;
      const tibiaEndY = femurEndY + Math.sin(tibiaAngle) * tibiaLen;

      ctx.strokeStyle = _shadeColor(legColor, -10);
      ctx.lineWidth = Math.max(0.8, r * 0.045);
      ctx.beginPath();
      ctx.moveTo(femurEndX, femurEndY);
      ctx.lineTo(tibiaEndX, tibiaEndY);
      ctx.stroke();

      // 跗节（3 节小段 + 钩爪）
      const tarsusLen = legLen * 0.2 * lenScale;
      const t1Angle = tibiaAngle + s * 0.15;
      const t2Angle = t1Angle + s * 0.1;
      const t3Angle = t2Angle + s * 0.15;

      const t1X = tibiaEndX + Math.cos(t1Angle) * tarsusLen * 0.4;
      const t1Y = tibiaEndY + Math.sin(t1Angle) * tarsusLen * 0.4;
      const t2X = t1X + Math.cos(t2Angle) * tarsusLen * 0.3;
      const t2Y = t1Y + Math.sin(t2Angle) * tarsusLen * 0.3;
      const t3X = t2X + Math.cos(t3Angle) * tarsusLen * 0.3;
      const t3Y = t2Y + Math.sin(t3Angle) * tarsusLen * 0.3;

      ctx.strokeStyle = _shadeColor(legColor, -20);
      ctx.lineWidth = Math.max(0.6, r * 0.03);
      ctx.beginPath();
      ctx.moveTo(tibiaEndX, tibiaEndY);
      ctx.lineTo(t1X, t1Y);
      ctx.lineTo(t2X, t2Y);
      ctx.lineTo(t3X, t3Y);
      ctx.stroke();

      // 爪尖（两个小钩）
      const clawAngle1 = t3Angle + s * 0.3;
      const clawAngle2 = t3Angle - s * 0.3;
      const clawLen = tarsusLen * 0.25;
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = Math.max(0.5, r * 0.025);
      ctx.beginPath();
      ctx.moveTo(t3X, t3Y);
      ctx.lineTo(t3X + Math.cos(clawAngle1) * clawLen, t3Y + Math.sin(clawAngle1) * clawLen);
      ctx.moveTo(t3X, t3Y);
      ctx.lineTo(t3X + Math.cos(clawAngle2) * clawLen, t3Y + Math.sin(clawAngle2) * clawLen);
      ctx.stroke();
    }

    const legLen = r * 0.85;
    // 前足对（最短，斜向前伸出）
    drawAntLeg(gap * 0.1, -r * 0.05, -Math.PI / 3, 0.7, -1);
    drawAntLeg(gap * 0.1, r * 0.05, Math.PI / 3, 0.7, 1);
    // 中足对
    drawAntLeg(gap * 0.3, -r * 0.05, -Math.PI / 2.5, 0.85, -1);
    drawAntLeg(gap * 0.3, r * 0.05, Math.PI / 2.5, 0.85, 1);
    // 后足对（最长，斜向后）
    drawAntLeg(gap * 0.5, -r * 0.05, -Math.PI / 2.2, 1.0, -1);
    drawAntLeg(gap * 0.5, r * 0.05, Math.PI / 2.2, 1.0, 1);

    // --- 腹部（后端，最大，最显眼） ---
    ctx.fillStyle = finalColor;
    ctx.beginPath();
    ctx.ellipse(gap * 0.8, 0, abdomenR, abdomenR * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();
    // 腹部细条纹（体现分节）
    ctx.strokeStyle = _shadeColor(finalColor, -35);
    ctx.lineWidth = Math.max(0.8, r * 0.04);
    for (let i = 1; i <= 3; i++) {
      const segX = gap * 0.8 - abdomenR * 0.5 + (i - 1) * abdomenR * 0.3;
      ctx.beginPath();
      ctx.moveTo(segX, -abdomenR * 0.6);
      ctx.lineTo(segX, abdomenR * 0.6);
      ctx.stroke();
    }

    // --- 胸部（中间，较小） ---
    ctx.fillStyle = _shadeColor(finalColor, -20);
    ctx.beginPath();
    ctx.arc(gap * 0.15, 0, thoraxR, 0, Math.PI * 2);
    ctx.fill();

    // --- 头部（前方，连接触角） ---
    ctx.fillStyle = finalColor;
    ctx.beginPath();
    ctx.arc(-headR * 0.9, 0, headR, 0, Math.PI * 2);
    ctx.fill();

    // --- 触角（从头部伸出，两条弯曲细线） ---
    ctx.strokeStyle = _shadeColor(finalColor, -30);
    ctx.lineWidth = Math.max(0.8, r * 0.04);
    // 左触角
    ctx.beginPath();
    ctx.moveTo(-headR * 1.1, -headR * 0.4);
    ctx.quadraticCurveTo(-headR * 1.8, -headR * 0.9, -headR * 2.1, -headR * 1.3);
    ctx.stroke();
    // 右触角
    ctx.beginPath();
    ctx.moveTo(-headR * 1.1, headR * 0.4);
    ctx.quadraticCurveTo(-headR * 1.8, headR * 0.9, -headR * 2.1, headR * 1.3);
    ctx.stroke();

    // --- 眼睛（两个小点） ---
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-headR * 0.8, -headR * 0.35, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-headR * 0.8, headR * 0.35, r * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // --- 角色标志（兵蚁有明显颚刺） ---
    if (role === 'soldier' || role === 'scout') {
      ctx.strokeStyle = _shadeColor(finalColor, -50);
      ctx.lineWidth = Math.max(1.0, r * 0.07);
      ctx.beginPath();
      ctx.moveTo(-headR * 1.5, -headR * 0.15);
      ctx.lineTo(-headR * 2.3, -headR * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-headR * 1.5, headR * 0.15);
      ctx.lineTo(-headR * 2.3, headR * 0.5);
      ctx.stroke();
    }

    // 轻微边缘高光
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(gap * 0.8, 0, abdomenR * 0.95, abdomenR * 0.78, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ===== _drawInsectAppearance =====
  function _drawInsectAppearance(ctx, r, cell, speciesKey) {
    const sp = INSECT_SPECIES[speciesKey];
    const main = sp.color;
    const spot = sp.spotColor || '#1a1a1a';

    // 外阴影
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.2, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    switch (speciesKey) {
      // --- 七星瓢虫：红色半球 + 7 黑点 ---
      case 'coccinella_septempunctata': {
        // 身体（红色半球）
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
        ctx.fill();
        // 中央分界缝
        ctx.strokeStyle = spot;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.9);
        ctx.lineTo(0, r * 0.9);
        ctx.stroke();
        // 7 个黑斑（左3 + 右3 + 中1）
        ctx.fillStyle = spot;
        const spotR = r * 0.15;
        // 中间1个（靠上）
        ctx.beginPath();
        ctx.arc(0, -r * 0.6, spotR, 0, Math.PI * 2);
        ctx.fill();
        // 左3 右3（对称）
        const lx = [-r * 0.35, -r * 0.55, -r * 0.3];
        const ly = [-r * 0.25, r * 0.25, r * 0.65];
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(lx[i], ly[i], spotR, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(-lx[i], ly[i], spotR, 0, Math.PI * 2);
          ctx.fill();
        }
        // 黑色小头 + 两根触角
        ctx.fillStyle = spot;
        ctx.beginPath();
        ctx.arc(-r * 0.95, 0, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = spot;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-r * 1.05, -r * 0.1);
        ctx.lineTo(-r * 1.35, -r * 0.35);
        ctx.moveTo(-r * 1.05, r * 0.1);
        ctx.lineTo(-r * 1.35, r * 0.35);
        ctx.stroke();
        break;
      }
      // --- 菜粉蝶：白色翅膀 + 黑色边缘 + 中央黑斑 ---
      case 'pieris_rapae': {
        // 翅膀（4 片——上翅下翅）
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.1);
        ctx.quadraticCurveTo(-r * 0.6, -r * 1.1, r * 0.5, -r * 0.8);
        ctx.quadraticCurveTo(r * 0.9, -r * 0.3, 0, r * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, r * 0.1);
        ctx.quadraticCurveTo(-r * 0.7, -r * 0.3, -r * 0.7, r * 0.7);
        ctx.quadraticCurveTo(0, r * 0.9, 0, r * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, r * 0.1);
        ctx.quadraticCurveTo(r * 0.7, -r * 0.3, r * 0.7, r * 0.7);
        ctx.quadraticCurveTo(0, r * 0.9, 0, r * 0.1);
        ctx.closePath();
        ctx.fill();
        // 翅尖黑斑
        ctx.fillStyle = spot;
        ctx.beginPath();
        ctx.ellipse(r * 0.6, -r * 0.75, r * 0.2, r * 0.15, 0.5, 0, Math.PI * 2);
        ctx.fill();
        // 翅中央各一个黑点
        ctx.beginPath();
        ctx.arc(-r * 0.4, r * 0.25, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r * 0.4, r * 0.25, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
        // 身体（细长棕色）
        ctx.fillStyle = '#3a2a2a';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.12, r * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      // --- 蚜虫：淡绿色小椭球 + 两根腹管 ---
      case 'aphid': {
        // 身体（梨形，前方大后方收窄）
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.ellipse(r * 0.1, 0, r * 0.85, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // 腹管（两根向后伸出）
        ctx.strokeStyle = spot;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(r * 0.75, -r * 0.25);
        ctx.lineTo(r * 1.2, -r * 0.55);
        ctx.moveTo(r * 0.75, r * 0.25);
        ctx.lineTo(r * 1.2, r * 0.55);
        ctx.stroke();
        // 小黑腿（3 对细线）
        ctx.strokeStyle = spot;
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(i * r * 0.25, -r * 0.55);
          ctx.lineTo(i * r * 0.25 - r * 0.15, -r * 0.95);
          ctx.moveTo(i * r * 0.25, r * 0.55);
          ctx.lineTo(i * r * 0.25 + r * 0.15, r * 0.95);
          ctx.stroke();
        }
        // 高光点（半透明）
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(r * 0.3, -r * 0.25, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      // --- 狼蛛：棕褐色 + 8 条多节长毛腿 + 前方双眼 ---
      case 'theraphosidae': {
        // 腿（4 对，每条腿分 3 段：基节+股+胫节，末端有毛和爪）
        const legLen = r * 1.15;
        for (let i = 0; i < 8; i++) {
          const baseAngle = (i / 8) * Math.PI * 2 + Math.PI / 8;
          // 基节（连接身体的短节）
          const coxaX = Math.cos(baseAngle) * r * 0.15;
          const coxaY = Math.sin(baseAngle) * r * 0.15;
          // 股节（最长段，向外延伸）
          const femurAngle = baseAngle + (i % 2 === 0 ? 0.35 : -0.35);
          const femurLen = legLen * 0.45;
          const femurX = coxaX + Math.cos(femurAngle) * femurLen;
          const femurY = coxaY + Math.sin(femurAngle) * femurLen;
          // 膝关节弯折
          const kneeAngle = femurAngle + (i % 2 === 0 ? 0.5 : -0.5);
          const tibiaLen = legLen * 0.35;
          const tibiaX = femurX + Math.cos(kneeAngle) * tibiaLen;
          const tibiaY = femurY + Math.sin(kneeAngle) * tibiaLen;
          // 跗节（末端细段）
          const tarsusAngle = kneeAngle + (i % 2 === 0 ? 0.3 : -0.3);
          const tarsusLen = legLen * 0.2;
          const tarsusX = tibiaX + Math.cos(tarsusAngle) * tarsusLen;
          const tarsusY = tibiaY + Math.sin(tarsusAngle) * tarsusLen;

          // 绘制腿：基节
          ctx.strokeStyle = _shadeColor(main, -10);
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(coxaX, coxaY);
          ctx.lineTo(femurX, femurY);
          ctx.stroke();
          // 股节到胫节
          ctx.strokeStyle = main;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(femurX, femurY);
          ctx.lineTo(tibiaX, tibiaY);
          ctx.stroke();
          // 跗节（细）
          ctx.strokeStyle = _shadeColor(main, 15);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(tibiaX, tibiaY);
          ctx.lineTo(tarsusX, tarsusY);
          ctx.stroke();
          // 跗节末端毛簇（3 根小刺）
          ctx.strokeStyle = _shadeColor(main, -20);
          ctx.lineWidth = 0.7;
          for (let j = 0; j < 3; j++) {
            const hairAngle = tarsusAngle + (j - 1) * 0.4;
            const hairLen = r * 0.08;
            ctx.beginPath();
            ctx.moveTo(tarsusX, tarsusY);
            ctx.lineTo(tarsusX + Math.cos(hairAngle) * hairLen, tarsusY + Math.sin(hairAngle) * hairLen);
            ctx.stroke();
          }
        }
        // 腹部（后椭圆形，较大，有斑点纹理）
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.ellipse(r * 0.25, 0, r * 0.75, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        // 头胸部（前小圆）
        ctx.fillStyle = _shadeColor(main, -20);
        ctx.beginPath();
        ctx.arc(-r * 0.3, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
        // 8 个小眼点（深色）
        ctx.fillStyle = spot;
        const eyeR = Math.max(1.5, r * 0.07);
        const eyeAngles = [-0.45, -0.15, 0.15, 0.45, -0.55, 0.55, -0.25, 0.25];
        for (let i = 0; i < eyeAngles.length; i++) {
          ctx.beginPath();
          ctx.arc(-r * 0.3 + Math.cos(eyeAngles[i]) * r * 0.18, Math.sin(eyeAngles[i]) * r * 0.2, eyeR, 0, Math.PI * 2);
          ctx.fill();
        }
        // 腹部斑点纹理
        ctx.fillStyle = spot;
        for (let i = 0; i < 5; i++) {
          const px = -r * 0.05 + (i - 2) * r * 0.18;
          const py = (i % 2 === 0 ? r * 0.15 : -r * 0.15);
          ctx.beginPath();
          ctx.arc(px, py, r * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      // --- 蜈蚣：多节扁平长条 + 步足 + 毒颚（节数减少，间距增大，观感更疏松）---
      case 'scolopendra': {
        const now = Date.now();
        const waveP = now * 0.002;
        const segments = 6;                                  // 节数减少
        const totalLen = r * 1.6;                            // 身体总长度
        const segW = totalLen / segments;                    // 节宽（节与节更宽）
        const startX = -totalLen / 2 + segW / 2;             // 节起始 x 偏移

        const bodyY = (i) => Math.sin(waveP + i * 0.5) * r * 0.08;

        for (let i = 0; i < segments; i++) {
          const sx = startX + i * segW;
          const sy = bodyY(i);
          ctx.fillStyle = i % 2 === 0 ? '#8a3818' : '#5e2410';
          ctx.beginPath();
          ctx.ellipse(sx, sy, segW * 0.38, r * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#2a0f05';
          ctx.lineWidth = 0.8;
          ctx.stroke();

          if (i > 0) {
            // 分节线（更细、更淡，减少密集压迫感）
            ctx.strokeStyle = '#201005';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(sx - segW * 0.38, sy - r * 0.22);
            ctx.lineTo(sx - segW * 0.38, sy + r * 0.22);
            ctx.stroke();
          }

          // 步足（更短，减少延伸长度）
          const legSw = Math.sin(waveP + i * 0.8) * r * 0.04;
          ctx.strokeStyle = '#3a1f0e';
          ctx.lineWidth = 1.0;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx, sy - r * 0.25);
          ctx.lineTo(sx - segW * 0.12, sy - r * 0.42 + legSw);
          ctx.lineTo(sx - segW * 0.2, sy - r * 0.52 + legSw * 0.5);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sx, sy + r * 0.25);
          ctx.lineTo(sx + segW * 0.12, sy + r * 0.42 - legSw);
          ctx.lineTo(sx + segW * 0.2, sy + r * 0.52 - legSw * 0.5);
          ctx.stroke();
          ctx.fillStyle = '#1a0803';
          ctx.beginPath();
          ctx.arc(sx - segW * 0.2, sy - r * 0.52 + legSw * 0.5, 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx + segW * 0.2, sy + r * 0.52 - legSw * 0.5, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // 头部
        const headX = startX + totalLen / 2 + segW * 0.55;
        const headY = bodyY(segments - 1);
        ctx.fillStyle = '#5e2010';
        ctx.beginPath();
        ctx.ellipse(headX, headY, r * 0.32, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1a0800';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // 眼睛
        ctx.fillStyle = '#050302';
        ctx.beginPath();
        ctx.arc(headX + r * 0.12, headY - r * 0.1, 1.2, 0, Math.PI * 2);
        ctx.arc(headX + r * 0.12, headY + r * 0.1, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // 触角
        ctx.strokeStyle = '#4a1f0e';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(headX + r * 0.1, headY - r * 0.08);
        ctx.quadraticCurveTo(headX + r * 0.4, headY - r * 0.45, headX + r * 0.55, headY - r * 0.55);
        ctx.moveTo(headX + r * 0.1, headY + r * 0.08);
        ctx.quadraticCurveTo(headX + r * 0.4, headY + r * 0.45, headX + r * 0.55, headY + r * 0.55);
        ctx.stroke();

        // 毒颚（前足特化）
        ctx.strokeStyle = '#1a0500';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(headX + r * 0.22, headY - r * 0.12);
        ctx.quadraticCurveTo(headX + r * 0.55, headY - r * 0.22, headX + r * 0.78, headY - r * 0.06);
        ctx.moveTo(headX + r * 0.22, headY + r * 0.12);
        ctx.quadraticCurveTo(headX + r * 0.55, headY + r * 0.22, headX + r * 0.78, headY + r * 0.06);
        ctx.stroke();
        ctx.fillStyle = '#e04020';
        ctx.beginPath();
        ctx.arc(headX + r * 0.78, headY - r * 0.06, 1.4, 0, Math.PI * 2);
        ctx.arc(headX + r * 0.78, headY + r * 0.06, 1.4, 0, Math.PI * 2);
        ctx.fill();

        // 尾部
        const tailX = startX - segW * 0.5;
        const tailY = bodyY(0);
        ctx.fillStyle = '#4a1a0d';
        ctx.beginPath();
        ctx.ellipse(tailX, tailY, r * 0.18, r * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1a0800';
        ctx.lineWidth = 0.6;
        ctx.stroke();

        break;
      }
// --- 虎甲：亮蓝色金属椭圆 + 巨大镰刀状颚 ---
      case 'cicindela': {
        // 身体（金属蓝色带高光）
        const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
        grad.addColorStop(0, spot);
        grad.addColorStop(1, main);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        // 鞘翅分缝
        ctx.strokeStyle = spot;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.9, 0);
        ctx.lineTo(r * 0.7, 0);
        ctx.stroke();
        // 头部（前突出圆，含大复眼）
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.arc(-r * 0.95, 0, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
        // 两只突出大复眼
        ctx.fillStyle = spot;
        ctx.beginPath();
        ctx.arc(-r * 0.95, -r * 0.25, r * 0.12, 0, Math.PI * 2);
        ctx.arc(-r * 0.95, r * 0.25, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        // 巨大镰刀状颚（两根向前）
        ctx.strokeStyle = '#d0d0e0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 1.1, -r * 0.1);
        ctx.quadraticCurveTo(-r * 1.5, -r * 0.15, -r * 1.9, -r * 0.3);
        ctx.moveTo(-r * 1.1, r * 0.1);
        ctx.quadraticCurveTo(-r * 1.5, r * 0.15, -r * 1.9, r * 0.3);
        ctx.stroke();
        // 腿（3 对，每条分 3 段，带刚毛）
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const lx = -r * 0.3 + i * r * 0.3;
          const legBaseY = r * 0.28;
          // 上半段（股节）
          ctx.strokeStyle = spot;
          ctx.lineWidth = 1.5;
          const uEndX = lx - r * 0.1;
          const uEndY = -r * 0.55;
          ctx.beginPath();
          ctx.moveTo(lx, -legBaseY);
          ctx.lineTo(uEndX, uEndY);
          ctx.stroke();
          // 膝关节
          ctx.fillStyle = spot;
          ctx.beginPath();
          ctx.arc(uEndX, uEndY, r * 0.05, 0, Math.PI * 2);
          ctx.fill();
          // 下半段（胫节）
          ctx.strokeStyle = main;
          ctx.lineWidth = 1.0;
          const lEndX = uEndX - r * 0.15;
          const lEndY = -r * 0.88;
          ctx.beginPath();
          ctx.moveTo(uEndX, uEndY);
          ctx.lineTo(lEndX, lEndY);
          ctx.stroke();
          // 跗节 + 爪
          ctx.strokeStyle = '#d0d0e0';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(lEndX, lEndY);
          ctx.lineTo(lEndX - r * 0.1, -r * 0.95);
          ctx.stroke();
          // 上刚毛
          ctx.strokeStyle = _shadeColor(spot, -30);
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(lx + r * 0.02, -legBaseY + r * 0.05);
          ctx.lineTo(lx + r * 0.15, -legBaseY + r * 0.2);
          ctx.stroke();
          // 下腿（对称）
          ctx.strokeStyle = spot;
          ctx.lineWidth = 1.5;
          const udEndX = lx + r * 0.1;
          const udEndY = r * 0.55;
          ctx.beginPath();
          ctx.moveTo(lx, legBaseY);
          ctx.lineTo(udEndX, udEndY);
          ctx.stroke();
          ctx.fillStyle = spot;
          ctx.beginPath();
          ctx.arc(udEndX, udEndY, r * 0.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = main;
          ctx.lineWidth = 1.0;
          const ldEndX = udEndX + r * 0.15;
          const ldEndY = r * 0.88;
          ctx.beginPath();
          ctx.moveTo(udEndX, udEndY);
          ctx.lineTo(ldEndX, ldEndY);
          ctx.stroke();
          ctx.strokeStyle = '#d0d0e0';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(ldEndX, ldEndY);
          ctx.lineTo(ldEndX + r * 0.1, r * 0.95);
          ctx.stroke();
        }
        break;
      }
      // --- 胡蜂：橙黄色 + 黑条纹 + 透明翅膀 ---
      case 'vespa': {
        // 翅膀（半透明，在最底层先画）
        ctx.fillStyle = 'rgba(220,220,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.5, r * 0.9, r * 0.45, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, r * 0.5, r * 0.9, r * 0.45, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,120,180,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // 腹部（细长椭球，橙黄 + 黑横条）
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.ellipse(r * 0.2, 0, r * 0.85, r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        // 黑色条纹（3 条横带）
        ctx.fillStyle = '#2a1a0a';
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.ellipse(-r * 0.2 + i * r * 0.3, 0, r * 0.07, r * 0.42, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // 胸部（中央圆）
        ctx.fillStyle = _shadeColor(main, -25);
        ctx.beginPath();
        ctx.arc(-r * 0.35, 0, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        // 3 对胡蜂腿（股节+胫节+跗节，带钩刺）
        ctx.lineCap = 'round';
        const waspLegPositions = [
          { x: -r * 0.35, yOff: r * 0.25, angle: -0.4, lenScale: 0.75 },
          { x: -r * 0.35, yOff: r * 0.25, angle: 0.4, lenScale: 0.75 },
          { x: -r * 0.2, yOff: r * 0.28, angle: -0.35, lenScale: 0.9 },
          { x: -r * 0.2, yOff: r * 0.28, angle: 0.35, lenScale: 0.9 },
          { x: -r * 0.05, yOff: r * 0.28, angle: -0.3, lenScale: 1.0 },
          { x: -r * 0.05, yOff: r * 0.28, angle: 0.3, lenScale: 1.0 },
        ];
        for (const leg of waspLegPositions) {
          const sign = leg.angle < 0 ? -1 : 1;
          // 股节
          const femurLen = r * 0.35 * leg.lenScale;
          const femurEndX = leg.x + Math.cos(leg.angle) * femurLen;
          const femurEndY = leg.yOff + Math.sin(leg.angle) * femurLen;
          ctx.strokeStyle = '#2a1a0a';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(leg.x, leg.yOff);
          ctx.lineTo(femurEndX, femurEndY);
          ctx.stroke();
          // 胫节（弯折）
          const tibiaAngle = leg.angle + sign * 0.7;
          const tibiaLen = r * 0.3 * leg.lenScale;
          const tibiaEndX = femurEndX + Math.cos(tibiaAngle) * tibiaLen;
          const tibiaEndY = femurEndY + Math.sin(tibiaAngle) * tibiaLen;
          ctx.strokeStyle = main;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(femurEndX, femurEndY);
          ctx.lineTo(tibiaEndX, tibiaEndY);
          ctx.stroke();
          // 跗节（3 节）
          const tLen = r * 0.15 * leg.lenScale;
          const t1End = { x: tibiaEndX + Math.cos(tibiaAngle + sign * 0.15) * tLen * 0.4, y: tibiaEndY + Math.sin(tibiaAngle + sign * 0.15) * tLen * 0.4 };
          const t2End = { x: t1End.x + Math.cos(tibiaAngle + sign * 0.1) * tLen * 0.3, y: t1End.y + Math.sin(tibiaAngle + sign * 0.1) * tLen * 0.3 };
          const t3End = { x: t2End.x + Math.cos(tibiaAngle) * tLen * 0.3, y: t2End.y + Math.sin(tibiaAngle) * tLen * 0.3 };
          ctx.strokeStyle = _shadeColor(main, -15);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(tibiaEndX, tibiaEndY);
          ctx.lineTo(t1End.x, t1End.y);
          ctx.lineTo(t2End.x, t2End.y);
          ctx.lineTo(t3End.x, t3End.y);
          ctx.stroke();
        }
        // 头部（前圆，大脸）
        ctx.fillStyle = _shadeColor(main, -15);
        ctx.beginPath();
        ctx.arc(-r * 0.85, 0, r * 0.25, 0, Math.PI * 2);
        ctx.fill();
        // 眼睛（两个黑椭圆）
        ctx.fillStyle = '#2a1a0a';
        ctx.beginPath();
        ctx.ellipse(-r * 0.85, -r * 0.18, r * 0.08, r * 0.12, 0, 0, Math.PI * 2);
        ctx.ellipse(-r * 0.85, r * 0.18, r * 0.08, r * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        // 尾刺（一小黑点+尖）
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.moveTo(r * 1.0, -r * 0.1);
        ctx.lineTo(r * 1.25, 0);
        ctx.lineTo(r * 1.0, r * 0.1);
        ctx.closePath();
        ctx.fill();
        break;
      }
      // --- 蚁狮：沙色陷阱形状 —— 不规则三角形 + 中央捕食者 ---
      case 'myrmeleon': {
        // 陷阱轮廓（漏斗形的沙圈）
        ctx.strokeStyle = _shadeColor(main, -15);
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(150,110,70,0.25)';
        ctx.beginPath();
        for (let i = 0; i < 20; i++) {
          const angle = (i / 20) * Math.PI * 2;
          const noise = 1 + Math.sin(i * 3.3) * 0.15;
          const rr = r * 0.95 * noise;
          const px = Math.cos(angle) * rr;
          const py = Math.sin(angle) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 内圈（更深的沙子）
        ctx.fillStyle = 'rgba(120,80,50,0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        // 中央捕食者（小椭球+大颚）
        ctx.fillStyle = spot;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.35, r * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        // 大颚（向前伸出的镰刀）
        ctx.strokeStyle = spot;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, -r * 0.12);
        ctx.quadraticCurveTo(-r * 0.6, -r * 0.2, -r * 0.85, -r * 0.1);
        ctx.moveTo(-r * 0.3, r * 0.12);
        ctx.quadraticCurveTo(-r * 0.6, r * 0.2, -r * 0.85, r * 0.1);
        ctx.stroke();
        // 陷阱内壁上的小沙粒（若干小点）
        ctx.fillStyle = 'rgba(90,60,40,0.8)';
        for (let i = 0; i < 12; i++) {
          const ang = Math.random() * Math.PI * 2;
          const rr = r * (0.6 + Math.random() * 0.35);
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default: {
        // 通用昆虫：简单身体+腿
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 通用边缘高光
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.15, r * 0.7, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    return true;
  }

  // ===== _drawPlantAppearance =====
  function _drawPlantAppearance(ctx, r, cell, speciesKey) {
    const attr = cell.attributes || {};
    const sp = PLANT_SPECIES[speciesKey];
    const type = sp ? sp.type : 'grass';
    const color = sp ? sp.color : attr.color || '#8fbc8f';

    // 轻微地面阴影
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * 1.0, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    switch (type) {
      // --- 禾本科（狗尾草、牛筋草）：中央茎 + 多片狭长叶 + 顶穗 ---
      case 'grass': {
        // 叶（7 条，绿色，从中心向上散开；长度由叶片固定索引决定，避免每帧抖动）
        const leafCount = 7;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        for (let i = 0; i < leafCount; i++) {
          const angle = -Math.PI / 2 + (i - leafCount / 2) * 0.35;
          // 固定长度序列（用索引代替 Math.random），避免每帧抖动
          const lenRatios = [0.88, 0.92, 0.96, 1.0, 0.97, 0.93, 0.87];
          const len = r * lenRatios[i];
          ctx.beginPath();
          ctx.moveTo(0, 0);
          const midX = Math.cos(angle) * len * 0.5;
          const midY = Math.sin(angle) * len * 0.5;
          ctx.quadraticCurveTo(midX * 1.2, midY - r * 0.15, Math.cos(angle) * len, Math.sin(angle) * len);
          ctx.stroke();
        }
        // 茎（中央稍深色）
        ctx.strokeStyle = _shadeColor(color, -20);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, r * 0.1);
        ctx.lineTo(0, -r * 0.6);
        ctx.stroke();
        // 穗（顶端，一串椭圆，狗尾草状）
        const spikeColor = _shadeColor(color, -30);
        ctx.fillStyle = spikeColor;
        for (let i = 0; i < 5; i++) {
          const yy = -r * 0.6 - i * r * 0.12;
          ctx.beginPath();
          ctx.ellipse(0, yy, r * 0.18, r * 0.1, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // 草籽散落（底部 2-3 颗）
        if (attr.seedsRemaining || attr.seedsRemaining === 0) {
          ctx.fillStyle = _shadeColor(color, -45);
          for (let i = 0; i < 3; i++) {
            const ang = -Math.PI / 2 + (i - 1) * 0.6;
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * r * 1.05, Math.sin(ang) * r * 0.9, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      // --- 阔叶草本（车前草、三叶草等）：从中心放射出 5 片宽叶 ---
      case 'herb':
      case 'forb': {
        const leafCount = 5;
        for (let i = 0; i < leafCount; i++) {
          const angle = (i / leafCount) * Math.PI * 2 - Math.PI / 2;
          const lx = Math.cos(angle) * r * 0.6;
          const ly = Math.sin(angle) * r * 0.6;
          // 叶片（椭圆）
          ctx.fillStyle = _shadeColor(color, i % 2 === 0 ? -5 : -18);
          ctx.beginPath();
          ctx.ellipse(lx * 0.6, ly * 0.6, r * 0.4, r * 0.2, angle, 0, Math.PI * 2);
          ctx.fill();
          // 叶脉
          ctx.strokeStyle = _shadeColor(color, -40);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(lx, ly);
          ctx.stroke();
        }
        // 中央生长点（小点）
        ctx.fillStyle = _shadeColor(color, -25);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      // --- 果实（草莓、番茄）：绿色叶丛 + 红色/紫色果实 ---
      case 'fruit': {
        // 叶丛（5 片，下方）
        ctx.fillStyle = _shadeColor(color, -30);
        for (let i = 0; i < 5; i++) {
          const ang = -Math.PI / 2 + (i - 2) * 0.35;
          ctx.beginPath();
          ctx.ellipse(Math.cos(ang) * r * 0.3, Math.sin(ang) * r * 0.3 - r * 0.1, r * 0.25, r * 0.15, ang, 0, Math.PI * 2);
          ctx.fill();
        }
        // 果实（3 颗红色浆果）
        const fruitColor = '#c84040';
        const fruitPositions = [
          [0, -r * 0.15, r * 0.3],
          [-r * 0.35, r * 0.15, r * 0.22],
          [r * 0.35, r * 0.15, r * 0.22]
        ];
        for (let i = 0; i < fruitPositions.length; i++) {
          const [fx, fy, fr] = fruitPositions[i];
          const fruit = ctx.createRadialGradient(fx - fr * 0.3, fy - fr * 0.3, 0, fx, fy, fr);
          fruit.addColorStop(0, '#ff8060');
          fruit.addColorStop(1, fruitColor);
          ctx.fillStyle = fruit;
          ctx.beginPath();
          ctx.arc(fx, fy, fr, 0, Math.PI * 2);
          ctx.fill();
          // 高光点
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.beginPath();
          ctx.arc(fx - fr * 0.3, fy - fr * 0.3, fr * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      // --- 蘑菇（双孢菇、鸡腿菇）：中央菌伞 + 下方菌柄 ---
      case 'mushroom': {
        // 菌柄（浅色圆柱，在底层）
        ctx.fillStyle = '#f5ead0';
        ctx.beginPath();
        ctx.rect(-r * 0.12, -r * 0.05, r * 0.24, r * 0.5);
        ctx.fill();
        // 菌伞（半圆，棕/灰色，带鳞片）
        const cap = ctx.createRadialGradient(0, -r * 0.1, 0, 0, -r * 0.1, r * 0.8);
        cap.addColorStop(0, _shadeColor(color, 25));
        cap.addColorStop(1, color);
        ctx.fillStyle = cap;
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.85, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();
        // 鳞片（几个深色小点）
        ctx.fillStyle = _shadeColor(color, -35);
        for (let i = 0; i < 7; i++) {
          const ang = -Math.PI + (i + 0.5) / 7 * Math.PI;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * r * 0.55, -r * 0.1 + Math.sin(ang) * r * 0.55, r * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
        // 菌伞边缘（薄深色线）
        ctx.strokeStyle = _shadeColor(color, -40);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.85, Math.PI, 0, false);
        ctx.stroke();
        break;
      }
      // --- 乔木（蒙古栎、椴树）：粗壮树干 + 大团树冠 ---
      case 'tree': {
        // 树干（棕色大圆柱）
        ctx.fillStyle = _shadeColor(sp.color || '#4a3a2a', -40);
        ctx.beginPath();
        ctx.rect(-r * 0.15, -r * 0.1, r * 0.3, r * 0.7);
        ctx.fill();
        // 树干纹理
        ctx.strokeStyle = _shadeColor(sp.color || '#4a3a2a', -55);
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const lx = -r * 0.12 + i * r * 0.12;
          ctx.beginPath();
          ctx.moveTo(lx, -r * 0.05);
          ctx.lineTo(lx - r * 0.02, r * 0.55);
          ctx.stroke();
        }
        // 树冠（多个重叠圆组成的蓬松叶团，深绿+浅绿渐变）
        const canopyColor = sp.color || color || '#4a7a3a';
        const canopyBlobs = [
          [0, -r * 0.35, r * 0.7],
          [-r * 0.45, -r * 0.25, r * 0.45],
          [r * 0.45, -r * 0.25, r * 0.45],
          [-r * 0.25, -r * 0.6, r * 0.45],
          [r * 0.25, -r * 0.6, r * 0.45],
          [0, -r * 0.75, r * 0.55]
        ];
        for (let i = 0; i < canopyBlobs.length; i++) {
          const [cx, cy, cr] = canopyBlobs[i];
          const grad = ctx.createRadialGradient(cx, cy - cr * 0.3, cr * 0.1, cx, cy, cr);
          grad.addColorStop(0, _shadeColor(canopyColor, 30));
          grad.addColorStop(1, _shadeColor(canopyColor, -20));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, cr, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      // --- 肉质/沙漠植物（骆驼刺、猪毛菜）：多刺/多浆，耐旱 ---
      case 'succulent':
      case 'thorn': {
        // 多肉质绿色团块（由几个大椭圆组成）
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2;
          const bx = Math.cos(ang) * r * 0.3;
          const by = Math.sin(ang) * r * 0.3;
          ctx.fillStyle = _shadeColor(color, i * 8 - 15);
          ctx.beginPath();
          ctx.ellipse(bx, by, r * 0.35, r * 0.22, ang, 0, Math.PI * 2);
          ctx.fill();
        }
        // 中央生长点
        ctx.fillStyle = _shadeColor(color, -30);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
        // 刺（尖细线）
        ctx.strokeStyle = _shadeColor(color, -45);
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * r * 0.35, Math.sin(ang) * r * 0.35);
          ctx.lineTo(Math.cos(ang) * r * 0.75, Math.sin(ang) * r * 0.75);
          ctx.stroke();
        }
        break;
      }
      default: {
        // 其他植物：简单圆形叶丛
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return true;
  }

  // ===== _drawSceneObject =====
  function _drawSceneObject(ctx, r, cell, sceneType) {
    switch (sceneType) {
      case 'nest': {
        // 巢穴：中央大土堆 + 入口小洞 + 放射状工蚁小径
        const c = cell.attributes && cell.attributes.color ? cell.attributes.color : '#8b5a2b';
        ctx.save();
        // 外圈深色土圈
        ctx.fillStyle = _shadeColor(c, -35);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.05, r * 0.78, 0, 0, Math.PI * 2);
        ctx.fill();
        // 中央土堆（径向渐变）
        const grad = ctx.createRadialGradient(-r * 0.1, -r * 0.15, r * 0.1, 0, 0, r * 0.92);
        grad.addColorStop(0, _shadeColor(c, 25));
        grad.addColorStop(0.55, c);
        grad.addColorStop(1, _shadeColor(c, -25));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.92, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        // 入口小洞（中央偏上）
        ctx.fillStyle = '#1a0e05';
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.05, r * 0.18, r * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(r * 0.04, -r * 0.02, r * 0.08, r * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        // 散粒土块
        ctx.fillStyle = _shadeColor(c, -20);
        const nestSpeckles = [
          [-0.55, -0.15, 1.8], [0.45, -0.1, 1.6], [-0.4, 0.35, 1.6],
          [0.35, 0.3, 1.4], [-0.15, -0.45, 1.3], [0.18, -0.4, 1.2],
          [-0.6, 0.15, 1.2], [0.55, 0.1, 1.3], [-0.2, 0.45, 1.3],
          [0.22, 0.48, 1.2]
        ];
        for (const [sx, sy, sr] of nestSpeckles) {
          ctx.beginPath();
          ctx.arc(sx * r, sy * r, sr, 0, Math.PI * 2);
          ctx.fill();
        }
        // 顶部高光
        ctx.fillStyle = 'rgba(255,235,180,0.35)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.18, -r * 0.35, r * 0.3, r * 0.08, -0.2, 0, Math.PI * 2);
        ctx.fill();
        // 食物储量显示（在 attributes.foodStorage 存在时显示一个微小的绿色圆）
        const food = cell.attributes && cell.attributes.foodStorage;
        if (food && food > 0) {
          ctx.fillStyle = '#7ac050';
          ctx.beginPath();
          ctx.arc(r * 0.55, -r * 0.55, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#2a4a20';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'rock': {
        const c = cell.attributes.color || '#888888';
        ctx.save();
        // 外轮廓（不规则多边形，固定扰动）
        ctx.fillStyle = c;
        ctx.strokeStyle = _shadeColor(c, -45);
        ctx.lineWidth = 2;
        ctx.beginPath();
        const points = 14;
        const baseAngles = [0.9, 1.1, 0.85, 1.15, 0.95, 1.05, 0.88, 1.12, 0.92, 1.08, 0.86, 1.1, 0.94, 1.02];
        for (let i = 0; i < points; i++) {
          const ang = (i / points) * Math.PI * 2;
          const rr = r * baseAngles[i] * 0.92;
          const px = Math.cos(ang) * rr;
          const py = Math.sin(ang) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        for (let i = 0; i < points; i++) {
          const ang = (i / points) * Math.PI * 2;
          const rr = r * baseAngles[i] * 0.92;
          const px = Math.cos(ang) * rr * 0.95 + r * 0.08;
          const py = Math.sin(ang) * rr * 0.92 + r * 0.1;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // 顶部高光
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.2, -r * 0.35, r * 0.38, r * 0.18, -0.35, 0, Math.PI * 2);
        ctx.fill();
        // 次级高光
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.ellipse(r * 0.15, -r * 0.2, r * 0.2, r * 0.1, 0.2, 0, Math.PI * 2);
        ctx.fill();
        // 裂纹
        ctx.strokeStyle = _shadeColor(c, -55);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, -r * 0.1);
        ctx.lineTo(r * 0.05, r * 0.25);
        ctx.lineTo(r * 0.3, r * 0.1);
        ctx.moveTo(-r * 0.5, r * 0.15);
        ctx.lineTo(-r * 0.15, r * 0.4);
        ctx.lineTo(r * 0.1, r * 0.55);
        ctx.moveTo(-r * 0.05, -r * 0.5);
        ctx.lineTo(r * 0.05, -r * 0.05);
        ctx.stroke();
        // 表面颗粒
        ctx.fillStyle = _shadeColor(c, -25);
        const specklePositions = [
          [-r * 0.25, -r * 0.05], [r * 0.3, r * 0.2], [-r * 0.4, -r * 0.2],
          [r * 0.2, -r * 0.4], [-r * 0.1, r * 0.35], [r * 0.45, -r * 0.1]
        ];
        for (const [sx, sy] of specklePositions) {
          ctx.beginPath();
          ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'water': {
        ctx.save();
        // 湿地土边缘
        ctx.fillStyle = 'rgba(60,75,65,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.02, r * 0.78, 0.1, 0, Math.PI * 2);
        ctx.fill();
        // 水体主色
        const mainGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.15, r * 0.1, 0, 0, r * 0.95);
        mainGrad.addColorStop(0, '#7fb8c4');
        mainGrad.addColorStop(0.5, '#4a8ea5');
        mainGrad.addColorStop(1, '#2f5f75');
        ctx.fillStyle = mainGrad;
        ctx.beginPath();
        const waterPts = 12;
        const waterRatios = [1.0, 0.95, 0.92, 0.98, 1.02, 0.94, 0.96, 1.0, 0.97, 0.93, 1.01, 0.98];
        for (let i = 0; i < waterPts; i++) {
          const ang = (i / waterPts) * Math.PI * 2 + 0.1;
          const rr = r * waterRatios[i] * 0.93;
          const px = Math.cos(ang) * rr;
          const py = Math.sin(ang) * rr * 0.72;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // 天空反光
        ctx.fillStyle = 'rgba(200,230,240,0.35)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.25, -r * 0.35, r * 0.3, r * 0.06, 0.1, 0, Math.PI * 2);
        ctx.fill();
        // 小反光
        ctx.fillStyle = 'rgba(180,210,225,0.25)';
        ctx.beginPath();
        ctx.ellipse(r * 0.2, -r * 0.15, r * 0.15, r * 0.04, -0.1, 0, Math.PI * 2);
        ctx.fill();
        // 同心水纹
        ctx.strokeStyle = 'rgba(200,220,230,0.35)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.ellipse(0, 0, r * i * 0.28, r * i * 0.2, 0.1, 0, Math.PI * 2);
          ctx.stroke();
        }
        // 波纹亮点
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        const sparklePositions = [
          [-r * 0.35, -r * 0.2, 2], [r * 0.25, -r * 0.3, 1.5],
          [-r * 0.1, r * 0.15, 1.5], [r * 0.4, r * 0.25, 2]
        ];
        for (const [sx, sy, sr] of sparklePositions) {
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'wood': {
        // 朽木：长条棕色椭圆（横向）+ 年轮 + 裂纹
        const c = cell.attributes.color || '#6a4a30';
        ctx.fillStyle = c;
        ctx.strokeStyle = _shadeColor(c, -40);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.0, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 年轮（多条同心椭弧）
        ctx.strokeStyle = _shadeColor(c, -25);
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
          ctx.beginPath();
          ctx.ellipse(0, 0, r * (1 - i * 0.18), r * (0.45 - i * 0.08), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        // 中央纵向裂纹
        ctx.strokeStyle = _shadeColor(c, -55);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, 0);
        ctx.lineTo(r * 0.7, 0);
        ctx.stroke();
        break;
      }
      case 'sand': {
        // 淡黄色圆形沙地 + 散沙粒
        const c = cell.attributes.color || '#c09860';
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.95, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        // 散沙粒
        ctx.fillStyle = _shadeColor(c, -30);
        for (let i = 0; i < 25; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() * r * 0.8;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 1.0, 0, Math.PI * 2);
          ctx.fill();
        }
        // 沙粒高光
        ctx.fillStyle = 'rgba(255,235,180,0.5)';
        for (let i = 0; i < 8; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() * r * 0.7;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default: break;
    }
    return true;
  }

  // ===== _shadeColor =====
  function _shadeColor(hex, percent) {
    if (!hex) return '#888888';
    // 兼容短 hex
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    if (hex.length !== 7) return hex;
    const num = parseInt(hex.slice(1), 16);
    let r = (num >> 16) + percent * 2.55;
    let g = ((num >> 8) & 0x00ff) + percent * 2.55;
    let b = (num & 0x0000ff) + percent * 2.55;
    r = Math.max(0, Math.min(255, Math.round(r)));
    g = Math.max(0, Math.min(255, Math.round(g)));
    b = Math.max(0, Math.min(255, Math.round(b)));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  // ===== MAP_PRESETS =====
  const MAP_PRESETS = {
    grassland: {
      name: '温带草原',
      backgroundColor: '#d8e0c4',
      foodMultiplier: 1.0,
      energyConsumption: 1.0,
      enemyMultiplier: 1.0,
      antSpecies: ['lasius_niger', 'formica_fusca', 'myrmica', 'camponotus', 'messor', 'lasium_flavus'],
      plantSpecies: ['setaria_viridis', 'plantago_major', 'trifolium_repens', 'oxalis_corniculata', 'fragaria_vesca', 'solanum_lycopersicum', 'agaricus_bisporus', 'coprinus_comatus'],
      insectSpecies: ['coccinella_septempunctata', 'vespa', 'aphid', 'theraphosidae', 'scolopendra', 'cicindela'],
      description: '温和的草地生态，食物与天敌均衡。游戏默认地图。'
    },
    desert: {
      name: '沙漠戈壁',
      backgroundColor: '#d4b88a',
      foodMultiplier: 0.55,
      energyConsumption: 1.15,
      enemyMultiplier: 1.25,
      antSpecies: ['messor', 'cataglyphis', 'lasium_flavus'],
      plantSpecies: ['alhagi', 'salsola'],
      insectSpecies: ['myrmeleon', 'theraphosidae', 'scolopendra', 'cicindela'],
      description: '干旱少水，食物稀少，移动消耗更大。天敌活跃（蚁狮伏击）。适合长距觅食策略。'
    },
    deciduous: {
      name: '落叶阔叶林',
      backgroundColor: '#c4d8b0',
      foodMultiplier: 1.2,
      energyConsumption: 0.95,
      enemyMultiplier: 1.05,
      antSpecies: ['lasius_niger', 'formica_fusca', 'myrmica', 'camponotus', 'reticulitermes', 'lasium_flavus'],
      plantSpecies: ['setaria_viridis', 'trifolium_repens', 'oxalis_corniculata', 'agaricus_bisporus', 'coprinus_comatus', 'quercus', 'tilia'],
      insectSpecies: ['coccinella_septempunctata', 'vespa', 'aphid', 'theraphosidae', 'cicindela'],
      description: '温带森林，有大型乔木（蒙古栎·椴树）提供高能量橡子与蜜露。'
    },
    rainforest: {
      name: '热带雨林',
      backgroundColor: '#88a878',
      foodMultiplier: 1.5,
      energyConsumption: 0.9,
      enemyMultiplier: 1.35,
      antSpecies: ['camponotus', 'pheidole', 'paraponera', 'polyrachis', 'reticulitermes'],
      plantSpecies: ['ficus', 'tilia', 'fragaria_vesca', 'solanum_lycopersicum', 'agaricus_bisporus', 'oxalis_corniculata'],
      insectSpecies: ['vespa', 'theraphosidae', 'scolopendra', 'aphid', 'cicindela'],
      description: '高湿度高生物量，食物与战斗资源极丰富，但敌人也多。'
    }
  };

  // ===== buildMapScene =====
  function buildMapScene(presetKey, options) {
    options = options || {};
    const preset = MAP_PRESETS[presetKey];
    if (!preset) {
      const available = Object.keys(MAP_PRESETS).join(', ');
      return { error: '未知地图预设: ' + presetKey + '，可用: ' + available };
    }

    const cc = window.CellCore;
    const rb = window.RenderBridge;
    if (!cc) return { error: 'CellCore 未初始化' };

    // 1. 清空世界（可选，默认开启）
    const clearWorld = options.clearWorld !== false;
    let cleared = 0;
    if (clearWorld && typeof cc.destroyAllNonEngineCells === 'function') {
      cleared = cc.destroyAllNonEngineCells();
    }

    // 2. 设置地图背景色
    if (rb && typeof rb.setBackgroundColor === 'function') {
      rb.setBackgroundColor(preset.backgroundColor);
    }

    // 3. 确定生成范围（以相机为中心，或指定中心+半径）
    const density = options.density || 1.0;
    let center = options.center || null;
    let radius = options.radius || 0;
    if (!center) {
      if (rb && typeof rb.getCamera === 'function') {
        const cam = rb.getCamera();
        center = { x: cam.x, y: cam.y };
        radius = radius || Math.max(800, (rb.getWidth ? rb.getWidth() / 2 : 600));
      } else {
        center = { x: 0, y: 0 };
        radius = 1000;
      }
    }
    if (!radius) radius = 1000;

    let plantCount = 0, insectCount = 0, treeCount = 0, waterCount = 0, rockCount = 0, nestCount = 0, antCount = 0;
    // 收集已生成的圆形占用（用于避免重叠）
    const _occupied = [];
    // 预填充：从 CellCore 读取已有 cell 的位置和半径
    try {
      if (typeof cc.getAllCells === 'function') {
        const existing = cc.getAllCells();
        if (Array.isArray(existing)) {
          for (const ec of existing) {
            if (ec && typeof ec.x === 'number' && typeof ec.y === 'number' && typeof ec.radius === 'number') {
              _occupied.push({ x: ec.x, y: ec.y, radius: ec.radius });
            }
          }
        }
      }
    } catch (e) {}

    // 辅助: 在范围内生成随机坐标，并避免与已有圆重叠
    function randomPos(minDist, selfRadius) {
      let x, y, tries = 0;
      const minD = minDist || 60;
      const selfR = selfRadius || 15;
      while (tries < 40) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        x = center.x + Math.cos(angle) * r;
        y = center.y + Math.sin(angle) * r;
        // 不要太靠近中心（中心留给玩家放置蚂蚁窝）
        if (Math.hypot(x - center.x, y - center.y) < minD) {
          tries++;
          continue;
        }
        // 检查与已有圆的距离
        let overlap = false;
        for (const occ of _occupied) {
          const d = Math.hypot(x - occ.x, y - occ.y);
          // 保持间距 = 自身半径 + 对方半径 + 最小边距
          if (d < (selfR + occ.radius + 10)) {
            overlap = true;
            break;
          }
        }
        if (!overlap) return { x, y };
        tries++;
      }
      // fallback: 仍然返回一个位置（可能重叠，但避免无限循环）
      return { x: center.x + (Math.random() - 0.5) * radius, y: center.y + (Math.random() - 0.5) * radius };
    }

    // 每次创建 cell 后记录占用
    function _recordOccupy(x, y, r) {
      _occupied.push({ x, y, radius: r || 15 });
    }
    const autoLoadBehaviorTargets = [];

    // 3.5 【游戏流程改动】玩家后续会通过控制台"create_queen"主动创建蚁后，
    //     蚁后会自己找安全的地方建造蚁巢并产下工蚁。
    //     这里不再预先生成蚁巢和蚂蚁，留给玩家操作。

    // 4. 根据预设生成植物
    const plantSpecies = preset.plantSpecies || [];
    const basePlantCount = Math.round(25 * (preset.foodMultiplier || 1.0) * density);
    for (let i = 0; i < basePlantCount; i++) {
      if (plantSpecies.length === 0) break;
      const spKey = plantSpecies[Math.floor(Math.random() * plantSpecies.length)];
      const sp = PLANT_SPECIES[spKey];
      if (!sp) continue;
      const plantRadius = (sp.size || 15) + 2;
      const pos = randomPos(80, plantRadius);
      const cell = cc.createCell('plant', pos.x, pos.y);
      if (cell) {
        _recordOccupy(pos.x, pos.y, plantRadius);
        const attrs = typeof buildPlantAttributes === 'function' ? buildPlantAttributes(spKey, cell.id) : {};
        const behaviorCode = typeof getPlantBehaviorCode === 'function' ? getPlantBehaviorCode(spKey) : '';
        cc.updateCell(cell.id, {
          name: sp.name || spKey,
          color: sp.color || '#8fbc8f',
          radius: plantRadius + Math.random() * 5,
          code: behaviorCode,
          codeMode: 'continuous',
          attributes: attrs,
          description: (sp.description || '') + '\n[物种ID] ' + spKey
        });
        cc.setAttribute(cell.id, 'species', spKey);
        autoLoadBehaviorTargets.push(cell.id);
        plantCount++;
      }
    }

    // 5. 生成大树（仅落叶林和雨林）
    if (presetKey === 'deciduous' || presetKey === 'rainforest') {
      const treeKeys = plantSpecies.filter(k => k === 'quercus' || k === 'tilia' || k === 'ficus');
      const treeTarget = presetKey === 'rainforest' ? 6 : 4;
      for (let i = 0; i < Math.round(treeTarget * density); i++) {
        if (treeKeys.length === 0) break;
        const spKey = treeKeys[Math.floor(Math.random() * treeKeys.length)];
        const sp = PLANT_SPECIES[spKey];
        if (!sp) continue;
        const largeRadius = 45 + Math.random() * 20;
        const pos = randomPos(200, largeRadius);
        const cell = cc.createCell('plant', pos.x, pos.y);
        if (cell) {
          _recordOccupy(pos.x, pos.y, largeRadius);
          const attrs = typeof buildPlantAttributes === 'function' ? buildPlantAttributes(spKey, cell.id) : {};
          const behaviorCode = typeof getPlantBehaviorCode === 'function' ? getPlantBehaviorCode(spKey) : '';
          cc.updateCell(cell.id, {
            name: (sp.name || spKey) + '（大树）',
            color: sp.color || '#556b2f',
            radius: largeRadius,
            code: behaviorCode,
            codeMode: 'continuous',
            attributes: attrs,
            description: (sp.description || '') + '\n[物种ID] ' + spKey
          });
          cc.setAttribute(cell.id, 'species', spKey);
          autoLoadBehaviorTargets.push(cell.id);
          treeCount++;
        }
      }
    }

    // 6. 生成水源（草原 / 雨林多，沙漠极少）
    let waterTargets = { grassland: 3, deciduous: 2, rainforest: 5, desert: 1 };
    const waterTarget = waterTargets[presetKey] || 2;
    const waterCode = typeof getSceneObjectBehaviorCode === 'function' ? getSceneObjectBehaviorCode('water') : '';
    for (let i = 0; i < Math.round(waterTarget * density); i++) {
      const waterRadius = 30 + Math.random() * 40;
      const pos = randomPos(150, waterRadius);
      const cell = cc.createCell('empty', pos.x, pos.y);
      if (cell) {
        _recordOccupy(pos.x, pos.y, waterRadius);
        cc.updateCell(cell.id, {
          name: presetKey === 'desert' ? '绿洲·小水洼' : '水源',
          color: presetKey === 'desert' ? '#8bb8c4' : '#4a90c2',
          radius: waterRadius,
          shape: 'circle',
          code: waterCode,
          codeMode: 'continuous',
          attributes: { type: 'water', energy: 200, hydration: 100, sceneType: 'water' },
          description: '水体，蚂蚁可在此补充水分。'
        });
        autoLoadBehaviorTargets.push(cell.id);
        waterCount++;
      }
    }

    // 7. 生成岩石/障碍物（沙漠多岩石）
    let rockTargets = { desert: 8, grassland: 3, deciduous: 4, rainforest: 2 };
    const rockTarget = rockTargets[presetKey] || 3;
    const rockCode = typeof getSceneObjectBehaviorCode === 'function' ? getSceneObjectBehaviorCode('rock') : '';
    for (let i = 0; i < Math.round(rockTarget * density); i++) {
      const r = 20 + Math.random() * 30;
      const pos = randomPos(120, r);
      const cell = cc.createCell('empty', pos.x, pos.y);
      if (cell) {
        _recordOccupy(pos.x, pos.y, r);
        cc.updateCell(cell.id, {
          name: '岩石',
          color: presetKey === 'desert' ? '#a89070' : '#808080',
          radius: r,
          shape: 'circle',
          code: rockCode,
          codeMode: 'continuous',
          attributes: { type: 'rock', hardness: 0.8, sceneType: 'rock' },
          description: presetKey === 'desert' ? '风化砂岩' : '林间石块'
        });
        autoLoadBehaviorTargets.push(cell.id);
        rockCount++;
      }
    }

    // 8. 生成昆虫（非蚂蚁）— 数量根据 enemyMultiplier
    const insectSpecies = preset.insectSpecies || [];
    const baseInsectCount = Math.round(12 * (preset.enemyMultiplier || 1.0) * density);
    for (let i = 0; i < baseInsectCount; i++) {
      if (insectSpecies.length === 0) break;
      const spKey = insectSpecies[Math.floor(Math.random() * insectSpecies.length)];
      const sp = INSECT_SPECIES[spKey];
      if (!sp) continue;
      const insectRadius = (sp.size || 12) + 2;
      const pos = randomPos(100, insectRadius);
      const cell = cc.createCell('insect', pos.x, pos.y);
      if (cell) {
        _recordOccupy(pos.x, pos.y, insectRadius);
        const attrs = typeof buildInsectAttributes === 'function' ? buildInsectAttributes(spKey, cell.id) : {};
        const behaviorCode = typeof getInsectBehaviorCode === 'function' ? getInsectBehaviorCode(spKey) : '';
        cc.updateCell(cell.id, {
          name: sp.name || spKey,
          color: sp.color || '#ff6347',
          radius: insectRadius + Math.random() * 4,
          code: behaviorCode,
          codeMode: 'continuous',
          attributes: attrs,
          description: (sp.description || '') + '\n[物种ID] ' + spKey
        });
        cc.setAttribute(cell.id, 'species', spKey);
        autoLoadBehaviorTargets.push(cell.id);
        insectCount++;
      }
    }

    // 9. 统一自动加载行为代码到沙箱中（让昆虫/植物真正动起来）
    // 延迟一帧确保 CellCore 的 cell.code 已保存
    if (typeof setTimeout === 'function' && autoLoadBehaviorTargets.length > 0) {
      setTimeout(() => {
        const sb = window.Sandbox;
        if (!sb || typeof sb.loadBehaviorCode !== 'function') return;
        for (let i = 0; i < autoLoadBehaviorTargets.length; i++) {
          const cid = autoLoadBehaviorTargets[i];
          if (typeof cc.getCell !== 'function') continue;
          const c = cc.getCell(cid);
          if (c && c.code && c.state !== 'error') {
            try {
              sb.loadBehaviorCode(cid, c.code, c.codeMode || 'continuous');
            } catch (e) {
              // 单个 cell 失败不影响其他
            }
          }
        }
      }, 100);
    }

    return {
      presetKey: presetKey,
      presetName: preset.name,
      cleared: cleared,
      plants: plantCount,
      trees: treeCount,
      insects: insectCount,
      waters: waterCount,
      rocks: rockCount,
      nests: nestCount,
      ants: antCount,
      total: plantCount + treeCount + insectCount + waterCount + rockCount + nestCount + antCount,
      background: preset.backgroundColor,
      description: preset.description,
      autoLoadedBehaviors: autoLoadBehaviorTargets.length
    };
  }

  // ===== 导出场景相关 API =====
  F.getSceneObjectBehaviorCode = getSceneObjectBehaviorCode;
  F.drawSpeciesAppearance = drawSpeciesAppearance;
  F._drawAntAppearance = _drawAntAppearance;
  F._drawInsectAppearance = _drawInsectAppearance;
  F._drawPlantAppearance = _drawPlantAppearance;
  F._drawSceneObject = _drawSceneObject;
  F._shadeColor = _shadeColor;
  F.MAP_PRESETS = MAP_PRESETS;
  F.buildMapScene = buildMapScene;

  // 兼容顶层调用
  global.buildMapScene = buildMapScene;
  global.drawSpeciesAppearance = drawSpeciesAppearance;

})(typeof window !== 'undefined' ? window : globalThis);
