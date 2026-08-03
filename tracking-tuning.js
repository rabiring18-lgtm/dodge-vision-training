// Protocol 04 tuning override
// - Always use seven balls
// - Double the original movement speed
// - Double the original tracking duration

difficulty = function(level) {
  level = clamp(Math.round(level), 1, MAX_LEVEL);

  return {
    level,
    count: 7,
    speed: (.115 + (level - 1) * .0065) * 2,
    trackTime: (2350 + (level - 1) * 58) * 2,
    targetTime: 900 - (level - 1) * 15,
    answerLimit: 2600 - (level - 1) * 48,
    radius: .042 - (level - 1) * .00065
  };
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
