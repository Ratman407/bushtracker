/* BushTrack V0.7.1 — use uploaded animal artwork in the shot screen. */
(function(){
  const ART={
    'Fallow deer':'fallow.jpg',
    'Red deer':'red-deer.jpg',
    'Feral goat':'goat.jpg',
    'Feral pig':'pig.jpg',
    'Rabbit':'rabbit.jpg'
  };
  const box=document.getElementById('aimBox');
  if(!box)return;
  const style=document.createElement('style');
  style.textContent=`
    #aimBox{position:relative;overflow:hidden;background:#18271d!important}
    #shotAnimalArt{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:contain;object-position:center;pointer-events:none;user-select:none}
    #aimBox .animal-target{display:none!important}
    #aimBox #vitalsZone{z-index:3}
    #aimBox #aimMarker{z-index:4}
  `;
  document.head.appendChild(style);
  let img=document.getElementById('shotAnimalArt');
  if(!img){img=document.createElement('img');img.id='shotAnimalArt';img.alt='';img.draggable=false;box.insertBefore(img,box.firstChild);}
  function updateArt(){
    try{
      const e=state&&state.currentEncounter;
      const species=e&&e.selectedAnimal&&e.selectedAnimal.species;
      const src=ART[species];
      if(!src){img.removeAttribute('src');img.style.display='none';return;}
      img.src=src;
      img.style.display='block';
    }catch(err){console.error('BushTrack animal artwork',err);}
  }
  const shot=document.getElementById('shotModal');
  if(shot)new MutationObserver(function(){if(!shot.classList.contains('hidden'))setTimeout(updateArt,0);}).observe(shot,{attributes:true,attributeFilter:['class']});
  document.addEventListener('click',function(ev){if(ev.target&&ev.target.closest&&ev.target.closest('[data-animal]'))setTimeout(updateArt,20);},true);
  window.BushTrackAnimalArt={updateArt,ART};
})();
