const LAST_KEY='srvn:last';
let health=null;

function vnParts(ts=Date.now()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(ts));
  return Object.fromEntries(parts.map(p=>[p.type,p.value]));
}

function freshnessState(generatedAt){
  const t=Date.parse(generatedAt||'');
  if(!Number.isFinite(t)) return {state:'NO DATA',cls:'bad',ageMin:null};
  const now=Date.now(), ageMin=Math.max(0,(now-t)/60000), p=vnParts(now);
  const weekday=!['Sat','Sun'].includes(p.weekday), mins=Number(p.hour)*60+Number(p.minute);
  const inSession=weekday&&mins>=480&&mins<=960;
  if(inSession) return ageMin<=100?{state:'FRESH',cls:'good',ageMin}:{state:'STALE',cls:'bad',ageMin};
  return {state:'MARKET CLOSED',cls:'warn',ageMin};
}

function apply(){
  if(!health) return;
  const generatedAt=health.generatedAt||health._snapshotAt;
  const st=freshnessState(generatedAt);
  if(generatedAt){
    const t=Date.parse(generatedAt);
    if(Number.isFinite(t)) localStorage.setItem(LAST_KEY,JSON.stringify(t));
  }
  const label=[...document.querySelectorAll('.label')].find(x=>x.textContent.trim()==='Data Health');
  const card=label?.closest('.card');
  if(!card) return;
  const metric=card.querySelector('.metric'), small=card.querySelector('.small');
  const failed=Array.isArray(health.failedSymbols)?health.failedSymbols:[];
  const when=generatedAt?new Date(generatedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'không rõ';
  const age=st.ageMin==null?'':` • ${Math.round(st.ageMin)} phút`;
  const failure=failed.length?` • lỗi: ${failed.join(', ')}`:'';
  const text=`${st.state} • snapshot ${when}${age}${failure}`;
  if(small&&small.textContent!==text) small.textContent=text;
  if(metric){metric.classList.remove('good','warn','bad');metric.classList.add(st.cls)}
}

async function load(){
  try{
    const r=await fetch('./data/health.json',{cache:'no-store'});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    health=await r.json();
  }catch(e){
    health={ok:false,generatedAt:null,failedSymbols:['health'],error:String(e.message||e)};
  }
  apply();
}

new MutationObserver(()=>apply()).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target?.id==='refreshBtn')setTimeout(load,700)});
load();
setInterval(load,60000);
