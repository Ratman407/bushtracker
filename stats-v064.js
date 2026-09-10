/* BushTrack V0.6.4: walking statistics and trend panel. */
(function(){
  const PATCH_VERSION='0.6.4';

  const versionTag=document.querySelector('.topbar .eyebrow');
  if(versionTag)versionTag.textContent='V0.6.4 WALKING STATS';
  document.title='BushTrack V0.6.4';

  function dayLabel(day){
    try{return dateFromDayKey(day).toLocaleDateString('en-AU',{weekday:'short'}).slice(0,2);}catch(e){return day.slice(-2);}
  }
  function shortDate(day){
    try{return dateFromDayKey(day).toLocaleDateString('en-AU',{day:'numeric',month:'short'});}catch(e){return day;}
  }
  function recorded(day){return !!(state&&state.stepLedger&&state.stepLedger[day]);}
  function stepsFor(day){return Math.max(0,Number(state&&state.stepLedger&&state.stepLedger[day]&&state.stepLedger[day].credited||0));}
  function sevenDayWindow(endDay){
    const days=Array.from({length:7},(_,i)=>addDaysKey(endDay,-6+i));
    const values=days.map(function(day){return {day,recorded:recorded(day),steps:stepsFor(day)};});
    const seen=values.filter(v=>v.recorded);
    const sum=seen.reduce((n,v)=>n+v.steps,0);
    return {days:values,recorded:seen.length,sum,avg:seen.length?Math.round(sum/seen.length):0,complete:seen.length===7};
  }
  function allRecordedDays(){
    const ledger=(state&&state.stepLedger)||{};
    return Object.keys(ledger).map(day=>({day,steps:Math.max(0,Number(ledger[day]&&ledger[day].credited||0))})).sort((a,b)=>a.day.localeCompare(b.day));
  }
  function bestRollingAverage(entries){
    if(entries.length<7)return 0;
    const map=new Map(entries.map(x=>[x.day,x.steps]));
    let best=0;
    for(const entry of entries){
      const days=Array.from({length:7},(_,i)=>addDaysKey(entry.day,-6+i));
      if(!days.every(d=>map.has(d)))continue;
      const avg=Math.round(days.reduce((n,d)=>n+map.get(d),0)/7);
      best=Math.max(best,avg);
    }
    return best;
  }
  function trendText(current,previous){
    if(!current.complete||!previous.complete)return {value:'Building history',className:'neutral',detail:'A full 7 days in both periods are needed for a clean week-on-week trend.'};
    const delta=current.avg-previous.avg;
    const pct=previous.avg?Math.round(delta/previous.avg*100):0;
    if(delta>0)return {value:'+'+fmt(delta)+' / day',className:'up',detail:pct+'% above the previous 7-day average.'};
    if(delta<0)return {value:'-'+fmt(Math.abs(delta))+' / day',className:'down',detail:Math.abs(pct)+'% below the previous 7-day average.'};
    return {value:'No change',className:'neutral',detail:'Same average as the previous 7 days.'};
  }

  function ensureStatsSection(){
    let section=document.getElementById('walkingStatsCard');
    if(section)return section;
    const journal=document.querySelector('[data-page="journal"]');
    if(!journal)return null;
    section=document.createElement('section');
    section.id='walkingStatsCard';
    section.className='panel-card walking-stats-card';
    section.innerHTML=`
      <div class="card-head"><div><div class="eyebrow">WALKING STATISTICS</div><h3>What the legs have done</h3></div><span class="tag" id="statsDaysRecorded">0 days</span></div>
      <div class="stats-main-grid">
        <div class="stats-big"><span>Lifetime credited</span><strong id="statsLifetime">0</strong><small id="statsSince">Since BushTrack started</small></div>
        <div class="stats-big"><span>Today</span><strong id="statsToday">0</strong><small>Health steps credited today</small></div>
        <div class="stats-big"><span>Current 7-day avg</span><strong id="statsCurrentAvg">—</strong><small id="statsCurrentCoverage">No days recorded</small></div>
        <div class="stats-big"><span>Best day</span><strong id="statsBestDay">—</strong><small id="statsBestDayDate">No history yet</small></div>
      </div>
      <div class="stats-trend-box"><div><span>7-day trend</span><strong id="statsTrend">Building history</strong><small id="statsTrendDetail"></small></div><div><span>Best 7-day avg</span><strong id="statsBestWeek">—</strong><small>Complete BushTrack weeks</small></div></div>
      <div class="stats-chart-wrap"><div class="stats-chart-title"><span>Last 7 days</span><small id="statsSevenTotal">0 steps recorded</small></div><div class="stats-bars" id="statsBars"></div></div>
      <div class="stats-milestones"><div><span>5k+ days</span><strong id="stats5k">0</strong></div><div><span>7.5k+ days</span><strong id="stats75k">0</strong></div><div><span>10k+ days</span><strong id="stats10k">0</strong></div></div>
      <p class="micro">These are BushTrack statistics only: they use the Health totals you have imported into the game, not your full Apple Health history from before BushTrack.</p>`;
    const first=journal.querySelector('.log-card');
    journal.insertBefore(section,first||journal.firstChild);

    const style=document.createElement('style');
    style.id='walkingStatsStyle';
    style.textContent=`
      .walking-stats-card{margin-bottom:22px}
      .stats-main-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}
      .stats-big,.stats-trend-box>div,.stats-milestones>div{background:#0d1711;border:1px solid #2c3a2f;border-radius:18px;padding:16px}
      .stats-big span,.stats-trend-box span,.stats-milestones span{display:block;color:#9da79d;font-size:.82rem;margin-bottom:7px}
      .stats-big strong{display:block;color:#f2f4ed;font-size:1.75rem;line-height:1.05}
      .stats-big small,.stats-trend-box small{display:block;color:#7f8b80;font-size:.72rem;line-height:1.35;margin-top:7px}
      .stats-trend-box{display:grid;grid-template-columns:1.25fr .75fr;gap:12px;margin-bottom:18px}
      .stats-trend-box strong{display:block;color:#e9eddf;font-size:1.12rem}
      #statsTrend.up{color:#b8d27e} #statsTrend.down{color:#d7a183} #statsTrend.neutral{color:#d6d9d1}
      .stats-chart-wrap{background:#0b130e;border:1px solid #2b382d;border-radius:20px;padding:16px;margin-bottom:14px}
      .stats-chart-title{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:14px;color:#dfe4db;font-weight:750}
      .stats-chart-title small{color:#859086;font-weight:500;text-align:right}
      .stats-bars{height:170px;display:flex;gap:8px;align-items:flex-end}
      .stats-day{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:0}
      .stats-bar-value{font-size:.62rem;color:#929d94;margin-bottom:5px;white-space:nowrap}
      .stats-bar-track{width:100%;height:125px;display:flex;align-items:flex-end;background:#08100b;border-radius:8px;overflow:hidden;border:1px solid #202c23}
      .stats-bar-fill{width:100%;min-height:2px;background:#859d5d;border-radius:7px 7px 0 0}
      .stats-day.missing .stats-bar-fill{height:2px!important;background:#293229}
      .stats-day-label{font-size:.68rem;color:#89938a;margin-top:6px}
      .stats-day.today .stats-day-label{color:#dcc98d;font-weight:800}
      .stats-milestones{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
      .stats-milestones strong{font-size:1.25rem;color:#edf0e8}
      @media(max-width:420px){.stats-main-grid{grid-template-columns:1fr 1fr}.stats-big{padding:13px}.stats-big strong{font-size:1.45rem}.stats-trend-box{grid-template-columns:1fr}.stats-bars{gap:5px}.stats-bar-value{font-size:.56rem}}
    `;
    document.head.appendChild(style);
    return section;
  }

  function renderWalkingStats(){
    const section=ensureStatsSection();if(!section||!state)return;
    const today=localDayKey();
    const entries=allRecordedDays();
    const current=sevenDayWindow(today);
    const previous=sevenDayWindow(addDaysKey(today,-7));
    const trend=trendText(current,previous);
    const bestDay=entries.reduce((best,x)=>!best||x.steps>best.steps?x:best,null);
    const conditioningBest=Number(state.progression&&state.progression.conditioning&&state.progression.conditioning.bestAverage||0);
    const bestWeek=Math.max(conditioningBest,bestRollingAverage(entries));
    const created=state.meta&&state.meta.createdAt?new Date(state.meta.createdAt):null;

    document.getElementById('statsDaysRecorded').textContent=entries.length+' day'+(entries.length===1?'':'s');
    document.getElementById('statsLifetime').textContent=fmt(Number(state.totalSteps||0))+' steps';
    document.getElementById('statsSince').textContent=created&&!Number.isNaN(created.getTime())?'Since '+created.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}):'Since this BushTrack save started';
    document.getElementById('statsToday').textContent=fmt(stepsFor(today))+' steps';
    document.getElementById('statsCurrentAvg').textContent=current.recorded?fmt(current.avg)+' / day':'—';
    document.getElementById('statsCurrentCoverage').textContent=current.recorded+'/7 days recorded • '+fmt(current.sum)+' total';
    document.getElementById('statsBestDay').textContent=bestDay?fmt(bestDay.steps)+' steps':'—';
    document.getElementById('statsBestDayDate').textContent=bestDay?shortDate(bestDay.day):'No history yet';
    const trendEl=document.getElementById('statsTrend');trendEl.textContent=trend.value;trendEl.className=trend.className;
    document.getElementById('statsTrendDetail').textContent=trend.detail;
    document.getElementById('statsBestWeek').textContent=bestWeek?fmt(bestWeek)+' / day':'—';
    document.getElementById('statsSevenTotal').textContent=fmt(current.sum)+' steps • '+current.recorded+'/7 days';
    document.getElementById('stats5k').textContent=entries.filter(x=>x.steps>=5000).length;
    document.getElementById('stats75k').textContent=entries.filter(x=>x.steps>=7500).length;
    document.getElementById('stats10k').textContent=entries.filter(x=>x.steps>=10000).length;

    const max=Math.max(1000,...current.days.map(x=>x.steps));
    document.getElementById('statsBars').innerHTML=current.days.map(function(x){
      const pct=x.recorded?Math.max(2,Math.round(x.steps/max*100)):1;
      const cls=(x.recorded?'':' missing')+(x.day===today?' today':'');
      return '<div class="stats-day'+cls+'"><div class="stats-bar-value">'+(x.recorded?fmt(x.steps):'—')+'</div><div class="stats-bar-track"><div class="stats-bar-fill" style="height:'+pct+'%"></div></div><div class="stats-day-label">'+dayLabel(x.day)+'</div></div>';
    }).join('');
  }

  try{
    const baseRenderJournal=renderJournal;
    renderJournal=function(){baseRenderJournal();renderWalkingStats();};
  }catch(err){console.error('BushTrack V0.6.4 journal stats hook',err);}

  async function serverVersion(){
    try{const r=await fetch('./version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return null;const j=await r.json();return j&&j.version?String(j.version):null;}catch(e){return null;}
  }
  try{
    checkForUpdate=async function(showCurrent=false){
      const banner=document.getElementById('updateBanner'),text=document.getElementById('updateBannerText');
      const server=await serverVersion();
      if(!server){if(showCurrent)alert('Could not check for an update right now.');return;}
      if(server!==PATCH_VERSION){if(text)text.textContent='BushTrack '+server+' is available. Reload to update the game code; your save stays intact.';if(banner)banner.classList.remove('hidden');}
      else{if(banner)banner.classList.add('hidden');if(showCurrent)alert('BushTrack '+PATCH_VERSION+' is current.');}
    };
  }catch(e){}

  setTimeout(function(){
    renderWalkingStats();
    const banner=document.getElementById('updateBanner');if(banner)banner.classList.add('hidden');
  },0);

  window.BushTrack064={renderWalkingStats};
})();
