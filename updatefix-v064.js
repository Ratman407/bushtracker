/* BushTrack V0.6.4: suppress false update banners caused by same-version service-worker refreshes. */
(function(){
  const CURRENT_VERSION='0.6.4';
  let checking=false;

  async function serverVersion(){
    try{
      const r=await fetch('./version.json?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)return null;
      const j=await r.json();
      return j&&j.version?String(j.version):null;
    }catch(e){return null;}
  }

  async function reconcileUpdateBanner(showCurrent=false){
    if(checking)return;
    checking=true;
    try{
      const banner=document.getElementById('updateBanner');
      const text=document.getElementById('updateBannerText');
      const server=await serverVersion();
      if(!server)return;
      if(server===CURRENT_VERSION){
        if(banner)banner.classList.add('hidden');
        if(showCurrent)alert('BushTrack '+CURRENT_VERSION+' is current.');
      }else{
        if(text)text.textContent='BushTrack '+server+' is available. Reload to update the game code; your save stays intact.';
        if(banner)banner.classList.remove('hidden');
      }
    }finally{checking=false;}
  }

  try{
    checkForUpdate=async function(showCurrent=false){return reconcileUpdateBanner(showCurrent);};
  }catch(e){}

  const banner=document.getElementById('updateBanner');
  const bannerText=document.getElementById('updateBannerText');
  if(banner){
    const observer=new MutationObserver(function(){
      if(!banner.classList.contains('hidden'))setTimeout(function(){reconcileUpdateBanner(false);},10);
    });
    observer.observe(banner,{attributes:true,attributeFilter:['class']});
    if(bannerText)observer.observe(bannerText,{childList:true,characterData:true,subtree:true});
  }

  setTimeout(function(){reconcileUpdateBanner(false);},50);
  window.BushTrack064UpdateFix={reconcileUpdateBanner};
})();
