import {DEFAULT_WATCH,DEFAULT_POLICY,indicators,recommend,buildPositions,sectorWeights} from './core.js';
import {riskQualityScore,extractFundamentalScore,extractFlowScore,extractNewsScore,tradePlan,decisionLabel} from './decision-core.js';

const K='srvn:';
const get=(k,d)=>{try{const v=localStorage.getItem(K+k);return v?JSON.parse(v):structuredClone(d)}catch{return structuredClone(d)}};
const fmt=(n,d=2)=>n==null||!Number.isFinite(+n)?'—':new Intl.NumberFormat('vi-VN',{maximumFractionDigits:d}).format(+n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const extra=['VCB','BID','VPB','STB','SSI','VND','VHM','VRE','MSN','PNJ','FRT','DGC','GVR','PLX','POW'];
const sectors={VCB:'Ngân hàng',BID:'Ngân hàng',VPB:'Ngân hàng',STB:'Ngân hàng',SSI:'Chứng khoán',VND:'Chứng khoán',VHM:'Bất động sản',VRE:'Bất động sản',MSN:'Tiêu dùng',PNJ:'Bán lẻ',FRT:'Bán lẻ',DGC:'Hóa chất',GVR:'Cao su',PLX:'Dầu khí',POW:'Điện'};
const actionRank={PRIORITY_BUY:6,WATCH_BUY:5,WATCH_HOLD:4,AVOID:2,REDUCE_REVIEW_NOW:1,EXIT_REVIEW_NOW:0};
let state={rows:[],loading:false,last:null};

function safe(s){return s.replace(/[^A-Z0-9]/gi,'_')}
async function json(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
async function market(symbol){try{const m=await json(`./data/${safe(symbol)}.json`);m.indicators=indicators(m.points||[]);return m}catch{return{symbol,price:null,points:[],indicators:indicators([]),error:'Chưa có snapshot'}}}
async function context(symbol){try{return await json(`./data/context/${safe(symbol)}.json`)}catch{return{symbol,data:null,error:'Chưa có context'}}}
function currentWatch(){return get('watch',DEFAULT_WATCH)}
function universe(){const watch=currentWatch();const map=new Map(watch.map(x=>[x.symbol,x]));for(const s of extra)if(!map.has(s))map.set(s,{symbol:s,type:'STOCK',sector:sectors[s]||'Khác',manual:{}});return [...map.values()]}
function portfolioMeta(marketMap){const tx=get('tx',[]),cash=get('cash',[]).reduce((a,x)=>a+(+x.amount||0),0),ps=buildPositions(tx,marketMap),sw=sectorWeights(ps,cash);return{held:new Map(ps.map(p=>[p.symbol,p])),sectorWeights:sw}}
function enrichItem(item,ctx,m){
  const f=extractFundamentalScore(ctx?.data),flow=extractFlowScore(ctx?.data),news=extractNewsScore(ctx?.data),rq=riskQualityScore(m);
  const manual={...(item.manual||{})};
  if(manual.fundamentals==null&&f.score!=null)manual.fundamentals=f.score;
  if(manual.smartMoney==null&&flow.score!=null)manual.smartMoney=flow.score;
  if(manual.catalyst==null&&news.score!=null)manual.catalyst=news.score;
  if(manual.riskQuality==null&&rq!=null)manual.riskQuality=rq;
  return{...item,manual,_f:f,_flow:flow,_news:news,_rq:rq};
}
function reasons(row){
  const out=[...(row.rec.rationale||[])];
  out.push(...(row.item._f.reasons||[]),...(row.item._flow.reasons||[]),...(row.item._news.reasons||[]));
  if(row.plan.setup)out.push(row.plan.setup);
  if(row.item._f.score==null)out.push('Fundamentals: chưa đủ dữ liệu có cấu trúc');
  if(row.item._flow.score==null)out.push('Smart Money: chưa đủ dữ liệu có cấu trúc');
  if(row.item._news.score==null)out.push('Catalyst/News: chưa đủ sentiment có cấu trúc');
  return [...new Set(out)].slice(0,8);
}
async function load(){
  if(state.loading)return;state.loading=true;render();
  const u=universe();const ms=await Promise.all(u.map(x=>market(x.symbol)));const mm=Object.fromEntries(ms.map(x=>[x.symbol,x]));const pm=portfolioMeta(mm);
  const cs=await Promise.all(u.map(x=>context(x.symbol)));
  const policy=get('policy',DEFAULT_POLICY);
  state.rows=u.map((base,i)=>{
    const m=ms[i],ctx=cs[i],item=enrichItem(base,ctx,m),held=pm.held.get(base.symbol),sectorWeight=pm.sectorWeights[base.sector];
    const rec=recommend(item,m,policy,held?.avgCost,sectorWeight);const plan=tradePlan(m,{action:rec.action,invalidation:item.invalidation});
    const label=decisionLabel(rec.action,plan,rec.confidence,rec.riskSeverity);
    return{symbol:base.symbol,item,m,ctx,held,rec,plan,label,reasons:[]};
  });
  for(const r of state.rows)r.reasons=reasons(r);
  state.rows.sort((a,b)=>(actionRank[b.rec.action]||0)-(actionRank[a.rec.action]||0)||(b.rec.score??-1)-(a.rec.score??-1)||(a.rec.riskSeverity-b.rec.riskSeverity));
  state.last=Date.now();state.loading=false;render();
}
function zone(a,b){return a==null||b==null?'—':`${fmt(a)} – ${fmt(b)}`}
function cls(label){return /MUA/.test(label)?'good':/THOÁT|GIẢM|TRÁNH/.test(label)?'bad':/CANH|THEO DÕI/.test(label)?'warn':''}
function render(){
  const v=document.querySelector('#view-decision');if(!v)return;
  if(state.loading&&!state.rows.length){v.innerHTML='<div class="topbar"><div><h1 class="title">Decision Desk</h1><div class="sub">Đang xây dựng khuyến nghị từ dữ liệu snapshot thật…</div></div></div><div class="card">Đang tải dữ liệu…</div>';return}
  const rows=state.rows,buys=rows.filter(r=>/MUA/.test(r.label)),top=buys[0]||rows[0],held=rows.filter(r=>r.held);
  v.innerHTML=`<div class="topbar"><div><h1 class="title">Decision Desk V1.3</h1><div class="sub">Gợi ý mua • vùng vào lệnh • stop • target • lý do • Data Confidence</div></div><button id="decisionRefresh" class="btn primary">Phân tích lại</button></div>
  <div class="grid g4"><div class="card"><div class="label">Ứng viên mua</div><div class="metric ${buys.length?'good':'warn'}">${buys.length}</div></div><div class="card"><div class="label">Top candidate</div><div class="metric ${top?cls(top.label):''}">${top?.symbol||'—'}</div><div class="small">${top?.label||'Chưa có'}</div></div><div class="card"><div class="label">Đang nắm giữ</div><div class="metric">${held.length}</div></div><div class="card"><div class="label">Universe</div><div class="metric">${rows.length}</div><div class="small">11 mã trọng tâm + Opportunity Universe</div></div></div>
  <div class="section card tableWrap"><table class="table decisionTable"><thead><tr><th>Mã</th><th>Trạng thái</th><th>Giá</th><th>Vùng mua</th><th>Stop</th><th>Target 1</th><th>Target 2 / vùng bán</th><th>Score</th><th>Confidence</th><th>Risk</th><th>R:R</th></tr></thead><tbody>${rows.map(r=>`<tr data-symbol="${r.symbol}"><td><b>${r.symbol}</b>${r.held?'<div class="tiny good">ĐANG NẮM</div>':''}</td><td class="${cls(r.label)}"><b>${r.label}</b><div class="tiny">${r.rec.action}</div></td><td>${fmt(r.m.price)}</td><td>${zone(r.plan.buyLow,r.plan.buyHigh)}</td><td class="bad">${fmt(r.plan.stop)}</td><td class="good">${fmt(r.plan.target1)}</td><td class="good">${zone(r.plan.sellLow,r.plan.sellHigh)}</td><td>${fmt(r.rec.score,1)}</td><td>${r.rec.confidence}%</td><td>${r.rec.riskSeverity}</td><td>${r.plan.rr1?fmt(r.plan.rr1,1)+'R':'—'}</td></tr>`).join('')}</tbody></table></div>
  <div class="section grid g2">${rows.slice(0,6).map(r=>`<div class="card decisionCard"><div class="kpiRow"><h2>${r.symbol}</h2><b class="${cls(r.label)}">${r.label}</b></div><div class="small"><b>Giá hiện tại:</b> ${fmt(r.m.price)} • <b>Vùng mua:</b> ${zone(r.plan.buyLow,r.plan.buyHigh)} • <b>Stop:</b> ${fmt(r.plan.stop)} • <b>T1/T2:</b> ${fmt(r.plan.target1)} / ${fmt(r.plan.target2)}</div><div class="decisionReasons">${r.reasons.map(x=>`<div>• ${esc(x)}</div>`).join('')}</div>${r.item._news.headlines?.length?`<div class="tiny">${r.item._news.headlines.map(x=>esc(x)).join('<br>')}</div>`:''}</div>`).join('')}</div>
  <div class="section card"><h2>Cách đọc vùng giá</h2><div class="small">Vùng mua/stop/target là kế hoạch định lượng từ giá, ATR và cấu trúc SMA/20 phiên. Chỉ hiển thị như hỗ trợ quyết định; không phải lệnh tự động. Fundamentals, Smart Money và Catalyst chỉ được cộng điểm khi snapshot có dữ liệu có cấu trúc; nếu thiếu, Confidence giảm và hệ thống ghi rõ thiếu dữ liệu.</div></div>`;
  document.querySelector('#decisionRefresh').onclick=load;
}
function install(){
  if(!document.querySelector('[data-view="decision"]')){
    const nav=document.querySelector('#nav');const b=document.createElement('button');b.dataset.view='decision';b.textContent='Decision Desk';nav.insertBefore(b,nav.children[1]||null);
    const main=document.querySelector('.main');const s=document.createElement('section');s.className='view';s.id='view-decision';main.insertBefore(s,main.querySelector('.footerNote'));
    b.onclick=()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x===s));if(!state.rows.length)load()};
  }
  if(!document.querySelector('#decisionStyles')){const st=document.createElement('style');st.id='decisionStyles';st.textContent='.decisionTable{min-width:1180px}.tiny{font-size:11px;margin-top:3px;opacity:.8}.decisionReasons{font-size:13px;line-height:1.55;margin-top:12px}.decisionCard h2{margin:0}.decisionCard{min-height:180px}';document.head.appendChild(st)}
  load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
