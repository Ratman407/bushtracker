/* BushTrack V0.7.22 — seven-day walking/running distance sync.
   Query: ?km7=2026-11-10:3.42;2026-11-11:4.18 (up to 7 days).
   Entries must be daily totals in kilometres. Repeating a date replaces that
   date's value, rather than adding it twice. Other game mechanics are untouched. */
(function () {
  'use strict';
  const params=new URLSearchParams(location.search);
  if(!params.has('km7'))return;
  const raw=(params.get('km7')||'').replace(/\u2060/g,'');
  function clearKmOnly(){
    try {
      params.delete('km7');
      history.replaceState({},'',location.pathname+(params.toString()?'?'+params.toString():'')+location.hash);
    } catch(e) {}
  }
  function parse(){
    const today=localDayKey();
    const valid=new Set(Array.from({length:7},(_,i)=>addDaysKey(today,i-6)));
    const pieces=raw.split(/[;,](?=\s*\d{4}-\d{2}-\d{2}:)/).map(s=>s.trim()).filter(Boolean);
    if(!pieces.length||pieces.length>7)throw Error('Send 1–7 dated distance totals in kilometres.');
    const seen=new Set(),records=[];
    for(const item of pieces){
      const m=/^(\d{4}-\d{2}-\d{2}):(\d{1,3}(?:\.\d{1,3})?)$/.exec(item);
      if(!m||!valid.has(m[1])||seen.has(m[1]))throw Error('Invalid or duplicate distance day: '+item);
      const km=Number(m[2]);
      if(!Number.isFinite(km)||km<0||km>150)throw Error('Invalid kilometre total: '+item);
      seen.add(m[1]);records.push({day:m[1],km:Math.round(km*1000)/1000});
    }
    return records;
  }
  // Remove distance data from URL so refreshing cannot replay the import.
  // A simultaneous step sync remains available to the original importer.
  clearKmOnly();
  try {
    if(!state||!validateState(state))throw Error('Your current game save is invalid.');
    const rows=parse();
    const f=state.fitness||{};
    const prior=f.distanceDays&&typeof f.distanceDays==='object'?f.distanceDays:{};
    const changed=rows.filter(({day,km})=>Number(prior[day])!==km || !Object.prototype.hasOwnProperty.call(prior,day));
    if(!changed.length)return;
    if(!createBackup('Before seven-day distance sync'))throw Error('Could not create safety backup.');
    const snapshot=cloneJson(state);
    try{
      state.fitness=state.fitness||{};
      state.fitness.distanceDays=state.fitness.distanceDays||{};
      for(const {day,km} of changed)state.fitness.distanceDays[day]=km;
      const distances=Object.values(state.fitness.distanceDays);
      if(!distances.every(km=>typeof km==='number'&&Number.isFinite(km)&&km>=0&&km<=150))
        throw Error('Stored daily distances failed validation.');
      state.fitness.walkingDistanceKm=Math.round(distances.reduce((a,b)=>a+b,0)*100)/100;
      addEvent('Distance synced',changed.length+' daily distance total(s) updated. Lifetime walking distance: '+state.fitness.walkingDistanceKm.toFixed(2)+' km.','health');
      render();
      if(!save())throw Error('Could not confirm distance save.');
    }catch(e){state=snapshot;throw e;}
  } catch(e) {
    console.error('BushTrack distance sync:',e);
    alert('Distance import stopped: '+(e.message||e));
  }
})();