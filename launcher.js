const launcherGames={
  p1:{key:'dodge-read-pro-v2',total:20},
  p2:{key:'dodge-read-decision-v1',total:20},
  p3:{key:'dodge-read-peripheral-v1',total:20},
  p4:{key:'dodge-read-tracking-v1',total:15},
  p5:{key:'dodge-read-rondo-v1',total:20},
  p6:{key:'dodge-read-possession-v1',total:15}
};

function readLauncherProgress(key){
  try{
    return JSON.parse(localStorage.getItem(key))||null;
  }catch{
    return null;
  }
}

Object.entries(launcherGames).forEach(([id,game])=>{
  const card=document.querySelector(`[data-game="${id}"]`);
  if(!card)return;

  const progress=readLauncherProgress(game.key);
  const sessions=Number(progress?.sessions||0);
  const best=Number(progress?.best||0);

  const bestNode=card.querySelector('[data-best]');
  const sessionsNode=card.querySelector('[data-sessions]');

  if(bestNode)bestNode.textContent=sessions?`${best} / ${game.total}`:`-- / ${game.total}`;
  if(sessionsNode)sessionsNode.textContent=`${sessions}回`;
});
