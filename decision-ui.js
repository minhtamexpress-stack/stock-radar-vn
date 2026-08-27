import {DEFAULT_WATCH,DEFAULT_POLICY,indicators,recommend,buildPositions,sectorWeights} from './core.js';
import {MARKET_UNIVERSE} from './universe.js';
import {riskQualityScore,extractFundamentalScore,extractFlowScore,extractNewsScore,tradePlan,decisionLabel} from './decision-core.js';

const K='srvn:';
const get=(k,d)=>{try{const v=localStorage.getItem(K+k);return v?JSON.parse(v):structuredClone(d)}catch{return structuredClone(d)}};
const fmt=(n,d=2)=>n==null||!Number.isFinite(+n)?'—':new Intl.NumberFormat('vi-VN',{maximumFractionDigits:d}).format(+n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actionRank={PRIORITY_BUY:6,WATCH_BUY:5,WATCH_HOLD:4,AVOID:2,REDUCE_REVIEW_NOW:1,EXIT_REVIEW_NOW:0};
let state={rows:[],loading:false,last:null};

function safe(s){return s.replace(/[^A-Z0-9]/gi,'_')}
async function json(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
async function market(symbol){try{const m=await json(`./data/${safe(symbol)}.json`);m.indicators=indicators(m.points||[]);return m}catch{return{symbol,price:null,points:[],indicators:indicators([]),error:'Chưa có snapshot'}}}
async function context(symbol){try{return await json(`./data/context/${safe(symbol)}.json`)}catch{return{symbol,data:null,error:'Chưa có context'}}}
async function news(symbol){try{return await json(`./data/news/${safe(symbol)}.json`)}catch{return{symbol,items:[],error:'Chưa có news snapshot'}}}
function currentWatch(){return get('watch',DEFAULT_WATCH)}
function universe(){const watch=currentWatch();const map=new Map(MARKET_UNIVERSE.map(x=>[x.symbol,{...x,manual:{}}]));for(const x of watch)map.set(x.symbol,{...map.get(x.symbol),...x,manual:{...(map.get(x.symbol)?.manual||{}),...(x.manual||{})}});return [...map.values()]}
function portfolioMeta(marketMap){const tx=get('tx',[]),cash=get('cash',[]).reduce((a,x)=>a+(+x.amount||0),0),ps=buildPositions(tx,marketMap),sw=sectorWeights(ps,cash);return{held:new Map(ps.map(p=>[p.symbol,p])),sectorWeights:sw}}
function enrichItem(item,ctx,m){
  const f=extractFundamentalScore(ctx?.data),flow=extractFlowScore(ctx?.data),newsScore=extractNewsScore(ctx?.data),rq=riskQualityScore(m);
  const manual={...(item.manual||{})};
  if(manual.fundamentals==null&&f.score!=null)manual.fundamentals=f.score;
  if(manual.smartMoney==null&&flow.score!=null)manual.smartMoney=flow.score;
  if(manual.catalyst==null&&newsScore.score!=null)manual.catalyst=newsScore.score;
  if(manual.riskQuality==null&&rq!=null)manual.riskQuality=rq;
  return{...item,manual,_f:f,_flow:flow,_news:newsScore,_rq:rq};
}
function eventItems(ctx){
  const raw=ctx?.data?.stock?.events?.data?.data||ctx?.data?.events?.data?.data||ctx?.data?.stock?.events?.data||[];
  return Array.isArray(raw)?raw:[];
}
function reasons(row){
  const out=[...(row.rec.rationale||[])];
  out.push(...(row.item._f.reasons||[]),...(row.item._flow.reasons||[]),...(row.item._news.reasons||[]));
  const ev=eventItems(row.ctx).slice(0,2);
  for(const e of ev){if(e?.EventTitle)out.push(`Sự kiện DN: ${e.EventTitle}`)}
  if(row.plan.setup)out.push(row.plan.setup);
  if(row.item._f.score==null)out.push('Fundamentals: chưa đủ dữ liệu mới có cấu trúc');
  if(row.item._flow.score==null)out.push('Smart Money: chưa đủ dữ liệu có cấu trúc');
  if(row.item._news.score==null)out.push('Catalyst/News: chưa đủ sentiment có cấu trúc');
  return [...new Set(out)].slice(0,12);
}
function holdingAdvice(row){
  if(!row.held)return null;
  const pnl=row.held.pnlPct;
  if(row.rec.riskSeverity>=85)return'BÁN / THOÁT ƯU TIÊN';
  if(row.rec.riskSeverity>=70)return'GIẢM TỶ TRỌNG';
  if(row.rec.action==='PRIORITY_BUY'&&pnl!=null&&pnl>-5)return'GIỮ / CÓ THỂ GIA TĂNG';
  if(row.rec.action==='WATCH_BUY')return'GIỮ / CANH MUA THÊM';
  if(row.rec.action==='WATCH_HOLD')return'GIỮ, KHÔNG MUA ĐUỔI';
  return pnl!=null&&pnl<0?'KHÔNG MUA THÊM / RÀ SOÁT':'GIỮ THẬN TRỌNG';
}
async function load(){
  if(state.loading)return;state.loading=true;render();
  const u=universe();
  const [ms,cs,ns]=await Promise.all([Promise.all(u.map(x=>market(x.symbol))),Promise.all(u.map(x=>context(x.symbol))),Promise.all(u.map(x=>news(x.symbol)))]);
  const mm=Object.fromEntries(ms.map(x=>[x.symbol,x])),pm=portfolioMeta(mm),policy=get('policy',DEFAULT_POLICY);
  state.rows=u.map((base,i)=>{
    const m=ms[i],rawCtx=cs[i],newsSnapshot=ns[i],ctx={...rawCtx,data:{stock:rawCtx?.data,news:newsSnapshot}},held=pm.held.get(base.symbol),sectorWeight=pm.sectorWeights[base.sector];
    const item=enrichItem(base,ctx,m),rec=recommend(item,m,policy,held?.avgCost,sectorWeight),plan=tradePlan(m,{action:rec.action,invalidation:item.invalidation}),label=decisionLabel(rec.action,plan,rec.confidence,rec.riskSeverity);
    return{symbol:base.symbol,item,m,ctx,newsSnapshot,held,rec,plan,label,reasons:[],holdingAdvice:null};
  });
  for(const r of state.rows){r.reasons=reasons(r);r.holdingAdvice=holdingAdvice(r)}
  state.rows.sort((a,b)=>(actionRank[b.rec.action]||0)-(actionRank[a.rec.action]||0)||(b.rec.score??-1)-(a.rec.score??-1)||(a.rec.riskSeverity-b.rec.riskSeverity));
  state.last=Date.now();state.loading=false;render();
}
function zone(a,b){return a==null||b==null?'—':`${fmt(a)} – ${fmt(b)}`}
function cls(label){return /MUA|GIA TĂNG/.test(label)?'good':/THOÁT|GIẢM|TRÁNH|KHÔNG MUA/.test(label)?'bad':/CANH|THEO DÕI|GIỮ/.test(label)?'warn':''}
function valuationLine(r){const f=r.item?._f?.metrics||{};const parts=[];if(f.pe!=null)parts.push(`P/E ${fmt(f.pe,1)}x`);if(f.pb!=null)parts.push(`P/B ${fmt(f.pb,1)}x`);if(f.roe!=null)parts.push(`${f.roeIsProxy?'ROE proxy':'ROE'} ${fmt(f.roe,1)}%`);if(f.eps!=null)parts.push(`EPS ${fmt(f.eps,2)}`);return parts.length?parts.join(' • '):'Fundamentals chưa đủ'}
function evidenceList(r){
  const newsItems=r.newsSnapshot?.items||[],events=eventItems(r.ctx).slice(0,3);
  const newsHtml=newsItems.length?`<div class="tiny"><b>News evidence:</b><br>${newsItems.slice(0,3).map(x=>`• <a target="_blank" rel="noreferrer" href="${esc(x.url||x.link||'#')}">${esc(x.title||x.headline)}</a> <span>(${esc(x.source||'nguồn mở')}, ${esc(x.sentiment||'neutral')})</span>`).join('<br>')}</div>`:'<div class="tiny">News evidence: chưa có snapshot</div>';
  const eventHtml=events.length?`<div class="tiny eventEvidence"><b>Corporate events:</b><br>${events.map(x=>`• ${esc(x.EventTitle||x.EventDescription||'Sự kiện doanh nghiệp')} <span>(${esc(x.PublicDate||x.IssueDate||'')})</span>`).join('<br>')}</div>`:'<div class="tiny eventEvidence">Corporate events: chưa có dữ liệu</div>';
  return `${eventHtml}${newsHtml}`;
}
function render(){
  const v=document.querySelector('#view-decision');if(!v)return;
  if(state.loading&&!state.rows.length){v.innerHTML='<div class="topbar"><div><h1 class="title">Decision Desk</h1><div class="sub">Đang xây dựng khuyến nghị từ dữ liệu snapshot thật…</div></div></div><div class="card">Đang tải dữ liệu…</div>';return}
  const rows=state.rows,buys=rows.filter(r=>/MUA/.test(r.label)),top=buys[0]||rows[0],held=rows.filter(r=>r.held),valid=rows.filter(r=>r.m.price!=null),newsReady=rows.filter(r=>(r.newsSnapshot?.items||[]).length>0),fundReady=rows.filter(r=>r.item?._f?.fresh),flowReady=rows.filter(r=>r.item?._flow?.score!=null),eventReady=rows.filter(r=>eventItems(r.ctx).length>0);
  v.innerHTML=`<div class="topbar"><div><h1 class="title">Decision Desk V1.5</h1><div class="sub">Opportunity Radar • vùng mua/bán • Fundamentals • Smart Money • Corporate Events • Catalyst/News • quản trị vị thế</div></div><button id="decisionRefresh" class="btn primary">Phân tích lại</button></div>
  <div class="grid g4"><div class="card"><div class="label">Ứng viên mua</div><div class="metric ${buys.length?'good':'warn'}">${buys.length}</div></div><div class="card"><div class="label">Top candidate</div><div class="metric ${top?cls(top.label):''}">${top?.symbol||'—'}</div><div class="small">${top?.label||'Chưa có'}</div></div><div class="card"><div class="label">Đang nắm giữ</div><div class="metric">${held.length}</div></div><div class="card"><div class="label">Data coverage</div><div class="metric">${valid.length}/${rows.length}</div><div class="small">Fund ${fundReady.length} • Flow ${flowReady.length} • Events ${eventReady.length} • News ${newsReady.length}</div></div></div>
  <div class="section card tableWrap"><table class="table decisionTable"><thead><tr><th>Mã</th><th>Trạng thái</th><th>Giá</th><th>Vùng mua</th><th>Stop</th><th>Target 1</th><th>Target 2 / vùng bán</th><th>P/E</th><th>P/B</th><th>Score</th><th>Confidence</th><th>Risk</th><th>R:R</th></tr></thead><tbody>${rows.map(r=>`<tr data-symbol="${r.symbol}"><td><b>${r.symbol}</b>${r.held?'<div class="tiny good">ĐANG NẮM</div>':''}</td><td class="${cls(r.label)}"><b>${r.label}</b><div class="tiny">${r.rec.action}</div></td><td>${fmt(r.m.price)}</td><td>${zone(r.plan.buyLow,r.plan.buyHigh)}</td><td class="bad">${fmt(r.plan.stop)}</td><td class="good">${fmt(r.plan.target1)}</td><td class="good">${zone(r.plan.sellLow,r.plan.sellHigh)}</td><td>${fmt(r.item?._f?.metrics?.pe,1)}</td><td>${fmt(r.item?._f?.metrics?.pb,1)}</td><td>${fmt(r.rec.score,1)}</td><td>${r.rec.confidence}%</td><td>${r.rec.riskSeverity}</td><td>${r.plan.rr1?fmt(r.plan.rr1,1)+'R':'—'}</td></tr>`).join('')}</tbody></table></div>
  ${held.length?`<div class="section card tableWrap"><h2>Khuyến nghị riêng cho danh mục đang nắm giữ</h2><table class="table"><thead><tr><th>Mã</th><th>Giá vốn</th><th>Giá hiện tại</th><th>P&L%</th><th>Hành động danh mục</th><th>Stop</th><th>Vùng bán</th></tr></thead><tbody>${held.map(r=>`<tr><td><b>${r.symbol}</b></td><td>${fmt(r.held.avgCost)}</td><td>${fmt(r.m.price)}</td><td class="${(r.held.pnlPct??0)>=0?'good':'bad'}">${fmt(r.held.pnlPct,1)}%</td><td class="${cls(r.holdingAdvice)}"><b>${r.holdingAdvice}</b></td><td>${fmt(r.plan.stop)}</td><td>${zone(r.plan.sellLow,r.plan.sellHigh)}</td></tr>`).join('')}</tbody></table></div>`:''}
  <div class="section grid g2">${rows.slice(0,10).map(r=>`<div class="card decisionCard"><div class="kpiRow"><h2>${r.symbol}</h2><b class="${cls(r.label)}">${r.label}</b></div>${r.holdingAdvice?`<div class="small"><b>Danh mục:</b> ${esc(r.holdingAdvice)}</div>`:''}<div class="small"><b>Giá hiện tại:</b> ${fmt(r.m.price)} • <b>Vùng mua:</b> ${zone(r.plan.buyLow,r.plan.buyHigh)} • <b>Stop:</b> ${fmt(r.plan.stop)} • <b>T1/T2:</b> ${fmt(r.plan.target1)} / ${fmt(r.plan.target2)}</div><div class="small valuation"><b>Định giá:</b> ${esc(valuationLine(r))}</div><div class="decisionReasons">${r.reasons.map(x=>`<div>• ${esc(x)}</div>`).join('')}</div>${evidenceList(r)}</div>`).join('')}</div>
  <div class="section card"><h2>Nguyên tắc quyết định</h2><div class="small">News/Catalyst và Corporate Events là tín hiệu hỗ trợ, không tự kích hoạt BUY. Vùng mua/stop/target được tính từ giá, ATR và cấu trúc kỹ thuật. Fundamentals chỉ được chấm khi dữ liệu đã qua freshness guard. P/E/P/B và ROE proxy có thể là chỉ số suy ra từ giá + EPS/BVPS và được gắn nhãn rõ, không giả thành số báo cáo nguyên bản.</div></div>`;
  document.querySelector('#decisionRefresh').onclick=load;
}
function install(){
  if(!document.querySelector('[data-view="decision"]')){
    const nav=document.querySelector('#nav');const b=document.createElement('button');b.dataset.view='decision';b.textContent='Decision Desk';nav.insertBefore(b,nav.children[1]||null);
    const main=document.querySelector('.main');const s=document.createElement('section');s.className='view';s.id='view-decision';main.insertBefore(s,main.querySelector('.footerNote'));
    b.onclick=()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x===s));if(!state.rows.length)load()};
  }
  if(!document.querySelector('#decisionStyles')){const st=document.createElement('style');st.id='decisionStyles';st.textContent='.decisionTable{min-width:1320px}.tiny{font-size:11px;margin-top:3px;opacity:.82}.decisionReasons{font-size:13px;line-height:1.55;margin-top:12px}.decisionCard h2{margin:0}.decisionCard{min-height:220px}.decisionCard a{text-decoration:none}.eventEvidence{margin:10px 0}.valuation{margin-top:7px}';document.head.appendChild(st)}
  load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
