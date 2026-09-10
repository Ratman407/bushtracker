/* BushTrack V0.6.4: definitive update-banner guard. Service-worker events may request a banner, but it is only visible after version.json confirms a genuinely newer version. */
(function(){
  const CURRENT_VERSION='0.6.4';

  if(!document.getElementById('btUpdateBannerGuardStyle')){
    const style=document.createElement('style');
    style.id='btUpdateBannerGuardStyle';
    style.textContent='#updateBanner:not([data-bt-confirmed-update="true"]){display:none!important}';
    document.head.appendChild(style);
  }

  async function serverVersion(){
    try{
      const r=await fetch('./version.json?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)return null;
      const j=await r.json();
      return j&&j.version?String(j.version):null;
    }catch(e){return null;}
  }

  function hideFalseBanner(){
    const banner=document.getElementById('updateBanner');
    if(!banner)return;
    banner.removeAttribute('data-bt-confirmed-update');
    banner.classList.add('hidden');
  }

  async function reconcileUpdateBanner(showCurrent=false){
    const banner=document.getElementById('updateBanner');
    const text=document.getElementById('updateBannerText');
    const server=await serverVersion();
    if(!server){
      hideFalseBanner();
      if(showCurrent)alert('Could not check for an update right now.');
      return;
    }
    if(server===CURRENT_VERSION){
      hideFalseBanner();
      if(showCurrent)alert('BushTrack '+CURRENT_VERSION+' is current.');
      return;
    }
    if(text)text.textContent='BushTrack '+server+' is available. Reload to update the game code; your save stays intact.';
    if(banner){
      banner.setAttribute('data-bt-confirmed-update','true');
      banner.classList.remove('hidden');
    }
  }

  try{checkForUpdate=async function(showCurrent=false){return reconcileUpdateBanner(showCurrent);};}catch(e){}

  const banner=document.getElementById('updateBanner');
  if(banner){
    hideFalseBanner();
    const observer=new MutationObserver(function(){
      if(!banner.classList.contains('hidden')&&banner.getAttribute('data-bt-confirmed-update')!=='true'){
        banner.classList.add('hidden');
        setTimeout(function(){reconcileUpdateBanner(false);},25);
      }
    });
    observer.observe(banner,{attributes:true,attributeFilter:['class']});
  }

  /* Catch old in-flight V0.6.0 checks and late service-worker controller events. */
  [0,100,350,1000,2500,5000].forEach(function(ms){setTimeout(function(){reconcileUpdateBanner(false);},ms);});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')setTimeout(function(){reconcileUpdateBanner(false);},50);});

  window.BushTrack064UpdateFix={reconcileUpdateBanner};
})();
