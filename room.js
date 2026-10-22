// Комната игры «Феи»: места, боты, раунды и вся симуляция волшебного сада.
// Работает в браузере создателя игры (или на одном устройстве в игре с ботами).
// Остальные игроки подключаются к нему через WebRTC (P2P), запасной канал MQTT или пересылку server.py,
// а сам создатель — через «петлю» в памяти. Игроки присылают только направление полёта и «вспышку»;
// всё остальное (сад по клеткам, дорожки, чары, бонусы, боты) считает комната и 15 раз в секунду
// рассылает снимок. Поэтому у всех одинаковая картина, а вернувшийся после обрыва получает её целиком.
(function(root){
'use strict';
const TICK=1/30;           // шаг симуляции, с
const SNAP_EVERY=2;        // снимок игрокам — каждые 2 шага (15 раз в секунду)
const RECONNECT_GRACE=180; // сколько секунд держим место ушедшей игроку
const BOT_DELAY=5;         // через сколько секунд за отошедшую начинает играть бот
const ID_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без похожих 0/O и 1/I

// ---------- правила (их же использует страница для предсказания своего полёта) ----------
const CELL=22;        // клетка сада в единицах мира
const BODY_R=16;      // радиус феи
const SPEED=142;      // скорость полёта
const TURN=7.2;       // как быстро фея поворачивает, рад/с
const FLASH_T=0.55,FLASH_CD=4,FLASH_MUL=1.7; // «вспышка»: длительность, перезарядка, ускорение
const SPEED_MUL=1.38; // бонус «бабочка»
const FROST_MUL=0.55,FROST_R=320; // «иней» замедляет соседок
const SLEEP_T=2.6;    // сколько спит зачарованная фея
const WAKE_INV=1.6;   // после сна её дорожку нельзя порвать
const HOME_R=3;       // радиус первого садика, клеток
const COUNTDOWN=3;    // отсчёт перед раундом
const END_PAUSE=10;   // пауза между раундами
const PICK_R=BODY_R+16;
const WIN_SHARE=0.55; // сад больше этой доли — раунд кончается досрочно
const POWERS=['S','H','R','F']; // бабочка (скорость), пузырь (защита), радуга (цветение вокруг), иней (замедлить соседок)
const POWER_T={S:7,H:8,F:3,G:8};
const WALL=255,POND=254;
function gridR(n){return 24+Math.round(4.2*n)} // радиус сада в клетках — по числу фей

const COLORS=12;
const WINGS=['butterfly','dragonfly','heart','crystal','angel','moth'];
const HEADS=['none','bow','tiara','wreath','ears','horn','crown','star'];
const TRAILS=['petals','hearts','stars','rainbow','snow','notes'];
const PETS=['none','cat','bunny','unicorn','owl','fox'];
function pick(a){return a[Math.floor(Math.random()*a.length)]}
function cleanSkin(k){
  k=k||{};
  const c=Math.trunc(Number(k.color));
  return {color:c>=0&&c<COLORS?c:0,wings:WINGS.includes(k.wings)?k.wings:'butterfly',head:HEADS.includes(k.head)?k.head:'none',
    trail:TRAILS.includes(k.trail)?k.trail:'petals',pet:PETS.includes(k.pet)?k.pet:'none'};
}
function botSkin(used){
  // цвет — из тех, что ещё никто не носит: сады должны различаться
  const free=[];for(let c=0;c<COLORS;c++)if(!used||!used.has(c))free.push(c);
  return {color:free.length?pick(free):Math.floor(Math.random()*COLORS),wings:Math.random()<0.5?'butterfly':pick(WINGS),head:Math.random()<0.6?pick(HEADS):'none',
    trail:Math.random()<0.6?'petals':pick(TRAILS),pet:Math.random()<0.3?pick(PETS):'none'};
}
const BOT_NAMES=['Ромашка','Звёздочка','Капелька','Снежинка','Ягодка','Пушинка','Карамелька','Луна','Искорка','Незабудка','Фиалка','Ириска',
  'Зефирка','Малинка','Солнышко','Бусинка','Вишенка','Лучик','Радуга','Жемчужинка','Ласточка','Мята','Тучка','Ванилька','Кнопочка','Василёк',
  'Облачко','Веснушка','Пчёлка','Лилия'];

// сложность ботов
const DIFF={
  easy:  {react:0.32,err:0.55,loop:0.75,fear:0.7, hunt:0.25,flash:0.1},
  normal:{react:0.2, err:0.28,loop:1,   fear:1,   hunt:0.6, flash:0.35},
  hard:  {react:0.11,err:0.1, loop:1.3, fear:1.25,hunt:1,   flash:0.7},
};

function randBytes(n){const b=new Uint8Array(n);crypto.getRandomValues(b);return b}
function newToken(){return Array.from(randBytes(16),x=>x.toString(16).padStart(2,'0')).join('')}
function randomGameId(){let s='';for(const x of randBytes(6))s+=ID_CHARS[x%ID_CHARS.length];return s}
function isNum(v){return typeof v==='number'&&Number.isFinite(v)}
function toInt(v){const n=Math.trunc(Number(v));return Number.isFinite(n)?n:0}
function rnd(a,b){return a+Math.random()*(b-a)}
function dist(ax,ay,bx,by){return Math.hypot(ax-bx,ay-by)}
function angDiff(a,b){let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d}

function cleanOpts(o){
  o=o||{};
  const flag=v=>v===undefined?true:!!v;
  const size=toInt(o.size),time=toInt(o.time);
  return {
    size:[2,3,4,5,6,8,10,12,16].includes(size)?size:6, // сколько фей в раунде
    bots:flag(o.bots),          // свободные места занимают боты
    diff:['easy','normal','hard'].includes(o.diff)?o.diff:'normal',
    time:[90,150,210].includes(time)?time:150, // длина раунда, с
    powers:flag(o.powers),      // бонусы в саду
    ponds:flag(o.ponds),        // пруды с кувшинками
    wins:[0,3,5].includes(o.wins)?o.wins:0, // матч до стольких побед (0 — бесконечно)
    solo:!!o.solo,              // игра с ботами на одном устройстве
  };
}
function cleanName(n){return String(n==null?'':n).trim().slice(0,14)}
function newSlot(){return {kind:'empty',ws:null,token:null,name:'',online:false,tasks:[],skin:cleanSkin(),input:{a:0,flash:false}}}
function slotIds(n){const a=[];for(let i=0;i<n;i++)a.push('P'+i);return a}

function leader(g){
  for(const s of Object.keys(g.slots)){const sl=g.slots[s];if(sl.kind==='human'&&sl.online)return s}
  for(const s of Object.keys(g.slots))if(g.slots[s].kind==='human')return s;
  return null;
}
function slotsView(g){
  const v={};
  for(const s in g.slots){const sl=g.slots[s];v[s]={kind:sl.kind,name:sl.name,online:sl.online,skin:sl.skin,away:sl.kind==='bot'&&!!sl.token}}
  return v;
}
function freeSlotForJoin(g){
  const ids=Object.keys(g.slots);
  // свободное место, затем место чистого бота (не «замещающего» отошедшую игроку)
  return ids.find(s=>g.slots[s].kind==='empty')||ids.find(s=>g.slots[s].kind==='bot'&&!g.slots[s].token)||ids.find(s=>g.slots[s].kind==='gone')||null;
}
function allHumans(g){return Object.values(g.slots).every(sl=>sl.kind==='human')}
function gameDead(g){return Object.values(g.slots).every(sl=>sl.token===null)}
function cancelTasks(sl){for(const t of sl.tasks)clearTimeout(t);sl.tasks=[]}
function usedBotNames(g){return new Set(Object.values(g.slots).filter(s=>s.kind==='bot').map(s=>s.name))}
function makeBot(g,sl){
  const used=usedBotNames(g),free=BOT_NAMES.filter(n=>!used.has(n));
  const colors=new Set(Object.values(g.slots).filter(s=>s!==sl&&s.kind!=='empty'&&s.kind!=='gone').map(s=>s.skin.color));
  sl.kind='bot';sl.name=free.length?pick(free):'Фея';sl.skin=botSkin(colors);
}

// ---------- сад: клетки ----------
// own[c]: 0 — ничья, 1..16 — сад феи (номер+1), POND — пруд, WALL — за оградой.
// tr[c]: 0 или номер+1 феи, чья дорожка из лепестков лежит на клетке.
function cellAt(r,x,y){
  const cx=Math.floor(x/CELL+r.N/2),cy=Math.floor(y/CELL+r.N/2);
  if(cx<0||cy<0||cx>=r.N||cy>=r.N)return -1;
  return cy*r.N+cx;
}
function cellCenter(r,c){return [((c%r.N)-r.N/2+0.5)*CELL,(Math.floor(c/r.N)-r.N/2+0.5)*CELL]}
function blocked(r,x,y){const c=cellAt(r,x,y);return c<0||r.own[c]>=POND}
// шаг полёта с обходом препятствий: упёрлась в ограду или пруд — скользит вдоль, а не застревает
const SLIDE=[0,0.3,-0.3,0.6,-0.6,0.95,-0.95,1.35,-1.35];
function slide(isBlocked,x,y,a,step){
  for(const k of SLIDE){
    const b=a+k,s=step*Math.max(0.55,Math.cos(k)),nx=x+Math.cos(b)*s,ny=y+Math.sin(b)*s;
    if(!isBlocked(nx,ny))return [nx,ny];
  }
  return [x,y];
}
function setCell(r,c,v){
  const o=r.own[c];
  if(o===v||o>=POND)return;
  if(o)r.area[o-1]--;
  if(v)r.area[v-1]++;
  r.own[c]=v;r.gd.push(c,v);
}
function disc(r,x,y,rad,v){
  const c0=cellAt(r,x,y);if(c0<0)return 0;
  const cx=c0%r.N,cy=Math.floor(c0/r.N),R=Math.ceil(rad);let n=0;
  for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){
    if(dx*dx+dy*dy>rad*rad+0.5)continue;
    const X=cx+dx,Y=cy+dy;if(X<0||Y<0||X>=r.N||Y>=r.N)continue;
    const c=Y*r.N+X;if(r.own[c]>=POND)continue;
    if(r.own[c]!==v){setCell(r,c,v);n++}
  }
  return n;
}
function rle(a){
  const out=[];let v=a[0],n=1;
  for(let i=1;i<a.length;i++){if(a[i]===v)n++;else{out.push(v,n);v=a[i];n=1}}
  out.push(v,n);return out;
}

// ---------- раунд ----------
function newRound(g){
  const ids=Object.keys(g.slots).filter(s=>g.slots[s].kind!=='empty'&&g.slots[s].kind!=='gone');
  const n=ids.length,Rg=gridR(Math.max(n,4)),N=2*Rg+4;
  const r={phase:'count',t:0,phaseT:COUNTDOWN,Rg,N,R:Rg*CELL,own:new Uint8Array(N*N),tr:new Uint8Array(N*N),area:new Array(16).fill(0),
    total:0,pk:new Map(),pkId:1,f:{},order:ids,gd:[],add:[],del:[],ev:[],winner:null,standings:null,timeLeft:g.opts.time,
    powerT:3,diaT:1,snapN:0,roseT:g.opts.time*rnd(0.4,0.5),rose:false,starT:g.opts.time*rnd(0.62,0.7),star:false,warned:false};
  g.round=(g.round||0)+1;
  // ограда — круг
  for(let c=0;c<N*N;c++){
    const [x,y]=cellCenter(r,c);
    if(Math.hypot(x,y)>r.R)r.own[c]=WALL;
  }
  // феи — по кругу, у каждой маленький садик
  const off=Math.random()*Math.PI*2,homes=[];
  ids.forEach((sid,i)=>{
    const a=off+i*Math.PI*2/n,d=r.R*(n<=2?0.45:0.6);
    const x=Math.cos(a)*d,y=Math.sin(a)*d;
    homes.push([x,y]);
    g.slots[sid].input={a:a+Math.PI,flash:false};
    r.f[sid]={sid,i,x,y,a:a+Math.PI,out:false,tc:[],tp:[],tpS:0,sleepT:0,invT:0,speedT:0,shieldT:0,frostT:0,flashT:0,flashCd:0,
      catches:0,caught:0,dia:0,best:0,
      ai:{t:Math.random()*0.3,a:a+Math.PI,flash:false,st:'home',wp:[],until:0}};
  });
  // пруды — не рядом с домиками
  if(g.opts.ponds){
    const cnt=Math.round(Rg*Rg/520);
    for(let k=0,made=0;k<cnt*6&&made<cnt;k++){
      const a=Math.random()*Math.PI*2,d=Math.sqrt(Math.random())*(r.R-5*CELL);
      const x=Math.cos(a)*d,y=Math.sin(a)*d,rad=rnd(2.2,4.2)*CELL;
      if(homes.some(h=>dist(h[0],h[1],x,y)<rad+7*CELL))continue;
      // пруд — два-три перекрывающихся круга, чтобы берег был неровным
      const blobs=[[x,y,rad]];
      for(let b=0;b<2;b++){const ba=Math.random()*Math.PI*2;blobs.push([x+Math.cos(ba)*rad*0.6,y+Math.sin(ba)*rad*0.6,rad*rnd(0.55,0.8)])}
      for(let c=0;c<N*N;c++){
        if(r.own[c])continue;
        const [cx,cy]=cellCenter(r,c);
        if(blobs.some(b=>dist(cx,cy,b[0],b[1])<b[2]))r.own[c]=POND;
      }
      made++;
    }
  }
  for(let c=0;c<N*N;c++)if(!r.own[c])r.total++;
  homes.forEach((h,i)=>disc(r,h[0],h[1],HOME_R,i+1));
  r.gd=[];
  // бонусы и кристаллы
  if(g.opts.powers)for(let i=0;i<Math.ceil(n/2)+1;i++)spawnPickup(r,POWERS[Math.floor(Math.random()*POWERS.length)]);
  for(let i=0;i<n+2;i++)spawnPickup(r,'D');
  r.add=[];
  g.r=r;
}
function freeSpot(r,margin){
  for(let k=0;k<40;k++){
    const a=Math.random()*Math.PI*2,d=Math.sqrt(Math.random())*(r.R-margin);
    const x=Math.cos(a)*d,y=Math.sin(a)*d;
    if(!blocked(r,x,y))return [x,y];
  }
  return [0,0];
}
function spawnPickup(r,t){
  const [x,y]=freeSpot(r,2*CELL);
  const p=[r.pkId++,Math.round(x),Math.round(y),t];
  r.pk.set(p[0],p);r.add.push(p);
  return p;
}

// ---------- боты ----------
// Бот летает «петлями», как настоящая игрок: из своего сада наружу, поворот, ещё поворот — и домой.
// Если рядом чужая дорожка — бросается её порвать; если к её дорожке летит соперница — спешит домой.
function nearestOwn(r,f,maxR){
  const c0=cellAt(r,f.x,f.y);if(c0<0)return null;
  const cx=c0%r.N,cy=Math.floor(c0/r.N),p=f.i+1;
  for(let R=1;R<=maxR;R++){
    let best=null,bd=1e9;
    for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){
      if(Math.abs(dx)!==R&&Math.abs(dy)!==R)continue;
      const X=cx+dx,Y=cy+dy;if(X<0||Y<0||X>=r.N||Y>=r.N)continue;
      const c=Y*r.N+X;
      if(r.own[c]===p){const d=dx*dx+dy*dy;if(d<bd){bd=d;best=c}}
    }
    if(best!=null)return cellCenter(r,best);
  }
  return null;
}
function rayFree(r,x,y,a,cells,p){
  // сколько клеток по лучу — не наши (интерес) и нет ли впереди воды или ограды (опасность)
  let free=0,edge=0;
  for(let k=1;k<=cells;k++){
    const c=cellAt(r,x+Math.cos(a)*k*CELL,y+Math.sin(a)*k*CELL);
    if(c<0||r.own[c]>=POND)return {free,wall:k,edge:edge||k};
    if(r.own[c]!==p){free++;if(!edge)edge=k}
  }
  return {free,wall:0,edge:edge||cells};
}
function botThink(g,f){
  const r=g.r,D=DIFF[g.opts.diff]||DIFF.normal,ai=f.ai,p=f.i+1;
  const fs=Object.values(r.f).filter(o=>o!==f&&!o.sleepT);
  const len=f.tc.length;
  // 1. опасность: соперница близко к нашей голове, а мы далеко от дома
  if(f.out&&len>2){
    let danger=1e9;
    for(const o of fs){
      const d=dist(o.x,o.y,f.x,f.y);
      if(d<danger)danger=d;
      // и к хвосту дорожки
      for(let k=0;k<f.tc.length;k+=4){const [tx,ty]=cellCenter(r,f.tc[k]);const dd=dist(o.x,o.y,tx,ty);if(dd<danger)danger=dd}
    }
    const limit=(140+len*7)*D.fear;
    if(danger<limit&&ai.st!=='back'){ai.st='back';ai.wp=[];if(Math.random()<D.flash)ai.flash=true}
    if(len>(36+Math.random()*12)*D.loop&&ai.st==='out')ai.st='back';
  }
  // 2. охота: чужая дорожка рядом и её хозяйка далеко от неё
  if(len<8&&Math.random()<D.hunt){
    let best=null,bs=0;
    for(const o of fs){
      if(!o.out||o.tc.length<3||o.invT>0||o.shieldT>0)continue;
      for(let k=0;k<o.tc.length;k+=2){
        const [tx,ty]=cellCenter(r,o.tc[k]),d=dist(f.x,f.y,tx,ty);
        if(d>520)continue;
        const s=(dist(o.x,o.y,tx,ty)+40)/(d+30);
        if(s>bs&&s>0.9){bs=s;best=[tx,ty]}
      }
    }
    if(best){ai.st='hunt';ai.wp=[best];if(Math.random()<D.flash*0.5)ai.flash=true}
    else if(ai.st==='hunt')ai.st=f.out?'back':'home';
  }
  // 3. дома — планируем петлю
  if(!f.out&&(ai.st==='back'||ai.st==='hunt'&&!ai.wp.length))ai.st='home';
  if(ai.st==='home'&&(!ai.wp.length||!f.out)){
    let ba=f.a,bs=-1e9,edge=0;
    for(let k=0;k<10;k++){
      const a=f.a+rnd(-Math.PI,Math.PI),ray=rayFree(r,f.x,f.y,a,40,p);
      // интересно: много чужой/ничьей земли и недалеко до края своего сада; опасно: вода или ограда рядом
      const s=Math.min(ray.free,14)-ray.edge*0.5-(ray.wall&&ray.wall-ray.edge<10?(10-(ray.wall-ray.edge))*2.5:0)+Math.random()*3;
      if(s>bs){bs=s;ba=a;edge=ray.edge}
    }
    const L1=(Math.max(0,edge-1)+rnd(5,13)*D.loop)*CELL,L2=rnd(4,11)*D.loop*CELL,side=Math.random()<0.5?1:-1;
    const x1=f.x+Math.cos(ba)*L1,y1=f.y+Math.sin(ba)*L1;
    const pa=ba+side*Math.PI/2,x2=x1+Math.cos(pa)*L2,y2=y1+Math.sin(pa)*L2;
    ai.wp=[[x1,y1],[x2,y2]];ai.st='out';
  }
  if(ai.st==='out'&&!ai.wp.length)ai.st='back';
  if(ai.st==='back'){
    const h=nearestOwn(r,f,r.N);
    ai.wp=h?[h]:[[0,0]];
  }
  // 4. летим к точке
  let tx=f.x+Math.cos(f.a)*100,ty=f.y+Math.sin(f.a)*100;
  if(ai.wp.length){
    const w=ai.wp[0];
    if(dist(f.x,f.y,w[0],w[1])<CELL*1.2&&ai.st!=='back'){ai.wp.shift()}
    if(ai.wp.length){tx=ai.wp[0][0];ty=ai.wp[0][1]}
  }
  let a=Math.atan2(ty-f.y,tx-f.x);
  // 5. впереди вода или ограда — сворачиваем
  for(let k=0;k<6&&blocked(r,f.x+Math.cos(a)*CELL*2,f.y+Math.sin(a)*CELL*2);k++)a+=0.6*(k%2?-k:k);
  // 6. не влетать в свою же дорожку под острым углом — не страшно (своя не рвётся), но смотрится глупо: чуть шумим
  ai.a=a+rnd(-0.5,0.5)*D.err;
}

// ---------- шаг симуляции ----------
function aliveList(r){return Object.values(r.f)}

class FairyHub{
  constructor(o){
    o=o||{};
    this.games={};
    this.log=o.log||(()=>{});
    this.onChange=o.onChange||null;   // состояние игры изменилось (для сохранения)
    this.onClosed=o.onClosed||null;   // игра закрыта
    // таймер симуляции; страница может дать свой (из Web Worker — он не засыпает в фоне)
    this.every=o.every||((fn,ms)=>{const h=setInterval(fn,ms);return()=>clearInterval(h)});
  }

  connect(conn){
    const c={conn,g:null,me:null,emoteAt:0};
    return {
      message:data=>{try{this._message(c,data)}catch(e){this.log('[!] Ошибка: '+(e&&e.stack||e))}},
      closed:()=>{try{this._closed(c)}catch(e){this.log('[!] Ошибка: '+(e&&e.stack||e))}},
    };
  }

  // ---------- отправка ----------
  send(ws,msg){
    if(!ws)return;
    try{ws.send(msg)}catch(e){}
  }
  broadcast(g,msg,exclude){
    for(const sl of Object.values(g.slots))if(sl.ws&&sl.ws!==exclude)this.send(sl.ws,msg);
  }
  sendSlots(g){
    if(g.started)this.broadcast(g,{type:'slots',slots:slotsView(g),leader:leader(g),score:g.score});
    else this.broadcast(g,{type:'lobby',game_id:g.id,slots:slotsView(g),leader:leader(g),opts:g.opts});
  }
  changed(g){if(this.onChange&&this.games[g.id]===g)this.onChange(g)}

  // всё о текущем раунде — для начала раунда и для вернувшихся
  roundState(g){
    const r=g.r;
    return {round:g.round,phase:r.phase,phaseT:r.phaseT,N:r.N,Rg:r.Rg,R:r.R,total:r.total,order:r.order,grid:rle(r.own),
      trails:Object.values(r.f).map(f=>[f.i].concat(f.tp)),pk:Array.from(r.pk.values()),p:this.players(r),ar:this.areas(r),
      tl:Math.round(r.timeLeft*10),t:Math.round(r.t*1000),
      stats:Object.fromEntries(Object.values(r.f).map(f=>[f.i,[f.catches,f.dia]])),
      standings:r.standings,winner:r.winner,score:g.score,match_over:g.match_over,opts:g.opts};
  }
  fullState(g,sid){
    return Object.assign({type:'resumed',game_id:g.id,slot:sid,started:g.started,slots:slotsView(g),leader:leader(g)},
      g.started&&g.r?this.roundState(g):{opts:g.opts});
  }
  players(r){
    const out=[];
    for(const f of Object.values(r.f)){
      const flags=1|(f.shieldT>0?2:0)|(f.speedT>0?4:0)|(f.flashT>0?8:0)|(f.sleepT>0?16:0)|(f.frostT>0?32:0)|(f.invT>0?64:0)|(f.out?128:0);
      out.push([f.i,Math.round(f.x),Math.round(f.y),Math.round(f.a*100),flags]);
    }
    return out;
  }
  areas(r){return r.order.map((s,i)=>r.area[i])}

  // ---------- игровой цикл ----------
  startLoop(g){
    this.stopLoop(g);
    let last=Date.now(),acc=0;
    g.stopLoop=this.every(()=>{
      if(this.games[g.id]!==g||!g.r){this.stopLoop(g);return}
      const now=Date.now();
      if(g.paused){last=now;return} // пауза (только в игре с ботами на одном устройстве)
      acc+=Math.min(0.5,(now-last)/1000);last=now; // вкладка спала — не догоняем всё сразу
      let n=0;
      while(acc>=TICK&&n<8){acc-=TICK;n++;try{this.step(g)}catch(e){this.log('[!] Ошибка шага: '+(e&&e.stack||e))}}
    },1000/60);
  }
  stopLoop(g){if(g.stopLoop){const s=g.stopLoop;g.stopLoop=null;s()}}

  step(g){
    const r=g.r;
    r.t+=TICK;
    if(r.phase==='count'){
      r.phaseT-=TICK;
      if(r.phaseT<=0){r.phase='play';r.ev.push(['go'])}
    }else if(r.phase==='play'){
      this.simulate(g);
    }else if(r.phase==='end'){
      r.phaseT-=TICK;
      if(r.phaseT<=0&&!g.match_over){this.beginRound(g);return}
    }
    if(++r.snapN>=SNAP_EVERY){r.snapN=0;this.sendSnap(g)}
  }
  sendSnap(g){
    const r=g.r;
    const msg={type:'snap',t:Math.round(r.t*1000),ph:r.phase,pt:Math.round(r.phaseT*10),tl:Math.round(r.timeLeft*10),p:this.players(r),ar:this.areas(r)};
    // сад: изменения клеток; если их очень много — весь сад целиком (сжатый)
    if(r.gd.length>4000)msg.gf=rle(r.own);
    else if(r.gd.length)msg.gd=r.gd;
    // новые точки дорожек
    const tr=[];
    for(const f of Object.values(r.f))if(f.tp.length>f.tpS){tr.push([f.i].concat(f.tp.slice(f.tpS)));f.tpS=f.tp.length}
    if(tr.length)msg.tr=tr;
    if(r.add.length)msg.add=r.add;
    if(r.del.length)msg.del=r.del;
    if(r.ev.length)msg.ev=r.ev;
    r.gd=[];r.add=[];r.del=[];r.ev=[];
    this.broadcast(g,msg);
  }
  beginRound(g){
    newRound(g);
    this.broadcast(g,Object.assign({type:'round'},this.roundState(g)));
    this.changed(g);
  }

  simulate(g){
    const r=g.r,fs=Object.values(r.f);
    r.timeLeft-=TICK;
    if(!r.warned&&r.timeLeft<=30&&g.opts.time>40){r.warned=true;r.ev.push(['w'])}
    for(const f of fs){
      const sl=g.slots[f.sid];
      f.flashT=Math.max(0,f.flashT-TICK);f.flashCd=Math.max(0,f.flashCd-TICK);
      f.speedT=Math.max(0,f.speedT-TICK);f.shieldT=Math.max(0,f.shieldT-TICK);f.frostT=Math.max(0,f.frostT-TICK);f.invT=Math.max(0,f.invT-TICK);
      if(f.sleepT>0){f.sleepT=Math.max(0,f.sleepT-TICK);if(!f.sleepT)r.ev.push(['wk',f.i]);continue}
      let inp;
      if(sl.kind==='bot'){
        f.ai.t-=TICK;
        if(f.ai.t<=0){botThink(g,f);const D=DIFF[g.opts.diff]||DIFF.normal;f.ai.t=D.react*rnd(0.7,1.3)}
        inp=f.ai;
      }else if(sl.kind==='human'&&sl.online)inp=sl.input;
      else inp={a:f.a,flash:false}; // отошла, а бота нет — летит прямо
      if(inp.flash){inp.flash=false;if(f.flashCd<=0){f.flashT=FLASH_T;f.flashCd=FLASH_CD;r.ev.push(['d',f.i])}}
      const want=isNum(inp.a)?inp.a:f.a,d=angDiff(f.a,want),mt=TURN*TICK;
      f.a+=Math.max(-mt,Math.min(mt,d));
      if(f.a>Math.PI)f.a-=Math.PI*2;else if(f.a<-Math.PI)f.a+=Math.PI*2;
      const sp=SPEED*(f.speedT>0?SPEED_MUL:1)*(f.flashT>0?FLASH_MUL:1)*(f.frostT>0?FROST_MUL:1);
      const [nx,ny]=slide((x,y)=>blocked(r,x,y),f.x,f.y,f.a,sp*TICK);
      this.moveTo(g,f,nx,ny);
    }
    // феи не проходят сквозь друг друга
    for(let i=0;i<fs.length;i++)for(let j=i+1;j<fs.length;j++){
      const a=fs[i],b=fs[j],dx=b.x-a.x,dy=b.y-a.y,dd=Math.hypot(dx,dy);
      if(dd>0&&dd<BODY_R*2){
        const p=(BODY_R*2-dd)/2,ux=dx/dd,uy=dy/dd;
        if(!a.sleepT&&!blocked(r,a.x-ux*p,a.y-uy*p)){a.x-=ux*p;a.y-=uy*p}
        if(!b.sleepT&&!blocked(r,b.x+ux*p,b.y+uy*p)){b.x+=ux*p;b.y+=uy*p}
      }
    }
    // чары: голова феи на чужой дорожке — хозяйка дорожки засыпает
    for(const f of fs){
      if(f.sleepT)continue;
      const c=cellAt(r,f.x,f.y);if(c<0)continue;
      const t=r.tr[c];
      if(t&&t!==f.i+1){const v=fs.find(o=>o.i===t-1);if(v)this.cut(g,v,f)}
    }
    // подбор
    for(const f of fs){
      if(f.sleepT)continue;
      for(const p of r.pk.values()){
        if(Math.abs(p[1]-f.x)>PICK_R||Math.abs(p[2]-f.y)>PICK_R||dist(p[1],p[2],f.x,f.y)>PICK_R)continue;
        r.pk.delete(p[0]);r.del.push([p[0],f.i]);
        this.power(g,f,p[3]);
      }
    }
    // новые бонусы и кристаллы
    if(g.opts.powers&&(r.powerT-=TICK)<=0){
      r.powerT=rnd(4,8);
      let pw=0;for(const p of r.pk.values())if(p[3]!=='D')pw++;
      if(pw<Math.ceil(r.order.length/2)+1)spawnPickup(r,POWERS[Math.floor(Math.random()*POWERS.length)]);
    }
    if((r.diaT-=TICK)<=0){
      r.diaT=rnd(2,4);
      let dn=0;for(const p of r.pk.values())if(p[3]==='D')dn++;
      if(dn<r.order.length+2)spawnPickup(r,'D');
    }
    // волшебная роза — одна за раунд; звездопад — россыпь кристаллов
    if(!r.rose&&r.timeLeft<=r.roseT){
      r.rose=true;
      const p=spawnPickup(r,'G');
      r.ev.push(['g',p[1],p[2]]);
    }
    if(!r.star&&r.timeLeft<=r.starT){
      r.star=true;
      for(let i=0;i<r.order.length*3+4;i++)spawnPickup(r,'D');
      r.ev.push(['sf']);
    }
    for(const f of fs){const s=r.area[f.i]/r.total;if(s>f.best)f.best=s}
    this.checkEnd(g);
  }
  // перелёт в точку (x,y): дорожка, возвращение домой
  moveTo(g,f,x,y){
    const r=g.r,p=f.i+1;
    const ox=f.x,oy=f.y,steps=Math.max(1,Math.ceil(Math.hypot(x-ox,y-oy)/5));
    let lastC=cellAt(r,ox,oy);
    for(let s=1;s<=steps;s++){
      const px=ox+(x-ox)*s/steps,py=oy+(y-oy)*s/steps,c=cellAt(r,px,py);
      if(c===lastC||c<0)continue;
      lastC=c;
      if(r.own[c]===p){
        f.x=px;f.y=py;
        if(f.tc.length)this.capture(g,f);
        f.out=false;
      }else if(r.own[c]<POND){
        if(r.tr[c]!==p){
          const t=r.tr[c];
          if(t){const v=r.f[r.order[t-1]];if(v&&v!==f)this.cut(g,v,f)}
          r.tr[c]=p;f.tc.push(c);
        }
        f.out=true;
      }
    }
    f.x=x;f.y=y;
    // точки для красивой дорожки у игроков
    if(f.out){
      const n=f.tp.length;
      if(!n||dist(f.tp[n-2],f.tp[n-1],x,y)>11)f.tp.push(Math.round(x),Math.round(y));
    }
  }
  clearTrail(r,f){
    const p=f.i+1;
    for(const c of f.tc)if(r.tr[c]===p)r.tr[c]=0;
    f.tc=[];f.tp=[];f.tpS=0;f.out=false;
    r.ev.push(['tc',f.i]);
  }
  // фея вернулась домой: дорожка становится садом, а всё, что она обвела, — расцветает
  capture(g,f){
    const r=g.r,p=f.i+1,N=r.N,own=r.own;
    const before=r.area[f.i];
    for(const c of f.tc)setCell(r,c,p);
    // заливка «снаружи»: от края сетки по всему, что не наше; что не достали — обведено
    const seen=new Uint8Array(N*N),q=new Int32Array(N*N);let qh=0,qt=0;
    const push=c=>{if(!seen[c]&&own[c]!==p){seen[c]=1;q[qt++]=c}};
    for(let i=0;i<N;i++){push(i);push((N-1)*N+i);push(i*N);push(i*N+N-1)}
    while(qh<qt){
      const c=q[qh++],x=c%N;
      if(x>0)push(c-1);if(x<N-1)push(c+1);
      if(c>=N)push(c-N);if(c<N*N-N)push(c+N);
    }
    for(let c=0;c<N*N;c++)if(!seen[c]&&own[c]!==p&&own[c]<POND)setCell(r,c,p);
    const got=r.area[f.i]-before;
    const [cx,cy]=f.tc.length?cellCenter(r,f.tc[Math.floor(f.tc.length/2)]):[f.x,f.y];
    this.clearTrail(r,f);
    r.ev.push(['cap',f.i,got,Math.round(cx),Math.round(cy)]);
    // у кого сад отняли целиком — та засыпает и просыпается в новом садике
    for(const o of Object.values(r.f))if(o!==f&&r.area[o.i]<=0&&!o.sleepT)this.sleep(g,o,f);
  }
  // голова соперницы коснулась дорожки v
  cut(g,v,by){
    const r=g.r;
    if(v.sleepT||!v.tc.length)return;
    if(v.invT>0)return;
    if(v.shieldT>0){
      // пузырь лопается вместо дорожки
      v.shieldT=0;v.invT=0.8;
      r.ev.push(['h',v.i]);
      return;
    }
    this.sleep(g,v,by);
  }
  sleep(g,v,by){
    const r=g.r,ox=v.x,oy=v.y;
    this.clearTrail(r,v);
    v.caught++;
    if(by){by.catches++;const s=g.score[by.sid];if(s)s.catches++}
    // просыпается дома; дома нет (или он крошечный) — в новом садике
    let home=null;
    if(r.area[v.i]>=6){
      const p=v.i+1,cells=[];
      for(let c=0;c<r.own.length;c++)if(r.own[c]===p&&r.own[c-1]===p&&r.own[c+1]===p&&r.own[c-r.N]===p&&r.own[c+r.N]===p)cells.push(c);
      if(cells.length)home=cellCenter(r,cells[Math.floor(Math.random()*cells.length)]);
    }
    if(!home){
      let best=null,bs=-1;
      for(let k=0;k<30;k++){
        const [x,y]=freeSpot(r,(HOME_R+3)*CELL);let s=0;
        for(const o of Object.values(r.f))if(o!==v)s+=Math.min(600,dist(o.x,o.y,x,y));
        if(r.own[cellAt(r,x,y)]===0)s+=900;
        if(s>bs){bs=s;best=[x,y]}
      }
      home=best||[0,0];
      disc(r,home[0],home[1],HOME_R,v.i+1);
    }
    v.x=home[0];v.y=home[1];
    v.sleepT=SLEEP_T;v.invT=SLEEP_T+WAKE_INV;v.flashT=0;v.speedT=0;v.frostT=0;
    v.ai.st='home';v.ai.wp=[];
    r.ev.push(['x',by?by.i:-1,v.i,Math.round(ox),Math.round(oy),Math.round(v.x),Math.round(v.y)]);
  }
  power(g,f,t){
    const r=g.r;
    if(t==='D'){f.dia++;r.ev.push(['p',f.i,t]);return}
    if(t==='S')f.speedT=POWER_T.S;
    else if(t==='H')f.shieldT=POWER_T.H;
    else if(t==='R'){disc(r,f.x,f.y,4.3,f.i+1)}
    else if(t==='F'){
      for(const o of Object.values(r.f))if(o!==f&&!o.sleepT&&dist(o.x,o.y,f.x,f.y)<FROST_R)o.frostT=POWER_T.F;
      r.ev.push(['f',f.i,Math.round(f.x),Math.round(f.y)]);
    }
    else if(t==='G'){disc(r,f.x,f.y,6.5,f.i+1);f.shieldT=POWER_T.G;f.dia+=3}
    r.ev.push(['p',f.i,t]);
    // радуга и роза могут «замкнуть» дорожку прямо на месте
    if((t==='R'||t==='G')&&f.tc.length){const c=cellAt(r,f.x,f.y);if(r.own[c]===f.i+1)this.capture(g,f)}
  }
  checkEnd(g){
    const r=g.r;
    let top=null;
    for(const f of Object.values(r.f))if(!top||r.area[f.i]>r.area[top.i])top=f;
    const early=top&&r.area[top.i]/r.total>=WIN_SHARE;
    if(r.timeLeft>0&&!early)return;
    r.timeLeft=Math.max(0,r.timeLeft);
    const list=Object.values(r.f).sort((a,b)=>r.area[b.i]-r.area[a.i]||b.catches-a.catches);
    list.forEach((f,k)=>f.place=k+1);
    const win=list[0]||null;
    if(win){r.winner=win.sid;const s=g.score[win.sid];if(s)s.wins++}
    for(const f of list){const s=g.score[f.sid];if(s)s.best=Math.max(s.best||0,Math.round(r.area[f.i]/r.total*1000))}
    r.phase='end';r.phaseT=END_PAUSE;
    r.standings=list.map(f=>({sid:f.sid,i:f.i,place:f.place,share:Math.round(r.area[f.i]/r.total*1000),best:Math.round(f.best*1000),catches:f.catches,caught:f.caught,dia:f.dia}));
    if(g.opts.wins&&win&&g.score[win.sid].wins>=g.opts.wins)g.match_over=true;
    this.sendSnap(g);
    this.broadcast(g,{type:'round_end',winner:r.winner,early:!!early,standings:r.standings,score:g.score,match_over:g.match_over,next:END_PAUSE,round:g.round});
    this.changed(g);
  }

  startGame(g){
    const ids=Object.keys(g.slots);
    if(g.opts.bots)for(const s of ids)if(g.slots[s].kind==='empty')makeBot(g,g.slots[s]);
    if(ids.filter(s=>g.slots[s].kind!=='empty').length<2)return false;
    g.started=true;g.match_over=false;g.round=0;
    g.score={};for(const s of ids)g.score[s]={wins:0,catches:0,best:0};
    this.sendSlots(g); // имена фей — раньше, чем начнётся раунд
    this.beginRound(g);
    this.startLoop(g);
    return true;
  }

  releaseSlot(g,sid){
    // игрок ушла насовсем: место освобождается (в игре — бот или «ушла»)
    const sl=g.slots[sid];
    cancelTasks(sl);
    sl.token=null;sl.ws=null;sl.online=false;
    if(!g.started){sl.kind='empty';sl.name=''}
    else if(g.opts.bots)makeBot(g,sl);
    else sl.kind='gone';
  }
  afterLeave(g){
    if(gameDead(g)){this.closeGame(g);return}
    this.sendSlots(g);
  }
  closeGame(g){
    this.stopLoop(g);
    for(const sl of Object.values(g.slots))cancelTasks(sl);
    if(this.games[g.id]!==g)return;
    delete this.games[g.id];
    this.log(`[-] Игра ${g.id} закрыта`);
    if(this.onClosed)this.onClosed(g.id);
  }
  awayTimer(g,sid,token){
    const sl=g.slots[sid];
    const giveUp=()=>{
      if(sl.token===token&&!sl.online){
        this.log(`[-] Игрок ${sid} не вернулась в игру ${g.id}`);
        this.releaseSlot(g,sid);
        this.afterLeave(g);
        this.changed(g);
      }
    };
    if(g.started){
      sl.tasks.push(setTimeout(()=>{
        if(sl.token===token&&!sl.online&&sl.kind==='human'&&g.opts.bots){
          // за отошедшую пока играет бот; вернётся — получит управление обратно
          sl.kind='bot';
          this.sendSlots(g);
          this.changed(g);
        }
        sl.tasks.push(setTimeout(giveUp,(RECONNECT_GRACE-BOT_DELAY)*1000));
      },BOT_DELAY*1000));
    }else sl.tasks.push(setTimeout(giveUp,RECONNECT_GRACE*1000));
  }

  // ---------- сообщения ----------
  _message(c,data){
    if(!data||typeof data!=='object')return;
    const ws=c.conn,action=data.action;
    let g=c.g,me=c.me;

    if(action==='ping'){
      this.send(ws,{type:'pong',n:data.n});
    }else if(action==='create_game'){
      // в P2P код игры выбирает хост (от него зависит адрес для подключения)
      let gid=String(data.game_id||'').toUpperCase();
      if(!/^[A-Z0-9]{6}$/.test(gid)||this.games[gid])gid=randomGameId();
      while(this.games[gid])gid=randomGameId();
      const o=cleanOpts(data.opts);
      g={id:gid,opts:o,slots:{},started:false,score:{},round:0,match_over:false};
      for(const s of slotIds(o.size))g.slots[s]=newSlot();
      me='P0';
      const sl=g.slots[me];
      Object.assign(sl,{kind:'human',ws,token:newToken(),name:cleanName(data.name)||'Фея 1',online:true,skin:cleanSkin(data.skin)});
      this.games[gid]=g;
      c.g=g;c.me=me;
      this.send(ws,{type:'joined',game_id:gid,slot:me,token:sl.token});
      this.log(`[+] Игра ${gid} создана (${o.size} фей)`);
      // игра с ботами на одном устройстве — сразу в сад
      if(o.solo){o.bots=true;this.startGame(g);this.sendSlots(g)}
      else this.sendSlots(g);
    }else if(action==='join_game'){
      const gid=String(data.game_id||'').toUpperCase();
      const gg=this.games[gid];
      const sid=gg&&!gg.opts.solo?freeSlotForJoin(gg):null;
      if(!sid){this.send(ws,{type:'error',message:gg?'В игре нет свободных мест':'Игра не найдена'});return}
      g=gg;me=sid;c.g=g;c.me=me;
      const sl=g.slots[me];
      cancelTasks(sl);
      const n=Object.values(g.slots).filter(s=>s.token).length+1;
      Object.assign(sl,{kind:'human',ws,token:newToken(),name:cleanName(data.name)||`Фея ${n}`,online:true,skin:cleanSkin(data.skin),input:{a:0,flash:false}});
      if(g.score&&!g.score[me])g.score[me]={wins:0,catches:0,best:0};
      this.send(ws,{type:'joined',game_id:gid,slot:me,token:sl.token});
      this.log(`[+] Игрок вошла в ${gid} на место ${me}`);
      if(g.started){
        if(g.r&&g.r.f[me])sl.input.a=g.r.f[me].a;
        this.send(ws,this.fullState(g,me));
        this.sendSlots(g);
      }else if(allHumans(g)){
        this.startGame(g);
        this.sendSlots(g);
      }else this.sendSlots(g);
    }else if(action==='resume'){
      const gid=String(data.game_id||'').toUpperCase();
      const sid=data.slot;
      const gg=this.games[gid];
      if(!gg||!(sid in gg.slots)||gg.slots[sid].token===null||gg.slots[sid].token!==data.token){
        this.send(ws,{type:'resume_failed'});
        return;
      }
      g=gg;me=sid;c.g=g;c.me=me;
      const sl=g.slots[me];
      const old=sl.ws;
      cancelTasks(sl);
      Object.assign(sl,{ws,online:true,kind:'human',input:{a:g.r&&g.r.f[me]?g.r.f[me].a:0,flash:false}});
      if(data.skin)sl.skin=cleanSkin(data.skin);
      if(old&&old!==ws){try{old.close()}catch(e){}}
      this.send(ws,this.fullState(g,me));
      this.sendSlots(g);
      this.log(`[~] Игрок ${me} вернулась в игру ${gid}`);
    }else if(!g){
      return;
    }else if(action==='input'){
      // направление полёта (радианы) и вспышка
      const sl=g.slots[me];
      if(sl.ws!==ws)return;
      if(isNum(data.a))sl.input.a=data.a;
      if(data.d)sl.input.flash=true;
      return; // часто — без сохранения
    }else if(action==='start_game'){
      if(!g.started&&leader(g)===me){
        if(this.startGame(g))this.sendSlots(g);
        else this.send(ws,{type:'error',message:'Нужно хотя бы две феи — позови подругу или включи ботов'});
      }
    }else if(action==='restart'){
      // новый матч — после финала или по желанию создательницы
      if(g.started&&leader(g)===me&&(g.match_over||(g.r&&g.r.phase==='end'))){
        for(const s in g.score)g.score[s]={wins:0,catches:0,best:0};
        g.match_over=false;g.round=0;
        this.beginRound(g);
      }
    }else if(action==='emote'){
      // быстрая фраза над феей; не чаще раза в секунду, чтобы не заспамили
      const now=Date.now(),e=toInt(data.e);
      if(g.started&&g.r&&now-c.emoteAt>1000&&e>=0&&e<16){
        c.emoteAt=now;const f=g.r.f[me];
        if(f)this.broadcast(g,{type:'emote',i:f.i,e});
      }
    }else if(action==='leave'){
      if(g.slots[me].ws===ws){
        this.releaseSlot(g,me);
        this.afterLeave(g);
      }
      this.changed(g);
      c.g=null;c.me=null;
      return;
    }
    if(c.g)this.changed(c.g);
  }

  _closed(c){
    const g=c.g,me=c.me;
    if(!g||!me||g.slots[me].ws!==c.conn)return;
    const sl=g.slots[me];
    sl.ws=null;sl.online=false;
    this.awayTimer(g,me,sl.token);
    this.sendSlots(g);
    this.changed(g);
  }

  // ---------- для хоста ----------
  // Хост закрывает игру: всем сообщаем и рвём соединения
  shutdown(gid){
    const g=this.games[gid];
    if(!g)return;
    for(const sl of Object.values(g.slots)){
      if(sl.ws){const ws=sl.ws;sl.ws=null;this.send(ws,{type:'game_closed'});try{ws.close()}catch(e){}}
    }
    this.closeGame(g);
  }
  // Снимок игры без соединений, таймеров и текущего раунда — чтобы пережить перезагрузку вкладки хоста
  snapshot(gid){
    const g=this.games[gid];
    if(!g)return null;
    const slots={};
    for(const s in g.slots){const sl=g.slots[s];slots[s]={kind:sl.kind,token:sl.token,name:sl.name,skin:sl.skin}}
    return JSON.parse(JSON.stringify({id:g.id,opts:g.opts,slots,started:g.started,score:g.score,round:g.round,match_over:g.match_over}));
  }
  restore(snap){
    const g=JSON.parse(JSON.stringify(snap));
    for(const s in g.slots)Object.assign(g.slots[s],{ws:null,online:false,tasks:[],input:{a:0,flash:false}});
    this.games[g.id]=g;
    // раунд после перезагрузки начинается заново
    if(g.started){g.round=Math.max(0,(g.round||1)-1);newRound(g);this.startLoop(g)}
    // все пока «отошли»: кто не вернётся вовремя — уступит место боту, как при обрыве связи
    for(const s in g.slots){const sl=g.slots[s];if(sl.token)this.awayTimer(g,s,sl.token)}
    return g;
  }
}

FairyHub.randomGameId=randomGameId;
FairyHub.slide=slide;
FairyHub.rules={TICK,CELL,BODY_R,SPEED,TURN,FLASH_T,FLASH_CD,FLASH_MUL,SPEED_MUL,FROST_MUL,FROST_R,SLEEP_T,COUNTDOWN,END_PAUSE,PICK_R,POWER_T,
  WALL,POND,WIN_SHARE,COLORS,WINGS,HEADS,TRAILS,PETS,gridR};
root.FairyHub=FairyHub;
if(typeof module!=='undefined'&&module.exports)module.exports=FairyHub;
})(typeof window!=='undefined'?window:globalThis);
