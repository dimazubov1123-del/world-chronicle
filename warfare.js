/* WORLD CHRONICLE — province movement and continuous frontlines */
(function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const warKey=(a,b)=>String(a)+'|'+String(b);
 const wars=()=>state.wars||(state.wars=[]);
 const armies=()=>state.armies||(state.armies=[]);
 const occupied=()=>state.occupiedRegions||(state.occupiedRegions={});
 const exercises=()=>state.exercises||(state.exercises=[]);
 const key=(admin,name)=>String(admin)+'::'+String(name);
 let selectedUnitId=null,unitLayer=null,frontLayer=null,frontsVisible=state.frontsVisible!==false;
 const featureByKey=new Map(),boxCache=new WeakMap(),segmentCache=new WeakMap(),adjacencyCache=new Map();
 const capitals={
  Russia:[55.7558,37.6173],'United States of America':[38.9072,-77.0369],China:[39.9042,116.4074],Germany:[52.52,13.405],France:[48.8566,2.3522],'United Kingdom':[51.5072,-.1276],Japan:[35.6762,139.6503],Brazil:[-15.7939,-47.8828],India:[28.6139,77.209],Italy:[41.9028,12.4964],Canada:[45.4215,-75.6972],Mexico:[19.4326,-99.1332],Ukraine:[50.4501,30.5234],Poland:[52.2297,21.0122],Turkey:[39.9334,32.8597],Iran:[35.6892,51.389],Spain:[40.4168,-3.7038],Australia:[-35.2809,149.13],Egypt:[30.0444,31.2357],'South Korea':[37.5665,126.978],Andorra:[42.5063,1.5218],Luxembourg:[49.6116,6.1319],Liechtenstein:[47.141,9.5209],'San Marino':[43.9424,12.4578],Malta:[35.8992,14.5141]
 };
 function admin(p){return String(p.admin||p.ADMIN||p.sovereignt||p.geonunit||p.shapeGroup||'').trim()}
 function name(p){return String(p.name||p.name_en||p.NAME||p.name_alt||p.shapeName||'Регион').trim()}
 function fkey(f){const p=f?.properties||{};return key(admin(p),name(p))}
 function controller(f){return occupied()[fkey(f)]?.controller||admin(f.properties||{})}
 function atWar(a,b){return wars().includes(warKey(a,b))||wars().includes(warKey(b,a))}
 function regionFeatures(){return window.__wcRegionData?.features||[]}
 function rebuildIndex(){featureByKey.clear();for(const f of regionFeatures())featureByKey.set(fkey(f),f)}
 function coordsOfGeometry(g){
  if(!g)return [];
  const out=[];
  const visit=x=>{if(!Array.isArray(x))return;if(x.length>=2&&typeof x[0]==='number'&&typeof x[1]==='number'){out.push(x);return}for(const y of x)visit(y)};
  visit(g.coordinates);return out;
 }
 function bounds(f){
  if(boxCache.has(f))return boxCache.get(f);
  const pts=coordsOfGeometry(f.geometry);let minX=180,minY=90,maxX=-180,maxY=-90;
  pts.forEach(p=>{minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1])});
  const b={minX,minY,maxX,maxY};boxCache.set(f,b);return b;
 }
 function segments(f){
  if(segmentCache.has(f))return segmentCache.get(f);
  const out=[],g=f.geometry;if(!g){segmentCache.set(f,out);return out}
  const rings=[];
  const addPolygon=poly=>{if(Array.isArray(poly))for(const ring of poly)if(Array.isArray(ring))rings.push(ring)};
  if(g.type==='Polygon')addPolygon(g.coordinates);
  else if(g.type==='MultiPolygon')for(const poly of g.coordinates||[])addPolygon(poly);
  for(const ring of rings)for(let i=1;i<ring.length;i++){
   const p=ring[i-1],q=ring[i];if(!p||!q)continue;
   out.push({a:p,b:q,minX:Math.min(p[0],q[0]),maxX:Math.max(p[0],q[0]),minY:Math.min(p[1],q[1]),maxY:Math.max(p[1],q[1])});
  }
  segmentCache.set(f,out);return out;
 }
 function pointLineDistance(p,a,b,cos){
  const ax=a[0]*cos,ay=a[1],bx=b[0]*cos,by=b[1],px=p[0]*cos,py=p[1],dx=bx-ax,dy=by-ay;
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));
 }
 function sharedBorder(a,b){
  const ba=bounds(a),bb=bounds(b),tol=.018;
  if(ba.maxX<bb.minX-tol||bb.maxX<ba.minX-tol||ba.maxY<bb.minY-tol||bb.maxY<ba.minY-tol)return [];
  const sa=segments(a),sb=segments(b),out=[];
  for(const x of sa)for(const y of sb){
   if(x.maxX<y.minX-tol||y.maxX<x.minX-tol||x.maxY<y.minY-tol||y.maxY<x.minY-tol)continue;
   const lat=(x.a[1]+x.b[1]+y.a[1]+y.b[1])/4,cos=Math.max(.15,Math.cos(lat*Math.PI/180));
   const ax=x.a[0]*cos,ay=x.a[1],bx=x.b[0]*cos,by=x.b[1],cx=y.a[0]*cos,cy=y.a[1],dx=y.b[0]*cos,dy=y.b[1];
   const ux=bx-ax,uy=by-ay,vx=dx-cx,vy=dy-cy,lu=Math.hypot(ux,uy),lv=Math.hypot(vx,vy);
   if(lu<.004||lv<.004)continue;
   const parallel=Math.abs((ux*vy-uy*vx)/(lu*lv));
   if(parallel>.09)continue;
   const dist1=pointLineDistance(y.a,x.a,x.b,cos),dist2=pointLineDistance(y.b,x.a,x.b,cos),dist3=pointLineDistance(x.a,y.a,y.b,cos),dist4=pointLineDistance(x.b,y.a,y.b,cos);
   if(Math.min(dist1,dist2,dist3,dist4)>.014)continue;
   const uxN=ux/lu,uyN=uy/lu;
   const projA=0,projB=lu,projC=(cx-ax)*uxN+(cy-ay)*uyN,projD=(dx-ax)*uxN+(dy-ay)*uyN;
   const lo=Math.max(Math.min(projA,projB),Math.min(projC,projD)),hi=Math.min(Math.max(projA,projB),Math.max(projC,projD));
   if(hi-lo<.012)continue;
   const toPoint=t=>[ (ax+uxN*t)/cos, ay+uyN*t ];
   const p1=toPoint(lo),p2=toPoint(hi);
   if(!out.some(z=>Math.abs(z[0][0]-p1[0])<.01&&Math.abs(z[1][0]-p2[0])<.01))out.push([p1,p2]);
  }
  return out;
 }
 function adjacent(f){
  const k=fkey(f);if(adjacencyCache.has(k))return adjacencyCache.get(k);
  const b=bounds(f),out=[];
  for(const candidate of regionFeatures()){
   if(candidate===f)continue;
   const cb=bounds(candidate),pad=.018;
   if(cb.maxX<b.minX-pad||b.maxX<cb.minX-pad||cb.maxY<b.minY-pad||b.maxY<cb.minY-pad)continue;
   const border=sharedBorder(f,candidate);if(border.length)out.push({feature:candidate,border});
  }
  adjacencyCache.set(k,out);return out;
 }
 function center(f){
  try{const b=L.geoJSON(f).getBounds();if(b.isValid())return [b.getCenter().lat,b.getCenter().lng]}catch(e){}
  return [0,0];
 }
 function pointInRing(point,ring){
  let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
   const intersect=((yi>point[0])!==(yj>point[0]))&&(point[1]<(xj-xi)*(point[0]-yi)/(yj-yi||1e-12)+xi);
   if(intersect)inside=!inside;
  }return inside;
 }
 function pointInFeature(latlng,f){
  const g=f.geometry;if(!g)return false;
  const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  for(const poly of polys){if(!poly?.length||!pointInRing([latlng[0],latlng[1]],poly[0]))continue;let hole=false;for(let i=1;i<poly.length;i++)if(pointInRing([latlng[0],latlng[1]],poly[i]))hole=true;if(!hole)return true}
  return false;
 }
 function initialRegion(countryId,latlng){
  const features=regionFeatures().filter(f=>admin(f.properties||{})===countryId);
  if(!features.length)return null;
  const found=features.find(f=>pointInFeature(latlng,f));if(found)return found;
  let best=features[0],bestD=Infinity;
  features.forEach(f=>{const c=center(f),d=(c[0]-latlng[0])**2+(c[1]-latlng[1])**2;if(d<bestD){bestD=d;best=f}});
  return best;
 }
 function unitRegion(unit){
  if(unit.regionKey&&featureByKey.has(unit.regionKey))return featureByKey.get(unit.regionKey);
  const found=initialRegion(state.selected,unit.position||[0,0]);
  if(found){unit.regionKey=fkey(found);unit.location=name(found.properties||{});return found}
  return null;
 }
 function ensureLayers(){
  if(!map||unitLayer)return;
  map.createPane('frontPane');map.getPane('frontPane').style.zIndex=480;
  map.createPane('unitsPane');map.getPane('unitsPane').style.zIndex=490;
  frontLayer=L.layerGroup([], {pane:'frontPane'}).addTo(map);
  unitLayer=L.layerGroup([], {pane:'unitsPane'}).addTo(map);
 }
 function syncUnits(){
  frontsVisible=state.frontsVisible!==false;
  if(!map||!window.L)return;ensureLayers();unitLayer.clearLayers();
  armies().forEach(u=>{
   if(!Array.isArray(u.position)||u.position.length!==2)return;
   const marker=L.marker(u.position,{pane:'unitsPane',icon:L.divIcon({className:'wc-army-marker '+(u.id===selectedUnitId?'selected':''),html:'<span>⚑</span><small>'+esc(u.name)+'</small>',iconSize:[34,34],iconAnchor:[17,17]})});
   marker.bindTooltip(esc(u.name)+' · '+u.type+' · '+u.strength+' тыс. · '+esc(u.location||'Позиция не указана'),{direction:'top',className:'wc-army-tooltip'});
   marker.on('click',()=>{selectedUnitId=u.id;syncUnits();openWarRoom()});unitLayer.addLayer(marker);
  });
  exercises().filter(x=>x.status==='active'&&Array.isArray(x.position)).forEach(ex=>{
   const marker=L.marker(ex.position,{pane:'unitsPane',interactive:true,icon:L.divIcon({className:'wc-exercise-marker',html:'<span>✣</span><small>УЧЕНИЯ</small>',iconSize:[42,42],iconAnchor:[21,21]})});
   marker.bindTooltip(esc(ex.name)+' · '+esc(ex.exerciseType)+' · осталось ходов: '+Math.max(0,Number(ex.endsTurn||0)-Number(state.turn||0)),{direction:'top',className:'wc-army-tooltip'});
   unitLayer.addLayer(marker);
  });
  syncFronts();
 }
 function frontContacts(){
  if(!featureByKey.size)rebuildIndex();
  const features=regionFeatures(),active=new Set();
  wars().forEach(w=>String(w).split('|').forEach(x=>active.add(x)));
  const out=[],seen=new Set();
  for(const f of features){
   const sideA=controller(f);if(!active.has(sideA)&&!active.has(admin(f.properties||{})))continue;
   for(const n of adjacent(f)){
    const sideB=controller(n.feature);if(sideA===sideB||!atWar(sideA,sideB))continue;
    const pair=[fkey(f),fkey(n.feature)].sort().join('|');if(seen.has(pair))continue;seen.add(pair);
    out.push({a:f,b:n.feature,sideA,sideB,border:n.border});
   }
  }
  return out;
 }
 function syncFronts(){
  if(!frontLayer||!window.L)return;frontLayer.clearLayers();
  if(!frontsVisible)return;
  frontContacts().forEach(contact=>contact.border.forEach(line=>{
   const coords=[[line[0][1],line[0][0]],[line[1][1],line[1][0]]];
   frontLayer.addLayer(L.polyline(coords,{pane:'frontPane',color:'#f0a05b',weight:7,opacity:.24,lineCap:'round',className:'wc-frontline-pulse',interactive:false}));
   frontLayer.addLayer(L.polyline(coords,{pane:'frontPane',color:'#e65a4f',weight:2.8,opacity:.98,dashArray:'7 3',lineCap:'round',className:'wc-frontline-dash',interactive:false}));
  }));
 }
 function toggleFronts(){
  frontsVisible=!frontsVisible;state.frontsVisible=frontsVisible;
  document.getElementById('wc-front-toggle')?.classList.toggle('active',frontsVisible);
  syncFronts();save();
 }
 function regionAdmin(p){return admin(p)}
 function regionName(p){return name(p)}
 function regionKey(a,n){return key(a,n)}
 function unitOptions(){return armies().map(u=>'<option value="'+esc(u.id)+'" '+(u.id===selectedUnitId?'selected':'')+'>'+esc(u.name)+' · '+esc(u.type)+' · '+u.strength+' тыс.</option>').join('')}
 function warRoomHtml(){
  const targets=(countryMeta||[]).filter(x=>x.info.id!==state.selected).sort((a,b)=>a.info.name.localeCompare(b.info.name,'ru'));
  const warsList=wars().map(w=>{const [a,b]=String(w).split('|');return '<div class="wc-war-row"><b>⚔ '+esc((countries[a]||{}).name||a)+' — '+esc((countries[b]||{}).name||b)+'</b><small>Вооружённый конфликт · '+(a===state.selected||b===state.selected?'ваша страна участвует':'иностранный конфликт')+'</small></div>'}).join('');
  const troops=armies().map(u=>'<div class="wc-unit-row"><span class="wc-unit-flag">⚑</span><span><b>'+esc(u.name)+'</b><small>'+esc(u.type)+' · '+u.strength+' тыс. · '+esc(u.location||'Позиция не указана')+'</small></span><button class="wc-mini" data-select-unit="'+esc(u.id)+'">'+(u.id===selectedUnitId?'Выбрана':'Выбрать')+'</button></div>').join('')||'<p class="wc-muted">Дивизий пока нет. Сформируйте первое соединение.</p>';
  const occupiedCount=Object.values(occupied()).filter(x=>x.controller===state.selected).length;
  return '<div class="wc-war-room"><div class="wc-war-stats"><div><small>ВОЙНЫ</small><b>'+wars().length+'</b></div><div><small>СОЕДИНЕНИЯ</small><b>'+armies().length+'</b></div><div><small>ЗАНЯТЫЕ РЕГИОНЫ</small><b>'+occupiedCount+'</b></div></div>'+
   '<h3>Объявление войны</h3><p>Объявление войны открывает военные действия, но продвижение возможно только по соседним регионам.</p><div class="wc-war-form"><select id="wc-war-target"><option value="">Выберите противника</option>'+targets.map(x=>'<option value="'+esc(x.info.id)+'">'+esc(x.info.name)+'</option>').join('')+'</select><button class="wc-danger" id="wc-declare-war">Объявить войну</button></div>'+
   '<h3>Формирование войск</h3><div class="wc-war-form"><input id="wc-unit-name" maxlength="45" placeholder="Название соединения" value="1-я дивизия"><select id="wc-unit-type"><option value="Пехотная дивизия">Пехотная дивизия · 10 тыс. · ₽4 млрд</option><option value="Моторизованная дивизия">Моторизованная дивизия · 8 тыс. · ₽6 млрд</option><option value="Танковая дивизия">Танковая дивизия · 7 тыс. · ₽8 млрд</option><option value="Воздушно-десантная дивизия">ВДВ · 6 тыс. · ₽7 млрд</option></select><button class="wc-primary" id="wc-create-unit">Сформировать</button></div><p class="wc-muted">Дивизия размещается в регионе столицы. Один приказ на карте перемещает её в один соседний регион.</p>'+
   '<h3>Свободный приказ штабу</h3><p class="wc-muted">Пишите своими словами: «1-я танковая дивизия проводит учения в Смоленске» или «Перебросить корпус к границе и наступать на Вильнюс».</p><textarea id="wc-free-military-order" rows="4" maxlength="3000" placeholder="Текст приказа верховного командования…"></textarea><button class="wc-primary" id="wc-queue-military-order">Передать приказ на следующий ход</button>'+
   '<h3>Активные учения</h3>'+(exercises().filter(x=>x.status==='active').map(x=>'<div class="wc-unit-row"><span class="wc-unit-flag">✣</span><span><b>'+esc(x.name)+'</b><small>'+esc(x.unitName)+' · '+esc(x.exerciseType)+' · до хода '+x.endsTurn+'</small></span></div>').join('')||'<p class="wc-muted">Активных учений нет.</p>')+
   '<h3>Ваши соединения</h3>'+troops+'<h3>Текущие войны</h3>'+(warsList||'<p class="wc-muted">Ваша страна пока не участвует в войнах.</p>')+'</div>';
 }
 function bindWarRoom(){
  document.getElementById('wc-declare-war')?.addEventListener('click',()=>{
   const target=document.getElementById('wc-war-target')?.value;if(!target)return alert('Выберите государство.');
   if(wars().some(w=>w===warKey(state.selected,target)||w===warKey(target,state.selected)))return alert('Война с этим государством уже идёт.');
   wars().push(warKey(state.selected,target));closeModal();
   event('ВОЕННОЕ ДЕЛО','Объявлена война: '+((countries[target]||{}).name||target),'Правительство '+((countries[state.selected]||{}).name||state.selected)+' объявило состояние войны. Вооружённые силы приведены в готовность.',{importance:'major',background:'Дипломатические отношения между государствами перешли в фазу открытого вооружённого противостояния.',development:'Объявление войны вступило в силу. Военное командование получает право проводить операции против вооружённых сил противника.',consequences:'Начинается военная кампания. Продвижение войск будет ограничено соседними регионами и возможностями снабжения.',reaction:'Международная реакция будет отражаться в публичной хронике по мере развития конфликта.'});
   syncFronts();updateUI();save();openWarRoom();
  });
  document.getElementById('wc-create-unit')?.addEventListener('click',()=>{
   const type=document.getElementById('wc-unit-type')?.value||'Пехотная дивизия',unitName=document.getElementById('wc-unit-name')?.value.trim()||'Новая дивизия';
   const specs={'Пехотная дивизия':{cost:4,manpower:10,strength:10},'Моторизованная дивизия':{cost:6,manpower:8,strength:9},'Танковая дивизия':{cost:8,manpower:7,strength:12},'Воздушно-десантная дивизия':{cost:7,manpower:6,strength:8}};
   const spec=specs[type];if(state.treasury<spec.cost)return alert('Недостаточно средств в казне. Требуется ₽ '+spec.cost+' млрд.');
   if(state.manpower<spec.manpower)return alert('Недостаточно людских ресурсов. Требуется '+spec.manpower+' тыс.');
   state.treasury-=spec.cost;state.manpower-=spec.manpower;state.army=(Number(state.army)||0)+spec.manpower;
   const position=capitals[state.selected]||centerForCountry(state.selected),feature=initialRegion(state.selected,position);
   const unit={id:'DIV-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),name:unitName,type,strength:spec.strength,position:feature?center(feature):position,location:feature?name(feature.properties||{}):'Район столицы',regionKey:feature?fkey(feature):null,createdTurn:state.turn};
   armies().push(unit);selectedUnitId=unit.id;
   event('ВОЕННОЕ ДЕЛО','Сформировано соединение: '+unitName,type+'. Численность: '+spec.manpower+' тыс. военнослужащих. Соединение размещено в '+unit.location+'.',{importance:'normal',background:'Правительство утвердило формирование нового воинского соединения и выделило средства из государственного бюджета.',development:'Личный состав укомплектован, соединение получило первоначальную организационную структуру и размещено в стартовом регионе.',consequences:'Военная мощь государства увеличилась. Соединение доступно для передислокации по соседним регионам.',reaction:'Формирование отражено в открытой военной хронике.'});
   updateUI();syncUnits();save();openWarRoom();
  });
  document.querySelectorAll('[data-select-unit]').forEach(b=>b.onclick=()=>{selectedUnitId=b.dataset.selectUnit;syncUnits();openWarRoom()});
  document.getElementById('wc-queue-military-order')?.addEventListener('click',()=>{
   const input=document.getElementById('wc-free-military-order'),value=input?.value.trim();
   if(!value)return alert('Напишите приказ для штаба.');
   if(!window.WC_QUEUE_ORDER?.(value))return;
   closeModal();alert('Приказ передан в очередь. Нажмите «Продолжить время», чтобы штаб обработал его.');
  });
 }
 function openWarRoom(){modal('Военное командование',warRoomHtml());bindWarRoom()}
 function canEnter(unit,feature){
  const from=unitRegion(unit);if(!from)return false;
  return adjacent(from).some(x=>fkey(x.feature)===fkey(feature));
 }
 function unitRegion(unit){if(!featureByKey.size)rebuildIndex();return unitRegionCached(unit)}
 function unitRegionCached(unit){
  if(unit.regionKey&&featureByKey.has(unit.regionKey))return featureByKey.get(unit.regionKey);
  const f=initialRegion(state.selected,unit.position||[0,0]);if(f){unit.regionKey=fkey(f);unit.location=name(f.properties||{})}return f;
 }
 function animateUnit(unit,from,to,feature,capture=false){
  if(!window.L||!map||!Array.isArray(from)||!Array.isArray(to)){syncUnits();return}
  const marker=L.marker(from,{pane:'unitsPane',interactive:false,icon:L.divIcon({className:'wc-army-marker wc-army-moving',html:'<span>⚑</span><small>'+esc(unit.name)+'</small>',iconSize:[34,34],iconAnchor:[17,17]})}).addTo(map);
  const started=performance.now(),duration=1050;
  const tick=now=>{
   const t=Math.min(1,(now-started)/duration),ease=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
   marker.setLatLng([from[0]+(to[0]-from[0])*ease,from[1]+(to[1]-from[1])*ease]);
   if(t<1)requestAnimationFrame(tick);
   else{map.removeLayer(marker);syncUnits();if(capture)flashCapture(feature)}
  };
  requestAnimationFrame(tick);
 }
 function animateBattle(feature,won){
  if(!window.L||!map||!feature)return;
  const point=center(feature),ring=L.circleMarker(point,{pane:'unitsPane',radius:7,color:won?'#f4d58d':'#e56b61',weight:3,opacity:.95,fillColor:won?'#e5b85e':'#b83f3a',fillOpacity:.22,interactive:false}).addTo(map);
  const started=performance.now(),duration=1150;
  const tick=now=>{
   const t=Math.min(1,(now-started)/duration),wave=Math.sin(t*Math.PI);
   ring.setRadius(7+wave*25);ring.setStyle({opacity:1-t,fillOpacity:.28*(1-t),weight:3+wave*2});
   if(t<1)requestAnimationFrame(tick);else map.removeLayer(ring);
  };
  requestAnimationFrame(tick);
 }
 function friendlyPath(start,target){
  const startKey=fkey(start),targetKey=fkey(target);if(startKey===targetKey)return [];
  const queue=[start],previous=new Map([[startKey,null]]),nodes=new Map([[startKey,start]]);
  let found=false,visited=0;
  while(queue.length&&visited<1800&&!found){
   const current=queue.shift();visited++;
   for(const n of adjacent(current)){
    const next=n.feature,k=fkey(next);
    if(previous.has(k)||controller(next)!==state.selected)continue;
    previous.set(k,fkey(current));nodes.set(k,next);
    if(k===targetKey){found=true;break}
    queue.push(next);
   }
  }
  if(!found)return null;
  const path=[];let cursor=targetKey;
  while(cursor&&cursor!==startKey){path.unshift(nodes.get(cursor));cursor=previous.get(cursor)}
  return path;
 }
 function animateRoute(unit,features,fromPosition){
  if(!window.L||!map||!features?.length){syncUnits();return}
  const points=features.map(center),start=Array.isArray(fromPosition)?fromPosition.slice():points[0];
  points.unshift(start);
  if(points.length<2){syncUnits();return}
  const marker=L.marker(points[0],{pane:'unitsPane',interactive:false,icon:L.divIcon({className:'wc-army-marker wc-army-moving',html:'<span>⚑</span><small>'+esc(unit.name)+'</small>',iconSize:[34,34],iconAnchor:[17,17]})}).addTo(map);
  const duration=Math.min(2400,Math.max(700,(points.length-1)*420)),started=performance.now(),segments=points.length-1;
  const tick=now=>{
   const t=Math.min(1,(now-started)/duration),scaled=t*segments,index=Math.min(segments-1,Math.floor(scaled)),part=t>=1?1:scaled-index,ease=part<.5?2*part*part:1-Math.pow(-2*part+2,2)/2;
   const a=points[index],b=points[index+1];marker.setLatLng([a[0]+(b[0]-a[0])*ease,a[1]+(b[1]-a[1])*ease]);
   if(t<1)requestAnimationFrame(tick);else{map.removeLayer(marker);syncUnits()}
  };
  requestAnimationFrame(tick);
 }
 function flashCapture(feature){
  if(!window.L||!map||!feature)return;
  const pulse=L.geoJSON(feature,{interactive:false,style:{color:'#f4d58d',weight:3,opacity:0,fillColor:'#e8b75d',fillOpacity:.05,className:'wc-capture-flash'}}).addTo(map);
  const start=performance.now(),duration=1500;
  const tick=now=>{
   const t=Math.min(1,(now-start)/duration),wave=Math.sin(t*Math.PI);
   pulse.setStyle({color:'#ffe5a6',weight:2+wave*5,opacity:wave*.95,fillColor:'#e8b75d',fillOpacity:.06+wave*.42});
   if(t<1)requestAnimationFrame(tick);else{map.removeLayer(pulse);if(regionLayer)regionLayer.setStyle(styleRegion)}
  };
  requestAnimationFrame(tick);
 }
 function moveUnit(unit,feature){
  if(!canEnter(unit,feature))return alert('Нельзя переместить соединение напрямую. Целевой регион должен граничить с текущей позицией дивизии.');
  const p=feature.properties||{},adminId=admin(p),controllerId=controller(feature);
  if(controllerId!==state.selected)return alert('Для перехода во вражеский регион требуется атака и состояние войны.');
  const previous=Array.isArray(unit.position)?unit.position.slice():center(unitRegion(unit));unit.regionKey=fkey(feature);unit.position=center(feature);unit.location=name(p);
  event('ВОЕННОЕ ДЕЛО','Передислокация: '+unit.name,'Соединение передислоцировано на один соседний регион: '+unit.location+'.',{location:unit.location});
  animateUnit(unit,previous,unit.position,feature,false);save();closeModal();
 }
 function attackRegion(unit,enemyAdmin,feature){
  if(!atWar(state.selected,enemyAdmin))return alert('Сначала объявите войну государству '+((countries[enemyAdmin]||{}).name||enemyAdmin)+'.');
  if(!canEnter(unit,feature))return alert('Регион не граничит с текущей позицией дивизии. Наступление через несоседнюю территорию невозможно.');
  const p=feature.properties||{},regionNameValue=name(p),targetKey=fkey(feature),defense=6+Math.floor(Math.random()*7),attack=unit.strength+Math.floor(Math.random()*8);
  const won=attack>=defense+5||Math.random()<Math.max(.18,Math.min(.88,.38+(unit.strength-defense)*.045));
  let previous=null;
  if(won){
   previous=Array.isArray(unit.position)?unit.position.slice():center(unitRegion(unit));
   occupied()[targetKey]={admin:admin(p),name:regionNameValue,controller:state.selected,turn:state.turn};
   unit.regionKey=targetKey;unit.position=center(feature);unit.location=regionNameValue;unit.strength=Math.max(1,unit.strength-1);
   event('ВОЕННОЕ ДЕЛО','Захвачен регион: '+regionNameValue,'Войска заняли регион «'+regionNameValue+'», ранее находившийся под контролем государства '+((countries[enemyAdmin]||{}).name||enemyAdmin)+'.',{importance:'major',location:regionNameValue,background:'В рамках продолжающейся войны командование начало наступательную операцию на сопредельном участке фронта.',development:'Соединение '+unit.name+' продвинулось из соседнего региона, преодолело сопротивление и установило контроль над административной территорией. Линия соприкосновения переместилась на новый рубеж.',consequences:'Регион перешёл под военный контроль '+((countries[state.selected]||{}).name||state.selected)+'. Дальнейшее продвижение возможно только в соседние регионы.',reaction:'Сведения о реакции иностранных государств появятся в хронике по мере поступления публичных заявлений.'});
  }else{
   unit.strength=Math.max(0,unit.strength-2);
   event('ВОЕННОЕ ДЕЛО','Наступление остановлено: '+regionNameValue,'Соединение '+unit.name+' не смогло занять регион. Оборона противника удержала позиции, атакующая часть понесла потери.',{importance:'major',location:regionNameValue,background:'Вооружённые силы предприняли попытку наступления на сопредельный участок обороны противника.',development:'Обороняющиеся войска удержали рубежи. Атакующее соединение понесло потери и было вынуждено отойти на исходные позиции.',consequences:'Регион остаётся под контролем '+((countries[enemyAdmin]||{}).name||enemyAdmin)+'. Боеспособность соединения снижена.',reaction:'Операция отражена в военной хронике.'});
   if(unit.strength===0){state.armies=armies().filter(x=>x.id!==unit.id);selectedUnitId=null;event('ВОЕННОЕ ДЕЛО','Соединение утратило боеспособность','Остатки личного состава выведены из строя, соединение больше не может участвовать в операциях.');}
  }
  if(won){animateBattle(feature,true);animateUnit(unit,previous,unit.position,feature,true)}else{syncUnits();animateBattle(feature,false)}updateUI();save();closeModal();if(regionLayer)regionLayer.setStyle(styleRegion);return won;
 }
 function styleRegion(feature){
  const p=feature.properties||{},adminId=admin(p),occ=occupied()[fkey(feature)],ctrl=occ?.controller||adminId;
  const z=map?.getZoom?.()||2;return{color:occ?'#f2cf83':z<3?'#aebdca':'#dce4ed',weight:occ?1.35:z<3?.35:z<5?.65:.95,opacity:occ?.98:z<3?.35:.72,fillColor:occ?(ctrl===state.selected?'#b84b42':'#a98a55'):'#dce4ed',fillOpacity:occ?.5:.025};
 }
 function openRegion(feature){
  if(!featureByKey.size)rebuildIndex();
  const p=feature.properties||{},adminId=admin(p),regionNameValue=name(p),occ=occupied()[fkey(feature)],ctrl=occ?.controller||adminId,own=ctrl===state.selected,foreign=!!ctrl&&!own,war=foreign&&atWar(state.selected,ctrl),ownerName=(countries[adminId]||{}).name||adminId||'Не определено',controllerName=(countries[ctrl]||{}).name||ctrl||ownerName,unit=armies().find(x=>x.id===selectedUnitId);
  const adjacentToUnit=unit?canEnter(unit,feature):false;
  let actions='';
  if(own){
   actions='<p class="wc-muted">Регион находится под вашим контролем.</p>'+(unit&&!adjacentToUnit?'<p class="wc-muted">Выбранная дивизия не имеет прямого сухопутного доступа к этому региону.</p>':'')+(armies().length?'<select id="wc-region-unit">'+unitOptions()+'</select><button class="wc-primary wc-region-action" id="wc-move-unit">Передислоцировать из соседнего региона</button>':'');
  }else if(foreign){
   actions=war?'<p class="wc-muted">Идёт война. Наступление разрешено только из непосредственно соседнего региона.</p>'+(armies().length?'<select id="wc-region-unit">'+unitOptions()+'</select><button class="wc-danger wc-region-action" id="wc-attack-region">Атаковать соседний регион</button>':'<p class="wc-muted">Сначала сформируйте дивизию в военном командовании.</p>'):'<p class="wc-muted">Регион находится под контролем другого государства.</p><button class="wc-danger wc-region-action" id="wc-region-declare">Объявить войну '+esc(controllerName)+'</button>';
  }
  const controlName=(countries[ctrl]||{}).name||ctrl;
  modal('Регион · '+regionNameValue,'<div class="wc-region-card"><div class="wc-region-owner"><span>◈</span><div><small>АДМИНИСТРАТИВНАЯ ПРИНАДЛЕЖНОСТЬ</small><b>'+esc(ownerName)+'</b></div></div><div class="wc-region-facts"><div><small>РЕГИОН</small><b>'+esc(regionNameValue)+'</b></div><div><small>ВОЕННЫЙ КОНТРОЛЬ</small><b>'+esc(controlName)+'</b></div></div>'+actions+'</div>');
  document.getElementById('wc-region-declare')?.addEventListener('click',()=>{if(!atWar(state.selected,ctrl)){wars().push(warKey(state.selected,ctrl));closeModal();event('ВОЕННОЕ ДЕЛО','Объявлена война: '+controllerName,'Правительство объявило войну государству '+controllerName+'.',{importance:'major',background:'Дипломатический кризис перешёл в открытое вооружённое противостояние.',development:'Вооружённые силы приведены в боевую готовность. Начинается военная кампания.',consequences:'Военные операции против государства '+ownerName+' теперь доступны при наличии сопредельных позиций.',reaction:'Международная реакция будет отражена в мировой хронике.'});save();}closeModal()});
  document.getElementById('wc-move-unit')?.addEventListener('click',()=>{const id=document.getElementById('wc-region-unit')?.value||selectedUnitId,u=armies().find(x=>x.id===id);if(!u)return alert('Выберите соединение.');selectedUnitId=id;moveUnit(u,feature)});
  document.getElementById('wc-attack-region')?.addEventListener('click',()=>{const id=document.getElementById('wc-region-unit')?.value||selectedUnitId,u=armies().find(x=>x.id===id);if(!u)return alert('Выберите соединение.');selectedUnitId=id;attackRegion(u,ctrl,feature)});
 }
 function bindRegionLayer(){
  if(!regionLayer||!window.L)return;
  const attach=layer=>{
   if(!layer||layer.__wcWarBound||!layer.feature)return;layer.__wcWarBound=true;
   layer.on('click',evt=>{if(evt.originalEvent)L.DomEvent.stopPropagation(evt.originalEvent);openRegion(layer.feature)});
  };
  regionLayer.eachLayer(attach);regionLayer.on('layeradd',e=>attach(e.layer));regionLayer.setStyle(styleRegion);
 }
 function advanceTurn(){
  let changed=false;
  exercises().forEach(ex=>{if(ex.status==='active'&&Number(state.turn||0)>=Number(ex.endsTurn||0)){
   ex.status='completed';changed=true;
   const unit=armies().find(u=>u.id===ex.unitId);if(unit)unit.strength=Math.min(20,Number(unit.strength||0)+1);
   event('ВОЕННОЕ ДЕЛО','Завершены учения: '+ex.name,(unit?.name||ex.unitName)+' завершил программу «'+ex.exerciseType+'». Подготовка соединения улучшена.',{importance:'normal',location:ex.regionKey});
  }});
  if(changed){syncUnits();save()}
 }
 function init(){
  if(!map||!window.L)return;
  ensureLayers();bindRegionLayer();rebuildIndex();syncUnits();
  document.getElementById('wc-war-room-btn')?.addEventListener('click',openWarRoom);
  document.getElementById('pax-own-country')?.addEventListener('click',()=>syncUnits());
  window.addEventListener('wc-regions-loaded',()=>{adjacencyCache.clear();rebuildIndex();bindRegionLayer();armies().forEach(u=>unitRegion(u));syncUnits()});
  document.getElementById('wc-front-toggle')?.classList.toggle('active',frontsVisible);
  function frontSnapshot(){return frontContacts().map(x=>({heldRegion:name(x.a.properties||{}),heldBy:x.sideA,enemyRegion:name(x.b.properties||{}),enemyCountry:x.sideB})).slice(0,100)}
  function commandSnapshot(){
   if(!featureByKey.size)rebuildIndex();
   const own=regionFeatures().filter(f=>admin(f.properties||{})===state.selected);
   const relevant=new Map(),addRegion=f=>{if(f)relevant.set(fkey(f),f)};
   armies().forEach(u=>{const f=unitRegion(u);if(f){addRegion(f);adjacent(f).forEach(n=>addRegion(n.feature))}});
   const capital=initialRegion(state.selected,capitals[state.selected]||centerForCountry(state.selected));addRegion(capital);
   own.forEach(addRegion);
   const regions=Array.from(relevant.values()).slice(0,120).map(f=>({key:fkey(f),name:name(f.properties||{}),countryId:admin(f.properties||{}),controller:controller(f)}));
   return {date:dateText(),player:{id:state.selected,name:(countries[state.selected]||{}).name||state.selected},treasury:state.treasury,manpower:state.manpower,army:state.army,wars:wars().slice(),armies:armies().map(u=>({id:u.id,name:u.name,type:u.type,strength:u.strength,location:u.location,regionKey:unitRegion(u)?u.regionKey:null})),units:armies().map(u=>({id:u.id,name:u.name,type:u.type,strength:u.strength,location:u.location,regionKey:unitRegion(u)?u.regionKey:null})),exercises:exercises().filter(x=>x.status==='active'),regions,countries:(countryMeta||[]).map(x=>({id:x.info.id,name:x.info.name}))};
  }
  function executeOrders(operations){
   const results=[],specs={'Пехотная дивизия':{cost:4,manpower:10,strength:10},'Моторизованная дивизия':{cost:6,manpower:8,strength:9},'Танковая дивизия':{cost:8,manpower:7,strength:12},'Воздушно-десантная дивизия':{cost:7,manpower:6,strength:8}};
   (Array.isArray(operations)?operations:[]).slice(0,8).forEach(op=>{
    try{
     if(op.type==='recruit'){
      const spec=specs[op.unitType];if(!spec){results.push('Отклонено формирование: неизвестный тип соединения.');return}
      if(state.treasury<spec.cost||state.manpower<spec.manpower){results.push('Не удалось сформировать '+op.unitType+': недостаточно казны или людских ресурсов.');return}
      state.treasury-=spec.cost;state.manpower-=spec.manpower;state.army=(Number(state.army)||0)+spec.manpower;
      const position=capitals[state.selected]||centerForCountry(state.selected),feature=initialRegion(state.selected,position),unit={id:'DIV-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),name:String(op.name||'Новое соединение').slice(0,45),type:op.unitType,strength:spec.strength,position:feature?center(feature):position,location:feature?name(feature.properties||{}):'Район столицы',regionKey:feature?fkey(feature):null,createdTurn:state.turn};
      armies().push(unit);selectedUnitId=unit.id;results.push('Сформировано '+unit.name+' ('+unit.type+'), '+spec.manpower+' тыс.; размещение: '+unit.location+'.');
      event('ВОЕННОЕ ДЕЛО','Сформировано соединение: '+unit.name,'По приказу верховного командования сформировано соединение '+unit.type+'. Численность — '+spec.manpower+' тыс. военнослужащих; место дислокации — '+unit.location+'.',{importance:'normal',location:unit.location});
     }else if(op.type==='exercise'){
       const unit=armies().find(u=>u.id===op.unitId),feature=featureByKey.get(op.targetRegionKey);
       if(!unit||!feature){results.push('Учения не назначены: соединение или регион не найден.');return}
       if(controller(feature)!==state.selected){results.push('Учения отклонены: район не находится под вашим контролем.');return}
       const duration=Math.max(1,Math.min(4,Number(op.durationTurns)||1)),exercise={id:'EX-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5),name:String(op.name||'Тактические учения').slice(0,80),exerciseType:op.exerciseType||'манёвры',unitId:unit.id,unitName:unit.name,regionKey:fkey(feature),position:center(feature),startedTurn:Number(state.turn||1),endsTurn:Number(state.turn||1)+duration,status:'active'};
       exercises().push(exercise);results.push('Назначены учения «'+exercise.name+'» для '+unit.name+' в районе '+name(feature.properties||{})+' на '+duration+' ход(а).');
       event('ВОЕННОЕ ДЕЛО','Начались военные учения: '+exercise.name,unit.name+' проводит '+exercise.exerciseType+' в районе '+name(feature.properties||{})+'. Продолжительность — '+duration+' ход(а).',{importance:'normal',location:name(feature.properties||{})});
       syncUnits();
      }else if(op.type==='move'||op.type==='attack'){
      const unit=armies().find(u=>u.id===op.unitId),feature=featureByKey.get(op.targetRegionKey);if(!unit||!feature){results.push('Операция отклонена: соединение или регион не найден.');return}
      const ctrl=controller(feature),from=unitRegion(unit);
      if(!from){results.push('Операция отклонена: не удалось определить исходный регион '+unit.name+'.');return}
      if(op.type==='move'){
       if(ctrl!==state.selected){results.push('Передислокация отменена: регион не находится под вашим контролем.');return}
       const path=friendlyPath(from,feature);if(!path){results.push('Передислокация отменена: безопасный сухопутный маршрут через контролируемые регионы не найден.');return}
       const prev=Array.isArray(unit.position)?unit.position.slice():center(from);unit.regionKey=fkey(feature);unit.position=center(feature);unit.location=name(feature.properties||{});animateRoute(unit,[from,...path],prev);
       results.push(unit.name+' передислоцировано в '+unit.location+' по маршруту из '+path.length+' регионов.');event('ВОЕННОЕ ДЕЛО','Передислокация: '+unit.name,'Соединение прошло по безопасному сухопутному маршруту и прибыло в регион '+unit.location+'.',{location:unit.location});
      }else{
       if(!adjacent(from).some(x=>fkey(x.feature)===fkey(feature))){results.push('Наступление отменено: цель не граничит с текущей позицией соединения.');return}
       if(!atWar(state.selected,ctrl)){results.push('Наступление отменено: с государством-контролёром региона не объявлена война.');return}
       const won=attackRegion(unit,ctrl,feature);results.push(won?'Захвачен регион '+name(feature.properties||{})+' силами '+unit.name+'.':'Наступление '+name(feature.properties||{})+' остановлено обороной противника.');
      }
     }else if(op.type==='declare_war'){
      const target=op.targetCountryId;if(!target||target===state.selected){results.push('Объявление войны отклонено: некорректная цель.');return}
      if(atWar(state.selected,target)){results.push('Война с '+target+' уже продолжается.');return}
      wars().push(warKey(state.selected,target));results.push('Объявлена война государству '+((countries[target]||{}).name||target)+'.');event('ВОЕННОЕ ДЕЛО','Объявлена война: '+((countries[target]||{}).name||target),'По распоряжению главы государства объявлено состояние войны. Вооружённые силы приведены в готовность.',{importance:'major'});
     }else if(op.type==='diplomacy'){
      const target=op.targetCountryId,label=(countries[target]||{}).name||target;
      if(op.action==='improve'){state.relations[target]=Math.min(100,Number(state.relations[target]||0)+8);results.push('Дипломатическая инициатива в отношении '+label+': отношение улучшено.');event('ДИПЛОМАТИЯ','Направлена дипломатическая инициатива: '+label,'Правительство распорядилось предпринять публичные шаги для улучшения двусторонних отношений.');}
      else if(op.action==='sanctions'){state.relations[target]=Math.max(-100,Number(state.relations[target]||0)-8);results.push('Введены ограничительные меры в отношении '+label+'.');event('ДИПЛОМАТИЯ','Объявлены ограничительные меры: '+label,'Правительство объявило о введении ограничительных мер в отношении государства '+label+'.',{importance:'major'});}
      else if(op.action==='treaty'){const pair=warKey(state.selected,target);if(!state.treaties.includes(pair))state.treaties.push(pair);results.push('Подготовлено и зарегистрировано соглашение о сотрудничестве с '+label+'.');event('ДИПЛОМАТИЯ','Заключено соглашение о сотрудничестве','Правительства '+((countries[state.selected]||{}).name||state.selected)+' и '+label+' оформили двустороннее соглашение.',{importance:'major'});}
     }else if(op.type==='mobilize'){
      const amount=Math.max(1,Math.min(25,Number(op.amount)||5)),cost=Math.ceil(amount*.7),before=Number(state.manpower||0),added=Math.min(amount,100-before);
      if(state.treasury<cost){results.push('Мобилизация не проведена: недостаточно средств на её организацию.');return}
      if(added<=0){results.push('Мобилизационный резерв уже достиг условного предела.');return}
      state.treasury-=cost;state.manpower=before+added;
      results.push('Проведены мобилизационные мероприятия: резерв людских ресурсов увеличен на '+added+' условных тыс.');event('ВОЕННОЕ ДЕЛО','Объявлены мобилизационные мероприятия','Правительство направило средства на развёртывание мобилизационного резерва.',{importance:'major'});
     }else if(op.type==='policy'){
      const scale=op.scale===2?2:1,policies={industry:{cost:8,title:'Программа промышленного развития',effect:()=>{state.gdp+=3*scale;state.stability=Math.max(0,state.stability-1)}},infrastructure:{cost:7,title:'Инфраструктурная программа',effect:()=>{state.gdp+=2*scale;state.prestige+=2*scale}},social:{cost:8,title:'Программа социальной поддержки',effect:()=>{state.stability+=3*scale;state.gdp=Math.max(1,state.gdp-1)}},military:{cost:10,title:'Увеличение военных расходов',effect:()=>{state.army+=3*scale;state.stability=Math.max(0,state.stability-1)}},stability:{cost:6,title:'Программа общественной стабильности',effect:()=>{state.stability+=2*scale;state.prestige+=1*scale}},education:{cost:6,title:'Национальная программа образования',effect:()=>{state.gdp+=scale;state.stability+=scale;state.prestige+=2*scale}},healthcare:{cost:6,title:'Программа развития здравоохранения',effect:()=>{state.stability+=2*scale;state.gdp+=scale}},agriculture:{cost:7,title:'Программа поддержки сельского хозяйства',effect:()=>{state.gdp+=2*scale;state.stability+=scale}},tax_reform:{cost:5,title:'Налоговая реформа',effect:()=>{state.gdp+=2*scale;state.stability+=scale}},trade:{cost:5,title:'Программа внешней торговли',effect:()=>{state.gdp+=2*scale;state.prestige+=scale}},public_order:{cost:5,title:'Программа общественного порядка',effect:()=>{state.stability+=3*scale;state.prestige=Math.max(0,state.prestige-scale)}}},cfg=policies[op.policy];
      if(!cfg||state.treasury<cfg.cost*scale){results.push('Государственная программа отклонена: недостаточно средств.');return}
      state.treasury-=cfg.cost*scale;cfg.effect();state.stability=Math.min(100,state.stability);state.prestige=Math.min(100,state.prestige);state.laws=Array.isArray(state.laws)?state.laws:[];state.laws.unshift(cfg.title);state.laws=state.laws.slice(0,60);results.push('Начата государственная программа: '+cfg.title+'.');event('ГОСУДАРСТВО',cfg.title,'По приказу правительства выделено ₽ '+cfg.cost*scale+' млрд. Программа включена в государственный план.',{importance:'normal'});
     }else if(op.type==='disband'){
      const unit=armies().find(u=>u.id===op.unitId);if(!unit){results.push('Расформирование отклонено: соединение не найдено.');return}
      state.armies=armies().filter(x=>x.id!==unit.id);results.push('Расформировано соединение '+unit.name+'.');event('ВОЕННОЕ ДЕЛО','Расформировано соединение: '+unit.name,'Военное командование вывело соединение из состава вооружённых сил.');
     }
    }catch(err){results.push('Операция не выполнена: '+String(err.message||err).slice(0,180))}
   });
   syncUnits();updateUI();save();return results;
  }
  window.WC_WAR={open:openWarRoom,sync:syncUnits,selected:()=>selectedUnitId,toggleFronts,frontSnapshot,snapshot:()=>armies().map(u=>({id:u.id,name:u.name,regionKey:u.regionKey,strength:u.strength,location:u.location})),commandSnapshot,executeOrders,advanceTurn};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
