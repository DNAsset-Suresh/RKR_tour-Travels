import './config/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pool } from './config/database.js';
import { bookingRoutes } from './routes/bookingRoutes.js';
import { vehicleRoutes } from './routes/vehicleRoutes.js';
import { contactRoutes } from './routes/contactRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { tripRoutes } from './routes/tripRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const candidateStaticDirs = [
  path.resolve(__dirname, '../public'),
  path.resolve(__dirname, '../frontend')
];
const staticDir = candidateStaticDirs.find(dir => fs.existsSync(path.join(dir, 'index.html'))) || null;

export const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3001,http://localhost:3002').split(',').map(v => v.trim());
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !origins.includes(origin) && !origin.endsWith('.vercel.app')) {
    return res.status(403).json({ error: { message: 'This website origin is not allowed.' } });
  }
  next();
});
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '16kb' }));

// Serve static assets when available locally or bundled
if (staticDir) {
  app.use(express.static(staticDir, { extensions: ['html'] }));
}

app.use('/api', rateLimit({ windowMs: 15*60*1000, limit: 300, standardHeaders:'draft-8', legacyHeaders:false, message:{error:{message:'Too many requests. Please wait a few minutes.'}} }));
const submissions=rateLimit({ windowMs:15*60*1000, limit:20, skip:req=>req.method!=='POST', standardHeaders:'draft-8', legacyHeaders:false, message:{error:{message:'Too many submissions. Please try again in 15 minutes.'}} });
app.get('/api', (req, res) => {
  res.json({
    status: 'online',
    service: 'RKR TOUR API',
    message: 'Backend API is running.'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    if (process.env.MONGODB_URI) {
      const { connectMongo } = await import('./config/mongodb.js');
      await connectMongo();
      return res.json({ status: 'ok', database: 'connected', engine: 'mongodb' });
    }
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', engine: 'postgresql' });
  } catch (err) {
    console.error('Health check failed:', err?.message || err);
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});
app.get('/api/config', (req,res) => {
  const phone=v=>/^\+[1-9]\d{6,14}$/.test(v || '')?v:null;
  const social=v=>{try {const u=new URL(v); return u.protocol==='https:'?u.href:null;}catch{return null;}};
  res.json({data:{phone:phone(process.env.BUSINESS_PHONE),whatsapp:phone(process.env.BUSINESS_WHATSAPP),email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.BUSINESS_EMAIL || '')?process.env.BUSINESS_EMAIL:null,address:process.env.BUSINESS_ADDRESS || null,instagram:social(process.env.BUSINESS_INSTAGRAM),facebook:social(process.env.BUSINESS_FACEBOOK)}});
});
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/bookings', submissions, bookingRoutes);
app.use('/api/contact', submissions, contactRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: { message: 'API endpoint not found.' } }));
app.use((req, res) => {
  if (staticDir) {
    return res.sendFile(path.join(staticDir, 'index.html'));
  }
  res.json({
    status: 'online',
    service: 'RKR TOUR API',
    message: 'API is running. Set Vercel Root Directory to repository root to serve the website UI.'
  });
});
app.use(errorHandler);

export default app;
