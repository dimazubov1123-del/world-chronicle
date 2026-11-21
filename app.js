/* WORLD CHRONICLE — playable browser strategy prototype */
const SAVE_KEY='worldChronicleSave_v2';
const state={year:1936,month:0,day:1,turn:1,paused:true,speed:1,selected:'Russia',regionsVisible:false,citiesVisible:true,election:null,treasury:120,prestige:45,stability:72,gdp:100,army:68,manpower:75,relations:{'United States of America':15,China:5,Germany:-20,France:20,'United Kingdom':18,Japan:-5},treaties:[],wars:[],laws:[],events:[],geoLayer:null};
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
function dateText(){return state.day+' '+['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][state.month]+' '+state.year}
function updateUI(){$('date-label').textContent=dateText();$('turn-label').textContent='ХОД '+String(state.turn).padStart(3,'0');$('treasury-top').textContent='₽ '+fmt(state.treasury)+' млрд';$('prestige-top').textContent=fmt(state.prestige);$('stability').textContent=fmt(state.stability)+'%';$('economy').textContent='Индекс '+fmt(state.gdp);$('military').textContent=fmt(state.army)+' тыс.'}
function event(category,title,description){state.events.unshift({category,title,description,date:dateText()});state.events=state.events.slice(0,12);const list=$('news-list');list.innerHTML='';state.events.slice(0,7).forEach(e=>{const a=document.createElement('article');a.className='news-item';const tag=e.category==='ДИПЛОМАТИЯ'?'gold':e.category==='ЭКОНОМИКА'?'blue':e.category==='ВОЕННОЕ ДЕЛО'?'red':'gold';a.innerHTML='<div class="news-meta"><span class="news-tag '+tag+'">'+e.category+'</span><time>'+e.date+'</time></div><h3></h3><p></p>';a.querySelector('h3').textContent=e.title;a.querySelector('p').textContent=e.description;list.append(a)});$('event-count').textContent=String(state.events.length).padStart(2,'0')}
function selectCountry(id,feature,displayName,displayFlag){
 const base=countries[id]||{name:displayName||id,capital:'Не определена',flag:displayFlag||'🏳️',population:'—',economy:'Нет данных',stability:50,military:'—'};
 const c={...base,name:displayName||base.name,flag:displayFlag||base.flag};
 state.selected=id;
 $('country-name').textContent=c.name;$('country-capital').textContent='Столица: '+c.capital;$('country-flag').textContent=c.flag;
 $('population').textContent=c.population;$('economy').textContent=c.economy;$('stability').textContent=c.stability+'%';$('military').textContent=c.military;
 $('map-hint').textContent='Выбрано государство: '+c.name;
 if(state.geoLayer)state.geoLayer.setStyle(styleFeature);
 refreshRegions();
 if(feature&&map){const item=countryMeta.find(x=>x.info.id===id);const b=item?.bounds||(L.geoJSON(feature).getBounds());if(b.isValid())map.fitBounds(b,{padding:[45,45],maxZoom:5})}
}
function styleFeature(f){
 const name=f.properties.ADMIN||f.properties.admin||f.properties.name||'';
 const hue=(Array.from(name).reduce((n,ch)=>((n*31)+ch.charCodeAt(0))>>>0,17)%360);
 const fill='hsl('+hue+' 39% 43%)';
 const selected=state.selected===name;
 return{color:selected?'#f2d18e':'#172536',weight:selected?2.1:.8,opacity:1,fillColor:selected?'#c49b53':fill,fillOpacity:selected?.96:.91};
}
const RU_COUNTRY_NAMES={RU:'Россия',US:'США',GB:'Великобритания',KR:'Южная Корея',KP:'КНДР',CZ:'Чехия',TR:'Турция',IR:'Иран',SY:'Сирия',TW:'Тайвань',CD:'ДР Конго',CG:'Республика Конго',CI:'Кот-д’Ивуар',BO:'Боливия',VE:'Венесуэла',TZ:'Танзания',MD:'Молдова',PS:'Палестина',VA:'Ватикан',XK:'Косово'};
const ruDisplayNames=typeof Intl!=='undefined'&&Intl.DisplayNames?new Intl.DisplayNames(['ru'],{type:'region'}):null;
function getCountryInfo(feature){
 const p=feature.properties||{},code=String(p.ISO_A2||p.ISO_A2_EH||p.iso_a2||'').toUpperCase(),original=p.ADMIN||p.admin||p.name||p.NAME||'Государство';
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
 const features=regionIndex.get(state.selected)||[];if(features.length)regionLayer.addData(features);
}
function loadRegions(){
 if(!state.regionsVisible||regionData||regionsLoading)return;regionsLoading=true;
 $('map-hint').textContent='Загружаются административные границы регионов…';
 fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson',{cache:'force-cache'})
  .then(r=>{if(!r.ok)throw Error('Regions unavailable');return r.json()})
  .then(data=>{regionData=data;for(const f of data.features){const p=f.properties||{},admin=p.admin||p.ADMIN||p.sovereignt||p.geonunit;if(!admin)continue;if(!regionIndex.has(admin))regionIndex.set(admin,[]);regionIndex.get(admin).push(f)}regionsLoading=false;refreshRegions();$('map-hint').textContent='Административные регионы загружены для выбранной страны.'})
  .catch(()=>{regionsLoading=false;$('map-hint').textContent='Не удалось загрузить слой регионов. Основная карта работает.'});
}
if(window.L){
 map=L.map('map',{zoomControl:true,worldCopyJump:true,minZoom:2,maxZoom:8,preferCanvas:true,zoomSnap:1,zoomDelta:1,wheelDebounceTime:110,wheelPxPerZoomLevel:140,fadeAnimation:false,zoomAnimation:false,markerZoomAnimation:false}).setView([24,12],2);
 canvasRenderer=L.canvas({padding:.35});
 map.createPane('regionsPane');map.getPane('regionsPane').style.zIndex=420;map.createPane('citiesPane');map.getPane('citiesPane').style.zIndex=460;
 regionLayer=L.geoJSON(null,{pane:'regionsPane',renderer:canvasRenderer,style:{color:'#f4dfb4',weight:.65,opacity:.85,fillColor:'#f4dfb4',fillOpacity:.035},onEachFeature:(feature,layer)=>{const p=feature.properties||{},name=p.name||p.name_en||p.NAME||'Регион';layer.bindTooltip(name,{sticky:true,className:'wc-region-tooltip'});layer.on('click',()=>{$('map-hint').textContent='Регион: '+name+' · '+(p.admin||p.ADMIN||'')})}}).addTo(map);
 cityLayer=L.layerGroup([], {pane:'citiesPane'}).addTo(map);
 L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:8,updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,reuseTiles:true,detectRetina:false,fadeAnimation:false,attribution:'© OpenStreetMap contributors · © CARTO'}).addTo(map);
 map.on('moveend zoomend',updateCityVisibility);
 fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',{cache:'force-cache'})
  .then(r=>{if(!r.ok)throw Error('GeoJSON unavailable');return r.json()})
  .then(data=>{
   state.geoLayer=L.geoJSON(data,{renderer:canvasRenderer,style:styleFeature,smoothFactor:4.5,interactive:true,bubblingMouseEvents:false,noClip:true,onEachFeature:(feature,layer)=>{
    const info=getCountryInfo(feature),bounds=layer.getBounds();if(bounds&&bounds.isValid())countryMeta.push({info,bounds});
    layer.on('click',()=>selectCountry(info.id,feature,info.name,info.flag));
   }}).addTo(map);
   $('map-hint').textContent='Выберите государство. Цветом обозначены территории стран; регионы и города открываются при приближении.';
   initCityMarkers();updateCityVisibility();
  })
  .catch(()=>$('map-hint').textContent='Не удалось загрузить границы государств — проверьте интернет.');
 requestAnimationFrame(()=>map.invalidateSize({pan:false}));
 window.addEventListener('resize',()=>map.invalidateSize({pan:false}),{passive:true});
}
function modal(title,html){$('modal-title').textContent=title;$('modal-content').innerHTML=html;$('modal-backdrop').classList.remove('hidden')}function closeModal(){$('modal-backdrop').classList.add('hidden')}
function save(){const copy={...state,geoLayer:null};localStorage.setItem(SAVE_KEY,JSON.stringify(copy));$('advisor-text').textContent='Кампания сохранена в этом браузере.'}
function load(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(!s)return false;Object.assign(state,s);state.geoLayer=null;selectCountry(state.selected||'Russia');state.events=[];(s.events||[]).slice().reverse().forEach(e=>event(e.category,e.title,e.description));updateUI();return true}catch(e){return false}}
function resetCampaign(year){Object.assign(state,{year:Number(year),month:0,day:1,turn:1,paused:true,election:null,treasury:120,prestige:45,stability:72,gdp:100,army:68,manpower:75,relations:{'United States of America':15,China:5,Germany:-20,France:20,'United Kingdom':18,Japan:-5},treaties:[],wars:[],laws:[],events:[]});ensureElection();$('scenario-label').textContent=scenarios[year];$('scenario-select').value=String(year);selectCountry('Russia');updateUI();event('ПОЛИТИКА','Кампания началась','Вы вступили в новую эпоху. Судьба государства теперь зависит от ваших решений.');save()}
function advanceTurn(){state.turn++;state.day+=7;const days=new Date(state.year,state.month+1,0).getDate();while(state.day>days){state.day-=days;state.month++;if(state.month>11){state.month=0;state.year++}}tickElection();const income=Math.max(1,state.gdp*.055);state.treasury+=income-3-state.wars.length*2;state.stability=Math.max(0,Math.min(100,state.stability+(state.treasury>30?.15:-.45)-(state.wars.length?1.2:0)));state.prestige=Math.max(0,Math.min(100,state.prestige+(state.treaties.length?.1:0)));updateUI();const headlines=['Кабинет министров подвёл итоги недели','Эксперты представили экономический прогноз','В столице состоялось заседание государственного совета','Дипломатические миссии обменялись нотами','Промышленные предприятия расширяют производство'];event(['ПОЛИТИКА','ЭКОНОМИКА','ДИПЛОМАТИЯ'][state.turn%3],headlines[state.turn%headlines.length],'Доход казны за период: ₽ '+fmt(income)+' млрд. Текущая стабильность: '+fmt(state.stability)+'%.');$('advisor-text').textContent=state.treasury<25?'Казна сокращается. Рекомендуется пересмотреть расходы.':state.stability<45?'Общественная стабильность падает. Нужны реформы.':'Государство сохраняет управляемость. Продолжайте укреплять его позиции.';save()}
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
$('choose-country').onclick=countryPicker;$('scenario-select').onchange=e=>resetCampaign(e.target.value);$('next-turn').onclick=advanceTurn;$('pause-button').onclick=()=>{state.paused=!state.paused;$('pause-button').classList.toggle('paused',state.paused);$('pause-button').textContent=state.paused?'Ⅱ ПАУЗА':'▶ ИГРА';syncTimer();save()};
document.querySelectorAll('.speed-button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.speed-button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.speed=Number(b.dataset.speed);syncTimer()});
$('reset-map').onclick=()=>map&&map.setView([24,12],2);
$('regions-toggle').onclick=()=>{state.regionsVisible=!state.regionsVisible;$('regions-toggle').classList.toggle('active',state.regionsVisible);if(state.regionsVisible){loadRegions();refreshRegions()}else if(regionLayer)regionLayer.clearLayers()};
$('cities-toggle').onclick=()=>{state.citiesVisible=!state.citiesVisible;$('cities-toggle').classList.toggle('active',state.citiesVisible);updateCityVisibility()};
$('political-view').onclick=()=>{if(state.geoLayer)state.geoLayer.setStyle(styleFeature);event('ПОЛИТИКА','Политическая карта активна','Территории государств окрашены по политической принадлежности.')};
$('help-btn').onclick=()=>modal('World Chronicle — справка','<p>Вы руководите государством в альтернативной исторической песочнице. Один ход равен одной неделе. Решения меняют казну, экономику, стабильность, престиж и военную мощь.</p><p>Кампания автоматически сохраняется в локальном хранилище этого браузера. Используйте разделы слева для управления страной.</p>');
$('modal-close').onclick=closeModal;$('modal-backdrop').onclick=e=>{if(e.target===$('modal-backdrop'))closeModal()};
document.addEventListener('click',e=>{const nav=e.target.closest('.nav-item');if(nav){document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));nav.classList.add('active');const pages={overview:closeModal,diplomacy,economy,military,politics,elections};if(pages[nav.dataset.action])pages[nav.dataset.action]()}const a=e.target.closest('.action-card');if(a){if(a.dataset.action==='decree')decree();if(a.dataset.action==='speech')speech()}});
load();ensureElection();if(state.regionsVisible){$('regions-toggle').classList.add('active');loadRegions()}if(!state.events.length)event('ПОЛИТИКА','Кампания готова к началу','Выберите направление развития государства и сделайте первый ход.');selectCountry(state.selected||'Russia');updateUI();
