import test from 'node:test';
import assert from 'node:assert/strict';
import {tradePlan,decisionLabel,riskQualityScore,extractFundamentalScore,extractFlowScore} from '../decision-core.js';

test('tradePlan builds buy zone stop and targets from ATR',()=>{
  const m={price:100,indicators:{atr14:4,sma20:98,sma50:94,high20:104,low20:90,volumeRatio20:1.1,ret20d:8}};
  const p=tradePlan(m,{action:'WATCH_BUY'});
  assert.ok(Number.isFinite(p.buyLow));
  assert.ok(Number.isFinite(p.buyHigh));
  assert.ok(p.stop<p.buyLow);
  assert.ok(p.target1>p.buyHigh);
  assert.ok(p.target2>p.target1);
});

test('tradePlan blocks buy on exit action',()=>{
  const m={price:100,indicators:{atr14:4,sma20:98,sma50:94,high20:104,low20:90,volumeRatio20:1.1,ret20d:8}};
  const p=tradePlan(m,{action:'EXIT_REVIEW_NOW'});
  assert.equal(p.status,'NO_BUY');
});

test('decisionLabel respects risk veto',()=>{
  const plan={status:'IN_BUY_ZONE'};
  assert.equal(decisionLabel('PRIORITY_BUY',plan,90,90),'ƯU TIÊN THOÁT');
  assert.equal(decisionLabel('PRIORITY_BUY',plan,90,20),'MUA ƯU TIÊN');
});

test('riskQualityScore returns bounded score',()=>{
  const s=riskQualityScore({price:100,indicators:{atr14:2,sma50:90,sma200:80,ret20d:5}});
  assert.ok(s>=0&&s<=100);
});

test('stale raw fundamentals are never scored',()=>{
  const r=extractFundamentalScore({fundamentalsRaw:{vps:{roe:25,pe:8,eps:5000,year:2021}}});
  assert.equal(r.score,null);
  assert.equal(r.fresh,false);
});

test('fresh normalized fundamentals are scored',()=>{
  const r=extractFundamentalScore({fundamentalNormalized:{fresh:true,asOfYear:2026,latestQuarter:{label:'Q2/2026'},metrics:{roe:20,pe:12,eps:5}}});
  assert.ok(Number.isFinite(r.score));
  assert.equal(r.fresh,true);
  assert.ok(r.reasons.some(x=>x.includes('Q2/2026')));
});

test('derived valuation and ROE proxy are labeled safely',()=>{
  const r=extractFundamentalScore({fundamentalNormalized:{fresh:true,latestQuarter:{label:'Q2/2026'},metrics:{pe:8.2,pb:1.35,eps:2.71,bvps:16.46,roe:null,roeProxy:16.46},derived:{pe:true,pb:true,roeProxy:true}}});
  assert.ok(Number.isFinite(r.score));
  assert.equal(r.metrics.roeIsProxy,true);
  assert.ok(r.reasons.some(x=>x.includes('ROE proxy')));
  assert.ok(r.reasons.some(x=>x.includes('P/B')));
  assert.ok(r.reasons.some(x=>x.includes('chỉ số suy ra')));
});

test('normalized organization flow becomes Smart Money score',()=>{
  const r=extractFlowScore({organizationFlow:{score:64,net5:12000000000,net15:-3000000000}});
  assert.equal(r.score,64);
  assert.ok(r.reasons.some(x=>x.includes('5 phiên')));
});
