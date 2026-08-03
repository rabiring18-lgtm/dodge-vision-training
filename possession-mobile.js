// Protocol 06 adaptive touch layout.
// Phones use portrait-first play. Tablets keep the landscape-first layout.

function possessionTouchDevice(){
  return navigator.maxTouchPoints>0||
    matchMedia('(pointer:coarse)').matches||
    matchMedia('(hover:none)').matches||
    'ontouchstart' in window;
}

function possessionDeviceShortSide(){
  const screenShort=Math.min(screen.width||innerWidth,screen.height||innerHeight);
  const viewportShort=Math.min(innerWidth,innerHeight);
  return Math.min(screenShort,viewportShort);
}

function possessionPhoneDevice(){
  return possessionTouchDevice()&&possessionDeviceShortSide()<=700;
}

function possessionTabletDevice(){
  return possessionTouchDevice()&&!possessionPhoneDevice();
}

function possessionPhoneLandscape(){
  return possessionPhoneDevice()&&innerWidth>innerHeight;
}

function possessionTabletPortrait(){
  return possessionTabletDevice()&&innerHeight>innerWidth;
}

function possessionMobilePlayMode(){
  if(possessionPhoneDevice())return true;
  return possessionTabletDevice()&&innerWidth>innerHeight&&possessionDeviceShortSide()<=1100;
}

function possessionFullscreenElement(){
  return document.fullscreenElement||document.webkitFullscreenElement||null;
}

async function requestPossessionFullscreen(){
  const target=document.documentElement;
  const request=target.requestFullscreen||target.webkitRequestFullscreen;
  if(!request||possessionFullscreenElement())return false;

  try{
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
  document.body.classList.toggle('possession-phone-playing',possessionPhoneDevice());
  document.body.classList.toggle('possession-tablet-playing',possessionTabletDevice());
  document.body.classList.toggle('possession-portrait-playing',innerHeight>innerWidth);
  document.body.classList.toggle('possession-landscape-playing',innerWidth>innerHeight);

  setTimeout(()=>{
    window.scrollTo(0,1);
    refreshPortrait();
    if($('#game').classList.contains('active'))resize();
  },80);
}

function leavePossessionMobileLayout(){
  document.body.classList.remove(
    'possession-mobile-playing',
    'possession-phone-playing',
    'possession-tablet-playing',
    'possession-portrait-playing',
    'possession-landscape-playing'
  );
  document.documentElement.classList.remove('possession-mobile-playing');
}

// Replace the old phone-landscape-only warning with device-specific guidance.
refreshPortrait=function(){
  const overlay=$('#portrait');
  if(!overlay)return;

  const gameActive=$('#game').classList.contains('active');
  const recommendPortrait=gameActive&&!portraitDismissed&&possessionPhoneLandscape();
  const recommendLandscape=gameActive&&!portraitDismissed&&possessionTabletPortrait();
  const showOverlay=recommendPortrait||recommendLandscape;

  if(showOverlay){
    const title=overlay.querySelector('strong');
    const text=overlay.querySelector('p');
    const button=overlay.querySelector('button');

    if(recommendPortrait){
      title.textContent='スマホは縦向き推奨';
      text.textContent='上下の間隔を広く使えるため、ポゼッションは縦向きのほうが選手を見分けやすく、タップもしやすくなります。';
    }else{
      title.textContent='タブレットは横向き推奨';
      text.textContent='iPadやタブレットでは、横向きにするとコート全体を広く見渡せます。';
    }
    button.textContent='この向きで続ける';
  }

  overlay.style.display=showOverlay?'flex':'none';
};

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
  const hitRadius=possessionPhoneDevice()
    ?Math.max(58,size*.15)
    :possessionTabletDevice()
      ?Math.max(52,size*.12)
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
  const adaptiveMode=possessionMobilePlayMode();

  if(adaptiveMode){
    enterPossessionMobileLayout();
    await requestPossessionFullscreen();

    // Do not lock a phone to landscape. Only tablets keep landscape lock.
    if(possessionFullscreenElement()&&possessionTabletDevice()&&innerWidth>innerHeight){
      try{await screen.orientation?.lock?.('landscape')}catch{}
    }
  }

  const result=await originalPossessionStartForMobile();
  if(adaptiveMode){
    setTimeout(()=>{
      enterPossessionMobileLayout();
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

  if(possessionFullscreenElement()){
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
$('#continue').onclick=()=>{
  portraitDismissed=true;
  refreshPortrait();
};

function refreshPossessionAdaptiveViewport(){
  setTimeout(()=>{
    if($('#game').classList.contains('active')){
      if(possessionMobilePlayMode())enterPossessionMobileLayout();
      else leavePossessionMobileLayout();
    }
    refreshPortrait();
    if($('#game').classList.contains('active'))resize();
  },100);
}

addEventListener('fullscreenchange',refreshPossessionAdaptiveViewport);
addEventListener('webkitfullscreenchange',refreshPossessionAdaptiveViewport);
visualViewport?.addEventListener('resize',refreshPossessionAdaptiveViewport);
addEventListener('orientationchange',()=>{
  portraitDismissed=false;
  refreshPossessionAdaptiveViewport();
});
