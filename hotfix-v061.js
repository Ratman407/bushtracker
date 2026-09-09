/* BushTrack V0.6.1 hotfix: readable shot target + recovery step-credit carryover. */
(function(){
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
      aimPos=0; aimDir=1;
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
      if(advice && !document.getElementById('fireBtn').disabled) advice.textContent='Tap SHOT when the reticle is over the chest/vitals. Range, rifle, fatigue and support change how steady it feels.';
    }catch(err){ console.error('BushTrack V0.6.1 shot hotfix',err); }
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
      if(e.recoveryRemaining<=0){
        e.recoveryRemaining=0;
        recoverAnimal();
      }
      save();
      render();
      return true;
    }catch(err){ console.error('BushTrack V0.6.1 recovery hotfix',err); return false; }
  }

  const shotModal=document.getElementById('shotModal');
  if(shotModal){
    const obs=new MutationObserver(function(){ if(!shotModal.classList.contains('hidden')) prepareReadableShot(); });
    obs.observe(shotModal,{attributes:true,attributeFilter:['class']});
  }

  const encounterAction=document.getElementById('encounterActionBtn');
  if(encounterAction) encounterAction.addEventListener('click',function(){ setTimeout(applyRecoveryCredit,0); });
  const fire=document.getElementById('fireBtn');
  if(fire) fire.addEventListener('click',function(){ setTimeout(applyRecoveryCredit,0); });

  // If the player is already sitting on a recovery from V0.6, one tap on Active recovery now consumes banked credit immediately.
  window.BushTrack061={prepareReadableShot:prepareReadableShot,applyRecoveryCredit:applyRecoveryCredit};
})();
