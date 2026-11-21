import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const app=express();
const PORT=process.env.PORT||8080;
const ORIGIN=(process.env.CORS_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
const MODEL=process.env.OPENROUTER_MODEL||'openrouter/free';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

app.use(cors({origin(origin,cb){if(!origin||!ORIGIN.length||ORIGIN.includes(origin))return cb(null,true);cb(new Error('Origin not allowed'));}}));
app.use(express.json({limit:'2mb'}));
app.use('/api/ai',rateLimit({windowMs:24*60*60*1000,limit:40,standardHeaders:true,legacyHeaders:false,message:{error:'Дневной лимит AI-запросов World Chronicle исчерпан. Попробуйте завтра.'}}));

app.get('/',(_req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.get('/index.html',(_req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.get('/app.js',(_req,res)=>res.sendFile(path.join(ROOT,'app.js')));
app.get('/styles.css',(_req,res)=>res.sendFile(path.join(ROOT,'styles.css')));
app.get('/health',(_req,res)=>res.json({ok:true,service:'world-chronicle',configured:Boolean(process.env.OPENROUTER_API_KEY),model:MODEL,hosting:'railway'}));

const clean=(v,n=4000)=>String(v??'').slice(0,n);
async function ask(system,user,maxTokens=1200){
 if(!process.env.OPENROUTER_API_KEY){const e=new Error('На сервере не задан OPENROUTER_API_KEY.');e.status=503;throw e}
 const body={model:MODEL,temperature:.72,max_tokens:maxTokens,messages:[{role:'system',content:system},{role:'user',content:user}]};
 if(MODEL.startsWith('nvidia/'))body.provider={only:['nvidia'],allow_fallbacks:false};
 const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENROUTER_API_KEY,'Content-Type':'application/json','HTTP-Referer':process.env.SITE_URL||'https://world-chronicle-production.up.railway.app/','X-Title':'World Chronicle'},body:JSON.stringify(body)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(d.error?.message||'AI provider error '+r.status);e.status=r.status===429?429:502;throw e}
 const c=d.choices?.[0]?.message?.content;if(!c)throw new Error('ИИ не вернул ответ.');return c
}
function parse(raw){
 const t=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
 const s=t.indexOf('{'),e=t.lastIndexOf('}');
 if(s<0||e<=s)throw Error('ИИ вернул ответ неверного формата.');
 return JSON.parse(t.slice(s,e+1));
}
const route=(system,user,max)=>async(req,res)=>{try{res.json(parse(await ask(system,user(req.body||{}),max)))}catch(e){res.status(e.status||502).json({error:clean(e.message,700)})}};
const compactWorld=b=>({
 date:clean(b.date,40),year:Number(b.year)||null,scenario:clean(b.scenario,100),turn:Number(b.turn)||0,
 player:b.player||{},relations:b.relations||{},wars:(b.wars||[]).slice(0,80),treaties:(b.treaties||[]).slice(0,80),
 laws:(b.laws||[]).slice(0,80),countries:(b.countries||[]).slice(0,220),
 previousReports:(b.previousReports||[]).slice(0,220)
});

const worldSystem=`Ты — автономный симулятор мира World Chronicle уровня глубокой геополитической песочницы. Ты управляешь КАЖДЫМ государством из переданного списка countries, кроме player.id. Не ограничивайся несколькими великими державами: у каждой страны есть собственное правительство, внутренняя политика, экономика, общество, дипломатия и вооружённые силы. Каждый ход страны самостоятельно оценивают интересы и предпринимают правдоподобные действия. Учитывай сценарий и год, географию, ресурсы, соседей, действующие войны, договоры, отношения и предыдущие доклады. Сохраняй непрерывность: не отменяй прошлые решения без причины, развивай реформы, кризисы и конфликты постепенно. Не повторяй один и тот же текст.

ПУБЛИЧНОСТЬ: в countryReports и events включай только сведения, которые могут быть известны обществу или иностранным наблюдателям: опубликованные указы и законы, парламентские решения, заявления министров, открытые заседания, известные экономические меры, бюджетные приоритеты без секретных цифр, публичные протесты, забастовки, выборы, официальные визиты, ноты, подписанные договоры, открытые мобилизационные меры, учения, передвижения войск, видимые приготовления и официальные военные операции. НЕ раскрывай секретные переговоры, закрытые совещания, планы разведки, агентурные сведения, тайные операции, секретные протоколы и скрытые намерения. Не выдумывай секреты и не выводи их как факт.

Не выдумывай точные показатели ВВП, населения, бюджетов, численности армий, результаты выборов, реальные законы или исторические события, если их нет во входных данных. Для вымышленной альтернативной истории можешь создавать правдоподобные события, но обозначай их как события текущей симуляции. Не приписывай государству невозможные ресурсы и возможности. Малые страны тоже получают самостоятельную политику, но их доклады могут быть компактнее.

Верни СТРОГО один JSON-объект без Markdown и текста вокруг:
{
 "worldSummary":"развёрнутый публичный обзор мировой обстановки за ход",
 "countryReports":[
  {"countryId":"точный id","government":"кто формирует исполнительную власть и как она действует; не выдумывай имена без оснований",
   "internalPolitics":"публичные решения правительства, парламент, оппозиция, общественные настроения и внутренние кризисы",
   "economy":"публичные экономические меры, торговля, промышленность, бюджетные приоритеты и экономические последствия",
   "society":"общественные процессы, регионы, протесты, социальные меры, культура или инфраструктура",
   "diplomacy":"публичные внешнеполитические шаги и отношения с другими странами",
   "defense":"публично известные оборонные решения, учения, мобилизация, закупки или военные действия",
   "publicDecision":"главное конкретное публичное действие страны в этом ходу, с причинами и последствиями",
   "nextStep":"вероятное направление следующего хода, не секретный план"}
 ],
 "events":[{"category":"ПОЛИТИКА|ЭКОНОМИКА|ДИПЛОМАТИЯ|ВОЕННОЕ ДЕЛО|ОБЩЕСТВО","title":"заголовок","description":"подробная новость на 2-5 предложений","visibility":"public"}],
 "actions":[{"countryId":"инициатор из countryReports","type":"relation|treaty|war","targetCountryId":"точный id цели","delta":-8}],
 "advisor":"доклад советника игроку: риски, возможности и рекомендации"
}

ОБЯЗАТЕЛЬНО: верни countryReports для КАЖДОЙ страны из countries, кроме страны игрока; используй точные id. Каждая страна должна получить содержательный индивидуальный доклад, а не заглушку. Для крупных и вовлечённых держав дай 6-8 содержательных разделов по 1-2 предложения; для малых стран — компактно, но индивидуально. Сформируй 5-12 действительно значимых публичных мировых событий, не заполняй ленту общими фразами. actions добавляй только если действие действительно меняет международные отношения, договор или войну. Не объявляй войну без серьёзной причины. Игроком управляешь не ты: никогда не меняй решения, законы или внутреннюю политику player.id.`;

app.post('/api/ai/world-turn',async(req,res)=>{
 try{
  const b=req.body||{},world=compactWorld(b);
  if(!world.player?.id)throw Object.assign(new Error('В запросе отсутствует страна игрока.'),{status:400});
  const allowed=new Set(world.countries.map(c=>c.id).filter(id=>id&&id!==world.player.id));
  const result=parse(await ask(worldSystem,'Состояние мира на начало хода. Прими решения за все страны, кроме игрока. Предыдущие публичные доклады нужны для непрерывности.\n'+JSON.stringify(world),14000));
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
