/* BushTrack V0.7.19 — optional seven-calendar-day Health sync via iPhone Shortcut.
   Format: ?sync7=2026-11-03:4500,2026-11-04:8300,... (up to seven calendar days including today).
   Values must be DAILY totals, not one running total across the week.
   Never changes past outing state; today still uses the normal claim path. */
(function(){
  const params0719=new URLSearchParams(location.search);
  if(!params0719.has('sync7'))return;
  const raw=params0719.get('sync7')||'';
  // Remove the import URL before doing anything, so a refresh cannot replay it.
  try{history.replaceState({},'',location.pathname+location.hash);}catch(e){}

  function report(message,isError=false){
    const box=document.getElementById('claimStatus');
    if(box)box.textContent=message;
    if(isError){console.error('BushTrack weekly step sync:',message);alert(message);}
  }
  function parseRows(){
    const today=localDayKey(),allowed=new Set(Array.from({length:7},(_,i)=>addDaysKey(today,i-6)));
    const parts=raw.split(/[,;](?=\s*\d{4}-\d{2}-\d{2}:)/).map(x=>x.trim()).filter(Boolean);
    if(!parts.length||parts.length>7)throw new Error('Send 1–7 dated daily step totals, separated by commas or semicolons.');
    const used=new Set(),rows=[];
    for(const item of parts){
      const m=/^(\d{4}-\d{2}-\d{2}):([\d,]{1,9})$/.exec(item);
      if(!m||!allowed.has(m[1])||used.has(m[1]))throw new Error('Invalid, duplicate or out-of-week date in Health import: '+item);
      const steps=Number(m[2].replace(/,/g,''));
      if(!Number.isSafeInteger(steps)||steps<0||steps>100000)throw new Error('Invalid step total for '+m[1]);
      used.add(m[1]);rows.push({day:m[1],total:steps});
    }
    return rows.sort((a,b)=>a.day.localeCompare(b.day));
  }
  try{
    if(!state||!validateState(state))throw new Error('Your current save is not valid. Import cancelled; no steps changed.');
    const rows=parseRows(),today=localDayKey();
    const changes=rows.map(({day,total})=>{
      const l=state.stepLedger?.[day]||{};
      const previous=Math.max(0,Number(l.healthTotal||0),Number(l.credited||0));
      return {day,total,previous,delta:Math.max(0,total-previous)};
    }).filter(x=>x.delta>0);
    if(!changes.length){report('7-day Health check complete: all supplied days already up to date. No steps added.');return;}
    if(!createBackup('Before 7-day Shortcut Health sync'))throw new Error('Could not create a safety backup. Import cancelled.');
    const snapshot=cloneJson(state);
    let historical=0,todayAdded=0;
    try{
      state.stepLedger=state.stepLedger||{};
      for(const c of changes.filter(x=>x.day!==today)){
        const old=state.stepLedger[c.day]||{};
        const now=new Date().toISOString();
        state.stepLedger[c.day]=Object.assign({},old,{
          date:c.day,credited:c.total,healthTotal:c.total,claimed:c.total,
          backfilled:true,backfilledAt:now,lastSeenAt:now,finalized:true,
          weeklySync0719:true
        });
        state.totalSteps=Math.max(0,Number(state.totalSteps||0))+c.delta;
        // Missed dates earn their earned step XP, but do not retroactively change
        // a hunt/encounter that may have finished since that date.
        state.xp=Math.max(0,Number(state.xp||0))+Math.round(c.delta/22*conditioningXpMultiplier());
        if(Array.isArray(state.backend?.claimAudit))
          state.backend.claimAudit.push({id:uid('weekSync'),at:now,day:c.day,source:'shortcut-weekly-history',
            previousHealthTotal:c.previous,healthTotal:c.total,creditedDelta:c.delta,historical:true,outingActive:false});
        historical+=c.delta;
      }
      const current=changes.find(x=>x.day===today);
      if(current){
        // Today's normal importer also moves the currently active outing.
        // Its own backup is skipped because we already made a full pre-batch backup.
        const ledger=state.stepLedger?.[today];
        if(ledger&&Number(ledger.healthTotal||0)<Number(ledger.credited||0))
          ledger.healthTotal=Number(ledger.credited||0);
        todayAdded=creditHealthTotal(current.total,{source:'shortcut-weekly',skipBackup:true});
        if(todayAdded!==current.delta)throw new Error('Today’s step claim did not match the expected increase.');
      }
      addEvent('Seven-day Health sync',
        fmt(historical+todayAdded)+' new steps recovered across '+changes.length+' day(s): '+fmt(historical)+' historical and '+fmt(todayAdded)+' today. No previous hunt progress was replayed.',
        'steps');
      if(!save())throw new Error('Could not confirm the save after importing. Use Save → recovery if needed.');
      render();
      report('7-day Health sync: +'+fmt(historical+todayAdded)+' steps ('+fmt(historical)+' previous days; '+fmt(todayAdded)+' today). Only missing steps were added.');
    }catch(e){
      state=snapshot;
      throw e;
    }
  }catch(e){
    report('7-day Health import stopped: '+(e.message||e),true);
  }
})();
