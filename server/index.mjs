import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
const app=express(),PORT=process.env.PORT||3000,ORIGIN=(process.env.CORS_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean),MODEL=process.env.OPENROUTER_MODEL||'openrouter/free';
app.use(cors({origin(origin,cb){if(!origin||!ORIGIN.length||ORIGIN.includes(origin))return cb(null,true);cb(new Error('Origin not allowed'));}}));
app.use(express.json({limit:'180kb'}));
app.use('/api/ai',rateLimit({windowMs:24*60*60*1000,limit:40,standardHeaders:true,legacyHeaders:false,message:{error:'Дневной лимит AI-запросов World Chronicle исчерпан. Попробуйте завтра.'}}));
app.get('/health',(_req,res)=>res.json({ok:true,service:'world-chronicle-ai',configured:Boolean(process.env.OPENROUTER_API_KEY),model:MODEL}));
const clean=(v,n=4000)=>String(v??'').slice(0,n);
async function ask(system,user,maxTokens=900){
 if(!process.env.OPENROUTER_API_KEY){const e=new Error('На сервере не задан OPENROUTER_API_KEY. Добавьте ключ OpenRouter в секретные переменные.');e.status=503;throw e}
 const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENROUTER_API_KEY,'Content-Type':'application/json','HTTP-Referer':process.env.SITE_URL||'https://dimazubov1123-del.github.io/world-chronicle/','X-Title':'World Chronicle'},body:JSON.stringify({model:MODEL,temperature:.75,max_tokens:maxTokens,messages:[{role:'system',content:system},{role:'user',content:user}]})});
 const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error?.message||'AI provider error '+r.status);e.status=r.status===429?429:502;throw e}
 const c=d.choices?.[0]?.message?.content;if(!c)throw new Error('ИИ не вернул ответ.');return c
}
function parse(raw){const t=raw.replace(/^\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`$/,'').trim(),s=t.indexOf('{'),e=t.lastIndexOf('}');if(s<0||e<=s)throw Error('ИИ вернул ответ неверного формата.');return JSON.parse(t.slice(s,e+1))}
const route=(system,user,max)=>async(req,res)=>{try{res.json(parse(await ask(system,user(req.body||{}),max)))}catch(e){res.status(e.status||502).json({error:clean(e.message,500)})}};
const world=b=>JSON.stringify({date:clean(b.date,40),turn:Number(b.turn)||0,player:b.player||{},relations:b.relations||{},wars:b.wars||[],treaties:b.treaties||[],laws:b.laws||[],countries:(b.countries||[]).slice(0,220)});
app.post('/api/ai/world-turn',route('Ты — движок grand strategy World Chronicle. Управляй всеми странами, кроме страны игрока. Принимай самостоятельные правдоподобные решения, учитывая интересы, баланс сил и международную обстановку. Верни только JSON: {"actions":[{"countryId":"точный ID из списка","type":"relation|treaty|war|decision","delta":число от -8 до 8,"title":"кратко","description":"последствие"}],"events":[{"category":"ДИПЛОМАТИЯ|ЭКОНОМИКА|ВОЕННОЕ ДЕЛО|ПОЛИТИКА","title":"заголовок","description":"новость"}],"advisor":"совет игроку"}. Не более 5 действий и 3 событий. Войну объявляй редко и только при убедительной причине. Не управляй страной игрока.',b=>'Состояние мира на текущий ход. Выбери несколько стран из списка и определи их решения.\n'+world(b),1300));
app.post('/api/ai/diplomacy',route('Ты — правительство иностранного государства в геополитической стратегии. Отвечай от лица указанной страны, учитывай интересы, отношения, обстановку и сообщение игрока. Можешь отказать, торговаться и предлагать условия. Верни только JSON {"reply":"ответ до 1200 символов","relationDelta":целое от -5 до 5}.',b=>JSON.stringify({countryId:clean(b.countryId,80),countryName:clean(b.countryName,100),message:clean(b.message,2000),history:(b.history||[]).slice(-8),world:b.world||{}}),700));
app.post('/api/ai/advisor',route('Ты — стратегический советник главы государства. Дай конкретный доклад: внутренняя обстановка, экономика, армия, дипломатические риски и 3 приоритетных шага. Не выдумывай показатели. Только JSON {"advice":"доклад на русском до 1800 символов"}.',b=>world(b),900));
app.post('/api/ai/order',route('Ты — штабной аналитик игры. Разбери свободный приказ и сформулируй его как игровую инициативу. Не исполняй и не меняй показатели. Только JSON {"initiative":"краткая формулировка","explanation":"что предстоит подготовить"}.',b=>JSON.stringify({order:clean(b.order,2000),world:b.world||{}}),600));
app.listen(PORT,'0.0.0.0',()=>console.log('World Chronicle AI server listening on '+PORT));
