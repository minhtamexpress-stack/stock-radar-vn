export const CORE_SYMBOLS=['VNM','VIC','FPT','HPG','MWG','MBB','TCB','ACB','CTG','HDB','GAS'];

export const OPPORTUNITY_UNIVERSE=[
  ['VCB','Ngân hàng'],['BID','Ngân hàng'],['VPB','Ngân hàng'],['STB','Ngân hàng'],['SHB','Ngân hàng'],['TPB','Ngân hàng'],['LPB','Ngân hàng'],
  ['SSI','Chứng khoán'],['VND','Chứng khoán'],['HCM','Chứng khoán'],['VCI','Chứng khoán'],['VIX','Chứng khoán'],
  ['VHM','Bất động sản'],['VRE','Bất động sản'],['BCM','Bất động sản'],['KDH','Bất động sản'],['DXG','Bất động sản'],['DIG','Bất động sản'],
  ['MSN','Tiêu dùng'],['PNJ','Bán lẻ'],['FRT','Bán lẻ'],['SAB','Tiêu dùng'],
  ['DGC','Hóa chất'],['GVR','Công nghiệp'],['REE','Hạ tầng'],['GEX','Công nghiệp'],
  ['PLX','Dầu khí'],['POW','Điện'],['PVD','Dầu khí'],['VJC','Hàng không']
].map(([symbol,sector])=>({symbol,type:'STOCK',sector,manual:{}}));

// Danh sách ETF niêm yết nội địa dùng cho ETF Radar V3.
// benchmark/indexName chỉ phục vụ nhóm so sánh và giải thích; không dùng như dữ liệu giá.
export const ETF_UNIVERSE=[
  ['E1VFVN30','VN30','VN30'],
  ['FUEABVND','VN Diamond','DIAMOND'],
  ['FUEBFVND','VN Diamond','DIAMOND'],
  ['FUEDCMID','VNMidcap','MIDCAP'],
  ['FUEFCV50','VNX50','VNX50'],
  ['FUEIP100','VN100','VN100'],
  ['FUEKIV30','VN30','VN30'],
  ['FUEKIVFS','VNFIN Select','VNFIN'],
  ['FUEKIVND','VN Diamond','DIAMOND'],
  ['FUEMAV30','VN30','VN30'],
  ['FUEMAVND','VN Diamond','DIAMOND'],
  ['FUEMITEC','VNMITECH','TECH'],
  ['FUESSV30','VN30','VN30'],
  ['FUESSV50','VNX50','VNX50'],
  ['FUESSVFL','VNFIN Lead','VNFIN'],
  ['FUETCC50','VNX50','VNX50'],
  ['FUETPVND','VN Diamond','DIAMOND'],
  ['FUEVFVND','VN Diamond','DIAMOND'],
  ['FUEVN100','VN100','VN100'],
  ['FUEVN50G','VN50 Growth','GROWTH50']
].map(([symbol,indexName,group])=>({symbol,type:'ETF',sector:'ETF',indexName,benchmark:indexName,group,manual:{}}));

export const ETF_SYMBOLS=ETF_UNIVERSE.map(x=>x.symbol);
export const ETF_SYMBOL_SET=new Set(ETF_SYMBOLS);

const coreSectors={VNM:'Tiêu dùng',VIC:'Bất động sản',FPT:'Công nghệ',HPG:'Thép',MWG:'Bán lẻ',MBB:'Ngân hàng',TCB:'Ngân hàng',ACB:'Ngân hàng',CTG:'Ngân hàng',HDB:'Ngân hàng',GAS:'Dầu khí'};
export const MARKET_UNIVERSE=[
  ...CORE_SYMBOLS.map(symbol=>({symbol,type:'STOCK',sector:coreSectors[symbol]||'Khác'})),
  ...OPPORTUNITY_UNIVERSE
];

export const UNIVERSE_VERSION='2026-09-09-v3';
export const ETF_UNIVERSE_VERSION='2026-09-09-v3-20etf';
