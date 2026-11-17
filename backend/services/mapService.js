export class TripError extends Error {
  constructor(status,message){super(message);this.status=status;}
}
export function mapSettings(env=process.env){
  const publicToken=/^pk\.[A-Za-z0-9._-]+$/.test(env.MAPBOX_PUBLIC_TOKEN||'')?env.MAPBOX_PUBLIC_TOKEN:null;
  return {publicToken,ready:!!(publicToken&&env.MAPBOX_SERVER_TOKEN),style:'mapbox://styles/mapbox/streets-v12'};
}
export function createMapService({token=process.env.MAPBOX_SERVER_TOKEN,fetcher=fetch}={}){
  async function request(path,params){
    if(!token)throw new TripError(503,'Map setup required: configure MAPBOX_SERVER_TOKEN and MAPBOX_PUBLIC_TOKEN in the backend environment.');
    const url=new URL(path,'https://api.mapbox.com');
    url.search=new URLSearchParams({...params,access_token:token});
    let response;
    try{response=await fetcher(url,{signal:AbortSignal.timeout(12000)});}catch{throw new TripError(503,'The map service timed out or could not be reached. Please try again.');}
    if(!response.ok)throw new TripError(503,response.status===401||response.status===403?'Map access was rejected. Check the configured tokens, account access and URL restrictions.':'The map provider is temporarily unavailable or has reached its request limit. Please try again later.');
    try{return await response.json();}catch{throw new TripError(502,'The map provider returned an unreadable response.');}
  }
  const places = payload => (payload.features||[]).filter(f=>Array.isArray(f.geometry?.coordinates)&&f.geometry.coordinates.length>=2).map(f=>({label:(f.properties?.full_address||[f.properties?.name,f.properties?.place_formatted].filter(Boolean).join(', ')).slice(0,200),coordinates:f.geometry.coordinates.slice(0,2)})).filter(f=>f.label);
  return {
    async search(q){return places(await request('/search/geocode/v6/forward',{q,autocomplete:'true',limit:'5',country:'in',language:'en',permanent:'true'}));},
    async reverse(coordinates){return places(await request('/search/geocode/v6/reverse',{longitude:coordinates[0],latitude:coordinates[1],limit:'1',language:'en',permanent:'true'}));},
    async route(from,to){
      const data=await request(`/directions/v5/mapbox/driving/${from.join(',')};${to.join(',')}`,{geometries:'geojson',overview:'full',steps:'false',alternatives:'false'});
      const r=data.routes?.[0];
      if(data.code!=='Ok'||!r)throw new TripError(422,'No driving route was found between these locations. Choose accessible pickup and drop-off points.');
      if(!Number.isFinite(r.distance)||r.distance<=0||!Number.isFinite(r.duration)||r.duration<0||r.geometry?.type!=='LineString'||!Array.isArray(r.geometry.coordinates)||r.geometry.coordinates.length<2)throw new TripError(502,'The map provider returned an incomplete driving route. Please try again.');
      return {distanceKm:r.distance/1000,durationSeconds:r.duration,geometry:r.geometry};
    }
  };
}
export async function drivingJourney(service,trip){
  const outbound=await service.route(trip.pickup.coordinates,trip.destination.coordinates);
  const returnIncluded=trip.trip_type==='round_trip'||(trip.trip_type==='outstation'&&trip.return_journey);
  const inbound=returnIncluded?await service.route(trip.destination.coordinates,trip.pickup.coordinates):null;
  return {distanceKm:outbound.distanceKm+(inbound?.distanceKm||0),durationSeconds:outbound.durationSeconds+(inbound?.durationSeconds||0),returnIncluded,outbound,inbound};
}
