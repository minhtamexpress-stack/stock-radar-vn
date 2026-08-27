import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {MARKET_UNIVERSE} from '../universe.js';
import {fetchVpsQuote} from './source-vps.mjs';
const DATA=new URL('../data/',import.meta.url),CTX=new URL('../data/context/',import.meta.url),SOCIAL=new URL('../data/social/',import.meta.url);
await mkdir(SOCIAL,{recursive:true});
const symbols=MARKET_UNIVERSE.map(x=>x.symbol),now=()=>new Date().toISOString(),safe=s=>s.replace(/[^A-Z0-9]/gi,'_');
async function readJson(url,fallback={}){try{return JSON.parse(await readFile(url,'utf8'))}catch{return fallback}}
async function pooled(items,limit,fn){let cursor=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const i=cursor++;await fn(items[i],i)}}))}
function flatten(o,p='',out=[]){if(o==null)return out;if(Array.isArray(o)){o.forEach((v,i)=>flatten(v,`${p}.${i}`,out));return out}if(typeof o==='object'){for(const [k,v] of Object.entries(o))flatten(v,p?`${p}.${k}`:k,out);return out}out.push([p.toLowerCase(),o]);return out}
function pick(flat,patterns,exclude=[]){for(const [k,v] of flat){if(exclude.some(x=>k.includes(x)))continue;if(patterns.some(x=>k.includes(x))){const n=Number(v);if(Number.isFinite(n))return{key:k,value:n}}}return null}
function foreignFrom(raw,price){
  const f=flatten(raw);
  const buyVal=pick(f,['foreignbuyvalue','foreign_buy_value','foreignbuyval','frbuyvalue','nnmua_gt','foreignbuyamt','fbvalue'],['room']);
  const sellVal=pick(f,['foreignsellvalue','foreign_sell_value','foreignsellval','frsellvalue','nnban_gt','foreignsellamt','fsvalue'],['room']);
  const buyVol=pick(f,['foreignbuyvolume','foreign_buy_volume','foreignbuyvol','frbuyvol','nnmua_kl','foreignbuyqty','foreignbuyquantity','fbvol','fbvolume'],['room']);
  const sellVol=pick(f,['foreignsellvolume','foreign_sell_volume','foreignsellvol','frsellvol','nnban_kl','foreignsellqty','foreignsellquantity','fsvol','fsvolume'],['room']);
  let b=buyVal?.value??null,s=sellVal?.value??null,estimated=false,unit='raw value';
  if((b==null||s==null)&&Number.isFinite(price)&&buyVol&&sellVol){b=buyVol.value*price;s=sellVol.value*price;estimated=true;unit='VND estimated from volume × price'}
  const net=Number.isFinite(b)&&Number.isFinite(s)?b-s:null,gross=Number.isFinite(b)&&Number.isFinite(s)?Math.abs(b)+Math.abs(s):null;
  const ratio=gross?net/gross:null,score=ratio==null?50:Math.max(0,Math.min(100,50+ratio*60));
  return{buyValue:b,sellValue:s,netValue:net,buyVolume:buyVol?.value??null,sellVolume:sellVol?.value??null,netRatio:ratio,score,estimated,unit,keys:{buyVal:buyVal?.key,sellVal:sellVal?.key,buyVol:buyVol?.key,sellVol:sellVol?.key}};
}
const UA={'User-Agent':'Mozilla/5.0 StockRadarVN/1.6'};
async function fetchText(url){const r=await fetch(url,{headers:UA,signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.text()}
function decode(s=''){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function tag(b,n){const m=b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`,'i'));return m?decode(m[1].trim()):''}
function sent(t=''){const x=t.toLowerCase(),pos=['mua ròng','tăng trưởng','lợi nhuận tăng','vượt kế hoạch','trúng thầu','cổ tức','tích cực','bứt phá','nâng hạng','tăng mạnh'],neg=['bán ròng','thua lỗ','lợi nhuận giảm','xử phạt','điều tra','khởi tố','cảnh báo','nợ xấu','giảm mạnh','tiêu cực','hủy niêm yết'];const p=pos.filter(k=>x.includes(k)).length,n=neg.filter(k=>x.includes(k)).length;return p>n?'positive':n>p?'negative':'neutral'}
async function googleNews(q){const xml=await fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=vi&gl=VN&ceid=VN:vi`);return[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,8).map(m=>{const b=m[1],title=tag(b,'title'),url=tag(b,'link'),pubDate=tag(b,'pubDate'),sm=b.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);return{title,url,pubDate,source:sm?decode(sm[1].trim()):'',sentiment:sent(title)}}).filter(x=>x.title)}
async function publicSocial(symbol){
  const queries=[['Facebook',`site:facebook.com "${symbol}" cổ phiếu chứng khoán`],['TikTok',`site:tiktok.com "${symbol}" cổ phiếu chứng khoán`],['Zalo',`site:zalo.me "${symbol}" cổ phiếu chứng khoán`]];
  const platforms=[];for(const [platform,q] of queries){try{const items=await googleNews(q);platforms.push({platform,ok:true,items})}catch(e){platforms.push({platform,ok:false,items:[],error:String(e.message||e)})}}
  const items=platforms.flatMap(p=>p.items.map(x=>({...x,platform:p.platform}))),pos=items.filter(x=>x.sentiment==='positive').length,neg=items.filter(x=>x.sentiment==='negative').length,neu=items.length-pos-neg;
  const score=items.length?Math.max(0,Math.min(100,50+(pos-neg)*8/Math.max(1,items.length))):null;
  return{symbol,provider:'Public indexed social signals',platforms,items,positive:pos,negative:neg,neutral:neu,score,generatedAt:now(),note:'Chỉ nội dung công khai được công cụ tìm kiếm lập chỉ mục; không truy cập bài riêng tư/đòi đăng nhập.'};
}
const checks=[];
await pooled(symbols,3,async symbol=>{
  const market=await readJson(new URL(`${safe(symbol)}.json`,DATA),{}),ctxFile=new URL(`${safe(symbol)}.json`,CTX),ctx=await readJson(ctxFile,{symbol,data:{},errors:{}});ctx.data??={};ctx.errors??={};
  let quote=null,foreign=null,quoteError=null;try{quote=await fetchVpsQuote(symbol);foreign=foreignFrom(quote?.data,Number(market.price))}catch(e){quoteError=String(e.message||e)}
  let social=null,socialError=null;try{social=await publicSocial(symbol)}catch(e){socialError=String(e.message||e)}
  ctx.data.foreignFlow={provider:'VPS Realtime Board',sourceUrl:quote?.sourceUrl||null,...foreign,generatedAt:now()};ctx.data.publicSocial=social;ctx.errors.vpsForeignFlow=quoteError;ctx.errors.publicSocial=socialError;ctx.generatedAt=now();
  await writeFile(ctxFile,JSON.stringify(ctx));await writeFile(new URL(`${safe(symbol)}.json`,SOCIAL),JSON.stringify(social||{symbol,error:socialError,items:[],generatedAt:now()}));
  checks.push({symbol,foreignOk:Number.isFinite(foreign?.netValue),foreignEstimated:foreign?.estimated??false,socialOk:(social?.items?.length??0)>0,socialCount:social?.items?.length??0,quoteError,socialError,foreignKeys:foreign?.keys??null});
});
const healthFile=new URL('health.json',DATA),health=await readJson(healthFile,{});health.foreignOk=checks.filter(x=>x.foreignOk).length;health.foreignTotal=symbols.length;health.socialOk=checks.filter(x=>x.socialOk).length;health.socialTotal=symbols.length;health.foreignSocialChecks=checks;health.generatedAt=now();await writeFile(healthFile,JSON.stringify(health));
console.log(`Foreign flow ${health.foreignOk}/${symbols.length}; public social ${health.socialOk}/${symbols.length}`);
