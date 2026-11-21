import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const app=express();
app.set('trust proxy',1);
const PORT=process.env.PORT||8080;
const ORIGIN=(process.env.CORS_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
const PROVIDER=(process.env.AI_PROVIDER||'openrouter').toLowerCase();
const MODEL=PROVIDER==='groq'?(process.env.GROQ_MODEL||'openai/gpt-oss-120b'):(process.env.OPENROUTER_MODEL||'openrouter/free');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

app.use(cors({origin(origin,cb){if(!origin||!ORIGIN.length||ORIGIN.includes(origin))return cb(null,true);cb(new Error('Origin not allowed'));}}));
app.use(express.json({limit:'2mb'}));
app.use('/api/ai',rateLimit({windowMs:24*60*60*1000,limit:40,standardHeaders:true,legacyHeaders:false,message:{error:'Дневной лимит AI-запросов World Chronicle исчерпан. Попробуйте завтра.'}}));

app.get('/',(_req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.get('/index.html',(_req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.get('/app.js',(_req,res)=>res.sendFile(path.join(ROOT,'app.js')));
app.get('/turn-system.js',(_req,res)=>res.sendFile(path.join(ROOT,'turn-system.js')));
app.get('/styles.css',(_req,res)=>res.sendFile(path.join(ROOT,'styles.css')));
app.get('/health',(_req,res)=>res.json({ok:true,service:'world-chronicle',provider:PROVIDER,configured:Boolean(PROVIDER==='groq'?process.env.GROQ_API_KEY:process.env.OPENROUTER_API_KEY),model:MODEL,hosting:'railway'}));

const clean=(v,n=4000)=>String(v??'').slice(0,n);
async function ask(system,user,maxTokens=1200){
 const groq=PROVIDER==='groq';
 const apiKey=groq?process.env.GROQ_API_KEY:process.env.OPENROUTER_API_KEY;
 if(!apiKey){const e=new Error(groq?'На сервере не задан GROQ_API_KEY.':'На сервере не задан OPENROUTER_API_KEY.');e.status=503;throw e}
 const body={model:MODEL,temperature:.72,max_tokens:maxTokens,messages:[{role:'system',content:system},{role:'user',content:user}]};
 if(!groq&&MODEL.startsWith('nvidia/'))body.provider={only:['nvidia'],allow_fallbacks:false};
 const headers={Authorization:'Bearer '+apiKey,'Content-Type':'application/json'};
 if(!groq){headers['HTTP-Referer']=process.env.SITE_URL||'https://world-chronicle-production.up.railway.app/';headers['X-Title']='World Chronicle';}
 const endpoint=groq?'https://api.groq.com/openai/v1/chat/completions':'https://openrouter.ai/api/v1/chat/completions';
 const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(body)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(d.error?.message||'AI provider error '+r.status);e.status=r.status===429?429:502;throw e}
 const c=d.choices?.[0]?.message?.content;if(!c)throw new Error('ИИ не вернул ответ.');return c
}
function parse(raw){
 const t=raw.replace(/^\x60\x60\x60(?:json)?\s*/i,'').replace(/\s*\x60\x60\x60$/,'').trim();
 const s=t.indexOf('{'),e=t.lastIndexOf('}');
 if(s<0||e<=s)throw Error('ИИ вернул ответ неверного формата.');
 return JSON.parse(t.slice(s,e+1));
}
const route=(system,user,max)=>async(req,res)=>{try{res.json(parse(await ask(system,user(req.body||{}),max)))}catch(e){res.status(e.status||502).json({error:clean(e.message,700)})}};
const compactWorld=b=>({
 date:clean(b.date,40),startDate:clean(b.startDate,40),endDate:clean(b.endDate,40),elapsedWeeks:Math.max(1,Math.min(520,Number(b.elapsedWeeks)||1)),
 playerOrder:clean(b.playerOrder,6000),year:Number(b.year)||null,scenario:clean(b.scenario,100),turn:Number(b.turn)||0,
 player:b.player||{},relations:b.relations||{},wars:(b.wars||[]).slice(0,80),treaties:(b.treaties||[]).slice(0,80),
 laws:(b.laws||[]).slice(0,80),countries:(b.countries||[]).slice(0,220),
 previousReports:(b.previousReports||[]).slice(0,220)
});

const worldSystem=`Ты — автономный симулятор альтернативной истории World Chronicle. Ты ведёшь каждое государство из countries, кроме player.id. Не ограничивайся великими державами: у каждого государства есть собственное правительство, внутренняя политика, экономика, общество, дипломатия и вооружённые силы. Это пошаговая симуляция: игрок задаёт свободный текст приказа, затем выбирает срок — от недели до года. Просчитай весь указанный интервал целиком, а не один условный ход. Учитывай стартовую и конечную дату, сценарий, географию, ресурсы, соседей, войны, договоры, отношения, предыдущие доклады и приказ игрока. Сохраняй непрерывность, причинно-следственные связи и правдоподобный темп событий. Не повторяй один и тот же текст.

ПРИКАЗ ИГРОКА: выполни его в пределах доступных ресурсов и возможностей страны. Опиши, что реально предприняло правительство игрока, какие ведомства и общественные силы вовлечены, какие возникли препятствия, реакция общества и иностранных правительств, а также промежуточные и итоговые последствия. Не превращай приказ в мгновенный успех: длительные реформы могут только начаться, столкнуться с сопротивлением или дать частичный результат. Если приказ пуст, опиши естественное развитие страны без выдумывания приказа.

ПУБЛИЧНОСТЬ: countryReports и events содержат только известные обществу и иностранным наблюдателям факты: опубликованные решения, парламент, заявления министров, открытые заседания, публичные протесты, забастовки, выборы, визиты, ноты, подписанные договоры, открытые мобилизационные меры, учения, видимые передвижения войск и официальные операции. Не раскрывай закрытые переговоры, планы разведки, агентурные сведения, тайные операции, секретные протоколы и скрытые намерения. Для других государств показывай их внутреннюю политику только в публичной части.

Не выдумывай точные экономические или военные показатели, которых нет во входных данных. Альтернативные события допустимы, но обозначай их как развитие текущей симуляции. Не приписывай странам невозможные ресурсы.

Верни строго один JSON:
{"playerReport":"подробная хроника действий страны игрока за весь интервал, 5-10 абзацев, по-русски","worldSummary":"развёрнутый обзор мировой обстановки за интервал","countryReports":[{"countryId":"точный id","government":"публичные сведения о правительстве","internalPolitics":"внутренняя политика, парламент, оппозиция и общественные настроения","economy":"экономика и публичные меры","society":"социальные процессы и инфраструктура","diplomacy":"публичные дипломатические шаги","defense":"публично известные оборонные решения","publicDecision":"главное публичное действие и его последствия","nextStep":"вероятное направление следующего периода"}],"events":[{"category":"ПОЛИТИКА|ЭКОНОМИКА|ДИПЛОМАТИЯ|ВОЕННОЕ ДЕЛО|ОБЩЕСТВО","title":"заголовок","description":"подробная новость на 2-5 предложений","visibility":"public"}],"actions":[{"countryId":"инициатор","type":"relation|treaty|war","targetCountryId":"цель","delta":-8}],"advisor":"аналитический доклад советника игроку"}.

Верни индивидуальный countryReport для каждой страны из списка, кроме player.id. Крупным и вовлечённым державам дай подробные разделы, малым странам — компактные, но конкретные. Сформируй 5-12 значимых публичных событий. Не объявляй войну без серьёзной причины. Никогда не принимай решения за игрока: только опиши последствия его приказа.`;

app.post('/api/ai/world-turn',async(req,res)=>{
 try{
  const b=req.body||{},world=compactWorld(b);
  if(!world.player?.id)throw Object.assign(new Error('В запросе отсутствует страна игрока.'),{status:400});
  const allowed=new Set(world.countries.map(c=>c.id).filter(id=>id&&id!==world.player.id));
  const prompt='Симулируй период с '+(world.startDate||world.date)+' по '+(world.endDate||'не указана')+' ('+world.elapsedWeeks+' недель). Приказ игрока: '+(world.playerOrder||'Игрок не отдал отдельного приказа.')+'. Состояние мира на начало периода:\n'+JSON.stringify(world);
  const result=parse(await ask(worldSystem,prompt,14000));
  result.playerReport=clean(result.playerReport,9000);
  result.countryReports=(Array.isArray(result.countryReports)?result.countryReports:[]).filter(r=>r&&allowed.has(r.countryId)).map(r=>{
   const out={countryId:r.countryId};
   for(const k of ['government','internalPolitics','economy','society','diplomacy','defense','publicDecision','nextStep'])if(r[k])out[k]=clean(r[k],1800);
   return out;
  });
  result.events=(Array.isArray(result.events)?result.events:[]).filter(e=>e&&e.title&&e.description&&(!e.visibility||e.visibility==='public')).slice(0,12).map(e=>({category:clean(e.category,32),title:clean(e.title,180),description:clean(e.description,1800),visibility:'public'}));
  result.actions=(Array.isArray(result.actions)?result.actions:[]).filter(a=>a&&allowed.has(a.countryId)&&(allowed.has(a.targetCountryId)||a.targetCountryId===world.player.id)&&['relation','treaty','war'].includes(a.type)).slice(0,80).map(a=>({countryId:a.countryId,type:a.type,targetCountryId:a.targetCountryId,delta:Math.max(-8,Math.min(8,Number(a.delta)||0))}));
  result.worldSummary=clean(result.worldSummary,5000);
  result.advisor=clean(result.advisor,3000);
  result.coverage={requested:allowed.size,returned:result.countryReports.length};
  res.json(result);
 }catch(e){res.status(e.status||502).json({error:clean(e.message,700)})}
});

app.post('/api/ai/diplomacy',route('Ты — публично выступающее правительство иностранного государства в геополитической стратегии. Отвечай от лица указанной страны, учитывай интересы, отношения, обстановку и сообщение игрока. Можешь отказать, торговаться и предлагать условия. Не раскрывай закрытые сведения. Верни только JSON {"reply":"развёрнутый официальный ответ до 1600 символов","relationDelta":целое от -5 до 5}.',b=>JSON.stringify({countryId:clean(b.countryId,80),countryName:clean(b.countryName,100),message:clean(b.message,2000),history:(b.history||[]).slice(-8),world:b.world||{}}),900));
app.post('/api/ai/advisor',route('Ты — стратегический советник главы государства. Подготовь содержательный аналитический доклад: внутренняя обстановка, экономика, армия, дипломатические риски, открытые мировые события и приоритетные шаги. Не выдумывай показатели. Только JSON {"advice":"доклад на русском до 3000 символов"}.',b=>JSON.stringify(compactWorld(b)),1400));
app.post('/api/ai/order',route('Ты — штабной аналитик игры. Разбери свободный приказ и сформулируй реалистичный план с этапами, ресурсными ограничениями, рисками и ожидаемыми последствиями. Не исполняй и не меняй показатели. Только JSON {"initiative":"формулировка","explanation":"подробное объяснение и этапы"}.',b=>JSON.stringify({order:clean(b.order,2000),world:b.world||{}}),900));

app.listen(PORT,'0.0.0.0',()=>console.log('World Chronicle Railway server listening on '+PORT));
