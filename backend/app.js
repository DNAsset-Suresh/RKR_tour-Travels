import './config/env.js';
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
export const app = express();
app.disable('x-powered-by');
app.use(helmet());
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
app.use('/api', rateLimit({ windowMs: 15*60*1000, limit: 300, standardHeaders:'draft-8', legacyHeaders:false, message:{error:{message:'Too many requests. Please wait a few minutes.'}} }));
const submissions=rateLimit({ windowMs:15*60*1000, limit:20, skip:req=>req.method!=='POST', standardHeaders:'draft-8', legacyHeaders:false, message:{error:{message:'Too many submissions. Please try again in 15 minutes.'}} });
app.get(['/', '/api'], (req, res) => {
  res.json({
    status: 'online',
    service: 'RKR TOUR API',
    frontendUrl: 'http://localhost:3001',
    message: 'Backend API is running. To open the website, visit http://localhost:3001'
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
  } catch {
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
app.use((req,res)=>res.status(404).json({error:{message:'Endpoint not found.'}}));
app.use(errorHandler);
