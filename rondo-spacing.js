// Protocol 05 defender spacing tuning
// Keep the two defenders spread apart so diagonal passing lanes can open.

const originalRondoMakeDefendersForSpacing = makeDefenders;
const originalRondoAssignPlanForSpacing = assignDefensivePlan;
const originalRondoMoveDefendersForSpacing = moveDefenders;

makeDefenders = function(d) {
  const defenders = originalRondoMakeDefendersForSpacing(d);
  const size = Math.min(w, h);
  const angle = Math.random() * Math.PI * 2;
  const radius = size * (.19 + Math.random() * .045);

  defenders.forEach((defender, index) => {
    const a = angle + index * Math.PI;
    defender.x = w / 2 + Math.cos(a) * radius;
    defender.y = h / 2 + Math.sin(a) * radius;
  });

  return defenders;
};

assignDefensivePlan = function(t) {
  originalRondoAssignPlanForSpacing(t);

  // The double press remains aggressive, but the two defenders approach from
  // wider angles instead of collapsing into the same central lane.
  if (t?.plan === 'double-trap' && t.defenders?.length === 2) {
    t.defenders[0].curve = -.15;
    t.defenders[1].curve = .15;
    t.defenders[0].depth = Math.max(t.defenders[0].depth || 0, .25);
    t.defenders[1].depth = Math.max(t.defenders[1].depth || 0, .25);
  }
};

function clampDefenderToCourt(defender, size) {
  const margin = size * .108;
  defender.x = clamp(defender.x, margin, w - margin);
  defender.y = clamp(defender.y, margin, h - margin);
}

function preserveWideDefenderGap(t) {
  if (!t?.defenders || t.defenders.length < 2) return;

  const size = Math.min(w, h);
  const first = t.defenders[0];
  const second = t.defenders[1];
  let dx = second.x - first.x;
  let dy = second.y - first.y;
  let distance = Math.hypot(dx, dy);

  if (distance < .001) {
    const angle = Math.random() * Math.PI * 2;
    dx = Math.cos(angle);
    dy = Math.sin(angle);
    distance = 1;
  }

  const diagonalPass = t.phase === 'passing' && t.pass?.isDiagonal;
  const minimumGap = size * (diagonalPass ? .42 : .34);

  if (distance < minimumGap) {
    const ux = dx / distance;
    const uy = dy / distance;
    const push = (minimumGap - distance) / 2;

    first.x -= ux * push;
    first.y -= uy * push;
    second.x += ux * push;
    second.y += uy * push;
  }

  // During a diagonal pass, keep the defenders on opposite sides of the pass
  // line. This opens a visible central window instead of letting both collapse
  // onto the same diagonal corridor.
  if (diagonalPass) {
    const from = t.players[t.pass.from];
    const to = t.players[t.pass.to];
    const lineX = to.x - from.x;
    const lineY = to.y - from.y;
    const lineLength = Math.hypot(lineX, lineY) || 1;
    const perpX = -lineY / lineLength;
    const perpY = lineX / lineLength;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const firstSide = (first.x - midX) * perpX + (first.y - midY) * perpY;
    const secondSide = (second.x - midX) * perpX + (second.y - midY) * perpY;
    const corridorHalfWidth = size * .15;
    const firstSign = firstSide >= secondSide ? 1 : -1;
    const secondSign = -firstSign;

    if (Math.abs(firstSide) < corridorHalfWidth || Math.sign(firstSide || firstSign) !== firstSign) {
      const correction = firstSign * corridorHalfWidth - firstSide;
      first.x += perpX * correction;
      first.y += perpY * correction;
    }

    if (Math.abs(secondSide) < corridorHalfWidth || Math.sign(secondSide || secondSign) !== secondSign) {
      const correction = secondSign * corridorHalfWidth - secondSide;
      second.x += perpX * correction;
      second.y += perpY * correction;
    }
  }

  clampDefenderToCourt(first, size);
  clampDefenderToCourt(second, size);
}

moveDefenders = function(dt) {
  originalRondoMoveDefendersForSpacing(dt);

  if (state?.t && state.t.phase !== 'done') {
    preserveWideDefenderGap(state.t);
  }
};
