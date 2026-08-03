// Protocol 05 defender spacing tuning
// Keep the two defenders spread while the user is deciding, without forcing
// them away from an active pass lane. Once a pass starts, both defenders are
// free to attack and intercept the ball.

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

  // Keep double pressure wide enough to create two distinct approaches,
  // while still allowing both defenders to collapse on the actual pass.
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

function preserveDecisionGap(t) {
  if (!t?.defenders || t.defenders.length < 2 || t.phase !== 'choosing') return;

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

  // Maintain visible separation only before the pass is selected. This keeps
  // the defensive picture readable without opening a guaranteed corridor.
  const minimumGap = size * .32;

  if (distance < minimumGap) {
    const ux = dx / distance;
    const uy = dy / distance;
    const push = (minimumGap - distance) / 2;

    first.x -= ux * push;
    first.y -= uy * push;
    second.x += ux * push;
    second.y += uy * push;
  }

  clampDefenderToCourt(first, size);
  clampDefenderToCourt(second, size);
}

moveDefenders = function(dt) {
  originalRondoMoveDefendersForSpacing(dt);

  if (state?.t && state.t.phase !== 'done') {
    preserveDecisionGap(state.t);
  }
};
