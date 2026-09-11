/* BushTrack V0.7.0 visual asset repair: crisp vector map + broken-image recovery. */
(function(){
  'use strict';
  if(window.BushTrackVisualFix070)return;

  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 820">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#142417"/><stop offset=".55" stop-color="#1b2b1c"/><stop offset="1" stop-color="#101b13"/></linearGradient>
    <linearGradient id="water"><stop stop-color="#274d57"/><stop offset=".5" stop-color="#477985"/><stop offset="1" stop-color="#244a54"/></linearGradient>
    <pattern id="trees" width="54" height="46" patternUnits="userSpaceOnUse"><circle cx="10" cy="18" r="8" fill="#213a22"/><circle cx="25" cy="12" r="9" fill="#29472a"/><circle cx="40" cy="25" r="8" fill="#1c321e"/><circle cx="18" cy="38" r="7" fill="#243e25"/><circle cx="48" cy="41" r="6" fill="#2b472b"/></pattern>
  </defs>
  <rect width="1400" height="820" fill="url(#bg)"/><rect width="1400" height="820" fill="url(#trees)" opacity=".86"/>
  <path d="M690 415C840 330 1110 350 1400 510V820H760C665 705 625 540 690 415Z" fill="#354d2e" opacity=".72"/>
  <path d="M165-30C120 120 260 155 220 260C175 375 390 345 405 455C420 560 620 520 690 610C770 710 900 675 1040 835" fill="none" stroke="#102329" stroke-width="70" opacity=".58"/>
  <path d="M165-30C120 120 260 155 220 260C175 375 390 345 405 455C420 560 620 520 690 610C770 710 900 675 1040 835" fill="none" stroke="url(#water)" stroke-width="46"/>
  <path d="M165-30C120 120 260 155 220 260C175 375 390 345 405 455C420 560 620 520 690 610C770 710 900 675 1040 835" fill="none" stroke="#91b2ad" stroke-width="3" opacity=".6"/>
  <ellipse cx="335" cy="470" rx="115" ry="88" fill="#17353b" stroke="#578485" stroke-width="5"/><ellipse cx="1115" cy="635" rx="145" ry="95" fill="#21464d" stroke="#607e78" stroke-width="5"/>
  <g fill="none" stroke="#8b9976" stroke-width="2" opacity=".30"><path d="M610 70C770 5 975 20 1200 150"/><path d="M590 105C770 42 980 55 1230 190"/><path d="M560 145C760 80 1010 90 1260 230"/><path d="M535 185C760 115 1025 125 1290 270"/><path d="M45 610C215 565 375 595 535 710"/><path d="M15 650C210 605 410 650 555 770"/></g>
  <path d="M650 105C690 200 660 285 710 360C760 430 730 510 820 600C900 680 1010 705 1170 735" fill="none" stroke="#d0b875" stroke-width="8" stroke-dasharray="20 16" opacity=".72"/>
  <path d="M760 760C870 680 1020 585 1390 530" fill="none" stroke="#9b956d" stroke-width="7" opacity=".36"/>
  <g stroke="#d6c88b" stroke-width="1" opacity=".07"><path d="M0 205H1400M0 410H1400M0 615H1400"/><path d="M350 0V820M700 0V820M1050 0V820"/></g>
  </svg>`;
  const mapUri='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);

  function applyMap(){
    const api=window.BushTrackVisual070;
    if(api&&api.assets)api.assets.map=mapUri;
    document.querySelectorAll('.bt70-map-image').forEach(el=>{el.style.backgroundImage=`url("${mapUri}")`;});
  }

  function repairImage(img){
    if(!(img instanceof HTMLImageElement))return;
    const src=img.getAttribute('src')||'';
    if(!src.includes('assets/visual/')){img.style.display='none';return;}
    if(img.dataset.bt70Retry==='1'){
      img.style.display='none';
      const parent=img.parentElement;if(parent)parent.classList.add('bt70-image-missing');
      return;
    }
    img.dataset.bt70Retry='1';
    img.src=src.split('?')[0]+'?v=070fix1';
  }

  document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement)repairImage(e.target);},true);
  const style=document.createElement('style');
  style.textContent=`.bt70-map-image{background-color:#132017!important;background-size:cover!important;background-position:center!important}.bt70-image-missing{background:linear-gradient(135deg,#152118,#0c120e)!important}.bt70-image-missing:before{content:'Image unavailable';display:block;color:#7f8c80;font-size:11px;padding:12px}`;
  document.head.appendChild(style);
  applyMap();
  setTimeout(applyMap,100);setTimeout(applyMap,800);
  window.addEventListener('focus',applyMap);
  window.BushTrackVisualFix070={applyMap,repairImage};
})();