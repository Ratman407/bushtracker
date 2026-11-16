/* BushTrack V0.7.23 — one-off historical walking-distance backfill.
   Paste dates and daily Walking + Running Distance (km) exported from Apple Health.
   Entries are limited to this SAVE's creation day onward. No step/XP/hunt changes.
   Same-day re-import replaces the old distance instead of adding it again. */
(function(){
  'use strict';
  const $hist=id=>document.getElementById(id);
  let prepared=null;
  const isoDay=/^\d{4}-\d{2}-\d{2}$/;
  function validDate(k){
    if(!isoDay.test(k))return false;
    const date=dateFromDayKey(k);
    return Number.isFinite(date.getTime()) && localDayKey(date)===k;
  }
  function startDay(){
    const iso=state?.meta?.createdAt;
    const date=typeof iso==='string'&&iso?new Date(iso):null;
    return date&&Number.isFinite(date.getTime())?localDayKey(date):null;
  }
  function status(msg,error=false){
    const el=$hist('historyDistanceStatus');
    if(el){el.textContent=msg;el.style.color=error?'#ffb0a2':'#c3d5b4';}
  }
  function currentDistanceDays(){
    const days=state?.fitness?.distanceDays;
    return days&&typeof days==='object'&&!Array.isArray(days)?days:{};
  }
  function parse(text){
    const start=startDay(),today=localDayKey();
    if(!start)throw Error('This BushTrack save has no valid creation date. Import blocked.');
    const clean=String(text||'').replace(/\u2060/g,'').trim();
    if(!clean)throw Error('Paste the dated kilometres copied from Shortcuts first.');
    if(clean.length>40000)throw Error('Too much text. Import smaller batches.');
    const pieces=clean.split(/[;,\r\n]+/).map(v=>v.trim()).filter(Boolean);
    if(pieces.length<1||pieces.length>366)throw Error('Import 1–366 days at a time.');
    const used=new Set(),out=[];
    for(const p of pieces){
      const match=/^(\d{4}-\d{2}-\d{2})\s*:\s*(\d{1,3}(?:\.\d{1,3})?)$/.exec(p);
      if(!match||!validDate(match[1]))throw Error('Invalid daily distance: '+p.slice(0,90));
      const day=match[1],km=Number(match[2]);
      if(day<start)throw Error(day+' is before this BushTrack save began ('+start+').');
      if(day>today)throw Error(day+' is in the future.');
      if(used.has(day))throw Error('Duplicate date in pasted data: '+day);
      if(!Number.isFinite(km)||km<0||km>150)throw Error('Invalid kilometres on '+day);
      used.add(day);out.push({day,km:Math.round(km*1000)/1000});
    }
    out.sort((a,b)=>a.day.localeCompare(b.day));
    return out;
  }
  function compare(rows){
    const old=currentDistanceDays();
    let fresh=0,revised=0,same=0,changeKm=0;
    for(const {day,km} of rows){
      const had=Object.prototype.hasOwnProperty.call(old,day);
      if(!had){fresh++;changeKm+=km;}
      else if(Math.abs(Number(old[day])-km)>0.0000001){revised++;changeKm+=km-Number(old[day]);}
      else same++;
    }
    return {fresh,revised,same,changeKm};
  }
  function preview(){
    prepared=null;
    const submit=$hist('historyDistanceImportBtn');
    if(submit)submit.disabled=true;
    try{
      const text=$hist('historyDistanceInput')?.value||'';
      const rows=parse(text);
      const info=compare(rows);
      prepared={text,rows};
      if(submit)submit.disabled=info.fresh+info.revised===0;
      status('Checked '+rows.length+' days ('+rows[0].day+' to '+rows[rows.length-1].day+'): '+
        info.fresh+' new, '+info.revised+' corrected, '+info.same+' unchanged. '+
        (info.fresh+info.revised? 'Net distance change '+info.changeKm.toFixed(2)+' km. Ready to import.':'Nothing new to import.'));
    }catch(e){status(e.message||String(e),true);}
  }
  function importNow(){
    try{
      if(!prepared)throw Error('Check the pasted distances first.');
      if(($hist('historyDistanceInput')?.value||'')!==prepared.text)throw Error('Text changed. Check import again.');
      // Re-evaluate after any other sync since the preview, including a day rollover.
      const rows=parse(prepared.text),info=compare(rows);
      const changed=rows.filter(({day,km})=>{
        const old=currentDistanceDays();
        return !Object.prototype.hasOwnProperty.call(old,day)||Math.abs(Number(old[day])-km)>0.0000001;
      });
      if(!changed.length){status('All '+rows.length+' dates are already up to date. No changes made.');return;}
      if(!validateState(state))throw Error('Your current save is not valid; import cancelled.');
      if(!createBackup('Before historical distance backfill'))throw Error('Could not create a safety backup. Import cancelled.');
      const snapshot=cloneJson(state);
      try{
        state.fitness=state.fitness||{};
        state.fitness.distanceDays=Object.assign({},currentDistanceDays());
        for(const {day,km} of changed)state.fitness.distanceDays[day]=km;
        const vals=Object.values(state.fitness.distanceDays);
        if(!vals.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=150))throw Error('Saved daily distances failed validation.');
        state.fitness.walkingDistanceKm=Math.round(vals.reduce((a,b)=>a+b,0)*100)/100;
        addEvent('Historical distance imported',changed.length+' days updated; '+
          state.fitness.walkingDistanceKm.toFixed(2)+' km recorded in total.','health');
        if(!save())throw Error('Could not save imported distances. Import rolled back.');
        render(); // Unlock badge(s) but do not award cash or XP until claimed.
        status('Imported '+changed.length+' day(s). Total distance: '+state.fitness.walkingDistanceKm.toFixed(2)+
          ' km. Open your distance badges below to claim any unlocked rewards.');
        prepared=null;
        if($hist('historyDistanceImportBtn'))$hist('historyDistanceImportBtn').disabled=true;
      }catch(e){state=snapshot;render();throw e;}
    }catch(e){status(e.message||String(e),true);}
  }
  function init(){
    const start=startDay();
    const startEl=$hist('historyDistanceStart');
    if(startEl)startEl.textContent=start||'Unavailable — check save metadata';
    const input=$hist('historyDistanceInput');
    input?.addEventListener('input',()=>{
      prepared=null;
      const button=$hist('historyDistanceImportBtn');if(button)button.disabled=true;
      status('Paste your daily distances, then tap Check Import.');
    });
    $hist('historyDistancePreviewBtn')?.addEventListener('click',preview);
    $hist('historyDistanceImportBtn')?.addEventListener('click',importNow);
  }
  init();
})();