// ================================================================
// species_plant.js - 植物行为 + 外观绘制代码生成器
// 依赖: species_core.js (提供 PLANT_SPECIES)
// ================================================================
(function (global) {
  'use strict';

  const D = global._SpeciesData;
  const F = global._SpeciesFns;
  const PLANT_SPECIES = D.PLANT_SPECIES;

  // ===== _getPlantDrawCode =====
  function _getPlantDrawCode(key) {
    const sp = PLANT_SPECIES[key];
    if (!sp) return '';
    const color = sp.color;
    const type = sp.type;

    const shadow = '// 地面阴影\nctx.save();ctx.globalAlpha=0.2;ctx.fillStyle="#000";ctx.beginPath();ctx.ellipse(0,r*0.3,r,r*0.3,0,0,Math.PI*2);ctx.fill();ctx.restore();';
    const shadeFn = 'const _sh=function(h,p){if(!h)return"#555";if(h.length===4)h="#"+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];if(h.length!==7)return h;const n=parseInt(h.slice(1),16);let r=(n>>16)+p*2.55,g=((n>>8)&0xff)+p*2.55,b=(n&0xff)+p*2.55;r=Math.max(0,Math.min(255,Math.round(r)));g=Math.max(0,Math.min(255,Math.round(g)));b=Math.max(0,Math.min(255,Math.round(b)));return"#"+((r<<16)|(g<<8)|b).toString(16).padStart(6,"0");};';

    let body = '';
    switch (type) {
      case 'grass':
        body = shadeFn + shadow +
'// 禾本科：7片细长叶 + 茎 + 穗\n' +
'ctx.strokeStyle = \'${color}\';\n' +
'ctx.lineWidth = 2;\n' +
'for (let i = 0; i < 7; i++) {\n' +
'  const angle = -Math.PI / 2 + (i - 3.5) * 0.35;\n' +
'  const lenRatios = [0.88, 0.92, 0.96, 1.0, 0.97, 0.93, 0.87];\n' +
'  const len = r * lenRatios[i];\n' +
'  ctx.beginPath();\n' +
'  ctx.moveTo(0, 0);\n' +
'  ctx.quadraticCurveTo(Math.cos(angle) * len * 0.6, Math.sin(angle) * len * 0.6 - r * 0.15, Math.cos(angle) * len, Math.sin(angle) * len);\n' +
'  ctx.stroke();\n' +
'}\n' +
'ctx.strokeStyle = _sh(\'${color}\', -20);\n' +
'ctx.lineWidth = 2.5;\n' +
'ctx.beginPath();\n' +
'ctx.moveTo(0, r * 0.1);\n' +
'ctx.lineTo(0, -r * 0.6);\n' +
'ctx.stroke();\n' +
'const spikeColor = _sh(\'${color}\', -30);\n' +
'ctx.fillStyle = spikeColor;\n' +
'for (let i = 0; i < 5; i++) {\n' +
'  ctx.beginPath();\n' +
'  ctx.ellipse(0, -r * 0.6 - i * r * 0.12, r * 0.18, r * 0.1, 0, 0, Math.PI * 2);\n' +
'  ctx.fill();\n' +
'}\n' +
'ctx.fillStyle = _sh(\'${color}\', -45);\n' +
'for (let i = 0; i < 3; i++) {\n' +
'  ctx.beginPath();\n' +
'  ctx.arc(Math.cos(-Math.PI / 2 + (i - 1) * 0.6) * r * 1.05, Math.sin(-Math.PI / 2 + (i - 1) * 0.6) * r * 0.9, 1.8, 0, Math.PI * 2);\n' +
'  ctx.fill();\n' +
'}';
        break;
      case 'herb':
      case 'forb':
        body = shadeFn + shadow +
'// 阔叶草本：5片放射状叶 + 中央生长点\n' +
'const leafCount = 5;\n' +
'for (let i = 0; i < leafCount; i++) {\n' +
'  const angle = (i / leafCount) * Math.PI * 2 - Math.PI / 2;\n' +
'  const lx = Math.cos(angle) * r * 0.6;\n' +
'  const ly = Math.sin(angle) * r * 0.6;\n' +
'  ctx.fillStyle = _sh(\'${color}\', i % 2 === 0 ? -5 : -18);\n' +
'  ctx.beginPath();\n' +
'  ctx.ellipse(lx * 0.6, ly * 0.6, r * 0.4, r * 0.2, angle, 0, Math.PI * 2);\n' +
'  ctx.fill();\n' +
'  ctx.strokeStyle = _sh(\'${color}\', -40);\n' +
'  ctx.lineWidth = 0.8;\n' +
'  ctx.beginPath();\n' +
'  ctx.moveTo(0, 0);\n' +
'  ctx.lineTo(lx, ly);\n' +
'  ctx.stroke();\n' +
'}\n' +
'ctx.fillStyle = _sh(\'${color}\', -25);\n' +
'ctx.beginPath();\n' +
'ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);\n' +
'ctx.fill();';
        break;
      case 'fruit':
        body = shadeFn + shadow +
'// 果实：绿色叶丛 + 3颗红色浆果\n' +
'ctx.fillStyle = _sh(\'${color}\', -30);\n' +
'for (let i = 0; i < 5; i++) {\n' +
'  ctx.beginPath();\n' +
'  ctx.ellipse(Math.cos(-Math.PI / 2 + (i - 2) * 0.35) * r * 0.3, Math.sin(-Math.PI / 2 + (i - 2) * 0.35) * r * 0.3 - r * 0.1, r * 0.25, r * 0.15, -Math.PI / 2 + (i - 2) * 0.35, 0, Math.PI * 2);\n' +
'  ctx.fill();\n' +
'}\n' +
'const fruitPositions = [[0, -r * 0.15, r * 0.3], [-r * 0.35, r * 0.15, r * 0.22], [r * 0.35, r * 0.15, r * 0.22]];\n' +
'for (let i = 0; i < fruitPositions.length; i++) {\n' +
'  const [fx, fy, fr] = fruitPositions[i];\n' +
'  const grad = ctx.createRadialGradient(fx - fr * 0.3, fy - fr * 0.3, 0, fx, fy, fr);\n' +
'  grad.addColorStop(0, \'#ff8060\');\n' +
'  grad.addColorStop(1, \'#c84040\');\n' +
'  ctx.fillStyle = grad;\n' +
'  ctx.beginPath();\n' +
'  ctx.arc(fx, fy, fr, 0, Math.PI * 2);\n' +
'  ctx.fill();\n' +
'  ctx.fillStyle = \'rgba(255,255,255,0.45)\';\n' +
'  ctx.beginPath();\n' +
'  ctx.arc(fx - fr * 0.3, fy - fr * 0.3, fr * 0.25, 0, Math.PI * 2);\n' +
'  ctx.fill();\n' +
'}';
        break;
      case 'mushroom':
        body = shadeFn + shadow +
'// 蘑菇：菌柄 + 半圆菌伞 + 鳞片\n' +
'ctx.fillStyle = \'#f5ead0\';\n' +
'ctx.beginPath();\n' +
'ctx.rect(-r * 0.12, -r * 0.05, r * 0.24, r * 0.5);\n' +
'ctx.fill();\n' +
'const cap = ctx.createRadialGradient(0, -r * 0.1, 0, 0, -r * 0.1, r * 0.8);\n' +
'cap.addColorStop(0, _sh(\'${color}\', 25));\n' +
'cap.addColorStop(1, \'${color}\');\n' +
'ctx.fillStyle = cap;\n' +
'ctx.beginPath();\n' +
'ctx.arc(0, -r * 0.1, r * 0.85, Math.PI, 0, false);\n' +
'ctx.closePath();\n' +
'ctx.fill();\n' +
'ctx.fillStyle = _sh(\'${color}\', -35);\n' +
'for (let i = 0; i < 7; i++) {\n' +
'  const ang = -Math.PI + (i + 0.5) / 7 * Math.PI;\n' +
'  ctx.beginPath();\n' +
'  ctx.arc(Math.cos(ang) * r * 0.55, -r * 0.1 + Math.sin(ang) * r * 0.55, r * 0.08, 0, Math.PI * 2);\n' +
'  ctx.fill();\n' +
'}\n' +
'ctx.strokeStyle = _sh(\'${color}\', -40);\n' +
'ctx.lineWidth = 1.2;\n' +
'ctx.beginPath();\n' +
'ctx.arc(0, -r * 0.1, r * 0.85, Math.PI, 0, false);\n' +
'ctx.stroke();';
        break;
      case 'tree':
        body = shadeFn + shadow +
'// 乔木：树干 + 树冠多圆团\n' +
'ctx.fillStyle = _sh(\'${color}\', -40);\n' +
'ctx.beginPath();\n' +
'ctx.rect(-r * 0.15, -r * 0.1, r * 0.3, r * 0.7);\n' +
'ctx.fill();\n' +
'ctx.strokeStyle = _sh(\'${color}\', -55);\n' +
'ctx.lineWidth = 1;\n' +
'for (let i = 0; i < 3; i++) {\n' +
'  const lx = -r * 0.12 + i * r * 0.12;\n' +
'  ctx.beginPath();\n' +
'  ctx.moveTo(lx, -r * 0.05);\n' +
'  ctx.lineTo(lx - r * 0.02, r * 0.55);\n' +
'  ctx.stroke();\n' +
'}\n' +
'const canopyBlobs = [[0, -r * 0.35, r * 0.7], [-r * 0.45, -r * 0.25, r * 0.45], [r * 0.45, -r * 0.25, r * 0.45], [-r * 0.25, -r * 0.6, r * 0.45], [r * 0.25, -r * 0.6, r * 0.45], [0, -r * 0.75, r * 0.55]];\n' +
'for (let i = 0; i < canopyBlobs.length; i++) {\n' +
'  const [cx, cy, cr] = canopyBlobs[i];\n' +
'  const grad = ctx.createRadialGradient(cx, cy - cr * 0.3, cr * 0.1, cx, cy, cr);\n' +
'  grad.addColorStop(0, _sh(\'${color}\', 30));\n' +
'  grad.addColorStop(1, _sh(\'${color}\', -20));\n' +
'  ctx.fillStyle = grad;\n' +
'  ctx.beginPath();\n' +
'  ctx.arc(cx, cy, cr, 0, Math.PI * 2);\n' +
'  ctx.fill();\n' +
'}';
        break;
      case 'succulent':
      case 'thorn':
        body = shadeFn + shadow +
'// 肉质/沙漠植物：5团绿色块 + 刺\n' +
'for (let i = 0; i < 5; i++) {\n' +
'  const ang = (i / 5) * Math.PI * 2;\n' +
'  const bx = Math.cos(ang) * r * 0.3;\n' +
'  const by = Math.sin(ang) * r * 0.3;\n' +
'  ctx.fillStyle = _sh(\'${color}\', i * 8 - 15);\n' +
'  ctx.beginPath();\n' +
'  ctx.ellipse(bx, by, r * 0.35, r * 0.22, ang, 0, Math.PI * 2);\n' +
'  ctx.fill();\n' +
'}\n' +
'ctx.fillStyle = _sh(\'${color}\', -30);\n' +
'ctx.beginPath();\n' +
'ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);\n' +
'ctx.fill();\n' +
'ctx.strokeStyle = _sh(\'${color}\', -45);\n' +
'ctx.lineWidth = 1.2;\n' +
'for (let i = 0; i < 10; i++) {\n' +
'  const ang = (i / 10) * Math.PI * 2;\n' +
'  ctx.beginPath();\n' +
'  ctx.moveTo(Math.cos(ang) * r * 0.35, Math.sin(ang) * r * 0.35);\n' +
'  ctx.lineTo(Math.cos(ang) * r * 0.75, Math.sin(ang) * r * 0.75);\n' +
'  ctx.stroke();\n' +
'}';
        break;
      default:
        body = `${shadow}ctx.fillStyle='${color}';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();`;
    }

    // 替换 body 中所有 ${color} 占位符为实际颜色值
    body = body.split('${color}').join(color);
    return body;
  }


  // ===== getPlantBehaviorCode =====
  function getPlantBehaviorCode(key) {
    const sp = PLANT_SPECIES[key];
    if (!sp) return '';
    const drawBody = _getPlantDrawCode(key);
    // 注意：所有字符串字面量用 '\\n'（文字反斜杠+n），确保 new Function() 验证通过
    const drawCode =
      '// =================== 外观绘制 ===================\\n' +
      'api.registerDraw(function(ctx, r) {\\n' +
      drawBody.split('\n').map(l => '  ' + l).join('\\n') + '\\n' +
      '});\\n' +
      '\\n';
    const behaviorCode =
      '// =================== 基本属性（属性面板参数定义）===================\\n' +
      '// ' + sp.name + '（' + sp.latin + '）\\n' +
      '// 以下属性定义同步更新属性面板的基本信息\\n' +
      '\\n' +
      'if (!api.getProperty("initialized")) {\\n' +
      '  api.setProperty("initialized", true);\\n' +
      '  api.setProperty("name", "' + sp.name + '");\\n' +
      '  api.setProperty("species", "' + key + '");\\n' +
      '  api.setKind("plant");\\n' +
      '  api.setProperty("type", "' + sp.type + '");\\n' +
      '  api.setColor("' + sp.color + '");\\n' +
      '  api.setRadius(' + sp.size + ');\\n' +
      '  api.setProperty("seedEnergy", ' + sp.seedEnergy + ');\\n' +
      '  api.setProperty("seedsRemaining", ' + sp.seedsPerCycle + ');\\n' +
      '  api.setProperty("growth", 0);\\n' +
      '  api.setProperty("preferred", ' + (sp.preferred || 0) + ');\\n' +
      '  api.setProperty("nutrients", ' + (sp.nutrients || 5) + ');\\n' +
      '}\\n' +
      '\\n' +
      '// 每 600 帧（10秒）生长一次\\n' +
      'if (api.getFrame() % 600 === 0) {\\n' +
      '  const g = Math.min(1, (api.getProperty("growth") || 0) + 0.03);\\n' +
      '  api.setProperty("growth", g);\\n' +
      '  api.setRadius(' + sp.size + ' * (0.6 + g * 0.4));\\n' +
      '}\\n' +
      '\\n' +
      '// 每 1200 帧(20秒)散一颗草籽，直到用完；带密度自限\\n' +
      '// 注意：树木(type=tree)不主动散播种子，维持静态\\n' +
      'if (sp.type !== "tree" && api.getFrame() % 1200 === 0 && (api.getProperty("seedsRemaining") || 0) > 0) {\\n' +
      '  var _nbAll = api.findAllWithinRadius(api.getX(), api.getY(), 50);\\n' +
      '  var nearbyCount = 0;\\n' +
      '  for (var _i = 0; _i < _nbAll.length; _i++) {\\n' +
      '    if (_nbAll[_i].kind === "plant") nearbyCount++;\\n' +
      '  }\\n' +
      '  if (nearbyCount < 8) {\\n' +
      '    api.setProperty("seedsRemaining", (api.getProperty("seedsRemaining") || 0) - 1);\\n' +
      '    var sx = api.getX() + (Math.random() - 0.5) * 30;\\n' +
      '    var sy = api.getY() + (Math.random() - 0.5) * 30;\\n' +
      '    api.createCell({\\n' +
      '      kind: "plant",\\n' +
      '      x: sx,\\n' +
      '      y: sy,\\n' +
      '      name: "草籽",\\n' +
      '      color: "#c8b050",\\n' +
      '      radius: 3,\\n' +
      '      code: "' + _getSeedCode(key, sp).split('\n').join('\\n').replace(/"/g, '\\"') + '",\\n' +
      '      mode: "continuous",\\n' +
      '      attributes: { seedEnergy: ' + sp.seedEnergy + ', type: "seed", species: "' + key + '" }\\n' +
      '    });\\n' +
      '  }\\n' +
      '}\\n';
    return drawCode + behaviorCode;
  }

  // ===== 种子发芽代码（发芽后变成完整植物）=====
  function _getSeedCode(key, sp) {
    // 种子发芽后：修改自身属性变成一株完整植物（不再创建新基圆）
    // 注意：发芽后的植物不会再散播种子（简化逻辑，避免无限繁殖）
    // 不使用 registerDraw 避免 drawBody 多层转义问题；发芽后保持默认外观
    var lines = [
      'if (!api.getProperty("_seedInit")) { api.setProperty("_seedInit", true); api.setProperty("_germinateStart", api.getFrame()); api.setProperty("_seedR", 3); }',
      'if (api.getFrame() % 600 === 0) {',
      '  var _elapsed = api.getFrame() - (api.getProperty("_germinateStart") || 0);',
      '  if (_elapsed > 6000) {',
      '    var _curR = api.getProperty("_seedR") || 3;',
      '    if (_curR < ' + sp.size + ') {',
      '      var _newR = Math.min(' + sp.size + ', _curR + 2);',
      '      api.setRadius(_newR);',
      '      api.setProperty("_seedR", _newR);',
      '    } else {',
      '      api.setProperty("name", "' + sp.name + '");',
      '      api.setProperty("type", "' + sp.type + '");',
      '      api.setProperty("seedsRemaining", 0);',
      '    }',
      '  }',
      '}',
    ];
    return lines.join('\n');
  }

  // ===== 导出植物相关 API =====
  F.getPlantBehaviorCode = getPlantBehaviorCode;
  F._getPlantDrawCode = _getPlantDrawCode;

  // 兼容顶层调用
  global.getPlantBehaviorCode = getPlantBehaviorCode;

})(typeof window !== 'undefined' ? window : globalThis);
