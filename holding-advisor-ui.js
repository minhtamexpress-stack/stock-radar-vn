import {DEFAULT_POLICY,indicators,recommend,buildPositions,sectorWeights,marketRegime} from './core.js';
import {riskQualityScore,extractFundamentalScore,extractFlowScore,tradePlan} from './decision-core.js';
import {holdingDecision} from './decision-v2.js';

const K='srvn:';
const get=(k,d)=>{try{const v=localStorage.getItem(K+k);return v?JSON.parse(v):structuredClone(d)}catch{return structuredClone(d)}};
const set=(k,v)=>localStorage.setItem(K+k,JSON.stringify(v));
const fmt=(n,d=0)=>n==null||!Number.isFinite(+n)?'—':new Intl.NumberFormat('vi-VN',{maximumFractionDigits:d}).format(+n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const safe=s=>String(s||'').replace(/[^A-Z0-9]/gi,'_');
const id=()=>crypto.randomUUID();
let state={loading:false,advice:new Map(),market:new Map(),last:0};

async function json(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}
async function loadMarket(symbol){
  try{const m=await json(`./data/${safe(symbol)}.json`);m.indicators=indicators(m.points||[]);return m}catch{return{symbol,price:null,points:[],indicators:indicators([]),error:'Chưa có snapshot cho mã này'}}
}
async function loadContext(symbol){try{return await json(`./data/context/${safe(symbol)}.json`)}catch{return{symbol,data:{}}}}
async function loadNews(symbol){try{return await json(`./data/news/${safe(symbol)}.json`)}catch{return{symbol,items:[]}}}
function sentiment(items=[]){let p=0,n=0,z=0;for(const x of items){if(x.sentiment==='positive')p++;else if(x.sentiment==='negative')n++;else z++}const total=p+n+z;return total?Math.max(0,Math.min(100,50+(p-n)*18/total)):null}

function quickPositionForm(){
  const root=document.querySelector('#view-portfolio');if(!root||root.querySelector('#quickHoldingInput'))return;
  const card=document.createElement('div');card.id='quickHoldingInput';card.className='card';
  card.innerHTML=`<h2>Nhập nhanh cổ phiếu đang nắm giữ</h2><div class="small">Nhập mã, số cổ phiếu và tổng số tiền thực tế đã đầu tư. Hệ thống tự suy ra giá vốn. Nếu mã chưa có trong dữ liệu Stock Radar, danh mục vẫn lưu nhưng phần phân tích sẽ báo chưa đủ dữ liệu.</div><div style="height:10px"></div><div class="formGrid holdingInputGrid"><input id="hqSymbol" class="input" placeholder="Mã cổ phiếu"><input id="hqQty" class="input" type="number" min="1" placeholder="Số cổ phiếu"><input id="hqAmount" class="input" type="number" min="1" placeholder="Tổng tiền đầu tư (VNĐ)"><select id="hqType" class="input"><option value="STOCK">Cổ phiếu</option><option value="ETF">ETF</option></select><input id="hqSector" class="input" placeholder="Ngành (nếu biết)"><button id="hqAdd" class="btn primary">Thêm vào danh mục</button></div><div class="actions" style="margin-top:10px"><button id="hqAnalyze" class="btn">Phân tích lại danh mục</button></div>`;
  const first=root.querySelector('.card');root.insertBefore(card,first||root.firstChild);
  card.querySelector('#hqAdd').onclick=()=>{
    const symbol=card.querySelector('#hqSymbol').value.trim().toUpperCase(),qty=Math.abs(Number(card.querySelector('#hqQty').value)||0),amount=Number(card.querySelector('#hqAmount').value)||0;
    if(!symbol||qty<=0||amount<=0)return flash('Cần nhập đủ mã, số cổ phiếu và tổng tiền đầu tư');
    const tx=get('tx',[]),price=amount/qty;
    tx.push({id:id(),symbol,type:card.querySelector('#hqType').value,sector:card.querySelector('#hqSector').value.trim()||'Khác',price,quantity:qty,fee:0,investedAmount:amount,date:new Date().toISOString(),source:'POSITION_IMPORT'});
    set('tx',tx);flash(`Đã lưu ${symbol}: ${fmt(qty)} cp • ${fmt(amount)} đồng`);setTimeout(()=>location.reload(),350);
  };
  card.querySelector('#hqAnalyze').onclick=()=>analyze(true);
}

function flash(t){
  let x=document.querySelector('#holdingToast');if(!x){x=document.createElement('div');x.id='holdingToast';x.className='toast';document.body.appendChild(x)}x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2300)
}

function findPortfolioTable(){
  const root=document.querySelector('#view-portfolio');if(!root)return null;
  return [...root.querySelectorAll('table.table')].find(t=>{const h=[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim());return h.includes('Mã')&&h.some(x=>x.includes('P&L'))});
}
function cls(code){return code==='SELL_NOW'?'danger':code==='REDUCE'||code==='TAKE_PROFIT'?'warn':code==='HOLD_LONG'?'good':'info'}
function buttonText(a){return a?.action||'ĐANG PHÂN TÍCH…'}

function augmentTable(){
  const table=findPortfolioTable();if(!table)return;
  const head=table.querySelector('thead tr');if(!head)return;
  if(!head.querySelector('[data-hadv-capital]')){const th=document.createElement('th');th.dataset.hadvCapital='1';th.textContent='Vốn đầu tư';head.appendChild(th)}
  if(!head.querySelector('[data-hadv-advice]')){const th=document.createElement('th');th.dataset.hadvAdvice='1';th.textContent='Kiến nghị';head.appendChild(th)}
  for(const tr of table.querySelectorAll('tbody tr')){
    const symbol=tr.cells?.[0]?.textContent?.trim()?.split(/\s+/)?.[0]?.toUpperCase();if(!symbol||symbol==='CHƯA')continue;
    let cap=tr.querySelector('[data-hadv-capital-cell]');if(!cap){cap=document.createElement('td');cap.dataset.hadvCapitalCell='1';tr.appendChild(cap)}
    let adv=tr.querySelector('[data-hadv-advice-cell]');if(!adv){adv=document.createElement('td');adv.dataset.hadvAdviceCell='1';tr.appendChild(adv)}
    const a=state.advice.get(symbol),p=a?._position;
    cap.textContent=p?fmt(p.cost,0):'—';
    adv.innerHTML=`<button class="btn hadvBtn ${cls(a?.code)}" data-hadv-symbol="${symbol}" ${a?'':'disabled'}>${esc(buttonText(a))}</button>`;
  }
}

function modal(){
  let m=document.querySelector('#holdingAdviceModal');if(m)return m;
  m=document.createElement('div');m.id='holdingAdviceModal';m.className='modal';m.innerHTML='<div class="modalBox" id="holdingAdviceBox"></div>';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m||e.target?.dataset?.close)m.classList.remove('open')});return m;
}
function showAdvice(symbol){
  const a=state.advice.get(symbol);if(!a)return;const m=modal(),box=m.querySelector('#holdingAdviceBox');
  const zone=a.sellLow!=null&&a.sellHigh!=null?`${fmt(a.sellLow,2)} – ${fmt(a.sellHigh,2)}`:'—';
  box.innerHTML=`<div class="kpiRow"><h2>${esc(symbol)} • ${esc(a.action)}</h2><button class="btn" data-close="1">Đóng</button></div><div class="grid g4"><div><div class="label">Opportunity</div><div class="metric">${a.opportunity}/100</div></div><div><div class="label">Risk</div><div class="metric ${a.risk>=70?'bad':a.risk>=50?'warn':'good'}">${a.risk}/100</div></div><div><div class="label">Confidence</div><div class="metric">${a.confidence}%</div></div><div><div class="label">Điểm dài hạn</div><div class="metric">${a.longTermScore}/100</div></div></div><div class="section grid g3"><div class="card"><div class="label">Giá vốn</div><div class="metric">${fmt(a.avgCost,2)}</div></div><div class="card"><div class="label">Giá hiện tại</div><div class="metric">${fmt(a.price,2)}</div></div><div class="card"><div class="label">P&L</div><div class="metric ${(a.pnlPct??0)>=0?'good':'bad'}">${fmt(a.pnlPct,1)}%</div></div></div><div class="section card"><div class="kpiRow"><span>Vùng bán/chốt lời tham khảo</span><b>${zone}</b></div><div class="kpiRow"><span>Điểm bảo vệ vốn/lợi nhuận</span><b class="bad">${fmt(a.protectiveStop,2)}</b></div><div style="height:8px"></div><div class="small"><b>Thời gian nắm giữ:</b> ${esc(a.timeHint)}</div></div><div class="section card"><h2>Lý do kiến nghị</h2>${a.reasons.map(x=>`<div class="small">• ${esc(x)}</div>`).join('')}</div><div class="section notice">Đây là kiến nghị quản trị vị thế, không phải lệnh giao dịch. Stock Radar không tự đặt lệnh và không bảo đảm lợi nhuận.</div>`;
  m.classList.add('open');
}

function journalAdvice(a){
  const j=get('holdingAdviceJournal',[]),now=Date.now(),sig=[a.symbol,a.code,a.opportunity,a.risk,a.confidence,Math.round((a.sellLow||0)*100),Math.round((a.protectiveStop||0)*100)].join('|'),prev=j.find(x=>x.symbol===a.symbol);
  if(!prev||prev.signature!==sig||now-prev.timestamp>3600000){j.unshift({timestamp:now,signature:sig,symbol:a.symbol,code:a.code,action:a.action,opportunity:a.opportunity,risk:a.risk,confidence:a.confidence,longTermScore:a.longTermScore,price:a.price,avgCost:a.avgCost,pnlPct:a.pnlPct,sellLow:a.sellLow,sellHigh:a.sellHigh,protectiveStop:a.protectiveStop,timeHint:a.timeHint});set('holdingAdviceJournal',j.slice(0,5000))}
}

async function analyze(force=false){
  if(state.loading)return;if(!force&&Date.now()-state.last<120000&&state.advice.size){augmentTable();return}state.loading=true;augmentTable();
  try{
    const tx=get('tx',[]),policy=get('policy',DEFAULT_POLICY),cash=get('cash',[]).reduce((a,x)=>a+(+x.amount||0),0),base=buildPositions(tx,{}).filter(p=>p.qty>0),symbols=[...new Set(base.map(p=>p.symbol))];
    if(!symbols.length){state.advice.clear();return}
    const [markets,contexts,newsSnaps,index]=await Promise.all([Promise.all(symbols.map(loadMarket)),Promise.all(symbols.map(loadContext)),Promise.all(symbols.map(loadNews)),loadMarket('^VNINDEX')]);
    const marketMap=Object.fromEntries(markets.map(x=>[x.symbol,x])),positions=buildPositions(tx,marketMap),sector=sectorWeights(positions,cash),regime=marketRegime(index,markets),watch=get('watch',[]);
    const map=new Map;
    for(let i=0;i<symbols.length;i++){
      const symbol=symbols[i],p=positions.find(x=>x.symbol===symbol);if(!p||p.qty<=0)continue;const m=markets[i],ctx=contexts[i],news=newsSnaps[i],f=extractFundamentalScore(ctx?.data),flow=extractFlowScore(ctx?.data),rq=riskQualityScore(m),manual={};
      if(f.score!=null)manual.fundamentals=f.score;if(flow.score!=null)manual.smartMoney=flow.score;if(rq!=null)manual.riskQuality=rq;const ns=sentiment(news?.items||[]);if(ns!=null)manual.catalyst=ns;const socialScore=Number(ctx?.data?.publicSocial?.score);if(Number.isFinite(socialScore))manual.socialAdjustment=Math.max(-3,Math.min(3,(socialScore-50)/50*3));
      const w=watch.find(x=>x.symbol===symbol)||{},item={symbol,type:p.type||w.type||'STOCK',sector:p.sector||w.sector||'Khác',manual:{...(w.manual||{}),...manual},invalidation:w.invalidation};
      const rec=recommend(item,m,policy,p.avgCost,sector[item.sector]),plan=tradePlan(m,{action:rec.action,invalidation:item.invalidation}),a=holdingDecision({position:p,market:m,rec,plan,fundamentals:f,flow,newsItems:news?.items||[],regime:regime.state});a._position=p;a._rec=rec;a._plan=plan;map.set(symbol,a);journalAdvice(a);
    }
    state.advice=map;state.market=new Map(markets.map(x=>[x.symbol,x]));state.last=Date.now();
  }finally{state.loading=false;augmentTable()}
}

function styles(){if(document.querySelector('#holdingAdvisorStyles'))return;const s=document.createElement('style');s.id='holdingAdvisorStyles';s.textContent='.hadvBtn{min-width:150px;font-weight:800}.hadvBtn.good{border-color:#1c6148;background:#0e3428;color:#33d18f}.hadvBtn.warn{border-color:#6b5419;background:#3a2c0c;color:#ffc857}.hadvBtn.danger{border-color:#71313b;background:#52202b;color:#ff9aa2}.hadvBtn.info{color:#8bc4ff}.holdingInputGrid{grid-template-columns:repeat(6,minmax(130px,1fr))}@media(max-width:920px){.holdingInputGrid{grid-template-columns:1fr 1fr}}@media(max-width:560px){.holdingInputGrid{grid-template-columns:1fr}}';document.head.appendChild(s)}

let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{quickPositionForm();augmentTable()},180)}).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-hadv-symbol]');if(b)showAdvice(b.dataset.hadvSymbol)});
function init(){styles();quickPositionForm();augmentTable();setTimeout(()=>analyze(),500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
