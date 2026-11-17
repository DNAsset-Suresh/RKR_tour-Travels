# RKR TOUR — Luxury Travel & Cab Booking Platform

A modern, high-performance travel and cab booking platform with a cinematic dark theme, 3D CSS perspective effects, interactive fare calculator with real-time OpenStreetMap road routing, and dual database support (MongoDB Atlas + PostgreSQL).

---

## 🌟 Key Features

1. **Cinematic Opening Experience**:
   - Full-screen entrance animation featuring a white Tempo Traveller arriving from the darkness.
   - Branded RKR TOUR logo decal on the van's side panel with an animated light-sweep shine and subtle gold glow.
   - Reduced-motion accessibility still-frame support and instant Skip button.

2. **Glassmorphism Navigation**:
   - Sticky header with brand logo linked to `#home`.
   - Scroll-spy active section highlighting.
   - Fluid responsive mobile navigation drawer.

3. **3D Interactive Fare Calculator**:
   - 3D glass cards with interactive mouse tilt.
   - 3D route path visualization with animated vehicle traversal.
   - Debounced (300ms) live typeahead suggestions for Pickup, Destination, and Waypoints.
   - "📍 My Location" one-touch browser Geolocation with reverse geocoding.
   - 3D lift/glow vehicle cards with animated count-up total fare.

4. **3D Flip Card Booking & Contact**:
   - 3D flip card: Booking form on the front face, Contact form on the back face.
   - Real-time updating "Travel Ticket" Boarding Pass summary.
   - 3D "CONFIRMED" ticket printed stamp animation on booking success.

5. **Multi-Column 3D Layered Footer**:
   - Brand logo with tagline: *"Extraordinary roads. Shared memories."*
   - Direct access to Fleet, Fare Calculator, Contact (Phone, WhatsApp, Email, Office Address), and Social links.

6. **Fleet Showcase**:
   - 14 vehicles with owner-supplied videos and poster fallbacks.
   - Full package tariffs and excess hour/km rates in Indian Rupees.

7. **Dual Database Architecture**:
   - **MongoDB Atlas** (Mongoose) with serverless connection pooling for Vercel.
   - **PostgreSQL 18** for standalone local development.

---

## 🚀 Local Development Setup

### Option 1: Automatic Single-Command Startup
Run the unified PowerShell startup script:
```powershell
powershell -ExecutionPolicy Bypass -File .\start-website.ps1
```
This automatically starts PostgreSQL (port 55432), the Backend API (port 5000), and the Frontend server (port 3001).

### Option 2: Manual Startup (Separate Terminals)

#### Terminal 1 — Database (PostgreSQL)
```powershell
& "D:\Survey_Checklist\dnassets-verify\.runtime\pgsql\bin\postgres.exe" -D ".\.local\pgdata"
```

#### Terminal 2 — Backend Express API
```powershell
cd backend
$env:ELECTRON_RUN_AS_NODE = "1"
& "C:\Users\DELL\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe" server.js
```

#### Terminal 3 — Frontend Dev Server
```powershell
cd frontend
$env:ELECTRON_RUN_AS_NODE = "1"
$env:FRONTEND_PORT = "3001"
& "C:\Users\DELL\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe" dev-server.js
```

Open your browser at **[http://localhost:3001](http://localhost:3001)**.

---

## 🍃 MongoDB Atlas Configuration

1. In `.env.local` (kept private and git-ignored), add your MongoDB Atlas connection string:
   ```dotenv
   MONGODB_URI=mongodb+srv://<db_user>:<db_password>@rkr.ei9mzh3.mongodb.net/travels?retryWrites=true&w=majority
   ```
2. Seed the fleet and tariffs into MongoDB:
   ```bash
   node backend/scripts/seed-mongo.js
   ```

---

## ☁️ Vercel Deployment

1. The project includes `vercel.json` configured for a monorepo setup:
   - `/api/*` &rarr; Serverless Express function (`api/index.js`)
   - `/*` &rarr; Static frontend (`frontend/*`)
2. Configure environment variables in Vercel Dashboard:
   - `MONGODB_URI`: Your MongoDB Atlas connection URI
   - `ADMIN_API_KEY`: Secret key for administrative endpoints
   - `BUSINESS_PHONE`: `9629426655`
   - `BUSINESS_WHATSAPP`: `9629426655`
   - `BUSINESS_EMAIL`: `rkr.enterprices@gmail.com`
   - `BUSINESS_ADDRESS`: `23/2 Madipakkam Main Road, Kaiveli, Pallikaranai, Chennai - 600100`

---

## 🔒 Security & Data Hygiene
- All `.env*` files (except `.env.example`), `.local/`, and `node_modules/` are strictly ignored by `.gitignore`.
- CSRF, CORS, Helmet, and Rate-Limiting are configured on all public API endpoints.
