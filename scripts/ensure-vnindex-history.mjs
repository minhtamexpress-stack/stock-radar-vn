import {readFile,writeFile} from 'node:fs/promises';

const FILE=new URL('../data/_VNINDEX.json',import.meta.url);
const UA={'User-Agent':'Mozilla/5.0 StockRadarVN/1.7','Accept':'application/json,text/plain,*/*'};
const now=()=>new Date().toISOString();
const n=v=>v==null||v===''?null:(Number.isFinite(Number(v))?Number(v):null);

function normalize(payload,provider,providerSymbol='VNINDEX'){
  const c=Array.isArray(payload?.c)?payload.c:[];
  const h=Array.isArray(payload?.h)?payload.h:[];
  const l=Array.isArray(payload?.l)?payload.l:[];
  const o=Array.isArray(payload?.o)?payload.o:[];
  const v=Array.isArray(payload?.v)?payload.v:[];
  const t=Array.isArray(payload?.t)?payload.t:[];
  const points=[];
  for(let i=0;i<c.length;i++){
    const close=n(c[i]),high=n(h[i])??close,low=n(l[i])??close,open=n(o[i])??close,volume=n(v[i])??0,ts=n(t[i]);
    if(close==null||high==null||low==null||ts==null)continue;
    points.push({t:ts>1e12?Math.floor(ts/1000):Math.floor(ts),open,high,low,close,volume:Number.isFinite(volume)?volume:0});
  }
  points.sort((a,b)=>a.t-b.t);
  const last=points.at(-1),prev=points.at(-2),price=last?.close??null,previousClose=prev?.close??null;
  return{symbol:'^VNINDEX',provider,providerSymbol,currency:'VND',price,previousClose,changePct:price!=null&&previousClose?((price/previousClose)-1)*100:null,volume:last?.volume??null,timestamp:last?.t??null,points,generatedAt:now(),fallback:true};
}

async function getJson(url){
  const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error(`HTTP ${r.status}`);
  return r.json();
}

async function fetchFallback(){
  const from=Math.floor((Date.now()-560*86400000)/1000),to=Math.floor(Date.now()/1000);
  const candidates=[
    ['VNDirect TradingView',`https://finfo-api.vndirect.com.vn/tradingView/history?symbol=VNINDEX`],
    ['VNDirect DChart',`https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&from=${from}&to=${to}&symbol=VNINDEX`]
  ];
  let lastError='VN-Index fallback unavailable';
  for(const [provider,url] of candidates){
    try{
      const payload=await getJson(url),out=normalize(payload,provider);
      if(out.price!=null&&out.points.length>=60)return out;
      lastError=`${provider}: only ${out.points.length} points`;
    }catch(e){lastError=`${provider}: ${String(e.message||e)}`}
  }
  throw Error(lastError);
}

let current=null;
try{current=JSON.parse(await readFile(FILE,'utf8'))}catch{}
const currentPoints=Array.isArray(current?.points)?current.points.length:0;
if(current?.price!=null&&currentPoints>=60){
  console.log(`VNINDEX history OK from ${current.provider||'existing'}: ${currentPoints} points`);
  process.exit(0);
}

try{
  const fallback=await fetchFallback();
  await writeFile(FILE,JSON.stringify(fallback));
  console.log(`VNINDEX history repaired from ${fallback.provider}: ${fallback.points.length} points`);
}catch(e){
  console.warn(`VNINDEX history fallback warning: ${String(e.message||e)}`);
  console.warn(`Keeping existing VNINDEX snapshot with ${currentPoints} points`);
}
