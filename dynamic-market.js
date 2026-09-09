import {indicators} from './core.js';

const safe=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const fileKey=s=>String(s||'').toUpperCase().startsWith('^')?`_${safe(s)}`:safe(s);
const n=v=>v==null||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const isoDate=d=>new Date(d).toISOString().slice(0,10);

export function normalizeVndirectPayload(payload,symbol=''){
  const rows=Array.isArray(payload?.data)?payload.data:Array.isArray(payload)?payload:[];
  const points=rows.map(r=>{
    const close=n(r.adClose)??n(r.close)??n(r.average);
    const high=n(r.adHigh)??n(r.high)??close;
    const low=n(r.adLow)??n(r.low)??close;
    const open=n(r.adOpen)??n(r.open)??close;
    const volume=n(r.nmVolume)??n(r.volume)??0;
    const rawDate=r.date||r.tradingDate||r.time||r.t;
    const ts=rawDate?Date.parse(rawDate):NaN;
    if(!Number.isFinite(close)||!Number.isFinite(high)||!Number.isFinite(low)||!Number.isFinite(ts))return null;
    return{t:Math.floor(ts/1000),open,high,low,close,volume:Number.isFinite(volume)?volume:0};
  }).filter(Boolean).sort((a,b)=>a.t-b.t);
  const last=points.at(-1),prev=points.at(-2);
  const price=last?.close??null,previousClose=prev?.close??null;
  return{symbol:safe(symbol),provider:'VNDirect Open Data',providerSymbol:safe(symbol),price,previousClose,changePct:price!=null&&previousClose?((price/previousClose)-1)*100:null,volume:last?.volume??null,timestamp:last?.t??null,points,generatedAt:new Date().toISOString(),dynamic:true,sourceKind:'DYNAMIC_VNDIRECT'};
}

export function normalizeTradingViewPayload(payload,symbol=''){
  const c=Array.isArray(payload?.c)?payload.c:[],h=Array.isArray(payload?.h)?payload.h:[],l=Array.isArray(payload?.l)?payload.l:[],o=Array.isArray(payload?.o)?payload.o:[],v=Array.isArray(payload?.v)?payload.v:[],t=Array.isArray(payload?.t)?payload.t:[];
  const points=[];
  for(let i=0;i<c.length;i++){
    const close=n(c[i]),high=n(h[i])??close,low=n(l[i])??close,open=n(o[i])??close,volume=n(v[i])??0,ts=n(t[i]);
    if(close==null||high==null||low==null||ts==null)continue;
    points.push({t:ts>1e12?Math.floor(ts/1000):Math.floor(ts),open,high,low,close,volume});
  }
  points.sort((a,b)=>a.t-b.t);
  const last=points.at(-1),prev=points.at(-2),price=last?.close??null,previousClose=prev?.close??null;
  return{symbol:safe(symbol),provider:'VNDirect Chart',providerSymbol:safe(symbol),price,previousClose,changePct:price!=null&&previousClose?((price/previousClose)-1)*100:null,volume:last?.volume??null,timestamp:last?.t??null,points,generatedAt:new Date().toISOString(),dynamic:true,sourceKind:'DYNAMIC_VNDIRECT_CHART'};
}

async function fetchJson(url,opts={}){const r=await fetch(url,{cache:'no-store',mode:'cors',...opts});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}

async function fromStatic(symbol){
  const s=safe(symbol),key=fileKey(symbol);if(!s)return null;
  const r=await fetch(`./data/${key}.json`,{cache:'no-store'});if(!r.ok)throw Error(`Static HTTP ${r.status}`);
  const m=await r.json();if(m?.price==null||!Array.isArray(m?.points)||m.points.length<15)throw Error('Static snapshot thiếu dữ liệu');
  m.symbol=s;m.sourceKind='STATIC_SNAPSHOT';m.dynamic=false;m.indicators=indicators(m.points||[]);return m;
}

async function fromVndirect(symbol){
  const s=safe(symbol);if(!s)throw Error('Mã không hợp lệ');
  const from=isoDate(Date.now()-560*86400000),to=isoDate(Date.now()+86400000),q=encodeURIComponent(`code:${s}~date:gte:${from}~date:lte:${to}`),url=`https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date&q=${q}&size=700&page=1`;
  const p=await fetchJson(url,{headers:{Accept:'application/json'}}),m=normalizeVndirectPayload(p,s);if(m.price==null||m.points.length<15)throw Error('VNDirect không có đủ lịch sử');m.indicators=indicators(m.points);return m;
}

async function fromTradingView(symbol){
  const s=safe(symbol);if(!s)throw Error('Mã không hợp lệ');
  const candidates=[`https://finfo-api.vndirect.com.vn/tradingView/history?symbol=${encodeURIComponent(s)}`,`https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&from=${Math.floor((Date.now()-560*86400000)/1000)}&to=${Math.floor(Date.now()/1000)}&symbol=${encodeURIComponent(s)}`];
  let last;
  for(const url of candidates){try{const p=await fetchJson(url,{headers:{Accept:'application/json'}}),m=normalizeTradingViewPayload(p,s);if(m.price!=null&&m.points.length>=15){m.indicators=indicators(m.points);return m}}catch(e){last=e}}
  throw last||Error('Không có nguồn chart dự phòng');
}

export async function loadMarketSnapshot(symbol,{allowDynamic=true}={}){
  const s=safe(symbol);if(!s)return{symbol:s,price:null,points:[],indicators:indicators([]),error:'Mã không hợp lệ',sourceKind:'NONE'};
  const errors=[];try{return await fromStatic(symbol)}catch(e){errors.push(String(e.message||e))}
  if(allowDynamic){try{return await fromVndirect(s)}catch(e){errors.push(String(e.message||e))}try{return await fromTradingView(s)}catch(e){errors.push(String(e.message||e))}}
  return{symbol:s,price:null,points:[],indicators:indicators([]),error:errors.join(' • ')||'Chưa có dữ liệu',sourceKind:'NONE',dynamic:true};
}

export async function loadContextSnapshot(symbol){
  const s=safe(symbol);if(!s)return{symbol:s,data:{},sourceKind:'NONE'};
  try{const r=await fetch(`./data/context/${s}.json`,{cache:'no-store'});if(r.ok){const x=await r.json();x.sourceKind='STATIC_CONTEXT';return x}}catch{}
  const data={fundamentals:{},organizationFlow:null,events:null},errors={};let usable=0;
  try{const u=`https://bgapidatafeed.vps.com.vn/getliststockbaseinfo/${encodeURIComponent(s)}`,d=await fetchJson(u,{headers:{Accept:'application/json,text/plain,*/*'}});data.fundamentals.vps={symbol:s,provider:'VPS Public Datafeed',sourceUrl:u,data:d,generatedAt:new Date().toISOString()};usable++}catch(e){errors.vpsBase=String(e.message||e)}
  try{const u=`https://histdatafeed.vps.com.vn/company/events/${encodeURIComponent(s)}`,d=await fetchJson(u,{headers:{Accept:'application/json,text/plain,*/*'}});data.events={symbol:s,provider:'VPS Company Events',sourceUrl:u,data:d,generatedAt:new Date().toISOString()};usable++}catch(e){errors.events=String(e.message||e)}
  return{symbol:s,provider:'Dynamic public sources',data,errors,generatedAt:new Date().toISOString(),sourceKind:usable?'DYNAMIC_CONTEXT':'NONE'};
}
