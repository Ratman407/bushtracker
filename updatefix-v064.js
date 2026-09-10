/* BushTrack V0.6.4: automatic update banner disabled. Manual update checks only. */
(function(){
  const CURRENT_VERSION='0.6.4';

  function killBanner(){
    const banner=document.getElementById('updateBanner');
    if(!banner)return;
    banner.classList.add('hidden');
    banner.setAttribute('aria-hidden','true');
    banner.style.setProperty('display','none','important');
  }

  /* Permanently prevent old app/service-worker listeners from making the banner visible. */
  if(!document.getElementById('btUpdateBannerKillStyle')){
    const style=document.createElement('style');
    style.id='btUpdateBannerKillStyle';
    style.textContent='#updateBanner{display:none!important}';
    document.head.appendChild(style);
  }

  killBanner();
  const banner=document.getElementById('updateBanner');
  if(banner){
    const observer=new MutationObserver(killBanner);
    observer.observe(banner,{attributes:true,childList:true,subtree:true});
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

  /* Automatic calls now do nothing; the Save-tab button still works because it calls with true. */
  try{
    checkForUpdate=async function(showCurrent=false){
      killBanner();
      if(showCurrent)return manualCheck();
      return null;
    };
  }catch(e){}

  /* Old in-flight events can still fire during this page load, so keep killing it for a few seconds. */
  [0,50,150,400,1000,2500,5000,10000].forEach(ms=>setTimeout(killBanner,ms));
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')killBanner();});
  window.addEventListener('focus',killBanner);

  window.BushTrack064UpdateFix={killBanner,manualCheck};
})();
