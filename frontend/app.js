'use strict';
const $ = selector => document.querySelector(selector);
const apiBase = window.RKR_CONFIG.apiBaseUrl.replace(/\/$/, '');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let vehicles = [], selectedCategory = 'All', detailVehicle;
const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
async function api(path, options = {}) {
  let response;
  try { response = await fetch(`${apiBase}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(12000) }); }
  catch { throw new Error(options.method === 'POST' ? 'We could not confirm whether your request was saved. Check your connection and try again later; avoid resubmitting repeatedly.' : 'The service is unavailable. Please check your connection and try again.'); }
  let payload; try { payload = await response.json(); } catch { throw new Error('The service returned an unexpected response. Please try again later.'); }
  if (!response.ok) { const error = new Error(payload.error?.message || 'The service is temporarily unavailable. Please try again later.'); error.fields = payload.error?.fields; throw error; }
  return payload;
}
const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }), { threshold: .08 });
if (!reduced.matches) document.documentElement.classList.add('motion');
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
const menu = $('#menu-toggle'), nav = $('#site-nav');
function closeMenu() { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }
menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });
nav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menu.focus(); } });
document.addEventListener('click', e => { if (!e.target.closest('.site-header')) closeMenu(); });
const navObserver = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { nav.querySelectorAll('a').forEach(a => { const current = a.hash === `#${entry.target.id}`; a.classList.toggle('active', current); if (current) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); }); } }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
['home', 'vehicles', 'fare-calculator', 'booking', 'contact'].forEach(id => { const el = document.getElementById(id); if (el) navObserver.observe(el); });
const siteHeader = $('.site-header');
if (siteHeader) {
  const checkHeaderScroll = () => { siteHeader.classList.toggle('scrolled', window.scrollY > 25); };
  window.addEventListener('scroll', checkHeaderScroll, { passive: true });
  checkHeaderScroll();
}
const rig = $('#vehicle-rig');
if (rig) {
  rig.addEventListener('animationend', e => { if (e.target === rig) rig.style.willChange = 'auto'; });
  $('#replay')?.addEventListener('click', () => { if (reduced.matches) { $('#replay').textContent = 'Reduced motion enabled'; return; } rig.classList.remove('entrance'); void rig.offsetWidth; rig.style.willChange = 'transform'; rig.classList.add('entrance'); });
}
let frame;
const hero = $('.hero');
if (hero) {
  hero.addEventListener('pointermove', e => { if (reduced.matches || e.pointerType !== 'mouse' || frame) return; frame = requestAnimationFrame(() => { const x = (e.clientX / innerWidth - .5) * 8; const land = $('.hero-landscape'); if (land) land.style.transform = `scale(1.05) translateX(${x}px)`; frame = null; }); }, { passive: true });
}
function availability(v) { return v.availability_status === 'unavailable' ? 'Currently unavailable' : v.tariff ? 'Availability to be confirmed' : v.is_sample ? 'Example vehicle · availability unconfirmed' : v.availability_status === 'available' ? 'Accepting requests · reservation subject to confirmation' : 'Availability to be confirmed'; }
const formatINR = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const tariffTerms = 'Taxes, tolls, parking and driver allowances are not specified in the supplied tariffs. Please confirm these and vehicle availability with the team.';
function tariffBlock(v, compact = false) {
  const block = node('div', undefined, `tariff-block${compact ? ' tariff-compact' : ''}`);
  if (!v.tariff) { block.append(node('p', 'Rates available on request.', 'tariff-pending')); return block; }
  const heading = node('p', 'TRAVEL PACKAGES · INR', 'tariff-eyebrow');
  const packages = node('dl', undefined, 'tariff-packages');
  for (const [label, amount] of [['5 hours / 50 km', v.tariff.package_5h_50km], ['10 hours / 100 km', v.tariff.package_10h_100km]]) { const item = node('div'); item.append(node('dt', label), node('dd', formatINR(amount))); packages.append(item); }
  const extras = node('dl', undefined, 'tariff-extras');
  for (const [label, amount, unit] of [['Extra hour', v.tariff.extra_hour, '/ hour'], ['Extra kilometre', v.tariff.extra_km, '/ km']]) { const item = node('div'); const price = node('dd', formatINR(amount)); price.append(node('span', ` ${unit}`)); item.append(node('dt', label), price); extras.append(item); }
  block.append(heading, packages, extras); return block;
}
function selectVehicle(id) {
  delete $('#booking-form').dataset.quoteId; $('#trip-booking-note')?.remove(); $('#booking-whatsapp')?.remove();
  switchFormTab('booking');
  $('#booking-vehicle').value = String(id); location.hash = 'booking';
  $('#booking').scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
  $('#booking-vehicle').focus({ preventScroll: true });
}
function safeImage(value) { return /^\/assets\/[a-z0-9-]+\.(svg|png|jpg)$/i.test(value) ? value : '/assets/van.svg'; }
function safeVideo(value) { return typeof value === 'string' && /^\/assets\/videos\/[a-z0-9-]+\.mp4$/.test(value) ? value : null; }
const showcase = $('#showcase'), showcaseVideo = $('#showcase-video'), showcaseTabs = $('#showcase-tabs');
let showcasedVehicle, wantsPlayback = true;
showcaseVideo.loop = true;
showcaseVideo.muted = true;
showcaseVideo.defaultMuted = true;
showcaseVideo.playsInline = true;
showcaseVideo.autoplay = true;
showcaseVideo.setAttribute('muted', '');
showcaseVideo.setAttribute('playsinline', '');
showcaseVideo.setAttribute('autoplay', '');
showcaseVideo.setAttribute('loop', '');

function updatePlayback() {
  if (!document.hidden && !showcaseVideo.hidden && (showcaseVideo.currentSrc || showcaseVideo.getAttribute('src'))) {
    showcaseVideo.muted = true;
    showcaseVideo.defaultMuted = true;
    showcaseVideo.volume = 0;
    const p = showcaseVideo.play();
    if (p !== undefined) {
      p.catch(() => {
        const onReady = () => { showcaseVideo.play().catch(() => { }); showcaseVideo.removeEventListener('canplay', onReady); };
        showcaseVideo.addEventListener('canplay', onReady);
      });
    }
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) updatePlayback(); });
document.addEventListener('rkr:intro-closed', updatePlayback);
showcaseVideo.addEventListener('loadeddata', () => { $('#showcase-media-status').textContent = ''; updatePlayback(); });
showcaseVideo.addEventListener('canplay', updatePlayback);
showcaseVideo.addEventListener('canplaythrough', updatePlayback);
showcaseVideo.addEventListener('ended', () => { showcaseVideo.currentTime = 0; showcaseVideo.play().catch(() => { }); });
showcaseVideo.addEventListener('timeupdate', () => {
  if (showcaseVideo.duration && showcaseVideo.currentTime >= showcaseVideo.duration - 0.12) {
    showcaseVideo.currentTime = 0;
    if (showcaseVideo.paused) showcaseVideo.play().catch(() => { });
  }
});
['click', 'touchstart', 'scroll', 'pointerdown', 'mousemove'].forEach(ev => {
  window.addEventListener(ev, () => { if (showcaseVideo && showcaseVideo.paused && showcaseVideo.src) showcaseVideo.play().catch(() => { }); }, { passive: true, once: true });
});
showcaseVideo.addEventListener('error', () => { $('#showcase-media-status').textContent = 'This film could not be loaded. You can still explore the details or request this vehicle.'; });
$('#showcase-book').addEventListener('click', () => { if (showcasedVehicle) selectVehicle(showcasedVehicle.id); });
function chooseShowcase(v, focusTab = false) {
  showcasedVehicle = v;
  for (const button of showcaseTabs.children) { const active = Number(button.dataset.id) === v.id; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; if (active && focusTab) { button.focus({ preventScroll: true }); button.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'nearest', inline: 'nearest' }); } }
  $('#showcase-panel').setAttribute('aria-labelledby', `vehicle-tab-${v.id}`);
  $('#showcase-name').textContent = v.name; $('#showcase-category').textContent = v.category;
  $('#showcase-tariff').replaceChildren(tariffBlock(v, true));
  $('#showcase-book').disabled = v.availability_status === 'unavailable';
  const path = safeVideo(v.video_path); showcaseVideo.hidden = !path; $('#showcase-image').hidden = !!path;
  $('#showcase-media-status').textContent = path ? 'Loading vehicle film…' : '';
  $('#showcase-note').textContent = (path ? (v.name === 'Toyota Innova' ? 'Innova Crysta reference film shown for the Innova family.' : 'Supplied reference video.') : (v.image_path.endsWith('.svg') ? 'Category illustration; exact model photograph not supplied.' : (v.name.includes('Traveller') ? 'Supplied Traveller reference photograph; exact configuration requires confirmation.' : 'Supplied vehicle reference photograph; exact configuration requires confirmation.'))) + ' ' + tariffTerms;
  wantsPlayback = true;
  if (path) {
    showcaseVideo.setAttribute('aria-label', `${v.name} reference video`);
    showcaseVideo.loop = true;
    showcaseVideo.muted = true;
    showcaseVideo.defaultMuted = true;
    showcaseVideo.volume = 0;
    showcaseVideo.src = path;
    updatePlayback();
  } else {
    showcaseVideo.removeAttribute('src'); showcaseVideo.load(); $('#showcase-image').src = safeImage(v.image_path); $('#showcase-image').alt = `${v.name} reference image`;
  }
}
function renderShowcase() {
  showcase.hidden = !vehicles.length; showcaseTabs.replaceChildren();
  const matching = vehicles.filter(v => selectedCategory === 'All' || v.category === selectedCategory);
  for (const v of matching) { const button = node('button', v.name); button.type = 'button'; button.id = `vehicle-tab-${v.id}`; button.dataset.id = String(v.id); button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'showcase-panel'); button.addEventListener('click', () => chooseShowcase(v)); showcaseTabs.append(button); }
  if (matching.length) chooseShowcase(matching.find(v => v.id === showcasedVehicle?.id) || matching[0]);
}
showcaseTabs.addEventListener('keydown', e => { const matching = vehicles.filter(v => selectedCategory === 'All' || v.category === selectedCategory); if (!matching.length) return; const index = matching.findIndex(v => v.id === showcasedVehicle?.id); let next; if (e.key === 'ArrowRight') next = (index + 1) % matching.length; else if (e.key === 'ArrowLeft') next = (index - 1 + matching.length) % matching.length; else if (e.key === 'Home') next = 0; else if (e.key === 'End') next = matching.length - 1; else return; e.preventDefault(); chooseShowcase(matching[next], true); });
const mediaObserver = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { const preview = entry.target; preview.src = preview.dataset.src; preview.load(); mediaObserver.unobserve(preview); } }, { rootMargin: '100px' });
function renderVehicles() {
  const grid = $('#vehicle-grid');
  if (!grid) return;
  mediaObserver.disconnect();
  const filtered = vehicles.filter(v => selectedCategory === 'All' || v.category === selectedCategory);
  grid.replaceChildren(); const countEl = $('#vehicle-count'); if (countEl) countEl.textContent = `${filtered.length} vehicle${filtered.length === 1 ? '' : 's'} to explore`;
  for (const v of filtered) {
    const card = node('article', undefined, 'vehicle-card reveal');
    const art = node('div', undefined, 'vehicle-art'); const img = node('img'); img.src = safeImage(v.image_path); img.alt = v.image_path.endsWith('.svg') ? `${v.category} category illustration, not an exact ${v.name} photograph` : 'Supplied Tempo Traveller reference photograph'; img.loading = 'lazy'; img.width = 450; img.height = 240;
    const media = safeVideo(v.video_path);
    if (media) { const preview = node('video'); preview.muted = true; preview.playsInline = true; preview.loop = true; preview.preload = 'metadata'; preview.dataset.src = `${media}#t=0.1`; preview.setAttribute('aria-label', `${v.name} supplied video still`); preview.addEventListener('error', () => preview.replaceWith(img), { once: true }); preview.addEventListener('ended', () => { preview.currentTime = 0; preview.play().catch(() => { }); }); art.append(preview); mediaObserver.observe(preview); card.addEventListener('mouseenter', () => { if (preview.src) { preview.play().catch(() => { }); } }); card.addEventListener('mouseleave', () => { if (preview.src) { preview.pause(); preview.currentTime = 0.1; } }); const watch = node('button', '▶ Watch film', 'card-video-link'); watch.type = 'button'; watch.setAttribute('aria-label', `Watch ${v.name} film`); watch.addEventListener('click', () => { chooseShowcase(v); location.hash = 'showcase'; showcase.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' }); }); art.append(watch); } else art.append(img);
    art.append(node('span', v.category, 'card-category'), node('span', String(vehicles.indexOf(v) + 1).padStart(2, '0'), 'card-number'), node('span', media ? 'SUPPLIED REFERENCE FILM' : v.image_path.endsWith('.svg') ? 'CATEGORY ILLUSTRATION' : 'REFERENCE PHOTOGRAPH', 'card-art-note'));
    const body = node('div', undefined, 'card-body'); const specs = node('div', undefined, 'card-specs'); specs.append(node('span', v.passenger_capacity ? `👤 ${v.passenger_capacity} Passengers` : '👤 Seating: on request'), node('span', v.air_conditioning === null ? '❄ AC: on request' : v.air_conditioning ? '❄ Air Conditioned' : 'Non-AC'));
    const actions = node('div', undefined, 'card-actions'); const details = node('button', 'View Details ↗', 'detail-link'); details.type = 'button'; details.setAttribute('aria-label', `View details for ${v.name}`); details.addEventListener('click', () => showDetails(v));
    const book = node('button', 'Book This Vehicle ↗', 'button secondary'); book.type = 'button'; book.setAttribute('aria-label', `Request ${v.name}`); book.disabled = v.availability_status === 'unavailable'; book.addEventListener('click', () => selectVehicle(v.id)); actions.append(details, book);
    body.append(node('h3', v.name), specs, node('p', v.description), tariffBlock(v), node('span', availability(v), 'availability'), actions); card.append(art, body); grid.append(card); observer.observe(card);
    card.addEventListener('pointermove', e => { if (reduced.matches || e.pointerType !== 'mouse') return; const r = card.getBoundingClientRect(); card.style.transform = `perspective(900px) rotateX(${-(e.clientY - r.top - r.height / 2) / 90}deg) rotateY(${(e.clientX - r.left - r.width / 2) / 70}deg)`; });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  }
}
const dialog = $('#vehicle-dialog');
function showDetails(v) {
  detailVehicle = v; const content = $('#detail-content'); content.replaceChildren(); const img = node('img'); img.src = safeImage(v.image_path); img.alt = v.image_path.endsWith('.svg') ? `${v.category} category illustration` : (v.name.includes('Traveller') ? 'Tempo Traveller reference photograph' : `${v.name} reference photograph`); const h = node('h2', v.name); h.id = 'detail-name'; const dl = node('dl');
  for (const [key, value] of [['Category', v.category], ['Passenger capacity', v.passenger_capacity || 'To be confirmed'], ['Air conditioning', v.air_conditioning === null ? 'To be confirmed' : v.air_conditioning ? 'Yes' : 'No'], ['Luggage', v.luggage_info || 'To be confirmed'], ['Availability', availability(v)]]) dl.append(node('dt', key), node('dd', String(value)));
  content.append(img, node('p', v.tariff ? 'VEHICLE & TARIFF' : v.is_sample ? 'EXAMPLE CATALOGUE' : 'VEHICLE DETAILS', 'eyebrow'), h, node('p', v.description), tariffBlock(v), dl, node('p', tariffTerms), node('p', 'Images are reference material. Exact model, seating and amenities must be confirmed for your trip.'));
  $('#detail-book').disabled = v.availability_status === 'unavailable'; dialog.showModal();
}
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
$('#detail-book').addEventListener('click', () => { dialog.close(); selectVehicle(detailVehicle.id); });
async function loadVehicles() {
  const statusEl = $('#fleet-status'), retryEl = $('#retry-fleet');
  if (statusEl) statusEl.textContent = 'Loading the vehicle collection…'; if (retryEl) retryEl.hidden = true;
  try {
    const result = await api('/vehicles'); vehicles = result.data; renderShowcase(); renderVehicles();
    const select = $('#booking-vehicle'), old = select.value; select.replaceChildren(new Option('Choose your preferred vehicle', ''));
    vehicles.forEach(v => { const option = new Option(`${v.name}${v.availability_status === 'unavailable' ? ' — unavailable' : ''}`, v.id); option.disabled = v.availability_status === 'unavailable'; select.add(option); }); select.disabled = false; if (old) select.value = old;
    if (statusEl) statusEl.textContent = vehicles.length ? '' : 'No vehicles are listed yet. Please send a contact enquiry.';
  } catch (e) { if (statusEl) statusEl.textContent = e.message; if (retryEl) retryEl.hidden = false; $('#booking-vehicle').replaceChildren(new Option('Vehicle service unavailable — retry above', '')); $('#booking-vehicle').disabled = true; }
}
$('#retry-fleet')?.addEventListener('click', loadVehicles);
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { selectedCategory = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); renderVehicles(); renderShowcase(); }));
document.addEventListener('rkr:preview-vehicle', event => { const vehicle = vehicles.find(v => v.id === event.detail?.id); if (!vehicle) return; if (selectedCategory !== 'All' && selectedCategory !== vehicle.category) { selectedCategory = 'All'; document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === 'All'))); renderVehicles(); renderShowcase(); } chooseShowcase(vehicle); });
const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
$('#booking-form [name=journey_date]').min = todayIST();
function clearErrors(form) { form.querySelectorAll('.field-error').forEach(e => e.remove()); form.querySelectorAll('[aria-invalid]').forEach(e => { e.removeAttribute('aria-invalid'); e.removeAttribute('aria-describedby'); }); }
function markFields(form, fields) { for (const [name, message] of Object.entries(fields)) { const input = form.elements.namedItem(name); if (!input) continue; input.setAttribute('aria-invalid', 'true'); const error = node('span', message, 'field-error'); error.id = `${form.id}-${name}-error`; input.setAttribute('aria-describedby', error.id); input.after(error); } form.querySelector('[aria-invalid=true]')?.focus(); }
function validate(form, kind) {
  const errors = {}; for (const input of form.querySelectorAll('input,select,textarea')) { if (!input.checkValidity()) errors[input.name] = input.validity.valueMissing ? 'Please complete this field.' : input.validationMessage; else if (input.required && !input.value.trim()) errors[input.name] = 'Please complete this field.'; }
  const mobile = form.elements.mobile_number.value.trim(); if (!/^\+?[\d ()-]+$/.test(mobile) || !/^\d{7,15}$/.test(mobile.replace(/\D/g, ''))) errors.mobile_number = 'Enter a mobile number with 7–15 digits; include country code if needed.';
  if (kind === 'booking') {
    if (!form.elements.vehicle_id.value) errors.vehicle_id = 'Choose a vehicle. If the list is unavailable, retry loading it above.';
    const date = form.elements.journey_date.value, time = form.elements.pickup_time.value;
    if (date && date < todayIST()) errors.journey_date = 'Choose today or a future date (India time).';
    if (date && time && new Date(`${date}T${time}:00+05:30`) <= new Date()) errors.pickup_time = 'Choose a pickup time in the future (India time).';
  } return errors;
}
for (const kind of ['booking', 'contact']) {
  const form = $(`#${kind}-form`), feedback = $(`#${kind}-feedback`);
  form.addEventListener('submit', async e => {
    e.preventDefault(); clearErrors(form); feedback.className = 'form-feedback'; feedback.textContent = ''; const errors = validate(form, kind);
    if (Object.keys(errors).length) { markFields(form, errors); feedback.classList.add('error'); feedback.textContent = 'Please check the highlighted details before sending.'; return; }
    const data = Object.fromEntries(new FormData(form)); Object.keys(data).forEach(k => data[k] = data[k].trim());
    if (kind === 'booking') { data.vehicle_id = Number(data.vehicle_id); data.passenger_count = Number(data.passenger_count); if (form.dataset.quoteId) data.quote_id = form.dataset.quoteId; }
    const button = form.querySelector('[type=submit]'), label = button.textContent; button.disabled = true; button.textContent = 'Saving your request…'; form.setAttribute('aria-busy', 'true');
    try {
      const result = await api(kind === 'booking' ? '/bookings' : '/contact', { method: 'POST', body: JSON.stringify(data) });
      feedback.classList.add('success');
      feedback.textContent = kind === 'booking' ? `${result.message} Your reference: ${result.data.booking_reference}. Status: pending.` : result.message;
      if (kind === 'booking') {
        const stamp = $('#ticket-stamp');
        if (stamp) {
          stamp.textContent = 'CONFIRMED';
          stamp.classList.add('stamped');
        }
        const ticketCard = $('#travel-ticket-card');
        if (ticketCard && !reduced.matches) {
          ticketCard.animate([
            { transform: 'perspective(800px) translateY(-16px) scale(0.96)' },
            { transform: 'perspective(800px) translateY(0) scale(1)' }
          ], { duration: 600, easing: 'cubic-bezier(.34,1.56,.64,1)' });
        }
      }
      form.reset();
      feedback.tabIndex = -1;
      feedback.focus({ preventScroll: true });
      feedback.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'nearest' });
    }
    catch (error) { feedback.classList.add('error'); feedback.textContent = error.message; if (error.fields) markFields(form, error.fields); }
    finally { button.disabled = false; button.textContent = label; form.removeAttribute('aria-busy'); }
  });
}
async function loadContact() { try { const { data } = await api('/config'); const container = $('#business-details'); if (!container) return; const links = node('div', undefined, 'contact-links'); for (const [text, url] of [['Call us', data.phone ? `tel:${data.phone}` : null], ['WhatsApp', data.whatsapp ? `https://wa.me/${data.whatsapp.replace('+', '')}` : null], ['Email us', data.email ? `mailto:${data.email}` : null], ['Instagram', data.instagram], ['Facebook', data.facebook]]) if (url) { const a = node('a', text); a.href = url; if (url.startsWith('https')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } links.append(a); } if (links.children.length || data.address) { container.replaceChildren(links); if (data.address) container.append(node('p', data.address, 'contact-pending')); } } catch {/* Keep honest, unconfigured contact copy. */ } }
$('#year').textContent = new Date().getFullYear();
loadVehicles(); loadContact();

const bookingForm = $('#booking-form');
if (bookingForm) {
  const updateTicket = () => {
    const pickup = bookingForm.elements.pickup_location?.value.trim() || 'Chennai';
    const dest = bookingForm.elements.destination?.value.trim() || 'Destination';
    const date = bookingForm.elements.journey_date?.value || '--';
    const time = bookingForm.elements.pickup_time?.value || '--';
    const passengers = bookingForm.elements.passenger_count?.value || '1';
    const select = bookingForm.elements.vehicle_id;
    const vehicleText = select?.selectedIndex > 0 ? select.options[select.selectedIndex].text.split('—')[0].trim() : 'Select fleet';
    if ($('#ticket-pickup')) $('#ticket-pickup').textContent = pickup.split(',')[0].slice(0, 16);
    if ($('#ticket-dest')) $('#ticket-dest').textContent = dest.split(',')[0].slice(0, 16);
    if ($('#ticket-date')) $('#ticket-date').textContent = date;
    if ($('#ticket-time')) $('#ticket-time').textContent = time;
    if ($('#ticket-passengers')) $('#ticket-passengers').textContent = passengers;
    if ($('#ticket-vehicle')) $('#ticket-vehicle').textContent = vehicleText;
  };
  bookingForm.addEventListener('input', updateTicket);
  bookingForm.addEventListener('change', updateTicket);
}

function switchFormTab(tabName) {
  const isBooking = tabName === 'booking';
  const tabBooking = $('#tab-booking'), tabContact = $('#tab-contact');
  const inner = $('#flip-card-inner');
  if (tabBooking && tabContact) {
    tabBooking.classList.toggle('active', isBooking);
    tabBooking.setAttribute('aria-selected', String(isBooking));
    tabContact.classList.toggle('active', !isBooking);
    tabContact.setAttribute('aria-selected', String(!isBooking));
  }
  if (inner) {
    inner.classList.toggle('flipped', !isBooking);
  }
  const targetForm = isBooking ? $('#booking-form') : $('#contact-form');
  targetForm?.querySelector('input, textarea')?.focus();
}
$('#tab-booking')?.addEventListener('click', () => switchFormTab('booking'));
$('#tab-contact')?.addEventListener('click', () => switchFormTab('contact'));
window.addEventListener('hashchange', () => {
  if (location.hash === '#contact') { switchFormTab('contact'); $('#booking')?.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' }); }
  else if (location.hash === '#booking') { switchFormTab('booking'); }
});
if (location.hash === '#contact') switchFormTab('contact');


