import { createHmac,randomBytes,timingSafeEqual } from 'node:crypto';
import { TripError } from './mapService.js';
// Process-local signatures expire along with quotes on restart; no secret reaches the client.
const secret=randomBytes(32);
const sign=data=>createHmac('sha256',secret).update(data).digest('base64url');
export function confirmPlace(place) {
  const payload=Buffer.from(JSON.stringify({...place,expires:Date.now()+30*60*1000})).toString('base64url');
  return {...place,placeToken:`${payload}.${sign(payload)}`};
}
export function verifyPlace(place) {
  try {
    const [payload,signature,...rest]=(place.placeToken||'').split('.');
    const expected=Buffer.from(sign(payload||'')),actual=Buffer.from(signature||'');
    if(rest.length||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error();
    const value=JSON.parse(Buffer.from(payload,'base64url').toString());
    if(value.expires<=Date.now()||value.label!==place.label||value.placeId!==place.placeId||JSON.stringify(value.coordinates)!==JSON.stringify(place.coordinates))throw new Error();
    const {expires,...confirmed}=value;return confirmed;
  } catch {throw new TripError(422,'Select both locations from the search results again; location confirmation is missing or expired.');}
}
