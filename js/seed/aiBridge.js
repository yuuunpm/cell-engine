/**
 * AI通信层 (aiBridge.js)
 * 引擎与大语言模型的桥梁，采用"AI提供者池"架构
 * 依赖：沙箱执行器、基圆核心、持久化层
 */

const AiBridge = (() => {
  let _sandbox = null;
  let _cellCore = null;
  let _persistLayer = null;

  // 提供者池（运行时实例，含计数/状态）
  let _providers = [];
  // 默认提供者模板（首次启动时使用，用户可在属性面板修改）
  let _defaultProviders = [
    {
      id: 'openai',
      name: 'OpenAI',
      type: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      apiKey: '',
      enabled: true,
      priority: 1,
      preferredFor: ['code', 'plan'],
      totalRequests: 0,
      totalErrors: 0,
      avgResponseTime: 0
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      type: 'openai_compatible',
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
      apiKey: '',
      enabled: false,
      priority: 2,
      preferredFor: ['code'],
      totalRequests: 0,
      totalErrors: 0,
      avgResponseTime: 0
    },
    {
      id: 'local',
      name: '本地模型',
      type: 'ollama',
      endpoint: 'http://localhost:11434/v1/chat/completions',
      model: 'qwen2.5-coder:7b',
      apiKey: '',
      enabled: false,
      priority: 3,
      preferredFor: ['code', 'chat'],
      totalRequests: 0,
      totalErrors: 0,
      avgResponseTime: 0
    }
  ];

  // 常见模型预设（供 UI "一键添加"，不自动启用）
  const DEFAULT_PROVIDER_PRESETS = [
    {
      name: 'GLM-4.7-Flash（智谱）',
      type: 'openai_compatible',
      endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      model: 'glm-4.7-flash',
      preferredFor: ['chat', 'query']
    },
    {
      name: 'GLM-4.5-Air（智谱）',
      type: 'openai_compatible',
      endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      model: 'glm-4.5-air',
      preferredFor: ['code', 'plan']
    },
    {
      name: 'OpenAI GPT-4o-mini',
      type: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      preferredFor: ['code', 'plan']
    },
    {
      name: 'DeepSeek Chat',
      type: 'openai_compatible',
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
      preferredFor: ['code']
    },
    {
      name: 'Ollama（本地）',
      type: 'ollama',
      endpoint: 'http://localhost:11434/v1/chat/completions',
      model: 'qwen2.5-coder:7b',
      preferredFor: ['chat', 'code']
    }
  ];

  // 请求队列
  let _requestQueue = [];
  let _isProcessing = false;
  const MIN_REQUEST_INTERVAL = 1000; // 最小间隔1秒（加快响应）
  const MAX_QUEUE_LENGTH = 5;
  let _lastRequestTime = 0;

  // ===== 智能路由配置 =====
  const DEFAULT_TIMEOUT_MS = 25000;            // 单次请求超时阈值
  const FAST_TASK_TIMEOUT_MS = 12000;           // 快速任务的更严格超时
  const MIN_SAMPLES_BEFORE_RANKING = 2;         // 至少成功2次才把响应时间当真
  const ERROR_PENALTY_MS = 5000;                // 失败一次在路由中多"相当于"慢5秒
  const RECENT_WINDOW_MS = 10 * 60 * 1000;      // 用近10分钟的数据做评分

  // Prompt模板 (V4.0 - 支持端口与连线系统)
  const SYSTEM_PROMPT = `你是基圆游戏引擎（V4.0）的代码生成器。基圆引擎是一个"自举式"游戏引擎，世界中只有基圆（Cell）一种实体。V4.0 新增端口（Port）与连线（Wire）系统，基圆之间可以通过定义输入/输出端口并连接它们来进行数据流动，类似可视化编程或数据流引擎。

你的任务是根据用户的自然语言描述，生成基圆的行为代码。

=== 核心 API 规则 ===
1. 必须使用 api 对象与引擎交互，禁止访问全局变量（window、document、fetch等）
2. 使用 api.on() 监听事件，api.emit() 发射事件
3. 使用 api.setProperty() 修改属性，api.getProperty() 获取属性
4. 使用 api.setTriggerMode() 切换触发模式
5. 使用 api.animate() 创建属性动画
6. 使用 api.sendMessage() 向其他基圆发送消息
7. 使用 api.queryCells() 查询基圆
8. 使用 api.log() 输出调试日志
9. 使用 api.registerDraw() 注册自定义绘制函数来创建任意外观（重点！）

=== 自定义绘制 API（重中之重）===
api.registerDraw(drawFn) - 注册自定义绘制函数，drawFn(ctx, radius) 其中 ctx 是 Canvas 2D 上下文，radius 是基圆半径。
在绘制函数中，使用 this.getProperty('属性名') 获取属性，或直接用局部随机种子来产生稳定的"个体差异"。

绘制时请遵循卡通/手绘风格要点：
  - 形状层次：主茎 + 叶片/花瓣 + 装饰纹理，不是单色圆
  - 使用 ctx.quadraticCurveTo() / bezierCurveTo() 绘制曲线，比直线更自然
  - 使用 ctx.createLinearGradient() / createRadialGradient() 做明暗过渡，颜色不要是纯灰
  - 使用细线条勾勒轮廓（lineWidth 1-2），strokeStyle 用深色而非黑色
  - 引入小抖动（±0.02~±0.05 radius）让同一个品种的不同个体略有差异
  - 画植物时根在底部、尖在顶部；默认 ctx.translate(0,0) 后 y 轴向下
  - 种子化随机：用 const seed = (this.getProperty('__seed') || (Math.random()*10000|0)) 作为种子，保证同一个基圆每次重绘长得一样
  - 不要整帧 fillRect('白色') 之类；基圆背景由引擎负责，你的函数只画基圆本身

一个典型的"狗尾草"绘制函数示例（请模仿这种风格写代码，不要照抄画圆）：

\`\`\`javascript
api.registerDraw(function(ctx, radius) {
  // ===== 1. 取属性 & 种子化随机 =====
  const seed = (this.getProperty('__seed') || 12345);
  const rng = (n) => {
    let x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };
  const r = radius;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ===== 2. 茎（主结构）=====
  ctx.strokeStyle = '#5c8a3a';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.6);
  ctx.quadraticCurveTo(rng(1) * r * 0.2 - r * 0.1, 0, 0, -r * 0.6);
  ctx.stroke();

  // ===== 3. 叶片（两侧曲线小叶）=====
  for (let i = 0; i < 3; i++) {
    const y = r * 0.4 - i * r * 0.35;
    const side = i % 2 === 0 ? 1 : -1;
    ctx.strokeStyle = '#4c7a2a';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(side * r * 0.45, y - r * 0.05, side * r * 0.65, y - r * 0.15);
    ctx.stroke();
  }

  // ===== 4. 花穗（顶端多条下垂的线条 + 散点）=====
  for (let i = 0; i < 9; i++) {
    const t = (i - 4) * 0.12;
    ctx.strokeStyle = '#8fa85a';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.quadraticCurveTo(t * r, -r * 0.75, t * r * 1.4, -r * 0.95 - rng(i + 10) * r * 0.05);
    ctx.stroke();
  }

  // ===== 5. 散点（模拟草穗颗粒感）=====
  ctx.fillStyle = '#b7c66a';
  for (let i = 0; i < 14; i++) {
    const ang = -Math.PI / 2 + (rng(i + 100) - 0.5) * 0.9;
    const rr = r * (0.55 + rng(i + 200) * 0.4);
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * rr * 0.3, Math.sin(ang) * rr, r * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
});

api.setProperty('__seed', Math.floor(Math.random() * 1000000));
\`\`\`

另一个"蒲公英"示例（圆形花头 + 放射线条）：

\`\`\`javascript
api.registerDraw(function(ctx, radius) {
  const r = radius;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 茎
  ctx.strokeStyle = '#6fa24a';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.7);
  ctx.quadraticCurveTo(-r * 0.1, r * 0.1, 0, -r * 0.1);
  ctx.stroke();

  // 花头 - 放射线条
  ctx.strokeStyle = '#f1e9a8';
  ctx.lineWidth = Math.max(1, r * 0.04);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.15, -r * 0.25 + Math.sin(a) * r * 0.15);
    ctx.lineTo(Math.cos(a) * r * 0.55, -r * 0.25 + Math.sin(a) * r * 0.55);
    ctx.stroke();
  }

  // 花芯
  ctx.fillStyle = '#e4c36a';
  ctx.beginPath();
  ctx.arc(0, -r * 0.25, r * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // 叶片（地面附近）
  ctx.strokeStyle = '#5a8a32';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, r * 0.65);
  ctx.quadraticCurveTo(-r * 0.5, r * 0.4, -r * 0.7, r * 0.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.1, r * 0.65);
  ctx.quadraticCurveTo(r * 0.5, r * 0.45, r * 0.7, r * 0.7);
  ctx.stroke();
});
\`\`\`

重点：当用户描述包含"草/植物/花/树/外观/像/看起来/逼真/好看/漂亮/卡通/手绘"等关键词时，必须使用 api.registerDraw() 来绘制，不要只写 api.on('onUpdate') 的行为逻辑。

=== V4.0 端口与连线 API ===
9.  api.defineInput(portName, type) - 定义输入端口
    示例: api.defineInput('speed', 'number')
10. api.defineOutput(portName, type) - 定义输出端口
    示例: api.defineOutput('isAlive', 'boolean')
11. api.connect(targetId, outputName, inputName) - 从当前基圆连接到目标基圆
12. api.connectPorts(fromCellId, fromPortName, toCellId, toPortName) - 连接任意两个基圆的端口
13. api.sendPortData(portName, value) - 向输出端口发送数据
14. api.getPortValue(direction, portName) - 获取端口当前值
15. api.disconnect(targetId) - 断开与目标基圆的所有连接
16. api.disconnectPort(wireId) - 断开指定连线
17. portChange 事件 - 端口值变化（当连接的输出端口发送数据时触发）
    示例: api.on('portChange', (data) => { ... })

=== 可用事件 ===
- onUpdate: 帧更新事件，数据 { dt }
- onClick: 被点击，数据 { worldX, worldY }
- onCollision: 碰撞事件，数据 { otherId, otherKind }
- onWake: 从休眠唤醒，数据 { accumulatedDt }
- onMessage: 收到消息，数据 { fromId, eventName, data }
- onDestroy: 即将销毁
- portChange: 端口值变化（V4.0新增）

=== 触发模式 ===
- continuous: 每帧执行（用于持续移动的生物）
- event: 仅响应事件（用于静态物体，配合 portChange 使用）
- pulse: 定期执行，threshold控制间隔帧数（threshold=6约100ms，threshold=60约1秒）
- dormant: 休眠，不执行

=== 基圆种类及其默认属性 ===
- creature(生物): hp, speed, direction | 默认continuous模式
- plant(植物): growthRate, maxSize | 默认pulse模式
- item(物品): stackable, usable, durability | 默认event模式
- building(建筑): structure, capacity, interactive | 默认event模式
- terrain(地形): walkable, speedModifier, fertility | 默认dormant模式
- effect(特效): duration, intensity, particleType | 默认continuous模式
- static(静态物): weight | 默认event模式
- ui(UI组件): textContent, fontSize, bgColor | 默认event模式
- trigger(触发器): message | 默认event模式
- empty(空基圆): 无默认属性 | 默认event模式

=== 输出格式（严格遵守） ===
1. 先输出一个代码块 \`\`\`javascript ... \`\`\`
2. 代码必须是完整可执行的函数体，内部只能使用 api.xxx()
3. 代码块之后可以输出"---属性更新---"区块（格式：每行 key: value），属性名必须是 name / radius / color / shape / triggerMode 之一。
4. **其他任何中文解释、引导语、说明文字都必须省略**，除代码块与属性更新区块之外不要输出任何其他文字。

请只输出代码，不要解释。代码应该是一个完整的函数体，使用api对象。如果涉及数据流，请使用端口 API 而非 sendMessage。`;


  // 引擎能力文档（L1记忆，每次请求必注入）
  const ENGINE_CAPABILITIES = {
    version: "4.0",
    apiMethods: [
      "api.on(event, callback)", "api.once(event, callback)", "api.off(event, callback)",
      "api.emit(eventName, data)", "api.setProperty(key, value)", "api.getProperty(key)",
      "api.setTriggerMode(mode, config)", "api.animate(prop, target, duration, easing)",
      "api.sendMessage(targetId, data)", "api.queryCells(filter)", "api.log(message)",
      "api.defineInput(portName, type)", "api.defineOutput(portName, type)",
      "api.connectPorts(fromCellId, fromPort, toCellId, toPort)",
      "api.sendPortData(portName, value)", "api.getPortValue(direction, portName)",
      "api.disconnectPort(wireId)"
    ],
    events: ["onUpdate", "onClick", "onCollision", "onWake", "onMessage", "onDestroy", "portChange"],
    portTypes: ["any", "number", "string", "boolean"],
    triggerModes: ["continuous", "event", "pulse", "dormant"],
    shapes: ["circle", "rect", "triangle", "polygon", "sprite"],
    kinds: ["creature", "plant", "item", "building", "terrain", "effect", "static", "ui", "trigger", "empty"]
  };

  function init(sandbox, cellCore, persistLayer) {
    _sandbox = sandbox;
    _cellCore = cellCore;
    _persistLayer = persistLayer;

    // 加载保存的提供者配置
    _loadProviders();

    console.log('[AiBridge] 初始化完成');
  }

  // ===== 提供者管理 =====
  async function _loadProviders() {
    if (_persistLayer) {
      const saved = await _persistLayer.loadSetting('ai_providers');
      if (saved) {
        _providers = saved;
      } else {
        _providers = [..._defaultProviders];
      }
      // 加载API Keys
      for (const provider of _providers) {
        if (_persistLayer) {
          const key = await _persistLayer.loadApiKey(provider.id);
          if (key) provider.apiKey = key;
        }
      }
    } else {
      _providers = [..._defaultProviders];
    }
  }

  async function _saveProviders() {
    if (_persistLayer) {
      await _persistLayer.saveSetting('ai_providers', _providers);
      for (const provider of _providers) {
        if (provider.apiKey) {
          await _persistLayer.saveApiKey(provider.id, provider.apiKey);
        }
      }
    }
  }

  function getProviders() {
    return _providers.map(p => ({ ...p, apiKey: p.apiKey ? '••••••' : '' }));
  }

  function getProvidersFull() {
    return _providers;
  }

  async function addProvider(provider) {
    provider.id = 'provider_' + Date.now().toString(36);
    provider.totalRequests = 0;
    provider.totalErrors = 0;
    provider.avgResponseTime = 0;
    _providers.push(provider);
    await _saveProviders();
    return provider;
  }

  async function updateProvider(providerId, updates) {
    const idx = _providers.findIndex(p => p.id === providerId);
    if (idx === -1) return null;
    Object.assign(_providers[idx], updates);
    await _saveProviders();
    return _providers[idx];
  }

  async function removeProvider(providerId) {
    _providers = _providers.filter(p => p.id !== providerId);
    await _saveProviders();
  }

  // ===== 任务难度评估 =====
  function _assessDifficulty(description) {
    const keywords = {
      simple: ['移动', '变色', '旋转', '缩放', '显示', '隐藏', '点击', '删除'],
      medium: ['碰撞', '跟随', '巡逻', '攻击', '动画', '计时', '计数', '消息'],
      complex: ['AI', '寻路', '生成', '复制', '组合', '状态机', '对话', '商店', '背包',
                '外观', '逼真', '好看', '漂亮', '卡通', '手绘', '植物', '草', '花', '树',
                '复杂', '高级', '精致']
    };

    let score = 0;
    for (const kw of keywords.simple) {
      if (description.includes(kw)) score += 1;
    }
    for (const kw of keywords.medium) {
      if (description.includes(kw)) score += 2;
    }
    for (const kw of keywords.complex) {
      if (description.includes(kw)) score += 3;
    }

    if (score <= 2) return 'simple';
    if (score <= 5) return 'medium';
    return 'complex';
  }

  // ===== 任务分类（chat / code / query / plan） =====
  function _classifyTask(text) {
    const t = (text || '').toLowerCase();

    // 明确要求生成代码 / ai 前缀
    if (/^(ai|生成代码|代码|code|生成行为)/.test(t)) {
      return { taskType: 'code', difficulty: 'complex' };
    }
    if (/生成.*代码|编写.*代码|让.*(做|行为|动起来)|变成.*(生物|动物|植物|触发器)/.test(t)) {
      return { taskType: 'code', difficulty: 'complex' };
    }

    // 世界状态查询类（回答信息即可）
    if (/(有多少|有几个|现在|当前|查询|列出|查看|统计|列表|什么|哪些|哪个|状态|时间|季节|几点|日期)/.test(t)) {
      return { taskType: 'query', difficulty: 'simple' };
    }

    // 对话/闲聊（简单 chat）
    if (/(你好|hi|hello|你是|你叫|谢谢|抱歉|早上好|晚上好|你能|介绍)/.test(t)) {
      return { taskType: 'chat', difficulty: 'simple' };
    }

    // 需要创建/修改/删除 —— 走工具调用
    if (/(创建|生成|添加|新建|造|放|删|移除|清空|修改|更新|设置|启动|停止|加速|减慢|改变|移动)/.test(t)) {
      return { taskType: 'plan', difficulty: 'medium' };
    }

    // 默认 chat（兜底：让大模型自己决定是否要调用工具）
    return { taskType: 'chat', difficulty: 'simple' };
  }

  // ===== 候选提供者排序（支持 taskType + difficulty 二维） =====
  // 返回按"合适程度"从高到低排序的数组；每个元素均为 enabled + 有 apiKey
  // 智能路由算法：
  //   1. 按 preferredFor 匹配度优先（匹配此 taskType 的放前面）
  //   2. 按动态响应时间 + 错误率加权排序（响应时间越短、错误率越低越好）
  //   3. 对简单任务：响应时间权重更高，追求快
  //   4. 对复杂任务：错误率权重更高，追求稳
  //   5. 对还没有足够统计数据的 provider，放在队列中间位置（先试用）
  function _rankProviders(difficulty, taskType) {
    const tt = taskType || 'chat';
    const enabled = _providers.filter(p => p.enabled && p.apiKey);
    if (enabled.length === 0) return [];

    // 响应时间/错误率加权公式
    // score = avgResponseTime (ms) + errRate * ERROR_PENALTY_MS + priority * 100
    // 未知 avgResponseTime 给一个"中等"初始值 2000ms（太高会被压底）
    function score(p) {
      const hasStat = (p.totalRequests || 0) >= MIN_SAMPLES_BEFORE_RANKING;
      let rtScore = hasStat && p.avgResponseTime > 0 ? p.avgResponseTime : 2000;
      // 对简单任务：放大响应时间的影响（慢的被压得更靠后
      if (difficulty === 'simple') rtScore = rtScore * 1.4;
      const total = (p.totalRequests || 0) + (p.totalErrors || 0);
      const errRate = total > 0 ? (p.totalErrors || 0) / total : 0;
      // 对复杂任务：放大错误率的影响（宁可慢一点也不要失败
      const errWeight = (difficulty === 'complex') ? ERROR_PENALTY_MS * 1.6 : ERROR_PENALTY_MS;
      const pri = typeof p.priority === 'number' ? p.priority : 99;
      return rtScore + errRate * errWeight + pri * 100;
    }

    // 分组：1) preferredFor 包含此 taskType 的；2) 其他（没设置 preferredFor 或不匹配）
    const preferred = enabled.filter(p =>
      Array.isArray(p.preferredFor) && p.preferredFor.indexOf(tt) !== -1
    );
    const others = enabled.filter(p =>
      !Array.isArray(p.preferredFor) || p.preferredFor.indexOf(tt) === -1
    );

    preferred.sort((a, b) => score(a) - score(b));
    others.sort((a, b) => score(a) - score(b));

    return preferred.concat(others);
  }

  // ===== 单提供者路由（兼容旧调用） =====
  function _routeProvider(difficulty, taskType) {
    const ranked = _rankProviders(difficulty, taskType);
    return ranked.length > 0 ? ranked[0] : null;
  }

  // ===== 对话（多轮 messages；自动故障转移 + 超时回退）=====
  // options: { taskType, maxTokens, temperature, timeoutMs }
  async function chat(messages, options) {
    const opts = options || {};
    const taskType = opts.taskType || 'chat';
    const difficulty = taskType === 'code' || taskType === 'plan' ? 'complex' : 'simple';
    const ranked = _rankProviders(difficulty, taskType);

    if (ranked.length === 0) {
      throw new Error('没有可用的 AI 提供者。请先在属性面板中启用至少一个模型并填入 API Key。');
    }

    const mergedOpts = {
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      timeoutMs: typeof opts.timeoutMs === 'number' ? opts.timeoutMs
        : (difficulty === 'simple' ? FAST_TASK_TIMEOUT_MS : DEFAULT_TIMEOUT_MS)
    };

    let lastError = null;
    for (let i = 0; i < ranked.length; i++) {
      const provider = ranked[i];
      try {
        const text = (provider.type === 'ollama'
          ? await _sendOllamaMessages(provider, messages, mergedOpts)
          : await _sendOpenAIMessages(provider, messages, mergedOpts));
        if (ranked.length > 1 && i > 0) {
          console.info('[AiBridge] 对话从', ranked[0] && ranked[0].name, '回退至', provider.name);
        }
        return text;
      } catch (err) {
        lastError = err;
        provider.totalErrors = (provider.totalErrors || 0) + 1;
        console.warn('[AiBridge]', provider.name + '(' + provider.model + ') 对话失败：', err.message || err);
        continue;
      }
    }
    throw lastError || new Error('所有 AI 提供者对话均失败。');
  }

  // ===== 单次问答（systemPrompt + user text） =====
  async function chatText(systemPrompt, userText, options) {
    const msgs = [];
    if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt });
    msgs.push({ role: 'user', content: userText });
    return chat(msgs, options);
  }

  // ===== 发送通用 chat 请求（messages 数组）=====
  // 单个 provider，不做回退（由上层 chat() 负责回退）
  async function _sendChatRequest(provider, messages, opts) {
    const startTime = performance.now();
    let text;
    if (provider.type === 'ollama') {
      text = await _sendOllamaMessages(provider, messages, opts);
    } else {
      text = await _sendOpenAIMessages(provider, messages, opts);
    }
    provider.totalRequests = (provider.totalRequests || 0) + 1;
    const rt = performance.now() - startTime;
    provider.avgResponseTime = provider.avgResponseTime === 0
      ? rt
      : (provider.avgResponseTime * 0.8 + rt * 0.2);
    return text;
  }

  // ===== 测速工具：逐个 ping 已启用的 providers =====
  // 返回 [{ id, name, model, status, responseTimeMs, error }]
  async function benchmarkProviders(options) {
    const opts = options || {};
    const enabled = _providers.filter(p => p.enabled && p.apiKey);
    const results = [];
    const probePrompt = '请回答仅一个字："好"。';
    const probeMsg = [
      { role: 'system', content: '你是一个简单的测试助手。' },
      { role: 'user', content: probePrompt }
    ];

    // 并行发送（但控制并发数为 2）
    let idx = 0;
    while (idx < enabled.length) {
      const batch = enabled.slice(idx, idx + 2);
      idx += 2;
      const promises = batch.map(async (provider) => {
        const start = performance.now();
        try {
          const text = provider.type === 'ollama'
            ? await _sendOllamaMessages(provider, probeMsg, { maxTokens: 30 })
            : await _sendOpenAIMessages(provider, probeMsg, { maxTokens: 30 });
          const rt = performance.now() - start;
          provider.totalRequests = (provider.totalRequests || 0) + 1;
          provider.avgResponseTime = provider.avgResponseTime === 0
            ? rt
            : (provider.avgResponseTime * 0.8 + rt * 0.2);
          results.push({
            id: provider.id,
            name: provider.name,
            model: provider.model,
            status: 'ok',
            responseTimeMs: Math.round(rt),
            preview: (text || '').substring(0, 40)
          });
        } catch (err) {
          provider.totalErrors = (provider.totalErrors || 0) + 1;
          results.push({
            id: provider.id,
            name: provider.name,
            model: provider.model,
            status: 'error',
            responseTimeMs: Math.round(performance.now() - start),
            error: err.message || String(err)
          });
        }
      });
      await Promise.all(promises);
    }

    results.sort((a, b) => a.responseTimeMs - b.responseTimeMs);
    return results;
  }

  // ===== 列出模型排名（用于诊断/展示）=====
  function rankProvidersForDebug(difficulty, taskType) {
    const ranked = _rankProviders(difficulty, taskType);
    return ranked.map(p => ({
      id: p.id,
      name: p.name,
      model: p.model,
      avgResponseTime: Math.round(p.avgResponseTime || 0),
      totalRequests: p.totalRequests || 0,
      totalErrors: p.totalErrors || 0,
      preferredFor: p.preferredFor || [],
      priority: p.priority
    }));
  }

  // ===== 带超时的 fetch 辅助函数 =====
  function _fetchWithTimeout(provider, messages, opts) {
    const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
    let body;
    let headers;
    if (provider.type === 'ollama') {
      headers = { 'Content-Type': 'application/json' };
      body = JSON.stringify({
        model: provider.model,
        messages: messages,
        stream: false,
        options: { num_predict: typeof opts.maxTokens === 'number' ? opts.maxTokens : 1500, temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.6 }
      });
    } else {
      headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + provider.apiKey };
      body = JSON.stringify({
        model: provider.model,
        messages: messages,
        temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.6,
        max_tokens: typeof opts.maxTokens === 'number' ? opts.maxTokens : 1500,
        stream: false
      });
    }

    // AbortController 做超时控制（不支持时回退到无超时
    let controller = null;
    let signal = undefined;
    try {
      controller = new AbortController();
      signal = controller.signal;
    } catch (e) { /* 旧浏览器不支持，忽略 */ }

    const reqOpts = {
      method: 'POST',
      headers: headers,
      body: body
    };
    if (controller) reqOpts.signal = signal;

    const timerId = controller ? setTimeout(() => { controller.abort(); }, timeoutMs) : null;

    return fetch(provider.endpoint, reqOpts).then(async (res) => {
      if (timerId) clearTimeout(timerId);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error('模型 ' + provider.name + '(' + provider.model + ') 请求失败 (' + res.status + '): ' + errText);
      }
      return res.json();
    }).catch((err) => {
      if (timerId) clearTimeout(timerId);
      if (err && (err.name === 'AbortError' || String(err.message).indexOf('aborted') >= 0 || String(err.message).indexOf('timed out') >= 0)) {
        throw new Error('模型 ' + provider.name + '(' + provider.model + ') 调用超时（> ' + (timeoutMs / 1000).toFixed(1) + 's），已自动跳过');
      }
      throw err;
    });
  }

  // ===== OpenAI 兼容接口：messages =====
  async function _sendOpenAIMessages(provider, messages, opts) {
    const data = await _fetchWithTimeout(provider, messages, opts || {});
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return typeof content === 'string' ? content : '';
  }

  // ===== Ollama 接口：messages =====
  async function _sendOllamaMessages(provider, messages, opts) {
    const data = await _fetchWithTimeout(provider, messages, opts || {});
    return (data.message && data.message.content) || (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  }

  // ===== 生成代码 =====
  async function generateCode(cellId, description) {
    if (_requestQueue.length >= MAX_QUEUE_LENGTH) {
      throw new Error('请求队列已满，请稍后再试');
    }
    const cell = _cellCore.getCell(cellId);
    if (!cell) throw new Error('基圆不存在');

    const difficulty = _assessDifficulty(description);
    const ranked = _rankProviders(difficulty, 'code');
    if (ranked.length === 0) throw new Error('没有可用的AI提供者，请先配置API Key');

    const prompt = _buildPrompt(cell, description);

    return new Promise((resolve, reject) => {
      _requestQueue.push({
        cellId,
        rankedProviders: ranked,     // 候选列表（用于回退）
        currentIndex: 0,              // 当前尝试到第几个
        prompt,
        difficulty,
        resolve,
        reject
      });
      _processQueue();
    });
  }

  // ===== 确认并加载代码 =====
  function confirmAndLoadCode(cellId, code, propertyUpdates) {
    const cell = _cellCore.getCell(cellId);
    if (!cell) return false;

    // 应用属性更新
    if (propertyUpdates && Object.keys(propertyUpdates).length > 0) {
      const updates = {};
      if (propertyUpdates.name) updates.name = propertyUpdates.name;
      if (propertyUpdates.radius) updates.radius = propertyUpdates.radius;
      if (propertyUpdates.color) updates.color = propertyUpdates.color;
      if (propertyUpdates.shape) updates.shape = propertyUpdates.shape;
      if (Object.keys(updates).length > 0) {
        _cellCore.updateCell(cellId, updates);
      }
      // 设置触发模式
      if (propertyUpdates.triggerMode) {
        const mode = propertyUpdates.triggerMode;
        _cellCore.setTriggerMode(cellId, mode, { threshold: mode === 'pulse' ? 6 : 30 });
      }
    }

    // ===== 关键修复：从代码中检测触发模式并提前设置 =====
    // 因为代码加载时需要知道使用哪个Worker，所以必须在加载前设置好触发模式
    const modeMatch = code.match(/api\.setTriggerMode\(['"](continuous|event|pulse)['"]\)/);
    if (modeMatch) {
      const detectedMode = modeMatch[1];
      _cellCore.setTriggerMode(cellId, detectedMode, { threshold: detectedMode === 'pulse' ? 6 : 30 });
    }

    // 先从沙箱卸载旧代码（防止模式切换时旧Worker残留）
    _sandbox.unloadBehaviorCode(cellId);

    // 更新基圆的行为代码
    _cellCore.updateCell(cellId, { code: code });

    // 确定触发模式（根据代码内容）
    let mode = cell.triggerConfig.mode;
    
    // 如果代码中显式调用了 setTriggerMode，则尊重代码设置，跳过自动检测
    const hasExplicitMode = code.includes("api.setTriggerMode('") || code.includes('api.setTriggerMode("');
    
    if (!hasExplicitMode && (code.includes("api.on('onUpdate'") || code.includes("api.on('onUpdate',"))) {
      // 如果代码监听onUpdate且没有显式设置模式，根据需要设置触发模式
      if (mode === 'event') {
        mode = 'pulse';
        _cellCore.setTriggerMode(cellId, 'pulse', { threshold: 6, eventMask: ['onUpdate'] });
      } else {
        // 更新eventMask（防御性处理undefined情况）
        const existingMask = cell.triggerConfig.eventMask || [];
        if (!existingMask.includes('onUpdate')) {
          _cellCore.setTriggerMode(cellId, mode, { eventMask: [...existingMask, 'onUpdate'] });
        }
      }
    }

    // 加载到沙箱
    _sandbox.loadBehaviorCode(cellId, code, mode);

    return true;
  }

  function _buildPrompt(cell, description) {
    // 获取周围基圆信息（含代码摘要）
    const nearbyCells = _cellCore.queryCells({
      near: { x: cell.x, y: cell.y, radius: 300 }
    }).filter(c => c.id !== cell.id).slice(0, 5);

    const contextInfo = nearbyCells.map(c => {
      const codeSummary = typeof c.code === 'string' && c.code
        ? ` [代码: ${c.code.substring(0, 60).replace(/\n/g, ' ')}${c.code.length > 60 ? '...' : ''}]`
        : '';
      return `- ${c.name}(${c.kind}) 位于(${c.x.toFixed(0)}, ${c.y.toFixed(0)})${codeSummary}`;
    }).join('\n');

    // 评估难度
    const difficulty = _assessDifficulty(description);

    // 从AiMemory获取分层记忆上下文
    const memoryContext = (typeof AiMemory !== 'undefined')
      ? AiMemory.buildMemoryContext(difficulty)
      : JSON.stringify(ENGINE_CAPABILITIES);

    // 当前基圆已有代码（增量修改上下文）
    const existingCodeSection = typeof cell.code === 'string' && cell.code
      ? `\n当前基圆已有代码（请在此基础上修改或扩展，而非重写）：\n\`\`\`javascript\n${cell.code}\n\`\`\``
      : '';

    const cellInfo =
`=== 属性自动设置规则 ===
请根据描述分析并建议属性更新。输出格式：
1. 先输出代码
2. 代码后面用以下格式输出属性建议（如果没有需要更新的可以不写）：

---属性更新---
name: [建议的名称]
triggerMode: [continuous|pulse|event|dormant]
radius: [建议的半径数字]
color: [建议的颜色如 #32CD32]
shape: [建议的形状如 circle|square|star|heart|diamond]
---属性更新结束---

当前基圆信息：
- ID: ${cell.id}
- 种类: ${cell.kind}
- 名称: ${cell.name}
- 位置: (${cell.x.toFixed(0)}, ${cell.y.toFixed(0)})
- 半径: ${cell.radius}
- 形状: ${cell.shape || 'circle'}
- 旋转: ${cell.rotation.toFixed(2)}
- 透明度: ${cell.opacity}
- 层级: ${cell.zIndex}
- 当前触发模式: ${cell.triggerConfig.mode}
- 触发阈值: ${cell.triggerConfig.threshold}
- 扩展属性: ${JSON.stringify(cell.attributes)}
- 标签: ${(cell.tags && cell.tags.join) ? cell.tags.join(', ') : '无'}${existingCodeSection}

周围基圆：
${contextInfo || '无'}`;

    // 返回 messages 数组：system 部分（模型角色 + API说明）和 user 部分（上下文 + 用户请求）
    // 这种结构对现代大模型更稳定，能减少"解释性废话"输出。
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${memoryContext}\n\n${cellInfo}\n\n用户描述：${description}\n\n请生成行为代码。`
      }
    ];
  }

  // ===== 处理请求队列（支持多模型回退）=====
  async function _processQueue() {
    if (_isProcessing || _requestQueue.length === 0) return;
    _isProcessing = true;

    while (_requestQueue.length > 0) {
      const request = _requestQueue.shift();
      const ranked = request.rankedProviders && request.rankedProviders.length
        ? request.rankedProviders
        : [request.provider].filter(Boolean);
      let lastError = null;
      let succeeded = false;
      let resultCode = null;

      // 遍历候选列表（从第 currentIndex 个开始）
      const start = typeof request.currentIndex === 'number' ? request.currentIndex : 0;
      for (let i = start; i < ranked.length; i++) {
        const provider = ranked[i];
        try {
          const now2 = Date.now();
          const elapsed = now2 - _lastRequestTime;
          if (elapsed < MIN_REQUEST_INTERVAL) {
            await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - elapsed));
          }
          const code = await _sendRequest(provider, request.prompt);
          _lastRequestTime = Date.now();
          provider.totalRequests = (provider.totalRequests || 0) + 1;
          resultCode = code;
          succeeded = true;
          if (i > 0) {
            console.info('[AiBridge] 代码生成从', ranked[0] && ranked[0].name, '回退至', provider.name);
          }
          break;
        } catch (err) {
          lastError = err;
          provider.totalErrors = (provider.totalErrors || 0) + 1;
          console.warn('[AiBridge]', provider.name + '(' + provider.model + ') 代码生成失败：', err.message || err);
          continue;
        }
      }

      if (succeeded) {
        request.resolve(resultCode);
      } else {
        request.reject(lastError || new Error('所有 AI 提供者代码生成都失败。'));
      }
    }

    _isProcessing = false;
  }

  // ===== 发送请求（内部走 messages 路径，统一调用链）=====
  async function _sendRequest(provider, messages) {
    const startTime = performance.now();
    let response;
    if (provider.type === 'ollama') {
      response = await _sendOllamaMessages(provider, messages, {});
    } else {
      response = await _sendOpenAIMessages(provider, messages, {});
    }
    const responseTime = performance.now() - startTime;
    provider.totalRequests = (provider.totalRequests || 0) + 1;
    provider.avgResponseTime = provider.avgResponseTime === 0
      ? responseTime
      : (provider.avgResponseTime * 0.8 + responseTime * 0.2);
    provider.lastResponseTimeMs = responseTime;
    return _extractCode(response);
  }

  // ===== 旧的单 provider fallback（保留兼容，实际已不用）=====
  function _findFallbackProvider(excludeProvider, difficulty) {
    const enabled = _providers.filter(p =>
      p.enabled && p.apiKey && p.id !== excludeProvider.id
    );
    if (enabled.length === 0) return null;
    enabled.sort((a, b) => (a.priority || 99) - (b.priority || 99));
    return enabled[0];
  }

  // ===== 从AI响应中提取代码 =====
  function _extractCode(response) {
    if (typeof response !== 'string') return { code: '', propertyUpdates: {} };

    // 提取属性更新建议
    let propertyUpdates = {};
    const propMatch = response.match(/---属性更新---\s*([\s\S]*?)---属性更新结束---/);
    if (propMatch) {
      const propLines = propMatch[1].split(/\r?\n/);
      for (const line of propLines) {
        if (!line.trim()) continue;
        const idx = line.indexOf(':');
        if (idx <= 0) continue;
        const k = line.substring(0, idx).trim();
        const v = line.substring(idx + 1).trim().replace(/^['"\[]|['"\]]$/g, '');
        if (!v || /^\[.*\]$/.test(v)) continue; // 跳过"[建议的名称]"这类占位
        if (k === 'triggerMode') propertyUpdates.triggerMode = v;
        else if (k === 'radius') propertyUpdates.radius = parseFloat(v) || 30;
        else if (k === 'color') propertyUpdates.color = v;
        else if (k === 'shape') propertyUpdates.shape = v;
        else if (k === 'name') propertyUpdates.name = v;
      }
    }

    // 去除属性更新部分，避免干扰代码提取
    const responseWithoutProps = response.replace(/---属性更新---[\s\S]*?---属性更新结束---/g, '');

    // 1) 首先尝试找到"代码块"（```javascript ... ``` 或 ``` ... ```）
    //    如果存在多个代码块，把它们拼成一份代码（LLM偶尔会分成2块）
    const codeBlocks = [];
    const blockRe = /```(?:javascript|js)?\s*\r?\n?([\s\S]*?)```/gi;
    let m;
    while ((m = blockRe.exec(responseWithoutProps)) !== null) {
      if (m[1] && m[1].trim()) codeBlocks.push(m[1].trim());
    }
    if (codeBlocks.length > 0) {
      // 取含有 api. 调用的那个（若多个都有，拼接）
      const withApi = codeBlocks.filter(c => c.indexOf('api.') !== -1);
      const finalCode = (withApi.length > 0 ? withApi : [codeBlocks[0]]).join('\n\n// ---\n\n');
      return { code: finalCode, propertyUpdates };
    }

    // 2) 没有代码块标记 → 找第一行包含 api. 的内容
    const lines = responseWithoutProps.split(/\r?\n/);
    const startIdx = lines.findIndex(l => l.indexOf('api.') !== -1);
    if (startIdx !== -1) {
      // 从 startIdx 开始到文件末尾或到第一行"明显中文句子"为止
      const outLines = [];
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        if (/^[\u4e00-\u9fa5][\u4e00-\u9fa5，。？！：；、\s]*$/.test(line.trim())) break; // 整行纯中文：停止
        if (/^[>\-\s]*[（(请注你好这里以下上面的注意)/]/.test(line.trim())) break; // 中文说明开头的行
        outLines.push(line);
      }
      if (outLines.length > 0) {
        return { code: outLines.join('\n').trim(), propertyUpdates };
      }
    }

    // 3) 还是没有 → 尝试找出整段文本中以 function/var/const/api 开头的那一段
    const alt = responseWithoutProps
      .split(/\r?\n\r?\n/)
      .find(seg => seg.indexOf('api.') !== -1);
    if (alt) return { code: alt.trim(), propertyUpdates };

    // 4) 最后兜底：整个响应（可能模型返回的就是代码本身）
    const trimmed = responseWithoutProps.trim();
    if (trimmed.length > 0 && trimmed.length < 8000) {
      return { code: trimmed, propertyUpdates };
    }

    throw new Error('AI响应中未找到有效代码，请重试（提示：尝试更具体的功能描述）');
  }

  // ===== 模型预设（供 UI 一键添加） =====
  function getProviderPresets() {
    return DEFAULT_PROVIDER_PRESETS.map(function (p) {
      return {
        name: p.name,
        type: p.type,
        endpoint: p.endpoint,
        model: p.model,
        preferredFor: p.preferredFor
      };
    });
  }

  // ===== 当前 AI 提供者状态摘要 =====
  function getProviderStats() {
    return _providers.map(function (p) {
      return {
        id: p.id,
        name: p.name,
        model: p.model,
        enabled: !!p.enabled,
        hasKey: !!p.apiKey,
        totalRequests: p.totalRequests || 0,
        totalErrors: p.totalErrors || 0,
        avgResponseTime: p.avgResponseTime || 0,
        preferredFor: p.preferredFor || []
      };
    });
  }

  return {
    init,
    getProviders, getProvidersFull,
    getProviderPresets, getProviderStats,
    addProvider, updateProvider, removeProvider,
    generateCode, confirmAndLoadCode,
    chat, chatText, benchmarkProviders,
    rankProvidersForDebug,
    classifyTask: _classifyTask,
    _saveProviders
  };
})();

// 暴露到全局
window.AiBridge = AiBridge;
