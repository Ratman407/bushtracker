/* BushTrack V0.7.20 — permanent milestones with manual reward claims.
   A milestone unlocks its badge when supported progress reaches its threshold.
   Cash and XP are only granted by the player's Claim Reward button.
   Kilometres and weight remain dormant until verified fitness data is supplied. */
(function () {
  'use strict';
  const GROUPS = [
    {key:'steps',name:'Lifetime steps',icon:'🥾',unit:'steps',
      targets:[10000,25000,50000,100000,250000,500000,1000000,2000000],
      names:['First Tracks','Finding Your Feet','Bush Walker','The Long Haul','Trail Regular','Half a Million','Million Step Trekker','Endless Country'],
      xp:[75,150,250,500,700,1200,2000,3500],
      cash:[25,50,100,250,350,600,1000,2000]},
    {key:'distance',name:'Distance walked',icon:'🧭',unit:'km',
      targets:[5,10,25,50,100,250,500,1000],
      names:['First Five','Ten on Foot','Track Marker','Long Circuit','Hundred Kilometre Club','Backcountry Explorer','Across the Ranges','The Thousand'],
      xp:[50,100,150,300,500,750,1250,2000],
      cash:[20,40,60,120,250,400,750,1200]},
    {key:'weight',name:'Weight lost',icon:'🏅',unit:'kg',
      targets:[2.5,5,10,15,20,25,40,50],
      names:['First Lighter Load','Five Down','Lightening the Load','Steady Progress','Twenty Down','Quarter-Century Down','Big Change','Fifty Down'],
      xp:[100,200,750,1000,1200,1500,2500,4000],
      cash:[50,100,500,650,800,1000,1600,2500]}
  ];
  const DEFINITIONS=[];
  for (const group of GROUPS) for (let i=0;i<group.targets.length;i++) {
    DEFINITIONS.push({id:group.key+'-'+String(group.targets[i]).replace('.','_'),
      metric:group.key,title:group.names[i],target:group.targets[i],
      unit:group.unit,icon:group.icon,xp:group.xp[i],cash:group.cash[i]});
  }
  const BY_ID=new Map(DEFINITIONS.map(d=>[d.id,d]));
  const clean=(x)=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const pretty=(value)=>Number(value).toLocaleString('en-AU',{maximumFractionDigits:1});
  const displayAmount=(d)=>pretty(d.target)+' '+d.unit;
  const now=()=>new Date().toISOString();
  function store(){
    if(!state||typeof state!=='object')return null;
    if(!state.milestones||typeof state.milestones!=='object'||Array.isArray(state.milestones))
      state.milestones={earned:{}};
    if(!state.milestones.earned||typeof state.milestones.earned!=='object'||Array.isArray(state.milestones.earned))
      state.milestones.earned={};
    return state.milestones.earned;
  }
  function valueFor(metric){
    if(!state)return null;
    if(metric==='steps'){
      const n=Number(state.totalSteps);
      return Number.isFinite(n)?Math.max(0,n):0;
    }
    const f=state.fitness||{};
    // Only the future Health distance integration can set this number.
    if(metric==='distance'){
      const n=f.walkingDistanceKm;
      return typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;
    }
    // Future weight integration must verify a reduction before setting this field.
    if(metric==='weight'){
      const n=f.confirmedWeightLossKg;
      return typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;
    }
    return null;
  }
  function discover(){
    const earned=store();
    if(!earned)return [];
    const newOnes=[];
    for(const d of DEFINITIONS){
      const n=valueFor(d.metric);
      if(n!==null&&n>=d.target&&!earned[d.id]){
        earned[d.id]={unlockedAt:now(),unlockedValue:n,claimedAt:null};
        addEvent('Milestone unlocked',d.title+' — '+displayAmount(d)+'. Badge earned; reward ready to claim.','achievement');
        newOnes.push(d);
      }
    }
    return newOnes;
  }
  function pendingCount(){
    const earned=store()||{};
    return DEFINITIONS.reduce((count,d)=>count+(earned[d.id]&&!earned[d.id].claimedAt?1:0),0);
  }
  function cardsFor(group){
    const earned=store()||{};
    const current=valueFor(group.key);
    return DEFINITIONS.filter(d=>d.metric===group.key).map(d=>{
      const record=earned[d.id];
      const unlocked=!!record;
      const claimed=!!record?.claimedAt;
      const percent=unlocked?100:(current===null?0:Math.max(0,Math.min(100,current/d.target*100)));
      const status=claimed?'CLAIMED':unlocked?'REWARD READY':current===null?'COMING SOON':'LOCKED';
      const label=current===null?'Awaiting verified '+(group.key==='distance'?'walking distance':'weight')+' data':
        pretty(Math.min(current,d.target))+' / '+displayAmount(d);
      const claim=unlocked&&!claimed?
        '<button type="button" class="primary mile-claim" data-claim-milestone="'+clean(d.id)+'">Claim Reward</button>':
        claimed?'<span class="mile-claimed-label">✓ Reward claimed</span>':'';
      return '<article class="mile-card '+(claimed?'mile-claimed':unlocked?'mile-earned':'mile-locked')+'">'+
        '<div class="mile-card-main"><div class="mile-seal" aria-hidden="true">'+clean(d.icon)+'</div>'+
        '<div class="mile-details"><div class="mile-title">'+clean(d.title)+'</div>'+
        '<div class="mile-target">'+clean(displayAmount(d))+' · '+clean(status)+'</div></div></div>'+
        '<div class="mile-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(percent)+'" aria-label="'+clean(d.title)+' progress"><span style="width:'+percent+'%"></span></div>'+
        '<div class="mile-card-footer"><span>'+clean(label)+'</span>'+
        '<strong>+'+pretty(d.xp)+' XP · $'+pretty(d.cash)+'</strong></div>'+
        (unlocked?'<div class="mile-date">Badge unlocked '+clean(new Date(record.unlockedAt).toLocaleDateString('en-AU'))+'</div>':'')+
        claim+'</article>';
    }).join('');
  }
  function paint(){
    const root=document.getElementById('milestoneSections');
    if(!root)return;
    const earned=store()||{};
    const unlocked=DEFINITIONS.reduce((n,d)=>n+(earned[d.id]?1:0),0);
    const pending=pendingCount();
    const tally=document.getElementById('milestoneSummary');
    if(tally)tally.textContent=unlocked+' badges unlocked · '+pending+' rewards ready to claim';
    const navCount=document.getElementById('milestoneNavCount');
    if(navCount){
      navCount.textContent=String(pending);
      navCount.hidden=pending===0;
    }
    root.innerHTML=GROUPS.map(group=>{
      const v=valueFor(group.key);
      const reason=group.key==='distance'?'Connect Apple Health walking/running distance to start earning these badges.':
        group.key==='weight'?'Weight milestones will activate when confirmed RENPHO / Apple Health weight tracking is added.':'All recorded BushTrack steps count, including earlier imports.';
      return '<section class="mile-group"><div class="mile-group-title"><span>'+clean(group.icon)+'</span><h3>'+clean(group.name)+'</h3></div>'+
        '<p class="mile-group-desc">'+clean(v===null?reason:group.key==='steps'?reason:'Tracked '+pretty(v)+' '+group.unit+' so far.')+'</p>'+
        '<div class="mile-grid">'+cardsFor(group)+'</div></section>';
    }).join('');
  }
  function notify(message){
    const toast=document.getElementById('milestoneToast');
    const text=document.getElementById('milestoneToastText');
    if(!toast||!text)return;
    text.textContent=message;
    toast.classList.remove('hidden');
  }
  function claim(id){
    const d=BY_ID.get(id),earned=store();
    if(!d||!earned||!earned[id]||earned[id].claimedAt)return;
    if(!createBackup('Before milestone reward '+id)){
      alert('Could not make a safety backup. Reward was not claimed.');return;
    }
    const prior=cloneJson(state);
    earned[id].claimedAt=now();
    state.xp=Math.max(0,Number(state.xp)||0)+d.xp;
    state.cash=Math.max(0,Number(state.cash)||0)+d.cash;
    addEvent('Milestone reward claimed',d.title+': +'+pretty(d.xp)+' XP and $'+pretty(d.cash)+'.','achievement');
    if(!save()){
      state=prior;
      alert('Could not save the reward. Your milestone remains available to claim.');
      render();
      return;
    }
    render();
    notify(d.title+' claimed: +'+pretty(d.xp)+' XP and $'+pretty(d.cash)+'.');
  }
  const originalRender=render;
  render=function(){
    let newOnes=[];
    try{newOnes=discover();}catch(error){console.error('Milestone detection',error);}
    const result=originalRender.apply(this,arguments);
    try{
      paint();
      if(newOnes.length)notify((newOnes.length===1?newOnes[0].title:newOnes.length+' milestones')+
        ' unlocked! Open Awards and tap Claim Reward.');
    }catch(error){console.error('Milestone display',error);}
    return result;
  };
  document.getElementById('milestoneSections')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-claim-milestone]');
    if(button)claim(button.getAttribute('data-claim-milestone'));
  });
  document.getElementById('milestoneToastClose')?.addEventListener('click',()=>{
    document.getElementById('milestoneToast')?.classList.add('hidden');
  });
  document.getElementById('milestoneToastOpen')?.addEventListener('click',()=>{
    document.getElementById('milestoneToast')?.classList.add('hidden');
    document.querySelector('.nav-btn[data-tab="milestones"]')?.click();
  });
  // The base game and seven-day importer run before this optional module loads.
  // Render once so existing lifetime step totals receive their badges retroactively.
  render();
})();