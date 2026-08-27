import { mkdir, writeFile } from 'node:fs/promises';
import { MARKET_UNIVERSE } from '../universe.js';
const OUT = new URL('../data/', import.meta.url);
const CTX = new URL('../data/context/', import.meta.url);
const NEWS = new URL('../data/news/', import.meta.url);
await mkdir(OUT, { recursive: true });
await mkdir(CTX, { recursive: true });
await mkdir(NEWS, { recursive: true });
const symbols=['^VNINDEX',...MARKET_UNIVERSE.map(x=>x.symbol)];
const stockSymbols=symbols.filter(s=>!s.startsWith('^'));
const safe=s=>s.replace(/[^A-Z0-9]/gi,'_');
const ua={'User-Agent':'Mozilla/5.0 StockRadarVN/1.4'};
const now=()=>new Date().toISOString();
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
  return {symbol,provider:'Yahoo Finance',providerSymbol:ps,currency:meta.currency,price,previousClose,changePct:price!=null&&previousClose?((price/previousClose)-1)*100:null,volume:points.at(-1)?.volume??null,timestamp:meta.regularMarketTime??points.at(-1)?.t??null,points,generatedAt:now()};
}
async function fetchJson(url){const r=await fetch(url,{headers:ua});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
async function fetchText(url){const r=await fetch(url,{headers:ua});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text()}
async function pooled(items,limit,fn){let cursor=0;const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const i=cursor++;await fn(items[i],i)}});await Promise.all(workers)}
function decodeXml(s=''){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function tag(block,name){const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));return m?decodeXml(m[1].trim()):''}
function sentiment(title=''){
  const t=title.toLowerCase();
  const pos=['tăng trưởng','lợi nhuận tăng','doanh thu tăng','kỷ lục','vượt kế hoạch','mở rộng','trúng thầu','chia cổ tức','mua ròng','nâng hạng','khởi sắc','tích cực','bứt phá','tăng mạnh'];
  const neg=['thua lỗ','lợi nhuận giảm','doanh thu giảm','vi phạm','xử phạt','điều tra','khởi tố','bán ròng','nợ xấu tăng','giảm mạnh','rủi ro','tiêu cực','hủy niêm yết','cảnh báo'];
  const p=pos.filter(x=>t.includes(x)).length,n=neg.filter(x=>t.includes(x)).length;
  return p>n?'positive':n>p?'negative':'neutral';
}
async function newsFor(symbol){
  const q=encodeURIComponent(`"${symbol}" cổ phiếu chứng khoán Việt Nam`);
  const xml=await fetchText(`https://news.google.com/rss/search?q=${q}&hl=vi&gl=VN&ceid=VN:vi`);
  const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,12).map(m=>{
    const b=m[1],title=tag(b,'title'),link=tag(b,'link'),pubDate=tag(b,'pubDate');
    const sourceMatch=b.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i),source=sourceMatch?decodeXml(sourceMatch[1].trim()):'';
    return{title,headline:title,link,url:link,pubDate,source,sentiment:sentiment(title)};
  }).filter(x=>x.title);
  return{symbol,provider:'Google News RSS',items,generatedAt:now()};
}
const marketChecks=[];
await pooled(symbols,6,async s=>{let out;try{out=await yahoo(s);marketChecks.push({name:s,ok:out.price!=null,provider:'Yahoo Finance'})}catch(e){out={symbol:s,provider:'Yahoo Finance',price:null,previousClose:null,changePct:null,volume:null,timestamp:null,points:[],error:String(e.message||e),generatedAt:now()};marketChecks.push({name:s,ok:false,error:String(e.message||e),provider:'Yahoo Finance'})}await writeFile(new URL(`${safe(s)}.json`,OUT),JSON.stringify(out))});
const contextChecks=[];
await pooled(stockSymbols,5,async s=>{let out;try{const data=await fetchJson(`https://vietstock.info/api/stocks/${encodeURIComponent(s)}`);out={symbol:s,provider:'Vietstock Public API',data,generatedAt:now()};contextChecks.push({name:`context:${s}`,ok:true,provider:'Vietstock Public API'})}catch(e){out={symbol:s,provider:'Vietstock Public API',data:null,error:String(e.message||e),generatedAt:now()};contextChecks.push({name:`context:${s}`,ok:false,error:String(e.message||e),provider:'Vietstock Public API'})}await writeFile(new URL(`${safe(s)}.json`,CTX),JSON.stringify(out))});
const newsChecks=[];
await pooled(stockSymbols,4,async s=>{let out;try{out=await newsFor(s);newsChecks.push({name:`news:${s}`,ok:out.items.length>0,count:out.items.length,provider:'Google News RSS'})}catch(e){out={symbol:s,provider:'Google News RSS',items:[],error:String(e.message||e),generatedAt:now()};newsChecks.push({name:`news:${s}`,ok:false,error:String(e.message||e),provider:'Google News RSS'})}await writeFile(new URL(`${safe(s)}.json`,NEWS),JSON.stringify(out))});
async function saveRemote(url,name){
  try{const j=await fetchJson(url);await writeFile(new URL(name,OUT),JSON.stringify({...j,_snapshotAt:now()}));return {name,ok:true}}
  catch(e){await writeFile(new URL(name,OUT),JSON.stringify({ok:false,error:String(e.message||e),_snapshotAt:now()}));return {name,ok:false,error:String(e.message||e)}}
}
const external=[];external.push(await saveRemote('https://vietstock.info/api/intel/daily','intel.json'));external.push(await saveRemote('https://vietstock.info/health','provider.json'));
const checks=[...marketChecks,...contextChecks,...newsChecks,...external];
const failedSymbols=marketChecks.filter(x=>!x.ok).map(x=>x.name),marketOk=marketChecks.filter(x=>x.ok).length;
await writeFile(new URL('health.json',OUT),JSON.stringify({ok:marketOk>=Math.max(8,Math.floor(symbols.length*.75)),marketOk,marketTotal:symbols.length,contextOk:contextChecks.filter(x=>x.ok).length,contextTotal:contextChecks.length,newsOk:newsChecks.filter(x=>x.ok).length,newsTotal:newsChecks.length,checks,failedSymbols,generatedAt:now()}));
console.log(`Generated ${symbols.length} market + ${stockSymbols.length} context + ${stockSymbols.length} news snapshots + intel/health`);
