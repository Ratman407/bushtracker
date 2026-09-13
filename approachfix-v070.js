/* BushTrack V0.7 approach feedback patch: show route choice and approach outcome immediately. */
(function(){
  'use strict';
  if(window.BushTrackApproachFeedback070)return;

  function showResult(title,text,buttonLabel,action,eyebrow){
    const api=window.BushTrack063;
    if(api&&typeof api.showFieldResult==='function'){
      api.showFieldResult(title,text,buttonLabel||'Continue',action||null,eyebrow||'APPROACH');
    }
  }
  function eventSince(title,beforeId){
    const list=(window.state&&state.events)||[];
    for(const ev of list){
      if(beforeId&&ev.id===beforeId)break;
      if(ev.title===title)return ev;
    }
    return null;
  }
  function supportText(v){return v==='solid'?'solid rest':v==='rest'?'some support':'no real rest';}
  function riskText(p){p=Number(p||0);return p<=.09?'low':p<=.20?'moderate':'higher';}

  /* When the approach actually resolves, show the outcome instead of hiding it in Journal. */
  try{
    const baseResolveApproach=resolveApproach;
    resolveApproach=function(){
      const before=state&&state.currentEncounter;
      const beforeId=state&&state.events&&state.events[0]?state.events[0].id:null;
      const encounterId=before&&before.id;
      const result=baseResolveApproach.apply(this,arguments);
      setTimeout(function(){
        const current=state&&state.currentEncounter;
        if(current&&current.id===encounterId&&current.stage==='shot'){
          const ev=eventSince('In position',beforeId);
          const text=ev?ev.text:('The approach worked. You are in position at about '+fmt(current.shotRange)+' m with '+supportText(current.shotSupport)+'.');
          showResult('In position',text,'Take the shot',function(){if(state&&state.currentEncounter&&state.currentEncounter.id===encounterId)openShot();},'APPROACH RESULT');
          return;
        }
        const busted=eventSince('Busted',beforeId);
        if(busted)showResult('Busted',busted.text,'Back to trail',null,'APPROACH RESULT');
      },20);
      return result;
    };
  }catch(err){console.error('BushTrack approach result patch',err);}

  /* After a player chooses a route, show exactly what they committed to. */
  const choices=document.getElementById('approachChoices');
  let snap=null;
  if(choices){
    choices.addEventListener('click',function(ev){
      const b=ev.target.closest('[data-approach]');if(!b)return;
      const e=state&&state.currentEncounter;
      const i=Number(b.dataset.approach);
      const r=e&&e.approachOptions&&e.approachOptions[i];
      if(!e||!r)return;
      snap={id:e.id,name:r.name,steps:Number(r.steps||0),range:r.range||[],spook:r.spook,support:r.support||'none',credit:Number(state.stepCredit||0)};
    },true);
    choices.addEventListener('click',function(ev){
      if(!ev.target.closest('[data-approach]'))return;
      setTimeout(function(){
        if(!snap)return;
        const s=snap;snap=null;
        const e=state&&state.currentEncounter;
        /* If banked steps instantly finished the approach, resolveApproach already shows the real result. */
        if(!e||e.id!==s.id||e.stage!=='approach')return;
        const remaining=Math.max(0,Number(e.approachRemaining||0));
        const used=Math.max(0,s.steps-remaining);
        let text=s.name+' selected.\n\n'+fmt(s.steps)+' steps to work into position';
        if(Array.isArray(s.range)&&s.range.length===2)text+=' • expected shot '+fmt(s.range[0])+'–'+fmt(s.range[1])+' m';
        text+=' • '+supportText(s.support)+' • '+riskText(s.spook)+' chance of being picked up.';
        if(used>0)text+='\n\n'+fmt(used)+' banked steps were applied immediately. '+fmt(remaining)+' steps remain.';
        showResult('Approach set',text,'Start approach',null,'APPROACH');
      },30);
    });
  }

  window.BushTrackApproachFeedback070={version:'1'};
})();
