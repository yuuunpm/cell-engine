// ================================================================
// species_insect.js - 昆虫行为代码生成器
// 依赖: species_core.js (提供 INSECT_SPECIES 数据)
//       species_scene.js (提供 _drawInsectAppearance 绘制函数)
//
// 绘制策略简化：不在行为代码中内联完整绘制逻辑，
// 而是调用全局的 SpeciesRegistry._drawInsectAppearance 方法。
// ================================================================
(function (global) {
  'use strict';

  const D = global._SpeciesData;
  const F = global._SpeciesFns;
  const INSECT_SPECIES = D.INSECT_SPECIES;

  // ===== _getInsectDrawCode: 简化版外观绘制代码生成器 =====
  // 返回可在 api.registerDraw(function(ctx, r){...}) 中使用的代码字符串
  // 策略：使用简化的通用绘制 + 全局 _drawInsectAppearance 调用
  function _getInsectDrawCode(speciesKey) {
    const sp = INSECT_SPECIES[speciesKey];
    if (!sp) {
      return 'ctx.fillStyle = "#888";ctx.beginPath();ctx.arc(0,0,r*0.8,0,Math.PI*2);ctx.fill();';
    }

    const color = sp.color;
    const spotColor = sp.spotColor || '#1a1a1a';

    // 通用阴影
    const shadow = 'ctx.save();ctx.globalAlpha=0.2;ctx.fillStyle="#000";' +
      'ctx.beginPath();ctx.ellipse(0,r*0.2,r*1.1,r*0.5,0,0,Math.PI*2);ctx.fill();ctx.restore();';

    // 根据物种生成简化的外观绘制代码
    let body = shadow;

    switch (speciesKey) {
      case 'coccinella_septempunctata':
        body += 'ctx.fillStyle="' + color + '";ctx.beginPath();ctx.arc(0,0,r*0.95,0,Math.PI*2);ctx.fill();';
        body += 'ctx.strokeStyle="' + spotColor + '";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,-r*0.9);ctx.lineTo(0,r*0.9);ctx.stroke();';
        body += 'ctx.fillStyle="' + spotColor + '";';
        body += 'var _spotR=r*0.15;ctx.beginPath();ctx.arc(0,-r*0.6,_spotR,0,Math.PI*2);ctx.fill();';
        body += 'var _lx=[-r*0.35,-r*0.55,-r*0.3],_ly=[-r*0.25,r*0.25,r*0.65];';
        body += 'for(var _i=0;_i<3;_i++){ctx.beginPath();ctx.arc(_lx[_i],_ly[_i],_spotR,0,Math.PI*2);ctx.fill();';
        body += 'ctx.beginPath();ctx.arc(-_lx[_i],_ly[_i],_spotR,0,Math.PI*2);ctx.fill();}';
        body += 'ctx.fillStyle="' + spotColor + '";ctx.beginPath();ctx.arc(-r*0.95,0,r*0.2,0,Math.PI*2);ctx.fill();';
        break;

      case 'pieris_rapae':
        body += 'ctx.fillStyle="' + color + '";';
        body += 'ctx.beginPath();ctx.moveTo(0,-r*0.1);ctx.quadraticCurveTo(-r*0.6,-r*1.1,r*0.5,-r*0.8);';
        body += 'ctx.quadraticCurveTo(r*0.9,-r*0.3,0,r*0.1);ctx.closePath();ctx.fill();';
        body += 'ctx.beginPath();ctx.moveTo(0,r*0.1);ctx.quadraticCurveTo(-r*0.7,-r*0.3,-r*0.7,r*0.7);';
        body += 'ctx.quadraticCurveTo(0,r*0.9,0,r*0.1);ctx.closePath();ctx.fill();';
        body += 'ctx.beginPath();ctx.moveTo(0,r*0.1);ctx.quadraticCurveTo(r*0.7,-r*0.3,r*0.7,r*0.7);';
        body += 'ctx.quadraticCurveTo(0,r*0.9,0,r*0.1);ctx.closePath();ctx.fill();';
        body += 'ctx.fillStyle="' + spotColor + '";ctx.beginPath();ctx.ellipse(0,0,r*0.15,r*0.35,0,0,Math.PI*2);ctx.fill();';
        break;

      case 'aphid':
        body += 'ctx.fillStyle="' + color + '";';
        body += 'ctx.beginPath();ctx.ellipse(0,0,r*0.55,r*0.4,0,0,Math.PI*2);ctx.fill();';
        body += 'ctx.fillStyle="' + spotColor + '";ctx.beginPath();ctx.arc(-r*0.5,0,r*0.2,0,Math.PI*2);ctx.fill();';
        body += 'ctx.strokeStyle="' + spotColor + '";ctx.lineWidth=0.8;';
        body += 'ctx.beginPath();ctx.moveTo(-r*0.55,-r*0.15);ctx.lineTo(-r*0.75,-r*0.35);';
        body += 'ctx.moveTo(-r*0.55,r*0.15);ctx.lineTo(-r*0.75,r*0.35);ctx.stroke();';
        break;

      case 'theraphosidae':
        body += 'ctx.fillStyle="' + color + '";ctx.beginPath();ctx.arc(0,0,r*0.45,0,Math.PI*2);ctx.fill();';
        body += 'ctx.strokeStyle="' + color + '";ctx.lineWidth=Math.max(1.2,r*0.08);';
        body += 'var _ang=[-2.8,-2,-1.2,1.2,2,2.8];';
        body += 'for(var _j=0;_j<_ang.length;_j++){var _a=_ang[_j];';
        body += 'var _ex=Math.cos(_a)*r*1.0,_ey=Math.sin(_a)*r*0.6;';
        body += 'var _mx=Math.cos(_a+(_a<0?-0.3:0.3))*r*0.7,_my=Math.sin(_a+(_a<0?-0.3:0.3))*r*0.5;';
        body += 'ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(_mx,_my);ctx.lineTo(_ex,_ey);ctx.stroke();}';
        body += 'ctx.fillStyle="' + spotColor + '";ctx.beginPath();ctx.arc(-r*0.3,-r*0.1,r*0.08,0,Math.PI*2);ctx.fill();';
        body += 'ctx.beginPath();ctx.arc(-r*0.3,r*0.1,r*0.08,0,Math.PI*2);ctx.fill();';
        break;

      case 'scolopendra':
        body += 'var _now=Date.now(),_waveP=_now*0.002;';
        body += 'var _segments=6,_totalLen=r*1.6,_segW=_totalLen/_segments;';
        body += 'var _startX=-_totalLen/2+_segW/2;var _bodyY=function(_i){return Math.sin(_waveP+_i*0.5)*r*0.08;};';
        body += 'for(var _i=0;_i<_segments;_i++){var _sx=_startX+_i*_segW,_sy=_bodyY(_i);';
        body += 'ctx.fillStyle=_i%2===0?"' + color + '":"' + (spotColor === '#1a1a1a' ? '#7a5838' : spotColor) + '";';
        body += 'ctx.beginPath();ctx.ellipse(_sx,_sy,_segW*0.38,r*0.3,0,0,Math.PI*2);ctx.fill();';
        body += 'ctx.strokeStyle="' + spotColor + '";ctx.lineWidth=0.8;ctx.stroke();';
        body += 'if(_i>0){ctx.strokeStyle="' + spotColor + '";ctx.lineWidth=1.0;';
        body += 'ctx.beginPath();ctx.moveTo(_sx-_segW*0.5,_sy-r*0.25);ctx.lineTo(_sx-_segW*0.5,_sy+r*0.25);ctx.stroke();}}';
        body += 'var _headX=_startX+5.5*_segW,_headY=_bodyY(5);';
        body += 'ctx.fillStyle="' + (spotColor === '#1a1a1a' ? '#4a2a18' : spotColor) + '";';
        body += 'ctx.beginPath();ctx.ellipse(_headX,_headY,r*0.2,r*0.22,0,0,Math.PI*2);ctx.fill();';
        body += 'ctx.strokeStyle="' + spotColor + '";ctx.lineWidth=1.8;ctx.lineCap="round";';
        body += 'ctx.beginPath();ctx.moveTo(_headX+r*0.22,_headY-r*0.12);';
        body += 'ctx.quadraticCurveTo(_headX+r*0.55,_headY-r*0.22,_headX+r*0.78,_headY-r*0.06);';
        body += 'ctx.moveTo(_headX+r*0.22,_headY+r*0.12);';
        body += 'ctx.quadraticCurveTo(_headX+r*0.55,_headY+r*0.22,_headX+r*0.78,_headY+r*0.06);ctx.stroke();';
        body += 'ctx.fillStyle="#e04020";';
        body += 'ctx.beginPath();ctx.arc(_headX+r*0.78,_headY-r*0.06,1.4,0,Math.PI*2);';
        body += 'ctx.arc(_headX+r*0.78,_headY+r*0.06,1.4,0,Math.PI*2);ctx.fill();';
        body += 'var _tailX=_startX-_segW*0.5,_tailY=_bodyY(0);';
        body += 'ctx.fillStyle="' + (spotColor === '#1a1a1a' ? '#4a1a0d' : spotColor) + '";';
        body += 'ctx.beginPath();ctx.ellipse(_tailX,_tailY,r*0.18,r*0.18,0,Math.PI*2);ctx.fill();';
        body += 'ctx.strokeStyle="' + spotColor + '";ctx.lineWidth=0.6;ctx.stroke();';
        break;

      case 'cicindela':
        body += 'ctx.fillStyle="' + color + '";';
        body += 'ctx.beginPath();ctx.ellipse(0,0,r*0.55,r*0.35,0,0,Math.PI*2);ctx.fill();';
        body += 'ctx.strokeStyle="' + spotColor + '";ctx.lineWidth=1.0;';
        body += 'for(var _k=-2;_k<=2;_k++){ctx.beginPath();ctx.moveTo(_k*r*0.08,-r*0.35);ctx.lineTo(_k*r*0.08,r*0.35);ctx.stroke();}';
        body += 'ctx.fillStyle="' + spotColor + '";';
        body += 'ctx.beginPath();ctx.arc(-r*0.6,-r*0.1,r*0.15,0,Math.PI*2);ctx.fill();';
        body += 'ctx.beginPath();ctx.arc(-r*0.6,r*0.1,r*0.15,0,Math.PI*2);ctx.fill();';
        body += 'ctx.strokeStyle="' + spotColor + '";ctx.lineWidth=1.5;ctx.lineCap="round";';
        body += 'ctx.beginPath();ctx.moveTo(-r*0.55,-r*0.1);';
        body += 'ctx.quadraticCurveTo(-r*1.1,-r*0.25,-r*1.3,-r*0.15);';
        body += 'ctx.moveTo(-r*0.55,r*0.1);';
        body += 'ctx.quadraticCurveTo(-r*1.1,r*0.25,-r*1.3,r*0.15);ctx.stroke();';
        body += 'ctx.strokeStyle="' + color + '";ctx.lineWidth=1.0;';
        body += 'var _legAngles=[-2.5,-1.5,1.5,2.5];';
        body += 'for(var _k2=0;_k2<_legAngles.length;_k2++){var _la=_legAngles[_k2];';
        body += 'ctx.beginPath();ctx.moveTo(Math.cos(_la)*r*0.2,Math.sin(_la)*r*0.15);';
        body += 'ctx.lineTo(Math.cos(_la)*r*0.9,Math.sin(_la)*r*0.6);ctx.stroke();}';
        break;

      case 'vespa':
        body += 'ctx.fillStyle="' + spotColor + '";';
        body += 'ctx.beginPath();ctx.ellipse(0,0,r*0.55,r*0.35,0,0,Math.PI*2);ctx.fill();';
        body += 'ctx.fillStyle="' + color + '";';
        body += 'for(var _s=0;_s<4;_s++){ctx.beginPath();';
        body += 'ctx.ellipse((_s-1.5)*r*0.25,0,r*0.12,r*0.35,0,0,Math.PI*2);ctx.fill();}';
        body += 'ctx.fillStyle="' + spotColor + '";';
        body += 'ctx.beginPath();ctx.arc(-r*0.6,0,r*0.18,0,Math.PI*2);ctx.fill();';
        body += 'ctx.fillStyle="rgba(255,255,255,0.3)";';
        body += 'ctx.beginPath();ctx.ellipse(r*0.1,-r*0.25,r*0.4,r*0.25,-0.5,0,Math.PI*2);ctx.fill();';
        body += 'ctx.beginPath();ctx.ellipse(r*0.1,r*0.25,r*0.4,r*0.25,0.5,0,Math.PI*2);ctx.fill();';
        body += 'ctx.strokeStyle="' + spotColor + '";ctx.lineWidth=1.0;';
        body += 'ctx.beginPath();ctx.moveTo(-r*0.65,-r*0.1);';
        body += 'ctx.lineTo(-r*0.9,-r*0.25);ctx.moveTo(-r*0.65,r*0.1);ctx.lineTo(-r*0.9,r*0.25);ctx.stroke();';
        break;

      case 'myrmeleon':
        body += 'ctx.fillStyle="rgba(180,140,80,0.3)";';
        body += 'ctx.beginPath();ctx.arc(0,0,r*1.5,0,Math.PI*2);ctx.fill();';
        body += 'ctx.strokeStyle="' + color + '";ctx.lineWidth=1.0;';
        body += 'ctx.beginPath();ctx.arc(0,0,r*1.2,0,Math.PI*2);ctx.stroke();';
        body += 'ctx.beginPath();ctx.arc(0,0,r*0.9,0,Math.PI*2);ctx.stroke();';
        body += 'ctx.fillStyle="' + color + '";';
        body += 'ctx.beginPath();ctx.ellipse(0,0,r*0.35,r*0.25,0,0,Math.PI*2);ctx.fill();';
        body += 'ctx.strokeStyle="' + spotColor + '";ctx.lineWidth=1.2;';
        body += 'ctx.beginPath();ctx.moveTo(-r*0.3,-r*0.1);ctx.lineTo(-r*0.6,-r*0.15);';
        body += 'ctx.moveTo(-r*0.3,r*0.1);ctx.lineTo(-r*0.6,r*0.15);ctx.stroke();';
        break;

      default:
        body += 'ctx.fillStyle="' + color + '";';
        body += 'ctx.beginPath();ctx.arc(0,0,r*0.8,0,Math.PI*2);ctx.fill();';
        body += 'ctx.strokeStyle="' + spotColor + '";ctx.lineWidth=1.0;ctx.stroke();';
    }

    return body;
  }

  // ===== getInsectBehaviorCode: 完整行为代码生成器 =====
  // 生成包含: 外观绘制 + 初始化 + 战斗处理 + 具体行为逻辑 的完整代码字符串
  function getInsectBehaviorCode(key) {
    const sp = INSECT_SPECIES[key];
    if (!sp) return '';
    const hostile = sp.hostile ? 'true' : 'false';

    // 外观绘制代码
    const drawBody = _getInsectDrawCode(key);
    const drawCode =
      '// =================== 外观绘制 ===================\n' +
      '// 以下代码通过 api.registerDraw 注册到渲染系统\n' +
      '// 只要复制这段代码，新基圆就会呈现同样的外观\n' +
      'api.registerDraw(function(ctx, r) {\n' +
      drawBody.split('\n').map(l => '  ' + l).join('\n') + '\n' +
      '});\n' +
      '\n';

    // 基本属性初始化（所有昆虫共享）
    const initBlock =
      'if (!api.getProperty("initialized")) {\n' +
      '  api.setProperty("initialized", true);\n' +
      '  api.setProperty("name", "' + sp.name + '");\n' +
      '  api.setProperty("species", "' + key + '");\n' +
      '  api.setKind("insect");\n' +
      '  api.setProperty("behaviorKind", "' + sp.kind + '");\n' +
      '  api.setProperty("hostile", ' + hostile + ');\n' +
      '  api.setColor("' + sp.color + '");\n' +
      '  api.setProperty("spotColor", "' + (sp.spotColor || '#1a1a1a') + '");\n' +
      '  api.setRadius(' + sp.size + ');\n' +
      '  api.setProperty("hp", ' + (30 + sp.energyValue) + ');\n' +
      '  api.setProperty("maxHp", ' + (30 + sp.energyValue) + ');\n' +
      '  api.setProperty("attackPower", ' + sp.attackPower + ');\n' +
      '  api.setProperty("aggression", ' + sp.aggression + ');\n' +
      '  api.setProperty("defense", ' + (sp.defense || 0) + ');\n' +
      '  api.setProperty("energyValue", ' + sp.energyValue + ');\n' +
      '  api.setProperty("speed", ' + sp.speed.toFixed(2) + ');\n' +
      '  api.setProperty("flying", ' + (sp.flying ? 'true' : 'false') + ');\n' +
      '  api.setProperty("direction", Math.random() * Math.PI * 2);\n' +
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
      '\n';

    // === 各物种差异化行为 ===
    let behavior = '';

    if (key === 'myrmeleon') {
      // 蚁狮：静态陷阱伏击
      behavior =
        '// ========== 蚁狮行为：静态陷阱 ==========\n' +
        '// 不移动，守在原地。附近经过的蚂蚁会被拖拽袭击\n' +
        '\n' +
        '// 扩大陷阱外观：半径 = 20（比默认8更大）\n' +
        'if (!api.getProperty("_trapSizeSet")) {\n' +
        '  api.setProperty("_trapSizeSet", true);\n' +
        '  api.setRadius(20);\n' +
        '  api.setProperty("speed", 0);\n' +
        '}\n' +
        '\n' +
        '// 陷阱伏击：检查半径内是否有蚂蚁\n' +
        'if (api.getFrame() % 30 === 0) {\n' +
        '  const nearby = api.findAllWithinRadius(api.getX(), api.getY(), 30);\n' +
        '  for (let i = 0; i < nearby.length; i++) {\n' +
        '    const nc = nearby[i];\n' +
        '    if (nc.attributes && (nc.attributes.antId || nc.attributes.species === "ant")) {\n' +
        '      // 伏击：发起攻击\n' +
        '      api.setProperty("lastAttack", api.getFrame());\n' +
        '      try {\n' +
        '        if (typeof api.attack === "function") {\n' +
        '          api.attack(nc.id, api.getProperty("attackPower") || 5);\n' +
        '        } else if (typeof nc.emit === "function") {\n' +
        '          nc.emit("attack", { damage: api.getProperty("attackPower") || 5 });\n' +
        '        }\n' +
        '      } catch (e) {}\n' +
        '      break;\n' +
        '    }\n' +
        '  }\n' +
        '}\n' +
        '\n';
    } else if (hostile === 'true') {
      // 敌对昆虫通用战斗行为（狼蛛、蜈蚣、虎甲、胡蜂）
      behavior =
        '// ========== 敌对昆虫行为：漫游 + 主动攻击蚂蚁 ==========\n' +
        'const speed = api.getProperty("speed") || 0.5;\n' +
        'const dir = api.getProperty("direction") || 0;\n' +
        'const agg = api.getProperty("aggression") || 0.5;\n' +
        '\n' +
        '// 寻找附近蚂蚁作为目标\n' +
        'let targetCell = null;\n' +
        'let minDist = Infinity;\n' +
        'if (api.getFrame() % 20 === 0) {\n' +
        '  const nearby = api.findAllWithinRadius(api.getX(), api.getY(), 80);\n' +
        '  for (let i = 0; i < nearby.length; i++) {\n' +
        '    const nc = nearby[i];\n' +
        '    if (nc.attributes && (nc.attributes.antId || nc.attributes.species === "ant")) {\n' +
        '      const d = Math.hypot(nc.x - api.getX(), nc.y - api.getY());\n' +
        '      if (d < minDist) { minDist = d; targetCell = nc; }\n' +
        '    }\n' +
        '  }\n' +
        '  if (targetCell) {\n' +
        '    api.setProperty("targetId", targetCell.id);\n' +
        '  } else {\n' +
        '    api.setProperty("targetId", null);\n' +
        '  }\n' +
        '}\n' +
        '\n' +
        '// 有目标时追击目标\n' +
        'const targetId = api.getProperty("targetId");\n' +
        'if (targetId) {\n' +
        '  // 追击方向\n' +
        '  const targetCell2 = api.findCellById ? api.findCellById(targetId) : null;\n' +
        '  let chaseX = api.getX(), chaseY = api.getY();\n' +
        '  if (targetCell2) {\n' +
        '    chaseX = targetCell2.x; chaseY = targetCell2.y;\n' +
        '    const ndx = chaseX - api.getX(), ndy = chaseY - api.getY();\n' +
        '    const nd = Math.hypot(ndx, ndy) || 1;\n' +
        '    api.moveTo(api.getX() + (ndx/nd) * speed, api.getY() + (ndy/nd) * speed);\n' +
        '    // 攻击范围检测\n' +
        '    if (nd < 15 && api.getFrame() % 30 < 3) {\n' +
        '      try {\n' +
        '        if (typeof api.attack === "function") {\n' +
        '          api.attack(targetId, api.getProperty("attackPower") || 3);\n' +
        '        } else if (typeof targetCell2.emit === "function") {\n' +
        '          targetCell2.emit("attack", { damage: api.getProperty("attackPower") || 3 });\n' +
        '        }\n' +
        '      } catch (e) {}\n' +
        '    }\n' +
        '  } else {\n' +
        '    // 目标丢失，随机漫游\n' +
        '    if (Math.random() < 0.02) {\n' +
        '      api.setProperty("direction", Math.random() * Math.PI * 2);\n' +
        '    }\n' +
        '    const nd2 = api.getProperty("direction") || 0;\n' +
        '    api.moveTo(api.getX() + Math.cos(nd2) * speed, api.getY() + Math.sin(nd2) * speed);\n' +
        '  }\n' +
        '} else {\n' +
        '  // 无目标时随机漫游\n' +
        '  if (Math.random() < 0.02) {\n' +
        '    api.setProperty("direction", Math.random() * Math.PI * 2);\n' +
        '  }\n' +
        '  const nd3 = api.getProperty("direction") || 0;\n' +
        '  api.moveTo(api.getX() + Math.cos(nd3) * speed, api.getY() + Math.sin(nd3) * speed);\n' +
        '}\n' +
        '\n';
    } else {
      // 温和昆虫行为（瓢虫、菜粉蝶、蚜虫）
      behavior =
        '// ========== 温和昆虫行为：随机漫游，被攻击时逃跑 ==========\n' +
        'const speed = api.getProperty("speed") || 0.4;\n' +
        'let dir = api.getProperty("direction") || 0;\n' +
        '\n' +
        '// 偶尔改变方向\n' +
        'if (Math.random() < 0.03) {\n' +
        '  dir = dir + (Math.random() - 0.5) * 1.2;\n' +
        '  api.setProperty("direction", dir);\n' +
        '}\n' +
        '\n' +
        '// 检测是否有敌人（敌对昆虫或蚂蚁）靠近\n' +
        'if (api.getFrame() % 30 === 0) {\n' +
        '  const nearby = api.findAllWithinRadius(api.getX(), api.getY(), 50);\n' +
        '  let threatX = 0, threatY = 0, hasThreat = false;\n' +
        '  for (let i = 0; i < nearby.length; i++) {\n' +
        '    const nc = nearby[i];\n' +
        '    if (nc.id === api.getProperty("id")) continue;\n' +
        '    if (nc.attributes && nc.attributes.hostile) {\n' +
        '      threatX += nc.x - api.getX();\n' +
        '      threatY += nc.y - api.getY();\n' +
        '      hasThreat = true;\n' +
        '    }\n' +
        '  }\n' +
        '  if (hasThreat) {\n' +
        '    // 逃跑方向\n' +
        '    const escapeAngle = Math.atan2(-threatY, -threatX);\n' +
        '    api.setProperty("direction", escapeAngle);\n' +
        '    dir = escapeAngle;\n' +
        '  }\n' +
        '}\n' +
        '\n' +
        '// 移动\n' +
        'api.moveTo(api.getX() + Math.cos(dir) * speed, api.getY() + Math.sin(dir) * speed);\n' +
        '\n';
    }

    return drawCode + initBlock + behavior;
  }

  // ===== 导出昆虫相关 API =====
  F.getInsectBehaviorCode = getInsectBehaviorCode;
  F._getInsectDrawCode = _getInsectDrawCode;

  // 兼容顶层调用
  global.getInsectBehaviorCode = getInsectBehaviorCode;

})(typeof window !== 'undefined' ? window : globalThis);
