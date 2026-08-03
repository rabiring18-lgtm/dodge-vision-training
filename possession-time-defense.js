// Protocol 06: survive for 20 seconds and keep the three defenders spread.
const POSSESSION_SET_DURATION=20000;

const originalPossessionMakeSet=makeSet;

makeDefenders=function(){
  return[
    {x:w*.32,y:h*.36,vx:0,vy:0,role:'press',target:null,tempo:random(.98,1.10),side:-1},
    {x:w*.68,y:h*.36,vx:0,vy:0,role:'mark',target:null,tempo:random(.91,1.04),side:1},
    {x:w*.50,y:h*.70,vx:0,vy:0,role:'cover',target:null,tempo:random(.88,1.01),side:Math.random()<.5?-1:1}
  ];
};

assignDefensePlan=function(t,force=false){
  const now=performance.now();
  if(!force&&now<(t.nextReplanAt||0))return;

  const holder=t.holder;
  const candidates=t.attackers.map((_,index)=>index).filter(index=>index!==holder);
  const predicted=predictedReceiver(t);
  const byDistance=[...candidates].sort((a,b)=>{
    const pa=t.attackers[a],pb=t.attackers[b],ball=t.attackers[holder];
    return Math.hypot(pa.x-ball.x,pa.y-ball.y)-Math.hypot(pb.x-ball.x,pb.y-ball.y);
  });
  const nearest=byDistance[0];
  const farthest=byDistance[byDistance.length-1];
  const pressIndex=Math.floor(Math.random()*3);
  const others=[0,1,2].filter(index=>index!==pressIndex);

  t.defenders.forEach((defender,index)=>{
    if(index===pressIndex){
      defender.role='press';
      defender.target=holder;
      defender.tempo=random(1.00,1.12);
    }else if(index===others[0]){
      defender.role='mark';
      defender.target=Math.random()<.62?nearest:predicted;
      defender.tempo=random(.91,1.04);
    }else{
      defender.role='cover';
      defender.target=Math.random()<.58?farthest:predicted;
      defender.tempo=random(.88,1.01);
    }
    defender.side=Math.random()<.5?-1:1;
  });

  t.nextReplanAt=now+random(t.d.replanMin,t.d.replanMax);
};

makeSet=function(level,holder){
  const t=originalPossessionMakeSet(level,holder);
  const now=performance.now();
  t.setStarted=now;
  t.setEndsAt=now+POSSESSION_SET_DURATION;
  t.completed=false;
  t.opened=now;
  t.graceUntil=now+520;
  return t;
};

function possessionSeparateDefenders(t){
  const size=Math.min(w,h);
  const minimumGap=size*.19;

  for(let i=0;i<t.defenders.length;i++){
    for(let j=i+1;j<t.defenders.length;j++){
      const first=t.defenders[i],second=t.defenders[j];
      let dx=second.x-first.x,dy=second.y-first.y,distance=Math.hypot(dx,dy);
      if(distance<.001){
        dx=random(-1,1);dy=random(-1,1);distance=Math.hypot(dx,dy)||1;
      }
      if(distance<minimumGap){
        const ux=dx/distance,uy=dy/distance;
        const push=(minimumGap-distance)/2;
        first.x-=ux*push;first.y-=uy*push;
        second.x+=ux*push;second.y+=uy*push;
      }
    }
  }

  t.defenders.forEach(defender=>{
    const point=insideCourt(defender.x,defender.y,.085);
    defender.x=point.x;defender.y=point.y;
  });
}

moveDefenders=function(t,dt,now){
  const size=Math.min(w,h),holder=t.attackers[t.holder];
  assignDefensePlan(t,false);

  t.defenders.forEach(defender=>{
    let target={x:w/2,y:h/2};
    let multiplier=defender.tempo;

    if(t.phase==='passing'&&t.pass){
      const from=t.pass.start,to=t.attackers[t.pass.to];

      if(defender.role==='press'){
        target=linePoint(from,to,.88);
        multiplier*=1.12;
      }else if(defender.role==='mark'){
        const marked=t.attackers[defender.target]||to;
        if(defender.target===t.pass.to){
          target=linePoint(from,to,.66);
          multiplier*=1.08;
        }else{
          target={
            x:marked.x+(to.x-marked.x)*.08,
            y:marked.y+(to.y-marked.y)*.08
          };
        }
      }else{
        const lane=linePoint(from,to,.40);
        const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1;
        const offset=size*.13*defender.side;
        target={x:lane.x+(-dy/length)*offset,y:lane.y+(dx/length)*offset};
        multiplier*=.96;
      }
    }else if(defender.role==='press'){
      const center={x:w/2,y:h/2};
      const dx=center.x-holder.x,dy=center.y-holder.y,length=Math.hypot(dx,dy)||1;
      target={
        x:holder.x+dx*.15+(-dy/length)*size*.032*defender.side,
        y:holder.y+dy*.15+(dx/length)*size*.032*defender.side
      };
      multiplier*=1.08;
    }else if(defender.role==='mark'){
      const receiver=t.attackers[defender.target]||t.attackers[(t.holder+1)%5];
      target={
        x:receiver.x+(holder.x-receiver.x)*.17,
        y:receiver.y+(holder.y-receiver.y)*.17
      };
    }else{
      const receiver=t.attackers[defender.target]||t.attackers[(t.holder+2)%5];
      const lane=linePoint(holder,receiver,.33);
      const dx=receiver.x-holder.x,dy=receiver.y-holder.y,length=Math.hypot(dx,dy)||1;
      const offset=size*.12*defender.side;
      target={x:lane.x+(-dy/length)*offset,y:lane.y+(dx/length)*offset};
      multiplier*=.93;
    }

    moveToward(defender,target.x,target.y,size*t.d.defenderSpeed*multiplier,dt);
    const point=insideCourt(defender.x,defender.y,.085);
    defender.x=point.x;defender.y=point.y;
  });

  possessionSeparateDefenders(t);
};

pressureValue=function(t){
  const holder=t.attackers[t.holder];
  const presser=t.defenders.find(defender=>defender.role==='press')||t.defenders[0];
  const ratio=Math.hypot(presser.x-holder.x,presser.y-holder.y)/Math.min(w,h);
  if(ratio<.10)return'HIGH';
  if(ratio<.18)return'MID';
  return'LOW';
};

function possessionRemaining(t,now=performance.now()){
  return Math.max(0,t.setEndsAt-now);
}

header=function(){
  if(!session)return;
  $('#number').textContent=Math.min(session.index+1,TOTAL);
  $('#level').textContent=session.level;
  $('#switches').textContent=`SWITCH ${session.switches}`;
  if(!state?.t)$('#chain').textContent='TIME 20.0';
};

draw=function(now=performance.now()){
  if(!w||!h)return;
  field();

  if(state?.t){
    const t=state.t;
    const dt=lastFrame?Math.min((now-lastFrame)/1000,.035):0;
    lastFrame=now;
    moveAttackers(t,dt,now);
    moveDefenders(t,dt,now);
    t.attackers.forEach(drawAttacker);
    t.defenders.forEach(drawDefender);
    if(t.phase==='passing')drawPass(now);

    if(state?.t===t&&t.phase!=='done'){
      const remaining=possessionRemaining(t,now);
      $('#chain').textContent=`TIME ${(remaining/1000).toFixed(1)}`;
      $('#bar').style.width=`${clamp((POSSESSION_SET_DURATION-remaining)/POSSESSION_SET_DURATION*100,0,100)}%`;

      if(remaining<=0){
        completePossessionSet();
      }else if(t.phase==='choosing'){
        const decisionRemain=clamp(1-(now-t.opened)/t.d.decisionLimit,0,1);
        $('#timer i').style.transform=`scaleX(${decisionRemain})`;

        if(now>t.graceUntil){
          const holder=t.attackers[t.holder];
          const presser=t.defenders.find(defender=>defender.role==='press');
          const trapped=presser&&Math.hypot(presser.x-holder.x,presser.y-holder.y)<Math.min(w,h)*t.d.trapRadius;
          if(trapped)failSet('TRAPPED');
        }
      }
    }

    if(state?.t===t&&t.phase!=='done')$('#pressure').textContent=`PRESS ${pressureValue(t)}`;
  }

  if($('#game').classList.contains('active'))raf=requestAnimationFrame(draw);
};

start=async function(){
  cancelAnimationFrame(raf);clearTimeout(decisionTimer);
  const startLevel=clamp(load().level||8,1,MAX_LEVEL);
  session={
    index:0,level:startLevel,results:[],passResults:[],block:[],
    holder:Math.floor(Math.random()*5),chain:0,streak:0,maxStreak:0,switches:0
  };
  state=null;portraitDismissed=false;show('game');
  requestAnimationFrame(()=>{resize();header()});
  $('#feedback').className='feedback';
  $('#instruction').textContent='20秒間、保持し続けろ';
  await countdown();
  launchSet();
};

launchSet=function(){
  if(!session||session.index>=TOTAL)return finish();
  clearTimeout(decisionTimer);
  session.chain=0;
  session.streak=0;
  state={t:makeSet(session.level,session.holder)};
  lastFrame=performance.now();
  $('#feedback').className='feedback';
  $('#feedback').textContent='';
  $('#instruction').textContent='20秒間、空いた味方へつなげ';
  $('#timer').className='timer show';
  $('#bar').style.width='0%';
  header();armDecisionTimer();cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);
};

resolvePass=function(success,label){
  const t=state?.t;
  if(!t||t.resolved||t.phase==='done')return;
  t.resolved=true;clearTimeout(decisionTimer);
  if(!success){failSet(label);return}

  const decisionMs=Math.round(t.pass.started-t.opened);
  const switched=isSwitchPass(t,t.pass.from,t.pass.to);
  session.passResults.push({success:true,ms:decisionMs,switched});
  if(switched)session.switches++;
  t.passHistory.push({from:t.pass.from,to:t.pass.to});
  session.holder=t.pass.to;
  t.holder=t.pass.to;
  session.chain++;
  session.streak++;
  session.maxStreak=Math.max(session.maxStreak,session.streak);

  const feedback=$('#feedback');
  feedback.textContent=`PASS ${session.chain}`;
  feedback.className='feedback show good';

  t.pass=null;
  t.phase='choosing';
  t.resolved=false;
  t.opened=performance.now();
  t.graceUntil=performance.now()+360;
  assignDefensePlan(t,true);
  $('#instruction').textContent='次の空きを探せ';
  $('#timer').className='timer show';
  header();armDecisionTimer();

  const passCount=session.chain;
  setTimeout(()=>{
    if(state?.t===t&&session?.chain===passCount&&!t.resolved){
      feedback.textContent='';feedback.className='feedback';
    }
  },260);
};

function completePossessionSet(){
  const t=state?.t;
  if(!t||t.phase==='done'||t.completed)return;
  t.completed=true;t.phase='done';t.resolved=true;clearTimeout(decisionTimer);
  session.results.push({success:true,passes:session.chain,duration:POSSESSION_SET_DURATION});
  applyDifficulty(true);
  const feedback=$('#feedback');
  feedback.textContent='20 SECONDS!';feedback.className='feedback show good';
  $('#instruction').textContent=`保持成功・${session.chain}本`;
  $('#timer').className='timer';
  $('#chain').textContent='TIME 0.0';
  $('#bar').style.width='100%';
  setTimeout(nextSet,820);
}

failSet=function(reason){
  const t=state?.t;
  if(!t||t.phase==='done')return;
  t.phase='done';t.resolved=true;clearTimeout(decisionTimer);
  const elapsed=Math.min(POSSESSION_SET_DURATION,performance.now()-t.setStarted);
  const feedback=$('#feedback');
  feedback.textContent=reason;feedback.className='feedback show bad';
  $('#instruction').textContent=`${(elapsed/1000).toFixed(1)}秒・${session.chain}本で終了`;
  $('#timer').className='timer';
  session.results.push({success:false,reason,passes:session.chain,duration:elapsed});
  session.passResults.push({success:false,ms:Math.round(performance.now()-t.opened)});
  applyDifficulty(false);
  setTimeout(nextSet,900);
};

finish=function(){
  cancelAnimationFrame(raf);clearTimeout(decisionTimer);
  const score=session.results.filter(result=>result.success).length;
  const valid=session.passResults.filter(result=>result.success);
  const reaction=Math.round(median(valid.map(result=>result.ms)));
  const turnovers=session.results.filter(result=>!result.success).length;
  const completion=session.results.length?Math.round(score/session.results.length*100):0;
  const averageTime=session.results.length?session.results.reduce((sum,result)=>sum+result.duration,0)/session.results.length:0;
  const endLevel=session.level,isBest=save(score,endLevel);

  $('#score').textContent=score;
  $('#reaction').textContent=valid.length?`${reaction} ms`:'-- ms';
  $('#endLevel').textContent=`Lv.${endLevel}`;
  $('#maxStreak').textContent=`${session.maxStreak}本`;
  $('#turnovers').textContent=`${turnovers}回`;
  $('#message').textContent=score>=13?'ELITE。20秒間、守備を動かしながら保持を支配しています。':score>=10?'高水準。寄せられる前に次の出口を作れています。':score>=7?'保持は成立。受ける前に次のパス先まで見よう。':'ボールだけでなく、守備3人の役割と空いた場所を先に見よう。';
  $('#possessionRates').innerHTML=`<div><span>20 SEC SUCCESS</span><strong>${completion}%</strong></div><div><span>AVG HOLD</span><strong>${(averageTime/1000).toFixed(1)}s</strong></div><div><span>MAX PASSES</span><strong>${session.maxStreak}</strong></div>`;
  $('#newBest').hidden=!isBest;
  state=null;show('result');refreshStats();
};

$('#start').onclick=start;
$('#retry').onclick=start;
