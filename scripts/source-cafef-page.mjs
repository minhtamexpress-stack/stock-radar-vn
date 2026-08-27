const HEADERS={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36 StockRadarVN/1.4','Accept':'text/html,application/xhtml+xml'};
const now=()=>new Date().toISOString();
function decode(s=''){return s.replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n))}
function text(s=''){return decode(s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function vnNum(s){if(s==null)return null;let x=String(s).trim().replace(/\s/g,'');if(!x||x==='-'||/^n\/?a$/i.test(x))return null;if(/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(x))x=x.replace(/\./g,'').replace(',','.');else if(/^[-+]?\d+(,\d+)$/.test(x))x=x.replace(',','.');else x=x.replace(/,/g,'');const n=Number(x.replace(/[^0-9+\-.]/g,''));return Number.isFinite(n)?n:null}
function rowCells(html){const rows=[];for(const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>text(x[1])).filter(Boolean);if(cells.length)rows.push(cells)}return rows}
function findRow(rows,labelRx){return rows.find(r=>r[0]&&labelRx.test(r[0]))||null}
function currentMetric(fullText,labelRx){const m=fullText.match(new RegExp(labelRx.source+'\\s*:?\\s*([-+]?\\d[\\d.,-]*)','i'));return m?vnNum(m[1]):null}
function latestYearFrom(rows){let y=0;for(const r of rows)for(const c of r)for(const m of c.matchAll(/20\d{2}/g))y=Math.max(y,+m[0]);return y||null}
function latestAnnualValue(rows,labelRx){const row=findRow(rows,labelRx);if(!row)return null;const nums=row.slice(1).map(vnNum).filter(Number.isFinite);return nums.length?nums.at(-1):null}
function latestQuarter(fullText){let best=null;for(const m of fullText.matchAll(/Qu[ýy]\s*([1-4])\s*[-\/]?\s*(20\d{2})/gi)){const q=+m[1],y=+m[2];if(!best||y>best.year||(y===best.year&&q>best.quarter))best={year:y,quarter:q,label:`Q${q}/${y}`}}return best}
export async function fetchCafeFFundamentals(symbol){
  const url=`https://cafef.vn/du-lieu/DuLieu.aspx?cat_id=1009&san=hose&symbol=${encodeURIComponent(symbol)}`;
  const r=await fetch(url,{headers:HEADERS,signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`CafeF page HTTP ${r.status}`);
  const html=await r.text(),full=text(html),rows=rowCells(html),q=latestQuarter(full),latestYear=latestYearFrom(rows);
  const epsCurrent=currentMetric(full,/EPS\s*cơ\s*bản\s*\(nghìn\s*đồng\)/i)??latestAnnualValue(rows,/^EPS\s*\(nghìn\s*đồng\)/i);
  const peCurrent=currentMetric(full,/P\/E\s*:/i)??latestAnnualValue(rows,/^P\/E$/i);
  const roeAnnual=latestAnnualValue(rows,/^ROE\s*\(%\)/i);
  const roaAnnual=latestAnnualValue(rows,/^ROA\s*\(%\)/i);
  const bvps= currentMetric(full,/Giá\s*trị\s*sổ\s*sách\s*\/cp\s*\(nghìn\s*đồng\)/i)??latestAnnualValue(rows,/^BV\s*\(nghìn\s*đồng\)/i);
  const pb=currentMetric(full,/P\/B\s*:/i);
  const asOfYear=Math.max(q?.year||0,latestYear||0)||null;
  const fresh=asOfYear!=null&&asOfYear>=2025&&(q?.year>=2026||latestYear>=2025);
  const metrics={eps:epsCurrent,pe:peCurrent,roe:roeAnnual,roa:roaAnnual,bvps,pb};
  const usable=Object.values(metrics).filter(Number.isFinite).length;
  return{symbol,provider:'CafeF Company Data Page',sourceUrl:url,fresh,asOfYear,latestQuarter:q,latestAnnualYear:latestYear,metrics,usable,generatedAt:now()};
}
