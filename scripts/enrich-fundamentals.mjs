import { readFile, writeFile } from 'node:fs/promises';
import { MARKET_UNIVERSE } from '../universe.js';
import { fetchCafeFFundamentals } from './source-cafef-page.mjs';

const DATA=new URL('../data/',import.meta.url);
const CTX=new URL('../data/context/',import.meta.url);
const symbols=MARKET_UNIVERSE.map(x=>x.symbol);
const safe=s=>s.replace(/[^A-Z0-9]/gi,'_');
const now=()=>new Date().toISOString();
async function readJson(url,fallback={}){try{return JSON.parse(await readFile(url,'utf8'))}catch{return fallback}}
async function pooled(items,limit,fn){let cursor=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const i=cursor++;await fn(items[i],i)}}))}
const missing=v=>v==null||!Number.isFinite(Number(v));
const checks=[];
await pooled(symbols,3,async symbol=>{
  const file=new URL(`${safe(symbol)}.json`,CTX),marketFile=new URL(`${safe(symbol)}.json`,DATA);
  const ctx=await readJson(file,{symbol,data:{},errors:{}}),market=await readJson(marketFile,{});
  ctx.data??={};ctx.errors??={};
  let page=null,error=null;
  try{page=await fetchCafeFFundamentals(symbol)}catch(e){error=String(e.message||e)}
  const base={...(page?.metrics||{})},price=Number(market?.price),priceK=Number.isFinite(price)?(price>1000?price/1000:price):null;
  const eps=Number(base.eps),bvps=Number(base.bvps);
  if(missing(base.pe)&&Number.isFinite(priceK)&&Number.isFinite(eps)&&eps>0)base.pe=priceK/eps;
  if(missing(base.pb)&&Number.isFinite(priceK)&&Number.isFinite(bvps)&&bvps>0)base.pb=priceK/bvps;
  if(missing(base.roe)&&Number.isFinite(eps)&&Number.isFinite(bvps)&&bvps>0)base.roeProxy=eps/bvps*100;
  const usable=Object.values(base).filter(Number.isFinite).length;
  const fresh=page?.fresh===true&&usable>=2;
  ctx.data.fundamentalsRaw??={};ctx.data.fundamentalsRaw.cafefPage=page;
  ctx.data.fundamentalNormalized=fresh?{
    fresh:true,
    asOfYear:page.asOfYear,
    latestQuarter:page.latestQuarter,
    latestAnnualYear:page.latestAnnualYear,
    metrics:base,
    derived:{pe:missing(page?.metrics?.pe)&&base.pe!=null,pb:missing(page?.metrics?.pb)&&base.pb!=null,roeProxy:base.roeProxy!=null,priceBasis:price,priceUnit:'VND',perShareFundamentalUnit:'thousand VND'},
    provider:page.provider,
    sourceUrl:page.sourceUrl,
    generatedAt:page.generatedAt
  }:null;
  ctx.errors.cafefPageFundamentals=error;
  ctx.fundamentalFresh=fresh;
  ctx.generatedAt=now();
  await writeFile(file,JSON.stringify(ctx));
  checks.push({name:`fundamental:${symbol}`,ok:fresh,provider:'CafeF Company Data Page',asOfYear:page?.asOfYear??null,latestQuarter:page?.latestQuarter?.label??null,usable,pe:base.pe??null,pb:base.pb??null,roeProxy:base.roeProxy??null,error});
});
const healthFile=new URL('health.json',DATA),health=await readJson(healthFile,{});
health.fundFresh=checks.filter(x=>x.ok).length;
health.fundTotal=symbols.length;
health.fundamentalChecks=checks;
health.generatedAt=now();
health.checks=[...(health.checks||[]).filter(x=>!String(x.name||'').startsWith('fundamental:')),...checks];
await writeFile(healthFile,JSON.stringify(health));
const intelFile=new URL('intel.json',DATA),intel=await readJson(intelFile,{});
intel.fundFresh=health.fundFresh;intel.fundTotal=symbols.length;intel.generatedAt=now();
intel.summary=`Market ${health.marketOk??'—'}/${health.marketTotal??'—'} • Fresh Fundamentals ${health.fundFresh}/${symbols.length} • Smart Money ${health.flowOk??'—'}/${health.flowTotal??'—'} • Events ${health.eventsOk??'—'}/${health.eventsTotal??'—'} • News ${health.newsOk??'—'}/${health.newsTotal??'—'}`;
await writeFile(intelFile,JSON.stringify(intel));
console.log(`Fresh fundamentals ${health.fundFresh}/${symbols.length}`);
