export const CORE_SYMBOLS=['VNM','VIC','FPT','HPG','MWG','MBB','TCB','ACB','CTG','HDB','GAS'];

export const OPPORTUNITY_UNIVERSE=[
  ['VCB','Ngân hàng'],['BID','Ngân hàng'],['VPB','Ngân hàng'],['STB','Ngân hàng'],['SHB','Ngân hàng'],['TPB','Ngân hàng'],['LPB','Ngân hàng'],
  ['SSI','Chứng khoán'],['VND','Chứng khoán'],['HCM','Chứng khoán'],['VCI','Chứng khoán'],['VIX','Chứng khoán'],
  ['VHM','Bất động sản'],['VRE','Bất động sản'],['BCM','Bất động sản'],['KDH','Bất động sản'],['DXG','Bất động sản'],['DIG','Bất động sản'],
  ['MSN','Tiêu dùng'],['PNJ','Bán lẻ'],['FRT','Bán lẻ'],['SAB','Tiêu dùng'],
  ['DGC','Hóa chất'],['GVR','Công nghiệp'],['REE','Hạ tầng'],['GEX','Công nghiệp'],
  ['PLX','Dầu khí'],['POW','Điện'],['PVD','Dầu khí'],['VJC','Hàng không']
].map(([symbol,sector])=>({symbol,type:'STOCK',sector,manual:{}}));

const coreSectors={VNM:'Tiêu dùng',VIC:'Bất động sản',FPT:'Công nghệ',HPG:'Thép',MWG:'Bán lẻ',MBB:'Ngân hàng',TCB:'Ngân hàng',ACB:'Ngân hàng',CTG:'Ngân hàng',HDB:'Ngân hàng',GAS:'Dầu khí'};
export const MARKET_UNIVERSE=[
  ...CORE_SYMBOLS.map(symbol=>({symbol,type:'STOCK',sector:coreSectors[symbol]||'Khác'})),
  ...OPPORTUNITY_UNIVERSE
];

export const UNIVERSE_VERSION='2026-08-27-v1';
