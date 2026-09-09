const num=v=>v==null||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));

const OFFICIAL_RX=/(hose\.vn|hnx\.vn|ssc\.gov\.vn|ubcknn|vsd\.vn|vsdc|công bố thông tin|doanh nghiệp niêm yết)/i;
const SEVERE_RX=/(khởi tố|truy tố|điều tra hình sự|đình chỉ giao dịch|hủy niêm yết|gian lận|phá sản|mất khả năng thanh toán)/i;
const HIGH_RX=/(xử phạt|vi phạm|thanh tra|cảnh báo|nợ xấu tăng mạnh|lợi nhuận giảm mạnh|thua lỗ lớn|bán giải chấp)/i;
const MEDIUM_RX=/(phát hành thêm|pha loãng|cổ đông lớn bán|lãnh đạo bán|trái phiếu đáo hạn|kiểm toán ngoại trừ)/i;

function sourceKey(x={}){
  return String(x.source||x.provider||x.domain||x.url||x.link||'unknown').trim().toLowerCase();
}
function isOfficial(x={}){
  if(x.official===true||Number(x.tier)<=2)return true;
  return OFFICIAL_RX.test(`${x.source||''} ${x.provider||''} ${x.url||x.link||''}`);
}

export function hotNewsRisk(items=[]){
  const hits=[];
  for(const x of items||[]){
    const title=String(x?.title||x?.headline||x?.summary||'').trim();
    if(!title)continue;
    let severity=0;
    if(SEVERE_RX.test(title))severity=92;
    else if(HIGH_RX.test(title))severity=76;
    else if(MEDIUM_RX.test(title))severity=58;
    if(severity)hits.push({severity,title,source:sourceKey(x),official:isOfficial(x),url:x.url||x.link||''});
  }
  hits.sort((a,b)=>b.severity-a.severity);
  const top=hits[0];
  if(!top)return{severity:0,veto:false,confirmed:false,hits:[],reasons:[]};
  const severe=hits.filter(x=>x.severity>=90);
  const sources=new Set(severe.map(x=>x.source).filter(Boolean));
  const confirmed=severe.some(x=>x.official)||sources.size>=2;
  const veto=top.severity>=90&&confirmed;
  const severity=veto?top.severity:(top.severity>=90?78:top.severity);
  const reasons=[top.title];
  if(top.severity>=90&&!confirmed)reasons.push('Tin nghiêm trọng nhưng chưa đủ xác nhận chéo để kích hoạt Risk Veto');
  if(veto)reasons.push('Risk Veto: tin nghiêm trọng đã được nguồn chính thức hoặc nhiều nguồn độc lập xác nhận');
  return{severity,veto,confirmed,hits,reasons};
}

export function positionSizeByRisk({portfolioValue,entryPrice,stopPrice,riskPct=0.8,maxPositionPct=15,lotSize=100}={}){
  const pv=num(portfolioValue),entry=num(entryPrice),stop=num(stopPrice);
  if(pv==null||pv<=0||entry==null||entry<=0||stop==null||stop>=entry)return{shares:0,capital:0,riskBudget:0,reason:'Thiếu dữ liệu hoặc stop không hợp lệ'};
  const riskBudget=pv*(Math.max(0,riskPct)/100),perShare=entry-stop;
  const rawByRisk=Math.floor(riskBudget/perShare),rawByCap=Math.floor((pv*(Math.max(0,maxPositionPct)/100))/entry);
  const raw=Math.max(0,Math.min(rawByRisk,rawByCap)),lot=Math.max(1,Math.floor(lotSize||1));
  const shares=Math.floor(raw/lot)*lot;
  return{shares,capital:shares*entry,riskBudget,perShareRisk:perShare,reason:shares?'Theo risk budget và giới hạn tỷ trọng':'Quy mô vị thế quá nhỏ với mức stop hiện tại'};
}

export function newEntryDecision({rec,plan,newsItems=[],regime='NEUTRAL'}={}){
  const news=hotNewsRisk(newsItems),opp=num(rec?.score),confidence=num(rec?.confidence)??0;
  const risk=Math.max(num(rec?.riskSeverity)??50,news.severity||0);
  if(news.veto||risk>=85)return{action:'TRÁNH MUA / RISK VETO',code:'AVOID_VETO',opportunity:opp,confidence,risk,reasons:[...(news.reasons||[]),...(rec?.rationale||[])]};
  if(opp==null||confidence<40)return{action:'CHƯA ĐỦ DỮ LIỆU',code:'NO_DATA',opportunity:opp,confidence,risk,reasons:['Không đủ dữ liệu để ra quyết định có độ tin cậy cao']};
  const zone=plan?.status==='IN_BUY_ZONE';
  if(opp>=85&&confidence>=80&&risk<=25&&zone&&regime!=='RISK_OFF')return{action:'MUA NGAY',code:'BUY_NOW',opportunity:opp,confidence,risk,reasons:['Cơ hội rất cao, độ tin cậy cao, rủi ro thấp và giá đang ở vùng mua']};
  if(opp>=78&&confidence>=70&&risk<=35&&zone&&regime!=='RISK_OFF')return{action:'MUA THĂM DÒ',code:'BUY_PROBE',opportunity:opp,confidence,risk,reasons:['Cơ hội tốt và giá đang trong vùng mua nhưng chưa đạt chuẩn MUA NGAY']};
  if(opp>=75&&risk<=50)return{action:'CANH MUA',code:'WATCH_BUY',opportunity:opp,confidence,risk,reasons:[zone?'Có thể chờ thêm xác nhận':'Cổ phiếu tốt nhưng chưa ở vùng mua tối ưu']};
  return{action:'QUAN SÁT / TRÁNH MUA',code:'WATCH_AVOID',opportunity:opp,confidence,risk,reasons:['Tín hiệu chưa đủ đồng thuận để giải ngân']};
}

function trendState(m={}){
  const p=num(m.price),i=m.indicators||{},s20=num(i.sma20),s50=num(i.sma50),s200=num(i.sma200);
  const up=p!=null&&(s50==null||p>=s50)&&(s20==null||p>=s20*0.985);
  const strong=p!=null&&s20!=null&&s50!=null&&p>=s20&&s20>=s50&&(s200==null||s50>=s200*0.97);
  return{up,strong,s20,s50,s200};
}

function exitLevels(position={},m={},plan={}){
  const avg=num(position.avgCost),price=num(m.price),atr=num(m?.indicators?.atr14),s20=num(m?.indicators?.sma20),s50=num(m?.indicators?.sma50);
  if(avg==null||avg<=0)return{protectiveStop:num(plan?.stop),sellLow:num(plan?.sellLow),sellHigh:num(plan?.sellHigh),riskUnit:null};
  const riskUnit=Math.max(avg*0.05,(atr||0)*1.5,avg*0.03);
  const baseT1=avg+2*riskUnit,baseT2=avg+3*riskUnit;
  let sellLow=baseT1,sellHigh=baseT2;
  if(price!=null&&atr!=null&&atr>0&&price>baseT1){sellLow=Math.max(baseT1,price+0.8*atr);sellHigh=Math.max(baseT2,price+2.2*atr)}
  let stop=num(plan?.stop);
  const technical=[stop,s50!=null&&atr!=null?s50-0.6*atr:null,s20!=null&&atr!=null?s20-1.2*atr:null].filter(Number.isFinite);
  stop=technical.length?Math.max(...technical):avg-riskUnit;
  const pnl=num(position.pnlPct);
  if(price!=null&&atr!=null&&atr>0&&pnl!=null){
    if(pnl>=15)stop=Math.max(stop,avg+0.5*riskUnit,price-2*atr);
    else if(pnl>=8)stop=Math.max(stop,avg,price-2.2*atr);
    else if(pnl>=4)stop=Math.max(stop,avg-0.3*riskUnit);
  }
  if(price!=null&&stop>=price)stop=price-(atr||price*0.02);
  return{protectiveStop:Math.max(0,stop),sellLow,sellHigh,riskUnit};
}

export function holdingDecision({position,market,rec,plan,fundamentals,flow,newsItems=[],regime='NEUTRAL'}={}){
  const news=hotNewsRisk(newsItems),opp=num(rec?.score)??50,confidence=num(rec?.confidence)??0;
  let risk=Math.max(num(rec?.riskSeverity)??50,news.severity||0);
  const fund=num(fundamentals?.score),flowScore=num(flow?.score),trend=trendState(market),levels=exitLevels(position,market,plan);
  const pnl=num(position?.pnlPct),price=num(market?.price),rsi=num(market?.indicators?.rsi14);
  const trendScore=trend.strong?90:trend.up?70:35;
  const longTermScore=clamp(opp*0.45+(fund??55)*0.25+trendScore*0.15+(flowScore??50)*0.15);
  if(regime==='RISK_OFF')risk=Math.max(risk,45);
  if(price!=null&&levels.protectiveStop!=null&&price<=levels.protectiveStop)risk=Math.max(risk,88);

  let code='HOLD',action='TIẾP TỤC NẮM GIỮ',timeHint='Theo dõi 20–60 phiên; tiếp tục giữ khi xu hướng và luận điểm còn nguyên.';
  const reasons=[];
  if(news.veto||risk>=85){
    code='SELL_NOW';action='BÁN NGAY';timeHint='Ưu tiên xử lý ngay khi có thanh khoản; đây là cảnh báo bảo toàn vốn/lợi nhuận.';
    reasons.push('Rủi ro đã chạm ngưỡng thoát vị thế');
  }else if(risk>=70){
    code='REDUCE';action='GIẢM TỶ TRỌNG';timeHint='Rà soát trong 1–3 phiên; không mua thêm cho tới khi rủi ro giảm.';
    reasons.push('Rủi ro cao, nên giảm quy mô vị thế');
  }else if(pnl!=null&&pnl>=15&&((rsi??0)>=76||(price!=null&&levels.sellLow!=null&&price>=levels.sellLow))){
    code='TAKE_PROFIT';action='CHỐT LỜI THEO VÙNG';timeHint='Có thể chốt từng phần và dùng điểm bảo vệ lợi nhuận cho phần còn lại.';
    reasons.push('Vị thế đã có lợi nhuận đáng kể hoặc tiến vào vùng chốt lời');
  }else if(longTermScore>=78&&confidence>=70&&risk<=40&&trend.up){
    code='HOLD_LONG';action='NẮM GIỮ LÂU DÀI';timeHint='Có thể giữ 3–12 tháng nếu cơ bản, dòng tiền và xu hướng tiếp tục được duy trì.';
    reasons.push('Cơ hội dài hạn tốt, xu hướng còn tích cực và rủi ro đang thấp');
  }else if(!trend.up&&pnl!=null&&pnl<0&&risk>=55){
    code='REDUCE';action='GIẢM TỶ TRỌNG';timeHint='Rà soát trong 3–10 phiên; ưu tiên bảo toàn vốn nếu xu hướng không hồi phục.';
    reasons.push('Xu hướng suy yếu trong khi vị thế đang lỗ');
  }else if(opp>=72&&risk<=50){
    code='HOLD';action='TIẾP TỤC NẮM GIỮ';timeHint='Theo dõi 20–60 phiên; nâng điểm bảo vệ khi lợi nhuận tăng.';
    reasons.push('Cơ hội vẫn còn, chưa xuất hiện điều kiện buộc phải bán');
  }else{
    code='HOLD_REVIEW';action='GIỮ THẬN TRỌNG / RÀ SOÁT';timeHint='Theo dõi sát 5–20 phiên; không gia tăng nếu tín hiệu chưa cải thiện.';
    reasons.push('Tín hiệu chưa đủ mạnh để giữ dài hạn nhưng chưa chạm ngưỡng bán ngay');
  }

  if(fund!=null)reasons.push(`Cơ bản ${Math.round(fund)}/100`);
  if(flowScore!=null)reasons.push(`Dòng tiền tổ chức ${Math.round(flowScore)}/100`);
  reasons.push(`Opportunity ${Math.round(opp)}/100 • Confidence ${Math.round(confidence)}% • Risk ${Math.round(risk)}/100`);
  if(levels.protectiveStop!=null)reasons.push(`Điểm bảo vệ vốn/lời khoảng ${levels.protectiveStop.toFixed(2)}`);
  reasons.push(...(news.reasons||[]));
  return{
    symbol:position?.symbol,
    code,action,timeHint,
    opportunity:Math.round(opp),confidence:Math.round(confidence),risk:Math.round(risk),longTermScore:Math.round(longTermScore),
    sellLow:levels.sellLow,sellHigh:levels.sellHigh,protectiveStop:levels.protectiveStop,
    pnlPct:pnl,avgCost:num(position?.avgCost),price,
    reasons:[...new Set(reasons)].slice(0,10),news
  };
}
