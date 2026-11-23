import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  formatIST,
  getOwnerEmails,
  buildUserConfirmationTemplate,
  buildOwnerNotificationTemplate,
  getTransporter,
  sendContactEmails
} from '../services/emailService.js';
import { contactSchema } from '../middleware/validateRequest.js';

test('EmailService - escapeHtml escapes dangerous characters', () => {
  const dirty = '<script>alert("xss")</script> & \'quotes\'';
  const clean = escapeHtml(dirty);
  assert.equal(clean.includes('<script>'), false);
  assert.equal(clean.includes('&lt;script&gt;'), true);
  assert.equal(clean.includes('&quot;'), true);
  assert.equal(clean.includes('&#039;'), true);
  assert.equal(clean.includes('&amp;'), true);
});

test('EmailService - formatIST generates valid Indian Standard Time timestamp', () => {
  const ist = formatIST(new Date('2026-11-19T10:00:00Z'));
  assert.ok(typeof ist === 'string');
  assert.ok(ist.length > 5);
});

test('EmailService - getOwnerEmails extracts configured owners and deduplicates', () => {
  const owners = getOwnerEmails();
  assert.ok(Array.isArray(owners));
  assert.ok(owners.length >= 1);
  assert.ok(owners.includes('travel.rkr@gmail.com'));
});

test('EmailService - buildUserConfirmationTemplate outputs sanitized HTML and text', () => {
  const data = {
    customer_name: 'Dr. Ramesh Kumar <test>',
    mobile_number: '+91 98765 43210',
    email: 'ramesh@example.com',
    subject: 'Innova Hycross 3-Day Ooty Tour',
    message: 'Hello, looking for luxury chauffeur service & pricing.<img src=x onerror=alert(1)>'
  };

  const template = buildUserConfirmationTemplate(data);
  assert.ok(template.subject.includes('Thank You for Contacting RKR TOUR & TRAVELS'));
  assert.ok(template.html.includes('Dr. Ramesh Kumar &lt;test&gt;'));
  assert.ok(!template.html.includes('<img src=x'));
  assert.ok(template.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(template.html.includes('+91 98765 43210'));
  assert.ok(template.text.includes('Dr. Ramesh Kumar <test>'));
  assert.ok(template.text.includes('+91 98765 43210'));
});

test('EmailService - buildOwnerNotificationTemplate contains replyTo guidance and all details', () => {
  const data = {
    customer_name: 'Priya Sharma',
    mobile_number: '9840123456',
    email: 'priya@example.com',
    subject: 'Corporate Airport Transfer',
    message: 'We need 3 luxury sedans for our executives arriving at Chennai Airport.'
  };

  const template = buildOwnerNotificationTemplate(data);
  assert.ok(template.subject.includes('New Website Enquiry - Priya Sharma'));
  assert.ok(template.html.includes('Priya Sharma'));
  assert.ok(template.html.includes('priya@example.com'));
  assert.ok(template.html.includes('Corporate Airport Transfer'));
  assert.ok(template.text.includes('priya@example.com'));
  assert.ok(template.text.includes('9840123456'));
});

test('Scenario 2 - Invalid email rejection in contactSchema', () => {
  const invalidPayloads = [
    { customer_name: 'John Doe', mobile_number: '9876543210', email: 'not-an-email', subject: 'Inquiry', message: 'Valid message for testing.' },
    { customer_name: 'John Doe', mobile_number: '9876543210', email: 'john@', subject: 'Inquiry', message: 'Valid message for testing.' },
    { customer_name: 'John Doe', mobile_number: '9876543210', email: 'john@domain', subject: 'Inquiry', message: 'Valid message for testing.' }
  ];

  for (const payload of invalidPayloads) {
    const result = contactSchema.safeParse(payload);
    assert.equal(result.success, false, `Expected failure for invalid email: ${payload.email}`);
    assert.ok(result.error.issues.some(i => i.path.includes('email')));
  }
});

test('Scenario 3 - Missing required fields rejection in contactSchema', () => {
  // Missing name
  assert.equal(contactSchema.safeParse({ mobile_number: '9876543210', email: 'test@example.com', subject: 'Sub', message: 'Message length at least 10' }).success, false);
  // Missing email
  assert.equal(contactSchema.safeParse({ customer_name: 'Name', mobile_number: '9876543210', subject: 'Sub', message: 'Message length at least 10' }).success, false);
  // Missing mobile
  assert.equal(contactSchema.safeParse({ customer_name: 'Name', email: 'test@example.com', subject: 'Sub', message: 'Message length at least 10' }).success, false);
  // Missing subject
  assert.equal(contactSchema.safeParse({ customer_name: 'Name', mobile_number: '9876543210', email: 'test@example.com', message: 'Message length at least 10' }).success, false);
  // Missing message
  assert.equal(contactSchema.safeParse({ customer_name: 'Name', mobile_number: '9876543210', email: 'test@example.com', subject: 'Sub' }).success, false);
  // Short message (under 10 chars)
  assert.equal(contactSchema.safeParse({ customer_name: 'Name', mobile_number: '9876543210', email: 'test@example.com', subject: 'Sub', message: 'Too short' }).success, false);
});

test('Scenario 1 - Valid payload acceptance in contactSchema', () => {
  const validPayload = {
    customer_name: 'Suresh Kumar',
    mobile_number: '+91 96294 26655',
    email: 'suresh@example.com',
    subject: 'Chennai to Tirupati Innova Booking',
    message: 'Need 1 Innova Crysta for 6 passengers departing Chennai at 5:00 AM.'
  };

  const result = contactSchema.safeParse(validPayload);
  assert.equal(result.success, true);
  assert.equal(result.data.customer_name, 'Suresh Kumar');
  assert.equal(result.data.email, 'suresh@example.com');
});
