/**
 * 开发者控制台 (DevConsole.js) — v2.0
 * 基圆引擎的命令行控制模块。支持：
 *   • 对话框拖动（点击 header 区可拖拽）
 *   • 动态读取物种注册表 (SpeciesRegistry)，回答「有多少种植物/蚂蚁/昆虫」等
 *   • 动态读取地图预设 (Map Presets)，回答「预设了几个地图」
 *   • 项目目录 & 源码文件读取（通过 fetch() 读取本地文件）
 *   • 完整运行状态监控：FPS / 基圆数 / 游戏时间 / AI 状态
 *   • 自然语言命令解析 + AI 辅助
 *
 * 使用方式:
 *   1. 点击右上角「💬 控制台」按钮，或按 Ctrl+`
 *   2. 输入命令: 地图 / 蚂蚁 / 植物 / 昆虫 / 状态 / 目录 / 读文件 species.js
 */

const DevConsole = (() => {
  let _cellCore = null;
  let _sandbox = null;
  let _aiBridge = null;
  let _isOpen = false;
  let _currentCellId = null;
  let _chatHistory = [];
  let _commandHistory = [];
  let _commandHistoryIndex = -1;
  let _initialized = false;
  let _timeLoopRunning = false;
  let _timeSpeed = 1.0;

  // ===== 游戏时间系统 =====
  const TIME_CONFIG = {
    msPerGameHour: 5000,
    hoursPerDay: 24,
    daysPerSeason: 30,
    seasonsPerYear: 4
  };

  let _gameTime = {
    totalMs: 0,
    year: 1,
    season: 0,
    day: 1,
    hour: 6,
    minute: 0,
    seasonName: '春',
    isDaytime: true
  };

  const SEASONS = [
    { name: '春', emoji: '🌸', color: '#90EE90', dayStart: 6, nightStart: 19 },
    { name: '夏', emoji: '☀️', color: '#FFD700', dayStart: 5, nightStart: 20 },
    { name: '秋', emoji: '🍂', color: '#FF8C00', dayStart: 6, nightStart: 18 },
    { name: '冬', emoji: '❄️', color: '#87CEEB', dayStart: 7, nightStart: 17 }
  ];

  // 内部植物小表（仅用于「快速创建植物/生物」命令；真实世界查询始终走 SpeciesRegistry）
  const QUICK_PLANT_DEFS = [
    { name: '青草', color: '#90EE90', radius: 18, energy: 50, shape: 'circle' },
    { name: '玫瑰', color: '#FF69B4', radius: 22, energy: 80, shape: 'circle' },
    { name: '向日葵', color: '#FFD700', radius: 28, energy: 120, shape: 'circle' },
    { name: '蘑菇', color: '#8B4513', radius: 20, energy: 60, shape: 'circle' },
    { name: '仙人掌', color: '#228B22', radius: 25, energy: 40, shape: 'rect' }
  ];
  const QUICK_RABBIT_DEFS = [
    { name: '小白兔', color: '#FFFFFF', speed: 2.0, hp: 100, radius: 18 },
    { name: '灰兔', color: '#808080', speed: 2.5, hp: 80, radius: 16 }
  ];

  // ===== 初始化 =====
  function init(cellCore, sandbox, aiBridge) {
    if (_initialized) return;
    _cellCore = cellCore;
    _sandbox = sandbox;
    _aiBridge = aiBridge || window.AiBridge || null;

    _buildUI();
    _bindEvents();
    _startTimeLoop();

    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.key === '~' || e.key === '\\')) {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && _isOpen) close();
    });

    console.log('[DevConsole] v2.0 初始化完成. 快捷键 Ctrl+`');
    _initialized = true;
  }

  function _startTimeLoop() {
    if (_timeLoopRunning) return;
    _timeLoopRunning = true;
    let lastTime = performance.now();
    function loop(currentTime) {
      if (!_timeLoopRunning) return;
      const dt = (currentTime - lastTime) * _timeSpeed;
      lastTime = currentTime;
      _updateGameTime(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // ===== UI 构建 =====
  function _buildUI() {
    if (document.getElementById('devConsole')) return;

    const html = `
    <div id="devConsole" class="dev-console hidden">
      <div class="dev-console-header" id="devConsoleHeader" title="拖动标题栏可移动对话框">
        <div class="dev-console-title">
          <span class="dev-console-icon">💬</span>
          <span>开发者控制台 <span class="dev-console-subtitle" style="font-size:11px;color:#888;">(拖动标题栏可移动位置)</span></span>
        </div>
        <button class="dev-console-close" id="devConsoleClose" title="关闭">&times;</button>
      </div>
      <div class="dev-console-body" id="devConsoleBody"></div>
      <div class="dev-console-commands" id="devConsoleCommands"></div>
      <div class="dev-console-input-area">
        <input type="text" id="devConsoleInput" placeholder="输入命令: 地图 / 蚂蚁 / 植物 / 昆虫 / 状态 / 目录 / 读文件 species.js / 帮助" />
        <button id="devConsoleSend" class="btn-primary">发送</button>
      </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  // ===== 事件绑定 + 拖拽 =====
  function _bindEvents() {
    const sendBtn = document.getElementById('devConsoleSend');
    const input = document.getElementById('devConsoleInput');
    const closeBtn = document.getElementById('devConsoleClose');

    sendBtn.addEventListener('click', () => _sendMessage());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _sendMessage();
      else if (e.key === 'ArrowUp') { e.preventDefault(); _cycleHistory(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); _cycleHistory(1); }
    });
    closeBtn.addEventListener('click', close);

    const consoleEl = document.getElementById('devConsole');
    consoleEl.addEventListener('click', (e) => {
      if (e.target === consoleEl) close();
    });

    // ===== 拖拽逻辑 =====
    const header = document.getElementById('devConsoleHeader');
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let dialogStartLeft = 0, dialogStartTop = 0;

    header.addEventListener('mousedown', (e) => {
      // 只响应左键，且不响应关闭按钮区域
      if (e.button !== 0) return;
      if (e.target.id === 'devConsoleClose') return;

      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = consoleEl.getBoundingClientRect();
      dialogStartLeft = rect.left;
      dialogStartTop = rect.top;

      // 切换到绝对坐标定位（忽略原 CSS 的 centering）
      consoleEl.style.left = dialogStartLeft + 'px';
      consoleEl.style.top = dialogStartTop + 'px';
      consoleEl.style.right = 'auto';
      consoleEl.style.bottom = 'auto';
      consoleEl.style.transform = 'none';
      consoleEl.style.cursor = 'grabbing';

      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      const newLeft = dialogStartLeft + dx;
      const newTop = dialogStartTop + dy;
      // 限制范围：避免完全跑出屏幕
      const maxLeft = window.innerWidth - 50;
      const maxTop = window.innerHeight - 50;
      const minLeft = -consoleEl.offsetWidth + 100;
      const minTop = -consoleEl.offsetHeight + 80;
      consoleEl.style.left = Math.max(minLeft, Math.min(maxLeft, newLeft)) + 'px';
      consoleEl.style.top = Math.max(minTop, Math.min(maxTop, newTop)) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        consoleEl.style.cursor = '';
      }
    });
  }

  function _cycleHistory(direction) {
    if (_commandHistory.length === 0) return;
    _commandHistoryIndex += direction;
    if (_commandHistoryIndex < 0) _commandHistoryIndex = 0;
    if (_commandHistoryIndex >= _commandHistory.length) _commandHistoryIndex = _commandHistory.length - 1;
    const input = document.getElementById('devConsoleInput');
    input.value = _commandHistory[_commandHistoryIndex];
  }

  // ===== 打开/关闭 =====
  function open(cellId) {
    if (!_initialized) init(window.CellCore, window.Sandbox, window.AiBridge);
    _isOpen = true;
    _currentCellId = cellId || null;
    const consoleEl = document.getElementById('devConsole');
    consoleEl.classList.remove('hidden');
    _renderCommands();

    if (!_chatHistory.length) {
      _addMessage('system', '👋 欢迎使用开发者控制台 v2.0！');
      _addMessage('system',
        '💡 你可以直接问：\n' +
        '   • 「地图」或「有几个地图预设」\n' +
        '   • 「蚂蚁」或「有多少种蚂蚁」\n' +
        '   • 「植物」或「有多少种植物」\n' +
        '   • 「昆虫」或「有多少种昆虫」\n' +
        '   • 「状态」「FPS」「性能」\n' +
        '   • 「目录」查看项目结构\n' +
        '   • 「读文件 species.js」读取指定源码\n' +
        '   • 「> 代码」执行 JS 代码\n' +
        '   • 「帮助」查看完整命令列表'
      );
    }
    document.getElementById('devConsoleInput').focus();
  }

  function close() {
    _isOpen = false;
    const consoleEl = document.getElementById('devConsole');
    consoleEl.classList.add('hidden');
  }

  function toggle(cellId) {
    if (_isOpen) close();
    else open(cellId);
  }

  // ===== 消息发送 =====
  function _sendMessage() {
    const input = document.getElementById('devConsoleInput');
    const text = input.value.trim();
    if (!text) return;

    _chatHistory.push({ role: 'user', text, time: new Date() });
    _commandHistory.push(text);
    _commandHistoryIndex = _commandHistory.length;
    _addMessage('user', text);
    input.value = '';

    // 同步执行 → 可能返回 Promise（AI 调用）
    setTimeout(async () => {
      const result = _executeCommand(text);
      if (result && typeof result.then === 'function') {
        try {
          const r = await result;
          _addMessage(r.type || 'info', r.text, r.data);
        } catch (err) {
          _addMessage('error', '执行失败: ' + (err.message || String(err)));
        }
      } else if (result) {
        _addMessage(result.type || 'system', result.text, result.data);
      }
    }, 80);
  }

  // ===== 渲染消息 =====
  function _addMessage(type, text, data) {
    const body = document.getElementById('devConsoleBody');
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let html = '';
    if (type === 'user') {
      html = `<div class="chat-msg user-msg"><div class="chat-bubble"><div class="chat-text">${_escapeHtml(text)}</div><div class="chat-time">${time}</div></div></div>`;
    } else if (type === 'error') {
      html = `<div class="chat-msg system-msg error-msg"><div class="chat-bubble"><div class="chat-text">❌ ${_escapeHtml(text)}</div><div class="chat-time">${time}</div></div></div>`;
    } else if (type === 'success') {
      html = `<div class="chat-msg system-msg success-msg"><div class="chat-bubble"><div class="chat-text">✅ ${_escapeHtml(text)}</div><div class="chat-time">${time}</div></div></div>`;
    } else if (type === 'info') {
      html = `<div class="chat-msg system-msg info-msg"><div class="chat-bubble"><div class="chat-text">ℹ️ ${_escapeHtml(text)}</div><div class="chat-time">${time}</div></div></div>`;
    } else {
      html = `<div class="chat-msg system-msg"><div class="chat-bubble"><div class="chat-text">${_escapeHtml(text)}</div><div class="chat-time">${time}</div></div></div>`;
    }
    if (data) {
      html += `<pre class="chat-data">${_escapeHtml(typeof data === 'string' ? data : JSON.stringify(data, null, 2))}</pre>`;
    }
    body.insertAdjacentHTML('beforeend', html);
    body.scrollTop = body.scrollHeight;
  }

  // ===== 快速命令按钮（v2.0 重写）=====
  function _renderCommands() {
    const container = document.getElementById('devConsoleCommands');
    const quickCommands = [
      { label: '🗺️ 地图预设', cmd: '地图预设' },
      { label: '🐜 蚂蚁物种', cmd: '有多少种蚂蚁' },
      { label: '🌱 植物物种', cmd: '有多少种植物' },
      { label: '🦗 昆虫物种', cmd: '有多少种昆虫' },
      { label: '📊 运行状态', cmd: '运行状态' },
      { label: '💾 手动保存', cmd: '保存' },
      { label: '⚙ AI设置', cmd: 'AI设置' },
      { label: '🔧 打开AI设置面板', cmd: '打开AI设置面板' },
      { label: '📁 项目目录', cmd: '目录' },
      { label: '❓ 帮助', cmd: '帮助' }
    ];

    let html = '<div class="quick-commands">';
    for (const qc of quickCommands) {
      html += `<button class="quick-cmd-btn" data-cmd="${_escapeHtml(qc.cmd)}">${qc.label}</button>`;
    }
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.quick-cmd-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('devConsoleInput');
        input.value = btn.dataset.cmd;
        _sendMessage();
      });
    });
  }

  // ===== 时间系统 =====
  function _updateGameTime(dt) {
    if (typeof dt !== 'number' || isNaN(dt) || dt < 0) return;
    _gameTime.totalMs = (_gameTime.totalMs || 0) + dt;
    const msPerDay = TIME_CONFIG.msPerGameHour * TIME_CONFIG.hoursPerDay;
    const msPerSeason = msPerDay * TIME_CONFIG.daysPerSeason;
    const msPerYear = msPerSeason * TIME_CONFIG.seasonsPerYear;
    _gameTime.year = Math.max(1, Math.floor(_gameTime.totalMs / msPerYear) + 1);
    const msInYear = _gameTime.totalMs % msPerYear;
    _gameTime.season = Math.max(0, Math.min(Math.floor(msInYear / msPerSeason), 3));
    const msInSeason = msInYear % msPerSeason;
    _gameTime.day = Math.floor(msInSeason / msPerDay) + 1;
    const msInDay = msInSeason % msPerDay;
    const totalGameMinutes = Math.floor(msInDay / TIME_CONFIG.msPerGameHour * 60);
    _gameTime.hour = Math.floor(totalGameMinutes / 60) % TIME_CONFIG.hoursPerDay;
    _gameTime.minute = totalGameMinutes % 60;
    _gameTime.seasonName = SEASONS[_gameTime.season].name;
    const s = SEASONS[_gameTime.season];
    _gameTime.isDaytime = _gameTime.hour >= s.dayStart && _gameTime.hour < s.nightStart;
  }

  function getGameTime() {
    const seasonIdx = Math.max(0, Math.min(_gameTime.season || 0, SEASONS.length - 1));
    const season = SEASONS[seasonIdx];
    return {
      year: _gameTime.year,
      season: seasonIdx,
      seasonName: _gameTime.seasonName || '春',
      day: _gameTime.day,
      hour: _gameTime.hour,
      minute: _gameTime.minute,
      isDaytime: _gameTime.isDaytime,
      seasonEmoji: season.emoji,
      seasonColor: season.color,
      totalMs: _gameTime.totalMs,
      timeString: _formatTimeString(),
      dateString: '第' + _gameTime.year + '年 ' + (_gameTime.seasonName || '春') + '季 第' + _gameTime.day + '日',
      periodString: _getPeriodString()
    };
  }
  function _formatTimeString() {
    const h = String(_gameTime.hour).padStart(2, '0');
    const m = String(_gameTime.minute).padStart(2, '0');
    return h + ':' + m;
  }
  function _getPeriodString() {
    const hour = _gameTime.hour;
    const season = SEASONS[_gameTime.season];
    if (!_gameTime.isDaytime) return '🌙 夜晚';
    if (hour >= 6 && hour < 9) return '🌅 清晨';
    if (hour >= 9 && hour < 12) return '☀️ 上午';
    if (hour >= 12 && hour < 14) return '🌞 中午';
    if (hour >= 14 && hour < 18) return '🌤️ 下午';
    if (hour >= 18 && hour < season.nightStart) return '🌇 傍晚';
    return '☀️ 白天';
  }
  function setTimeSpeed(speed) {
    _timeSpeed = Math.max(0, Math.min(10, speed));
    console.log('[DevConsole] 时间速度:', _timeSpeed + 'x');
    return true;
  }
  function getTimeSpeed() { return _timeSpeed; }
  function resetGameTime() {
    _gameTime.totalMs = 0; _gameTime.year = 1; _gameTime.season = 0;
    _gameTime.day = 1; _gameTime.hour = 6; _gameTime.minute = 0;
    _gameTime.seasonName = '春'; _gameTime.isDaytime = true;
  }

  // ===== 命令解析引擎 v2.0 =====
  // 优先级: 精确匹配 > 关键词匹配 > AI
  function _executeCommand(rawText) {
    const text = rawText.trim().toLowerCase();
    const normalized = _normalizeText(rawText);

    // ============== 1. 帮助 ==============
    if (/帮助|help|\?|？|命令|指南|怎么用/.test(text)) {
      return _showHelp();
    }

    // ============== 2. 建造地图场景（优先级高于普通"地图"查询）==============
    // 识别: "建一张沙漠地图"、"生成草原场景"、"切换到雨林"、"重建落叶林地图" 等
    if (/(^|[\s，。,、])(建|生成|创建|重建|切换|换|布置)(一张|一整个|整个|一个|新的)?[\s，。,、]*(沙漠|戈壁|草原|草地|落叶林|森林|雨林|热带雨林|落叶阔叶林|温带草原|地图|场景)(地图)?/.test(rawText) ||
        /(build|create|generate|switch to|rebuild)\s*(a\s*)?(desert|grassland|forest|rainforest|deciduous|map|scene)/i.test(rawText)) {
      return _buildMapScene(rawText);
    }

    // ============== 3. 地图 / 地图预设 ==============
    if (/(地图|map|预设|环境|群落|沙漠|戈壁|草地|草原|森林|阔叶林|雨林|雨林)/.test(text)) {
      return _showMapPresets(rawText);
    }

    // ============== 3. 创建类命令（必须在物种查询之前，否则"创建5个植物"会被误拦截）==============
    if (/(创建|生成|添加|新建|造)\s*[0-9零一二三四五六七八九十]*\s*个?\s*(植物|草|花|树)/.test(rawText)) {
      return _createPlants(rawText);
    }
    if (/(创建|生成|添加|新建|造)\s*[0-9零一二三四五六七八九十]*\s*只?\s*(兔|生物|creature)/.test(rawText)) {
      return _createRabbits(rawText);
    }
    if (/(创建|生成|添加|新建|create|make|build|new)\s*[0-9零一二三四五六七八九十]*\s*个?\s*(基圆|cell|circle)/.test(rawText)) {
      return _createEmptyCells(rawText);
    }

    // ============== 4. 删除类命令（必须在物种查询之前，否则"删除所有植物"被误拦截）==============
    if (/(删除|清空|移除|清理|清除|delete|remove|clean)/.test(text)) {
      return _deleteCells(rawText);
    }

    // ============== 5. 保存 / 持久化 ==============
    if (/(保存|存档|快照|save|snapshot|save snapshot|保存快照|保存世界|手动保存)/.test(text)) {
      return _saveSnapshot();
    }

    // ============== 6. AI 设置 / 提供者配置 ==============
    // - "打开AI设置面板" / "打开提供者配置" — 直接打开原生弹窗
    // - "AI设置" / "提供者" / "API Key" — 在控制台展示文字版配置
    if (/(打开|弹|开启|调出|show|open)\s*(ai|AI)?\s*(设置|配置|面板|提供者|provider|api键|api key|apikey)/.test(rawText)) {
      return _openProviderPanel();
    }
    if (/(ai设置|ai配置|提供者|api设置|api配置|模型设置|provider|api key|apikey)/.test(text)) {
      return _showAiProvidersConfig();
    }

    // ============== 7. 暂停 / 控制类命令 ==============
    if (/暂停|停止|pause|stop/.test(text)) {
      return _setTimeSpeed(rawText);
    }

    // ============== 6. 物种查询（排除"创建/删除"关键词，排除"蚁狮"等昆虫名称）==============
    if (!/(创建|生成|添加|新建|造|删除|清空|移除|清理|清除)/.test(text) &&
        !/(蚁狮|螳螂|瓢虫|蜜蜂|蝶蛾|胡蜂|昆虫|insect)/.test(text) &&
        /(蚂蚁|ant|蚁|蚁种|物种.*蚂蚁|蚂蚁.*物种)/.test(text)) {
      return _showSpeciesList('ant', rawText);
    }
    if (!/(创建|生成|添加|新建|造|删除|清空|移除|清理|清除)/.test(text) &&
        /(植物|草|花|树|plant|tree|物种.*植物|植物.*物种)/.test(text)) {
      return _showSpeciesList('plant', rawText);
    }
    if (!/(创建|生成|添加|新建|造|删除|清空|移除|清理|清除)/.test(text) &&
        /(昆虫|虫|insect|蚁狮|蜜蜂|瓢虫|螳螂|天敌|胡蜂|蝶蛾)/.test(text)) {
      return _showSpeciesList('insect', rawText);
    }

    // ============== 7. 运行状态 / FPS / 性能 ==============
    if (/(运行|状态|status|fps|性能|统计|监控)/.test(text)) {
      return _showRuntimeStatus();
    }

    // ============== 8. 项目目录 / 文件读取 ==============
    if (/(目录|dir|结构|ls|项目|文件树|有哪些文件)/.test(text)) {
      return _showProjectStructure();
    }

    // 读文件 / 查看文件
    if (/(读|读取|查看|打开|show|read|cat|open)\s*.*\.(js|css|html|md|json|txt|ts)/.test(text)) {
      return _readSourceFile(rawText);
    }
    if (/^(读|read)\s*[:：]?\s*/.test(text) || text.startsWith('读文件') || text.startsWith('读取') || text.startsWith('查看文件')) {
      return _readSourceFile(rawText);
    }

    // ============== 9. 列出 / 查询基圆 ==============
    if (/(列出|查看|统计|有什么|有多少|列表|ls|list)\s*[^文]/.test(text)) {
      return _listCells(rawText);
    }

    // ============== 10. AI 代码生成 ==============
    if (/^(ai|生成代码|代码|code)/.test(text) || rawText.startsWith('/ai')) {
      return _aiGenerate(rawText);
    }

    // ============== 11. AI 测速 ==============
    if (/(测试|测速|ping|benchmark|性能).*(ai|模型|大模型|provider|llm)|ai.*(测试|测速|ping|响应)/.test(text)) {
      return _benchmarkAI(rawText);
    }

    // ============== 12. 保存 ==============
    if (/保存|save/.test(text)) {
      return _saveGame(rawText);
    }

    // ============== 13. 时间相关 ==============
    if (/(时间|time|时钟|clock|日期|date|季节|season|昼夜|白天|黑夜)/.test(text)) {
      return _showGameTime(rawText);
    }

    // ============== 14. 速度命令 ==============
    if (/(速度|speed|快|慢|加速|减速|倍速|时间流速)/.test(text)) {
      return _setTimeSpeed(rawText);
    }

    // ============== 15. 清空对话 ==============
    if (/清空对话|清除对话|clear/.test(text)) {
      _chatHistory = [];
      const body = document.getElementById('devConsoleBody');
      if (body) body.innerHTML = '';
      return { type: 'info', text: '对话历史已清空' };
    }

    // ============== 16. 直接 JS 执行 ==============
    if (rawText.startsWith('>')) {
      return _runCode(rawText.substring(1).trim());
    }

    // ============== 17. 未能识别 → 尝试 AI 回答 ==============
    return _aiCommand(rawText);
  }

  // ===== 世界快照（提供给 AI）=====
  function _getWorldSnapshot() {
    const parts = [];
    try {
      if (_cellCore && typeof _cellCore.getAllCells === 'function') {
        const cells = _cellCore.getAllCells();
        parts.push('基圆总数: ' + cells.length);
        if (cells.length > 0) {
          const kinds = {};
          for (let i = 0; i < cells.length; i++) {
            const k = cells[i].kind || 'unknown';
            kinds[k] = (kinds[k] || 0) + 1;
          }
          const kNames = Object.keys(kinds);
          const kindParts = [];
          for (let i = 0; i < kNames.length; i++) kindParts.push(kNames[i] + ':' + kinds[kNames[i]]);
          parts.push('分类: ' + kindParts.join(', '));
        }
      }
    } catch (e) { /* ignore */ }

    try {
      const t = _gameTime;
      parts.push('游戏时间: 第' + t.year + '年 ' + (SEASONS[t.season] ? SEASONS[t.season].name : '') + ' 第' + t.day + '日 ' + t.hour + ':' + (t.minute < 10 ? '0' : '') + t.minute + ' 时间流速:x' + _timeSpeed);
    } catch (e) { /* ignore */ }

    try {
      const fpsEl = document.getElementById('fpsDisplay');
      if (fpsEl && fpsEl.textContent) parts.push('FPS: ' + fpsEl.textContent);
    } catch (e) { /* ignore */ }

    if (_currentCellId) {
      parts.push('当前选中基圆 ID: ' + _currentCellId);
      if (_cellCore && typeof _cellCore.getCell === 'function') {
        const c = _cellCore.getCell(_currentCellId);
        if (c) parts.push('选中基圆: kind=' + (c.kind || '') + ' radius=' + c.radius);
      }
    }

    // v2.0: 将物种注册表信息一并打入快照，让 AI 知道地图/物种总数
    try {
      const sr = window.SpeciesRegistry;
      if (sr) {
        const antCount = (typeof sr.getAllAnts === 'function') ? Object.keys(sr.getAllAnts()).length : 0;
        const plantCount = (typeof sr.getAllPlants === 'function') ? Object.keys(sr.getAllPlants()).length : 0;
        const insectCount = (typeof sr.getAllInsects === 'function') ? Object.keys(sr.getAllInsects()).length : 0;
        parts.push('物种注册表: 蚂蚁' + antCount + '种, 植物' + plantCount + '种, 昆虫' + insectCount + '种');
        if (typeof sr.getMapPresets === 'function') {
          parts.push('地图预设: ' + Object.keys(sr.getMapPresets()).length + '张');
        }
      }
    } catch (e) { /* ignore */ }

    return parts.join(' | ');
  }

  // ===== 打开 AI 提供者配置面板 =====
  function _openProviderPanel() {
    // 优先调用 Loader.showProviderConfig() 打开原生弹窗
    const loader = window.Loader;
    if (loader && typeof loader.showProviderConfig === 'function') {
      try {
        loader.showProviderConfig();
        return { type: 'success', text: '✅ 已打开 AI 设置面板。\n（关闭面板后点击控制台外部区域，控制台保持打开）' };
      } catch (err) {
        return { type: 'error', text: '❌ 打开面板时出错: ' + (err?.message || String(err)) };
      }
    }
    // 回退：直接操作 DOM 打开 providerConfig 面板
    const panel = document.getElementById('providerConfig');
    if (panel) {
      panel.classList.remove('hidden');
      return { type: 'success', text: '✅ 已打开 AI 设置面板。' };
    }
    return { type: 'info', text: '⚠ 未找到 AI 设置面板。请刷新页面重试。' };
  }

  // ===== 保存世界快照 =====
  function _saveSnapshot() {
    const pl = window.PersistLayer;
    const cc = window.CellCore;
    const rb = window.RenderBridge;
    if (!pl || typeof pl.saveFullSnapshot !== 'function') {
      return { type: 'error', text: 'PersistLayer 未初始化或不支持 saveFullSnapshot' };
    }
    try {
      pl.saveFullSnapshot(
        () => (cc && typeof cc.getAllCellDataForSave === 'function') ? cc.getAllCellDataForSave() : [],
        () => (rb && typeof rb.getCamera === 'function') ? rb.getCamera() : null
      ).then(() => {
        _addMessage('success', '✅ 世界快照已保存到本地持久化存储。');
      }).catch(err => {
        _addMessage('error', '❌ 保存失败: ' + (err?.message || String(err)));
      });
      return { type: 'system', text: '💾 正在保存…（稍候片刻）' };
    } catch (err) {
      return { type: 'error', text: '❌ 保存过程出错: ' + (err?.message || String(err)) };
    }
  }

  // ===== AI 提供者配置（在控制台内展示）=====
  function _showAiProvidersConfig() {
    const ab = window.AiBridge;
    if (!ab || typeof ab.getProviders !== 'function') {
      return { type: 'error', text: 'AiBridge 未初始化，无法读取AI提供者配置' };
    }
    const providers = ab.getProviders();
    const full = typeof ab.getProvidersFull === 'function' ? ab.getProvidersFull() : providers;
    if (!full || full.length === 0) {
      return {
        type: 'info',
        text: '⚙ 当前还没有配置任何AI提供者。\n\n可以在开发者控制台之外手动编辑，或用 JS 命令配置：\n  > AiBridge.addProvider({ name: "提供者A", endpoint: "https://api.example.com/v1/chat/completions", model: "gpt-4o-mini", apiKey: "sk-xxxxx", enabled: true, priority: 1 })'
      };
    }
    const lines = ['⚙ AI 提供者配置（共 ' + full.length + ' 个）:\n'];
    for (let i = 0; i < full.length; i++) {
      const p = full[i];
      const status = p.enabled ? '✅ 启用' : '⏸ 禁用';
      const maskedKey = (typeof p.apiKey === 'string' && p.apiKey.length > 8)
        ? p.apiKey.substring(0, 4) + '...' + p.apiKey.substring(p.apiKey.length - 4)
        : (p.apiKey || '(未设置)');
      lines.push('[' + (i + 1) + '] ' + status + '  ' + (p.name || '(未命名)'));
      lines.push('     优先级: ' + (p.priority ?? '-'));
      lines.push('     模型: ' + (p.model || '(未设置)'));
      lines.push('     端点: ' + (p.endpoint || '(未设置)'));
      lines.push('     API Key: ' + maskedKey);
      lines.push('');
    }
    lines.push('💡 用 JS 命令修改：');
    lines.push('   > AiBridge.addProvider({ name:"新提供者", endpoint:"https://...", model:"...", apiKey:"sk-...", enabled:true, priority:1 })');
    lines.push('   > AiBridge.updateProvider("providerId", { apiKey:"新key" })');
    lines.push('   > AiBridge.removeProvider("providerId")');
    return { type: 'info', text: lines.join('\n') };
  }

  // ===== 建造地图场景 =====
  function _buildMapScene(rawText) {
    const sr = window.SpeciesRegistry;
    if (!sr || typeof sr.getMapPresets !== 'function') {
      return { type: 'error', text: 'SpeciesRegistry 未初始化或未提供地图预设 API' };
    }
    const presets = sr.getMapPresets();
    const keys = Object.keys(presets);

    // 从用户输入中匹配地图预设（支持英文ID和中文名称）
    const txt = rawText.toLowerCase();
    let presetKey = null;
    for (const k of keys) {
      const p = presets[k];
      if (txt.includes(k) || txt.includes(p.name) || rawText.includes(p.name)) {
        presetKey = k;
        break;
      }
    }
    // 别名支持
    if (!presetKey) {
      if (/沙漠|戈壁/.test(rawText)) presetKey = 'desert';
      else if (/草原|草地|温带/.test(rawText)) presetKey = 'grassland';
      else if (/落叶|阔叶林|森林/.test(rawText)) presetKey = 'deciduous';
      else if (/雨林|热带/.test(rawText)) presetKey = 'rainforest';
    }

    // 从文本中解析密度（支持 "2倍密度"、"高密度"、"稀疏" 等）
    let density = 1.0;
    const densityMatch = rawText.match(/(\d+(?:\.\d+)?)\s*倍/);
    if (densityMatch) density = parseFloat(densityMatch[1]);
    else if (/密集|高密度|丰富|多/.test(rawText)) density = 1.6;
    else if (/稀疏|少|精简|低密/.test(rawText)) density = 0.5;

    // 是否清空世界（默认清空；用户说"不清空"/"保留现有"则不清空）
    const clearWorld = !/(不清空|保留|不清|保留现有|追加|在现有基础上)/.test(rawText);

    if (!presetKey) {
      let lines = ['⚠️ 未能识别具体地图，请在命令中指定地图名称。\n'];
      lines.push('支持的地图预设:');
      for (const k of keys) {
        lines.push('  • ' + presets[k].name + '（' + k + '）');
      }
      lines.push('\n示例命令:');
      lines.push('  • 建一张沙漠地图');
      lines.push('  • 生成草原场景');
      lines.push('  • 切换到落叶林');
      lines.push('  • 建一张2倍密度的雨林地图（不清空）');
      return { type: 'info', text: lines.join('\n') };
    }

    const preset = presets[presetKey];
    _addMessage('info', '🗺️ 正在建造【' + preset.name + '】地图场景...');

    try {
      const result = sr.buildMapScene(presetKey, { clearWorld: clearWorld, density: density });
      if (result.error) {
        return { type: 'error', text: '❌ 建造失败: ' + result.error };
      }
      const lines = [
        '✅ 地图场景建造完成！',
        '📍 预设: ' + result.presetName + '（' + result.presetKey + '）',
        '🎨 背景色: ' + (result.background || '-'),
      ];
      if (result.cleared > 0) lines.push('🧹 已清理原有基圆: ' + result.cleared + ' 个');
      lines.push('🌱 植物: ' + result.plants + ' 株');
      if (result.trees > 0) lines.push('🌳 大树: ' + result.trees + ' 株');
      lines.push('🦗 昆虫: ' + result.insects + ' 只');
      if (result.waters > 0) lines.push('💧 水源: ' + result.waters + ' 处');
      if (result.rocks > 0) lines.push('🪨 岩石: ' + result.rocks + ' 块');
      lines.push('📊 总计新建: ' + result.total + ' 个基圆');
      lines.push('📖 生态说明: ' + (result.description || '-'));
      lines.push('\n💡 提示: 中心区域留空供你放置蚂蚁窝。点击画布左上角「💬 控制台」随时切换地图。');
      return { type: 'success', text: lines.join('\n') };
    } catch (err) {
      return { type: 'error', text: '❌ 建造过程出错: ' + (err.message || String(err)) };
    }
  }

  // ===== 地图预设查询 =====
  function _showMapPresets(rawText) {
    const sr = window.SpeciesRegistry;
    if (!sr || typeof sr.getMapPresets !== 'function') {
      return { type: 'error', text: 'SpeciesRegistry 未初始化或未提供地图预设 API' };
    }
    const presets = sr.getMapPresets();
    const keys = Object.keys(presets);
    if (keys.length === 0) {
      return { type: 'info', text: '当前没有地图预设' };
    }

    // 判断用户是否在询问某个特定地图
    const txt = rawText.toLowerCase();
    let specific = null;
    for (const k of keys) {
      const p = presets[k];
      if (txt.includes(k) || txt.includes(p.name) || rawText.includes(p.name)) {
        specific = { id: k, ...p };
        break;
      }
    }

    if (specific) {
      let lines = ['🗺️ 【' + specific.name + '】 地图详情:\n'];
      lines.push('• ID: ' + specific.id);
      lines.push('• 背景色: ' + (specific.backgroundColor || '未设置'));
      lines.push('• 食物倍率: x' + specific.foodMultiplier);
      lines.push('• 能量消耗: x' + specific.energyConsumption);
      lines.push('• 天敌频率: x' + specific.enemyMultiplier);
      lines.push('• 描述: ' + (specific.description || '(无)'));
      lines.push('');
      // 蚂蚁
      if (specific.antSpecies && specific.antSpecies.length > 0) {
        lines.push('🐜 蚂蚁 (' + specific.antSpecies.length + ' 种):');
        for (const sp of specific.antSpecies) {
          try {
            const info = sr.getAnt(sp);
            if (info) lines.push('   • ' + (info.name || sp) + (info.latin ? ' (' + info.latin + ')' : ''));
            else lines.push('   • ' + sp + ' (⚠️ 物种定义缺失)');
          } catch (e) { lines.push('   • ' + sp); }
        }
      }
      // 植物
      if (specific.plantSpecies && specific.plantSpecies.length > 0) {
        lines.push('');
        lines.push('🌱 植物 (' + specific.plantSpecies.length + ' 种):');
        for (const sp of specific.plantSpecies) {
          try {
            const info = sr.getPlant(sp);
            if (info) lines.push('   • ' + (info.name || sp) + (info.latin ? ' (' + info.latin + ')' : ''));
            else lines.push('   • ' + sp + ' (⚠️ 物种定义缺失)');
          } catch (e) { lines.push('   • ' + sp); }
        }
      }
      // 昆虫
      if (specific.insectSpecies && specific.insectSpecies.length > 0) {
        lines.push('');
        lines.push('🦗 昆虫 (' + specific.insectSpecies.length + ' 种):');
        for (const sp of specific.insectSpecies) {
          try {
            const info = sr.getInsect(sp);
            if (info) lines.push('   • ' + (info.name || sp) + (info.latin ? ' (' + info.latin + ')' : ''));
            else lines.push('   • ' + sp + ' (⚠️ 物种定义缺失)');
          } catch (e) { lines.push('   • ' + sp); }
        }
      }
      return { type: 'success', text: lines.join('\n') };
    }

    // 否则：列出全部地图简介
    let lines = ['🗺️ 当前共预设 ' + keys.length + ' 张地图:\n'];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const p = presets[k];
      const antN = (p.antSpecies || []).length;
      const plantN = (p.plantSpecies || []).length;
      const insectN = (p.insectSpecies || []).length;
      lines.push(
        (i + 1) + '. 【' + p.name + '】 (' + k + ')' +
        '\n   背景: ' + (p.backgroundColor || '-') +
        '  食物x' + p.foodMultiplier + '  能耗x' + p.energyConsumption + '  天敌x' + p.enemyMultiplier +
        '\n   🐜 ' + antN + '种蚂蚁 · 🌱 ' + plantN + '种植物 · 🦗 ' + insectN + '种昆虫' +
        (p.description ? '\n   ' + p.description : '') +
        '\n'
      );
    }
    lines.push('💡 提示: 输入「沙漠」「草原」「落叶林」「雨林」可查看特定地图详情');
    return { type: 'success', text: lines.join('\n') };
  }

  // ===== 物种列表查询 =====
  function _showSpeciesList(kind, rawText) {
    const sr = window.SpeciesRegistry;
    if (!sr) {
      return { type: 'error', text: 'SpeciesRegistry 未加载' };
    }

    let items = {};
    let getter = null;
    let label = '';
    let emoji = '';

    if (kind === 'ant') {
      items = (typeof sr.getAllAnts === 'function') ? sr.getAllAnts() : {};
      getter = sr.getAnt;
      label = '蚂蚁';
      emoji = '🐜';
    } else if (kind === 'plant') {
      items = (typeof sr.getAllPlants === 'function') ? sr.getAllPlants() : {};
      getter = sr.getPlant;
      label = '植物';
      emoji = '🌱';
    } else if (kind === 'insect') {
      items = (typeof sr.getAllInsects === 'function') ? sr.getAllInsects() : {};
      getter = sr.getInsect;
      label = '昆虫';
      emoji = '🦗';
    }

    const keys = Object.keys(items);
    if (keys.length === 0) {
      return { type: 'info', text: emoji + ' 当前没有' + label + '物种定义' };
    }

    // 检查是否询问特定物种（支持中文名、拉丁名、英文 ID）
    const q = rawText.toLowerCase();
    for (const k of keys) {
      const item = items[k];
      const name = (item.name || '').toLowerCase();
      const latin = (item.latin || '').toLowerCase();
      if (q.includes(k) || q.includes(name) || q.includes(latin)) {
        return _showSpeciesDetail(kind, k, item);
      }
    }

    // 否则：输出总览
    let lines = [emoji + ' 当前共注册 ' + keys.length + ' 种' + label + ':\n'];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const item = items[k];
      const name = item.name || k;
      const latin = item.latin ? ' (' + item.latin + ')' : '';
      const extra = [];
      if (typeof item.size !== 'undefined') extra.push('size=' + item.size);
      if (typeof item.radius !== 'undefined' && extra.length === 0) extra.push('radius=' + item.radius);
      if (typeof item.color !== 'undefined') extra.push('颜色=' + item.color);
      const desc = (item.description && typeof item.description === 'string')
        ? ('\n   描述: ' + item.description.split('\n')[0].substring(0, 80) + (item.description.length > 80 ? '...' : ''))
        : '';
      lines.push((i + 1) + '. ' + name + latin + ' [ID: ' + k + ']' + (extra.length ? ' (' + extra.join(', ') + ')' : '') + desc);
    }
    lines.push('\n💡 提示: 输入「箭蚁」「蚁狮」「橡树」等物种名可查看详细信息');
    return { type: 'success', text: lines.join('\n') };
  }

  function _showSpeciesDetail(kind, id, item) {
    const lines = [];
    const emoji = kind === 'ant' ? '🐜' : kind === 'plant' ? '🌱' : '🦗';
    lines.push(emoji + ' 【' + (item.name || id) + '】 物种详情:\n');
    lines.push('• ID: ' + id);
    if (item.latin) lines.push('• 拉丁名: ' + item.latin);
    if (item.color) lines.push('• 颜色: ' + item.color);
    if (typeof item.size !== 'undefined') lines.push('• 大小: ' + item.size);
    if (typeof item.radius !== 'undefined') lines.push('• 半径: ' + item.radius);
    if (typeof item.speed !== 'undefined') lines.push('• 速度: ' + item.speed);
    if (typeof item.hp !== 'undefined') lines.push('• HP: ' + item.hp);
    if (typeof item.attackPower !== 'undefined') lines.push('• 攻击: ' + item.attackPower);
    if (typeof item.defense !== 'undefined') lines.push('• 防御: ' + item.defense);
    if (typeof item.energyValue !== 'undefined') lines.push('• 能量值: ' + item.energyValue);
    if (typeof item.seedEnergy !== 'undefined') lines.push('• 种子能量: ' + item.seedEnergy);
    if (typeof item.flying !== 'undefined') lines.push('• 飞行: ' + (item.flying ? '是' : '否'));
    if (typeof item.hostile !== 'undefined') lines.push('• 敌对: ' + (item.hostile ? '是' : '否'));
    if (item.kind && typeof item.kind === 'string') lines.push('• 习性: ' + item.kind);

    // 角色（蚂蚁特有）
    if (item.roles && typeof item.roles === 'object') {
      const roleKeys = Object.keys(item.roles);
      if (roleKeys.length > 0) {
        lines.push('• 角色 (' + roleKeys.length + '种): ' + roleKeys.map(r => item.roles[r].name || r).join(' · '));
      }
    }

    if (item.description && typeof item.description === 'string') {
      lines.push('\n📖 描述:');
      lines.push(item.description);
    }

    return { type: 'success', text: lines.join('\n') };
  }

  // ===== 运行状态 =====
  function _showRuntimeStatus() {
    const fps = document.getElementById('fpsDisplay')?.textContent || '未知';
    const cellCount = _cellCore?.getCellCount?.() || (_cellCore?.getAllCells?.() || []).length || 0;
    const time = getGameTime();
    const sr = window.SpeciesRegistry;
    const antCount = (sr && typeof sr.getAllAnts === 'function') ? Object.keys(sr.getAllAnts()).length : 0;
    const plantCount = (sr && typeof sr.getAllPlants === 'function') ? Object.keys(sr.getAllPlants()).length : 0;
    const insectCount = (sr && typeof sr.getAllInsects === 'function') ? Object.keys(sr.getAllInsects()).length : 0;
    const mapCount = (sr && typeof sr.getMapPresets === 'function') ? Object.keys(sr.getMapPresets()).length : 0;

    // 基圆类型分布
    let kindStats = '';
    try {
      if (_cellCore && typeof _cellCore.getAllCells === 'function') {
        const cells = _cellCore.getAllCells();
        const kinds = {};
        for (let i = 0; i < cells.length; i++) {
          const k = cells[i].kind || 'unknown';
          kinds[k] = (kinds[k] || 0) + 1;
        }
        const lines = [];
        for (const [k, v] of Object.entries(kinds)) lines.push(k + ': ' + v);
        if (lines.length > 0) kindStats = '\n  基圆类型分布: ' + lines.join(' · ');
      }
    } catch (e) { /* ignore */ }

    // AI 状态
    const ai = window.AiBridge;
    let aiStatus = '未初始化';
    if (ai && typeof ai.getProviderStats === 'function') {
      const providers = ai.getProviderStats();
      if (providers && providers.length > 0) {
        const enabled = providers.filter(p => p.enabled && p.hasKey);
        aiStatus = providers.length + '个提供者, ' + enabled.length + '个已启用';
      }
    }

    return {
      type: 'info',
      text: '📊 运行状态:\n' +
            '  FPS: ' + fps + '\n' +
            '  基圆数量: ' + cellCount + (kindStats || '') + '\n' +
            '  游戏时间: ' + time.dateString + ' ' + time.timeString + ' (' + time.periodString + ')\n' +
            '  时间速度: x' + getTimeSpeed().toFixed(1) + '\n' +
            '  🗺️ 地图预设: ' + mapCount + ' 张\n' +
            '  🐜 蚂蚁物种: ' + antCount + ' 种\n' +
            '  🌱 植物物种: ' + plantCount + ' 种\n' +
            '  🦗 昆虫物种: ' + insectCount + ' 种\n' +
            '  🤖 AI: ' + aiStatus + '\n' +
            '  💬 控制台: v2.0 (' + (_initialized ? '就绪' : '未初始化') + ')'
    };
  }

  // ===== 项目目录结构 =====
  // 通过 fetch() 尝试获取关键文件列表；因浏览器不支持目录遍历，这里列出已知的核心文件结构
  function _showProjectStructure() {
    const structure = [
      '📁 cell-engine/',
      '  ├── 📄 index.html                  (主页面)',
      '  ├── 📁 css/',
      '  │   └── 📄 main.css                (样式)',
      '  ├── 📁 js/',
      '  │   └── 📁 seed/',
      '  │       ├── 📄 species.js          物种注册表 / 地图预设 (已动态加载)',
      '  │       ├── 📄 loader.js           属性面板 / 资源加载',
      '  │       ├── 📄 devConsole.js       开发者控制台 (本文件)',
      '  │       ├── 📄 cellCore.js         基圆核心',
      '  │       ├── 📄 gameLoop.js         游戏循环',
      '  │       ├── 📄 renderBridge.js     渲染桥',
      '  │       ├── 📄 sandbox.js          沙箱执行环境',
      '  │       ├── 📄 aiBridge.js         AI 桥接',
      '  │       ├── 📄 persistLayer.js     持久化',
      '  │       ├── 📄 aiMemory.js         AI 记忆系统',
      '  │       └── 📁 tools/',
      '  │           ├── 📄 engineTools.js  引擎工具 / 工具调用',
      '  │           ├── 📄 codeProvider.js 代码生成 Provider',
      '  │           └── ... (其他 provider)',
      '  └── 📁 contexts/mappers/...       (AI 上下文与代码模板)',
      '',
      '📖 读取文件命令示例:',
      '   • 读文件 species.js',
      '   • 读取 loader.js 前 100 行',
      '   • 查看 main.css 全部',
      '   • 读取 index.html'
    ];

    // 附加：检测哪些 JS 文件实际已加载（存在 window 上）
    const knownModules = [];
    if (window.CellCore) knownModules.push('CellCore ✅');
    if (window.Sandbox) knownModules.push('Sandbox ✅');
    if (window.SpeciesRegistry) knownModules.push('SpeciesRegistry ✅');
    if (window.AiBridge) knownModules.push('AiBridge ✅');
    if (window.RenderBridge) knownModules.push('RenderBridge ✅');
    if (window.PersistLayer) knownModules.push('PersistLayer ✅');
    if (window.AiMemory) knownModules.push('AiMemory ✅');
    if (window.EngineTools) knownModules.push('EngineTools ✅');

    structure.push('');
    structure.push('🔌 当前已加载的核心模块:');
    structure.push('   ' + knownModules.join(' · '));

    return { type: 'info', text: structure.join('\n') };
  }

  // ===== 读取源代码文件 =====
  async function _readSourceFile(rawText) {
    // 解析文件名: 支持 "读文件 species.js" / "读取 loader.js" / "查看 main.css" / "species.js"(直接) 等
    const cleanText = rawText.trim();

    // 常见模式匹配
    let filename = null;
    const filePattern = /([a-zA-Z0-9_\-\.\/]+\.(?:js|css|html|md|json|txt|ts))/i;
    const match = cleanText.match(filePattern);
    if (match) {
      filename = match[1];
    } else {
      // 尝试：用户可能只写了 "species" 之类的关键字
      const knownFiles = [
        { key: 'species', file: 'js/seed/species.js' },
        { key: 'devconsole', file: 'js/seed/devConsole.js' },
        { key: 'loader', file: 'js/seed/loader.js' },
        { key: 'sandbox', file: 'js/seed/sandbox.js' },
        { key: 'aibridge', file: 'js/seed/aiBridge.js' },
        { key: 'cellcore', file: 'js/seed/cellCore.js' },
        { key: 'cell_core', file: 'js/seed/cellCore.js' },
        { key: 'gameloop', file: 'js/seed/gameLoop.js' },
        { key: 'renderbridge', file: 'js/seed/renderBridge.js' },
        { key: 'persist', file: 'js/seed/persistLayer.js' },
        { key: 'memory', file: 'js/seed/aiMemory.js' },
        { key: 'enginetools', file: 'js/seed/tools/engineTools.js' },
        { key: 'main.css', file: 'css/main.css' },
        { key: 'css', file: 'css/main.css' },
        { key: 'index.html', file: 'index.html' },
        { key: 'html', file: 'index.html' }
      ];
      const lower = cleanText.toLowerCase();
      for (const kf of knownFiles) {
        if (lower.includes(kf.key)) { filename = kf.file; break; }
      }
    }

    if (!filename) {
      return {
        type: 'error',
        text: '❌ 未能识别要读取的文件名。\n示例:\n  • 读文件 species.js\n  • 读取 loader.js\n  • 查看 main.css\n  • 读文件 index.html'
      };
    }

    // 解析行数限制: "前 100 行" / "100-200"
    let startLine = 0, maxLines = 80;
    const firstMatch = cleanText.match(/(?:前|首)\s*(\d+)\s*行/);
    const rangeMatch = cleanText.match(/(\d+)\s*[-\~到至]\s*(\d+)\s*行?/);
    if (firstMatch) {
      maxLines = parseInt(firstMatch[1]);
    } else if (rangeMatch) {
      startLine = parseInt(rangeMatch[1]) - 1;
      maxLines = parseInt(rangeMatch[2]) - startLine;
    }

    _addMessage('info', '📖 正在读取文件: ' + filename + ' ...');

    try {
      // 使用 fetch 从静态服务器读取
      const response = await fetch(filename);
      if (!response.ok) {
        return {
          type: 'error',
          text: '❌ 文件读取失败 (' + response.status + ' ' + response.statusText + ')\n' +
                '可能原因:\n  1. 文件路径不正确 (请尝试相对根目录的路径)\n  2. 页面通过 file:// 协议打开，浏览器不允许 fetch 读取本地文件\n\n提示: 请用 HTTP 服务器打开 index.html (如 `python -m http.server` 或 VS Code Live Server)'
        };
      }
      const content = await response.text();
      const totalLines = content.split('\n').length;

      // 截取指定行范围
      const lines = content.split('\n');
      const sliceStart = Math.max(0, startLine);
      const sliceEnd = Math.min(lines.length, sliceStart + maxLines);
      const slice = lines.slice(sliceStart, sliceEnd);

      let display = '';
      for (let i = 0; i < slice.length; i++) {
        const lineNum = sliceStart + i + 1;
        display += String(lineNum).padStart(4) + ': ' + slice[i] + '\n';
      }

      // 裁剪过长的文本，防止爆炸
      const MAX_DISPLAY = 12000;
      let result = '';
      if (totalLines > sliceEnd) {
        result = '📄 文件: ' + filename + ' (共 ' + totalLines + ' 行, 显示第 ' + (sliceStart + 1) + '-' + sliceEnd + ' 行)\n\n' + display;
      } else if (startLine > 0) {
        result = '📄 文件: ' + filename + ' (共 ' + totalLines + ' 行, 显示第 ' + (sliceStart + 1) + '-' + sliceEnd + ' 行)\n\n' + display;
      } else {
        result = '📄 文件: ' + filename + ' (共 ' + totalLines + ' 行, 完整显示)\n\n' + display;
      }

      if (result.length > MAX_DISPLAY) {
        result = result.substring(0, MAX_DISPLAY) + '\n\n... (已截断，文件过大请分段读取: 如「读文件 species.js 200-400 行」)';
      }

      return { type: 'success', text: result };
    } catch (err) {
      return {
        type: 'error',
        text: '❌ 文件读取错误: ' + (err.message || String(err)) + '\n\n提示: 请通过 HTTP 服务器打开项目，不要用 file:// 协议直接打开 index.html。\n推荐方式:\n  • VS Code: 安装 Live Server 插件 → 右键 index.html → Open with Live Server\n  • Python: 在项目目录执行 `python -m http.server 8000`\n  • Node: `npx serve`'
      };
    }
  }

  // ===== AI 命令主循环 =====
  async function _aiCommand(rawText) {
    const aiBridge = _aiBridge || window.AiBridge;
    const engineTools = window.EngineTools;

    if (!aiBridge || typeof aiBridge.chat !== 'function') {
      return {
        type: 'info',
        text: '⚠️ 当前未配置 AI 提供者。请在属性面板中启用一个 AI 模型并填入 API Key。\n\n也可以使用以下手动命令:\n  • 地图 / 蚂蚁 / 植物 / 昆虫 / 状态 / 目录 / 读文件 species.js / 帮助'
      };
    }

    if (engineTools && !engineTools.isReady && typeof engineTools.init === 'function') {
      try { engineTools.init(_cellCore || window.CellCore, aiBridge, _sandbox || window.Sandbox, null); }
      catch (e) { /* ignore */ }
    }

    // 动态获取工具列表，自动支持新工具
    const toolLines = (engineTools && typeof engineTools.listTools === 'function')
      ? engineTools.listTools().map((t, i) => `  ${i + 1}. ${t.name}${t.usage} — ${t.description}`)
      : ['  (工具列表不可用)'];
    const toolListStr = '你是基圆引擎的 AI 操作员。可用工具:\n' + toolLines.join('\n');

    const systemPrompt =
      toolListStr + '\n' +
      '\n调用工具格式: __TOOL_CALL__[{name: "...", params:{...}}]\n' +
      '不需要工具时，用简洁中文回答用户。\n\n' +
      '当前世界状态: ' + _getWorldSnapshot();

    const messages = [{ role: 'system', content: systemPrompt }];
    const MAX_HISTORY = 20;
    const startIdx = Math.max(0, _chatHistory.length - MAX_HISTORY);
    for (let i = startIdx; i < _chatHistory.length; i++) {
      const item = _chatHistory[i];
      if (!item || !item.text) continue;
      if (item.role === 'user') messages.push({ role: 'user', content: item.text });
      else if (item.role === 'assistant') messages.push({ role: 'assistant', content: item.text });
    }
    messages.push({ role: 'user', content: rawText });

    try {
      const firstResponse = await aiBridge.chat(messages, { taskType: 'chat' });

      let calls = null;
      if (engineTools && typeof engineTools.parseToolCalls === 'function') {
        calls = engineTools.parseToolCalls(firstResponse);
      } else {
        const idx = firstResponse.indexOf('__TOOL_CALL__');
        if (idx !== -1) {
          try {
            const jsonPart = firstResponse.substring(idx + '__TOOL_CALL__'.length).trim();
            const endIdx = jsonPart.indexOf(']');
            if (endIdx !== -1) {
              const parsed = JSON.parse(jsonPart.substring(0, endIdx + 1));
              calls = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : null);
            }
          } catch (e) { calls = null; }
        }
      }

      if (!calls || calls.length === 0) {
        _chatHistory.push({ role: 'assistant', text: firstResponse, time: new Date() });
        return { type: 'info', text: firstResponse };
      }

      _addMessage('info', '🤖 AI 决定调用以下工具:');
      for (let i = 0; i < calls.length; i++) {
        const c = calls[i];
        _addMessage('system', '   • ' + c.name + '(' + (c.params ? JSON.stringify(c.params) : '') + ')');
      }

      const toolResults = engineTools ? await engineTools.dispatch(calls) : null;
      _addMessage('system', '工具执行完成。正在让 AI 总结结果...');

      const secondMessages = messages.concat([
        { role: 'assistant', content: firstResponse },
        {
          role: 'user',
          content: '引擎工具执行结果 (JSON):\n' + (typeof toolResults === 'string' ? toolResults : JSON.stringify(toolResults, null, 2)) +
                    '\n\n请基于此回答用户原始问题: ' + rawText
        }
      ]);

      const secondResponse = await aiBridge.chat(secondMessages, { taskType: 'chat' });
      _chatHistory.push({ role: 'assistant', text: firstResponse, time: new Date() });
      _chatHistory.push({ role: 'assistant', text: secondResponse, time: new Date() });
      return { type: 'success', text: secondResponse };
    } catch (err) {
      return {
        type: 'error',
        text: 'AI 调用出错: ' + (err.message || String(err)) +
              '\n\n请检查:\n  1. 属性面板中 AI 提供者是否已启用、API Key 是否正确\n  2. 网络连接\n  3. 使用手动命令 (输入「帮助」查看全部)'
      };
    }
  }

  // ===== AI 测速 =====
  async function _benchmarkAI(rawText) {
    const ai = window.AiBridge;
    if (!ai || typeof ai.benchmarkProviders !== 'function') {
      return { type: 'error', text: '❌ AiBridge 未初始化或不支持 benchmarkProviders' };
    }
    const providers = (typeof ai.getProviderStats === 'function') ? ai.getProviderStats() : null;
    const enabledStats = (providers || []).filter(p => p.enabled && p.hasKey);
    if (!enabledStats || enabledStats.length === 0) {
      return { type: 'error', text: '❌ 没有已启用并配置了 API Key 的 AI 提供者。请在属性面板中配置。' };
    }
    _addMessage('info', '⚡ 开始测速: 已启用 ' + enabledStats.length + ' 个 AI 提供者...');
    try {
      const results = await ai.benchmarkProviders({});
      if (!results || results.length === 0) return { type: 'error', text: '❌ 没有返回测速结果' };
      const parts = ['📊 AI 模型响应速度排名:\n'];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'ok') {
          parts.push((i + 1) + '. ✅ ' + r.name + ' (' + r.model + ')\n     响应: ' + r.responseTimeMs + ' ms\n     预览: "' + String(r.preview || '').substring(0, 60) + '..."\n');
        } else {
          parts.push((i + 1) + '. ❌ ' + r.name + ' (' + r.model + ')\n     错误: ' + r.error + '\n');
        }
      }
      return { type: 'success', text: parts.join('\n') };
    } catch (err) {
      return { type: 'error', text: '❌ AI 测速失败: ' + (err.message || String(err)) };
    }
  }

  // ===== 辅助函数 =====
  function _normalizeText(text) {
    return text.replace(/[，。！？、]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function _extractCount(text) {
    const m = text.match(/(\d+)/);
    if (m) return parseInt(m[1]);
    const cnNums = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
    for (const [cn, num] of Object.entries(cnNums)) {
      if (text.includes(cn)) return num;
    }
    return 1;
  }

  function _getCenterPosition() {
    if (_currentCellId && _cellCore) {
      const cell = _cellCore.getCell(_currentCellId);
      if (cell) return { x: cell.x, y: cell.y };
    }
    const rb = window.RenderBridge;
    if (rb && typeof rb.getCamera === 'function') {
      const cam = rb.getCamera();
      return { x: cam.x, y: cam.y };
    }
    return { x: 0, y: 0 };
  }

  function _escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ===== 帮助 =====
  function _showHelp() {
    return {
      type: 'info',
      text: '📖 开发者控制台 v2.0 — 完整命令指南\n\n' +
            '【地图 / 环境】\n' +
            '• 建一张沙漠地图 / 生成草原场景 / 切换到雨林 — 自动建造整张地图（植物/水/岩石/昆虫，行为代码已自动加载并运行）\n' +
            '• 建一张2倍密度的落叶林（不清空）— 自定义密度 & 保留现有基圆\n' +
            '• 地图 / 地图预设 / 有几个地图 — 仅查看地图预设信息\n' +
            '• 沙漠 / 草原 / 落叶林 / 雨林 — 查看特定地图详情\n\n' +
            '【保存与 AI】\n' +
            '• 保存 / 保存快照 / 手动保存 — 保存整个世界到本地持久化\n' +
            '• AI设置 / 提供者 / API Key — 在控制台内查看已配置的 AI 提供者\n' +
            '• 打开AI设置面板 — 弹出完整的 AI 提供者配置面板（可编辑/添加/删除）\n\n' +
            '【物种查询】\n' +
            '• 蚂蚁 / 有多少种蚂蚁 — 列出所有蚂蚁物种\n' +
            '• 植物 / 有多少种植物 — 列出所有植物物种\n' +
            '• 昆虫 / 有多少种昆虫 / 蚁狮 — 列出所有昆虫物种\n' +
            '• 箭蚁 / 蒙古栎 / 蚁狮 — 查看特定物种详情\n\n' +
            '【运行状态】\n' +
            '• 状态 / 运行状态 / FPS / 性能 — 当前运行信息\n' +
            '• 时间 / 季节 / 昼夜 — 游戏时间信息\n' +
            '• 速度 / 倍速 / 暂停 — 调整时间流速\n\n' +
            '【创建 / 删除】\n' +
            '• 创建5个植物 / 创建2只兔子\n' +
            '• 创建3个基圆 / 删除所有基圆\n\n' +
            '【代码 / 项目】\n' +
            '• 目录 / 项目结构 — 查看项目文件结构\n' +
            '• 读文件 species.js / 读取 loader.js — 读取源码\n' +
            '• 读文件 species.js 前 200 行 / 100-300 行 — 分段读取\n' +
            '• > 代码 — 执行 JavaScript 代码\n' +
            '• ai 描述 — 为选中基圆生成行为代码\n\n' +
            '【其他】\n' +
            '• 保存 / 帮助 / 清空对话\n' +
            '• Ctrl+` 切换控制台 · ESC 关闭\n' +
            '• 点击标题栏可拖动控制台'
    };
  }

  // ===== 简单基圆操作 =====
  function _listCells(rawText) {
    if (!_cellCore) return { type: 'error', text: 'CellCore 未初始化' };
    const all = _cellCore.getAllCells();
    const kinds = {};
    for (const cell of all) {
      kinds[cell.kind] = (kinds[cell.kind] || 0) + 1;
    }
    let result = '当前世界中有 ' + all.length + ' 个基圆:\n';
    for (const [kind, count] of Object.entries(kinds)) {
      result += '  • ' + kind + ': ' + count + ' 个\n';
    }
    return { type: 'success', text: result };
  }

  function _deleteCells(rawText) {
    if (!_cellCore) return { type: 'error', text: 'CellCore 未初始化' };
    const text = rawText.toLowerCase();
    const all = _cellCore.getAllCells();
    if (/所有|全部|all|每/.test(text)) {
      let targets = all;
      if (/植物/.test(rawText)) targets = all.filter(c => c.kind === 'plant' || (c.attributes && c.attributes.variety));
      else if (/兔/.test(rawText)) targets = all.filter(c => c.kind === 'creature');
      for (const cell of targets) _cellCore.destroyCell(cell.id);
      return { type: 'success', text: '已删除 ' + targets.length + ' 个基圆' };
    }
    const n = _extractCount(rawText);
    const toDelete = all.slice(0, n);
    for (const cell of toDelete) _cellCore.destroyCell(cell.id);
    return { type: 'success', text: '已删除 ' + toDelete.length + ' 个基圆' };
  }

  function _createPlants(rawText) {
    if (!_cellCore) return { type: 'error', text: 'CellCore 未初始化' };
    const count = _extractCount(rawText);
    const center = _getCenterPosition();
    const created = [];
    for (let i = 0; i < count; i++) {
      const variety = QUICK_PLANT_DEFS[i % QUICK_PLANT_DEFS.length];
      const x = center.x + (Math.random() - 0.5) * 400;
      const y = center.y + (Math.random() - 0.5) * 400;
      const cell = _cellCore.createCell('plant', x, y);
      _cellCore.updateCell(cell.id, { name: variety.name, radius: variety.radius, color: variety.color, shape: variety.shape });
      _cellCore.setAttribute(cell.id, 'energy', variety.energy);
      created.push(variety.name);
    }
    return { type: 'success', text: '已创建 ' + count + ' 个植物: ' + created.join('、') };
  }

  function _createRabbits(rawText) {
    if (!_cellCore) return { type: 'error', text: 'CellCore 未初始化' };
    const count = _extractCount(rawText);
    const center = _getCenterPosition();
    const created = [];
    for (let i = 0; i < count; i++) {
      const variety = QUICK_RABBIT_DEFS[i % QUICK_RABBIT_DEFS.length];
      const x = center.x + (Math.random() - 0.5) * 300;
      const y = center.y + (Math.random() - 0.5) * 300;
      const cell = _cellCore.createCell('creature', x, y);
      _cellCore.updateCell(cell.id, { name: variety.name, radius: variety.radius, color: variety.color, speed: variety.speed });
      _cellCore.setAttribute(cell.id, 'hp', variety.hp);
      created.push(variety.name);
    }
    return { type: 'success', text: '已创建 ' + count + ' 个生物: ' + created.join('、') };
  }

  function _createEmptyCells(rawText) {
    if (!_cellCore) return { type: 'error', text: 'CellCore 未初始化' };
    const count = _extractCount(rawText);
    const center = _getCenterPosition();
    for (let i = 0; i < count; i++) {
      const x = center.x + (Math.random() - 0.5) * 200;
      const y = center.y + (Math.random() - 0.5) * 200;
      _cellCore.createCell('default', x, y);
    }
    return { type: 'success', text: '已创建 ' + count + ' 个基圆' };
  }

  function _aiGenerate(rawText) {
    const aiBridge = _aiBridge || window.AiBridge;
    if (!aiBridge) return { type: 'error', text: 'AI Bridge 未配置。请在 index.html 中启用 AI Provider。' };
    if (!_currentCellId) return { type: 'error', text: '请先选中一个基圆。' };
    _addMessage('info', '🤖 正在为选中的基圆生成行为代码，请稍候...');
    const cell = _cellCore ? _cellCore.getCell(_currentCellId) : null;
    const description = rawText.replace(/^(ai|生成代码|代码|code)\s*/i, '').trim();
    return {
      type: 'info',
      text: '📝 AI 代码生成请求已发送到 ' + (aiBridge.constructor.name || 'Provider') +
            (cell ? '\n目标基圆: ' + cell.id + ' (' + (cell.kind || 'unknown') + ')' : '') +
            (description ? '\n描述: ' + description : '\n描述: 使用默认行为模板')
    };
  }

  function _saveGame(rawText) {
    const persist = window.PersistLayer || (window.CellCore && window.CellCore.persist);
    if (!persist) return { type: 'error', text: '持久化层未初始化' };
    try {
      if (typeof persist.save === 'function') persist.save();
      return { type: 'success', text: '💾 状态已保存到本地' };
    } catch (e) {
      return { type: 'error', text: '保存失败: ' + e.message };
    }
  }

  function _showGameTime(rawText) {
    const gt = getGameTime();
    return {
      type: 'info',
      text: '⏰ 游戏时间:\n' +
            '  季节: ' + gt.seasonName + ' (' + gt.seasonEmoji + ')\n' +
            '  时段: ' + gt.periodString + '\n' +
            '  时钟: ' + gt.timeString + '\n' +
            '  总运行: ' + Math.floor(gt.totalMs / 1000) + ' 秒\n' +
            '  时间流速: x' + _timeSpeed.toFixed(1) + ' (可输入 "速度 2" 或 "暂停" 调整)'
    };
  }

  function _setTimeSpeed(rawText) {
    const text = rawText.toLowerCase();
    let speed = 1;
    if (text.includes('暂停') || text.includes('pause') || text.includes('stop')) speed = 0;
    else if (text.includes('快') || text.includes('加速')) speed = 2;
    else if (text.includes('慢') || text.includes('减速')) speed = 0.5;
    else {
      const m = rawText.match(/(\d+(\.\d+)?)/);
      if (m) speed = parseFloat(m[1]);
    }
    setTimeSpeed(speed);
    return { type: 'success', text: '⏱ 时间流速已设置为 x' + speed.toFixed(1) };
  }

  function _runCode(code) {
    try {
      const result = eval.call(null, code);
      const str = (result === undefined) ? '执行成功，无返回值' : String(result);
      return { type: 'success', text: '> ' + code + '\n\n结果: ' + str.substring(0, 300) };
    } catch (e) {
      return { type: 'error', text: '> ' + code + '\n\n错误: ' + e.message };
    }
  }

  // ===== 公共 API =====
  return {
    init: init,
    open: open,
    close: close,
    toggle: toggle,
    send: _sendMessage,
    getGameTime: getGameTime,
    setTimeSpeed: setTimeSpeed,
    getTimeSpeed: getTimeSpeed,
    resetGameTime: resetGameTime
  };

})();

// 挂载到 window 以便其他模块通过 window.DevConsole 访问
if (typeof window !== 'undefined') {
  window.DevConsole = DevConsole;
}