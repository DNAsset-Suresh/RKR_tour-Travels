import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const user = process.env.SMTP_USER || 'travel.rkr@gmail.com';
const rawPass = process.env.SMTP_PASSWORD || '';
const pass = rawPass.replace(/\s+/g, '');

console.log('Testing SMTP connection with:');
console.log('User:', user);
console.log('Password length:', pass.length);
console.log('Host:', process.env.SMTP_HOST || 'smtp.gmail.com');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user, pass }
});

try {
  console.log('Verifying transporter...');
  await transporter.verify();
  console.log('✅ SMTP transporter verified successfully!');

  console.log('Sending test email to', user, '...');
  const info = await transporter.sendMail({
    from: `"RKR TOUR Test" <${user}>`,
    to: user,
    subject: 'RKR TOUR - Test Enquiry Notification',
    text: 'This is a test notification confirming that Nodemailer is configured correctly for RKR TOUR & TRAVELS.',
    html: '<h3>RKR TOUR & TRAVELS</h3><p>This is a test email confirming that your website email system is active and working.</p>'
  });
  console.log('✅ Email sent successfully! Message ID:', info.messageId);
} catch (err) {
  console.error('❌ SMTP Error:', err);
}
