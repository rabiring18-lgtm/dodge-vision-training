// Protocol 05 diagonal pass tuning
// Adjacent passes keep their current speed; diagonal passes travel at 2x speed.

const originalRondoTapForDiagonalSpeed = tap;
canvas.removeEventListener('pointerdown', originalRondoTapForDiagonalSpeed);

tap = function(e) {
  if (!state || state.t.phase !== 'choosing') return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const t = state.t;
  let chosen = -1;
  let best = Infinity;

  t.players.forEach((player, index) => {
    if (index === t.holder) return;
    const distance = Math.hypot(player.x - x, player.y - y);
    if (distance < best) {
      best = distance;
      chosen = index;
    }
  });

  if (chosen < 0 || best > Math.max(38, Math.min(w, h) * .09)) return;

  clearTimeout(decisionTimer);

  const fromIndex = t.holder;
  const from = t.players[fromIndex];
  const to = t.players[chosen];
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const isDiagonal = (chosen - fromIndex + 4) % 4 === 2;
  const speedMultiplier = isDiagonal ? 2 : 1;
  const duration = distance / (Math.min(w, h) * t.d.passSpeed * speedMultiplier) * 1000;

  t.phase = 'passing';
  t.pass = {
    from: fromIndex,
    to: chosen,
    started: performance.now(),
    duration,
    isDiagonal,
    speedMultiplier
  };

  $('#instruction').textContent = isDiagonal ? '対角線高速パス' : 'パスコースを確認';
  $('#timer').className = 'timer';
};

canvas.addEventListener('pointerdown', tap);
