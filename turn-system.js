/* WORLD CHRONICLE — AI-driven, player-issued period turns */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 let busy=false;
 const periods={1:'1 неделя',4:'1 месяц',13:'3 месяца',26:'6 месяцев',52:'1 год'};
 function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function moveDate(weeks){
  const d=new Date(state.year,state.month,state.day);
  d.setDate(d.getDate()+weeks*7);
  state.year=d.getFullYear();state.month=d.getMonth();state.day=d.getDate();state.turn=(Number(state.turn)||0)+1;
 }
 function pendingText(){return (state.pendingOrders||[]).map(x=>typeof x==='string'?x:x.text).filter(Boolean)}
 function refreshOrderQueue(){
  const box=$('pax-orders');if(!box)return;
  const orders=pendingText();
  box.innerHTML='<div class="pax-initiative-head"><b>Приказы на следующий период · '+orders.length+'</b><small>ИИ получит их при продолжении времени</small></div>'+
   (orders.length?orders.map((x,i)=>'<div class="pax-log-item"><b>Приказ '+(i+1)+'</b><br>'+escapeHtml(x)+'</div>').join(''):'<p style="font-size:10px;color:#89939e">Приказы ещё не добавлены.</p>');
 }
 function queueOrder(){
  const input=$('pax-order');const value=input?.value.trim();
  if(!value){alert('Сначала напишите приказ.');return}
  state.pendingOrders=state.pendingOrders||[];
  state.pendingOrders.push({text:value,createdAt:dateText()});
  if(input)input.value='';
  refreshOrderQueue();save();
  const send=$('pax-send');if(send){send.textContent='Приказ добавлен ✓';setTimeout(()=>{if(send.isConnected)send.textContent='Добавить приказ в ход'},1600)}
 }
 function setBusy(on){
  busy=on;
  ['pax-jump-btn','next-turn','pax-send'].forEach(id=>{const b=$(id);if(b)b.disabled=on});
  const b=$('pax-jump-btn');if(b)b.textContent=on?'ИИ рассчитывает период…':'Продолжить время';
  const n=$('next-turn');if(n)n.innerHTML=on?'ИИ рассчитывает…':'ПРОДОЛЖИТЬ ВРЕМЯ <span>→</span>';
  const hint=$('advisor-text');if(hint&&on)hint.textContent='ИИ рассчитывает выбранный период, исполняет приказы и формирует мировую хронику…';
 }
 async function continuePeriod(weeks){
  if(busy)return;
  if(!window.WC_AI?.enabled?.()){alert('Не задан адрес AI-сервера. Откройте игру через Railway или проверьте подключение.');return}
  const orders=pendingText();
  const order=orders.length?orders.join('\n\n'):'Игрок не отдал отдельного приказа. Продолжи естественное развитие государства и мира.';
  const startDate=dateText();
  const end=new Date(state.year,state.month,state.day);end.setDate(end.getDate()+weeks*7);
  const endDate=end.getDate()+' '+['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][end.getMonth()]+' '+end.getFullYear();
  const base=window.WC_AI.snapshot();
  setBusy(true);
  try{
   const result=await window.WC_AI.request('world-turn',{...base,date:startDate,startDate,endDate,elapsedWeeks:weeks,playerOrder:order});
   moveDate(weeks);
   state.aiWorldState=state.aiWorldState||{countries:{},lastSummary:''};
   state.aiWorldState.countries=state.aiWorldState.countries||{};
   (result.countryReports||[]).forEach(r=>{
    if(!r?.countryId||r.countryId===state.selected)return;
    const report={countryId:r.countryId,lastUpdatedTurn:state.turn};
    ['government','internalPolitics','economy','society','diplomacy','defense','publicDecision','nextStep'].forEach(k=>{if(r[k])report[k]=String(r[k]).slice(0,1800)});
    state.aiWorldState.countries[r.countryId]=report;
   });
   if(result.worldSummary)state.aiWorldState.lastSummary=String(result.worldSummary).slice(0,5000);
   window.__replayingEvents=true;
   if(result.playerReport)event('ДЕЙСТВИЯ ПРАВИТЕЛЬСТВА','Отчёт за период '+startDate+' — '+dateText(),String(result.playerReport).slice(0,9000));
   if(result.worldSummary)event('МИРОВАЯ ОБСТАНОВКА','Обзор мира · '+startDate+' — '+dateText(),String(result.worldSummary).slice(0,5000));
   (result.events||[]).forEach(e=>{if(e?.title&&e?.description&&(!e.visibility||e.visibility==='public'))event(String(e.category||'МИРОВЫЕ СОБЫТИЯ'),String(e.title),String(e.description),e)});
   (result.actions||[]).forEach(a=>{
    if(!a?.countryId||a.countryId===state.selected)return;
    const target=a.targetCountryId;
    if(a.type==='relation'&&target){
     const delta=Math.max(-8,Math.min(8,Number(a.delta)||0));
     if(target===state.selected)state.relations[a.countryId]=Math.max(-100,Math.min(100,Number(state.relations[a.countryId]||0)+delta));
     else if((result.countryReports||[]).some(x=>x.countryId===target)){state.aiWorldState.bilateralRelations=state.aiWorldState.bilateralRelations||{};const key=[a.countryId,target].sort().join('|');state.aiWorldState.bilateralRelations[key]=Math.max(-100,Math.min(100,Number(state.aiWorldState.bilateralRelations[key]||0)+delta))}
    }
    if(a.type==='treaty'&&target&&!state.treaties.includes(a.countryId+'|'+target))state.treaties.push(a.countryId+'|'+target);
    if(a.type==='war'&&target&&!state.wars.includes(a.countryId+'|'+target))state.wars.push(a.countryId+'|'+target);
   });
   window.__replayingEvents=false;
   state.pendingOrders=[];
   updateUI();save();
   const advisor=$('advisor-text');if(advisor)advisor.textContent=result.advisor||'Период рассчитан. Подробности находятся в хронике событий и карточках государств.';
   const drawer=$('pax-drawer-content');
   if(drawer&&$('pax-orders'))refreshOrderQueue();
   const last=state.events?.[0];if(last)showChronicleEvent(last);
   const count=(result.countryReports||[]).length,requested=result.coverage?.requested||count;
   if(count<requested)event('СИСТЕМА ИИ','Часть стран не получила доклады','ИИ вернул '+count+' докладов из '+requested+'. Проверьте ограничения модели или повторите расчёт в следующем периоде.');
  }catch(err){
   window.__replayingEvents=false;
   alert('ИИ не смог рассчитать период. Время не продвинуто, приказы сохранены.\n\n'+err.message);
   const advisor=$('advisor-text');if(advisor)advisor.textContent='Ошибка расчёта: '+err.message;
  }finally{setBusy(false);save()}
 }
 // This game is now paused between player-issued periods; no real-time ticking.
 state.paused=true;
 if(window.gameTimer){clearInterval(window.gameTimer);window.gameTimer=null}
 window.advanceTurn=()=>continuePeriod(1);
 const oldSync=window.syncTimer;
 window.syncTimer=()=>{if(window.gameTimer){clearInterval(window.gameTimer);window.gameTimer=null}state.paused=true};
 document.addEventListener('click',e=>{
  const send=e.target.closest('#pax-send');
  if(send){e.preventDefault();e.stopImmediatePropagation();queueOrder();return}
  const jump=e.target.closest('#pax-jump-btn');
  if(jump){e.preventDefault();e.stopImmediatePropagation();continuePeriod(Number($('pax-jump-size')?.value)||1);return}
  const next=e.target.closest('#next-turn');
  if(next){e.preventDefault();e.stopImmediatePropagation();continuePeriod(1);return}
 },true);
 const jump=$('pax-jump-btn');if(jump)jump.textContent='Продолжить время';
 const next=$('next-turn');if(next)next.innerHTML='ПРОДОЛЖИТЬ ВРЕМЯ <span>→</span>';
 const period=$('pax-jump-size');if(period){period.title='Сколько времени должен просчитать ИИ';period.setAttribute('aria-label','Продолжительность периода')}
 const pause=$('pause-button');if(pause)pause.style.display='none';
 document.querySelectorAll('.speed-button,.speed-label').forEach(x=>x.style.display='none');
 document.querySelectorAll('.main-nav .nav-item[data-action="politics"],.main-nav .nav-item[data-action="elections"],.main-nav .nav-item[data-action="economy"],.main-nav .nav-item[data-action="military"],.action-card,.pax-float-button[data-pax-panel="projects"]').forEach(x=>x.style.display='none');
 const help=$('help-btn');if(help)help.onclick=()=>modal('Как проходит игровой период','<p>1. Откройте «Действия» и напишите свободный приказ обычным текстом.</p><p>2. Нажмите «Добавить приказ в ход». Можно подготовить несколько распоряжений.</p><p>3. Выберите длительность: неделя, месяц, три месяца, полгода или год.</p><p>4. Нажмите «Продолжить время». ИИ обработает приказы, действия других государств и публичную хронику. Если запрос завершится ошибкой, дата не изменится, а приказы останутся в очереди.</p>');
 // Build the queue panel once when the actions drawer is opened.
 const content=$('pax-drawer-content');
 if(content){
  const ensureQueue=()=>{
   const send=$('pax-send');
   if(!send||!content.contains(send))return;
   let box=$('pax-orders');
   if(!box){
    box=document.createElement('div');
    box.id='pax-orders';
    box.style.marginTop='12px';
    send.parentElement?.after(box);
   }
   if(send.textContent!=='Добавить приказ в ход')send.textContent='Добавить приказ в ход';
   refreshOrderQueue();
  };
  const observer=new MutationObserver(()=>{
   if(!$('pax-orders'))ensureQueue();
  });
  observer.observe(content,{childList:true,subtree:true});
  ensureQueue();
 }
})();
