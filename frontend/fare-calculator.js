
import { inr, journeyText, whatsappMessage, whatsappUrl } from './booking-service.js?v=open-routing-20261028';
const $ = s => document.querySelector(s), form = $('#trip-form'), base = window.RKR_CONFIG.apiBaseUrl.replace(/\/$/, '');
const el = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
const state = { places: { pickup: null, destination: null, extras: [] }, config: null, fleet: [], estimate: null, selected: null, request: 0, whatsapp: null };
let routeAbort;

async function request(path, { body, signal } = {}) {
  let response; try { response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) }); } catch (e) { if (e.name === 'AbortError') throw e; throw new Error('The journey service could not be reached. Please check your connection and try again.'); }
  let payload; try { payload = await response.json(); } catch { throw new Error('The journey service returned an unreadable response. Please try again.'); }
  if (!response.ok) throw new Error(Object.values(payload.error?.fields || {})[0] || payload.error?.message || 'The journey could not be calculated.'); return payload.data;
}

const status = message => { $('#trip-status').textContent = message; };
function clearBookingEstimate() { delete $('#booking-form').dataset.quoteId; $('#trip-booking-note')?.remove(); $('#booking-whatsapp')?.remove(); }

function invalidate() {
  state.request++; routeAbort?.abort(); state.estimate = null;
  if (!$('#trip-manual-distance').checked) form.elements.distance_km.value = '';
  $('#trip-estimate').hidden = true; $('#trip-route-choices').replaceChildren();
  $('#trip-route-summary').textContent = 'Enter pickup and destination to calculate road distance and vehicle fares.';
  form.removeAttribute('aria-busy'); form.querySelector('[type=submit]').disabled = false;
  clearBookingEstimate(); renderVehicles();
}

function getExtraInputs() { return Array.from(document.querySelectorAll('.extra-dest-input')); }

function tripBody() {
  const values = Object.fromEntries(new FormData(form)), manual = $('#trip-manual-distance').checked;
  const extraInputs = getExtraInputs();
  const extraDestinations = manual
    ? extraInputs.map(i => ({ label: i.value.trim() })).filter(d => d.label)
    : (state.places.extras || []).filter(Boolean);
  return {
    pickup: manual ? { label: $('#trip-pickup').value.trim() } : state.places.pickup,
    destination: manual ? { label: $('#trip-destination').value.trim() } : state.places.destination,
    destinations: extraDestinations,
    ...(manual ? { distance_km: Number(values.distance_km) } : {}),
    journey_date: values.journey_date,
    pickup_time: values.pickup_time,
    passenger_count: Number(values.passenger_count),
    trip_type: values.trip_type,
    package_id: values.package_id,
    rental_hours: Number(values.rental_hours),
    travel_days: values.trip_type === 'local' ? 1 : Number(values.travel_days),
    waiting_minutes: values.trip_type === 'local' ? 0 : Number(values.waiting_minutes),
    return_journey: values.trip_type === 'round_trip' || values.return_journey === 'on'
  };
}

function validTime() { const v = tripBody(); return new Date(`${v.journey_date}T${v.pickup_time}:00+05:30`) > new Date(); }

function update3DRouteLabels() {
  const p = $('#trip-pickup')?.value.trim();
  const d = $('#trip-destination')?.value.trim();
  const startEl = $('#route-start-label');
  const endEl = $('#route-end-label');
  if (startEl) startEl.textContent = p ? p.split(',')[0].slice(0, 18) : 'Pickup';
  if (endEl) endEl.textContent = d ? d.split(',')[0].slice(0, 18) : 'Drop-off';
}

function animateCountUp(element, targetValue, duration = 650) {
  if (!element) return;
  const num = Number(targetValue);
  if (isNaN(num)) { element.textContent = inr(targetValue); return; }
  const start = 0, startTime = performance.now();
  const step = now => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (num - start) * ease);
    element.textContent = inr(current);
    if (progress < 1) requestAnimationFrame(step);
    else element.textContent = inr(num);
  };
  requestAnimationFrame(step);
}

function apply3DTilt(element, maxAngle = 5) {
  if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches || 'ontouchstart' in window) return;
  element.addEventListener('mousemove', e => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const rotateX = ((rect.height / 2 - y) / (rect.height / 2)) * maxAngle;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * maxAngle;
    element.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(6px)`;
  });
  element.addEventListener('mouseleave', () => {
    element.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
  });
}

apply3DTilt($('.trip-panel'));
apply3DTilt($('#trip-estimate'));
apply3DTilt($('.trip-vehicles-panel'));

let debounceTimer;
function setupTypeahead(inputEl, kind, containerEl, onSelect) {
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = inputEl.value.trim();
    if (query.length < 3) {
      if (containerEl) containerEl.hidden = true;
      else $(`#${kind}-suggestions`).hidden = true;
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const data = await request('/trips/places', { body: { query } });
        if (data?.matches) {
          showMatches(kind, data.matches, containerEl, onSelect);
        }
      } catch { }
    }, 300);
  });
}

for (const kind of ['pickup', 'destination']) {
  const inp = $(`#trip-${kind}`);
  inp.addEventListener('input', () => {
    state.places[kind] = null;
    invalidate();
    update3DRouteLabels();
    document.querySelectorAll('.place-matches').forEach(list => list.hidden = true);
    status('');
  });
  setupTypeahead(inp, kind);
}

const useLocBtn = $('#btn-use-location');
if (useLocBtn) {
  useLocBtn.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      status('Geolocation is not supported by your browser.');
      return;
    }
    status('Detecting your location…');
    useLocBtn.disabled = true;
    useLocBtn.textContent = '📍 Locating…';
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
            headers: { 'Accept': 'application/json' }
          });
          const geo = await res.json();
          const label = geo.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          const place = { label, coordinates: [longitude, latitude] };
          try {
            const confirmed = await request('/trips/places', { body: { query: label.split(',')[0] } });
            state.places.pickup = confirmed?.matches?.[0] || place;
          } catch {
            state.places.pickup = place;
          }
          $('#trip-pickup').value = label;
          update3DRouteLabels();
          status('Pickup location set from GPS.');
          checkAllConfirmed();
        } catch {
          status('Could not resolve address. Please type it in.');
        } finally {
          useLocBtn.disabled = false;
          useLocBtn.textContent = '📍 My Location';
        }
      },
      err => {
        useLocBtn.disabled = false;
        useLocBtn.textContent = '📍 My Location';
        if (err.code === 1) status('Location access was denied. Please type your pickup place.');
        else status('Location temporarily unavailable. Please enter it manually.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}

$('#trip-swap').addEventListener('click', () => {
  invalidate();
  $('#trip-swap').classList.toggle('rotated');
  [state.places.pickup, state.places.destination] = [state.places.destination, state.places.pickup];
  document.querySelectorAll('.place-matches').forEach(list => list.hidden = true);
  const text = $('#trip-pickup').value; $('#trip-pickup').value = $('#trip-destination').value; $('#trip-destination').value = text;
  update3DRouteLabels();
});

$('#trip-manual-distance').addEventListener('change', () => {
  invalidate();
  const manual = $('#trip-manual-distance').checked, input = form.elements.distance_km;
  input.disabled = !manual; input.readOnly = !manual; input.required = manual; input.value = '';
  input.placeholder = manual ? 'For example, 65' : 'Calculated after confirming places';
  $('#trip-distance-label').textContent = manual ? 'Estimated trip distance · km' : 'Calculated road distance · km';
  $('#trip-distance-help').textContent = manual ? 'This distance is entered by you and is not verified against a road route.' : 'Driving time excludes live traffic, stops and waiting.';
  document.querySelectorAll('.place-matches').forEach(list => list.hidden = true); status('');
});

function showMatches(kind, places, containerEl, onSelect) {
  const list = containerEl || $(`#${kind}-suggestions`);
  if (!list) return;
  list.replaceChildren(); list.hidden = false;
  list.setAttribute('role', 'listbox');
  list.append(el('p', places.length ? `Confirm your ${kind === 'pickup' ? 'pickup location' : 'destination'}:` : 'No matching place found. Add the city or choose a nearby landmark.'));
  let selectedIndex = -1;
  const buttons = [];
  for (const place of places) {
    const button = el('button', place.label); button.type = 'button';
    button.setAttribute('role', 'option');
    button.addEventListener('click', () => {
      invalidate();
      if (onSelect) {
        onSelect(place);
      } else {
        state.places[kind] = place;
        $(`#trip-${kind}`).value = place.label;
        update3DRouteLabels();
      }
      list.hidden = true;
      checkAllConfirmed();
    });
    buttons.push(button);
    list.append(button);
  }
  const inputEl = containerEl ? containerEl.closest('.location-field')?.querySelector('input') : $(`#trip-${kind}`);
  if (inputEl) {
    const keyHandler = e => {
      if (list.hidden || !buttons.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % buttons.length;
        buttons.forEach((b, i) => b.setAttribute('aria-selected', String(i === selectedIndex)));
        buttons[selectedIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + buttons.length) % buttons.length;
        buttons.forEach((b, i) => b.setAttribute('aria-selected', String(i === selectedIndex)));
        buttons[selectedIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        buttons[selectedIndex].click();
      } else if (e.key === 'Escape') {
        list.hidden = true;
      }
    };
    if (inputEl._kh) inputEl.removeEventListener('keydown', inputEl._kh);
    inputEl._kh = keyHandler;
    inputEl.addEventListener('keydown', keyHandler);
  }
}

function checkAllConfirmed() {
  const extraInputs = getExtraInputs();
  const allExtrasConfirmed = extraInputs.every((_, idx) => Boolean(state.places.extras[idx]));
  if (state.places.pickup && state.places.destination && allExtrasConfirmed) {
    status('All locations confirmed. Calculating…');
    calculate(true);
  } else {
    status('Confirm the other locations below to calculate your route.');
  }
}

// Extra Destinations for Round Trip
const addDestBtn = $('#add-destination-btn'), extraList = $('#extra-destinations-list');

function reindexExtraDestinations() {
  const rows = Array.from(extraList.children);
  const newExtras = [];
  rows.forEach((row, idx) => {
    row.dataset.index = idx;
    row.querySelector('label').textContent = `Destination ${idx + 2}`;
    const input = row.querySelector('.extra-dest-input');
    input.id = `trip-dest-${idx}`;
    const sugg = row.querySelector('.place-matches');
    sugg.id = `dest-suggestions-${idx}`;
    newExtras.push(state.places.extras[idx] || null);
  });
  state.places.extras = newExtras;
}

function updateAddDestButtonVisibility() {
  const isRoundTrip = form.elements.trip_type.value === 'round_trip';
  if (addDestBtn) addDestBtn.hidden = !isRoundTrip;
  if (!isRoundTrip && extraList) {
    extraList.replaceChildren();
    state.places.extras = [];
  }
}

if (addDestBtn) {
  addDestBtn.addEventListener('click', () => {
    const index = extraList.children.length;
    if (index >= 6) { status('You can add up to 6 additional destinations.'); return; }
    state.places.extras.push(null);
    const row = el('div', undefined, 'location-field extra-destination-field');
    row.dataset.index = index;

    const header = el('div', undefined, 'destination-header-row');
    header.append(el('label', `Destination ${index + 2}`));
    const removeBtn = el('button', '✕ Remove', 'remove-dest-btn');
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', () => {
      row.remove();
      reindexExtraDestinations();
      invalidate();
    });
    header.append(removeBtn);

    const inputWrap = el('div', undefined, 'location-input');
    inputWrap.append(el('span', '■'));
    const input = el('input');
    input.id = `trip-dest-${index}`;
    input.className = 'extra-dest-input';
    input.autocomplete = 'off';
    input.placeholder = 'Where to next?';
    input.maxLength = 200;
    input.minLength = 2;
    input.required = true;
    input.addEventListener('input', () => {
      const idx = Array.from(extraList.children).indexOf(row);
      if (idx !== -1) state.places.extras[idx] = null;
      invalidate();
      sugg.hidden = true;
      status('');
    });
    inputWrap.append(input);

    const sugg = el('div', undefined, 'place-matches');
    sugg.id = `dest-suggestions-${index}`;
    sugg.setAttribute('role', 'group');
    sugg.setAttribute('aria-label', `Matching places for destination ${index + 2}`);
    sugg.hidden = true;

    row.append(header, inputWrap, sugg);
    extraList.append(row);
    input.focus();
    invalidate();
  });
}

async function findPlaces() {
  const pickup = $('#trip-pickup').value.trim(), destination = $('#trip-destination').value.trim();
  const extraInputs = getExtraInputs();
  const extraValues = extraInputs.map(i => i.value.trim());

  if (pickup.length < 3 || destination.length < 3 || extraValues.some(v => v.length < 3)) {
    status('Enter at least three characters for each location, including the city where possible.');
    return;
  }
  const allLabels = [pickup, destination, ...extraValues].map(s => s.toLowerCase());
  if (new Set(allLabels).size !== allLabels.length) {
    status('Enter different locations for each stop.');
    return;
  }
  invalidate();
  const id = state.request;
  routeAbort = new AbortController();
  form.setAttribute('aria-busy', 'true');
  form.querySelector('[type=submit]').disabled = true;
  status('Finding matching places…');
  try {
    const body = { pickup, destination };
    if (extraValues.length) body.destinations = extraValues;
    const data = await request('/trips/places', { body, signal: routeAbort.signal });
    if (id !== state.request) return;
    if (!state.places.pickup && data.pickup) showMatches('pickup', data.pickup);
    if (!state.places.destination && data.destination) showMatches('destination', data.destination);
    if (Array.isArray(data.destinations)) {
      data.destinations.forEach((matches, idx) => {
        if (!state.places.extras[idx] && matches) {
          const sugg = $(`#dest-suggestions-${idx}`);
          const input = $(`#trip-dest-${idx}`);
          if (sugg && input) {
            showMatches(`dest-${idx}`, matches, sugg, place => {
              state.places.extras[idx] = place;
              input.value = place.label;
            });
          }
        }
      });
    }
    status('Choose the matching places below. Distance will then be calculated automatically.');
  } catch (e) {
    if (id === state.request && e.name !== 'AbortError') status(e.message);
  } finally {
    if (id === state.request) {
      form.removeAttribute('aria-busy');
      form.querySelector('[type=submit]').disabled = false;
    }
  }
}

form.addEventListener('submit', event => { event.preventDefault(); calculate(true); });

for (const field of form.querySelectorAll('[name]')) field.addEventListener('change', () => {
  invalidate();
  const tripType = form.elements.trip_type.value;
  const local = tripType === 'local';
  $('#trip-local-options').hidden = !local;
  $('#trip-road-options').hidden = local;
  $('#trip-return-option').hidden = tripType !== 'outstation';
  updateAddDestButtonVisibility();
  if (field.name === 'package_id') { const pack = state.config?.packages.find(p => p.id === field.value); if (pack) form.elements.rental_hours.value = pack.hours; }
  status('');
});

for (const field of form.querySelectorAll('input[name]')) field.addEventListener('input', () => invalidate());

async function calculate(manual = false) {
  if (form.getAttribute('aria-busy') === 'true') return;
  if (!form.checkValidity()) { if (manual) form.reportValidity(); return; }
  if (!validTime()) { status('Choose a pickup date and time in the future (India time).'); return; }
  if (!state.config?.ready) { status(state.config?.setupMessage || 'The fare service is unavailable. Please use the booking form for a personal quotation.'); return; }

  const manualDistance = $('#trip-manual-distance').checked;
  const extraInputs = getExtraInputs();
  const allExtrasConfirmed = extraInputs.every((_, idx) => Boolean(state.places.extras[idx]));
  if (!manualDistance && (!state.places.pickup || !state.places.destination || !allExtrasConfirmed)) {
    await findPlaces();
    return;
  }
  const body = tripBody();
  if (body.pickup.label.toLowerCase() === body.destination.label.toLowerCase()) {
    status('Enter different pickup and destination locations.');
    return;
  }
  invalidate();
  const id = state.request;
  routeAbort = new AbortController();
  form.setAttribute('aria-busy', 'true');
  form.querySelector('[type=submit]').disabled = true;
  status(manualDistance ? 'Calculating vehicle fares from your entered distance…' : 'Calculating road distance and vehicle fares…');
  try {
    const data = await request(manualDistance ? '/trips/estimate' : '/trips/road-estimate', { body, signal: routeAbort.signal });
    if (id !== state.request) return;
    state.estimate = { ...data, trip: body };
    if (!manualDistance) form.elements.distance_km.value = data.route.distanceKm.toFixed(2);
    renderVehicles();
    renderRoute();
    const selected = data.vehicles.find(v => v.id === state.selected && !['unavailable', 'capacity_exceeded'].includes(v.fare.status)) || data.vehicles.find(v => !['unavailable', 'capacity_exceeded'].includes(v.fare.status));
    if (selected) selectVehicle(selected.id, false);
    status(manualDistance ? 'Fares calculated from your entered distance. Choose a vehicle to review.' : 'Road distance calculated. Choose a vehicle to review your estimate.');
  } catch (e) {
    if (id === state.request && e.name !== 'AbortError') {
      status(e.message);
      $('#trip-fleet-note').textContent = 'No fare has been estimated. Check your trip details or try again.';
    }
  } finally {
    if (id === state.request) {
      form.removeAttribute('aria-busy');
      form.querySelector('[type=submit]').disabled = false;
    }
  }
}

function renderRoute() {
  const { route, trip } = state.estimate;
  const allDestLabels = [trip.destination.label, ...(trip.destinations || []).map(d => d.label)];
  const isRoundTrip = trip.trip_type === 'round_trip' || trip.return_journey;
  const routeDisplay = isRoundTrip
    ? `${trip.pickup.label} → ${allDestLabels.join(' → ')} → ${trip.pickup.label} (Round trip)`
    : `${trip.pickup.label} → ${allDestLabels.join(' → ')}`;
  $('#trip-route-summary').textContent = `${routeDisplay} · ${journeyText(route)}${trip.rental_hours && trip.trip_type === 'local' ? ` · ${trip.rental_hours} planned rental hours.` : '.'} ${route.source === 'OSRM' ? 'OpenStreetMap / OSRM driving estimate, without live traffic.' : 'Driving time has not been calculated.'}`;
  $('#trip-route-choices').replaceChildren();
}

function renderVehicles() {
  const container = $('#trip-vehicles'); container.replaceChildren(); const fleet = state.estimate?.vehicles || state.fleet;
  if (!fleet.length) { container.append(el('p', 'The fleet is currently unavailable. You can still send a journey request below.', 'trip-empty')); return; }
  for (const vehicle of fleet) {
    const card = el('article', undefined, `trip-vehicle${state.estimate && state.selected === vehicle.id ? ' selected' : ''}`), head = el('div', undefined, 'trip-vehicle-heading'), image = el('img'); image.src = /^\/assets\/[a-z0-9-]+\.(svg|png|jpg)$/i.test(vehicle.image_path) ? vehicle.image_path : '/assets/van.svg'; image.alt = `${vehicle.name} reference`; image.loading = 'lazy';
    const copy = el('div'); copy.append(el('h4', vehicle.name), el('p', vehicle.passenger_capacity ? `Up to ${vehicle.passenger_capacity} passengers` : 'Passenger capacity: confirm with team')); head.append(image, copy); card.append(head);
    if (state.estimate) { card.append(el('p', journeyText(state.estimate.route))); if (vehicle.fare.ratePerKm !== null && vehicle.fare.ratePerKm !== undefined) card.append(el('p', `${inr(vehicle.fare.ratePerKm)}/km`)); }
    if (vehicle.fare) { const details = el('details', undefined, 'trip-card-details'); details.append(el('summary', 'Package & charge details')); for (const row of vehicle.fare.breakdown) details.append(el('p', `${row.label}: ${inr(row.amount)}${row.detail ? ` · ${row.detail}` : ''}`)); if (vehicle.fare.reason) details.append(el('p', vehicle.fare.reason)); details.append(el('p', vehicle.fare.exclusions.length ? `Not included / to confirm: ${vehicle.fare.exclusions.join(', ')}.` : 'Confirm tolls, parking, taxes and any other unconfigured charges with the team.')); card.append(details); }
    const price = el('div', undefined, 'trip-vehicle-price'); price.append(el('strong', !vehicle.fare ? 'Enter trip details' : vehicle.fare.total === null ? 'Quote Required' : inr(vehicle.fare.total))); if (vehicle.fare?.total !== null && vehicle.fare) card.append(el('p', 'Estimated total · subject to confirmation', 'trip-help'));
    const button = el('button', state.selected === vehicle.id && state.estimate ? 'Selected' : 'Select vehicle'); button.type = 'button'; button.disabled = !state.estimate || ['unavailable', 'capacity_exceeded'].includes(vehicle.fare?.status); button.setAttribute('aria-label', `Select ${vehicle.name} for your trip`); button.setAttribute('aria-pressed', String(!!state.estimate && state.selected === vehicle.id)); button.addEventListener('click', () => selectVehicle(vehicle.id, true)); price.append(button); card.append(price); if (['unavailable', 'capacity_exceeded'].includes(vehicle.fare?.status)) card.append(el('p', vehicle.fare.reason)); container.append(card);
  }
}

function selectVehicle(id, syncShowcase) {
  const vehicle = state.estimate?.vehicles.find(v => v.id === id); if (!vehicle) return; state.selected = id; clearBookingEstimate(); renderVehicles(); $('#trip-estimate').hidden = false; $('#trip-estimate-title').textContent = vehicle.name;
  const { trip, route } = state.estimate;
  const allDestLabels = [trip.destination.label, ...(trip.destinations || []).map(d => d.label)];
  const isRoundTrip = trip.trip_type === 'round_trip' || trip.return_journey;
  const routeDisplay = isRoundTrip
    ? `${trip.pickup.label} → ${allDestLabels.join(' → ')} → ${trip.pickup.label} (Round trip)`
    : `${trip.pickup.label} → ${allDestLabels.join(' → ')}`;
  $('#trip-summary-route').textContent = `${routeDisplay} · ${journeyText(route)}${trip.trip_type === 'local' ? ` · ${trip.rental_hours} planned hours` : ''} · ${trip.journey_date}, ${trip.pickup_time} IST`;
  const breakdown = $('#trip-breakdown'); breakdown.replaceChildren(); for (const row of vehicle.fare.breakdown) { const line = el('div'), term = el('dt', row.label); if (row.detail) term.append(el('span', row.detail)); line.append(term, el('dd', inr(row.amount))); breakdown.append(line); }
  if (vehicle.fare.total === null) { $('#trip-total').textContent = 'Quote Required'; } else { animateCountUp($('#trip-total'), vehicle.fare.total); }
  $('#trip-fare-reason').textContent = vehicle.fare.reason || 'This estimate is valid for 30 minutes. Availability and final charges need confirmation.'; $('#trip-assumptions').textContent = vehicle.fare.assumptions.join(' '); $('#trip-exclusions').textContent = vehicle.fare.exclusions.length ? `Not included / to confirm: ${vehicle.fare.exclusions.join(', ')}.` : 'Unconfigured charges are not assumed to be zero. Confirm the final quotation with the team.'; $('#trip-whatsapp').hidden = !state.whatsapp;
  $('#trip-fleet-note').textContent = route.source === 'OSRM' ? 'Estimates use the calculated road distance and rental package. Availability and seating require confirmation.' : 'Estimates use your entered distance and planned hours. Actual usage, availability and seating require confirmation.';
  if (syncShowcase) document.dispatchEvent(new CustomEvent('rkr:preview-vehicle', { detail: { id } }));
}

function prepareBooking(whatsapp = false) {
  const estimate = state.estimate, vehicle = estimate?.vehicles.find(v => v.id === state.selected); if (!vehicle) return;
  if (estimate.quote.expiresAt <= Date.now()) { invalidate(); status('Your estimate expired. Please calculate the fare again.'); return; }
  const booking = $('#booking-form'), trip = estimate.trip; clearBookingEstimate(); $('#tab-booking')?.click();
  const allDestLabels = [trip.destination.label, ...(trip.destinations || []).map(d => d.label)];
  const isRoundTrip = trip.trip_type === 'round_trip' || trip.return_journey;
  const bookingDest = isRoundTrip
    ? `${allDestLabels.join(' → ')} → Return to ${trip.pickup.label} (Round trip)`
    : allDestLabels.join(' → ');
  for (const [key, value] of Object.entries({ pickup_location: trip.pickup.label, destination: bookingDest, journey_date: trip.journey_date, pickup_time: trip.pickup_time, passenger_count: trip.passenger_count, vehicle_id: vehicle.id, trip_type: trip.trip_type })) booking.elements[key].value = String(value);
  booking.dataset.quoteId = estimate.quote.id;
  const note = el('p', `${vehicle.name} · ${journeyText(estimate.route)} · ${vehicle.fare.total === null ? 'Quote Required' : inr(vehicle.fare.total)}. Add your name and mobile number below. This is an unconfirmed estimate.`, 'trip-booking-note');
  note.id = 'trip-booking-note'; booking.querySelector('.form-heading').after(note);
  if (state.whatsapp) {
    const button = el('button', 'Open WhatsApp with this enquiry ↗', 'button secondary'); button.id = 'booking-whatsapp'; button.type = 'button'; button.addEventListener('click', () => {
      if (!booking.reportValidity()) return; const fields = Object.fromEntries(new FormData(booking)); if (!/^\+?[\d ()-]+$/.test(fields.mobile_number) || !/^\d{7,15}$/.test(fields.mobile_number.replace(/\D/g, '')) || fields.customer_name.trim().length < 2) { $('#booking-feedback').textContent = 'Enter your name and a valid mobile number before opening WhatsApp.'; return; }
      if (new Date(`${fields.journey_date}T${fields.pickup_time}:00+05:30`) <= new Date() || estimate.quote.expiresAt <= Date.now()) { $('#booking-feedback').textContent = 'The pickup time or estimate is no longer valid. Please recalculate your journey.'; return; }
      const url = whatsappUrl(state.whatsapp, whatsappMessage(fields, estimate, vehicle)); if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }); booking.querySelector('.submit').after(button);
  }
  location.hash = 'booking'; booking.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); booking.elements.customer_name.focus({ preventScroll: true }); if (whatsapp) $('#booking-feedback').textContent = 'Add your name and mobile number, then use the WhatsApp button to review and send your enquiry.';
}

$('#trip-book').addEventListener('click', () => prepareBooking());
$('#trip-whatsapp').addEventListener('click', () => prepareBooking(true));
$('#booking-form').addEventListener('input', event => { if (['pickup_location', 'destination', 'journey_date', 'pickup_time', 'passenger_count', 'vehicle_id', 'trip_type'].includes(event.target.name)) clearBookingEstimate(); });
$('#booking-form').addEventListener('change', event => { if (['vehicle_id', 'trip_type'].includes(event.target.name)) clearBookingEstimate(); });
$('#booking-form').addEventListener('reset', clearBookingEstimate);

const dateIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
form.elements.journey_date.min = dateIST();
const tomorrow = new Date(Date.now() + 86400000);
form.elements.journey_date.value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(tomorrow);
form.elements.pickup_time.value = '09:00';

const results = await Promise.allSettled([request('/trips/config'), request('/vehicles'), request('/config')]);
if (results[0].status === 'fulfilled') {
  state.config = results[0].value;
  $('#fare-setup').textContent = state.config.setupMessage || '';
  const packages = form.elements.package_id;
  packages.replaceChildren();
  for (const p of state.config.packages) packages.add(new Option(`${p.hours} hours / ${p.km} km`, p.id));
  const types = form.elements.trip_type;
  for (const option of Array.from(types.options)) if (!(state.config.tripTypes || ['local']).includes(option.value)) option.remove();
  updateAddDestButtonVisibility();
} else {
  $('#fare-setup').textContent = 'The journey planner is temporarily unavailable. Existing tariffs and the booking form remain available.';
}
if (results[1].status === 'fulfilled') { state.fleet = results[1].value; renderVehicles(); } else renderVehicles();
if (results[2].status === 'fulfilled') state.whatsapp = results[2].value.whatsapp;
