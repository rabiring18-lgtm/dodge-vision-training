// Protocol 06 mobile controls.
// Try the browser Fullscreen API, then always use an in-app fullscreen layout
// on touch devices so the court remains large even when browser UI cannot hide.

function possessionTouchDevice(){
  return navigator.maxTouchPoints>0||
    matchMedia('(pointer:coarse)').matches||
    matchMedia('(hover:none)').matches||
    'ontouchstart' in window;
}

function possessionMobilePlayMode(){
  const landscape=innerWidth>innerHeight;
  const shortSide=Math.min(innerWidth,innerHeight);
  return possessionTouchDevice()&&landscape&&shortSide<=900;
}

function possessionFullscreenElement(){
  return document.fullscreenElement||document.webkitFullscreenElement||null;
}

async function requestPossessionFullscreen(){
  const target=document.documentElement;
  const request=target.requestFullscreen||target.webkitRequestFullscreen;
  if(!request||possessionFullscreenElement())return false;

  try{
    // Invoke directly from the start-button gesture for maximum compatibility.
    await request.call(target);
    return Boolean(possessionFullscreenElement());
  }catch{
    return false;
  }
}

function enterPossessionMobileLayout(){
  if(!possessionMobilePlayMode())return;
  document.body.classList.add('possession-mobile-playing');
  document.documentElement.classList.add('possession-mobile-playing');
  setTimeout(()=>{
    window.scrollTo(0,1);
    refreshPortrait();
    if($('#game').classList.contains('active'))resize();
  },80);
}

function leavePossessionMobileLayout(){
  document.body.classList.remove('possession-mobile-playing');
  document.documentElement.classList.remove('possession-mobile-playing');
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
    ?Math.max(56,size*.14)
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
  const mobileMode=possessionMobilePlayMode();

  if(mobileMode){
    // Apply the fallback immediately. Browser fullscreen is an enhancement.
    enterPossessionMobileLayout();
    const fullscreenPromise=requestPossessionFullscreen();
    await fullscreenPromise;

    if(possessionFullscreenElement()){
      try{await screen.orientation?.lock?.('landscape')}catch{}
    }
  }

  const result=await originalPossessionStartForMobile();
  if(mobileMode){
    setTimeout(()=>{
      window.scrollTo(0,1);
      resize();
    },100);
  }
  return result;
};

const originalPossessionHomeForMobile=home;
home=function(){
  originalPossessionHomeForMobile();
  leavePossessionMobileLayout();

  const fullscreen=possessionFullscreenElement();
  if(fullscreen){
    const exit=document.exitFullscreen||document.webkitExitFullscreen;
    try{
      const result=exit?.call(document);
      result?.catch?.(()=>{});
    }catch{}
  }
};

$('#start').onclick=start;
$('#retry').onclick=start;
$('#homeBtn').onclick=home;
$('#quit').onclick=()=>{
  if(confirm('トレーニングを終了しますか？'))home();
};

function refreshPossessionMobileViewport(){
  setTimeout(()=>{
    if(possessionMobilePlayMode()&&$('#game').classList.contains('active')){
      enterPossessionMobileLayout();
    }
    refreshPortrait();
    if($('#game').classList.contains('active'))resize();
  },100);
}

addEventListener('fullscreenchange',refreshPossessionMobileViewport);
addEventListener('webkitfullscreenchange',refreshPossessionMobileViewport);
visualViewport?.addEventListener('resize',refreshPossessionMobileViewport);
