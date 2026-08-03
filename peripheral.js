const TOTAL=20,MAX_LEVEL=20,KEY='dodge-read-peripheral-v1';
const DIRS=[
  {name:'左上',x:-.72,y:-.68,area:'上側'},
  {name:'上',x:0,y:-1,area:'上側'},
  {name:'右上',x:.72,y:-.68,area:'上側'},
  {name:'右',x:1,y:0,area:'右側'},
  {name:'右下',x:.72,y:.68,area:'下側'},
  {name:'下',x:0,y:1,area:'下側'},
  {name:'左下',x:-.72,y:.68,area:'下側'},
  {name:'左',x:-1,y:0,area:'左側'}
];
const SHAPES=[
  {id:'circle',glyph:'●',color:'#ffda36'},
  {id:'diamond',glyph:'◆',color:'#67d5ff'},
  {id:'triangle',glyph:'▲',color:'#ff8d98'}
];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const screens={home:$('#home'),game:$('#game'),result:$('#result')},canvas=$('#canvas'),ctx=canvas.getContext('2d');
let session=null,state=null,raf=0,w=0,h=0,portraitDismissed=false,answerTimer=0,stimulusTimer=0;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function difficulty(level){
  level=clamp(Math.round(level),1,MAX_LEVEL);
  return{
    level,
    display:Math.round(430-(level-1)*17.2),
    answerLimit:Math.round(1550-(level-1)*28),
    radius:.26+(level-1)*.0084,
    size:26-(level-1)*.55,
    distractors:level<7?1:level<14?2:3,
    jitter:.008+(level-1)*.0015
  };
}
function load(){try{return JSON.parse(localStorage.getItem(KEY))||{best:0,sessions:0,level:10}}catch{return{best:0,sessions:0,level:10}}}
function save(score,endLevel){const p=load(),isBest=score>(p.best||0),next=clamp(endLevel-(score<10?1:0),1,MAX_LEVEL);localStorage.setItem(KEY,JSON.stringify({best:Math.max(p.best||0,score),sessions:(p.sessions||0)+1,level:next}));return isBest}
function show(name){Object.entries(screens).forEach(([k,n])=>n.classList.toggle('active',k===name));if(name!=='game'){cancelAnimationFrame(raf);clearTimeout(answerTimer);clearTimeout(stimulusTimer)}refreshPortrait()}
function refreshStats(){const p=load();$('#best').textContent=p.sessions?`${p.best} / ${TOTAL}`:`-- / ${TOTAL}`;$('#sessions').textContent=`${p.sessions||0}回`;$('#startLevel').textContent=`Lv.${clamp(p.level||10,1,MAX_LEVEL)}`}
function buildSchedule(){const base=DIRS.flatMap((_,i)=>[i,i]);return shuffle([...base,...shuffle(DIRS.map((_,i)=>i)).slice(0,4)])}
function makeTrial(level,dirIndex){
  const d=difficulty(level),targetShape=SHAPES[Math.floor(Math.random()*SHAPES.length)];
  const candidates=shuffle(DIRS.map((_,i)=>i).filter(i=>i!==dirIndex)).slice(0,d.distractors);
  const distractorShapes=candidates.map((dir,i)=>({dir,shape:SHAPES.filter(s=>s.id!==targetShape.id)[i%2]}));
  return{id:crypto.randomUUID?crypto.randomUUID():String(Math.random()),level:d.level,dir:dirIndex,targetShape,distractors:distractorShapes,display:d.display,answerLimit:d.answerLimit,radius:d.radius,size:Math.max(14,d.size),jitter:d.jitter};
}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);w=Math.max(1,r.width);h=Math.max(1,r.height);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);draw()}
function background(){
  const g=ctx.createRadialGradient(w*.5,h*.48,10,w*.5,h*.48,Math.max(w,h)*.7);g.addColorStop(0,'#102b4c');g.addColorStop(.48,'#091b31');g.addColorStop(1,'#050c17');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(103,213,255,.08)';ctx.lineWidth=1;
  for(let i=1;i<=4;i++){ctx.beginPath();ctx.arc(w*.5,h*.48,Math.min(w,h)*(.12+i*.09),0,Math.PI*2);ctx.stroke()}
  ctx.beginPath();ctx.moveTo(w*.5,0);ctx.lineTo(w*.5,h);ctx.moveTo(0,h*.48);ctx.lineTo(w,h*.48);ctx.stroke();
}
function itemPoint(dirIndex,t){const d=DIRS[dirIndex],base=Math.min(w,h)*t.radius;return{x:w*.5+d.x*base+(state?.jitter?.[dirIndex]?.x||0)*w,y:h*.48+d.y*base+(state?.jitter?.[dirIndex]?.y||0)*h}}
function drawShape(point,shape,size,alpha=1,ghost=false){ctx.save();ctx.globalAlpha=alpha;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`950 ${size}px system-ui,-apple-system,"Noto Sans JP",sans-serif`;ctx.fillStyle=shape.color;ctx.shadowColor=shape.color;ctx.shadowBlur=ghost?20:13;ctx.fillText(shape.glyph,point.x,point.y);ctx.restore()}
function targetRing(point){ctx.save();ctx.strokeStyle='#ffda36';ctx.lineWidth=2.5;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(point.x,point.y,28,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
function draw(now=performance.now()){
  if(!w||!h)return;background();
  if(state){const t=state.t;if(state.phase==='stimulus'){
      drawShape(itemPoint(t.dir,t),t.targetShape,t.size,1);
      t.distractors.forEach(x=>drawShape(itemPoint(x.dir,t),x.shape,t.size,1));
    }else if(state.phase==='answering'){
      const remain=clamp(1-(now-state.answerOpened)/t.answerLimit,0,1);$('#timer i').style.transform=`scaleX(${remain})`;
    }else if(state.phase==='revealing'){
      const p=itemPoint(t.dir,t);drawShape(p,t.targetShape,t.size*1.1,.95,true);targetRing(p);
      t.distractors.forEach(x=>drawShape(itemPoint(x.dir,t),x.shape,t.size,.22,true));
    }}
  if($('#game').classList.contains('active'))raf=requestAnimationFrame(draw)
}
function enable(v){$$('.dir').forEach(b=>b.disabled=!v);$('#directionPad').classList.toggle('show',v)}
function setFocus(shape,dim=false){$('#focusShape').textContent=shape.glyph;$('#focusShape').style.color=shape.color;$('#focusTarget').style.borderColor=`${shape.color}88`;$('#focusTarget').classList.toggle('dim',dim)}
function header(){$('#number').textContent=Math.min(session.index+1,TOTAL);$('#bar').style.width=`${session.index/TOTAL*100}%`;$('#level').textContent=session.level}
async function countdown(){for(const x of ['3','2','1']){$('#count').textContent=x;await new Promise(r=>setTimeout(r,380))}$('#count').textContent=''}
async function start(){cancelAnimationFrame(raf);clearTimeout(answerTimer);clearTimeout(stimulusTimer);const startLevel=clamp(load().level||10,1,MAX_LEVEL);session={index:0,level:startLevel,results:[],block:[],schedule:buildSchedule()};state=null;portraitDismissed=false;show('game');requestAnimationFrame(()=>{resize();header()});enable(false);$('#feedback').className='feedback';$('#instruction').textContent='中央だけを見ろ';setFocus(SHAPES[1]);await countdown();launch()}
function launch(){
  if(!session||session.index>=TOTAL)return finish();header();enable(false);$('#feedback').className='feedback';$('#feedback').textContent='';$('#timer').className='timer';$('#instruction').textContent='中央の記号を覚えろ';
  const t=makeTrial(session.level,session.schedule[session.index]);
  const jitter={};[t.dir,...t.distractors.map(x=>x.dir)].forEach(i=>{jitter[i]={x:(Math.random()-.5)*t.jitter,y:(Math.random()-.5)*t.jitter}});
  state={t,phase:'focus',answerOpened:0,revealStart:0,jitter};setFocus(t.targetShape,false);cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);
  stimulusTimer=setTimeout(()=>{
    if(!state||state.t.id!==t.id)return;state.phase='stimulus';$('#instruction').textContent='目は中央のまま';
    setTimeout(()=>{
      if(!state||state.t.id!==t.id||state.phase!=='stimulus')return;state.phase='answering';state.answerOpened=performance.now();setFocus(t.targetShape,true);$('#instruction').textContent='同じ記号はどこ？';$('#timer').className='timer show';enable(true);answerTimer=setTimeout(()=>timeout(t.id),t.answerLimit)
    },t.display)
  },520)
}
function circularDistance(a,b){const d=Math.abs(a-b);return Math.min(d,8-d)}
function resolve(chosen,timedOut=false){
  if(!state||state.phase!=='answering')return;clearTimeout(answerTimer);enable(false);const t=state.t,ms=timedOut?t.answerLimit:Math.round(performance.now()-state.answerOpened),distance=timedOut?null:circularDistance(chosen,t.dir),correct=!timedOut&&distance===0,near=!timedOut&&distance===1,f=$('#feedback');
  f.textContent=timedOut?'TIME OUT':correct?'EXACT!':`正解：${DIRS[t.dir].name}`;f.className=`feedback show ${correct?'good':'bad'}`;$('#instruction').textContent='周辺位置を確認';$('#timer').className='timer';session.results.push({dir:t.dir,chosen,correct,near,ms,level:t.level,timedOut,area:DIRS[t.dir].area});session.block.push(correct);if(session.block.length===5){const c=session.block.filter(Boolean).length;if(c>=4)session.level=clamp(session.level+1,1,MAX_LEVEL);else if(c<=2)session.level=clamp(session.level-1,1,MAX_LEVEL);session.block=[]}state.phase='revealing';state.revealStart=performance.now();setTimeout(next,820)
}
function timeout(id){if(state&&state.t.id===id&&state.phase==='answering')resolve(null,true)}
function next(){if(!session)return;session.index++;session.index>=TOTAL?finish():launch()}
function median(a){if(!a.length)return 0;a=[...a].sort((x,y)=>x-y);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function areaRate(area){const a=session.results.filter(x=>x.area===area);return a.length?Math.round(a.filter(x=>x.correct).length/a.length*100):0}
function finish(){
  cancelAnimationFrame(raf);clearTimeout(answerTimer);clearTimeout(stimulusTimer);enable(false);const exact=session.results.filter(x=>x.correct).length,valid=session.results.filter(x=>!x.timedOut),ms=Math.round(median(valid.map(x=>x.ms))),near=session.results.filter(x=>x.near).length,timeouts=session.results.filter(x=>x.timedOut).length,endLevel=session.level,isBest=save(exact,endLevel);
  $('#score').textContent=exact;$('#reaction').textContent=valid.length?`${ms} ms`:'-- ms';$('#endLevel').textContent=`Lv.${endLevel}`;$('#nearMiss').textContent=`${near}回`;$('#timeouts').textContent=`${timeouts}回`;
  $('#message').textContent=exact>=17?'ELITE。中央注視と周辺認知が高精度で両立しています。':exact>=13?'高水準。さらに短い表示時間へ適応しよう。':exact>=9?'PRO負荷に適応中。中央を見たまま位置だけを感じ取ろう。':'周辺を探しに行かず、中央の記号を見続けよう。';
  const areas=['上側','右側','下側','左側'];$('#areaRates').innerHTML=areas.map(a=>`<div><span>${a}</span><strong>${areaRate(a)}%</strong></div>`).join('');$('#newBest').hidden=!isBest;state=null;show('result');refreshStats()
}
function home(){cancelAnimationFrame(raf);clearTimeout(answerTimer);clearTimeout(stimulusTimer);session=null;state=null;enable(false);show('home');refreshStats()}
function refreshPortrait(){const p=innerHeight>innerWidth&&innerWidth<720&&!portraitDismissed&&$('#game').classList.contains('active');$('#portrait').style.display=p?'flex':'none'}
$('#start').onclick=start;$('#retry').onclick=start;$('#homeBtn').onclick=home;$('#quit').onclick=()=>{if(confirm('トレーニングを終了しますか？'))home()};$('#continue').onclick=()=>{portraitDismissed=true;refreshPortrait()};$$('.dir').forEach(b=>b.onclick=()=>resolve(Number(b.dataset.dir),false));addEventListener('resize',()=>{refreshPortrait();if($('#game').classList.contains('active'))resize()});addEventListener('orientationchange',()=>setTimeout(()=>{portraitDismissed=false;refreshPortrait();resize()},200));refreshStats();
