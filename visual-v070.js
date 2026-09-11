/* BushTrack V0.7.0 VISUAL UPDATE
   Additive presentation layer. It keeps the existing V0.6 save/schema/gameplay and adds
   richer Trail, Map, Fishing, Gear and Journal visuals plus a direct Fish the Hole action.
*/
(function(){
  'use strict';
  if(window.BushTrackVisual070)return;

  const V='0.7.0';
  const A={"creek":"./assets/visual/creek-hero.webp","deepHole":"./assets/visual/deep-hole.webp","map":"./assets/visual/country-map.webp","bass":"./assets/visual/bass.webp","eel":"./assets/visual/eel.webp","deer":"./assets/visual/deer.webp","deerSign":"./assets/visual/deer-sign.webp","pig":"./assets/visual/pig.webp","rabbit":"./assets/visual/rabbit.webp","camera":"./assets/visual/trail-camera.webp","yabby":"./assets/visual/yabby-net.webp","camp":"./assets/visual/camp-sunset.webp","spinnerbait":"./assets/visual/spinnerbait.webp","hardbody":"./assets/visual/hardbody.webp","softPlastic":"./assets/visual/soft-plastic.webp","line":"./assets/visual/line.webp"};

  function q(sel,root=document){return root.querySelector(sel)}
  function qa(sel,root=document){return Array.from(root.querySelectorAll(sel))}
  function safeText(v){return String(v==null?'':v)}
  function fmtV(n){try{return Math.max(0,Math.round(Number(n)||0)).toLocaleString('en-AU')}catch(e){return String(n||0)}}
  function speciesAsset(species,text=''){
    const s=(safeText(species)+' '+safeText(text)).toLowerCase();
    if(s.includes('eel')||s.includes('catfish'))return A.eel;
    if(s.includes('pig')||s.includes('boar')||s.includes('sow'))return A.pig;
    if(s.includes('rabbit'))return A.rabbit;
    if(s.includes('deer')||s.includes('buck')||s.includes('stag')||s.includes('hind')||s.includes('doe')||s.includes('goat')||s.includes('billy')||s.includes('nanny'))return A.deer;
    return A.bass;
  }
  function eventAsset(ev){
    const s=(safeText(ev?.title)+' '+safeText(ev?.text)).toLowerCase();
    if(s.includes('camera'))return A.camera;
    if(s.includes('yabby')||s.includes('net'))return A.yabby;
    if(s.includes('snagged')||s.includes('snag'))return A.deepHole;
    if(s.includes('deep water')||s.includes('fishing spot')||s.includes('back at the water'))return A.deepHole;
    if(s.includes('new place')||s.includes('map'))return A.map;
    if(s.includes('fish')||s.includes('bass')||s.includes('eel')||s.includes('carp')||s.includes('perch'))return speciesAsset('',s);
    if(s.includes('recover')||s.includes('buck')||s.includes('deer')||s.includes('pig')||s.includes('goat')||s.includes('rabbit'))return speciesAsset('',s);
    if(s.includes('camp')||s.includes('return'))return A.camp;
    if(s.includes('sign')||s.includes('track')||s.includes('stalk'))return A.deerSign;
    return null;
  }
  function trophyAsset(t){return speciesAsset(t?.species,t?.name)}
  function activeAsset(){
    try{
      if(state?.active?.kind==='river')return state.river?.ready?A.deepHole:A.creek;
      if(state?.active?.kind==='encounter')return speciesAsset(state.currentEncounter?.selectedAnimal?.species,'');
      if(state?.active?.kind==='objective'){
        const o=(state.objectives||[]).find(x=>x.id===state.active.id);
        if(o?.type==='fishReturn')return A.deepHole;
        if(o?.type==='cameraCheck')return A.camera;
        if(o?.type==='netCheck')return A.yabby;
        if(['returnBase','campTravel','campResupply','campBuild'].includes(o?.type))return A.camp;
        if(['branchHunt','ambush','rabbitHunt','glassHunt'].includes(o?.type))return speciesAsset(o?.data?.species,'');
      }
      if(state?.active?.kind==='hunt')return A.deerSign;
    }catch(e){}
    return A.creek;
  }
  function locationAsset(loc){
    const id=loc?.templateId;
    if(id==='deepHole')return A.deepHole;
    if(id==='creek'||id==='crossing')return A.creek;
    if(id==='farmDam')return A.deepHole;
    if(id==='wallow')return A.pig;
    if(id==='rabbitWarren')return A.rabbit;
    if(id==='gameTrail')return A.deerSign;
    if(id==='ridge'||id==='backblockGate')return A.map;
    if(id==='campsite')return A.camp;
    return A.map;
  }
  function navTo(tab){
    const b=q(`.nav-btn[data-tab="${tab}"]`);
    if(b)b.click();
  }
  function deepHoleLocation(){
    let loc=(state?.locations||[]).find(x=>x.templateId==='deepHole');
    if(!loc && state?.river?.ready && typeof ensureLocation==='function'){
      try{loc=ensureLocation(state,'deepHole')}catch(e){}
    }
    return loc||null;
  }
  function fishAction(){
    const loc=deepHoleLocation();
    if(!loc)return;
    if(typeof locationAction==='function')locationAction('fish',loc.id);
  }

  function ensureTopbar(){
    const top=q('.topbar'); if(!top)return;
    const eye=q('.eyebrow',top); if(eye)eye.textContent='V0.7 VISUAL UPDATE';
    const left=top.firstElementChild;
    if(left&&!q('.bt70-tagline',left)){
      const t=document.createElement('div');t.className='bt70-tagline';t.textContent='Explore • Hunt • Fish • Move';left.appendChild(t);
    }
    top.classList.add('bt70-topbar');
  }

  function ensureHero(){
    const card=q('.hero-card'); if(!card)return;
    card.classList.add('bt70-hero');
    let photo=q('.bt70-hero-photo',card);
    if(!photo){
      photo=document.createElement('div');photo.className='bt70-hero-photo';
      photo.innerHTML='<img alt="" aria-hidden="true"><div class="bt70-photo-shade"></div><div class="bt70-hero-badge">ACTIVE TRAIL</div>';
      card.insertBefore(photo,card.firstChild);
    }
    const img=q('img',photo); if(img)img.src=activeAsset();
    const oldMap=q('.map-scene',card); if(oldMap)oldMap.classList.add('bt70-old-map');

    const copy=q('.hero-copy',card);
    if(copy){
      let row=q('.bt70-hero-actions',copy);
      if(!row){row=document.createElement('div');row.className='bt70-hero-actions';copy.appendChild(row);}
      row.innerHTML='';
      const loc=deepHoleLocation();
      const activeObj=state?.active?.kind==='objective'?(state.objectives||[]).find(x=>x.id===state.active.id):null;
      if(state?.river?.ready && loc && (state?.active?.kind==='river' || activeObj?.type==='fishReturn')){
        const b=document.createElement('button');b.className='primary bt70-big-action';
        b.textContent=loc.fishReady?'🎣 Fish the hole':'🥾 Walk back to fish';
        b.addEventListener('click',fishAction);row.appendChild(b);
      }
      const mapBtn=document.createElement('button');mapBtn.className='secondary bt70-map-link';mapBtn.textContent='🗺 View country map';mapBtn.addEventListener('click',()=>navTo('map'));row.appendChild(mapBtn);
    }
  }

  function ensureRiverCard(){
    const card=q('#riverCard');if(!card)return;
    let thumb=q('.bt70-mini-photo',card);
    if(!thumb){
      thumb=document.createElement('img');thumb.className='bt70-mini-photo';thumb.alt='Creek and fishing water';card.insertBefore(thumb,card.firstChild);
    }
    thumb.src=state?.river?.ready?A.deepHole:A.creek;
    let b=q('.bt70-river-action',card);
    if(state?.river?.ready){
      if(!b){b=document.createElement('button');b.className='primary bt70-river-action';card.appendChild(b);b.addEventListener('click',fishAction);}
      const loc=deepHoleLocation();b.textContent=loc?.fishReady?'Fish the hole':'Walk back to fish';
    }else if(b)b.remove();
  }

  const pinPos={
    creek:[25,37],deepHole:[18,68],farmDam:[78,72],gameTrail:[38,28],wallow:[62,47],
    rabbitWarren:[74,26],oldHut:[48,22],ridge:[61,14],crossing:[43,58],campsite:[52,52],backblockGate:[86,20]
  };
  function ensureMap(){
    const page=q('[data-page="map"]');const list=q('#locationList');if(!page||!list)return;
    let map=q('.bt70-country-map',page);
    if(!map){
      map=document.createElement('section');map.className='bt70-country-map panel-card';
      list.parentNode.insertBefore(map,list);
    }
    const locs=(state?.locations||[]).slice();
    const pins=locs.slice(0,10).map((loc,i)=>{
      const pos=pinPos[loc.templateId]||[20+(i*17)%68,20+(i*23)%64];
      const icon=loc.type==='water'?'≈':loc.type==='camp'?'▲':loc.type==='sign'?'•':'◆';
      return `<button class="bt70-map-pin" data-v70-map-index="${i}" style="left:${pos[0]}%;top:${pos[1]}%"><b>${icon}</b><span>${safeText(loc.name)}</span></button>`;
    }).join('');
    map.innerHTML=`<div class="bt70-map-image" style="background-image:url('${A.map}')">
      <div class="bt70-map-overlay">
        <div class="bt70-map-head"><div><span>COUNTRY MAP</span><strong>${safeText(state?.currentRegion||'Home block')}</strong></div><em>Illustrated field map • not GPS</em></div>
        ${pins}
        <div class="bt70-map-stats"><span>${fmtV(locs.length)} places</span><span>${fmtV(state?.cameras?.length||0)} cameras</span><span>${fmtV(state?.nets?.length||0)} nets</span></div>
      </div></div>`;
    qa('[data-v70-map-index]',map).forEach(btn=>btn.addEventListener('click',()=>{
      const idx=Number(btn.dataset.v70MapIndex||0);const card=qa('.location-card',list)[idx];
      if(card)card.scrollIntoView({behavior:'smooth',block:'center'});else list.scrollIntoView({behavior:'smooth'});
    }));

    const cards=qa('.location-card',list);
    locs.forEach((loc,i)=>{
      const c=cards[i];if(!c)return;c.classList.add('bt70-location-card');
      if(!q('.bt70-location-thumb',c)){
        const im=document.createElement('img');im.className='bt70-location-thumb';im.alt='';im.src=locationAsset(loc);c.insertBefore(im,c.firstChild);
      }
      const cam=(state.cameras||[]).find(x=>x.locationId===loc.id);
      const net=(state.nets||[]).find(x=>x.locationId===loc.id);
      const cb=q('[data-loc-action="cameraCheck"]',c);
      if(cb&&cam&&!cam.ready)cb.textContent='Camera set — collecting photos';
      const nb=q('[data-loc-action="netCheck"]',c);
      if(nb&&net&&!net.ready)nb.textContent='Net soaking — check tomorrow';
    });
  }

  function lureAsset(name){
    const s=safeText(name).toLowerCase();
    if(s.includes('spinner'))return A.spinnerbait;
    if(s.includes('surface')||s.includes('hard'))return A.hardbody;
    if(s.includes('soft'))return A.softPlastic;
    if(s.includes('yabby')||s.includes('bait'))return A.yabby;
    return A.line;
  }
  function ensureFishing(){
    const panel=q('#fishModal .modal-panel');if(!panel)return;
    let hero=q('.bt70-fish-hero',panel);
    if(!hero){
      hero=document.createElement('div');hero.className='bt70-fish-hero';
      hero.innerHTML=`<img src="${A.deepHole}" alt="Deep timber fishing hole"><div><span>FISHING SPOT</span><strong>Deep timber hole</strong><small>Dark water • submerged timber • big fish country</small></div>`;
      panel.insertBefore(hero,panel.firstChild);
    }
    qa('#lureGrid .lure').forEach(b=>{
      if(q('.bt70-lure-img',b))return;
      const im=document.createElement('img');im.className='bt70-lure-img';im.src=lureAsset(b.dataset.lure);im.alt='';b.insertBefore(im,b.firstChild);
    });
    const res=q('#fishResult');
    if(res)res.classList.add('bt70-fish-result');
  }

  function ensureGear(){
    const page=q('[data-page="gear"]');if(!page)return;
    let banner=q('.bt70-gear-banner',page);
    if(!banner){
      const anchor=q('.field-loadout-card',page)||page.firstElementChild;
      banner=document.createElement('section');banner.className='bt70-gear-banner';
      anchor.parentNode.insertBefore(banner,anchor);
    }
    let ammo='';
    try{ammo=state?.expedition?.active?`${fmtV(availableAmmo())} rounds in field`:'At camp'}catch(e){ammo='Field kit'}
    banner.innerHTML=`<img src="${A.camp}" alt=""><div><span>FIELD KIT</span><strong>${safeText(typeof currentBaseName==='function'?currentBaseName():'Main Camp')}</strong><small>${safeText(ammo)} • gear stays where you leave it</small></div>`;

    const invMap={'spinnerbaits':A.spinnerbait,'surface lures':A.hardbody,'soft plastics':A.softPlastic,'bait':A.yabby,'trail cameras':A.camera,'yabby nets':A.yabby};
    qa('#inventoryList .inventory-item').forEach(item=>{
      const label=safeText(q('span',item)?.textContent).toLowerCase();const src=invMap[label];if(!src)return;
      if(!q('img',item)){const im=document.createElement('img');im.src=src;im.alt='';im.className='bt70-inventory-img';item.insertBefore(im,item.firstChild);}
    });
    qa('#shopList .shop-item').forEach(item=>{
      const text=safeText(item.textContent).toLowerCase();let src=null;
      if(text.includes('spinner'))src=A.spinnerbait;else if(text.includes('surface'))src=A.hardbody;else if(text.includes('soft plastic'))src=A.softPlastic;else if(text.includes('trail camera'))src=A.camera;else if(text.includes('yabby net'))src=A.yabby;
      if(src&&!q('.bt70-shop-img',item)){const im=document.createElement('img');im.src=src;im.alt='';im.className='bt70-shop-img';item.insertBefore(im,item.firstChild);}
    });
  }

  function ensureJournal(){
    const page=q('[data-page="journal"]');if(!page)return;
    let feature=q('.bt70-journal-feature',page);
    if(!feature){
      feature=document.createElement('section');feature.className='bt70-journal-feature';
      page.insertBefore(feature,page.firstChild);
    }
    const t=state?.trophies?.[0];
    if(t){
      feature.innerHTML=`<img src="${trophyAsset(t)}" alt=""><div><span>LATEST TROPHY</span><strong>${safeText(t.metricLabel||t.detail||t.name)}</strong><h2>${safeText(t.species||t.name||'Trophy')}</h2><small>${safeText(t.date||'')}</small></div>`;
      feature.onclick=()=>openTrophyDetail(0);
    }else{
      feature.innerHTML=`<img src="${A.camp}" alt=""><div><span>FIELD JOURNAL</span><h2>Trophies & memories</h2><small>Your best fish, recovered animals and field-camera moments will build up here.</small></div>`;
      feature.onclick=null;
    }

    const entries=qa('#eventLog .log-entry');
    (state?.events||[]).slice(0,entries.length).forEach((ev,i)=>{
      const entry=entries[i];const src=eventAsset(ev);if(!src||q('.bt70-log-img',entry))return;
      const kids=Array.from(entry.children);const copy=document.createElement('div');copy.className='bt70-log-copy';kids.forEach(k=>copy.appendChild(k));
      const im=document.createElement('img');im.className='bt70-log-img';im.src=src;im.alt='';
      entry.appendChild(im);entry.appendChild(copy);entry.classList.add('bt70-log-entry');
    });

    const trophies=qa('#trophyList .trophy');
    (state?.trophies||[]).forEach((t,i)=>{
      const card=trophies[i];if(!card)return;card.classList.add('bt70-trophy-card');
      if(!q('.bt70-trophy-img',card)){const im=document.createElement('img');im.className='bt70-trophy-img';im.src=trophyAsset(t);im.alt='';card.insertBefore(im,card.firstChild);}
      if(!card.dataset.bt70){card.dataset.bt70='1';card.addEventListener('click',()=>openTrophyDetail(i));}
    });

    const bests=typeof personalBests==='function'?personalBests():[];
    qa('#bestList .best-card').forEach((card,i)=>{
      const b=bests[i];if(!b)return;card.classList.add('bt70-best-card');
      if(!q('img',card)){const im=document.createElement('img');im.src=speciesAsset(b.species,b.detail);im.alt='';card.insertBefore(im,card.firstChild);}
    });
  }

  function ensureTrophyModal(){
    let m=q('#bt70TrophyModal');if(m)return m;
    m=document.createElement('div');m.id='bt70TrophyModal';m.className='modal hidden';
    m.innerHTML=`<div class="modal-panel bt70-trophy-modal">
      <img class="bt70-trophy-detail-img" alt="">
      <div class="eyebrow">TROPHY / MEMORY</div>
      <h2 class="bt70-trophy-detail-title">Trophy</h2>
      <p class="bt70-trophy-detail-meta"></p>
      <div class="bt70-trophy-detail-grid"></div>
      <div class="modal-actions"><button class="primary bt70-close-trophy">Back to journal</button></div>
    </div>`;
    document.body.appendChild(m);
    q('.bt70-close-trophy',m).addEventListener('click',()=>m.classList.add('hidden'));
    m.addEventListener('click',e=>{if(e.target===m)m.classList.add('hidden')});
    return m;
  }
  function openTrophyDetail(index){
    const t=state?.trophies?.[index];if(!t)return;
    const m=ensureTrophyModal();q('.bt70-trophy-detail-img',m).src=trophyAsset(t);
    q('.bt70-trophy-detail-title',m).textContent=t.name||t.species||'Trophy';
    q('.bt70-trophy-detail-meta',m).textContent=[t.species,t.date].filter(Boolean).join(' • ');
    q('.bt70-trophy-detail-grid',m).innerHTML=`<div><span>Record</span><strong>${safeText(t.metricLabel||'Standout')}</strong></div><div><span>Details</span><strong>${safeText(t.detail||'Field memory')}</strong></div>`;
    m.classList.remove('hidden');
  }

  function enhanceKnownAndField(){
    qa('#knownAnimalList .stack-item').forEach((item,i)=>{
      if(q('img',item))return;const a=(state?.knownAnimals||[]).filter(x=>x.status!=='taken')[i];if(!a)return;
      const im=document.createElement('img');im.className='bt70-stack-img';im.src=speciesAsset(a.species,a.nickname);im.alt='';item.insertBefore(im,item.firstChild);item.classList.add('bt70-stack-visual');
    });
    qa('#fieldGearList .stack-item').forEach(item=>{
      if(q('img',item))return;const text=safeText(item.textContent).toLowerCase();const im=document.createElement('img');im.className='bt70-stack-img';im.src=text.includes('camera')?A.camera:A.yabby;im.alt='';item.insertBefore(im,item.firstChild);item.classList.add('bt70-stack-visual');
    });
  }

  function enhance(){
    try{
      ensureTopbar();ensureHero();ensureRiverCard();ensureMap();ensureFishing();ensureGear();ensureJournal();enhanceKnownAndField();
      document.body.classList.add('bt70-enabled');
    }catch(e){console.warn('BushTrack visual layer',e);}
  }

  try{
    const priorRender=render;
    render=function(){const r=priorRender.apply(this,arguments);enhance();return r;};
  }catch(e){}

  try{
    const priorFishRender=renderFishingModal;
    renderFishingModal=function(){const r=priorFishRender.apply(this,arguments);ensureFishing();return r;};
  }catch(e){}

  ensureTrophyModal();
  enhance();
  window.BushTrackVisual070={version:V,enhance,assets:A};
})();
