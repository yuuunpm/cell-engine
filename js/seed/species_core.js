// ================================================================
// species_core.js  (必须第一个加载 — 其他文件依赖本文件)
// 包含: 物种数据字典 (ANT_SPECIES / PLANT_SPECIES / INSECT_SPECIES)
//       + 性格标签 (ANT_PERSONALITIES)
//       + 场景对象类型 (SCENE_OBJECT_TYPES)
//       + 颜色工具 _shadeColor
//       + 属性构建器 buildAntAttributes / buildPlantAttributes / buildInsectAttributes
// ================================================================
(function (global) {
  'use strict';

  // ---------- 数据字典 ----------
  global._SpeciesData = global._SpeciesData || {};
  const D = global._SpeciesData;

  D.ANT_SPECIES = {
    lasius_niger: {
      name: '花园黑蚁', latin: 'Lasius niger', color: '#2a1a0e', size: 5,
      speed: 0.70, hp: 30, attackPower: 2, defense: 0.30, maxCarry: 15,
      aggression: 0.40, preferredFood: '杂食·蜜露',
      description: '【学名】Lasius niger\n【分类】膜翅目·蚁科·毛蚁属\n\n【外形】工蚁体长 3-5mm，体黑褐色，触角膝状，腹部椭圆形，体表细密刻点在阳光下微亮。\n\n【习性】最常见的家蚁，地下筑巢，喜路边花坛缝隙。单巢工蚁 50-200 只，多蚁后结构。杂食偏蜜源，会饲养蚜虫获取蜜露，同时也捕食小型昆虫、收集草籽。攻击性中等，主要在保卫食物和巢穴时战斗。\n\n【游戏参数·v3.0】\n速度 0.70 px/帧 ≈ 42px/秒（800px 屏幕横穿约 19 秒）\nHP 30：承受 15-20 次攻击\n攻击 2：每 120 帧（2 秒）一次，战斗节奏舒缓可观察\n防御 30%：减免 30% 伤害\n最大负重 15 能量：可搬运 1-2 颗草籽\n饱食度 100：需每 10-15 分钟觅食补充\n自然寿命 60-120 分钟（类比真实工蚁 7-70 天）\n\n【趣味事实】花园黑蚁沿同伴留下的信息素轨迹觅食，发现新食物源后会沿途留下更浓的信息素召唤同伴。',
      roles: {
        worker: { name: '工蚁', sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0, defenseMul: 1.0, carryMul: 1.0, color: '#2a1a0e' },
        soldier: { name: '兵蚁', sizeMul: 1.2, speedMul: 0.85, attackMul: 2.0, defenseMul: 1.3, carryMul: 0.8, color: '#1a0e06' },
        queen: { name: '繁殖蚁', sizeMul: 1.6, speedMul: 0.9, attackMul: 1.5, defenseMul: 1.5, carryMul: 0.5, color: '#4a2818' }
      }
    },
    formica_fusca: {
      name: '黑园蚁', latin: 'Formica fusca', color: '#180c04', size: 6,
      speed: 0.85, hp: 35, attackPower: 3, defense: 0.40, maxCarry: 18,
      aggression: 0.60, preferredFood: '杂食·偏好昆虫',
      description: '【学名】Formica fusca\n【分类】膜翅目·蚁科·蚁属\n\n【外形】体型比花园黑蚁稍大，工蚁体长 5-7mm，乌黑有光泽，体表毛较密。动作敏捷，常做出"探索式"快速摆动。\n\n【习性】攻击性较高的蚁种，巢小而分散，常见于树根下或石缝中。工蚁行动大胆，敢于单独探索未知区域，对其他蚁种闯入者积极驱赶。\n\n【游戏参数·v3.0】\n速度 0.85 ≈ 51px/秒\nHP 35：较粗壮\n攻击 3：较高攻击\n防御 40%\n攻击性 60%：主动接近其他蚁群',
      roles: {
        worker: { name: '工蚁', sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0, defenseMul: 1.0, carryMul: 1.0, color: '#180c04' },
        soldier: { name: '兵蚁', sizeMul: 1.25, speedMul: 0.9, attackMul: 1.8, defenseMul: 1.4, carryMul: 0.8, color: '#0a0603' },
        scout: { name: '侦察蚁', sizeMul: 0.9, speedMul: 1.35, attackMul: 1.2, defenseMul: 1.1, carryMul: 0.7, color: '#2a1608' }
      }
    },
    reticulitermes: {
      name: '家白蚁', latin: 'Reticulitermes chinensis', color: '#d8c89a', size: 5,
      speed: 0.50, hp: 35, attackPower: 2, defense: 0.50, maxCarry: 25,
      aggression: 0.50, preferredFood: '木材纤维',
      description: '【学名】Reticulitermes chinensis\n【分类】蜚蠊目·白蚁科\n\n【外形】工蚁身体柔软呈乳白色，头部圆形黄褐色，无复眼（退化），触角念珠状。兵蚁头大呈深褐色，上颚弯刀状。\n\n【习性】畏光，几乎终身在修筑的泥路中活动。以木材和植物纤维为食，依赖肠道中共生原生动物消化纤维素。蚂蚁是白蚁在自然环境中的头号天敌。\n\n【游戏参数·v3.0】\n速度 0.50 ≈ 30px/秒（动作缓慢，需仔细观察）\nHP 35：体软但防御高\n防御 50%：硬壳头部吸收一半伤害\n最大负重 25 能量：专门搬运木屑/碎屑',
      roles: {
        worker: { name: '工蚁', sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0, defenseMul: 1.0, carryMul: 1.0, color: '#d8c89a' },
        soldier: { name: '兵蚁', sizeMul: 1.25, speedMul: 0.8, attackMul: 2.5, defenseMul: 1.6, carryMul: 0.7, color: '#7a5838' },
        nymph: { name: '若蚁（繁殖）', sizeMul: 1.15, speedMul: 1.05, attackMul: 1.2, defenseMul: 1.2, carryMul: 0.6, color: '#b8a078' }
      }
    },
    messor: {
      name: '收获蚁', latin: 'Messor aciculatus', color: '#7a5030', size: 6,
      speed: 0.60, hp: 40, attackPower: 2, defense: 0.45, maxCarry: 40,
      aggression: 0.35, preferredFood: '草籽/种子',
      description: '【学名】Messor aciculatus\n【分类】膜翅目·蚁科·收获蚁属\n\n【外形】体红褐色至黑褐色，头部较大，体表多直立针状毛。工蚁明显多态：小工蚁纤细（搬运），大工蚁粗壮（切割/咬碎硬种子）。\n\n【习性】典型的"种子专家"。巢内有专门的粮仓房间储存干燥植物种子。觅食工蚁在草茎和地面寻找成熟种子，用颚切割后搬回巢。收获蚁在生态系统中是重要的"种子传播者"。\n\n【游戏参数·v3.0】\n最大负重 40 能量：同类最强，可搬运大量草籽\n速度 0.60：负重较大因此稍慢\nHP 40：粗壮体型带来更高耐久',
      roles: {
        worker_minor: { name: '小工蚁', sizeMul: 0.85, speedMul: 1.2, attackMul: 0.8, defenseMul: 0.9, carryMul: 1.0, color: '#8a6038' },
        worker_major: { name: '大工蚁', sizeMul: 1.3, speedMul: 0.9, attackMul: 1.5, defenseMul: 1.3, carryMul: 1.5, color: '#5a3820' },
        soldier: { name: '兵蚁', sizeMul: 1.4, speedMul: 0.8, attackMul: 1.8, defenseMul: 1.4, carryMul: 1.6, color: '#4a2c18' },
        replete: { name: '储粮蚁', sizeMul: 1.5, speedMul: 0.5, attackMul: 0.5, defenseMul: 1.6, carryMul: 2.2, color: '#c0a070' }
      }
    },
    monomorium_pharaonis: {
      name: '法老蚁', latin: 'Monomorium pharaonis', color: '#e8c078', size: 3.5,
      speed: 0.95, hp: 18, attackPower: 1, defense: 0.20, maxCarry: 10,
      aggression: 0.35, preferredFood: '甜食/高蛋白',
      description: '【学名】Monomorium pharaonis\n【分类】膜翅目·蚁科·小家蚁属\n\n【外形】小型蚂蚁，工蚁体长仅 1.5-2mm，体淡黄褐色至黄褐色，腹部末端颜色略深。身体光滑有光泽。\n\n【习性】全球分布的入侵性小蚁种，常见于厨房、医院、仓储。喜暖喜湿，对甜食和高蛋白食物（熟蛋黄、昆虫尸体）极度偏好。多蚁后多分巢结构，一个建筑内可能十几个相连蚁巢。\n\n【游戏参数·v3.0】\n体型 3.5：屏幕中最小的蚂蚁之一\n速度 0.95 ≈ 57px/秒：灵巧迅速\nHP 18：脆弱，靠数量取胜',
      roles: {
        worker: { name: '工蚁', sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0, defenseMul: 1.0, carryMul: 1.0, color: '#e8c078' },
        nurse: { name: '哺育蚁', sizeMul: 0.95, speedMul: 0.9, attackMul: 0.6, defenseMul: 1.1, carryMul: 1.2, color: '#d8b068' },
        scout: { name: '侦察蚁', sizeMul: 0.9, speedMul: 1.4, attackMul: 1.0, defenseMul: 0.9, carryMul: 0.7, color: '#f0c888' }
      }
    },
    camponotus: {
      name: '弓背蚁', latin: 'Camponotus japonicus', color: '#2a1810', size: 8,
      speed: 0.65, hp: 60, attackPower: 4, defense: 0.50, maxCarry: 25,
      aggression: 0.50, preferredFood: '昆虫/蜜露/树汁',
      description: '【学名】Camponotus japonicus\n【分类】膜翅目·蚁科·弓背蚁属\n\n【外形】较大型蚁种，工蚁体长 6-12mm。体色黑色或深褐，体壁较厚有光泽，腹部呈卵形。大工蚁/兵蚁头部巨大，上颚粗壮——战斗时抬起头如张弓，故名"弓背"。\n\n【习性】多在朽木或树洞中筑巢，也会在土壤下建巢。夜行性倾向较强，夜间工蚁大量外出觅食。\n\n【游戏参数·v3.0】\n体型 8px：屏幕上较显眼的大蚁\nHP 60：粗壮体壁，需要多次攻击才能击败\n攻击 4：单次伤害最高的蚂蚁之一\n速度 0.65：大体型略显笨拙',
      roles: {
        worker_minor: { name: '小工蚁', sizeMul: 0.8, speedMul: 1.15, attackMul: 0.7, defenseMul: 0.9, carryMul: 0.9, color: '#3a2015' },
        worker_major: { name: '大工蚁', sizeMul: 1.25, speedMul: 0.9, attackMul: 1.4, defenseMul: 1.3, carryMul: 1.2, color: '#1a0e08' },
        soldier: { name: '兵蚁', sizeMul: 1.5, speedMul: 0.8, attackMul: 2.0, defenseMul: 1.5, carryMul: 1.0, color: '#0a0603' }
      }
    },
    pheidole: {
      name: '大头蚁', latin: 'Pheidole noda', color: '#b89050', size: 4.5,
      speed: 0.80, hp: 25, attackPower: 3, defense: 0.45, maxCarry: 12,
      aggression: 0.55, preferredFood: '杂食',
      description: '【学名】Pheidole noda\n【分类】膜翅目·蚁科·大头蚁属\n\n【外形】小型蚁，有明显兵蚁分化。兵蚁头部巨大呈球形（与身体不成比例），上颚强健发达，被称为"种子破碎机"。工蚁细小灵活。\n\n【习性】数量庞大适应性强。工蚁善于寻找小颗粒食物，发现大型目标后会释放信息素召唤同伴，靠数量优势搬运。兵蚁专门处理大型种子、坚硬食物、以及防御战斗。\n\n【游戏参数·v3.0】\n兵蚁攻击 3+：大头蚁的兵蚁依靠大头+大颚打出高伤害\nHP 25：普通工蚁脆',
      roles: {
        worker: { name: '工蚁', sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0, defenseMul: 1.0, carryMul: 1.0, color: '#b89050' },
        soldier: { name: '兵蚁', sizeMul: 1.6, speedMul: 0.75, attackMul: 2.5, defenseMul: 1.6, carryMul: 1.1, color: '#7a5028' }
      }
    },
    tapinoma: {
      name: '黑头酸臭蚁', latin: 'Tapinoma melanocephalum', color: '#555a40', size: 4,
      speed: 0.80, hp: 20, attackPower: 1, defense: 0.25, maxCarry: 12,
      aggression: 0.30, preferredFood: '甜食/蜜露',
      description: '【学名】Tapinoma melanocephalum\n【分类】膜翅目·蚁科·酸臭蚁属\n\n【外形】小型蚁，头黑腹浅色。受惊扰或被压碎时会释放一种类似"腐烂椰子"的独特气味——腹部臀腺分泌的防御性化学物质（含酮类和烷烃类），因此得名"酸臭蚁"。\n\n【习性】温热带常见入侵蚁种。多蚁后多分巢，扩散极快。与法老蚁不同的是：酸臭蚁更偏好甜食，对蛋白质需求较低。攻击性较弱，遇到其他蚁种时通常避开而非战斗。\n\n【游戏参数·v3.0】\nHP 20：脆弱，受攻击容易死亡\n攻击性 30%：低，倾向逃跑而非战斗\n速度 0.80：动作敏捷灵活',
      roles: {
        worker: { name: '工蚁', sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0, defenseMul: 1.0, carryMul: 1.0, color: '#555a40' },
        forager: { name: '觅食蚁', sizeMul: 0.95, speedMul: 1.2, attackMul: 0.9, defenseMul: 0.9, carryMul: 1.3, color: '#6a6a48' }
      }
    },
    polyrachis: {
      name: '多刺蚁', latin: 'Polyrhachis vicina', color: '#3a2a3a', size: 7,
      speed: 0.55, hp: 50, attackPower: 2, defense: 0.60, maxCarry: 20,
      aggression: 0.45, preferredFood: '杂食偏蜜',
      description: '【学名】Polyrhachis vicina\n【分类】膜翅目·蚁科·多刺蚁属\n\n【外形】体黑，体壁较厚有光泽，最显著特征是胸腹连接处有一对明显的小刺（背刺），这是多刺蚁属的共同标志。工蚁体长约 5-7mm，行动稳健。\n\n【习性】分布于中国南方及东南亚。树栖为主，常在灌木丛、竹丛中结织叶巢（用幼虫吐的丝把叶片粘在一起）。也会在地面活动觅食。背刺是物理防御武器——攻击时身体弯曲可将刺刺入对手软组织。\n\n【游戏参数·v3.0】\n防御 60%：同类中最高，背刺+厚壁结构\n速度 0.55：缓慢稳健\nHP 50：高耐久，团队战表现强',
      roles: {
        worker: { name: '工蚁', sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0, defenseMul: 1.0, carryMul: 1.0, color: '#3a2a3a' },
        soldier: { name: '兵蚁', sizeMul: 1.2, speedMul: 0.85, attackMul: 1.8, defenseMul: 1.3, carryMul: 0.9, color: '#1a0f18' },
        nurse: { name: '哺育蚁', sizeMul: 0.95, speedMul: 0.9, attackMul: 0.7, defenseMul: 1.2, carryMul: 1.3, color: '#4a3648' }
      }
    },
    lasium_flavus: {
      name: '黄墩蚁', latin: 'Lasius flavus', color: '#c8b070', size: 4,
      speed: 0.70, hp: 22, attackPower: 1, defense: 0.30, maxCarry: 12,
      aggression: 0.25, preferredFood: '蚜虫蜜露/草籽',
      description: '【学名】Lasius flavus\n【分类】膜翅目·蚁科·毛蚁属\n\n【外形】小型黄色蚂蚁，工蚁体长 2-4mm，通体淡黄褐色，体表有细密毛，阳光下呈金黄色。外观与花园黑蚁相似但颜色鲜明。\n\n【习性】地下筑巢，巢规模可达很大（单巢上千工蚁）。与花园黑蚁同样以饲养蚜虫换取蜜露为生，但黄蚁对蚜虫的"牧养"更专一——它们会主动转移蚜虫到更嫩的植物部位，并保护蚜虫免受瓢虫等天敌侵害。\n\n【游戏参数·v3.0】\n攻击性 25%：同类中最低，以躲避为主而非战斗\n速度 0.70\n最大负重 12 能量：能搬 1 颗草籽或少量蜜露',
      roles: {
        worker: { name: '工蚁', sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0, defenseMul: 1.0, carryMul: 1.0, color: '#c8b070' },
        farmer: { name: '牧蚜蚁', sizeMul: 0.95, speedMul: 0.95, attackMul: 0.7, defenseMul: 1.1, carryMul: 1.4, color: '#d8c080' },
        queen: { name: '繁殖蚁', sizeMul: 1.5, speedMul: 0.9, attackMul: 1.3, defenseMul: 1.4, carryMul: 0.5, color: '#a88848' }
      }
    },
    cataglyphis: {
      name: '箭蚁', latin: 'Cataglyphis bicolor', color: '#8a5a3a', size: 5,
      speed: 1.10, hp: 28, attackPower: 2, defense: 0.35, maxCarry: 18,
      aggression: 0.45, preferredFood: '种子·昆虫尸体',
      description: '【学名】Cataglyphis bicolor\n【分类】膜翅目·蚁科·箭蚁属\n\n【外形】中大型蚂蚁，工蚁体长 6-10mm，体色红褐至深褐。最显著特征是极长的步足（身体比例上是蚂蚁中步足最长的种类之一），以及可360°旋转的灵活胸部——这些都是适应沙漠开阔地快速移动和快速定位猎物的进化产物。\n\n【习性】典型的沙漠/干旱区代表种。与依靠信息素导航的蚂蚁不同，箭蚁主要依靠**太阳位置和偏振光**进行精确导航（这是科学家研究最多的"昆虫导航"模型种）。工蚁在沙漠地表长距离（几十米至数百米）觅食，发现食物后几乎沿直线返回巢穴——在千篇一律的沙地上做到这一点需要极精密的"路径积分(path integration)"能力。\n\n【游戏参数·v4.0】\n速度 1.10 px/帧 ≈ 66px/秒（蚂蚁中最快之一，对应沙漠长距觅食）\nHP 28：中等耐久（高温环境下需要较强体能）\n攻击 2：独居觅食者，不依靠群体战斗\n防御 35%：硬壳减少水分蒸发（沙漠生存的关键）\n最大负重 18 能量：搬运能力强（每次觅食收益要覆盖往返消耗）\n饱食消耗 +10%：沙漠高温导致代谢更快\n【地图限制】仅在沙漠/戈壁地图中出现（特有种）',
      roles: {
        worker: { name: '工蚁', sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0, defenseMul: 1.0, carryMul: 1.0, color: '#8a5a3a' },
        forager: { name: '长距觅食蚁', sizeMul: 0.95, speedMul: 1.25, attackMul: 0.9, defenseMul: 0.9, carryMul: 1.3, color: '#a06a40' }
      }
    },
    myrmica: {
      name: '红蚁', latin: 'Myrmica rubra', color: '#b03030', size: 4,
      speed: 0.85, hp: 25, attackPower: 2, defense: 0.32, maxCarry: 12,
      aggression: 0.60, preferredFood: '蚜虫蜜露·小昆虫',
      description: '【学名】Myrmica rubra\n【分类】膜翅目·蚁科·红蚁属\n\n【外形】小型蚂蚁，工蚁体长 4-5mm，体色红褐至深红。腹部有明显的后腹柄节（两节），区别于其他蚂蚁的单节。\n\n【习性】欧亚大陆温带最常见的蚂蚁之一，筑巢于石块下或腐烂木材中。攻击性中等，遇到同类其他蚁群会主动攻击。工蚁会"放牧"蚜虫获取蜜露，同时也捕食小型节肢动物。\n\n【游戏参数·v4.0】\n速度 0.85，HP 25，攻击 2（工蚁会主动攻击），防御 32%。\n【地图限制】温带草原·落叶阔叶林地图。',
      roles: {
        worker: { name: '工蚁', sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0, defenseMul: 1.0, carryMul: 1.0, color: '#b03030' },
        soldier: { name: '兵蚁', sizeMul: 1.15, speedMul: 0.9, attackMul: 1.6, defenseMul: 1.25, carryMul: 0.9, color: '#8a2020' }
      }
    },
    paraponera: {
      name: '子弹蚁', latin: 'Paraponera clavata', color: '#2a1a0a', size: 8,
      speed: 0.90, hp: 50, attackPower: 6, defense: 0.45, maxCarry: 15,
      aggression: 0.75, preferredFood: '大型昆虫·花蜜',
      description: '【学名】Paraponera clavata\n【分类】膜翅目·蚁科·近猛蚁亚科\n\n【外形】体长 18-25mm（工蚁），是世界上体型最大的蚂蚁之一。体色深褐至近黑，上颚发达。俗名"子弹蚁"来自其叮咬——被评为"昆虫界最痛的叮咬"（施密特叮咬指数最高级4.0+），据称痛感"如同被子弹击中"。\n\n【习性】热带雨林树冠层及下层活动。单独觅食，捕食大型昆虫。毒性极强（含神经毒素poneratoxin），叮咬可造成24小时持续疼痛。\n\n【游戏参数·v4.0】\n速度 0.90，HP 50（超高耐久），攻击 6（游戏中最高攻击之一——可一击击杀多数小型蚂蚁），防御 45%。\n【地图限制】热带雨林地图特有。威胁等级：极高。',
      roles: {
        worker: { name: '工蚁', sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0, defenseMul: 1.0, carryMul: 1.0, color: '#2a1a0a' }
      }
    }
  };

  D.PLANT_SPECIES = {
    setaria_viridis: {
      name: '狗尾草', latin: 'Setaria viridis', color: '#6ba84f',
      size: 20, seedEnergy: 10, seedsPerCycle: 3, growDays: 35, preferred: 0.9, type: 'grass',
      description: '【学名】Setaria viridis\n【分类】禾本科·狗尾草属\n\n【外形】一年生草本，茎直立或倾斜，叶扁平，顶端有一束像小狗尾巴的绿色穗子，成熟后变褐黄色，轻风吹过时穗子会明显摇晃。\n\n【生态意义】狗尾草是全世界最常见的野草之一，常见路边、田野、荒地。它的种子大量散落，是麻雀、蚂蚁及其他小型昆虫的重要食物来源。\n\n【游戏参数】草籽能量 10（适中），单株每周期散 3 颗草籽，蚂蚁偏好 90%（容易被蚂蚁发现并搬运）。'
    },
    eleusine_indica: {
      name: '牛筋草', latin: 'Eleusine indica', color: '#5a8a3e',
      size: 25, seedEnergy: 8, seedsPerCycle: 2, growDays: 45, preferred: 0.6, type: 'grass',
      description: '【学名】Eleusine indica\n【分类】禾本科·穇属\n\n【外形】根系极发达，贴地丛生，很难用手连根拔起（因此得名"牛筋"）。叶片质硬、边缘粗糙，花序呈数根指状分枝在茎顶展开，如手掌张开。\n\n【生态意义】极耐践踏，是足球场边的常客。草籽成熟后自然脱落，为蚂蚁等地面昆虫提供能量补给。\n\n【游戏参数】草籽能量 8，蚂蚁偏好 60%。'
    },
    digitaria_sanguinalis: {
      name: '马唐', latin: 'Digitaria sanguinalis', color: '#8aa055',
      size: 18, seedEnergy: 9, seedsPerCycle: 3, growDays: 28, preferred: 0.7, type: 'grass',
      description: '【学名】Digitaria sanguinalis\n【分类】禾本科·马唐属\n\n【外形】贴地生长、向四周匍匐伸展的一年生禾草。叶片细薄柔软，紫色小穗呈指状排列。生长极快，环境适宜时一个月就能完成从萌发到结籽的整个生命周期。\n\n【游戏参数】草籽能量 9，生长周期 28 天（同类最短）。'
    },
    echinochloa_crus_galli: {
      name: '稗子', latin: 'Echinochloa crus-galli', color: '#7cb058',
      size: 30, seedEnergy: 12, seedsPerCycle: 4, growDays: 40, preferred: 1.0, type: 'grass',
      description: '【学名】Echinochloa crus-galli\n【分类】禾本科·稗属\n\n【外形】形似小水稻。穗呈鸡冠状分枝（因此拉丁名 crus-galli 意为"鸡冠"）。叶片宽而柔软，常见于湿润的田野和路边。\n\n【生态意义】稗子的草籽颗粒较大、淀粉含量高，是蚂蚁心目中的"顶级大餐"——一旦被发现往往吸引大批工蚁搬运。\n\n【游戏参数】草籽能量 12（同类最高），蚂蚁偏好 100%（优先选择）。'
    },
    taraxacum_officinale: {
      name: '蒲公英', latin: 'Taraxacum officinale', color: '#5fa03e',
      size: 22, seedEnergy: 6, seedsPerCycle: 2, growDays: 50, preferred: 0.4, type: 'herb',
      description: '【学名】Taraxacum officinale\n【分类】菊科·蒲公英属\n\n【外形】叶缘锯齿状（"牙齿"形），花茎中空直立。开金黄色舌状花，成熟后变为白色绒球，风吹时种子漫天飘散。\n\n【生态意义】典型的"风播植物"——种子带白色冠毛可随风飞散数百米。蚂蚁通常只在种子刚落下、冠毛未散开的短暂时间内收集它们。\n\n【游戏参数】草籽能量 6，蚂蚁偏好 40%。'
    },
    plantago_major: {
      name: '车前草', latin: 'Plantago major', color: '#557e3a',
      size: 22, seedEnergy: 5, seedsPerCycle: 2, growDays: 55, preferred: 0.3, type: 'herb',
      description: '【学名】Plantago major\n【分类】车前科·车前属\n\n【外形】叶基生呈莲座状铺地，叶片椭圆，叶脉凸起明显如筋。花茎直立，顶端有细小密集的穗状花序。\n\n【生态意义】车前草叶片含较多纤维素，蚂蚁很少直接食用。但其种子富含黏液蛋白，偶尔被收集。\n\n【游戏参数】草籽能量 5，蚂蚁偏好 30%。'
    },
    trifolium_repens: {
      name: '白三叶', latin: 'Trifolium repens', color: '#68a848',
      size: 16, seedEnergy: 7, seedsPerCycle: 2, growDays: 60, preferred: 0.5, type: 'herb',
      description: '【学名】Trifolium repens\n【分类】豆科·车轴草属\n\n【外形】茎匍匐贴地生长，每叶柄顶端有三片倒卵形小叶，小叶中央有白色V形斑。花为圆球状白色花序，有微香。\n\n【生态意义】三叶草是豆科植物，种子含较高的蛋白质。蚂蚁偶尔取食。'
    },
    oxalis_corniculata: {
      name: '酢浆草', latin: 'Oxalis corniculata', color: '#70a850',
      size: 12, seedEnergy: 5, seedsPerCycle: 1, growDays: 30, preferred: 0.2, type: 'herb',
      description: '【学名】Oxalis corniculata\n【分类】酢浆草科·酢浆草属\n\n【外形】三片小叶倒心形。花为小朵黄色五瓣花。全株含草酸，有微酸味——"酢"就是古字"醋"。\n\n【生态意义】果实成熟后会"啪"地弹开，把种子射出较远距离。蚂蚁偶尔能捡到弹射后的种子。\n\n【游戏参数】草籽能量 5，蚂蚁偏好 20%（酸味较重不常取）。'
    },
    fragaria_vesca: {
      name: '野草莓', latin: 'Fragaria vesca', color: '#c43838',
      size: 15, seedEnergy: 15, seedsPerCycle: 3, growDays: 70, preferred: 1.0, type: 'fruit',
      description: '【学名】Fragaria vesca\n【分类】蔷薇科·草莓属\n\n【外形】小叶三出、叶缘有锯齿。花白色五瓣。果细小红色，表面有许多小籽（实际上每个"小籽"才是真正的果实，红色部分是膨大的花托）。成熟果实散发香甜气味。\n\n【游戏参数】果粒能量 15（游戏中最高能量食物），蚂蚁偏好 100%。'
    },
    solanum_lycopersicum: {
      name: '小番茄', latin: 'Solanum lycopersicum', color: '#c04030',
      size: 18, seedEnergy: 13, seedsPerCycle: 3, growDays: 80, preferred: 0.95, type: 'fruit',
      description: '【学名】Solanum lycopersicum\n【分类】茄科·茄属\n\n【外形】羽状复叶，茎叶有特殊气味和细小毛。花为黄色五瓣。果为小圆球状，成熟后鲜红色。\n\n【生态意义】番茄含糖和维生素丰富。蚂蚁特别喜欢裂口番茄的汁液——在果实自然裂开或被鸟啄食后，常会吸引大量蚂蚁聚集。\n\n【游戏参数】草籽能量 13，蚂蚁偏好 95%。'
    },
    agaricus_bisporus: {
      name: '褐菇', latin: 'Agaricus bisporus', color: '#8a6a48',
      size: 14, seedEnergy: 9, seedsPerCycle: 1, growDays: 15, preferred: 0.6, type: 'mushroom',
      description: '【学名】Agaricus bisporus（双孢蘑菇）\n【分类】伞菌目·蘑菇科\n\n【外形】菌盖棕褐色圆顶状，表面光滑。菌柄白色粗壮。成熟后菌盖下可见深褐色菌褶（产生孢子的地方）。\n\n【生态意义】多在潮湿阴凉处出现。对湿度非常敏感——干燥环境下几小时就会萎缩。成熟后释放大量孢子，蚂蚁偶尔取食其柔软组织。\n\n【游戏参数】孢子能量 9，生长周期 15 天（比植物短得多）。'
    },
    coprinus_comatus: {
      name: '鸡腿菇', latin: 'Coprinus comatus', color: '#d8d0bc',
      size: 16, seedEnergy: 9, seedsPerCycle: 1, growDays: 12, preferred: 0.5, type: 'mushroom',
      description: '【学名】Coprinus comatus\n【分类】伞菌目·鬼伞科\n\n【外形】菌盖呈钟形、白色，表面有许多棕色鳞片，整体像一根鸡腿。菌柄细长白色。成熟后菌盖会自溶成黑色墨汁状液体（这是鬼伞科的典型特征——"自体消化"）。\n\n【生态意义】生命周期极短，从破土到自溶常常只有两三天。自溶后的黑色液体对蚂蚁无吸引力。'
    },
    alhagi: {
      name: '骆驼刺', latin: 'Alhagi sparsifolia', color: '#6a8a4a',
      size: 18, seedEnergy: 14, seedsPerCycle: 2, growDays: 100, preferred: 0.75, type: 'desert',
      description: '【学名】Alhagi sparsifolia\n【分类】豆科·骆驼刺属\n\n【外形】多年生半灌木，主茎直立，多分枝，每枝顶端有一个尖锐的短刺（因此得名）。叶细小椭圆，贴枝生长。全株灰绿色，减少阳光直射。\n\n【生态意义】典型的干旱/半干旱区植物。根系极深（可达10米以上），从地下水源吸取水分。种子富含蛋白质，是沙漠中蚂蚁、甲虫的重要食物。\n\n【游戏参数·v4.0】草籽能量 14，蚂蚁偏好 75%。【地图限制】沙漠/戈壁地图特有。'
    },
    salsola: {
      name: '猪毛菜', latin: 'Salsola collina', color: '#8aa05a',
      size: 12, seedEnergy: 10, seedsPerCycle: 2, growDays: 50, preferred: 0.7, type: 'desert',
      description: '【学名】Salsola collina\n【分类】藜科·猪毛菜属\n\n【外形】一年生草本，叶片圆柱形半肉质（"猪毛"状），富含储水组织，是典型的耐旱植物。老株折断后会形成风滚草（tumbleweed），借风力滚动散种。\n\n【生态意义】在沙漠/戈壁边缘的先锋植物。种子虽小但数量多，为干旱环境下的蚂蚁提供稳定食物。\n\n【游戏参数·v4.0】草籽能量 10，偏好 70%。【地图限制】沙漠/戈壁地图特有。'
    },
    quercus: {
      name: '蒙古栎', latin: 'Quercus mongolica', color: '#4a5a2a',
      size: 30, seedEnergy: 20, seedsPerCycle: 3, growDays: 200, preferred: 0.85, type: 'tree',
      description: '【学名】Quercus mongolica\n【分类】壳斗科·栎属（落叶乔木）\n\n【外形】大型落叶乔木，树高可达20米以上。叶倒卵形，叶缘有波状圆钝齿。果实为橡子（acorn），卵形带硬壳，顶部有鳞片状的"碗"（壳斗）。\n\n【生态意义】东北亚落叶阔叶林的代表树种。橡子是林地中松鼠、野猪、老鼠、蚂蚁等动物的重要冬季食物。一颗橡子能量很高，但外壳较硬，需要较大体型的蚂蚁（如弓背蚁）才能搬运。\n\n【游戏参数·v4.0】草籽能量 20（游戏中最高），蚂蚁偏好 85%。【地图限制】落叶阔叶林地图特有。【视觉】在游戏中以较大的基圆（30px）呈现，代表"大树"。'
    },
    tilia: {
      name: '椴树', latin: 'Tilia mandshurica', color: '#5a7a3a',
      size: 22, seedEnergy: 15, seedsPerCycle: 2, growDays: 150, preferred: 0.80, type: 'tree',
      description: '【学名】Tilia mandshurica\n【分类】椴树科·椴树属\n\n【外形】落叶乔木，树高15-20米。叶心形，边缘有锯齿。花黄绿色，有强烈香气，花蜜浓度高，是重要的蜜源植物（椴树蜜是高级蜂蜜品种）。\n\n【生态意义】椴树的花蜜和嫩叶上的蚜虫蜜露是蚂蚁的重要食物。树栖蚂蚁（如弓背蚁）常在树干上建立通道。\n\n【游戏参数·v4.0】草籽能量 15，偏好 80%。【地图限制】落叶阔叶林/雨林地图。【视觉】22px，表现为中等"树冠"。'
    },
    ficus: {
      name: '榕树', latin: 'Ficus microcarpa', color: '#3a5a2a',
      size: 28, seedEnergy: 18, seedsPerCycle: 4, growDays: 180, preferred: 0.90, type: 'tree',
      description: '【学名】Ficus microcarpa\n【分类】桑科·榕属（常绿乔木）\n\n【外形】高可达25米，树冠开展呈伞状。枝上常生有气根（从空气吸取水分）。榕果（果实）球形成对腋生，成熟时黄色或红色，甜度高。\n\n【生态意义】热带雨林和亚热带森林中的"关键物种"。榕果一年四季大量产生，喂养着从鸟类到蚂蚁的大量动物。蚂蚁在榕树上构建复杂的种群。\n\n【游戏参数·v4.0】草籽能量 18，偏好 90%。【地图限制】热带雨林地图特有。【视觉】28px，表现为"大榕树"。'
    }
  };

  D.INSECT_SPECIES = {
    coccinella_septempunctata: {
      name: '七星瓢虫', latin: 'Coccinella septempunctata', kind: 'flying',
      color: '#c8302a', spotColor: '#1a1a1a', size: 6, speed: 0.45, energyValue: 12,
      aggression: 0, attackPower: 0, defense: 0.50, flying: true, hostile: false,
      description: '【学名】Coccinella septempunctata\n【分类】鞘翅目·瓢虫科\n\n【外形】体长 5-7mm，身体半球形。鲜红色鞘翅上均匀分布 7 个黑色斑点（左翅 3 + 右翅 3 + 中间接缝 1）。头黑色，前胸背板有两块白色斑。\n\n【习性】主要捕食蚜虫、介壳虫等软体小虫。一只瓢虫一天可吃 50+ 只蚜虫，被誉为"益虫之王"。飞行缓慢但灵巧，遇到惊扰会装死从叶片跌落，并从足关节分泌黄色苦味液体御敌。\n\n【与蚂蚁的关系】对蚂蚁完全无害。蚂蚁偶尔会与瓢虫在蚜虫资源上发生"竞争"（双方都需要蚜虫），但通常仅表现为驱赶而非攻击。\n\n【游戏参数·v3.0】速度 0.45（≈27px/秒），能量值 12，防御 50%（有硬壳保护）。'
    },
    pieris_rapae: {
      name: '菜粉蝶（白蝴蝶）', latin: 'Pieris rapae', kind: 'flying',
      color: '#f8f4e8', spotColor: '#2a2a2a', size: 8, speed: 0.65, energyValue: 15,
      aggression: 0, attackPower: 0, defense: 0.50, flying: true, hostile: false,
      description: '【学名】Pieris rapae\n【分类】鳞翅目·粉蝶科\n\n【外形】成虫翅膀乳白色，前翅顶角有一块黑斑，翅中央各有一个圆形黑点。飞行姿态优雅，常在花间停留吸食花蜜。白天活动，阳光充足时特别活跃。飞行轨迹飘忽不定，能突然变向。\n\n【与蚂蚁的关系】对蚂蚁完全无害。蚂蚁极少能捕捉到飞行中的成虫，偶尔取食自然死亡的个体或幼虫。\n\n【游戏参数·v3.0】速度 0.65（≈39px/秒），能量值 15。'
    },
    aphid: {
      name: '蚜虫', latin: 'Aphidoidea sp.', kind: 'ground',
      color: '#a8d068', spotColor: '#507030', size: 4, speed: 0.15, energyValue: 8,
      aggression: 0, attackPower: 0, defense: 0.20, flying: false, hostile: false,
      description: '【学名】Aphidoidea（蚜虫总科）\n【分类】半翅目·蚜虫亚目\n\n【外形】小型软体昆虫，身体呈梨形，通常淡绿或黄绿色。腹部有两根管状突起（腹管），用来释放告警信息素。常群居在植物嫩茎和叶背，数量多时密密麻麻一层。\n\n【习性】用细长口针刺入植物组织吸食汁液。食物中大量糖分超过身体需要，会从腹部分泌出甜甜的"蜜露"液滴——这正是蚂蚁喜爱的能量来源。\n\n【与蚂蚁的关系：典型共生】蚂蚁会：① 保护蚜虫不受瓢虫等天敌捕食；② 用触角敲打蚜虫腹部刺激其分泌蜜露；③ 甚至将蚜虫搬回巢中越冬——完全像人类放牧牛羊。\n\n【游戏参数·v3.0】速度 0.15（≈9px/秒，蚂蚁轻易追上），能量值 8，防御 20%（软躯体）。'
    },
    theraphosidae: {
      name: '狼蛛', latin: 'Lycosidae sp.', kind: 'ground',
      color: '#4a3a2a', spotColor: '#d8c070', size: 10, speed: 0.38, energyValue: 20,
      aggression: 0.70, attackPower: 4, defense: 0.55, flying: false, hostile: true,
      description: '【学名】Lycosidae（狼蛛科）\n【分类】蜘蛛目·狼蛛科\n\n【外形】中型蜘蛛，棕褐色，身体被长毛。8 只眼睛排列在头胸部前方（2 只大眼在前上方，4 只中眼在前缘，2 只小眼在侧面）——这让狼蛛拥有极佳的视觉和猎物感知能力。\n\n【习性】不结网，在地面游猎。以蚂蚁、甲虫等节肢动物为食。发现猎物后迅速跃起扑咬，用毒液麻痹后拖走。一次能捕食多只蚂蚁（尤其是数量多的工蚁群）。\n\n【与蚂蚁的关系：敌对】狼蛛是蚂蚁的重要天敌。蚂蚁遇到狼蛛应第一时间逃跑，除非有大群兵蚁合围、或以数量压倒。\n\n【游戏参数·v3.0】攻击性 70%，攻击 4（每 2 秒一次），HP 40，速度 0.38。建议 3+ 只兵蚁合围。'
    },
    scolopendra: {
      name: '蜈蚣', latin: 'Scolopendra subspinipes', kind: 'ground',
      color: '#7a5a3a', spotColor: '#c08040', size: 12, speed: 0.32, energyValue: 28,
      aggression: 0.65, attackPower: 5, defense: 0.55, flying: false, hostile: true,
      description: '【学名】Scolopendra subspinipes（少棘蜈蚣）\n【分类】唇足纲·蜈蚣目\n\n【外形】身体由众多环节组成，每节生有一对步足，整体呈长条扁平形。体色黄褐色或红褐色，头部有一对巨大的毒颚（由第一对步足特化而来），会注入毒液麻痹猎物。\n\n【习性】喜夜间活动，白天藏于石缝或枯叶下。肉食性，主要捕食昆虫、蜘蛛、甚至小型脊椎动物。爬行速度较快，发现猎物后立即用毒颚刺入。\n\n【与蚂蚁的关系：敌对】蜈蚣经常闯入蚁巢取食幼虫、卵和蛹，一只成年蜈蚣对一个蚁群的破坏力相当大。蚁群通常需要多只兵蚁合作才能击退。\n\n【游戏参数·v3.0】攻击 5（单次伤害最高之一），HP 55（极难单只击败），体型 12，速度 0.32。建议 5+ 只兵蚁合围。'
    },
    cicindela: {
      name: '虎甲', latin: 'Cicindela chinensis', kind: 'ground',
      color: '#3a5a7a', spotColor: '#a0c0e0', size: 7, speed: 0.75, energyValue: 18,
      aggression: 0.55, attackPower: 3, defense: 0.50, flying: false, hostile: true,
      description: '【学名】Cicindela chinensis（中华虎甲）\n【分类】鞘翅目·虎甲科\n\n【外形】身体呈亮绿或蓝色，带金属光泽。头部有两只突出的大复眼，占头部比例很大；上颚极度发达呈镰刀状，交叉闭合——这就是它能瞬间切碎猎物的武器。\n\n【习性】成虫和幼虫均为凶猛捕食者。成虫在地面奔跑捕猎，按体重比例虎甲是世界上跑得最快的昆虫之一（相对速度可达 120 倍体长/秒，相当于人类 700km/h）。\n\n【与蚂蚁的关系：敌对】虎甲会主动追捕落单的蚂蚁。对蚂蚁来说，看到虎甲的大颚就是"立即撤退"的信号。\n\n【游戏参数·v3.0】速度 0.75（≈45px/秒），攻击 3，HP 35（"快速、脆弱但致命"的战斗风格，小型蚁种需 2 只合围）。'
    },
    vespa: {
      name: '胡蜂', latin: 'Vespa mandarinia', kind: 'flying',
      color: '#c84a2a', spotColor: '#ffaa40', size: 9, speed: 0.65, energyValue: 25,
      aggression: 0.60, attackPower: 4, defense: 0.45, flying: true, hostile: true,
      description: '【学名】Vespa mandarinia（金环胡蜂/大虎头蜂）\n【分类】膜翅目·胡蜂科\n\n【外形】体长 35-50mm（蜂后可达55mm），是世界上体型最大的胡蜂之一。体色橙黄与黑褐相间，头部巨大呈橙黄色，腹部有多条金黄色环纹。复眼发达，飞行时头部保持朝前。\n\n【习性】社会性昆虫，筑巢于地下或树洞中。工蜂飞行速度快（可达 40km/h），能长途飞行觅食。以其他昆虫、蜘蛛为食，也取食树汁、花蜜。日本亚种因曾被报道"一小时消灭3万只蜜蜂"闻名。\n\n【与蚂蚁的关系：敌对】胡蜂偶尔会攻击蚁巢获取幼虫作为食物。单个工蜂对蚂蚁有毁灭性打击能力，但蚂蚁数量优势可反击。\n\n【游戏参数·v4.0】速度 0.65（飞行移动），攻击 4，HP 45，能量值 25（游戏中最高之一）。【地图限制】温带草原·落叶阔叶林·热带雨林。'
    },
    myrmeleon: {
      name: '蚁狮', latin: 'Myrmeleon formicarius', kind: 'ambush',
      color: '#8a6a48', spotColor: '#5a3a2a', size: 8, speed: 0.05, energyValue: 18,
      aggression: 0.85, attackPower: 5, defense: 0.40, flying: false, hostile: true,
      description: '【学名】Myrmeleon formicarius\n【分类】脉翅目·蚁蛉科\n\n【外形】幼虫体扁宽纺锤形（"沙牛"），头部具镰刀状大颚，体表多毛。成虫似蜻蜓但触角念珠状。\n\n【习性】最著名的"陷阱大师"。幼虫在干燥沙地挖掘漏斗状陷阱（直径5-10cm），潜伏底部等待蚂蚁滑落。当蚂蚁进入陷阱，沙粒因松软而滚动，蚂蚁滑落到底部时，蚁狮用大颚刺入猎物并注入消化液，吸食体液后抛出空壳。\n\n【与蚂蚁的关系：敌对】蚂蚁是蚁狮的首选猎物。对蚂蚁来说，蚁狮是"看不见的陷阱"——除非走到陷阱边缘，否则无法察觉。\n\n【游戏参数·v4.0】\n速度 0.05 px/帧（几乎静止，伏击者不主动移动）\n攻击 5：每2秒一次（一口致命）\nHP 40：需要多只兵蚁协作击杀\n【特有行为】在固定区域挖掘陷阱；蚂蚁进入陷阱半径后触发突袭。\n【地图限制】沙漠/戈壁地图特有（干燥沙地是唯一合适的挖掘环境）。'
    }
  };

  D.ANT_PERSONALITIES = [
    { key: 'bold', name: '大胆', desc: '敢于靠近危险，主动探索', modifier: { attackMul: 1.15, speedMul: 1.05, defenseMul: 0.90 } },
    { key: 'cautious', name: '谨慎', desc: '遇到风险迅速撤退', modifier: { attackMul: 0.85, speedMul: 1.10, defenseMul: 1.20 } },
    { key: 'diligent', name: '勤劳', desc: '休息时间短，持续搬运', modifier: { carryMul: 1.20, speedMul: 1.05 } },
    { key: 'lazy', name: '慵懒', desc: '走走停停', modifier: { carryMul: 0.80, speedMul: 0.80 } },
    { key: 'aggressive', name: '好斗', desc: '遇到其他蚁种倾向挑衅', modifier: { attackMul: 1.30, defenseMul: 1.10 } },
    { key: 'peaceful', name: '温和', desc: '避开冲突优先搬运', modifier: { attackMul: 0.70, defenseMul: 0.90, carryMul: 1.20 } },
    { key: 'fast', name: '敏捷', desc: '移动快但易疲劳', modifier: { speedMul: 1.25, attackMul: 0.90 } },
    { key: 'sturdy', name: '坚韧', desc: '体力好，负重更大', modifier: { defenseMul: 1.25, carryMul: 1.25, speedMul: 0.95 } },
    { key: 'smart', name: '聪明', desc: '信息素记忆更强，回巢捷径', modifier: { speedMul: 1.05 } },
    { key: 'explorer', name: '探索者', desc: '常偏离路径探索新区域', modifier: { speedMul: 1.15, attackMul: 0.90 } }
  ];

  D.SCENE_OBJECT_TYPES = {
    nest: { name: '蚁巢', color: '#8b5a2b', size: 40, description: '蚁巢基圆：蚁群的家。工蚁在此存储食物，兵蚁在此回血。' },
    rock: { name: '岩石', color: '#888888', size: 25, description: '岩石/石块。可作为蚂蚁的地标，部分昆虫（蜈蚣）会在石块下藏身。' },
    water: { name: '小水塘', color: '#4a90c8', size: 35, description: '小水塘或潮湿土壤。蚂蚁在干旱环境下会寻找水源。' },
    wood: { name: '朽木', color: '#6a4a30', size: 40, description: '朽木/枯木——弓背蚁的理想筑巢地。' },
    sand: { name: '沙地凹陷', color: '#c09860', size: 20, description: '蚁狮陷阱所在区域——蚂蚁靠近需谨慎。' }
  };

  // ---------- 工具函数 ----------
  global._SpeciesFns = global._SpeciesFns || {};
  const F = global._SpeciesFns;

  F._shadeColor = function (hex, percent) {
    if (!hex) return '#888888';
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
  };

  F.buildAntAttributes = function (speciesKey, roleKey, opt) {
    const sp = D.ANT_SPECIES[speciesKey];
    if (!sp) return null;
    opt = opt || {};
    const roleKeyActual = roleKey || Object.keys(sp.roles)[0];
    const role = sp.roles[roleKeyActual];

    const picks = [];
    const pool = [...D.ANT_PERSONALITIES];
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picks.push(pool.splice(idx, 1)[0]);
    }

    const sizeVar = 0.9 + Math.random() * 0.2;
    const speedVar = 0.95 + Math.random() * 0.1;

    let finalSpeed = sp.speed * role.speedMul * speedVar;
    let finalAttack = sp.attackPower * role.attackMul;
    let finalDefense = sp.defense * role.defenseMul;
    let finalCarry = sp.maxCarry * role.carryMul;
    for (const p of picks) {
      if (p.modifier.speedMul) finalSpeed *= p.modifier.speedMul;
      if (p.modifier.attackMul) finalAttack *= p.modifier.attackMul;
      if (p.modifier.defenseMul) finalDefense *= p.modifier.defenseMul;
      if (p.modifier.carryMul) finalCarry *= p.modifier.carryMul;
    }

    return {
      species: speciesKey,
      speciesName: sp.name,
      speciesLatin: sp.latin,
      role: roleKeyActual,
      roleName: role.name,
      personality: picks.map(p => p.key).join(','),
      personalityName: picks.map(p => p.name).join('·'),
      personalityDesc: picks.map(p => p.name + '(' + p.desc + ')').join('；'),
      antId: 'ant_' + Math.floor(Math.random() * 1e9).toString(36),
      generation: opt.generation || 1,
      colonyId: opt.colonyId || 'A',
      size: Math.round((sp.size * role.sizeMul * sizeVar) * 10) / 10,
      speed: Math.round(finalSpeed * 100) / 100,
      attackPower: Math.round(finalAttack * 10) / 10,
      defense: Math.round(finalDefense * 100) / 100,
      maxCarry: Math.round(finalCarry),
      hp: sp.hp,
      maxHp: sp.hp,
      energy: 100,
      maxEnergy: 100,
      foodCarried: 0,
      state: 'idle',
      age: 0,
      maxAge: 60 * 60 * 60 * (0.8 + Math.random() * 0.6),
      sizeVar: sizeVar,
      speedVar: speedVar,
      color: role.color || sp.color,
      aggression: sp.aggression,
      preferredFood: sp.preferredFood,
      description_text:
        '【' + sp.name + ' · ' + role.name + '】（' + sp.latin + '）\n' +
        '性格：' + picks.map(p => p.name + '·' + p.desc).join('；') + '\n' +
        '所属蚁群：' + (opt.colonyId || 'A') + ' · 第 ' + (opt.generation || 1) + ' 代\n' +
        '饱食度：100（需每 10-15 分钟觅食补充）\n' +
        '自然寿命：约 60-120 分钟（游戏时间）\n\n' +
        sp.description
    };
  };

  F.buildPlantAttributes = function (key, opt) {
    const sp = D.PLANT_SPECIES[key];
    if (!sp) return null;
    return {
      species: key, speciesName: sp.name, speciesLatin: sp.latin,
      type: sp.type, color: sp.color, size: sp.size,
      seedEnergy: sp.seedEnergy, seedsRemaining: Math.floor(sp.seedsPerCycle * (0.4 + Math.random() * 0.6)),
      moisture: 0.3 + Math.random() * 0.4, preferred: sp.preferred, age: 0,
      description_text: sp.description
    };
  };

  F.buildInsectAttributes = function (key, opt) {
    const sp = D.INSECT_SPECIES[key];
    if (!sp) return null;
    return {
      species: key, speciesName: sp.name, speciesLatin: sp.latin,
      kind: sp.kind, flying: sp.flying, hostile: sp.hostile || false,
      aggression: sp.aggression, attackPower: sp.attackPower, defense: sp.defense,
      speed: sp.speed, energyValue: sp.energyValue, color: sp.color, size: sp.size,
      hp: 30 + Math.round(sp.energyValue), maxHp: 30 + Math.round(sp.energyValue), age: 0,
      direction: Math.random() * Math.PI * 2, state: 'wander',
      description_text: sp.description
    };
  };

  F.getSpeciesDescription = function (category, key) {
    let sp = null;
    if (category === 'plant') sp = D.PLANT_SPECIES[key];
    else if (category === 'insect') sp = D.INSECT_SPECIES[key];
    else sp = D.ANT_SPECIES[key];
    return sp ? sp.description : null;
  };

  // ---------- 兼容原 species.js 的顶层同名函数 ----------
  // 这样原先从 species.js 中直接调用的 buildAntAttributes / buildPlantAttributes /
  // buildInsectAttributes / getSpeciesDescription 在分割文件后仍可正常工作。
  global.buildAntAttributes = function (speciesKey, roleKey, opt) { return F.buildAntAttributes(speciesKey, roleKey, opt); };
  global.buildPlantAttributes = function (key, opt) { return F.buildPlantAttributes(key, opt); };
  global.buildInsectAttributes = function (key, opt) { return F.buildInsectAttributes(key, opt); };
  global.getSpeciesDescription = function (category, key) { return F.getSpeciesDescription(category, key); };

})(typeof window !== 'undefined' ? window : globalThis);
