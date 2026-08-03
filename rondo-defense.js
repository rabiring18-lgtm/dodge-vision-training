// Protocol 05 defensive AI override
// Two defenders keep moving through each five-pass set:
// one presses the ball holder while the other predicts and blocks a likely lane.

const originalRondoDifficulty = difficulty;
const originalRondoMakeTrial = makeTrial;
const originalRondoFinishPass = finishPass;
const originalRondoFinish = finish;

difficulty = function(level) {
  const d = originalRondoDifficulty(level);
  level = clamp(Math.round(level), 1, MAX_LEVEL);

  return {
    ...d,
    defenders: 2,
    defenderSpeed: .175 + (level - 1) * .0105,
    predictionBias: .48 + (level - 1) * .018,
    replanMin: Math.max(430, 880 - (level - 1) * 18),
    replanMax: Math.max(720, 1320 - (level - 1) * 22),
    roleSwapChance: Math.min(.62, .28 + (level - 1) * .017),
    randomReadChance: Math.max(.16, .34 - (level - 1) * .007)
  };
};

makeDefenders = function(d) {
  const size = Math.min(w, h);
  const angle = Math.random() * Math.PI * 2;
  const radius = size * (.075 + Math.random() * .045);

  return [0, 1].map(index => {
    const a = angle + index * Math.PI;
    return {
      x: w / 2 + Math.cos(a) * radius,
      y: h / 2 + Math.sin(a) * radius,
      vx: 0,
      vy: 0,
      role: index === 0 ? 'press' : 'block',
      tempo: .92 + Math.random() * .16,
      sway: (Math.random() < .5 ? -1 : 1) * (.018 + Math.random() * .026)
    };
  });
};

function weightedChoice(items) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)]?.index;
  let cursor = Math.random() * total;
  for (const item of items) {
    cursor -= Math.max(0, item.weight);
    if (cursor <= 0) return item.index;
  }
  return items[items.length - 1]?.index;
}

function choosePredictedReceiver(t) {
  const holder = t.holder;
  const candidates = [0, 1, 2, 3].filter(index => index !== holder);

  // Sometimes make a deliberately imperfect read. This prevents the same
  // defensive answer from appearing every possession.
  if (Math.random() < t.d.randomReadChance) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const clockwise = (holder + 1) % 4;
  const counterClockwise = (holder + 3) % 4;
  const opposite = (holder + 2) % 4;
  const history = t.passHistory || [];
  const last = history[history.length - 1];
  const previous = history[history.length - 2];

  const weights = candidates.map(index => ({ index, weight: 1 }));
  const add = (index, value) => {
    const item = weights.find(entry => entry.index === index);
    if (item) item.weight += value;
  };

  // Slightly favour the natural next pass in either direction so both lanes
  // can look dangerous instead of leaving one permanent safe answer.
  add(clockwise, 1.15);
  add(counterClockwise, 1.15);
  add(opposite, .55);

  if (last) {
    const direction = (last.to - last.from + 4) % 4;
    if (direction === 1) add(clockwise, 3.4 * t.d.predictionBias);
    if (direction === 3) add(counterClockwise, 3.4 * t.d.predictionBias);
    if (direction === 2) {
      add(clockwise, 1.35 * t.d.predictionBias);
      add(counterClockwise, 1.35 * t.d.predictionBias);
    }
  }

  // Repeating the same rotational direction twice is read more strongly.
  if (last && previous) {
    const lastDirection = (last.to - last.from + 4) % 4;
    const previousDirection = (previous.to - previous.from + 4) % 4;
    if (lastDirection === previousDirection && lastDirection === 1) {
      add(clockwise, 4.2 * t.d.predictionBias);
    }
    if (lastDirection === previousDirection && lastDirection === 3) {
      add(counterClockwise, 4.2 * t.d.predictionBias);
    }
  }

  // The defender also remembers which receiver has been used most often in
  // the current set, but does not follow this information perfectly.
  const counts = t.targetCounts || [0, 0, 0, 0];
  candidates.forEach(index => add(index, counts[index] * .72 * t.d.predictionBias));

  // Avoid visibly camping on the same lane every time.
  if (t.predictedReceiver !== undefined) add(t.predictedReceiver, -.85);

  return weightedChoice(weights);
}

function assignDefensivePlan(t, forceRoleChange = false) {
  if (!t || !t.defenders?.length) return;

  if (forceRoleChange || Math.random() < t.d.roleSwapChance) {
    const pressIndex = Math.random() < .5 ? 0 : 1;
    t.defenders.forEach((defender, index) => {
      defender.role = index === pressIndex ? 'press' : 'block';
      defender.tempo = .91 + Math.random() * .18;
      defender.sway = (Math.random() < .5 ? -1 : 1) * (.016 + Math.random() * .034);
    });
  }

  t.predictedReceiver = choosePredictedReceiver(t);
  t.laneRatio = .40 + Math.random() * .31;
  t.pressDepth = .12 + Math.random() * .13;
  t.planSide = Math.random() < .5 ? -1 : 1;
  t.nextReplanAt = performance.now() + t.d.replanMin + Math.random() * (t.d.replanMax - t.d.replanMin);
}

makeTrial = function(level, holder) {
  const t = originalRondoMakeTrial(level, holder);
  t.passHistory = [];
  t.targetCounts = [0, 0, 0, 0];
  t.predictedReceiver = undefined;
  assignDefensivePlan(t, true);
  return t;
};

function moveToward(defender, tx, ty, speed, dt) {
  const dx = tx - defender.x;
  const dy = ty - defender.y;
  const length = Math.hypot(dx, dy) || 1;
  defender.vx = dx / length * speed;
  defender.vy = dy / length * speed;
  defender.x += defender.vx * dt;
  defender.y += defender.vy * dt;
}

moveDefenders = function(dt) {
  if (!state || !state.t || state.t.phase === 'done') return;

  const t = state.t;
  const d = t.d;
  const size = Math.min(w, h);
  const holder = t.players[t.holder];
  const now = performance.now();

  // While the user is deciding, defenders occasionally change their read or
  // exchange jobs. The motion remains continuous; positions are never reset.
  if (t.phase === 'choosing' && now >= (t.nextReplanAt || 0)) {
    assignDefensivePlan(t, false);
  }

  for (const defender of t.defenders) {
    let tx = w / 2;
    let ty = h / 2;
    let speedMultiplier = defender.role === 'press' ? 1.08 : .94;

    if (t.phase === 'passing' && t.pass) {
      const from = t.players[t.pass.from];
      const to = t.players[t.pass.to];

      if (defender.role === 'block') {
        const nearest = nearestPoint(from.x, from.y, to.x, to.y, defender.x, defender.y);
        const ratio = clamp(nearest.t + .10, .25, .82);
        tx = from.x + (to.x - from.x) * ratio;
        ty = from.y + (to.y - from.y) * ratio;
        speedMultiplier = 1.08;
      } else {
        // The presser releases the old holder and closes the receiver.
        tx = from.x + (to.x - from.x) * .84;
        ty = from.y + (to.y - from.y) * .84;
        speedMultiplier = 1.02;
      }
    } else if (defender.role === 'press') {
      // Close the ball holder from a slightly different inside angle each
      // possession rather than running to the exact same point.
      const cx = w / 2;
      const cy = h / 2;
      const dx = cx - holder.x;
      const dy = cy - holder.y;
      const length = Math.hypot(dx, dy) || 1;
      const perpendicularX = -dy / length;
      const perpendicularY = dx / length;
      tx = holder.x + dx * t.pressDepth + perpendicularX * size * defender.sway;
      ty = holder.y + dy * t.pressDepth + perpendicularY * size * defender.sway;
    } else {
      // Stand in a predicted lane, not directly on the receiver. The lane
      // ratio and side offset change every read, creating genuine choices.
      const receiver = t.players[t.predictedReceiver] || t.players[(t.holder + 2) % 4];
      const dx = receiver.x - holder.x;
      const dy = receiver.y - holder.y;
      const length = Math.hypot(dx, dy) || 1;
      const perpendicularX = -dy / length;
      const perpendicularY = dx / length;
      const offset = size * defender.sway * t.planSide;
      tx = holder.x + dx * t.laneRatio + perpendicularX * offset;
      ty = holder.y + dy * t.laneRatio + perpendicularY * offset;
    }

    const speed = size * d.defenderSpeed * speedMultiplier * defender.tempo;
    moveToward(defender, tx, ty, speed, dt);

    const margin = size * .115;
    defender.x = clamp(defender.x, margin, w - margin);
    defender.y = clamp(defender.y, margin, h - margin);
  }
};

finishPass = function(success, intercepted = false, timedOut = false) {
  const t = state?.t;
  const completedPass = t?.pass ? { from: t.pass.from, to: t.pass.to } : null;

  if (success && t && completedPass) {
    t.passHistory = t.passHistory || [];
    t.targetCounts = t.targetCounts || [0, 0, 0, 0];
    t.passHistory.push(completedPass);
    t.targetCounts[completedPass.to] += 1;
  }

  originalRondoFinishPass(success, intercepted, timedOut);

  // The chain script has already changed possession at this point. Give the
  // same continuously moving defenders a fresh, partly random defensive plan.
  if (success && t && state?.t === t && t.phase === 'choosing') {
    assignDefensivePlan(t, true);
  }
};

finish = function() {
  originalRondoFinish();
  const rate = rateFor(2);
  const rates = $('#passRates');
  if (rates) {
    rates.innerHTML = `<div><span>2 DEFENDERS</span><strong>${rate === null ? '--' : rate + '%'}</strong></div>` +
      `<div><span>PREDICTIVE DEFENSE</span><strong>ACTIVE</strong></div>` +
      `<div><span>MAX PASS STREAK</span><strong>${session?.maxStreak || 0}</strong></div>`;
  }
};
