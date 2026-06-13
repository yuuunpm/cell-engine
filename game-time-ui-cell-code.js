// ===== 游戏时间显示基圆（最终版）=====
// 功能：实时显示游戏时间 + 直接点击速度按钮切换

api.setTriggerMode('event');

api.setProperty('name', '⏰ 游戏时间');
api.setProperty('radius', 70);
api.setProperty('shape', 'circle');
api.setProperty('color', '#1e293b');

// 设置为固定屏幕位置（普通模式下不随地图移动/缩放，固定在编辑模式放置的位置）
api.setProperty('screenFixed', true);

if (api.getProperty('currentSpeed') === undefined) {
  api.setProperty('currentSpeed', 1);
}

api.on('onUpdate', function(dt) {
  if (typeof window !== 'undefined' && window.DevConsole) {
    window.DevConsole.ensureGameTimeStarted();
    api.setProperty('currentSpeed', window.DevConsole.getTimeSpeed());
  }
});

// 点击事件：根据点击位置判断点击了哪个速度按钮
api.on('onClick', function(data) {
  const speeds = [0, 1, 2, 5];
  const radius = 70;
  
  // 计算点击位置相对于基圆中心的偏移
  // data.worldX/worldY 在屏幕固定模式下是屏幕坐标偏移
  let clickX = 0;
  let clickY = 0;
  if (data && data.worldX !== undefined) {
    clickX = data.worldX;
    clickY = data.worldY;
  }
  
  // 速度按钮区域检测
  const itemWidth = radius * 0.4;
  const itemHeight = radius * 0.25;
  const itemGap = radius * 0.08;
  const totalWidth = speeds.length * itemWidth + (speeds.length - 1) * itemGap;
  const startX = -totalWidth / 2;
  const startY = radius * 0.9;

  for (let i = 0; i < speeds.length; i++) {
    const x = startX + i * (itemWidth + itemGap);
    if (clickX >= x && clickX <= x + itemWidth && clickY >= startY && clickY <= startY + itemHeight) {
      const newSpeed = speeds[i];
      api.setProperty('currentSpeed', newSpeed);
      api.sendCommand('setTimeSpeed', { speed: newSpeed });
      return;
    }
  }
  
  // 如果没点到按钮，循环切换速度
  const currentSpeed = api.getProperty('currentSpeed') || 1;
  const currentIndex = speeds.indexOf(currentSpeed);
  const newIndex = (currentIndex + 1) % speeds.length;
  const newSpeed = speeds[newIndex];
  api.setProperty('currentSpeed', newSpeed);
  api.sendCommand('setTimeSpeed', { speed: newSpeed });
});

api.registerDraw(function(ctx, radius) {
  const hasDevConsole = typeof window !== 'undefined' && window.DevConsole;
  const t = hasDevConsole ? window.DevConsole.getGameTime() : null;
  const currentSpeed = hasDevConsole ? window.DevConsole.getTimeSpeed() : (api.getProperty('currentSpeed') || 1);

  const panelWidth = radius * 2.2;
  const panelHeight = radius * 2.0;
  const cornerRadius = radius * 0.2;

  let bgColor = '#1e293b';
  let borderColor = '#475569';
  let textColor = '#e2e8f0';
  let accentColor = '#94a3b8';
  
  if (t && t.isDaytime) {
    const seasonColors = {
      '春': { bg: '#f0fdf4', border: '#4ade80', text: '#064e3b', accent: '#059669' },
      '夏': { bg: '#fef3c7', border: '#fbbf24', text: '#78350f', accent: '#d97706' },
      '秋': { bg: '#ffedd5', border: '#fb923c', text: '#7c2d12', accent: '#c2410c' },
      '冬': { bg: '#e0f2fe', border: '#60a5fa', text: '#1e40af', accent: '#2563eb' }
    };
    const colors = seasonColors[t.seasonName] || seasonColors['春'];
    bgColor = colors.bg;
    borderColor = colors.border;
    textColor = colors.text;
    accentColor = colors.accent;
  }

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(-panelWidth/2, -panelHeight/2, panelWidth, panelHeight, cornerRadius);
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (t) {
    const seasonEmojis = { '春': '🌸', '夏': '☀️', '秋': '🍂', '冬': '❄️' };
    const periodEmoji = t.isDaytime ? '☀️' : '🌙';

    // 季节图标（左上）
    ctx.font = `${radius * 0.35}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accentColor;
    ctx.fillText(seasonEmojis[t.seasonName] || '🌸', -radius * 0.65, -radius * 0.55);

    // 季节名称
    ctx.font = `bold ${radius * 0.24}px sans-serif`;
    ctx.fillText(t.seasonName + '季', -radius * 0.65, -radius * 0.25);

    // 时段
    ctx.fillStyle = textColor;
    ctx.font = `${radius * 0.18}px sans-serif`;
    ctx.fillText(periodEmoji + ' ' + t.periodString, -radius * 0.65, radius * 0);

    // 大号时间显示（中间）
    ctx.fillStyle = textColor;
    ctx.font = `bold ${radius * 0.6}px 'Courier New', monospace`;
    ctx.fillText(t.timeString, radius * 0.1, -radius * 0.2);

    // 年份和日期
    ctx.font = `${radius * 0.18}px sans-serif`;
    ctx.fillStyle = accentColor;
    ctx.fillText(`${t.year}年 第${t.day}日`, radius * 0.1, radius * 0.15);

    // 日期进度条
    const progressWidth = radius * 1.4;
    const progressHeight = radius * 0.05;
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.roundRect(-progressWidth/2 + radius * 0.1, radius * 0.35, progressWidth, progressHeight, progressHeight/2);
    ctx.fill();
    
    const dayProgress = (t.day - 1) / 30;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(-progressWidth/2 + radius * 0.1, radius * 0.35, progressWidth * dayProgress, progressHeight, progressHeight/2);
    ctx.fill();

  } else {
    ctx.fillStyle = '#9ca3af';
    ctx.font = `${radius * 0.35}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏰', 0, -radius * 0.1);
    ctx.font = `${radius * 0.45}px 'Courier New', monospace`;
    ctx.fillText('--:--', 0, radius * 0.3);
  }

  // 速度按钮组（可直接点击）
  const speedItems = [
    { value: 0, label: '⏸', desc: '暂停', color: '#ef4444' },
    { value: 1, label: '1x', desc: '正常', color: '#22c55e' },
    { value: 2, label: '2x', desc: '快速', color: '#3b82f6' },
    { value: 5, label: '5x', desc: '极速', color: '#a855f7' }
  ];

  const itemWidth = radius * 0.4;
  const itemHeight = radius * 0.25;
  const itemGap = radius * 0.08;
  const totalWidth = speedItems.length * itemWidth + (speedItems.length - 1) * itemGap;
  const startX = -totalWidth / 2;
  const startY = radius * 0.9;

  speedItems.forEach((item, i) => {
    const x = startX + i * (itemWidth + itemGap);
    const isActive = Math.round(currentSpeed) === item.value;

    ctx.fillStyle = isActive ? item.color : 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.roundRect(x, startY, itemWidth, itemHeight, radius * 0.1);
    ctx.fill();

    if (isActive) {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = isActive ? '#ffffff' : textColor;
    ctx.font = `bold ${radius * 0.18}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, x + itemWidth/2, startY + itemHeight/2);
  });

  // 提示文字
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.font = `${radius * 0.12}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('点击按钮切换速度', 0, radius * 1.3);

});
