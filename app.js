const STORAGE_KEY = 'bushtrack-v01';

function localDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function initialState() {
  return {
    version: 1,
    xp: 0,
    cash: 0,
    active: 'hunt',
    lastClaimDate: null,
    hunt: {
      species: 'Fallow buck',
      startDistance: 10000,
      remaining: 10000,
      cumulative: 0,
      ready: false,
      shotRange: null,
      trophyPotential: randInt(205, 255)
    },
    river: {
      discovered: false,
      startDistance: 8500,
      remaining: 8500,
      ready: false,
      fishedDate: null
    },
    trophies: [],
    events: [
      { title: 'Fresh sign', text: 'A solid fallow buck crossed the track before daylight.', date: 'Today' }
    ]
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    return { ...initialState(), ...JSON.parse(raw) };
  } catch { return initialState(); }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function fmt(n) { return Math.max(0, Math.round(n)).toLocaleString('en-AU'); }
function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function addEvent(title,text){ state.events.unshift({title,text,date:'Today'}); state.events = state.events.slice(0,12); }

let state = loadState();
let aimTimer = null;
let aimPos = 0;
let aimDir = 1;
let selectedLure = 'Spinnerbait';

const $ = (id) => document.getElementById(id);
const els = {
  levelText:$('levelText'), xpText:$('xpText'), cashText:$('cashText'),
  activeTitle:$('activeTitle'), activeStory:$('activeStory'), activeDistance:$('activeDistance'), activeProgress:$('activeProgress'),
  mapTarget:$('mapTarget'), riverLine:$('riverLine'),
  stepsInput:$('stepsInput'), claimBtn:$('claimBtn'), claimStatus:$('claimStatus'),
  huntCard:$('huntCard'), huntTitle:$('huntTitle'), huntText:$('huntText'), huntDistance:$('huntDistance'), huntTag:$('huntTag'), selectHuntBtn:$('selectHuntBtn'), shotBtn:$('shotBtn'),
  riverCard:$('riverCard'), riverText:$('riverText'), riverDistance:$('riverDistance'), riverTag:$('riverTag'), selectRiverBtn:$('selectRiverBtn'), fishBtn:$('fishBtn'),
  eventLog:$('eventLog'), trophyList:$('trophyList'), resetBtn:$('resetBtn'),
  shotModal:$('shotModal'), shotTitle:$('shotTitle'), shotRangeText:$('shotRangeText'), aimMarker:$('aimMarker'), vitalsZone:$('vitalsZone'), cancelShotBtn:$('cancelShotBtn'), fireBtn:$('fireBtn'),
  fishModal:$('fishModal'), lureGrid:$('lureGrid'), fishResult:$('fishResult'), closeFishBtn:$('closeFishBtn'), castBtn:$('castBtn')
};

function levelFromXp(xp){ return Math.floor(xp/1000)+1; }

function render() {
  const level = levelFromXp(state.xp);
  els.levelText.textContent = `LV ${level}`;
  els.xpText.textContent = `${fmt(state.xp)} XP`;
  els.cashText.textContent = `$${fmt(state.cash)}`;

  const today = localDayKey();
  els.claimStatus.textContent = state.lastClaimDate === today
    ? 'Today’s steps have already been claimed.'
    : 'No steps claimed today.';
  els.claimBtn.disabled = state.lastClaimDate === today;
  els.claimBtn.style.opacity = state.lastClaimDate === today ? '.45' : '1';

  // Hunt card
  els.huntTitle.textContent = state.hunt.species;
  els.huntDistance.textContent = state.hunt.ready ? `${state.hunt.shotRange} m shot` : `${fmt(state.hunt.remaining)} steps`;
  els.huntTag.textContent = state.hunt.ready ? 'SHOT READY' : 'TRACKING';
  els.huntText.textContent = state.hunt.ready
    ? 'You’ve worked into a shooting position. Open the encounter when you’re ready.'
    : 'Fresh tracks are leading through broken timber.';
  els.shotBtn.classList.toggle('hidden', !state.hunt.ready);
  els.selectHuntBtn.classList.toggle('hidden', state.hunt.ready);
  els.selectHuntBtn.textContent = state.active === 'hunt' ? 'Active trail' : 'Make active';
  els.huntCard.classList.toggle('active', state.active === 'hunt');

  // River card
  els.riverCard.classList.toggle('locked', !state.river.discovered);
  els.riverLine.classList.toggle('hidden', !state.river.discovered);
  if (!state.river.discovered) {
    els.riverTag.textContent = 'UNDISCOVERED';
    els.riverText.textContent = 'You haven’t found a watercourse worth following yet.';
    els.riverDistance.textContent = '—';
    els.selectRiverBtn.classList.add('hidden');
    els.fishBtn.classList.add('hidden');
  } else if (!state.river.ready) {
    els.riverTag.textContent = 'EXPLORING';
    els.riverText.textContent = 'Mostly shallow water. Keep following it upstream; the banks are getting steeper.';
    els.riverDistance.textContent = `${fmt(state.river.remaining)} steps`;
    els.selectRiverBtn.classList.remove('hidden');
    els.selectRiverBtn.textContent = state.active === 'river' ? 'Active trail' : 'Make active';
    els.fishBtn.classList.add('hidden');
  } else {
    els.riverTag.textContent = 'DEEP HOLE';
    els.riverText.textContent = 'A deep bend sits under timber. Big fish have been rolling after dark.';
    els.riverDistance.textContent = 'Unlocked';
    els.selectRiverBtn.classList.add('hidden');
    els.fishBtn.classList.remove('hidden');
    els.fishBtn.disabled = state.river.fishedDate === today;
    els.fishBtn.style.opacity = state.river.fishedDate === today ? '.45' : '1';
    els.fishBtn.textContent = state.river.fishedDate === today ? 'Fished today' : 'Fish the hole';
  }
  els.riverCard.classList.toggle('active', state.active === 'river');

  const active = state.active === 'river' && state.river.discovered ? 'river' : 'hunt';
  if (active === 'hunt') {
    els.activeTitle.textContent = state.hunt.ready ? `${state.hunt.species} — opportunity` : state.hunt.species;
    els.activeStory.textContent = state.hunt.ready
      ? `You’ve closed the gap. Estimated range is ${state.hunt.shotRange} metres.`
      : 'Fresh tracks are heading into timber. Keep moving and close the distance.';
    els.activeDistance.textContent = state.hunt.ready ? `${state.hunt.shotRange} m` : `${fmt(state.hunt.remaining)} steps`;
    const pct = state.hunt.ready ? 100 : clamp((state.hunt.startDistance-state.hunt.remaining)/state.hunt.startDistance*100,0,100);
    els.activeProgress.style.width = `${pct}%`;
    els.mapTarget.textContent = 'BUCK';
  } else {
    els.activeTitle.textContent = state.river.ready ? 'Deep hole found' : 'Follow the creek';
    els.activeStory.textContent = state.river.ready
      ? 'You’ve found the water you were looking for. Something big is holding under the timber.'
      : 'The creek is shallow here. Keep following it until the country forces the water into a deeper bend.';
    els.activeDistance.textContent = state.river.ready ? 'Fishing unlocked' : `${fmt(state.river.remaining)} steps`;
    const pct = state.river.ready ? 100 : clamp((state.river.startDistance-state.river.remaining)/state.river.startDistance*100,0,100);
    els.activeProgress.style.width = `${pct}%`;
    els.mapTarget.textContent = state.river.ready ? 'HOLE' : 'CREEK';
  }

  els.eventLog.innerHTML = state.events.map(e => `<div class="log-entry"><strong>${escapeHtml(e.title)}</strong><div>${escapeHtml(e.text)}</div><small>${escapeHtml(e.date)}</small></div>`).join('');
  if (!state.trophies.length) {
    els.trophyList.innerHTML = '<div class="empty">Nothing on the wall yet.</div>';
  } else {
    els.trophyList.innerHTML = state.trophies.map(t => `<div class="trophy"><strong>${escapeHtml(t.name)}</strong><span>${escapeHtml(t.detail)}</span></div>`).join('');
  }

  save();
}

function escapeHtml(str){ return String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }

function claimSteps() {
  const today = localDayKey();
  if (state.lastClaimDate === today) return;
  const steps = parseInt(String(els.stepsInput.value).replace(/\D/g,''),10);
  if (!steps || steps < 1 || steps > 100000) {
    els.claimStatus.textContent = 'Put in a sensible step count first.';
    return;
  }
  state.lastClaimDate = today;
  state.xp += Math.round(steps/20);

  if (state.active === 'river' && state.river.discovered && !state.river.ready) {
    state.river.remaining -= steps;
    if (state.river.remaining <= 0) {
      state.river.remaining = 0;
      state.river.ready = true;
      state.xp += 350;
      addEvent('Deep water found', 'The shallow creek finally drops into a dark bend under timber. This spot is now on your map permanently.');
    } else {
      const clue = riverClue(state.river.remaining);
      addEvent('Upstream progress', `${fmt(steps)} steps along the creek. ${clue}`);
    }
  } else if (!state.hunt.ready) {
    state.hunt.cumulative += steps;
    state.hunt.remaining -= steps;

    if (!state.river.discovered && state.hunt.cumulative >= 2500) {
      state.river.discovered = true;
      addEvent('Side trail discovered', 'You cross a shallow creek. It looks ordinary here, but the bank gets tighter upstream. You can follow it another day.');
    }

    if (state.hunt.remaining <= 0) {
      const overshoot = Math.abs(state.hunt.remaining);
      state.hunt.remaining = 0;
      state.hunt.ready = true;
      state.hunt.shotRange = clamp(240 - Math.floor(overshoot/28), 65, 240);
      state.xp += 300;
      addEvent('Movement ahead', `You’ve caught up with the buck and worked into ${state.hunt.shotRange} m. A shot opportunity is waiting.`);
    } else {
      // Partial progress always matters. The animal relocates, but the next target gets a little easier.
      const relocation = Math.min(state.hunt.remaining-400, randInt(250,850));
      if (relocation > 0) state.hunt.remaining -= relocation;
      addEvent('Tracks getting fresher', `${fmt(steps)} steps covered. Overnight movement shifted the intercept another ${fmt(Math.max(0,relocation))} steps in your favour. About ${fmt(state.hunt.remaining)} remain.`);
    }
  }

  els.stepsInput.value = '';
  render();
}

function riverClue(rem) {
  if (rem < 1800) return 'The bottom has dropped away and you can hear water working around a bend.';
  if (rem < 4000) return 'More submerged timber is showing and the banks are starting to pinch in.';
  return 'Still mostly shallow, but there are bigger snags and deeper edges than before.';
}

function openShot() {
  if (!state.hunt.ready) return;
  els.shotTitle.textContent = state.hunt.species;
  els.shotRangeText.textContent = `Range: ${state.hunt.shotRange} m`;
  const width = clamp(88 - (state.hunt.shotRange-65)*0.25, 38, 88);
  els.vitalsZone.style.width = `${width}px`;
  els.shotModal.classList.remove('hidden');
  aimPos = 0; aimDir = 1;
  clearInterval(aimTimer);
  const speed = clamp(17 - Math.floor((240-state.hunt.shotRange)/30), 9, 17);
  aimTimer = setInterval(() => {
    aimPos += aimDir * speed;
    if (aimPos >= 100) { aimPos = 100; aimDir = -1; }
    if (aimPos <= 0) { aimPos = 0; aimDir = 1; }
    els.aimMarker.style.left = `calc(${aimPos}% - 1px)`;
  }, 45);
}

function fireShot() {
  clearInterval(aimTimer);
  const boxWidth = $('aimBox').clientWidth;
  const markerX = aimPos/100*boxWidth;
  const zoneWidth = els.vitalsZone.getBoundingClientRect().width;
  const half = zoneWidth/2;
  const centre = boxWidth/2;
  const error = Math.abs(markerX-centre);
  const hit = error <= half;
  els.shotModal.classList.add('hidden');

  if (hit) {
    const score = clamp(state.hunt.trophyPotential + randInt(-12,18), 170, 290);
    const payout = Math.round(score*3.1);
    state.cash += payout;
    state.xp += 500;
    state.trophies.unshift({ name: state.hunt.species, detail: `${score} pt trophy • ${state.hunt.shotRange} m` });
    addEvent('Clean hit', `${score}-point fallow buck taken at ${state.hunt.shotRange} m. Trophy added to the cabinet.`);
  } else {
    state.xp += 80;
    addEvent('Missed opportunity', 'The shot was off and the buck disappeared into cover. You’ll have to find fresh sign again.');
  }
  newHunt();
  render();
}

function newHunt() {
  const distance = randInt(6500,13500);
  state.hunt = {
    species: 'Fallow buck', startDistance: distance, remaining: distance, cumulative:0,
    ready:false, shotRange:null, trophyPotential:randInt(200,265)
  };
  state.active = 'hunt';
}

function openFish() {
  if (!state.river.ready || state.river.fishedDate === localDayKey()) return;
  els.fishResult.textContent = 'One cast tonight.';
  els.castBtn.disabled = false;
  els.fishModal.classList.remove('hidden');
}

function castLine() {
  if (els.castBtn.disabled) return;
  els.castBtn.disabled = true;
  state.river.fishedDate = localDayKey();
  const roll = Math.random();
  const lureBonus = selectedLure === 'Spinnerbait' ? 0.04 : selectedLure === 'Surface lure' ? 0.025 : selectedLure === 'Bait' ? 0.015 : 0;
  if (roll < 0.12 + lureBonus) {
    const cm = randInt(48,64);
    const trophy = cm >= 58;
    const label = trophy ? 'Trophy bass' : 'Good bass';
    els.fishResult.textContent = `${label}: ${cm} cm on the ${selectedLure.toLowerCase()}.`;
    state.trophies.unshift({ name: trophy ? 'Trophy bass' : 'Australian bass', detail: `${cm} cm • ${selectedLure}` });
    state.xp += trophy ? 420 : 220;
    state.cash += trophy ? 280 : 120;
    addEvent(label, `${cm} cm bass pulled from the deep timber on a ${selectedLure.toLowerCase()}.`);
  } else if (roll < .67) {
    const cm = randInt(23,43);
    els.fishResult.textContent = `Bass: ${cm} cm. Not the trophy fish, but the hole definitely holds them.`;
    state.xp += 80;
    addEvent('Fish landed', `${cm} cm bass from the deep hole. The bigger one is still in there.`);
  } else {
    els.fishResult.textContent = 'Nothing committed. You saw a boil near the timber though.';
    addEvent('No fish tonight', 'A boil near the snag suggests the big fish is still holding in the hole.');
  }
  render();
}

els.claimBtn.addEventListener('click', claimSteps);
els.selectHuntBtn.addEventListener('click', () => { state.active='hunt'; render(); });
els.selectRiverBtn.addEventListener('click', () => { if(state.river.discovered){ state.active='river'; render(); } });
els.shotBtn.addEventListener('click', openShot);
els.cancelShotBtn.addEventListener('click', () => { clearInterval(aimTimer); els.shotModal.classList.add('hidden'); });
els.fireBtn.addEventListener('click', fireShot);
els.fishBtn.addEventListener('click', openFish);
els.closeFishBtn.addEventListener('click', () => els.fishModal.classList.add('hidden'));
els.castBtn.addEventListener('click', castLine);
els.lureGrid.addEventListener('click', (e) => {
  const b = e.target.closest('.lure'); if(!b) return;
  [...els.lureGrid.querySelectorAll('.lure')].forEach(x=>x.classList.remove('selected'));
  b.classList.add('selected'); selectedLure = b.dataset.lure;
});
els.resetBtn.addEventListener('click', () => {
  if (confirm('Reset all prototype progress?')) { state = initialState(); save(); render(); }
});

// iPhone Shortcut hook:
//   ?steps=5820             -> prefills today's steps
//   ?steps=5820&claim=1     -> imports AND claims them automatically
const params = new URLSearchParams(location.search);
const imported = parseInt(params.get('steps'),10);
const shortcutAutoClaim = params.get('claim') === '1';

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();

if (imported > 0 && imported < 100000) {
  // Remove the imported step count from the address bar after we've read it.
  history.replaceState({},'',location.pathname);

  if (shortcutAutoClaim) {
    if (state.lastClaimDate === localDayKey()) {
      els.claimStatus.textContent = `${fmt(imported)} steps received from Shortcut, but today is already claimed.`;
    } else {
      els.stepsInput.value = imported;
      claimSteps();
    }
  } else {
    els.stepsInput.value = imported;
    els.claimStatus.textContent = `${fmt(imported)} steps imported — tap Claim steps when ready.`;
  }
}
