const TOTAL=15,PASSES_PER_SUCCESS=5,MAX_LEVEL=20,KEY='dodge-read-possession-v1';
const $=selector=>document.querySelector(selector);
const screens={home:$('#home'),game:$('#game'),result:$('#result')};
const canvas=$('#canvas'),ctx=canvas.getContext('2d');
let session=null,state=null,raf=0,w=0,h=0,lastFrame=0,decisionTimer=0,portraitDismissed=false;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const random=(min,max)=>min+Math.random()*(max-min);

function difficulty(level){
  level=clamp(Math.round(level),1,MAX_LEVEL);
  return{
    level,
    attackerSpeed:.115+(level-1)*.0035,
    defenderSpeed:.185+(level-1)*.007,
    passSpeed:1.22+(level-1)*.018,
    decisionLimit:2250-(level-1)*43,
    interceptRadius:.039+(level-1)*.0009,
    trapRadius:.054+(level-1)*.0011,
    replanMin:Math.max(300,690-(level-1)*15),
    replanMax:Math.max(520,980-(level-1)*18)
  };
}

function load(){
  try{return JSON.parse(localStorage.getItem(KEY))||{best:0,sessions:0,level:8}}
  catch{return{best:0,sessions:0,level:8}}
}

function save(score,endLevel){
  const previous=load();
  const isBest=score>(previous.best||0);
  const next=clamp(endLevel-(score<7?1:0),1,MAX_LEVEL);
  localStorage.setItem(KEY,JSON.stringify({best:Math.max(previous.best||0,score),sessions:(previous.sessions||0)+1,level:next}));
  return isBest;
}

function show(name){
  Object.entries(screens).forEach(([key,node])=>node.classList.toggle('active',key===name));
  if(name!=='game'){
    cancelAnimationFrame(raf);
    clearTimeout(decisionTimer);
  }
  refreshPortrait();
}

function refreshStats(){
  const progress=load();
  $('#best').textContent=progress.sessions?`${progress.best} / ${TOTAL}`:`-- / ${TOTAL}`;
  $('#sessions').textContent=`${progress.sessions||0}回`;
  $('#startLevel').textContent=`Lv.${clamp(progress.level||8,1,MAX_LEVEL)}`;
}

function resize(){
  const rect=canvas.getBoundingClientRect();
  const scale=Math.min(devicePixelRatio||1,2);
  w=Math.max(1,rect.width);h=Math.max(1,rect.height);
  canvas.width=w*scale;canvas.height=h*scale;
  ctx.setTransform(scale,0,0,scale,0,0);
  draw(performance.now());
}

function field(){
  const gradient=ctx.createLinearGradient(0,0,0,h);
  gradient.addColorStop(0,'#143854');gradient.addColorStop(1,'#071521');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  const pad=Math.min(w,h)*.055;
  ctx.strokeStyle='rgba(174,218,255,.32)';ctx.lineWidth=2;ctx.strokeRect(pad,pad,w-pad*2,h-pad*2);
  ctx.strokeStyle='rgba(255,255,255,.10)';ctx.setLineDash([8,8]);
  ctx.beginPath();ctx.moveTo(w/2,pad);ctx.lineTo(w/2,h-pad);ctx.stroke();
  ctx.strokeRect(w*.25,pad*1.6,w*.5,h-pad*3.2);ctx.setLineDash([]);
}

function insideCourt(x,y,margin=.09){
  const size=Math.min(w,h),mx=size*margin,my=size*margin;
  return{x:clamp(x,mx,w-mx),y:clamp(y,my,h-my)};
}

function makeAttackers(holder){
  const spots=[
    {x:w*.12,y:h*.22},{x:w*.50,y:h*.13},{x:w*.88,y:h*.25},{x:w*.78,y:h*.78},{x:w*.25,y:h*.80}
  ];
  return spots.map((spot,index)=>({
    x:spot.x,y:spot.y,vx:0,vy:0,tx:spot.x,ty:spot.y,
    holder:index===holder,nextMoveAt:0,zone:index,phase:Math.random()*Math.PI*2
  }));
}

function makeDefenders(){
  return [
    {x:w*.42,y:h*.43,vx:0,vy:0,role:'press',target:null,tempo:random(.94,1.08)},
    {x:w*.59,y:h*.40,vx:0,vy:0,role:'lane',target:null,tempo:random(.94,1.08)},
    {x:w*.52,y:h*.64,vx:0,vy:0,role:'shadow',target:null,tempo:random(.94,1.08)}
  ];
}

function assignAttackerTarget(attacker,index,now){
  const anchors=[
    {x:.16,y:.24},{x:.50,y:.16},{x:.84,y:.27},{x:.77,y:.75},{x:.25,y:.78}
  ];
  const anchor=anchors[index];
  const spreadX=index===1?.17:.15;
  const spreadY=.15;
  const point=insideCourt(w*(anchor.x+random(-spreadX,spreadX)),h*(anchor.y+random(-spreadY,spreadY)),.10);
  attacker.tx=point.x;attacker.ty=point.y;attacker.nextMoveAt=now+random(780,1450);
}

function predictedReceiver(t){
  const holder=t.holder;
  const candidates=t.attackers.map((_,index)=>index).filter(index=>index!==holder);
  const history=t.passHistory;
  if(history.length&&Math.random()<.64){
    const last=history[history.length-1];
    const oppositeSide=candidates.filter(index=>Math.abs(t.attackers[index].x-t.attackers[last.to].x)>w*.24);
    if(oppositeSide.length)return oppositeSide[Math.floor(Math.random()*oppositeSide.length)];
  }
  return candidates[Math.floor(Math.random()*candidates.length)];
}

function assignDefensePlan(t,force=false){
  const now=performance.now();
  if(!force&&now<(t.nextReplanAt||0))return;
  const holder=t.holder;
  const candidates=t.attackers.map((_,index)=>index).filter(index=>index!==holder);
  const predicted=predictedReceiver(t);
  const nearest=[...candidates].sort((a,b)=>{
    const pa=t.attackers[a],pb=t.attackers[b],ball=t.attackers[holder];
    return Math.hypot(pa.x-ball.x,pa.y-ball.y)-Math.hypot(pb.x-ball.x,pb.y-ball.y);
  })[0];
  const farthest=[...candidates].sort((a,b)=>{
    const pa=t.attackers[a],pb=t.attackers[b],ball=t.attackers[holder];
    return Math.hypot(pb.x-ball.x,pb.y-ball.y)-Math.hypot(pa.x-ball.x,pa.y-ball.y);
  })[0];
  const roles=Math.random()<.5?['press','lane','shadow']:['lane','press','screen'];
  t.defenders.forEach((defender,index)=>{
    defender.role=roles[index];
    defender.target=defender.role==='press'?holder:defender.role==='lane'?predicted:defender.role==='screen'?farthest:nearest;
    defender.tempo=random(.92,1.12);
    defender.side=Math.random()<.5?-1:1;
  });
  t.nextReplanAt=now+random(t.d.replanMin,t.d.replanMax);
}

function makeSet(level,holder){
  const d=difficulty(level);
  const t={d,holder,attackers:makeAttackers(holder),defenders:makeDefenders(),phase:'choosing',pass:null,opened:performance.now(),resolved:false,passHistory:[],nextReplanAt:0,graceUntil:performance.now()+420};
  const now=performance.now();
  t.attackers.forEach((attacker,index)=>assignAttackerTarget(attacker,index,now));
  assignDefensePlan(t,true);
  return t;
}

function moveToward(entity,tx,ty,speed,dt){
  const dx=tx-entity.x,dy=ty-entity.y,length=Math.hypot(dx,dy)||1;
  entity.vx=dx/length*speed;entity.vy=dy/length*speed;
  entity.x+=entity.vx*dt;entity.y+=entity.vy*dt;
}

function moveAttackers(t,dt,now){
  const size=Math.min(w,h);
  t.attackers.forEach((attacker,index)=>{
    if(now>=attacker.nextMoveAt)assignAttackerTarget(attacker,index,now);
    const holder=index===t.holder;
    const speed=size*t.d.attackerSpeed*(holder?.48:1)*(1+Math.sin(now/330+attacker.phase)*.05);
    moveToward(attacker,attacker.tx,attacker.ty,speed,dt);
    const point=insideCourt(attacker.x,attacker.y,.09);attacker.x=point.x;attacker.y=point.y;
  });
}

function linePoint(from,to,ratio){return{x:from.x+(to.x-from.x)*ratio,y:from.y+(to.y-from.y)*ratio}}

function moveDefenders(t,dt,now){
  const size=Math.min(w,h),holder=t.attackers[t.holder];
  assignDefensePlan(t,false);
  t.defenders.forEach((defender,index)=>{
    let target={x:w/2,y:h/2},multiplier=defender.tempo;
    if(t.phase==='passing'&&t.pass){
      const from=t.pass.start,to=t.attackers[t.pass.to];
      const ratios=[.48,.68,.86];
      target=linePoint(from,to,ratios[index]);
      multiplier*=1.18+index*.05;
    }else if(defender.role==='press'){
      const center={x:w/2,y:h/2},dx=center.x-holder.x,dy=center.y-holder.y,length=Math.hypot(dx,dy)||1;
      target={x:holder.x+dx*.16+(-dy/length)*size*.035*defender.side,y:holder.y+dy*.16+(dx/length)*size*.035*defender.side};
      multiplier*=1.10;
    }else if(defender.role==='lane'){
      const receiver=t.attackers[defender.target]||t.attackers[(t.holder+2)%5];
      target=linePoint(holder,receiver,.48);
      multiplier*=1.03;
    }else if(defender.role==='screen'){
      const receiver=t.attackers[defender.target]||t.attackers[(t.holder+3)%5];
      target=linePoint(holder,receiver,.30);
    }else{
      const receiver=t.attackers[defender.target]||t.attackers[(t.holder+1)%5];
      target={x:receiver.x+(holder.x-receiver.x)*.22,y:receiver.y+(holder.y-receiver.y)*.22};
    }
    moveToward(defender,target.x,target.y,size*t.d.defenderSpeed*multiplier,dt);
    const point=insideCourt(defender.x,defender.y,.085);defender.x=point.x;defender.y=point.y;
  });
}

function circle(x,y,r,fill,stroke='transparent',line=2){
  ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  if(stroke!=='transparent'){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke()}
}

function drawAttacker(attacker,index){
  const holder=state?.t?.holder===index,r=Math.max(17,Math.min(w,h)*.038);
  circle(attacker.x,attacker.y,r,holder?'#ffda36':'#67d5ff',holder?'#fff4a8':'#c3efff',3);
  ctx.fillStyle=holder?'#312000':'#06121e';ctx.font=`900 ${Math.max(12,r*.70)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(index+1,attacker.x,attacker.y);
  if(holder)circle(attacker.x,attacker.y+r+8,4.5,'#ffda36');
}

function drawDefender(defender){
  const r=Math.max(16,Math.min(w,h)*.035);
  circle(defender.x,defender.y,r,'#ff6678','#ffc2c8',3);
  ctx.fillStyle='#3a0811';ctx.font=`900 ${Math.max(11,r*.68)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('D',defender.x,defender.y);
}

function pressureValue(t){
  const holder=t.attackers[t.holder];
  const distance=Math.min(...t.defenders.map(defender=>Math.hypot(defender.x-holder.x,defender.y-holder.y)));
  const size=Math.min(w,h),ratio=distance/size;
  if(ratio<.10)return'HIGH';
  if(ratio<.18)return'MID';
  return'LOW';
}

function drawPass(now){
  const t=state?.t,pass=t?.pass;if(!pass)return;
  const to=t.attackers[pass.to];
  const elapsed=now-pass.started,progress=clamp(elapsed/pass.duration,0,1);
  const x=pass.start.x+(to.x-pass.start.x)*progress,y=pass.start.y+(to.y-pass.start.y)*progress;
  ctx.strokeStyle='rgba(255,218,54,.30)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(pass.start.x,pass.start.y);ctx.lineTo(to.x,to.y);ctx.stroke();
  circle(x,y,Math.max(6,Math.min(w,h)*.014),'#ffda36','#fff5b0',2);
  for(const defender of t.defenders){
    if(Math.hypot(defender.x-x,defender.y-y)<Math.min(w,h)*t.d.interceptRadius){resolvePass(false,'INTERCEPTED');return}
  }
  if(progress>=1)resolvePass(true,'CONNECTED');
}

function draw(now=performance.now()){
  if(!w||!h)return;
  field();
  if(state?.t){
    const dt=lastFrame?Math.min((now-lastFrame)/1000,.035):0;lastFrame=now;
    moveAttackers(state.t,dt,now);moveDefenders(state.t,dt,now);
    state.t.attackers.forEach(drawAttacker);state.t.defenders.forEach(drawDefender);
    if(state.t.phase==='passing')drawPass(now);
    if(state.t.phase==='choosing'){
      const remain=clamp(1-(now-state.t.opened)/state.t.d.decisionLimit,0,1);$('#timer i').style.transform=`scaleX(${remain})`;
      if(now>state.t.graceUntil){
        const holder=state.t.attackers[state.t.holder];
        const trapped=state.t.defenders.some(defender=>Math.hypot(defender.x-holder.x,defender.y-holder.y)<Math.min(w,h)*state.t.d.trapRadius);
        if(trapped)failSet('TRAPPED');
      }
    }
    $('#pressure').textContent=`PRESS ${pressureValue(state.t)}`;
  }
  if($('#game').classList.contains('active'))raf=requestAnimationFrame(draw);
}

function header(){
  if(!session)return;
  $('#number').textContent=Math.min(session.index+1,TOTAL);
  $('#bar').style.width=`${session.index/TOTAL*100}%`;
  $('#level').textContent=session.level;
  $('#chain').textContent=`CHAIN ${session.chain} / ${PASSES_PER_SUCCESS}`;
  $('#switches').textContent=`SWITCH ${session.switches}`;
}

async function countdown(){
  for(const value of['3','2','1']){$('#count').textContent=value;await new Promise(resolve=>setTimeout(resolve,380))}
  $('#count').textContent='';
}

async function start(){
  cancelAnimationFrame(raf);clearTimeout(decisionTimer);
  const startLevel=clamp(load().level||8,1,MAX_LEVEL);
  session={index:0,level:startLevel,results:[],passResults:[],block:[],holder:Math.floor(Math.random()*5),chain:0,streak:0,maxStreak:0,switches:0};
  state=null;portraitDismissed=false;show('game');
  requestAnimationFrame(()=>{resize();header()});
  $('#feedback').className='feedback';$('#instruction').textContent='5本つないで1回成功';
  await countdown();launchSet();
}

function launchSet(){
  if(!session||session.index>=TOTAL)return finish();
  clearTimeout(decisionTimer);
  state={t:makeSet(session.level,session.holder)};
  lastFrame=performance.now();
  $('#feedback').className='feedback';$('#feedback').textContent='';$('#instruction').textContent='空いた味方をタップ';$('#timer').className='timer show';
  header();armDecisionTimer();cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);
}

function armDecisionTimer(){
  clearTimeout(decisionTimer);
  const t=state?.t;if(!t)return;
  decisionTimer=setTimeout(()=>failSet('TIME OUT'),t.d.decisionLimit);
}

function tap(event){
  if(!state||state.t.phase!=='choosing')return;
  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,t=state.t;
  let chosen=-1,best=Infinity;
  t.attackers.forEach((attacker,index)=>{
    if(index===t.holder)return;
    const distance=Math.hypot(attacker.x-x,attacker.y-y);
    if(distance<best){best=distance;chosen=index}
  });
  if(chosen<0||best>Math.max(38,Math.min(w,h)*.085))return;
  clearTimeout(decisionTimer);
  const from=t.attackers[t.holder],to=t.attackers[chosen],distance=Math.hypot(to.x-from.x,to.y-from.y);
  const duration=distance/(Math.min(w,h)*t.d.passSpeed)*1000;
  t.phase='passing';
  t.pass={from:t.holder,to:chosen,start:{x:from.x,y:from.y},started:performance.now(),duration};
  $('#instruction').textContent='パスコースを確認';$('#timer').className='timer';
}

function isSwitchPass(t,from,to){return Math.hypot(t.attackers[to].x-t.attackers[from].x,t.attackers[to].y-t.attackers[from].y)>w*.46}

function resolvePass(success,label){
  const t=state?.t;if(!t||t.resolved)return;
  t.resolved=true;clearTimeout(decisionTimer);
  if(!success){failSet(label);return}
  const decisionMs=Math.round(t.pass.started-t.opened);
  const switched=isSwitchPass(t,t.pass.from,t.pass.to);
  session.passResults.push({success:true,ms:decisionMs,switched});
  if(switched)session.switches++;
  t.passHistory.push({from:t.pass.from,to:t.pass.to});
  session.holder=t.pass.to;t.holder=t.pass.to;
  session.chain++;session.streak++;session.maxStreak=Math.max(session.maxStreak,session.streak);
  const feedback=$('#feedback');feedback.textContent=`${session.chain} / ${PASSES_PER_SUCCESS}`;feedback.className='feedback show good';
  if(session.chain>=PASSES_PER_SUCCESS){
    t.phase='done';session.results.push({success:true});applyDifficulty(true);
    $('#instruction').textContent='1回成功';feedback.textContent='POSSESSION!';$('#timer').className='timer';session.chain=0;header();setTimeout(nextSet,760);return;
  }
  t.pass=null;t.phase='choosing';t.resolved=false;t.opened=performance.now();t.graceUntil=performance.now()+320;assignDefensePlan(t,true);
  $('#instruction').textContent='次の空きを探せ';$('#timer').className='timer show';header();armDecisionTimer();
  const chainAtFeedback=session.chain;
  setTimeout(()=>{if(state?.t===t&&session?.chain===chainAtFeedback&&!t.resolved){feedback.textContent='';feedback.className='feedback'}},260);
}

function failSet(reason){
  const t=state?.t;if(!t||t.phase==='done')return;
  t.phase='done';t.resolved=true;clearTimeout(decisionTimer);
  const feedback=$('#feedback');feedback.textContent=reason;feedback.className='feedback show bad';
  $('#instruction').textContent=`${session.chain}本で終了。0本から再開`;$('#timer').className='timer';
  session.results.push({success:false,reason});session.passResults.push({success:false,ms:Math.round(performance.now()-t.opened)});applyDifficulty(false);
  session.chain=0;session.streak=0;header();setTimeout(nextSet,900);
}

function applyDifficulty(success){
  session.block.push(success);
  if(session.block.length<3)return;
  const wins=session.block.filter(Boolean).length;
  if(wins>=2)session.level=clamp(session.level+1,1,MAX_LEVEL);
  else if(wins===0)session.level=clamp(session.level-1,1,MAX_LEVEL);
  session.block=[];
}

function nextSet(){
  if(!session)return;
  session.index++;session.index>=TOTAL?finish():launchSet();
}

function median(values){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}

function finish(){
  cancelAnimationFrame(raf);clearTimeout(decisionTimer);
  const score=session.results.filter(result=>result.success).length;
  const valid=session.passResults.filter(result=>result.success);
  const reaction=Math.round(median(valid.map(result=>result.ms)));
  const turnovers=session.results.filter(result=>!result.success).length;
  const completion=session.results.length?Math.round(score/session.results.length*100):0;
  const endLevel=session.level,isBest=save(score,endLevel);
  $('#score').textContent=score;$('#reaction').textContent=valid.length?`${reaction} ms`:'-- ms';$('#endLevel').textContent=`Lv.${endLevel}`;$('#maxStreak').textContent=`${session.maxStreak}本`;$('#turnovers').textContent=`${turnovers}回`;
  $('#message').textContent=score>=13?'ELITE。動く味方と守備を同時に捉え、保持を支配しています。':score>=10?'高水準。寄せられる前に次の出口を作れています。':score>=7?'保持は成立。受けてから探さず、ボールが来る前に次を見よう。':'ボール保持者だけでなく、空いた味方と守備の移動を先に見よう。';
  $('#possessionRates').innerHTML=`<div><span>SET SUCCESS</span><strong>${completion}%</strong></div><div><span>SWITCH PASSES</span><strong>${session.switches}</strong></div><div><span>MAX PASS STREAK</span><strong>${session.maxStreak}</strong></div>`;
  $('#newBest').hidden=!isBest;state=null;show('result');refreshStats();
}

function home(){
  cancelAnimationFrame(raf);clearTimeout(decisionTimer);session=null;state=null;show('home');refreshStats();
}

function refreshPortrait(){
  const showOverlay=innerHeight>innerWidth&&innerWidth<720&&!portraitDismissed&&$('#game').classList.contains('active');
  $('#portrait').style.display=showOverlay?'flex':'none';
}

$('#start').onclick=start;$('#retry').onclick=start;$('#homeBtn').onclick=home;
$('#quit').onclick=()=>{if(confirm('トレーニングを終了しますか？'))home()};
$('#continue').onclick=()=>{portraitDismissed=true;refreshPortrait()};
canvas.addEventListener('pointerdown',tap);
addEventListener('resize',()=>{refreshPortrait();if($('#game').classList.contains('active'))resize()});
addEventListener('orientationchange',()=>setTimeout(()=>{portraitDismissed=false;refreshPortrait();resize()},200));
refreshStats();
