// Protocol 06 GOOD pass evaluation
// A completed pass to a non-adjacent numbered teammate is praised as GOOD.
// With five attackers arranged as a ring, this covers one- or two-player skips
// such as 1→3, 1→4, 2→4 and the same patterns in reverse.

const originalPossessionFinishForGoodPass = finish;

function isGoodSkipPass(from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return false;
  const directGap = Math.abs(to - from);
  const circularGap = Math.min(directGap, 5 - directGap);
  return circularGap >= 2;
}

resolvePass = function(success, label) {
  const t = state?.t;
  if (!t || t.resolved || t.phase === 'done') return;

  const fromIndex = t.pass?.from;
  const toIndex = t.pass?.to;
  const goodPass = success && isGoodSkipPass(fromIndex, toIndex);

  t.resolved = true;
  clearTimeout(decisionTimer);

  if (!success) {
    failSet(label);
    return;
  }

  const decisionMs = Math.round(t.pass.started - t.opened);
  const switched = isSwitchPass(t, fromIndex, toIndex);
  const passResult = { success: true, ms: decisionMs, switched, good: goodPass };
  session.passResults.push(passResult);

  if (switched) session.switches++;
  if (goodPass) session.goodPasses = (session.goodPasses || 0) + 1;

  t.passHistory.push({ from: fromIndex, to: toIndex });
  session.holder = toIndex;
  t.holder = toIndex;
  session.chain++;
  session.streak++;
  session.maxStreak = Math.max(session.maxStreak, session.streak);

  const feedback = $('#feedback');
  if (goodPass) {
    feedback.textContent = 'GOOD!';
    $('#instruction').textContent = `${fromIndex + 1} → ${toIndex + 1}　展開成功`;
  } else {
    feedback.textContent = `PASS ${session.chain}`;
    $('#instruction').textContent = '次の空きを探せ';
  }
  feedback.className = 'feedback show good';

  t.pass = null;
  t.phase = 'choosing';
  t.resolved = false;
  t.opened = performance.now();
  t.graceUntil = performance.now() + 360;
  assignDefensePlan(t, true);
  $('#timer').className = 'timer show';
  header();
  armDecisionTimer();

  const passCount = session.chain;
  const displayTime = goodPass ? 520 : 260;
  setTimeout(() => {
    if (state?.t === t && session?.chain === passCount && !t.resolved) {
      feedback.textContent = '';
      feedback.className = 'feedback';
      $('#instruction').textContent = '次の空きを探せ';
    }
  }, displayTime);
};

finish = function() {
  originalPossessionFinishForGoodPass();

  const rates = $('#possessionRates');
  if (rates) {
    rates.insertAdjacentHTML(
      'beforeend',
      `<div><span>GOOD PASSES</span><strong>${session?.goodPasses || 0}</strong></div>`
    );
  }
};
