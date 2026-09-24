/* BushTrack V0.7.2: missed-day Health step backfill.
   Historical totals repair the step ledger/statistics only. They deliberately do not
   advance the current trail: a forgotten import should fix history without replaying
   yesterday's game progress into today's world state. */
(function(){
  const PATCH_VERSION='0.7.2';

  function shortDate(day){
    try{return dateFromDayKey(day).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'});}catch(e){return day;}
  }
  function validPastDay(day){
    return /^\d{4}-\d{2}-\d{2}$/.test(day)&&day<localDayKey();
  }
  function ensureBackfillUI(){
    if(document.getElementById('backfillStepsBtn'))return;
    const correction=document.getElementById('correctStepsInput');
    const card=correction&&correction.closest('.panel-card');
    if(!card)return;
    const block=document.createElement('div');
    block.id='stepBackfillBlock';
    block.innerHTML=`
      <div style="height:1px;background:#2c3a2f;margin:18px 0"></div>
      <div class="card-head"><div><div class="eyebrow">MISSED DAY</div><h3>Backfill Health total</h3></div></div>
      <p class="micro">Use this if you forgot to import a previous day's final Health total. It repairs walking history and averages without adding those old steps to today's trail.</p>
      <label class="form-label">Date <input id="backfillDateInput" type="date" /></label>
      <div class="claim-row"><input id="backfillStepsInput" inputmode="numeric" pattern="[0-9]*" placeholder="Final Health total" aria-label="Previous day Health step total" /><button class="secondary" id="backfillStepsBtn">Backfill day</button></div>
      <p class="micro" id="backfillStatus">No missed day selected.</p>`;
    card.appendChild(block);
    const date=document.getElementById('backfillDateInput');
    date.max=addDaysKey(localDayKey(),-1);
    date.value=addDaysKey(localDayKey(),-1);
    document.getElementById('backfillStepsBtn').addEventListener('click',backfillSteps);
  }

  function backfillSteps(){
    const dateEl=document.getElementById('backfillDateInput');
    const stepsEl=document.getElementById('backfillStepsInput');
    const status=document.getElementById('backfillStatus');
    const day=String(dateEl&&dateEl.value||'');
    const raw=String(stepsEl&&stepsEl.value||'').replace(/,/g,'').trim();
    const total=Number(raw);
    if(!validPastDay(day)){alert('Choose a previous date. Today still uses the normal Health import.');return;}
    if(!Number.isFinite(total)||total<0||!Number.isInteger(total)){alert('Enter the final Health step total for that day.');return;}
    state.stepLedger=state.stepLedger||{};
    const existing=state.stepLedger[day];
    const old=existing?Math.max(0,Number(existing.credited||0)):0;
    if(existing&&!confirm(shortDate(day)+' already has '+fmt(old)+' steps recorded. Replace it with '+fmt(total)+'?'))return;

    state.stepLedger[day]=Object.assign({},existing||{}, {
      credited:total,
      healthTotal:total,
      claimed:total,
      backfilled:true,
      backfilledAt:new Date().toISOString()
    });
    state.totalSteps=Math.max(0,Number(state.totalSteps||0)+(total-old));
    if(Array.isArray(state.claimAudit))state.claimAudit.unshift({id:uid('backfill'),day,healthTotal:total,delta:total-old,credited:total-old,at:new Date().toISOString(),type:'historical-backfill'});
    if(typeof addEvent==='function')addEvent('Walking history repaired',shortDate(day)+': '+fmt(total)+' Health steps recorded as a missed-day backfill. Historical repair only; no current trail progress was added.');
    try{if(typeof evaluateConditioning==='function')evaluateConditioning();}catch(e){}
    save();
    render();
    try{if(window.BushTrack064&&typeof window.BushTrack064.renderWalkingStats==='function')window.BushTrack064.renderWalkingStats();}catch(e){}
    if(status)status.textContent=shortDate(day)+' now records '+fmt(total)+' steps.';
    stepsEl.value='';
  }

  const versionTag=document.querySelector('.topbar .eyebrow');
  if(versionTag)versionTag.textContent='V0.7.2 STEP BACKFILL';
  document.title='BushTrack V0.7.2';
  setTimeout(ensureBackfillUI,0);
  window.BushTrack072={ensureBackfillUI,backfillSteps};
})();
