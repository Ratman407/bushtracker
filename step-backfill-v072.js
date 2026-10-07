/* BushTrack V0.7.17: repair corrupted permanent-camp ammunition balances. */
(function(){
  const PATCH_VERSION='0.7.17';

  function unifyPermanentCamp(){
    try{
      if(!state)return;
      state.campStores=state.campStores||{};
      const main=state.campStores.main||(typeof freshStore==='function'?freshStore('Sheltered campsite'):{name:'Sheltered campsite',active:true,ammo:{}});
      main.name='Sheltered campsite';main.active=true;main.ammo=main.ammo||{};
      const oldKey='camp:campsite',old=state.campStores[oldKey];
      state.meta=state.meta||{};
      if(old&&!state.meta.shelteredCampUnified077){
        old.ammo=old.ammo||{};
        for(const id of ['22lr','44lever','223','3006']) main.ammo[id]=Math.max(0,Number(main.ammo[id]||0))+Math.max(0,Number(old.ammo[id]||0));
        main.meatKg=Math.max(0,Number(main.meatKg||0))+Math.max(0,Number(old.meatKg||0));
        main.scrapsKg=Math.max(0,Number(main.scrapsKg||0))+Math.max(0,Number(old.scrapsKg||0));
        main.yabbies=Math.max(0,Number(main.yabbies||0))+Math.max(0,Number(old.yabbies||0));
        main.hides=[...(main.hides||[]),...(old.hides||[])];
        state.meta.shelteredCampUnified077=true;
        if(typeof addEvent==='function')addEvent('Camp stores repaired','Sheltered campsite is now the permanent base. Ammunition and supplies previously split between Main Camp and the campsite were combined here.');
      }
      if(state.expedition&&(state.expedition.baseId===oldKey||(!state.expedition.active&&Number(state.expedition.distanceFromBase||0)<=0)))state.expedition.baseId='main';
      try{currentBaseName=function(){return currentStoreKey()==='main'?'Sheltered campsite':(baseLocationForKey()?.name||storeForKey().name||'Remote Camp');};}catch(e){}
    }catch(e){console.error('BushTrack permanent-camp migration',e);}
  }


  function recoverCampAmmo0716(){
    try{
      if(!state)return;
      state.meta=state.meta||{};
      if(state.meta.ammoRecovered0716)return;
      state.campStores=state.campStores||{};
      const main=state.campStores.main||(typeof freshStore==='function'?freshStore('Sheltered campsite'):{name:'Sheltered campsite',active:true,ammo:{}});
      main.name='Sheltered campsite';main.active=true;main.ammo=main.ammo||{};
      const ids=['22lr','44lever','223','3006'];
      const best={};
      for(const id of ids)best[id]=Math.max(0,Number(main.ammo[id]||0),Number(state.armoury?.ammo?.[id]||0));
      for(const [key,st] of Object.entries(state.campStores||{})){
        if(key==='main'||key==='camp:campsite'){
          for(const id of ids)best[id]=Math.max(best[id],Math.max(0,Number(st?.ammo?.[id]||0)));
        }
      }
      try{
        const raw=localStorage.getItem('bushtrack-v06-backups');
        const backups=JSON.parse(raw||'[]');
        if(Array.isArray(backups))for(const b of backups){
          const d=b&&b.data;if(!d)continue;
          for(const id of ids){
            best[id]=Math.max(best[id],Math.max(0,Number(d.campStores?.main?.ammo?.[id]||0)),Math.max(0,Number(d.campStores?.['camp:campsite']?.ammo?.[id]||0)),Math.max(0,Number(d.armoury?.ammo?.[id]||0)));
          }
        }
      }catch(e){}
      for(const id of ids)main.ammo[id]=best[id];
      state.armoury=state.armoury||{};state.armoury.ammo=state.armoury.ammo||{};
      for(const id of ids)state.armoury.ammo[id]=Math.max(Number(state.armoury.ammo[id]||0),Number(main.ammo[id]||0));
      // The old split-store bug could overwrite every recoverable copy with zero/2 rounds.
      // Restore a conservative one-time floor matching the original permanent armoury,
      // and one .223 pack when that rifle is owned. This is recovery, not a recurring refill.
      const floor={'22lr':75,'44lever':50,'3006':40,'223':(state.armoury?.owned||[]).includes('223')?20:0};
      for(const id of ids)main.ammo[id]=Math.max(Number(main.ammo[id]||0),Number(floor[id]||0));
      for(const id of ids)state.armoury.ammo[id]=Math.max(Number(state.armoury.ammo[id]||0),Number(main.ammo[id]||0));
      state.meta.ammoRecovered0716=true;
      if(typeof addEvent==='function')addEvent('Ammunition records recovered','BushTrack checked the permanent camp, legacy armoury and automatic backups and restored the highest valid stored ammunition totals it could find.');
    }catch(e){console.error('BushTrack ammo recovery 0.7.16',e);}
  }

  function forcePermanentAmmoStore0716(){
    try{
      if(!state)return;
      state.campStores=state.campStores||{};
      const main=state.campStores.main||(state.campStores.main={name:'Sheltered campsite',active:true,foodKg:0,meatKg:0,scrapsKg:0,yabbies:0,hides:[],ammo:{}});
      main.name='Sheltered campsite';main.active=true;main.ammo=main.ammo||{};
      state.armoury=state.armoury||{};state.armoury.ammo=state.armoury.ammo||{};
      for(const [id,n] of Object.entries(main.ammo))if(!Number.isFinite(Number(state.armoury.ammo[id])))state.armoury.ammo[id]=Number(n||0);
    }catch(e){console.error('BushTrack permanent ammo store 0.7.16',e);}
  }

  function recoveryCandidates0717(){
    const out=[];
    try{
      const raw=storageGet(LAST_GOOD_KEY);
      if(raw){const d=JSON.parse(raw);if(validateState(d))out.push({kind:'last-good',label:'Last known good',date:d.meta?.lastSavedAt||'',reason:'Previous atomic save',data:d});}
    }catch(e){}
    try{
      const bs=readBackups();
      bs.forEach((b,i)=>out.push({kind:'backup',label:'Backup '+(i+1),date:b.createdAt||b.data?.meta?.lastSavedAt||'',reason:b.reason||'Automatic backup',data:b.data}));
    }catch(e){}
    return out;
  }
  function ensureEmergencyRecovery0717(){
    if(document.getElementById('emergencyRecovery0717'))return;
    const host=document.querySelector('[data-page="save"]')||document.getElementById('savePage')||document.body;
    const card=document.createElement('section');card.id='emergencyRecovery0717';card.className='panel-card';
    const rows=recoveryCandidates0717();
    card.innerHTML='<div class="eyebrow">EMERGENCY SAVE RECOVERY</div><h3>Recover pre-bug save</h3><p class="micro">Nothing is restored until you tap a candidate below. Compare XP and total steps first.</p>'+
      (rows.length?rows.map((r,i)=>'<button class="secondary" data-recover0717="'+i+'" style="display:block;width:100%;margin:8px 0;text-align:left"><strong>'+esc(r.label)+'</strong><br><span>'+esc(r.reason)+' • '+esc(formatDateTime(r.date))+' • LV '+(Math.floor(Number(r.data?.xp||0)/1000)+1)+' • '+fmt(r.data?.xp||0)+' XP • '+fmt(r.data?.totalSteps||0)+' total steps</span></button>').join(''):'<p><strong>No valid local recovery copies were found.</strong></p>');
    host.prepend(card);
    card.addEventListener('click',e=>{
      const b=e.target.closest('[data-recover0717]');if(!b)return;
      const r=recoveryCandidates0717()[Number(b.dataset.recover0717)];if(!r)return;
      if(!confirm('Restore '+r.label+' from '+formatDateTime(r.date)+'?\n\nXP: '+fmt(r.data?.xp||0)+'\nTotal steps: '+fmt(r.data?.totalSteps||0)))return;
      try{
        state=migrateContentState(ensureEntityIds(ensureV6State(deepMerge(initialState(),JSON.parse(JSON.stringify(r.data))))));
        addEvent('Emergency save recovered','Recovered '+r.label+' from '+formatDateTime(r.date)+'.','system');
        save();render();alert('Recovered. Check your XP, steps, gear and map before doing anything else.');
      }catch(err){alert('Recovery failed: '+(err.message||err));}
    });
  }

  function shortDate(day){try{return dateFromDayKey(day).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'});}catch(e){return day;}}
  function validPastDay(day){return /^\d{4}-\d{2}-\d{2}$/.test(day)&&day<localDayKey();}
  function ensureBackfillUI(){
    if(document.getElementById('backfillStepsBtn'))return;
    const correction=document.getElementById('correctStepsInput'),card=correction&&correction.closest('.panel-card');if(!card)return;
    const block=document.createElement('div');block.id='stepBackfillBlock';block.innerHTML=`<div style="height:1px;background:#2c3a2f;margin:18px 0"></div><div class="card-head"><div><div class="eyebrow">MISSED DAY</div><h3>Backfill Health total</h3></div></div><p class="micro">Use this if you forgot to import a previous day's final Health total. It repairs walking history and averages without adding those old steps to today's trail.</p><label class="form-label">Date <input id="backfillDateInput" type="date" /></label><div class="claim-row"><input id="backfillStepsInput" inputmode="numeric" pattern="[0-9]*" placeholder="Final Health total" aria-label="Previous day Health step total" /><button class="secondary" id="backfillStepsBtn">Backfill day</button></div><p class="micro" id="backfillStatus">No missed day selected.</p>`;card.appendChild(block);
    const date=document.getElementById('backfillDateInput');date.max=addDaysKey(localDayKey(),-1);date.value=addDaysKey(localDayKey(),-1);document.getElementById('backfillStepsBtn').addEventListener('click',backfillSteps);
  }
  function backfillSteps(){
    const dateEl=document.getElementById('backfillDateInput'),stepsEl=document.getElementById('backfillStepsInput'),status=document.getElementById('backfillStatus'),day=String(dateEl&&dateEl.value||''),raw=String(stepsEl&&stepsEl.value||'').replace(/,/g,'').trim(),total=Number(raw);
    if(!validPastDay(day)){alert('Choose a previous date. Today still uses the normal Health import.');return;}if(!Number.isFinite(total)||total<0||!Number.isInteger(total)){alert('Enter the final Health step total for that day.');return;}
    state.stepLedger=state.stepLedger||{};const existing=state.stepLedger[day],old=existing?Math.max(0,Number(existing.credited||0)):0;if(existing&&!confirm(shortDate(day)+' already has '+fmt(old)+' steps recorded. Replace it with '+fmt(total)+'?'))return;
    state.stepLedger[day]=Object.assign({},existing||{},{credited:total,healthTotal:total,claimed:total,backfilled:true,backfilledAt:new Date().toISOString()});state.totalSteps=Math.max(0,Number(state.totalSteps||0)+(total-old));if(Array.isArray(state.claimAudit))state.claimAudit.unshift({id:uid('backfill'),day,healthTotal:total,delta:total-old,credited:total-old,at:new Date().toISOString(),type:'historical-backfill'});if(typeof addEvent==='function')addEvent('Walking history repaired',shortDate(day)+': '+fmt(total)+' Health steps recorded as a missed-day backfill. Historical repair only; no current trail progress was added.');try{if(typeof evaluateConditioning==='function')evaluateConditioning();}catch(e){}save();render();try{if(window.BushTrack064&&typeof window.BushTrack064.renderWalkingStats==='function')window.BushTrack064.renderWalkingStats();}catch(e){}if(status)status.textContent=shortDate(day)+' now records '+fmt(total)+' steps.';stepsEl.value='';
  }

  function campReturnCard(){
    const e=state&&state.expedition||{},active=!!e.active,dist=Math.max(0,Math.round(Number(e.distanceFromBase||0))),base=typeof currentBaseName==='function'?currentBaseName():'Main Camp';
    return `<article class="location-card main-camp-return-card"><div class="location-copy"><div class="eyebrow">PERMANENT BASE</div><h3>${esc(base)}</h3><p>Your armoury, purchased ammunition and stored supplies live here. Return to camp before changing loadout or drawing fresh ammunition.</p><div class="stat-row"><span>Route back</span><strong>${active?(dist>0?'~'+fmt(dist)+' steps':'At camp'):'At camp'}</strong></div><button class="${active?'primary':'secondary'}" id="mapReturnMainCampBtn" ${active?'':'disabled'}>${active?(dist>0?'Return to camp':'Finish return to camp'):'You are at camp'}</button></div></article>`;
  }
  function ensureCampReturnUI(){
    const list=document.getElementById('locationList');if(!list||!state)return;list.querySelector('.main-camp-return-card')?.remove();list.insertAdjacentHTML('afterbegin',campReturnCard());document.getElementById('mapReturnMainCampBtn')?.addEventListener('click',()=>{if(typeof requestReturnToBase==='function')requestReturnToBase();});
  }
  function resupplyAtCamp(){
    if(state?.expedition?.active){alert('Return to camp before changing ammunition.');return;}
    forcePermanentAmmoStore0716();
    save();
    openLoadout();
  }
  function patchLoadoutAmmo0716(){
    try{
      const original=window.openLoadout||openLoadout;
      window.openLoadout=function(){
        forcePermanentAmmoStore0716();
        save();
        return original.apply(this,arguments);
      };
    }catch(e){console.error('BushTrack loadout ammo patch 0.7.16',e);}
  }
  function showAmmoDebug0716(){
    try{
      const key=currentStoreKey();
      const st=storeForKey(key);
      const main=state.campStores?.main;
      let box=document.getElementById('ammoDebug0716');
      if(!box){
        box=document.createElement('div');box.id='ammoDebug0716';box.className='panel-card';
        const choices=document.getElementById('weaponChoices');
        if(choices)choices.insertAdjacentElement('beforebegin',box);
      }
      if(box)box.innerHTML='<div class="eyebrow">AMMO DEBUG 0.7.16</div><p class="micro">store key: <b>'+esc(String(key))+'</b><br>main: .22 '+fmt(main?.ammo?.['22lr']||0)+' | .44 '+fmt(main?.ammo?.['44lever']||0)+' | .223 '+fmt(main?.ammo?.['223']||0)+' | .30-06 '+fmt(main?.ammo?.['3006']||0)+'<br>loadout store: .22 '+fmt(st?.ammo?.['22lr']||0)+' | .44 '+fmt(st?.ammo?.['44lever']||0)+' | .223 '+fmt(st?.ammo?.['223']||0)+' | .30-06 '+fmt(st?.ammo?.['3006']||0)+'</p>';
    }catch(e){console.error('Ammo debug 0.7.16',e);}
  }
  function ensureCampAmmoButton(){
    const prep=document.getElementById('prepareOutingBtn');if(!prep)return;
    let b=document.getElementById('campAmmoBtn');
    if(!b){b=document.createElement('button');b.id='campAmmoBtn';b.className='secondary';b.addEventListener('click',resupplyAtCamp);prep.insertAdjacentElement('afterend',b);}
    const e=state&&state.expedition||{},atCamp=!e.active&&Number(e.distanceFromBase||0)<=0;
    if(atCamp){e.loaded=0;e.spare=0;}
    b.classList.toggle('hidden',!atCamp);b.disabled=!atCamp;
    b.textContent='Choose rifle & draw camp ammo';
    const field=document.getElementById('fieldReloadBtn');if(field&&!e.active)field.classList.add('hidden');
    const ret=document.getElementById('returnBaseBtn');if(ret&&!e.active)ret.classList.add('hidden');
  }
  unifyPermanentCamp();recoverCampAmmo0716();forcePermanentAmmoStore0716();patchLoadoutAmmo0716();
  const oldRender=window.render;if(typeof oldRender==='function')window.render=function(){unifyPermanentCamp();forcePermanentAmmoStore0716();oldRender.apply(this,arguments);ensureCampAmmoButton();ensureCampReturnUI();};
  document.getElementById('prepareOutingBtn')?.addEventListener('click',()=>{forcePermanentAmmoStore0716();save();setTimeout(()=>{ensureCampAmmoButton();},0);});
  const oldRenderLocations=window.renderLocations;if(typeof oldRenderLocations==='function')window.renderLocations=function(){oldRenderLocations.apply(this,arguments);ensureCampReturnUI();};
  const setVersionTag=()=>{const tags=[...document.querySelectorAll('.eyebrow')];const versionTag=tags.find(el=>/^V0\.7/i.test((el.textContent||'').trim()));if(versionTag)versionTag.textContent='V0.7.17 AMMO RESTORE';};setVersionTag();document.title='BushTrack V0.7.17';setTimeout(()=>{setVersionTag();ensureBackfillUI();ensureCampReturnUI();ensureCampAmmoButton();ensureEmergencyRecovery0717();},0);window.BushTrack072={ensureBackfillUI,backfillSteps,ensureCampReturnUI,ensureCampAmmoButton,resupplyAtCamp,ensureEmergencyRecovery0717};
})();
