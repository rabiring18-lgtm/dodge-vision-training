// Protocol 06 mobile controls.
// On coarse-pointer landscape devices, use fullscreen when possible and make
// moving teammates easier to select without changing desktop gameplay.

function possessionMobilePlayMode(){
  return matchMedia('(pointer:coarse)').matches&&innerWidth>innerHeight&&innerHeight<=700;
}

const originalPossessionTapForMobile=tap;
canvas.removeEventListener('pointerdown',originalPossessionTapForMobile);

tap=function(event){
  if(!state||state.t.phase!=='choosing')return;

  event.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const x=event.clientX-rect.left;
  const y=event.clientY-rect.top;
  const t=state.t;
  let chosen=-1;
  let best=Infinity;

  t.attackers.forEach((attacker,index)=>{
    if(index===t.holder)return;
    const distance=Math.hypot(attacker.x-x,attacker.y-y);
    if(distance<best){
      best=distance;
      chosen=index;
    }
  });

  const size=Math.min(w,h);
  const hitRadius=possessionMobilePlayMode()
    ?Math.max(52,size*.13)
    :Math.max(38,size*.085);

  if(chosen<0||best>hitRadius)return;

  clearTimeout(decisionTimer);
  const from=t.attackers[t.holder];
  const to=t.attackers[chosen];
  const distance=Math.hypot(to.x-from.x,to.y-from.y);
  const duration=distance/(size*t.d.passSpeed)*1000;

  t.phase='passing';
  t.pass={
    from:t.holder,
    to:chosen,
    start:{x:from.x,y:from.y},
    started:performance.now(),
    duration
  };
  $('#instruction').textContent='パスコースを確認';
  $('#timer').className='timer';
};

canvas.addEventListener('pointerdown',tap,{passive:false});

const originalPossessionStartForMobile=start;
start=async function(){
  if(possessionMobilePlayMode()&&!document.fullscreenElement&&document.fullscreenEnabled){
    try{
      await document.documentElement.requestFullscreen();
      try{await screen.orientation?.lock?.('landscape')}catch{}
      await new Promise(resolve=>setTimeout(resolve,80));
    }catch{}
  }
  return originalPossessionStartForMobile();
};

const originalPossessionHomeForMobile=home;
home=function(){
  originalPossessionHomeForMobile();
  if(document.fullscreenElement){
    document.exitFullscreen().catch(()=>{});
  }
};

$('#start').onclick=start;
$('#retry').onclick=start;
$('#homeBtn').onclick=home;
$('#quit').onclick=()=>{
  if(confirm('トレーニングを終了しますか？'))home();
};

addEventListener('fullscreenchange',()=>{
  setTimeout(()=>{
    refreshPortrait();
    if($('#game').classList.contains('active'))resize();
  },100);
});
