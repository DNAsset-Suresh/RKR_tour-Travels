// Synthetic browser fixtures only; injected via CDP in QA, never loaded by the website.
(() => {
  const originalFetch=window.fetch.bind(window),quotes=new Map();
  window.rkrQA={fail:false,delay:0,calls:0,aiFail:false};
  const json=data=>new Response(JSON.stringify({data}),{headers:{'Content-Type':'application/json'}});
  const outbound=[{distanceKm:60,durationSeconds:7200,description:'QA default road',isDefault:true},{distanceKm:70,durationSeconds:8000,description:'QA alternative road',isDefault:false}];
  async function estimate(url,trip,selection={outboundIndex:0,returnIndex:null}){
    const fleet=(await (await originalFetch(`${url.origin}/api/vehicles`)).json()).data,leg=outbound[selection.outboundIndex],round=trip.trip_type==='round_trip',km=leg.distanceKm+(round?64:0);
    const vehicles=fleet.map(v=>{const local=trip.trip_type==='local',large=trip.package_id==='10h100',base=large?v.tariff.package_10h_100km:v.tariff.package_5h_50km,extraKm=Math.max(0,km-(large?100:50))*v.tariff.extra_km,extraHour=Math.max(0,trip.rental_hours-(large?10:5))*v.tariff.extra_hour;return {...v,fare:{status:local?'estimated':'quote_required',total:local?base+extraKm+extraHour:null,currency:'INR',reason:local?null:'Approved road-trip rates are not configured.',breakdown:local?[{label:`QA fixture ${large?'10h / 100km':'5h / 50km'} package`,amount:base},{label:'Extra kilometres',amount:extraKm},{label:'Extra hours',amount:extraHour}]:[],assumptions:['QA FIXTURE — not a live road route'],exclusions:['Taxes','Tolls','Parking','Driver allowance'],ratePerKm:null}};});
    const quote={id:crypto.randomUUID(),expiresAt:Date.now()+1800000};quotes.set(quote.id,trip);
    return {quote,route:{source:'Google Routes',trafficAware:false,distanceKm:km,durationSeconds:leg.durationSeconds+(round?7600:0),returnIncluded:round,outbound:leg,inbound:round?{distanceKm:64,durationSeconds:7600}:null,options:{outbound,inbound:[]},selection},vehicles};
  }
  window.fetch=async(input,options={})=>{
    const url=new URL(input,location.href);
    if(!url.pathname.startsWith('/api/trips/'))return originalFetch(input,options);
    if(url.pathname.endsWith('/config'))return json({ready:true,aiReady:false,provider:'Google Maps',tripTypes:['local'],packages:[{id:'5h50',hours:5,km:50},{id:'10h100',hours:10,km:100}]});
    if(url.pathname.endsWith('/search'))return json([{label:`QA fixture ${url.searchParams.get('q')}`,placeId:url.searchParams.get('q').includes('pickup')?'QA_pickup':'QA_destination'}]);
    if(url.pathname.endsWith('/place')){const p=JSON.parse(options.body);return json({label:p.placeId==='QA_pickup'?'QA fixture pickup':'QA fixture destination',placeId:p.placeId,placeToken:'QA_ONLY',coordinates:p.placeId==='QA_pickup'?[80.27,13.08]:[80.16,12.99]});}
    if(url.pathname.endsWith('/estimate')||url.pathname.endsWith('/route-choice')){
      window.rkrQA.calls++;await new Promise(resolve=>setTimeout(resolve,window.rkrQA.delay));
      if(window.rkrQA.fail)return new Response(JSON.stringify({error:{message:'QA fixture: route provider unavailable.'}}),{status:503,headers:{'Content-Type':'application/json'}});
      const body=JSON.parse(options.body);return json(await estimate(url,body.quote_id?quotes.get(body.quote_id):body,body.quote_id?{outboundIndex:body.outboundIndex,returnIndex:body.returnIndex}:undefined));
    }
    if(url.pathname.endsWith('/analysis'))return json({mode:'factual',message:'QA fixture: AI unavailable; verified route facts are still available.',paragraphs:['QA FIXTURE — not live Google or Gemini data.','Tolls, parking, driver allowance and taxes need confirmation.','Passenger capacity and availability must be confirmed by the team.'],recommendedVehicleId:null});
    return originalFetch(input,options);
  };
})();
