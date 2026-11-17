// Local development smoke check. Requires the frontend and API to be running.
import assert from 'node:assert/strict';
const frontend='http://localhost:3002';
const response=await fetch('http://localhost:5000/api/vehicles');assert.equal(response.status,200);
const {data:vehicles}=await response.json();
const paths=[...new Set(vehicles.map(v=>v.video_path).filter(Boolean))];
assert.ok(paths.length >= 10);
for(const path of paths){
  const partial=await fetch(frontend+path,{headers:{Range:'bytes=0-127'}});
  assert.equal(partial.status,206,path);assert.equal(partial.headers.get('content-type'),'video/mp4');assert.equal((await partial.arrayBuffer()).byteLength,128);
  const head=await fetch(frontend+path,{method:'HEAD'});assert.equal(head.status,200);assert.ok(Number(head.headers.get('content-length'))>1000);
}
const invalid=await fetch(frontend+paths[0],{headers:{Range:'bytes=999999999999-'}});assert.equal(invalid.status,416);
console.log('10 unique supplied videos reachable; byte-range playback, HEAD metadata and invalid-range handling passed.');
