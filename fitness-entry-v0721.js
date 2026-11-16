/* BushTrack V0.7.21: local fitness measurements for milestone badges.
   Records stay in the existing on-device game save and are not sent to GitHub.
   Future Shortcuts imports can write the same fitness values. */
(function(){
  'use strict';
  const byId=id=>document.getElementById(id);
  const validDay=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&localDayKey(dateFromDayKey(s))===s;
  function data(){
    if(!state.fitness||typeof state.fitness!=='object')state.fitness={};
    const f=state.fitness;
    if(!f.distanceDays||typeof f.distanceDays!=='object')f.distanceDays={};
    if(!f.weightReadings||typeof f.weightReadings!=='object')f.weightReadings={};
    return f;
  }
  function recalc(f){
    f.walkingDistanceKm=Math.round(Object.values(f.distanceDays).reduce((sum,v)=>sum+(Number(v)||0),0)*100)/100;
    const baseline=Number(f.weightBaselineKg);
    const history=Object.entries(f.weightReadings).filter(([d,v])=>validDay(d)&&Number.isFinite(Number(v))).sort((a,b)=>a[0].localeCompare(b[0]));
    const good=Number.isFinite(baseline)&&baseline>=50&&baseline<=300;
    f.latestWeightKg=history.length?Number(history[history.length-1][1]):(good?baseline:null);
    let confirmed=0;
    if(good){
      for(let i=1;i<history.length;i++){
        if(history[i-1][0]===history[i][0])continue;
        confirmed=Math.max(confirmed,baseline-Math.max(Number(history[i-1][1]),Number(history[i][1])));
      }
    }
    f.confirmedWeightLossKg=good?Math.round(Math.max(0,confirmed)*100)/100:null;
  }
  function notice(message,isError){
    const el=byId('fitnessDataStatus');if(el){el.textContent=message;el.style.color=isError?'#ffb0a2':'#c3d5b4';}
    if(isError)alert(message);
  }
  function mutate(label,work){
    if(!createBackup('Before fitness entry: '+label)){notice('Could not create a safety backup. No changes made.',true);return;}
    const old=cloneJson(state);
    try{
      const f=data();work(f);recalc(f);
      addEvent('Fitness milestone data',label,'fitness');
      render();if(!save())throw Error('Could not save the measurements.');
      notice('Updated: '+f.walkingDistanceKm.toFixed(2)+' km walked'+(f.latestWeightKg!==null?' · last weight '+f.latestWeightKg.toFixed(2)+' kg':'')+'.',false);
    }catch(e){state=old;render();notice(e.message||String(e),true);}
  }
  function readNumber(id,min,max){
    const raw=byId(id)?.value||'';
    const n=Number(raw);
    if(raw.trim()===''||!Number.isFinite(n)||n<min||n>max)throw Error('Enter a valid number for '+id+'.');
    return Math.round(n*100)/100;
  }
  function day(id){
    const d=byId(id)?.value||'';
    if(!validDay(d)||d>localDayKey())throw Error('Choose a valid date, not in the future.');
    return d;
  }
  function initialise(){
    for(const id of ['fitnessDistDay','fitnessBaselineDay','fitnessWeightDay']){
      if(byId(id)){byId(id).value=localDayKey();byId(id).max=localDayKey();}
    }
    if(state?.fitness){recalc(data());}
    byId('fitnessRecordDistance')?.addEventListener('click',()=>{
      let d,km;
      try{d=day('fitnessDistDay');km=readNumber('fitnessDistKm',0,150);}catch(e){notice(e.message,true);return;}
      mutate('Walking distance '+d+': '+km+' km',f=>{f.distanceDays[d]=km;});
    });
    byId('fitnessSetBaseline')?.addEventListener('click',()=>{
      let d,kg;
      try{d=day('fitnessBaselineDay');kg=readNumber('fitnessBaselineKg',50,300);}catch(e){notice(e.message,true);return;}
      if(state.fitness?.weightBaselineKg!=null){notice('Weight baseline already saved. Existing baseline was not changed.',true);return;}
      mutate('Weight baseline saved',f=>{f.weightBaselineKg=kg;f.weightBaselineDate=d;f.weightReadings[d]=kg;});
    });
    byId('fitnessRecordWeight')?.addEventListener('click',()=>{
      let d,kg;
      try{d=day('fitnessWeightDay');kg=readNumber('fitnessWeightKg',50,300);}catch(e){notice(e.message,true);return;}
      if(state.fitness?.weightBaselineKg==null){notice('Set your starting weight first.',true);return;}
      if(d<state.fitness.weightBaselineDate){notice('Weigh-in date predates your starting weight.',true);return;}
      mutate('Weigh-in '+d, f=>{f.weightReadings[d]=kg;});
    });
    const baseline=state.fitness?.weightBaselineKg;
    if(baseline!=null&&byId('fitnessDataStatus'))notice('Starting weight '+Number(baseline).toFixed(2)+' kg · '+Number(state.fitness.walkingDistanceKm||0).toFixed(2)+' km tracked.',false);
  }
  initialise();
})();