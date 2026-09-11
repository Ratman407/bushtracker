/* BushTrack V0.7.0 visual asset repair v3: crisp map + built-in creek artwork + cache-busted images. */
(function(){
  'use strict';
  if(window.BushTrackVisualFix070v3)return;

  const ASSET_REV='070fix3';
  const mapSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 820">
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
  </svg>`;

  const creekSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 650">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a9b99e"/><stop offset="1" stop-color="#617a60"/></linearGradient>
    <linearGradient id="hill" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#52664b"/><stop offset="1" stop-color="#283a2b"/></linearGradient>
    <linearGradient id="creek" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#35555a"/><stop offset=".55" stop-color="#18383d"/><stop offset="1" stop-color="#10292d"/></linearGradient>
    <linearGradient id="gum" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#4b4439"/><stop offset=".45" stop-color="#b0a390"/><stop offset=".65" stop-color="#70695d"/><stop offset="1" stop-color="#3d3932"/></linearGradient>
    <filter id="shade"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="1200" height="650" fill="url(#sky)"/>
  <path d="M0 295C140 210 275 210 395 255C510 300 610 190 760 205C930 220 1050 145 1200 165V410H0Z" fill="url(#hill)"/>
  <path d="M0 335C165 280 300 330 430 315C610 295 720 335 860 285C1000 235 1095 255 1200 235V455H0Z" fill="#213522" opacity=".9"/>
  <path d="M0 470C170 425 315 455 470 430C645 402 760 410 920 390C1055 372 1135 382 1200 405V650H0Z" fill="url(#creek)"/>
  <g opacity=".72" stroke="#7ba0a2" fill="none"><path d="M20 505C210 470 360 505 535 472C690 443 875 445 1160 428"/><path d="M40 565C210 530 395 557 610 520C815 485 1015 500 1190 468"/><path d="M110 615C355 575 620 598 880 550"/></g>
  <g fill="#554f43" stroke="#26251f" stroke-width="4"><ellipse cx="80" cy="478" rx="95" ry="52"/><ellipse cx="225" cy="438" rx="83" ry="48"/><ellipse cx="365" cy="458" rx="115" ry="58"/><ellipse cx="520" cy="412" rx="88" ry="48"/><ellipse cx="690" cy="430" rx="125" ry="55"/><ellipse cx="885" cy="390" rx="110" ry="48"/><ellipse cx="1070" cy="414" rx="120" ry="55"/></g>
  <g fill="#776e5d" opacity=".55"><ellipse cx="240" cy="420" rx="55" ry="20"/><ellipse cx="535" cy="394" rx="50" ry="18"/><ellipse cx="705" cy="410" rx="65" ry="17"/><ellipse cx="1060" cy="390" rx="70" ry="19"/></g>
  <path d="M155 -20C145 125 120 230 95 390" stroke="url(#gum)" stroke-width="78" fill="none"/><path d="M315 -15C275 125 250 255 225 405" stroke="url(#gum)" stroke-width="70" fill="none"/><path d="M250 80C185 115 145 160 115 225" stroke="#837b6e" stroke-width="24" fill="none"/><path d="M335 75C420 110 485 125 565 118" stroke="#766e61" stroke-width="20" fill="none"/>
  <g fill="#172b1b"><circle cx="70" cy="90" r="74"/><circle cx="170" cy="60" r="72"/><circle cx="275" cy="80" r="88"/><circle cx="380" cy="74" r="70"/><circle cx="475" cy="100" r="68"/></g>
  <g fill="#29452b"><circle cx="720" cy="130" r="75"/><circle cx="805" cy="95" r="85"/><circle cx="905" cy="115" r="80"/><circle cx="1020" cy="90" r="90"/><circle cx="1130" cy="130" r="84"/></g>
  <ellipse cx="590" cy="635" rx="620" ry="80" fill="#07110d" opacity=".22" filter="url(#shade)"/>
  </svg>`;

  const mapUri='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(mapSvg);
  const creekUri='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(creekSvg);

  function applyBuiltIns(){
    const api=window.BushTrackVisual070;
    if(api&&api.assets){api.assets.map=mapUri;api.assets.creek=creekUri;}
    document.querySelectorAll('.bt70-map-image').forEach(el=>{
      el.style.backgroundImage=`url("${mapUri}")`;
      el.style.backgroundColor='#132017';el.style.backgroundSize='cover';el.style.backgroundPosition='center';
    });
    document.querySelectorAll('img').forEach(img=>{
      const src=img.getAttribute('src')||'';
      if(src.includes('creek-hero.webp')){img.src=creekUri;img.style.removeProperty('display');}
    });
  }

  function freshAssetUrl(src){
    if(!src||!src.includes('assets/visual/'))return src;
    return src.split('?')[0]+'?v='+ASSET_REV;
  }
  function refreshImages(root=document){
    root.querySelectorAll('img').forEach(img=>{
      let src=img.getAttribute('src')||'';
      if(src.includes('creek-hero.webp')){img.src=creekUri;return;}
      if(!src.includes('assets/visual/'))return;
      img.classList.remove('bt70-image-missing');if(img.parentElement)img.parentElement.classList.remove('bt70-image-missing');
      img.style.removeProperty('display');const next=freshAssetUrl(src);if(next!==src)img.src=next;
    });
  }
  document.addEventListener('error',e=>{
    const img=e.target;if(!(img instanceof HTMLImageElement))return;
    const src=img.getAttribute('src')||'';
    if(src.includes('creek-hero.webp')){img.src=creekUri;return;}
    if(src.includes('assets/visual/')&&!src.includes('v='+ASSET_REV))img.src=freshAssetUrl(src);
  },true);

  const style=document.createElement('style');
  style.textContent='.bt70-map-image{background-color:#132017!important;background-size:cover!important;background-position:center!important}.bt70-image-missing:before{content:none!important}';
  document.head.appendChild(style);
  applyBuiltIns();refreshImages();
  [100,500,1400].forEach(ms=>setTimeout(()=>{applyBuiltIns();refreshImages();},ms));
  window.addEventListener('focus',()=>{applyBuiltIns();refreshImages();});
  window.BushTrackVisualFix070v3={applyBuiltIns,refreshImages};
})();