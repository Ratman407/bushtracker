/* BushTrack V0.6.2 hotfix: readable shot target, banked-step carryover, and update-banner fix. */
(function(){
  const HOTFIX_VERSION='0.6.2';
  const versionTag=document.querySelector('.topbar .eyebrow');
  if(versionTag)versionTag.textContent='V0.6.2 STEP CREDIT FIX';
  document.title='BushTrack V0.6.2';

  function addTargetIfNeeded(){
    const box=document.getElementById('aimBox');
    const vitals=document.getElementById('vitalsZone');
    if(!box||!vitals)return null;
    let target=document.getElementById('animalTarget');
    if(!target){
      target=document.createElement('div');
      target.id='animalTarget';
      target.className='animal-target deer';
      target.setAttribute('aria-hidden','true');
      target.innerHTML='<div class="animal-body"></div><div class="animal-neck"></div><div class="animal-head"></div><div class="animal-ear ear-one"></div><div class="animal-ear ear-two"></div><div class="animal-leg leg-one"></div><div class="animal-leg leg-two"></div><div class="animal-tail"></div><div class="animal-antler antler-one"></div><div class="animal-antler antler-two"></div>';
      box.insertBefore(target,vitals);
    }
    return target;
  }

  function prepareReadableShot(){
    try{
      const e=state&&state.currentEncounter;
      if(!e||e.stage!=='shot')return;
      const a=e.selectedAnimal||{};
      const target=addTargetIfNeeded();
      if(target){
        const cls=({'Fallow deer':'deer','Red deer':'deer','Feral goat':'goat','Feral pig':'pig','Rabbit':'rabbit'})[a.species]||'deer';
        target.className='animal-target '+cls;
      }
      clearInterval(aimTimer);
      aimPos=0;aimDir=1;
      const w=currentWeapon();
      const fatigue=Number(state.expedition&&state.expedition.fatigue||0);
      const support=shotSupportBonus(e);
      const speed=clamp(1.15+(1.02-w.handling)*1.8+fatigue*.0018-support*.75,.65,2.4);
      const marker=document.getElementById('aimMarker');
      if(marker)marker.style.left='0%';
      aimTimer=setInterval(function(){
        aimPos+=aimDir*speed;
        if(aimPos>=100){aimPos=100;aimDir=-1;}
        if(aimPos<=0){aimPos=0;aimDir=1;}
        if(marker)marker.style.left=aimPos+'%';
      },50);
      const advice=document.getElementById('shotAdviceText');
      const fire=document.getElementById('fireBtn');
      if(advice&&fire&&!fire.disabled)advice.textContent='Tap SHOT when the reticle is over the chest/vitals. Range, rifle, fatigue and support change how steady it feels.';
    }catch(err){console.error('BushTrack V0.6.2 shot hotfix',err);}
  }

  function applyRecoveryCredit(){
    try{
      const e=state&&state.currentEncounter;
      const credit=Math.max(0,Number(state&&state.stepCredit||0));
      if(!e||e.stage!=='recovery'||credit<=0)return false;
      const used=Math.min(credit,Math.max(0,Number(e.recoveryRemaining||0)));
      if(used<=0)return false;
      e.recoveryRemaining=Math.max(0,Number(e.recoveryRemaining||0)-used);
      state.stepCredit=credit-used;
      addEvent('Recovery walking counted',fmt(used)+' banked same-day steps were applied to the blood trail.'+(state.stepCredit>0?' '+fmt(state.stepCredit)+' same-day steps remain available.':''));
      if(e.recoveryRemaining<=0){e.recoveryRemaining=0;recoverAnimal();}
      save();render();return true;
    }catch(err){console.error('BushTrack V0.6.2 recovery hotfix',err);return false;}
  }

  function applyCreditToHunt(){
    try{
      const credit=Math.max(0,Number(state&&state.stepCredit||0));
      if(credit<=0||!state.hunt||state.hunt.stage!=='track')return false;
      state.active={kind:'hunt',id:null};
      state.stepCredit=0;
      addEvent('Banked walking applied',fmt(credit)+' same-day steps were put onto the deer trail.');
      advanceHunt(credit);
      save();render();return true;
    }catch(err){console.error('BushTrack V0.6.2 hunt-credit hotfix',err);return false;}
  }

  function applyCreditToRiver(){
    try{
      const credit=Math.max(0,Number(state&&state.stepCredit||0));
      if(credit<=0||!state.river||!state.river.discovered||state.river.ready)return false;
      state.active={kind:'river',id:null};
      state.stepCredit=0;
      addEvent('Banked walking applied',fmt(credit)+' same-day steps were put onto the creek trail.');
      advanceRiver(credit);
      save();render();return true;
    }catch(err){console.error('BushTrack V0.6.2 river-credit hotfix',err);return false;}
  }

  function applyCreditToObjective(id){
    try{
      const credit=Math.max(0,Number(state&&state.stepCredit||0));
      if(!id||credit<=0)return false;
      const o=state.objectives&&state.objectives.find(function(x){return x.id===id&&!x.complete;});
      if(!o)return false;
      setObjectiveActive(id,true);
      addEvent('Banked walking applied','Same-day step credit was applied to '+o.title.toLowerCase()+'.');
      save();render();return true;
    }catch(err){console.error('BushTrack V0.6.2 objective-credit hotfix',err);return false;}
  }

  function applyCreditToEncounter(){
    try{
      const e=state&&state.currentEncounter;
      if(!e||Number(state&&state.stepCredit||0)<=0)return false;
      state.active={kind:'encounter',id:e.id};
      if(e.stage==='recovery')return applyRecoveryCredit();
      if(e.stage==='approach'){
        const before=Number(state.stepCredit||0);
        applyStepCreditToEncounter();
        if(Number(state.stepCredit||0)!==before){save();render();return true;}
      }
      return false;
    }catch(err){console.error('BushTrack V0.6.2 encounter-credit hotfix',err);return false;}
  }

  async function currentServerVersion(){
    try{
      const r=await fetch('./version.json?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)return null;
      const info=await r.json();
      return info&&info.version?String(info.version):null;
    }catch(err){return null;}
  }

  async function tidyUpdateBanner(){
    const banner=document.getElementById('updateBanner');
    if(!banner||banner.classList.contains('hidden'))return;
    const server=await currentServerVersion();
    if(server===HOTFIX_VERSION)banner.classList.add('hidden');
  }

  try{
    checkForUpdate=async function(showCurrent=false){
      const banner=document.getElementById('updateBanner');
      const text=document.getElementById('updateBannerText');
      const server=await currentServerVersion();
      if(!server){if(showCurrent)alert('Could not check for an update right now.');return;}
      if(server!==HOTFIX_VERSION){
        if(text)text.textContent='BushTrack '+server+' is available. Reload to update the game code; your save stays intact.';
        if(banner)banner.classList.remove('hidden');
      }else{
        if(banner)banner.classList.add('hidden');
        if(showCurrent)alert('BushTrack '+HOTFIX_VERSION+' is current.');
      }
    };
  }catch(err){}

  const shotModal=document.getElementById('shotModal');
  if(shotModal){
    const obs=new MutationObserver(function(){if(!shotModal.classList.contains('hidden'))prepareReadableShot();});
    obs.observe(shotModal,{attributes:true,attributeFilter:['class']});
  }

  const updateBanner=document.getElementById('updateBanner');
  if(updateBanner){
    const updateObs=new MutationObserver(function(){setTimeout(tidyUpdateBanner,20);});
    updateObs.observe(updateBanner,{attributes:true,attributeFilter:['class']});
    setTimeout(tidyUpdateBanner,30);
  }

  const huntBtn=document.getElementById('selectHuntBtn');
  if(huntBtn)huntBtn.addEventListener('click',function(){setTimeout(applyCreditToHunt,0);});
  const riverBtn=document.getElementById('selectRiverBtn');
  if(riverBtn)riverBtn.addEventListener('click',function(){setTimeout(applyCreditToRiver,0);});
  const objectiveList=document.getElementById('objectiveList');
  if(objectiveList)objectiveList.addEventListener('click',function(ev){
    const b=ev.target.closest('[data-objective]');if(!b)return;const id=b.dataset.objective;setTimeout(function(){applyCreditToObjective(id);},0);
  });
  const encounterAction=document.getElementById('encounterActionBtn');
  if(encounterAction)encounterAction.addEventListener('click',function(){setTimeout(applyCreditToEncounter,0);});
  const fire=document.getElementById('fireBtn');
  if(fire)fire.addEventListener('click',function(){setTimeout(applyRecoveryCredit,0);});

  window.BushTrack062={prepareReadableShot:prepareReadableShot,applyRecoveryCredit:applyRecoveryCredit,applyCreditToHunt:applyCreditToHunt,applyCreditToRiver:applyCreditToRiver,applyCreditToObjective:applyCreditToObjective,applyCreditToEncounter:applyCreditToEncounter};
})();
