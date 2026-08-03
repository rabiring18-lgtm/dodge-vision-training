// Protocol 05 defensive AI override
// Two defenders keep moving through each five-pass set.
// Their tactical plan changes between possessions, with six distinct patterns.

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
    // Roughly 1.6–1.8x faster than the previous defensive tuning.
    defenderSpeed: .32 + (level - 1) * .014,
    predictionBias: .52 + (level - 1) * .019,
    replanMin: Math.max(250, 560 - (level - 1) * 12),
    replanMax: Math.max(440, 840 - (level - 1) * 16),
    randomReadChance: Math.max(.13, .31 - (level - 1) * .007),
    passReactionBoost: 1.24 + (level - 1) * .012
  };
};

makeDefenders = function(d) {
  const size = Math.min(w, h);
  const angle = Math.random() * Math.PI * 2;
  const radius = size * (.07 + Math.random() * .055);

  return [0, 1].map(index => {
    const a = angle + index * Math.PI;
    return {
      x: w / 2 + Math.cos(a) * radius,
      y: h / 2 + Math.sin(a) * radius,
      vx: 0,
      vy: 0,
      task: index === 0 ? 'press' : 'lane',
      receiver: null,
      tempo: .94 + Math.random() * .18,
      curve: (Math.random() < .5 ? -1 : 1) * (.025 + Math.random() * .045),
      depth: .16,
      fakeUntil: 0,
      phase: Math.random() * Math.PI * 2
    };
  });
};

function weightedChoice(items) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)]?.value;

  let cursor = Math.random() * total;
  for (const item of items) {
    cursor -= Math.max(0, item.weight);
    if (cursor <= 0) return item.value;
  }
  return items[items.length - 1]?.value;
}

function passDirection(from, to) {
  return (to - from + 4) % 4;
}

function likelyReceiver(t) {
  const holder = t.holder;
  const clockwise = (holder + 1) % 4;
  const counter = (holder + 3) % 4;
  const opposite = (holder + 2) % 4;
  const history = t.passHistory || [];
  const last = history[history.length - 1];
  const previous = history[history.length - 2];

  if (Math.random() < t.d.randomReadChance) {
    return [clockwise, counter, opposite][Math.floor(Math.random() * 3)];
  }

  const options = [
    { value: clockwise, weight: 1.35 },
    { value: counter, weight: 1.35 },
    { value: opposite, weight: .72 }
  ];

  const add = (receiver, amount) => {
    const item = options.find(option => option.value === receiver);
    if (item) item.weight += amount;
  };

  if (last) {
    const direction = passDirection(last.from, last.to);
    if (direction === 1) add(clockwise, 3.8 * t.d.predictionBias);
    if (direction === 3) add(counter, 3.8 * t.d.predictionBias);
    if (direction === 2) add(opposite, 2.35 * t.d.predictionBias);
  }

  if (last && previous) {
    const lastDirection = passDirection(last.from, last.to);
    const previousDirection = passDirection(previous.from, previous.to);
    if (lastDirection === previousDirection) {
      if (lastDirection === 1) add(clockwise, 4.8 * t.d.predictionBias);
      if (lastDirection === 3) add(counter, 4.8 * t.d.predictionBias);
      if (lastDirection === 2) add(opposite, 3.2 * t.d.predictionBias);
    }
  }

  const counts = t.targetCounts || [0, 0, 0, 0];
  [clockwise, counter, opposite].forEach(receiver => {
    add(receiver, counts[receiver] * .74 * t.d.predictionBias);
  });

  return weightedChoice(options);
}

function chooseDefensePlan(t) {
  const history = t.passHistory || [];
  const last = history[history.length - 1];
  const previous = history[history.length - 2];
  const weights = [
    { value: 'press-clockwise', weight: 1.3 },
    { value: 'press-counter', weight: 1.3 },
    { value: 'press-opposite', weight: 1.0 },
    { value: 'double-trap', weight: .9 },
    { value: 'split-lanes', weight: 1.0 },
    { value: 'fake-jump', weight: 1.05 }
  ];

  const add = (plan, amount) => {
    const item = weights.find(entry => entry.value === plan);
    if (item) item.weight += amount;
  };

  if (last) {
    const direction = passDirection(last.from, last.to);
    if (direction === 1) add('press-clockwise', 2.2 * t.d.predictionBias);
    if (direction === 3) add('press-counter', 2.2 * t.d.predictionBias);
    if (direction === 2) add('press-opposite', 1.8 * t.d.predictionBias);
  }

  if (last && previous && passDirection(last.from, last.to) === passDirection(previous.from, previous.to)) {
    add('split-lanes', 1.3 * t.d.predictionBias);
    add('fake-jump', 1.15 * t.d.predictionBias);
  }

  return weightedChoice(weights);
}

function setTask(defender, task, receiver = null, options = {}) {
  defender.task = task;
  defender.receiver = receiver;
  defender.tempo = options.tempo ?? (.94 + Math.random() * .18);
  defender.curve = options.curve ?? ((Math.random() < .5 ? -1 : 1) * (.025 + Math.random() * .05));
  defender.depth = options.depth ?? (.14 + Math.random() * .22);
  defender.fakeUntil = options.fakeUntil ?? 0;
  defender.phase = Math.random() * Math.PI * 2;
}

function assignDefensivePlan(t) {
  if (!t || !t.defenders?.length) return;

  const holder = t.holder;
  const clockwise = (holder + 1) % 4;
  const counter = (holder + 3) % 4;
  const opposite = (holder + 2) % 4;
  const predicted = likelyReceiver(t);
  const plan = chooseDefensePlan(t);
  const firstPress = Math.random() < .5 ? 0 : 1;
  const second = 1 - firstPress;
  const now = performance.now();

  t.plan = plan;
  t.predictedReceiver = predicted;
  t.planStarted = now;

  switch (plan) {
    case 'press-clockwise':
      setTask(t.defenders[firstPress], 'press', holder, { tempo: 1.12 + Math.random() * .12 });
      setTask(t.defenders[second], 'lane', clockwise, { depth: .40 + Math.random() * .22 });
      break;

    case 'press-counter':
      setTask(t.defenders[firstPress], 'press', holder, { tempo: 1.12 + Math.random() * .12 });
      setTask(t.defenders[second], 'lane', counter, { depth: .40 + Math.random() * .22 });
      break;

    case 'press-opposite':
      setTask(t.defenders[firstPress], 'press', holder, { tempo: 1.08 + Math.random() * .15 });
      setTask(t.defenders[second], 'lane', opposite, { depth: .34 + Math.random() * .24 });
      break;

    case 'double-trap':
      setTask(t.defenders[0], 'trap-left', holder, { tempo: 1.10 + Math.random() * .14, curve: -.09 });
      setTask(t.defenders[1], 'trap-right', holder, { tempo: 1.10 + Math.random() * .14, curve: .09 });
      break;

    case 'split-lanes':
      setTask(t.defenders[0], 'lane', clockwise, { depth: .34 + Math.random() * .28, tempo: 1.02 + Math.random() * .13 });
      setTask(t.defenders[1], 'lane', counter, { depth: .34 + Math.random() * .28, tempo: 1.02 + Math.random() * .13 });
      break;

    case 'fake-jump':
    default:
      setTask(t.defenders[firstPress], 'fake-press', predicted, {
        tempo: 1.08 + Math.random() * .16,
        fakeUntil: now + 180 + Math.random() * 250,
        depth: .40 + Math.random() * .24
      });
      setTask(t.defenders[second], Math.random() < .5 ? 'shadow' : 'lane', opposite, {
        tempo: .98 + Math.random() * .16,
        depth: .30 + Math.random() * .24
      });
      break;
  }

  t.nextReplanAt = now + t.d.replanMin + Math.random() * (t.d.replanMax - t.d.replanMin);
}

makeTrial = function(level, holder) {
  const t = originalRondoMakeTrial(level, holder);
  t.passHistory = [];
  t.targetCounts = [0, 0, 0, 0];
  t.predictedReceiver = undefined;
  assignDefensivePlan(t);
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

function laneTarget(t, receiverIndex, depth, curve) {
  const size = Math.min(w, h);
  const holder = t.players[t.holder];
  const receiver = t.players[receiverIndex] || t.players[(t.holder + 2) % 4];
  const dx = receiver.x - holder.x;
  const dy = receiver.y - holder.y;
  const length = Math.hypot(dx, dy) || 1;
  const px = -dy / length;
  const py = dx / length;

  return {
    x: holder.x + dx * depth + px * size * curve,
    y: holder.y + dy * depth + py * size * curve
  };
}

function pressTarget(t, defender, side = 0) {
  const size = Math.min(w, h);
  const holder = t.players[t.holder];
  const cx = w / 2;
  const cy = h / 2;
  const dx = cx - holder.x;
  const dy = cy - holder.y;
  const length = Math.hypot(dx, dy) || 1;
  const px = -dy / length;
  const py = dx / length;
  const movingCurve = defender.curve + Math.sin(performance.now() / 145 + defender.phase) * .018;

  return {
    x: holder.x + dx * (.105 + defender.depth * .20) + px * size * (movingCurve + side),
    y: holder.y + dy * (.105 + defender.depth * .20) + py * size * (movingCurve + side)
  };
}

moveDefenders = function(dt) {
  if (!state || !state.t || state.t.phase === 'done') return;

  const t = state.t;
  const d = t.d;
  const size = Math.min(w, h);
  const now = performance.now();

  if (t.phase === 'choosing' && now >= (t.nextReplanAt || 0)) {
    // Occasionally switch the entire defensive idea while preserving positions.
    if (Math.random() < .58) assignDefensivePlan(t);
    else t.nextReplanAt = now + t.d.replanMin + Math.random() * (t.d.replanMax - t.d.replanMin);
  }

  t.defenders.forEach((defender, index) => {
    let target = { x: w / 2, y: h / 2 };
    let speedMultiplier = defender.tempo;

    if (t.phase === 'passing' && t.pass) {
      const from = t.players[t.pass.from];
      const to = t.players[t.pass.to];
      const actualReceiver = t.pass.to;

      if (defender.task === 'lane' && defender.receiver === actualReceiver) {
        const nearest = nearestPoint(from.x, from.y, to.x, to.y, defender.x, defender.y);
        const ratio = clamp(nearest.t + .18, .22, .84);
        target = {
          x: from.x + (to.x - from.x) * ratio,
          y: from.y + (to.y - from.y) * ratio
        };
        speedMultiplier *= d.passReactionBoost * 1.10;
      } else if (defender.task === 'fake-press' || defender.task.startsWith('trap')) {
        const ratio = index === 0 ? .68 : .88;
        target = {
          x: from.x + (to.x - from.x) * ratio,
          y: from.y + (to.y - from.y) * ratio
        };
        speedMultiplier *= d.passReactionBoost * 1.08;
      } else if (defender.task === 'press') {
        target = {
          x: from.x + (to.x - from.x) * .92,
          y: from.y + (to.y - from.y) * .92
        };
        speedMultiplier *= d.passReactionBoost;
      } else {
        const nearest = nearestPoint(from.x, from.y, to.x, to.y, defender.x, defender.y);
        target = {
          x: from.x + (to.x - from.x) * clamp(nearest.t + .08, .18, .76),
          y: from.y + (to.y - from.y) * clamp(nearest.t + .08, .18, .76)
        };
        speedMultiplier *= d.passReactionBoost * .98;
      }
    } else {
      switch (defender.task) {
        case 'press':
          target = pressTarget(t, defender, 0);
          speedMultiplier *= 1.12;
          break;

        case 'trap-left':
          target = pressTarget(t, defender, -.085);
          speedMultiplier *= 1.16;
          break;

        case 'trap-right':
          target = pressTarget(t, defender, .085);
          speedMultiplier *= 1.16;
          break;

        case 'fake-press':
          if (now < defender.fakeUntil) {
            target = pressTarget(t, defender, index === 0 ? -.04 : .04);
            speedMultiplier *= 1.10;
          } else {
            target = laneTarget(t, defender.receiver, defender.depth, defender.curve);
            speedMultiplier *= 1.28;
          }
          break;

        case 'shadow': {
          const receiver = t.players[defender.receiver] || t.players[(t.holder + 2) % 4];
          const holder = t.players[t.holder];
          target = {
            x: receiver.x + (holder.x - receiver.x) * (.18 + defender.depth * .18),
            y: receiver.y + (holder.y - receiver.y) * (.18 + defender.depth * .18)
          };
          speedMultiplier *= 1.03;
          break;
        }

        case 'lane':
        default:
          target = laneTarget(t, defender.receiver, defender.depth, defender.curve);
          speedMultiplier *= 1.06;
          break;
      }
    }

    const speed = size * d.defenderSpeed * speedMultiplier;
    moveToward(defender, target.x, target.y, speed, dt);

    const margin = size * .108;
    defender.x = clamp(defender.x, margin, w - margin);
    defender.y = clamp(defender.y, margin, h - margin);
  });
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

  // The same defenders remain on the court, but receive a new tactical plan.
  if (success && t && state?.t === t && t.phase === 'choosing') {
    assignDefensivePlan(t);
  }
};

finish = function() {
  originalRondoFinish();
  const rate = rateFor(2);
  const rates = $('#passRates');

  if (rates) {
    rates.innerHTML = `<div><span>2 DEFENDERS</span><strong>${rate === null ? '--' : rate + '%'}</strong></div>` +
      `<div><span>DEFENSE PLANS</span><strong>6 TYPES</strong></div>` +
      `<div><span>MAX PASS STREAK</span><strong>${session?.maxStreak || 0}</strong></div>`;
  }
};
