const HEADERS={'User-Agent':'Mozilla/5.0 StockRadarVN/1.4','Accept':'application/json,text/plain,*/*'};
const now=()=>new Date().toISOString();
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
async function getJson(url){const r=await fetch(url,{headers:HEADERS,signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error(`CafeF HTTP ${r.status}`);const j=await r.json();if(j?.isSuccess===false)throw new Error(`CafeF API error`);return j}
function templateMap(node,map=new Map()){
  if(Array.isArray(node)){for(const x of node)templateMap(x,map);return map}
  if(node&&typeof node==='object'){
    if(node.code!=null&&node.name!=null)map.set(String(node.code),String(node.name));
    for(const v of Object.values(node))if(v&&typeof v==='object')templateMap(v,map);
  }
  return map;
}
function collectPeriods(node,out=[]){
  if(Array.isArray(node)){for(const x of node)collectPeriods(x,out);return out}
  if(node&&typeof node==='object'){
    if(typeof node.time==='string'&&Array.isArray(node.data)&&node.data.some(x=>x&&x.code!=null&&x.value!=null))out.push(node);
    else for(const v of Object.values(node))if(v&&typeof v==='object')collectPeriods(v,out);
  }
  return out;
}
function parsePeriod(s=''){const m=s.match(/^Q(\d)[-\/]?(\d{4})$/i);if(m)return[+m[2],+m[1]];const y=s.match(/(\d{4})/);return[y?+y[1]:0,0]}
function normalizeReport(j){
  const value=j?.value??j, names=templateMap(value?.templace??value?.template??[]),periodsRaw=collectPeriods(value?.data??value);
  const periods=[...new Map(periodsRaw.map(p=>[p.time,p])).values()].sort((a,b)=>{const [ya,qa]=parsePeriod(a.time),[yb,qb]=parsePeriod(b.time);return ya-yb||qa-qb});
  const rows=periods.map(p=>{const values={};for(const it of p.data||[])values[String(it.code)]=Number.isFinite(Number(it.value))?Number(it.value):null;return{time:p.time,values}});
  return{names:Object.fromEntries(names),periods:rows};
}
function pickCode(report,patterns,fallback=[]){
  const entries=Object.entries(report.names||{});
  for(const [code,name] of entries){const n=norm(name);if(patterns.some(p=>n.includes(p)))return code}
  for(const c of fallback)if(entries.some(([x])=>x===c)||report.periods.some(p=>c in p.values))return c;
  return null;
}
function series(report,code){if(!code)return[];return report.periods.map(p=>({period:p.time,value:p.values[code]??null})).filter(x=>x.value!=null)}
function growth(a,b){return Number.isFinite(a)&&Number.isFinite(b)&&b!==0?((a/b)-1)*100:null}
export async function fetchFundamentals(symbol){
  const endpoints={income:'https://apiweb.cafef.vn/api/v1/BCTC/GetReportDetail',balance:'https://apiweb.cafef.vn/api/v2/BCTC/GetReportCDKT'};
  const url=(base,reportType)=>`${base}?symbol=${encodeURIComponent(symbol)}&pageIndex=1&pageSize=4&reportType=${reportType}&TypeTime=NAM`;
  const [incomeJ,balanceJ]=await Promise.all([getJson(url(endpoints.income,'KQKD')),getJson(url(endpoints.balance,'ALL'))]);
  const income=normalizeReport(incomeJ),balance=normalizeReport(balanceJ);
  const revenueCode=pickCode(income,['doanh thu thuan','thu nhap lai thuan','tong thu nhap hoat dong'],['10']);
  const profitCode=pickCode(income,['loi nhuan sau thue','loi nhuan sau thue thu nhap doanh nghiep'],['60']);
  const equityCode=pickCode(balance,['von chu so huu'],['400']);
  const revenue=series(income,revenueCode),profit=series(income,profitCode),equity=series(balance,equityCode);
  const revLast=revenue.at(-1)?.value??null,revPrev=revenue.at(-2)?.value??null,profitLast=profit.at(-1)?.value??null,profitPrev=profit.at(-2)?.value??null,equityLast=equity.at(-1)?.value??null;
  const metrics={revenue:revLast,profitAfterTax:profitLast,equity:equityLast,revenueGrowth:growth(revLast,revPrev),profitGrowth:growth(profitLast,profitPrev),roe:Number.isFinite(profitLast)&&Number.isFinite(equityLast)&&equityLast!==0?profitLast/equityLast*100:null};
  const usable=Object.values(metrics).filter(Number.isFinite).length;
  return{symbol,provider:'CafeF Financial API',metrics,periods:{revenue:revenue.map(x=>x.period),profit:profit.map(x=>x.period),equity:equity.map(x=>x.period)},codes:{revenueCode,profitCode,equityCode},usable,generatedAt:now()};
}
function vnDate(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const x=Object.fromEntries(p.map(a=>[a.type,a.value]));return`${x.year}-${x.month}-${x.day}`}
function oneFlowSummary(data=[]){
  const rows=Array.isArray(data)?data.filter(x=>Number.isFinite(Number(x?.netVal))):[];
  const last5=rows.slice(0,5),last15=rows.slice(0,15);
  const summarize=a=>{const net=a.reduce((s,x)=>s+Number(x.netVal||0),0),gross=a.reduce((s,x)=>s+Math.abs(Number(x.buyVal||0))+Math.abs(Number(x.sellVal||0)),0),pos=a.filter(x=>Number(x.netVal)>0).length;return{netVal:net,grossVal:gross,positiveDays:pos,totalDays:a.length,netRatio:gross?net/gross:null}};
  return{d5:summarize(last5),d15:summarize(last15)};
}
function combinedScore(summaries=[]){
  const ratios=[],cons=[];
  for(const s of summaries){for(const k of ['d5','d15']){const x=s?.[k];if(Number.isFinite(x?.netRatio)){ratios.push(k==='d5'?x.netRatio*1.5:x.netRatio);if(x.totalDays)cons.push((x.positiveDays/x.totalDays-.5)*2)}}}
  if(!ratios.length)return null;
  const ratio=ratios.reduce((a,b)=>a+b,0)/ratios.length,consistency=cons.length?cons.reduce((a,b)=>a+b,0)/cons.length:0;
  return Math.max(0,Math.min(100,50+ratio*80+consistency*12));
}
export async function fetchOrganizationFlow(symbol){
  const d=vnDate();
  const urls=[0,1].map((type,i)=>`https://msh-appdata.cafef.vn/rest-api/api/v1/OverviewOrgnizaztion/${type}/${d}/${i?20:15}?symbol=${encodeURIComponent(symbol)}`);
  const results=[];
  for(const url of urls){try{const data=await getJson(url);results.push({ok:true,url,data,summary:oneFlowSummary(data)})}catch(e){results.push({ok:false,url,error:String(e.message||e)})}}
  const summaries=results.filter(x=>x.ok).map(x=>x.summary),score=combinedScore(summaries);
  const net5=summaries.reduce((a,x)=>a+(x?.d5?.netVal||0),0),net15=summaries.reduce((a,x)=>a+(x?.d15?.netVal||0),0);
  return{symbol,provider:'CafeF Organization Flow',score,net5,net15,results,generatedAt:now()};
}
