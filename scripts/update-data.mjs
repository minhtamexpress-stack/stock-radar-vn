import { mkdir, writeFile } from 'node:fs/promises';
const OUT = new URL('../data/', import.meta.url);
const CTX = new URL('../data/context/', import.meta.url);
await mkdir(OUT, { recursive: true });
await mkdir(CTX, { recursive: true });
const symbols=['^VNINDEX','VNM','VIC','FPT','HPG','MWG','MBB','TCB','ACB','CTG','HDB','GAS'];
const stockSymbols=symbols.filter(s=>!s.startsWith('^'));
const safe=s=>s.replace(/[^A-Z0-9]/gi,'_');
const ua={'User-Agent':'Mozilla/5.0 StockRadarVN/1.3'};
async function yahoo(symbol){
  const ps=symbol.startsWith('^')||symbol.includes('.')?symbol:`${symbol}.VN`;
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ps)}?range=1y&interval=1d&events=div%2Csplits&includePrePost=false`;
  const r=await fetch(url,{headers:ua});
  if(!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const j=await r.json(),x=j?.chart?.result?.[0];
  if(!x) throw new Error(j?.chart?.error?.description||'Yahoo không có dữ liệu');
  const q=x.indicators?.quote?.[0]||{},ts=x.timestamp||[],points=[];
  for(let i=0;i<ts.length;i++){
    const close=q.close?.[i],high=q.high?.[i],low=q.low?.[i],volume=q.volume?.[i];
    if([close,high,low].every(Number.isFinite)) points.push({t:ts[i],close,high,low,volume:Number.isFinite(volume)?volume:0});
  }
  const meta=x.meta||{},price=Number.isFinite(meta.regularMarketPrice)?meta.regularMarketPrice:points.at(-1)?.close??null;
  const previousClose=Number.isFinite(meta.chartPreviousClose)?meta.chartPreviousClose:points.at(-2)?.close??null;
  return {symbol,provider:'Yahoo Finance',providerSymbol:ps,currency:meta.currency,price,previousClose,changePct:price!=null&&previousClose?((price/previousClose)-1)*100:null,volume:points.at(-1)?.volume??null,timestamp:meta.regularMarketTime??points.at(-1)?.t??null,points,generatedAt:new Date().toISOString()};
}
async function fetchJson(url){
  const r=await fetch(url,{headers:ua});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  return r.json();
}
const marketChecks=[];
for(const s of symbols){
  let out;
  try{out=await yahoo(s);marketChecks.push({name:s,ok:out.price!=null})}catch(e){out={symbol:s,provider:'Yahoo Finance',price:null,previousClose:null,changePct:null,volume:null,timestamp:null,points:[],error:String(e.message||e),generatedAt:new Date().toISOString()};marketChecks.push({name:s,ok:false,error:String(e.message||e)})}
  await writeFile(new URL(`${safe(s)}.json`,OUT),JSON.stringify(out));
}
const contextChecks=[];
for(const s of stockSymbols){
  let out;
  try{
    const data=await fetchJson(`https://vietstock.info/api/stocks/${encodeURIComponent(s)}`);
    out={symbol:s,provider:'Vietstock Public API',data,generatedAt:new Date().toISOString()};
    contextChecks.push({name:`context:${s}`,ok:true});
  }catch(e){
    out={symbol:s,provider:'Vietstock Public API',data:null,error:String(e.message||e),generatedAt:new Date().toISOString()};
    contextChecks.push({name:`context:${s}`,ok:false,error:String(e.message||e)});
  }
  await writeFile(new URL(`${safe(s)}.json`,CTX),JSON.stringify(out));
}
async function saveRemote(url,name){
  try{const j=await fetchJson(url);await writeFile(new URL(name,OUT),JSON.stringify({...j,_snapshotAt:new Date().toISOString()}));return {name,ok:true}}
  catch(e){await writeFile(new URL(name,OUT),JSON.stringify({ok:false,error:String(e.message||e),_snapshotAt:new Date().toISOString()}));return {name,ok:false,error:String(e.message||e)}}
}
const external=[];
external.push(await saveRemote('https://vietstock.info/api/intel/daily','intel.json'));
external.push(await saveRemote('https://vietstock.info/health','provider.json'));
const checks=[...marketChecks,...contextChecks,...external];
const failedSymbols=marketChecks.filter(x=>!x.ok).map(x=>x.name);
await writeFile(new URL('health.json',OUT),JSON.stringify({ok:marketChecks.filter(x=>x.ok).length>=8,checks,failedSymbols,generatedAt:new Date().toISOString()}));
console.log(`Generated ${symbols.length} market snapshots + ${stockSymbols.length} context snapshots + intel/health`);
