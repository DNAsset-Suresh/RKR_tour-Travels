import { TripError } from './mapService.js';

export const googleSettings = () => ({provider:'Google Maps',ready:!!process.env.GOOGLE_MAPS_API_KEY?.trim(),aiReady:!!process.env.GEMINI_API_KEY?.trim()});
const coordinates = p => p && Number.isFinite(p.longitude) && Math.abs(p.longitude)<=180 && Number.isFinite(p.latitude) && Math.abs(p.latitude)<=90;
export function createGoogleMapsService({key=process.env.GOOGLE_MAPS_API_KEY,fetcher=fetch}={}) {
  async function call(url,{body,mask}={}) {
    if(!key?.trim())throw new TripError(503,'Google Maps setup required. Address search and road-distance calculation are unavailable; you can still request a personal quotation.');
    let response,data;
    try {
      response=await fetcher(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,...(mask?{'X-Goog-FieldMask':mask}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error('provider');
      data=await response.json();
    } catch {throw new TripError(503,'Google Maps could not complete this request. Please try again or request a personal quotation.');}
    return data;
  }
  return {
    async search(input,sessionToken) {
      const data=await call('https://places.googleapis.com/v1/places:autocomplete',{body:{input,sessionToken,includedRegionCodes:['in'],languageCode:'en'},mask:'suggestions.placePrediction.placeId,suggestions.placePrediction.text'});
      return (data.suggestions||[]).map(s=>s.placePrediction).filter(p=>p?.placeId&&p.text?.text).slice(0,8).map(p=>({placeId:p.placeId,label:p.text.text.slice(0,200)}));
    },
    async place(placeId,sessionToken) {
      const url=new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);url.searchParams.set('sessionToken',sessionToken);url.searchParams.set('languageCode','en');
      const p=await call(url,{mask:'id,displayName,formattedAddress,location'});
      if(!p.id||!coordinates(p.location)||!p.formattedAddress)throw new TripError(422,'This location could not be confirmed. Select another address.');
      const name=p.displayName?.text;return {placeId:p.id,label:(name&&!p.formattedAddress.startsWith(name)?`${name}, ${p.formattedAddress}`:p.formattedAddress).slice(0,200),coordinates:[p.location.longitude,p.location.latitude]};
    },
    async reverse(position) {
      if(!key?.trim())throw new TripError(503,'Google Maps setup required for current-location lookup.');
      const url=new URL('https://maps.googleapis.com/maps/api/geocode/json');url.searchParams.set('latlng',`${position[1]},${position[0]}`);url.searchParams.set('key',key);url.searchParams.set('language','en');
      const data=await call(url);
      if(data.status==='ZERO_RESULTS')throw new TripError(422,'No address was found here. Search for a pickup location instead.');
      if(data.status!=='OK'||!data.results?.[0]?.formatted_address)throw new TripError(503,'Current-location lookup is unavailable. Search for a pickup location instead.');
      // Keep the device position as the route waypoint, not the nearest address centroid.
      return {label:data.results[0].formatted_address.slice(0,200),coordinates:position};
    },
    async routes(origin,destination) {
      const waypoint=p=>p.placeId?{placeId:p.placeId}:{location:{latLng:{latitude:p.coordinates[1],longitude:p.coordinates[0]}}};
      const data=await call('https://routes.googleapis.com/directions/v2:computeRoutes',{body:{origin:waypoint(origin),destination:waypoint(destination),travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE',computeAlternativeRoutes:true,languageCode:'en-IN',units:'METRIC'},mask:'routes.distanceMeters,routes.duration,routes.routeLabels,routes.description'});
      if(!data.routes?.length)throw new TripError(422,'No driving route was found between these locations. Try different locations or request a quotation.');
      const routes=data.routes.map(r=>({distanceKm:r.distanceMeters/1000,durationSeconds:typeof r.duration==='string'&&/^\d+(\.\d+)?s$/.test(r.duration)?Number(r.duration.slice(0,-1)):NaN,description:typeof r.description==='string'?r.description.slice(0,200):'',isDefault:r.routeLabels?.includes('DEFAULT_ROUTE')===true}));
      if(routes.some(r=>!Number.isFinite(r.distanceKm)||r.distanceKm<=0||!Number.isFinite(r.durationSeconds)||r.durationSeconds<=0))throw new TripError(502,'Google Maps returned incomplete route information. Please try again.');
      return routes;
    }
  };
}
export function selectGoogleJourney(options,selection={}) {
  const choose=(list,index)=>{
    const chosen=index??Math.max(0,list.findIndex(r=>r.isDefault));
    if(!Number.isInteger(chosen)||!list[chosen])throw new TripError(422,'Choose a listed route alternative.');
    return chosen;
  };
  const outboundIndex=choose(options.outbound,selection.outboundIndex),returnIndex=options.inbound.length?choose(options.inbound,selection.returnIndex):null;
  if(returnIndex===null&&selection.returnIndex!=null)throw new TripError(422,'A return route has not been requested.');
  const outbound=options.outbound[outboundIndex],inbound=returnIndex===null?null:options.inbound[returnIndex];
  return {source:'Google Routes',trafficAware:false,distanceKm:outbound.distanceKm+(inbound?.distanceKm||0),durationSeconds:outbound.durationSeconds+(inbound?.durationSeconds||0),returnIncluded:!!inbound,outbound,inbound,options,selection:{outboundIndex,returnIndex}};
}
export async function googleJourney(service,trip,selection) {
  const needsReturn=trip.trip_type==='round_trip'||(trip.trip_type==='outstation'&&trip.return_journey);
  const [outbound,inbound]=await Promise.all([service.routes(trip.pickup,trip.destination),needsReturn?service.routes(trip.destination,trip.pickup):Promise.resolve([])]);
  return selectGoogleJourney({outbound,inbound},selection);
}
