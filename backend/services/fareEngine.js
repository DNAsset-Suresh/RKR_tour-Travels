import { readFile } from 'node:fs/promises';
const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
export async function readPricing() {
  return JSON.parse(await readFile(new URL('../config/vehicle-pricing.json', import.meta.url), 'utf8'));
}
export function calculateFare(vehicle, trip, route, pricing) {
  const unavailable = reason => ({status:'quote_required', total:null, currency:'INR', reason, breakdown:[], assumptions:[], exclusions:[]});
  if (vehicle.availability_status === 'unavailable') return {...unavailable('This vehicle is not accepting requests.'),status:'unavailable'};
  if (vehicle.passenger_capacity && trip.passenger_count > vehicle.passenger_capacity) return {...unavailable('Your group exceeds the confirmed passenger capacity.'),status:'capacity_exceeded'};
  const manual=route.source==='Customer-entered distance';
  if (!valid(route.distanceKm) || route.distanceKm <= 0 || (!manual&&!valid(route.durationSeconds))) return unavailable('A valid trip distance is required.');
  const config = pricing?.vehicles?.[vehicle.name];
  if (!config) return unavailable('Pricing configuration is missing for this vehicle.');
  const breakdown=[], assumptions=[], exclusions=[];
  const add = (label, amount, detail='') => breakdown.push({label,amount:money(amount),detail});
  let rates;
  if (trip.trip_type === 'local') {
    const t = vehicle.tariff;
    const packages = config.localPackages ?? (t ? [
      {id:'5h50',hours:5,km:50,price:t.package_5h_50km,extraHour:t.extra_hour,extraKm:t.extra_km},
      {id:'10h100',hours:10,km:100,price:t.package_10h_100km,extraHour:t.extra_hour,extraKm:t.extra_km}
    ] : []);
    const pack = packages.find(p=>p.id===trip.package_id);
    if (!pack || !['hours','km','price','extraHour','extraKm'].every(k=>valid(pack[k])) || !pack.hours) return unavailable('Approved rates for this rental package are not configured.');
    rates = config.localCharges || {};
    const hours = manual?trip.rental_hours:Math.max(trip.rental_hours, route.durationSeconds / 3600);
    const extraKm = Math.max(0,route.distanceKm-pack.km), extraHours = Math.max(0,hours-pack.hours);
    add(`${pack.hours} hours / ${pack.km} km package`,pack.price);
    add('Extra kilometres',extraKm*pack.extraKm,`${extraKm.toFixed(2)} km × ₹${pack.extraKm}/km`);
    add('Extra hours',extraHours*pack.extraHour,`${extraHours.toFixed(2)} hours × ₹${pack.extraHour}/hour`);
    assumptions.push(manual?'This estimate uses your entered distance and planned rental hours. Road distance and driving time have not been verified. Extra hours and kilometres are prorated; actual usage and final charges require operator confirmation.':'Rental time uses the longer of your planned duration and the routed driving time. Extra hours and kilometres are prorated; final charges require operator confirmation.');
  } else {
    rates = config[trip.trip_type];
    if (!rates || !['baseFare','ratePerKm','minimumFare'].every(k=>valid(rates[k]))) {
      if (vehicle.tariff) {
        rates = {
          baseFare: 0,
          ratePerKm: vehicle.tariff.extra_km,
          minimumFare: vehicle.tariff.package_5h_50km,
          driverAllowancePerDay: 500,
          minimumKmPerDay: trip.trip_type === 'round_trip' ? 150 : 100
        };
      } else {
        return unavailable('Approved rates for this trip type are not configured. Please request a quotation.');
      }
    }
    if (rates.returnRequired && !route.returnIncluded) return unavailable('This vehicle’s outstation tariff requires a return journey. Include the return route to calculate.');
    const minimumKm = valid(rates.minimumKmPerDay) ? rates.minimumKmPerDay*trip.travel_days : 0;
    const billableKm = Math.max(route.distanceKm,minimumKm);
    add('Base fare',rates.baseFare);
    add('Distance charge',billableKm*rates.ratePerKm,`${billableKm.toFixed(2)} billable km × ₹${rates.ratePerKm}/km`);
    if (minimumKm && route.distanceKm < minimumKm) assumptions.push(`Minimum ${rates.minimumKmPerDay} billable km/day × ${trip.travel_days} day(s). Actual road distance is ${route.distanceKm.toFixed(2)} km.`);
    const initial=breakdown.reduce((s,r)=>s+r.amount,0);
    if(initial<rates.minimumFare)add('Minimum fare adjustment',rates.minimumFare-initial);
    if (trip.trip_type === 'round_trip') assumptions.push(`Round trip circuit distance: ${route.distanceKm.toFixed(2)} km. Rate: ₹${rates.ratePerKm}/km.`);
    else assumptions.push(`₹${rates.ratePerKm}/km; minimum fare ₹${rates.minimumFare}.`);
  }
  for(const [key,label,multiplier] of [['driverAllowancePerDay','Driver allowance',trip.travel_days],['tolls','Tolls',1],['parking','Parking',1]]) {
    if(valid(rates[key]))add(label,rates[key]*multiplier);else exclusions.push(label);
  }
  const night=Number(trip.pickup_time.slice(0,2))>=22||Number(trip.pickup_time.slice(0,2))<6;
  if(night){if(valid(rates.nightCharge))add('Night charge',rates.nightCharge);else exclusions.push('Night charges');}
  if(trip.trip_type!=='local'&&trip.waiting_minutes>0){if(valid(rates.waitingPerHour))add('Waiting',trip.waiting_minutes/60*rates.waitingPerHour);else exclusions.push('Waiting charges');}
  let total=money(breakdown.reduce((s,r)=>s+r.amount,0));
  if(valid(rates.taxPercent)){add('Tax',total*rates.taxPercent/100,`${rates.taxPercent}%`);total=money(breakdown.reduce((s,r)=>s+r.amount,0));}else exclusions.push('Taxes');
  return {status:'estimated',currency:'INR',total,breakdown,assumptions,exclusions,pricingVersion:pricing.version,ratePerKm:trip.trip_type==='local'?null:rates.ratePerKm};
}
