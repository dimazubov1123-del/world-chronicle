/* WORLD CHRONICLE — playable browser strategy prototype */
const SAVE_KEY='worldChronicleSave_v2';
const state={year:1936,month:0,day:1,turn:1,paused:true,speed:1,selected:'Russia',regionsVisible:true,citiesVisible:true,frontsVisible:true,election:null,treasury:120,prestige:45,stability:72,gdp:100,army:68,manpower:75,relations:{'United States of America':15,China:5,Germany:-20,France:20,'United Kingdom':18,Japan:-5},treaties:[],wars:[],laws:[],events:[],periodArchive:[],currentPeriod:null,initiatives:[],pendingOrders:[],aiWorldState:{countries:{},lastSummary:''},geoLayer:null,armies:[],occupiedRegions:{}};
const countries={
'Russia':{name:'Российская Федерация',capital:'Москва',flag:'🇷🇺',population:'170 млн',economy:'Сильная',stability:72,military:'Высокие'},
'United States of America':{name:'Соединённые Штаты',capital:'Вашингтон',flag:'🇺🇸',population:'330 млн',economy:'Крупнейшая',stability:81,military:'Очень высокие'},
'China':{name:'Китай',capital:'Пекин',flag:'🇨🇳',population:'1,4 млрд',economy:'Крупная',stability:76,military:'Высокие'},
'Germany':{name:'Германия',capital:'Берлин',flag:'🇩🇪',population:'69 млн',economy:'Промышленная',stability:64,military:'Средние'},
'France':{name:'Франция',capital:'Париж',flag:'🇫🇷',population:'42 млн',economy:'Развитая',stability:74,military:'Высокие'},
'United Kingdom':{name:'Великобритания',capital:'Лондон',flag:'🇬🇧',population:'48 млн',economy:'Развитая',stability:78,military:'Высокие'},
'Japan':{name:'Япония',capital:'Токио',flag:'🇯🇵',population:'70 млн',economy:'Промышленная',stability:83,military:'Высокие'},
'Brazil':{name:'Бразилия',capital:'Бразилиа',flag:'🇧🇷',population:'40 млн',economy:'Развивающаяся',stability:62,military:'Средние'},
'India':{name:'Индия',capital:'Нью-Дели',flag:'🇮🇳',population:'380 млн',economy:'Развивающаяся',stability:68,military:'Высокие'},
'Italy':{name:'Италия',capital:'Рим',flag:'🇮🇹',population:'42 млн',economy:'Промышленная',stability:61,military:'Средние'}
};
const scenarios={'1836':'Эпоха империй','1914':'Лето 1914 года','1936':'Европа на распутье','2026':'Современный мир'};
const $=id=>document.getElementById(id),fmt=n=>Math.round(n).toLocaleString('ru-RU');

const WC_AI_BASE=String(window.WC_API_BASE||'').replace(/\/$/,'');
let wcAiBusy=false,wcAiLastTurn=0;
async function wcAiRequest(path,payload){
 if(!WC_AI_BASE)throw new Error('ИИ-сервер не настроен.');
 const response=await fetch(WC_AI_BASE+'/api/ai/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Ошибка ИИ-сервера ('+response.status+')');
 return data;
}
function wcAiCountries(){return (countryMeta||[]).map(x=>({id:x.info.id,name:x.info.name,flag:x.info.flag,region:x.feature?.properties?.REGION_UN||x.feature?.properties?.CONTINENT||'',populationEstimate:x.feature?.properties?.POP_EST||null,gdpEstimate:x.feature?.properties?.GDP_MD_EST||null})).filter(x=>x.id&&x.id!==state.selected).slice(0,220)}
function wcAiSnapshot(){
 const previous=state.aiWorldState?.countries||{};
 return {date:dateText(),year:state.year,scenario:scenarios[String(state.year)]||'Альтернативная история',turn:state.turn,player:{id:state.selected,name:(countries[state.selected]||{}).name||state.selected,treasury:state.treasury,gdp:state.gdp,stability:state.stability,prestige:state.prestige,army:state.army,manpower:state.manpower},relations:state.relations||{},wars:state.wars||[],armies:state.armies||[],occupiedRegions:state.occupiedRegions||{},treaties:state.treaties||[],laws:state.laws||[],countries:wcAiCountries(),previousReports:Object.entries(previous).map(([id,r])=>({id,summary:String(r.publicDecision||r.internalPolitics||'').slice(0,220),nextStep:String(r.nextStep||'').slice(0,140)})).slice(0,220)};
}
async function runWorldAI(){
 if(window.__replayingEvents||wcAiBusy||wcAiLastTurn===state.turn)return;
 wcAiBusy=true;wcAiLastTurn=state.turn;
 try{
  const result=await wcAiRequest('world-turn',wcAiSnapshot());
  state.aiWorldState=state.aiWorldState||{countries:{},lastSummary:''};
  state.aiWorldState.countries=state.aiWorldState.countries||{};
  (result.countryReports||[]).forEach(r=>{
   if(!r||!r.countryId||r.countryId===state.selected||!countryMeta.some(x=>x.info.id===r.countryId))return;
   const fields=['government','internalPolitics','economy','society','diplomacy','defense','publicDecision','nextStep'];
   const report={countryId:r.countryId,lastUpdatedTurn:state.turn};
   fields.forEach(k=>{if(r[k])report[k]=String(r[k]).slice(0,1800)});
   state.aiWorldState.countries[r.countryId]=report;
  });
  if(result.coverage&&Number(result.coverage.returned)<Number(result.coverage.requested))event('СИСТЕМА ИИ','Неполный охват мировых докладов','ИИ подготовил публичные доклады для '+result.coverage.returned+' из '+result.coverage.requested+' государств. Остальные страны будут повторно обработаны в следующих ходах.');
  if(result.worldSummary){state.aiWorldState.lastSummary=String(result.worldSummary).slice(0,5000);event('МИРОВАЯ ОБСТАНОВКА','Общий обзор мира · '+dateText(),state.aiWorldState.lastSummary.slice(0,1800))}
  (result.events||[]).slice(0,12).forEach(e=>{if(e&&e.title&&e.description&&(!e.visibility||e.visibility==='public'))event(String(e.category||'МИРОВЫЕ СОБЫТИЯ').slice(0,32),String(e.title).slice(0,180),String(e.description).slice(0,1800))});
  (result.actions||[]).slice(0,80).forEach(a=>{
   if(!a||!a.countryId||a.countryId===state.selected||!countryMeta.some(x=>x.info.id===a.countryId))return;
   const target=a.targetCountryId,isPlayerTarget=target===state.selected,isKnownTarget=countryMeta.some(x=>x.info.id===target);
   if(a.type==='relation'&&target&&Number.isFinite(Number(a.delta))){if(isPlayerTarget)state.relations[a.countryId]=Math.max(-100,Math.min(100,Number(state.relations[a.countryId]||0)+Math.max(-8,Math.min(8,Number(a.delta)))));else if(isKnownTarget){state.aiWorldState.bilateralRelations=state.aiWorldState.bilateralRelations||{};const key=[a.countryId,target].sort().join('|');state.aiWorldState.bilateralRelations[key]=Math.max(-100,Math.min(100,Number(state.aiWorldState.bilateralRelations[key]||0)+Math.max(-8,Math.min(8,Number(a.delta)))));}}
   if(a.type==='treaty'&&target&&(isPlayerTarget||isKnownTarget)&&!state.treaties.includes(a.countryId+'|'+target))state.treaties.push(a.countryId+'|'+target);
   if(a.type==='war'&&target&&(isPlayerTarget||isKnownTarget)&&!state.wars.includes(a.countryId+'|'+target))state.wars.push(a.countryId+'|'+target);
  });
  if(result.advisor){window.__wcLastAiBrief=String(result.advisor).slice(0,3000);$('advisor-text').textContent=window.__wcLastAiBrief.slice(0,700)}
  updateUI();save();
 }catch(err){console.warn('World Chronicle AI:',err.message);window.__wcAiError=err.message;$('advisor-text').textContent='ИИ не смог обновить мировую хронику: '+err.message}
 finally{wcAiBusy=false;if(wcAiLastTurn!==state.turn&&!window.__replayingEvents)runWorldAI()}
}
window.WC_AI={request:wcAiRequest,snapshot:wcAiSnapshot,enabled:()=>!!WC_AI_BASE};

function dateText(){return state.day+' '+['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][state.month]+' '+state.year}
let wcAudio=null;
let soundEnabled=localStorage.getItem('wcSound')!=='off';
function playSound(kind='click'){
 if(!soundEnabled)return;
 try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!wcAudio)wcAudio=new AC();if(wcAudio.state==='suspended')wcAudio.resume();const now=wcAudio.currentTime;
 const tones=kind==='event'?[{f:523,d:.13,t:0},{f:659,d:.16,t:.14},{f:784,d:.25,t:.31}]:kind==='turn'?[{f:392,d:.08,t:0},{f:523,d:.12,t:.09}]:[{f:660,d:.035,t:0}];
 tones.forEach(n=>{const o=wcAudio.createOscillator(),g=wcAudio.createGain();o.type=kind==='click'?'sine':'triangle';o.frequency.setValueAtTime(n.f,now+n.t);g.gain.setValueAtTime(.0001,now+n.t);g.gain.exponentialRampToValueAtTime(kind==='click'?.035:.07,now+n.t+.012);g.gain.exponentialRampToValueAtTime(.0001,now+n.t+n.d);o.connect(g);g.connect(wcAudio.destination);o.start(now+n.t);o.stop(now+n.t+n.d+.02)})}catch(e){}
}
function setSoundEnabled(on){soundEnabled=!!on;localStorage.setItem('wcSound',soundEnabled?'on':'off');const b=$('sound-toggle');if(b){b.classList.toggle('sound-off',!soundEnabled);b.setAttribute('aria-pressed',String(soundEnabled));b.innerHTML=soundEnabled?'♫ <span>ЗВУК ВКЛ.</span>':'♩ <span>ЗВУК ВЫКЛ.</span>'}if(soundEnabled)playSound('click')}
function updateUI(){$('date-label').textContent=dateText();$('turn-label').textContent='ХОД '+String(state.turn).padStart(3,'0');$('treasury-top').textContent='₽ '+fmt(state.treasury)+' млрд';$('prestige-top').textContent=fmt(state.prestige);$('stability').textContent=fmt(state.stability)+'%';$('economy').textContent='Индекс '+fmt(state.gdp);$('military').textContent=fmt(state.army)+' тыс.'}
function showChronicleEvent(e){if(window.openNewsDrawer){window.openNewsDrawer(e?.periodTurn??'current');return;}const overlay=$('event-overlay');if(!overlay)return;$('event-date').textContent=e.date+' · '+(e.category||'ГОСУДАРСТВО');$('event-heading').textContent=e.title;$('event-description').textContent=e.description;overlay.classList.remove('hidden');document.body.classList.add('event-open');playSound('event')}
function closeChronicleEvent(){const overlay=$('event-overlay');if(overlay)overlay.classList.add('hidden');document.body.classList.remove('event-open')}
function wcNewsEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function wcNewsDate(v){return String(v||'').trim()||'Дата не указана'}
let wcNewsSelectedId=null,wcNewsPeriod='current';
function renderNewsArticle(item){
 const pane=$('wc-news-article');if(!pane)return;
 if(!item){pane.innerHTML='<div class="wc-news-empty"><span>✦</span><b>События за этот период не зафиксированы</b><p>После следующего временного перехода здесь появятся публикации мировой хроники.</p></div>';return}
 const paragraphs=String(item.article||item.description||'').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 const sections=[['Предыстория',item.background],['Развитие событий',item.development],['Последствия',item.consequences],['Международная реакция',item.reaction]].filter(x=>x[1]);
 pane.innerHTML='<div class="wc-news-paper"><div class="wc-news-kicker">WORLD CHRONICLE <span>·</span> МИРОВАЯ ГАЗЕТА</div><div class="wc-news-dateline">'+wcNewsEsc(wcNewsDate(item.date))+' <i>—</i> '+wcNewsEsc(item.category||'МИРОВЫЕ СОБЫТИЯ')+(item.location?' <i>·</i> '+wcNewsEsc(item.location):'')+'</div><div class="wc-news-rule"></div><div class="wc-news-label">'+(item.importance==='major'?'ГЛАВНОЕ СОБЫТИЕ':'ХРОНИКА ДНЯ')+'</div><h1>'+wcNewsEsc(item.title)+'</h1>'+(item.subtitle?'<h2>'+wcNewsEsc(item.subtitle)+'</h2>':'')+(item.lead?'<p class="wc-news-lead">'+wcNewsEsc(item.lead)+'</p>':'')+'<div class="wc-news-body">'+paragraphs.map(p=>'<p>'+wcNewsEsc(p)+'</p>').join('')+'</div>'+(sections.length?'<div class="wc-news-sections">'+sections.map(x=>'<section><b>'+wcNewsEsc(x[0])+'</b><p>'+wcNewsEsc(x[1])+'</p></section>').join('')+'</div>':'')+'<div class="wc-news-foot">WORLD CHRONICLE <span>Официальная хроника альтернативного мира</span></div></div>';
}
function renderNewsDrawer(period){
 const drawer=$('wc-news-drawer');if(!drawer)return;
 const archive=Array.isArray(state.periodArchive)?state.periodArchive:[];
 const select=$('wc-news-period');
 if(select){
  const options=[{value:'current',label:'Последний период'},{value:'all',label:'Вся хроника'},...archive.map(x=>({value:String(x.turn),label:(x.label||'Период')+' · '+(x.startDate||'')+' — '+(x.endDate||'')}))];
  select.innerHTML=options.map(o=>'<option value="'+wcNewsEsc(o.value)+'">'+wcNewsEsc(o.label)+'</option>').join('');
  select.value=String(period??wcNewsPeriod);
  if(!Array.from(select.options).some(o=>o.value===select.value))select.value='current';
  wcNewsPeriod=select.value;
 }
 let items=(state.events||[]);
 if(wcNewsPeriod!=='all'&&wcNewsPeriod!=='current')items=items.filter(e=>String(e.periodTurn)===wcNewsPeriod);
 else if(wcNewsPeriod==='current'){
  const latest=archive[0];
  const turn=latest?.turn??state.turn;
  items=items.filter(e=>Number(e.periodTurn)===Number(turn));
 }
 const list=$('wc-news-list');if(!list)return;
 list.innerHTML='';
 if(!items.length){list.innerHTML='<div class="wc-news-list-empty">За выбранный период новостей нет.</div>';renderNewsArticle(null);return}
 items.forEach((item,index)=>{
  const button=document.createElement('button');button.type='button';button.className='wc-news-item'+(item.id===wcNewsSelectedId?' active':'')+(item.importance==='major'?' major':'');
  button.innerHTML='<span class="wc-news-item-meta"><i>'+wcNewsEsc(item.category||'СОБЫТИЕ')+'</i><time>'+wcNewsEsc(wcNewsDate(item.date))+'</time></span><b></b><small></small>';
  button.querySelector('b').textContent=item.title||'Событие';
  button.querySelector('small').textContent=item.lead||item.description||'';
  button.addEventListener('click',()=>{wcNewsSelectedId=item.id;list.querySelectorAll('.wc-news-item').forEach(x=>x.classList.remove('active'));button.classList.add('active');renderNewsArticle(item)});
  list.append(button);
 });
 const selected=items.find(x=>x.id===wcNewsSelectedId)||items[0];wcNewsSelectedId=selected.id;
 const selectedButton=Array.from(list.children).find(x=>x.querySelector('b')?.textContent===selected.title);selectedButton?.classList.add('active');
 renderNewsArticle(selected);
 const count=$('wc-news-total');if(count)count.textContent=String(items.length).padStart(2,'0');const caption=$('wc-news-period-caption');if(caption){const latest=archive.find(x=>String(x.turn)===String(wcNewsPeriod))||archive[0];caption.textContent=wcNewsPeriod==='all'?'Полная хронология кампании':latest?(latest.label+' · '+latest.startDate+' — '+latest.endDate):'События текущего хода'}
}
function openNewsDrawer(period='current'){
 const drawer=$('wc-news-drawer');if(!drawer)return;
 drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');document.body.classList.add('wc-news-open');
 renderNewsDrawer(period==='current'?'current':period);
}
function closeNewsDrawer(){const drawer=$('wc-news-drawer');if(drawer){drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true')}document.body.classList.remove('wc-news-open')}
window.openNewsDrawer=openNewsDrawer;window.closeNewsDrawer=closeNewsDrawer;window.renderNewsDrawer=renderNewsDrawer;
function event(category,title,description,details={}){
 const d=details&&typeof details==='object'?details:{};
 const item={id:d.id||'EV-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),category:String(category||'МИРОВЫЕ СОБЫТИЯ'),title:String(title||'Событие'),description:String(description||''),date:wcNewsDate(d.date||dateText()),periodTurn:Number(d.periodTurn??state.turn)||1,periodStart:String(d.periodStart||state.currentPeriod?.startDate||''),periodEnd:String(d.periodEnd||state.currentPeriod?.endDate||''),periodLabel:String(d.periodLabel||state.currentPeriod?.label||''),subtitle:String(d.subtitle||'').slice(0,300),lead:String(d.lead||'').slice(0,1000),article:String(d.article||'').slice(0,9000),location:String(d.location||'').slice(0,160),background:String(d.background||'').slice(0,1800),development:String(d.development||'').slice(0,2400),consequences:String(d.consequences||'').slice(0,1800),reaction:String(d.reaction||'').slice(0,1400),importance:d.importance==='major'?'major':'normal'};
 state.events.unshift(item);state.events=state.events.slice(0,500);
 const list=$('news-list');if(list){list.innerHTML='';state.events.slice(0,7).forEach(e=>{const node=document.createElement('article');node.className='news-item';const tag=e.category==='ДИПЛОМАТИЯ'?'gold':e.category==='ЭКОНОМИКА'?'blue':e.category==='ВОЕННОЕ ДЕЛО'?'red':'gold';node.innerHTML='<div class="news-meta"><span class="news-tag '+tag+'">'+wcNewsEsc(e.category)+'</span><time>'+wcNewsEsc(e.date)+'</time></div><h3></h3><p></p>';node.querySelector('h3').textContent=e.title;node.querySelector('p').textContent=e.lead||e.description;list.append(node)})}
 $('event-count').textContent=String(state.events.length).padStart(2,'0');if($('pax-events-count'))$('pax-events-count').textContent=String(state.events.length);
 const important=item.importance==='major'||/выбор|правительств|парламент|закон:|указ:|обращение к нации|войн|мобилиз|напад|пакт о ненападении|торговое соглашение|кризис|переворот|аннекс|капитуляц|сформирована парламентская коалиц|состоялись общенациональные/i.test(item.category+' '+item.title);
 if($('wc-news-drawer')?.classList.contains('open'))renderNewsDrawer(wcNewsPeriod);
 if(important&&!window.__replayingEvents&&window.openNewsDrawer)openNewsDrawer(item.periodTurn);
}
function selectCountry(id,feature,displayName,displayFlag){
 const base=countries[id]||{name:displayName||id,capital:'Не определена',flag:displayFlag||'🏳️',population:'—',economy:'Нет данных',stability:50,military:'—'};
 const c={...base,name:displayName||base.name,flag:displayFlag||base.flag};
 state.selected=id;state.inspectedCountry=id;
 $('country-name').textContent=c.name;$('country-capital').textContent='Столица: '+c.capital;$('country-flag').innerHTML=wcFlagImg(getCountryInfo(feature||countryMeta.find(x=>x.info.id===id)?.feature||{}).code||'',''+c.name,'wc-main-flag');
 $('population').textContent=c.population;$('economy').textContent=c.economy;$('stability').textContent=c.stability+'%';$('military').textContent=c.military;
 $('map-hint').textContent='Выбрано государство: '+c.name;
 if(state.geoLayer)state.geoLayer.setStyle(styleFeature);
 refreshRegions();
 if(feature&&map){const item=countryMeta.find(x=>x.info.id===id);const b=item?.bounds||(L.geoJSON(feature).getBounds());if(b.isValid())map.fitBounds(b,{padding:[45,45],maxZoom:5})}
}
function inspectCountry(id,feature,displayName,displayFlag){
 const item=countryMeta.find(x=>x.info.id===id),f=feature||item?.feature,info=f?getCountryInfo(f):{id,name:displayName||countries[id]?.name||id,flag:displayFlag||countries[id]?.flag||'🏳️'};
 state.inspectedCountry=id;
 if(state.geoLayer)state.geoLayer.setStyle(styleFeature);
 openCountryProfile(id,f,info);
 if(f&&map){const b=item?.bounds||(L.geoJSON(f).getBounds());if(b?.isValid())map.fitBounds(b,{padding:[45,45],maxZoom:5})}
 $('map-hint').textContent='Открыта карточка государства: '+info.name;
}
function escCountryHtml(value){return String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function openCountryProfile(id,feature,info){
 const drawer=document.getElementById('pax-drawer'),content=document.getElementById('pax-drawer-content'),title=document.getElementById('pax-drawer-title');
 if(!drawer||!content)return;
 const p=feature?.properties||{},base=countries[id]||{},name=info?.name||base.name||id,flag=info?.flag||base.flag||'🏳️';
 const flagCode=info?.code||getCountryInfo(feature||{}).code||'';const relation=Number(state.relations?.[id]||0),relationLabel=relation>=50?'Союзные':relation>=15?'Дружественные':relation<=-40?'Напряжённые':'Нейтральные';
 const pop=Number(p.POP_EST),gdp=Number(p.GDP_MD_EST),region=p.REGION_UN||p.REGION_WB||p.CONTINENT||'';
 const popText=pop>0?(pop>=1e9?(pop/1e9).toFixed(2).replace('.',',')+' млрд':(pop/1e6).toFixed(1).replace('.',',')+' млн'):base.population||'Нет данных';
 const gdpText=gdp>0?'$ '+(gdp/1000).toLocaleString('ru-RU',{maximumFractionDigits:1})+' млрд':base.economy||'Нет данных';
 const CAPITALS={'United States of America':'Вашингтон','Canada':'Оттава','Mexico':'Мехико','Brazil':'Бразилиа','Argentina':'Буэнос-Айрес','Chile':'Сантьяго','Peru':'Лима','Colombia':'Богота','Venezuela':'Каракас','United Kingdom':'Лондон','France':'Париж','Germany':'Берлин','Spain':'Мадрид','Portugal':'Лиссабон','Italy':'Рим','Poland':'Варшава','Ukraine':'Киев','Belarus':'Минск','Norway':'Осло','Sweden':'Стокгольм','Finland':'Хельсинки','Denmark':'Копенгаген','Netherlands':'Амстердам','Belgium':'Брюссель','Switzerland':'Берн','Austria':'Вена','Czechia':'Прага','Greece':'Афины','Turkey':'Анкара','China':'Пекин','Japan':'Токио','India':'Нью-Дели','Pakistan':'Исламабад','South Korea':'Сеул','North Korea':'Пхеньян','Thailand':'Бангкок','Vietnam':'Ханой','Indonesia':'Джакарта','Malaysia':'Куала-Лумпур','Philippines':'Манила','Saudi Arabia':'Эр-Рияд','Iran':'Тегеран','Iraq':'Багдад','Israel':'Иерусалим','Egypt':'Каир','South Africa':'Претория','Nigeria':'Абуджа','Kenya':'Найроби','Ethiopia':'Аддис-Абеба','Australia':'Канберра','New Zealand':'Веллингтон'};
 const capital=base.capital||CAPITALS[id]||p.CAPITAL||'Нет данных в сценарии';
 const isPlayer=id===state.selected;
 title.textContent='Государство · '+name;
 drawer.classList.add('country-open');drawer.classList.remove('hidden');
 content.innerHTML='<div class="wc-country-hero"><span class="wc-country-flag">'+wcFlagImg(flagCode,name,'wc-profile-flag')+'</span><div class="wc-country-heading"><span class="wc-country-kicker">'+(isPlayer?'УПРАВЛЯЕМОЕ ГОСУДАРСТВО':'ГОСУДАРСТВО МИРА')+'</span><h2>'+escCountryHtml(name)+'</h2><small>'+escCountryHtml(p.FORMAL_EN||p.TYPE||'Суверенное государство')+'</small></div></div>'+
 '<div class="wc-country-facts"><div><small>СТОЛИЦА</small><b>'+escCountryHtml(capital)+'</b></div><div><small>НАСЕЛЕНИЕ</small><b>'+escCountryHtml(popText)+'</b></div><div><small>ЭКОНОМИКА</small><b>'+escCountryHtml(gdpText)+'</b></div><div><small>РЕГИОН</small><b>'+escCountryHtml(region||'Нет данных')+'</b></div></div>'+
 '<div class="wc-country-relations"><span><small>ОТНОШЕНИЯ С ВАШЕЙ СТРАНОЙ</small><b>'+relationLabel+'</b></span><strong>'+ (relation>0?'+':'')+relation+'</strong></div>'+
 '<div class="wc-country-actions">'+(isPlayer?'<button class="pax-secondary" id="wc-country-own">Это ваша страна</button>':'<button class="pax-primary" id="wc-country-diplomacy">✦ Дипломатические действия</button><button class="pax-secondary" id="wc-country-chat">☏ Открыть переговоры</button>')+'</div>'+
 '<section class="wc-ai-country-report"><div class="wc-country-kicker">ПУБЛИЧНАЯ ХРОНИКА · ИИ</div>'+(isPlayer?'<p>Это управляемое вами государство. ИИ не принимает за него внутренние или внешнеполитические решения.</p>':state.aiWorldState?.countries?.[id]?'<div class="wc-ai-report-date">Обновлено: ход '+escCountryHtml(state.aiWorldState.countries[id].lastUpdatedTurn||'—')+'</div>'+[['ПРАВИТЕЛЬСТВО',state.aiWorldState.countries[id].government],['ВНУТРЕННЯЯ ПОЛИТИКА',state.aiWorldState.countries[id].internalPolitics],['ЭКОНОМИКА И ОБЩЕСТВО',(state.aiWorldState.countries[id].economy||'')+' '+(state.aiWorldState.countries[id].society||'')],['ВНЕШНЯЯ ПОЛИТИКА',state.aiWorldState.countries[id].diplomacy],['ОБОРОНА И ВООРУЖЁННЫЕ СИЛЫ',state.aiWorldState.countries[id].defense],['ПУБЛИЧНЫЕ ДЕЙСТВИЯ',state.aiWorldState.countries[id].publicDecision],['ДАЛЬНЕЙШИЕ ПЛАНЫ',state.aiWorldState.countries[id].nextStep]].filter(x=>x[1]).map(x=>'<div class="wc-ai-report-block"><b>'+x[0]+'</b><p>'+escCountryHtml(x[1])+'</p></div>').join(''):'<p>ИИ ещё не сформировал публичный доклад по этому государству. Перейдите к следующему ходу, чтобы обновить мировую хронику.</p>')+'</section><p class="wc-country-note">Публикуются только открытые решения и наблюдаемые действия. Закрытые переговоры, разведывательные сведения и секретные планы в хронику не попадают.</p>';
 const dip=document.getElementById('wc-country-diplomacy');if(dip)dip.onclick=()=>{drawer.classList.remove('country-open');diplomacyTalk(id)};
 const chat=document.getElementById('wc-country-chat');if(chat)chat.onclick=()=>{drawer.classList.remove('country-open');window.__paxOpenChatWithTarget?.(id)};
}
function styleFeature(f){
 const name=f.properties.ADMIN||f.properties.admin||f.properties.name||'';
 const hue=(Array.from(name).reduce((n,ch)=>((n*31)+ch.charCodeAt(0))>>>0,17)%360);
 const fill='hsl('+hue+' 39% 43%)';
 const selected=(state.inspectedCountry||state.selected)===name;
 return{color:selected?'#f2d18e':'#172536',weight:selected?2.1:.8,opacity:1,fillColor:selected?'#c49b53':fill,fillOpacity:selected?.96:.91};
}
const RU_COUNTRY_NAMES={RU:'Россия',US:'США',GB:'Великобритания',KR:'Южная Корея',KP:'КНДР',CZ:'Чехия',TR:'Турция',IR:'Иран',SY:'Сирия',TW:'Тайвань',CD:'ДР Конго',CG:'Республика Конго',CI:'Кот-д’Ивуар',BO:'Боливия',VE:'Венесуэла',TZ:'Танзания',MD:'Молдова',PS:'Палестина',VA:'Ватикан',XK:'Косово'};
const ruDisplayNames=typeof Intl!=='undefined'&&Intl.DisplayNames?new Intl.DisplayNames(['ru'],{type:'region'}):null;
function getCountryInfo(feature){
 const p=feature.properties||{},rawCode=String(p.ISO_A2||'').toUpperCase(),code=/^[A-Z]{2}$/.test(rawCode)?rawCode:String(p.ISO_A2_EH||p.iso_a2||'').toUpperCase(),original=p.ADMIN||p.admin||p.name||p.NAME||'Государство';
 let name=RU_COUNTRY_NAMES[code]||p.NAME_RU;if(!name&&/^[A-Z]{2}$/.test(code)&&ruDisplayNames){try{name=ruDisplayNames.of(code)}catch(e){}}
 if(!name||name===code)name=original;
 let flag='🏳️';if(/^[A-Z]{2}$/.test(code)&&code!=='-99')flag=Array.from(code).map(ch=>String.fromCodePoint(127397+ch.charCodeAt(0))).join('');if(code==='XK')flag='🇽🇰';
 return{id:original,name,flag,code};
}
let map=null,canvasRenderer=null,countryMeta=[],regionData=null,regionLayer=null,cityLayer=null,regionsLoading=false;
const CITIES=[
 ['Москва',55.7558,37.6173,'Russia'],['Санкт-Петербург',59.9343,30.3351,'Russia'],['Калининград',54.7104,20.4522,'Russia'],['Казань',55.7961,49.1064,'Russia'],['Екатеринбург',56.8389,60.6057,'Russia'],['Новосибирск',55.0084,82.9357,'Russia'],['Владивосток',43.1155,131.8855,'Russia'],
 ['Вашингтон',38.9072,-77.0369,'United States of America'],['Нью-Йорк',40.7128,-74.006,'United States of America'],['Лос-Анджелес',34.0522,-118.2437,'United States of America'],['Оттава',45.4215,-75.6972,'Canada'],['Мехико',19.4326,-99.1332,'Mexico'],
 ['Лондон',51.5072,-.1276,'United Kingdom'],['Париж',48.8566,2.3522,'France'],['Берлин',52.52,13.405,'Germany'],['Мадрид',40.4168,-3.7038,'Spain'],['Рим',41.9028,12.4964,'Italy'],['Варшава',52.2297,21.0122,'Poland'],['Киев',50.4501,30.5234,'Ukraine'],['Стокгольм',59.3293,18.0686,'Sweden'],['Анкара',39.9334,32.8597,'Turkey'],
 ['Пекин',39.9042,116.4074,'China'],['Шанхай',31.2304,121.4737,'China'],['Токио',35.6762,139.6503,'Japan'],['Сеул',37.5665,126.978,'South Korea'],['Пхеньян',39.0392,125.7625,'North Korea'],['Нью-Дели',28.6139,77.209,'India'],['Исламабад',33.6844,73.0479,'Pakistan'],['Бангкок',13.7563,100.5018,'Thailand'],['Джакарта',-6.2088,106.8456,'Indonesia'],
 ['Каир',30.0444,31.2357,'Egypt'],['Аддис-Абеба',8.9806,38.7578,'Ethiopia'],['Найроби',-1.2921,36.8219,'Kenya'],['Претория',-25.7479,28.2293,'South Africa'],['Бразилиа',-15.7939,-47.8828,'Brazil'],['Буэнос-Айрес',-34.6037,-58.3816,'Argentina'],['Канберра',-35.2809,149.1300,'Australia']
];
let cityMarkers=[];
function initCityMarkers(){
 if(!map||!cityLayer||cityMarkers.length)return;
 for(const [name,lat,lng,country] of CITIES){
  const m=L.circleMarker([lat,lng],{radius:map.getZoom()>5?4:3,weight:1,color:'#f5dfad',fillColor:'#d7b56d',fillOpacity:.95,renderer:canvasRenderer});
  m.bindTooltip(name,{permanent:false,direction:'top',className:'wc-city-tooltip',offset:[0,-5]});
  m.on('click',()=>{$('map-hint').textContent='Город: '+name+' · '+country.replace('United States of America','США').replace('United Kingdom','Великобритания');map.setView([lat,lng],Math.max(5,map.getZoom()))});
  cityMarkers.push(m);cityLayer.addLayer(m);
 }
}
function updateCityVisibility(){
 if(!map)return;const visible=state.citiesVisible&&map.getZoom()>=3.4,labels=visible&&map.getZoom()>=5.2,bounds=map.getBounds();
 for(const m of cityMarkers){m.setStyle({opacity:visible?1:0,fillOpacity:visible?.95:0});const showLabel=labels&&bounds.contains(m.getLatLng());if(showLabel){if(!m.isTooltipOpen())m.openTooltip()}else if(m.isTooltipOpen())m.closeTooltip();}
}
const regionIndex=new Map();
function refreshRegions(){
 if(!map||!regionLayer)return;regionLayer.clearLayers();
 if(!state.regionsVisible||!regionData)return;
 if(regionData?.features?.length)regionLayer.addData(regionData.features);
}
function ensureCountryRegionCoverage(){
 if(!regionData||!Array.isArray(window.__wcCountryFeatures)||!window.__wcCountryFeatures.length)return;
 const known=new Set((regionData.features||[]).map(f=>String((f.properties||{}).admin||(f.properties||{}).ADMIN||(f.properties||{}).sovereignt||(f.properties||{}).geonunit||(f.properties||{}).shapeGroup||'')));
 let added=false;
 for(const countryFeature of window.__wcCountryFeatures){
  const info=getCountryInfo(countryFeature);if(!info?.id||known.has(info.id))continue;
  regionData.features.push({type:'Feature',properties:{admin:info.id,name:info.name||info.id,geonunit:info.id,synthetic:true},geometry:countryFeature.geometry});
  known.add(info.id);added=true;
 }
 if(added){
  window.__wcRegionData=regionData;regionIndex.clear();
  for(const f of regionData.features){const p=f.properties||{},admin=p.admin||p.ADMIN||p.sovereignt||p.geonunit||p.shapeGroup;if(!admin)continue;if(!regionIndex.has(admin))regionIndex.set(admin,[]);regionIndex.get(admin).push(f)}
  refreshRegions();window.dispatchEvent(new Event('wc-regions-loaded'));
 }
}
function loadRegions(){
 if(!state.regionsVisible||regionData||regionsLoading)return;regionsLoading=true;
 $('map-hint').textContent='Загружаются административные границы регионов…';
 fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson',{cache:'force-cache'})
  .then(r=>{if(!r.ok)throw Error('Regions unavailable');return r.json()})
  .then(data=>{
   regionData=data;window.__wcRegionData=data;regionIndex.clear();
   const indexRegions=()=>{regionIndex.clear();for(const f of regionData.features||[]){const p=f.properties||{},admin=p.admin||p.ADMIN||p.sovereignt||p.geonunit||p.shapeGroup;if(!admin)continue;if(!regionIndex.has(admin))regionIndex.set(admin,[]);regionIndex.get(admin).push(f)}};
   indexRegions();regionsLoading=false;refreshRegions();ensureCountryRegionCoverage();window.dispatchEvent(new Event('wc-regions-loaded'));
   $('map-hint').textContent='Основные регионы загружены. Детализируются административные границы Европы…';
   const supplements=[
    ['AND','Andorra'],['LIE','Liechtenstein'],['LUX','Luxembourg'],['MCO','Monaco'],['SMR','San Marino'],['MLT','Malta'],
    ['BEL','Belgium'],['NLD','Netherlands'],['CHE','Switzerland'],['AUT','Austria'],['CZE','Czechia'],['SVK','Slovakia'],
    ['SVN','Slovenia'],['HRV','Croatia'],['SRB','Serbia'],['MNE','Montenegro'],['ALB','Albania'],['MKD','North Macedonia'],
    ['BIH','Bosnia and Herzegovina'],['EST','Estonia'],['LVA','Latvia'],['LTU','Lithuania'],['IRL','Ireland'],
    ['DNK','Denmark'],['ISL','Iceland'],['CYP','Cyprus'],['BGR','Bulgaria'],['HUN','Hungary'],['ROU','Romania'],['PRT','Portugal'],['GRC','Greece'],
    ['DEU','Germany'],['FRA','France'],['POL','Poland'],['UKR','Ukraine'],['ITA','Italy'],['ESP','Spain'],['GBR','United Kingdom'],['NOR','Norway'],['SWE','Sweden'],['FIN','Finland']
   ];
   (async()=>{
    let boundaryIndex=[];
    try{const metaResponse=await fetch('https://www.geoboundaries.org/api/current/gbOpen/ALL/ADM1/',{cache:'force-cache'});if(metaResponse.ok)boundaryIndex=await metaResponse.json()}catch(e){}
    const fallbackGeo={AND:'https://raw.githubusercontent.com/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/AND/ADM1/geoBoundaries-AND-ADM1_simplified.geojson',LIE:'https://raw.githubusercontent.com/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/LIE/ADM1/geoBoundaries-LIE-ADM1_simplified.geojson',LUX:'https://raw.githubusercontent.com/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/LUX/ADM1/geoBoundaries-LUX-ADM1_simplified.geojson',SMR:'https://raw.githubusercontent.com/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/SMR/ADM1/geoBoundaries-SMR-ADM1_simplified.geojson',MLT:'https://raw.githubusercontent.com/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/MLT/ADM1/geoBoundaries-MLT-ADM1_simplified.geojson'};
    const extra=await Promise.all(supplements.map(async ([iso,admin])=>{try{const meta=boundaryIndex.find(x=>x.boundaryISO===iso&&x.boundaryType==='ADM1');const url=meta?.simplifiedGeometryGeoJSON||fallbackGeo[iso];if(!url)return {admin,features:[]};const r=await fetch(url,{cache:'force-cache'});if(!r.ok)return {admin,features:[]};const g=await r.json();return {admin,features:(g.features||[]).map(f=>({...f,properties:{...(f.properties||{}),admin,name:(f.properties||{}).shapeName||(f.properties||{}).name||admin,geonunit:admin,iso_a3:iso}}))}}catch(e){return {admin,features:[]}}}));
    return extra;
   })().then(extra=>{
    const replaced=new Set(extra.filter(x=>x.features.length).map(x=>x.admin));
    regionData.features=(regionData.features||[]).filter(f=>!replaced.has(String((f.properties||{}).admin||(f.properties||{}).ADMIN||(f.properties||{}).geonunit||''))).concat(...extra.map(x=>x.features));
    window.__wcRegionData=regionData;indexRegions();ensureCountryRegionCoverage();refreshRegions();window.dispatchEvent(new Event('wc-regions-loaded'));
    $('map-hint').textContent='Подробные регионы мира и административные единицы Европы загружены.';
   }).catch(()=>{$('map-hint').textContent='Основные регионы загружены; дополнительная детализация Европы недоступна.'});
  })  .catch(()=>{regionsLoading=false;$('map-hint').textContent='Не удалось загрузить слой регионов. Основная карта работает.'});
}
if(window.L){
 map=L.map('map',{zoomControl:true,worldCopyJump:true,minZoom:2,maxZoom:8,preferCanvas:true,zoomSnap:1,zoomDelta:1,wheelDebounceTime:110,wheelPxPerZoomLevel:140,fadeAnimation:false,zoomAnimation:false,markerZoomAnimation:false}).setView([24,12],2);
 canvasRenderer=L.canvas({padding:.35});
 map.createPane('regionsPane');map.getPane('regionsPane').style.zIndex=420;map.createPane('citiesPane');map.getPane('citiesPane').style.zIndex=460;
 regionLayer=L.geoJSON(null,{pane:'regionsPane',renderer:canvasRenderer,style:()=>{const z=map.getZoom();return{color:'#d8c69e',weight:z<3?.35:z<5?.65:.95,opacity:z<3?.35:.72,fillColor:'#d8c69e',fillOpacity:.025}},onEachFeature:(feature,layer)=>{const p=feature.properties||{},name=p.name||p.name_en||p.NAME||p.shapeName||'Регион';layer.bindTooltip(name,{sticky:true,className:'wc-region-tooltip'});layer.on('click',()=>{$('map-hint').textContent='Регион: '+name+' · '+(p.admin||p.ADMIN||p.shapeGroup||'')})}}).addTo(map);
 cityLayer=L.layerGroup([], {pane:'citiesPane'}).addTo(map);
 map.on('moveend zoomend',updateCityVisibility);map.on('zoomend',()=>{if(regionLayer)regionLayer.setStyle(()=>{const z=map.getZoom();return{color:'#d8c69e',weight:z<3?.35:z<5?.65:.95,opacity:z<3?.35:.72,fillColor:'#d8c69e',fillOpacity:.025}})});
 fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',{cache:'force-cache'})
  .then(r=>{if(!r.ok)throw Error('GeoJSON unavailable');return r.json()})
  .then(data=>{
   window.__wcCountryFeatures=data.features||[];
   state.geoLayer=L.geoJSON(data,{renderer:canvasRenderer,style:styleFeature,smoothFactor:4.5,interactive:true,bubblingMouseEvents:false,noClip:true,onEachFeature:(feature,layer)=>{
    const info=getCountryInfo(feature),bounds=layer.getBounds();if(bounds&&bounds.isValid())countryMeta.push({info,bounds,feature});
    layer.on('click',()=>inspectCountry(info.id,feature,info.name,info.flag));
   }}).addTo(map);
   ensureCountryRegionCoverage();
   $('map-hint').textContent='Выберите государство. Цветом обозначены территории стран; регионы и города открываются при приближении.';
   initCityMarkers();updateCityVisibility();
  })
  .catch(()=>$('map-hint').textContent='Не удалось загрузить границы государств — проверьте интернет.');
 requestAnimationFrame(()=>map.invalidateSize({pan:false}));
 window.addEventListener('resize',()=>map.invalidateSize({pan:false}),{passive:true});
}
function modal(title,html){$('modal-title').textContent=title;$('modal-content').innerHTML=html;$('modal-backdrop').classList.remove('hidden')}function closeModal(){$('modal-backdrop').classList.add('hidden')}
function save(){const copy={...state,geoLayer:null};localStorage.setItem(SAVE_KEY,JSON.stringify(copy));$('advisor-text').textContent='Кампания сохранена в этом браузере.'}
function load(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(!s)return false;Object.assign(state,s);state.geoLayer=null;selectCountry(state.selected||'Russia');state.events=[];state.periodArchive=Array.isArray(s.periodArchive)?s.periodArchive:[];window.__replayingEvents=true;(s.events||[]).slice().reverse().forEach(e=>event(e.category,e.title,e.description,e));window.__replayingEvents=false;updateUI();return true}catch(e){return false}}
function resetCampaign(year){Object.assign(state,{year:Number(year),month:0,day:1,turn:1,paused:true,election:null,treasury:120,prestige:45,stability:72,gdp:100,army:68,manpower:75,relations:{'United States of America':15,China:5,Germany:-20,France:20,'United Kingdom':18,Japan:-5},treaties:[],wars:[],laws:[],events:[],periodArchive:[],currentPeriod:null,frontsVisible:true,initiatives:[],pendingOrders:[],armies:[],occupiedRegions:{},aiWorldState:{countries:{},lastSummary:''}});ensureElection();$('scenario-label').textContent=scenarios[year];$('scenario-select').value=String(year);selectCountry('Russia');updateUI();window.WC_WAR?.sync?.();event('ПОЛИТИКА','Кампания началась','Вы вступили в новую эпоху. Судьба государства теперь зависит от ваших решений.');save()}
function initiativeType(text){const s=text.toLowerCase();if(/арм|мобилиз|дивиз|флот|учени|военн|фронт|обор|ракета/.test(s))return 'ВОЕННОЕ ДЕЛО';if(/переговор|посол|договор|соглаш|альянс|нота|диплом/.test(s))return 'ДИПЛОМАТИЯ';if(/завод|промышлен|инфраструкт|инвест|строитель|торгов|эконом|бюджет|налог/.test(s))return 'ЭКОНОМИКА';return 'ПОЛИТИКА'}
function addInitiative(text){const value=String(text||'').trim();if(!value)return null;const category=initiativeType(value),weeks=category==='ЭКОНОМИКА'?5:category==='ВОЕННОЕ ДЕЛО'?3:category==='ДИПЛОМАТИЯ'?2:4;const item={id:'I-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),text:value,category,status:'В очереди',progress:0,weeksLeft:weeks,totalWeeks:weeks,createdTurn:state.turn};state.initiatives=state.initiatives||[];state.initiatives.unshift(item);return item}
function processInitiatives(){const list=state.initiatives||[];for(const x of list){if(x.status==='Завершено'||x.status==='Заблокировано')continue;if(x.status==='В очереди')x.status='В процессе';if(x.category==='ЭКОНОМИКА'&&state.treasury<8){x.status='Сдерживается';continue}if(x.status==='Сдерживается')x.status='В процессе';x.weeksLeft=Math.max(0,(x.weeksLeft||1)-1);x.progress=Math.min(100,Math.round(100*(1-x.weeksLeft/(x.totalWeeks||1))));if(x.weeksLeft===0){x.status='Завершено';x.progress=100;if(x.category==='ЭКОНОМИКА'){state.gdp=Math.min(300,state.gdp+2);state.treasury=Math.max(0,state.treasury-5)}else if(x.category==='ВОЕННОЕ ДЕЛО'){state.army=Math.min(500,state.army+2);state.manpower=Math.max(0,state.manpower-1)}else if(x.category==='ДИПЛОМАТИЯ'){state.prestige=Math.min(100,state.prestige+2)}else{state.stability=Math.min(100,state.stability+1);state.prestige=Math.min(100,state.prestige+1)}event('ИНИЦИАТИВА','Завершена инициатива: '+x.text.slice(0,75),'Инициатива завершена в рамках доступной игровой модели. Категория: '+x.category+'.');}}}
function advanceTurn(){state.turn++;state.day+=7;const days=new Date(state.year,state.month+1,0).getDate();while(state.day>days){state.day-=days;state.month++;if(state.month>11){state.month=0;state.year++}}tickElection();const income=Math.max(1,state.gdp*.055);state.treasury+=income-3-state.wars.length*2;state.stability=Math.max(0,Math.min(100,state.stability+(state.treasury>30?.15:-.45)-(state.wars.length?1.2:0)));state.prestige=Math.max(0,Math.min(100,state.prestige+(state.treaties.length?.1:0)));processInitiatives();updateUI();$('advisor-text').textContent='ИИ анализирует обстановку и готовит решения правительств мира…';save();runWorldAI()}
function countryPicker(){const keys=Object.keys(countries);modal('Выберите государство','<div class="country-picker">'+keys.map(k=>'<button class="country-option" data-country="'+k+'"><strong>'+countries[k].flag+' '+countries[k].name+'</strong><small>Столица: '+countries[k].capital+'</small></button>').join('')+'</div>');document.querySelectorAll('[data-country]').forEach(b=>b.onclick=()=>{selectCountry(b.dataset.country);closeModal();save()})}
function actionButton(label,desc,action){return '<button class="game-action" data-game-action="'+action+'"><strong>'+label+'</strong><small>'+desc+'</small><span>→</span></button>'}
function section(title,sub,content){modal(title,'<p class="modal-intro">'+sub+'</p><div class="game-panel-content">'+content+'</div>')}
function diplomacy(){const names=Object.keys(countries).filter(k=>k!==state.selected);const html=names.map(k=>{const r=state.relations[k]||0,status=r>=50?'Союзные отношения':r>=15?'Дружественные':r<=-40?'Напряжённые':'Нейтральные';return '<div class="country-row"><span class="country-row-flag">'+countries[k].flag+'</span><span class="country-row-name"><b>'+countries[k].name+'</b><small>'+status+' · '+(r>0?'+':'')+r+'</small></span><button class="mini-action" data-dip="'+k+'">Переговоры</button></div>'}).join('');section('Дипломатия','Выстраивайте отношения, заключайте договоры и формируйте союзы.','<div class="metric-strip"><div><small>ДОГОВОРЫ</small><b>'+state.treaties.length+'</b></div><div><small>ВОЙНЫ</small><b>'+state.wars.length+'</b></div><div><small>ПРЕСТИЖ</small><b>'+fmt(state.prestige)+'</b></div></div>'+html);document.querySelectorAll('[data-dip]').forEach(b=>b.onclick=()=>diplomacyTalk(b.dataset.dip))}
function diplomacyTalk(id){const c=countries[id];modal('Переговоры: '+c.name,'<p>Выберите дипломатическую инициативу в отношении '+c.name+'.</p><div class="game-panel-content">'+actionButton('Направить дипломатическую ноту','Отношения +5 · ₽ 2 млрд','note')+actionButton('Предложить торговое соглашение','Отношения +12 · ₽ 8 млрд','trade')+actionButton('Предложить пакт о ненападении','Отношения +18 · ₽ 5 млрд','pact')+actionButton('Отозвать посла','Отношения −15 · престиж −2','recall')+'</div>');document.querySelectorAll('[data-game-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.gameAction;let cost=2,delta=5;if(a==='trade'){cost=8;delta=12}else if(a==='pact'){cost=5;delta=18}else if(a==='recall'){cost=0;delta=-15;state.prestige-=2}if(state.treasury<cost){alert('Недостаточно средств в казне.');return}state.treasury-=cost;state.relations[id]=(state.relations[id]||0)+delta;if(a==='pact')state.treaties.push(id);event('ДИПЛОМАТИЯ',(a==='recall'?'Отозван посол':a==='trade'?'Торговое соглашение предложено':a==='pact'?'Пакт о ненападении предложен':'Дипломатическая нота направлена')+': '+c.name,'Изменение отношений: '+(delta>0?'+':'')+delta+'.');updateUI();save();diplomacy()})}
function economy(){section('Экономика','Управляйте государственными финансами, промышленностью и налоговой политикой.','<div class="metric-strip"><div><small>КАЗНА</small><b>₽ '+fmt(state.treasury)+' млрд</b></div><div><small>ИНДЕКС ВВП</small><b>'+fmt(state.gdp)+'</b></div><div><small>СТАБИЛЬНОСТЬ</small><b>'+fmt(state.stability)+'%</b></div></div><h3 class="subhead">Государственные инвестиции</h3>'+actionButton('Инфраструктурная программа','Стоимость ₽ 15 млрд · ВВП +8','infrastructure')+actionButton('Поддержка промышленности','Стоимость ₽ 20 млрд · ВВП +12','industry')+actionButton('Образование и наука','Стоимость ₽ 12 млрд · престиж +8, ВВП +4','education')+'<h3 class="subhead">Налоговая политика</h3>'+actionButton('Снизить налоги','Казна −₽ 5 млрд · стабильность +7','taxcut')+actionButton('Повысить налоги','Казна +₽ 10 млрд · стабильность −6','taxraise'));document.querySelectorAll('[data-game-action]').forEach(b=>b.onclick=()=>economyAction(b.dataset.gameAction))}
function economyAction(a){const data={infrastructure:[15,()=>state.gdp+=8,'Инфраструктурная программа запущена'],industry:[20,()=>state.gdp+=12,'Программа поддержки промышленности утверждена'],education:[12,()=>{state.prestige+=8;state.gdp+=4},'Увеличено финансирование образования и науки'],taxcut:[5,()=>state.stability=Math.min(100,state.stability+7),'Налоговая нагрузка снижена'],taxraise:[-10,()=>state.stability=Math.max(0,state.stability-6),'Налоги повышены']};const [cost,fn,title]=data[a];if(state.treasury<cost){alert('Недостаточно средств в казне.');return}state.treasury-=cost;fn();event('ЭКОНОМИКА',title,'Решение вступило в силу. Его последствия отражены в показателях государства.');updateUI();save();economy()}
function military(){section('Вооружённые силы','Формируйте армию, укрепляйте оборону и поддерживайте боеготовность.','<div class="metric-strip"><div><small>ЛИЧНЫЙ СОСТАВ</small><b>'+fmt(state.army)+' тыс.</b></div><div><small>РЕЗЕРВ</small><b>'+fmt(state.manpower)+' тыс.</b></div><div><small>ПРЕСТИЖ</small><b>'+fmt(state.prestige)+'</b></div></div><h3 class="subhead">Военные программы</h3>'+actionButton('Объявить набор','Стоимость ₽ 10 млрд · армия +8 тыс.','recruit')+actionButton('Модернизация вооружения','Стоимость ₽ 18 млрд · престиж +7','modernize')+actionButton('Военные учения','Стоимость ₽ 7 млрд · престиж +5, стабильность +2','drills')+actionButton('Укрепить границы','Стоимость ₽ 12 млрд · стабильность +3','border'));document.querySelectorAll('[data-game-action]').forEach(b=>b.onclick=()=>militaryAction(b.dataset.gameAction))}
function militaryAction(a){const data={recruit:[10,()=>{state.army+=8;state.manpower=Math.max(0,state.manpower-8)},'Начат набор военнослужащих'],modernize:[18,()=>state.prestige+=7,'Программа модернизации вооружения утверждена'],drills:[7,()=>{state.prestige+=5;state.stability=Math.min(100,state.stability+2)},'Проведены общегосударственные военные учения'],border:[12,()=>state.stability=Math.min(100,state.stability+3),'Утверждена программа укрепления границ']};const [cost,fn,title]=data[a];if(state.treasury<cost){alert('Недостаточно средств в казне.');return}state.treasury-=cost;fn();event('ВОЕННОЕ ДЕЛО',title,'Военное ведомство приступило к исполнению распоряжения.');updateUI();save();military()}

const PARTY_TEMPLATES=[
 {id:'civic',name:'Партия национального развития',short:'ПНР',ideology:'Центризм · государственное развитие',color:'#c5a15c',support:28,leader:'Александр Волков'},
 {id:'social',name:'Социал-демократический союз',short:'СДС',ideology:'Социал-демократия',color:'#c65b62',support:24,leader:'Мария Орлова'},
 {id:'liberal',name:'Либеральная партия',short:'ЛП',ideology:'Либерализм · реформы',color:'#5795c9',support:19,leader:'Дмитрий Соколов'},
 {id:'conservative',name:'Консервативный союз',short:'КС',ideology:'Консерватизм · традиции',color:'#6e83aa',support:17,leader:'Павел Миронов'},
 {id:'green',name:'Зелёная альтернатива',short:'ЗА',ideology:'Экология · региональная политика',color:'#5b9b79',support:12,leader:'Елена Белова'}
];
const PROMISES=[
 {id:'jobs',name:'Новые рабочие места',detail:'Поддержка занятости и промышленности'},
 {id:'pensions',name:'Повышение пенсий',detail:'Рост социальных расходов'},
 {id:'tax',name:'Снижение налоговой нагрузки',detail:'Стимулирование бизнеса'},
 {id:'education',name:'Доступное образование',detail:'Инвестиции в школы и университеты'},
 {id:'regions',name:'Развитие регионов',detail:'Инфраструктура и местное самоуправление'},
 {id:'security',name:'Безопасность и оборона',detail:'Усиление правоохранительных органов и армии'}
];
function ensureElection(){
 if(!state.election||!Array.isArray(state.election.parties)){
  state.election={parties:PARTY_TEMPLATES.map(p=>({...p})),playerParty:'civic',phase:'waiting',nextYear:state.year+4,campaignWeeks:0,turnout:64,promises:[],system:'dhondt',results:null,government:null,debateDone:false,lawHistory:[]};
 }
 const e=state.election;
 e.parties.forEach(p=>{const t=PARTY_TEMPLATES.find(x=>x.id===p.id);if(t){p.color=t.color;p.short=t.short;p.ideology=t.ideology;p.leader=p.leader||t.leader}});
 if(!e.parties.some(p=>p.id===e.playerParty))e.playerParty=e.parties[0]?.id||'civic';
 if(!e.promises)e.promises=[];if(!e.lawHistory)e.lawHistory=[];
 return e;
}
function partyById(id){return ensureElection().parties.find(p=>p.id===id)}
function normalizeSupport(){
 const ps=ensureElection().parties;const sum=ps.reduce((n,p)=>n+Math.max(0,p.support),0)||1;
 ps.forEach(p=>p.support=Math.max(0,p.support)*100/sum);
}
function electionAction(action){
 const e=ensureElection(),p=partyById(e.playerParty);if(!p)return;
 if(['results','government'].includes(e.phase)&&['rally','media','field','debate','promise'].includes(action)){alert('Избирательная кампания завершена. Эти действия будут доступны перед следующими выборами.');return}
 const actions={
  rally:{cost:6,boost:2.4,turnout:1.2,title:'Проведён предвыборный митинг',desc:'Партия встретилась с избирателями и представила программу.'},
  media:{cost:8,boost:2.1,turnout:.4,title:'Запущена информационная кампания',desc:'Рекламные материалы партии размещены в общенациональных СМИ.'},
  field:{cost:5,boost:1.8,turnout:1.8,title:'Развёрнуты региональные штабы',desc:'В регионах открыты волонтёрские и агитационные штабы.'}
 };
 if(action==='debate'){
  if(e.debateDone){alert('В этих выборах дебаты уже состоялись.');return}
  p.support+=3.2;const rival=e.parties.filter(x=>x.id!==p.id).sort((a,b)=>b.support-a.support)[0];if(rival)rival.support=Math.max(1,rival.support-.8);
  e.debateDone=true;e.turnout=Math.min(90,e.turnout+1.5);event('ВЫБОРЫ','Состоялись общенациональные теледебаты','Выступление лидера '+p.name+' укрепило позиции партии.');normalizeSupport();save();elections();return;
 }
 if(action==='promise'){
  const id=$('promise-select')?.value,issue=PROMISES.find(x=>x.id===id);
  if(!issue){alert('Выберите предвыборное обещание.');return}
  if(e.promises.some(x=>x.id===id)){alert('Это обещание уже включено в программу.');return}
  e.promises.push(issue);p.support+=1.1;normalizeSupport();event('ВЫБОРЫ','В программу включено обещание: '+issue.name,issue.detail+'.');save();elections();return;
 }
 if(action==='early'){
  if(e.phase==='campaign'){alert('Предвыборная кампания уже идёт.');return}
  e.phase='campaign';e.campaignWeeks=8;e.nextYear=state.year;e.debateDone=false;e.results=null;
  event('ВЫБОРЫ','Назначены досрочные парламентские выборы','Началась восьминедельная предвыборная кампания.');save();elections();return;
 }
 if(action==='vote'){
  if(e.phase!=='campaign'){alert('Голосование пока не назначено. Сначала начните предвыборную кампанию.');return}
  conductElection();save();elections();return;
 }
 if(action==='coalition'){
  if(!e.results){alert('Сначала должны состояться выборы.');return}
  const chosen=Array.from(document.querySelectorAll('[data-coalition-party]:checked')).map(x=>x.dataset.coalitionParty);
  if(!chosen.includes(e.playerParty))chosen.unshift(e.playerParty);
  const seats=chosen.reduce((n,id)=>n+(e.results.seats[id]||0),0);
  if(seats<Math.floor(e.results.totalSeats/2)+1){alert('Для формирования правительства не хватает большинства. Выберите дополнительные партии для коалиции.');return}
  e.government={parties:chosen,seats,leader:e.playerParty,formedYear:state.year};
  e.phase='government';state.stability=Math.min(100,state.stability+4);state.prestige=Math.min(100,state.prestige+2);
  event('ПРАВИТЕЛЬСТВО','Сформирована парламентская коалиция','Правительство получило поддержку '+seats+' из '+e.results.totalSeats+' депутатов.');updateUI();save();elections();return;
 }
 if(action==='bill'){
  if(!e.government){alert('Сначала сформируйте парламентское большинство и правительство.');return}
  const bills={
   economy:{name:'Закон о промышленном развитии',cost:12,apply:()=>{state.gdp+=9;state.stability+=1}},
   social:{name:'Закон о социальной поддержке',cost:15,apply:()=>{state.stability+=5;state.gdp+=2}},
   regions:{name:'Закон о развитии регионов',cost:10,apply:()=>{state.gdp+=4;state.prestige+=4}}
  };
  const b=bills[$('bill-select')?.value];if(!b)return;
  if(state.treasury<b.cost){alert('Недостаточно средств в казне для реализации программы.');return}
  const votes=e.government.seats+Math.round((e.results.totalSeats-e.government.seats)*.22);
  if(votes<=e.results.totalSeats/2){alert('Законопроект отклонён парламентом.');return}
  state.treasury-=b.cost;b.apply();state.stability=Math.min(100,state.stability);state.gdp=Math.max(1,state.gdp);e.lawHistory.unshift(b.name);
  event('ПАРЛАМЕНТ','Принят закон: '+b.name,'За законопроект проголосовало '+votes+' депутатов.');updateUI();save();elections();return;
 }
 const cfg=actions[action];if(!cfg)return;
 if(e.phase==='results'||e.phase==='government'){alert('Избирательная кампания завершена. Назначьте досрочные выборы для новых агитационных действий.');return}
 if(state.treasury<cfg.cost){alert('Недостаточно средств в казне.');return}
 state.treasury-=cfg.cost;p.support+=cfg.boost;normalizeSupport();
 event('ВЫБОРЫ',cfg.title,cfg.desc+' Поддержка партии выросла.');updateUI();save();elections();
}
function allocateSeats(parties,total,system){
 const eligible=parties.filter(p=>p.support>=5),seats={};eligible.forEach(p=>seats[p.id]=0);if(!eligible.length)return seats;
 if(system==='majoritarian'){
  const weights=eligible.map(p=>({...p,w:Math.pow(p.support,1.22)})),sum=weights.reduce((n,p)=>n+p.w,0);let used=0;
  weights.forEach(p=>{seats[p.id]=Math.floor(total*p.w/sum);used+=seats[p.id]});
  while(used<total){const p=weights.reduce((a,b)=>(seats[a.id]+1)/a.w<(seats[b.id]+1)/b.w?a:b);seats[p.id]++;used++}return seats;
 }
 for(let i=0;i<total;i++){
  let best=null,bestQ=-1;
  for(const p of eligible){const d=system==='sainte'?2*seats[p.id]+1:seats[p.id]+1,q=p.support/d;if(q>bestQ){bestQ=q;best=p}}
  if(best)seats[best.id]++;
 }
 return seats;
}
function conductElection(){
 const e=ensureElection();normalizeSupport();const totalSeats=450,seats=allocateSeats(e.parties,totalSeats,e.system);
 const votes=e.parties.map(p=>({id:p.id,name:p.name,support:p.support,seats:seats[p.id]||0,color:p.color})).sort((a,b)=>b.support-a.support);
 e.results={year:state.year,turnout:Math.round(e.turnout),totalSeats,seats,votes};e.phase='results';e.campaignWeeks=0;e.nextYear=state.year+4;
 const winner=votes[0];event('ВЫБОРЫ','Объявлены результаты парламентских выборов',winner.name+' получила '+winner.support.toFixed(1)+'% голосов и '+winner.seats+' мест в парламенте.');updateUI();
}
function tickElection(){
 const e=ensureElection();
 if(['waiting','results','government'].includes(e.phase)&&state.year>=e.nextYear){e.phase='campaign';e.campaignWeeks=8;e.debateDone=false;e.results=null;e.government=null;e.promises=[];event('ВЫБОРЫ','Началась предвыборная кампания','До голосования осталось восемь недель.')}
 else if(e.phase==='campaign'){e.campaignWeeks=Math.max(0,e.campaignWeeks-1);if(e.campaignWeeks===0)conductElection()}
}
function elections(){
 const e=ensureElection(),majority=e.results?Math.floor(e.results.totalSeats/2)+1:226;
 const rows=e.parties.slice().sort((a,b)=>b.support-a.support).map(x=>{
  const seats=e.results?.seats?.[x.id]||0;
  return '<div class="party-row"><span class="party-color" style="background:'+x.color+'"></span><div class="party-main"><strong>'+x.name+'</strong><small>'+x.ideology+' · '+x.leader+'</small><div class="party-meter"><i style="width:'+Math.max(0,Math.min(100,x.support))+'%;background:'+x.color+'"></i></div></div><b class="party-percent">'+x.support.toFixed(1)+'%'+(e.results?'<small>'+seats+' мест</small>':'')+'</b></div>'
 }).join('');
 const phaseText={waiting:'До очередных выборов',campaign:'Предвыборная кампания',results:'Итоги голосования',government:'Действующее правительство'}[e.phase];
 const status=e.phase==='waiting'?'Очередные выборы запланированы на '+e.nextYear+' год. Можно назначить досрочное голосование.':e.phase==='campaign'?'До дня голосования: '+e.campaignWeeks+' недель.':e.phase==='results'?'Выборы завершены. Необходимо сформировать парламентское большинство.':'Правительство сформировано. Парламент рассматривает законопроекты.';
 let resultHtml='';
 if(e.results){
  resultHtml='<h3 class="subhead">Распределение мест в парламенте</h3>'+e.results.votes.map(v=>'<div class="seat-row"><span><i style="background:'+v.color+'"></i>'+v.name+'</span><b>'+v.seats+'</b></div>').join('')+
  '<p class="election-note">Явка: '+e.results.turnout+'% · '+e.results.totalSeats+' депутатов · большинство: '+majority+' мест.</p>';
 }
 let coalitionHtml='';
 if(e.results&&!e.government){
  coalitionHtml='<h3 class="subhead">Переговоры о коалиции</h3><p class="election-note">Отметьте партии, готовые войти в правительство. Ваша партия включена автоматически.</p>'+
  e.parties.filter(x=>x.id!==e.playerParty).map(x=>'<label class="coalition-option"><input type="checkbox" data-coalition-party="'+x.id+'"> <span class="party-color" style="background:'+x.color+'"></span>'+x.name+' <b>'+(e.results.seats[x.id]||0)+' мест</b></label>').join('')+
  '<button class="modal-submit" data-election-action="coalition">Сформировать коалиционное правительство</button>';
 }
 let governmentHtml='';
 if(e.government){
  governmentHtml='<h3 class="subhead">Парламент и правительство</h3><div class="government-card"><strong>Коалиционное правительство</strong><span>'+e.government.parties.map(id=>partyById(id)?.short||id).join(' + ')+' · '+e.government.seats+' / '+e.results.totalSeats+' мест</span></div>'+
  '<label class="election-label">Законопроект для голосования</label><select class="modal-input" id="bill-select"><option value="economy">Закон о промышленном развитии · ₽12 млрд</option><option value="social">Закон о социальной поддержке · ₽15 млрд</option><option value="regions">Закон о развитии регионов · ₽10 млрд</option></select>'+
  '<button class="modal-submit" data-election-action="bill">Внести законопроект и провести голосование</button><p class="election-note">Принятые законы влияют на экономику, стабильность и престиж государства.</p>';
 }
 const controls=[
 '<h3 class="subhead">Партия, которую вы возглавляете</h3><label class="election-label">Выберите политическую силу</label>',
 '<select class="modal-input" id="player-party-select">',e.parties.map(x=>'<option value="'+x.id+'" '+(x.id===e.playerParty?'selected':'')+'>'+x.name+'</option>').join(''),'</select>',
 '<h3 class="subhead">Избирательная система</h3><select class="modal-input" id="electoral-system">',
 '<option value="dhondt" '+(e.system==='dhondt'?'selected':'')+'>Пропорциональная · Д’Ондт</option><option value="sainte" '+(e.system==='sainte'?'selected':'')+'>Пропорциональная · Сент-Лагю</option><option value="majoritarian" '+(e.system==='majoritarian'?'selected':'')+'>Мажоритарная · округа</option></select>',
 '<div class="election-actions">',
 actionButton('Предвыборный митинг','Стоимость ₽ 6 млрд · поддержка +2,4 п.п.','rally').replace('data-game-action','data-election-action'),
 actionButton('Медиа-кампания','Стоимость ₽ 8 млрд · поддержка +2,1 п.п.','media').replace('data-game-action','data-election-action'),
 actionButton('Региональные штабы','Стоимость ₽ 5 млрд · поддержка +1,8 п.п.','field').replace('data-game-action','data-election-action'),
 actionButton('Теледебаты','Поддержка +3,2 п.п. · один раз за кампанию','debate').replace('data-game-action','data-election-action'),'</div>',
 '<h3 class="subhead">Предвыборная программа</h3><select class="modal-input" id="promise-select">',
 PROMISES.map(x=>'<option value="'+x.id+'">'+x.name+'</option>').join(''),'</select>',
 '<button class="modal-submit secondary-submit" data-election-action="promise">Добавить обещание в программу</button>',
 e.promises.length?'<div class="promise-list">'+e.promises.map(x=>'<span>✓ '+x.name+'</span>').join('')+'</div>':'',
 e.phase==='waiting'?'<button class="modal-submit" data-election-action="early">Назначить досрочные выборы · 8 недель кампании</button>':'',
 e.phase==='campaign'?'<button class="modal-submit" data-election-action="vote">Провести голосование сейчас</button>':''
 ].join('');
 const intro='<div class="metric-strip"><div><small>СТАТУС</small><b>'+phaseText+'</b></div><div><small>ЯВКА В ПРОГНОЗЕ</small><b>'+Math.round(e.turnout)+'%</b></div><div><small>СЛЕДУЮЩИЕ ВЫБОРЫ</small><b>'+e.nextYear+'</b></div></div><p class="election-note">'+status+'</p>';
 section('Выборы и парламент','Политическая система государства: партии, рейтинги, кампания, голосование и формирование правительства.',intro+'<h3 class="subhead">Рейтинг политических партий</h3><div class="party-list">'+rows+'</div>'+resultHtml+controls+coalitionHtml+governmentHtml);
 $('player-party-select').onchange=x=>{e.playerParty=x.target.value;save();elections()};
 $('electoral-system').onchange=x=>{e.system=x.target.value;save();elections()};
 document.querySelectorAll('[data-election-action]').forEach(b=>b.onclick=()=>electionAction(b.dataset.electionAction));
}

function politics(){const laws=['Закон о развитии регионов','Программа доступного жилья','Реформа государственного управления','Закон о поддержке семьи','Антикоррупционная программа'];section('Внутренняя политика','Принимайте законы, проводите реформы и укрепляйте легитимность власти.','<div class="metric-strip"><div><small>СТАБИЛЬНОСТЬ</small><b>'+fmt(state.stability)+'%</b></div><div><small>ПРЕСТИЖ</small><b>'+fmt(state.prestige)+'</b></div><div><small>ПРИНЯТО ЗАКОНОВ</small><b>'+state.laws.length+'</b></div></div><h3 class="subhead">Законодательные инициативы</h3>'+laws.map((l,i)=>actionButton(l,'Стоимость ₽ '+[8,12,10,9,14][i]+' млрд · общественный эффект','law'+i)).join('')+'<h3 class="subhead">Государственный аппарат</h3>'+actionButton('Кадровая реформа','Стоимость ₽ 6 млрд · престиж +6','bureaucracy'));document.querySelectorAll('[data-game-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.gameAction;if(a==='bureaucracy'){if(state.treasury<6){alert('Недостаточно средств.');return}state.treasury-=6;state.prestige+=6;event('ПОЛИТИКА','Начата кадровая реформа','Государственный аппарат ожидает обновление.')}else{const i=Number(a.slice(3)),cost=[8,12,10,9,14][i];if(state.treasury<cost){alert('Недостаточно средств.');return}state.treasury-=cost;state.laws.push(laws[i]);state.stability=Math.min(100,state.stability+[3,5,2,6,1][i]);state.prestige+=2;event('ПОЛИТИКА','Принят закон: '+laws[i],'Законодательная инициатива утверждена и направлена на исполнение.')}updateUI();save();politics()})}
function decree(){modal('Государственный указ','<p>Подготовьте распоряжение главы государства. Указ повлияет на внутреннюю обстановку.</p><input class="modal-input" id="decree-title" maxlength="90" placeholder="Название указа"><textarea class="modal-input" id="decree-text" rows="3" placeholder="Содержание и цели указа"></textarea><button class="modal-submit" id="publish-decree">Подписать указ</button>');$('publish-decree').onclick=()=>{const t=$('decree-title').value.trim(),d=$('decree-text').value.trim();if(!t||!d){alert('Заполните название и содержание указа.');return}state.stability=Math.min(100,state.stability+1);state.prestige++;event('ПОЛИТИКА','Подписан указ: '+t,d);updateUI();save();closeModal()}}
function speech(){modal('Обращение к нации','<p>Подготовьте публичное обращение. Содержание будет опубликовано в хронике и повысит престиж государства.</p><input class="modal-input" id="speech-title" maxlength="90" placeholder="Тема обращения"><textarea class="modal-input" id="speech-text" rows="4" placeholder="Текст обращения к гражданам"></textarea><button class="modal-submit" id="publish-speech">Опубликовать обращение</button>');$('publish-speech').onclick=()=>{const t=$('speech-title').value.trim(),d=$('speech-text').value.trim();if(!t||!d){alert('Заполните тему и текст обращения.');return}state.prestige=Math.min(100,state.prestige+3);state.stability=Math.min(100,state.stability+1);event('ПОЛИТИКА','Обращение к нации: '+t,d);updateUI();save();closeModal()}}
function syncTimer(){if(window.gameTimer)clearInterval(window.gameTimer);if(!state.paused)window.gameTimer=setInterval(advanceTurn,Math.max(2500,15000/state.speed))}
$('choose-country').onclick=countryPicker;$('scenario-select').onchange=e=>resetCampaign(e.target.value);$('next-turn').onclick=()=>{playSound('turn');advanceTurn()};$('pause-button').onclick=()=>{state.paused=!state.paused;$('pause-button').classList.toggle('paused',state.paused);$('pause-button').textContent=state.paused?'Ⅱ ПАУЗА':'▶ ИГРА';syncTimer();save()};
document.querySelectorAll('.speed-button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.speed-button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.speed=Number(b.dataset.speed);syncTimer()});
$('reset-map').onclick=()=>map&&map.setView([24,12],2);
$('regions-toggle').onclick=()=>{state.regionsVisible=!state.regionsVisible;$('regions-toggle').classList.toggle('active',state.regionsVisible);if(state.regionsVisible){loadRegions();refreshRegions()}else if(regionLayer)regionLayer.clearLayers()};
$('cities-toggle').onclick=()=>{state.citiesVisible=!state.citiesVisible;$('cities-toggle').classList.toggle('active',state.citiesVisible);updateCityVisibility()};
$('political-view').onclick=()=>{if(state.geoLayer)state.geoLayer.setStyle(styleFeature);event('ПОЛИТИКА','Политическая карта активна','Территории государств окрашены по политической принадлежности.')};
$('help-btn').onclick=()=>modal('World Chronicle — справка','<p>Вы руководите государством в альтернативной исторической песочнице. Один ход равен одной неделе. Решения меняют казну, экономику, стабильность, престиж и военную мощь.</p><p>Кампания автоматически сохраняется в локальном хранилище этого браузера. Используйте разделы слева для управления страной.</p>');
$('sound-toggle').onclick=()=>setSoundEnabled(!soundEnabled);setSoundEnabled(soundEnabled);$('modal-close').onclick=closeModal;$('wc-news-close').onclick=closeNewsDrawer;$('wc-news-scrim').onclick=closeNewsDrawer;$('wc-news-period').onchange=e=>renderNewsDrawer(e.target.value);$('wc-news-show-all').onclick=()=>{const s=$('wc-news-period');if(s){s.value='all';renderNewsDrawer('all')}};$('wc-front-toggle').onclick=()=>window.WC_WAR?.toggleFronts?.();document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNewsDrawer()});$('event-continue').onclick=closeChronicleEvent;$('event-overlay').onclick=e=>{if(e.target===$('event-overlay'))closeChronicleEvent()};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeChronicleEvent()});$('modal-backdrop').onclick=e=>{if(e.target===$('modal-backdrop'))closeModal()};
document.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('#sound-toggle')&&!e.target.closest('#next-turn'))playSound('click');const nav=e.target.closest('.nav-item');if(nav){document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));nav.classList.add('active');const pages={overview:closeModal,diplomacy,economy,military,politics,elections};if(pages[nav.dataset.action])pages[nav.dataset.action]()}const a=e.target.closest('.action-card');if(a){if(a.dataset.action==='decree')decree();if(a.dataset.action==='speech')speech()}});
load();state.regionsVisible=true;state.armies=state.armies||[];state.occupiedRegions=state.occupiedRegions||{};ensureElection();if(state.regionsVisible){$('regions-toggle').classList.add('active');loadRegions()}if(!state.events.length)event('ПОЛИТИКА','Кампания готова к началу','Выберите направление развития государства и сделайте первый ход.');selectCountry(state.selected||'Russia');updateUI();


// Map-first command dock: local simulation log, existing diplomacy and advisor systems.
(function(){
 const body=document.getElementById('pax-dock-body');
 const tabs=[...document.querySelectorAll('.pax-tab')];
 function showTab(tab){
  tabs.forEach(x=>x.classList.toggle('active',x.dataset.paxTab===tab));
  if(tab==='actions'){
   body.innerHTML='<div class="pax-compose"><textarea id="pax-action-input" placeholder="Опишите действия вашего государства..."></textarea><div class="pax-compose-foot"><span>Приказы государства · фиксируются в хронике</span><button id="pax-submit-action">Отправить приказ ↗</button></div></div>';
   document.getElementById('pax-submit-action').onclick=submitAction;
  } else if(tab==='chat'){
   body.innerHTML='<div class="pax-chat-empty">Выберите государство на карте или откройте раздел «Дипломатия», чтобы начать переговоры. Переписка и дипломатические инициативы доступны через существующую систему игры.<br><button id="pax-open-diplomacy" class="mini-action" style="margin-top:9px">Открыть дипломатию →</button></div>';
   document.getElementById('pax-open-diplomacy').onclick=()=>{diplomacy();};
  } else if(tab==='advisor'){
   body.innerHTML='<div class="pax-chat-empty"><b>Советник государства</b><br><span id="pax-advisor-copy">'+(document.getElementById('advisor-text')?.textContent||'Советник готов предоставить сводку.')+'</span><br><button id="pax-advisor-refresh" class="mini-action" style="margin-top:9px">Обновить оценку</button></div>';
   document.getElementById('pax-advisor-refresh').onclick=()=>{const t=document.getElementById('advisor-text')?.textContent||'Показатели государства стабильны.';document.getElementById('pax-advisor-copy').textContent=t;};
  } else {
   body.innerHTML='<div class="pax-chat-empty" id="pax-chronicle-copy">Последние события кампании отображаются в панели хроники справа. Нажмите на событие, чтобы следить за развитием ситуации.</div>';
   const panel=document.querySelector('.right-panel');if(panel)panel.style.display='block';
  }
 }
 function submitAction(){
  const input=document.getElementById('pax-action-input');const value=input?.value.trim();if(!value){alert('Опишите приказ перед отправкой.');return;}
  event('ПРИКАЗ ГОСУДАРСТВА','Новый приказ: '+value.slice(0,90),value+' Приказ внесён в журнал решений и будет учтён при дальнейшем ходе кампании.');
  input.value='';save();
 }
 tabs.forEach(t=>t.addEventListener('click',()=>showTab(t.dataset.paxTab)));
 document.getElementById('pax-submit-action')?.addEventListener('click',submitAction);
})();

/* Floating edge interface: orders, diplomacy, operations, country and advisor */
(function(){
 const drawer=document.getElementById('pax-drawer'),content=document.getElementById('pax-drawer-content'),title=document.getElementById('pax-drawer-title');
 let target=null;const chats={};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const current=()=>countries[state.selected]||{name:state.selected,capital:'Не определена',flag:'🏳️',population:'—',economy:'Нет данных',stability:50,military:'—'};
 function open(kind){drawer.classList.remove('country-open');drawer.classList.remove('hidden');document.querySelectorAll('.pax-float-button').forEach(b=>b.classList.toggle('active',b.dataset.paxPanel===kind));
 if(kind==='actions'){title.textContent='Центр приказов';content.innerHTML='<div class="wc-order-intro"><span class="wc-order-kicker">ВЕРХОВНОЕ УПРАВЛЕНИЕ</span><b>Отдайте распоряжение своими словами</b><p>ИИ разберёт приказ, а игровой движок проверит ресурсы, состав армии, географию и доступность операции. Исполнение произойдёт при продолжении времени.</p></div><textarea id="pax-order" class="wc-order-input" placeholder="Например: сформируй танковую дивизию «Стальной кулак», затем перебрось 1-ю пехотную дивизию в соседний регион Смоленск."></textarea><div class="wc-order-examples"><span>ПРИМЕРЫ ПРИКАЗОВ</span><button type="button" data-order-example="Сформировать пехотную дивизию «1-я гвардейская»">+ Сформировать дивизию</button><button type="button" data-order-example="Провести мобилизацию резерва на 10 тысяч человек">+ Мобилизация</button><button type="button" data-order-example="Запустить программу промышленного развития">+ Промышленность</button><button type="button" data-order-example="Передислоцировать 1-ю дивизию в соседний регион Смоленск">+ Передислокация</button><button type="button" data-order-example="Начать наступление на соседний регион Минск силами 1-й дивизии">+ Наступление</button><button type="button" data-order-example="Увеличить расходы на оборону в два раза">+ Военный бюджет</button></div><div class="wc-order-actions"><button class="pax-secondary" id="pax-ideas">Помощь советника</button><button class="pax-primary" id="pax-send">Добавить приказ в план ↗</button></div><div class="wc-order-footnote">ПРИКАЗЫ СОБИРАЮТСЯ В ОДИН ПЛАН · ИСПОЛНЕНИЕ ПРОВЕРЯЕТСЯ ПО ИГРОВОМУ СОСТОЯНИЮ</div><div id="pax-orders" style="margin-top:12px"></div>';
 content.querySelectorAll('[data-order-example]').forEach(b=>b.addEventListener('click',()=>{const input=document.getElementById('pax-order');input.value=b.dataset.orderExample;input.focus()}));
 document.getElementById('pax-ideas').onclick=()=>document.getElementById('pax-order').value='Подготовить комплексный государственный план: укрепить экономику, повысить устойчивость общества, оценить оборонные потребности и представить конкретные этапы с учётом казны и людских ресурсов.';
 document.getElementById('pax-send').onclick=async()=>{const v=document.getElementById('pax-order').value.trim();if(!v)return alert('Напишите приказ.');const btn=document.getElementById('pax-send');btn.disabled=true;btn.textContent='ИИ анализирует приказ…';try{const parsed=await wcAiRequest('order',{order:v,world:wcAiSnapshot()});const normalized=String(parsed.initiative||v).slice(0,500);addInitiative(normalized);event('ПРИКАЗ','ИИ подготовил проект исполнения',String(parsed.explanation||normalized).slice(0,500));document.getElementById('pax-order').value='';renderOrders();save()}catch(err){addInitiative(v);event('ПРИКАЗ','Приказ зарегистрирован без ИИ',v+' · '+err.message);renderOrders();save()}finally{btn.disabled=false;btn.textContent='Отправить приказ ↗'}};
 renderOrders();
 }else if(kind==='chat'){title.textContent='Дипломатический чат';const opts=Object.keys(countries).filter(k=>k!==state.selected);content.innerHTML='<label style="font-size:10px;color:#9fa8b2">СОБЕСЕДНИК</label><select id="pax-target">'+opts.map(k=>'<option value="'+esc(k)+'">'+countries[k].flag+' '+esc(countries[k].name)+'</option>').join('')+'</select><div id="pax-chat-log" style="max-height:220px;overflow:auto;margin:10px 0"></div><textarea id="pax-chat-text" placeholder="Ваше дипломатическое сообщение..."></textarea><button class="pax-primary" id="pax-chat-send">Отправить сообщение</button><p style="font-size:9px;color:#89939e">Ответы правительств формируются ИИ после подключения игрового сервера.</p>';
 const sel=document.getElementById('pax-target');if(target&&countries[target]&&target!==state.selected)sel.value=target;target=sel.value;sel.onchange=()=>{target=sel.value;renderChat()};renderChat();
 document.getElementById('pax-chat-send').onclick=async()=>{const v=document.getElementById('pax-chat-text').value.trim();if(!v)return;const peer=target;chats[peer]=chats[peer]||[];chats[peer].push({from:'Вы',text:v});document.getElementById('pax-chat-text').value='';renderChat();event('ДИПЛОМАТИЯ','Сообщение направлено: '+countries[peer].name,v);save();try{const reply=await wcAiRequest('diplomacy',{countryId:peer,countryName:countries[peer]?.name||peer,message:v,world:wcAiSnapshot(),history:chats[peer].slice(-8)});chats[peer].push({from:countries[peer]?.name||peer,text:String(reply.reply||'Правительство изучит ваше предложение.').slice(0,1800)});if(reply.relationDelta)state.relations[peer]=Math.max(-100,Math.min(100,Number(state.relations[peer]||0)+Math.max(-5,Math.min(5,Number(reply.relationDelta)))));renderChat();event('ДИПЛОМАТИЯ','Ответ получен от '+(countries[peer]?.name||peer),String(reply.reply||'').slice(0,500));save()}catch(err){chats[peer].push({from:'Система',text:err.message});renderChat()}};
 }else if(kind==='projects'){title.textContent='Операции и проекты';const items=['Инфраструктурная программа: подготовить план инвестиций.','Промышленная программа: подготовить расширение мощностей.','Военная программа: подготовить план мобилизационного резерва.','Дипломатическая миссия: открыть канал переговоров.'];content.innerHTML='<p style="font-size:11px;color:#aeb6bf">Подготовьте проекты к исполнению в следующем игровом периоде.</p>'+items.map((x,i)=>'<div class="pax-log-item">'+esc(x)+'<br><button class="pax-secondary" data-project="'+i+'">Добавить в очередь</button></div>').join('');content.querySelectorAll('[data-project]').forEach(b=>b.onclick=()=>{addInitiative(items[Number(b.dataset.project)]);renderOrders();save();b.textContent='Добавлено ✓'})}
 else if(kind==='search'){title.textContent='Поиск по миру';content.innerHTML='<input id="pax-search" placeholder="Название страны"><div id="pax-search-results"></div>';const inp=document.getElementById('pax-search');inp.oninput=()=>{const q=inp.value.toLowerCase();document.getElementById('pax-search-results').innerHTML=Object.entries(countries).filter(([k,v])=>(k+' '+v.name).toLowerCase().includes(q)).map(([k,v])=>'<div class="pax-log-item"><b>'+v.flag+' '+esc(v.name)+'</b> <button class="pax-secondary" data-find="'+esc(k)+'">Показать</button></div>').join('');content.querySelectorAll('[data-find]').forEach(b=>b.onclick=()=>{inspectCountry(b.dataset.find)})}}
 }
 function renderOrders(){const el=document.getElementById('pax-orders');if(!el)return;const items=state.initiatives||[];el.innerHTML='<div class="pax-initiative-head"><b>Инициативы · '+items.length+'</b><small>Выполнение зависит от времени и ресурсов</small></div>'+(items.length?items.map(x=>'<div class="pax-initiative"><div class="pax-initiative-top"><b>'+esc(x.text)+'</b><span class="pax-status '+(x.status==='Завершено'?'done':x.status==='Сдерживается'?'hold':x.status==='Заблокировано'?'blocked':'active')+'">'+esc(x.status)+'</span></div><div class="pax-progress"><i style="width:'+Math.max(0,Math.min(100,x.progress||0))+'%"></i></div><small>'+esc(x.category)+' · '+(x.progress||0)+'% · '+(x.status==='Завершено'?'результат достигнут':Math.max(0,x.weeksLeft||0)+' нед. до завершения')+'</small></div>').join(''):'<p style="font-size:10px;color:#89939e">Пока нет инициатив. Отправьте первый приказ.</p>')}
 function renderChat(){const el=document.getElementById('pax-chat-log');if(el)el.innerHTML=(chats[target]||[]).map(x=>'<div class="pax-chat-line '+(x.from==='Вы'?'me':'')+'"><b>'+esc(x.from)+':</b> '+esc(x.text)+'</div>').join('')||'<p style="font-size:10px;color:#89939e">Начните дипломатический разговор.</p>'}
 function countryCard(){inspectCountry(state.selected)}
 window.__paxOpenChatWithTarget=(id)=>{target=id;open('chat')};
 document.querySelectorAll('.pax-float-button').forEach(b=>b.onclick=()=>open(b.dataset.paxPanel));
 document.getElementById('pax-drawer-close').onclick=()=>drawer.classList.add('hidden');
 document.getElementById('pax-own-country').onclick=countryCard;
 document.getElementById('pax-advisor-open').onclick=()=>{title.textContent='Советник государства';drawer.classList.remove('hidden');content.innerHTML='<div class="pax-country-card"><span class="flag">'+current().flag+'</span><div><b>Стратегический советник</b><small>'+esc(current().name)+' · '+dateText()+'</small></div></div><div class="pax-log-item">'+esc(document.getElementById('advisor-text')?.textContent||'Советник готов к работе.')+'</div><div class="pax-log-item">Казна: <b>₽ '+fmt(state.treasury)+' млрд</b><br>Стабильность: <b>'+fmt(state.stability)+'%</b><br>ВВП: <b>'+fmt(state.gdp)+'</b><br>Армия: <b>'+fmt(state.army)+' тыс.</b></div><button class="pax-primary" id="wc-ai-advice">Получить стратегический доклад ИИ</button><div id="wc-ai-advice-result" class="pax-log-item">'+esc(window.__wcLastAiBrief||'Запросите доклад: советник оценит внутреннее положение и международную обстановку.')+'</div>';document.getElementById('wc-ai-advice').onclick=async()=>{const b=document.getElementById('wc-ai-advice'),out=document.getElementById('wc-ai-advice-result');b.disabled=true;b.textContent='Подготовка доклада…';try{const r=await wcAiRequest('advisor',wcAiSnapshot());out.textContent=r.advice||'Доклад не получен.';window.__wcLastAiBrief=out.textContent}catch(e){out.textContent=e.message}finally{b.disabled=false;b.textContent='Обновить стратегический доклад'}}};
 document.getElementById('pax-menu-btn').onclick=()=>{title.textContent='Меню кампании';drawer.classList.remove('hidden');content.innerHTML='<button class="pax-secondary" id="pax-menu-dip">Дипломатия</button> <button class="pax-secondary" id="pax-menu-sound">Звук: вкл./выкл.</button> <button class="pax-secondary" id="pax-menu-scenario">Сменить сценарий</button>';document.getElementById('pax-menu-dip').onclick=()=>open('chat');document.getElementById('pax-menu-sound').onclick=()=>setSoundEnabled(!soundEnabled);document.getElementById('pax-menu-scenario').onclick=()=>document.getElementById('scenario-select')?.focus()};
 document.getElementById('pax-events-btn').onclick=()=>{window.openNewsDrawer?.('current')};
 function sync(){const c=current();document.getElementById('pax-session-country').textContent=c.name;document.getElementById('pax-date-pill').textContent=dateText();document.getElementById('pax-own-flag').textContent=c.flag;document.getElementById('pax-own-name').textContent=c.name;document.getElementById('pax-events-count').textContent=(state.events||[]).length;if(document.getElementById('pax-orders'))renderOrders()}
 new MutationObserver(sync).observe(document.getElementById('date-label'),{childList:true,subtree:true});
 new MutationObserver(sync).observe(document.getElementById('country-name'),{childList:true,subtree:true});
 new MutationObserver(sync).observe(document.getElementById('news-list'),{childList:true});
 document.getElementById('pax-jump-btn').onclick=()=>{const n=Number(document.getElementById('pax-jump-size').value)||1;window.__replayingEvents=true;for(let i=0;i<n;i++)advanceTurn();window.__replayingEvents=false;runWorldAI();sync();const last=state.events[0];if(last)showChronicleEvent(last)};
 sync();
})();


/* Main menu and multiplayer lobby shell. Network actions stay explicitly offline until backend exists. */
(function(){
 const menu=document.getElementById('wc-main-menu'),content=document.getElementById('wc-menu-content');if(!menu||!content)return;
 const PROFILE_KEY='wcPlayerProfile_v1',DRAFT_KEY='wcCampaignDrafts_v1';let profile=localStorage.getItem(PROFILE_KEY)||'Игрок';
 function profileSync(){document.getElementById('wc-profile-name').textContent=profile;document.getElementById('wc-profile-initial').textContent=(profile.trim()[0]||'И').toUpperCase()}
 function enterGame(){menu.classList.add('wc-menu-hide');document.querySelector('.app-shell').style.display='flex';setTimeout(()=>{if(map)map.invalidateSize({pan:false});openCountrySelection(true)},120)}
 function page(name){document.querySelectorAll('.wc-menu-nav').forEach(b=>b.classList.toggle('active',b.dataset.menuPage===name));content.classList.add('wc-menu-page');
  if(name==='home'){content.innerHTML='<div class="wc-menu-section-head"><div><span class="wc-menu-overline">ВАШ МИР</span><h2>Продолжить игру</h2></div><span class="wc-menu-muted">ВЫБЕРИТЕ РЕЖИМ</span></div><div class="wc-menu-cards"><button class="wc-menu-card wc-card-network" data-menu-page="network"><span class="wc-card-icon">◎</span><span class="wc-card-tag">МУЛЬТИПЛЕЕР</span><b>Сетевая игра</b><small>Создайте комнату или присоединитесь к кампании с другими игроками.</small><i>Открыть лобби →</i></button><button class="wc-menu-card" id="wc-page-solo"><span class="wc-card-icon">♜</span><span class="wc-card-tag">ОДИНОЧНАЯ ИГРА</span><b>Новая кампания</b><small>Выберите сценарий и возьмите управление государством.</small><i>Начать игру →</i></button><button class="wc-menu-card" data-menu-page="my"><span class="wc-card-icon">▤</span><span class="wc-card-tag">СОХРАНЕНИЯ</span><b>Мои кампании</b><small>Ваши сохранения и подготовленные сетевые комнаты.</small><i>Посмотреть →</i></button></div><div class="wc-menu-bottom-grid"><div class="wc-menu-info-panel"><span class="wc-menu-overline">СЕТЕВАЯ ИНФРАСТРУКТУРА</span><b><span class="wc-status-dot"></span> Сервер ещё не подключён</b><p>Для реальной игры нужен общий сервер кампаний и синхронизация ходов.</p></div><div class="wc-menu-info-panel"><span class="wc-menu-overline">ВЕРСИЯ</span><b>World Chronicle · Pre-Alpha</b><p>Карта мира, страны, дипломатия, проекты и игровые инициативы.</p></div></div>';document.getElementById('wc-page-solo').onclick=enterGame;
  }else if(name==='network'||name==='servers'){content.innerHTML='<span class="wc-menu-overline">МНОГОПОЛЬЗОВАТЕЛЬСКИЙ РЕЖИМ</span><h2>'+(name==='servers'?'Список сетевых комнат':'Сетевая игра')+'</h2><div class="wc-menu-page-grid"><div class="wc-menu-list-card"><span class="wc-menu-overline">ПОДКЛЮЧЕНИЕ</span><h3 style="font:700 16px Manrope">Общий мир для нескольких игроков</h3><p>Каждый участник выбирает государство. Решения, дипломатия, войны и смена игровых ходов должны синхронизироваться через сервер.</p><div class="wc-menu-notice"><b>Сервер недоступен — сетевой режим пока не подключён.</b><br>Сейчас сайт работает как одиночный браузерный прототип. Ниже показан интерфейс будущего лобби, реальные комнаты появятся после запуска backend.</div></div><div class="wc-menu-list-card"><span class="wc-menu-overline">КОМНАТЫ</span><h3 style="font:700 16px Manrope">Открытые кампании</h3><div class="wc-menu-empty">Нет подключённых серверов и активных комнат.<br>Это не список фиктивных игроков — комнаты загрузятся с сервера после его подключения.</div></div></div><div style="margin-top:14px"><button class="wc-menu-primary" id="wc-go-create">＋ Создать кампанию</button> <button class="wc-menu-secondary" id="wc-refresh-rooms">Обновить список</button></div>';document.getElementById('wc-go-create').onclick=()=>page('create');document.getElementById('wc-refresh-rooms').onclick=()=>{document.querySelector('.wc-menu-empty').textContent='Сервер не подключён. Список комнат пока невозможно получить.'};
  }else if(name==='create'){content.innerHTML='<span class="wc-menu-overline">НОВАЯ СЕТЕВАЯ СЕССИЯ</span><h2>Создать кампанию</h2><div class="wc-menu-page-grid"><div class="wc-menu-form-card"><label>НАЗВАНИЕ КАМПАНИИ</label><input id="wc-campaign-name" maxlength="48" placeholder="Например: Европа на распутье"><label>ИСТОРИЧЕСКИЙ СЦЕНАРИЙ</label><select id="wc-campaign-scenario"><option value="1936">Европа на распутье · 1936</option><option value="1914">Лето 1914 года · 1914</option><option value="2026">Современный мир · 2026</option><option value="1836">Эпоха империй · 1836</option></select><label>МАКСИМУМ УЧАСТНИКОВ</label><select id="wc-campaign-slots"><option>2</option><option selected>5</option><option>10</option><option>20</option><option>50</option></select><label>ДОСТУП</label><select id="wc-campaign-access"><option value="private">По приглашению</option><option value="public">Открытая кампания</option></select><button id="wc-save-draft">Сохранить настройки кампании</button></div><div class="wc-menu-list-card"><span class="wc-menu-overline">ПРАВИЛА КАМПАНИИ</span><h3 style="font:700 16px Manrope">Настройте свою ВПИ</h3><p>В будущей сетевой версии здесь будут доступны длительность хода, ведущий/администратор, выбор государств, правила паузы, скорость ходов, условия победы и приглашение игроков.</p><div class="wc-menu-notice">Пока сервер не подключён, создание сохранит только локальный черновик настроек на этом устройстве. Кампания не будет опубликована и другие игроки не смогут к ней подключиться.</div></div></div><div id="wc-create-feedback" aria-live="polite"></div>';
   document.getElementById('wc-save-draft').onclick=()=>{const n=document.getElementById('wc-campaign-name').value.trim();if(!n){document.getElementById('wc-create-feedback').innerHTML='<div class="wc-menu-notice">Введите название кампании.</div>';return}const drafts=JSON.parse(localStorage.getItem(DRAFT_KEY)||'[]');drafts.push({name:n,scenario:document.getElementById('wc-campaign-scenario').value,slots:document.getElementById('wc-campaign-slots').value,access:document.getElementById('wc-campaign-access').value,created:new Date().toISOString()});localStorage.setItem(DRAFT_KEY,JSON.stringify(drafts));document.getElementById('wc-create-feedback').innerHTML='<div class="wc-menu-notice">Настройки сохранены как локальный черновик. Чтобы открыть комнату для других игроков, потребуется подключить сервер.</div>'};
  }else if(name==='my'){const drafts=JSON.parse(localStorage.getItem(DRAFT_KEY)||'[]');content.innerHTML='<span class="wc-menu-overline">ВАШИ СОХРАНЕНИЯ</span><h2>Мои кампании</h2><div class="wc-menu-list-card">'+(drafts.length?drafts.map((d,i)=>'<div class="wc-room-row"><div><b>'+String(d.name).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</b><small>Сценарий '+d.scenario+' · мест: '+d.slots+' · Локальный черновик</small></div><button data-draft-delete="'+i+'">Удалить</button></div>').join(''):'<div class="wc-menu-empty">У вас пока нет сохранённых кампаний.<br>Создайте новую сетевую кампанию, чтобы подготовить настройки.</div>')+'</div>';content.querySelectorAll('[data-draft-delete]').forEach(b=>b.onclick=()=>{const ds=JSON.parse(localStorage.getItem(DRAFT_KEY)||'[]');ds.splice(Number(b.dataset.draftDelete),1);localStorage.setItem(DRAFT_KEY,JSON.stringify(ds));page('my')});
  }else if(name==='settings'){content.innerHTML='<span class="wc-menu-overline">ПЕРСОНАЛИЗАЦИЯ</span><h2>Настройки профиля</h2><div class="wc-menu-form-card wc-menu-profile-form"><label>ИГРОВОЙ НИКНЕЙМ</label><input id="wc-profile-input" maxlength="24" value="'+profile.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"><button id="wc-save-profile">Сохранить профиль</button><div class="wc-menu-notice">Профиль пока хранится локально в браузере. Для сетевой игры потребуется серверная учётная запись.</div></div>';document.getElementById('wc-save-profile').onclick=()=>{const v=document.getElementById('wc-profile-input').value.trim();if(!v)return;profile=v;localStorage.setItem(PROFILE_KEY,profile);profileSync();document.getElementById('wc-save-profile').textContent='Сохранено ✓'};
  }
  content.querySelectorAll('[data-menu-page]').forEach(b=>b.onclick=()=>page(b.dataset.menuPage));
 }
 document.querySelectorAll('[data-menu-page]').forEach(b=>b.addEventListener('click',()=>page(b.dataset.menuPage)));
 document.getElementById('wc-menu-network').onclick=()=>page('network');document.getElementById('wc-menu-solo').onclick=enterGame;document.getElementById('wc-card-solo').onclick=enterGame;document.getElementById('wc-menu-profile').onclick=()=>page('settings');profileSync();
})();

/* Country selection flow and country/administrative-region atlas */
const WC_COUNTRY_GEO_URL='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
const WC_REGION_GEO_URL='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';
let wcCountryFeaturesPromise=null,wcRegionFeaturesPromise=null,wcPickerSelected='Russia',wcPickerInitial=false,wcPickerDirectory=[];
const WC_CAPITALS={'Russia':'Москва','United States of America':'Вашингтон','Canada':'Оттава','Mexico':'Мехико','Brazil':'Бразилиа','Argentina':'Буэнос-Айрес','Chile':'Сантьяго','Peru':'Лима','Colombia':'Богота','Venezuela':'Каракас','United Kingdom':'Лондон','France':'Париж','Germany':'Берлин','Spain':'Мадрид','Portugal':'Лиссабон','Italy':'Рим','Poland':'Варшава','Ukraine':'Киев','Belarus':'Минск','Norway':'Осло','Sweden':'Стокгольм','Finland':'Хельсинки','Denmark':'Копенгаген','Netherlands':'Амстердам','Belgium':'Брюссель','Switzerland':'Берн','Austria':'Вена','Czechia':'Прага','Greece':'Афины','Turkey':'Анкара','China':'Пекин','Japan':'Токио','India':'Нью-Дели','Pakistan':'Исламабад','South Korea':'Сеул','North Korea':'Пхеньян','Thailand':'Бангкок','Vietnam':'Ханой','Indonesia':'Джакарта','Malaysia':'Куала-Лумпур','Philippines':'Манила','Saudi Arabia':'Эр-Рияд','Iran':'Тегеран','Iraq':'Багдад','Israel':'Иерусалим','Egypt':'Каир','South Africa':'Претория','Nigeria':'Абуджа','Kenya':'Найроби','Ethiopia':'Аддис-Абеба','Australia':'Канберра','New Zealand':'Веллингтон','Latvia':'Рига','Lithuania':'Вильнюс','Estonia':'Таллин','Georgia':'Тбилиси','Armenia':'Ереван','Azerbaijan':'Баку','Kazakhstan':'Астана','Uzbekistan':'Ташкент','Afghanistan':'Кабул','Bangladesh':'Дакка','Nepal':'Катманду','Myanmar':'Нейпьидо','Cambodia':'Пномпень','Laos':'Вьентьян','Singapore':'Сингапур','Mongolia':'Улан-Батор','Morocco':'Рабат','Algeria':'Алжир','Tunisia':'Тунис','Libya':'Триполи','Sudan':'Хартум','Eritrea':'Асмэра','Somalia':'Могадишо','Uganda':'Кампала','Tanzania':'Додома','Rwanda':'Кигали','Senegal':'Дакар','Ghana':'Аккра','Angola':'Луанда','Namibia':'Виндхук','Botswana':'Габороне','Zimbabwe':'Хараре','Zambia':'Лусака','Mozambique':'Мапуту','Madagascar':'Антананариву','Cuba':'Гавана','Jamaica':'Кингстон','Haiti':'Порт-о-Пренс','Dominican Republic':'Санто-Доминго','Ecuador':'Кито','Uruguay':'Монтевидео','Paraguay':'Асунсьон','Iceland':'Рейкьявик','Ireland':'Дублин','Romania':'Бухарест','Bulgaria':'София','Serbia':'Белград','Croatia':'Загреб','Hungary':'Будапешт','Slovakia':'Братислава','Slovenia':'Любляна','Bosnia and Herz.':'Сараево','Albania':'Тирана','Montenegro':'Подгорица','Moldova':'Кишинёв','Cyprus':'Никосия','Saudi Arabia':'Эр-Рияд','Qatar':'Доха','United Arab Emirates':'Абу-Даби','Oman':'Маскат','Yemen':'Сана','Kuwait':'Эль-Кувейт'};
const WC_REGION_RU={'Europe':'Европа','Asia':'Азия','Africa':'Африка','North America':'Северная Америка','South America':'Южная Америка','Oceania':'Океания','Seven seas (open ocean)':'Океания'};
function wcFlagUrl(code){const c=String(code||'').toLowerCase();return /^[a-z]{2}$/.test(c)&&c!=='-99'?'https://raw.githubusercontent.com/hampusborgos/country-flags/main/svg/'+c+'.svg':''}
function wcFlagImg(code,alt,cls='wc-flag-image'){const url=wcFlagUrl(code);return url?'<img class=\"'+cls+'\" src=\"'+url+'\" alt=\"Флаг '+wcEsc(alt)+'\" loading=\"lazy\" onerror=\"this.replaceWith(document.createTextNode(\'🏳️\'))\">':'<span class=\"'+cls+'\">🏳️</span>'}
function wcEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function wcGetFeatures(){if(window.__wcCountryFeatures?.length)return Promise.resolve(window.__wcCountryFeatures);if(!wcCountryFeaturesPromise)wcCountryFeaturesPromise=fetch(WC_COUNTRY_GEO_URL,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Не удалось загрузить каталог стран');return r.json()}).then(d=>{window.__wcCountryFeatures=d.features||[];return window.__wcCountryFeatures});return wcCountryFeaturesPromise}
function wcBuildDirectory(features){const rows=[];for(const f of features){const p=f.properties||{},info=getCountryInfo(f),id=info.id;if(!id||rows.some(x=>x.id===id))continue;const pop=Number(p.POP_EST),gdp=Number(p.GDP_MD_EST),region=p.REGION_UN||p.REGION_WB||p.CONTINENT||'';rows.push({id,name:info.name,flag:info.flag,code:info.code,feature:f,capital:WC_CAPITALS[id]||p.CAPITAL||p.capital||'Нет данных',population:pop>0?(pop>=1e9?(pop/1e9).toFixed(2).replace('.',',')+' млрд':(pop/1e6).toFixed(1).replace('.',',')+' млн'):'Нет данных',gdp:gdp>0?'$ '+(gdp/1000).toLocaleString('ru-RU',{maximumFractionDigits:1})+' млрд':'Нет данных',region,subregion:p.SUBREGION||'',type:p.TYPE||p.FORMAL_EN||'Государство'});wcEnsureCountryEntry(rows[rows.length-1]);}rows.sort((a,b)=>a.name.localeCompare(b.name,'ru'));return rows}
function wcEnsureCountryEntry(c){const old=countries[c.id]||{};countries[c.id]={...old,name:c.name,flag:c.flag,capital:c.capital,population:c.population,economy:c.gdp,stability:old.stability??50,military:old.military||'Нет данных'};}
async function openCountrySelection(initial=false){wcPickerInitial=initial;const shell=document.querySelector('.app-shell');if(shell)shell.style.display='flex';modal('Выбор государства','<div class="wc-country-loading">Загружается каталог государств…</div>');document.querySelector('#modal-backdrop .modal')?.classList.add('wc-country-select-modal');try{const features=await wcGetFeatures();wcPickerDirectory=wcBuildDirectory(features);if(!wcPickerDirectory.length)throw Error('Каталог стран пуст');wcPickerSelected=wcPickerDirectory.some(x=>x.id===state.selected)?state.selected:'Russia';wcRenderCountrySelection()}catch(e){$('modal-content').innerHTML='<div class="wc-country-loading">Не удалось загрузить каталог стран. Проверьте подключение к интернету.<br><button class="modal-submit" id="wc-country-retry">Повторить</button></div>';document.getElementById('wc-country-retry').onclick=()=>openCountrySelection(initial)}}
function wcRenderCountrySelection(){const year=Number($('scenario-select')?.value||state.year||1936);$('modal-title').textContent=wcPickerInitial?'Выберите государство для новой кампании':'Сменить управляемое государство';$('modal-content').innerHTML='<div class="wc-country-picker-shell"><div class="wc-country-picker-top"><div><label>ИСТОРИЧЕСКИЙ СЦЕНАРИЙ</label><select id="wc-pick-year"><option value="1836">Эпоха империй · 1836</option><option value="1914">Лето 1914 года · 1914</option><option value="1936">Европа на распутье · 1936</option><option value="2026">Современный мир · 2026</option></select></div><div class="wc-country-count"><b>'+wcPickerDirectory.length+'</b><small>государств в каталоге</small></div></div><div class="wc-country-picker-grid"><div class="wc-country-list-column"><input id="wc-country-search" class="modal-input" placeholder="⌕ Поиск страны…"><div class="wc-country-filters"><select id="wc-country-region"><option value="">Все регионы мира</option>'+Object.entries(WC_REGION_RU).map(([k,v])=>'<option value="'+wcEsc(k)+'">'+v+'</option>').join('')+'</select><select id="wc-country-sort"><option value="az">По алфавиту</option><option value="population">По населению</option><option value="gdp">По экономике</option></select></div><div id="wc-country-results" class="wc-country-results"></div></div><aside id="wc-country-preview" class="wc-country-preview"></aside></div><div class="wc-country-picker-footer"><span>Население и экономика — справочные оценки Natural Earth, не точные показатели выбранного исторического года.</span><button class="modal-submit" id="wc-confirm-country">Начать кампанию →</button></div></div>';
 $('wc-pick-year').value=String(year);const search=$('wc-country-search'),region=$('wc-country-region'),sort=$('wc-country-sort');function draw(){let rows=wcPickerDirectory.filter(c=>(!region.value||c.region===region.value)&&(!search.value||[c.name,c.id,c.capital,c.code].join(' ').toLowerCase().includes(search.value.toLowerCase())));if(sort.value==='population')rows.sort((a,b)=>Number(b.feature.properties.POP_EST||0)-Number(a.feature.properties.POP_EST||0));else if(sort.value==='gdp')rows.sort((a,b)=>Number(b.feature.properties.GDP_MD_EST||0)-Number(a.feature.properties.GDP_MD_EST||0));else rows.sort((a,b)=>a.name.localeCompare(b.name,'ru'));$('wc-country-results').innerHTML=rows.map(c=>'<button class="wc-country-choice '+(c.id===wcPickerSelected?'selected':'')+'" data-wc-country="'+wcEsc(c.id)+'"><span class="wc-choice-flag">'+wcFlagImg(c.code,c.name)+'</span><span><b>'+wcEsc(c.name)+'</b><small>'+wcEsc(WC_REGION_RU[c.region]||c.region||'Регион не указан')+' · '+wcEsc(c.capital)+'</small></span><i>'+(c.id===wcPickerSelected?'✓':'›')+'</i></button>').join('')||'<div class="wc-country-loading">Страны не найдены.</div>';document.querySelectorAll('[data-wc-country]').forEach(b=>b.onclick=()=>{wcPickerSelected=b.dataset.wcCountry;draw();wcRenderCountryPreview()})}search.oninput=draw;region.onchange=draw;sort.onchange=draw;draw();wcRenderCountryPreview();$('wc-confirm-country').onclick=()=>{const c=wcPickerDirectory.find(x=>x.id===wcPickerSelected);if(!c)return;wcEnsureCountryEntry(c);const y=Number($('wc-pick-year').value);if(wcPickerInitial)resetCampaign(y);else{$('scenario-label').textContent=scenarios[state.year]||'Кампания';}selectCountry(c.id,c.feature,c.name,c.flag);$('scenario-select').value=String(state.year);save();closeModal();if(map){map.invalidateSize({pan:false});const item=countryMeta.find(x=>x.info.id===c.id);if(item?.bounds?.isValid())map.fitBounds(item.bounds,{padding:[45,45],maxZoom:5})}}}
function wcRenderCountryPreview(){const c=wcPickerDirectory.find(x=>x.id===wcPickerSelected);if(!c)return;const p=c.feature.properties||{};$('wc-country-preview').innerHTML='<div class="wc-preview-flag">'+wcFlagImg(c.code,c.name,'wc-flag-preview')+'</div><span class="wc-preview-kicker">ВЫБРАННОЕ ГОСУДАРСТВО</span><h3>'+wcEsc(c.name)+'</h3><p class="wc-preview-official">'+wcEsc(c.type)+'</p><div class="wc-preview-facts"><div><small>СТОЛИЦА</small><b>'+wcEsc(c.capital)+'</b></div><div><small>НАСЕЛЕНИЕ</small><b>'+wcEsc(c.population)+'</b></div><div><small>ВВП · СПРАВОЧНО</small><b>'+wcEsc(c.gdp)+'</b></div><div><small>ЧАСТЬ СВЕТА</small><b>'+wcEsc(WC_REGION_RU[c.region]||c.region||'Нет данных')+'</b></div><div class="wide"><small>СУБРЕГИОН</small><b>'+wcEsc(c.subregion||'Нет данных')+'</b></div><div class="wide"><small>КОД ISO</small><b>'+wcEsc(c.code||'Не присвоен')+'</b></div></div><div class="wc-preview-regions"><div><b>Административные регионы</b><small id="wc-regions-status">Загрузка по запросу</small></div><button id="wc-load-regions">Показать регионы</button></div><div id="wc-preview-region-list" class="wc-preview-region-list">Административные единицы можно загрузить для выбранной страны.</div><p class="wc-preview-note">Границы и статусы территорий основаны на наборе Natural Earth и могут не отражать все политические позиции.</p>';$('wc-load-regions').onclick=()=>wcLoadRegionsForCountry(c.id)}
async function wcLoadRegionsForCountry(id){const status=$('wc-regions-status'),list=$('wc-preview-region-list');if(status)status.textContent='Загрузка…';try{if(!wcRegionFeaturesPromise)wcRegionFeaturesPromise=fetch(WC_REGION_GEO_URL,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Regions unavailable');return r.json()}).then(d=>d.features||[]);const features=await wcRegionFeaturesPromise;const country=wcPickerDirectory.find(x=>x.id===id),cp=country?.feature?.properties||{},iso3=String(cp.ADM0_A3||cp.adm0_a3||'').toUpperCase();const matches=features.filter(f=>{const p=f.properties||{},a3=String(p.adm0_a3||p.ADM0_A3||'').toUpperCase(),admin=p.admin||p.ADMIN||p.sovereignt||p.geonunit;return(iso3&&a3===iso3)||(!iso3&&admin===id)});const rows=matches.map(f=>{const p=f.properties||{};return{name:p.name||p.name_en||p.NAME||p.name_local||'Регион',type:p.type_en||p.type||p.TYPE||'Административный регион',code:p.iso_3166_2||p.ISO_3166_2||'',region:p.region||p.region_un||'',feature:f}}).filter((x,i,a)=>a.findIndex(y=>y.name===x.name&&y.code===x.code)===i).sort((a,b)=>a.name.localeCompare(b.name,'ru'));if(status)status.textContent=rows.length+' регионов · Admin-1';if(list)list.innerHTML=rows.length?rows.map((r,i)=>'<details class=\"wc-region-entry\"><summary><span>'+wcEsc(r.name)+'</span><small>'+wcEsc(r.type)+'</small></summary><div><b>Тип:</b> '+wcEsc(r.type)+(r.code?'<br><b>Код ISO 3166-2:</b> '+wcEsc(r.code):'')+(r.region?'<br><b>Часть страны:</b> '+wcEsc(r.region):'')+'</div></details>').join(''):'В глобальном наборе Natural Earth для этой страны административные единицы первого уровня не найдены.'}catch(e){if(status)status.textContent='Ошибка загрузки';if(list)list.textContent='Не удалось получить административные границы.'}}
function countryPicker(){openCountrySelection(false)}
