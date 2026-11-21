import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import {fileURLToPath} from 'node:url';

const app=express();
app.set('trust proxy',1);
const PORT=process.env.PORT||8080;
const ORIGIN=(process.env.CORS_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
const PROVIDER=(process.env.AI_PROVIDER||'openrouter').toLowerCase();
const MODEL=PROVIDER==='gemini'?(process.env.GEMINI_MODEL||'gemini-3.8-flash'):PROVIDER==='groq'?(process.env.GROQ_MODEL||'openai/gpt-oss-120b'):(process.env.OPENROUTER_MODEL||'openrouter/free');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

app.use(cors({origin(origin,cb){if(!origin||!ORIGIN.length||ORIGIN.includes(origin))return cb(null,true);cb(new Error('Origin not allowed'));}}));
app.use(express.json({limit:'8mb'}));
app.use('/api/ai',rateLimit({windowMs:24*60*60*1000,limit:40,standardHeaders:true,legacyHeaders:false,message:{error:'Дневной лимит AI-запросов World Chronicle исчерпан. Попробуйте завтра.'}}));

app.get('/',(_req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.get('/index.html',(_req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.get('/app.js',(_req,res)=>res.sendFile(path.join(ROOT,'app.js')));
app.get('/turn-system.js',(_req,res)=>res.sendFile(path.join(ROOT,'turn-system.js')));
app.get('/warfare.js',(_req,res)=>res.sendFile(path.join(ROOT,'warfare.js')));
app.get('/styles.css',(_req,res)=>res.sendFile(path.join(ROOT,'styles.css')));
app.get('/health',(_req,res)=>res.json({ok:true,service:'world-chronicle',provider:PROVIDER,configured:Boolean(PROVIDER==='gemini'?process.env.GEMINI_API_KEY:PROVIDER==='groq'?process.env.GROQ_API_KEY:process.env.OPENROUTER_API_KEY),model:MODEL,hosting:'railway'}));

const clean=(v,n=4000)=>String(v??'').slice(0,n);
async function ask(system,user,maxTokens=1200){
 const groq=PROVIDER==='groq',gemini=PROVIDER==='gemini';
 const apiKey=gemini?process.env.GEMINI_API_KEY:groq?process.env.GROQ_API_KEY:process.env.OPENROUTER_API_KEY;
 if(!apiKey){const keyName=gemini?'GEMINI_API_KEY':groq?'GROQ_API_KEY':'OPENROUTER_API_KEY';const e=new Error('На сервере не задан '+keyName+'.');e.status=503;throw e}
 let endpoint,headers,body;
 if(gemini){
  endpoint='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(MODEL)+':generateContent';
  headers={'x-goog-api-key':apiKey,'Content-Type':'application/json'};
  body={
   systemInstruction:{parts:[{text:system}]},
   contents:[{role:'user',parts:[{text:user}]}],
   generationConfig:{maxOutputTokens:maxTokens,responseMimeType:'application/json',thinkingConfig:{thinkingLevel:(process.env.GEMINI_THINKING_LEVEL||'LOW').toUpperCase()}}
  };
 }else{
  body={model:MODEL,temperature:.55,messages:[{role:'system',content:system},{role:'user',content:user}]};
  if(groq){body.max_completion_tokens=maxTokens;body.reasoning_effort='low';body.reasoning_format='hidden';body.response_format={type:'json_object'};}else body.max_tokens=maxTokens;
  if(!groq&&MODEL.startsWith('nvidia/'))body.provider={only:['nvidia'],allow_fallbacks:false};
  headers={Authorization:'Bearer '+apiKey,'Content-Type':'application/json'};
  if(groq)headers['Groq-Beta']='inference-metrics';
  if(!groq){headers['HTTP-Referer']=process.env.SITE_URL||'https://world-chronicle-production.up.railway.app/';headers['X-Title']='World Chronicle';}
  endpoint=groq?'https://api.groq.com/openai/v1/chat/completions':'https://openrouter.ai/api/v1/chat/completions';
 }
 const started=Date.now();
 const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(body)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok){
  const retry=r.headers.get('retry-after'),detail=d.error?.message||d.error?.status||d.message||'AI provider error '+r.status;
  const e=new Error(r.status===429?(detail+(retry?' Повторите через '+retry+' сек.':'')):detail);e.status=r.status===429?429:502;
  console.error('[AI provider error]',JSON.stringify({provider:PROVIDER,status:r.status,message:detail,retryAfter:retry,elapsedMs:Date.now()-started}));
  throw e;
 }
 let result;
 if(gemini){
  result=(d.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
  if(!result){const reason=d.promptFeedback?.blockReason||d.candidates?.[0]?.finishReason||'empty response';throw new Error('Gemini не вернул текстовый ответ: '+reason+'.')}
  console.log('[Gemini metrics]',JSON.stringify({elapsedMs:Date.now()-started,model:MODEL,usage:d.usageMetadata||null}));
 }else{
  if(groq)console.log('[Groq metrics]',JSON.stringify({elapsedMs:Date.now()-started,model:MODEL,metadata:d.metadata||null,usage:d.usage||null}));
  result=d.choices?.[0]?.message?.content;
 }
 if(!result)throw new Error('ИИ не вернул ответ.');
 return result;
}
function parse(raw){
 const t=raw.replace(/^\x60\x60\x60(?:json)?\s*/i,'').replace(/\s*\x60\x60\x60$/,'').trim();
 const s=t.indexOf('{'),e=t.lastIndexOf('}');
 if(s<0||e<=s)throw Error('ИИ вернул ответ неверного формата.');
 return JSON.parse(t.slice(s,e+1));
}
const route=(system,user,max)=>async(req,res)=>{try{res.json(parse(await ask(system,user(req.body||{}),max)))}catch(e){res.status(e.status||502).json({error:clean(e.message,700)})}};

function compactAdvisorWorld(w={}){
 const player=w.player||w.country||{};
 const countries=(Array.isArray(w.countries)?w.countries:[]).slice(0,18).map(c=>({id:clean(c.id,80),name:clean(c.name,100),region:clean(c.region,60),populationEstimate:c.populationEstimate??null,gdpEstimate:c.gdpEstimate??null}));
 const events=(w.events||w.chronicle||w.news||[]).slice(-6).map(e=>({date:clean(e.date,40),title:clean(e.title,180),description:clean(e.description||e.lead||e.text,500),category:clean(e.category,40),location:clean(e.location,100)}));
 return {
  date:clean(w.date,40),year:Number(w.year)||null,turn:Number(w.turn)||0,scenario:clean(w.scenario,80),
  player:{id:clean(player.id||w.playerId||w.selected,80),name:clean(player.name||w.playerName||w.selectedName,100),government:clean(player.government,180),population:player.population??null,gdp:player.gdp??player.gdpEstimate??null,treasury:player.treasury??w.treasury??null,stability:player.stability??null,manpower:player.manpower??w.manpower??null,army:player.army??w.army??null},
  relations:Object.fromEntries(Object.entries(w.relations||{}).slice(0,16)),
  wars:(w.wars||[]).slice(0,12).map(x=>clean(typeof x==='string'?x:JSON.stringify(x),180)),
  treaties:(w.treaties||[]).slice(0,12).map(x=>clean(typeof x==='string'?x:JSON.stringify(x),180)),
  countries,events
 };
}

function compactWorld(b){
 const allCountries=(b.countries||[]).filter(c=>c&&c.id).slice(0,220);
 const active=new Set();
 for(const [id,value] of Object.entries(b.relations||{}))if(Math.abs(Number(value)||0)>=10)active.add(id);
 for(const pair of [...(b.wars||[]),...(b.treaties||[])])String(pair).split('|').forEach(id=>{if(id)active.add(id)});
 const priority=allCountries.filter(c=>active.has(c.id));
 const major=[...allCountries].sort((a,b)=>(Number(b.gdpEstimate)||0)-(Number(a.gdpEstimate)||0)).slice(0,6);
 const chosen=new Set(),batch=[];
 const add=c=>{if(c&&!chosen.has(c.id)&&batch.length<5){chosen.add(c.id);batch.push(c)}};
 priority.slice(0,3).forEach(add);major.forEach(add);
 const rotating=allCountries.filter(c=>!chosen.has(c.id));
 if(rotating.length){const offset=((Math.max(0,Number(b.turn)||0)*10)%rotating.length);for(let i=0;i<Math.min(5-batch.length,5,rotating.length);i++)add(rotating[(offset+i)%rotating.length]);}
 return {
  date:clean(b.date,40),startDate:clean(b.startDate,40),endDate:clean(b.endDate,40),elapsedWeeks:Math.max(1,Math.min(520,Number(b.elapsedWeeks)||1)),
  playerOrder:clean(b.playerOrder,6000),year:Number(b.year)||null,scenario:clean(b.scenario,100),turn:Number(b.turn)||0,
  commandContext:{treasury:Number(b.commandContext?.treasury)||0,manpower:Number(b.commandContext?.manpower)||0,army:Number(b.commandContext?.army)||0,countryIds:(b.commandContext?.countries||[]).map(c=>clean(c.id,80)).slice(0,220),regions:(b.commandContext?.regions||[]).slice(0,120).map(r=>({key:clean(r.key,180),name:clean(r.name,90),countryId:clean(r.countryId,80),controller:clean(r.controller,80)})),units:(b.commandContext?.armies||[]).slice(0,40).map(u=>({id:clean(u.id,60),name:clean(u.name,70),type:clean(u.type,60),strength:Number(u.strength)||0,regionKey:clean(u.regionKey,180),location:clean(u.location,90)}))},
  player:b.player||{},relations:b.relations||{},bilateralRelations:b.aiWorldState?.bilateralRelations||{},wars:(b.wars||[]).slice(0,80),armies:(b.armies||[]).slice(0,80).map(u=>({id:clean(u.id,60),name:clean(u.name,80),type:clean(u.type,60),strength:Number(u.strength)||0,location:clean(u.location,100),regionKey:clean(u.regionKey,180),position:Array.isArray(u.position)?u.position.slice(0,2).map(Number):[]})),occupiedRegions:Object.values(b.occupiedRegions||{}).slice(0,100).map(r=>({admin:clean(r.admin,100),name:clean(r.name,120),controller:clean(r.controller,100)})),frontlines:(b.frontlines||[]).slice(0,100).map(r=>({heldRegion:clean(r.heldRegion,120),heldBy:clean(r.heldBy,100),enemyRegion:clean(r.enemyRegion,120),enemyCountry:clean(r.enemyCountry,100)})),treaties:(b.treaties||[]).slice(0,80),
  laws:(b.laws||[]).slice(0,40),countries:batch.map(c=>({id:c.id,name:c.name,region:c.region||'',populationEstimate:c.populationEstimate||null,gdpEstimate:c.gdpEstimate||null})),
  allCountryIds:allCountries.map(c=>c.id),
  previousReports:(b.previousReports||[]).filter(r=>chosen.has(r.id)).slice(0,20).map(r=>({id:r.id,summary:clean(r.summary,140),nextStep:clean(r.nextStep,90)}))
 };
}

const worldSystem=`Ты — автономный симулятор альтернативной истории World Chronicle. Просчитай весь указанный интервал целиком, учитывая дату, сценарий, географию, ресурсы, соседей, войны, двусторонние дипломатические отношения, состав дивизий игрока, их размещение, занятые регионы, текущие линии фронта и сопредельные участки, договоры, отношения, предыдущие доклады и приказ игрока. Сохраняй непрерывность и причинно-следственные связи. Выполни приказ игрока реалистично: не превращай длительные реформы в мгновенный успех; опиши препятствия и частичные результаты. Если приказ пуст, опиши естественное развитие страны.

В countries перечислены до 5 государств для подробного обновления в этом ходу. Другие государства учитывай в общей мировой картине и событиях, но не создавай для них отдельные countryReports сейчас. Состав государств меняется от хода к ходу, чтобы со временем обновлялись все страны. Важные государства и участники войн/дипломатии имеют приоритет.

ПУБЛИЧНОСТЬ: сообщай только известные обществу и иностранным наблюдателям факты — опубликованные решения, парламент, заявления, протесты, выборы, визиты, ноты, подписанные договоры, открытые мобилизационные меры, учения, видимые передвижения войск и официальные операции. Не раскрывай закрытые переговоры, планы разведки, агентурные сведения, тайные операции, секретные протоколы и скрытые намерения.

Учитывай переданные в armies соединения игрока, occupiedRegions как фактический состав войск и территории под военным контролем, frontlines как существующие участки соприкосновения. Не описывай прорыв или захват, если он не подтверждён игровым состоянием. Не создавай несуществующие дивизии игрока и не меняй их состав автоматически. Не выдумывай точные экономические или военные показатели, которых нет во входных данных. Для countryReports пиши кратко и конкретно, без воды; новостные статьи должны быть содержательными и журналистски проработанными. Для каждого выбранного государства верни все поля countryReports, но каждое поле — максимум одно короткое предложение (до 110 символов). playerReport — 3-5 содержательных абзацев. worldSummary — 1-2 абзаца. advisor — один короткий аналитический абзац. Сформируй 2-4 действительно значимые публичные новости за весь период. Не выдумывай события ради количества: если значимых событий нет, верни пустой массив; если событий больше двух, выбери два наиболее важных. Не заполняй хронику искусственными событиями: у каждой публикации должна быть причина и конкретное развитие. Для важнейшей новости поставь importance="major", для второй — "normal". Каждая новость — как профессиональная газетная статья в историческом журнале: title — выразительный заголовок; subtitle — короткий подзаголовок; lead — сильный первый абзац с главным фактом; article — продолжение материала из 1-2 коротких абзацев, примерно 300-450 символов; не повторяй в нём lead, с конкретными датами внутри периода, местами, участниками, заявлениями и ходом событий. Пиши литературно, но как журналист: без канцелярского повтора, без воды, без выдуманных цитат и цифр. date — конкретная дата внутри симулируемого периода, если её можно обоснованно определить; location — место события. description — краткий анонс в 1-2 предложения. background, development, consequences, reaction — дополнительные аналитические блоки, не дублирующие статью; заполняй только когда есть фактическое содержание. В новостях о войне учитывай реальные армии, позиции и соседство регионов из входных данных; никакой телепортации и мгновенного захвата стран. Реакцию не выдумывай. Не принимай решения за игрока. Если playerOrder содержит секцию «ПЛАН РАЗОБРАННЫХ ПРИКАЗОВ», считай операции предварительно разобранными, но сообщай об успешном исполнении только после их подтверждения результатом игрового движка. Не придумывай захваты, сформированные части, мобилизацию или реформы, которых нет в переданном плане и подтверждённом состоянии. ПАРСИНГ ПРИКАЗОВ: одновременно преобразуй текст playerOrder в массив commandOperations, используя только доступные операции recruit, move, attack, disband, declare_war, diplomacy, mobilize, policy. Контекст commandContext содержит точные ID соединений и ключи доступных регионов; не придумывай их. Для move/attack выбери только точный region key из commandContext.regions и ID из commandContext.units. recruit принимает unitType из «Пехотная дивизия», «Моторизованная дивизия», «Танковая дивизия», «Воздушно-десантная дивизия» и name. declare_war принимает targetCountryId из commandContext.countryIds; diplomacy принимает targetCountryId и action improve|sanctions|treaty. mobilize принимает amount 1–25. policy принимает industry|infrastructure|social|military|stability|education|healthcare|agriculture|tax_reform|trade|public_order и scale 1|2. Не создавай операции, которых нет в приказе; если цель не определена, оставь массив пустым и заполни commandClarification. Не описывай результаты исполнения приказов в событиях: игровой движок применит операции после ответа. Верни commandSummary и commandClarification.

Верни строго один JSON:
{"playerReport":"хроника действий страны игрока за интервал","worldSummary":"обзор мировой обстановки","commandOperations":[{"type":"recruit|move|attack|disband|declare_war|diplomacy|mobilize|policy","unitType":"...","name":"...","unitId":"...","targetRegionKey":"...","targetCountryId":"...","action":"improve|sanctions|treaty","amount":10,"policy":"industry","scale":1}],"commandSummary":"что понял штаб","commandClarification":"пусто или вопрос","countryReports":[{"countryId":"точный id из списка countries","government":"публичные сведения о правительстве","internalPolitics":"внутренняя политика и общественные настроения","economy":"экономика и публичные меры","society":"социальные процессы","diplomacy":"публичные дипломатические шаги","defense":"публично известные оборонные решения","publicDecision":"главное публичное действие и последствия","nextStep":"вероятное направление следующего периода"}],"events":[{"date":"дата события внутри периода","location":"город или регион","category":"ПОЛИТИКА|ЭКОНОМИКА|ДИПЛОМАТИЯ|ВОЕННОЕ ДЕЛО|ОБЩЕСТВО","title":"газетный заголовок","subtitle":"подзаголовок","lead":"лид статьи","article":"полноценная статья из нескольких абзацев, абзацы разделять пустой строкой","description":"краткий анонс","importance":"major|normal","background":"предыстория","development":"развитие событий","consequences":"последствия","reaction":"международная и внутренняя реакция","visibility":"public"}],"actions":[{"countryId":"инициатор","type":"relation|treaty|war","targetCountryId":"цель","delta":-8}],"advisor":"краткий аналитический доклад советника"}.`;


app.post('/api/ai/command',async(req,res)=>{
 try{
  const b=req.body||{},w=b.world||{},order=clean(b.order,5000);
  if(!w.player?.id)throw Object.assign(new Error('Не определена страна игрока.'),{status:400});
  const regions=(Array.isArray(w.regions)?w.regions:[]).slice(0,700).map(r=>({key:clean(r.key,220),name:clean(r.name,120),countryId:clean(r.countryId,100),controller:clean(r.controller,100)}));
  const units=(Array.isArray(w.armies)?w.armies:[]).slice(0,100).map(u=>({id:clean(u.id,80),name:clean(u.name,100),type:clean(u.type,80),strength:Number(u.strength)||0,location:clean(u.location,120),regionKey:clean(u.regionKey,220)}));
  const countries=(Array.isArray(w.countries)?w.countries:[]).slice(0,220).map(c=>({id:clean(c.id,100),name:clean(c.name,120)}));
  const stateForAI={date:clean(w.date,40),country:w.player,treasury:Number(w.treasury)||0,manpower:Number(w.manpower)||0,army:Number(w.army)||0,wars:(w.wars||[]).slice(0,80),units,regions,countries};
  const system=`Ты — штабной и государственный исполнитель приказов в стратегии World Chronicle. Разбери текст приказа игрока и преобразуй его только в выполнимые игровые операции из списка. Не исполняй словами то, что не выражается операциями. Не придумывай регионы, части или государства: используй только точные id/key из состояния. Если приказ содержит несколько распоряжений, верни несколько операций. Если невозможно определить цель, верни пустой operations и объясни, что нужно уточнить. Для армии доступны: recruit (unitType строго один из "Пехотная дивизия","Моторизованная дивизия","Танковая дивизия","Воздушно-десантная дивизия"; optional name), move (unitId и targetRegionKey), attack (unitId и targetRegionKey), disband (unitId). Для страны доступны: declare_war (targetCountryId), diplomacy (targetCountryId и action "improve","sanctions" или "treaty"), mobilize (amount от 1 до 25), policy (policy строго "industry","infrastructure","social","military","stability","education","healthcare","agriculture","tax_reform","trade","public_order"; scale 1 или 2). Не добавляй лишние типы. Передвижение/атака должны быть подтверждены приложением по соседству и состоянию войны. recruit/mobilize/policy будут проверены по ресурсам. Не создавай приказ о капитуляции, мгновенном захвате страны, телепортации или автоматической победе. Верни строго JSON: {"operations":[{"type":"recruit|move|attack|disband|declare_war|diplomacy|mobilize|policy","unitType":"...","name":"...","unitId":"...","targetRegionKey":"...","targetCountryId":"...","amount":10,"policy":"industry","scale":1}],"summary":"коротко, что понято","clarification":"пусто или один конкретный вопрос"}.`;
  const raw=await ask(system,'ТЕКСТ ПРИКАЗА:\n'+order+'\n\nСОСТОЯНИЕ ИГРЫ:\n'+JSON.stringify(stateForAI),1000);
  const parsed=parse(raw),validRegions=new Set(regions.map(r=>r.key)),validUnits=new Set(units.map(u=>u.id)),validCountries=new Set(countries.map(c=>c.id));
  const operations=(Array.isArray(parsed.operations)?parsed.operations:[]).slice(0,8).flatMap(op=>{
   if(!op||typeof op!=='object')return [];
   if(op.type==='recruit'&&['Пехотная дивизия','Моторизованная дивизия','Танковая дивизия','Воздушно-десантная дивизия'].includes(op.unitType))return [{type:'recruit',unitType:op.unitType,name:clean(op.name,45)}];
   if(['move','attack'].includes(op.type)&&validUnits.has(op.unitId)&&validRegions.has(op.targetRegionKey))return [{type:op.type,unitId:op.unitId,targetRegionKey:op.targetRegionKey}];
   if(op.type==='disband'&&validUnits.has(op.unitId))return [{type:'disband',unitId:op.unitId}];
   if(op.type==='declare_war'&&validCountries.has(op.targetCountryId)&&op.targetCountryId!==w.player.id)return [{type:'declare_war',targetCountryId:op.targetCountryId}];
   if(op.type==='diplomacy'&&validCountries.has(op.targetCountryId)&&op.targetCountryId!==w.player.id&&['improve','sanctions','treaty'].includes(op.action))return [{type:'diplomacy',targetCountryId:op.targetCountryId,action:op.action}];
   if(op.type==='mobilize')return [{type:'mobilize',amount:Math.max(1,Math.min(25,Math.round(Number(op.amount)||5)))}];
   if(op.type==='policy'&&['industry','infrastructure','social','military','stability','education','healthcare','agriculture','tax_reform','trade','public_order'].includes(op.policy))return [{type:'policy',policy:op.policy,scale:Number(op.scale)===2?2:1}];
   return [];
  });
  res.json({operations,summary:clean(parsed.summary,700),clarification:clean(parsed.clarification,500)});
 }catch(e){res.status(e.status||502).json({error:clean(e.message,700)})}
});

app.post('/api/ai/world-turn',async(req,res)=>{
 const requestStarted=Date.now();
 let aiElapsedMs=0,promptChars=0;
 try{
  const b=req.body||{},world=compactWorld(b);
  if(!world.player?.id)throw Object.assign(new Error('В запросе отсутствует страна игрока.'),{status:400});
  const allowed=new Set((world.allCountryIds||world.countries.map(c=>c.id)).filter(id=>id&&id!==world.player.id));
  const {allCountryIds,...modelWorld}=world;
  let prompt='Симулируй период с '+(world.startDate||world.date)+' по '+(world.endDate||'не указана')+' ('+world.elapsedWeeks+' недель). Приказ игрока: '+(world.playerOrder||'Игрок не отдал отдельного приказа.')+'. Состояние мира на начало периода (подробно обнови 5 выбранных государств; остальные учитывай в общей мировой картине):\n'+JSON.stringify(modelWorld);
  promptChars=prompt.length;
  const multiplayerOrders=(Array.isArray(b.multiplayerOrders)?b.multiplayerOrders:[]).slice(0,20).map(p=>({name:clean(p.name,24),countryId:clean(p.countryId,90),order:clean(p.order,4000)})).filter(p=>p.order);if(multiplayerOrders.length)prompt+='\n\nСЕТЕВЫЕ ПРИКАЗЫ УЧАСТНИКОВ (каждый приказ относится только к указанной стране; не смешивай государства и не приписывай их действия стране ведущего):\n'+JSON.stringify(multiplayerOrders);
  const diplomaticContext=b.diplomaticContext&&typeof b.diplomaticContext==='object'?{messages:(b.diplomaticContext.messages||[]).slice(-20).map(m=>({fromCountryId:clean(m.fromCountryId,90),toCountryId:clean(m.toCountryId,90),message:clean(m.message,1000)})),proposals:(b.diplomaticContext.proposals||[]).slice(-20).map(x=>({fromCountryId:clean(x.fromCountryId,90),toCountryId:clean(x.toCountryId,90),type:clean(x.type,80),title:clean(x.title,140),message:clean(x.message,1200),status:clean(x.status,30),response:clean(x.response,1000)}))}:null;if(diplomaticContext&&(diplomaticContext.messages.length||diplomaticContext.proposals.length))prompt+='\n\nДИПЛОМАТИЧЕСКАЯ ПЕРЕПИСКА И СОГЛАСОВАННЫЕ ПРЕДЛОЖЕНИЯ ИГРОКОВ: учитывай контекст и реальные формулировки; не считай предложение подписанным до статуса accepted; не игнорируй отказ или встречные условия. Переписка конфиденциальна: не публикуй её текст и не раскрывай содержание третьим странам; публично отражай только официально объявленные итоги, например факт принятого договора. Если ИИ-государство инициирует публичное дипломатическое действие в отношении страны игрока, отрази его в actions с targetCountryId страны игрока.\n'+JSON.stringify(diplomaticContext);
  const aiStarted=Date.now();
  let raw;
  try{raw=await ask(worldSystem,prompt,2000)}finally{aiElapsedMs=Date.now()-aiStarted}
  const result=parse(raw);
  result.playerReport=clean(result.playerReport,9000);
  result.countryReports=(Array.isArray(result.countryReports)?result.countryReports:[]).filter(r=>r&&allowed.has(r.countryId)).map(r=>{
   const out={countryId:r.countryId};
   for(const k of ['government','internalPolitics','economy','society','diplomacy','defense','publicDecision','nextStep'])if(r[k])out[k]=clean(r[k],1800);
   return out;
  });
  result.events=(Array.isArray(result.events)?result.events:[]).filter(e=>e&&e.title&&(!e.visibility||e.visibility==='public')).slice(0,4).map(e=>({date:clean(e.date,80),location:clean(e.location,160),category:clean(e.category,32),title:clean(e.title,180),subtitle:clean(e.subtitle,300),lead:clean(e.lead,1000),article:clean(e.article,9000),description:clean(e.description||e.lead,2400),importance:e.importance==='major'?'major':'normal',background:clean(e.background,1800),development:clean(e.development,2400),consequences:clean(e.consequences,1800),reaction:clean(e.reaction,1400),visibility:'public'}));
  result.actions=(Array.isArray(result.actions)?result.actions:[]).filter(a=>a&&allowed.has(a.countryId)&&(allowed.has(a.targetCountryId)||a.targetCountryId===world.player.id)&&['relation','treaty','war'].includes(a.type)).slice(0,80).map(a=>({countryId:a.countryId,type:a.type,targetCountryId:a.targetCountryId,delta:Math.max(-8,Math.min(8,Number(a.delta)||0))}));
  const cc=world.commandContext||{},validRegions=new Set((cc.regions||[]).map(r=>r.key)),validUnits=new Set((cc.units||[]).map(u=>u.id)),validCommandCountries=new Set(world.allCountryIds||[]);
  result.commandOperations=(Array.isArray(result.commandOperations)?result.commandOperations:[]).slice(0,8).flatMap(op=>{
   if(!op||typeof op!=='object')return [];
   if(op.type==='recruit'&&['Пехотная дивизия','Моторизованная дивизия','Танковая дивизия','Воздушно-десантная дивизия'].includes(op.unitType))return [{type:'recruit',unitType:op.unitType,name:clean(op.name,45)}];
   if(['move','attack'].includes(op.type)&&validUnits.has(op.unitId)&&validRegions.has(op.targetRegionKey))return [{type:op.type,unitId:op.unitId,targetRegionKey:op.targetRegionKey}];
   if(op.type==='disband'&&validUnits.has(op.unitId))return [{type:'disband',unitId:op.unitId}];
   if(op.type==='declare_war'&&validCommandCountries.has(op.targetCountryId)&&op.targetCountryId!==world.player.id)return [{type:'declare_war',targetCountryId:op.targetCountryId}];
   if(op.type==='diplomacy'&&validCommandCountries.has(op.targetCountryId)&&op.targetCountryId!==world.player.id&&['improve','sanctions','treaty'].includes(op.action))return [{type:'diplomacy',targetCountryId:op.targetCountryId,action:op.action}];
   if(op.type==='mobilize')return [{type:'mobilize',amount:Math.max(1,Math.min(25,Math.round(Number(op.amount)||5)))}];
   if(op.type==='policy'&&['industry','infrastructure','social','military','stability','education','healthcare','agriculture','tax_reform','trade','public_order'].includes(op.policy))return [{type:'policy',policy:op.policy,scale:Number(op.scale)===2?2:1}];
   return [];
  });
  result.commandSummary=clean(result.commandSummary,700);result.commandClarification=clean(result.commandClarification,500);
  result.worldSummary=clean(result.worldSummary,5000);
  result.advisor=clean(result.advisor,3000);
  result.coverage={requested:world.countries.length,returned:result.countryReports.length,total:allowed.size};
  console.log('[World turn metrics]',JSON.stringify({elapsedMs:Date.now()-requestStarted,aiElapsedMs,elapsedWeeks:world.elapsedWeeks,countriesInPrompt:world.countries.length,countryReports:result.countryReports.length,events:result.events.length,promptChars,outputChars:raw.length,playerCountry:clean(world.player?.id,80)}));
  res.json(result);
 }catch(e){
  console.error('[World turn error]',JSON.stringify({elapsedMs:Date.now()-requestStarted,aiElapsedMs,promptChars,status:e.status||502,message:clean(e.message,240)}));
  res.status(e.status||502).json({error:clean(e.message,700)})
 }
});

app.post('/api/ai/diplomacy',route('Ты — правительство иностранного государства в геополитической стратегии. Отвечай как реальный дипломатический собеседник, оценивая интересы, отношения, ситуацию, текст предложения и историю переговоров. Если игрок предлагает посольство или улучшение отношений, оценивай это отдельно от договора. Не соглашайся автоматически: можешь принять, отказать, запросить уточнения или выдвинуть встречные условия. Решение должно быть последовательным и обоснованным. Не раскрывай закрытые сведения и не выдумывай уже подписанные документы. Верни строго JSON {"reply":"официальный ответ до 1400 символов","relationDelta":целое от -5 до 5,"decision":"accept|reject|negotiate|none","proposalStatus":"accepted|rejected|counteroffer|pending|none","advisorMessage":"короткое уведомление советника игрока до 500 символов"}.',b=>JSON.stringify({countryId:clean(b.countryId,80),countryName:clean(b.countryName,100),message:clean(b.message,2000),proposalType:clean(b.proposalType,80),isProposal:!!b.isProposal,history:(b.history||[]).slice(-8),world:b.world||{}}),1100));
app.post('/api/ai/advisor-chat',route('Ты — личный государственный советник игрока в стратегии World Chronicle. Отвечай на вопрос по краткой сводке страны и мира. Это отдельный лёгкий запрос советника, не расчёт мирового хода: не пытайся симулировать все государства и весь период. Различай подтверждённые факты, вероятные оценки и неизвестные сведения. Не раскрывай секретные данные и не выдумывай цифры, договоры, события или действия других стран. Давай практичные рекомендации и объясняй риски. Верни строго JSON {"answer":"ответ советника на русском до 2200 символов","notification":"короткая дополнительная рекомендация или пустая строка"}.',b=>JSON.stringify({question:clean(b.question,1200),history:(b.history||[]).slice(-4).map(x=>({from:clean(x.from,40),text:clean(x.text,500)})),world:compactAdvisorWorld(b.world||{}),inbox:(b.inbox||[]).slice(0,4).map(x=>({type:clean(x.type,40),title:clean(x.title,140),body:clean(x.body,350),createdAt:clean(x.createdAt,40)}))}),700));
app.post('/api/ai/advisor',route('Ты — стратегический советник главы государства. Подготовь содержательный аналитический доклад: внутренняя обстановка, экономика, армия, дипломатические риски, открытые мировые события и приоритетные шаги. Не выдумывай показатели. Только JSON {"advice":"доклад на русском до 3000 символов"}.',b=>JSON.stringify(compactWorld(b)),1400));
app.post('/api/ai/order',route('Ты — штабной аналитик игры. Разбери свободный приказ и сформулируй реалистичный план с этапами, ресурсными ограничениями, рисками и ожидаемыми последствиями. Не исполняй и не меняй показатели. Только JSON {"initiative":"формулировка","explanation":"подробное объяснение и этапы"}.',b=>JSON.stringify({order:clean(b.order,2000),world:b.world||{}}),900));


const multiplayerRooms=new Map();
const roomCode=()=>randomBytes(4).toString('hex').slice(0,6).toUpperCase();
const roomToken=()=>randomBytes(24).toString('hex');
const publicRoom=room=>({code:room.code,name:room.name,scenario:room.scenario,maxPlayers:room.maxPlayers,access:room.access,turn:room.turn,phase:room.phase,players:room.players.map(p=>({id:p.id,name:p.name,countryId:p.countryId,host:p.host,ready:p.ready,online:Date.now()-(p.lastSeen||0)<12000})),createdAt:room.createdAt});
const findRoom=(req,res)=>{const room=multiplayerRooms.get(String(req.params.code||'').toUpperCase());if(!room){res.status(404).json({error:'Комната не найдена или сервер был перезапущен.'});return null}room.lastActivity=Date.now();return room};
const findPlayer=(room,token)=>{const p=room.players.find(p=>p.token&&p.token===String(token||''));if(p)p.lastSeen=Date.now();return p};
app.get('/api/rooms',(_req,res)=>{
 const now=Date.now();for(const [code,r] of multiplayerRooms)if(now-r.lastActivity>12*60*60*1000)multiplayerRooms.delete(code);
 res.json({rooms:Array.from(multiplayerRooms.values()).filter(r=>r.access==='public'&&r.phase!=='closed'&&r.players.length<r.maxPlayers).map(publicRoom).slice(0,50)});
});
app.post('/api/rooms', (req,res)=>{
 const b=req.body||{},name=clean(b.name,48).trim(),playerName=clean(b.playerName,24).trim()||'Игрок',countryId=clean(b.countryId,90).trim()||'Russia',scenario=['1836','1914','1936','2026'].includes(String(b.scenario))?String(b.scenario):'1936',maxPlayers=Math.max(2,Math.min(20,Number(b.maxPlayers)||5)),access=b.access==='public'?'public':'private';
 if(!name)return res.status(400).json({error:'Укажите название кампании.'});
 if(Array.from(multiplayerRooms.values()).filter(r=>r.phase!=='closed').length>=200)return res.status(503).json({error:'Сервер комнат временно перегружен.'});
 let code;do{code=roomCode()}while(multiplayerRooms.has(code));
 const player={id:roomToken().slice(0,12),token:roomToken(),name:playerName,countryId,host:true,ready:false,order:'',lastSeen:Date.now()};
 const room={code,name,scenario,maxPlayers,access,hostId:player.id,players:[player],chat:[],diplomacyMessages:[],proposals:[],notifications:{},turn:1,phase:'lobby',weeks:1,snapshot:b.snapshot&&typeof b.snapshot==='object'?b.snapshot:null,createdAt:new Date().toISOString(),lastActivity:Date.now(),revision:1};
 multiplayerRooms.set(code,room);res.status(201).json({room:publicRoom(room),token:player.token,playerId:player.id});
});
app.post('/api/rooms/:code/join',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{};
 if(room.phase!=='lobby')return res.status(409).json({error:'Ход уже рассчитывается. Подключитесь после завершения периода.'});
 if(room.players.length>=room.maxPlayers)return res.status(409).json({error:'В комнате нет свободных мест.'});
 const playerName=clean(b.playerName,24).trim()||'Игрок',countryId=clean(b.countryId,90).trim()||'Russia';
 if(room.players.some(p=>p.countryId===countryId))return res.status(409).json({error:'Это государство уже выбрал другой участник.'});
 const player={id:roomToken().slice(0,12),token:roomToken(),name:playerName,countryId,host:false,ready:false,order:'',lastSeen:Date.now()};room.players.push(player);room.notifications[player.id]=[];room.revision++;
 res.status(201).json({room:publicRoom(room),token:player.token,playerId:player.id});
});
app.get('/api/rooms/:code',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const player=findPlayer(room,req.query.token);if(!player)return res.status(403).json({error:'Неверный ключ участника.'});
 res.json({room:publicRoom(room),playerId:player.id,host:player.host,orders:room.players.map(p=>({playerId:p.id,name:p.name,countryId:p.countryId,order:p.order,ready:p.ready})),snapshot:room.snapshot,revision:room.revision,weeks:room.weeks});
});
app.post('/api/rooms/:code/order',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},player=findPlayer(room,b.token);if(!player)return res.status(403).json({error:'Неверный ключ участника.'});
 if(room.phase!=='lobby')return res.status(409).json({error:'Нельзя менять приказ во время расчёта хода.'});
 player.order=clean(b.order,4000).trim();player.ready=false;room.revision++;res.json({ok:true,room:publicRoom(room)});
});
app.post('/api/rooms/:code/ready',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},player=findPlayer(room,b.token);if(!player)return res.status(403).json({error:'Неверный ключ участника.'});
 if(room.phase!=='lobby')return res.status(409).json({error:'Сейчас идёт расчёт хода.'});
 player.ready=!!b.ready;room.revision++;res.json({ok:true,room:publicRoom(room)});
});
app.post('/api/rooms/:code/begin',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},player=findPlayer(room,b.token);if(!player||!player.host)return res.status(403).json({error:'Только ведущий может начать расчёт хода.'});
 if(room.phase!=='lobby')return res.status(409).json({error:'Ход уже рассчитывается.'});
 if(room.players.length<2)return res.status(409).json({error:'Для сетевого хода нужен хотя бы один второй участник.'});
 const unready=room.players.filter(p=>!p.ready||Date.now()-(p.lastSeen||0)>12000);if(unready.length)return res.status(409).json({error:'Не все участники подтвердили готовность.'});
 room.phase='resolving';room.revision++;res.json({ok:true,orders:room.players.map(p=>({playerId:p.id,name:p.name,countryId:p.countryId,order:p.order})),room:publicRoom(room)});
});
app.post('/api/rooms/:code/complete',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},player=findPlayer(room,b.token);if(!player||!player.host)return res.status(403).json({error:'Только ведущий может завершить расчёт.'});
 if(room.phase!=='resolving')return res.status(409).json({error:'Комната не находится в режиме расчёта.'});
 const snapshot=b.snapshot;if(!snapshot||typeof snapshot!=='object'||JSON.stringify(snapshot).length>7500000)return res.status(400).json({error:'Некорректный или слишком большой снимок кампании.'});
 room.snapshot=snapshot;room.turn++;room.weeks=Math.max(1,Math.min(52,Number(b.weeks)||1));room.phase='lobby';room.players.forEach(p=>{p.ready=false;p.order=''});room.revision++;res.json({ok:true,room:publicRoom(room)});
});
app.post('/api/rooms/:code/abort',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},player=findPlayer(room,b.token);if(!player||!player.host)return res.status(403).json({error:'Только ведущий может отменить расчёт.'});
 if(room.phase==='resolving'){room.phase='lobby';room.players.forEach(p=>p.ready=false);room.revision++}res.json({ok:true,room:publicRoom(room)});
});
app.post('/api/rooms/:code/leave',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},player=findPlayer(room,b.token);if(!player)return res.status(403).json({error:'Неверный ключ участника.'});
 if(player.host){room.phase='closed';multiplayerRooms.delete(room.code)}else{room.players=room.players.filter(p=>p.id!==player.id);room.revision++}
 res.json({ok:true});
});


const socialId=()=>roomToken().slice(0,16);
const notifyPlayer=(room,playerId,item)=>{if(!room.notifications)room.notifications={};room.notifications[playerId]=room.notifications[playerId]||[];room.notifications[playerId].push({...item,id:socialId(),createdAt:new Date().toISOString(),read:false});room.notifications[playerId]=room.notifications[playerId].slice(-100)};
const socialPlayer=(room,token,res)=>{const p=findPlayer(room,token);if(!p)res.status(403).json({error:'Неверный ключ участника.'});return p};
app.get('/api/rooms/:code/social',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const p=socialPlayer(room,req.query.token,res);if(!p)return;
 const messages=(room.diplomacyMessages||[]).filter(m=>m.fromCountryId===p.countryId||m.toCountryId===p.countryId).slice(-100);
 const proposals=(room.proposals||[]).filter(x=>x.fromCountryId===p.countryId||x.toCountryId===p.countryId||x.status==='accepted').slice(-80);
 res.json({chat:(room.chat||[]).slice(-100),messages,proposals,notifications:(room.notifications?.[p.id]||[]).slice(-60),players:room.players.map(x=>({id:x.id,name:x.name,countryId:x.countryId,online:Date.now()-(x.lastSeen||0)<12000}))});
});
app.post('/api/rooms/:code/chat',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},p=socialPlayer(room,b.token,res);if(!p)return;
 const message=clean(b.message,1200).trim();if(!message)return res.status(400).json({error:'Пустое сообщение.'});
 const item={id:socialId(),playerId:p.id,playerName:p.name,countryId:p.countryId,message,createdAt:new Date().toISOString()};
 room.chat=room.chat||[];room.chat.push(item);room.chat=room.chat.slice(-300);room.revision++;res.status(201).json({message:item});
});
app.post('/api/rooms/:code/diplomacy/messages',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},p=socialPlayer(room,b.token,res);if(!p)return;
 const toCountryId=clean(b.toCountryId,90).trim(),message=clean(b.message,1600).trim();
 if(!toCountryId||toCountryId===p.countryId||!message)return res.status(400).json({error:'Укажите государство и текст сообщения.'});
 const recipient=room.players.find(x=>x.countryId===toCountryId);if(!recipient)return res.status(404).json({error:'В выбранном государстве нет игрока. Для переговоров с ИИ используйте дипломатический канал ИИ.'});
 const item={id:socialId(),fromPlayerId:p.id,fromPlayerName:p.name,fromCountryId:p.countryId,toPlayerId:recipient.id,toCountryId,message,createdAt:new Date().toISOString(),kind:'message'};
 room.diplomacyMessages=room.diplomacyMessages||[];room.diplomacyMessages.push(item);room.diplomacyMessages=room.diplomacyMessages.slice(-300);
 notifyPlayer(room,recipient.id,{type:'diplomacy_message',title:'Новое дипломатическое сообщение',body:p.countryId+': '+message.slice(0,260),fromCountryId:p.countryId,messageId:item.id});
 room.revision++;res.status(201).json({message:item});
});
app.post('/api/rooms/:code/proposals',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},p=socialPlayer(room,b.token,res);if(!p)return;
 const toCountryId=clean(b.toCountryId,90).trim(),type=clean(b.type,80).trim()||'diplomatic',title=clean(b.title,140).trim(),message=clean(b.message,1800).trim();
 if(!toCountryId||toCountryId===p.countryId||!message)return res.status(400).json({error:'Укажите государство и содержание инициативы.'});
 const recipient=room.players.find(x=>x.countryId===toCountryId);if(!recipient)return res.status(404).json({error:'В выбранном государстве нет игрока. Для переговоров с ИИ отправьте инициативу через канал ИИ.'});
 const proposal={id:socialId(),fromPlayerId:p.id,fromPlayerName:p.name,fromCountryId:p.countryId,toPlayerId:recipient.id,toCountryId,type,title:title||'Дипломатическая инициатива',message,status:'pending',response:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 room.proposals=room.proposals||[];room.proposals.push(proposal);room.proposals=room.proposals.slice(-150);
 notifyPlayer(room,recipient.id,{type:'proposal',title:'Дипломатическое предложение: '+proposal.title,body:p.countryId+' направляет инициативу. Изучите условия и ответьте.',proposalId:proposal.id,fromCountryId:p.countryId});
 notifyPlayer(room,p.id,{type:'proposal_sent',title:'Предложение направлено',body:'Инициатива передана государству '+toCountryId+'. Ожидается ответ.',proposalId:proposal.id,toCountryId});
 room.revision++;res.status(201).json({proposal});
});
app.post('/api/rooms/:code/proposals/:id/respond',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},p=socialPlayer(room,b.token,res);if(!p)return;
 const proposal=(room.proposals||[]).find(x=>x.id===req.params.id);if(!proposal)return res.status(404).json({error:'Предложение не найдено.'});
 if(proposal.toCountryId!==p.countryId)return res.status(403).json({error:'Ответить на это предложение может только государство-получатель.'});
 if(proposal.status!=='pending')return res.status(409).json({error:'По этому предложению уже принято решение.'});
 const action=['accept','reject','counter'].includes(b.action)?b.action:'reject',response=clean(b.response,1600).trim();
 proposal.status=action==='accept'?'accepted':action==='reject'?'rejected':'counteroffer';proposal.response=response;proposal.updatedAt=new Date().toISOString();proposal.respondedBy=p.id;
 const labels={accepted:'ПРИНЯТО',rejected:'ОТКЛОНЕНО',counteroffer:'ВСТРЕЧНОЕ ПРЕДЛОЖЕНИЕ'};
 if(proposal.fromPlayerId)notifyPlayer(room,proposal.fromPlayerId,{type:'proposal_result',title:'Ответ на дипломатическую инициативу: '+labels[proposal.status],body:p.countryId+': '+(response||labels[proposal.status]),proposalId:proposal.id,status:proposal.status,fromCountryId:p.countryId});
 notifyPlayer(room,p.id,{type:'proposal_recorded',title:'Решение зарегистрировано',body:'Ваш ответ государству '+proposal.fromCountryId+' сохранён.',proposalId:proposal.id,status:proposal.status});
 room.revision++;res.json({ok:true,proposal});
});

app.post('/api/rooms/:code/social/ai-action',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},p=socialPlayer(room,b.token,res);if(!p)return;
 if(!p.host)return res.status(403).json({error:'Только ведущий фиксирует результаты мирового ИИ.'});
 const a=b.action||{},fromCountryId=clean(a.countryId,90).trim(),targetCountryId=clean(a.targetCountryId,90).trim(),type=clean(a.type,30),recipient=room.players.find(x=>x.countryId===targetCountryId);
 if(!fromCountryId||!recipient||!['relation','treaty','war'].includes(type))return res.status(400).json({error:'Некорректное дипломатическое действие ИИ.'});
 const actor=clean(b.countryName||fromCountryId,120);
 if(type==='treaty'||(type==='relation'&&Number(a.delta)>0)){
  const embassy=type==='relation';
  const proposal={id:socialId(),fromPlayerId:null,fromPlayerName:'Правительство '+actor,fromCountryId,toPlayerId:recipient.id,toCountryId:recipient.countryId,type:embassy?'embassy':'treaty',title:embassy?'Предложение об обмене дипломатическими миссиями':'Предложение о международном договоре',message:clean(b.message||(embassy?'Правительство '+actor+' предлагает направить дипломатическую миссию для улучшения двусторонних отношений.':'Правительство '+actor+' предлагает начать оформление двустороннего договора.'),1800),status:'pending',response:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),initiatedByAI:true};
  room.proposals=room.proposals||[];room.proposals.push(proposal);room.proposals=room.proposals.slice(-150);
  notifyPlayer(room,recipient.id,{type:'ai_proposal',title:'ИИ направил дипломатическое предложение',body:actor+' предлагает '+(embassy?'обмен дипломатическими миссиями.':'заключить договор.')+' Откройте дипломатию, чтобы принять решение.',proposalId:proposal.id,fromCountryId});
  room.revision++;return res.status(201).json({ok:true,proposal});
 }
 const title='Военно-политическое действие ИИ';
 const body=actor+' предприняло военное действие в отношении вашего государства. Проверьте хронику и оборонную обстановку.';
 notifyPlayer(room,recipient.id,{type:'ai_action',title,body,fromCountryId,actionType:type,delta:Number(a.delta)||0});
 room.revision++;res.status(201).json({ok:true});
});

app.post('/api/rooms/:code/social/ai-message',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},p=socialPlayer(room,b.token,res);if(!p)return;
 const toCountryId=clean(b.toCountryId,90).trim(),message=clean(b.message,1600).trim(),reply=clean(b.reply,1800).trim(),isProposal=!!b.isProposal;
 if(!toCountryId||!message||!reply)return res.status(400).json({error:'Не хватает текста дипломатического обмена.'});
 const createdAt=new Date().toISOString(),base={fromPlayerId:p.id,fromPlayerName:p.name,fromCountryId:p.countryId,toCountryId,createdAt,kind:'ai'};
 room.diplomacyMessages=room.diplomacyMessages||[];
 room.diplomacyMessages.push({...base,id:socialId(),toPlayerId:null,message,kind:'ai_outgoing'},{...base,id:socialId(),fromPlayerId:null,fromPlayerName:'Правительство '+clean(b.countryName||toCountryId,120),fromCountryId:toCountryId,toPlayerId:p.id,toCountryId:p.countryId,message:reply,kind:'ai_reply',createdAt:new Date().toISOString()});
 room.diplomacyMessages=room.diplomacyMessages.slice(-300);
 let proposal=null;
 if(isProposal){
  const decision=['accept','reject','negotiate'].includes(b.decision)?b.decision:'none',status=decision==='accept'?'accepted':decision==='reject'?'rejected':decision==='negotiate'?'counteroffer':'pending';
  proposal={id:socialId(),fromPlayerId:p.id,fromPlayerName:p.name,fromCountryId:p.countryId,toPlayerId:null,toCountryId,type:clean(b.proposalType,80)||'diplomatic',title:clean(b.title,140)||'Дипломатическое предложение',message,status,response:reply,createdAt,updatedAt:new Date().toISOString(),aiCounterparty:true};
  room.proposals=room.proposals||[];room.proposals.push(proposal);room.proposals=room.proposals.slice(-150);
 }
 notifyPlayer(room,p.id,{type:'ai_response',title:isProposal?'Ответ ИИ на дипломатическое предложение':'Ответ иностранного правительства',body:clean(b.advisorMessage||reply,600),fromCountryId:toCountryId,proposalId:proposal?.id,status:proposal?.status});
 room.revision++;res.status(201).json({ok:true,proposal});
});
app.post('/api/rooms/:code/social/apply',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},p=socialPlayer(room,b.token,res);if(!p)return;
 if(!p.host)return res.status(403).json({error:'Только ведущий применяет дипломатические соглашения к общему состоянию.'});
 const ready=(room.proposals||[]).filter(x=>['accepted','rejected','counteroffer'].includes(x.status)&&!x.applied);
 ready.forEach(x=>{x.applied=true;x.appliedAt=new Date().toISOString()});
 res.json({proposals:ready});
});
app.post('/api/rooms/:code/social/read',(req,res)=>{
 const room=findRoom(req,res);if(!room)return;const b=req.body||{},p=socialPlayer(room,b.token,res);if(!p)return;
 (room.notifications?.[p.id]||[]).forEach(n=>n.read=true);res.json({ok:true});
});

app.listen(PORT,'0.0.0.0',()=>console.log('World Chronicle Railway server listening on '+PORT));
