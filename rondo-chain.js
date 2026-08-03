const PASSES_PER_SUCCESS=5;

function applySetDifficulty(success){
  session.block.push(success);
  if(session.block.length<4)return;
  const wins=session.block.filter(Boolean).length;
  if(wins>=3)session.level=clamp(session.level+1,1,MAX_LEVEL);
  else if(wins<=1)session.level=clamp(session.level-1,1,MAX_LEVEL);
  session.block=[];
}

header=function(){
  if(!session)return;
  $('#number').textContent=Math.min(session.index+1,TOTAL);
  $('#bar').style.width=`${session.index/TOTAL*100}%`;
  $('#level').textContent=session.level;
  $('#streak').textContent=`CHAIN ${session.chain} / ${PASSES_PER_SUCCESS}`;
};

start=async function(){
  cancelAnimationFrame(raf);
  clearTimeout(decisionTimer);
  const startLevel=clamp(load().level||8,1,MAX_LEVEL);
  session={
    index:0,
    level:startLevel,
    results:[],
    passResults:[],
    currentSetPasses:[],
    block:[],
    holder:Math.floor(Math.random()*4),
    chain:0,
    streak:0,
    maxStreak:0
  };
  state=null;
  portraitDismissed=false;
  show('game');
  requestAnimationFrame(()=>{resize();header()});
  $('#feedback').className='feedback';
  $('#instruction').textContent='5本つないで1回成功';
  await countdown();
  launch();
};

function nextSet(){
  if(!session)return;
  session.index++;
  session.index>=TOTAL?finish():launch();
}

function continueCurrentSet(t){
  clearTimeout(decisionTimer);

  // Keep the same trial, players and defenders. Only possession changes.
  // This preserves every defender's position and movement between passes.
  t.holder=session.holder;
  t.pass=null;
  t.phase='choosing';
  t.resolved=false;
  t.opened=performance.now();
  lastFrame=performance.now();

  $('#instruction').textContent='続けてつなげ';
  $('#timer').className='timer show';
  decisionTimer=setTimeout(()=>finishPass(false,false,true),t.d.decisionLimit);
}

finishPass=function(success,intercepted=false,timedOut=false){
  if(!state||state.t.resolved)return;
  const t=state.t;
  t.resolved=true;
  clearTimeout(decisionTimer);

  const ms=Math.round(performance.now()-t.opened);
  const passResult={success,intercepted,timedOut,ms,defenders:t.d.defenders,level:t.d.level};
  session.passResults.push(passResult);
  session.currentSetPasses.push(passResult);

  const f=$('#feedback');

  if(success){
    session.chain++;
    session.streak++;
    session.maxStreak=Math.max(session.maxStreak,session.streak);
    session.holder=t.pass.to;

    if(session.chain<PASSES_PER_SUCCESS){
      f.textContent=`${session.chain} / ${PASSES_PER_SUCCESS}`;
      f.className='feedback show good';
      header();
      continueCurrentSet(t);

      const chainAtFeedback=session.chain;
      setTimeout(()=>{
        if(state?.t===t&&session?.chain===chainAtFeedback&&!t.resolved){
          f.textContent='';
          f.className='feedback';
        }
      },260);
      return;
    }

    t.phase='done';
    const setPasses=[...session.currentSetPasses];
    const averageMs=Math.round(setPasses.reduce((sum,p)=>sum+p.ms,0)/setPasses.length);
    const defenders=Math.max(...setPasses.map(p=>p.defenders));
    session.results.push({success:true,ms:averageMs,defenders,passes:PASSES_PER_SUCCESS});
    applySetDifficulty(true);

    f.textContent='5 PASSES!';
    f.className='feedback show good';
    $('#instruction').textContent='1回成功';
    $('#timer').className='timer';
    session.chain=0;
    session.currentSetPasses=[];
    header();
    setTimeout(nextSet,760);
    return;
  }

  t.phase='done';
  const completed=session.chain;
  const setPasses=[...session.currentSetPasses];
  const averageMs=Math.round(setPasses.reduce((sum,p)=>sum+p.ms,0)/setPasses.length);
  const defenders=Math.max(...setPasses.map(p=>p.defenders));
  session.results.push({success:false,ms:averageMs,defenders,completed,intercepted,timedOut});
  applySetDifficulty(false);

  f.textContent=timedOut?'TIME OUT':'INTERCEPTED';
  f.className='feedback show bad';
  $('#instruction').textContent=`${completed}本で終了。0本から再開`;
  $('#timer').className='timer';
  session.chain=0;
  session.streak=0;
  session.currentSetPasses=[];
  header();
  setTimeout(nextSet,900);
};

rateFor=function(defenders){
  const sets=session.results.filter(x=>x.defenders===defenders);
  return sets.length?Math.round(sets.filter(x=>x.success).length/sets.length*100):null;
};

finish=function(){
  cancelAnimationFrame(raf);
  clearTimeout(decisionTimer);
  const score=session.results.filter(x=>x.success).length;
  const valid=session.passResults.filter(x=>!x.timedOut);
  const ms=Math.round(median(valid.map(x=>x.ms)));
  const turnovers=session.results.filter(x=>!x.success).length;
  const endLevel=session.level;
  const isBest=save(score,endLevel);

  $('#score').textContent=score;
  $('#reaction').textContent=valid.length?`${ms} ms`:'-- ms';
  $('#endLevel').textContent=`Lv.${endLevel}`;
  $('#maxStreak').textContent=`${session.maxStreak}本`;
  $('#turnovers').textContent=`${turnovers}回`;
  $('#message').textContent=score>=18?'ELITE。同じ守備の連続した寄せを外しながら、5本の保持を完成させています。':score>=15?'高水準。守備の動きが続いても、次の空きを捉えられています。':score>=11?'判断は成立。パス後も守備から目を切らず、次の受け手を準備しよう。':'1本を通した後に安心せず、動き続ける守備を追いながら5本つなごう。';
  $('#passRates').innerHTML=[1,2].map(n=>{
    const rate=rateFor(n);
    return `<div><span>${n} DEFENDER${n>1?'S':''}</span><strong>${rate===null?'--':rate+'%'}</strong></div>`;
  }).join('')+`<div><span>MAX PASS STREAK</span><strong>${session.maxStreak}</strong></div>`;
  $('#newBest').hidden=!isBest;
  state=null;
  show('result');
  refreshStats();
};

$('#start').onclick=start;
$('#retry').onclick=start;
