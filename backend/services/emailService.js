import nodemailer from 'nodemailer';

/**
 * Escapes unsafe characters for safe inclusion in HTML email bodies.
 * Prevents HTML injection from user inputs.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats a Date object or ISO string into IST (Indian Standard Time).
 * @param {Date|string} date
 * @returns {string}
 */
export function formatIST(date = new Date()) {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true
    }).format(d);
  } catch {
    return new Date().toISOString();
  }
}

let transporterInstance = null;

/**
 * Sets or overrides the active transporter (useful for testing or custom transports).
 * @param {import('nodemailer').Transporter|null} transporter
 */
export function setTransporter(transporter) {
  transporterInstance = transporter;
}

/**
 * Creates or retrieves the singleton Nodemailer transporter.
 * Reads configuration strictly from server environment variables.
 * @returns {import('nodemailer').Transporter}
 */
export function getTransporter() {
  if (transporterInstance) {
    return transporterInstance;
  }

  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = (process.env.SMTP_USER || 'travel.rkr@gmail.com').trim();
  // Strip extraneous spaces from Google App Passwords if needed
  const rawPass = (process.env.SMTP_PASSWORD || '').trim();
  const pass = rawPass.includes(' ') && rawPass.length >= 19 ? rawPass.replace(/\s+/g, '') : rawPass;

  const transportConfig = {
    host,
    port,
    secure,
    auth: {
      user,
      pass
    },
    // Pool connections for performance
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    // Require TLS on port 587
    requireTLS: !secure && port === 587,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  };

  transporterInstance = nodemailer.createTransport(transportConfig);
  return transporterInstance;
}

/**
 * Verifies SMTP connection health.
 * Useful during startup or diagnostic checks.
 */
export async function verifySmtpConnection() {
  const transporter = getTransporter();
  try {
    await transporter.verify();
    return { ok: true, message: 'SMTP connection verified successfully.' };
  } catch (error) {
    console.error('[EmailService] SMTP verification failed:', error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * Resolves list of owner email addresses from environment.
 * @returns {string[]}
 */
export function getOwnerEmails() {
  const list = [
    process.env.OWNER_EMAIL_1,
    process.env.OWNER_EMAIL_2
  ]
    .filter(Boolean)
    .map(e => e.trim())
    .filter(e => e.length > 0);

  if (list.length === 0) {
    const fallback = (process.env.SMTP_USER || 'travel.rkr@gmail.com').trim();
    if (fallback) list.push(fallback);
  }

  // Deduplicate
  return Array.from(new Set(list));
}

/**
 * Builds user confirmation email HTML.
 * @param {object} data
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildUserConfirmationTemplate(data) {
  const safeName = escapeHtml(data.customer_name);
  const safeEmail = escapeHtml(data.email);
  const safePhone = escapeHtml(data.mobile_number);
  const safeSubject = escapeHtml(data.subject);
  const safeMessage = escapeHtml(data.message).replace(/\r?\n/g, '<br>');
  const submittedAt = formatIST(data.created_at || new Date());

  const subject = `Thank You for Contacting RKR TOUR & TRAVELS`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin:0; padding:0; background-color:#f4f6fb; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b; line-height:1.6; }
    .wrapper { width:100%; max-width:620px; margin:24px auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 4px 16px rgba(11,19,41,0.06); }
    .header { background:linear-gradient(135deg, #0b1329 0%, #1a2a4f 100%); padding:32px 28px; text-align:center; color:#ffffff; }
    .header h1 { margin:0 0 8px 0; font-size:22px; font-weight:700; letter-spacing:0.5px; color:#ffffff; }
    .header p { margin:0; font-size:13px; color:#d4af37; text-transform:uppercase; letter-spacing:1.5px; font-weight:600; }
    .body-content { padding:32px 28px; }
    .greeting { font-size:17px; font-weight:600; color:#0b1329; margin-bottom:12px; }
    .intro { font-size:15px; color:#475569; margin-bottom:24px; }
    .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:20px; margin:24px 0; }
    .card-title { margin:0 0 16px 0; font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#0b1329; font-weight:700; border-bottom:1px solid #e2e8f0; padding-bottom:8px; }
    .field-row { margin-bottom:12px; display:flex; font-size:14px; }
    .field-label { width:130px; font-weight:600; color:#64748b; flex-shrink:0; }
    .field-value { color:#0f172a; word-break:break-word; }
    .message-box { background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; padding:12px 14px; margin-top:6px; color:#334155; font-size:14px; line-height:1.5; }
    .contact-box { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:16px 20px; margin:24px 0; font-size:14px; color:#166534; }
    .contact-box a { color:#15803d; font-weight:600; text-decoration:none; }
    .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:20px 28px; text-align:center; font-size:12px; color:#94a3b8; }
    .footer p { margin:4px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <p>Luxury Chauffeur &amp; Holiday Tours</p>
      <h1>RKR TOUR &amp; TRAVELS</h1>
    </div>
    <div class="body-content">
      <div class="greeting">Hello ${safeName},</div>
      <p class="intro">
        Thank you for contacting <strong>RKR TOUR &amp; TRAVELS</strong>.
        We have successfully received your enquiry. Our travel reservation team in Chennai is reviewing your request and will get back to you shortly.
      </p>

      <div class="card">
        <div class="card-title">Your Submitted Details</div>
        <div class="field-row">
          <div class="field-label">Full Name:</div>
          <div class="field-value">${safeName}</div>
        </div>
        <div class="field-row">
          <div class="field-label">Mobile Number:</div>
          <div class="field-value">${safePhone}</div>
        </div>
        <div class="field-row">
          <div class="field-label">Email:</div>
          <div class="field-value">${safeEmail}</div>
        </div>
        <div class="field-row">
          <div class="field-label">Subject:</div>
          <div class="field-value"><strong>${safeSubject}</strong></div>
        </div>
        <div class="field-row" style="flex-direction:column; margin-top:14px;">
          <div class="field-label" style="width:100%; margin-bottom:6px;">Your Message:</div>
          <div class="message-box">${safeMessage}</div>
        </div>
        <div class="field-row" style="margin-top:14px; font-size:12px; color:#94a3b8;">
          <div class="field-label" style="width:130px;">Submitted At:</div>
          <div class="field-value">${submittedAt} IST</div>
        </div>
      </div>

      <div class="contact-box">
        <strong>Need urgent assistance?</strong><br>
        Call / WhatsApp our Chennai helpline directly at <a href="tel:+919629426655">+91 96294 26655</a> or email us at <a href="mailto:travel.rkr@gmail.com">travel.rkr@gmail.com</a>.
      </div>

      <p style="font-size:14px; color:#64748b; margin-top:24px;">
        Warm regards,<br>
        <strong>Reservations &amp; Customer Support Team</strong><br>
        RKR Tour and Travels Chennai
      </p>
    </div>
    <div class="footer">
      <p><strong>RKR TOUR &amp; TRAVELS</strong> · 23/2 Madipakkam Main Road, Kaiveli, Pallikaranai, Chennai - 600100</p>
      <p>Luxury Sedans, Innova Hycross, Tempo Travellers &amp; Chauffeur Rentals in Chennai &amp; Tamil Nadu</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Hello ${data.customer_name},

Thank you for contacting RKR TOUR & TRAVELS.

We have successfully received your enquiry and our team will review your request and get back to you shortly.

Your submitted details:
------------------------------------------
Name:           ${data.customer_name}
Mobile Number:  ${data.mobile_number}
Email:          ${data.email}
Subject:        ${data.subject}
Message:
${data.message}

Submitted At:   ${submittedAt} IST
------------------------------------------

Need urgent booking or assistance?
Call / WhatsApp us directly: +91 96294 26655
Email: travel.rkr@gmail.com

Regards,
RKR TOUR & TRAVELS
23/2 Madipakkam Main Road, Pallikaranai, Chennai - 600100
https://rkr-tour-travels.vercel.app`;

  return { subject, html, text };
}

/**
 * Builds owner notification email HTML.
 * @param {object} data
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildOwnerNotificationTemplate(data) {
  const safeName = escapeHtml(data.customer_name);
  const safeEmail = escapeHtml(data.email);
  const safePhone = escapeHtml(data.mobile_number);
  const safeSubject = escapeHtml(data.subject);
  const safeMessage = escapeHtml(data.message).replace(/\r?\n/g, '<br>');
  const submittedAt = formatIST(data.created_at || new Date());

  const subject = `New Website Enquiry - ${data.customer_name} - ${data.subject}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
  <style>
    body { margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#0f172a; line-height:1.6; }
    .wrapper { width:100%; max-width:620px; margin:20px auto; background:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #cbd5e1; box-shadow:0 6px 20px rgba(0,0,0,0.08); }
    .badge-bar { background:#0b1329; padding:18px 24px; color:#ffffff; display:flex; justify-content:space-between; align-items:center; }
    .badge-bar h2 { margin:0; font-size:18px; color:#ffffff; }
    .badge { background:#d4af37; color:#0b1329; font-size:11px; font-weight:700; text-transform:uppercase; padding:4px 10px; border-radius:4px; letter-spacing:1px; }
    .content { padding:28px 24px; }
    .notice { background:#fef9c3; border-left:4px solid #ca8a04; padding:12px 16px; margin-bottom:20px; border-radius:4px; font-size:14px; color:#854d0e; }
    .details-table { width:100%; border-collapse:collapse; margin:20px 0; }
    .details-table th, .details-table td { padding:12px 14px; text-align:left; border-bottom:1px solid #e2e8f0; font-size:14px; }
    .details-table th { background:#f8fafc; color:#475569; width:130px; font-weight:600; }
    .details-table td { color:#0f172a; }
    .message-container { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:16px; margin:16px 0; color:#1e293b; font-size:14px; line-height:1.6; }
    .quick-actions { background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:16px 20px; margin:24px 0; font-size:14px; color:#0369a1; }
    .quick-actions a { color:#0284c7; font-weight:600; text-decoration:none; margin-right:16px; }
    .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:16px 24px; text-align:center; font-size:12px; color:#94a3b8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="badge-bar">
      <h2>RKR TOUR · Website Enquiry</h2>
      <span class="badge">Action Required</span>
    </div>
    <div class="content">
      <div class="notice">
        <strong>New Customer Enquiry Received!</strong><br>
        A customer has submitted a message via the website contact form. Please review and respond promptly.
      </div>

      <table class="details-table">
        <tr>
          <th>Customer Name</th>
          <td><strong>${safeName}</strong></td>
        </tr>
        <tr>
          <th>Mobile Number</th>
          <td><a href="tel:${safePhone}" style="color:#0284c7; font-weight:600; text-decoration:none;">${safePhone}</a></td>
        </tr>
        <tr>
          <th>Email Address</th>
          <td><a href="mailto:${safeEmail}" style="color:#0284c7; font-weight:600; text-decoration:none;">${safeEmail}</a></td>
        </tr>
        <tr>
          <th>Subject</th>
          <td><strong>${safeSubject}</strong></td>
        </tr>
        <tr>
          <th>Submitted At</th>
          <td>${submittedAt} IST</td>
        </tr>
      </table>

      <h4 style="margin:20px 0 8px 0; font-size:14px; color:#0b1329; text-transform:uppercase; letter-spacing:0.5px;">Message from Customer:</h4>
      <div class="message-container">
        ${safeMessage}
      </div>

      <div class="quick-actions">
        <strong>Direct Response:</strong><br>
        Click <em>Reply</em> in your email client to write directly to <strong>${safeEmail}</strong>, or call the customer at <a href="tel:${safePhone}">${safePhone}</a>.
      </div>
    </div>
    <div class="footer">
      RKR TOUR &amp; TRAVELS · Automatic Website Notification Engine
    </div>
  </div>
</body>
</html>`;

  const text = `New Website Enquiry - ${data.customer_name}

A new enquiry has been submitted through the RKR TOUR website.

Customer Details:
------------------------------------------
Name:         ${data.customer_name}
Email:        ${data.email}
Phone:        ${data.mobile_number}
Subject:      ${data.subject}

Message:
${data.message}

Submitted At: ${submittedAt} IST
------------------------------------------

Please contact the customer regarding this enquiry. You can reply directly to this email to reach the customer (${data.email}).`;

  return { subject, html, text };
}

/**
 * Builds user booking confirmation email HTML.
 * @param {object} data
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildBookingConfirmationTemplate(data) {
  const safeName = escapeHtml(data.customer_name);
  const safeRef = escapeHtml(data.booking_reference);
  const safeVehicle = escapeHtml(data.vehicle_name || 'Fleet Vehicle');
  const safePickup = escapeHtml(data.pickup_location);
  const safeDest = escapeHtml(data.destination);
  const safeDate = escapeHtml(data.journey_date);
  const safeTime = escapeHtml(data.pickup_time);
  const safePassengers = escapeHtml(String(data.passenger_count || 1));
  const safeTripType = escapeHtml(String(data.trip_type || 'outstation').replace('_', ' ').toUpperCase());
  const safeNotes = escapeHtml(data.additional_requirements || '');
  const submittedAt = formatIST(data.created_at || new Date());

  const subject = `Booking Confirmation - ${safeRef} - RKR TOUR & TRAVELS`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
  <style>
    body { margin:0; padding:0; background-color:#0b1329; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#ffffff; line-height:1.6; }
    .wrapper { width:100%; max-width:620px; margin:24px auto; background:#11192e; border-radius:16px; overflow:hidden; border:1px solid #1e293b; box-shadow:0 12px 36px rgba(0,0,0,0.4); }
    .header { background:linear-gradient(135deg, #0b1329 0%, #1a2a4f 100%); padding:28px 24px; text-align:center; border-bottom:1px solid #1e293b; }
    .header h1 { margin:0 0 6px 0; font-size:22px; font-weight:700; color:#ffffff; letter-spacing:0.5px; }
    .header p { margin:0; font-size:12px; color:#d4af37; text-transform:uppercase; letter-spacing:1.5px; font-weight:600; }
    .ticket-badge-bar { display:flex; justify-content:space-between; align-items:center; background:#162038; padding:12px 24px; border-bottom:1px dashed #2a3859; font-size:12px; }
    .ticket-badge { background:#ff6b4a; color:#ffffff; font-weight:700; font-size:11px; text-transform:uppercase; padding:3px 10px; border-radius:4px; letter-spacing:1px; }
    .ticket-ref { color:#94a3b8; font-family:monospace; font-size:13px; font-weight:600; }
    .body-content { padding:28px 24px; background:#11192e; color:#e2e8f0; }
    .greeting { font-size:18px; font-weight:600; color:#ffffff; margin-bottom:12px; }
    .intro { font-size:14px; color:#cbd5e1; margin-bottom:24px; }
    .route-card { background:#0b1329; border:1px solid #1e293b; border-radius:12px; padding:20px; margin-bottom:24px; }
    .route-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid #1e293b; padding-bottom:12px; }
    .route-station { font-size:16px; font-weight:700; color:#ffffff; }
    .route-arrow { color:#d4af37; font-size:18px; margin:0 10px; }
    .route-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; font-size:13px; }
    .route-item-label { color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px; }
    .route-item-val { color:#ffffff; font-weight:600; font-size:14px; }
    .status-confirmed { display:inline-block; border:2px dashed #ff6b4a; color:#ff6b4a; padding:6px 16px; font-size:14px; font-weight:800; letter-spacing:2px; border-radius:6px; transform:rotate(-2deg); margin:12px 0; }
    .help-box { background:#162038; border:1px solid #2a3859; border-radius:8px; padding:16px; margin:20px 0; font-size:13px; color:#cbd5e1; }
    .help-box a { color:#38bdf8; text-decoration:none; font-weight:600; }
    .footer { background:#080d1a; padding:20px; text-align:center; font-size:11px; color:#64748b; border-top:1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <p>Luxury Chauffeur &amp; Holiday Tours</p>
      <h1>RKR TOUR &amp; TRAVELS</h1>
    </div>
    <div class="ticket-badge-bar">
      <span class="ticket-badge">Boarding Pass</span>
      <span class="ticket-ref">REF: ${safeRef}</span>
    </div>
    <div class="body-content">
      <div class="greeting">Hello ${safeName},</div>
      <p class="intro">
        Thank you for choosing <strong>RKR TOUR &amp; TRAVELS</strong>. We have received your journey request for <strong>${safeVehicle}</strong>.
      </p>

      <div class="route-card">
        <div class="route-header">
          <div>
            <span class="route-station">${safePickup}</span>
            <span class="route-arrow">➔</span>
            <span class="route-station">${safeDest}</span>
          </div>
          <div>
            <span class="status-confirmed">CONFIRMED</span>
          </div>
        </div>
        <div class="route-grid">
          <div>
            <div class="route-item-label">Journey Date</div>
            <div class="route-item-val">${safeDate}</div>
          </div>
          <div>
            <div class="route-item-label">Pickup Time</div>
            <div class="route-item-val">${safeTime} IST</div>
          </div>
          <div>
            <div class="route-item-label">Vehicle Selected</div>
            <div class="route-item-val" style="color:#d4af37;">${safeVehicle}</div>
          </div>
          <div>
            <div class="route-item-label">Passengers</div>
            <div class="route-item-val">${safePassengers}</div>
          </div>
          <div>
            <div class="route-item-label">Trip Type</div>
            <div class="route-item-val">${safeTripType}</div>
          </div>
          <div>
            <div class="route-item-label">Customer Mobile</div>
            <div class="route-item-val">${escapeHtml(data.mobile_number)}</div>
          </div>
        </div>
        ${safeNotes ? `<div style="margin-top:14px; padding-top:10px; border-top:1px solid #1e293b; font-size:12px; color:#94a3b8;"><strong style="color:#cbd5e1;">Requirements:</strong> ${safeNotes}</div>` : ''}
      </div>

      <div class="help-box">
        <strong>Our Team is on it!</strong><br>
        Our fleet operations team in Chennai has received your request and is arranging your chauffeur allocation. We will call you at <strong>${escapeHtml(data.mobile_number)}</strong> with driver details.<br><br>
        Need immediate support or changes? Call us 24/7 at <a href="tel:+919629426655">+91 96294 26655</a>.
      </div>
    </div>
    <div class="footer">
      <p><strong>RKR TOUR &amp; TRAVELS</strong> · 23/2 Madipakkam Main Road, Pallikaranai, Chennai - 600100</p>
      <p>Luxury Chauffeur Service · Innova Hycross · Sedans · Tempo Travellers</p>
    </div>
  </div>
</body>
</html>`;

  const text = `RKR TOUR & TRAVELS - Journey Booking Confirmation

Hello ${data.customer_name},

Thank you for planning your journey with RKR TOUR & TRAVELS.
We have successfully received your booking request.

Booking Reference: ${data.booking_reference}
Status:            CONFIRMED (Operator Allocation in Progress)

Journey Details:
------------------------------------------
Pickup:            ${data.pickup_location}
Destination:       ${data.destination}
Date:              ${data.journey_date}
Pickup Time:       ${data.pickup_time} IST
Vehicle:           ${data.vehicle_name || 'Fleet Vehicle'}
Passengers:        ${data.passenger_count || 1}
Trip Type:         ${data.trip_type || 'outstation'}
Mobile Number:     ${data.mobile_number}
Special Notes:     ${data.additional_requirements || 'None'}
------------------------------------------

Need urgent support or modifications?
Call / WhatsApp us 24/7: +91 96294 26655
Email: travel.rkr@gmail.com

Regards,
RKR TOUR & TRAVELS Chennai`;

  return { subject, html, text };
}

/**
 * Builds owner booking notification email HTML.
 * @param {object} data
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildBookingNotificationTemplate(data) {
  const safeName = escapeHtml(data.customer_name);
  const safeRef = escapeHtml(data.booking_reference);
  const safeVehicle = escapeHtml(data.vehicle_name || 'Vehicle');
  const safePickup = escapeHtml(data.pickup_location);
  const safeDest = escapeHtml(data.destination);
  const safeDate = escapeHtml(data.journey_date);
  const safeTime = escapeHtml(data.pickup_time);
  const safePhone = escapeHtml(data.mobile_number);
  const safeEmail = escapeHtml(data.email || 'Not provided');
  const safePassengers = escapeHtml(String(data.passenger_count || 1));
  const safeTripType = escapeHtml(String(data.trip_type || 'outstation').replace('_', ' ').toUpperCase());
  const safeNotes = escapeHtml(data.additional_requirements || 'None');
  const submittedAt = formatIST(data.created_at || new Date());

  const subject = `🚗 New Booking Request - ${safeVehicle} - ${data.customer_name} (${data.pickup_location} to ${data.destination})`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
  <style>
    body { margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#0f172a; line-height:1.6; }
    .wrapper { width:100%; max-width:640px; margin:20px auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #cbd5e1; box-shadow:0 8px 24px rgba(0,0,0,0.1); }
    .badge-bar { background:#0b1329; padding:20px 24px; color:#ffffff; display:flex; justify-content:space-between; align-items:center; }
    .badge-bar h2 { margin:0; font-size:18px; color:#ffffff; }
    .badge { background:#ff6b4a; color:#ffffff; font-size:12px; font-weight:700; text-transform:uppercase; padding:4px 12px; border-radius:4px; letter-spacing:1px; }
    .content { padding:28px 24px; }
    .alert-box { background:#fef3c7; border-left:4px solid #f59e0b; padding:14px 18px; margin-bottom:24px; border-radius:4px; font-size:14px; color:#92400e; }
    .route-banner { background:#0f172a; color:#ffffff; border-radius:8px; padding:16px 20px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; }
    .route-text { font-size:16px; font-weight:700; color:#38bdf8; }
    .details-table { width:100%; border-collapse:collapse; margin:16px 0; }
    .details-table th, .details-table td { padding:12px 14px; text-align:left; border-bottom:1px solid #e2e8f0; font-size:14px; }
    .details-table th { background:#f8fafc; color:#475569; width:150px; font-weight:600; }
    .details-table td { color:#0f172a; }
    .vehicle-tag { background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:4px; font-weight:700; font-size:13px; }
    .quick-actions { background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:16px 20px; margin:24px 0; font-size:14px; color:#0369a1; }
    .quick-actions a { color:#0284c7; font-weight:700; text-decoration:none; margin-right:16px; font-size:15px; }
    .footer { background:#f8fafc; border-top:1px solid #e2e8f0; padding:16px 24px; text-align:center; font-size:12px; color:#94a3b8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="badge-bar">
      <h2>RKR TOUR · Journey Booking</h2>
      <span class="badge">Action Required</span>
    </div>
    <div class="content">
      <div class="alert-box">
        <strong>⚡ New Journey Booking Request Received!</strong><br>
        A customer has submitted a booking request through the website. Please contact the customer and allocate a vehicle/driver.
      </div>

      <div class="route-banner">
        <div>
          <span style="font-size:12px; color:#94a3b8; text-transform:uppercase;">Journey Route:</span><br>
          <span class="route-text">${safePickup} ➔ ${safeDest}</span>
        </div>
        <div style="text-align:right;">
          <span style="font-size:12px; color:#94a3b8; text-transform:uppercase;">Ref:</span><br>
          <span style="font-family:monospace; font-weight:700; color:#ffffff;">${safeRef}</span>
        </div>
      </div>

      <table class="details-table">
        <tr>
          <th>Customer Name</th>
          <td><strong>${safeName}</strong></td>
        </tr>
        <tr>
          <th>Mobile Phone</th>
          <td><a href="tel:${safePhone}" style="color:#0284c7; font-weight:700; text-decoration:none;">${safePhone}</a></td>
        </tr>
        <tr>
          <th>Email Address</th>
          <td><a href="mailto:${safeEmail}" style="color:#0284c7; text-decoration:none;">${safeEmail}</a></td>
        </tr>
        <tr>
          <th>Vehicle Requested</th>
          <td><span class="vehicle-tag">${safeVehicle}</span></td>
        </tr>
        <tr>
          <th>Pickup Date &amp; Time</th>
          <td><strong>${safeDate}</strong> at <strong>${safeTime} IST</strong></td>
        </tr>
        <tr>
          <th>Passengers</th>
          <td>${safePassengers} passenger(s)</td>
        </tr>
        <tr>
          <th>Trip Type</th>
          <td>${safeTripType}</td>
        </tr>
        <tr>
          <th>Special Notes</th>
          <td>${safeNotes}</td>
        </tr>
        <tr>
          <th>Submitted At</th>
          <td>${submittedAt} IST</td>
        </tr>
      </table>

      <div class="quick-actions">
        <strong>Direct Operator Actions:</strong><br>
        📞 Call Customer: <a href="tel:${safePhone}">${safePhone}</a> &nbsp;|&nbsp;
        💬 WhatsApp: <a href="https://wa.me/${safePhone.replace(/\D/g, '')}" target="_blank">Chat on WhatsApp</a>
        ${data.email ? `<br>✉️ Reply: <a href="mailto:${safeEmail}">Email ${safeName}</a>` : ''}
      </div>
    </div>
    <div class="footer">
      RKR TOUR &amp; TRAVELS · Automatic Booking Notification Engine
    </div>
  </div>
</body>
</html>`;

  const text = `New Journey Booking - ${data.customer_name}

Reference:   ${data.booking_reference}
Vehicle:     ${data.vehicle_name || 'Vehicle'}
Route:       ${data.pickup_location} -> ${data.destination}
Date & Time: ${data.journey_date} at ${data.pickup_time} IST

Customer Details:
------------------------------------------
Name:        ${data.customer_name}
Mobile:      ${data.mobile_number}
Email:       ${data.email || 'Not provided'}
Passengers:  ${data.passenger_count || 1}
Trip Type:   ${data.trip_type || 'outstation'}
Notes:       ${data.additional_requirements || 'None'}
Submitted:   ${submittedAt} IST
------------------------------------------

Call customer immediately to confirm driver and journey: ${data.mobile_number}`;

  return { subject, html, text };
}

/**
 * Sends booking confirmation to customer and notification to owners.
 * @param {object} booking
 * @returns {Promise<{ userMail: any, ownerMail: any }>}
 */
export async function sendBookingEmails(booking) {
  const transporter = getTransporter();
  const smtpUser = (process.env.SMTP_USER || 'travel.rkr@gmail.com').trim();
  const fromAddress = process.env.EMAIL_FROM || `"RKR TOUR & TRAVELS" <${smtpUser}>`;
  const ownerRecipients = getOwnerEmails();

  const results = { userMail: null, ownerMail: null };

  // 1. Prepare Owner Notification
  if (ownerRecipients.length > 0) {
    const ownerTemplate = buildBookingNotificationTemplate(booking);
    const ownerMailOptions = {
      from: fromAddress,
      to: ownerRecipients,
      replyTo: booking.email ? `${booking.customer_name} <${booking.email}>` : undefined,
      subject: ownerTemplate.subject,
      text: ownerTemplate.text,
      html: ownerTemplate.html
    };

    try {
      results.ownerMail = await transporter.sendMail(ownerMailOptions);
      console.log(`[EmailService] Owner booking notification sent to: ${ownerRecipients.join(', ')} (Message ID: ${results.ownerMail.messageId})`);
    } catch (err) {
      console.error('[EmailService] Failed sending owner booking notification:', err.message);
      throw err;
    }
  }

  // 2. Prepare User Confirmation Email (if customer provided an email address)
  if (booking.email && booking.email.trim().length > 0) {
    const userTemplate = buildBookingConfirmationTemplate(booking);
    const userMailOptions = {
      from: fromAddress,
      to: booking.email.trim(),
      replyTo: fromAddress,
      subject: userTemplate.subject,
      text: userTemplate.text,
      html: userTemplate.html
    };

    try {
      results.userMail = await transporter.sendMail(userMailOptions);
      console.log(`[EmailService] Customer booking confirmation sent to: ${booking.email} (Message ID: ${results.userMail.messageId})`);
    } catch (err) {
      console.error(`[EmailService] Failed sending customer booking confirmation to ${booking.email}:`, err.message);
      throw err;
    }
  }

  return results;
}

/**
 * Sends both confirmation email to customer and notification emails to owners.
 * @param {object} enquiry
 * @returns {Promise<{ userMail: any, ownerMail: any }>}
 */
export async function sendContactEmails(enquiry) {
  const transporter = getTransporter();
  const smtpUser = (process.env.SMTP_USER || 'travel.rkr@gmail.com').trim();
  const fromAddress = process.env.EMAIL_FROM || `"RKR TOUR & TRAVELS" <${smtpUser}>`;
  const ownerRecipients = getOwnerEmails();

  const results = { userMail: null, ownerMail: null };

  // 1. Prepare Owner Notification
  if (ownerRecipients.length > 0) {
    const ownerTemplate = buildOwnerNotificationTemplate(enquiry);
    const ownerMailOptions = {
      from: fromAddress,
      to: ownerRecipients,
      replyTo: enquiry.email ? `${enquiry.customer_name} <${enquiry.email}>` : undefined,
      subject: ownerTemplate.subject,
      text: ownerTemplate.text,
      html: ownerTemplate.html
    };

    try {
      results.ownerMail = await transporter.sendMail(ownerMailOptions);
      console.log(`[EmailService] Owner notification sent to: ${ownerRecipients.join(', ')} (Message ID: ${results.ownerMail.messageId})`);
    } catch (err) {
      console.error('[EmailService] Failed sending owner notification:', err.message);
      throw err;
    }
  }

  // 2. Prepare User Confirmation Email (if customer provided an email address)
  if (enquiry.email && enquiry.email.trim().length > 0) {
    const userTemplate = buildUserConfirmationTemplate(enquiry);
    const userMailOptions = {
      from: fromAddress,
      to: enquiry.email.trim(),
      replyTo: fromAddress,
      subject: userTemplate.subject,
      text: userTemplate.text,
      html: userTemplate.html
    };

    try {
      results.userMail = await transporter.sendMail(userMailOptions);
      console.log(`[EmailService] Customer confirmation sent to: ${enquiry.email} (Message ID: ${results.userMail.messageId})`);
    } catch (err) {
      console.error(`[EmailService] Failed sending customer confirmation to ${enquiry.email}:`, err.message);
      // If owner email succeeded but user email failed, we still report error or throw
      throw err;
    }
  }

  return results;
}
