const HEADERS={'User-Agent':'Mozilla/5.0 StockRadarVN/1.6','Accept':'application/json,text/plain,*/*'};
const now=()=>new Date().toISOString();
async function getJson(url){const r=await fetch(url,{headers:HEADERS,signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error(`VPS HTTP ${r.status}`);return r.json()}
export async function fetchVpsBaseInfo(symbol){
  const url=`https://bgapidatafeed.vps.com.vn/getliststockbaseinfo/${encodeURIComponent(symbol)}`;
  const data=await getJson(url);
  return{symbol,provider:'VPS Public Datafeed',sourceUrl:url,data,generatedAt:now()};
}
export async function fetchVpsEvents(symbol){
  const url=`https://histdatafeed.vps.com.vn/company/events/${encodeURIComponent(symbol)}`;
  const data=await getJson(url);
  return{symbol,provider:'VPS Company Events',sourceUrl:url,data,generatedAt:now()};
}
export async function fetchVpsQuote(symbol){
  const url=`https://bgapidatafeed.vps.com.vn/getliststockdata/${encodeURIComponent(symbol)}`;
  const data=await getJson(url);
  return{symbol,provider:'VPS Realtime Board',sourceUrl:url,data,generatedAt:now()};
}
