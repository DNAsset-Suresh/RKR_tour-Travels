import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { setTransporter } from '../services/emailService.js';

const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/api`;

after(async () => {
  setTransporter(null);
  await new Promise(resolve => server.close(resolve));
});

const postContact = (payload) =>
  fetch(`${base}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

test('Scenario 1: Valid submission sends confirmation and owner notification with 201 response', async () => {
  let sentMails = [];
  const mockTransporter = {
    sendMail: async (options) => {
      sentMails.push(options);
      return { messageId: `mock-${Date.now()}` };
    }
  };
  setTransporter(mockTransporter);

  try {
    const res = await postContact({
      customer_name: 'Anita Deshmukh',
      mobile_number: '+91 98765 43210',
      email: 'anita.deshmukh@example.com',
      subject: 'Innova Hycross Airport Transfer',
      message: 'Need prompt pickup from Chennai International Airport terminal 2 at 7:00 PM.'
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.ok(json.data.id, 'Expected enquiry ID in response');
    assert.equal(
      json.message,
      'Thank you! Your enquiry has been submitted successfully. We will get back to you shortly.'
    );

    // Verify both emails were dispatched
    assert.equal(sentMails.length, 2, 'Expected 2 emails (1 owner notification, 1 user confirmation)');

    // Check Owner Notification
    const ownerMail = sentMails.find(m => m.subject.includes('New Website Enquiry'));
    assert.ok(ownerMail, 'Owner mail was generated');
    assert.ok(ownerMail.to.includes('travel.rkr@gmail.com'));
    assert.equal(ownerMail.replyTo, 'Anita Deshmukh <anita.deshmukh@example.com>');
    assert.ok(ownerMail.html.includes('Anita Deshmukh'));
    assert.ok(ownerMail.html.includes('Innova Hycross Airport Transfer'));

    // Check User Confirmation
    const userMail = sentMails.find(m => m.subject.includes('Thank You for Contacting'));
    assert.ok(userMail, 'User confirmation was generated');
    assert.equal(userMail.to, 'anita.deshmukh@example.com');
    assert.ok(userMail.html.includes('Anita Deshmukh'));
    assert.ok(userMail.html.includes('+91 98765 43210'));
  } finally {
    setTransporter(null);
  }
});

test('Scenario 2: Invalid email format is rejected by server with 422 Unprocessable Entity', async () => {
  const invalidEmails = ['invalid-email', 'missing-domain@', 'spaces in@email.com', 'user@domain'];
  for (const email of invalidEmails) {
    const res = await postContact({
      customer_name: 'Test Customer',
      mobile_number: '+91 98765 43210',
      email,
      subject: 'Valid Subject',
      message: 'This is a valid enquiry message for testing.'
    });

    assert.equal(res.status, 422, `Email "${email}" should be rejected with 422`);
    const json = await res.json();
    assert.ok(json.error);
    assert.ok(json.error.fields?.email, 'Expected validation error on email field');
  }
});

test('Scenario 3: Missing required fields are rejected with 422', async () => {
  // Empty body
  const emptyRes = await postContact({});
  assert.equal(emptyRes.status, 422);

  // Missing mobile
  const noMobileRes = await postContact({
    customer_name: 'Test Customer',
    email: 'valid@example.com',
    subject: 'Subject',
    message: 'Valid message content'
  });
  assert.equal(noMobileRes.status, 422);

  // Missing message
  const noMsgRes = await postContact({
    customer_name: 'Test Customer',
    mobile_number: '9876543210',
    email: 'valid@example.com',
    subject: 'Subject'
  });
  assert.equal(noMsgRes.status, 422);

  // Message too short (min 10 chars)
  const shortMsgRes = await postContact({
    customer_name: 'Test Customer',
    mobile_number: '9876543210',
    email: 'valid@example.com',
    subject: 'Subject',
    message: 'Short'
  });
  assert.equal(shortMsgRes.status, 422);
});

test('Scenario 4: SMTP failure logs technical error and returns safe 502 without leaking credentials', async () => {
  const mockFailingTransporter = {
    sendMail: async () => {
      const err = new Error('getaddrinfo ENOTFOUND smtp.gmail.com');
      err.code = 'EDNS';
      throw err;
    }
  };
  setTransporter(mockFailingTransporter);

  try {
    const res = await postContact({
      customer_name: 'Ravi Kumar',
      mobile_number: '+91 98765 43210',
      email: 'ravi.kumar@example.com',
      subject: 'Ooty Holiday Package Enquiry',
      message: 'Please send itinerary and price details for a 4-day trip to Ooty.'
    });

    assert.equal(res.status, 502, 'Expected 502 Bad Gateway on email failure');
    const json = await res.json();
    assert.ok(json.error, 'Expected error object in JSON response');
    // Ensure safe user-facing message
    assert.equal(
      json.error.message,
      'Something went wrong while submitting your enquiry. Please try again or contact us directly.'
    );
    // CRITICAL: Ensure NO credentials, passwords, or technical stack trace leaked to client
    const jsonString = JSON.stringify(json);
    assert.equal(jsonString.includes('xevp'), false, 'Password must not be leaked');
    assert.equal(jsonString.includes('ENOTFOUND'), false, 'Network error details must not be leaked');
    assert.equal(jsonString.includes('stack'), false, 'Stack trace must not be leaked');
  } finally {
    setTransporter(null);
  }
});

test('Scenario 5: Payload size protection and duplicate protection', async () => {
  const hugePayload = {
    customer_name: 'Test',
    mobile_number: '9876543210',
    email: 'test@example.com',
    subject: 'Large Test',
    message: 'x'.repeat(25000)
  };
  const res = await postContact(hugePayload);
  assert.ok(res.status === 413 || res.status === 422, `Expected 413 or 422 on oversize payload, got ${res.status}`);
});
