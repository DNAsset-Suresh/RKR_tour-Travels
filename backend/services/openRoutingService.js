import { TripError } from './mapService.js';

// Shared across all requests: public services allow at most one request/second.
export function createRequestQueue({interval=1100,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  let tail=Promise.resolve(),lastStart=0,pending=0;
  return task=>{
    if(pending>=4)return Promise.reject(new TripError(503,'Address lookup is busy. Please retry shortly or enter the distance yourself.'));
    pending++;
    const result=tail.then(async()=>{const delay=interval-(now()-lastStart);if(delay>0)await sleep(delay);lastStart=now();return task();});
    tail=result.catch(()=>{}).finally(()=>pending--);return result;
  };
}
const geocodeQueue=createRequestQueue(),routeQueue=createRequestQueue();
const searches=new Map(),routes=new Map();
function cached(map,key){const item=map.get(key);if(item?.expires>Date.now())return structuredClone(item.value);map.delete(key);}
function remember(map,key,value,ttl){if(map.size>=300)map.delete(map.keys().next().value);map.set(key,{value:structuredClone(value),expires:Date.now()+ttl});return value;}
export function createOpenRoutingService({fetcher=fetch,geocoder=process.env.NOMINATIM_BASE_URL||'https://nominatim.openstreetmap.org',router=process.env.OSRM_BASE_URL||'https://routing.openstreetmap.de/routed-car',userAgent=process.env.OPEN_ROUTING_USER_AGENT||'RKR-Tour/1.0 (local travel-planning website; http://localhost:3002)',searchQueue=geocodeQueue,drivingQueue=routeQueue,searchCache=searches,routeCache=routes}={}){
  async function get(url){
    try{const response=await fetcher(url,{headers:{'User-Agent':userAgent,'Accept':'application/json','Accept-Language':'en'},signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();return await response.json();}
    catch{throw new TripError(503,'The public address or routing service is unavailable. Retry shortly, enter the distance yourself, or request a personal quote.');}
  }
  return {
    async search(query){
      const key=`${geocoder}:${query.trim().toLowerCase()}`,hit=cached(searchCache,key);if(hit)return hit;
      return searchQueue(async()=>{
        const again=cached(searchCache,key);if(again)return again;
        const url=new URL(`${geocoder.replace(/\/$/,'')}/search`);url.search=new URLSearchParams({q:query,format:'jsonv2',countrycodes:'in',limit:'5','accept-language':'en'}).toString();
        const data=await get(url);if(!Array.isArray(data))throw new TripError(502,'Address search returned an unreadable response. Please retry.');
        const results=data.filter(p=>typeof p?.display_name==='string'&&p.display_name.trim().length>=2&&p.lon!=null&&p.lat!=null&&String(p.lon).trim()!==''&&String(p.lat).trim()!==''&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lon))<=180&&Number.isFinite(Number(p.lat))&&Math.abs(Number(p.lat))<=90).map(p=>({label:p.display_name.slice(0,200),coordinates:[Number(p.lon),Number(p.lat)]}));
        return remember(searchCache,key,results,24*60*60*1000);
      });
    },
    async route(pickup,destination,{fresh=false,roundTrip=false}={}){
      const destList = Array.isArray(destination) ? destination : [destination];
      const allPoints = [pickup, ...destList, ...(roundTrip ? [pickup] : [])];
      const coords = allPoints.map(p => p.coordinates);
      if(coords.some(p=>!Array.isArray(p)||p.length!==2||!Number.isFinite(p[0])||Math.abs(p[0])>180||!Number.isFinite(p[1])||Math.abs(p[1])>90))throw new TripError(422,'Choose confirmed pickup and destination locations.');
      const key=`${router}:${JSON.stringify(coords)}`,hit=!fresh&&cached(routeCache,key);if(hit)return hit;
      return drivingQueue(async()=>{
        const url=new URL(`${router.replace(/\/$/,'')}/route/v1/driving/${coords.map(p=>p.join(',')).join(';')}`);url.search=new URLSearchParams({overview:'false',alternatives:'false',steps:'false'}).toString();
        const data=await get(url);
        if(data.code==='NoRoute'||data.code==='NoSegment')throw new TripError(422,'No driving route was found. Try a nearby public landmark or enter the distance yourself.');
        const route=data.routes?.[0];
        if(data.code!=='Ok'||!Number.isFinite(route?.distance)||route.distance<=0||!Number.isFinite(route?.duration)||route.duration<=0||!Array.isArray(data.waypoints)||data.waypoints.length!==coords.length)throw new TripError(502,'The routing service returned incomplete road information. Please retry or enter the distance yourself.');
        if(data.waypoints.some(p=>!Number.isFinite(p.distance)||p.distance>1000))throw new TripError(422,'A selected location is too far from a routable road. Choose a closer public landmark.');
        return remember(routeCache,key,{source:'OSRM',distanceKm:route.distance/1000,durationSeconds:route.duration,returnIncluded:roundTrip,trafficAware:false,calculatedAt:new Date().toISOString()},5*60*1000);
      });
    }
  };
}
