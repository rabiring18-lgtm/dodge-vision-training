// Shared adaptive orientation controller for Protocols 01–05.
// Phones are portrait-first. Tablets retain the existing landscape-first UI.
(() => {
  const file=(location.pathname.split('/').pop()||'').toLowerCase();
  const gameMap={
    'hidden-ball.html':'hidden-ball',
    'catch-dodge.html':'catch-dodge',
    'peripheral.html':'peripheral',
    'tracking.html':'tracking',
    'rondo.html':'rondo'
  };
  const gameId=gameMap[file];
  if(!gameId)return;

  document.body.classList.add(`phone-game-${gameId}`);

  function isTouchDevice(){
    return navigator.maxTouchPoints>0||
      matchMedia('(pointer:coarse)').matches||
      matchMedia('(hover:none)').matches||
      'ontouchstart' in window;
  }

  function deviceShortSide(){
    const screenShort=Math.min(screen.width||innerWidth,screen.height||innerHeight);
    const viewportShort=Math.min(innerWidth,innerHeight);
    return Math.min(screenShort,viewportShort);
  }

  function isPhone(){
    return isTouchDevice()&&deviceShortSide()<=700;
  }

  function isTablet(){
    return isTouchDevice()&&!isPhone();
  }

  function isPortrait(){
    return innerHeight>=innerWidth;
  }

  function fullscreenElement(){
    return document.fullscreenElement||document.webkitFullscreenElement||null;
  }

  async function requestPhoneFullscreen(){
    if(!isPhone()||!isPortrait()||fullscreenElement())return false;
    const target=document.documentElement;
    const request=target.requestFullscreen||target.webkitRequestFullscreen;
    if(!request)return false;

    try{
      await request.call(target);
      return Boolean(fullscreenElement());
    }catch{
      return false;
    }
  }

  function enterPhoneLayout(){
    if(!isPhone())return;
    document.documentElement.classList.add('phone-adaptive-playing');
    document.body.classList.add('phone-adaptive-playing');
    setTimeout(() => {
      scrollTo(0,1);
      if(document.querySelector('#game.active')&&typeof resize==='function')resize();
    },80);
  }

  function leavePhoneLayout(exitFullscreen=true){
    document.documentElement.classList.remove('phone-adaptive-playing');
    document.body.classList.remove('phone-adaptive-playing');

    if(exitFullscreen&&fullscreenElement()){
      const exit=document.exitFullscreen||document.webkitExitFullscreen;
      try{
        const result=exit?.call(document);
        result?.catch?.(()=>{});
      }catch{}
    }
  }

  // Replace each protocol's landscape-only warning with device-aware guidance.
  if(typeof refreshPortrait==='function'){
    refreshPortrait=function(){
      const overlay=document.querySelector('#portrait');
      if(!overlay)return;

      const gameActive=Boolean(document.querySelector('#game.active'));
      const phoneLandscape=gameActive&&!portraitDismissed&&isPhone()&&!isPortrait();
      const tabletPortrait=gameActive&&!portraitDismissed&&isTablet()&&isPortrait();
      const show=phoneLandscape||tabletPortrait;

      if(show){
        const title=overlay.querySelector('strong');
        const text=overlay.querySelector('p');
        const button=overlay.querySelector('button');

        if(phoneLandscape){
          title.textContent='スマホは縦向き推奨';
          text.textContent='縦向きにするとプレー領域と操作ボタンを大きく使えます。スマホを縦に戻して続けてください。';
        }else{
          title.textContent='タブレットは横向き推奨';
          text.textContent='iPadやタブレットでは、横向きにすると情報を広く見渡せます。';
        }
        button.textContent='この向きで続ける';
      }

      overlay.style.display=show?'flex':'none';
    };
  }

  // Enlarge moving-target selection only where canvas tapping is required.
  if(gameId==='tracking'&&typeof tap==='function'&&typeof canvas!=='undefined'){
    const baseTrackingTap=tap;
    canvas.removeEventListener('pointerdown',baseTrackingTap);
    const phoneTrackingTap=event=>{
      if(isPhone()&&isPortrait()&&state?.phase==='choosing'){
        const rect=canvas.getBoundingClientRect();
        const x=event.clientX-rect.left;
        const y=event.clientY-rect.top;
        let chosen=-1;
        let best=Infinity;
        state.t.balls.forEach((ball,index)=>{
          const distance=Math.hypot(ball.x-x,ball.y-y);
          if(distance<best){best=distance;chosen=index}
        });
        if(chosen>=0&&best<=Math.max(50,state.t.balls[chosen].r*2.35)){
          resolve(chosen,false);
          return;
        }
      }
      baseTrackingTap(event);
    };
    canvas.addEventListener('pointerdown',phoneTrackingTap,{passive:false});
  }

  if(gameId==='rondo'&&typeof tap==='function'&&typeof canvas!=='undefined'){
    const baseRondoTap=tap;
    canvas.removeEventListener('pointerdown',baseRondoTap);
    const phoneRondoTap=event=>{
      if(isPhone()&&isPortrait()&&state?.t?.phase==='choosing'){
        const rect=canvas.getBoundingClientRect();
        const x=event.clientX-rect.left;
        const y=event.clientY-rect.top;
        let chosen=-1;
        let best=Infinity;
        state.t.players.forEach((player,index)=>{
          if(index===state.t.holder)return;
          const distance=Math.hypot(player.x-x,player.y-y);
          if(distance<best){best=distance;chosen=index}
        });
        if(chosen>=0&&best<=Math.max(58,Math.min(w,h)*.15)){
          const player=state.t.players[chosen];
          baseRondoTap({clientX:rect.left+player.x,clientY:rect.top+player.y});
          return;
        }
      }
      baseRondoTap(event);
    };
    canvas.addEventListener('pointerdown',phoneRondoTap,{passive:false});
  }

  if(typeof start==='function'){
    const baseStart=start;
    start=async function(){
      if(isPhone()){
        enterPhoneLayout();
        await requestPhoneFullscreen();
      }
      const result=await baseStart();
      if(isPhone()){
        setTimeout(() => {
          enterPhoneLayout();
          refreshPortrait();
        },100);
      }
      return result;
    };
  }

  if(typeof home==='function'){
    const baseHome=home;
    home=function(){
      leavePhoneLayout(true);
      return baseHome();
    };
  }

  if(typeof finish==='function'){
    const baseFinish=finish;
    finish=function(){
      leavePhoneLayout(true);
      return baseFinish();
    };
  }

  const startButton=document.querySelector('#start');
  const retryButton=document.querySelector('#retry');
  const homeButton=document.querySelector('#homeBtn');
  const quitButton=document.querySelector('#quit');
  const continueButton=document.querySelector('#continue');

  if(startButton)startButton.onclick=start;
  if(retryButton)retryButton.onclick=start;
  if(homeButton)homeButton.onclick=home;
  if(quitButton)quitButton.onclick=()=>{
    if(confirm('トレーニングを終了しますか？'))home();
  };
  if(continueButton)continueButton.onclick=()=>{
    portraitDismissed=true;
    refreshPortrait();
  };

  function refreshAdaptiveViewport(){
    setTimeout(() => {
      if(document.querySelector('#game.active')&&isPhone())enterPhoneLayout();
      refreshPortrait();
      if(document.querySelector('#game.active')&&typeof resize==='function')resize();
    },120);
  }

  addEventListener('fullscreenchange',refreshAdaptiveViewport);
  addEventListener('webkitfullscreenchange',refreshAdaptiveViewport);
  visualViewport?.addEventListener('resize',refreshAdaptiveViewport);
  addEventListener('orientationchange',()=>{
    portraitDismissed=false;
    refreshAdaptiveViewport();
  });
})();
