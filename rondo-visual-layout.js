// Protocol 05 visual layout tuning
// Use the full square court while keeping the visible markers compact.
// The pointer hit area remains controlled by rondo.js and is intentionally larger.

playerSpots = function() {
  const edge = Math.min(w, h) * .08;
  return [
    { x: edge, y: edge },
    { x: w - edge, y: edge },
    { x: w - edge, y: h - edge },
    { x: edge, y: h - edge }
  ];
};

drawPlayer = function(p, index) {
  const holder = state?.t?.holder === index;
  const size = Math.min(w, h);
  const radius = Math.max(10, size * .028);

  circle(
    p.x,
    p.y,
    radius,
    holder ? '#ffda36' : '#67d5ff',
    holder ? '#fff3a0' : '#bcecff',
    2
  );

  ctx.fillStyle = holder ? '#312000' : '#06121e';
  ctx.font = `900 ${Math.max(10, radius * .82)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(index + 1, p.x, p.y);

  if (holder) {
    circle(p.x, p.y + radius + 7, 3, '#ffda36');
  }
};

drawDefender = function(defender) {
  const size = Math.min(w, h);
  const radius = Math.max(10, size * .027);

  circle(defender.x, defender.y, radius, '#ff6678', '#ffc0c7', 2);
  ctx.fillStyle = '#3a0811';
  ctx.font = `900 ${Math.max(9, radius * .78)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D', defender.x, defender.y);
};

drawPass = function(now) {
  const pass = state?.t?.pass;
  if (!pass) return;

  const from = state.t.players[pass.from];
  const to = state.t.players[pass.to];
  const elapsed = now - pass.started;
  const progress = clamp(elapsed / pass.duration, 0, 1);
  const x = from.x + (to.x - from.x) * progress;
  const y = from.y + (to.y - from.y) * progress;
  const size = Math.min(w, h);

  ctx.strokeStyle = 'rgba(255,218,54,.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  circle(x, y, Math.max(3.5, size * .0075), '#ffda36', '#fff5b0', 1.5);

  for (const defender of state.t.defenders) {
    if (Math.hypot(defender.x - x, defender.y - y) < size * state.t.d.interceptRadius) {
      finishPass(false, true);
      return;
    }
  }

  if (progress >= 1) finishPass(true, false);
};
