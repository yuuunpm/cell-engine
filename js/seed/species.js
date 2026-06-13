/**
 * SpeciesRegistry - 生态场景物种注册表（v3.0 · 60fps 时间系统重做版）
 * 速度单位 = px/帧；攻击 = 伤害/次（每120帧=2秒一次）；HP = 生命值
 * 饱食度(energy) = 觅食需求；寿命(maxAge) = 自然衰老
 * 饱食消耗：每600帧(10秒)-1 → 100饱食=1000秒≈17分钟（需觅食补充）
 * 自然寿命：216000-432000帧 = 60-120分钟游戏时间（类比真实工蚁7-70天）
 */
(function (global) {
  'use strict';

  // ===== 蚂蚁：10 种（均已校准 · v3.0）=====
  // key, name, latin, color, size, speed, hp, attack, defense, maxCarry, aggression, preferredFood, colonySize
  const ANT_SPECIES = {
    lasius_niger: {
      name: '花园黑蚁', latin: 'Lasius niger', color: '#2a1a0e', size: 5,
      speed: 0.70, hp: 30, attackPower: 2, defense: 0.30, maxCarry: 15,
      aggression: 0.40, preferredFood: '杂食·蜜露',
      description: '【学名】Lasius niger\n【分类】膜翅目·蚁科·毛蚁属\n\n【外形】工蚁体长 3-5mm，体黑褐色，触角膝状，腹部椭圆形，体表细密刻点在阳光下微亮。\n\n【习性】最常见的家蚁，地下筑巢，喜路边花坛缝隙。单巢工蚁 50-200 只，多蚁后结构。杂食偏蜜源，会饲养蚜虫获取蜜露，同时也捕食小型昆虫、收集草籽。攻击性中等，主要在保卫食物和巢穴时战斗。\n\n【游戏参数·v3.0】\n速度 0.70 px/帧 ≈ 42px/秒（800px 屏幕横穿约 19 秒）\nHP 30：承受 15-20 次攻击\n攻击 2：每 120 帧（2 秒）一次，战斗节奏舒缓可观察\n防御 30%：减免 30% 伤害\n最大负重 15 能量：可搬运 1-2 颗草籽\n饱食度 100：需每 10-15 分钟觅食一次\n自然寿命 60-120 分钟（类比真实工蚁 7-70 天）\n\n【趣味事实】花园黑蚁沿同伴留下的信息素轨迹觅食，发现新食物源后会沿途留下更浓的信息素召唤同伴。',
      roles: {
        worker:  { name: '工蚁',  sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0,  defenseMul: 1.0, carryMul: 1.0, color: '#2a1a0e' },
        soldier: { name: '兵蚁',  sizeMul: 1.2, speedMul: 0.85, attackMul: 2.0, defenseMul: 1.3, carryMul: 0.8, color: '#1a0e06' },
        queen:   { name: '繁殖蚁', sizeMul: 1.6, speedMul: 0.9, attackMul: 1.5, defenseMul: 1.5, carryMul: 0.5, color: '#4a2818' }
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
      description: '【学名】Reticulitermes chinensis\n【分类】蜚蠊目·白蚁科\n\n【外形】工蚁身体柔软呈乳白色，头部圆形黄褐色，无复眼（退化），触角念珠状。兵蚁头大呈深褐色，上颚（牙）弯刀状。\n\n【习性】畏光，几乎终身在修筑的泥路中活动。以木材和植物纤维为食，依赖肠道中共生原生动物消化纤维素。蚂蚁是白蚁在自然环境中的头号天敌。\n\n【游戏参数·v3.0】\n速度 0.50 ≈ 30px/秒（动作缓慢，需仔细观察）\nHP 35：体软但防御高\n防御 50%：硬壳头部吸收一半伤害\n最大负重 25 能量：专门搬运木屑/碎屑',
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
      description: '【学名】Pheidole noda\n【分类】膜翅目·蚁科·大头蚁属\n\n【外形】小型蚁，有明显兵蚁分化。兵蚁头部巨大呈球形（与身体不成比例），上颚强健发达，被称为"种子破碎机"。工蚁细小灵活。\n\n【习性】数量庞大适应性强。工蚁善于寻找小颗粒食物，发现大型目标后会释放信息素召唤同伴，靠数量优势搬运。兵蚁专门负责处理大型种子、坚硬食物、以及防御战斗。\n\n【游戏参数·v3.0】\n兵蚁攻击 3+：大头蚁的兵蚁依靠大头+大颚打出高伤害\nHP 25：普通工蚁脆',
      roles: {
        worker: { name: '工蚁', sizeMul: 1.0, speedMul: 1.0, attackMul: 1.0, defenseMul: 1.0, carryMul: 1.0, color: '#b89050' },
        soldier: { name: '兵蚁', sizeMul: 1.6, speedMul: 0.75, attackMul: 2.5, defenseMul: 1.6, carryMul: 1.1, color: '#7a5028' }
      }
    },
    tapinoma: {
      name: '黑头酸臭蚁', latin: 'Tapinoma melanocephalum', color: '#555a40', size: 4,
      speed: 0.80, hp: 20, attackPower: 1, defense: 0.25, maxCarry: 12,
      aggression: 0.30, preferredFood: '甜食/蜜露',
      description: '【学名】Tapinoma melanocephalum\n【分类】膜翅目·蚁科·酸臭蚁属\n\n【外形】小型蚁，头黑腹浅色。受惊扰或被压碎时会释放一种类似"腐烂椰子"的独特气味——腹部臀腺分泌的防御性化学物质（含酮类和烷烃），因此得名"酸臭蚁"。\n\n【习性】温热带常见入侵蚁种。多蚁后多分巢，扩散极快。与法老蚁不同的是：酸臭蚁更偏好甜食，对蛋白质需求较低。攻击性较弱，遇到其他蚁种时通常避开而非战斗。\n\n【游戏参数·v3.0】\nHP 20：脆弱，受攻击容易死亡\n攻击性 30%：低，倾向逃跑而非战斗\n速度 0.80：动作敏捷灵活',
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

  // ===== 植物：17 种 =====
  // 草籽能量(seedEnergy) = 蚂蚁搬运一颗能获得的能量
  // preferred = 蚂蚁搜寻偏好度（0-1）
  const PLANT_SPECIES = {
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
      description: '【学名】Taraxacum officinale\n【分类】菊科·蒲公英属\n\n【外形】叶缘锯齿状（"牙齿"形），花茎中空直立。开金黄色舌状花，成熟后变为白色绒球，风吹时种子漫天飘散。\n\n【生态意义】典型的"风播植物"——种子带白色冠毛可随风飞散数百米。蚂蚁通常只在种子刚落下、冠毛未散开的短暂时间内收集它们。\n\n【游戏参数】草籽能量 6，蚂蚁偏好 40%（不优先搜寻）。'
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
      description: '【学名】Agaricus bisporus（双孢蘑菇）\n【分类】伞菌目·蘑菇科\n\n【外形】菌盖棕褐色圆顶状，表面光滑。菌柄白色粗壮。成熟后菌盖下可见深褐色菌褶（产生孢子的地方）。\n\n【生态意义】多在潮湿阴凉处出现。对湿度非常敏感——干燥环境下几小时就会萎缩。成熟时释放大量孢子，蚂蚁偶尔取食其柔软组织。\n\n【游戏参数】孢子能量 9，生长周期 15 天（比植物短得多）。'
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

  // ===== 昆虫：8 种（3 飞行 + 1 共生 + 5 敌对 · v4.0）=====
  // 注：攻击每120帧(2秒)1次，战斗节奏舒缓可观察
  const INSECT_SPECIES = {
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

  // ===== 性格标签：10 种 =====
  // 每只蚂蚁随机获得 1-2 个，叠加影响其属性与行为
  const ANT_PERSONALITIES = [
    { key: 'bold',       name: '大胆',   desc: '敢于靠近危险，主动探索',    modifier: { attackMul: 1.15, speedMul: 1.05, defenseMul: 0.90, wanderRate: 1.3 } },
    { key: 'cautious',   name: '谨慎',   desc: '遇到风险迅速撤退',         modifier: { attackMul: 0.85, speedMul: 1.10, defenseMul: 1.20, wanderRate: 0.8 } },
    { key: 'diligent',   name: '勤劳',   desc: '休息时间短，持续搬运',      modifier: { carryMul: 1.20, speedMul: 1.05 } },
    { key: 'lazy',       name: '慵懒',   desc: '走走停停',                 modifier: { carryMul: 0.80, speedMul: 0.80 } },
    { key: 'aggressive', name: '好斗',   desc: '遇到其他蚁种倾向挑衅',      modifier: { attackMul: 1.30, defenseMul: 1.10, wanderRate: 1.2 } },
    { key: 'peaceful',   name: '温和',   desc: '避开冲突优先搬运',          modifier: { attackMul: 0.70, defenseMul: 0.90, carryMul: 1.20 } },
    { key: 'fast',       name: '敏捷',   desc: '移动快但易疲劳',            modifier: { speedMul: 1.25, attackMul: 0.90 } },
    { key: 'sturdy',     name: '坚韧',   desc: '体力好，负重更大',          modifier: { defenseMul: 1.25, carryMul: 1.25, speedMul: 0.95 } },
    { key: 'smart',      name: '聪明',   desc: '信息素记忆更强，回巢捷径',   modifier: { speedMul: 1.05 } },
    { key: 'explorer',   name: '探索者', desc: '常偏离路径探索新区域',       modifier: { speedMul: 1.15, wanderRate: 1.50, attackMul: 0.90 } }
  ];

  // ===== 工具函数：基于物种+角色构建一只蚂蚁的完整属性 =====
  function buildAntAttributes(speciesKey, roleKey, opt) {
    const sp = ANT_SPECIES[speciesKey];
    if (!sp) return null;
    opt = opt || {};
    const roleKeyActual = roleKey || Object.keys(sp.roles)[0];
    const role = sp.roles[roleKeyActual];

    // 随机 1-2 个性格
    const picks = [];
    const pool = [...ANT_PERSONALITIES];
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picks.push(pool.splice(idx, 1)[0]);
    }

    // 个体变异（±10% 大小，±5% 速度）
    const sizeVar = 0.9 + Math.random() * 0.2;
    const speedVar = 0.95 + Math.random() * 0.1;

    // 应用角色+性格修饰
    let finalSpeed = sp.speed * role.speedMul * speedVar;
    let finalAttack = sp.attackPower * role.attackMul;
    let finalDefense = sp.defense * role.defenseMul;
    let finalCarry = sp.maxCarry * role.carryMul;
    let finalSize = sp.size * role.sizeMul * sizeVar;
    for (const p of picks) {
      if (p.modifier.speedMul)  finalSpeed *= p.modifier.speedMul;
      if (p.modifier.attackMul) finalAttack *= p.modifier.attackMul;
      if (p.modifier.defenseMul) finalDefense *= p.modifier.defenseMul;
      if (p.modifier.carryMul)  finalCarry *= p.modifier.carryMul;
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
      size: Math.round(finalSize * 10) / 10,
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
      // 自然寿命：60fps下约 60-120 分钟（类比真实蚂蚁7-70天）
      maxAge: 60 * 60 * 60 * (0.8 + Math.random() * 0.6),
      sizeVar: sizeVar,
      speedVar: speedVar,
      color: role.color || sp.color,
      aggression: sp.aggression,
      preferredFood: sp.preferredFood,
      // 属性面板描述（第二页使用）
      description_text:
        '【' + sp.name + ' · ' + role.name + '】（' + sp.latin + '）\n' +
        '性格：' + picks.map(p => p.name + '·' + p.desc).join('；') + '\n' +
        '所属蚁群：' + (opt.colonyId || 'A') + ' · 第 ' + (opt.generation || 1) + ' 代\n' +
        '饱食度：100（需每 10-15 分钟觅食补充）\n' +
        '自然寿命：约 60-120 分钟（游戏时间）\n\n' +
        sp.description
    };
  }

  function buildPlantAttributes(key, opt) {
    const sp = PLANT_SPECIES[key];
    if (!sp) return null;
    return {
      species: key, speciesName: sp.name, speciesLatin: sp.latin,
      type: sp.type, color: sp.color, size: sp.size,
      seedEnergy: sp.seedEnergy, seedsRemaining: Math.floor(sp.seedsPerCycle * (0.4 + Math.random() * 0.6)),
      moisture: 0.3 + Math.random() * 0.4, preferred: sp.preferred, age: 0,
      description_text: sp.description
    };
  }

  function buildInsectAttributes(key, opt) {
    const sp = INSECT_SPECIES[key];
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
  }

  // ===== 获取描述文字（属性面板第二页使用） =====
  function getSpeciesDescription(category, key) {
    let sp = null;
    if (category === 'plant') sp = PLANT_SPECIES[key];
    else if (category === 'insect') sp = INSECT_SPECIES[key];
    else sp = ANT_SPECIES[key];
    return sp ? sp.description : null;
  }

  // ===== 简易行为代码模板（属性面板第三页使用 · v3.0） =====
  // 时间系统：饱食度100，每600帧(10秒)-1 → 约17分钟饿死；寿命 60-120 分钟
  // ========== 角色行为代码生成器 ==========
  // 根据角色返回差异化的行为逻辑字符串
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
      '  else if (attr.seedEnergy > 0 || attr.energyValue > 0) nearestFood = nearestFood || n;\n' +
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

    // ------ 工蚁：觅食循环 ------（idle → foraging → returning → idle）
    const workerCode =
      '// ========== 工蚁行为：觅食循环 ==========\n' +
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
      'const state = api.getProperty("state") || "idle";\n' +
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
      '    api.setProperty("state", "foraging");\n' +
      '  }\n' +
      '} else if (state === "foraging") {\n' +
      '  if (carried >= maxCarry) {\n' +
      '    api.setProperty("state", "returning");\n' +
      '  }\n' +
      '} else if (state === "returning") {\n' +
      '  const distToNest = Math.hypot(api.getX() - nestX, api.getY() - nestY);\n' +
      '  if (distToNest < 20) {\n' +
      '    // 到达巢穴，卸粮\n' +
      '    if (carried > 0 && nestEntity && nestEntity.id) {\n' +
      '      // 通过全局接口给巢穴增加粮食存储\n' +
      '      if (window.CellCore && window.CellCore.setAttribute) {\n' +
      '        const cur = (nestEntity.attributes && nestEntity.attributes.foodStorage) || 0;\n' +
      '        window.CellCore.setAttribute(nestEntity.id, "foodStorage", cur + carried);\n' +
      '      }\n' +
      '      api.setProperty("foodCarried", 0);\n' +
      '    } else {\n' +
      '      api.setProperty("foodCarried", 0);\n' +
      '    }\n' +
      '    // 从巢穴拿能量\n' +
      '    api.setProperty("energy", Math.min(100, (api.getProperty("energy") || 100) + 30));\n' +
      '    api.setProperty("state", "idle");\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      '// 决策与移动\n' +
      'if (nearestHostile) {\n' +
      '  dx = api.getX() - nearestHostile.x; dy = api.getY() - nearestHostile.y;\n' +
      '} else if (api.getProperty("state") === "returning") {\n' +
      '  dx = nestX - api.getX(); dy = nestY - api.getY();\n' +
      '} else if (nearestFood && carried < maxCarry) {\n' +
      '  dx = nearestFood.x - api.getX(); dy = nearestFood.y - api.getY();\n' +
      '  const foodDist = Math.hypot(nearestFood.x - api.getX(), nearestFood.y - api.getY());\n' +
      '  if (foodDist < 15 && api.getFrame() % 120 === 0) {\n' +
      '    const energy = nearestFood.attributes ? (nearestFood.attributes.seedEnergy || 8) : 8;\n' +
      '    api.setProperty("foodCarried", carried + energy);\n' +
      '    // 拾取草籽后销毁草籽基圆\n' +
      '    if (window.CellCore && nearestFood.attributes && nearestFood.attributes.seedEnergy && api.getFrame() % 120 === 0) {\n' +
      '      window.CellCore.destroyCell(nearestFood.id);\n' +
      '    }\n' +
      '  }\n' +
      '} else {\n' +
      '  let dir = api.getProperty("direction") || 0;\n' +
      '  dir += (Math.random() - 0.5) * 0.2;\n' +
      '  dx = Math.cos(dir); dy = Math.sin(dir);\n' +
      '  api.setProperty("direction", dir);\n' +
      '}\n' +
      '\n' +
      'const dist = Math.sqrt(dx*dx + dy*dy) || 1;\n' +
      'api.setPosition(api.getX() + dx/dist * spd, api.getY() + dy/dist * spd);\n';

    // ------ 兵蚁：主动战斗 ------
    const soldierCode =
      '// ========== 兵蚁行为：主动战斗 ==========\n' +
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
      'const myColony = api.getProperty("colonyId") || "A";\n' +
      '\n' +
      'if (nearestHostile) {\n' +
      '  // 有敌人 → 追击并战斗\n' +
      '  dx = nearestHostile.x - api.getX();\n' +
      '  dy = nearestHostile.y - api.getY();\n' +
      '  const d = Math.sqrt(dx*dx + dy*dy) || 1;\n' +
      '  if (d < 20 && api.getFrame() % 120 === 0) {\n' +
      '    const atk = api.getProperty("attackPower") || 2;\n' +
      '    api.emitCellEvent(nearestHostile.id, "attack", { damage: atk, sourceId: api.getProperty("id") });\n' +
      '  }\n' +
      '} else if (hp < maxHp * 0.3) {\n' +
      '  // HP过低 → 撤退回巢\n' +
      '  if (nestEntity) {\n' +
      '    dx = nestEntity.x - api.getX();\n' +
      '    dy = nestEntity.y - api.getY();\n' +
      '    if (Math.hypot(nestEntity.x - api.getX(), nestEntity.y - api.getY()) < 15) {\n' +
      '      // 到达巢穴，缓慢回血\n' +
      '      if (api.getFrame() % 60 === 0) {\n' +
      '        api.setProperty("hp", Math.min(maxHp, (api.getProperty("hp") || 0) + 1));\n' +
      '      }\n' +
      '    }\n' +
      '  } else {\n' +
      '    let dir = api.getProperty("direction") || 0;\n' +
      '    dir += (Math.random() - 0.5) * 0.1;\n' +
      '    dx = Math.cos(dir); dy = Math.sin(dir);\n' +
      '    api.setProperty("direction", dir);\n' +
      '  }\n' +
      '} else {\n' +
      '  // 巡逻：主动搜索敌人（敌对昆虫 + 异群蚂蚁）\n' +
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

    // ------ 蚁后：繁殖为主 ------
    const queenCode =
      '// ========== 蚁后行为：定居繁殖 ==========\n' +
      '// 寻找巢穴基圆（作为栖息地）\n' +
      'let nestEntity = null;\n' +
      'for (let i = 0; i < nearby.length; i++) {\n' +
      '  const n = nearby[i];\n' +
      '  if (n.attributes && n.attributes.isNest) { nestEntity = n; break; }\n' +
      '}\n' +
      'const spd = (api.getProperty("speed") || 0.7) * 0.5;  // 蚁后移动很慢\n' +
      'let nestX = api.getProperty("nestX") || api.getX();\n' +
      'let nestY = api.getProperty("nestY") || api.getY();\n' +
      'if (nestEntity) { nestX = nestEntity.x; nestY = nestEntity.y; }\n' +
      'const distToNest = Math.hypot(api.getX() - nestX, api.getY() - nestY);\n' +
      '\n' +
      'let dx = 0, dy = 0;\n' +
      '\n' +
      'if (distToNest > 60) {\n' +
      '  dx = nestX - api.getX(); dy = nestY - api.getY();\n' +
      '} else if (nearestHostile) {\n' +
      '  // 有敌人靠近，缓慢撤退\n' +
      '  dx = api.getX() - nearestHostile.x; dy = api.getY() - nearestHostile.y;\n' +
      '} else {\n' +
      '  // 原地小幅徘徊\n' +
      '  let dir = api.getProperty("direction") || 0;\n' +
      '  dir += (Math.random() - 0.5) * 0.05;\n' +
      '  dx = Math.cos(dir) * 0.3; dy = Math.sin(dir) * 0.3;\n' +
      '  api.setProperty("direction", dir);\n' +
      '}\n' +
      '\n' +
      'api.setPosition(api.getX() + dx * spd, api.getY() + dy * spd);\n' +
      '\n' +
      '// 产卵：每3600帧(60秒)产一只新工蚁\n' +
      'let layTimer = api.getProperty("layTimer") || 0;\n' +
      'layTimer++;\n' +
      'api.setProperty("layTimer", layTimer);\n' +
      'if (layTimer >= 3600) {\n' +
      '  api.setProperty("layTimer", 0);\n' +
      '  if (window.CellCore && window.CellCore.createCell) {\n' +
      '    // 直接通过引擎接口创建新工蚁基圆\n' +
      '    const qName = api.getProperty("name") || "花园黑蚁";\n' +
      '    const qSpecies = api.getProperty("species") || "lasius_niger";\n' +
      '    const qColony = api.getProperty("colonyId") || "A";\n' +
      '    const antX = nestX + (Math.random() - 0.5) * 40;\n' +
      '    const antY = nestY + (Math.random() - 0.5) * 40;\n' +
      '    const newAnt = window.CellCore.createCell("creature", antX, antY);\n' +
      '    if (newAnt) {\n' +
      '      window.CellCore.updateCell(newAnt.id, { name: qName, radius: 4, color: "#2a1a0e" });\n' +
      '      // 新工蚁的行为代码注入（简化：交由属性面板加载时由 species.js API 填充）\n' +
      '    }\n' +
      '  }\n' +
      '}\n';

    // ------ 牧蚜蚁：黄墩蚁特有 ------
    const farmerCode =
      '// ========== 牧蚜蚁行为：放牧蚜虫获取蜜露 ==========\n' +
      'let dx = 0, dy = 0;\n' +
      'const spd = api.getProperty("speed") || 0.7;\n' +
      'const nestX = api.getProperty("nestX") || 0;\n' +
      'const nestY = api.getProperty("nestY") || 0;\n' +
      '\n' +
      '// 寻找附近的蚜虫（special food source）\n' +
      'let nearestAphid = null;\n' +
      'for (let i = 0; i < nearby.length; i++) {\n' +
      '  const n = nearby[i];\n' +
      '  if (n.attributes && n.attributes.species === "aphid") {\n' +
      '    nearestAphid = n;\n' +
      '    break;\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'if (nearestHostile) {\n' +
      '  dx = api.getX() - nearestHostile.x;\n' +
      '  dy = api.getY() - nearestHostile.y;\n' +
      '} else if (nearestAphid) {\n' +
      '  // 靠近蚜虫获取蜜露（额外能量来源）\n' +
      '  dx = nearestAphid.x - api.getX();\n' +
      '  dy = nearestAphid.y - api.getY();\n' +
      '  const d = Math.hypot(dx, dy);\n' +
      '  if (d < 20 && api.getFrame() % 300 === 0) {\n' +
      '    // 从蚜虫获取蜜露：+8能量（比自己觅食少但稳定）\n' +
      '    api.setProperty("energy", Math.min(100, (api.getProperty("energy") || 100) + 8));\n' +
      '  }\n' +
      '} else if (nearestFood) {\n' +
      '  dx = nearestFood.x - api.getX();\n' +
      '  dy = nearestFood.y - api.getY();\n' +
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
      '  api.setProperty("state", "idle");\n' +
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

  // ========== 蚂蚁外观绘制代码生成器 ==========
  // 返回可作为 api.registerDraw 参数的函数字符串: "function(ctx, r) { ... }"
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

  // ========== 植物外观绘制代码生成器 ==========
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
      '// 每 1200 帧(20秒)散一颗草籽，直到用完\n' +
      'if (api.getFrame() % 1200 === 0 && (api.getProperty("seedsRemaining") || 0) > 0) {\n' +
      '  api.setProperty("seedsRemaining", (api.getProperty("seedsRemaining") || 0) - 1);\n' +
      '  var sx = api.getX() + (Math.random() - 0.5) * 30;\n' +
      '  var sy = api.getY() + (Math.random() - 0.5) * 30;\n' +
      '  if (window.CellCore && window.CellCore.createCell) {\n' +
      '    var sd = window.CellCore.createCell("plant", sx, sy);\n' +
      '    if (sd) {\n' +
      '      window.CellCore.updateCell(sd.id, { name: "草籽", color: "#c8b050", radius: 3 });\n' +
      '      window.CellCore.setAttribute(sd.id, "seedEnergy", ' + sp.seedEnergy + ');\n' +
      '      window.CellCore.setAttribute(sd.id, "type", "seed");\n' +
      '      window.CellCore.setAttribute(sd.id, "species", "' + key + '");\n' +
      '    }\n' +
      '  }\n' +
      '}\n';
    return drawCode + behaviorCode;
  }
  // 通过 api.registerDraw() 注册自定义绘制函数，让代码页可编辑、可修改外观
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

  // ========== 昆虫外观绘制代码生成器 ==========
  // 返回可作为 api.registerDraw 参数的函数字符串: "function(ctx, r) { ... }"
  function _getInsectDrawCode(speciesKey) {
    const sp = INSECT_SPECIES[speciesKey];
    if (!sp) return 'function(ctx, r) { ctx.fillStyle = "#888"; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); }';

    const color = sp.color;
    const spotColor = sp.spotColor || '#1a1a1a';

    // --- 通用阴影模板 ---
    const shadow = 'ctx.save();ctx.globalAlpha=0.2;ctx.fillStyle="#000";ctx.beginPath();ctx.ellipse(0,r*0.2,r*1.1,r*0.5,0,0,Math.PI*2);ctx.fill();ctx.restore();';

    // --- shadeColor 内联辅助 ---
    const shadeFn = 'const _sh=function(h,p){if(!h)return"#555";if(h.length===4)h="#"+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];if(h.length!==7)return h;const n=parseInt(h.slice(1),16);let r=(n>>16)+p*2.55,g=((n>>8)&0xff)+p*2.55,b=(n&0xff)+p*2.55;r=Math.max(0,Math.min(255,Math.round(r)));g=Math.max(0,Math.min(255,Math.round(g)));b=Math.max(0,Math.min(255,Math.round(b)));return"#"+((r<<16)|(g<<8)|b).toString(16).padStart(6,"0");};';

    let body = '';

    // --- 按物种生成绘制代码 ---
    switch (speciesKey) {
      case 'scolopendra': {
        body = `${shadeFn}
// 蜈蚣：多节扁平长条 + 步足 + 毒颚
const now = Date.now();
const waveP = now * 0.002;
const segments = 6;
const totalLen = r * 1.6;
const segW = totalLen / segments;
const startX = -totalLen / 2 + segW / 2;
const bodyY = function(i){ return Math.sin(waveP + i * 0.5) * r * 0.08; };
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
    ctx.strokeStyle = '#201005';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(sx - segW * 0.38, sy - r * 0.22);
    ctx.lineTo(sx - segW * 0.38, sy + r * 0.22);
    ctx.stroke();
  }
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
const headX = startX + totalLen / 2 + segW * 0.55;
const headY = bodyY(segments - 1);
ctx.fillStyle = '#5e2010';
ctx.beginPath();
ctx.ellipse(headX, headY, r * 0.32, r * 0.28, 0, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#1a0800';
ctx.lineWidth = 0.8;
ctx.stroke();
ctx.fillStyle = '#050302';
ctx.beginPath();
ctx.arc(headX + r * 0.12, headY - r * 0.1, 1.2, 0, Math.PI * 2);
ctx.arc(headX + r * 0.12, headY + r * 0.1, 1.2, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#4a1f0e';
ctx.lineWidth = 0.8;
ctx.beginPath();
ctx.moveTo(headX + r * 0.1, headY - r * 0.08);
ctx.quadraticCurveTo(headX + r * 0.4, headY - r * 0.45, headX + r * 0.55, headY - r * 0.55);
ctx.moveTo(headX + r * 0.1, headY + r * 0.08);
ctx.quadraticCurveTo(headX + r * 0.4, headY + r * 0.45, headX + r * 0.55, headY + r * 0.55);
ctx.stroke();
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
const tailX = startX - segW * 0.5;
const tailY = bodyY(0);
ctx.fillStyle = '#4a1a0d';
ctx.beginPath();
ctx.ellipse(tailX, tailY, r * 0.18, r * 0.18, 0, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#1a0800';
ctx.lineWidth = 0.6;
ctx.stroke();`;
        break;
      }
      case 'coccinella_septempunctata': {
        body = `// 七星瓢虫：红色半球 + 7 黑斑
ctx.fillStyle = '${color}';
ctx.beginPath();
ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '${spotColor}';
ctx.lineWidth = 1.5;
ctx.beginPath();
ctx.moveTo(0, -r * 0.9);
ctx.lineTo(0, r * 0.9);
ctx.stroke();
ctx.fillStyle = '${spotColor}';
const spotR = r * 0.15;
ctx.beginPath();
ctx.arc(0, -r * 0.6, spotR, 0, Math.PI * 2);
ctx.fill();
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
ctx.fillStyle = '${spotColor}';
ctx.beginPath();
ctx.arc(-r * 0.95, 0, r * 0.2, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '${spotColor}';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(-r * 1.05, -r * 0.1);
ctx.lineTo(-r * 1.35, -r * 0.35);
ctx.moveTo(-r * 1.05, r * 0.1);
ctx.lineTo(-r * 1.35, r * 0.35);
ctx.stroke();`;
        break;
      }
      case 'aphid': {
        body = `// 蚜虫：淡绿色梨形 + 腹管 + 细腿
ctx.fillStyle = '${color}';
ctx.beginPath();
ctx.ellipse(r * 0.1, 0, r * 0.85, r * 0.6, 0, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '${spotColor}';
ctx.lineWidth = 1.2;
ctx.beginPath();
ctx.moveTo(r * 0.75, -r * 0.25);
ctx.lineTo(r * 1.2, -r * 0.55);
ctx.moveTo(r * 0.75, r * 0.25);
ctx.lineTo(r * 1.2, r * 0.55);
ctx.stroke();
ctx.strokeStyle = '${spotColor}';
ctx.lineWidth = 1;
for (let i = -1; i <= 1; i += 1) {
  ctx.beginPath();
  ctx.moveTo(i * r * 0.25, -r * 0.55);
  ctx.lineTo(i * r * 0.25 - r * 0.15, -r * 0.95);
  ctx.moveTo(i * r * 0.25, r * 0.55);
  ctx.lineTo(i * r * 0.25 + r * 0.15, r * 0.95);
  ctx.stroke();
}
ctx.fillStyle = 'rgba(255,255,255,0.35)';
ctx.beginPath();
ctx.arc(r * 0.3, -r * 0.25, r * 0.15, 0, Math.PI * 2);
ctx.fill();`;
        break;
      }
      case 'theraphosidae': {
        body = `${shadeFn}
// 狼蛛：棕褐色 + 8 条多节长毛腿
const legLen = r * 1.15;
for (let i = 0; i < 8; i++) {
  const baseAngle = (i / 8) * Math.PI * 2 + Math.PI / 8;
  const coxaX = Math.cos(baseAngle) * r * 0.15;
  const coxaY = Math.sin(baseAngle) * r * 0.15;
  const sign2 = i % 2 === 0 ? 1 : -1;
  const femurAngle = baseAngle + sign2 * 0.35;
  const femurLen = legLen * 0.45;
  const femurX = coxaX + Math.cos(femurAngle) * femurLen;
  const femurY = coxaY + Math.sin(femurAngle) * femurLen;
  const kneeAngle = femurAngle + sign2 * 0.5;
  const tibiaLen = legLen * 0.35;
  const tibiaX = femurX + Math.cos(kneeAngle) * tibiaLen;
  const tibiaY = femurY + Math.sin(kneeAngle) * tibiaLen;
  const tarsusAngle = kneeAngle + sign2 * 0.3;
  const tarsusLen = legLen * 0.2;
  const tarsusX = tibiaX + Math.cos(tarsusAngle) * tarsusLen;
  const tarsusY = tibiaY + Math.sin(tarsusAngle) * tarsusLen;
  ctx.strokeStyle = _sh('${color}', -10);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(coxaX, coxaY);
  ctx.lineTo(femurX, femurY);
  ctx.stroke();
  ctx.strokeStyle = '${color}';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(femurX, femurY);
  ctx.lineTo(tibiaX, tibiaY);
  ctx.stroke();
  ctx.strokeStyle = _sh('${color}', 15);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(tibiaX, tibiaY);
  ctx.lineTo(tarsusX, tarsusY);
  ctx.stroke();
}
ctx.fillStyle = '${color}';
ctx.beginPath();
ctx.ellipse(r * 0.25, 0, r * 0.75, r * 0.55, 0, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = _sh('${color}', -20);
ctx.beginPath();
ctx.arc(-r * 0.3, 0, r * 0.35, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '${spotColor}';
const eyeR2 = Math.max(1.5, r * 0.07);
const eyeAngles = [-0.45, -0.15, 0.15, 0.45, -0.55, 0.55, -0.25, 0.25];
for (let i = 0; i < eyeAngles.length; i++) {
  ctx.beginPath();
  ctx.arc(-r * 0.3 + Math.cos(eyeAngles[i]) * r * 0.18, Math.sin(eyeAngles[i]) * r * 0.2, eyeR2, 0, Math.PI * 2);
  ctx.fill();
}
ctx.fillStyle = '${spotColor}';
for (let i = 0; i < 5; i++) {
  const px = -r * 0.05 + (i - 2) * r * 0.18;
  const py = (i % 2 === 0 ? r * 0.15 : -r * 0.15);
  ctx.beginPath();
  ctx.arc(px, py, r * 0.05, 0, Math.PI * 2);
  ctx.fill();
}`;
        break;
      }
      case 'cicindela': {
        body = `${shadeFn}
// 虎甲：亮蓝色金属椭圆 + 巨大镰刀状颚
const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
grad.addColorStop(0, '${spotColor}');
grad.addColorStop(1, '${color}');
ctx.fillStyle = grad;
ctx.beginPath();
ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '${spotColor}';
ctx.lineWidth = 1.2;
ctx.beginPath();
ctx.moveTo(-r * 0.9, 0);
ctx.lineTo(r * 0.7, 0);
ctx.stroke();
ctx.fillStyle = '${color}';
ctx.beginPath();
ctx.arc(-r * 0.95, 0, r * 0.3, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '${spotColor}';
ctx.beginPath();
ctx.arc(-r * 0.95, -r * 0.25, r * 0.12, 0, Math.PI * 2);
ctx.arc(-r * 0.95, r * 0.25, r * 0.12, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#d0d0e0';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(-r * 1.1, -r * 0.1);
ctx.quadraticCurveTo(-r * 1.5, -r * 0.15, -r * 1.9, -r * 0.3);
ctx.moveTo(-r * 1.1, r * 0.1);
ctx.quadraticCurveTo(-r * 1.5, r * 0.15, -r * 1.9, r * 0.3);
ctx.stroke();
ctx.lineCap = 'round';
for (let i = 0; i < 3; i++) {
  const lx = -r * 0.3 + i * r * 0.3;
  const legBaseY = r * 0.28;
  ctx.strokeStyle = '${spotColor}';
  ctx.lineWidth = 1.5;
  const uEndX = lx - r * 0.1;
  const uEndY = -r * 0.55;
  ctx.beginPath();
  ctx.moveTo(lx, -legBaseY);
  ctx.lineTo(uEndX, uEndY);
  ctx.stroke();
  ctx.strokeStyle = '${color}';
  ctx.lineWidth = 1.0;
  const lEndX = uEndX - r * 0.15;
  const lEndY = -r * 0.88;
  ctx.beginPath();
  ctx.moveTo(uEndX, uEndY);
  ctx.lineTo(lEndX, lEndY);
  ctx.stroke();
  ctx.strokeStyle = '#d0d0e0';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(lEndX, lEndY);
  ctx.lineTo(lEndX - r * 0.1, -r * 0.95);
  ctx.stroke();
  ctx.strokeStyle = '${spotColor}';
  ctx.lineWidth = 1.5;
  const udEndX = lx + r * 0.1;
  const udEndY = r * 0.55;
  ctx.beginPath();
  ctx.moveTo(lx, legBaseY);
  ctx.lineTo(udEndX, udEndY);
  ctx.stroke();
  ctx.strokeStyle = '${color}';
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
}`;
        break;
      }
      case 'vespa': {
        body = `${shadeFn}
// 胡蜂：橙黄色 + 黑条纹 + 透明翅膀
ctx.fillStyle = 'rgba(220,220,255,0.35)';
ctx.beginPath();
ctx.ellipse(0, -r * 0.5, r * 0.9, r * 0.45, -0.3, 0, Math.PI * 2);
ctx.fill();
ctx.beginPath();
ctx.ellipse(0, r * 0.5, r * 0.9, r * 0.45, 0.3, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '${color}';
ctx.beginPath();
ctx.ellipse(r * 0.2, 0, r * 0.85, r * 0.42, 0, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '#2a1a0a';
for (let i = 1; i <= 3; i++) {
  ctx.beginPath();
  ctx.ellipse(-r * 0.2 + i * r * 0.3, 0, r * 0.07, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
}
ctx.fillStyle = _sh('${color}', -25);
ctx.beginPath();
ctx.arc(-r * 0.35, 0, r * 0.28, 0, Math.PI * 2);
ctx.fill();
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
  const sign2 = leg.angle < 0 ? -1 : 1;
  const femurLen = r * 0.35 * leg.lenScale;
  const femurEndX = leg.x + Math.cos(leg.angle) * femurLen;
  const femurEndY = leg.yOff + Math.sin(leg.angle) * femurLen;
  ctx.strokeStyle = '#2a1a0a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(leg.x, leg.yOff);
  ctx.lineTo(femurEndX, femurEndY);
  ctx.stroke();
  const tibiaAngle = leg.angle + sign2 * 0.7;
  const tibiaLen = r * 0.3 * leg.lenScale;
  const tibiaEndX = femurEndX + Math.cos(tibiaAngle) * tibiaLen;
  const tibiaEndY = femurEndY + Math.sin(tibiaAngle) * tibiaLen;
  ctx.strokeStyle = '${color}';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(femurEndX, femurEndY);
  ctx.lineTo(tibiaEndX, tibiaEndY);
  ctx.stroke();
}
ctx.fillStyle = _sh('${color}', -15);
ctx.beginPath();
ctx.arc(-r * 0.85, 0, r * 0.25, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '#2a1a0a';
ctx.beginPath();
ctx.ellipse(-r * 0.85, -r * 0.18, r * 0.08, r * 0.12, 0, 0, Math.PI * 2);
ctx.ellipse(-r * 0.85, r * 0.18, r * 0.08, r * 0.12, 0, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '#1a1a1a';
ctx.beginPath();
ctx.moveTo(r * 1.0, -r * 0.1);
ctx.lineTo(r * 1.25, 0);
ctx.lineTo(r * 1.0, r * 0.1);
ctx.closePath();
ctx.fill();`;
        break;
      }
      case 'pieris_rapae': {
        body = `// 菜粉蝶：白色翅膀 + 黑斑 + 细长身体
ctx.fillStyle = '${color}';
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
ctx.fillStyle = '${spotColor}';
ctx.beginPath();
ctx.ellipse(r * 0.6, -r * 0.75, r * 0.2, r * 0.15, 0.5, 0, Math.PI * 2);
ctx.fill();
ctx.beginPath();
ctx.arc(-r * 0.4, r * 0.25, r * 0.1, 0, Math.PI * 2);
ctx.fill();
ctx.beginPath();
ctx.arc(r * 0.4, r * 0.25, r * 0.1, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '#3a2a2a';
ctx.beginPath();
ctx.ellipse(0, 0, r * 0.12, r * 0.85, 0, 0, Math.PI * 2);
ctx.fill();`;
        break;
      }
      case 'myrmeleon': {
        body = `${shadeFn}
// 蚁狮：沙色陷阱形状 + 中央捕食者
ctx.strokeStyle = _sh('${color}', -15);
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
ctx.fillStyle = 'rgba(120,80,50,0.5)';
ctx.beginPath();
ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '${spotColor}';
ctx.beginPath();
ctx.ellipse(0, 0, r * 0.35, r * 0.22, 0, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '${spotColor}';
ctx.lineWidth = 1.8;
ctx.beginPath();
ctx.moveTo(-r * 0.3, -r * 0.12);
ctx.quadraticCurveTo(-r * 0.6, -r * 0.2, -r * 0.85, -r * 0.1);
ctx.moveTo(-r * 0.3, r * 0.12);
ctx.quadraticCurveTo(-r * 0.6, r * 0.2, -r * 0.85, r * 0.1);
ctx.stroke();
ctx.fillStyle = 'rgba(90,60,40,0.8)';
for (let i = 0; i < 12; i++) {
  const ang2 = (i / 12) * Math.PI * 2;
  const rr2 = r * (0.6 + (i % 3) * 0.1);
  ctx.beginPath();
  ctx.arc(Math.cos(ang2) * rr2, Math.sin(ang2) * rr2, 1.2, 0, Math.PI * 2);
  ctx.fill();
}`;
        break;
      }
      default:
        body = `ctx.fillStyle = '${color}';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();`;
    }

    return `${shadow}${body}`;
  }

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

    // 行为逻辑代码
    const behaviorCode =
      '// =================== 基本属性（属性面板参数定义）===================\n' +
      ('// ' + sp.name + '（' + sp.latin + '）\n') +
      '// 以下属性定义同步更新属性面板的基本信息\n' +
      '\n' +
      'if (!api.getProperty("initialized")) {\n' +
      '  api.setProperty("initialized", true);\n' +
      '  // --- 基本信息 ---\n' +
      '  api.setProperty("name", "' + sp.name + '");         // 名称\n' +
      '  api.setProperty("species", "' + key + '");           // 物种key（用于外观识别）\n' +
      '  api.setKind("insect");                               // 基圆种类：昆虫\n' +
      '  api.setProperty("behaviorKind", "' + sp.kind + '"); // 行为类型（ground/flying/ambush）\n' +
      '  api.setProperty("hostile", ' + hostile + ');         // 是否敌对\n' +
      '  // --- 外观参数 ---\n' +
      '  api.setColor("' + sp.color + '");                   // 主体颜色\n' +
      '  api.setProperty("spotColor", "' + (sp.spotColor || '#1a1a1a') + '"); // 斑点颜色\n' +
      '  api.setRadius(' + sp.size + ');                      // 体型（半径）\n' +
      '  // --- 战斗参数 ---\n' +
      '  api.setProperty("hp", ' + (30 + sp.energyValue) + ');             // 生命值\n' +
      '  api.setProperty("attackPower", ' + sp.attackPower + ');           // 攻击力（每120帧/2秒一次）\n' +
      '  api.setProperty("aggression", ' + sp.aggression + ');             // 攻击性（0~1）\n' +
      '  api.setProperty("defense", ' + (sp.defense || 0) + ');           // 防御力（0~1）\n' +
      '  api.setProperty("energyValue", ' + sp.energyValue + ');           // 能量值（死亡后给蚂蚁）\n' +
      '  // --- 移动参数 ---\n' +
      '  api.setProperty("speed", ' + sp.speed.toFixed(2) + ');            // 移动速度（px/帧）\n' +
      '  api.setProperty("flying", ' + (sp.flying ? 'true' : 'false') + '); // 是否飞行\n' +
      '  api.setProperty("direction", Math.random() * Math.PI * 2);       // 初始朝向\n' +
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
      'const spd = api.getProperty("speed") || 1.0;\n' +
      'let dir = api.getProperty("direction") || 0;\n' +
      '\n' +
      (sp.hostile
        ? '// 敌对昆虫：搜索范围内蚂蚁追击\n' +
          'const nearby = api.findAllWithinRadius(api.getX(), api.getY(), 150);\n' +
          'let target = null, minD = Infinity;\n' +
          'for (let i = 0; i < nearby.length; i++) {\n' +
          '  const n = nearby[i];\n' +
          '  if (n.attributes && n.attributes.antId) {\n' +
          '    const d = Math.hypot(n.x - api.getX(), n.y - api.getY());\n' +
          '    if (d < minD) { minD = d; target = n; }\n' +
          '  }\n' +
          '}\n' +
          '\n' +
          'let dx, dy;\n' +
          'if (target) {\n' +
          '  dx = target.x - api.getX(); dy = target.y - api.getY();\n' +
          '  if (minD < 20 && api.getFrame() % 120 === 0) {\n' +
          '    api.emitCellEvent(target.id, "attack", { damage: api.getProperty("attackPower") || 3, sourceId: api.getProperty("id") });\n' +
          '  }\n' +
          '} else {\n' +
          '  dir += (Math.random() - 0.5) * 0.2;\n' +
          '  dx = Math.cos(dir); dy = Math.sin(dir);\n' +
          '  api.setProperty("direction", dir);\n' +
          '}\n'
        : '// 非敌对昆虫：随机漫游，偶尔变向\n' +
          'if (api.getFrame() % 60 === 0) dir += (Math.random() - 0.5) * 0.4;\n' +
          'let dx = Math.cos(dir), dy = Math.sin(dir);\n' +
          'api.setProperty("direction", dir);\n') +
      '\n' +
      '// 移动\n' +
      'const dist = Math.sqrt(dx*dx + dy*dy) || 1;\n' +
      'api.setPosition(api.getX() + dx/dist * spd, api.getY() + dy/dist * spd);\n' +
      '\n' +
      '// 饱食度消耗（每600帧=10秒-1）\n' +
      'if (api.getFrame() % 600 === 0) {\n' +
      '  api.setProperty("energy", Math.max(0, (api.getProperty("energy") || 100) - 1));\n' +
      '}\n';

    return drawCode + behaviorCode;
  }

  // ===== 场景对象（岩石/水源/树洞）—— 非生物 =====
  // 这些基圆被蚂蚁视为"环境"：岩石阻挡、水源提供湿气、树洞是蚁巢候选
  const SCENE_OBJECT_TYPES = {
    nest: {
      name: '蚁巢',
      color: '#8b5a2b',
      size: 40,
      description: '蚁巢基圆：蚁群的家。工蚁在此存储食物，兵蚁在此回血。'
    },
    rock: {
      name: '岩石',
      color: '#888888',
      size: 25,
      description: '岩石/石块。可作为蚂蚁的地标，部分昆虫（蜈蚣）会在石块下藏身。'
    },
    water: {
      name: '小水塘',
      color: '#4a90c8',
      size: 35,
      description: '小水塘或潮湿土壤。蚂蚁在干旱环境下会寻找水源。'
    },
    wood: {
      name: '朽木',
      color: '#6a4a30',
      size: 40,
      description: '朽木/枯木——弓背蚁的理想筑巢地。'
    },
    sand: {
      name: '沙地凹陷',
      color: '#c09860',
      size: 20,
      description: '蚁狮陷阱所在区域——蚂蚁靠近需谨慎。'
    }
  };

  // ===== 详细外观绘制函数（v5.0 视觉升级）=====
  // 每个函数接收 ctx（Canvas2D 上下文）、r（基圆半径）、cell（原始基圆数据）
  // 坐标系：以基圆中心为原点(0,0)，调用方已进行 translate + 旋转
  // 可根据 cell.attributes 中的物种信息绘制具体外观
  //
  // 视觉风格：俯视角度 + 轻微阴影轮廓 + 高光点 + 物种特征（斑点/分节/触角等）
  // -----------------------------------------------------------------
  //
  // --- 工具函数：在 ctx 上画一条带端点的分节线（蚂蚁腿）---
  //
  // NOTE: 这些函数被 renderBridge.js 的 _drawDefaultCell 调用，不能用 api.*

  // ===== 主绘制函数：根据 species key 绘制细致外观 =====
  // 返回值：true 表示已完成自定义绘制，不需要回退到默认圆形
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

  // ---------------------------------------------------------------
  // 蚂蚁：分节身体 + 头 + 胸 + 腹 + 3 对足 + 2 触角
  // 颜色随物种变化（黑/黄/红/白）
  // ---------------------------------------------------------------
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

  // ---------------------------------------------------------------
  // 昆虫：按物种特征绘制 ——
  // 瓢虫：红半球 + 7黑点 + 小黑头； 菜粉蝶：白翅膀 + 黑斑；
  // 蚜虫：小绿色椭球； 狼蛛：8 腿 + 2 眼； 蜈蚣：长条多节；
  // 虎甲：亮绿金属 + 大颚； 胡蜂：黄黑条纹 + 翅膀； 蚁狮：沙色陷阱形
  // ---------------------------------------------------------------
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

  // ---------------------------------------------------------------
  // 植物：按类型绘制 ——
  //   grass（禾本科）：多根向上细叶片 + 中央穗
  //   herb（阔叶）：3-5 片宽叶呈放射形
  //   fruit（果实）：茎+ 2-3 颗浆果
  //   mushroom（蘑菇）：蘑菇伞 + 菌柄
  //   tree（乔木）：粗壮树干+ 茂密树冠（圆形叶团）
  //   succulent（肉植）：沙漠耐旱，多浆
  // ---------------------------------------------------------------
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

  // ---------------------------------------------------------------
  // 场景对象：岩石、水塘、朽木、沙地 ——
  //  rock：不规则多边形灰色 + 裂纹
  //  water：蓝色圆 + 水纹 + 少量高光
  //  wood：棕色不规则长条 + 年轮纹理
  //  sand：淡黄圆形 + 散沙粒
  // ---------------------------------------------------------------
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

  // --- 颜色辅助：将 hex 颜色 +/- percent（变亮/变暗）---
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

  // ===== 地图预设：v4.0 =====
  // 不同地图有不同的背景色、植物群、昆虫、可使用的蚂蚁种群、能量倍率
  // preset 对象中的键名即预设ID（如 grassland），对象内不重复冗余id字段
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

  // ===== 构建地图场景（根据预设生成植物/水源/岩石/昆虫） =====
  // 参数: presetKey = 'grassland' | 'desert' | 'deciduous' | 'rainforest'
  //       options = { clearWorld: true, density: 1.0, center: {x, y}, radius: number }
  // 返回: { presetKey, presetName, plants, insects, trees, waters, rocks, total, error? }
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

    let plantCount = 0, insectCount = 0, treeCount = 0, waterCount = 0, rockCount = 0;
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
      total: plantCount + treeCount + insectCount + waterCount + rockCount,
      background: preset.backgroundColor,
      description: preset.description,
      autoLoadedBehaviors: autoLoadBehaviorTargets.length
    };
  }

  // ===== 导出公共 API =====
  window.SpeciesRegistry = {
    getAnt: function (key) { return ANT_SPECIES[key]; },
    getPlant: function (key) { return PLANT_SPECIES[key]; },
    getInsect: function (key) { return INSECT_SPECIES[key]; },
    getAllAnts: function () { return ANT_SPECIES; },
    getAllPlants: function () { return PLANT_SPECIES; },
    getAllInsects: function () { return INSECT_SPECIES; },
    getMapPreset: function (key) { return MAP_PRESETS[key]; },
    getMapPresets: function () { return MAP_PRESETS; },
    getAntRoles: function (speciesKey) { return (ANT_SPECIES[speciesKey] || {}).roles; },
    getPersonalities: function () { return ANT_PERSONALITIES; },
    buildAntAttributes: buildAntAttributes,
    buildPlantAttributes: buildPlantAttributes,
    buildInsectAttributes: buildInsectAttributes,
    getSpeciesDescription: getSpeciesDescription,
    getAntBehaviorCode: getAntBehaviorCode,
    getPlantBehaviorCode: getPlantBehaviorCode,
    getInsectBehaviorCode: getInsectBehaviorCode,
    getSceneObjectBehaviorCode: getSceneObjectBehaviorCode,
    getRandomAntSpecies: function () {
      const keys = Object.keys(ANT_SPECIES);
      return keys[Math.floor(Math.random() * keys.length)];
    },
    getRandomPlantSpecies: function () {
      const keys = Object.keys(PLANT_SPECIES);
      return keys[Math.floor(Math.random() * keys.length)];
    },
    getRandomInsectSpecies: function () {
      const keys = Object.keys(INSECT_SPECIES);
      return keys[Math.floor(Math.random() * keys.length)];
    },
    buildMapScene: buildMapScene,
    drawSpeciesAppearance: drawSpeciesAppearance,
    SCENE_OBJECT_TYPES: SCENE_OBJECT_TYPES
  };
})(window);
