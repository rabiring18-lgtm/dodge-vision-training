// Protocol 06 wildcard defender
// One defender ignores the normal press/mark/cover structure and changes
// direction, route and speed unpredictably throughout each 20-second set.

const originalPossessionMakeSetForWildcard=makeSet;

const WILDCARD_PATTERNS=[
  'cross-court',
  'orbit-holder',
  'retreat-return',
  'lane-ambush',
  'receiver-jump',
  'free-zigzag'
];

function wildcardCourtPoint(xRatio,yRatio){
  return insideCourt(w*xRatio,h*yRatio,.10);
}

function chooseWildcardPlan(t,defender,now,force=false){
  if(!force&&now<(defender.wildcardNextAt||0))return;

  const previous=defender.wildcardPattern;
  const choices=WILDCARD_PATTERNS.filter(pattern=>pattern!==previous);
  const pattern=choices[Math.floor(Math.random()*choices.length)]||WILDCARD_PATTERNS[0];
  const holder=t.attackers[t.holder];
  const candidates=t.attackers.map((_,index)=>index).filter(index=>index!==t.holder);
  const receiverIndex=candidates[Math.floor(Math.random()*candidates.length)];
  const receiver=t.attackers[receiverIndex];
  const size=Math.min(w,h);
  let target={x:w/2,y:h/2};

  switch(pattern){
    case 'cross-court': {
      const oppositeX=defender.x<w/2?random(.68,.88):random(.12,.32);
      const oppositeY=defender.y<h/2?random(.62,.84):random(.16,.38);
      target=wildcardCourtPoint(oppositeX,oppositeY);
      break;
    }

    case 'orbit-holder': {
      const angle=random(0,Math.PI*2);
      const radius=size*random(.17,.31);
      target=insideCourt(holder.x+Math.cos(angle)*radius,holder.y+Math.sin(angle)*radius,.10);
      break;
    }

    case 'retreat-return': {
      const dx=defender.x-holder.x;
      const dy=defender.y-holder.y;
      const length=Math.hypot(dx,dy)||1;
      const retreat=Math.random()<.55;
      target=retreat
        ?insideCourt(holder.x+dx/length*size*random(.34,.48),holder.y+dy/length*size*random(.34,.48),.10)
        :insideCourt(holder.x+dx/length*size*random(.06,.14),holder.y+dy/length*size*random(.06,.14),.10);
      break;
    }

    case 'lane-ambush': {
      const ratio=random(.24,.76);
      const lane=linePoint(holder,receiver,ratio);
      const dx=receiver.x-holder.x;
      const dy=receiver.y-holder.y;
      const length=Math.hypot(dx,dy)||1;
      const offset=size*random(-.15,.15);
      target=insideCourt(lane.x+(-dy/length)*offset,lane.y+(dx/length)*offset,.10);
      break;
    }

    case 'receiver-jump': {
      const dx=holder.x-receiver.x;
      const dy=holder.y-receiver.y;
      const ratio=random(.08,.27);
      target=insideCourt(receiver.x+dx*ratio,receiver.y+dy*ratio,.10);
      break;
    }

    case 'free-zigzag':
    default:
      target=wildcardCourtPoint(random(.12,.88),random(.14,.86));
      break;
  }

  defender.wildcardPattern=pattern;
  defender.wildcardTarget=target;
  defender.wildcardReceiver=receiverIndex;
  defender.wildcardNextAt=now+random(300,930);
  defender.wildcardBaseSpeed=random(.74,1.22);

  // Short, unpredictable bursts. Some plans remain at normal speed, while
  // others suddenly accelerate for roughly 0.2–0.55 seconds.
  if(Math.random()<.38){
    defender.wildcardBoostUntil=now+random(190,560);
    defender.wildcardBoost=random(1.65,2.45);
  }else{
    defender.wildcardBoostUntil=0;
    defender.wildcardBoost=1;
  }
}

assignDefensePlan=function(t,force=false){
  const now=performance.now();
  if(!force&&now<(t.nextReplanAt||0))return;

  if(!Number.isInteger(t.wildcardIndex)){
    t.wildcardIndex=Math.floor(Math.random()*t.defenders.length);
  }

  const holder=t.holder;
  const candidates=t.attackers.map((_,index)=>index).filter(index=>index!==holder);
  const predicted=predictedReceiver(t);
  const byDistance=[...candidates].sort((a,b)=>{
    const pa=t.attackers[a],pb=t.attackers[b],ball=t.attackers[holder];
    return Math.hypot(pa.x-ball.x,pa.y-ball.y)-Math.hypot(pb.x-ball.x,pb.y-ball.y);
  });
  const nearest=byDistance[0];
  const farthest=byDistance[byDistance.length-1];
  const structured=[0,1,2].filter(index=>index!==t.wildcardIndex);
  const pressIndex=Math.random()<.5?structured[0]:structured[1];
  const supportIndex=structured.find(index=>index!==pressIndex);

  t.defenders.forEach((defender,index)=>{
    if(index===t.wildcardIndex){
      defender.role='wildcard';
      defender.target=null;
      defender.side=Math.random()<.5?-1:1;
      chooseWildcardPlan(t,defender,now,force||!defender.wildcardTarget);
      return;
    }

    if(index===pressIndex){
      defender.role='press';
      defender.target=holder;
      defender.tempo=random(1.00,1.12);
    }else{
      defender.role=Math.random()<.52?'mark':'cover';
      defender.target=defender.role==='mark'
        ?(Math.random()<.62?nearest:predicted)
        :(Math.random()<.58?farthest:predicted);
      defender.tempo=defender.role==='mark'?random(.91,1.04):random(.88,1.01);
    }
    defender.side=Math.random()<.5?-1:1;
  });

  t.nextReplanAt=now+random(t.d.replanMin,t.d.replanMax);
};

makeSet=function(level,holder){
  const t=originalPossessionMakeSetForWildcard(level,holder);
  if(!Number.isInteger(t.wildcardIndex)){
    t.wildcardIndex=Math.floor(Math.random()*t.defenders.length);
  }
  assignDefensePlan(t,true);
  return t;
};

function moveWildcardDefender(t,defender,dt,now){
  const size=Math.min(w,h);

  if(t.phase==='passing'&&t.pass){
    const passId=t.pass.started;
    if(defender.wildcardPassId!==passId){
      defender.wildcardPassId=passId;

      // Sometimes attack the live pass lane, sometimes ignore it and keep the
      // irregular route. This prevents the player from learning one response.
      if(Math.random()<.48){
        const to=t.attackers[t.pass.to];
        const ratio=random(.25,.80);
        const lane=linePoint(t.pass.start,to,ratio);
        const dx=to.x-t.pass.start.x;
        const dy=to.y-t.pass.start.y;
        const length=Math.hypot(dx,dy)||1;
        const offset=size*random(-.08,.08);
        defender.wildcardTarget=insideCourt(
          lane.x+(-dy/length)*offset,
          lane.y+(dx/length)*offset,
          .10
        );
        defender.wildcardBoostUntil=now+random(160,430);
        defender.wildcardBoost=random(1.75,2.55);
        defender.wildcardNextAt=now+random(260,650);
      }
    }
  }else{
    defender.wildcardPassId=null;
    chooseWildcardPlan(t,defender,now,false);
  }

  if(!defender.wildcardTarget){
    chooseWildcardPlan(t,defender,now,true);
  }

  const boost=now<(defender.wildcardBoostUntil||0)?(defender.wildcardBoost||1):1;
  const pulse=1+Math.sin(now/115+(defender.phase||0))*.08;
  const speed=size*t.d.defenderSpeed*(defender.wildcardBaseSpeed||1)*boost*pulse;
  moveToward(defender,defender.wildcardTarget.x,defender.wildcardTarget.y,speed,dt);

  const distance=Math.hypot(defender.x-defender.wildcardTarget.x,defender.y-defender.wildcardTarget.y);
  if(distance<size*.035){
    defender.wildcardNextAt=0;
  }
}

moveDefenders=function(t,dt,now){
  const size=Math.min(w,h);
  const holder=t.attackers[t.holder];
  assignDefensePlan(t,false);

  t.defenders.forEach(defender=>{
    if(defender.role==='wildcard'){
      moveWildcardDefender(t,defender,dt,now);
      const point=insideCourt(defender.x,defender.y,.085);
      defender.x=point.x;defender.y=point.y;
      return;
    }

    let target={x:w/2,y:h/2};
    let multiplier=defender.tempo;

    if(t.phase==='passing'&&t.pass){
      const from=t.pass.start;
      const to=t.attackers[t.pass.to];

      if(defender.role==='press'){
        target=linePoint(from,to,.88);
        multiplier*=1.12;
      }else if(defender.role==='mark'){
        const marked=t.attackers[defender.target]||to;
        if(defender.target===t.pass.to){
          target=linePoint(from,to,.66);
          multiplier*=1.08;
        }else{
          target={x:marked.x+(to.x-marked.x)*.08,y:marked.y+(to.y-marked.y)*.08};
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
      target={x:receiver.x+(holder.x-receiver.x)*.17,y:receiver.y+(holder.y-receiver.y)*.17};
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
