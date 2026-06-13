// ===== 开发者对话框基圆（优化版）=====
// 功能：点击弹出开发者控制台
// 使用方法：创建基圆 → 粘贴代码 → 运行

api.setTriggerMode('event');
api.setProperty('name', '开发者控制台');

// 点击事件
api.on('onClick', function(data) {
  api.openDevConsole();
});

// 自定义绘制 - 终端风格图标
api.registerDraw(function(ctx, radius) {
  const w = radius * 1.8;
  const h = radius * 1.4;
  const corner = radius * 0.25;

  // 背景面板（圆角矩形）
  ctx.fillStyle = '#1e1e2e';
  ctx.beginPath();
  ctx.roundRect(-w/2, -h/2, w, h, corner);
  ctx.fill();

  // 边框
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 顶部标题栏
  ctx.fillStyle = '#2a2a3e';
  ctx.beginPath();
  ctx.roundRect(-w/2, -h/2, w, radius * 0.4, [corner, corner, 0, 0]);
  ctx.fill();

  // 窗口控制按钮
  const btnSize = radius * 0.12;
  const btnY = -h/2 + radius * 0.2;
  
  // 关闭按钮
  ctx.fillStyle = '#ff5f56';
  ctx.beginPath();
  ctx.arc(-w/2 + radius * 0.35, btnY, btnSize, 0, Math.PI * 2);
  ctx.fill();

  // 最小化按钮
  ctx.fillStyle = '#ffbd2e';
  ctx.beginPath();
  ctx.arc(-w/2 + radius * 0.65, btnY, btnSize, 0, Math.PI * 2);
  ctx.fill();

  // 最大化按钮
  ctx.fillStyle = '#27c93f';
  ctx.beginPath();
  ctx.arc(-w/2 + radius * 0.95, btnY, btnSize, 0, Math.PI * 2);
  ctx.fill();

  // 终端图标
  ctx.fillStyle = '#4fc3f7';
  ctx.font = `bold ${radius * 0.6}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('>_', 0, radius * 0.15);

  // 标签文字
  ctx.fillStyle = '#ffffff';
  ctx.font = `${radius * 0.22}px sans-serif`;
  ctx.fillText('DEV', 0, radius * 0.55);

  // 发光效果
  ctx.shadowColor = 'rgba(79, 195, 247, 0.4)';
  ctx.shadowBlur = radius * 0.3;
  ctx.strokeStyle = 'rgba(79, 195, 247, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-w/2 + 2, -h/2 + 2, w - 4, h - 4, corner);
  ctx.stroke();
  ctx.shadowBlur = 0;
});