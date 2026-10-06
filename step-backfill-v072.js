/* BushTrack V0.7.4: missed-day backfill + camp return + camp ammo resupply. */
(function(){
  const PATCH_VERSION='0.7.4';
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
    const list=document.getElementById('locationList');if(!list||!window.state)return;list.querySelector('.main-camp-return-card')?.remove();list.insertAdjacentHTML('afterbegin',campReturnCard());document.getElementById('mapReturnMainCampBtn')?.addEventListener('click',()=>{if(typeof requestReturnToBase==='function')requestReturnToBase();});
  }
  function resupplyAtCamp(){
    const e=state&&state.expedition||{};
    if(e.active||Number(e.distanceFromBase||0)>0){alert('Return to camp before drawing fresh ammunition.');return;}
    const id=e.weaponId;
    const w=window.WEAPONS&&WEAPONS[id];
    if(!id||!w){alert('Choose a loadout first.');return;}
    const store=storeForKey();
    const have=Math.max(0,Number(store.ammo?.[id]||0));
    if(have<1){addEvent('No ammunition in camp',`There is no ${w.name} ammunition stored at ${currentBaseName()}.`);render();return;}
    const room=Math.max(0,Number(w.capacity||0)-Number(e.loaded||0));
    const moved=Math.min(room,have);
    if(moved<1){addEvent('Rifle already loaded',`The ${w.name} is already full.`);render();return;}
    store.ammo[id]=have-moved;e.loaded=Number(e.loaded||0)+moved;
    addEvent('Reloaded at camp',`${moved} round${moved===1?'':'s'} drawn from ${currentBaseName()} stores and loaded into the ${w.name}. ${fmt(store.ammo[id])} round${store.ammo[id]===1?'':'s'} remain stored.`);
    save();render();
  }
  function ensureCampAmmoButton(){
    const prep=document.getElementById('prepareOutingBtn');if(!prep)return;
    let b=document.getElementById('campAmmoBtn');
    if(!b){b=document.createElement('button');b.id='campAmmoBtn';b.className='secondary';b.addEventListener('click',resupplyAtCamp);prep.insertAdjacentElement('afterend',b);}
    const e=state&&state.expedition||{},id=e.weaponId,w=window.WEAPONS&&WEAPONS[id],atCamp=!e.active&&Number(e.distanceFromBase||0)<=0,stored=id?Math.max(0,Number(storeForKey().ammo?.[id]||0)):0,room=w?Math.max(0,Number(w.capacity||0)-Number(e.loaded||0)):0;
    b.classList.toggle('hidden',!atCamp||!id);b.disabled=!atCamp||!id||stored<1||room<1;b.textContent=room<1?'Rifle already loaded':`Reload ${w?w.name:'rifle'} from camp (${fmt(stored)} stored)`;
  }
  const oldRenderOuting=window.renderOuting;if(typeof oldRenderOuting==='function')window.renderOuting=function(){oldRenderOuting.apply(this,arguments);ensureCampAmmoButton();};
  const oldRenderLocations=window.renderLocations;if(typeof oldRenderLocations==='function')window.renderLocations=function(){oldRenderLocations.apply(this,arguments);ensureCampReturnUI();};
  const versionTag=document.querySelector('.topbar .eyebrow');if(versionTag)versionTag.textContent='V0.7.4 CAMP AMMO FIX';document.title='BushTrack V0.7.4';setTimeout(()=>{ensureBackfillUI();ensureCampReturnUI();ensureCampAmmoButton();},0);window.BushTrack072={ensureBackfillUI,backfillSteps,ensureCampReturnUI,ensureCampAmmoButton,resupplyAtCamp};
})();
