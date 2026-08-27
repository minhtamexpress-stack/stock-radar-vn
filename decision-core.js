const num=v=>v==null||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));

export function riskQualityScore(m){
  const p=num(m?.price),i=m?.indicators||{};
  if(p==null)return null;
  let s=60,used=0;
  if(num(i.atr14)!=null&&p>0){const ap=i.atr14/p*100;s+=ap<=2?12:ap<=3.5?5:ap>=6?-18:-5;used++}
  if(num(i.sma50)!=null){s+=p>=i.sma50?10:-12;used++}
  if(num(i.sma200)!=null){s+=p>=i.sma200?10:-15;used++}
  if(num(i.ret20d)!=null){s+=i.ret20d>=-12?5:-10;used++}
  return used?clamp(s):null;
}

function flatten(obj,prefix='',out=[]){
  if(obj==null)return out;
  if(Array.isArray(obj)){obj.forEach((v,i)=>flatten(v,`${prefix}.${i}`,out));return out}
  if(typeof obj==='object'){for(const [k,v] of Object.entries(obj))flatten(v,prefix?`${prefix}.${k}`:k,out);return out}
  out.push([prefix.toLowerCase(),obj]);return out;
}
function metric(flat,patterns){
  for(const [k,v] of flat){if(patterns.some(p=>k.includes(p))){const n=num(v);if(n!=null)return n}}
  return null;
}
function findNested(obj,key,depth=0){
  if(!obj||typeof obj!=='object'||depth>6)return null;
  if(Object.prototype.hasOwnProperty.call(obj,key))return obj[key];
  for(const v of Object.values(obj)){const x=findNested(v,key,depth+1);if(x!=null)return x}
  return null;
}

export function extractFundamentalScore(context){
  if(!context||typeof context!=='object')return{score:null,reasons:[],metrics:{}};
  const normalized=findNested(context,'fundamentalNormalized');
  if(!normalized||normalized.fresh!==true)return{score:null,reasons:[],metrics:{},fresh:false};
  const raw=normalized.metrics||{};
  const f=flatten(raw);
  const reportedRoe=num(raw.roe)??metric(f,['return_on_equity','returnonequity']);
  const roeProxy=num(raw.roeProxy);
  const roe=reportedRoe??roeProxy;
  const metrics={
    roe,
    roeProxy:reportedRoe==null?roeProxy:null,
    roeIsProxy:reportedRoe==null&&roeProxy!=null,
    pe:num(raw.pe)??metric(f,['p/e','pe_ratio','peratio','price_earnings']),
    pb:num(raw.pb)??metric(f,['p/b','pb_ratio','pbratio','price_book']),
    eps:num(raw.eps)??metric(f,['earnings_per_share']),
    bvps:num(raw.bvps)??metric(f,['book_value_per_share']),
    revenueGrowth:metric(f,['revenue_growth','revenuegrowth','sales_growth','doanhthu_tangtruong','growth_revenue']),
    profitGrowth:metric(f,['profit_growth','profitgrowth','earnings_growth','loinhuan_tangtruong','growth_profit'])
  };
  let s=50,n=0;const reasons=[];
  if(metrics.roe!=null){n++;s+=metrics.roe>=20?18:metrics.roe>=15?12:metrics.roe>=10?5:-12;reasons.push(`${metrics.roeIsProxy?'ROE proxy':'ROE'} ${metrics.roe.toFixed(1)}%`)}
  if(metrics.pe!=null){n++;s+=metrics.pe>0&&metrics.pe<=15?10:metrics.pe<=25?4:metrics.pe>=40?-12:-3;reasons.push(`P/E ${metrics.pe.toFixed(1)}x`)}
  if(metrics.pb!=null)reasons.push(`P/B ${metrics.pb.toFixed(1)}x`);
  if(metrics.revenueGrowth!=null){n++;s+=metrics.revenueGrowth>=15?12:metrics.revenueGrowth>0?5:-10;reasons.push(`Tăng trưởng DT ${metrics.revenueGrowth.toFixed(1)}%`)}
  if(metrics.profitGrowth!=null){n++;s+=metrics.profitGrowth>=15?15:metrics.profitGrowth>0?6:-12;reasons.push(`Tăng trưởng LN ${metrics.profitGrowth.toFixed(1)}%`)}
  if(metrics.eps!=null){n++;reasons.push(`EPS ${metrics.eps.toFixed(2)}`);s+=metrics.eps>0?3:-8}
  if(normalized.latestQuarter?.label)reasons.push(`BCTC cập nhật ${normalized.latestQuarter.label}`);
  else if(normalized.asOfYear)reasons.push(`Fundamentals as-of ${normalized.asOfYear}`);
  if(normalized.derived?.pe||normalized.derived?.pb||metrics.roeIsProxy)reasons.push('Định giá/ROE proxy là chỉ số suy ra từ giá + EPS/BVPS, không phải số báo cáo nguyên bản');
  return{score:n?clamp(s):null,reasons,metrics,fresh:true,provider:normalized.provider||null,sourceUrl:normalized.sourceUrl||null};
}

export function extractFlowScore(context){
  if(!context||typeof context!=='object')return{score:null,reasons:[]};
  const f=flatten(context);
  const direct=metric(f,['organizationflow.score','smartmoney.score','smartmoneyscore']);
  const net5=metric(f,['organizationflow.net5','smartmoney.net5']);
  const net15=metric(f,['organizationflow.net15','smartmoney.net15']);
  if(direct!=null){
    const reasons=[`Organization Flow ${direct.toFixed(0)}/100`];
    if(net5!=null)reasons.push(`Dòng tiền ròng 5 phiên ${net5>=0?'+':''}${(net5/1e9).toFixed(1)} tỷ`);
    if(net15!=null)reasons.push(`Dòng tiền ròng 15 phiên ${net15>=0?'+':''}${(net15/1e9).toFixed(1)} tỷ`);
    return{score:clamp(direct),reasons};
  }
  const foreign=metric(f,['foreign_net','foreignnet','net_foreign','khoingoai_rong','foreign_net_value']);
  const prop=metric(f,['proprietary_net','proprietarynet','tudoanh_rong','net_proprietary']);
  let s=50,n=0;const reasons=[];
  if(foreign!=null){n++;s+=foreign>0?20:foreign<0?-20:0;reasons.push(`Khối ngoại ròng ${foreign>0?'+':''}${foreign.toFixed(0)}`)}
  if(prop!=null){n++;s+=prop>0?15:prop<0?-15:0;reasons.push(`Tự doanh ròng ${prop>0?'+':''}${prop.toFixed(0)}`)}
  return{score:n?clamp(s):null,reasons};
}

export function extractNewsScore(news){
  if(!news||typeof news!=='object')return{score:null,reasons:[],headlines:[]};
  const f=flatten(news),texts=f.filter(([k,v])=>typeof v==='string'&&(k.includes('sentiment')||k.includes('label')||k.includes('tone'))).map(([,v])=>String(v).toLowerCase());
  let pos=0,neg=0,neu=0;
  for(const t of texts){if(/positive|tích cực|bullish/.test(t))pos++;else if(/negative|tiêu cực|bearish/.test(t))neg++;else if(/neutral|trung tính/.test(t))neu++}
  const headlineKeys=['title','headline','summary'];const headlines=[];
  for(const [k,v] of f){if(typeof v==='string'&&headlineKeys.some(x=>k.endsWith(x))&&v.length>15&&!headlines.includes(v)){headlines.push(v);if(headlines.length>=3)break}}
  const n=pos+neg+neu;if(!n)return{score:null,reasons:headlines.length?[`${headlines.length} tin nhưng chưa đọc được sentiment`]:[],headlines};
  const score=clamp(50+(pos-neg)*15/Math.max(1,n));
  return{score,reasons:[`Tin: ${pos} tích cực • ${neu} trung tính • ${neg} tiêu cực`],headlines};
}

export function tradePlan(m,{action='WATCH_HOLD',invalidation=null}={}){
  const p=num(m?.price),i=m?.indicators||{},atr=num(i.atr14);
  if(p==null||atr==null||atr<=0)return{status:'NO_LEVELS',buyLow:null,buyHigh:null,stop:null,target1:null,target2:null,sellLow:null,sellHigh:null,rr1:null,rr2:null,setup:'Thiếu giá/ATR'};
  const high20=num(i.high20),low20=num(i.low20),s20=num(i.sma20),s50=num(i.sma50),vr=num(i.volumeRatio20),r20=num(i.ret20d);
  const breakout=high20!=null&&p>=high20-0.35*atr&&(vr??0)>=1.25&&(r20??0)>0;
  let buyLow,buyHigh,setup;
  if(breakout){buyLow=p-0.30*atr;buyHigh=p+0.18*atr;setup='Breakout có xác nhận thanh khoản'}
  else{
    const supports=[s20,s50,low20].filter(x=>x!=null&&x<=p+0.25*atr).sort((a,b)=>Math.abs(p-a)-Math.abs(p-b));
    const anchor=supports[0]??p-0.55*atr;
    buyLow=Math.max(0,anchor-0.35*atr);buyHigh=anchor+0.35*atr;setup=supports.length?'Pullback về hỗ trợ kỹ thuật':'Vùng mua theo ATR';
  }
  if(buyHigh<buyLow)[buyLow,buyHigh]=[buyHigh,buyLow];
  const mid=(buyLow+buyHigh)/2;
  let stop=num(invalidation);
  if(stop==null){const candidates=[buyLow-0.9*atr,s50!=null?s50-0.55*atr:null,low20!=null?low20-0.35*atr:null].filter(x=>x!=null&&x<buyLow);stop=candidates.length?Math.max(...candidates):buyLow-atr}
  if(stop>=buyLow)stop=buyLow-atr;
  stop=Math.max(0,stop);
  const risk=Math.max(atr*0.6,mid-stop);
  const target1=mid+2*risk,target2=mid+3*risk;
  const rr1=risk?((target1-mid)/risk):null,rr2=risk?((target2-mid)/risk):null;
  let status='WAIT';
  if(['AVOID','EXIT_REVIEW_NOW','REDUCE_REVIEW_NOW'].includes(action))status='NO_BUY';
  else if(p>=buyLow&&p<=buyHigh)status='IN_BUY_ZONE';
  else if(p>buyHigh)status='WAIT_PULLBACK';
  else if(p<buyLow)status='WAIT_CONFIRM';
  return{status,buyLow,buyHigh,stop,target1,target2,sellLow:target1,sellHigh:target2,rr1,rr2,setup};
}

export function decisionLabel(action,plan,confidence,risk){
  if(risk>=85)return'ƯU TIÊN THOÁT';
  if(risk>=70)return'XEM XÉT GIẢM';
  if(action==='PRIORITY_BUY'&&plan.status==='IN_BUY_ZONE'&&confidence>=70)return'MUA ƯU TIÊN';
  if((action==='PRIORITY_BUY'||action==='WATCH_BUY')&&plan.status==='IN_BUY_ZONE')return'CÓ THỂ MUA THĂM DÒ';
  if(action==='PRIORITY_BUY'||action==='WATCH_BUY')return'CANH MUA';
  if(action==='WATCH_HOLD')return'THEO DÕI / GIỮ';
  return'TRÁNH MUA';
}
