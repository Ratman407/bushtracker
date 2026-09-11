/* BushTrack V0.6.4: automatic update banner disabled. Manual update checks only. */
(function(){
  const CURRENT_VERSION='0.6.4';

  /* CSS alone is enough to suppress the old automatic banner without watching/mutating it. */
  if(!document.getElementById('btUpdateBannerKillStyle')){
    const style=document.createElement('style');
    style.id='btUpdateBannerKillStyle';
    style.textContent='#updateBanner{display:none!important}';
    document.head.appendChild(style);
  }

  function killBanner(){
    const banner=document.getElementById('updateBanner');
    if(!banner)return;
    if(!banner.classList.contains('hidden'))banner.classList.add('hidden');
    if(banner.getAttribute('aria-hidden')!=='true')banner.setAttribute('aria-hidden','true');
  }

  async function manualCheck(){
    try{
      const r=await fetch('./version.json?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const j=await r.json();
      const server=j&&j.version?String(j.version):null;
      if(!server)throw new Error('No version returned');
      if(server===CURRENT_VERSION)alert('BushTrack '+CURRENT_VERSION+' is current.');
      else alert('BushTrack '+server+' is available. Reload the page to update; your save stays intact.');
    }catch(e){
      alert('Could not check for an update right now.');
    }finally{
      killBanner();
    }
  }

  /* Automatic checks no longer display anything. The Save-tab manual button still works. */
  try{
    checkForUpdate=async function(showCurrent=false){
      killBanner();
      if(showCurrent)return manualCheck();
      return null;
    };
  }catch(e){}

  killBanner();
  [0,250,1000,3000].forEach(ms=>setTimeout(killBanner,ms));
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')killBanner();});
  window.addEventListener('focus',killBanner);

  window.BushTrack064UpdateFix={killBanner,manualCheck};
})();
