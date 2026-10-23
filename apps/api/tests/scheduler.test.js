import test from 'node:test';
import assert from 'node:assert/strict';
import { activateScheduledAuctions } from '../src/services/scheduler.js';

const now=new Date('2026-10-23T16:00:00.000Z');
test('scheduler ativa apenas lotes agendados dentro da janela e avisa cada sala',async()=>{
  const auctions=[
    {id:'start',status:'SCHEDULED',startsAt:new Date(now.getTime()-1000),endsAt:new Date(now.getTime()+60_000)},
    {id:'future',status:'SCHEDULED',startsAt:new Date(now.getTime()+60_000),endsAt:new Date(now.getTime()+120_000)},
    {id:'expired',status:'SCHEDULED',startsAt:new Date(now.getTime()-100_000),endsAt:new Date(now.getTime()-1)},
    {id:'live',status:'LIVE',startsAt:new Date(now.getTime()-1000),endsAt:new Date(now.getTime()+60_000)}
  ];
  const matches=(a)=>a.status==='SCHEDULED' && a.startsAt<=now && a.endsAt>now;
  const db={auction:{
    findMany:async()=>auctions.filter(matches).map(({id})=>({id})),
    updateMany:async({where,data})=>{
      const item=auctions.find(a=>a.id===where.id && matches(a));
      if(!item)return {count:0};
      item.status=data.status;
      return {count:1};
    }
  }};
  const events=[];
  assert.equal(await activateScheduledAuctions(db,id=>events.push(id),now),1);
  assert.deepEqual(events,['start']);
  assert.equal(auctions[0].status,'LIVE');
  assert.equal(await activateScheduledAuctions(db,id=>events.push(id),now),0);
  assert.deepEqual(events,['start']);
});
