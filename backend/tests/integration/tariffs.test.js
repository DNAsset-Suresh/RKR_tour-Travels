import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../app.js';
import { pool } from '../../config/database.js';
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
after(async()=>{await new Promise(resolve=>server.close(resolve));await pool.end();});
test('all 14 supplied tariffs are returned accurately from PostgreSQL through the API',async()=>{
  const expected=[
    ['Swift Dzire',1300,2600,260,14],['Toyota Etios',1400,2800,280,15],
    ['Toyota Innova',1800,3600,360,18],['Innova Crysta',2200,4400,420,22],
    ['Honda City',2400,4800,440,22],['Toyota Corolla Altis',2800,5600,540,25],
    ['Mercedes-Benz E-Class',7000,14000,1500,175],['Mercedes-Benz S-Class',12500,25000,2000,150],
    ['Toyota Fortuner',4500,9000,600,65],['Kia Carnival',2500,5000,500,40],
    ['Toyota Innova Hycross',2500,5000,500,40],['Force Urbania',3000,6000,500,40],
    ['Tempo Traveller — 12 Seater Luxury',2500,5000,500,22],['Tempo Traveller — 18 Seater Luxury',2750,5500,550,26]
  ];
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/vehicles`);
  assert.equal(response.status,200);const {data}=await response.json();
  for(const [name,...amounts] of expected){
    const matches=data.filter(v=>v.name===name);assert.equal(matches.length,1,name);
    const t=matches[0].tariff;assert.ok(t,name);assert.equal(t.currency,'INR');
    assert.deepEqual([t.package_5h_50km,t.package_10h_100km,t.extra_hour,t.extra_km],amounts,name);
  }
});
