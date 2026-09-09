const APP_VERSION = '0.6.0';
const SCHEMA_VERSION = 6;
const CONTENT_VERSION = 2;
const STORAGE_KEY = 'bushtrack-v06';
const BACKUP_KEY = 'bushtrack-backups-v06';
const STAGING_KEY = 'bushtrack-staging-v06';
const LAST_GOOD_KEY = 'bushtrack-last-good-v06';
const LEGACY_KEYS = ['bushtrack-v05','bushtrack-v04','bushtrack-v03','bushtrack-v02','bushtrack-v01'];
const MAX_BACKUPS = 7;
const HISTORY_LIMITS = {events:1200,claimAudit:800,notifications:300,eventQueue:300};
const DEFAULT_FEATURE_FLAGS = {conditioning:true,worldQueue:true,persistentAnimals:true,loadouts:true,camps:true,glassing:true,recoveryEconomy:true,trapPressure:true,notifications:false,cloudSync:false,fieldTestTools:false};
const CONDITIONING_CONFIG = {milestoneStep:500,maxTier:6,momentum500:0.05,momentum1000:0.10};

var state = null;
let runtimeStorageError = null;
let lastRuntimeSaveAt = null;
let pendingImportEnvelope = null;

const $ = id => document.getElementById(String(id).replace(/^#/,''));
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
const fmt = n => Math.max(0,Math.round(n)).toLocaleString('en-AU');
const esc = str => String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

function hash32(str){
  let h=2166136261>>>0;
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
}
function seededFloat(seed){
  let a=hash32(seed)||0x6d2b79f5;
  a|=0; a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296;
}
function worldRandom(){
  if(!state || !state.meta || !state.meta.saveId) return Math.random();
  const c=Number(state.meta.randomCounter||0);
  const day=state.meta.currentDay||localDayKey();
  const r=seededFloat(`${state.meta.saveId}|${day}|${c}`);
  state.meta.randomCounter=c+1;
  return r;
}
const randInt = (min,max) => Math.floor(worldRandom()*(max-min+1))+min;
const pick = arr => arr[Math.floor(worldRandom()*arr.length)];
const chance = p => worldRandom() < p;

function localDayKey(d=new Date()){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function displayDay(d=new Date()){
  return d.toLocaleDateString('en-AU',{day:'numeric',month:'short'});
}
function seasonForDate(d=new Date()){
  const m=d.getMonth()+1;
  if([12,1,2].includes(m)) return 'Summer';
  if([3,4,5].includes(m)) return 'Autumn';
  if([6,7,8].includes(m)) return 'Winter';
  return 'Spring';
}
function uid(prefix='id'){ return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
function weighted(items){
  const total=items.reduce((s,x)=>s+x.w,0); let r=worldRandom()*total;
  for(const x of items){ r-=x.w; if(r<=0) return x.v; }
  return items[items.length-1].v;
}

const LOCATION_TEMPLATES = {
  creek: {type:'water',name:'Shallow creek',desc:'A narrow creek with long shallow runs and scattered timber.',actions:['camera']},
  deepHole: {type:'water',name:'Deep timber hole',desc:'A dark bend under timber. One of those spots that looks like it has to hold fish.',actions:['fish','net','camera'],fishery:'bassCreek'},
  farmDam: {type:'water',name:'Old farm dam',desc:'Muddy edges, plenty of sign and deeper water near the wall.',actions:['fish','net','camera','ambush'],fishery:'farmDam'},
  gameTrail: {type:'sign',name:'Well-used game trail',desc:'Multiple species are using the same line through the scrub.',actions:['camera','ambush']},
  wallow: {type:'sign',name:'Muddy wallow',desc:'Fresh churned mud and tracks around a wet depression.',actions:['camera','ambush']},
  rabbitWarren: {type:'sign',name:'Rabbit warren',desc:'Fresh scratchings and several active holes.',actions:['rabbit']},
  oldHut: {type:'landmark',name:'Old hut',desc:'Half-collapsed, but worth a look whenever you pass through.',actions:[]},
  ridge: {type:'landmark',name:'Open ridge',desc:'A good glassing point over the surrounding country.',actions:['glass','ambush']},
  crossing: {type:'sign',name:'Creek crossing',desc:'A narrow crossing with tracks punched into both banks.',actions:['camera','ambush']},
  campsite: {type:'camp',name:'Sheltered campsite',desc:'Flat ground with water nearby. Could become a base for longer trips.',actions:['camp']},
  backblockGate: {type:'access',name:'Back-block access',desc:'The ute gets you to more remote country, but once there you are back on foot.',actions:['region']}
};

const FISHERIES = {
  bassCreek: {
    name:'Deep timber hole',
    species:[
      {name:'Australian bass',w:68,min:18,max:58,trophy:48,metric:'cm'},
      {name:'Eel-tailed catfish',w:16,min:25,max:72,trophy:58,metric:'cm'},
      {name:'Freshwater eel',w:10,min:35,max:95,trophy:75,metric:'cm'},
      {name:'Silver perch',w:6,min:20,max:48,trophy:40,metric:'cm'}
    ],
    lureBias:{'Spinnerbait':1.08,'Surface lure':1.02,'Soft plastic':1.08,'Bait':1.04,'Yabby bait':1.18}
  },
  farmDam: {
    name:'Farm dam',
    species:[
      {name:'Carp',w:45,min:28,max:92,trophy:72,metric:'cm'},
      {name:'Golden perch',w:24,min:25,max:61,trophy:50,metric:'cm'},
      {name:'Eel-tailed catfish',w:20,min:24,max:74,trophy:58,metric:'cm'},
      {name:'Australian bass',w:11,min:20,max:52,trophy:45,metric:'cm'}
    ],
    lureBias:{'Spinnerbait':1.05,'Surface lure':0.9,'Soft plastic':1.08,'Bait':1.12,'Yabby bait':1.20}
  }
};

const GEAR = [
  {id:'boots',name:'Quiet boots',base:350,max:3,desc:'Reduce the chance of blowing an approach.'},
  {id:'binoculars',name:'Better binoculars',base:450,max:3,desc:'Reveal more about animals before you commit.'},
  {id:'scope',name:'Better scope',base:550,max:3,desc:'Makes the shot timing window a little more forgiving.'},
  {id:'rod',name:'Better rod & reel',base:450,max:3,desc:'Gives more control when a trophy fish is hooked.'},
  {id:'pack',name:'Field pack',base:300,max:3,desc:'Improves the chance of useful finds while exploring.'},
  {id:'call',name:'Basic game call',base:300,max:1,desc:'Once per hunt, try to pull animals closer or reveal something else.'},
  {id:'uteAccess',name:'Back-block ute access',base:1800,max:1,level:4,desc:'Unlock more remote country and a wider hunt table.'}
];


// V0.6 field-loadout tables. Ranges/weights are game-balance values, not a ballistics reference.
const WEAPONS = {
  '22lr':{id:'22lr',name:'.22 LR',capacity:10,practicalRange:45,weight:2.5,handling:1.10,ammoWeight:.004,ammoPack:25,ammoPrice:35,power:'small',desc:'Light small-game rifle. Excellent for rabbits; poor choice for larger animals.'},
  '44lever':{id:'44lever',name:'.44 lever action',capacity:10,practicalRange:50,weight:3.1,handling:1.03,ammoWeight:.018,ammoPack:20,ammoPrice:65,power:'medium',desc:'Handy in thick country with ten rounds, but you need to get close.'},
  '223':{id:'223',name:'.223 bolt rifle',capacity:5,practicalRange:170,weight:3.2,handling:1.00,ammoWeight:.012,ammoPack:20,ammoPrice:75,power:'medium',desc:'Light general-purpose rifle with useful reach. Purchasable once the economy gets moving.'},
  '3006':{id:'3006',name:'.30-06 bolt rifle',capacity:5,practicalRange:250,weight:3.9,handling:.92,ammoWeight:.027,ammoPack:20,ammoPrice:95,power:'large',desc:'Heavier five-round rifle with strong long-range capability on larger game.'}
};
const WEAPON_START = ['22lr','44lever','3006'];
const WEAPON_SHOP = [{id:'223',price:950}];
const CAMP_FOOD_PER_DAY = 1.2; // kg of usable meat per occupied remote-camp day in the prototype.
const ANIMAL_RECOVERY = {
  'Rabbit':{scale:'tiny',meat:[.7,1.5],hideBase:12,scrap:[.05,.18]},
  'Fallow deer':{scale:'medium',meat:[22,42],hideBase:95,scrap:[1.0,3.0]},
  'Red deer':{scale:'large',meat:[42,72],hideBase:145,scrap:[1.5,4.0]},
  'Feral goat':{scale:'medium',meat:[14,30],hideBase:55,scrap:[.7,2.0]},
  'Feral pig':{scale:'medium',meat:[18,42],hideBase:25,scrap:[1.0,3.0]}
};
const POWER_SCORE={small:1,medium:2,large:3};
const SCALE_SCORE={tiny:1,medium:2,large:3};
const LOADOUT_SPARE_OPTIONS=[0,5,10,20];

function dateFromDayKey(key){
  const [y,m,d]=String(key).split('-').map(Number);
  return new Date(y,(m||1)-1,d||1,12,0,0,0);
}
function addDaysKey(key,days){
  const d=dateFromDayKey(key); d.setDate(d.getDate()+days); return localDayKey(d);
}
function diffDayKeys(a,b){
  return Math.round((dateFromDayKey(b)-dateFromDayKey(a))/86400000);
}
function seededWeighted(items,seed){
  const total=items.reduce((s,x)=>s+x.w,0); let r=seededFloat(seed)*total;
  for(const x of items){ r-=x.w; if(r<=0)return x.v; }
  return items[items.length-1].v;
}
function conditionsForSeed(saveId,day){
  const d=dateFromDayKey(day);
  return {
    date:day,
    season:seasonForDate(d),
    weather:seededWeighted([{v:'Clear',w:26},{v:'Overcast',w:24},{v:'Showers',w:18},{v:'Windy',w:18},{v:'Hot',w:14}],`${saveId}|${day}|weather`),
    wind:seededWeighted([{v:'Light',w:35},{v:'Steady',w:40},{v:'Gusty',w:25}],`${saveId}|${day}|wind`)
  };
}
function newConditions(){
  const day=localDayKey();
  return conditionsForSeed(state?.meta?.saveId||'new-game',day);
}
function makeSaveId(){
  if(globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `bt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
}


const SPECIES_DEFS = {
  'Fallow deer':{family:'deer',home:['Home block','Back block'],sexes:['Doe','Yearling','Spiker','Buck'],traits:['Split-tine buck','Wide buck','Dark-antler buck','Old palmated buck'],returnBias:.20},
  'Red deer':{family:'red',home:['Back block'],sexes:['Hind','Stag'],traits:['Heavy stag','Broken-tine stag','Dark-maned stag','Old back-block stag'],returnBias:.18},
  'Feral goat':{family:'goat',home:['Home block','Back block'],sexes:['Nanny','Billy'],traits:['Wide billy','Broken-tip billy','White billy','Old ridge billy'],returnBias:.16},
  'Feral pig':{family:'pig',home:['Home block','Back block'],sexes:['Sow','Boar'],traits:['Scarred boar','Black boar','Old creek boar','Heavy boar'],returnBias:.18},
  'Rabbit':{family:'rabbit',home:['Home block'],sexes:['Rabbit'],traits:['Big rabbit'],returnBias:.08}
};
const ANIMAL_TABLES = {
  'Fallow deer':[
    {key:'doe',w:42,sex:'Doe',quality:'doe'}, {key:'yearling',w:14,sex:'Yearling',quality:'yearling'}, {key:'spiker',w:12,sex:'Spiker',quality:'spiker'},
    {key:'buck',w:24,sex:'Buck',quality:'good',metric:[175,235],unit:'pt'}, {key:'mature buck',w:7,sex:'Buck',quality:'mature',metric:[220,270],unit:'pt'}, {key:'trophy buck',w:1,sex:'Buck',quality:'trophy',metric:[255,310],unit:'pt'}
  ],
  'Red deer':[
    {key:'hind',w:38,sex:'Hind',quality:'hind',autumn:-5}, {key:'young stag',w:22,sex:'Stag',quality:'young',metric:[120,210],unit:'pt'},
    {key:'stag',w:30,sex:'Stag',quality:'good',metric:[210,285],unit:'pt',autumn:2}, {key:'mature stag',w:8,sex:'Stag',quality:'mature',metric:[260,325],unit:'pt',autumn:2}, {key:'trophy stag',w:2,sex:'Stag',quality:'trophy',metric:[300,380],unit:'pt',autumn:1}
  ],
  'Feral goat':[
    {key:'nanny',w:34,sex:'Nanny',quality:'nanny'}, {key:'young billy',w:24,sex:'Billy',quality:'young',metric:[45,78],unit:'cm horn spread'},
    {key:'billy',w:32,sex:'Billy',quality:'good',metric:[72,98],unit:'cm horn spread'}, {key:'wide billy',w:10,sex:'Billy',quality:'trophy',metric:[90,118],unit:'cm horn spread'}
  ],
  'Feral pig':[
    {key:'sow',w:34,sex:'Sow',quality:'sow',metric:[45,110],unit:'kg'}, {key:'young boar',w:22,sex:'Boar',quality:'young',metric:[45,85],unit:'kg'},
    {key:'boar',w:35,sex:'Boar',quality:'good',metric:[75,125],unit:'kg'}, {key:'old boar',w:9,sex:'Boar',quality:'trophy',metric:[110,165],unit:'kg'}
  ],
  'Rabbit':[{key:'rabbit',w:92,sex:'Rabbit',quality:'average',metric:[10,29],unit:'rabbitKg10'},{key:'big rabbit',w:8,sex:'Rabbit',quality:'trophy',metric:[22,39],unit:'rabbitKg10'}]
};

const STORAGE_ADAPTERS = {
  local:{
    get:key=>localStorage.getItem(key),
    set:(key,value)=>localStorage.setItem(key,value),
    remove:key=>localStorage.removeItem(key)
  },
  cloud:{
    get:()=>null,
    set:()=>{throw new Error('Cloud sync is not connected in this prototype.');},
    remove:()=>{}
  }
};
function activeStorageAdapter(){ return STORAGE_ADAPTERS.local; }
function storageGet(key){ return activeStorageAdapter().get(key); }
function storageSet(key,value){ return activeStorageAdapter().set(key,value); }
function storageRemove(key){ return activeStorageAdapter().remove(key); }
function resolvedTimeZone(){ try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'local';}catch(e){return'local';} }
function cloneJson(x){ return JSON.parse(JSON.stringify(x)); }
function conditioningState(s=state){ return s?.progression?.conditioning||null; }
function archiveState(s=state){ s.backend=s.backend||{};s.backend.archive=s.backend.archive||{eventCount:0,claimAuditCount:0,notificationCount:0};return s.backend.archive; }
function ensureBackendState(s){
  s.backend=s.backend||{};
  if(s.backend.contentVersion==null)s.backend.contentVersion=CONTENT_VERSION;
  if(!Array.isArray(s.backend.claimAudit))s.backend.claimAudit=[];
  if(!Array.isArray(s.backend.eventQueue))s.backend.eventQueue=[];
  s.backend.archive=s.backend.archive||{eventCount:0,claimAuditCount:0,notificationCount:0};
  s.backend.featureFlags=s.backend.featureFlags||{};for(const [k,v] of Object.entries(DEFAULT_FEATURE_FLAGS))if(s.backend.featureFlags[k]==null)s.backend.featureFlags[k]=v;
  s.backend.notifications=s.backend.notifications||{enabled:false,queue:[]};if(!Array.isArray(s.backend.notifications.queue))s.backend.notifications.queue=[];
  s.backend.storage=s.backend.storage||{provider:'local',lastAtomicCommitAt:null,lastKnownGoodAt:null};
  if(!('selfTests'in s.backend))s.backend.selfTests=null;
  s.progression=s.progression||{};
  if(!s.progression.conditioning)s.progression.conditioning={baselineAverage:null,baselineSource:null,bestAverage:null,permanentTier:0,lastEvaluatedDay:null,momentum:{tier:0,delta:0,currentAverage:null,previousAverage:null,expiresDay:null},awards:[]};
  const c=s.progression.conditioning;if(!Array.isArray(c.awards))c.awards=[];c.momentum=c.momentum||{tier:0,delta:0,currentAverage:null,previousAverage:null,expiresDay:null};if(c.permanentTier==null)c.permanentTier=0;if(!('baselineAverage'in c))c.baselineAverage=null;if(!('bestAverage'in c))c.bestAverage=null;
  s.world=s.world||{entityVersion:1,animals:{},entityIndex:{locations:[],fieldGear:[],trophies:[]}};s.world.animals=s.world.animals||{};s.world.entityIndex=s.world.entityIndex||{locations:[],fieldGear:[],trophies:[]};
  s.meta=s.meta||{};s.meta.timeZone=s.meta.timeZone||resolvedTimeZone();s.meta.contentVersion=Number(s.meta.contentVersion||CONTENT_VERSION);
  return s;
}

function freshStore(name='Main Camp'){
  return {name,active:true,foodKg:0,meatKg:0,scrapsKg:1.0,yabbies:0,hides:[],ammo:{'22lr':75,'44lever':50,'223':0,'3006':40},lastOccupiedDay:null};
}
function ensureV6State(s){
  ensureBackendState(s);
  s.armoury=s.armoury||{};
  if(!Array.isArray(s.armoury.owned))s.armoury.owned=[...WEAPON_START];
  for(const id of WEAPON_START)if(!s.armoury.owned.includes(id))s.armoury.owned.push(id);
  s.armoury.ammo=s.armoury.ammo||{'22lr':75,'44lever':50,'223':0,'3006':40};
  for(const id of Object.keys(WEAPONS))if(!Number.isFinite(Number(s.armoury.ammo[id])))s.armoury.ammo[id]=id==='223'?0:(id==='22lr'?75:id==='44lever'?50:40);
  s.campStores=s.campStores||{main:freshStore('Main Camp')};
  s.campStores.main=s.campStores.main||freshStore('Main Camp');
  s.campStores.main.name='Main Camp';s.campStores.main.active=true;s.campStores.main.hides=Array.isArray(s.campStores.main.hides)?s.campStores.main.hides:[];
  s.campStores.main.ammo=s.campStores.main.ammo||cloneJson(s.armoury.ammo);
  for(const id of Object.keys(WEAPONS))if(!Number.isFinite(Number(s.campStores.main.ammo[id])))s.campStores.main.ammo[id]=Number(s.armoury.ammo[id]||0);
  s.expedition=s.expedition||{};
  if(!('active'in s.expedition))s.expedition.active=true; // migrate ongoing V0.5 hunts without blocking today's progress.
  s.expedition.baseId=s.expedition.baseId||'main';
  s.expedition.weaponId=s.expedition.weaponId&&WEAPONS[s.expedition.weaponId]?s.expedition.weaponId:'3006';
  const w=WEAPONS[s.expedition.weaponId];
  if(!Number.isFinite(Number(s.expedition.loaded)))s.expedition.loaded=w.capacity;
  if(!Number.isFinite(Number(s.expedition.spare)))s.expedition.spare=5;
  if(!Number.isFinite(Number(s.expedition.fatigue)))s.expedition.fatigue=0;
  if(!Number.isFinite(Number(s.expedition.distanceFromBase)))s.expedition.distanceFromBase=0;
  if(!Number.isFinite(Number(s.expedition.stepsSinceBase)))s.expedition.stepsSinceBase=0;
  if(!Number.isFinite(Number(s.expedition.totalCarriedKg)))s.expedition.totalCarriedKg=0;
  s.expedition.startedDay=s.expedition.startedDay||s.meta?.currentDay||localDayKey();
  s.expedition.binoculars=s.expedition.binoculars!==false;
  s.expedition.haul=s.expedition.haul||{meatKg:0,scrapsKg:0,yabbies:0,hides:[]};
  s.expedition.haul.hides=Array.isArray(s.expedition.haul.hides)?s.expedition.haul.hides:[];
  for(const k of ['meatKg','scrapsKg','yabbies'])if(!Number.isFinite(Number(s.expedition.haul[k])))s.expedition.haul[k]=0;
  s.glassing=s.glassing||{lastResult:null,lastDay:null};
  s.backend.featureFlags.loadouts=true;s.backend.featureFlags.camps=true;s.backend.featureFlags.glassing=true;s.backend.featureFlags.recoveryEconomy=true;s.backend.featureFlags.trapPressure=true;
  for(const loc of s.locations||[]){
    if(loc.camp&&!loc.campState)loc.campState={active:true,foodKg:0,lastOccupiedDay:null};
    if(loc.campState){loc.camp=true;loc.campState.active=loc.campState.active!==false;loc.campState.foodKg=Number(loc.campState.foodKg||0);const key=`camp:${loc.id}`;if(!s.campStores[key])s.campStores[key]={...freshStore(loc.name),foodKg:Number(loc.campState.foodKg||0),ammo:{'22lr':0,'44lever':0,'223':0,'3006':0},scrapsKg:0};}
    if(loc.trapPressure==null)loc.trapPressure=0;
    if(loc.trapSets==null)loc.trapSets=0;
  }
  return s;
}
function ensureEntityIds(s){
  ensureBackendState(s);
  for(const l of s.locations||[]){l.id=l.id||uid('loc');l.entityId=l.entityId||l.id;l.baseReturnDistance=Number(l.baseReturnDistance||l.returnDistance||randInt(1400,3200));l.returnDistance=applyConditioningCost(l.baseReturnDistance);}
  for(const c of s.cameras||[]){c.id=c.id||uid('cam');c.entityId=c.entityId||c.id;}
  for(const n of s.nets||[]){n.id=n.id||uid('net');n.entityId=n.entityId||n.id;}
  for(const o of s.objectives||[]){o.id=o.id||uid('obj');o.entityId=o.entityId||o.id;}
  for(const t of s.trophies||[]){t.id=t.id||uid('t');t.entityId=t.entityId||t.id;}
  for(const a of s.knownAnimals||[]){
    a.id=a.id||uid('known');a.entityId=a.entityId||a.id;a.firstSeenDate=a.firstSeenDate||s.meta.currentDay||localDayKey();a.lastSeenDate=a.lastSeenDate||a.firstSeenDate;
    a.homeArea=a.homeArea||s.currentRegion||'Home block';a.wariness=Number.isFinite(Number(a.wariness))?Number(a.wariness):randInt(20,55);a.history=Array.isArray(a.history)?a.history:[];
    s.world.animals[a.entityId]=deepMerge({entityId:a.entityId,species:a.species,sex:a.sex,quality:a.quality,status:a.status||'At large',homeArea:a.homeArea,wariness:a.wariness,firstSeenDate:a.firstSeenDate,lastSeenDate:a.lastSeenDate,distinctiveTrait:a.distinctiveTrait||a.nickname||null,history:a.history},s.world.animals[a.entityId]||{});
  }
  s.world.entityIndex.locations=(s.locations||[]).map(x=>x.entityId);
  s.world.entityIndex.fieldGear=[...(s.cameras||[]),...(s.nets||[])].map(x=>x.entityId);
  s.world.entityIndex.trophies=(s.trophies||[]).map(x=>x.entityId);
  return s;
}
function migrateContentState(s){
  ensureBackendState(s);ensureEntityIds(s);
  if(Number(s.meta.contentVersion||0)<CONTENT_VERSION){
    s.meta.contentVersion=CONTENT_VERSION;
    addEventTo(s,'Content tables updated',`BushTrack content data moved to content version ${CONTENT_VERSION} without resetting the world.`,'system');
  }
  return s;
}
function scheduleWorldEvent(type,dueDay,payload={},uniqueKey=null){
  ensureBackendState(state);if(!state.backend.featureFlags.worldQueue)return null;
  if(uniqueKey&&state.backend.eventQueue.some(e=>e.uniqueKey===uniqueKey&&!e.processedAt))return null;
  const e={id:uid('queue'),type,dueDay,payload:cloneJson(payload),uniqueKey,createdAt:new Date().toISOString(),processedAt:null};
  state.backend.eventQueue.push(e);return e;
}
function queueNotification(title,body,type='world'){
  ensureBackendState(state);const n={id:uid('note'),title,body,type,createdAt:new Date().toISOString(),delivered:false};
  state.backend.notifications.queue.push(n);
  if(state.backend.featureFlags.notifications&&state.backend.notifications.enabled&&'Notification'in window&&Notification.permission==='granted'){
    try{new Notification(title,{body});n.delivered=true;}catch(e){}
  }
}
function processWorldEventQueue(day=localDayKey()){
  ensureBackendState(state);if(!state.backend.featureFlags.worldQueue)return;
  for(const e of state.backend.eventQueue){
    if(e.processedAt||!e.dueDay||e.dueDay>day)continue;
    if(e.type==='cameraReady'){
      const cam=state.cameras.find(c=>c.id===e.payload.cameraId);if(cam){cam.ready=true;queueNotification('Trail camera ready',`Worth walking back to ${getLoc(cam.locationId)?.name||'the camera'}.`,'camera');}
    }else if(e.type==='netReady'){
      const net=state.nets.find(n=>n.id===e.payload.netId);if(net){net.ready=true;queueNotification('Yabby net ready',`The net at ${getLoc(net.locationId)?.name||'the water'} is ready to check.`,'net');}
    }else if(e.type==='objectiveExpire'){
      const o=state.objectives.find(o=>o.id===e.payload.objectiveId);if(o&&!o.complete){o.complete=true;addEvent('Sign went cold',`${o.title} faded before you got back to it.`);}
    }else if(e.type==='pendingExpire'){
      if(state.pendingEncounter?.id===e.payload.pendingId){addEvent('Opportunity moved on',`${state.pendingEncounter.species||'The animal'} sign went cold.`,'world');state.pendingEncounter=null;}
    }
    e.processedAt=new Date().toISOString();
  }
}
function dailyCredited(day,s=state){ return Number(s?.stepLedger?.[day]?.credited||0); }
function weekDaysEnding(endDay){ return Array.from({length:7},(_,i)=>addDaysKey(endDay,-6+i)); }
function weeklyAverage(endDay,{requireRecorded=true,s=state}={}){
  const days=weekDaysEnding(endDay);const vals=[];
  for(const day of days){const l=s?.stepLedger?.[day];if(requireRecorded&&!l)return null;vals.push(Number(l?.credited||0));}
  return Math.round(vals.reduce((a,b)=>a+b,0)/7);
}
function conditioningPerks(tier=conditioningState()?.permanentTier||0){
  tier=clamp(Number(tier||0),0,CONDITIONING_CONFIG.maxTier);
  return {routeReduction:Math.min(.12,tier*.02),discoveryBonus:tier*.0125,signDays:Math.floor(tier/2),label:tier?`Trail Conditioning ${['I','II','III','IV','V','VI'][tier-1]}`:'Unconditioned'};
}
function applyConditioningCost(steps){ return Math.max(1,Math.round(Number(steps||0)*(1-conditioningPerks().routeReduction))); }
function conditioningXpMultiplier(){const c=conditioningState();return 1+Number(c?.momentum?.tier||0)*.05;}
function awardConditioningTier(newTier,currentAverage){
  const c=conditioningState();const old=Number(c.permanentTier||0);if(newTier<=old)return;
  for(let t=old+1;t<=newTier;t++){
    c.awards.push({id:uid('cond'),tier:t,average:currentAverage,date:localDayKey(),at:new Date().toISOString()});
    addEvent('Trail conditioning improved',`Permanent Conditioning ${['I','II','III','IV','V','VI'][t-1]} earned at a ${fmt(currentAverage)}-step weekly average. Stalking and return walks are now ${Math.round(conditioningPerks(t).routeReduction*100)}% shorter.`,'progression');
    queueNotification('Trail conditioning improved',`Permanent Conditioning ${['I','II','III','IV','V','VI'][t-1]} earned.`,'conditioning');
  }
  c.permanentTier=newTier;
}
function evaluateConditioning(today=localDayKey()){
  ensureBackendState(state);const c=conditioningState();if(!state.backend.featureFlags.conditioning)return;
  if(c.lastEvaluatedDay===today)return;
  const currentEnd=addDaysKey(today,-1);const currentAvg=weeklyAverage(currentEnd,{requireRecorded:true});
  const previousEnd=addDaysKey(currentEnd,-7);const previousAvg=weeklyAverage(previousEnd,{requireRecorded:true});
  if(c.baselineAverage==null){
    if(previousAvg!=null){c.baselineAverage=previousAvg;c.baselineSource='first complete previous week';c.bestAverage=previousAvg;addEvent('Conditioning baseline set',`First complete baseline week: ${fmt(previousAvg)} steps/day.`,'progression');}
    else if(currentAvg!=null&&!c.bestAverage){c.bestAverage=currentAvg;}
  }
  if(currentAvg!=null){
    c.bestAverage=Math.max(Number(c.bestAverage||0),currentAvg);
    if(c.baselineAverage!=null){
      const tier=clamp(Math.floor((c.bestAverage-c.baselineAverage)/CONDITIONING_CONFIG.milestoneStep),0,CONDITIONING_CONFIG.maxTier);
      awardConditioningTier(tier,currentAvg);
    }
  }
  if(currentAvg!=null&&previousAvg!=null){
    const d=currentAvg-previousAvg;const tier=d>=1000?2:d>=500?1:0;
    c.momentum={tier,delta:d,currentAverage:currentAvg,previousAverage:previousAvg,expiresDay:addDaysKey(today,7)};
    if(tier>0)addEvent('Weekly momentum',`Your completed 7-day average is ${fmt(currentAvg)} — ${fmt(d)} steps/day above the previous week. ${tier===2?'Strong':'Good'} momentum is active for the next week.`,'progression');
  }else if(c.momentum?.expiresDay&&today>c.momentum.expiresDay)c.momentum={tier:0,delta:0,currentAverage:currentAvg,previousAverage:previousAvg,expiresDay:null};
  c.lastEvaluatedDay=today;
}
function setConditioningBaseline(value,source='manual Health 7-day average'){
  ensureBackendState(state);const v=Math.round(Number(value));if(!Number.isFinite(v)||v<500||v>50000)return false;
  const c=conditioningState();c.baselineAverage=v;c.baselineSource=source;c.bestAverage=Math.max(Number(c.bestAverage||0),v);c.permanentTier=clamp(Math.floor((c.bestAverage-v)/CONDITIONING_CONFIG.milestoneStep),0,CONDITIONING_CONFIG.maxTier);c.lastEvaluatedDay=null;
  for(const loc of state.locations||[])loc.returnDistance=applyConditioningCost(loc.baseReturnDistance||loc.returnDistance);addEvent('Conditioning baseline set',`${fmt(v)} steps/day is now the baseline used for permanent walking milestones.`,'progression');return true;
}
function compactHistories(s=state){
  ensureBackendState(s);const a=archiveState(s);
  if((s.events||[]).length>HISTORY_LIMITS.events){const removed=s.events.splice(HISTORY_LIMITS.events);a.eventCount+=removed.length;}
  if(s.backend.claimAudit.length>HISTORY_LIMITS.claimAudit){const removed=s.backend.claimAudit.splice(0,s.backend.claimAudit.length-HISTORY_LIMITS.claimAudit);a.claimAuditCount+=removed.length;}
  if(s.backend.notifications.queue.length>HISTORY_LIMITS.notifications){const removed=s.backend.notifications.queue.splice(0,s.backend.notifications.queue.length-HISTORY_LIMITS.notifications);a.notificationCount+=removed.length;}
  if(s.backend.eventQueue.length>HISTORY_LIMITS.eventQueue)s.backend.eventQueue=s.backend.eventQueue.slice(-HISTORY_LIMITS.eventQueue);
}
function runSelfTests(){
  const results=[];const test=(name,fn)=>{try{results.push({name,ok:!!fn()});}catch(e){results.push({name,ok:false,error:String(e.message||e)});}};
  test('Day math survives DST-shaped calendar gaps',()=>diffDayKeys('2026-10-03','2026-10-05')===2);
  test('500-step conditioning milestone',()=>Math.floor((5000-4500)/500)===1);
  test('1000-step momentum tier',()=>((x)=>x>=1000?2:x>=500?1:0)(1000)===2);
  test('Route reduction stays capped',()=>conditioningPerks(6).routeReduction<=.12);
  test('Checksum changes with save data',()=>checksumString('abc')!==checksumString('abd'));
  test('Lever loadout keeps ten-round capacity',()=>WEAPONS['44lever'].capacity===10);
  test('Thirty-06 field magazine is five in prototype',()=>WEAPONS['3006'].capacity===5);
  test('Rabbit overkill is recognised',()=>weaponSuitability({species:'Rabbit'},WEAPONS['44lever']).damage==='catastrophic');
  test('Remote camp food rate is positive',()=>CAMP_FOOD_PER_DAY>0);
  test('Loadout weight resolves to a finite number',()=>Number.isFinite(loadoutWeight()));
  const out={at:new Date().toISOString(),passed:results.filter(x=>x.ok).length,total:results.length,results};state.backend.selfTests=out;return out;
}

function initialState(){
  const firstDist=10000;
  const saveId=makeSaveId(), day=localDayKey(), now=new Date().toISOString();
  return {
    version:6,schemaVersion:SCHEMA_VERSION,
    meta:{saveId,currentDay:day,createdAt:now,lastSavedAt:null,lastBackupAt:null,lastBackupReason:null,randomCounter:0,lastVersion:APP_VERSION,contentVersion:CONTENT_VERSION,timeZone:resolvedTimeZone(),storageHealthy:true,lastDayProcessedAt:now},
    backend:{contentVersion:CONTENT_VERSION,claimAudit:[],eventQueue:[],archive:{eventCount:0,claimAuditCount:0,notificationCount:0},featureFlags:{...DEFAULT_FEATURE_FLAGS},notifications:{enabled:false,queue:[]},storage:{provider:'local',lastAtomicCommitAt:null,lastKnownGoodAt:null},selfTests:null},
    progression:{conditioning:{baselineAverage:null,baselineSource:null,bestAverage:null,permanentTier:0,lastEvaluatedDay:null,momentum:{tier:0,delta:0,currentAverage:null,previousAverage:null,expiresDay:null},awards:[]}},
    world:{entityVersion:2,animals:{},entityIndex:{locations:[],fieldGear:[],trophies:[]}},
    armoury:{owned:[...WEAPON_START],ammo:{'22lr':75,'44lever':50,'223':0,'3006':40}},
    campStores:{main:freshStore('Main Camp')},
    expedition:{active:true,baseId:'main',weaponId:'3006',loaded:5,spare:5,fatigue:0,distanceFromBase:0,stepsSinceBase:0,totalCarriedKg:0,startedDay:day,binoculars:true,haul:{meatKg:0,scrapsKg:0,yabbies:0,hides:[]}},
    glassing:{lastResult:null,lastDay:null},
    xp:0,cash:0,totalSteps:0,claimCount:0,lastClaimDate:null,stepCredit:0,stepLedger:{},
    currentRegion:'Home block',conditions:conditionsForSeed(saveId,day),
    active:{kind:'hunt',id:null},
    hunt:{id:uid('hunt'),signFamily:'deer',title:'Fresh deer sign',startDistance:firstDist,remaining:firstDist,cumulative:0,called:false,stage:'track',lastProgressDate:null,knownAnimalId:null},
    river:{discovered:false,startDistance:8500,remaining:8500,ready:false},
    objectives:[],pendingEncounter:null,currentEncounter:null,
    locations:[],knownAnimals:[],cameras:[],nets:[],
    inventory:{Spinnerbait:3,'Surface lure':2,'Soft plastic':5,Bait:8,trailCameras:1,yabbyNets:1},
    gear:{boots:0,binoculars:0,scope:0,rod:0,pack:0,call:0,uteAccess:0},
    knowledge:{'Fallow deer':0,'Red deer':0,'Feral goat':0,'Feral pig':0,'Rabbit':0,'Australian bass':0,'Eel-tailed catfish':0,'Golden perch':0,'Carp':0},
    trophies:[],fishSession:null,pendingFish:null,
    events:[{id:uid('event'),type:'world',title:'Fresh sign',text:'Fresh deer tracks cut across the track and disappear into broken timber.',date:displayDay(),at:now}]
  };
}

function deepMerge(base, incoming){
  if(!incoming || typeof incoming!=='object') return base;
  const out={...base};
  for(const [k,v] of Object.entries(incoming)){
    if(v && typeof v==='object' && !Array.isArray(v) && base[k] && typeof base[k]==='object' && !Array.isArray(base[k])) out[k]=deepMerge(base[k],v);
    else out[k]=v;
  }
  return out;
}

function normaliseEvents(events){
  const now=new Date().toISOString();
  return (Array.isArray(events)?events:[]).map((e,i)=>({
    id:e.id||uid('event'),type:e.type||'legacy',title:e.title||'Journal entry',text:e.text||'',date:e.date==='Today'?displayDay():e.date||displayDay(),at:e.at||now
  }));
}
function upgradeLegacy(old,sourceKey){
  const fresh=initialState();
  let s=deepMerge(fresh,old||{});
  s.version=6; s.schemaVersion=SCHEMA_VERSION;
  s.meta=deepMerge(fresh.meta,old?.meta||{});
  s.meta.saveId=s.meta.saveId||makeSaveId();
  s.meta.lastVersion=APP_VERSION;s.meta.contentVersion=CONTENT_VERSION;s.meta.timeZone=s.meta.timeZone||resolvedTimeZone();
  s.meta.currentDay=old?.meta?.currentDay||old?.conditions?.date||localDayKey();
  s.meta.randomCounter=Number(s.meta.randomCounter||0);
  s.stepLedger=(old?.stepLedger&&typeof old.stepLedger==='object')?old.stepLedger:{};
  s.events=normaliseEvents(old?.events?.length?old.events:fresh.events);
  s.hunt=deepMerge(fresh.hunt,old?.hunt||{});
  if(!('lastProgressDate' in s.hunt))s.hunt.lastProgressDate=null;
  s.locations=(s.locations||[]).map(l=>({...l,discoveredDate:l.discoveredDate||s.meta.currentDay}));
  s.cameras=(s.cameras||[]).map(c=>({...c,placedDate:c.placedDate||s.lastClaimDate||s.meta.currentDay}));
  s.nets=(s.nets||[]).map(n=>({...n,placedDate:n.placedDate||s.lastClaimDate||s.meta.currentDay}));
  s.objectives=(s.objectives||[]).map(o=>({...o,createdDate:o.createdDate||s.lastClaimDate||s.meta.currentDay}));
  ensureV6State(s);ensureEntityIds(s);
  addEventTo(s,'V0.6 upgrade',`Save upgraded from ${sourceKey.replace('bushtrack-','').toUpperCase()}. Loadouts, camps, glassing and recovery economy are now active.`,'system');
  return s;
}
function validateState(s){
  if(!s||typeof s!=='object')return false;
  if(!Number.isFinite(Number(s.xp))||!Number.isFinite(Number(s.cash)))return false;
  if(!s.active||typeof s.active!=='object'||!s.hunt||typeof s.hunt!=='object')return false;
  if(!Array.isArray(s.events)||!Array.isArray(s.locations)||!Array.isArray(s.trophies))return false;
  return true;
}
function checksumString(str){
  let h=2166136261>>>0;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16).padStart(8,'0');
}
function readBackups(){
  try{
    const arr=JSON.parse(storageGet(BACKUP_KEY)||'[]');
    return Array.isArray(arr)?arr.filter(b=>b&&b.data&&b.checksum===checksumString(JSON.stringify(b.data))&&validateState(b.data)):[];
  }catch(e){return[];}
}
function recoverFromBackups(){
  const good=readBackups();
  if(!good.length)return null;
  runtimeStorageError='Main save was unreadable. BushTrack recovered the newest good automatic backup.';
  return migrateContentState(ensureEntityIds(ensureV6State(deepMerge(initialState(),good[0].data))));
}
function loadState(){
  try{
    const raw=storageGet(STORAGE_KEY);
    if(raw){
      try{
        const parsed=JSON.parse(raw);
        if(validateState(parsed)){
          const upgraded=Number(parsed.schemaVersion||parsed.version||0)<SCHEMA_VERSION?upgradeLegacy(parsed,STORAGE_KEY):deepMerge(initialState(),parsed);
          upgraded.schemaVersion=SCHEMA_VERSION;upgraded.version=6;upgraded.meta.lastVersion=APP_VERSION;
          return migrateContentState(ensureEntityIds(ensureV6State(upgraded)));
        }
      }catch(e){console.warn('Current save parse failed',e);}
      const recovered=recoverFromBackups();
      if(recovered)return recovered;
    }
    for(const key of LEGACY_KEYS){
      const oldRaw=storageGet(key);
      if(oldRaw){
        try{
          const migrated=upgradeLegacy(JSON.parse(oldRaw),key);
          storageSet(STORAGE_KEY,JSON.stringify(migrated));
          return migrated;
        }catch(e){console.warn('Legacy migration failed',key,e);}
      }
    }
  }catch(e){runtimeStorageError=`Storage read failed: ${e.message||e}`;}
  return initialState();
}

state=loadState();
ensureV6State(state);ensureEntityIds(state);processDayRollover();evaluateConditioning();
if(!readBackups().length)createBackup('Initial V0.6 safety backup');
let aimTimer=null,aimPos=0,aimDir=1;
let fightTimer=null,fightPos=0,fightDir=1,fightGood=0,fightBad=0;
let selectedLure='Spinnerbait';

function safeSetItem(key,value){
  try{storageSet(key,value);runtimeStorageError=null;if(state?.meta)state.meta.storageHealthy=true;return true;}
  catch(e){runtimeStorageError=`BushTrack could not save to Safari storage: ${e.message||e}`;if(state?.meta)state.meta.storageHealthy=false;return false;}
}
function save(){
  if(!state)return false;
  ensureBackendState(state);ensureEntityIds(state);compactHistories(state);
  state.version=6;state.schemaVersion=SCHEMA_VERSION;
  state.meta=state.meta||{};
  state.meta.lastSavedAt=new Date().toISOString();state.meta.lastVersion=APP_VERSION;state.meta.contentVersion=CONTENT_VERSION;state.meta.timeZone=state.meta.timeZone||resolvedTimeZone();
  const raw=JSON.stringify(state), staging={checksum:checksumString(raw),savedAt:state.meta.lastSavedAt,data:state};
  try{
    safeSetItem(STAGING_KEY,JSON.stringify(staging));
    const verify=JSON.parse(storageGet(STAGING_KEY)||'null');
    if(!verify||verify.checksum!==checksumString(JSON.stringify(verify.data))||!validateState(verify.data))throw new Error('Staging verification failed');
    const previous=storageGet(STORAGE_KEY);if(previous){safeSetItem(LAST_GOOD_KEY,previous);state.backend.storage.lastKnownGoodAt=state.meta.lastSavedAt;}
    const ok=safeSetItem(STORAGE_KEY,raw);if(!ok)return false;
    storageRemove(STAGING_KEY);state.backend.storage.lastAtomicCommitAt=state.meta.lastSavedAt;lastRuntimeSaveAt=state.meta.lastSavedAt;
    updateStorageWarning();return true;
  }catch(e){runtimeStorageError=`Atomic save failed: ${e.message||e}`;updateStorageWarning();return false;}
}
function restoreLastKnownGood(){
  const raw=storageGet(LAST_GOOD_KEY);if(!raw){alert('No last-known-good save is stored yet.');return;}
  try{const parsed=JSON.parse(raw);if(!validateState(parsed))throw new Error('Stored fallback failed validation');createBackup('Before last-known-good restore');state=migrateContentState(ensureEntityIds(ensureV6State(deepMerge(initialState(),parsed))));addEvent('Last-known-good restored','BushTrack restored the previous atomic save snapshot.','system');save();render();}
  catch(e){alert(`Could not restore the last-known-good save: ${e.message||e}`);}
}
function addEventTo(s,title,text,type='game'){
  s.events=s.events||[];
  s.events.unshift({id:uid('event'),type,title,text,date:displayDay(),at:new Date().toISOString()});
}
function addEvent(title,text,type='game'){ addEventTo(state,title,text,type); }

function createBackup(reason='Automatic backup'){
  if(!state||!validateState(state))return false;
  try{
    const snapshot=JSON.parse(JSON.stringify(state));
    const envelope={kind:'BushTrackBackup',formatVersion:1,schemaVersion:SCHEMA_VERSION,contentVersion:CONTENT_VERSION,appVersion:APP_VERSION,createdAt:new Date().toISOString(),reason,saveId:state.meta?.saveId||'',timeZone:state.meta?.timeZone||resolvedTimeZone(),data:snapshot};
    envelope.checksum=checksumString(JSON.stringify(envelope.data));
    const backups=readBackups();
    backups.unshift(envelope);
    const ok=safeSetItem(BACKUP_KEY,JSON.stringify(backups.slice(0,MAX_BACKUPS)));
    if(ok){
      state.meta.lastBackupAt=envelope.createdAt;state.meta.lastBackupReason=reason;
    }
    return ok;
  }catch(e){runtimeStorageError=`Automatic backup failed: ${e.message||e}`;updateStorageWarning();return false;}
}
function latestBackup(){return readBackups()[0]||null;}
function formatDateTime(iso){
  if(!iso)return'Never';
  try{return new Date(iso).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});}catch(e){return String(iso);}
}
function processDayRollover(){
  if(!state||!state.meta)return;
  const today=localDayKey(), from=state.meta.currentDay||state.conditions?.date||today;
  if(from===today){
    state.conditions=conditionsForSeed(state.meta.saveId,today);
    matureFieldGear(today);processWorldEventQueue(today);expireOldObjectives(today);evaluateConditioning(today);
    return;
  }
  let days=diffDayKeys(from,today);
  if(days<0){state.meta.currentDay=today;state.conditions=conditionsForSeed(state.meta.saveId,today);return;}
  const capped=Math.min(days,370);
  let previous=from;
  for(let i=1;i<=capped;i++){
    const day=addDaysKey(from,i);
    const prevLedger=state.stepLedger?.[previous];if(prevLedger)prevLedger.finalized=true;
    const cond=conditionsForSeed(state.meta.saveId,day);
    // Only give a helpful overnight shift if you actually worked this hunt the previous day.
    if(state.hunt?.stage==='track'&&state.hunt.lastProgressDate===previous&&state.hunt.remaining>300){
      const maxShift=Math.max(0,Math.min(state.hunt.remaining-300,Math.round(state.hunt.remaining*.18)));
      if(maxShift>0){
        const minShift=Math.min(maxShift,Math.max(120,Math.round(state.hunt.remaining*.04)));
        const seed=`${state.meta.saveId}|${day}|overnight|${state.hunt.id}`;
        const shift=minShift+Math.floor(seededFloat(seed)*(Math.max(0,maxShift-minShift)+1));
        state.hunt.remaining=Math.max(300,state.hunt.remaining-shift);
        addEvent('Overnight movement',`The animals shifted through the country overnight. The intercept is now about ${fmt(state.hunt.remaining)} steps — ${fmt(shift)} closer than when you left it.`,'world');
      }
    }
    for(const loc of state.locations||[]){
      if(loc.fishery){
        const decay=cond.weather==='Showers'?.12:.05;
        loc.pressure=Math.max(0,(loc.pressure||0)-decay);
      }
      if(loc.actions?.includes('net'))loc.trapPressure=Math.max(0,Number(loc.trapPressure||0)-(cond.weather==='Showers'?.12:.075));
    }
    // Remote camps only stay viable while the player has food there.
    const baseKey=state.expedition?.baseId||'main';
    if(baseKey!=='main'){
      const camp=state.campStores?.[baseKey],loc=baseLocationForKey(baseKey);
      if(camp){
        let need=CAMP_FOOD_PER_DAY;const meat=Math.min(need,Number(camp.meatKg||0));camp.meatKg-=meat;need-=meat;
        if(need>0&&Number(camp.yabbies||0)>0){const yabNeeded=Math.ceil(need/.12),used=Math.min(yabNeeded,Number(camp.yabbies||0));camp.yabbies-=used;need=Math.max(0,need-used*.12);}
        if(need>0){camp.active=false;if(loc?.campState)loc.campState.active=false;state.expedition.baseId='main';state.expedition.active=false;state.expedition.distanceFromBase=0;addEvent('Remote camp ran out of food',`${loc?.name||'The remote camp'} went short of meat and is no longer usable as a base. You are back operating from Main Camp until it is resupplied.`,'world');}
        else{camp.lastOccupiedDay=day;if(loc?.campState){loc.campState.active=true;loc.campState.foodKg=Number(camp.meatKg||0);}}
      }
    }
    state.meta.currentDay=day;state.conditions=cond;
    matureFieldGear(day);processWorldEventQueue(day);expireOldObjectives(day);evaluateConditioning(day);
    if(state.pendingEncounter?.createdDate){
      const queued=state.backend?.eventQueue?.some(e=>!e.processedAt&&e.type==='pendingExpire'&&e.payload?.pendingId===state.pendingEncounter.id);
      const age=diffDayKeys(state.pendingEncounter.createdDate,day);
      if(!queued&&age>1+conditioningPerks().signDays){addEvent('Opportunity moved on',`${state.pendingEncounter.species||'The animal'} sign you had noticed has gone cold.`,'world');state.pendingEncounter=null;}
    }
    previous=day;
  }
  if(days>capped){
    for(const loc of state.locations||[])if(loc.fishery)loc.pressure=0;
    matureFieldGear(today);expireOldObjectives(today);
    state.meta.currentDay=today;state.conditions=conditionsForSeed(state.meta.saveId,today);processWorldEventQueue(today);evaluateConditioning(today);
    addEvent('Back in the field',`${days} days passed since BushTrack was last opened. Permanent places stayed mapped; temporary sign may have moved on.`,'system');
  }
  state.meta.lastDayProcessedAt=new Date().toISOString();
  createBackup('Automatic day-rollover backup');
  save();
}
function updateStorageWarning(){
  const el=$('#storageWarning');
  if(!el)return;
  const bad=runtimeStorageError||state?.meta?.storageHealthy===false;
  el.classList.toggle('hidden',!bad);
  if(bad)$('#storageWarningText').textContent=runtimeStorageError||'Safari storage reported a problem. Export a backup before continuing.';
}
function testStorage(){
  try{
    const k='__bushtrack_probe__';storageSet(k,'1');storageRemove(k);
    if(state?.meta)state.meta.storageHealthy=true;runtimeStorageError=null;return true;
  }catch(e){
    runtimeStorageError=`Safari storage test failed: ${e.message||e}`;if(state?.meta)state.meta.storageHealthy=false;return false;
  }
}
function saveExportEnvelope(){
  const data=JSON.parse(JSON.stringify(state));
  const envelope={kind:'BushTrackSave',portable:true,formatVersion:1,schemaVersion:SCHEMA_VERSION,contentVersion:CONTENT_VERSION,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),saveId:state.meta.saveId,timeZone:state.meta?.timeZone||resolvedTimeZone(),data};
  envelope.checksum=checksumString(JSON.stringify(data));
  return envelope;
}
async function shareJsonFile(envelope,filename,title){
  const text=JSON.stringify(envelope,null,2);
  const blob=new Blob([text],{type:'application/json'});
  try{
    const file=new File([blob],filename,{type:'application/json'});
    if(navigator.canShare?.({files:[file]})&&navigator.share){
      await navigator.share({files:[file],title});
      return;
    }
  }catch(e){if(e?.name==='AbortError')return;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function exportSave(){
  createBackup('Manual backup before export');
  const stamp=localDayKey();
  await shareJsonFile(saveExportEnvelope(),`BushTrack-save-${stamp}.json`,'BushTrack save backup');
  addEvent('Save exported','A BushTrack backup was prepared for Files/iCloud.','system');render();
}
async function exportDiagnostics(){
  const today=localDayKey(),ledger=state.stepLedger?.[today]||null;
  const diag={
    kind:'BushTrackDiagnostics',generatedAt:new Date().toISOString(),appVersion:APP_VERSION,schemaVersion:SCHEMA_VERSION,
    saveId:state.meta?.saveId,storageHealthy:!runtimeStorageError&&state.meta?.storageHealthy!==false,storageError:runtimeStorageError,
    lastSavedAt:state.meta?.lastSavedAt,lastBackupAt:state.meta?.lastBackupAt,lastBackupReason:state.meta?.lastBackupReason,
    currentDay:state.meta?.currentDay,conditions:state.conditions,lastClaimDate:state.lastClaimDate,todayLedger:ledger,
    totalSteps:state.totalSteps,xp:state.xp,level:level(),eventCount:state.events?.length||0,archivedEvents:state.backend?.archive?.eventCount||0,locationCount:state.locations?.length||0,
    conditioning:state.progression?.conditioning,claimAuditTail:(state.backend?.claimAudit||[]).slice(-20),eventQueue:(state.backend?.eventQueue||[]).filter(e=>!e.processedAt),featureFlags:state.backend?.featureFlags,selfTests:state.backend?.selfTests,
    active:state.active,hunt:state.hunt,currentEncounter:state.currentEncounter,
    userAgent:navigator.userAgent,serviceWorkerControlled:!!navigator.serviceWorker?.controller
  };
  await shareJsonFile(diag,`BushTrack-diagnostics-${localDayKey()}.json`,'BushTrack diagnostics');
}
function validateImportEnvelope(envelope){
  if(!envelope||envelope.kind!=='BushTrackSave'||!envelope.data)return{ok:false,error:'That is not a BushTrack save export.'};
  if(envelope.checksum!==checksumString(JSON.stringify(envelope.data)))return{ok:false,error:'The backup checksum does not match. The file may be damaged.'};
  if(!validateState(envelope.data))return{ok:false,error:'The save data is incomplete or invalid.'};
  if(Number(envelope.schemaVersion||0)>SCHEMA_VERSION)return{ok:false,error:'This backup was created by a newer BushTrack version.'};
  return{ok:true};
}
function openImportPicker(){ $('#importFileInput').value='';$('#importFileInput').click(); }
async function handleImportFile(file){
  if(!file)return;
  try{
    const envelope=JSON.parse(await file.text()),check=validateImportEnvelope(envelope);
    if(!check.ok){alert(check.error);return;}
    pendingImportEnvelope=envelope;
    const d=envelope.data;
    $('#importPreviewText').textContent=`Backup ${formatDateTime(envelope.exportedAt)} • LV ${Math.floor((d.xp||0)/1000)+1} • ${fmt(d.xp||0)} XP • ${fmt(d.totalSteps||0)} credited steps • ${(d.trophies||[]).length} trophies.`;
    $('#importModal').classList.remove('hidden');
  }catch(e){alert(`Could not read that backup: ${e.message||e}`);}
}
function confirmImport(){
  if(!pendingImportEnvelope)return;
  createBackup('Before importing external save');
  const incoming=Number(pendingImportEnvelope.schemaVersion||0)<SCHEMA_VERSION?upgradeLegacy(pendingImportEnvelope.data,'import'):deepMerge(initialState(),pendingImportEnvelope.data);
  state=migrateContentState(ensureEntityIds(ensureV6State(incoming)));state.schemaVersion=SCHEMA_VERSION;state.version=6;state.meta.lastVersion=APP_VERSION;state.meta.contentVersion=CONTENT_VERSION;
  processDayRollover();addEvent('Backup restored',`Imported save from ${formatDateTime(pendingImportEnvelope.exportedAt)}.`,'system');
  pendingImportEnvelope=null;$('#importModal').classList.add('hidden');save();render();
}
function cancelImport(){pendingImportEnvelope=null;$('#importModal').classList.add('hidden');}
function undoLastStepClaim(){
  const backups=readBackups();
  const b=backups.find(x=>String(x.reason||'').startsWith('Before step claim'));
  if(!b){alert('No step-claim backup is available to undo.');return;}
  if(!confirm(`Undo the most recent step claim and restore the save from ${formatDateTime(b.createdAt)}?`))return;
  createBackup('Before undoing step claim');
  state=deepMerge(initialState(),JSON.parse(JSON.stringify(b.data)));
  state.schemaVersion=SCHEMA_VERSION;state.version=6;state.meta.lastVersion=APP_VERSION;
  addEvent('Step claim undone','The most recent claim was rolled back from its automatic backup. Run the Shortcut again to import the corrected Health total.','system');
  save();render();
}
function applyCurrentHealthTotal(){
  const val=parseInt(String($('#correctStepsInput').value).replace(/\D/g,''),10);
  if(!Number.isFinite(val)){alert('Enter the current Steps total from Health.');return;}
  const previous=Number(getTodayLedger().healthTotal||0);
  if(val<previous){alert(`That is lower than the ${fmt(previous)} already credited. Use “Undo last claim” first, then import the corrected total.`);return;}
  creditHealthTotal(val,{source:'settings'});
  $('#correctStepsInput').value='';
}
function resetCurrentHunt(){
  if(!confirm('Abandon the current hunt/encounter and generate fresh sign? Your map, gear, trophies and step history stay intact.'))return;
  createBackup('Before reset current hunt');state.currentEncounter=null;state.pendingEncounter=null;state.stepCredit=0;
  state.objectives=state.objectives.filter(o=>o.complete||!['branchHunt','ambush','rabbitHunt'].includes(o.type));
  newMainHunt();addEvent('Hunt reset','The current sign was abandoned and a fresh main hunt was generated.','system');render();
}
function resetWorldKeepProgress(){
  if(!confirm('Reset the explored world? This removes locations, cameras, nets and active side trails, but keeps XP, gear, trophies, fieldcraft and step history.'))return;
  createBackup('Before world reset');
  state.locations=[];state.cameras=[];state.nets=[];state.objectives=[];state.pendingEncounter=null;state.currentEncounter=null;state.river={discovered:false,startDistance:8500,remaining:8500,ready:false};state.stepCredit=0;state.currentRegion='Home block';newMainHunt();
  addEvent('World reset','Explored country was cleared while player progression and history were kept.','system');render();
}
function fullWipe(){
  const typed=prompt('This removes ALL BushTrack progress from this Safari save. Type RESET to continue.');
  if(typed!=='RESET')return;
  createBackup('Before full wipe');
  LEGACY_KEYS.forEach(k=>storageRemove(k));storageRemove(STORAGE_KEY);storageRemove(STAGING_KEY);storageRemove(LAST_GOOD_KEY);
  state=initialState();save();render();
}

function renderConditioning(){
  const c=conditioningState();if(!c)return;const perks=conditioningPerks(c.permanentTier);const today=localDayKey();
  const current=weeklyAverage(addDaysKey(today,-1),{requireRecorded:true});
  const next=(c.baselineAverage==null)?null:Number(c.baselineAverage)+(Number(c.permanentTier||0)+1)*CONDITIONING_CONFIG.milestoneStep;
  $('#conditioningLevel')&&($('#conditioningLevel').textContent=c.permanentTier?perks.label:'Baseline building');
  $('#conditioningAvg')&&($('#conditioningAvg').textContent=current==null?'Need 7 recorded days':`${fmt(current)} / day`);
  $('#conditioningBaseline')&&($('#conditioningBaseline').textContent=c.baselineAverage==null?'Not set':`${fmt(c.baselineAverage)} / day`);
  $('#conditioningNext')&&($('#conditioningNext').textContent=next&&c.permanentTier<CONDITIONING_CONFIG.maxTier?`${fmt(next)} / day`:'Max tier');
  $('#conditioningPerk')&&($('#conditioningPerk').textContent=c.permanentTier?`${Math.round(perks.routeReduction*100)}% shorter stalk/return routes • +${Math.round(perks.discoveryBonus*100)}% discovery chance${perks.signDays?` • +${perks.signDays} day sign life`:''}`:'Set a baseline or record enough weeks to start earning permanent perks.');
  const m=c.momentum||{};$('#momentumText')&&($('#momentumText').textContent=m.tier?`${m.tier===2?'Strong':'Good'} momentum: +${fmt(Math.max(0,m.delta))}/day vs previous week • +${m.tier*5}% walking XP`:'No weekly momentum bonus active.');
  $('#baselineHelp')&&($('#baselineHelp').textContent=c.baselineAverage==null?'Optional: enter the 7-day average shown by Apple Health to start immediately. Otherwise BushTrack will establish one after enough complete weeks.':`Baseline source: ${c.baselineSource||'unknown'}. Permanent tiers only move upward.`);
  $('#devModeToggle')&&($('#devModeToggle').checked=!!state.backend?.featureFlags?.fieldTestTools);
  $('#devToolPanel')&&$('#devToolPanel').classList.toggle('hidden',!state.backend?.featureFlags?.fieldTestTools);
}

function renderSettings(){
  if(!$('#saveHealthText'))return;
  const b=latestBackup(),today=localDayKey(),ledger=state.stepLedger?.[today];
  $('#saveHealthText').textContent=runtimeStorageError||state.meta.storageHealthy===false?'PROBLEM':'Healthy';
  $('#saveHealthText').classList.toggle('bad',!!runtimeStorageError||state.meta.storageHealthy===false);
  $('#lastSavedText').textContent=formatDateTime(state.meta.lastSavedAt||lastRuntimeSaveAt);
  $('#lastBackupText').textContent=b?`${formatDateTime(b.createdAt)} — ${b.reason}`:'None yet';
  $('#saveIdText').textContent=state.meta.saveId||'—';
  $('#schemaText').textContent=`V${SCHEMA_VERSION} • app ${APP_VERSION}`;
  $('#lastClaimText').textContent=ledger?`${fmt(ledger.healthTotal||0)} Health • ${fmt(ledger.credited||0)} credited today`:'No claim today';
  $('#historyCountText').textContent=`${fmt(state.events?.length||0)} journal events stored${state.backend?.archive?.eventCount?` • ${fmt(state.backend.archive.eventCount)} compacted`:''}`;
  $('#contentVersionText')&&($('#contentVersionText').textContent=`C${state.meta?.contentVersion||CONTENT_VERSION}`);
  $('#storageProviderText')&&($('#storageProviderText').textContent=state.backend?.storage?.provider||'local');
  renderConditioning();
  const st=state.backend?.selfTests;$('#selfTestText')&&($('#selfTestText').textContent=st?`${st.passed}/${st.total} passed • ${formatDateTime(st.at)}`:'Not run yet');
  $('#storageProblemText').textContent=runtimeStorageError||'No storage errors detected.';
}
function setupSettingsActions(){
  $('#backupNowBtn')?.addEventListener('click',()=>{createBackup('Manual local backup');addEvent('Local backup','Manual rotating backup created.','system');render();});
  $('#exportSaveBtn')?.addEventListener('click',exportSave);
  $('#importSaveBtn')?.addEventListener('click',openImportPicker);
  $('#importFileInput')?.addEventListener('change',e=>handleImportFile(e.target.files?.[0]));
  $('#confirmImportBtn')?.addEventListener('click',confirmImport);$('#cancelImportBtn')?.addEventListener('click',cancelImport);
  $('#undoClaimBtn')?.addEventListener('click',undoLastStepClaim);$('#applyCorrectionBtn')?.addEventListener('click',applyCurrentHealthTotal);
  $('#exportDiagBtn')?.addEventListener('click',exportDiagnostics);$('#checkUpdateBtn')?.addEventListener('click',()=>checkForUpdate(true));
  $('#reloadUpdateBtn')?.addEventListener('click',()=>location.reload());
  $('#resetHuntBtn')?.addEventListener('click',resetCurrentHunt);$('#resetWorldBtn')?.addEventListener('click',resetWorldKeepProgress);$('#fullWipeBtn')?.addEventListener('click',fullWipe);
  $('#setBaselineBtn')?.addEventListener('click',()=>{const v=parseInt(String($('#baselineInput').value).replace(/\D/g,''),10);if(!setConditioningBaseline(v)){alert('Enter a sensible daily average, e.g. 4418.');return;}$('#baselineInput').value='';evaluateConditioning();render();});
  $('#runSelfTestsBtn')?.addEventListener('click',()=>{const r=runSelfTests();addEvent('Backend self-tests',`${r.passed}/${r.total} checks passed.`,'system');render();});
  $('#restoreLastGoodBtn')?.addEventListener('click',restoreLastKnownGood);
  $('#devModeToggle')?.addEventListener('change',e=>{state.backend.featureFlags.fieldTestTools=!!e.target.checked;render();});
  $('#forceEncounterBtn')?.addEventListener('click',()=>{if(!state.backend.featureFlags.fieldTestTools)return;state.hunt.remaining=0;state.hunt.stage='encounter';state.currentEncounter=createAnimalEncounter(familySpecies(state.hunt.signFamily),{source:'main'});addEvent('Field-test encounter','Developer tool forced the current sign into an encounter.','diagnostic');render();});
}
async function checkForUpdate(showCurrent=false){
  try{
    const r=await fetch(`./version.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const info=await r.json();
    if(info.version&&info.version!==APP_VERSION){
      $('#updateBannerText').textContent=`BushTrack ${info.version} is available. Reload to update the game code; your save stays intact.`;
      $('#updateBanner').classList.remove('hidden');
    }else if(showCurrent)alert(`BushTrack ${APP_VERSION} is current.`);
  }catch(e){if(showCurrent)alert(`Could not check for an update right now: ${e.message||e}`);}
}
function setupServiceWorker(){
  if(!('serviceWorker'in navigator))return;
  navigator.serviceWorker.register('./sw.js').then(reg=>{
    reg.update().catch(()=>{});
    reg.addEventListener('updatefound',()=>{$('#updateBannerText').textContent='A new BushTrack build is downloading. Reload once it is ready.';$('#updateBanner').classList.remove('hidden');});
  }).catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{$('#updateBannerText').textContent='New BushTrack code is ready. Reload to switch versions.';$('#updateBanner').classList.remove('hidden');});
  checkForUpdate(false);
}
function setupVisibilityChecks(){
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){processDayRollover();checkForUpdate(false);render();}});
  window.addEventListener('focus',()=>{processDayRollover();});
}
function level(){ return Math.floor(state.xp/1000)+1; }
function gainKnowledge(species,amt=1){ state.knowledge[species]=(state.knowledge[species]||0)+amt; }
function knowledgeLevel(species){ return Math.min(5,Math.floor((state.knowledge[species]||0)/4)); }

function ensureLocation(s,templateId){
  let loc=s.locations.find(x=>x.templateId===templateId);
  if(loc) return loc;
  const t=LOCATION_TEMPLATES[templateId];
  loc={id:uid('loc'),templateId,type:t.type,name:t.name,desc:t.desc,actions:[...t.actions],fishery:t.fishery||null,fishReady:templateId==='deepHole',baseReturnDistance:randInt(1400,3200),returnDistance:0,camp:false,pressure:0,discoveredClaim:s.claimCount,discoveredDate:s.meta?.currentDay||localDayKey()};
  loc.returnDistance=applyConditioningCost(loc.baseReturnDistance);s.locations.push(loc);
  return loc;
}
function discoverLocation(templateId,story){
  if(state.locations.some(x=>x.templateId===templateId)) return null;
  const loc=ensureLocation(state,templateId);
  state.xp+=120;
  addEvent('New place marked',story||`${loc.name} added to your map.`);
  if(templateId==='oldHut') lootOldHut();
  return loc;
}
function lootOldHut(){
  const found=weighted([{v:'Soft plastic',w:28},{v:'Spinnerbait',w:18},{v:'Surface lure',w:14},{v:'Bait',w:24},{v:'cash',w:16}]);
  const packBonus=state.gear.pack||0;
  if(found==='cash'){
    const cash=randInt(50,120)+packBonus*20; state.cash+=cash; addEvent('Something useful in the hut',`An old tin tucked away inside held $${cash} worth of usable gear and odds and ends.`);
  }else{
    const qty=1+(chance(.2+packBonus*.08)?1:0); state.inventory[found]=(state.inventory[found]||0)+qty; addEvent('Tackle find',`Found ${qty} usable ${found.toLowerCase()}${qty>1?'s':''} around the old hut.`);
  }
}

function refreshConditions(){ state.conditions=conditionsForSeed(state.meta.saveId,state.meta.currentDay||localDayKey()); }

function activeObjectiveData(){
  if(state.active.kind==='hunt') return {title:state.hunt.title,remaining:state.hunt.remaining,start:state.hunt.startDistance,story:huntClue(),tag:'SIGN'};
  if(state.active.kind==='river') return {title:'Follow the creek',remaining:state.river.remaining,start:state.river.startDistance,story:riverClue(state.river.remaining),tag:'CREEK'};
  if(state.active.kind==='encounter' && state.currentEncounter){
    const e=state.currentEncounter;
    if(e.stage==='approach') return {title:`Approach ${animalDisplay(e.selectedAnimal,true)}`,remaining:e.approachRemaining,start:e.approachStart,story:`You picked the ${e.approachName.toLowerCase()}. Keep moving until you are in position.`,tag:'STALK'};
    if(e.stage==='recovery') return {title:'Follow the blood trail',remaining:e.recoveryRemaining,start:e.recoveryStart,story:'The hit was not perfect. Stay on the sign and recover the animal.',tag:'TRACK'};
    if(e.stage==='shot') return {title:`${animalDisplay(e.selectedAnimal,true)} — shot ready`,remaining:0,start:1,story:`You are in position at about ${e.shotRange} m.`,tag:'SHOT'};
  }
  if(state.active.kind==='objective'){
    const o=state.objectives.find(x=>x.id===state.active.id);
    if(o) return {title:o.title,remaining:o.remaining,start:o.startDistance,story:o.story,tag:o.tag||'SIDE'};
  }
  return {title:'Fresh deer sign',remaining:state.hunt.remaining,start:state.hunt.startDistance,story:huntClue(),tag:'SIGN'};
}

function huntClue(){
  const h=state.hunt; const pct=1-h.remaining/h.startDistance; const k=knowledgeLevel(h.signFamily==='deer'?'Fallow deer':familySpecies(h.signFamily));
  if(h.stage==='encounter') return 'You have caught up. Glass the animals before deciding what to do.';
  if(h.signFamily==='pig') return pct>.65?'The rooting is fresh and you can smell pigs in the thick stuff.':pct>.3?'Fresh mud and sharper-edged prints. The mob is not far ahead.':'Rooting and tracks disappear into thicker cover.';
  if(h.signFamily==='red') return pct>.68?'Big deer sign is very fresh now. You are closing on whatever made it.':pct>.34?'Longer tracks and heavy slots keep angling into rougher country.':'Large deer sign heads away into the back block.';
  if(h.signFamily==='goat') return pct>.65?'You can hear rocks rolling somewhere above you.':pct>.3?'Fresh pellets and clipped browse show the goats are close.':'Goat prints angle toward rougher country.';
  if(h.signFamily==='rabbit') return pct>.55?'Fresh scratchings and movement around the next patch of cover.':'Rabbit sign is scattered along the edge.';
  if(pct>.72) return k>=2?'Several fallow deer are close. One track is clearly heavier than the others.':'Tracks are very fresh and there is movement somewhere ahead.';
  if(pct>.4) return k>=1?'Fresh fallow tracks, probably from more than one animal.':'The tracks are getting fresher and the droppings still have a shine.';
  return k>=3?'Fallow tracks less than a day old, heading into broken timber.':'Fresh deer sign heads into broken timber.';
}
function riverClue(rem){
  if(rem<=0) return 'The creek finally drops into a proper hole under timber.';
  if(rem<1800) return 'The bottom is dropping away and you can hear water working around the next bend.';
  if(rem<4000) return 'More submerged timber is showing and the banks are starting to pinch in.';
  return 'Still mostly shallow, but each bend is getting a little better.';
}
function familySpecies(f){ return ({deer:'Fallow deer',red:'Red deer',goat:'Feral goat',pig:'Feral pig',rabbit:'Rabbit'})[f]||'Fallow deer'; }


function currentStoreKey(){ return state.expedition?.baseId||'main'; }
function storeForKey(key=currentStoreKey()){
  ensureV6State(state);
  if(!state.campStores[key])state.campStores[key]=freshStore(key==='main'?'Main Camp':'Remote Camp');
  return state.campStores[key];
}
function baseLocationForKey(key=currentStoreKey()){
  if(key==='main')return null;
  const id=String(key).replace(/^camp:/,'');return getLoc(id);
}
function currentBaseName(){ return currentStoreKey()==='main'?'Main Camp':(baseLocationForKey()?.name||storeForKey().name||'Remote Camp'); }
function currentWeapon(){ return WEAPONS[state.expedition?.weaponId]||WEAPONS['3006']; }
function availableAmmo(){ return Math.max(0,Number(state.expedition?.loaded||0))+Math.max(0,Number(state.expedition?.spare||0)); }
function haulWeight(){
  const h=state.expedition?.haul||{};return Number(h.meatKg||0)+Number(h.scrapsKg||0)+Number(h.yabbies||0)*.08+Number((h.hides||[]).length)*.6;
}
function loadoutWeight(){
  const e=state.expedition||{},w=currentWeapon();const bino=(e.binoculars?(.65+(state.gear.binoculars||0)*.08):0);const ammo=(Number(e.loaded||0)+Number(e.spare||0))*Number(w.ammoWeight||0);return w.weight+bino+ammo+haulWeight();
}
function fatigueLabel(v=Number(state.expedition?.fatigue||0)){
  if(v<12)return'Fresh';if(v<28)return'Warm';if(v<48)return'Tired';if(v<70)return'Heavy legs';return'Knackered';
}
function expeditionAtBase(){ return Number(state.expedition?.distanceFromBase||0)<=0; }
function updateOutingForSteps(steps,isReturning=false){
  const e=state.expedition;if(!e?.active)return;
  const kg=loadoutWeight(),gain=(Number(steps||0)/1000)*(0.55+Math.max(0,kg-3)*.11);
  e.fatigue=clamp(Number(e.fatigue||0)+gain,0,100);e.stepsSinceBase=Number(e.stepsSinceBase||0)+Number(steps||0);e.totalCarriedKg=kg;
  if(isReturning)e.distanceFromBase=Math.max(0,Number(e.distanceFromBase||0)-Number(steps||0));
  else e.distanceFromBase=clamp(Number(e.distanceFromBase||0)+Math.round(Number(steps||0)*.38),0,16000);
}
function bankStepsAtBase(steps){ state.stepCredit=Number(state.stepCredit||0)+Number(steps||0);addEvent('Walking banked at camp',`${fmt(steps)} steps were recorded while no outing was active. Pick a loadout and they can be applied to the trail today.`,'steps'); }
function applyBankedStepsAfterStart(){
  const n=Number(state.stepCredit||0);if(n<=0)return;state.stepCredit=0;addEvent('Banked steps applied',`${fmt(n)} same-day steps were applied after you chose the loadout.`,'steps');applyStepsToActive(n);ambientDiscovery(n);maybeBranchEncounter(n);maybeGatherBait(n);maybeFindTackle(n);
}
function reloadFromSpare(){
  const e=state.expedition,w=currentWeapon();if(!e?.active)return false;const room=Math.max(0,w.capacity-Number(e.loaded||0));const moved=Math.min(room,Number(e.spare||0));if(moved<=0){addEvent('Nothing to reload',e.spare>0?'The rifle is already full.':'No spare rounds left in the field.');render();return false;}e.loaded+=moved;e.spare-=moved;addEvent('Reloaded',`${moved} round${moved===1?'':'s'} moved from spare ammo into the ${w.name}.`);render();return true;
}
function weaponSuitability(a,w=currentWeapon()){
  const species=a?.species||'Fallow deer',power=w.power;
  if(species==='Rabbit'){
    if(power==='small')return{ok:true,label:'appropriate',damage:'normal',message:'A sensible small-game setup with good recovery potential.'};
    return{ok:true,label:'severe overkill',damage:'catastrophic',message:`The ${w.name} is far more rifle than a rabbit needs. Expect very little usable carcass or hide if you hit it.`};
  }
  if(power==='small')return{ok:false,label:'underpowered',damage:'low',message:`The ${w.name} is not a sensible option for an animal this size.`};
  if(species==='Red deer'&&power==='medium')return{ok:true,label:'close-range suitable',damage:'normal',message:'The rifle can work here, but its short practical range makes the stalk much more demanding.'};
  return{ok:true,label:'appropriate',damage:'normal',message:'The rifle is a sensible match for the animal.'};
}
function shotSupportBonus(e){return e?.shotSupport==='solid'?.18:e?.shotSupport==='rest'?.10:0;}
function practicalRangeStatus(e){const w=currentWeapon();const range=Number(e?.shotRange||0);return{range,max:w.practicalRange,inRange:range<=w.practicalRange};}
function openLoadout(){
  if(state.expedition?.active){addEvent('Finish the current outing',`Return to ${currentBaseName()} before changing rifles or drawing fresh ammunition.`);render();return;}
  const store=storeForKey();const owned=state.armoury.owned||[];let selected=state.expedition?.weaponId&&owned.includes(state.expedition.weaponId)?state.expedition.weaponId:owned[0];
  $('#weaponChoices').innerHTML=owned.map(id=>{const w=WEAPONS[id],ammo=Number(store.ammo?.[id]||0);return `<button class="animal-choice ${id===selected?'special':''}" data-weapon-choice="${id}"><strong>${esc(w.name)}</strong><span>${w.capacity} in the rifle • game practical range ${w.practicalRange} m • ${w.weight.toFixed(1)} kg • ${fmt(ammo)} rounds stored</span><span>${esc(w.desc)}</span></button>`}).join('');
  $('#loadoutModal').dataset.weapon=selected;$('#carryBinosToggle').checked=true;renderSpareOptions(selected);renderLoadoutPreview();$('#loadoutModal').classList.remove('hidden');
}
function renderSpareOptions(id){const w=WEAPONS[id],store=storeForKey(),have=Math.max(0,Number(store.ammo?.[id]||0)),loaded=Math.min(w.capacity,have),available=Math.max(0,have-loaded);const opts=LOADOUT_SPARE_OPTIONS.filter(n=>n<=available);if(!opts.includes(0))opts.unshift(0);$('#spareAmmoSelect').innerHTML=opts.map(n=>`<option value="${n}">${n} spare round${n===1?'':'s'}</option>`).join('');$('#spareAmmoSelect').value=String(Math.min(10,opts[opts.length-1]||0));$('#spareAmmoSelect').dataset.loaded=String(loaded);}
function renderLoadoutPreview(){const id=$('#loadoutModal').dataset.weapon||'3006',w=WEAPONS[id],spare=Number($('#spareAmmoSelect').value||0),loaded=Number($('#spareAmmoSelect').dataset.loaded||0),binos=$('#carryBinosToggle').checked;const kg=w.weight+(loaded+spare)*w.ammoWeight+(binos?.65:0);$('#loadoutPreview').textContent=`${w.name}: ${loaded} loaded + ${spare} spare • about ${kg.toFixed(1)} kg before any meat/hides • ${binos?'binoculars carried':'no binoculars'}.`;}
function selectLoadoutWeapon(id){if(!WEAPONS[id]||!state.armoury.owned.includes(id))return;$('#loadoutModal').dataset.weapon=id;document.querySelectorAll('#weaponChoices [data-weapon-choice]').forEach(b=>b.classList.toggle('special',b.dataset.weaponChoice===id));renderSpareOptions(id);renderLoadoutPreview();}
function startOuting(){
  const id=$('#loadoutModal').dataset.weapon,w=WEAPONS[id],store=storeForKey();if(!w)return;const spare=Number($('#spareAmmoSelect').value||0),have=Number(store.ammo?.[id]||0),loaded=Math.min(w.capacity,have),need=loaded+spare;if(loaded<1){alert(`There is no ${w.name} ammunition stored at ${currentBaseName()}.`);return;}if(have<need){alert(`Only ${fmt(have)} rounds are stored at ${currentBaseName()}.`);return;}
  store.ammo[id]=have-need;state.expedition={active:true,baseId:currentStoreKey(),weaponId:id,loaded,spare,fatigue:0,distanceFromBase:0,stepsSinceBase:0,totalCarriedKg:0,startedDay:localDayKey(),binoculars:$('#carryBinosToggle').checked,haul:{meatKg:0,scrapsKg:0,yabbies:0,hides:[]}};
  $('#loadoutModal').classList.add('hidden');addEvent('Outing started',`${w.name}, ${loaded} loaded and ${spare} spare round${spare===1?'':'s'} from ${currentBaseName()}.${state.expedition.binoculars?' Binoculars are in the kit.':''}`);applyBankedStepsAfterStart();render();
}
function depositHaul(){
  const h=state.expedition?.haul;if(!h)return;const store=storeForKey();store.meatKg=Number(store.meatKg||0)+Number(h.meatKg||0);store.scrapsKg=Number(store.scrapsKg||0)+Number(h.scrapsKg||0);store.yabbies=Number(store.yabbies||0)+Number(h.yabbies||0);store.hides=[...(store.hides||[]),...(h.hides||[])];state.expedition.haul={meatKg:0,scrapsKg:0,yabbies:0,hides:[]};
}
function finishReturnToBase(){depositHaul();const e=state.expedition;e.distanceFromBase=0;e.fatigue=0;e.active=false;e.loaded=Number(e.loaded||0);e.spare=Number(e.spare||0);const store=storeForKey();store.ammo[e.weaponId]=Number(store.ammo[e.weaponId]||0)+e.loaded+e.spare;e.loaded=0;e.spare=0;addEvent('Back at camp',`Returned to ${currentBaseName()}. Field haul was stored, unused ammunition went back into camp stores, and fatigue reset.`);newMainHunt();state.active={kind:'hunt',id:null};}
function requestReturnToBase(){
  if(!state.expedition?.active){addEvent('Already at camp',`You are already at ${currentBaseName()}.`);render();return;}const dist=Math.max(0,Math.round(state.expedition.distanceFromBase||0));if(dist<=0){finishReturnToBase();render();return;}const existing=state.objectives.find(o=>!o.complete&&o.type==='returnBase');if(existing){setObjectiveActive(existing.id);render();return;}const o=createObjective({type:'returnBase',title:`Return to ${currentBaseName()}`,story:'Turn around and walk the route back with whatever you are carrying.',distance:dist,tag:'RETURN',data:{baseId:currentStoreKey()}});setObjectiveActive(o.id,true);addEvent('Heading back',`${fmt(dist)} steps estimated back to ${currentBaseName()}.`);render();
}

function settleAtCamp(key){
  const target=state.campStores[key];if(!target)return;const e=state.expedition;if(e?.active){const oldBase=e.baseId;e.baseId=key;depositHaul();target.ammo[e.weaponId]=Number(target.ammo[e.weaponId]||0)+Number(e.loaded||0)+Number(e.spare||0);e.loaded=0;e.spare=0;e.distanceFromBase=0;e.fatigue=0;e.active=false;e.baseId=key;const loc=baseLocationForKey(key);if(loc?.campState){loc.campState.active=true;loc.campState.foodKg=Number(target.meatKg||0);}}
  addEvent('Camp reached',`${target.name||'Remote camp'} is now your base. Gear stored here stays here, and the camp needs meat to remain viable.`);
}
function startCampUse(loc){
  const key=`camp:${loc.id}`,store=state.campStores[key];if(!loc.camp||!store){addEvent('No camp here','This location has not been established as a camp yet.');render();return;}if(store.active===false&&Number(store.meatKg||0)<CAMP_FOOD_PER_DAY){addEvent('Camp has gone to shit',`${loc.name} is out of food. Carry meat back in before using it as a base.`);render();return;}if(!state.expedition?.active){addEvent('Start an outing first',`Prepare a loadout at ${currentBaseName()} before walking into ${loc.name}.`);render();return;}const existing=state.objectives.find(o=>!o.complete&&o.type==='campTravel'&&o.data.locationId===loc.id);if(existing){setObjectiveActive(existing.id);render();return;}const o=createObjective({type:'campTravel',title:`Walk into ${loc.name}`,story:'Carry your current kit and field haul into the remote camp.',distance:applyConditioningCost(loc.baseReturnDistance||loc.returnDistance),tag:'CAMP',data:{locationId:loc.id}});setObjectiveActive(o.id,true);render();
}
function startCampResupply(loc){
  const key=`camp:${loc.id}`;if(!loc.camp||!state.campStores[key])return;if(!state.expedition?.active){addEvent('Start an outing first','Prepare a loadout so the supply walk has somewhere to live in the field state.');render();return;}const h=state.expedition.haul;let carry=Number(h.meatKg||0);if(carry<1&&currentStoreKey()==='main'&&Number(state.expedition.distanceFromBase||0)<250){const main=storeForKey('main');const take=Math.min(5,Number(main.meatKg||0));if(take>0){main.meatKg-=take;h.meatKg+=take;carry=Number(h.meatKg||0);addEvent('Meat packed for camp',`${take.toFixed(1)} kg of meat loaded from Main Camp for the resupply walk.`);}}
  if(carry<1){addEvent('Nothing to carry','You need some recovered meat in the field haul (or stored at Main Camp before leaving) to resupply this camp.');render();return;}const o=createObjective({type:'campResupply',title:`Carry meat to ${loc.name}`,story:'Walk the supplies back in. The more food you leave there, the longer the remote camp stays viable.',distance:applyConditioningCost(loc.baseReturnDistance||loc.returnDistance),tag:'SUPPLY',data:{locationId:loc.id}});setObjectiveActive(o.id,true);render();
}
function completeCampResupply(loc){const key=`camp:${loc.id}`,st=state.campStores[key],h=state.expedition.haul;const amount=Math.min(5,Number(h.meatKg||0));if(amount>0){h.meatKg-=amount;st.meatKg=Number(st.meatKg||0)+amount;st.active=true;loc.campState=loc.campState||{};loc.campState.active=true;loc.campState.foodKg=st.meatKg;addEvent('Camp resupplied',`${amount.toFixed(1)} kg of meat left at ${loc.name}. That is roughly ${(st.meatKg/CAMP_FOOD_PER_DAY).toFixed(1)} occupied camp-days of food.`);}else addEvent('Supply run came up empty','No meat was left at the camp.');}

function sellStoredHides(){const st=storeForKey();if(!(st.hides||[]).length){addEvent('No hides to sell','There are no stored hides at this camp.');render();return;}const total=st.hides.reduce((n,h)=>n+Number(h.value||0),0);const count=st.hides.length;st.hides=[];state.cash+=total;addEvent('Hides traded',`${count} stored hide${count===1?'':'s'} traded for $${fmt(total)}.`);render();}
function sellStoredMeat(){const st=storeForKey();if(Number(st.meatKg||0)<5){addEvent('Not enough meat','Keep at least 5 kg at camp before selling a batch.');render();return;}st.meatKg-=5;const cash=randInt(45,75);state.cash+=cash;addEvent('Meat sold',`5 kg of usable meat traded for $${cash}.`);render();}
function useYabbiesAsFood(){const st=storeForKey();const n=Math.min(5,Number(st.yabbies||0));if(n<1){addEvent('No yabbies','There are no yabbies stored at this camp.');render();return;}st.yabbies-=n;st.meatKg=Number(st.meatKg||0)+n*.12;addEvent('Yabbies kept for the pot',`${n} yabby${n===1?'':'ies'} added about ${(n*.12).toFixed(1)} kg of camp food value.`);render();}
function consumeTrapBait(){
  const h=state.expedition?.haul||{},st=storeForKey();if(Number(h.scrapsKg||0)>=.25){h.scrapsKg-=.25;return'field meat scraps';}if(Number(st.scrapsKg||0)>=.25){st.scrapsKg-=.25;return'meat scraps';}if(Number(h.meatKg||0)>=.25){h.meatKg-=.25;return'usable meat';}if(Number(st.meatKg||0)>=.25){st.meatKg-=.25;return'usable meat';}return null;
}
function availableYabbies(){return Number(state.expedition?.haul?.yabbies||0)+Number(storeForKey().yabbies||0);}
function consumeYabby(){const h=state.expedition?.haul;if(Number(h?.yabbies||0)>0){h.yabbies--;return true;}const st=storeForKey();if(Number(st.yabbies||0)>0){st.yabbies--;return true;}return false;}
function recoveryRoll(a,shotQuality='clean'){
  const rec=ANIMAL_RECOVERY[a.species]||ANIMAL_RECOVERY['Fallow deer'],w=currentWeapon(),suit=weaponSuitability(a,w);let meat=rec.meat[0]+worldRandom()*(rec.meat[1]-rec.meat[0]);let scraps=rec.scrap[0]+worldRandom()*(rec.scrap[1]-rec.scrap[0]);let hideFactor=shotQuality==='clean'?.9:.62;
  if(suit.damage==='heavy'){meat*=.62;hideFactor*=.55;scraps*=1.45;}if(suit.damage==='catastrophic'){meat*=a.species==='Rabbit'?.08:.35;hideFactor*=.08;scraps*=1.8;}if(shotQuality==='marginal'){meat*=.76;hideFactor*=.72;scraps*=1.25;}
  meat=Math.max(0,Math.round(meat*10)/10);scraps=Math.max(0,Math.round(scraps*10)/10);const hideCondition=hideFactor>.8?'Excellent':hideFactor>.55?'Good':hideFactor>.28?'Damaged':'Destroyed';const hideValue=hideCondition==='Destroyed'?0:Math.max(1,Math.round(rec.hideBase*hideFactor*(a.quality==='trophy'?1.35:a.quality==='mature'?1.15:1)));
  return{meatKg:meat,scrapsKg:scraps,hideCondition,hideValue,suitability:suit.label};
}
function addRecoveryToHaul(a,recovery){const h=state.expedition.haul;h.meatKg=Number(h.meatKg||0)+recovery.meatKg;h.scrapsKg=Number(h.scrapsKg||0)+recovery.scrapsKg;if(recovery.hideValue>0)h.hides.push({id:uid('hide'),species:a.species,condition:recovery.hideCondition,value:recovery.hideValue,date:localDayKey()});}
function glassLocation(loc){
  if(!state.expedition?.active){addEvent('No outing active','Choose a loadout before heading out to glass.');render();return;}if(!state.expedition.binoculars){addEvent('No binoculars','You left the binoculars at camp. The ridge still gives you a view, but not enough to pick animals apart.');render();return;}
  const observations=[];const level=state.gear.binoculars||0;const count=randInt(1,3);for(let i=0;i<count;i++){
    let animal=null;const live=state.knownAnimals.filter(a=>a.status!=='taken'&&a.homeArea===state.currentRegion);if(live.length&&chance(.30))animal=pick(live);if(!animal)animal=generateAnimal(speciesForLocation(loc),chance(.18));const distance=randInt(350,1400);const id=animal.knownId||animal.entityId||null;let label=level>=2?animalDisplay(animal,true):level>=1?`${animal.species} ${animal.sex||''}`.trim():animal.species;let detail=level>=2&&animal.metricLabel?animal.metricLabel:(level>=1?animalSubtext(animal):'Too far to judge much more than species and movement.');observations.push({animal,knownAnimalId:id,label,distance,detail});
  }
  if(chance(.15)){const pool=['farmDam','crossing','gameTrail'].filter(id=>!state.locations.some(l=>l.templateId===id));if(pool.length){const found=pick(pool);discoverLocation(found,'While glassing, you picked out a useful landmark in the distance and marked it on the map.');}}
  state.glassing={lastResult:cloneJson(observations),lastDay:localDayKey(),locationId:loc.id};$('#glassTitle').textContent=loc.name;$('#glassText').textContent=`You worked the open country with ${level>=2?'good glass':level>=1?'decent glass':'basic binoculars'}. Distances are only rough until you commit to a stalk.`;$('#glassChoices').innerHTML=observations.map((o,i)=>`<button class="animal-choice" data-glass-index="${i}"><strong>${esc(o.label)}</strong><span>${esc(o.detail)} • roughly ${Math.round(o.distance/100)*100} m away</span></button>`).join('')||'<div class="empty">Nothing moving while you glassed this time.</div>';$('#glassModal').classList.remove('hidden');save();
}
function pursueGlassed(index){const o=state.glassing?.lastResult?.[index];if(!o)return;const dist=randInt(1800,6200);const resume={...state.active};const obj=createObjective({type:'glassHunt',title:`Stalk toward ${o.label}`,story:'Leave the glassing point and work into the country where you saw the animal.',distance:dist,tag:'GLASSED',data:{species:o.animal.species,knownAnimalId:o.knownAnimalId||null,resumeActive:resume}});$('#glassModal').classList.add('hidden');setObjectiveActive(obj.id,true);addEvent('Glassed animal chosen',`${o.label} looked worth leaving the ridge for. The stalk starts with about ${fmt(dist)} steps.`);render();}
function renderOuting(){
  if(!$('#outingTitle'))return;const e=state.expedition,w=currentWeapon(),active=!!e?.active;$('#outingStatusTag').textContent=active?'IN FIELD':'AT CAMP';$('#outingTitle').textContent=active?`${w.name} outing`:'Ready at camp';$('#outingBaseText').textContent=currentBaseName();$('#outingWeaponText').textContent=active?w.name:'Choose before leaving';$('#outingAmmoText').textContent=active?`${fmt(e.loaded)} loaded + ${fmt(e.spare)} spare`:`${fmt(storeForKey().ammo?.[e.weaponId]||0)} stored`;$('#outingFatigueText').textContent=active?`${fatigueLabel()} • ${Math.round(e.fatigue||0)}%`:'Rested';$('#outingWeightText').textContent=active?`${loadoutWeight().toFixed(1)} kg`:'—';$('#outingReturnText').textContent=active&&e.distanceFromBase>0?`~${fmt(e.distanceFromBase)} steps`:'At camp';$('#outingText').textContent=active?`Rifle and ammunition stay with you until you walk back. ${availableAmmo()?'You can keep following other sign while ammunition remains.':'You are out of ammunition — head back to camp.'}`:'Choose the rifle, spare ammunition and whether to carry binoculars before the next outing.';const h=e?.haul||{};$('#outingHaulText').textContent=active?`Field haul: ${Number(h.meatKg||0).toFixed(1)} kg meat • ${Number(h.scrapsKg||0).toFixed(1)} kg scraps • ${fmt(h.yabbies||0)} yabbies • ${(h.hides||[]).length} hide(s).`:'No field haul being carried.';$('#prepareOutingBtn').disabled=active;$('#returnBaseBtn').disabled=!active;$('#fieldReloadBtn').disabled=!active||Number(e.spare||0)<=0||Number(e.loaded||0)>=w.capacity;
}
function renderCampStores(){
  if(!$('#campStoreList'))return;const rows=[];for(const [key,st] of Object.entries(state.campStores||{})){const loc=key==='main'?null:baseLocationForKey(key);rows.push(`<div class="camp-store"><div><strong>${esc(key==='main'?'Main Camp':(loc?.name||st.name||'Remote Camp'))}</strong><span>${key===currentStoreKey()?'Current base • ':''}${key==='main'?'Permanent':(st.active===false?'Inactive — needs food':'Active')}</span></div><div class="camp-resource-grid"><span>Meat <b>${Number(st.meatKg||0).toFixed(1)} kg</b></span><span>Scraps <b>${Number(st.scrapsKg||0).toFixed(1)} kg</b></span><span>Yabbies <b>${fmt(st.yabbies||0)}</b></span><span>Hides <b>${(st.hides||[]).length}</b></span></div></div>`);}$('#campStoreList').innerHTML=rows.join('');
}

function render(){
  $('#levelText').textContent=`LV ${level()}`; $('#xpText').textContent=`${fmt(state.xp)} XP`; $('#cashText').textContent=`$${fmt(state.cash)}`;
  $('#seasonText').textContent=state.conditions.season; $('#weatherText').textContent=state.conditions.weather; $('#windText').textContent=state.conditions.wind; $('#regionText').textContent=state.currentRegion;
  $('#riverLine').classList.toggle('hidden',!state.river.discovered);

  const today=localDayKey();
  const ledger=state.stepLedger?.[today];
  const healthTotal=Number(ledger?.healthTotal||0), credited=Number(ledger?.credited||0);
  $('#claimStatus').textContent=healthTotal>0?`Today: ${fmt(healthTotal)} Health steps seen • ${fmt(credited)} credited to BushTrack. Run the Shortcut again any time; only the increase is added.`:'No steps imported today yet.';
  $('#claimBtn').disabled=false; $('#claimBtn').style.opacity='1';
  $('#stepCreditBox').classList.toggle('hidden',state.stepCredit<1);
  if(state.stepCredit>0) $('#stepCreditBox').textContent=`${fmt(state.stepCredit)} steps of same-day trail credit are still available for the next choice you make.`;

  const a=activeObjectiveData();
  $('#activeTitle').textContent=a.title; $('#activeStory').textContent=a.story; $('#mapTarget').textContent=a.tag;
  $('#activeDistance').textContent=a.remaining<=0?(state.active.kind==='encounter'&&state.currentEncounter?.stage==='shot'?`${state.currentEncounter.shotRange} m`:'Ready'):`${fmt(a.remaining)} steps`;
  const pct=a.remaining<=0?100:clamp((a.start-a.remaining)/Math.max(1,a.start)*100,0,100); $('#activeProgress').style.width=`${pct}%`;
  $('#activeMeta').textContent=`${fmt(state.totalSteps)} real steps banked • ${state.expedition?.active?`${currentWeapon().name}, ${fmt(availableAmmo())} rounds left, ${fatigueLabel().toLowerCase()}`:`at ${currentBaseName()}`}.`;

  renderHunt(); renderRiver(); renderObjectives(); renderPendingChoice(); renderEncounterStatus(); renderLocations(); renderKnownAnimals(); renderFieldGear(); renderOuting(); renderCampStores(); renderInventory(); renderShop(); renderKnowledge(); renderJournal(); renderSettings(); updateStorageWarning();
  save();
}

function renderHunt(){
  const h=state.hunt; const active=state.active.kind==='hunt'; $('#huntCard').classList.toggle('active',active);
  $('#huntTitle').textContent=h.title; $('#huntText').textContent=huntClue();
  if(h.stage==='encounter'){
    $('#huntTag').textContent='PAUSED AT SIGN'; $('#huntStatLabel').textContent='Status'; $('#huntDistance').textContent='Encounter open';
    $('#selectHuntBtn').classList.add('hidden'); $('#encounterBtn').classList.add('hidden'); $('#callBtn').classList.add('hidden');
  }else{
    $('#huntTag').textContent='TRACKING'; $('#huntStatLabel').textContent='Estimated intercept'; $('#huntDistance').textContent=`${fmt(h.remaining)} steps`;
    $('#selectHuntBtn').classList.remove('hidden'); $('#selectHuntBtn').textContent=active?'Active trail':'Make active'; $('#encounterBtn').classList.add('hidden');
    const canCall=state.gear.call>0&&!h.called; $('#callBtn').classList.toggle('hidden',!canCall); $('#callBtn').textContent='Use a call';
  }
}
function renderRiver(){
  const r=state.river; $('#riverCard').classList.toggle('locked',!r.discovered); $('#riverCard').classList.toggle('active',state.active.kind==='river');
  if(!r.discovered){ $('#riverTag').textContent='UNDISCOVERED'; $('#riverText').textContent='You haven’t found a watercourse worth following yet.'; $('#riverDistance').textContent='—'; $('#selectRiverBtn').classList.add('hidden'); return; }
  if(!r.ready){ $('#riverTag').textContent='EXPLORING'; $('#riverText').textContent=riverClue(r.remaining); $('#riverDistance').textContent=`${fmt(r.remaining)} steps`; $('#selectRiverBtn').classList.remove('hidden'); $('#selectRiverBtn').textContent=state.active.kind==='river'?'Active trail':'Make active'; }
  else{ $('#riverTag').textContent='DEEP HOLE'; $('#riverText').textContent='You found the deep timber bend. It now lives permanently on the map.'; $('#riverDistance').textContent='Mapped'; $('#selectRiverBtn').classList.add('hidden'); }
}
function renderObjectives(){
  const live=state.objectives.filter(o=>!o.complete);
  $('#objectiveSection').classList.toggle('hidden',live.length===0);
  $('#objectiveList').innerHTML=live.map(o=>`<article class="mission-card ${state.active.kind==='objective'&&state.active.id===o.id?'active':''}"><div class="card-head"><div><div class="eyebrow">${esc(o.tag||'SIDE TRAIL')}</div><h3>${esc(o.title)}</h3></div><span class="tag">${o.expiresAtClaim&&state.claimCount>=o.expiresAtClaim?'FADING':'OPEN'}</span></div><p>${esc(o.story)}</p><div class="stat-row"><span>Distance</span><strong>${fmt(o.remaining)} steps</strong></div><button class="secondary" data-objective="${o.id}">${state.active.kind==='objective'&&state.active.id===o.id?'Active trail':'Make active'}</button></article>`).join('');
}
function renderPendingChoice(){
  const p=state.pendingEncounter; $('#pendingChoiceCard').classList.toggle('hidden',!p); if(!p)return;
  $('#pendingChoiceTitle').textContent=p.title; $('#pendingChoiceText').textContent=p.text; $('#chaseChoiceBtn').textContent=p.chaseLabel||'Follow it';
}
function renderEncounterStatus(){
  const e=state.currentEncounter; $('#encounterStatusCard').classList.toggle('hidden',!e); if(!e)return;
  const a=e.selectedAnimal;
  if(e.stage==='choose'){ $('#encounterStatusTitle').textContent='Animals ahead'; $('#encounterStatusText').textContent='You have reached the sign. Glass what is actually there before deciding whether to keep hunting.'; $('#encounterStatusLabel').textContent='Status'; $('#encounterStatusValue').textContent='Ready to glass'; $('#encounterActionBtn').textContent='Glass the animals'; }
  else if(e.stage==='approach'){ $('#encounterStatusTitle').textContent=`Stalking ${animalDisplay(a,true)}`; $('#encounterStatusText').textContent=`${e.approachName}. Keep walking to finish the stalk.`; $('#encounterStatusLabel').textContent='Approach'; $('#encounterStatusValue').textContent=`${fmt(e.approachRemaining)} steps`; $('#encounterActionBtn').textContent=state.active.kind==='encounter'?'Active stalk':'Make stalk active'; }
  else if(e.stage==='shot'){ const w=currentWeapon(),rs=practicalRangeStatus(e),suit=weaponSuitability(a,w);$('#encounterStatusTitle').textContent=`${animalDisplay(a,true)} — ${rs.inRange&&suit.ok?'shot ready':'needs another decision'}`; $('#encounterStatusText').textContent=rs.inRange?(suit.ok?`You are settled at about ${e.shotRange} m with the ${w.name}.`:`${suit.message}`):`${e.shotRange} m is beyond the ${w.name} practical game range. You will need to stalk closer.`; $('#encounterStatusLabel').textContent='Range / ammo'; $('#encounterStatusValue').textContent=`${e.shotRange} m • ${fmt(availableAmmo())} rd`; $('#encounterActionBtn').textContent='Open shot'; }
  else { $('#encounterStatusTitle').textContent='Follow the blood trail'; $('#encounterStatusText').textContent='There is recoverable sign. Keep walking until you find the animal.'; $('#encounterStatusLabel').textContent='Recovery'; $('#encounterStatusValue').textContent=`${fmt(e.recoveryRemaining)} steps`; $('#encounterActionBtn').textContent=state.active.kind==='encounter'?'Active recovery':'Make recovery active'; }
}
function renderLocations(){
  if(!state.locations.length){ $('#locationList').innerHTML='<div class="empty">The map is still blank. Walk a few trails and start finding country.</div>'; return; }
  $('#locationList').innerHTML=state.locations.map(loc=>{
    const cam=state.cameras.find(c=>c.locationId===loc.id); const net=state.nets.find(n=>n.locationId===loc.id);const key=`camp:${loc.id}`;const campStore=state.campStores?.[key];
    const buttons=[];
    if(loc.actions.includes('glass'))buttons.push(`<button class="primary" data-loc-action="glass" data-loc="${loc.id}">Glass the country</button>`);
    if(loc.actions.includes('fish')) buttons.push(`<button class="${loc.fishReady?'primary':'secondary'}" data-loc-action="fish" data-loc="${loc.id}">${loc.fishReady?'Fish here':'Walk back to fish'}</button>`);
    if(loc.actions.includes('camera')) buttons.push(cam?`<button class="secondary" data-loc-action="cameraCheck" data-loc="${loc.id}">${cam.ready?'Walk in & check camera':'Camera soaking'}</button>`:`<button class="secondary" data-loc-action="cameraPlace" data-loc="${loc.id}">Place camera</button>`);
    if(loc.actions.includes('net')) buttons.push(net?`<button class="secondary" data-loc-action="netCheck" data-loc="${loc.id}">${net.ready?'Walk back & check net':'Net soaking'}</button>`:`<button class="secondary" data-loc-action="netPlace" data-loc="${loc.id}">Set yabby net</button>`);
    if(loc.actions.includes('ambush')) buttons.push(`<button class="secondary" data-loc-action="ambush" data-loc="${loc.id}">Sit & watch sign</button>`);
    if(loc.actions.includes('rabbit')) buttons.push(`<button class="secondary" data-loc-action="rabbit" data-loc="${loc.id}">Hunt the warren</button>`);
    if(loc.actions.includes('camp')){
      if(!loc.camp)buttons.push(`<button class="secondary" data-loc-action="camp" data-loc="${loc.id}">Establish camp</button>`);
      else{buttons.push(`<button class="secondary" data-loc-action="campUse" data-loc="${loc.id}">${currentStoreKey()===key?'Current base':'Walk in & use camp'}</button>`);buttons.push(`<button class="secondary" data-loc-action="campResupply" data-loc="${loc.id}">Carry meat to camp</button>`);}
    }
    if(loc.actions.includes('region')) buttons.push(`<button class="secondary" data-loc-action="region" data-loc="${loc.id}">${state.currentRegion==='Back block'?'Return home':'Drive to back block'}</button>`);
    const pressure=loc.fishery?` • fishing pressure ${(loc.pressure||0)>.35?'high':(loc.pressure||0)>.15?'moderate':'low'}`:'';const trap=loc.actions.includes('net')?` • trap pressure ${(loc.trapPressure||0)>.45?'worked hard':(loc.trapPressure||0)>.18?'some use':'fresh'}`:'';const camp=loc.camp?` • camp food ${Number(campStore?.meatKg||0).toFixed(1)} kg`:'';
    return `<article class="location-card"><div class="eyebrow">${esc(loc.type.toUpperCase())}</div><h3>${esc(loc.name)}</h3><p>${esc(loc.desc)}</p><div class="location-meta">Access walk: about ${fmt(applyConditioningCost(loc.baseReturnDistance||loc.returnDistance))} steps${pressure}${trap}${camp}</div><div class="location-actions">${buttons.join('')}</div></article>`;
  }).join('');
}
function renderKnownAnimals(){
  const live=state.knownAnimals.filter(a=>a.status!=='taken');
  $('#knownAnimalList').innerHTML=live.length?live.map(a=>`<div class="stack-item"><strong>${esc(a.nickname||animalDisplay(a,true))}</strong><span>${esc(a.species)} • ${esc(a.lastSeen||'Seen once')} • ${esc(a.status||'At large')}</span></div>`).join(''):'<div class="empty">No individual animal has made enough of an impression yet.</div>';
}
function renderFieldGear(){
  const items=[];
  state.cameras.forEach(c=>{const loc=getLoc(c.locationId);items.push(`<div class="stack-item"><strong>Trail camera — ${esc(loc?.name||'Unknown')}</strong><span>${c.ready?'Ready to walk in and check':'Soaking. It may have something after the next step claim.'}</span></div>`)});
  state.nets.forEach(n=>{const loc=getLoc(n.locationId);items.push(`<div class="stack-item"><strong>Yabby net — ${esc(loc?.name||'Unknown')}</strong><span>${n.ready?'Ready to walk back and check':'Set and soaking until a later day.'}</span></div>`)});
  $('#fieldGearList').innerHTML=items.length?items.join(''):'<div class="empty">Nothing left in the field yet.</div>';
}
function renderInventory(){
  const labels=[['Spinnerbait','Spinnerbaits'],['Surface lure','Surface lures'],['Soft plastic','Soft plastics'],['Bait','Bait'],['trailCameras','Trail cameras'],['yabbyNets','Yabby nets']];
  $('#inventoryList').innerHTML=labels.map(([k,l])=>`<div class="inventory-item"><span>${l}</span><strong>${fmt(state.inventory[k]||0)}</strong></div>`).join('');
}
function renderShop(){
  const rows=[];
  for(const g of GEAR){
    const lvl=state.gear[g.id]||0; const maxed=lvl>=g.max; const price=Math.round(g.base*(1+lvl*.65)); const locked=g.level&&level()<g.level;
    rows.push(`<div class="shop-item"><div><strong>${esc(g.name)} ${g.max>1?`L${lvl}/${g.max}`:''}</strong><p>${esc(g.desc)}${locked?` Unlocks at level ${g.level}.`:''}</p></div><button class="secondary" data-buy-gear="${g.id}" ${maxed||locked?'disabled':''}>${maxed?'Owned':`$${price}`}</button></div>`);
  }
  const consumables=[['trailCameras','Trail camera',220],['yabbyNets','Yabby net',140],['Spinnerbait','Spinnerbait',70],['Surface lure','Surface lure',65],['Soft plastic','Soft plastic pack',45],['Bait','Bait pack',30]];
  for(const [id,name,price] of consumables) rows.push(`<div class="shop-item"><div><strong>${name}</strong><p>Consumable field gear.</p></div><button class="secondary" data-buy-item="${id}" data-price="${price}">$${price}</button></div>`);
  for(const w of WEAPON_SHOP){const def=WEAPONS[w.id],owned=state.armoury.owned.includes(w.id);rows.push(`<div class="shop-item"><div><strong>${esc(def.name)}</strong><p>${esc(def.desc)}</p></div><button class="secondary" data-buy-weapon="${w.id}" data-price="${w.price}" ${owned?'disabled':''}>${owned?'Owned':`$${w.price}`}</button></div>`);}
  for(const [id,w] of Object.entries(WEAPONS)){if(!state.armoury.owned.includes(id))continue;rows.push(`<div class="shop-item"><div><strong>${esc(w.name)} ammunition</strong><p>${w.ammoPack} rounds delivered to Main Camp stores.</p></div><button class="secondary" data-buy-ammo="${id}" data-price="${w.ammoPrice}">$${w.ammoPrice}</button></div>`);}
  $('#shopList').innerHTML=rows.join('');
}
function renderKnowledge(){
  const entries=Object.entries(state.knowledge).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  $('#knowledgeList').innerHTML=entries.length?entries.map(([name,pts])=>{const lv=knowledgeLevel(name);return `<div class="knowledge-item"><strong>${esc(name)}</strong><span class="micro">Fieldcraft ${lv}/5</span><div class="bar"><i style="width:${clamp(pts/20*100,3,100)}%"></i></div></div>`}).join(''):'<div class="empty">Knowledge builds by actually finding, tracking and catching things.</div>';
}
function renderJournal(){
  $('#eventLog').innerHTML=state.events.slice(0,150).map(e=>`<div class="log-entry"><strong>${esc(e.title)}</strong><div>${esc(e.text)}</div><small>${esc(e.date)}</small></div>`).join('')+(state.events.length>150?`<div class="empty">${fmt(state.events.length-150)} older journal events remain stored in the save/export.</div>`:'');
  const bests=personalBests();
  $('#bestList').innerHTML=bests.length?bests.map(b=>`<div class="best-card"><strong>${esc(b.species)}</strong><span>${esc(b.detail)}</span></div>`).join(''):'<div class="empty">No personal bests yet.</div>';
  $('#trophyList').innerHTML=state.trophies.length?state.trophies.map(t=>`<div class="trophy"><strong>${esc(t.name||t.species)}</strong><span>${esc(t.detail)}</span></div>`).join(''):'<div class="empty">Nothing worthy of the wall yet.</div>';
}
function personalBests(){
  const map={};
  for(const t of state.trophies){ if(!t.metricValue) continue; if(!map[t.species]||t.metricValue>map[t.species].metricValue) map[t.species]=t; }
  return Object.values(map).map(t=>({species:t.species,detail:t.metricLabel||t.detail}));
}

function getTodayLedger(){
  const day=localDayKey();
  state.stepLedger=state.stepLedger||{};
  if(!state.stepLedger[day])state.stepLedger[day]={date:day,healthTotal:0,credited:0,claims:[],firstClaimAt:null,lastClaimAt:null,lastSeenAt:null,finalized:false};
  return state.stepLedger[day];
}
function creditHealthTotal(currentTotal,{source='manual',skipBackup=false}={}){
  processDayRollover();
  const today=localDayKey(), ledger=getTodayLedger();
  currentTotal=Math.round(Number(currentTotal));
  if(!Number.isFinite(currentTotal)||currentTotal<0||currentTotal>100000){$('#claimStatus').textContent='Put in a sensible step count first.';return 0;}
  const previous=Number(ledger.healthTotal||0);
  if(currentTotal<previous){
    $('#claimStatus').textContent=`Health total is lower than the ${fmt(previous)} already recorded. Use Undo last claim if the previous import was wrong.`;
    return 0;
  }
  const delta=currentTotal-previous;
  if(delta<=0){ledger.lastSeenAt=new Date().toISOString();save();$('#claimStatus').textContent=`No new steps since the last import — still ${fmt(currentTotal)} today.`;return 0;}
  if(!skipBackup)createBackup(`Before step claim ${today} ${previous}->${currentTotal}`);
  ledger.healthTotal=currentTotal;ledger.lastSeenAt=new Date().toISOString();
  const firstToday=Number(ledger.credited||0)===0;
  if(firstToday){state.claimCount++;ledger.firstClaimAt=new Date().toISOString();}
  ledger.credited=Number(ledger.credited||0)+delta;ledger.lastClaimAt=new Date().toISOString();
  ledger.claims=(ledger.claims||[]);const claimId=uid('claim');ledger.claims.push({id:claimId,at:new Date().toISOString(),source,total:currentTotal,delta,provisional:true});
  const activeBefore=cloneJson(state.active);const huntBefore={id:state.hunt?.id,remaining:state.hunt?.remaining,stage:state.hunt?.stage};
  state.lastClaimDate=today;state.totalSteps=Number(state.totalSteps||0)+delta;state.xp+=Math.round((delta/22)*conditioningXpMultiplier());
  const outingWasActive=!!state.expedition?.active;applyStepsToActive(delta);
  state.backend.claimAudit.push({id:claimId,at:new Date().toISOString(),day:today,source,previousHealthTotal:previous,healthTotal:currentTotal,creditedDelta:delta,activeBefore,activeAfter:cloneJson(state.active),huntBefore,huntAfter:{id:state.hunt?.id,remaining:state.hunt?.remaining,stage:state.hunt?.stage},outingActive:outingWasActive,weaponId:state.expedition?.weaponId||null});
  if(outingWasActive){ambientDiscovery(delta);maybeBranchEncounter(delta);maybeGatherBait(delta);maybeFindTackle(delta);}
  addEvent('Steps credited',`${fmt(delta)} new steps added from a ${fmt(currentTotal)}-step Health total.`, 'steps');
  $('#stepsInput').value='';
  render();
  return delta;
}
function claimSteps(){
  const steps=parseInt(String($('#stepsInput').value).replace(/\D/g,''),10);
  creditHealthTotal(steps,{source:'manual'});
}

function applyStepsToActive(steps){
  steps=Number(steps||0);if(steps<=0)return;
  if(!state.expedition?.active){bankStepsAtBase(steps);return;}
  const activeObj=state.active.kind==='objective'?state.objectives.find(x=>x.id===state.active.id&&!x.complete):null;
  const returning=activeObj?.type==='returnBase';updateOutingForSteps(steps,returning);
  if(state.active.kind==='hunt') return advanceHunt(steps);
  if(state.active.kind==='river') return advanceRiver(steps);
  if(state.active.kind==='encounter'&&state.currentEncounter) return advanceEncounter(steps);
  if(state.active.kind==='objective') return advanceObjective(state.active.id,steps);
  advanceHunt(steps);
}
function advanceHunt(steps){
  if(state.hunt.stage!=='track') return;
  state.hunt.cumulative+=steps;state.hunt.remaining-=steps;state.hunt.lastProgressDate=localDayKey();
  if(!state.river.discovered&&state.hunt.cumulative>=2500){state.river.discovered=true;ensureLocation(state,'creek');addEvent('Side trail discovered','You crossed a shallow creek. It looks ordinary here, but the banks tighten upstream. You can follow it whenever you want.');}
  if(state.hunt.remaining<=0){
    state.stepCredit+=Math.abs(state.hunt.remaining);state.hunt.remaining=0;state.hunt.stage='encounter';
    state.currentEncounter=createAnimalEncounter(familySpecies(state.hunt.signFamily),{source:'main',bonusSteps:state.stepCredit,knownAnimalId:state.hunt.knownAnimalId});
    addEvent('Movement ahead','You have caught up with the sign. There are animals ahead, but you still need to glass them and decide what they are worth.');
  }else addEvent('Tracks getting fresher',`${fmt(steps)} steps on the trail. About ${fmt(state.hunt.remaining)} remain. If you leave it there, the animals may shift overnight.`);
}
function advanceRiver(steps){
  if(!state.river.discovered||state.river.ready)return;
  state.river.remaining-=steps;
  if(state.river.remaining<=0){
    state.stepCredit+=Math.abs(state.river.remaining); state.river.remaining=0; state.river.ready=true;
    const loc=ensureLocation(state,'deepHole'); loc.fishReady=true; state.xp+=300;
    addEvent('Deep water found','The shallow creek finally drops into a dark bend under timber. The hole is now marked permanently and is ready to fish.');
  }else addEvent('Upstream progress',`${fmt(steps)} steps along the creek. ${riverClue(state.river.remaining)}`);
}
function advanceEncounter(steps){
  const e=state.currentEncounter; if(!e)return;
  if(e.stage==='approach'){
    e.approachRemaining-=steps;
    if(e.approachRemaining<=0){ state.stepCredit+=Math.abs(e.approachRemaining); e.approachRemaining=0; resolveApproach(); }
    else addEvent('Closing the gap',`${fmt(steps)} steps into the approach. About ${fmt(e.approachRemaining)} remain before you are in position.`);
  }else if(e.stage==='recovery'){
    e.recoveryRemaining-=steps;
    if(e.recoveryRemaining<=0){ state.stepCredit+=Math.abs(e.recoveryRemaining); e.recoveryRemaining=0; recoverAnimal(); }
    else addEvent('Blood trail continues',`${fmt(steps)} steps on the recovery. Sign is still there; about ${fmt(e.recoveryRemaining)} remain.`);
  }
}
function advanceObjective(id,steps){
  const o=state.objectives.find(x=>x.id===id&&!x.complete); if(!o){ state.active={kind:'hunt',id:null}; return; }
  o.remaining-=steps;
  if(o.remaining<=0){ state.stepCredit+=Math.abs(o.remaining); o.remaining=0; o.complete=true; completeObjective(o); }
  else addEvent(o.progressTitle||'Side trail progress',`${fmt(steps)} steps covered. About ${fmt(o.remaining)} remain.`);
}

function newMainHunt(opts={}){
  let knownId=opts.knownAnimalId||null;
  if(!knownId){ const live=state.knownAnimals.filter(a=>a.status!=='taken'); if(live.length&&chance(.16)){ const k=pick(live); knownId=k.id; opts.family=speciesFamily(k.species); } }
  const family=opts.family||weighted(huntFamilyTable()); const distance=opts.distance||(state.currentRegion==='Back block'?randInt(10000,26000):randInt(6000,13500));
  const titles={deer:'Fresh deer sign',red:'Heavy deer sign',goat:'Fresh goat sign',pig:'Fresh pig sign',rabbit:'Rabbit sign'};
  state.hunt={id:uid('hunt'),signFamily:family,title:knownId?'Distinctive familiar sign':titles[family],startDistance:distance,remaining:distance,cumulative:0,called:false,stage:'track',knownAnimalId:knownId,lastProgressDate:null};
  state.active={kind:'hunt',id:null};
}
function huntFamilyTable(){
  const rows=[{v:'deer',w:48},{v:'pig',w:22},{v:'goat',w:20},{v:'rabbit',w:10}];
  if(state.currentRegion==='Back block') { rows[0].w=30; rows[1].w=26; rows[2].w=24; rows.push({v:'red',w:state.locations.some(l=>l.camp)?12:5}); }
  return rows;
}
function speciesFamily(species){ return ({'Fallow deer':'deer','Red deer':'red','Feral goat':'goat','Feral pig':'pig','Rabbit':'rabbit'})[species]||'deer'; }

function createAnimalEncounter(species,opts={}){
  let group=[];
  if(opts.knownAnimalId){
    const ka=state.knownAnimals.find(x=>x.id===opts.knownAnimalId||x.entityId===opts.knownAnimalId); if(ka) group=[{...ka,id:uid('animal'),knownId:ka.entityId||ka.id,entityId:ka.entityId||ka.id}];
  }
  if(!group.length) group=generateAnimalGroup(species,opts.forceBuck);
  return {id:uid('enc'),source:opts.source||'main',resumeActive:opts.resumeActive||null,group,stage:'choose',selectedAnimal:null,bonusSteps:opts.bonusSteps||0,approachRemaining:0,approachStart:0,shotRange:null,recoveryRemaining:0,recoveryStart:0};
}
function generateAnimalGroup(species,forceBuck=false){
  const count=species==='Rabbit'?randInt(1,4):species==='Fallow deer'?randInt(1,5):randInt(1,3); const arr=[];
  for(let i=0;i<count;i++) arr.push(generateAnimal(species,forceBuck&&i===0));
  if(species==='Fallow deer'&&chance(.12)) arr.push(generateAnimal(chance(.55)?'Feral pig':'Feral goat',false));
  return arr;
}
function generateAnimal(species,forceMature=false){
  const table=ANIMAL_TABLES[species]||ANIMAL_TABLES['Rabbit'];
  let rows=table.map(r=>({...r,w:Math.max(.1,Number(r.w||1)+(state.conditions?.season==='Autumn'?Number(r.autumn||0):0))}));
  let row;
  if(forceMature){const preferred=rows.filter(r=>['mature','trophy'].includes(r.quality));row=preferred.length?weighted(preferred.map(r=>({v:r,w:r.quality==='mature'?4:1}))):weighted(rows.map(r=>({v:r,w:r.w})));}
  else row=weighted(rows.map(r=>({v:r,w:r.w})));
  let a={id:uid('animal'),entityId:null,species,sex:row.sex||'',quality:row.quality||'average',metricValue:0,metricLabel:'',nickname:null};
  if(row.metric){const raw=randInt(row.metric[0],row.metric[1]);if(row.unit==='rabbitKg10'){a.metricValue=raw/10;a.metricLabel=`~${(raw/10).toFixed(1)} kg`;}else{a.metricValue=raw;a.metricLabel=`~${raw} ${row.unit}`;}}
  if(a.species==='Fallow deer'&&chance(.004)){a.variant=chance(.5)?'Albino':'Melanistic';a.quality='trophy';a.nickname=`${a.variant} fallow`;const k=registerKnownAnimal(a);if(k){a.nickname=k.nickname;a.knownId=k.entityId;a.entityId=k.entityId;}}
  if((a.quality==='mature'||a.quality==='trophy')&&chance(.4)&&!a.nickname){a.nickname=makeNickname(a);const k=registerKnownAnimal(a);if(k){a.nickname=k.nickname;a.knownId=k.entityId;a.entityId=k.entityId;}}
  return a;
}
function makeNickname(a){
  const def=SPECIES_DEFS[a.species];return def?.traits?.length?pick(def.traits):`Distinctive ${String(a.species||'animal').toLowerCase()}`;
}
function registerKnownAnimal(a){
  if(!a.nickname)return null;
  if(a.knownId){const existing=state.knownAnimals.find(x=>x.id===a.knownId||x.entityId===a.knownId);if(existing)return existing;}
  let nickname=a.nickname, n=2;while(state.knownAnimals.some(x=>x.nickname===nickname&&x.species===a.species))nickname=`${a.nickname} ${n++}`;
  const id=uid('animalEntity'),def=SPECIES_DEFS[a.species]||{};
  const known={id,entityId:id,species:a.species,sex:a.sex,quality:a.quality,metricValue:a.metricValue,metricLabel:a.metricLabel,nickname,distinctiveTrait:a.variant||nickname,status:'At large',firstSeenDate:localDayKey(),lastSeenDate:localDayKey(),lastSeen:displayDay(),homeArea:state.currentRegion||def.home?.[0]||'Home block',wariness:randInt(20,55),history:[{date:localDayKey(),event:'First seen'}]};
  state.knownAnimals.push(known);state.world.animals[known.entityId]=cloneJson(known);a.nickname=known.nickname;a.knownId=known.entityId;a.entityId=known.entityId;return known;
}
function animalDisplay(a,full=false){
  if(!a)return'Animal'; if(a.nickname)return a.nickname;
  const bin=state.gear.binoculars||0;
  if(!full&&bin===0){ if(a.species==='Fallow deer') return a.sex==='Buck'?'Buck':'Deer'; if(a.species==='Feral goat')return a.sex==='Billy'?'Billy':'Goat'; if(a.species==='Feral pig')return a.sex==='Boar'?'Boar':'Pig'; }
  let label=`${a.species} ${a.sex}`.trim(); if(bin>=2&&a.metricLabel) label+=` • ${a.metricLabel}`; else if(bin>=1&&['good','mature','trophy'].includes(a.quality)) label+=` • ${a.quality==='trophy'?'very good':a.quality}`;
  return label;
}

function openAnimalEncounter(){
  const e=state.currentEncounter; if(!e||e.stage!=='choose')return;
  $('#animalModalTitle').textContent=e.source==='main'?'You’ve caught up with the sign':'Something is ahead';
  $('#animalModalText').textContent='Nothing here is guaranteed to be a trophy. Pick an animal, or pass the group and keep looking.';
  $('#animalChoices').innerHTML=e.group.map((a,i)=>`<button class="animal-choice ${a.quality==='trophy'?'special':''}" data-animal-index="${i}"><strong>${esc(animalDisplay(a,false))}</strong><span>${esc(animalSubtext(a))}</span></button>`).join('');
  $('#animalModal').classList.remove('hidden');
}
function animalSubtext(a){
  const k=knowledgeLevel(a.species); if(state.gear.binoculars>=2&&a.metricLabel)return a.metricLabel;
  if(k>=3&&a.metricLabel)return `Looks roughly ${a.metricLabel.replace('~','')}`;
  if(['trophy','mature'].includes(a.quality)) return 'Older/heavier animal. Worth a closer look.';
  if(a.quality==='good') return 'Solid animal.'; return 'Nothing obviously exceptional.';
}
function selectAnimal(index){
  const e=state.currentEncounter; if(!e)return; e.selectedAnimal=e.group[index]; $('#animalModal').classList.add('hidden'); openApproach();
}
function openApproach(){
  const e=state.currentEncounter; if(!e?.selectedAnimal)return;
  $('#approachTitle').textContent=`Approach ${animalDisplay(e.selectedAnimal,true)}`;
  $('#approachText').textContent=`Wind is ${state.conditions.wind.toLowerCase()} and the weather is ${state.conditions.weather.toLowerCase()}. Choose how much walking you want to spend on the stalk.`;
  if(!Array.isArray(e.approachOptions)||!e.approachOptions.length){e.approachOptions=approachOptions();save();}
  const routes=e.approachOptions;
  $('#approachChoices').innerHTML=routes.map((r,i)=>`<button class="approach-choice" data-approach="${i}"><strong>${esc(r.name)} — ${fmt(r.steps)} steps</strong><span>${esc(r.desc)}</span><em>Likely shot ${r.range[0]}–${r.range[1]} m • spook risk ${Math.round(r.spook*100)}%</em></button>`).join('');
  $('#approachModal').classList.remove('hidden');
}
function approachOptions(){
  const boots=state.gear.boots||0; const fatigue=Number(state.expedition?.fatigue||0);const windPenalty=state.conditions.wind==='Gusty'?.04:state.conditions.wind==='Steady'?.01:0; const sel=state.currentEncounter?.selectedAnimal;const known=sel?.knownId?state.knownAnimals.find(x=>x.id===sel.knownId||x.entityId===sel.knownId):null;const warinessPenalty=known?clamp(Number(known.wariness||0)/1200,0,.08):0;const fatiguePenalty=clamp(fatigue/1200,0,.07);
  return [
    {name:'Straight in',steps:applyConditioningCost(randInt(550,850)),range:[175,245],spook:clamp(.27+windPenalty+warinessPenalty+fatiguePenalty-boots*.035,.08,.52),support:'none',desc:'Shortest walk, but you are relying on cover and may have to shoot unsupported.'},
    {name:'Use the timber',steps:applyConditioningCost(randInt(1100,1650)),range:[105,175],spook:clamp(.14+windPenalty+warinessPenalty+fatiguePenalty*.8-boots*.03,.04,.40),support:'rest',desc:'Longer line through cover with a better wind and usually a tree or log to lean on.'},
    {name:'Circle right around',steps:applyConditioningCost(randInt(1900,2700)),range:[60,115],spook:clamp(.06+windPenalty+warinessPenalty+fatiguePenalty*.5-boots*.018,.015,.28),support:'solid',desc:'A proper downwind circle. More walking for the best chance, closest shot and strongest rest.'}
  ];
}
function chooseApproach(i){
  const e=state.currentEncounter;if(!e)return;const routes=e.approachOptions||[];const r=routes[i];if(!r)return;
  e.approachName=r.name; e.approachSpook=r.spook; e.approachRange=r.range; e.shotSupport=r.support||'none'; e.approachStart=r.steps; e.approachRemaining=r.steps; e.stage='approach'; state.active={kind:'encounter',id:e.id}; $('#approachModal').classList.add('hidden');
  applyStepCreditToEncounter(); addEvent('Approach chosen',`${r.name}: ${fmt(r.steps)} steps to work into position.`); render();
}
function applyStepCreditToEncounter(){
  const e=state.currentEncounter; if(!e||e.stage!=='approach'||state.stepCredit<=0)return;
  const used=Math.min(state.stepCredit,e.approachRemaining); e.approachRemaining-=used; state.stepCredit-=used; if(used>0)addEvent('Extra walking counted',`${fmt(used)} steps from today’s overshoot carried straight into the approach.`); if(e.approachRemaining<=0)resolveApproach();
}
function resolveApproach(){
  const e=state.currentEncounter;if(!e)return;
  if(chance(e.approachSpook)){ const a=e.selectedAnimal; rememberEscape(a,'Busted on the approach'); addEvent('Busted',`${animalDisplay(a,true)} picked you up before you got settled and disappeared into cover.`); finishEncounter(false,true); return; }
  if(e.forcedRangeMax){const hi=Math.max(18,Math.round(e.forcedRangeMax));e.shotRange=randInt(Math.max(12,Math.round(hi*.55)),hi);e.forcedRangeMax=null;}else e.shotRange=randInt(e.approachRange[0],e.approachRange[1]); e.stage='shot'; state.active={kind:'encounter',id:e.id}; state.xp+=120; addEvent('In position',`The approach worked. ${animalDisplay(e.selectedAnimal,true)} is about ${e.shotRange} m away with ${e.shotSupport==='solid'?'a solid rest':e.shotSupport==='rest'?'some support':'no real rest'}.`);
}
function passAnimals(){
  const e=state.currentEncounter;if(!e)return; $('#animalModal').classList.add('hidden');
  addEvent('Passed the animals','Nothing there made you want to force a shot. You backed out and kept looking.');
  if(e.source==='main') newMainHunt({family:state.hunt.signFamily,distance:randInt(3200,7200)}); else { state.currentEncounter=null; state.active=e.resumeActive||{kind:'hunt',id:null}; }
  render();
}
function rememberEscape(a,reason){
  if(!a)return; let known=null;
  if(a.knownId) known=state.knownAnimals.find(x=>x.id===a.knownId||x.entityId===a.knownId);
  if(!known&&(a.quality==='trophy'||a.quality==='mature')){ if(!a.nickname)a.nickname=makeNickname(a); registerKnownAnimal(a); known=state.knownAnimals.find(x=>x.nickname===a.nickname); }
  if(known){ known.status='At large'; known.lastSeen=displayDay();known.lastSeenDate=localDayKey();known.wariness=clamp(Number(known.wariness||30)+randInt(4,10),0,100);known.history=known.history||[];known.history.push({date:localDayKey(),event:reason||'Escaped'});state.world.animals[known.entityId||known.id]=cloneJson(known); addEvent('One to remember',`${known.nickname} is still out there — and a little warier now.`); }
}

function openShot(){
  const e=state.currentEncounter;if(!e||e.stage!=='shot')return;const a=e.selectedAnimal,w=currentWeapon(),range=practicalRangeStatus(e),suit=weaponSuitability(a,w),fatigue=Number(state.expedition?.fatigue||0);
  $('#shotTitle').textContent=animalDisplay(a,true);$('#shotRangeText').textContent=`Range: ${e.shotRange} m • ${e.shotSupport==='solid'?'solid rest':e.shotSupport==='rest'?'supported':'unsupported'}`;
  $('#shotLoadoutText').textContent=`${w.name} • ${fmt(state.expedition.loaded)} loaded + ${fmt(state.expedition.spare)} spare • ${fatigueLabel(fatigue)} • ${suit.label}`;
  const support=shotSupportBonus(e),rangePenalty=clamp(e.shotRange/Math.max(1,w.practicalRange),.25,1.8),base=102*w.handling*(1+support)*(1-fatigue*.0045);const width=clamp(base-(rangePenalty*28)+(state.gear.scope||0)*8,26,118);$('#vitalsZone').style.width=`${width}px`;
  const noAmmo=Number(state.expedition.loaded||0)<=0,outOfRange=!range.inRange,unsuitable=!suit.ok;
  $('#reloadShotBtn').classList.toggle('hidden',!(noAmmo&&Number(state.expedition.spare||0)>0));$('#stalkCloserBtn').classList.toggle('hidden',!outOfRange);$('#fireBtn').disabled=noAmmo||outOfRange||unsuitable;$('#fireBtn').style.opacity=$('#fireBtn').disabled?'.45':'1';
  $('#shotAdviceText').textContent=unsuitable?suit.message:outOfRange?`${w.name} is a poor fit for a ${e.shotRange} m opportunity in this game. Stalk closer or back out.`:noAmmo?(state.expedition.spare>0?'Reload from your spare rounds before taking the shot.':'No ammunition left. You need to return to camp.'):`${suit.message} Fatigue and the available rest affect how steady the shot feels.`;
  $('#shotModal').classList.remove('hidden');aimPos=0;aimDir=1;clearInterval(aimTimer);const speed=clamp(Math.round(13/w.handling+fatigue*.035-support*9),7,19);aimTimer=setInterval(()=>{aimPos+=aimDir*speed;if(aimPos>=100){aimPos=100;aimDir=-1}if(aimPos<=0){aimPos=0;aimDir=1}$('#aimMarker').style.left=`calc(${aimPos}% - 1px)`},45);
}
function stalkCloserFromShot(){const e=state.currentEncounter;if(!e||e.stage!=='shot')return;clearInterval(aimTimer);$('#shotModal').classList.add('hidden');const w=currentWeapon();const extra=applyConditioningCost(randInt(500,1400)+Math.max(0,e.shotRange-w.practicalRange)*5);e.stage='approach';e.approachName='Close the final gap';e.approachSpook=clamp(.10+Number(state.expedition?.fatigue||0)/1400-(state.gear.boots||0)*.02,.03,.28);e.approachStart=extra;e.approachRemaining=extra;e.forcedRangeMax=Math.max(18,Math.round(w.practicalRange*.88));e.shotSupport=e.shotSupport==='none'?'rest':e.shotSupport;state.active={kind:'encounter',id:e.id};addEvent('Stalking closer',`${w.name} needs a closer opportunity. Another ${fmt(extra)} steps should put you inside its practical game range.`);render();}
function fireShot(){
  clearInterval(aimTimer);const e=state.currentEncounter;if(!e)return;const a=e.selectedAnimal,w=currentWeapon(),range=practicalRangeStatus(e),suit=weaponSuitability(a,w);if(Number(state.expedition.loaded||0)<=0||!range.inRange||!suit.ok){openShot();return;}state.expedition.loaded--;const boxW=$('#aimBox').clientWidth;const marker=aimPos/100*boxW;const zoneW=$('#vitalsZone').getBoundingClientRect().width;const err=Math.abs(marker-boxW/2);$('#shotModal').classList.add('hidden');e.lastWeaponId=w.id;
  if(err<=zoneW*.5){e.shotQuality='clean';harvestAnimal(a,'Clean hit','clean');}
  else if(err<=zoneW*.9){e.stage='recovery';e.shotQuality='marginal';e.recoveryStart=randInt(1100,3200);e.recoveryRemaining=e.recoveryStart;state.active={kind:'encounter',id:e.id};addEvent('Marginal hit',`The animal disappeared into cover, but there is sign to follow. Recovery is about ${fmt(e.recoveryRemaining)} steps. ${fmt(availableAmmo())} round${availableAmmo()===1?'':'s'} remain in the field.`);}
  else{rememberEscape(a,'Missed');addEvent('Missed opportunity',`${animalDisplay(a,true)} vanished after the shot. ${fmt(availableAmmo())} round${availableAmmo()===1?'':'s'} remain.`);finishEncounter(false,true);}
  render();
}
function recoverAnimal(){const e=state.currentEncounter;if(!e)return;harvestAnimal(e.selectedAnimal,'Recovered',e.shotQuality||'marginal');}
function harvestAnimal(a,how,shotQuality='clean'){
  const metric=a.metricValue||0,notable=['trophy','mature'].includes(a.quality)||(a.species==='Feral pig'&&metric>=120)||(a.species==='Feral goat'&&metric>=95);const recovery=recoveryRoll(a,shotQuality);addRecoveryToHaul(a,recovery);state.xp+=notable?520:260;gainKnowledge(a.species,2);
  if(notable){state.trophies.unshift({id:uid('t'),type:'animal',species:a.species,name:a.nickname||animalDisplay(a,true),detail:`${a.metricLabel||a.sex} • ${how} • hide ${recovery.hideCondition.toLowerCase()}`,metricValue:metric,metricLabel:a.metricLabel,date:displayDay()});}
  if(a.knownId){const k=state.knownAnimals.find(x=>x.id===a.knownId||x.entityId===a.knownId);if(k){k.status='taken';k.lastSeenDate=localDayKey();k.history=k.history||[];k.history.push({date:localDayKey(),event:'Taken'});state.world.animals[k.entityId||k.id]=cloneJson(k);}}else if(a.nickname){const k=state.knownAnimals.find(x=>x.nickname===a.nickname&&x.species===a.species);if(k)k.status='taken';}
  const damageNote=recovery.suitability.includes('overkill')?` The ${currentWeapon().name} caused ${recovery.suitability} damage.`:'';addEvent(how,`${animalDisplay(a,true)} recovered: ${recovery.meatKg.toFixed(1)} kg usable meat, ${recovery.scrapsKg.toFixed(1)} kg bait scraps, hide ${recovery.hideCondition.toLowerCase()}${recovery.hideValue?` (about $${recovery.hideValue})`:''}.${damageNote}`);finishEncounter(true,false);createBackup(`After animal ${a.species}`);
}
function animalPayout(a){if(a.species==='Fallow deer')return a.sex==='Buck'?randInt(180,320):randInt(90,160);if(a.species==='Red deer')return a.sex==='Stag'?randInt(260,460):randInt(130,220);if(a.species==='Feral pig')return randInt(110,260);if(a.species==='Feral goat')return randInt(100,220);return randInt(25,60);}
function finishEncounter(success,escaped){
  const e=state.currentEncounter;if(!e)return;const source=e.source,resume=e.resumeActive;state.currentEncounter=null;
  if(availableAmmo()<=0&&state.expedition?.active){const dist=Math.max(800,Math.round(state.expedition.distanceFromBase||0));const o=createObjective({type:'returnBase',title:`Return to ${currentBaseName()} for ammunition`,story:'You have no ammunition left in the field. Walk back to camp to unload the haul and resupply.',distance:dist,tag:'OUT OF AMMO',data:{baseId:currentStoreKey()}});setObjectiveActive(o.id);addEvent('Out of ammunition',`The hunt is over until you cover about ${fmt(dist)} steps back to ${currentBaseName()}.`);return;}
  if(source==='main')newMainHunt();else state.active=resume||{kind:'hunt',id:null};
}

function useCall(){
  const h=state.hunt;if(h.stage!=='track'||h.called||state.gear.call<1)return; h.called=true;
  const roll=worldRandom();
  if(roll<.48){ const moved=Math.min(h.remaining-300,randInt(500,1800)); if(moved>0)h.remaining-=moved; addEvent('Call answered',`Something moved in response. The sign feels ${fmt(Math.max(0,moved))} steps closer.`); }
  else if(roll<.78){ const species=weighted([{v:'Feral pig',w:45},{v:'Feral goat',w:40},{v:'Fallow deer',w:15}]); state.pendingEncounter={id:uid('pending'),kind:'animal',species,title:`Different animal answers the country`,text:`While you are waiting on the call, ${species.toLowerCase()} sign shows up nearby. Chase it or stay on your original trail?`,distance:randInt(1300,3400),chaseLabel:`Chase ${species.toLowerCase()}`,createdDate:localDayKey()}; scheduleWorldEvent('pendingExpire',addDaysKey(localDayKey(),1+conditioningPerks().signDays),{pendingId:state.pendingEncounter.id},`pending:${state.pendingEncounter.id}`); addEvent('Something else showed up',`The call did not bring your target in cleanly, but ${species.toLowerCase()} sign appeared nearby.`); }
  else{ h.remaining+=randInt(250,700); addEvent('Wrong move','The country went quiet after the call. Whatever was ahead shifted away a little.'); }
  render();
}

function maybeBranchEncounter(steps){
  if(state.pendingEncounter||state.currentEncounter||steps<2200)return;
  let p=state.active.kind==='river'?.38:.22; if(state.conditions.weather==='Showers')p+=.05; if(!chance(p))return;
  const species=weighted([{v:'Feral pig',w:42},{v:'Feral goat',w:30},{v:'Fallow deer',w:20},{v:'Rabbit',w:8}]);
  const context=state.active.kind==='river'?'crosses the creek':'cuts across your line';
  state.pendingEncounter={id:uid('pending'),kind:'animal',species,title:`Fresh ${species.toLowerCase()} sign ${context}`,text:`You were heading somewhere else, but this sign is fresh. Following it will pause your current plan rather than delete it.`,distance:randInt(1200,4200),chaseLabel:`Chase ${species.toLowerCase()}`,createdDate:localDayKey()}; scheduleWorldEvent('pendingExpire',addDaysKey(localDayKey(),1+conditioningPerks().signDays),{pendingId:state.pendingEncounter.id},`pending:${state.pendingEncounter.id}`);
}
function choosePendingEncounter(){
  const p=state.pendingEncounter;if(!p)return; const resume={...state.active};
  const o=createObjective({type:'branchHunt',title:`Follow ${p.species.toLowerCase()} sign`,story:'Fresh sign is cutting away from your original route. See where it leads.',distance:p.distance,tag:'DISTRACTION',data:{species:p.species,resumeActive:resume}});
  state.pendingEncounter=null; setObjectiveActive(o.id,true); addEvent('Changed plans',`You left the original route and started following ${p.species.toLowerCase()} sign.`); render();
}
function ignorePendingEncounter(){ if(!state.pendingEncounter)return; addEvent('Stayed on plan',`You marked the ${state.pendingEncounter.species.toLowerCase()} sign mentally and kept moving on the original route.`); state.pendingEncounter=null; render(); }

function createObjective({type,title,story,distance,tag,data={},expiresDays=null}){
  const createdDate=localDayKey();
  if(expiresDays==null&&type==='branchHunt')expiresDays=2+conditioningPerks().signDays;
  const o={id:uid('obj'),type,title,story,startDistance:distance,remaining:distance,tag,data,complete:false,createdClaim:state.claimCount,createdDate,expiresDate:expiresDays?addDaysKey(createdDate,expiresDays):null};
  state.objectives.push(o);if(o.expiresDate)scheduleWorldEvent('objectiveExpire',addDaysKey(o.expiresDate,1),{objectiveId:o.id},`objectiveExpire:${o.id}`);return o;
}
function setObjectiveActive(id,useCredit=false){ state.active={kind:'objective',id}; if(useCredit&&state.stepCredit>0){ const o=state.objectives.find(x=>x.id===id); if(o){const used=Math.min(state.stepCredit,o.remaining);o.remaining-=used;state.stepCredit-=used;if(used)addEvent('Extra walking counted',`${fmt(used)} leftover steps carried straight into ${o.title.toLowerCase()}.`);if(o.remaining<=0){o.complete=true;completeObjective(o);}} } }
function completeObjective(o){
  addEvent('Trail completed',`${o.title} reached.`);
  if(['branchHunt','ambush','rabbitHunt','glassHunt'].includes(o.type)){
    const species=o.type==='rabbitHunt'?'Rabbit':o.data.species||speciesForLocation(getLoc(o.data.locationId));
    state.currentEncounter=createAnimalEncounter(species,{source:'side',resumeActive:o.data.resumeActive||{kind:'hunt',id:null},bonusSteps:state.stepCredit,knownAnimalId:o.data.knownAnimalId||null}); state.currentEncounter.stage='choose'; state.active={kind:'encounter',id:state.currentEncounter.id}; addEvent('Animals ahead',`The side trail paid off. You have ${species.toLowerCase()} ahead.`);
  }else if(o.type==='fishReturn'){
    const loc=getLoc(o.data.locationId); if(loc)loc.fishReady=true; state.active=o.data.resumeActive||{kind:'hunt',id:null}; addEvent('Back at the water',`${loc?.name||'The fishing spot'} is ready for another session.`);
  }else if(o.type==='cameraCheck'){ checkCameraNow(o.data.cameraId); state.active=o.data.resumeActive||{kind:'hunt',id:null}; }
  else if(o.type==='netCheck'){ checkNetNow(o.data.netId); state.active=o.data.resumeActive||{kind:'hunt',id:null}; }
  else if(o.type==='campBuild'){
    const loc=getLoc(o.data.locationId); if(loc){loc.camp=true;loc.campState={active:true,foodKg:0,lastOccupiedDay:null};const key=`camp:${loc.id}`;state.campStores[key]={...freshStore(loc.name),foodKg:0,meatKg:0,scrapsKg:0,yabbies:0,hides:[],ammo:{'22lr':0,'44lever':0,'223':0,'3006':0}};} state.xp+=300; state.active=o.data.resumeActive||{kind:'hunt',id:null}; addEvent('Camp established','The shelter is permanent, but it has no food yet. Carry meat in before trying to live out of it.');
  }else if(o.type==='returnBase'){finishReturnToBase();}
  else if(o.type==='campTravel'){const loc=getLoc(o.data.locationId);if(loc)settleAtCamp(`camp:${loc.id}`);state.active={kind:'hunt',id:null};}
  else if(o.type==='campResupply'){const loc=getLoc(o.data.locationId);if(loc)completeCampResupply(loc);state.active={kind:'hunt',id:null};}
  render();
}
function expireOldObjectives(day=localDayKey()){
  for(const o of state.objectives){
    const oldExpired=o.expiresAtClaim&&state.claimCount>o.expiresAtClaim;
    const dayExpired=o.expiresDate&&day>o.expiresDate;
    if((oldExpired||dayExpired)&&!o.complete){o.complete=true;addEvent('Sign went cold',`${o.title} faded before you got back to it.`);}
  }
  if(state.active.kind==='objective'){const o=state.objectives.find(x=>x.id===state.active.id);if(!o||o.complete)state.active={kind:'hunt',id:null};}
}

function ambientDiscovery(steps){
  if(steps<1800)return; const discoveryChance=clamp(.11+steps/26000+(state.gear.pack||0)*.025+conditioningPerks().discoveryBonus,.12,.55); if(!chance(discoveryChance))return;
  const pool=state.active.kind==='river'?['gameTrail','crossing','oldHut','rabbitWarren','farmDam','campsite']:['gameTrail','wallow','rabbitWarren','oldHut','ridge','crossing','farmDam','campsite'];
  const remaining=pool.filter(id=>!state.locations.some(l=>l.templateId===id)); if(!remaining.length)return; const id=pick(remaining); const loc=discoverLocation(id,discoveryStory(id));
  if(loc&&['gameTrail','wallow','crossing','farmDam'].includes(id)&&chance(.25)) maybeCreateKnownAnimalFromSign(id);
}
function discoveryStory(id){
  return ({gameTrail:'A heavily used animal trail cuts through the scrub. It is now marked on the map.',wallow:'Fresh mud and churned edges reveal a wallow worth checking again.',rabbitWarren:'A cluster of active rabbit holes appears on a sunny bank.',oldHut:'You push through scrub and find an old half-collapsed hut.',ridge:'The timber opens onto a ridge with a good view over the block.',crossing:'Tracks converge at a narrow creek crossing.',farmDam:'A hidden old farm dam appears beyond the timber.',campsite:'A flat sheltered patch beside water looks good enough to use as a future camp.'})[id]||'A new place is now marked.';
}
function maybeCreateKnownAnimalFromSign(id){
  const species=id==='wallow'?'Feral pig':weighted([{v:'Fallow deer',w:50},{v:'Feral pig',w:25},{v:'Feral goat',w:25}]); const a=generateAnimal(species,true); if(!a.nickname){a.nickname=makeNickname(a);registerKnownAnimal(a);} addEvent('Distinctive sign',`Something about the sign suggests a particular ${species.toLowerCase()} is using this spot regularly.`);
}
function maybeGatherBait(steps){
  if(state.active.kind!=='river'||steps<1800||!chance(.22))return; const qty=randInt(1,3); state.inventory.Bait+=qty; addEvent('Bait gathered',`Found enough worms/shrimp along the creek edge for ${qty} extra bait uses.`);
}
function maybeFindTackle(steps){
  if(state.active.kind!=='river'||steps<2200||!chance(.10+(state.gear.pack||0)*.03))return;
  const item=weighted([{v:'Spinnerbait',w:24},{v:'Surface lure',w:18},{v:'Soft plastic',w:42},{v:'Bait',w:16}]); state.inventory[item]=(state.inventory[item]||0)+1; addEvent('Old tackle found',`Something shiny in a tree/snags turned out to be a usable ${item.toLowerCase()}. Into the tackle box it goes.`);
}

function getLoc(id){ return state.locations.find(x=>x.id===id); }
function speciesForLocation(loc){
  if(!loc)return'Fallow deer'; if(loc.templateId==='wallow')return'Feral pig'; if(loc.templateId==='rabbitWarren')return'Rabbit';
  return weighted(state.currentRegion==='Back block'?[{v:'Fallow deer',w:28},{v:'Red deer',w:16},{v:'Feral pig',w:30},{v:'Feral goat',w:26}]:[{v:'Fallow deer',w:45},{v:'Feral pig',w:30},{v:'Feral goat',w:25}]);
}
function locationAction(action,locId){
  const loc=getLoc(locId); if(!loc)return;
  if(action==='fish'){
    if(loc.fishReady) openFishing(loc.id); else { const existing=state.objectives.find(o=>!o.complete&&o.type==='fishReturn'&&o.data.locationId===loc.id); if(existing){setObjectiveActive(existing.id);render();return;} const o=createObjective({type:'fishReturn',title:`Walk back to ${loc.name}`,story:'The spot is still there, but another fishing session means physically getting back to it.',distance:applyConditioningCost(loc.baseReturnDistance||loc.returnDistance),tag:'FISHING',data:{locationId:loc.id,resumeActive:{...state.active}}}); setObjectiveActive(o.id,true); render(); }
  }else if(action==='glass')glassLocation(loc);
  else if(action==='cameraPlace') placeCamera(loc);
  else if(action==='cameraCheck') startCameraCheck(loc);
  else if(action==='netPlace') placeNet(loc);
  else if(action==='netCheck') startNetCheck(loc);
  else if(action==='ambush') startAmbush(loc);
  else if(action==='rabbit') startRabbitHunt(loc);
  else if(action==='camp') startCamp(loc);
  else if(action==='campUse') startCampUse(loc);
  else if(action==='campResupply') startCampResupply(loc);
  else if(action==='region') toggleRegion();
}
function placeCamera(loc){
  if((state.inventory.trailCameras||0)<1){addEvent('No trail camera','You need to buy or find another camera first.');render();return;} if(state.cameras.some(c=>c.locationId===loc.id))return;
  state.inventory.trailCameras--; const cam={id:uid('cam'),locationId:loc.id,placedClaim:state.claimCount,placedDate:localDayKey(),ready:false,lastPhoto:null};cam.entityId=cam.id;state.cameras.push(cam);scheduleWorldEvent('cameraReady',addDaysKey(localDayKey(),1),{cameraId:cam.id},`cameraReady:${cam.id}`); addEvent('Camera set',`Trail camera left at ${loc.name}. It needs at least another day before it is worth walking back to check.`);render();
}
function matureFieldGear(day=localDayKey()){
  for(const c of state.cameras)if(c.placedDate&&day>c.placedDate)c.ready=true;
  for(const n of state.nets)if(n.placedDate&&day>n.placedDate)n.ready=true;
}
function startCameraCheck(loc){
  const cam=state.cameras.find(c=>c.locationId===loc.id); if(!cam||!cam.ready)return;
  const existing=state.objectives.find(o=>!o.complete&&o.type==='cameraCheck'&&o.data.cameraId===cam.id); if(existing){setObjectiveActive(existing.id);render();return;}
  const o=createObjective({type:'cameraCheck',title:`Check camera at ${loc.name}`,story:'The camera may have something, but you still need to walk back in to pull the card.',distance:applyConditioningCost(loc.baseReturnDistance||loc.returnDistance),tag:'CAMERA',data:{cameraId:cam.id,resumeActive:{...state.active}}});setObjectiveActive(o.id,true);render();
}
function checkCameraNow(camId){
  const cam=state.cameras.find(c=>c.id===camId);if(!cam)return;const loc=getLoc(cam.locationId);cam.ready=false;cam.placedClaim=state.claimCount;cam.placedDate=localDayKey();
  const blank=chance(.18);if(blank){addEvent('Camera check',`Nothing useful on the camera at ${loc?.name||'the site'}. A few blurry shapes and an empty track.`);return;}
  let animal=null; const live=state.knownAnimals.filter(a=>a.status!=='taken'); if(live.length&&chance(.38))animal=pick(live);
  if(!animal){const a=generateAnimal(speciesForLocation(loc),chance(.28)); if(a.nickname){animal=state.knownAnimals.find(x=>x.nickname===a.nickname)||a;}else animal=a;}
  cam.lastPhoto=displayDay(); addEvent('Camera photo',`${animal.nickname||animalDisplay(animal,true)} showed up at ${loc?.name||'the camera site'}.`); if(animal.nickname){const known=state.knownAnimals.find(x=>x.nickname===animal.nickname);if(known){known.lastSeen=displayDay();known.status='At large';}}
}
function placeNet(loc){
  if((state.inventory.yabbyNets||0)<1){addEvent('No yabby net','You need another net before you can set one here.');render();return;}if(state.nets.some(n=>n.locationId===loc.id))return;
  const bait=consumeTrapBait();if(!bait){addEvent('No meat for the net','You need at least a little meat or scraps in the field haul/camp store to bait the yabby net.');render();return;}
  state.inventory.yabbyNets--;loc.trapQuality=Number(loc.trapQuality||(.82+worldRandom()*.38));const net={id:uid('net'),locationId:loc.id,placedClaim:state.claimCount,placedDate:localDayKey(),ready:false,bait,pressureAtSet:Number(loc.trapPressure||0)};net.entityId=net.id;state.nets.push(net);scheduleWorldEvent('netReady',addDaysKey(localDayKey(),1),{netId:net.id},`netReady:${net.id}`);addEvent('Yabby net set',`A net baited with ${bait} is left at ${loc.name}. This water is ${Number(loc.trapPressure||0)<.15?'fresh and relatively untouched':'already seeing some trap pressure'}.`);render();
}
function startNetCheck(loc){
  const net=state.nets.find(n=>n.locationId===loc.id);if(!net||!net.ready)return;const existing=state.objectives.find(o=>!o.complete&&o.type==='netCheck'&&o.data.netId===net.id);if(existing){setObjectiveActive(existing.id);render();return;}
  const o=createObjective({type:'netCheck',title:`Check yabby net at ${loc.name}`,story:'The net has soaked long enough. Time to physically walk back and check it.',distance:applyConditioningCost(loc.baseReturnDistance||loc.returnDistance),tag:'NET',data:{netId:net.id,resumeActive:{...state.active}}});setObjectiveActive(o.id,true);render();
}
function checkNetNow(netId){
  const net=state.nets.find(n=>n.id===netId);if(!net)return;const loc=getLoc(net.locationId);const pressure=clamp(Number(net.pressureAtSet??loc?.trapPressure??0),0,.9),quality=Number(loc?.trapQuality||1);const zeroChance=clamp(.08+pressure*.46-quality*.04,.04,.58);let n=0;if(!chance(zeroChance)){const max=Math.max(2,Math.round((7+quality*10)*(1-pressure*.72)));n=randInt(1,max);if(chance(.10*(1-pressure)))n=Math.min(24,n+randInt(3,7));}
  net.ready=false;net.placedClaim=state.claimCount;net.placedDate=localDayKey();if(loc){loc.trapSets=Number(loc.trapSets||0)+1;loc.trapPressure=clamp(Number(loc.trapPressure||0)+.16+n*.012,0,.85);}if(n===0)addEvent('Empty net',`Nothing in the yabby net at ${loc?.name||'the water'}. Even fresh-looking water can blank sometimes.`);else{state.expedition.haul.yabbies=Number(state.expedition.haul.yabbies||0)+n;state.xp+=n*22;addEvent('Yabby net checked',`${n} yabby${n===1?'':'ies'} in the net. They are now in the field haul and can be eaten or used as fishing bait.`);}state.nets=state.nets.filter(x=>x.id!==netId);state.inventory.yabbyNets=Number(state.inventory.yabbyNets||0)+1;
}
function startAmbush(loc){
  const o=createObjective({type:'ambush',title:`Walk into ${loc.name} and sit`,story:'Get into the spot quietly, then let the country come to you.',distance:randInt(1400,2800),tag:'AMBUSH',data:{locationId:loc.id,species:speciesForLocation(loc),resumeActive:{...state.active}}});setObjectiveActive(o.id,true);render();
}
function startRabbitHunt(loc){const o=createObjective({type:'rabbitHunt',title:'Work the rabbit warren',story:'Walk the edges and get into a position where the rabbits start showing again.',distance:randInt(1000,2300),tag:'RABBITS',data:{locationId:loc.id,resumeActive:{...state.active}}});setObjectiveActive(o.id,true);render();}
function startCamp(loc){const o=createObjective({type:'campBuild',title:`Establish camp at ${loc.name}`,story:'Carry gear in, scout the immediate area and turn this into a permanent jumping-off point.',distance:4000,tag:'CAMP',data:{locationId:loc.id,resumeActive:{...state.active}}});setObjectiveActive(o.id,true);render();}
function toggleRegion(){ if(state.gear.uteAccess<1)return; state.currentRegion=state.currentRegion==='Back block'?'Home block':'Back block'; addEvent('Changed country',`You are now hunting the ${state.currentRegion.toLowerCase()}. The vehicle only gets you to the edge; the actual hunting still costs real steps.`); newMainHunt();render(); }

function openFishing(locId){
  const loc=getLoc(locId);if(!loc||!loc.fishery||!loc.fishReady)return;
  if(!state.fishSession||state.fishSession.locationId!==locId||state.fishSession.ended){
    const snagAt=randInt(11,21);state.fishSession={locationId:locId,snagAt,casts:0,caught:0,ended:false,log:[],createdAt:new Date().toISOString()};save();
  }
  selectedLure=firstAvailableLure();renderFishingModal();$('#fishModal').classList.remove('hidden');
}
function firstAvailableLure(){ if(availableYabbies()>0)return'Yabby bait';return ['Spinnerbait','Surface lure','Soft plastic','Bait'].find(x=>(state.inventory[x]||0)>0)||'Bait'; }
function renderFishingModal(){
  const s=state.fishSession;if(!s)return;const loc=getLoc(s.locationId);$('#fishTitle').textContent=loc?.name||'Fishing spot';$('#fishSpotText').textContent=`${loc?.desc||''} You get somewhere between 10 and 20 casts before a snag eventually ends the visit.`;
  const lures=['Spinnerbait','Surface lure','Soft plastic','Bait','Yabby bait'];$('#lureGrid').innerHTML=lures.map(l=>{const qty=l==='Yabby bait'?availableYabbies():Number(state.inventory[l]||0);return `<button class="lure ${selectedLure===l?'selected':''}" data-lure="${l}" ${qty<1?'disabled':''}><strong>${l}</strong><small>${fmt(qty)} ${l==='Yabby bait'?'yabbies available':'in tackle box'}</small></button>`}).join('');
  $('#castCountText').textContent=`Cast ${s.casts}`;$('#fishCountText').textContent=`${s.caught} fish`;$('#fishSessionLog').innerHTML=s.log.slice().reverse().map(x=>`<div>${esc(x)}</div>`).join('');$('#castBtn').disabled=s.ended||!!state.pendingFish;$('#castBtn').textContent=s.ended?'Session finished':state.pendingFish?'Fish on…':'Cast'; if(s.ended)$('#fishResult').textContent='That visit is finished. Walk back another day if you want another session.';
}
function castLine(){
  const s=state.fishSession;if(!s||s.ended||state.pendingFish)return; const qty=selectedLure==='Yabby bait'?availableYabbies():Number(state.inventory[selectedLure]||0);if(qty<1){selectedLure=firstAvailableLure();renderFishingModal();return;}
  if(selectedLure==='Yabby bait'&&!consumeYabby()){selectedLure=firstAvailableLure();renderFishingModal();return;}
  s.casts++;
  if(s.casts>=s.snagAt){ endFishingOnSnag(); render(); return; }
  const loc=getLoc(s.locationId),fishery=FISHERIES[loc.fishery]; let catchP=.28+(state.gear.rod||0)*.015;
  if(state.conditions.weather==='Overcast')catchP+=.04;if(state.conditions.weather==='Showers')catchP+=.07;if(state.conditions.weather==='Hot')catchP-=.025;if(state.conditions.season==='Spring')catchP+=.015;catchP-=clamp(loc.pressure||0,0,.35);catchP*=fishery.lureBias[selectedLure]||1;
  if(s.caught===0&&s.casts>=7)catchP+=.16;if(s.caught===0&&s.casts>=s.snagAt-2)catchP=.95;if(s.caught===0&&s.casts===s.snagAt-1)catchP=1;
  if(chance(clamp(catchP,.12,1))){ const fish=rollFish(fishery); if(fish.trophy){state.pendingFish=fish;startFishFight(fish);}else landFish(fish); }
  else{const msg=pick(['Nothing touched it.','A small swirl behind the lure, but no hook-up.','A tap near the timber and then nothing.','Dead cast.']);s.log.push(`Cast ${s.casts}: ${msg}`);$('#fishResult').textContent=msg;}
  renderFishingModal(); save();
}
function rollFish(fishery){
  const spec=weighted(fishery.species.map(x=>({v:x,w:x.w})));let size=randInt(spec.min,spec.max);const k=knowledgeLevel(spec.name);if(k>=3&&chance(.12))size=Math.min(spec.max,size+randInt(2,6));return{species:spec.name,size,metric:spec.metric,trophy:size>=spec.trophy,threshold:spec.trophy,lure:selectedLure};
}
function landFish(fish){
  const s=state.fishSession;s.caught++;gainKnowledge(fish.species,1);const msg=`${fish.species}: ${fish.size} ${fish.metric} on the ${fish.lure.toLowerCase()}.`;s.log.push(`Cast ${s.casts}: ${msg}`);$('#fishResult').textContent=msg;state.xp+=fish.trophy?380:90;state.cash+=fish.trophy?randInt(160,280):randInt(25,80);
  if(fish.trophy){state.trophies.unshift({id:uid('t'),type:'fish',species:fish.species,name:`Trophy ${fish.species}`,detail:`${fish.size} ${fish.metric} • ${fish.lure}`,metricValue:fish.size,metricLabel:`${fish.size} ${fish.metric}`,date:displayDay()});addEvent('Trophy fish',`${fish.size} ${fish.metric} ${fish.species} landed from ${getLoc(s.locationId)?.name||'the water'}.`);}else if(chance(.28))addEvent('Fish landed',msg);
  state.pendingFish=null;if(fish.trophy)createBackup(`After trophy fish ${fish.species}`);renderFishingModal();render();
}
function endFishingOnSnag(){
  const s=state.fishSession;s.ended=true;const loc=getLoc(s.locationId);let lost='';if(!['Bait','Yabby bait'].includes(selectedLure)&&chance(.7)&&(state.inventory[selectedLure]||0)>0){state.inventory[selectedLure]--;lost=` and lost the ${selectedLure.toLowerCase()}`;}s.log.push(`Cast ${s.casts}: Buried in the snag${lost}. Session over.`);$('#fishResult').textContent=`Buried it in the timber${lost}. That ends this visit.`;loc.fishReady=false;loc.baseReturnDistance=randInt(1400,3200);loc.returnDistance=applyConditioningCost(loc.baseReturnDistance);loc.pressure=clamp((loc.pressure||0)+.14,0,.6);addEvent('Snagged up',`After ${s.casts-1} usable casts and ${s.caught} fish, the lure finally found the timber. You will have to walk back another day for another session.`);renderFishingModal();save();
}
function startFishFight(fish){
  $('#fightTitle').textContent=`${fish.species} — looks like a good one`;$('#fightText').textContent=`This fish is around the trophy mark. Hit REEL three times with the marker in the safe zone before you make two bad pulls.`;fightGood=0;fightBad=0;fightPos=0;fightDir=1;
  const rod=state.gear.rod||0;const difficulty=clamp((fish.size-fish.threshold)/Math.max(1,fish.threshold),0,.35);const width=clamp(34+rod*7-difficulty*35,22,55);$('#safeZone').style.width=`${width}%`;$('#safeZone').style.left=`${50-width/2}%`;$('#fightScore').textContent='Good pressure: 0 / 3';$('#fightModal').classList.remove('hidden');clearInterval(fightTimer);fightTimer=setInterval(()=>{fightPos+=fightDir*6;if(fightPos>=100){fightPos=100;fightDir=-1}if(fightPos<=0){fightPos=0;fightDir=1}$('#tensionMarker').style.left=`calc(${fightPos}% - 2px)`},45);
}
function reelFish(){
  const fish=state.pendingFish;if(!fish)return;const zone=$('#safeZone').getBoundingClientRect(),box=$('#fightBox').getBoundingClientRect();const x=box.left+fightPos/100*box.width;if(x>=zone.left&&x<=zone.right)fightGood++;else fightBad++;$('#fightScore').textContent=`Good pressure: ${fightGood} / 3 • bad pulls ${fightBad} / 2`;
  if(fightGood>=3){clearInterval(fightTimer);$('#fightModal').classList.add('hidden');landFish(fish);}else if(fightBad>=2){clearInterval(fightTimer);$('#fightModal').classList.add('hidden');state.fishSession.log.push(`Cast ${state.fishSession.casts}: A big ${fish.species.toLowerCase()} pulled free.`);$('#fishResult').textContent=`Lost a good ${fish.species.toLowerCase()} during the fight.`;addEvent('Fish lost',`A likely trophy ${fish.species.toLowerCase()} pulled free beside the snag.`);state.pendingFish=null;renderFishingModal();render();}
}

function buyGear(id){
  const g=GEAR.find(x=>x.id===id);if(!g)return;const lvl=state.gear[id]||0;if(lvl>=g.max)return;if(g.level&&level()<g.level)return;const price=Math.round(g.base*(1+lvl*.65));if(state.cash<price){addEvent('Not enough cash',`${g.name} costs $${price}.`);render();return;}state.cash-=price;state.gear[id]=lvl+1;addEvent('Gear upgraded',`${g.name} is now level ${state.gear[id]}.`);if(id==='uteAccess')discoverLocation('backblockGate','You now have access to a track that reaches the back block.');render();
}
function buyItem(id,price){if(state.cash<price){addEvent('Not enough cash',`You need $${price} for that.`);render();return;}state.cash-=price;state.inventory[id]=(state.inventory[id]||0)+1;addEvent('Gear bought',`Added one ${id} to the kit.`);render();}

function buyWeapon(id,price){const w=WEAPONS[id];if(!w||state.armoury.owned.includes(id))return;if(state.cash<price){addEvent('Not enough cash',`${w.name} costs $${price}.`);render();return;}state.cash-=price;state.armoury.owned.push(id);state.campStores.main.ammo[id]=Number(state.campStores.main.ammo[id]||0)+w.ammoPack;addEvent('Rifle bought',`${w.name} added to the Main Camp armoury with ${w.ammoPack} rounds to get started.`);render();}
function buyAmmo(id,price){const w=WEAPONS[id];if(!w||!state.armoury.owned.includes(id))return;if(state.cash<price){addEvent('Not enough cash',`${w.ammoPack} rounds for ${w.name} costs $${price}.`);render();return;}state.cash-=price;state.campStores.main.ammo[id]=Number(state.campStores.main.ammo[id]||0)+w.ammoPack;addEvent('Ammunition bought',`${w.ammoPack} rounds for ${w.name} added to Main Camp stores.`);render();}

// Event listeners
$('#claimBtn').addEventListener('click',claimSteps);
$('#selectHuntBtn').addEventListener('click',()=>{state.active={kind:'hunt',id:null};render()});
$('#selectRiverBtn').addEventListener('click',()=>{if(state.river.discovered&&!state.river.ready){state.active={kind:'river',id:null};render()}});
$('#callBtn').addEventListener('click',useCall);$('#encounterBtn').addEventListener('click',openAnimalEncounter);
$('#encounterActionBtn').addEventListener('click',()=>{ const e=state.currentEncounter;if(!e)return;if(e.stage==='choose')openAnimalEncounter();else if(e.stage==='shot')openShot();else{state.active={kind:'encounter',id:e.id};render();} });
$('#chaseChoiceBtn').addEventListener('click',choosePendingEncounter);$('#ignoreChoiceBtn').addEventListener('click',ignorePendingEncounter);
$('#objectiveList').addEventListener('click',e=>{const b=e.target.closest('[data-objective]');if(!b)return;setObjectiveActive(b.dataset.objective);render()});
$('#locationList').addEventListener('click',e=>{const b=e.target.closest('[data-loc-action]');if(!b)return;locationAction(b.dataset.locAction,b.dataset.loc)});
$('#animalChoices').addEventListener('click',e=>{const b=e.target.closest('[data-animal-index]');if(!b)return;selectAnimal(Number(b.dataset.animalIndex))});
$('#passAnimalsBtn').addEventListener('click',passAnimals);$('#cancelApproachBtn').addEventListener('click',()=>{$('#approachModal').classList.add('hidden');$('#animalModal').classList.remove('hidden')});
$('#approachChoices').addEventListener('click',e=>{const b=e.target.closest('[data-approach]');if(!b)return;chooseApproach(Number(b.dataset.approach))});
$('#cancelShotBtn').addEventListener('click',()=>{clearInterval(aimTimer);$('#shotModal').classList.add('hidden')});$('#fireBtn').addEventListener('click',fireShot);
$('#lureGrid').addEventListener('click',e=>{const b=e.target.closest('[data-lure]');if(!b||b.disabled)return;selectedLure=b.dataset.lure;renderFishingModal()});$('#castBtn').addEventListener('click',castLine);$('#closeFishBtn').addEventListener('click',()=>$('#fishModal').classList.add('hidden'));$('#reelBtn').addEventListener('click',reelFish);
$('#shopList').addEventListener('click',e=>{const g=e.target.closest('[data-buy-gear]');if(g){buyGear(g.dataset.buyGear);return}const i=e.target.closest('[data-buy-item]');if(i){buyItem(i.dataset.buyItem,Number(i.dataset.price));return}const w=e.target.closest('[data-buy-weapon]');if(w){buyWeapon(w.dataset.buyWeapon,Number(w.dataset.price));return}const a=e.target.closest('[data-buy-ammo]');if(a)buyAmmo(a.dataset.buyAmmo,Number(a.dataset.price));});
$('#prepareOutingBtn')?.addEventListener('click',openLoadout);$('#returnBaseBtn')?.addEventListener('click',requestReturnToBase);$('#fieldReloadBtn')?.addEventListener('click',reloadFromSpare);
$('#weaponChoices')?.addEventListener('click',e=>{const b=e.target.closest('[data-weapon-choice]');if(b)selectLoadoutWeapon(b.dataset.weaponChoice)});$('#spareAmmoSelect')?.addEventListener('change',renderLoadoutPreview);$('#carryBinosToggle')?.addEventListener('change',renderLoadoutPreview);$('#cancelLoadoutBtn')?.addEventListener('click',()=>$('#loadoutModal').classList.add('hidden'));$('#startOutingBtn')?.addEventListener('click',startOuting);
$('#sellHidesBtn')?.addEventListener('click',sellStoredHides);$('#sellMeatBtn')?.addEventListener('click',sellStoredMeat);$('#eatYabbiesBtn')?.addEventListener('click',useYabbiesAsFood);
$('#glassChoices')?.addEventListener('click',e=>{const b=e.target.closest('[data-glass-index]');if(b)pursueGlassed(Number(b.dataset.glassIndex))});$('#closeGlassBtn')?.addEventListener('click',()=>$('#glassModal').classList.add('hidden'));
$('#reloadShotBtn')?.addEventListener('click',()=>{reloadFromSpare();if(state.currentEncounter?.stage==='shot')openShot();});$('#stalkCloserBtn')?.addEventListener('click',stalkCloserFromShot);


$('.bottom-nav')?.addEventListener?.('click',()=>{});
document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.toggle('active',x===btn));
  document.querySelectorAll('.tab-page').forEach(p=>p.classList.toggle('active',p.dataset.page===btn.dataset.tab)); window.scrollTo({top:0,behavior:'smooth'});
}));

// Hero can open the relevant ready encounter.
$('#activeTitle').addEventListener('click',()=>{ if(state.active.kind==='encounter'&&state.currentEncounter?.stage==='shot')openShot(); else if(state.hunt.stage==='encounter'&&state.currentEncounter?.stage==='choose')openAnimalEncounter(); });

// Add a visible shot button by reusing hero distance tap when ready.
$('#activeDistance').addEventListener('click',()=>{ if(state.active.kind==='encounter'&&state.currentEncounter?.stage==='shot')openShot(); });

// iPhone Shortcut hook: ?steps=5820&claim=1
const params=new URLSearchParams(location.search);const imported=parseInt(params.get('steps'),10);const autoClaim=params.get('claim')==='1';
testStorage();setupSettingsActions();setupServiceWorker();setupVisibilityChecks();render();
if(imported>=0&&imported<100000){
  history.replaceState({},'',location.pathname);
  if(autoClaim)creditHealthTotal(imported,{source:'shortcut'});
  else{$('#stepsInput').value=imported;$('#claimStatus').textContent=`${fmt(imported)} steps imported — tap Claim steps when ready.`;}
}

