const EXACT=new Map(Object.entries({
  'Dashboard':'Bảng điều khiển',
  'Decision Desk':'Bàn quyết định',
  'Decision Desk V1.5':'Bàn quyết định V1.5',
  'Portfolio Master':'Quản lý danh mục',
  'Stock & ETF Radar':'Radar Cổ phiếu & ETF',
  'ETF Core Radar':'Radar ETF lõi',
  'Expert Intelligence':'Trí tuệ Chuyên gia',
  'Social & Expert Intelligence':'Tín hiệu Chuyên gia & Cộng đồng',
  'Nguồn & Evidence':'Nguồn & Bằng chứng',
  'Policy & Backup':'Chính sách & Sao lưu',
  'Decision support • Risk first':'Hỗ trợ quyết định • Ưu tiên quản trị rủi ro',
  'Market Regime':'Trạng thái thị trường',
  'Portfolio P&L':'Lãi/Lỗ danh mục',
  'Risk Alerts':'Cảnh báo rủi ro',
  'Data Health':'Tình trạng dữ liệu',
  'Provider Health':'Tình trạng nguồn dữ liệu',
  'Market Intel':'Nhận định thị trường',
  'NEUTRAL':'TRUNG TÍNH',
  'RISK_ON':'TÍCH CỰC',
  'RISK_OFF':'PHÒNG THỦ',
  'ONLINE':'HOẠT ĐỘNG',
  'OFFLINE':'MẤT KẾT NỐI',
  'FRESH':'DỮ LIỆU MỚI',
  'STALE':'DỮ LIỆU CŨ',
  'NO DATA':'KHÔNG CÓ DỮ LIỆU',
  'MARKET CLOSED':'THỊ TRƯỜNG ĐÃ ĐÓNG CỬA',
  'Top candidate':'Ứng viên hàng đầu',
  'Data coverage':'Độ phủ dữ liệu',
  'Score':'Điểm',
  'Confidence':'Độ tin cậy',
  'Risk':'Rủi ro',
  'Stop':'Cắt lỗ',
  'Target 1':'Mục tiêu 1',
  'Target 2 / vùng bán':'Mục tiêu 2 / vùng bán',
  'Technical':'Kỹ thuật',
  'Fund.':'Cơ bản',
  'Smart':'Dòng tiền',
  'Catalyst':'Động lực',
  'Risk Q.':'Chất lượng rủi ro',
  'Social':'Cộng đồng',
  'Invalidation':'Ngưỡng vô hiệu',
  'Bear / Base / Bull':'Kịch bản Xấu / Cơ sở / Tốt',
  'ETF universe':'Danh sách ETF',
  'Policy core':'Tỷ trọng ETF lõi',
  'Track record & Reliability':'Lịch sử dự báo & Độ tin cậy',
  'Automatic Provenance':'Nguồn bằng chứng tự động',
  'Decision Journal V1.5 — immutable snapshots':'Nhật ký quyết định V1.5 — ảnh chụp bất biến',
  'Portfolio Policy Guard':'Kiểm soát chính sách danh mục',
  'Governance / Regulatory Risk':'Rủi ro quản trị / pháp lý',
  'Governance/Regulatory Risk':'Rủi ro quản trị / pháp lý',
  'News evidence:':'Bằng chứng tin tức:',
  'News evidence: chưa có snapshot':'Bằng chứng tin tức: chưa có dữ liệu',
  'Corporate events:':'Sự kiện doanh nghiệp:',
  'Corporate events: chưa có dữ liệu':'Sự kiện doanh nghiệp: chưa có dữ liệu',
  'Fundamentals chưa đủ':'Dữ liệu cơ bản chưa đủ',
  'positive':'tích cực',
  'negative':'tiêu cực',
  'neutral':'trung tính',
  'NORMAL':'BÌNH THƯỜNG',
  'WATCH':'THEO DÕI',
  'HIGH_ALERT':'CẢNH BÁO CAO',
  'PRIORITY_BUY':'ƯU TIÊN MUA',
  'WATCH_BUY':'CANH MUA',
  'WATCH_HOLD':'THEO DÕI / GIỮ',
  'AVOID':'TRÁNH MUA',
  'REDUCE_REVIEW_NOW':'RÀ SOÁT GIẢM TỶ TRỌNG',
  'EXIT_REVIEW_NOW':'RÀ SOÁT THOÁT VỊ THẾ',
  'IN_BUY_ZONE':'ĐANG TRONG VÙNG MUA',
  'WAIT_PULLBACK':'CHỜ ĐIỀU CHỈNH',
  'WAIT_CONFIRM':'CHỜ XÁC NHẬN',
  'NO_BUY':'KHÔNG MUA',
  'WAIT':'CHỜ',
  'NO_LEVELS':'CHƯA ĐỦ MỨC GIÁ'
}));

function translateCore(s){
  let t=s;
  if(EXACT.has(t))return EXACT.get(t);
  t=t.replace(/^(\d+) mã trọng tâm • Risk Engine độc lập • Không tự đặt lệnh$/,'$1 mã trọng tâm • Bộ máy quản trị rủi ro độc lập • Không tự đặt lệnh');
  t=t.replace(/^MARKET CLOSED • snapshot /,'THỊ TRƯỜNG ĐÃ ĐÓNG CỬA • dữ liệu lúc ');
  t=t.replace(/^FRESH • snapshot /,'DỮ LIỆU MỚI • dữ liệu lúc ');
  t=t.replace(/^STALE • snapshot /,'DỮ LIỆU CŨ • dữ liệu lúc ');
  t=t.replace(/^NO DATA/,'KHÔNG CÓ DỮ LIỆU');
  t=t.replace(/^Market (\d+\/\d+) • Fresh Fundamentals (\d+\/\d+) • Smart Money (\d+\/\d+) • Events (\d+\/\d+) • News (\d+\/\d+)$/,'Thị trường $1 • Cơ bản mới $2 • Dòng tiền tổ chức $3 • Sự kiện $4 • Tin tức $5');
  t=t.replace(/^Fund (\d+) • Flow (\d+) • Events (\d+) • News (\d+)$/,'Cơ bản $1 • Dòng tiền $2 • Sự kiện $3 • Tin tức $4');
  t=t.replace(/^Data Confidence (\d+)% < policy (\d+)%$/,'Độ tin cậy dữ liệu $1% < ngưỡng chính sách $2%');
  t=t.replace(/^Fundamentals: /,'Cơ bản: ');
  t=t.replace(/^Smart Money: /,'Dòng tiền tổ chức: ');
  t=t.replace(/^Catalyst\/News: /,'Động lực/Tin tức: ');
  t=t.replace(/^Organization Flow /,'Dòng tiền tổ chức ');
  t=t.replace(/^News: /,'Tin tức: ');
  t=t.replace(/^ROE proxy /,'ROE ước tính ');
  t=t.replace(/^Decision Desk /,'Bàn quyết định ');
  t=t.replace(/^ETF Core Radar$/,'Radar ETF lõi');
  t=t.replace(/^Core–Satellite • /,'Lõi–Vệ tinh • ');
  t=t.replace(/^Opportunity Radar • vùng mua\/bán • Fundamentals • Smart Money • Corporate Events • Catalyst\/News • quản trị vị thế$/,'Radar cơ hội • vùng mua/bán • Cơ bản • Dòng tiền tổ chức • Sự kiện doanh nghiệp • Động lực/Tin tức • quản trị vị thế');
  t=t.replace(/^ETF Radar ưu tiên vai trò ổn định danh mục\. Tín hiệu ETF dựa trên xu hướng\/động lượng và liquidity snapshot; không dùng Fundamentals cổ phiếu để chấm ETF\.$/,'Radar ETF ưu tiên vai trò ổn định danh mục. Tín hiệu ETF dựa trên xu hướng, động lượng và dữ liệu thanh khoản; không dùng dữ liệu cơ bản cổ phiếu để chấm ETF.');
  t=t.replace(/^News\/Catalyst và Corporate Events là tín hiệu hỗ trợ, không tự kích hoạt BUY\./,'Tin tức/Động lực và Sự kiện doanh nghiệp là tín hiệu hỗ trợ, không tự kích hoạt lệnh MUA.');
  t=t.replace(/Fundamentals chỉ được chấm khi dữ liệu đã qua freshness guard\./,'Dữ liệu cơ bản chỉ được chấm khi đã qua kiểm tra độ mới.');
  t=t.replace(/P\/E\/P\/B và ROE proxy/g,'P/E, P/B và ROE ước tính');
  t=t.replace(/snapshot/g,'dữ liệu chụp');
  return t;
}

function translateNode(node){
  if(node.nodeType!==Node.TEXT_NODE)return;
  const parent=node.parentElement;if(!parent||['SCRIPT','STYLE','CODE','PRE'].includes(parent.tagName))return;
  if(parent.closest('a'))return;
  const raw=node.nodeValue??'',trim=raw.trim();if(!trim)return;
  const out=translateCore(trim);if(out!==trim)node.nodeValue=raw.replace(trim,out);
}

function translateAttrs(el){
  if(!(el instanceof Element))return;
  for(const attr of ['placeholder','title','aria-label']){
    const v=el.getAttribute(attr);if(!v)continue;const n=translateCore(v);if(n!==v)el.setAttribute(attr,n);
  }
}

function walk(root=document.body){
  if(!root)return;
  if(root.nodeType===Node.TEXT_NODE){translateNode(root);return}
  translateAttrs(root);
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))translateNode(n);
  root.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(translateAttrs);
}

let timer=null;
const obs=new MutationObserver(muts=>{
  clearTimeout(timer);timer=setTimeout(()=>{
    for(const m of muts){for(const n of m.addedNodes)walk(n);if(m.type==='characterData')translateNode(m.target)}
  },30);
});

function init(){walk(document.body);obs.observe(document.body,{childList:true,subtree:true,characterData:true});setTimeout(()=>walk(document.body),500);setTimeout(()=>walk(document.body),1500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
