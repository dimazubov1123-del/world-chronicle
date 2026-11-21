/* WORLD CHRONICLE — operational warfare layer */
(function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const warKey=(a,b)=>String(a)+'|'+String(b);
 const hasWar=(target)=>((state.wars||[]).some(w=>w===warKey(state.selected,target)||w===warKey(target,state.selected)));
 const armies=()=>state.armies||(state.armies=[]);
 const occupied=()=>state.occupiedRegions||(state.occupiedRegions={});
 let selectedUnitId=null,unitLayer=null;
 const capitals={
  Russia:[55.7558,37.6173],'United States of America':[38.9072,-77.0369],China:[39.9042,116.4074],Germany:[52.52,13.405],France:[48.8566,2.3522],'United Kingdom':[51.5072,-.1276],Japan:[35.6762,139.6503],Brazil:[-15.7939,-47.8828],India:[28.6139,77.209],Italy:[41.9028,12.4964],Canada:[45.4215,-75.6972],Mexico:[19.4326,-99.1332],Ukraine:[50.4501,30.5234],Poland:[52.2297,21.0122],Turkey:[39.9334,32.8597],Iran:[35.6892,51.389],Spain:[40.4168,-3.7038],Australia:[-35.2809,149.13],Egypt:[30.0444,31.2357],'South Korea':[37.5665,126.978]
 };
 function centerForCountry(id){
  if(capitals[id])return capitals[id];
  const item=(countryMeta||[]).find(x=>x.info.id===id);
  if(item?.bounds?.isValid())return [item.bounds.getCenter().lat,item.bounds.getCenter().lng];
  return [24,12];
 }
 function centerForFeature(feature){
  try{const b=L.geoJSON(feature).getBounds();if(b.isValid())return [b.getCenter().lat,b.getCenter().lng]}catch(e){}
  return centerForCountry(state.selected);
 }
 function ensureLayer(){
  if(!map||unitLayer)return;
  map.createPane('unitsPane');map.getPane('unitsPane').style.zIndex=490;
  unitLayer=L.layerGroup([], {pane:'unitsPane'}).addTo(map);
 }
 function syncUnits(){
  if(!map||!window.L)return;ensureLayer();unitLayer.clearLayers();
  armies().forEach(u=>{
   if(!Array.isArray(u.position)||u.position.length!==2)return;
   const marker=L.marker(u.position,{pane:'unitsPane',icon:L.divIcon({className:'wc-army-marker '+(u.id===selectedUnitId?'selected':''),html:'<span>⚑</span><small>'+esc(u.name)+'</small>',iconSize:[34,34],iconAnchor:[17,17]})});
   marker.bindTooltip(esc(u.name)+' · '+u.type+' · '+u.strength+' тыс.',{direction:'top',className:'wc-army-tooltip'});
   marker.on('click',()=>{selectedUnitId=u.id;syncUnits();openWarRoom()});
   unitLayer.addLayer(marker);
  });
 }
 function regionAdmin(p){return String(p.admin||p.ADMIN||p.sovereignt||p.geonunit||'').trim()}
 function regionName(p){return String(p.name||p.name_en||p.NAME||p.name_alt||'Регион').trim()}
 function regionKey(admin,name){return admin+'::'+name}
 function unitOptions(){return armies().map(u=>'<option value="'+esc(u.id)+'" '+(u.id===selectedUnitId?'selected':'')+'>'+esc(u.name)+' · '+esc(u.type)+' · '+u.strength+' тыс.</option>').join('')}
 function warRoomHtml(){
  const targets=(countryMeta||[]).filter(x=>x.info.id!==state.selected).sort((a,b)=>a.info.name.localeCompare(b.info.name,'ru'));
  const wars=(state.wars||[]).map(w=>{const [a,b]=String(w).split('|');return '<div class="wc-war-row"><b>⚔ '+esc((countries[a]||{}).name||a)+' — '+esc((countries[b]||{}).name||b)+'</b><small>Вооружённый конфликт · '+(a===state.selected||b===state.selected?'ваша страна участвует':'иностранный конфликт')+'</small></div>'}).join('');
  const troops=armies().map(u=>'<div class="wc-unit-row"><span class="wc-unit-flag">⚑</span><span><b>'+esc(u.name)+'</b><small>'+esc(u.type)+' · '+u.strength+' тыс. · '+esc(u.location||'Позиция не указана')+'</small></span><button class="wc-mini" data-select-unit="'+esc(u.id)+'">'+(u.id===selectedUnitId?'Выбрана':'Выбрать')+'</button></div>').join('')||'<p class="wc-muted">Дивизий пока нет. Сформируйте первое соединение.</p>';
  return '<div class="wc-war-room">'+
   '<div class="wc-war-stats"><div><small>ВОЙНЫ</small><b>'+(state.wars||[]).length+'</b></div><div><small>СОЕДИНЕНИЯ</small><b>'+armies().length+'</b></div><div><small>ЗАНЯТЫЕ РЕГИОНЫ</small><b>'+Object.values(occupied()).filter(x=>x.controller===state.selected).length+'</b></div></div>'+
   '<h3>Объявление войны</h3><p>Выберите государство. Война начнётся немедленно и будет отражена в мировой хронике.</p><div class="wc-war-form"><select id="wc-war-target"><option value="">Выберите противника</option>'+targets.map(x=>'<option value="'+esc(x.info.id)+'">'+esc(x.info.name)+'</option>').join('')+'</select><button class="wc-danger" id="wc-declare-war">Объявить войну</button></div>'+
   '<h3>Формирование войск</h3><div class="wc-war-form"><input id="wc-unit-name" maxlength="45" placeholder="Название соединения" value="1-я дивизия"><select id="wc-unit-type"><option value="Пехотная дивизия">Пехотная дивизия · 10 тыс. · ₽4 млрд</option><option value="Моторизованная дивизия">Моторизованная дивизия · 8 тыс. · ₽6 млрд</option><option value="Танковая дивизия">Танковая дивизия · 7 тыс. · ₽8 млрд</option><option value="Воздушно-десантная дивизия">ВДВ · 6 тыс. · ₽7 млрд</option></select><button class="wc-primary" id="wc-create-unit">Сформировать</button></div><p class="wc-muted">Дивизии появляются на карте у столицы. Для атаки выберите соединение, затем нажмите на регион противника.</p>'+
   '<h3>Ваши соединения</h3>'+troops+
   '<h3>Текущие войны</h3>'+(wars||'<p class="wc-muted">Ваша страна пока не участвует в войнах.</p>')+
   '</div>';
 }
 function bindWarRoom(){
  document.getElementById('wc-declare-war')?.addEventListener('click',()=>{
   const target=document.getElementById('wc-war-target')?.value;if(!target)return alert('Выберите государство.');
   if(hasWar(target))return alert('Война с этим государством уже идёт.');
   state.wars.push(warKey(state.selected,target));
   event('ВОЕННОЕ ДЕЛО','Объявлена война: '+((countries[target]||{}).name||target),'Правительство '+((countries[state.selected]||{}).name||state.selected)+' объявило состояние войны. Вооружённые силы приведены в готовность.',{importance:'major',background:'Дипломатические отношения между государствами перешли в фазу открытого вооружённого противостояния.',development:'Объявление войны вступило в силу. Военное командование получает право проводить операции против вооружённых сил противника.',consequences:'Начинается военная кампания. Исход конфликта будет зависеть от действий игрока, состава войск и контроля над регионами.',reaction:'Международная реакция будет отражаться в публичной хронике по мере развития конфликта.'});
   updateUI();save();openWarRoom();
  });
  document.getElementById('wc-create-unit')?.addEventListener('click',()=>{
   const type=document.getElementById('wc-unit-type')?.value||'Пехотная дивизия',name=document.getElementById('wc-unit-name')?.value.trim()||'Новая дивизия';
   const specs={'Пехотная дивизия':{cost:4,manpower:10,strength:10},'Моторизованная дивизия':{cost:6,manpower:8,strength:9},'Танковая дивизия':{cost:8,manpower:7,strength:12},'Воздушно-десантная дивизия':{cost:7,manpower:6,strength:8}};
   const s=specs[type];if(state.treasury<s.cost)return alert('Недостаточно средств в казне. Требуется ₽ '+s.cost+' млрд.');
   if(state.manpower<s.manpower)return alert('Недостаточно людских ресурсов. Требуется '+s.manpower+' тыс.');
   state.treasury-=s.cost;state.manpower-=s.manpower;state.army=(Number(state.army)||0)+s.manpower;
   const unit={id:'DIV-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),name,type,strength:s.strength,position:centerForCountry(state.selected),location:'Район столицы',createdTurn:state.turn};
   armies().push(unit);selectedUnitId=unit.id;
   event('ВОЕННОЕ ДЕЛО','Сформировано соединение: '+name,type+'. Численность: '+s.manpower+' тыс. военнослужащих. Соединение размещено на карте у столицы.',{importance:'major',background:'Правительство утвердило формирование нового воинского соединения и выделило средства из государственного бюджета.',development:'Личный состав укомплектован, соединение получило первоначальную организационную структуру и размещено в районе столицы.',consequences:'Военная мощь государства увеличилась. Соединение доступно для передислокации и участия в боевых операциях.',reaction:'Формирование отражено в открытой военной хронике.'});
   updateUI();syncUnits();save();openWarRoom();
  });
  document.querySelectorAll('[data-select-unit]').forEach(b=>b.onclick=()=>{selectedUnitId=b.dataset.selectUnit;syncUnits();openWarRoom()});
 }
 function openWarRoom(){modal('Военное командование',warRoomHtml());bindWarRoom()}
 function moveUnit(unit,feature,name){
  unit.position=centerForFeature(feature);unit.location=name;event('ВОЕННОЕ ДЕЛО','Передислокация: '+unit.name,'Соединение передислоцировано в регион «'+name+'».',{});syncUnits();save();closeModal();
 }
 function attackRegion(unit,admin,name,feature){
  if(!hasWar(admin))return alert('Сначала объявите войну государству '+((countries[admin]||{}).name||admin)+'.');
  const key=regionKey(admin,name),defense=6+Math.floor(Math.random()*7),attack=unit.strength+Math.floor(Math.random()*8);
  const won=attack>=defense+5||Math.random()<Math.max(.18,Math.min(.88,.38+(unit.strength-defense)*.045));
  if(won){
   occupied()[key]={admin,name,controller:state.selected,turn:state.turn};
   unit.position=centerForFeature(feature);unit.location=name;unit.strength=Math.max(1,unit.strength-1);
   event('ВОЕННОЕ ДЕЛО','Захвачен регион: '+name,'Войска заняли регион «'+name+'», ранее находившийся под контролем государства '+((countries[admin]||{}).name||admin)+'.', {importance:'major',background:'В рамках продолжающейся войны командование начало наступательную операцию на данном направлении.',development:'Соединение '+unit.name+' прорвало оборону противника и установило контроль над административным центром региона. На территории размещены подразделения и организовано военное управление.',consequences:'Регион перешёл под военный контроль '+((countries[state.selected]||{}).name||state.selected)+'. Контроль может измениться в ходе дальнейших боевых действий.',reaction:'Сведения о реакции иностранных государств появятся в хронике после следующего расчёта мирового периода.'});
  }else{
   unit.strength=Math.max(0,unit.strength-2);
   event('ВОЕННОЕ ДЕЛО','Наступление остановлено: '+name,'Соединение '+unit.name+' не смогло занять регион. Потери и сопротивление противника ослабили боеспособность части.',{importance:'major',background:'Вооружённые силы предприняли попытку наступления на подготовленные позиции противника.',development:'Обороняющиеся войска удержали рубежи. Атакующее соединение понесло потери и было вынуждено остановить продвижение.',consequences:'Регион остаётся под контролем '+((countries[admin]||{}).name||admin)+'. Боеспособность соединения снижена.',reaction:'Операция отражена в военной хронике.'});
   if(unit.strength===0){state.armies=armies().filter(x=>x.id!==unit.id);selectedUnitId=null;event('ВОЕННОЕ ДЕЛО','Соединение расформировано','Боеспособность соединения исчерпана, остатки личного состава выведены из строя.');}
  }
  syncUnits();updateUI();save();closeModal();if(regionLayer)regionLayer.setStyle(styleRegion);
 }
 function styleRegion(feature){
  const p=feature.properties||{},admin=regionAdmin(p),name=regionName(p),occ=occupied()[regionKey(admin,name)];
  return{color:occ?'#f2cf83':'#dce4ed',weight:occ?1.35:.72,opacity:occ?.98:.58,fillColor:occ?'#bb493e':'#dce4ed',fillOpacity:occ?.48:.018};
 }
 function openRegion(feature){
  const p=feature.properties||{},admin=regionAdmin(p),name=regionName(p),occ=occupied()[regionKey(admin,name)],own=admin===state.selected||(occ&&occ.controller===state.selected),unit=armies().find(x=>x.id===selectedUnitId);
  const foreign=admin&&admin!==state.selected,war=foreign&&hasWar(admin);
  const ownerName=(countries[admin]||{}).name||admin||'Не определено';
  let actions='';
  if(own){
   actions='<p class="wc-muted">Регион находится под вашим контролем.</p>'+(armies().length?'<select id="wc-region-unit">'+unitOptions()+'</select><button class="wc-primary wc-region-action" id="wc-move-unit">Передислоцировать соединение сюда</button>':'');
  }else if(foreign){
   actions=war?'<p class="wc-muted">Идёт война с этим государством. Выберите соединение для проведения операции.</p>'+(armies().length?'<select id="wc-region-unit">'+unitOptions()+'</select><button class="wc-danger wc-region-action" id="wc-attack-region">Атаковать регион</button>':'<p class="wc-muted">Сначала сформируйте дивизию в военном командовании.</p>'):'<p class="wc-muted">Регион принадлежит другому государству.</p><button class="wc-danger wc-region-action" id="wc-region-declare">Объявить войну '+esc(ownerName)+'</button>';
  }
  modal('Регион · '+name,'<div class="wc-region-card"><div class="wc-region-owner"><span>◈</span><div><small>АДМИНИСТРАТИВНАЯ ПРИНАДЛЕЖНОСТЬ</small><b>'+esc(ownerName)+'</b></div></div><div class="wc-region-facts"><div><small>РЕГИОН</small><b>'+esc(name)+'</b></div><div><small>КОНТРОЛЬ</small><b>'+(occ?esc((countries[occ.controller]||{}).name||occ.controller):'Гражданская администрация')+'</b></div></div>'+actions+'</div>');
  document.getElementById('wc-region-declare')?.addEventListener('click',()=>{if(!hasWar(admin)){state.wars.push(warKey(state.selected,admin));event('ВОЕННОЕ ДЕЛО','Объявлена война: '+ownerName,'Правительство объявило войну государству '+ownerName+'.',{importance:'major',background:'Дипломатический кризис перешёл в открытое вооружённое противостояние.',development:'Вооружённые силы приведены в боевую готовность. Начинается военная кампания.',consequences:'Военные операции против государства '+ownerName+' теперь доступны.',reaction:'Международная реакция будет отражена в мировой хронике.'});save();}closeModal();openRegion(feature)});
  document.getElementById('wc-move-unit')?.addEventListener('click',()=>{const id=document.getElementById('wc-region-unit')?.value||selectedUnitId,u=armies().find(x=>x.id===id);if(!u)return alert('Выберите соединение.');selectedUnitId=id;moveUnit(u,feature,name)});
  document.getElementById('wc-attack-region')?.addEventListener('click',()=>{const id=document.getElementById('wc-region-unit')?.value||selectedUnitId,u=armies().find(x=>x.id===id);if(!u)return alert('Выберите соединение.');selectedUnitId=id;attackRegion(u,admin,name,feature)});
 }
 function bindRegionLayer(){
  if(!regionLayer||!window.L)return;
  const attach=layer=>{
   if(!layer||layer.__wcWarBound||!layer.feature)return;layer.__wcWarBound=true;
   layer.on('click',evt=>{if(evt.originalEvent)L.DomEvent.stopPropagation(evt.originalEvent);openRegion(layer.feature)});
  };
  regionLayer.eachLayer(attach);
  regionLayer.on('layeradd',e=>attach(e.layer));
  regionLayer.setStyle(styleRegion);
 }
 function init(){
  if(!map||!window.L)return;
  ensureLayer();bindRegionLayer();syncUnits();
  document.getElementById('wc-war-room-btn')?.addEventListener('click',openWarRoom);
  document.getElementById('wc-create-unit-btn')?.addEventListener('click',openWarRoom);
  document.getElementById('pax-own-country')?.addEventListener('click',()=>syncUnits());
  const oldUpdate=window.updateUI; // refresh army counters in the operational panel without changing the main HUD
  document.querySelectorAll('.pax-float-button').forEach(b=>{if(b.dataset.paxPanel==='projects'){b.addEventListener('click',()=>{setTimeout(()=>{const content=document.getElementById('pax-drawer-content');if(content&&!content.querySelector('#wc-open-war-room')){const box=document.createElement('div');box.className='wc-war-shortcut';box.innerHTML='<button class="wc-primary" id="wc-open-war-room">⚔ Военное командование</button>';content.prepend(box);document.getElementById('wc-open-war-room').onclick=openWarRoom}},0)})}});
  window.WC_WAR={open:openWarRoom,sync:syncUnits,selected:()=>selectedUnitId};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
