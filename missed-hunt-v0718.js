/* Optional, one-time credit of already-recorded yesterday steps to an active outing. */
(function(){
  const KEY='huntCreditFromBackfill0718';
  function yesterday(){return addDaysKey(localDayKey(),-1);}
  function eligible(){
    const day=yesterday(),l=state?.stepLedger?.[day];
    if(!l?.backfilled||l[KEY])return {day,steps:0,ledger:l};
    const audit=(state.claimAudit||[]).filter(a=>a.day===day&&a.type==='historical-backfill');
    const last=audit[0];
    // Only the increment added by the historical repair is eligible.
    // Existing daily claims have already progressed gameplay.
    const steps=last?Math.max(0,Math.floor(Number(last.delta||0))):(!Array.isArray(l.claims)||!l.claims.length?Math.floor(Number(l.credited||0)):0);
    return {day,steps:Math.min(100000,steps),ledger:l};
  }
  function update(){
    const button=document.getElementById('backfillHuntCredit0718'),msg=document.getElementById('backfillHuntCreditStatus0718');
    if(!button||!msg)return;
    const e=eligible(),used=!!e.ledger?.[KEY],active=!!state?.expedition?.active;
    button.disabled=!e.steps||!active||used;
    msg.textContent=used?'Already credited once.':!e.ledger?.backfilled?'Backfill yesterday first.':!e.steps?'No unclaimed steps are available from yesterday.':!active?'Start or resume an outing to use this.':fmt(e.steps)+' recorded steps available for your current outing. No extra XP or total steps.';
  }
  function credit(){
    const e=eligible();if(!e.steps||!state?.expedition?.active){update();return;}
    if(!confirm('Apply '+fmt(e.steps)+' previously recorded steps from yesterday to the CURRENT outing? This is a one-time credit and will not add steps or XP again.'))return;
    if(!createBackup('Before missed-day outing credit '+e.day)){alert('Could not create a safety backup. No changes made.');return;}
    const before=cloneJson(state.active);
    e.ledger[KEY]={at:new Date().toISOString(),steps:e.steps,activeBefore:before};
    applyStepsToActive(e.steps);
    addEvent('Missed-day outing credit',fmt(e.steps)+' already-recorded steps applied once to the active outing.','steps');
    if(!save())alert('Save could not be confirmed. Export your game save before continuing.');
    render();update();
  }
  function install(){
    const host=document.getElementById('stepBackfillBlock');
    if(!host)return;
    if(!document.getElementById('backfillHuntCredit0718')){
      const wrap=document.createElement('div');wrap.style.marginTop='12px';
      wrap.innerHTML='<button class="secondary" id="backfillHuntCredit0718" type="button">Credit yesterday to current outing (once)</button><p class="micro" id="backfillHuntCreditStatus0718"></p>';
      host.appendChild(wrap);
      document.getElementById('backfillHuntCredit0718').addEventListener('click',credit);
    }
    update();
  }
  setTimeout(install,0);
  document.querySelector('[data-tab="settings"]')?.addEventListener('click',()=>setTimeout(install,0));
  window.BushTrackMissedHunt={refresh:install};
})();
