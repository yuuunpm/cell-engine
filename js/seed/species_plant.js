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
        body = `${shadeFn}${shadow}
// 禾本科：7片细长叶 + 茎 + 穗
const leafCount = 7;
ctx.strokeStyle = '${color}';
ctx.lineWidth = 2;
for (let i = 0; i < leafCount; i++) {
  const angle = -Math.PI / 2 + (i - leafCount / 2) * 0.35;
  const lenRatios = [0.88, 0.92, 0.96, 1.0, 0.97, 0.93, 0.87];
  const len = r * lenRatios[i];
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const midX = Math.cos(angle) * len * 0.5;
  const midY = Math.sin(angle) * len * 0.5;
  ctx.quadraticCurveTo(midX * 1.2, midY - r * 0.15, Math.cos(angle) * len, Math.sin(angle) * len);
  ctx.stroke();
}
// 茎
ctx.strokeStyle = _sh('${color}', -20);
ctx.lineWidth = 2.5;
ctx.beginPath();
ctx.moveTo(0, r * 0.1);
ctx.lineTo(0, -r * 0.6);
ctx.stroke();
// 穗
const spikeColor = _sh('${color}', -30);
ctx.fillStyle = spikeColor;
for (let i = 0; i < 5; i++) {
  const yy = -r * 0.6 - i * r * 0.12;
  ctx.beginPath();
  ctx.ellipse(0, yy, r * 0.18, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
}
// 草籽
ctx.fillStyle = _sh('${color}', -45);
for (let i = 0; i < 3; i++) {
  const ang = -Math.PI / 2 + (i - 1) * 0.6;
  ctx.beginPath();
  ctx.arc(Math.cos(ang) * r * 1.05, Math.sin(ang) * r * 0.9, 1.8, 0, Math.PI * 2);
  ctx.fill();
}`;
        break;
      case 'herb':
      case 'forb':
        body = `${shadeFn}${shadow}
// 阔叶草本：5片放射状叶 + 中央生长点
const leafCount = 5;
for (let i = 0; i < leafCount; i++) {
  const angle = (i / leafCount) * Math.PI * 2 - Math.PI / 2;
  const lx = Math.cos(angle) * r * 0.6;
  const ly = Math.sin(angle) * r * 0.6;
  ctx.fillStyle = _sh('${color}', i % 2 === 0 ? -5 : -18);
  ctx.beginPath();
  ctx.ellipse(lx * 0.6, ly * 0.6, r * 0.4, r * 0.2, angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = _sh('${color}', -40);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(lx, ly);
  ctx.stroke();
}
ctx.fillStyle = _sh('${color}', -25);
ctx.beginPath();
ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
ctx.fill();`;
        break;
      case 'fruit':
        body = `${shadeFn}${shadow}
// 果实：绿色叶丛 + 3颗红色浆果
ctx.fillStyle = _sh('${color}', -30);
for (let i = 0; i < 5; i++) {
  const ang = -Math.PI / 2 + (i - 2) * 0.35;
  ctx.beginPath();
  ctx.ellipse(Math.cos(ang) * r * 0.3, Math.sin(ang) * r * 0.3 - r * 0.1, r * 0.25, r * 0.15, ang, 0, Math.PI * 2);
  ctx.fill();
}
const fruitPositions = [[0, -r * 0.15, r * 0.3], [-r * 0.35, r * 0.15, r * 0.22], [r * 0.35, r * 0.15, r * 0.22]];
for (let i = 0; i < fruitPositions.length; i++) {
  const [fx, fy, fr] = fruitPositions[i];
  const grad = ctx.createRadialGradient(fx - fr * 0.3, fy - fr * 0.3, 0, fx, fy, fr);
  grad.addColorStop(0, '#ff8060');
  grad.addColorStop(1, '#c84040');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(fx, fy, fr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(fx - fr * 0.3, fy - fr * 0.3, fr * 0.25, 0, Math.PI * 2);
  ctx.fill();
}`;
        break;
      case 'mushroom':
        body = `${shadeFn}${shadow}
// 蘑菇：菌柄 + 半圆菌伞 + 鳞片
ctx.fillStyle = '#f5ead0';
ctx.beginPath();
ctx.rect(-r * 0.12, -r * 0.05, r * 0.24, r * 0.5);
ctx.fill();
const cap = ctx.createRadialGradient(0, -r * 0.1, 0, 0, -r * 0.1, r * 0.8);
cap.addColorStop(0, _sh('${color}', 25));
cap.addColorStop(1, '${color}');
ctx.fillStyle = cap;
ctx.beginPath();
ctx.arc(0, -r * 0.1, r * 0.85, Math.PI, 0, false);
ctx.closePath();
ctx.fill();
ctx.fillStyle = _sh('${color}', -35);
for (let i = 0; i < 7; i++) {
  const ang = -Math.PI + (i + 0.5) / 7 * Math.PI;
  ctx.beginPath();
  ctx.arc(Math.cos(ang) * r * 0.55, -r * 0.1 + Math.sin(ang) * r * 0.55, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
}
ctx.strokeStyle = _sh('${color}', -40);
ctx.lineWidth = 1.2;
ctx.beginPath();
ctx.arc(0, -r * 0.1, r * 0.85, Math.PI, 0, false);
ctx.stroke();`;
        break;
      case 'tree':
        body = `${shadeFn}${shadow}
// 乔木：树干 + 树冠多圆团
ctx.fillStyle = _sh('${color}', -40);
ctx.beginPath();
ctx.rect(-r * 0.15, -r * 0.1, r * 0.3, r * 0.7);
ctx.fill();
ctx.strokeStyle = _sh('${color}', -55);
ctx.lineWidth = 1;
for (let i = 0; i < 3; i++) {
  const lx = -r * 0.12 + i * r * 0.12;
  ctx.beginPath();
  ctx.moveTo(lx, -r * 0.05);
  ctx.lineTo(lx - r * 0.02, r * 0.55);
  ctx.stroke();
}
const canopyBlobs = [[0, -r * 0.35, r * 0.7], [-r * 0.45, -r * 0.25, r * 0.45], [r * 0.45, -r * 0.25, r * 0.45], [-r * 0.25, -r * 0.6, r * 0.45], [r * 0.25, -r * 0.6, r * 0.45], [0, -r * 0.75, r * 0.55]];
for (let i = 0; i < canopyBlobs.length; i++) {
  const [cx, cy, cr] = canopyBlobs[i];
  const grad = ctx.createRadialGradient(cx, cy - cr * 0.3, cr * 0.1, cx, cy, cr);
  grad.addColorStop(0, _sh('${color}', 30));
  grad.addColorStop(1, _sh('${color}', -20));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, cr, 0, Math.PI * 2);
  ctx.fill();
}`;
        break;
      case 'succulent':
      case 'thorn':
        body = `${shadeFn}${shadow}
// 肉质/沙漠植物：5团绿色块 + 刺
for (let i = 0; i < 5; i++) {
  const ang = (i / 5) * Math.PI * 2;
  const bx = Math.cos(ang) * r * 0.3;
  const by = Math.sin(ang) * r * 0.3;
  ctx.fillStyle = _sh('${color}', i * 8 - 15);
  ctx.beginPath();
  ctx.ellipse(bx, by, r * 0.35, r * 0.22, ang, 0, Math.PI * 2);
  ctx.fill();
}
ctx.fillStyle = _sh('${color}', -30);
ctx.beginPath();
ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = _sh('${color}', -45);
ctx.lineWidth = 1.2;
for (let i = 0; i < 10; i++) {
  const ang = (i / 10) * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(Math.cos(ang) * r * 0.35, Math.sin(ang) * r * 0.35);
  ctx.lineTo(Math.cos(ang) * r * 0.75, Math.sin(ang) * r * 0.75);
  ctx.stroke();
}`;
        break;
      default:
        body = `${shadow}ctx.fillStyle='${color}';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();`;
    }

    return body;
  }


  // ===== getPlantBehaviorCode =====
  function getPlantBehaviorCode(key) {
    const sp = PLANT_SPECIES[key];
    if (!sp) return '';
    const drawBody = _getPlantDrawCode(key);
    const drawCode =
      '// =================== 外观绘制 ===================\n' +
      'api.registerDraw(function(ctx, r) {\n' +
      drawBody.split('\n').map(l => '  ' + l).join('\n') + '\n' +
      '});\n' +
      '\n';
    const behaviorCode =
      '// =================== 基本属性（属性面板参数定义）===================\n' +
      ('// ' + sp.name + '（' + sp.latin + '）\n') +
      '// 以下属性定义同步更新属性面板的基本信息\n' +
      '\n' +
      'if (!api.getProperty("initialized")) {\n' +
      '  api.setProperty("initialized", true);\n' +
      '  // --- 基本信息 ---\n' +
      '  api.setProperty("name", "' + sp.name + '");       // 名称\n' +
      '  api.setProperty("species", "' + key + '");         // 物种key（用于外观识别）\n' +
      '  api.setKind("plant");                              // 基圆种类：植物\n' +
      '  api.setProperty("type", "' + sp.type + '");        // 类型（grass/herb/fruit/mushroom/tree/succulent）\n' +
      '  // --- 外观参数 ---\n' +
      '  api.setColor("' + sp.color + '");                 // 主体颜色\n' +
      '  api.setRadius(' + sp.size + ');                    // 体型（半径）\n' +
      '  // --- 植物参数 ---\n' +
      '  api.setProperty("seedEnergy", ' + sp.seedEnergy + ');           // 每颗草籽能量值\n' +
      '  api.setProperty("seedsRemaining", ' + sp.seedsPerCycle + ');     // 可散布草籽总数\n' +
      '  api.setProperty("growth", 0);                       // 当前生长阶段（0~1）\n' +
      '  api.setProperty("preferred", ' + (sp.preferred || 0) + ');     // 蚂蚁取食偏好（0~1）\n' +
      '  api.setProperty("nutrients", ' + (sp.nutrients || 5) + ');    // 营养价值\n' +
      '}\n' +
      '\n' +
      '// 每 600 帧（10秒）生长一次\n' +
      'if (api.getFrame() % 600 === 0) {\n' +
      '  const g = Math.min(1, (api.getProperty("growth") || 0) + 0.03);\n' +
      '  api.setProperty("growth", g);\n' +
      '  api.setRadius(' + sp.size + ' * (0.6 + g * 0.4));\n' +
      '}\n' +
      '\n' +
      '// 密度自限：如果附近已有太多植物/种子则停止散播（避免过度拥挤）\n' +
      'var nearbyCount = 0;\n' +
      'var _nbAll = api.findAllWithinRadius(api.getX(), api.getY(), 50);\n' +
      'for (var _i = 0; _i < _nbAll.length; _i++) {\n' +
      '  var _nn = _nbAll[_i];\n' +
      '  if (_nn.kind === "plant") nearbyCount++;\n' +
      '}\n' +
      'var _allowScatter = nearbyCount < 8;\n' +
      '\n' +
      '// 每 1200 帧(20秒)散一颗草籽，直到用完；带密度自限和种子自动发芽\n' +
      'if (_allowScatter && api.getFrame() % 1200 === 0 && (api.getProperty("seedsRemaining") || 0) > 0) {\n' +
      '  api.setProperty("seedsRemaining", (api.getProperty("seedsRemaining") || 0) - 1);\n' +
      '  var sx = api.getX() + (Math.random() - 0.5) * 30;\n' +
      '  var sy = api.getY() + (Math.random() - 0.5) * 30;\n' +
      '  var seedCode = "' +
      'if (api.getFrame() === 1) { api.setProperty(\\"_germinateStart\\", api.getFrame()); api.setProperty(\\"_seedR\\", 3); }\\n" +' +
      '"if (api.getFrame() % 600 === 0) {\\n" +' +
      '"  var _elapsed = api.getFrame() - (api.getProperty(\\"_germinateStart\\") || 0);\\n" +' +
      '"  if (_elapsed > 6000) {\\n" +' +   // 100秒后开始发芽成长
      '"    var _curR = api.getProperty(\\"_seedR\\") || 3;\\n" +' +
      '"    if (_curR < ' + sp.size + ') {\\n" +' +
      '"      var _newR = Math.min(' + sp.size + ', _curR + 2);\\n" +' +
      '"      api.setRadius(_newR);\\n" +' +
      '"      api.setProperty(\\"_seedR\\", _newR);\\n" +' +
      '"      api.setProperty(\\"name\\", \\"' + sp.name + '（幼苗）\\");\\n" +' +
      '"      api.setColor(\\"' + sp.color + '\\");\\n" +' +
      '"    }\\n" +' +
      '"  }\\n" +' +
      '"}";' +
      '  api.createCell({\n' +
      '    kind: "plant",\n' +
      '    x: sx,\n' +
      '    y: sy,\n' +
      '    name: "草籽",\n' +
      '    color: "#c8b050",\n' +
      '    radius: 3,\n' +
      '    code: seedCode,\n' +
      '    mode: "continuous",\n' +
      '    attributes: { seedEnergy: ' + sp.seedEnergy + ', type: "seed", species: "' + key + '" }\n' +
      '  });\n' +
      '}\n';
    return drawCode + behaviorCode;
  }

  // ===== 导出植物相关 API =====
  F.getPlantBehaviorCode = getPlantBehaviorCode;
  F._getPlantDrawCode = _getPlantDrawCode;

  // 兼容顶层调用
  global.getPlantBehaviorCode = getPlantBehaviorCode;

})(typeof window !== 'undefined' ? window : globalThis);
