// «Феи» — всё, что видно и слышно на устройстве: меню, бутик, задания, рисование сада и фей,
// звук, музыка, управление и предсказание своего полёта. Связь — в net.js, правила — в room.js.
'use strict';
const VERSION='1.0'; // видно в углу меню — по нему ясно, что на устройстве свежая версия
const $=id=>document.getElementById(id);
$('ver').textContent='версия '+VERSION;
const RULES=FairyHub.rules;
const {CELL,BODY_R,SPEED,TURN,FLASH_T,FLASH_CD,FLASH_MUL,SPEED_MUL,FROST_MUL,FROST_R,WALL,POND,TICK}=RULES;
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function lsDel(k){try{localStorage.removeItem(k)}catch(e){}}
function lsJson(k,def){try{const v=JSON.parse(lsGet(k)||'null');return v==null?def:v}catch(e){return def}}
function clamp(v,a,b){return v<a?a:v>b?b:v}
function lerp(a,b,t){return a+(b-a)*t}
function angDiff(a,b){let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d}
function angLerp(a,b,t){return a+angDiff(a,b)*t}
function easeBack(t){const c=1.7;t=clamp(t,0,1)-1;return Math.max(0,1+(c+1)*t*t*t+c*t*t)} // в нуле из-за округления бывает -1e-16
function easeOut(t){t=clamp(t,0,1);return 1-Math.pow(1-t,3)}
function hash(n){return Math.imul(n^0x5bd1e995,2654435761)>>>0}
function show(id){
  for(const s of document.querySelectorAll('.screen'))s.classList.toggle('active',s.id===id);
  document.body.className=document.body.className.replace(/scr-\S+/g,'').trim()+' scr-'+id; // фон и затемнение — по экрану
  $('corner').style.display=$('ver').style.display=id==='game'||id==='lobby'?'none':'';
  if(id!=='game')scrollTo(0,0);
  if(typeof musicFor==='function')musicFor(id);
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
let toastT=null;
function toast(t,ms){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),ms||2600)}
// старые iPhone (iOS 15 и раньше) не умеют roundRect
if(!CanvasRenderingContext2D.prototype.roundRect)CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
  r=Math.min(typeof r==='number'?r:0,w/2,h/2);
  this.moveTo(x+r,y);this.arcTo(x+w,y,x+w,y+h,r);this.arcTo(x+w,y+h,x,y+h,r);this.arcTo(x,y+h,x,y,r);this.arcTo(x,y,x+w,y,r);this.closePath();
};
const TOUCH=matchMedia('(pointer:coarse)').matches||'ontouchstart' in window;
if(TOUCH)document.body.classList.add('touch');
const FONT_D='Comfortaa,"Segoe UI",system-ui,sans-serif',FONT_B='Nunito,"Segoe UI",system-ui,sans-serif',FONT_S='Lobster,Comfortaa,cursive';
const EMOJI='"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
// искорки на фоне меню
(function(){const box=$('sparkles');for(let i=0;i<26;i++){const s=document.createElement('i');s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';
  s.style.animationDelay=(Math.random()*4).toFixed(2)+'s';s.style.animationDuration=(3+Math.random()*3).toFixed(2)+'s';const k=0.4+Math.random()*0.8;s.style.width=s.style.height=(6*k).toFixed(1)+'px';box.append(s)}})();

// ================= Цвета =================
const COLORS=['#ff6fb5','#ff5d7a','#ff9a5c','#ffc93c','#97d94f','#2fd0a0','#45c2f5','#6f86ff','#a678ff','#d564f0','#efe3ff','#a8745c'];
function rgbOf(hex){const n=parseInt(hex.slice(1),16);return [n>>16,n>>8&255,n&255]}
function mix(a,b,t){const x=rgbOf(a),y=rgbOf(b);return`rgb(${x[0]+(y[0]-x[0])*t|0},${x[1]+(y[1]-x[1])*t|0},${x[2]+(y[2]-x[2])*t|0})`}
function rgba(hex,al){const x=rgbOf(hex);return`rgba(${x[0]},${x[1]},${x[2]},${al})`}
function shade(hex,f){return f<0?mix(hex,'#000000',-f):mix(hex,'#ffffff',f)}
function hairOf(col){return col==='#efe3ff'?'#c9b2f0':col==='#ffc93c'?'#f0a92a':shade(col,-0.12)}

// ================= Бутик, кристаллы, достижения, задания =================
// цена — число кристаллов; 'a:показатель:сколько' — открывается только достижением
const CAT={
  wings:{title:'🦋 Крылья',items:{butterfly:['Бабочка',0],dragonfly:['Стрекоза',60],heart:['Сердечки',120],moth:['Мотылёк',160],angel:['Ангел',300],crystal:['Хрусталь','a:wins:5']}},
  head:{title:'🎀 Украшения',items:{none:['Без украшения',0],bow:['Бантик',0],wreath:['Веночек',50],ears:['Ушки',80],tiara:['Диадема',150],horn:['Рог единорога',220],star:['Звёздочка','a:catches:25'],crown:['Корона','a:wins:15']}},
  trail:{title:'🌸 Дорожка',items:{petals:['Лепестки',0],hearts:['Сердечки',70],stars:['Звёзды',100],notes:['Ноты',120],snow:['Снежинки',150],rainbow:['Радуга','a:bestShare:400']}},
  pet:{title:'🐾 Питомец',items:{none:['Без питомца',0],cat:['Котёнок',150],bunny:['Зайка',150],owl:['Совёнок',220],fox:['Лисёнок',260],unicorn:['Единорожка','a:rounds:30']}},
};
const ACH=[ // [показатель, сколько, значок, название, описание]
  ['rounds',1,'🌱','Первый полёт','сыграй раунд'],
  ['rounds',10,'🌿','Садовница','сыграй 10 раундов'],
  ['rounds',30,'🦄','Подружка единорога','сыграй 30 раундов — питомец «Единорожка»'],
  ['wins',1,'🏅','Первая победа','выиграй раунд'],
  ['wins',5,'💠','Хрустальная фея','выиграй 5 раундов — крылья «Хрусталь»'],
  ['wins',15,'👑','Королева сада','выиграй 15 раундов — «Корона»'],
  ['catches',5,'🪄','Чародейка','зачаруй 5 фей'],
  ['catches',25,'⭐','Звёздная волшебница','зачаруй 25 фей — «Звёздочка»'],
  ['bestShare',250,'🌸','Цветущий сад','вырасти сад в 25%'],
  ['bestShare',400,'🌈','Радужный сад','вырасти сад в 40% — дорожка «Радуга»'],
  ['bigLoop',80,'🎀','Большая петля','обведи 80 клеток за раз'],
  ['dia',100,'💎','Собирательница','собери 100 кристаллов в саду'],
  ['cells',5000,'🌼','Тысяча цветов','вырасти 5000 клеток сада'],
];
const STAT_KEY='fairies_stats';
let stats=Object.assign({rounds:0,wins:0,catches:0,bestShare:0,bigLoop:0,dia:0,cells:0,loops:0,earned:0},lsJson(STAT_KEY,{}));
function saveStats(){lsSet(STAT_KEY,JSON.stringify(stats))}
let gems=+(lsGet('fairies_gems')??50)||0; // подарок на старте — хватит на первую покупку
let owned=new Set(lsJson('fairies_owned',[]));
function saveGems(){lsSet('fairies_gems',String(gems));for(const id of ['purse','purse2']){const el=$(id);el.textContent='💎 '+gems;el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump')}}
function addGems(n){if(n>0){gems+=n;stats.earned+=n;saveStats();saveGems()}}
function itemInfo(kind,id){return CAT[kind].items[id]}
function itemHave(kind,id){
  const it=itemInfo(kind,id);if(!it)return false;
  if(typeof it[1]==='string'){const [,k,need]=it[1].split(':');return stats[k]>=+need}
  return it[1]===0||owned.has(kind+':'+id);
}
function achDone(){return ACH.filter(a=>stats[a[0]]>=a[1]).map(a=>a[0]+a[1])}
// после изменения статистики — поздравляем с открытым
function bumpStats(fn){
  const before=new Set(achDone());
  fn();saveStats();
  for(const a of ACH)if(stats[a[0]]>=a[1]&&!before.has(a[0]+a[1])){toast(a[2]+' Достижение: «'+a[3]+'»',3800);sfx('ach')}
}
const SKIN_KEY='fairies_skin';
let skin=Object.assign({color:Math.floor(Math.random()*10),wings:'butterfly',head:'bow',trail:'petals',pet:'none'},lsJson(SKIN_KEY,{}));
if(!lsGet(SKIN_KEY))lsSet(SKIN_KEY,JSON.stringify(skin)); // случайный цвет при первом запуске — запоминаем
function mySkin(){
  const s={color:skin.color};
  for(const kind in CAT)s[kind]=itemHave(kind,skin[kind])?skin[kind]:Object.keys(CAT[kind].items)[kind==='head'?1:0];
  return s;
}
function saveSkin(){lsSet(SKIN_KEY,JSON.stringify(skin));if(demo&&demo.g&&demo.g.slots.P0){demo.g.slots.P0.skin=mySkin();demo.D.slots.P0&&(demo.D.slots.P0.skin=mySkin());refreshColors(demo.D)}}
let shopTab='wings';
function renderSkinUI(){
  const sw=$('swatches');sw.innerHTML='';
  COLORS.forEach((c,i)=>{
    const b=document.createElement('button');b.className='sw'+(i===skin.color?' on':'');b.style.background=`radial-gradient(circle at 35% 30%,${shade(c,0.45)},${c} 60%)`;b.setAttribute('aria-label','Цвет '+(i+1));
    b.onclick=()=>{skin.color=i;saveSkin();renderSkinUI();sfx('pick')};
    sw.append(b);
  });
  const tabs=$('tabs');tabs.innerHTML='';
  for(const kind in CAT){const t=document.createElement('button');t.className='tab'+(kind===shopTab?' on':'');t.textContent=CAT[kind].title;t.onclick=()=>{shopTab=kind;renderSkinUI()};tabs.append(t)}
  const box=$('items');box.innerHTML='';
  const cur=mySkin();
  for(const id in CAT[shopTab].items){
    const [name,price]=CAT[shopTab].items[id],have=itemHave(shopTab,id),on=cur[shopTab]===id;
    const el=document.createElement('button');el.className='item'+(on?' on':'')+(have?'':' locked');
    const cv=document.createElement('canvas');cv.width=cv.height=144;
    const nm=document.createElement('div');nm.className='in';nm.textContent=name;
    const pr=document.createElement('div');
    if(on){pr.className='ip';pr.textContent='✓ надето'}
    else if(have){pr.className='ip';pr.style.color='var(--muted)';pr.textContent='надеть'}
    else if(typeof price==='string'){pr.className='ip lock';pr.textContent='🔒 достижение'}
    else{pr.className='ip';pr.textContent='💎 '+price}
    el.append(cv,nm,pr);box.append(el);
    drawItemIcon(cv,shopTab,id);
    el.onclick=()=>{
      if(have){skin[shopTab]=id;saveSkin();renderSkinUI();sfx('pick');return}
      openBuy(shopTab,id);
    };
  }
  for(const id of ['purse','purse2'])$(id).textContent='💎 '+gems;
}
let buying=null;
function openBuy(kind,id){
  const [name,price]=itemInfo(kind,id);
  buying={kind,id};
  $('buyTitle').textContent=name;
  if(typeof price==='string'){
    const a=ACH.find(a=>price==='a:'+a[0]+':'+a[1]);
    const [,k,need]=price.split(':');
    $('buyText').innerHTML='Особый наряд — открывается достижением<br><b>'+esc(a?a[3]:'')+'</b>: '+esc(a?a[4]:'')+'<br>Сейчас: '+Math.min(stats[k],+need)+' из '+need;
    $('btnBuy').style.display='none';
  }else{
    $('buyText').innerHTML='Стоит <b style="color:var(--gold)">💎 '+price+'</b> · у тебя 💎 '+gems+(gems<price?'<br>Кристаллы дают за каждый раунд и за задания дня 📅':'');
    $('btnBuy').style.display='';$('btnBuy').disabled=gems<price;$('btnBuy').textContent=gems<price?'Не хватает 💎 '+(price-gems):'Купить за 💎 '+price;
  }
  drawItemIcon($('buyPrev'),kind,id,true);
  $('buyBox').classList.add('show');
}
$('btnBuy').onclick=()=>{
  if(!buying)return;
  const price=itemInfo(buying.kind,buying.id)[1];
  if(typeof price!=='number'||gems<price)return;
  gems-=price;owned.add(buying.kind+':'+buying.id);lsSet('fairies_owned',JSON.stringify([...owned]));saveGems();
  skin[buying.kind]=buying.id;saveSkin();sfx('buy');toast('✨ Новинка надета!');
  $('buyBox').classList.remove('show');renderSkinUI();
};
$('btnBuyCancel').onclick=()=>$('buyBox').classList.remove('show');
$('buyBox').onclick=e=>{if(e.target===$('buyBox'))$('buyBox').classList.remove('show')};

function renderProgress(){
  const tile=(v,t)=>`<div><b>${v}</b><span>${t}</span></div>`;
  let h='<div class="stat5">'+tile(stats.rounds,'раундов')+tile(stats.wins,'побед')+tile(stats.catches,'чар')+tile((stats.bestShare/10).toFixed(1)+'%','лучший сад')+tile(stats.dia,'кристаллов')+tile(stats.earned,'заработано 💎')+'</div><div class="list">';
  for(const a of ACH){
    const have=Math.min(stats[a[0]],a[1]),ok=have>=a[1];
    const show=a[0]==='bestShare'?(have/10).toFixed(0)+'/'+a[1]/10+'%':have+'/'+a[1];
    h+=`<div class="ach${ok?' ok':''}"><div class="ai">${a[2]}</div><div><div class="an">${esc(a[3])}</div><div class="ad">${esc(a[4])}</div>
      <div class="bar"><i style="width:${Math.round(have/a[1]*100)}%"></i></div></div><div class="ap">${ok?'✓':show}</div></div>`;
  }
  $('progress').innerHTML=h+'</div>';
}

// --- задания дня: три случайных на сегодня, одинаковые весь день ---
const QUESTS={rounds:['🌷','Сыграй 3 раунда',3,25],share:['🌸','Вырасти сад в 20% за раунд',20,30],catches:['🪄','Зачаруй 3 феи',3,30],
  dia:['💎','Собери 15 кристаллов в саду',15,25],win:['👑','Выиграй раунд',1,40],powers:['🦋','Подбери 6 бонусов',6,20],loops:['🎀','Замкни 20 петель',20,25],big:['🌈','Обведи 50 клеток за раз',50,35]};
const QUEST_BONUS=50;
function today(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()}
function loadDaily(){
  let q=lsJson('fairies_daily',null);
  if(!q||q.d!==today()){
    let s=0;for(const ch of today())s=(s*31+ch.charCodeAt(0))>>>0;
    const keys=Object.keys(QUESTS).sort((a,b)=>hash(s+a.charCodeAt(0)*7+a.length)-hash(s+b.charCodeAt(0)*7+b.length));
    q={d:today(),ids:keys.slice(0,3),p:{},done:{},bonus:false};
  }
  return q;
}
let daily=loadDaily();
function saveDaily(){lsSet('fairies_daily',JSON.stringify(daily));renderQuestDot()}
function quest(id,v,max){
  if(!mode)return;
  if(daily.d!==today())daily=loadDaily();
  if(!daily.ids.includes(id)||daily.done[id])return;
  const q=QUESTS[id];
  daily.p[id]=max?Math.max(daily.p[id]||0,v):(daily.p[id]||0)+v;
  if(daily.p[id]>=q[2]){
    daily.done[id]=true;addGems(q[3]);toast(q[0]+' Задание выполнено: +'+q[3]+' 💎',3500);sfx('ach');
    if(!daily.bonus&&daily.ids.every(i=>daily.done[i])){daily.bonus=true;addGems(QUEST_BONUS);setTimeout(()=>toast('🎁 Все задания дня! Бонус +'+QUEST_BONUS+' 💎',4000),3800)}
  }
  saveDaily();
}
function renderQuestDot(){const left=daily.ids.filter(i=>!daily.done[i]).length;const d=$('questDot');d.textContent=left;d.classList.toggle('show',left>0)}
function renderQuests(){
  if(daily.d!==today()){daily=loadDaily();saveDaily()}
  let h='';
  for(const id of daily.ids){
    const q=QUESTS[id],have=Math.min(daily.p[id]||0,q[2]),ok=!!daily.done[id];
    h+=`<div class="ach${ok?' ok':''}"><div class="ai">${q[0]}</div><div><div class="an">${esc(q[1])}</div><div class="ad">награда 💎 ${q[3]}</div>
      <div class="bar"><i style="width:${Math.round(have/q[2]*100)}%"></i></div></div><div class="ap">${ok?'✓':have+'/'+q[2]}</div></div>`;
  }
  h+=`<div class="questBonus">${daily.bonus?'🎁 Бонус за все задания получен!':'🎁 Выполни все три — ещё +'+QUEST_BONUS+' 💎'}</div>`;
  $('quests').innerHTML=h;
}
$('btnQuest').onclick=()=>{renderQuests();$('questBox').classList.add('show')};
$('btnQuestClose').onclick=()=>$('questBox').classList.remove('show');
$('questBox').onclick=e=>{if(e.target===$('questBox'))$('questBox').classList.remove('show')};
renderQuestDot();

$('playerName').value=lsGet('fairies_name')||'';
function myName(){const n=$('playerName').value.trim().slice(0,14);lsSet('fairies_name',n);return n}

// настройки сада запоминаются
const OPT_IDS=['optSize','optDiff','optTime','optWins','optBots','optPowers','optPonds'];
(function(){
  const o=lsJson('fairies_opts',null);
  if(o)for(const id of OPT_IDS)if(id in o){const el=$(id);if(el.type==='checkbox')el.checked=!!o[id];else el.value=o[id]}
})();
function gameOpts(){
  const o={};for(const id of OPT_IDS){const el=$(id);o[id]=el.type==='checkbox'?el.checked:el.value}
  lsSet('fairies_opts',JSON.stringify(o));
  return {size:+o.optSize,diff:o.optDiff,time:+o.optTime,wins:+o.optWins,bots:o.optBots,powers:o.optPowers,ponds:o.optPonds};
}

// ================= Звук =================
let AC=null,soundOn=lsGet('fairies_sound')!=='0';
function audioInit(){
  if(AC){if(AC.state==='suspended')AC.resume().then(()=>musicFor(currentScreen()),()=>{});return}
  try{AC=new (window.AudioContext||window.webkitAudioContext)();AC.resume().then(()=>musicFor(currentScreen()),()=>{})}catch(e){AC=null}
}
// звук в браузере включается только после касания — ловим первое
addEventListener('pointerdown',function first(){removeEventListener('pointerdown',first,true);audioInit()},true);
let noiseBuf=null;
function noise(){
  if(noiseBuf)return noiseBuf;
  noiseBuf=AC.createBuffer(1,AC.sampleRate*0.5,AC.sampleRate);
  const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  return noiseBuf;
}
function tone(f1,f2,dur,type,vol,delay){
  const t=AC.currentTime+(delay||0),o=AC.createOscillator(),g=AC.createGain();
  o.type=type||'sine';o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+dur);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g).connect(AC.destination);o.start(t);o.stop(t+dur+0.02);
}
// колокольчик: основной тон и тихий обертон — звенит, как челеста
function bell(f,vol,delay,dur){tone(f,f,dur||0.5,'sine',vol,delay);tone(f*2.005,f*2.005,(dur||0.5)*0.5,'sine',vol*0.35,delay);tone(f*3.01,f*3.01,(dur||0.5)*0.25,'sine',vol*0.12,delay)}
function hiss(dur,freq,vol,delay,type){
  const t=AC.currentTime+(delay||0),s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();
  s.buffer=noise();f.type=type||'bandpass';f.frequency.value=freq;f.Q.value=1.2;
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(f).connect(g).connect(AC.destination);s.start(t);s.stop(t+dur+0.02);
}
const lastSfx={};
const PENTA=[0,2,4,7,9,12,14,16,19,21,24];
function sfx(name,vol,arg){
  if(!soundOn||!AC||AC.state!=='running')return;
  vol=vol==null?1:vol;if(vol<0.04)return;
  const now=performance.now();
  if(lastSfx[name]&&now-lastSfx[name]<(name==='pick'?50:name==='dia'?40:0))return;
  lastSfx[name]=now;
  const v=0.2*vol,F=f=>523.25*Math.pow(2,f/12);
  switch(name){
    case'pick':bell(F(19),v*0.5,0,0.25);break;
    case'dia':bell(F(24),v*0.55,0,0.3);bell(F(28),v*0.45,0.06,0.35);break;
    case'power':[0,4,7,12].forEach((n,i)=>bell(F(n+12),v*0.6,i*0.06,0.4));break;
    case'cap':{const k=clamp(Math.round(2+(arg||0)/12),2,8);for(let i=0;i<k;i++)bell(F(PENTA[i]+7),v*0.7,i*0.055,0.5);hiss(0.4,6000,v*0.25,0,'highpass');break}
    case'cut':tone(1600,400,0.35,'triangle',v*0.5);[16,12,7].forEach((n,i)=>bell(F(n),v*0.6,0.05+i*0.07,0.4));hiss(0.3,3000,v*0.4);break;
    case'sleep':[12,7,4,0].forEach((n,i)=>bell(F(n),v*0.6,i*0.12,0.5));break;
    case'flash':hiss(0.25,2500,v*0.7);tone(600,1800,0.2,'sine',v*0.25);break;
    case'bubble':tone(500,1400,0.12,'sine',v*0.8);hiss(0.08,4000,v*0.5,0.02);break;
    case'frost':hiss(0.6,7000,v*0.6,0,'highpass');[24,21,19].forEach((n,i)=>bell(F(n),v*0.35,i*0.05,0.6));break;
    case'beep':bell(F(12),v*0.7,0,0.3);break;
    case'go':[0,4,7,12].forEach((n,i)=>bell(F(n+12),v*0.7,i*0.05,0.6));break;
    case'warn':bell(F(7),v*0.7,0,0.25);bell(F(7),v*0.7,0.3,0.25);break;
    case'rose':[0,4,7,11,14].forEach((n,i)=>bell(F(n+7),v*0.55,i*0.09,0.7));break;
    case'star':for(let i=0;i<7;i++)bell(F(PENTA[10-i]+5),v*0.4,i*0.07,0.5);break;
    case'win':[0,4,7,12,16,19,24].forEach((n,i)=>bell(F(n),v*0.75,i*0.1,0.8));break;
    case'ach':[7,12,16].forEach((n,i)=>bell(F(n+12),v*0.55,i*0.08,0.6));break;
    case'buy':[0,7,12,19].forEach((n,i)=>bell(F(n+12),v*0.6,i*0.06,0.5));hiss(0.3,6000,v*0.3,0,'highpass');break;
  }
}
function vibrate(p){try{if(navigator.vibrate&&(!navigator.userActivation||navigator.userActivation.hasBeenActive))navigator.vibrate(p)}catch(e){}}
const ICON_SOUND_ON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',ICON_SOUND_OFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
function setSound(on){soundOn=on;lsSet('fairies_sound',on?'1':'0');$('btnSound').innerHTML=on?ICON_SOUND_ON:ICON_SOUND_OFF;if(on)audioInit();musicFor(currentScreen())}

// ---------- музыка: свой волшебный вальс — нежный в меню, бодрее в саду и ещё быстрее в последние секунды ----------
let musicOn=lsGet('fairies_music')!=='0',music=null;
function currentScreen(){const s=document.querySelector('.screen.active');return s?s.id:'menu'}
function setMusic(on){musicOn=on;lsSet('fairies_music',on?'1':'0');$('btnMusic').classList.toggle('off',!on);if(on)audioInit();musicFor(currentScreen())}
function musicFor(id){
  const want=musicOn&&soundOn&&AC&&AC.state==='running'?(id==='game'?'battle':'menu'):null;
  if(!want){if(music){music.stop();music=null}return}
  if(!music)music=startMusic();
  music.mode=want;
}
function startMusic(){
  // ре мажор на три четверти: бас на первую долю, аккорд на вторую и третью, сверху — колокольчики
  const out=AC.createGain();out.gain.value=0;out.connect(AC.destination);
  out.gain.linearRampToValueAtTime(0.5,AC.currentTime+1.5);
  const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3200;lp.connect(out);
  const prog=[[50,54,57,62],[47,50,54,59],[43,47,50,55],[45,49,52,57],[50,54,57,62],[43,47,50,55],[45,49,52,57],[45,49,52,57]]; // D Bm G A D G A A
  const hz=n=>440*Math.pow(2,(n-69)/12);
  const M={mode:'menu',beat:0,next:AC.currentTime+0.1,timer:null};
  const note=(f,t,d,type,v)=>{const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=f;
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(v,t+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g).connect(lp);o.start(t);o.stop(t+d+0.05)};
  const cel=(f,t,d,v)=>{note(f,t,d,'sine',v);note(f*2.005,t,d*0.5,'sine',v*0.3)};
  const shaker=(t,v)=>{const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=noise();f.type='highpass';f.frequency.value=8000;
    g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.06);s.connect(f).connect(g).connect(out);s.start(t);s.stop(t+0.07)};
  const MEL=[3,2,1,2,3,3, 2,1,0,1,2,2, 3,1,2,0,1,3, 2,3,1,2,0,0];
  const tick=()=>{
    const battle=M.mode==='battle',heat=battle&&G&&G.tl<=30&&G.phase==='play';
    const bpm=battle?(heat?186:162):104,spb=60/bpm/2; // восьмые; такт — шесть восьмых
    while(M.next<AC.currentTime+0.25){
      const t=M.next,b=M.beat,pos=b%6,bar=Math.floor(b/6),ch=prog[bar%8];
      if(pos===0)note(hz(ch[0]-12),t,spb*5,'triangle',battle?0.3:0.22);
      if(pos===2||pos===4)for(let k=1;k<3;k++)note(hz(ch[k]),t,spb*1.6,'sine',0.045);
      if(battle&&pos%2===1)shaker(t,heat?0.07:0.045);
      const m=MEL[(bar%4)*6+pos];
      if(battle||pos%2===0)cel(hz(ch[m]+24),t,spb*(battle?2.4:3.5),battle?0.05:0.06);
      if(pos===0&&bar%2===0)note(hz(ch[2]+12),t,spb*11,'sine',0.03); // подложка
      M.next+=spb;M.beat++;
    }
  };
  M.timer=setInterval(tick,60);tick();
  M.stop=()=>{clearInterval(M.timer);const t=AC.currentTime;out.gain.cancelScheduledValues(t);out.gain.setValueAtTime(out.gain.value,t);out.gain.linearRampToValueAtTime(0,t+0.6);setTimeout(()=>out.disconnect(),800)};
  return M;
}
$('btnMusic').onclick=()=>setMusic(!musicOn);

// ================= Рисование: феи, крылья, украшения, питомцы =================
function setWorld(c,cam){
  const s=cam.s*cam.dpr;
  c.setTransform(s,0,0,s,(cam.w/2-cam.x*cam.s)*cam.dpr,(cam.h/2-cam.y*cam.s)*cam.dpr);
}
function wingPath(c,type){
  // одно крыло (правое), корень в (0,0), единица — радиус феи
  c.beginPath();
  switch(type){
    case'dragonfly':
      c.ellipse(0.85,-0.38,1.0,0.24,-0.38,0,Math.PI*2);c.moveTo(1.6,0.32);c.ellipse(0.8,0.3,0.86,0.2,0.32,0,Math.PI*2);break;
    case'heart':{
      const h=(x,y,s,r)=>{c.save();c.translate(x,y);c.rotate(r);c.scale(s,s);c.moveTo(0,0.35);c.bezierCurveTo(-0.9,-0.25,-0.45,-1.0,0,-0.5);c.bezierCurveTo(0.45,-1.0,0.9,-0.25,0,0.35);c.restore()};
      h(0.85,-0.2,1.15,1.1);h(0.6,0.55,0.7,1.9);break}
    case'moth':
      c.moveTo(0,-0.1);c.bezierCurveTo(0.5,-1.15,1.95,-1.05,1.75,-0.2);c.bezierCurveTo(1.65,0.3,0.7,0.25,0,0.1);
      c.moveTo(0,0.12);c.bezierCurveTo(0.8,0.2,1.35,0.75,1.0,1.05);c.bezierCurveTo(0.6,1.3,0.15,0.7,0,0.2);break;
    case'angel':
      for(let k=0;k<5;k++){const a=-1.05+k*0.36,L=1.75-k*0.2;c.moveTo(0,0);c.ellipse(Math.cos(a)*L*0.5,Math.sin(a)*L*0.5,L*0.55,0.2,a,0,Math.PI*2)}break;
    case'crystal':
      c.moveTo(0,0);c.lineTo(0.45,-1.35);c.lineTo(1.5,-1.15);c.lineTo(1.25,-0.3);c.closePath();
      c.moveTo(0,0.05);c.lineTo(1.15,0.12);c.lineTo(0.75,0.95);c.closePath();break;
    default: // бабочка
      c.moveTo(0,-0.05);c.bezierCurveTo(0.4,-1.45,1.65,-1.5,1.48,-0.55);c.bezierCurveTo(1.38,-0.05,0.6,0.05,0,0.05);
      c.moveTo(0,0.05);c.bezierCurveTo(0.75,0.1,1.2,0.62,0.88,0.98);c.bezierCurveTo(0.56,1.24,0.15,0.62,0,0.15);
  }
}
function drawWings(c,R,type,col,flap){
  const g=c.createLinearGradient(0,-R*1.3,R*1.7,R*0.8);
  if(type==='crystal'){g.addColorStop(0,'rgba(240,252,255,.95)');g.addColorStop(0.5,'rgba(170,225,255,.7)');g.addColorStop(1,rgba(col,.6))}
  else if(type==='angel'){g.addColorStop(0,'rgba(255,255,255,.98)');g.addColorStop(1,'rgba(235,228,255,.85)')}
  else{g.addColorStop(0,'rgba(255,255,255,.88)');g.addColorStop(0.55,rgba(col,.5));g.addColorStop(1,rgba(col,.75))}
  for(const s of [-1,1]){
    c.save();c.scale(s*R*flap,R);
    wingPath(c,type);
    c.fillStyle=g;c.fill();
    c.lineWidth=0.07;c.strokeStyle=type==='angel'?'rgba(200,190,230,.8)':'rgba(255,255,255,.95)';c.stroke();
    if(type==='moth'){c.fillStyle=rgba(col,.85);c.beginPath();c.arc(1.1,-0.45,0.2,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(1.1,-0.45,0.08,0,Math.PI*2);c.fill()}
    if(type==='butterfly'){c.fillStyle='rgba(255,255,255,.7)';for(const [x,y,r] of [[1.15,-0.8,0.1],[0.85,-0.55,0.06],[0.7,0.62,0.07]]){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill()}}
    if(type==='crystal'){c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=0.05;c.beginPath();c.moveTo(0.2,-0.3);c.lineTo(0.9,-1.1);c.moveTo(0.3,0.1);c.lineTo(0.9,0.5);c.stroke()}
    c.restore();
  }
}
function star5(c,x,y,r1,r2,rot){
  c.beginPath();
  for(let i=0;i<10;i++){const r=i%2?r2:r1,a=rot-Math.PI/2+i*Math.PI/5;c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r)}
  c.closePath();
}
function heartPath(c,x,y,s){c.beginPath();c.moveTo(x,y+s*0.35);c.bezierCurveTo(x-s*0.9,y-s*0.25,x-s*0.45,y-s,x,y-s*0.5);c.bezierCurveTo(x+s*0.45,y-s,x+s*0.9,y-s*0.25,x,y+s*0.35);c.closePath()}
function drawHeadwear(c,type,hy,hr,col,hair){
  switch(type){
    case'bow':{
      const x=hr*0.55,y=hy-hr*0.7,cc=col==='#ff6fb5'||col==='#ff5d7a'?'#ffffff':'#ff5aa8';
      c.fillStyle=cc;c.strokeStyle='rgba(120,20,70,.35)';c.lineWidth=hr*0.05;
      for(const s of [-1,1]){c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+s*hr*0.55,y-hr*0.45,x+s*hr*0.55,y+hr*0.05);c.quadraticCurveTo(x+s*hr*0.3,y+hr*0.2,x,y);c.fill();c.stroke()}
      c.beginPath();c.arc(x,y,hr*0.13,0,Math.PI*2);c.fill();c.stroke();
      c.fillStyle='rgba(255,255,255,.7)';c.beginPath();c.arc(x-hr*0.28,y-hr*0.12,hr*0.05,0,Math.PI*2);c.arc(x+hr*0.3,y-hr*0.1,hr*0.05,0,Math.PI*2);c.fill();break}
    case'tiara':{
      const y=hy-hr*0.78;const g=c.createLinearGradient(0,y-hr*0.4,0,y+hr*0.1);g.addColorStop(0,'#fff6d6');g.addColorStop(1,'#e9a93a');
      c.fillStyle=g;c.beginPath();c.moveTo(-hr*0.6,y+hr*0.12);c.lineTo(-hr*0.42,y-hr*0.12);c.lineTo(-hr*0.2,y+hr*0.02);c.lineTo(0,y-hr*0.42);c.lineTo(hr*0.2,y+hr*0.02);c.lineTo(hr*0.42,y-hr*0.12);c.lineTo(hr*0.6,y+hr*0.12);c.closePath();c.fill();
      c.fillStyle='#7cd4ff';c.beginPath();c.arc(0,y-hr*0.1,hr*0.1,0,Math.PI*2);c.fill();c.fillStyle='#ff7ac8';c.beginPath();c.arc(-hr*0.35,y+hr*0.02,hr*0.06,0,Math.PI*2);c.arc(hr*0.35,y+hr*0.02,hr*0.06,0,Math.PI*2);c.fill();break}
    case'wreath':{
      const cols=['#ff7ac8','#ffd27a','#ffffff','#b892ff','#7cd4ff'];
      c.fillStyle='#5fb874';c.beginPath();c.ellipse(0,hy-hr*0.55,hr*0.85,hr*0.32,0,Math.PI,0);c.lineWidth=hr*0.14;c.strokeStyle='#5fb874';c.stroke();
      for(let k=0;k<7;k++){const a=Math.PI+k*Math.PI/6,x=Math.cos(a)*hr*0.85,y=hy-hr*0.55+Math.sin(a)*hr*0.32;
        c.fillStyle=cols[k%5];for(let p=0;p<5;p++){const pa=p*Math.PI*0.4;c.beginPath();c.arc(x+Math.cos(pa)*hr*0.09,y+Math.sin(pa)*hr*0.09,hr*0.08,0,Math.PI*2);c.fill()}
        c.fillStyle='#ffcf3f';c.beginPath();c.arc(x,y,hr*0.06,0,Math.PI*2);c.fill()}
      break}
    case'ears':
      for(const s of [-1,1]){
        c.fillStyle=hair;c.beginPath();c.moveTo(s*hr*0.25,hy-hr*0.85);c.lineTo(s*hr*0.62,hy-hr*1.35);c.lineTo(s*hr*0.82,hy-hr*0.55);c.closePath();c.fill();
        c.fillStyle='#ffb3d6';c.beginPath();c.moveTo(s*hr*0.38,hy-hr*0.82);c.lineTo(s*hr*0.6,hy-hr*1.15);c.lineTo(s*hr*0.7,hy-hr*0.65);c.closePath();c.fill();
      }break;
    case'horn':{
      const g=c.createLinearGradient(-hr*0.15,0,hr*0.15,0);g.addColorStop(0,'#fff6d6');g.addColorStop(1,'#f0b850');
      c.fillStyle=g;c.beginPath();c.moveTo(-hr*0.17,hy-hr*0.78);c.lineTo(0,hy-hr*1.65);c.lineTo(hr*0.17,hy-hr*0.78);c.closePath();c.fill();
      c.strokeStyle='rgba(200,120,30,.6)';c.lineWidth=hr*0.04;c.beginPath();for(let k=1;k<4;k++){const y=hy-hr*(0.8+k*0.2),w=hr*0.17*(1-k*0.24);c.moveTo(-w,y+hr*0.05);c.lineTo(w,y-hr*0.05)}c.stroke();break}
    case'crown':{
      const y=hy-hr*0.82,g=c.createLinearGradient(0,y-hr*0.5,0,y+hr*0.15);g.addColorStop(0,'#fff1c7');g.addColorStop(1,'#e8962c');
      c.fillStyle=g;c.strokeStyle='#b8751a';c.lineWidth=hr*0.05;c.beginPath();
      c.moveTo(-hr*0.5,y+hr*0.15);c.lineTo(-hr*0.58,y-hr*0.35);c.lineTo(-hr*0.25,y-hr*0.08);c.lineTo(0,y-hr*0.55);c.lineTo(hr*0.25,y-hr*0.08);c.lineTo(hr*0.58,y-hr*0.35);c.lineTo(hr*0.5,y+hr*0.15);c.closePath();c.fill();c.stroke();
      c.fillStyle='#ff4f9a';c.beginPath();c.arc(0,y-hr*0.02,hr*0.09,0,Math.PI*2);c.fill();break}
    case'star':{
      const g=c.createLinearGradient(0,hy-hr*1.2,0,hy-hr*0.4);g.addColorStop(0,'#fff6d6');g.addColorStop(1,'#ffb43a');
      c.fillStyle=g;c.strokeStyle='#fff';c.lineWidth=hr*0.06;star5(c,hr*0.5,hy-hr*0.72,hr*0.38,hr*0.17,0.2);c.fill();c.stroke();break}
  }
}
// фея: (x,y) — центр в мире; o: t (с), face (куда смотрит), flap, sleep, seed, scale, alpha
function drawFairy(c,x,y,sk,o){
  const s=o.scale||1,R=BODY_R*s,t=o.t||0,seed=o.seed||0,col=COLORS[sk.color]||COLORS[0],hair=hairOf(col);
  const bob=o.sleep?Math.sin(t*1.6)*R*0.05:Math.sin(t*4.2+seed)*R*0.13;
  c.fillStyle='rgba(50,15,70,.2)';c.beginPath();c.ellipse(x,y+R*1.15,R*0.8*(1-bob/R*0.6),R*0.26,0,0,Math.PI*2);c.fill();
  const face=o.face==null?Math.PI/2:o.face,tilt=o.sleep?0.25:Math.cos(face)*0.16;
  c.save();c.translate(x,y-R*0.25+bob);c.rotate(tilt);
  // крылья
  const flap=o.sleep?0.4:0.5+0.5*Math.abs(Math.sin(t*(o.fast?30:17)+seed));
  c.save();c.translate(0,R*0.18);drawWings(c,R*1.05,sk.wings,col,flap);c.restore();
  // платье-колокольчик
  const dg=c.createLinearGradient(0,R*0.05,0,R*1.0);dg.addColorStop(0,shade(col,0.25));dg.addColorStop(1,shade(col,-0.08));
  c.fillStyle=dg;c.beginPath();c.moveTo(-R*0.2,R*0.12);c.quadraticCurveTo(-R*0.35,R*0.55,-R*0.62,R*0.95);
  c.quadraticCurveTo(-R*0.31,R*1.08,0,R*0.98);c.quadraticCurveTo(R*0.31,R*1.08,R*0.62,R*0.95);c.quadraticCurveTo(R*0.35,R*0.55,R*0.2,R*0.12);c.closePath();c.fill();
  c.fillStyle='rgba(255,255,255,.75)';for(const [px,py] of [[-0.25,0.7],[0.18,0.55],[0.05,0.85],[0.32,0.82]]){c.beginPath();c.arc(px*R,py*R,R*0.045,0,Math.PI*2);c.fill()}
  // ножки
  c.fillStyle='#ffd9c6';c.beginPath();c.ellipse(-R*0.15,R*1.08,R*0.07,R*0.1,0,0,Math.PI*2);c.ellipse(R*0.15,R*1.08,R*0.07,R*0.1,0,0,Math.PI*2);c.fill();
  // голова: волосы сзади, хвостики, лицо, чёлка
  const hy=-R*0.32,hr=R*0.62;
  c.fillStyle=hair;c.beginPath();c.arc(0,hy+hr*0.05,hr*1.08,0,Math.PI*2);c.fill();
  for(const sd of [-1,1]){c.beginPath();c.ellipse(sd*hr*0.98,hy+hr*0.45,hr*0.3,hr*0.5,sd*0.35,0,Math.PI*2);c.fill()}
  const sg=c.createRadialGradient(-hr*0.3,hy-hr*0.3,hr*0.1,0,hy,hr);sg.addColorStop(0,'#fff1e8');sg.addColorStop(1,'#ffd5c2');
  c.fillStyle=sg;c.beginPath();c.arc(0,hy+hr*0.08,hr*0.86,0,Math.PI*2);c.fill();
  c.fillStyle=hair;c.beginPath();c.arc(0,hy+hr*0.05,hr*1.02,Math.PI*1.02,Math.PI*1.98);
  c.quadraticCurveTo(hr*0.75,hy-hr*0.05,hr*0.45,hy-hr*0.28);c.quadraticCurveTo(hr*0.25,hy-hr*0.02,0,hy-hr*0.3);
  c.quadraticCurveTo(-hr*0.3,hy-hr*0.02,-hr*0.48,hy-hr*0.3);c.quadraticCurveTo(-hr*0.75,hy-hr*0.02,-hr*1.0,hy+hr*0.05);c.fill();
  c.fillStyle='rgba(255,255,255,.28)';c.beginPath();c.ellipse(-hr*0.35,hy-hr*0.62,hr*0.32,hr*0.1,-0.4,0,Math.PI*2);c.fill();
  // лицо
  const lx=Math.cos(face)*hr*0.07,ly=Math.sin(face)*hr*0.05,blink=((t+seed*1.7)%4.3)<0.13;
  for(const sd of [-1,1]){
    const ex=sd*hr*0.34+lx,ey=hy+hr*0.18+ly;
    if(o.sleep||blink){c.strokeStyle='#4a2550';c.lineWidth=hr*0.07;c.lineCap='round';c.beginPath();c.arc(ex,ey-hr*0.03,hr*0.13,0.2,Math.PI-0.2);c.stroke()}
    else{
      c.fillStyle='#3a1f4d';c.beginPath();c.ellipse(ex,ey,hr*0.15,hr*0.2,0,0,Math.PI*2);c.fill();
      c.fillStyle=shade(col,-0.05);c.beginPath();c.ellipse(ex,ey+hr*0.07,hr*0.11,hr*0.1,0,0,Math.PI*2);c.fill();
      c.fillStyle='#3a1f4d';c.beginPath();c.ellipse(ex,ey+hr*0.02,hr*0.07,hr*0.1,0,0,Math.PI*2);c.fill();
      c.fillStyle='#fff';c.beginPath();c.arc(ex-hr*0.05,ey-hr*0.08,hr*0.065,0,Math.PI*2);c.fill();
      c.beginPath();c.arc(ex+hr*0.05,ey+hr*0.07,hr*0.03,0,Math.PI*2);c.fill();
    }
  }
  c.fillStyle='rgba(255,120,170,.45)';c.beginPath();c.ellipse(-hr*0.55+lx,hy+hr*0.45,hr*0.14,hr*0.08,0,0,Math.PI*2);c.ellipse(hr*0.55+lx,hy+hr*0.45,hr*0.14,hr*0.08,0,0,Math.PI*2);c.fill();
  c.strokeStyle='#8a3a5a';c.lineWidth=hr*0.06;c.lineCap='round';c.beginPath();
  if(o.sleep)c.arc(lx,hy+hr*0.5,hr*0.06,0,Math.PI*2);else c.arc(lx,hy+hr*0.42,hr*0.12,0.25,Math.PI-0.25);c.stroke();
  drawHeadwear(c,sk.head,hy,hr,col,hair);
  c.restore();
}
const PET_COL={cat:'#ffb26b',bunny:'#ffffff',owl:'#b98a62',fox:'#ff8a3d',unicorn:'#fff6fb'};
function drawPet(c,x,y,type,t,face,s){
  if(!type||type==='none')return;
  const P=BODY_R*0.62*(s||1),bob=Math.abs(Math.sin(t*6))*P*0.25,col=PET_COL[type];
  c.fillStyle='rgba(50,15,70,.18)';c.beginPath();c.ellipse(x,y+P*1.05,P*0.8,P*0.25,0,0,Math.PI*2);c.fill();
  c.save();c.translate(x,y-bob);
  const lx=Math.cos(face||0)*P*0.12;
  c.fillStyle=col;c.strokeStyle='rgba(90,40,60,.35)';c.lineWidth=P*0.08;
  // уши
  if(type==='cat'||type==='fox'){for(const sd of [-1,1]){c.beginPath();c.moveTo(sd*P*0.25,-P*0.6);c.lineTo(sd*P*0.75,-P*1.1);c.lineTo(sd*P*0.85,-P*0.3);c.closePath();c.fill();c.stroke()}}
  if(type==='bunny'){for(const sd of [-1,1]){c.beginPath();c.ellipse(sd*P*0.32,-P*1.15,P*0.2,P*0.55,sd*0.15,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#ffb3d6';c.beginPath();c.ellipse(sd*P*0.32,-P*1.1,P*0.09,P*0.38,sd*0.15,0,Math.PI*2);c.fill();c.fillStyle=col}}
  if(type==='owl'){for(const sd of [-1,1]){c.beginPath();c.moveTo(sd*P*0.4,-P*0.7);c.lineTo(sd*P*0.75,-P*1.0);c.lineTo(sd*P*0.8,-P*0.45);c.closePath();c.fill()}}
  // голова
  c.beginPath();c.arc(0,-P*0.15,P*0.85,0,Math.PI*2);c.fill();c.stroke();
  if(type==='unicorn'){
    const mane=['#ff9ad5','#ffd27a','#9be7ff','#c6a6ff'];mane.forEach((m,k)=>{c.fillStyle=m;c.beginPath();c.arc(-P*0.55+k*0.1*P,-P*0.75+k*P*0.28,P*0.24,0,Math.PI*2);c.fill()});
    const g=c.createLinearGradient(0,-P*1.6,0,-P*0.8);g.addColorStop(0,'#fff6d6');g.addColorStop(1,'#f0b850');c.fillStyle=g;c.beginPath();c.moveTo(-P*0.14,-P*0.9);c.lineTo(P*0.05,-P*1.65);c.lineTo(P*0.2,-P*0.88);c.closePath();c.fill();
  }
  if(type==='fox'){c.fillStyle='#fff';c.beginPath();c.ellipse(lx,P*0.25,P*0.45,P*0.32,0,0,Math.PI*2);c.fill()}
  if(type==='owl'){c.fillStyle='#f3dcc0';c.beginPath();c.arc(-P*0.33+lx,-P*0.2,P*0.33,0,Math.PI*2);c.arc(P*0.33+lx,-P*0.2,P*0.33,0,Math.PI*2);c.fill();c.fillStyle='#ffb43a';c.beginPath();c.moveTo(lx-P*0.1,P*0.05);c.lineTo(lx+P*0.1,P*0.05);c.lineTo(lx,P*0.25);c.fill()}
  // глаза
  const er=type==='owl'?P*0.17:P*0.12;
  c.fillStyle='#2a1838';for(const sd of [-1,1]){c.beginPath();c.arc(sd*P*0.33+lx,-P*0.2,er,0,Math.PI*2);c.fill()}
  c.fillStyle='#fff';for(const sd of [-1,1]){c.beginPath();c.arc(sd*P*0.33+lx-er*0.35,-P*0.2-er*0.35,er*0.38,0,Math.PI*2);c.fill()}
  if(type!=='owl'){c.fillStyle='#ff7ab0';c.beginPath();c.arc(lx,P*0.05,P*0.08,0,Math.PI*2);c.fill()}
  c.fillStyle='rgba(255,120,170,.4)';c.beginPath();c.arc(-P*0.6+lx,P*0.05,P*0.12,0,Math.PI*2);c.arc(P*0.6+lx,P*0.05,P*0.12,0,Math.PI*2);c.fill();
  c.restore();
}
// значки бутика: фея в этой вещи, дорожка или питомец
function drawItemIcon(cv,kind,id,big){
  const c=cv.getContext('2d'),W=cv.width,H=cv.height;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
  const sk=Object.assign(mySkin(),{[kind]:id}),t=performance.now()/1000;
  if(kind==='trail'){
    const cam={x:0,y:0,s:W/150,w:W,h:H,dpr:1};setWorld(c,cam);
    const pts=[];for(let k=0;k<=12;k++){const u=k/12;pts.push(-60+u*120,Math.sin(u*Math.PI*1.6+0.4)*26)}
    drawTrail(c,pts,COLORS[sk.color],id,t,1);return;
  }
  if(kind==='pet'){
    const cam={x:0,y:0,s:W/60,w:W,h:H,dpr:1};setWorld(c,cam);
    if(id==='none'){c.font='700 16px '+FONT_D;c.fillStyle='rgba(255,255,255,.4)';c.textAlign='center';c.textBaseline='middle';c.fillText('—',0,0);return}
    drawPet(c,0,4,id,0.3,Math.PI/2,1.9);return;
  }
  const cam={x:0,y:kind==='head'?-8:-2,s:W/(kind==='head'?44:64),w:W,h:H,dpr:1};setWorld(c,cam);
  drawFairy(c,0,0,sk,{t:0.35,face:Math.PI/2,seed:1});
}

// ---------- сад: трава, цветы, кувшинки, кристаллы, роза ----------
let grassTile=null;
function grassPattern(c){
  if(c.__grass)return c.__grass;
  if(!grassTile){
    const S=512,cv=document.createElement('canvas');cv.width=cv.height=S;grassTile=cv;
    const x=cv.getContext('2d');x.fillStyle='#b4e6ac';x.fillRect(0,0,S,S);
    let seed=11;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;
    for(let i=0;i<24;i++){const px=r()*S,py=r()*S,rad=50+r()*100,col=r()<0.5?'rgba(220,250,190,.45)':'rgba(140,205,140,.22)';
      for(let ox=-S;ox<=S;ox+=S)for(let oy=-S;oy<=S;oy+=S){const g=x.createRadialGradient(px+ox,py+oy,0,px+ox,py+oy,rad);
        g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(px+ox-rad,py+oy-rad,rad*2,rad*2)}}
    for(let i=0;i<1300;i++){const px=r()*S,py=r()*S,h=4+r()*6,a=-0.5+r();
      x.strokeStyle=r()<0.5?'rgba(150,215,140,.6)':'rgba(90,160,100,.4)';x.lineWidth=1.4;x.lineCap='round';
      x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.sin(a)*h,py-Math.cos(a)*h);x.stroke()}
    // крошечные цветочки в траве
    for(let i=0;i<70;i++){const px=r()*S,py=r()*S,col=['#ffffff','#fff3a8','#ffd0ea','#d9ccff'][Math.floor(r()*4)];
      x.fillStyle=col;for(let k=0;k<5;k++){const a=k*1.2566;x.beginPath();x.arc(px+Math.cos(a)*2.2,py+Math.sin(a)*2.2,1.7,0,Math.PI*2);x.fill()}
      x.fillStyle='#ffc93c';x.beginPath();x.arc(px,py,1.3,0,Math.PI*2);x.fill()}
  }
  return c.__grass=c.createPattern(grassTile,'repeat');
}
const FLW={};
function flowerSprite(ci,type){
  const key=ci+'_'+type;if(FLW[key])return FLW[key];
  const S=48,cv=document.createElement('canvas');cv.width=cv.height=S;const x=cv.getContext('2d');x.translate(S/2,S/2);
  const col=COLORS[ci]||COLORS[0],pet=mix(col,'#ffffff',0.35),edge=shade(col,-0.12);
  // листики
  x.fillStyle='#5fb874';for(const a of [0.7,2.4]){x.beginPath();x.ellipse(Math.cos(a)*11,Math.sin(a)*11+3,9,4,a,0,Math.PI*2);x.fill()}
  x.lineWidth=1.2;x.strokeStyle=edge;
  if(type===0){for(let k=0;k<6;k++){const a=k*Math.PI/3;x.fillStyle=pet;x.beginPath();x.ellipse(Math.cos(a)*8,Math.sin(a)*8,7,4.2,a,0,Math.PI*2);x.fill();x.stroke()}
    x.fillStyle='#ffd54a';x.beginPath();x.arc(0,0,4.5,0,Math.PI*2);x.fill()}
  else if(type===1){x.fillStyle=col;x.beginPath();x.moveTo(-9,-6);x.lineTo(-5,-1);x.lineTo(-2,-9);x.lineTo(2,-1);x.lineTo(5,-9);x.lineTo(9,-6);x.quadraticCurveTo(10,8,0,9);x.quadraticCurveTo(-10,8,-9,-6);x.fill();
    x.fillStyle='rgba(255,255,255,.35)';x.beginPath();x.ellipse(-3,1,2.5,5,0.2,0,Math.PI*2);x.fill()}
  else if(type===2){for(const [r,cl] of [[11,edge],[8.5,col],[6,pet],[3.4,col]]){x.fillStyle=cl;x.beginPath();x.arc(0,0,r,0,Math.PI*2);x.fill()}
    x.strokeStyle='rgba(255,255,255,.5)';x.beginPath();x.arc(0,0,7,3.6,5.6);x.stroke()}
  else{x.fillStyle=pet;star5(x,0,0,12,5.5,0);x.fill();x.stroke();x.fillStyle='#ffffff';x.beginPath();x.arc(0,0,3.6,0,Math.PI*2);x.fill();x.fillStyle='#ffc93c';x.beginPath();x.arc(0,0,2.2,0,Math.PI*2);x.fill()}
  return FLW[key]=cv;
}
function drawGem(c,x,y,s,now){
  c.save();c.translate(x,y);c.scale(s,s);
  c.fillStyle='rgba(50,15,70,.2)';c.beginPath();c.ellipse(1,13,8,3,0,0,Math.PI*2);c.fill();
  const g=c.createLinearGradient(-9,-9,9,9);g.addColorStop(0,'#e9fbff');g.addColorStop(0.5,'#7fe3ff');g.addColorStop(1,'#c58bff');
  c.fillStyle=g;c.beginPath();c.moveTo(-9,-3);c.lineTo(-5,-9);c.lineTo(5,-9);c.lineTo(9,-3);c.lineTo(0,10);c.closePath();c.fill();
  c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=1;c.stroke();
  c.beginPath();c.moveTo(-9,-3);c.lineTo(9,-3);c.moveTo(-5,-9);c.lineTo(-2,-3);c.lineTo(0,10);c.lineTo(2,-3);c.lineTo(5,-9);c.strokeStyle='rgba(255,255,255,.55)';c.stroke();
  const tw=(now/700+x*0.01)%3;if(tw<0.4){c.globalAlpha=Math.sin(tw/0.4*Math.PI);c.fillStyle='#fff';star5(c,5,-7,6,1.3,0);c.fill();c.globalAlpha=1}
  c.restore();
}
function drawRose(c,x,y,s,now){
  c.save();c.translate(x,y+Math.sin(now/260)*3);c.scale(s,s);
  c.save();c.rotate(now/1800);c.globalAlpha=0.4;
  for(let i=0;i<10;i++){c.rotate(Math.PI/5);const g=c.createLinearGradient(0,0,0,-85);g.addColorStop(0,'rgba(255,220,120,.95)');g.addColorStop(1,'rgba(255,200,240,0)');c.fillStyle=g;c.beginPath();c.moveTo(-7,0);c.lineTo(0,-85);c.lineTo(7,0);c.fill()}
  c.restore();
  c.fillStyle='#3f9a55';c.beginPath();c.ellipse(-14,10,13,6,-0.5,0,Math.PI*2);c.ellipse(14,10,13,6,0.5,0,Math.PI*2);c.fill();
  const layers=[[20,'#c2185b'],[16,'#e8457f'],[12,'#ff6fa3'],[8,'#ff94bf'],[4.5,'#ffc0da']];
  for(const [r,cl] of layers){c.fillStyle=cl;c.beginPath();for(let k=0;k<6;k++){const a=k*Math.PI/3+r*0.2;c.arc(Math.cos(a)*r*0.35,Math.sin(a)*r*0.35,r*0.72,0,Math.PI*2)}c.fill()}
  c.strokeStyle='#fff6c8';c.lineWidth=2;c.beginPath();c.arc(0,0,24,0,Math.PI*2);c.globalAlpha=0.5+0.3*Math.sin(now/200);c.stroke();c.globalAlpha=1;
  c.restore();
}
const POWER_INFO={S:['🦋','#ffb6e1','Скорость'],H:['🫧','#9be7ff','Пузырь-защита'],R:['🌈','#ffd27a','Радуга!'],F:['❄️','#b9ecff','Иней'],D:['💎','#7fe3ff','+1'],G:['🌹','#ff6fa3','Волшебная роза!']};
function drawPower(c,p,now,sc){
  const info=POWER_INFO[p.t]||['?','#fff'],b=Math.sin(now/300+p.id)*3;
  const g=c.createRadialGradient(p.x,p.y+b,4,p.x,p.y+b,34*sc);g.addColorStop(0,info[1]);g.addColorStop(1,'rgba(255,255,255,0)');
  c.globalAlpha=0.45+0.15*Math.sin(now/200+p.id);c.fillStyle=g;c.beginPath();c.arc(p.x,p.y+b,34*sc,0,Math.PI*2);c.fill();c.globalAlpha=1;
  c.fillStyle='rgba(50,15,70,.2)';c.beginPath();c.ellipse(p.x+2,p.y+19,12*sc,4*sc,0,0,Math.PI*2);c.fill();
  const og=c.createRadialGradient(p.x-5,p.y+b-6,2,p.x,p.y+b,18*sc);og.addColorStop(0,'rgba(255,255,255,.95)');og.addColorStop(0.7,'rgba(255,240,252,.55)');og.addColorStop(1,rgba(info[1],.8));
  c.fillStyle=og;c.strokeStyle='#fff';c.lineWidth=2;
  c.beginPath();c.arc(p.x,p.y+b,17*sc,0,Math.PI*2);c.fill();c.stroke();
  c.font=`${17*sc}px ${EMOJI}`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#000';
  c.fillText(info[0],p.x,p.y+b+1);
}
// дорожка: лента цвета феи и украшения по ней
const RAINBOW=['#ff6b8b','#ffb04a','#ffe066','#7be495','#6fc3ff','#b38cff'];
function drawTrail(c,pts,col,type,t,alpha){
  const n=pts.length/2;if(n<2)return;
  c.lineJoin='round';c.lineCap='round';
  const path=()=>{c.beginPath();c.moveTo(pts[0],pts[1]);for(let k=2;k<pts.length;k+=2)c.lineTo(pts[k],pts[k+1])};
  c.globalAlpha=alpha||1;
  path();c.strokeStyle='rgba(60,20,80,.16)';c.lineWidth=14;c.stroke();
  if(type==='rainbow'){
    RAINBOW.forEach((cl,k)=>{path();c.strokeStyle=cl;c.lineWidth=13-k*2;c.stroke()});
  }else{
    path();c.strokeStyle=rgba(col,.88);c.lineWidth=11;c.stroke();
    path();c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=3;c.setLineDash([1,9]);c.lineDashOffset=-t*40;c.stroke();c.setLineDash([]);
  }
  // украшения через равные промежутки
  let acc=12,k=0;
  for(let i=2;i<pts.length;i+=2){
    const x0=pts[i-2],y0=pts[i-1],x1=pts[i],y1=pts[i+1],L=Math.hypot(x1-x0,y1-y0);
    let d=acc;
    while(d<L){
      const x=x0+(x1-x0)*d/L,y=y0+(y1-y0)*d/L,a=Math.atan2(y1-y0,x1-x0),w=Math.sin(t*3+k)*0.35;k++;
      decor(c,type,x,y,a+w,col,k);d+=26;
    }
    acc=d-L;
  }
  c.globalAlpha=1;
}
function decor(c,type,x,y,a,col,k){
  c.save();c.translate(x,y);c.rotate(a);
  switch(type){
    case'hearts':c.fillStyle=k%2?'#fff':shade(col,-0.1);heartPath(c,0,1,8);c.fill();break;
    case'stars':c.fillStyle=k%2?'#fff6c8':'#ffd27a';star5(c,0,0,7,3,0);c.fill();break;
    case'snow':c.strokeStyle='#ffffff';c.lineWidth=1.6;c.beginPath();for(let i=0;i<3;i++){c.rotate(Math.PI/3);c.moveTo(-6,0);c.lineTo(6,0)}c.stroke();break;
    case'notes':c.fillStyle=k%2?'#fff':shade(col,-0.25);c.beginPath();c.ellipse(-2,4,3.6,2.6,-0.4,0,Math.PI*2);c.fill();c.fillRect(1,-7,1.6,11);c.beginPath();c.moveTo(2.6,-7);c.quadraticCurveTo(7,-5,5.5,-1);c.lineTo(5,-2);c.quadraticCurveTo(5,-4.5,2.6,-5);c.fill();break;
    case'rainbow':c.fillStyle='#fff';star5(c,0,0,4,1.6,0);c.fill();break;
    default:c.fillStyle=k%2?'#ffffff':mix(col,'#ffffff',0.5);c.beginPath();c.ellipse(0,0,6.5,3.4,0.6,0,Math.PI*2);c.fill();
      c.strokeStyle=rgba(col,.6);c.lineWidth=0.8;c.stroke();
  }
  c.restore();
}

// ================= Состояние сада на этом устройстве =================
// S — раунд: феи (из снимков комнаты), клетки сада, дорожки, бонусы, частицы.
// G — игра, в которой ты летаешь; demo.D — живой сад на фоне меню (тот же код, своя комната с ботами).
let G=null;
let mode=null; // 'online' | 'solo'
const INTERP=110; // показываем чужих фей чуть «в прошлом», чтобы движение было плавным
const EMOTES=['👋 Привет!','💖','😍','😂','😮','😤 Ну держись!','🌸 Красота!','🤝 Дружим?','✨ Ура!'];
const TP=8; // пикселей на клетку в картинке сада
function slotOf(S,i){const sid=S&&S.order&&S.order[i];return sid&&S.slots&&S.slots[sid]||null}
function nameOf(S,i){const s=slotOf(S,i);if(!s)return'?';if(s.kind==='bot'&&s.away)return(s.name||'Фея')+' (бот)';return s.name||(s.kind==='bot'?'Фея':'Игрок')}
function skinOf(S,i){const s=slotOf(S,i);return s&&s.skin||{color:0,wings:'butterfly',head:'none',trail:'petals',pet:'none'}}
function colorOf(S,i){return COLORS[skinOf(S,i).color]||COLORS[0]}
function unrle(a,n){const o=new Uint8Array(n);let p=0;for(let k=0;k<a.length;k+=2){o.fill(a[k],p,p+a[k+1]);p+=a[k+1]}return o}
function refreshColors(S){
  if(!S||!S.order)return;
  const key=S.order.map((s,i)=>skinOf(S,i).color).join(',');
  if(key===S.colKey)return;
  S.colKey=key;
  S.pal=S.order.map((s,i)=>{const c=colorOf(S,i);return {a:mix(c,'#ffffff',0.48),e:shade(c,-0.06),ci:skinOf(S,i).color}});
  if(S.tx)paintAll(S);
}
function paintCell(S,c){
  const N=S.N,x=c%N,y=(c/N)|0,v=S.own[c],t=S.tx,X=x*TP,Y=y*TP;
  t.clearRect(X,Y,TP,TP);
  if(!v||v===WALL)return;
  // наружные углы клетки скругляем — край сада получается волнистым, как у клумбы, а не «лесенкой»
  const own=S.own,L=own[c-1]!==v,Rt=own[c+1]!==v,T=own[c-N]!==v,B=own[c+N]!==v,r=TP*0.5,i=1.6;
  const tl=L&&T?r:0,tr=Rt&&T?r:0,br=Rt&&B?r:0,bl=L&&B?r:0;
  let fill,edge;
  if(v===POND){fill='#86d6f1';edge='#eef8dc'}
  else{const p=S.pal[v-1];if(!p)return;fill=p.a;edge=p.e}
  t.fillStyle=edge;t.beginPath();t.roundRect(X,Y,TP,TP,[tl,tr,br,bl]);t.fill();
  const x0=X+(L?i:0),y0=Y+(T?i:0),x1=X+TP-(Rt?i:0),y1=Y+TP-(B?i:0);
  t.fillStyle=fill;t.beginPath();t.roundRect(x0,y0,x1-x0,y1-y0,[tl&&r-i,tr&&r-i,br&&r-i,bl&&r-i]);t.fill();
}
function paintAround(S,c){paintCell(S,c);const N=S.N;if(c%N>0)paintCell(S,c-1);if(c%N<N-1)paintCell(S,c+1);if(c>=N)paintCell(S,c-N);if(c<N*N-N)paintCell(S,c+N)}
function paintAll(S){S.tx.clearRect(0,0,S.tcv.width,S.tcv.height);for(let c=0;c<S.own.length;c++)if(S.own[c]&&S.own[c]!==WALL)paintCell(S,c)}
function cellAt(S,x,y){const cx=Math.floor(x/CELL+S.N/2),cy=Math.floor(y/CELL+S.N/2);return cx<0||cy<0||cx>=S.N||cy>=S.N?-1:cy*S.N+cx}
function blockedAt(S,x,y){const c=cellAt(S,x,y);return c<0||S.own[c]>=POND}

function newState(demo){return {demo:!!demo,slots:{}}}
function initRound(S,m){
  const order=m.order||[];
  Object.assign(S,{round:m.round,N:m.N,R:m.R,total:m.total,order,opts:m.opts||{},
    own:unrle(m.grid,m.N*m.N),born:new Float32Array(m.N*m.N),
    trails:order.map(()=>[]),
    f:order.map((sid,i)=>({i,sid,x:0,y:0,a:0,flags:1,seen:false,catches:((m.stats||{})[i]||[0,0])[0],dia:((m.stats||{})[i]||[0,0])[1],emote:null,emoteT:0,
      pet:null,seed:Math.random()*10})),
    pk:new Map(),snaps:[],off:null,last:null,lastAt:0,phase:m.phase,phaseT:m.phaseT,tl:(m.tl||0)/10,ar:m.ar||[],
    parts:[],texts:[],feed:[],flyPk:[],standings:m.standings||null,winner:m.winner||null,changed:[],
    myI:S.demo?-1:order.indexOf(NET.slot),pred:null,hist:[],flashT:0,flashCd:0,cam:null,shake:0,
    banner:null,lastBeep:-1,score:m.score||{},matchOver:!!m.match_over,colKey:null,sleepUntil:0});
  if(!S.demo)S.slots=NET.slots;
  if(!S.tcv)S.tcv=document.createElement('canvas');
  S.tcv.width=S.tcv.height=S.N*TP;S.tx=S.tcv.getContext('2d');
  refreshColors(S);paintAll(S);
  for(const t of m.trails||[])if(S.trails[t[0]])S.trails[t[0]]=t.slice(1);
  for(const p of m.pk||[])S.pk.set(p[0],{id:p[0],x:p[1],y:p[2],t:p[3],born:-1e9});
  applySnap(S,{t:m.t,p:m.p,ph:m.phase,pt:Math.round((m.phaseT||0)*10),tl:m.tl,ar:m.ar},true);
  if(S.demo)return;
  $('roundEnd').classList.remove('show');$('emotes').classList.remove('show');
  reHidden=false;
  if(m.phase==='end'&&m.standings)showRoundEnd({winner:m.winner,standings:m.standings,score:m.score,match_over:m.match_over,round:m.round},true);
  updatePauseBtn();
}

function applySnap(S,m,initial){
  const now=performance.now();
  const o=now-m.t;
  if(S.off==null||o<S.off)S.off=o;else S.off+=(o-S.off)*0.02; // разница часов: берём самую быструю доставку
  const map=new Map();for(const a of m.p||[])map.set(a[0],a);
  S.snaps.push({t:m.t,map});if(S.snaps.length>40)S.snaps.shift();
  S.last=map;S.lastAt=now;S.lastT=m.t;
  const prevPhase=S.phase;
  S.phase=m.ph;S.phaseT=(m.pt||0)/10;if(m.tl!=null)S.tl=m.tl/10;if(m.ar)S.ar=m.ar;
  if(!initial&&prevPhase!=='play'&&S.phase==='play'){S.pred=null;S.hist=[]}
  // сад
  S.changed=[];
  const ns=now/1000;
  if(m.gf){
    const nw=unrle(m.gf,S.N*S.N);
    for(let c=0;c<nw.length;c++)if(nw[c]!==S.own[c]){S.born[c]=ns;S.changed.push(c)}
    S.own=nw;paintAll(S);
  }
  if(m.gd){
    const gd=m.gd;
    for(let k=0;k<gd.length;k+=2){const c=gd[k];S.own[c]=gd[k+1];S.born[c]=ns;S.changed.push(c)}
    if(gd.length>1600)paintAll(S);else for(let k=0;k<gd.length;k+=2)paintAround(S,gd[k]);
  }
  for(const p of m.add||[])S.pk.set(p[0],{id:p[0],x:p[1],y:p[2],t:p[3],born:now});
  for(const d of m.del||[]){
    const p=S.pk.get(d[0]);if(!p)continue;
    S.pk.delete(d[0]);
    S.flyPk.push({x:p.x,y:p.y,t:p.t,to:d[1],life:0.25,max:0.25});
  }
  for(const e of m.ev||[])onEvent(S,e);
  for(const t of m.tr||[]){const a=S.trails[t[0]];if(a)for(let k=1;k<t.length;k++)a.push(t[k])}
  // своё положение: сравниваем с тем, где мы были «пинг назад», и мягко поправляем
  const me=S.myI>=0?map.get(S.myI):null;
  if(S.pred&&me&&!(me[4]&16)&&S.phase==='play'){
    const t=now-NET.rtt;
    let h=null;for(let i=S.hist.length-1;i>=0;i--){if(S.hist[i].t<=t){h=S.hist[i];break}}
    if(!h)h=S.hist[0]||S.pred;
    const ex=me[1]-h.x,ey=me[2]-h.y;
    if(Math.hypot(ex,ey)>160){S.pred.x=me[1];S.pred.y=me[2];S.hist=[]}
    else{const cx=ex*0.3,cy=ey*0.3;S.pred.x+=cx;S.pred.y+=cy;for(const q of S.hist){q.x+=cx;q.y+=cy}}
  }
}
function fpos(S,i){
  const f=S.f[i];
  if(f&&f.seen)return f;
  const a=S.last&&S.last.get(i);return a?{x:a[1],y:a[2]}:{x:0,y:0};
}
function hearVol(S,x,y){
  const c=S.cam;if(!c)return 1;
  const d=Math.hypot(x-c.x,y-c.y);return clamp(1-d/(950/Math.min(1,c.s*1.4)),0,1);
}
function onEvent(S,e){
  const now=performance.now(),live=!S.demo,me=S.myI;
  const snd=(n,v,a)=>{if(live)sfx(n,v,a)};
  switch(e[0]){
    case'cap':{ // фея вернулась домой: обведённое расцветает волной от середины
      const [,i,got,cx,cy]=e,col=colorOf(S,i),ns=now/1000;
      for(const c of S.changed)if(S.own[c]===i+1){const N=S.N,x=((c%N)-N/2+0.5)*CELL,y=(((c/N)|0)-N/2+0.5)*CELL;S.born[c]=ns+Math.min(0.9,Math.hypot(x-cx,y-cy)/900)}
      const f=fpos(S,i);
      if(got>4){for(let k=0;k<(Q.low?6:14);k++)addPart(S,f.x,f.y,{v:200,life:0.8,col:k%2?'#fff':mix(col,'#ffffff',0.3),size:5,drag:3,shape:'petal'});
        addPart(S,f.x,f.y,{ring:true,life:0.5,col:'#fff',size:BODY_R})}
      if(i===me&&live){
        if(got>0)addText(S,f.x,f.y-42,'+'+got+' 🌸','#ff4fa8',1.4,Math.min(1.6,1+got/120));
        snd('cap',1,got);vibrate(15);
        bumpStats(()=>{stats.loops++;stats.cells+=got;stats.bigLoop=Math.max(stats.bigLoop,got)});
        quest('loops',1);quest('big',got,true);
      }else if(live&&got>8)snd('cap',hearVol(S,f.x,f.y)*0.35,got);
      break;}
    case'tc':S.trails[e[1]]=[];break;
    case'x':{ // фея зачарована: дорожка осыпается, она засыпает дома
      const [,ki,vi,x,y,nx,ny]=e,col=colorOf(S,vi);
      const tr=S.trails[vi];
      // лепестки с порванной дорожки
      if(tr&&tr.length&&!Q.low)for(let k=0;k<tr.length;k+=6)addPart(S,tr[k],tr[k+1],{v:60,life:0.9,col:k%4?mix(col,'#ffffff',0.4):'#fff',size:4.5,drag:2,shape:'petal'});
      for(let k=0;k<(Q.low?10:24);k++)addPart(S,x,y,{v:300,life:0.8,col:k%3?col:'#ffffff',size:4,drag:3,shape:k%2?'star':'dot',glow:k%2===0});
      addPart(S,x,y,{ring:true,life:0.6,col:'#fff',size:BODY_R*1.4});
      addPart(S,nx,ny,{ring:true,life:0.8,col:'#d9b8ff',size:BODY_R*2});
      if(ki>=0&&S.f[ki])S.f[ki].catches++;
      if(S.f[vi]){S.f[vi].pet=null}
      const nm=i=>i===me?'Ты':nameOf(S,i);
      S.feed.push({t:now,text:(ki>=0?nm(ki)+' 🪄 ':'💤 ')+nm(vi),ki,vi});
      if(S.feed.length>5)S.feed.shift();
      if(!live)break;
      if(vi===me){
        snd('sleep');vibrate([60,40,120]);S.shake=10;S.flash=1;S.flashCol='#b892ff';
        S.banner={t:now,text:ki>=0?'Тебя зачаровали!':'Твой сад отняли!',sub:ki>=0?nameOf(S,ki)+' коснулась твоей дорожки':'Просыпаешься в новом садике',col:'#b892ff',big:true};
        S.sleepUntil=now+RULES.SLEEP_T*1000;S.pred=null;
      }else if(ki===me){
        snd('cut');vibrate(40);S.shake=Math.max(S.shake,6);S.flash=0.5;S.flashCol='#fff2fb';
        addText(S,x,y-30,'🪄 Чары!','#c86bff',1.4,1.3);
        S.banner={t:now,text:'Чары!',sub:nameOf(S,vi)+' уснула',col:'#ff7ac8'};
        bumpStats(()=>{stats.catches++});quest('catches',1);
      }else snd('cut',hearVol(S,x,y)*0.5);
      break;}
    case'h':{ // пузырь выдержал
      const p=fpos(S,e[1]);
      addPart(S,p.x,p.y,{ring:true,life:0.45,col:'#9be7ff',size:BODY_R+12});
      for(let k=0;k<10;k++)addPart(S,p.x,p.y,{v:180,life:0.5,col:'#e6fbff',size:3,drag:3});
      snd('bubble',hearVol(S,p.x,p.y));
      if(e[1]===me&&live){addText(S,p.x,p.y-44,'🫧 Пузырь спас!','#5cc8ff',1.3);vibrate(30)}
      break;}
    case'p':{ // бонус или кристалл
      const p=fpos(S,e[1]),info=POWER_INFO[e[2]];
      if(e[1]===me&&live){
        if(info)addText(S,p.x,p.y-44,info[0]+' '+info[2],e[2]==='D'?'#3fb6e8':'#ff4fa8',e[2]==='D'?0.9:1.3,e[2]==='D'?0.85:1);
        if(e[2]==='D'){snd('dia');bumpStats(()=>{stats.dia++});quest('dia',1)}
        else{snd(e[2]==='G'?'rose':'power');quest('powers',1);if(e[2]==='G'){bumpStats(()=>{stats.dia+=3});quest('dia',3)}}
      }else if(info&&e[2]!=='D'&&live&&hearVol(S,p.x,p.y)>0.3)addText(S,p.x,p.y-44,info[0]+' '+info[2],info[1],1.2,0.9);
      if(e[2]==='R'||e[2]==='G'){for(let k=0;k<(Q.low?8:20);k++)addPart(S,p.x,p.y,{v:260,life:0.9,col:RAINBOW[k%6],size:4,drag:2.5,shape:'star',glow:true})}
      if(S.f[e[1]]&&e[2]==='D')S.f[e[1]].dia++;
      if(S.f[e[1]]&&e[2]==='G')S.f[e[1]].dia+=3;
      break;}
    case'f':{ // иней
      const [,i,x,y]=e;
      addPart(S,x,y,{ring:true,life:0.7,col:'#bdf0ff',size:FROST_R/2.2});
      for(let k=0;k<(Q.low?10:26);k++)addPart(S,x,y,{v:380,life:0.9,col:'#ffffff',size:3.5,drag:2.2,shape:'snow'});
      snd('frost',hearVol(S,x,y));
      if(live&&i!==me&&me>=0&&S.f[me]&&Math.hypot(S.f[me].x-x,S.f[me].y-y)<FROST_R)addText(S,S.f[me].x,S.f[me].y-44,'❄️ Брр!','#5cc8ff',1.2);
      break;}
    case'd':{ // вспышка
      const p=fpos(S,e[1]);
      for(let k=0;k<10;k++)addPart(S,p.x,p.y,{v:140,life:0.45,col:k%2?'#fff':mix(colorOf(S,e[1]),'#ffffff',0.4),size:3.5,drag:4,shape:'star',glow:true});
      if(e[1]!==me)snd('flash',hearVol(S,p.x,p.y)*0.5);
      break;}
    case'wk':{const p=fpos(S,e[1]);addPart(S,p.x,p.y,{ring:true,life:0.5,col:'#ffe3f5',size:BODY_R*1.3});if(e[1]===me&&live){S.banner={t:now,text:'Проснулась!',col:'#ff7ac8'};snd('go',0.6)}break}
    case'w':if(live){S.banner={t:now,text:'Последние 30 секунд!',sub:'Скорее обводи всё, что успеешь',col:'#ff6b8b',big:true};snd('warn')}break;
    case'go':if(live){S.banner={t:now,text:'Полетели!',col:'#ff7ac8',big:true};snd('go')}break;
    case'g':
      if(live){S.banner={t:now,text:'Волшебная роза!',sub:'Расцветает большой сад и дарит пузырь — она на карте',col:'#ff6fa3'};snd('rose')}
      for(let k=0;k<(Q.low?10:26);k++)addPart(S,e[1],e[2],{v:260,life:1.1,col:k%2?'#ffd27a':'#ff9ad5',size:4,drag:2.4,shape:'star',glow:true});
      break;
    case'sf':
      if(live){S.banner={t:now,text:'Звездопад!',sub:'Собирай 💎 кристаллы',col:'#7fe3ff',big:true};snd('star')}
      S.starfall=now;
      break;
  }
}
function addPart(S,x,y,o){
  const a=Math.random()*Math.PI*2,v=(o.v||0)*(0.3+Math.random()*0.7);
  S.parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:o.life,max:o.life,col:o.col,size:o.size||3,drag:o.drag||2,ring:!!o.ring,glow:!!o.glow,shape:o.shape||'dot',rot:Math.random()*6,vr:(Math.random()-0.5)*8,fall:o.fall||0});
  const cap=Q.low?220:600;if(S.parts.length>cap)S.parts.splice(0,S.parts.length-cap);
}
function addText(S,x,y,text,col,life,size){S.texts.push({x,y,text,col,life:life||1,max:life||1,size:size||1})}

// ================= Управление =================
// Фея летит всегда — игрок выбирает только направление
const keys=new Set();
let mouse=null,joy=null,inputSent={a:0,at:0},lastDir=null;
const KEYMAP={KeyW:'u',ArrowUp:'u',KeyS:'d',ArrowDown:'d',KeyA:'l',ArrowLeft:'l',KeyD:'r',ArrowRight:'r'};
addEventListener('keydown',e=>{
  if(!$('game').classList.contains('active'))return;
  if(KEYMAP[e.code]){keys.add(KEYMAP[e.code]);mouse=null;e.preventDefault()} // играют с клавиатуры — мышь не ведёт
  else if(e.code==='Space'||e.code==='ShiftLeft'||e.code==='ShiftRight'){doFlash();e.preventDefault()}
  else if(e.code==='Escape'&&mode==='solo')setPaused(!soloPaused());
  else if(/^Digit[1-9]$/.test(e.code)){sendEmote(+e.code.slice(5)-1)}
});
addEventListener('keyup',e=>{if(KEYMAP[e.code])keys.delete(KEYMAP[e.code])});
addEventListener('blur',()=>{keys.clear();joy=null});
const cv=$('cv');
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  audioInit();
  $('emotes').classList.remove('show');
  if(e.pointerType==='mouse'){mouse={x:e.clientX,y:e.clientY};doFlash();return}
  if(!joy){joy={id:e.pointerId,bx:e.clientX,by:e.clientY,x:e.clientX,y:e.clientY};try{cv.setPointerCapture(e.pointerId)}catch(_){}}
  else doFlash(); // второй палец — вспышка
  e.preventDefault();
});
cv.addEventListener('pointermove',e=>{
  if(e.pointerType==='mouse'){mouse={x:e.clientX,y:e.clientY};return}
  if(joy&&joy.id===e.pointerId){
    joy.x=e.clientX;joy.y=e.clientY;
    // джойстик «едет» за пальцем, если тянуть дальше края
    const dx=joy.x-joy.bx,dy=joy.y-joy.by,l=Math.hypot(dx,dy),max=joyR();
    if(l>max){joy.bx=joy.x-dx/l*max;joy.by=joy.y-dy/l*max}
  }
});
const endJoy=e=>{if(joy&&joy.id===e.pointerId)joy=null};
cv.addEventListener('pointerup',endJoy);cv.addEventListener('pointercancel',endJoy);
function joyR(){return clamp(Math.min(innerWidth,innerHeight)*0.11,40,70)}
$('btnFlash').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();audioInit();doFlash()});

function curDir(){
  let x=0,y=0;
  if(keys.has('u'))y--;if(keys.has('d'))y++;if(keys.has('l'))x--;if(keys.has('r'))x++;
  if(x||y)return lastDir=Math.atan2(y,x);
  if(joy){const dx=joy.x-joy.bx,dy=joy.y-joy.by;if(Math.hypot(dx,dy)>8)return lastDir=Math.atan2(dy,dx);return lastDir}
  if(mouse&&G&&G.cam&&G.myI>=0){
    const me=G.f[G.myI];
    const sx=(me.x-G.cam.x)*G.cam.s+G.cam.w/2,sy=(me.y-G.cam.y)*G.cam.s+G.cam.h/2;
    if(Math.hypot(mouse.x-sx,mouse.y-sy)>6)return lastDir=Math.atan2(mouse.y-sy,mouse.x-sx);
  }
  return lastDir;
}
function doFlash(){
  if(!G||G.phase!=='play'||G.myI<0)return;
  const me=G.last&&G.last.get(G.myI);if(!me||me[4]&16)return;
  if(G.flashCd>0)return;
  G.flashT=FLASH_T;G.flashCd=FLASH_CD;
  sfx('flash',0.8);
  const a=curDir();
  netSend({action:'input',a:+(a==null?G.f[G.myI].a:a).toFixed(3),d:1});
  inputSent.at=performance.now();
}
function sendInput(now){
  if(!G||G.myI<0)return;
  const a=curDir();if(a==null)return;
  if((Math.abs(angDiff(inputSent.a,a))>0.03&&now-inputSent.at>33)||now-inputSent.at>250){
    netSend({action:'input',a:+a.toFixed(3)});
    inputSent={a,at:now};
  }
}

// свой полёт считаем сразу, не дожидаясь комнаты
function predict(dt,now){
  const S=G,me=S.myI>=0&&S.last?S.last.get(S.myI):null;
  S.flashT=Math.max(0,S.flashT-dt);S.flashCd=Math.max(0,S.flashCd-dt);
  if(!me||(me[4]&16)||S.phase!=='play'){S.pred=null;S.hist=[];return}
  if(!S.pred){S.pred={x:me[1],y:me[2],a:me[3]/100};S.hist=[]}
  const want=curDir(),p=S.pred;
  if(want!=null){const d=angDiff(p.a,want),mt=TURN*dt;p.a+=clamp(d,-mt,mt)}
  const fl=me[4];
  const sp=SPEED*(fl&4?SPEED_MUL:1)*(S.flashT>0||fl&8?FLASH_MUL:1)*(fl&32?FROST_MUL:1);
  const [nx,ny]=FairyHub.slide((x,y)=>blockedAt(S,x,y),p.x,p.y,p.a,sp*dt);
  p.x=nx;p.y=ny;
  S.hist.push({t:now,x:p.x,y:p.y});
  while(S.hist.length&&now-S.hist[0].t>1500)S.hist.shift();
}
// чужие феи — между двумя снимками
function interpolate(S,now){
  const rt=now-S.off-INTERP;
  let a=null,b=null;
  for(let i=S.snaps.length-1;i>=0;i--){if(S.snaps[i].t<=rt){a=S.snaps[i];b=S.snaps[i+1]||null;break}}
  if(!a){a=S.snaps[0];b=null}
  if(!a)return;
  const t=b?clamp((rt-a.t)/(b.t-a.t),0,1):0;
  for(const f of S.f){
    const pa=a.map.get(f.i),pb=b?b.map.get(f.i):null,pl=S.last.get(f.i);
    if(!pa&&!pl)continue;
    if(f.i===S.myI&&pl){
      f.flags=pl[4];
      if(S.pred){f.x=S.pred.x;f.y=S.pred.y;f.a=S.pred.a}
      else{f.x=pl[1];f.y=pl[2];f.a=pl[3]/100}
      f.seen=true;
      continue;
    }
    const A=pa||pl,B=pb||A;
    if(Math.hypot(B[1]-A[1],B[2]-A[2])>200){f.x=B[1];f.y=B[2]} // проснулась дома — без «полёта» через весь сад
    else{f.x=lerp(A[1],B[1],t);f.y=lerp(A[2],B[2],t)}
    f.a=angLerp(A[3]/100,B[3]/100,t);
    f.flags=pl?pl[4]:B[4];
    f.seen=true;
  }
}

// ================= Кадр =================
const ctx=cv.getContext('2d');
let lastFrame=performance.now(),reHidden=false;
// Качество графики подстраивается само: если кадры тяжёлые (слабый телефон) — меньше частиц и без «ретины»
const Q={low:false,ft:16,slow:0};
function frame(){
  requestAnimationFrame(frame);
  const now=performance.now(),dt=Math.min(0.05,(now-lastFrame)/1000);lastFrame=now;
  Q.ft=Q.ft*0.95+dt*1000*0.05;
  if(!Q.low){if(Q.ft>30)Q.slow+=dt;else Q.slow=Math.max(0,Q.slow-dt);if(Q.slow>2.5)Q.low=true}
  if(!$('game').classList.contains('active')){
    if($('menu').classList.contains('active'))drawPreview(now);
    // живой сад на фоне меню; пока подключаемся — замирает, чтобы телефон все силы отдал соединению
    if(!(NET.conn&&NET.conn.readyState===0)&&!joinTry)drawDemo(now,dt);
    return;
  }
  if(!G||!G.last)return;
  sendInput(now);
  predict(dt,now);
  interpolate(G,now);
  stepFx(G,dt,now);
  draw(now,dt);
}
function stepFx(S,dt,now){
  for(const p of S.parts){p.x+=p.vx*dt;p.y+=p.vy*dt+p.fall*dt;const k=Math.exp(-p.drag*dt);p.vx*=k;p.vy*=k;p.life-=dt;p.rot+=p.vr*dt}
  S.parts=S.parts.filter(p=>p.life>0);
  for(const t of S.texts){t.y-=34*dt;t.life-=dt}
  S.texts=S.texts.filter(t=>t.life>0);
  for(const p of S.flyPk)p.life-=dt;
  S.flyPk=S.flyPk.filter(p=>p.life>0);
  S.shake=Math.max(0,S.shake-dt*30);
  S.flash=Math.max(0,(S.flash||0)-dt*2.5);
  for(const f of S.f){
    if(!f.seen)continue;
    // питомец догоняет фею, держась чуть позади
    const sk=skinOf(S,f.i);
    if(sk.pet&&sk.pet!=='none'){
      const tx=f.x-Math.cos(f.a)*30,ty=f.y-Math.sin(f.a)*30+6;
      if(!f.pet||Math.hypot(f.pet.x-tx,f.pet.y-ty)>300)f.pet={x:tx,y:ty};
      const k=1-Math.exp(-dt*5);f.pet.x+=(tx-f.pet.x)*k;f.pet.y+=(ty-f.pet.y)*k;
    }
    // искорки за быстрой феей
    if(!Q.low&&(f.flags&12)&&Math.random()<0.6)addPart(S,f.x+(Math.random()-0.5)*14,f.y+(Math.random()-0.5)*14,{v:15,life:0.5,col:f.flags&8?'#fff':mix(colorOf(S,f.i),'#ffffff',0.5),size:3,drag:2,shape:'star',glow:true});
    if(!Q.low&&(f.flags&128)&&!S.demo&&Math.random()<dt*6)addPart(S,f.x,f.y+6,{v:10,life:0.9,col:mix(colorOf(S,f.i),'#ffffff',0.5),size:3.5,drag:1,shape:'petal',fall:12});
  }
  // звездопад: падающие звёзды по всему экрану (в мире — вокруг камеры)
  if(S.starfall&&now-S.starfall<6000&&S.cam&&Math.random()<dt*14&&!Q.low){
    const c=S.cam,x=c.x+(Math.random()-0.5)*c.w/c.s,y=c.y-c.h/c.s*0.6;
    S.parts.push({x,y,vx:-120,vy:520,life:1.6,max:1.6,col:'#fff6c8',size:4,drag:0,ring:false,glow:true,shape:'meteor',rot:0,vr:0,fall:0});
  }
  if(S.demo)return;
  // отсчёт перед раундом и последние секунды
  if(S.phase==='count'){const n=Math.ceil(S.phaseT);if(n!==S.lastBeep&&n>0){S.lastBeep=n;sfx('beep')}}
  if(S.phase==='play'&&S.tl<=10&&S.tl>0){const n=Math.ceil(S.tl);if(n!==S.lastBeep){S.lastBeep=n;sfx('beep',0.6)}}
  // кнопка вспышки: кольцо перезарядки
  const db=$('btnFlash');db.classList.toggle('cd',S.flashCd>0);db.style.setProperty('--cd',(1-S.flashCd/FLASH_CD).toFixed(3));
  if($('roundEnd').classList.contains('show')){
    $('reNext').textContent=S.matchOver?(NET.leader===NET.slot?'Матч окончен. Сыграем ещё?':'Матч окончен. Новый матч может начать создательница игры.')
      :S.phase==='end'?'Следующий раунд через '+Math.ceil(S.phaseT)+' с':'';
  }
}

// ---------- рисование мира (общее для игры и живого фона) ----------
const NIGHT_STARS=Array.from({length:110},()=>({x:Math.random(),y:Math.random(),s:0.5+Math.random()*1.6,p:Math.random()*6.28,sp:0.6+Math.random()*1.6}));
function drawSky(c,W,H,dpr,now,rc){
  const g=c.createLinearGradient(0,0,0,H*dpr);g.addColorStop(0,'#2a1250');g.addColorStop(0.55,'#4a1f6b');g.addColorStop(1,'#7a3c86');
  c.fillStyle=g;c.fillRect(0,0,W*dpr,H*dpr);
  // звёзды с лёгким параллаксом
  for(const s of NIGHT_STARS){
    const x=((s.x*W-rc.x*0.05*s.s)%W+W)%W,y=((s.y*H-rc.y*0.05*s.s)%H+H)%H,a=0.35+0.65*Math.abs(Math.sin(now/1000*s.sp+s.p));
    c.globalAlpha=a;c.fillStyle='#fff';c.beginPath();c.arc(x*dpr,y*dpr,s.s*dpr,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=1;
}
function drawWorld(c,S,rc,now){
  const W=rc.w,H=rc.h,dpr=rc.dpr,ns=now/1000;
  c.setTransform(1,0,0,1,0,0);
  drawSky(c,W,H,dpr,now,rc);
  setWorld(c,rc);
  const vx0=rc.x-W/2/rc.s,vy0=rc.y-H/2/rc.s,vx1=rc.x+W/2/rc.s,vy1=rc.y+H/2/rc.s;
  const vis=(x,y,r)=>x+r>vx0&&x-r<vx1&&y+r>vy0&&y-r<vy1;
  const R=S.R,N=S.N,half=N/2*CELL;
  // свечение вокруг сада
  if(!Q.low){const g=c.createRadialGradient(0,0,R,0,0,R+220);g.addColorStop(0,'rgba(255,170,230,.35)');g.addColorStop(1,'rgba(255,170,230,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,R+220,0,Math.PI*2);c.fill()}
  // трава
  c.fillStyle=grassPattern(c);c.beginPath();c.arc(0,0,R+4,0,Math.PI*2);c.fill();
  // сады фей — картинка по клеткам, растянутая с мягким сглаживанием
  const sx0=clamp(Math.floor((vx0+half)/CELL)-1,0,N),sy0=clamp(Math.floor((vy0+half)/CELL)-1,0,N),sx1=clamp(Math.ceil((vx1+half)/CELL)+1,0,N),sy1=clamp(Math.ceil((vy1+half)/CELL)+1,0,N);
  if(sx1>sx0&&sy1>sy0){
    c.imageSmoothingEnabled=true;
    c.save();c.beginPath();c.arc(0,0,R+2,0,Math.PI*2);c.clip();
    c.drawImage(S.tcv,sx0*TP,sy0*TP,(sx1-sx0)*TP,(sy1-sy0)*TP,sx0*CELL-half,sy0*CELL-half,(sx1-sx0)*CELL,(sy1-sy0)*CELL);
    c.restore();
  }
  // цветы на садах и кувшинки на прудах
  const lowDetail=Q.low&&rc.s<0.5;
  if(rc.s>0.22&&!lowDetail){
    const own=S.own,born=S.born;
    for(let y=sy0;y<sy1;y++)for(let x=sx0;x<sx1;x++){
      const c0=y*N+x,v=own[c0];
      if(!v||v===WALL)continue;
      const h=hash(c0);
      const wx=(x-N/2+0.5)*CELL+((h>>8)%9-4),wy=(y-N/2+0.5)*CELL+((h>>12)%9-4);
      if(v===POND){
        if(h%7===0){c.fillStyle='#5cb86f';c.beginPath();c.arc(wx,wy,8,0.4+(h%6),0.4+(h%6)+Math.PI*1.7);c.lineTo(wx,wy);c.fill();
          if(h%5===0){c.fillStyle='#ffb3d6';star5(c,wx+2,wy-1,5,2.6,h%3);c.fill()}}
        continue;
      }
      if(h%4!==0)continue;
      const age=ns-born[c0];if(age<0)continue;
      const sc=age<0.45?easeBack(age/0.45):1;
      const pal=S.pal[v-1];if(!pal)continue;
      const sz=CELL*1.15*sc*(0.8+(h%5)*0.08);
      c.drawImage(flowerSprite(pal.ci,(h>>4)%4),wx-sz/2,wy-sz/2,sz,sz);
    }
  }
  // живая изгородь из роз по краю сада
  c.strokeStyle='#3d8a55';c.lineWidth=34;c.beginPath();c.arc(0,0,R+18,0,Math.PI*2);c.stroke();
  c.strokeStyle='#5aae6c';c.lineWidth=20;c.beginPath();c.arc(0,0,R+14,0,Math.PI*2);c.stroke();
  if(rc.s>0.18){
    const n=Math.round(R*2*Math.PI/46);
    for(let k=0;k<n;k++){
      const a=k/n*Math.PI*2,x=Math.cos(a)*(R+16+((k*7)%3-1)*6),y=Math.sin(a)*(R+16+((k*5)%3-1)*6);
      if(!vis(x,y,12))continue;
      c.fillStyle=k%3===0?'#ff9ad5':k%3===1?'#ffffff':'#ff6fa3';c.beginPath();c.arc(x,y,6.5,0,Math.PI*2);c.fill();
      c.fillStyle='rgba(255,255,255,.6)';c.beginPath();c.arc(x-2,y-2,2,0,Math.PI*2);c.fill();
    }
  }
  // кристаллы и бонусы
  for(const p of S.pk.values()){
    if(!vis(p.x,p.y,90))continue;
    const age=(now-p.born)/1000,sc=age<0.3?easeBack(age/0.3):1;
    if(p.t==='D')drawGem(c,p.x,p.y+Math.sin(now/280+p.id)*2.5,sc,now);
    else if(p.t==='G')drawRose(c,p.x,p.y,sc,now);
    else drawPower(c,p,now,sc);
  }
  for(const p of S.flyPk){
    const f=S.f[p.to];if(!f)continue;
    const k=1-p.life/p.max,x=lerp(p.x,f.x,k*k),y=lerp(p.y,f.y,k*k);
    if(p.t==='D')drawGem(c,x,y,1-k*0.6,now);
  }
  // дорожки
  for(const f of S.f){
    const tr=S.trails[f.i];if(!tr||!f.seen)continue;
    const out=f.flags&128;
    if(tr.length<2&&!out)continue;
    const pts=out&&!(f.flags&16)?tr.concat([f.x,f.y]):tr;
    if(pts.length<4)continue;
    drawTrail(c,pts,colorOf(S,f.i),skinOf(S,f.i).trail,ns,f.i===S.myI?1:0.95);
  }
  // феи — сверху вниз, чтобы ближние перекрывали дальних
  const drawn=S.f.filter(f=>f.seen&&vis(f.x,f.y,80)).sort((a,b)=>a.y-b.y);
  for(const f of drawn){
    const sk=skinOf(S,f.i),sleep=!!(f.flags&16);
    if(f.i===S.myI){c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=2.5;c.setLineDash([6,6]);c.lineDashOffset=-now/60;c.beginPath();c.ellipse(f.x,f.y+BODY_R*1.1,BODY_R+8,(BODY_R+8)*0.4,0,0,Math.PI*2);c.stroke();c.setLineDash([])}
    if(f.flags&32){c.fillStyle='rgba(160,225,255,.25)';c.beginPath();c.arc(f.x,f.y,BODY_R*1.7,0,Math.PI*2);c.fill()}
    if(f.pet&&sk.pet!=='none'&&f.pet.y<f.y)drawPet(c,f.pet.x,f.pet.y,sk.pet,ns+f.seed,f.a);
    c.globalAlpha=f.flags&64&&!sleep?0.55+0.35*Math.sin(now/70):1;
    drawFairy(c,f.x,f.y,sk,{t:ns,face:f.a,seed:f.seed,sleep,fast:!!(f.flags&12),scale:1.2});
    c.globalAlpha=1;
    if(f.pet&&sk.pet!=='none'&&f.pet.y>=f.y)drawPet(c,f.pet.x,f.pet.y,sk.pet,ns+f.seed,f.a);
    if(f.flags&2){ // пузырь
      const r=BODY_R*2+Math.sin(now/180)*1.5;
      const g=c.createRadialGradient(f.x-r*0.35,f.y-r*0.45,r*0.1,f.x,f.y,r);g.addColorStop(0,'rgba(255,255,255,.35)');g.addColorStop(0.7,'rgba(180,230,255,.08)');g.addColorStop(1,'rgba(255,160,230,.35)');
      c.fillStyle=g;c.beginPath();c.arc(f.x,f.y-4,r,0,Math.PI*2);c.fill();
      c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1.5;c.stroke();
      c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=2.5;c.beginPath();c.arc(f.x,f.y-4,r*0.75,3.6,4.3);c.stroke();
    }
    if(sleep){ // сон: «Zzz»
      c.font=`700 ${12+Math.sin(now/300)*2}px ${FONT_D}`;c.fillStyle='#fff';c.textAlign='center';
      for(let k=0;k<3;k++){const u=((now/900+k/3)%1);c.globalAlpha=1-u;c.fillText('z',f.x+14+u*14,f.y-26-u*26)}
      c.globalAlpha=1;
    }
  }
  // подписи: имя и размер сада
  c.textBaseline='middle';c.textAlign='center';
  const fs=clamp(12/rc.s,11,26),total=S.total||1;
  for(const f of drawn){
    const y=f.y-BODY_R*3-fs*0.6,mine=f.i===S.myI;
    const nm=mine?'Ты':nameOf(S,f.i),pc=((S.ar[f.i]||0)/total*100).toFixed(1)+'%';
    c.font=`900 ${fs}px ${FONT_B}`;const wN=c.measureText(nm).width;c.font=`700 ${fs*0.82}px ${FONT_D}`;const wP=c.measureText(pc).width;
    const pad=fs*0.5,w=wN+wP+pad*3+fs*0.7,h=fs*1.6,x0=f.x-w/2;
    c.fillStyle=mine?'rgba(255,90,170,.88)':'rgba(40,16,62,.7)';c.beginPath();c.roundRect(x0,y-h/2,w,h,h/2);c.fill();
    if(mine){c.strokeStyle='rgba(255,255,255,.8)';c.lineWidth=1.2;c.stroke()}
    c.fillStyle=colorOf(S,f.i);c.beginPath();c.arc(x0+pad+fs*0.25,y,fs*0.25,0,Math.PI*2);c.fill();c.strokeStyle='#fff';c.lineWidth=1;c.stroke();
    c.font=`900 ${fs}px ${FONT_B}`;c.fillStyle='#fff';c.textAlign='left';c.fillText(nm,x0+pad+fs*0.7,y+fs*0.05);
    c.font=`700 ${fs*0.82}px ${FONT_D}`;c.fillStyle=mine?'#fff1fa':'#ffc2e6';c.fillText(pc,x0+pad*2+fs*0.7+wN,y+fs*0.05);
    c.textAlign='center';
    if(f.emote!=null&&now-f.emoteT<2600){
      const t=EMOTES[f.emote]||'';c.font=`900 ${fs}px ${FONT_B}`;const tw=c.measureText(t).width+fs*1.2,ty=y-h*1.5;
      c.fillStyle='#fff';c.beginPath();c.roundRect(f.x-tw/2,ty-fs*0.8,tw,fs*1.6,fs*0.6);c.fill();
      c.beginPath();c.moveTo(f.x-5,ty+fs*0.8);c.lineTo(f.x+5,ty+fs*0.8);c.lineTo(f.x,ty+fs*1.2);c.fill();
      c.fillStyle='#3a1f4d';c.fillText(t,f.x,ty+fs*0.05);
    }
  }
  // частицы
  c.globalCompositeOperation='lighter';
  for(const p of S.parts){
    if(!p.glow)continue;const a=p.life/p.max;c.globalAlpha=a;c.fillStyle=p.col;
    if(p.shape==='meteor'){c.strokeStyle='rgba(255,246,200,.8)';c.lineWidth=3;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*0.12,p.y-p.vy*0.12);c.stroke();c.beginPath();c.arc(p.x,p.y,3.5,0,Math.PI*2);c.fill()}
    else if(p.shape==='star'){star5(c,p.x,p.y,p.size*1.5*(0.5+a*0.5),p.size*0.6,p.rot);c.fill()}
    else{c.beginPath();c.arc(p.x,p.y,p.size*(0.4+a*0.6),0,Math.PI*2);c.fill()}
  }
  c.globalCompositeOperation='source-over';
  for(const p of S.parts){
    if(p.glow)continue;
    const a=p.life/p.max;c.globalAlpha=Math.min(1,a*1.5);
    if(p.ring){c.strokeStyle=p.col;c.lineWidth=4*a+1;c.beginPath();c.arc(p.x,p.y,p.size*(2.2-a*1.2),0,Math.PI*2);c.stroke()}
    else if(p.shape==='petal'){c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.fillStyle=p.col;c.beginPath();c.ellipse(0,0,p.size*1.3,p.size*0.7,0,0,Math.PI*2);c.fill();c.restore()}
    else if(p.shape==='star'){c.fillStyle=p.col;star5(c,p.x,p.y,p.size*1.5,p.size*0.6,p.rot);c.fill()}
    else if(p.shape==='snow'){c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.strokeStyle=p.col;c.lineWidth=1.4;c.beginPath();for(let i=0;i<3;i++){c.rotate(Math.PI/3);c.moveTo(-p.size,0);c.lineTo(p.size,0)}c.stroke();c.restore()}
    else{c.fillStyle=p.col;c.beginPath();c.arc(p.x,p.y,p.size*(0.4+a*0.6),0,Math.PI*2);c.fill()}
  }
  c.globalAlpha=1;
  for(const t of S.texts){
    const k=1-t.life/t.max,sc=k<0.15?easeBack(k/0.15):1;
    c.globalAlpha=clamp(t.life/t.max*1.6,0,1);
    c.font=`700 ${fs*1.2*t.size*sc}px ${FONT_D}`;c.lineJoin='round';c.lineWidth=fs/3;c.strokeStyle='rgba(255,255,255,.9)';c.fillStyle=t.col;
    c.strokeText(t.text,t.x,t.y);c.fillText(t.text,t.x,t.y);
  }
  c.globalAlpha=1;
}

function draw(now,dt){
  const S=G,dpr=Q.low?1:Math.min(2,window.devicePixelRatio||1),W=cv.clientWidth,H=cv.clientHeight;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  const me=S.myI>=0?S.f[S.myI]:null;
  const target=me&&me.seen?me:{x:0,y:0};
  const wantS=clamp(Math.sqrt(W*H)/(2*440),0.45,1.4);
  if(!S.cam)S.cam={x:target.x,y:target.y,s:wantS};
  const cam=S.cam;
  if(me&&S.pred){cam.x=target.x;cam.y=target.y}
  else{const k=Math.min(1,dt*7);cam.x+=(target.x-cam.x)*k;cam.y+=(target.y-cam.y)*k}
  cam.s+=(wantS-cam.s)*Math.min(1,dt*2);
  cam.w=W;cam.h=H;cam.dpr=dpr;
  const shx=S.shake?(Math.random()-0.5)*S.shake:0,shy=S.shake?(Math.random()-0.5)*S.shake:0;
  const rc={x:cam.x+shx/cam.s,y:cam.y+shy/cam.s,s:cam.s,w:W,h:H,dpr};
  drawWorld(ctx,S,rc,now);
  drawHud(now,W,H,dpr,me);
}

// ---------- интерфейс поверх сада ----------
function glass(x,y,w,h,r,strong){
  ctx.fillStyle=strong?'rgba(40,16,64,.84)':'rgba(40,16,64,.62)';ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=1;ctx.stroke();
}
function fmtTime(s){s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function drawHud(now,W,H,dpr,me){
  const S=G,c=ctx;
  c.setTransform(dpr,0,0,dpr,0,0);
  const small=W<560,u=small?0.86:1;
  c.textBaseline='middle';
  // вспышка экрана
  if(S.flash>0){c.globalAlpha=S.flash*0.35;c.fillStyle=S.flashCol||'#fff';c.fillRect(0,0,W,H);c.globalAlpha=1}
  // мягкая виньетка
  if(!Q.low){const g=c.createRadialGradient(W/2,H/2,Math.min(W,H)*0.45,W/2,H/2,Math.max(W,H)*0.75);g.addColorStop(0,'rgba(40,10,60,0)');g.addColorStop(1,'rgba(40,10,60,.35)');c.fillStyle=g;c.fillRect(0,0,W,H)}
  // таймер
  const tl=S.phase==='count'?(S.opts.time||150):S.tl,urgent=S.phase==='play'&&tl<=10;
  {
    const tw=110*u,th=40*u,tx=small?W-tw-10:W/2-tw/2,ty=small?62:10; // на телефоне — под кнопками справа
    const pulse=urgent?1+0.06*Math.sin(now/90):1;
    c.save();c.translate(tx+tw/2,ty+th/2);c.scale(pulse,pulse);c.translate(-(tx+tw/2),-(ty+th/2));
    glass(tx,ty,tw,th,th/2,true);
    const pr=clamp(tl/(S.opts.time||150),0,1);
    c.strokeStyle=urgent?'#ff6b8b':'#ff9ad5';c.lineWidth=3;c.lineCap='round';c.beginPath();c.arc(tx+th/2,ty+th/2,th*0.3,-Math.PI/2,-Math.PI/2+Math.PI*2*pr);c.stroke();
    c.font=`700 ${19*u}px ${FONT_D}`;c.fillStyle=urgent?'#ffb3c4':'#fff';c.textAlign='center';c.fillText(fmtTime(tl),tx+tw/2+th*0.25,ty+th/2+1);
    c.restore();
  }
  // таблица садов
  const total=S.total||1;
  const rows=S.f.map(f=>({i:f.i,a:S.ar[f.i]||0})).sort((a,b)=>b.a-a.a);
  const myRank=rows.findIndex(r=>r.i===S.myI);
  const showN=Math.min(rows.length,small?3:5);
  let list=rows.slice(0,showN);if(myRank>=showN)list=list.concat([rows[myRank]]);
  {
    const lw=small?150:196,lh=22*u,lx=10,ly=small?62:10;
    glass(lx,ly,lw,14+list.length*lh+(small?0:18),14);
    let y=ly+8;
    if(!small){c.font=`700 ${10}px ${FONT_D}`;c.fillStyle='#d2bde8';c.textAlign='left';c.fillText('САДЫ',lx+12,y+6);y+=16}
    for(const r of list){
      const rank=rows.indexOf(r)+1,mine=r.i===S.myI,pct=r.a/total*100;
      if(mine){c.fillStyle='rgba(255,122,200,.22)';c.beginPath();c.roundRect(lx+4,y,lw-8,lh-2,8);c.fill()}
      c.fillStyle='rgba(255,255,255,.08)';c.beginPath();c.roundRect(lx+30,y+lh-6,lw-80,3,2);c.fill();
      c.fillStyle=colorOf(S,r.i);c.beginPath();c.roundRect(lx+30,y+lh-6,(lw-80)*clamp(pct/(rows[0].a/total*100||1),0,1),3,2);c.fill();
      c.font=`700 ${11*u}px ${FONT_D}`;c.fillStyle=rank===1?'#ffd27a':'#d2bde8';c.textAlign='center';c.fillText(rank===1?'👑':String(rank),lx+17,y+lh/2-1);
      c.font=`900 ${12.5*u}px ${FONT_B}`;c.fillStyle=mine?'#fff':'#f3e6fb';c.textAlign='left';
      let nm=mine?'Ты':nameOf(S,r.i);const maxW=lw-96;while(c.measureText(nm).width>maxW&&nm.length>2)nm=nm.slice(0,-2)+'…';
      c.fillText(nm,lx+30,y+lh/2-3);
      c.font=`700 ${11*u}px ${FONT_D}`;c.textAlign='right';c.fillStyle=mine?'#ffd6f0':'#ffc2e6';c.fillText(pct.toFixed(1)+'%',lx+lw-10,y+lh/2-2);
      y+=lh;
    }
  }
  // мини-карта
  {
    const mr=small?50:64,mx=10+mr,my=H-10-mr-(TOUCH?0:0);
    c.save();
    c.fillStyle='rgba(40,16,64,.7)';c.beginPath();c.arc(mx,my,mr+5,0,Math.PI*2);c.fill();
    c.strokeStyle='rgba(255,255,255,.18)';c.lineWidth=1;c.stroke();
    c.beginPath();c.arc(mx,my,mr,0,Math.PI*2);c.clip();
    c.fillStyle='#9fd69a';c.fillRect(mx-mr,my-mr,mr*2,mr*2);
    const sc=mr/S.R,half=S.N/2*CELL;
    c.imageSmoothingEnabled=true;
    c.drawImage(S.tcv,mx-half*sc,my-half*sc,S.N*CELL*sc,S.N*CELL*sc);
    for(const p of S.pk.values())if(p.t==='G'){c.font=`${12}px ${EMOJI}`;c.textAlign='center';c.fillText('🌹',mx+p.x*sc,my+p.y*sc)}
    for(const f of S.f){
      if(!f.seen)continue;
      const tr=S.trails[f.i];
      if(tr&&tr.length>=4){c.strokeStyle=colorOf(S,f.i);c.lineWidth=1.5;c.beginPath();c.moveTo(mx+tr[0]*sc,my+tr[1]*sc);for(let k=2;k<tr.length;k+=2)c.lineTo(mx+tr[k]*sc,my+tr[k+1]*sc);c.stroke()}
    }
    for(const f of S.f){
      if(!f.seen)continue;
      const mine=f.i===S.myI;
      c.fillStyle=colorOf(S,f.i);c.strokeStyle='#fff';c.lineWidth=mine?2:1;
      c.beginPath();c.arc(mx+f.x*sc,my+f.y*sc,mine?4.5:3,0,Math.PI*2);c.fill();c.stroke();
    }
    if(G.cam){c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=1;c.strokeRect(mx+(G.cam.x-W/2/G.cam.s)*sc,my+(G.cam.y-H/2/G.cam.s)*sc,W/G.cam.s*sc,H/G.cam.s*sc)}
    c.restore();
  }
  // моё: сад, кристаллы, чары
  if(me){
    const pct=((S.ar[S.myI]||0)/total*100).toFixed(1)+'%',f=S.f[S.myI];
    const parts=[['🌸',pct],['💎',String(f.dia)],['🪄',String(f.catches)]];
    c.font=`700 ${14*u}px ${FONT_D}`;
    const ws=parts.map(p=>c.measureText(p[1]).width+28*u),bw=ws.reduce((a,b)=>a+b,0)+16,bh=34*u;
    const bx=W/2-bw/2,by=H-bh-(TOUCH?16:14);
    glass(bx,by,bw,bh,bh/2);
    let x=bx+8;
    parts.forEach((p,k)=>{c.font=`${13*u}px ${EMOJI}`;c.textAlign='left';c.fillText(p[0],x+2,by+bh/2+1);c.font=`700 ${14*u}px ${FONT_D}`;c.fillStyle='#fff';c.fillText(p[1],x+22*u,by+bh/2+1);x+=ws[k]});
  }
  // лента событий
  {
    let y=small?112:66;c.textAlign='right';
    for(const e of S.feed){
      const age=(now-e.t)/1000;if(age>6)continue;
      c.globalAlpha=clamp(6-age,0,1);
      c.font=`800 ${12*u}px ${FONT_B}`;const w=c.measureText(e.text).width+18;
      glass(W-10-w,y,w,22,11);
      c.fillStyle=e.ki===S.myI?'#ffd6f0':e.vi===S.myI?'#d9b8ff':'#fff';c.fillText(e.text,W-19,y+11.5);
      y+=26;
    }
    c.globalAlpha=1;
  }
  // отсчёт
  if(S.phase==='count'){
    const n=Math.ceil(S.phaseT),k=S.phaseT%1;
    c.font=`400 ${(120+k*40)*u}px ${FONT_S}`;c.textAlign='center';c.globalAlpha=clamp(k*1.6,0,1);
    c.lineWidth=10;c.strokeStyle='rgba(120,30,110,.5)';c.strokeText(String(n),W/2,H*0.42);
    const g=c.createLinearGradient(0,H*0.42-60,0,H*0.42+60);g.addColorStop(0,'#fff');g.addColorStop(1,'#ff7ac8');c.fillStyle=g;c.fillText(String(n),W/2,H*0.42);
    c.globalAlpha=1;
    c.font=`800 ${15*u}px ${FONT_B}`;c.fillStyle='#fff';c.fillText('Вылетай из сада и обводи новые земли!',W/2,H*0.42+80*u);
  }
  // баннер
  if(S.banner){
    const b=S.banner,age=(now-b.t)/1000,life=b.big?2.4:2.1;
    if(age>life)S.banner=null;
    else{
      const k=age<0.25?easeBack(age/0.25):1,al=age>life-0.4?(life-age)/0.4:1;
      c.save();c.globalAlpha=al;c.translate(W/2,H*0.26);c.scale(k,k);
      c.font=`400 ${(b.big?46:34)*u}px ${FONT_S}`;c.textAlign='center';c.lineJoin='round';
      c.lineWidth=8;c.strokeStyle='rgba(60,15,70,.55)';c.strokeText(b.text,0,0);
      const g=c.createLinearGradient(0,-24,0,24);g.addColorStop(0,'#fff');g.addColorStop(1,b.col);c.fillStyle=g;c.fillText(b.text,0,0);
      if(b.sub){c.font=`800 ${14*u}px ${FONT_B}`;c.lineWidth=4;c.strokeStyle='rgba(60,15,70,.5)';c.strokeText(b.sub,0,34*u);c.fillStyle='#fff';c.fillText(b.sub,0,34*u)}
      c.restore();
    }
  }
  // сон
  if(me&&me.flags&16){
    const left=Math.max(0,(S.sleepUntil-now)/1000);
    c.font=`400 ${30*u}px ${FONT_S}`;c.textAlign='center';c.fillStyle='#fff';c.lineWidth=6;c.strokeStyle='rgba(60,15,70,.5)';
    const t='💤 Сладкий сон'+(left>0?' · '+left.toFixed(1):'');c.strokeText(t,W/2,H*0.62);c.fillText(t,W/2,H*0.62);
  }
  // джойстик
  if(joy){
    const r=joyR();
    c.fillStyle='rgba(255,255,255,.1)';c.strokeStyle='rgba(255,255,255,.3)';c.lineWidth=2;c.beginPath();c.arc(joy.bx,joy.by,r,0,Math.PI*2);c.fill();c.stroke();
    const dx=joy.x-joy.bx,dy=joy.y-joy.by,l=Math.min(r,Math.hypot(dx,dy)),a=Math.atan2(dy,dx);
    c.fillStyle='rgba(255,170,220,.6)';c.beginPath();c.arc(joy.bx+Math.cos(a)*l,joy.by+Math.sin(a)*l,r*0.42,0,Math.PI*2);c.fill();
  }
  // связь
  const nn=netNotice();
  if(nn){c.font=`800 ${13}px ${FONT_B}`;const w=c.measureText(nn).width+24;const ny=small?150:58;glass(W/2-w/2,ny,w,28,14,true);c.fillStyle='#fff';c.textAlign='center';c.fillText(nn,W/2,ny+14)}
}

// ================= Превью феи в меню и живой сад на фоне =================
let previewAt=0,previewPet={x:-40,y:30};
function drawPreview(now){
  const c=$('preview'),x=c.getContext('2d'),sk=mySkin(),t=now/1000;
  const cam={x:0,y:-4,s:c.width/78,w:c.width,h:c.height,dpr:1};
  x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,c.width,c.height);
  setWorld(x,cam);
  // искорки вокруг
  for(let k=0;k<7;k++){const a=t*0.8+k*0.9,r=26+Math.sin(t*2+k)*4;x.globalAlpha=0.5+0.5*Math.sin(t*3+k);x.fillStyle=k%2?'#fff':'#ffd6f0';star5(x,Math.cos(a)*r,Math.sin(a)*r*0.8-4,2.6,1,a);x.fill()}
  x.globalAlpha=1;
  const face=Math.PI/2+Math.sin(t*0.9)*0.9;
  if(sk.pet!=='none'){const px=Math.cos(t*0.7)*22,py=10+Math.sin(t*0.7)*6;if(py<0)drawPet(x,px,py+6,sk.pet,t,face,0.95)}
  drawFairy(x,0,0,sk,{t,face,seed:2});
  if(sk.pet!=='none'){const px=Math.cos(t*0.7)*22,py=10+Math.sin(t*0.7)*6;if(py>=0)drawPet(x,px,py+6,sk.pet,t,face,0.95)}
}
let demo=null;
function demoInit(){
  const hub=new FairyHub({every:()=>()=>{}});
  const D=newState(true);
  const sess=hub.connect({send:m=>{
    if(m.type==='lobby'||m.type==='slots'){D.slots=m.slots;refreshColors(D)}
    else if(m.type==='round')initRound(D,m);
    else if(m.type==='snap'&&D.last)applySnap(D,m);
  },close(){}});
  sess.message({action:'create_game',name:myName()||'Ты',skin:mySkin(),opts:{size:6,diff:'normal',time:210,solo:true,bots:true,powers:true,ponds:true}});
  const g=Object.values(hub.games)[0];
  g.slots.P0.kind='bot'; // твоя фея летает на фоне сама
  demo={hub,g,D,acc:0};
}
function drawDemo(now,dt){
  // это лишь фон: рисуем без «ретины» — телефону легче, а под размытой карточкой разницы не видно
  const c=$('demo'),dpr=1,W=c.clientWidth,H=c.clientHeight;
  if(c.width!==Math.round(W*dpr)||c.height!==Math.round(H*dpr)){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr)}
  if(!demo)demoInit();
  demo.acc+=dt;let n=0;
  while(demo.acc>=TICK&&n<4){demo.acc-=TICK;n++;demo.hub.step(demo.g)}
  const D=demo.D;if(!D.last)return;
  interpolate(D,now);stepFx(D,dt,now);
  const f=D.f[0],wantS=clamp(Math.sqrt(W*H)/(2*820),0.32,0.9);
  if(!D.cam)D.cam={x:f.x,y:f.y,s:wantS};
  const k=Math.min(1,dt*1.5);D.cam.x+=(f.x*0.6-D.cam.x)*k;D.cam.y+=(f.y*0.6-D.cam.y)*k;D.cam.s=wantS;
  drawWorld(c.getContext('2d'),D,{x:D.cam.x,y:D.cam.y,s:D.cam.s,w:W,h:H,dpr},now);
}

// ================= Итоги раунда =================
let lastEarn=null;
function showRoundEnd(m,resumed){
  const S=G;if(!S)return;
  S.standings=m.standings;S.winner=m.winner;S.score=m.score||S.score;S.matchOver=!!m.match_over;
  const iWon=m.winner===NET.slot;
  const wi=S.order.indexOf(m.winner);
  $('reKicker').textContent=S.matchOver?'Матч окончен':'Раунд '+m.round+(m.early?' · досрочно':'');
  $('reTitle').textContent=S.matchOver?(iWon?'Ты — королева матча!':'Матч выиграла '+nameOf(S,wi)):iWon?'Победа!':wi>=0?'Победила '+nameOf(S,wi):'Ничья';
  const mine=m.standings.find(s=>s.sid===NET.slot);
  $('reSub').textContent=(mine&&!iWon?'Твоё место: '+mine.place+' из '+m.standings.length:iWon?'Твой сад — самый большой!':'')+(S.opts&&S.opts.wins?' · матч до '+S.opts.wins+' побед':'');
  // пьедестал: 2 — 1 — 3
  const top=m.standings.slice(0,3),pod=$('rePodium');pod.innerHTML='';
  for(const n of [1,0,2]){
    const s=top[n],el=document.createElement('div');el.className='pod p'+(n+1);
    if(s){
      const cvs=document.createElement('canvas'),pn=document.createElement('div'),pk=document.createElement('div'),ps=document.createElement('div');
      pn.className='pn';pn.textContent=nameOf(S,s.i);pk.className='pk';pk.textContent='🌸 '+(s.share/10).toFixed(1)+'% · 🪄 '+s.catches;ps.className='ps';ps.textContent=n+1;
      el.append(cvs,pn,pk,ps);pod.append(el);drawAvatar(cvs,skinOf(S,s.i),n===0?100:76);
    }else pod.append(el);
  }
  // награды раунда
  const best=k=>m.standings.reduce((a,b)=>b[k]>(a?a[k]:-1)?b:a,null);
  const bc=best('catches'),bd=best('dia'),bs=best('best'),chips=[];
  if(bs)chips.push('🌸 Самый большой сад за раунд: <b>'+esc(nameOf(S,bs.i))+'</b> ('+(bs.best/10).toFixed(1)+'%)');
  if(bc&&bc.catches>0)chips.push('🪄 Больше всех чар: <b>'+esc(nameOf(S,bc.i))+'</b> ('+bc.catches+')');
  if(bd&&bd.dia>0)chips.push('💎 Собирательница: <b>'+esc(nameOf(S,bd.i))+'</b> ('+bd.dia+')');
  $('reMvp').innerHTML=chips.map(c=>'<span>'+c+'</span>').join('');
  // кристаллы за раунд
  const er=$('reEarn');
  if(!resumed&&mine&&mode){
    const sh=Math.round(mine.share/10),pl=[15,8,5][mine.place-1]||0,ch=mine.catches*3,di=mine.dia,base=5,sum=sh+pl+ch+di+base;
    lastEarn={sum,txt:'сад '+sh+(pl?' · место '+pl:'')+(ch?' · чары '+ch:'')+(di?' · кристаллы '+di:'')+' · за полёт '+base};
    addGems(sum);
  }else if(resumed)lastEarn=null;
  er.style.display=lastEarn?'block':'none';
  if(lastEarn)er.innerHTML='<b>+'+lastEarn.sum+' 💎</b>'+esc(lastEarn.txt)+'<br>Всего: 💎 '+gems;
  let h='<tr><th>#</th><th>Фея</th><th>Сад</th><th>Чары</th><th>💎</th><th>Побед</th></tr>';
  for(const s of m.standings.slice(3)){
    const sc=(S.score||{})[s.sid]||{wins:0};
    h+=`<tr class="${s.sid===NET.slot?'me':''}"><td>${s.place||'—'}</td><td><span class="c" style="background:${colorOf(S,s.i)}"></span>${esc(nameOf(S,s.i))}</td><td>${(s.share/10).toFixed(1)}%</td><td>${s.catches}</td><td>${s.dia}</td><td>${sc.wins}</td></tr>`;
  }
  $('reTable').innerHTML=h;
  $('reTable').style.display=m.standings.length>3?'':'none';
  $('btnRestart').style.display=S.matchOver&&NET.leader===NET.slot?'':'none';
  $('roundEnd').classList.add('show');
  reHidden=false;
}
$('btnReHide').onclick=()=>{$('roundEnd').classList.remove('show');reHidden=true};
$('btnRestart').onclick=()=>netSend({action:'restart'});
$('btnReMenu').onclick=()=>toMenu();
// маленький портрет феи (комната, пьедестал)
function drawAvatar(c,sk,size){
  const x=c.getContext('2d'),dpr=Math.min(2,window.devicePixelRatio||1),W=size,H=size; // размер — из CSS (экран может быть ещё скрыт)
  c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);
  const cam={x:0,y:-3,s:W/58,w:W,h:H,dpr};
  x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,c.width,c.height);
  setWorld(x,cam);drawFairy(x,0,0,sk,{t:0.4,face:Math.PI/2,seed:1});
}

// ---------- открытка на память: сад раунда, тройка лучших и дата ----------
$('btnCard').onclick=()=>{
  const S=G;if(!S||!S.standings)return;
  const W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#2a1250');g.addColorStop(0.6,'#5a2478');g.addColorStop(1,'#a04a8e');x.fillStyle=g;x.fillRect(0,0,W,H);
  for(const s of NIGHT_STARS){x.globalAlpha=0.3+0.7*Math.abs(Math.sin(s.p));x.fillStyle='#fff';x.beginPath();x.arc(s.x*W,s.y*H,s.s*2,0,Math.PI*2);x.fill()}
  x.globalAlpha=1;x.textAlign='center';x.textBaseline='middle';
  x.font='400 110px '+FONT_S;const tg=x.createLinearGradient(0,60,0,170);tg.addColorStop(0,'#fff');tg.addColorStop(1,'#ff7ac8');x.fillStyle=tg;x.fillText('Волшебный сад',W/2,120);
  x.font='700 30px '+FONT_D;x.fillStyle='#e6d3f5';x.fillText('Раунд '+S.round+' · '+new Date().toLocaleDateString('ru-RU'),W/2,200);
  // сад
  const cx=W/2,cy=640,r=380;
  x.save();x.shadowColor='rgba(255,150,220,.6)';x.shadowBlur=60;x.fillStyle='#ade0a6';x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.fill();x.restore();
  x.save();x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.clip();x.fillStyle=grassPattern(x);x.fillRect(cx-r,cy-r,r*2,r*2);
  const sc=r/S.R,half=S.N/2*CELL;x.imageSmoothingEnabled=true;x.drawImage(S.tcv,cx-half*sc,cy-half*sc,S.N*CELL*sc,S.N*CELL*sc);x.restore();
  x.strokeStyle='#5aae6c';x.lineWidth=22;x.beginPath();x.arc(cx,cy,r+8,0,Math.PI*2);x.stroke();
  for(let k=0;k<64;k++){const a=k/64*Math.PI*2;x.fillStyle=k%3?'#ff9ad5':'#fff';x.beginPath();x.arc(cx+Math.cos(a)*(r+8),cy+Math.sin(a)*(r+8),7,0,Math.PI*2);x.fill()}
  // тройка
  S.standings.slice(0,3).forEach((s,k)=>{
    const y=1100+k*70,mine=s.sid===NET.slot;
    x.fillStyle=mine?'rgba(255,122,200,.3)':'rgba(255,255,255,.08)';x.beginPath();x.roundRect(170,y-30,740,60,30);x.fill();
    x.font='40px '+EMOJI;x.fillText(['🥇','🥈','🥉'][k],220,y+2);
    x.fillStyle=colorOf(S,s.i);x.beginPath();x.arc(275,y,14,0,Math.PI*2);x.fill();
    x.font='900 34px '+FONT_B;x.fillStyle='#fff';x.textAlign='left';x.fillText(nameOf(S,s.i)+(mine?' (я)':''),305,y+2);
    x.font='700 32px '+FONT_D;x.textAlign='right';x.fillStyle='#ffd6f0';x.fillText((s.share/10).toFixed(1)+'%',880,y+2);x.textAlign='center';
  });
  x.font='700 24px '+FONT_D;x.fillStyle='rgba(255,255,255,.6)';x.fillText('Феи · волшебный сад',W/2,H-40);
  c.toBlob(b=>{
    if(!b)return;
    const file=new File([b],'feya-sad.png',{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:'Мой волшебный сад'}).catch(()=>{});return}
    const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='feya-sad.png';document.body.append(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toast('📸 Открытка сохранена');
  },'image/png');
};

// ================= Кнопки в саду =================
function sendEmote(n){
  if(!G||n<0||n>=EMOTES.length)return;
  netSend({action:'emote',e:n});
  $('emotes').classList.remove('show');
}
(function(){
  const box=$('emotes');
  EMOTES.forEach((t,i)=>{const b=document.createElement('button');b.className='btn';b.textContent=t;b.onclick=()=>sendEmote(i);box.append(b)});
})();
$('btnEmote').onclick=()=>$('emotes').classList.toggle('show');
$('btnSound').onclick=()=>setSound(!soundOn);
$('btnFull').onclick=()=>{
  const d=document,el=d.documentElement;
  if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d)}
  else{const f=el.requestFullscreen||el.webkitRequestFullscreen;if(f)Promise.resolve(f.call(el)).catch(()=>{});else toast('На iPhone: «Поделиться» → «На экран Домой»')}
};
$('btnExit').onclick=()=>{
  if(mode==='online'&&G&&G.phase==='play'&&!confirm(NET.host?'Выйти? Игра закроется для всех.':'Выйти из игры?'))return;
  toMenu();
};
function soloGame(){return HOST.hub&&HOST.gid?HOST.hub.games[HOST.gid]:null}
function soloPaused(){const g=soloGame();return !!(g&&g.paused)}
function setPaused(p){
  const g=soloGame();if(!g||mode!=='solo')return;
  g.paused=p;$('pauseBox').classList.toggle('show',p);
}
function updatePauseBtn(){$('btnPause').style.display=mode==='solo'?'':'none'}
$('btnPause').onclick=()=>setPaused(true);
$('btnResume').onclick=()=>setPaused(false);
$('btnPauseMenu').onclick=()=>toMenu();
function toMenu(){
  if(NET.conn&&NET.gameId&&!NET.host)netSend({action:'leave'});
  clearSession();netClose();G=null;mode=null;
  $('roundEnd').classList.remove('show');$('pauseBox').classList.remove('show');
  show('modes');renderSkinUI(); // после игры — сразу к выбору режима
}
