// Protocol 04 elite tuning override
// - Always use seven balls
// - Five times the original movement speed
// - Keep the doubled tracking duration
// - Smaller balls and shorter target preview
// - Several balls make unpredictable direction changes during tracking

difficulty = function(level) {
  level = clamp(Math.round(level), 1, MAX_LEVEL);

  return {
    level,
    count: 7,
    speed: (.115 + (level - 1) * .0065) * 5,
    trackTime: (2350 + (level - 1) * 58) * 2,
    targetTime: Math.max(420, 650 - (level - 1) * 12),
    answerLimit: 2400 - (level - 1) * 42,
    radius: (.042 - (level - 1) * .00065) * .78,
    turnInterval: Math.max(.38, .82 - (level - 1) * .021),
    turnAngle: Math.min(Math.PI * .30, Math.PI * (.13 + (level - 1) * .007))
  };
};

// Use a smaller minimum radius than the original game so the size setting
// remains effective on phones with a short landscape viewport.
createBalls = function(d) {
  const r = Math.max(11, Math.min(w, h) * d.radius);
  const pad = r + 18;
  const balls = [];

  for (let i = 0; i < d.count; i++) {
    let x;
    let y;
    let tries = 0;

    do {
      x = pad + Math.random() * (w - pad * 2);
      y = pad + Math.random() * (h - pad * 2);
      tries++;
    } while (
      tries < 220 &&
      balls.some(ball => Math.hypot(ball.x - x, ball.y - y) < r * 2.55)
    );

    const angle = Math.random() * Math.PI * 2;
    const speed = Math.min(w, h) * d.speed * (.90 + Math.random() * .20);

    balls.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r
    });
  }

  return balls;
};

const originalTrackingPhysics = updatePhysics;
let trackingTurnElapsed = 0;
let trackingTurnTrialId = null;

function rotateVelocity(ball, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const vx = ball.vx * cos - ball.vy * sin;
  const vy = ball.vx * sin + ball.vy * cos;
  ball.vx = vx;
  ball.vy = vy;
}

function applyRandomCuts() {
  if (!state || state.phase !== 'tracking') return;

  const balls = state.t.balls;
  const d = state.t.d;
  const indexes = balls.map((_, index) => index);

  // Change three or four balls on each cut. The target is treated exactly
  // like every other ball, so it never receives a distinctive movement cue.
  for (let i = indexes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }

  const changeCount = Math.random() < .5 ? 3 : 4;
  indexes.slice(0, changeCount).forEach(index => {
    const magnitude = d.turnAngle * (.45 + Math.random() * .55);
    const direction = Math.random() < .5 ? -1 : 1;
    rotateVelocity(balls[index], magnitude * direction);
  });
}

updatePhysics = function(dt) {
  if (state && state.phase === 'tracking') {
    if (trackingTurnTrialId !== state.t.id) {
      trackingTurnTrialId = state.t.id;
      trackingTurnElapsed = 0;
    }

    trackingTurnElapsed += dt;
  }

  originalTrackingPhysics(dt);

  if (
    state &&
    state.phase === 'tracking' &&
    trackingTurnElapsed >= state.t.d.turnInterval
  ) {
    trackingTurnElapsed = 0;
    applyRandomCuts();
  }
};

const originalTrackingFinish = finish;
finish = function() {
  originalTrackingFinish();

  const rate = countRate(7);
  const rates = document.querySelector('#countRates');
  const maxBalls = document.querySelector('#maxBalls');
  const ballCount = document.querySelector('#ballCount');

  if (rates) {
    rates.innerHTML = `<div><span>7 BALLS</span><strong>${rate === null ? '--' : rate + '%'}</strong></div>`;
  }
  if (maxBalls) maxBalls.textContent = '7個';
  if (ballCount) ballCount.textContent = '7 BALLS';
};
