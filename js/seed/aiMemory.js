/**
 * AI记忆层 (aiMemory.js)
 * 管理AI的长期记忆：引擎能力(L1)、世界摘要(L2)、成功模式(L3)
 * 记忆以JSON格式存储在IndexedDB中，按需注入AI Prompt
 */

const AiMemory = (() => {
  let _cellCore = null;
  let _persistLayer = null;

  // L1: 引擎能力（固定，不随世界变化）
  const L1_ENGINE = {
    version: "4.0",
    apiMethods: {
      "api.on(event, callback)": "监听事件",
      "api.once(event, callback)": "监听事件一次",
      "api.off(event, callback)": "取消监听",
      "api.emit(eventName, data)": "发射事件",
      "api.setProperty(key, value)": "设置扩展属性",
      "api.getProperty(key)": "获取扩展属性",
      "api.setTriggerMode(mode, config)": "切换触发模式 (continuous|event|pulse|dormant)",
      "api.animate(prop, target, duration, easing)": "属性动画",
      "api.sendMessage(targetId, data)": "向其他基圆发消息",
      "api.queryCells(filter)": "查询基圆",
      "api.defineInput(portName, type)": "定义输入端口（V4.0新增）",
      "api.defineOutput(portName, type)": "定义输出端口（V4.0新增）",
      "api.connectPorts(fromCellId, fromPort, toCellId, toPort)": "连接端口（V4.0新增）",
      "api.sendPortData(portName, value)": "向输出端口发送数据（V4.0新增）",
      "api.disconnectPort(wireId)": "断开连线（V4.0新增）",
      "api.log(message)": "调试日志"
    },
    events: {
      "onUpdate": "帧更新 { dt }",
      "onClick": "被点击 { worldX, worldY }",
      "onCollision": "碰撞 { otherId, otherKind }",
      "onWake": "休眠唤醒 { accumulatedDt }",
      "onMessage": "收到消息 { fromId, eventName, data }",
      "onDestroy": "即将销毁",
      "portChange": "端口值变化（V4.0）{ portName, portType, value, oldValue, wireId }"
    },
    triggerModes: {
      "continuous": "每帧执行（适合需要持续运动的生物）",
      "event": "仅响应事件（适合静态物体/触发器）",
      "pulse": "定期执行（threshold控制间隔，适合生长/定时逻辑）",
      "dormant": "休眠，不执行"
    },
    kinds: {
      "creature": "会动的生物（默认 continuous）",
      "plant": "植物（默认 pulse）",
      "item": "物品（默认 event）",
      "building": "建筑（默认 event）",
      "terrain": "地形（默认 dormant）",
      "effect": "特效（默认 continuous）",
      "static": "静态物（默认 event）",
      "ui": "UI 组件（默认 event）",
      "trigger": "触发器（默认 event）",
      "empty": "空基圆（默认 event）"
    },
    shapes: ["circle", "rect", "triangle", "polygon"],
    portTypes: ["any", "number", "string", "boolean"]
  };

  // L2: 世界摘要缓存
  let _worldSummaryCache = null;
  let _worldSummaryDirty = true;

  // L3: 成功模式库
  let _patterns = [];
  const MAX_PATTERNS = 50;

  function init(cellCore, persistLayer) {
    _cellCore = cellCore;
    _persistLayer = persistLayer;
    _loadPatterns();

    // 监听基圆变更，标记世界摘要需要更新
    _cellCore.on('cell:created', () => { _worldSummaryDirty = true; });
    _cellCore.on('cell:destroyed', () => { _worldSummaryDirty = true; });
    _cellCore.on('cell:updated', () => { _worldSummaryDirty = true; });

    console.log('[AiMemory] 初始化完成');
  }

  // ===== L1: 引擎能力 =====
  function getEngineCapabilities() {
    return L1_ENGINE;
  }

  // ===== L2: 世界摘要 =====
  function getWorldSummary() {
    if (!_worldSummaryDirty && _worldSummaryCache) {
      return _worldSummaryCache;
    }

    const allCells = _cellCore.getAllCells();
    const kindCounts = {};
    const cellList = [];

    for (const c of allCells) {
      kindCounts[c.kind] = (kindCounts[c.kind] || 0) + 1;
      cellList.push({
        id: c.id,
        name: c.name,
        kind: c.kind,
        position: { x: Math.round(c.x), y: Math.round(c.y) },
        hasCode: !!c.code,
        triggerMode: c.triggerConfig.mode,
        parentId: c.parentId,
        tags: c.tags || []
      });
    }

    // 事件订阅拓扑
    const eventTopology = [];
    for (const c of allCells) {
      if (typeof c.code === 'string' && c.code) {
        const emitMatches = c.code.match(/api\.emit\(['"](\w+)['"]/g);
        const onMatches = c.code.match(/api\.on\(['"](\w+)['"]/g);
        if (emitMatches || onMatches) {
          eventTopology.push({
            cellId: c.id,
            name: c.name,
            emits: emitMatches ? emitMatches.map(m => m.match(/['"](\w+)['"]/)?.[1]).filter(Boolean) : [],
            listens: onMatches ? onMatches.map(m => m.match(/['"](\w+)['"]/)?.[1]).filter(Boolean) : []
          });
        }
      }
    }

    _worldSummaryCache = {
      totalCells: allCells.length,
      kindCounts,
      cells: cellList,
      eventTopology
    };
    _worldSummaryDirty = false;

    return _worldSummaryCache;
  }

  // ===== L3: 成功模式库 =====
  async function _loadPatterns() {
    if (_persistLayer) {
      const saved = await _persistLayer.loadSetting('ai_patterns');
      if (saved) _patterns = saved;
    }
  }

  async function _savePatterns() {
    if (_persistLayer) {
      await _persistLayer.saveSetting('ai_patterns', _patterns);
    }
  }

  function addPattern(cellId, description, code, kind) {
    // 避免重复
    const existing = _patterns.findIndex(p => p.description === description);
    if (existing !== -1) {
      _patterns[existing].code = code;
      _patterns[existing].usageCount = (_patterns[existing].usageCount || 0) + 1;
    } else {
      _patterns.push({
        description,
        code,
        kind,
        cellId,
        usageCount: 1,
        createdAt: Date.now()
      });
    }

    // 限制数量
    if (_patterns.length > MAX_PATTERNS) {
      _patterns.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
      _patterns = _patterns.slice(0, MAX_PATTERNS);
    }

    _savePatterns();
  }

  function getPatterns(kind) {
    if (kind) {
      return _patterns.filter(p => p.kind === kind);
    }
    return _patterns;
  }

  // ===== 按难度注入记忆 =====
  function buildMemoryContext(difficulty) {
    const parts = [];

    // L1: 始终注入
    parts.push(`引擎能力: ${JSON.stringify(L1_ENGINE)}`);

    // L2: 始终注入摘要
    const summary = getWorldSummary();
    parts.push(`世界概况: ${summary.totalCells}个基圆, ${JSON.stringify(summary.kindCounts)}`);

    if (difficulty === 'medium' || difficulty === 'complex') {
      // 注入事件拓扑
      if (summary.eventTopology.length > 0) {
        parts.push(`事件拓扑: ${JSON.stringify(summary.eventTopology)}`);
      }
    }

    if (difficulty === 'complex') {
      // 注入相关成功模式
      if (_patterns.length > 0) {
        const patternSummaries = _patterns.slice(0, 5).map(p => {
          const codePreview = typeof p.code === 'string' && p.code
            ? p.code.substring(0, 80)
            : '(非字符串代码)';
          return `[${p.kind}] ${p.description} → ${codePreview}...`;
        });
        parts.push(`成功模式参考:\n${patternSummaries.join('\n')}`);
      }
    }

    return parts.join('\n\n');
  }

  // ===== 给工具调用场景的 system prompt =====
  // worldContext 可选：额外注入的上下文（例如 "currentCellId"）
  function getSystemPrompt(taskType, worldContext) {
    const toolList = [
      'get_world_state() -> 返回世界摘要（基圆总数、各类数量、游戏时间）',
      'list_cells({ kind, limit, offset }) -> 查询基圆；不填 kind 查全部',
      'create_cell({ kind, x, y, name, radius, color, attributes }) -> 创建一个基圆',
      'update_cell(id, { name, radius, color, ... }) -> 修改基圆属性',
      'delete_cell({ id, kind, all }) -> 删除基圆；填 kind 删除某一类；填 all:true 清空世界',
      'set_time_speed(0~10) -> 设置游戏时间流速（0 暂停，1 正常，5 五倍速）',
      'generate_code_for(cellId, description) -> 为指定基圆生成行为代码并立即加载',
      'list_providers() -> 列出当前已配置的所有 AI 提供者及状态',
      'emit_event(eventName, data) -> 向引擎发射一个事件（例如 onUpdate, onClick）'
    ];

    const lines = [];
    lines.push('你是基圆引擎（Cell Engine v4.0）的 AI 操作员。你的职责是理解用户的自然语言请求，并通过可用工具去操作/查询引擎，然后用简洁的中文回答。');
    lines.push('');
    lines.push('=== 引擎核心 ===');
    lines.push('版本: 4.0');
    lines.push('可用基圆种类: ' + Object.keys(L1_ENGINE.kinds).join(', '));
    lines.push('触发模式: ' + Object.keys(L1_ENGINE.triggerModes).join(', '));
    lines.push('形状: ' + (L1_ENGINE.shapes || ['circle', 'rect', 'triangle']).join(', '));
    lines.push('端口类型: ' + (L1_ENGINE.portTypes || ['any', 'number', 'string', 'boolean']).join(', '));
    lines.push('');

    if (worldContext && typeof worldContext === 'string' && worldContext.length > 0) {
      lines.push('=== 当前世界快照 ===');
      lines.push(worldContext);
      lines.push('');
    }

    lines.push('=== 可用工具（通过 __TOOL_CALL__ 标记调用）===');
    lines.push('输出格式规则（严格遵守）:');
    lines.push('- 如果你可以直接回答（或你的回答只是纯信息），直接输出中文回答即可。');
    lines.push('- 如果你需要调用工具（查询/修改世界），请输出如下格式：');
    lines.push('    __TOOL_CALL__[{"name":"工具名","params":{...}}]');
    lines.push('  注意：一次只调用一个工具。等待工具执行结果后再做下一步。');
    lines.push('- 当需要创建/修改多个基圆时，可以一次传多个调用：');
    lines.push('    __TOOL_CALL__[{"name":"create_cell","params":{...}},{"name":"create_cell","params":{...}}]');
    lines.push('- 工具执行后，引擎会把结果再喂给你，请你把工具结果翻译成自然语言回答用户。');
    lines.push('');
    lines.push('工具列表（按需要选择合适的工具）：');
    for (let i = 0; i < toolList.length; i++) {
      lines.push('  ' + (i + 1) + '. ' + toolList[i]);
    }
    lines.push('');
    lines.push('=== 重要约束 ===');
    lines.push('1. 回答用户必须用简洁的中文，不需要解释底层实现。');
    lines.push('2. 如果一个问题无法由任何工具解决，请明确告知用户能做什么。');
    lines.push('3. 不要暴露 __TOOL_CALL__ 给最终用户（引擎会在后台解析），你的最终自然语言回答中不应再出现 __TOOL_CALL__。');
    lines.push('4. 调用 generate_code_for 工具时，请同时提供 cellId 与行为描述。');

    return lines.join('\n');
  }

  return {
    init,
    getEngineCapabilities,
    getWorldSummary,
    addPattern,
    getPatterns,
    buildMemoryContext,
    getSystemPrompt
  };
})();

// 挂载到 window 以便其他模块通过 window.AiMemory 访问
if (typeof window !== 'undefined') {
  window.AiMemory = AiMemory;
}
