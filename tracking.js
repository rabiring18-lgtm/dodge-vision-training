const TOTAL=15,MAX_LEVEL=20,KEY='dodge-read-tracking-v1';
const $=s=>document.querySelector(s);
const screens={home:$('#home'),game:$('#game'),result:$('#result')},canvas=$('#canvas'),ctx=canvas.getContext('2d');
let session=null,state=null,raf=0,w=0,h=0,portraitDismissed=false,answerTimer=0,lastFrame=0;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function difficulty(level){
  level=clamp(Math.round(level),1,MAX_LEVEL);
  return{level,count:clamp(3+Math.floor((level-1)/4),3,7),speed:.115+(level-1)*.0065,trackTime:2350+(level-1)*58,targetTime:900-(level-1)*15,answerLimit:2600-(level-1)*48,radius:.042-(level-1)*.00065};
}
function load(){try{return JSON.parse(localStorage.getItem(KEY))||{best:0,sessions:0,level:8}}catch{return{best:0,sessions:0,level:8}}}
function save(score,endLevel){const p=load(),isBest=score>(p.best||0),next=clamp(endLevel-(score<7?1:0),1,MAX_LEVEL);localStorage.setItem(KEY,JSON.stringify({best:Math.max(p.best||0,score),sessions:(p.sessions||0)+1,level:next}));return isBest}
function show(name){Object.entries(screens).forEach(([k,n])=>n.classList.toggle('active',k===name));if(name!=='game'){cancelAnimationFrame(raf);clearTimeout(answerTimer)}refreshPortrait()}
function refreshStats(){const p=load();$('#best').textContent=p.sessions?`${p.best} / ${TOTAL}`:`-- / ${TOTAL}`;$('#sessions').textContent=`${p.sessions||0}回`;$('#startLevel').textContent=`Lv.${clamp(p.level||8,1,MAX_LEVEL)}`}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);w=Math.max(1,r.width);h=Math.max(1,r.height);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);if(state&&state.phase!=='revealing')restartCurrentRound();else draw(performance.now())}
function arena(){const g=ctx.createRadialGradient(w*.5,h*.45,10,w*.5,h*.45,Math.max(w,h)*.7);g.addColorStop(0,'#17375e');g.addColorStop(.55,'#0a1b31');g.addColorStop(1,'#050c17');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(130,190,255,.10)';ctx.lineWidth=1;const step=Math.max(38,Math.min(w,h)*.12);for(let x=step;x<w;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=step;y<h;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}ctx.strokeStyle='rgba(103,213,255,.20)';ctx.lineWidth=2;ctx.strokeRect(16,16,w-32,h-32)}
function createBalls(d){
  const r=Math.max(15,Math.min(w,h)*d.radius),pad=r+22,balls=[];
  for(let i=0;i<d.count;i++){
    let x,y,tries=0;
    do{x=pad+Math.random()*(w-pad*2);y=pad+Math.random()*(h-pad*2);tries++}while(tries<180&&balls.some(b=>Math.hypot(b.x-x,b.y-y)<r*2.8));
    const angle=Math.random()*Math.PI*2,speed=Math.min(w,h)*d.speed*(.88+Math.random()*.24);
    balls.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r});
  }
  return balls;
}
function makeTrial(level){const d=difficulty(level);return{id:crypto.randomUUID?crypto.randomUUID():String(Math.random()),d,target:Math.floor(Math.random()*d.count),balls:createBalls(d)}}
function updatePhysics(dt){
  if(!state||state.phase!=='tracking')return;const balls=state.t.balls,pad=16;
  for(const b of balls){b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x-b.r<pad){b.x=pad+b.r;b.vx=Math.abs(b.vx)}else if(b.x+b.r>w-pad){b.x=w-pad-b.r;b.vx=-Math.abs(b.vx)}if(b.y-b.r<pad){b.y=pad+b.r;b.vy=Math.abs(b.vy)}else if(b.y+b.r>h-pad){b.y=h-pad-b.r;b.vy=-Math.abs(b.vy)}}
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
    const a=balls[i],b=balls[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||.001,min=a.r+b.r;
    if(dist<min){const nx=dx/dist,ny=dy/dist,overlap=min-dist;a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;const rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(rel>0){a.vx-=rel*nx;a.vy-=rel*ny;b.vx+=rel*nx;b.vy+=rel*ny}}
  }
}
function drawBall(b,index){
  const phase=state?.phase,target=state?.t.target,selected=state?.selected;
  ctx.save();const g=ctx.createRadialGradient(b.x-b.r*.35,b.y-b.r*.4,b.r*.08,b.x,b.y,b.r);g.addColorStop(0,'#fffbd8');g.addColorStop(.5,'#ffe044');g.addColorStop(1,'#dd6500');ctx.fillStyle=g;ctx.shadowColor='#0009';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#6d2d0099';ctx.lineWidth=Math.max(1.5,b.r*.08);ctx.beginPath();ctx.arc(b.x,b.y,b.r*.68,-.8,1.2);ctx.stroke();ctx.beginPath();ctx.arc(b.x,b.y,b.r*.65,2.05,4.2);ctx.stroke();
  if(phase==='preview'&&index===target){ctx.strokeStyle='#67d5ff';ctx.lineWidth=6;ctx.shadowColor='#67d5ff';ctx.shadowBlur=22;ctx.beginPath();ctx.arc(b.x,b.y,b.r+9,0,Math.PI*2);ctx.stroke()}
  if(phase==='revealing'&&index===target){ctx.strokeStyle='#69efb2';ctx.lineWidth=7;ctx.beginPath();ctx.arc(b.x,b.y,b.r+10,0,Math.PI*2);ctx.stroke()}
  if(phase==='revealing'&&index===selected&&selected!==target){ctx.strokeStyle='#ff8d98';ctx.lineWidth=7;ctx.beginPath();ctx.arc(b.x,b.y,b.r+10,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
}
function draw(now=performance.now()){
  if(!w||!h)return;arena();if(state){if(lastFrame&&state.phase==='tracking')updatePhysics(Math.min((now-lastFrame)/1000,.035));lastFrame=now;state.t.balls.forEach(drawBall);if(state.phase==='choosing'){const remain=clamp(1-(now-state.answerOpened)/state.t.d.answerLimit,0,1);$('#timer i').style.transform=`scaleX(${remain})`}}
  if($('#game').classList.contains('active'))raf=requestAnimationFrame(draw)
}
function header(){if(!session)return;$('#number').textContent=Math.min(session.index+1,TOTAL);$('#bar').style.width=`${session.index/TOTAL*100}%`;$('#level').textContent=session.level}
async function countdown(){for(const x of ['3','2','1']){$('#count').textContent=x;await new Promise(r=>setTimeout(r,380))}$('#count').textContent=''}
async function start(){cancelAnimationFrame(raf);clearTimeout(answerTimer);const startLevel=clamp(load().level||8,1,MAX_LEVEL);session={index:0,level:startLevel,results:[],block:[],maxBalls:3};state=null;portraitDismissed=false;show('game');requestAnimationFrame(()=>{resize();header()});$('#feedback').className='feedback';$('#instruction').textContent='光るボールを覚えろ';await countdown();launch()}
function launch(){if(!session||session.index>=TOTAL)return finish();header();$('#feedback').className='feedback';$('#feedback').textContent='';$('#timer').className='timer';$('#instruction').textContent='光るボールを覚えろ';const t=makeTrial(session.level);session.maxBalls=Math.max(session.maxBalls,t.d.count);$('#ballCount').textContent=`${t.d.count} BALLS`;state={t,phase:'preview',selected:null,answerOpened:0};lastFrame=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);setTimeout(()=>{if(!state||state.t.id!==t.id)return;state.phase='tracking';$('#instruction').textContent='見失うな';lastFrame=performance.now();setTimeout(()=>openChoice(t.id),t.d.trackTime)},t.d.targetTime)}
function openChoice(id){if(!state||state.t.id!==id||state.phase!=='tracking')return;state.phase='choosing';state.answerOpened=performance.now();$('#instruction').textContent='最初のボールをタップ';$('#timer').className='timer show';answerTimer=setTimeout(()=>resolve(null,true),state.t.d.answerLimit)}
function tap(e){if(!state||state.phase!=='choosing')return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left),y=(e.clientY-r.top);let chosen=-1,best=Infinity;state.t.balls.forEach((b,i)=>{const d=Math.hypot(b.x-x,b.y-y);if(d<best){best=d;chosen=i}});if(chosen>=0&&best<=state.t.balls[chosen].r*1.7)resolve(chosen,false)}
function resolve(chosen,timedOut=false){if(!state||state.phase!=='choosing')return;clearTimeout(answerTimer);const t=state.t,ms=timedOut?t.d.answerLimit:Math.round(performance.now()-state.answerOpened),correct=!timedOut&&chosen===t.target,f=$('#feedback');state.selected=chosen;state.phase='revealing';f.textContent=timedOut?'TIME OUT':correct?'TRACKED!':'見失った';f.className=`feedback show ${correct?'good':'bad'}`;$('#instruction').textContent=correct?'正確に追えている':'緑が正解';$('#timer').className='timer';session.results.push({correct,ms,timedOut,count:t.d.count,level:t.d.level});session.block.push(correct);if(session.block.length===3){const c=session.block.filter(Boolean).length;if(c===3)session.level=clamp(session.level+1,1,MAX_LEVEL);else if(c<=1)session.level=clamp(session.level-1,1,MAX_LEVEL);session.block=[]}setTimeout(next,900)}
function next(){if(!session)return;session.index++;session.index>=TOTAL?finish():launch()}
function median(a){if(!a.length)return 0;a=[...a].sort((x,y)=>x-y);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function countRate(count){const a=session.results.filter(x=>x.count===count);return a.length?Math.round(a.filter(x=>x.correct).length/a.length*100):null}
function finish(){cancelAnimationFrame(raf);clearTimeout(answerTimer);const exact=session.results.filter(x=>x.correct).length,valid=session.results.filter(x=>!x.timedOut),ms=Math.round(median(valid.map(x=>x.ms))),timeouts=session.results.filter(x=>x.timedOut).length,endLevel=session.level,isBest=save(exact,endLevel);$('#score').textContent=exact;$('#reaction').textContent=valid.length?`${ms} ms`:'-- ms';$('#endLevel').textContent=`Lv.${endLevel}`;$('#maxBalls').textContent=`${session.maxBalls}個`;$('#timeouts').textContent=`${timeouts}回`;$('#message').textContent=exact>=13?'ELITE。交差しても対象を正確に保持できています。':exact>=10?'高水準。近くを通るボールに対象を奪われないようにしよう。':exact>=7?'追跡力が育っています。ボール全体ではなく対象の中心を追おう。':'対象を目で追い回さず、動く方向を先読みして視線を運ぼう。';$('#countRates').innerHTML=[3,4,5,6,7].map(n=>{const rate=countRate(n);return`<div><span>${n} BALLS</span><strong>${rate===null?'--':rate+'%'}</strong></div>`}).join('');$('#newBest').hidden=!isBest;state=null;show('result');refreshStats()}
function home(){cancelAnimationFrame(raf);clearTimeout(answerTimer);session=null;state=null;show('home');refreshStats()}
function restartCurrentRound(){if(!session||!$('#game').classList.contains('active'))return;clearTimeout(answerTimer);cancelAnimationFrame(raf);setTimeout(launch,120)}
function refreshPortrait(){const p=innerHeight>innerWidth&&innerWidth<720&&!portraitDismissed&&$('#game').classList.contains('active');$('#portrait').style.display=p?'flex':'none'}
$('#start').onclick=start;$('#retry').onclick=start;$('#homeBtn').onclick=home;$('#quit').onclick=()=>{if(confirm('トレーニングを終了しますか？'))home()};$('#continue').onclick=()=>{portraitDismissed=true;refreshPortrait()};canvas.addEventListener('pointerdown',tap);addEventListener('resize',()=>{refreshPortrait();if($('#game').classList.contains('active'))resize()});addEventListener('orientationchange',()=>setTimeout(()=>{portraitDismissed=false;refreshPortrait();resize()},200));refreshStats();
