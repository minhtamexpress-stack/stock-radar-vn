import test from 'node:test';
import assert from 'node:assert/strict';
import {tradePlan,decisionLabel,riskQualityScore} from '../decision-core.js';

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
