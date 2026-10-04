// BushTrack V0.7.3 — permanent Main Camp map return control
(function(){
  function mainCampCard(){
    if(!window.state) return '';
    const e=state.expedition||{};
    const inField=!!e.active;
    const baseName=(typeof currentBaseName==='function'?currentBaseName():'Main Camp');
    const dist=Math.max(0,Math.round(Number(e.distanceFromBase||0)));
    const isMain=(typeof currentStoreKey==='function'?currentStoreKey()==='main':true);
    const title=isMain?'Main Camp':baseName;
    const status=!inField?'AT CAMP':dist>0?`${typeof fmt==='function'?fmt(dist):dist} steps back`:'At camp';
    return `<article class="location-card main-camp-return-card"><div class="location-art camp"><div class="art-label">BASE</div></div><div class="location-copy"><div class="eyebrow">PERMANENT BASE</div><h3>${typeof esc==='function'?esc(title):title}</h3><p>Your armoury, purchased ammunition and stored supplies live here. Return before changing loadout or drawing fresh ammo.</p><div class="location-meta"><span>${status}</span></div><div class="location-actions"><button class="${inField?'primary':'secondary'}" id="mapReturnMainCampBtn" ${!inField?'disabled':''}>${inField?(dist>0?'Return to camp':'Finish return to camp'):'You are at camp'}</button></div></div></article>`;
  }

  function injectMainCamp(){
    const list=document.getElementById('locationList');
    if(!list||!window.state) return;
    list.querySelector('.main-camp-return-card')?.remove();
    list.insertAdjacentHTML('afterbegin',mainCampCard());
    document.getElementById('mapReturnMainCampBtn')?.addEventListener('click',function(){
      if(typeof requestReturnToBase==='function') requestReturnToBase();
    });
  }

  const originalRenderLocations=window.renderLocations;
  if(typeof originalRenderLocations==='function'){
    window.renderLocations=function(){ originalRenderLocations.apply(this,arguments); injectMainCamp(); };
  }
  const originalRender=window.render;
  if(typeof originalRender==='function'){
    window.render=function(){ originalRender.apply(this,arguments); injectMainCamp(); };
  }
  document.addEventListener('DOMContentLoaded',injectMainCamp);
  setTimeout(injectMainCamp,0);
})();
