# Astraterra CRM — Deployment Guide

## 🚀 Quick Deployment (Recommended)

### Option 1: Railway (Backend) + Vercel (Frontend)

This is the recommended production setup. Free tier available for both.

---

## STEP 1: Deploy Backend to Railway

### 1a. Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

### 1b. Create Railway Project
```bash
cd /data/.openclaw/workspace/astraterra-crm/backend
railway init
# Select "Empty Project"
# Name it: astraterra-crm-backend
```

### 1c. Add PostgreSQL
```bash
railway add --plugin postgresql
```

### 1d. Set Environment Variables
```bash
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=astraterra-crm-super-secret-key-2026-dubai-properties
railway variables set EMAIL_USER=admin@astraterra.ae
railway variables set EMAIL_PASS=ojwbqkeunpcahbza
railway variables set GOOGLE_DRIVE_FOLDER_ID=10LyPHdzLcmP-EBfqtdtNrJN7k0_tXQT8
```

### 1e. Deploy Backend
```bash
railway up
```

### 1f. Get Backend URL
```bash
railway domain
# Note the URL: https://astraterra-crm-backend.up.railway.app
```

---

## STEP 2: Deploy Frontend to Vercel

### 2a. Install Vercel CLI
```bash
npm install -g vercel
vercel login
# Use: admin@astraterra.ae
```

### 2b. Deploy Frontend
```bash
cd /data/.openclaw/workspace/astraterra-crm/frontend
vercel
# Follow the prompts
# When asked for env variables, set:
# NEXT_PUBLIC_API_URL = <your Railway backend URL>
```

### 2c. Set Production Environment Variable
```bash
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://astraterra-crm-backend.up.railway.app
vercel --prod
```

---

## STEP 3: Data Migration (SQLite → PostgreSQL)

After Railway PostgreSQL is ready:

```bash
# Get Railway DATABASE_URL
railway variables get DATABASE_URL

# Run migration script
cd /data/.openclaw/workspace/astraterra-crm
node scripts/migrate-to-postgresql.js
```

---

## Option 2: Local Production (Already Working)

The CRM is already fully functional locally:

```bash
# Start Backend
cd /data/.openclaw/workspace/astraterra-crm/backend
PORT=3001 node server.js &

# Start Frontend (production build)
cd /data/.openclaw/workspace/astraterra-crm/frontend
npm run build
PORT=3000 npm run start &
```

Access at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

---

## Option 3: Docker Deployment

### 3a. Build Docker Images
```bash
cd /data/.openclaw/workspace/astraterra-crm
docker build -t astraterra-backend ./backend
docker build -t astraterra-frontend ./frontend
```

### 3b. Run with Docker Compose
```bash
docker-compose up -d
```

---

## Environment Variables Reference

### Backend (.env)
| Variable | Value | Required |
|----------|-------|----------|
| PORT | 3001 | Yes |
| NODE_ENV | production | Yes |
| JWT_SECRET | (any secure 32+ char string) | Yes |
| DATABASE_URL | postgresql://... | Yes (prod) |
| EMAIL_USER | admin@astraterra.ae | For email |
| EMAIL_PASS | ojwbqkeunpcahbza | For email |
| GOOGLE_DRIVE_FOLDER_ID | 10LyPHdzLcmP-EBfqtdtNrJN7k0_tXQT8 | For Drive |

### Frontend (.env.local or Vercel)
| Variable | Value | Required |
|----------|-------|----------|
| NEXT_PUBLIC_API_URL | https://your-backend.railway.app | Yes |

---

## Login Credentials

```
Email: joseph@astraterra.ae
Password: joseph123
```

---

## Features Included in v1.0

✅ Authentication (JWT)
✅ Dashboard with analytics charts
✅ Leads management (full CRUD)
✅ Contacts management (739 contacts imported)
✅ Properties management (full CRUD)
✅ Deals pipeline (Kanban + list)
✅ Viewings scheduler (calendar view)
✅ Tasks board (Kanban + priorities)
✅ Reports & CSV export
✅ Settings page
✅ Global search (across all entities)
✅ WhatsApp click-to-chat links
✅ Email integration (Gmail SMTP)
✅ Google Drive integration
✅ File uploads (local)
✅ Mobile responsive design

---

## API Endpoints

Backend base URL: http://localhost:3001

| Module | Endpoints |
|--------|-----------|
| Auth | POST /api/auth/login, /api/auth/register |
| Dashboard | GET /api/dashboard/stats |
| Leads | GET/POST/PUT/DELETE /api/leads/:id |
| Contacts | GET/POST/PUT/DELETE /api/contacts/:id |
| Properties | GET/POST/PUT/DELETE /api/properties/:id |
| Deals | GET/POST/PUT/DELETE /api/deals/:id |
| Viewings | GET/POST/PUT/DELETE /api/viewings/:id |
| Tasks | GET/POST/PUT/DELETE /api/tasks/:id |
| Reports | GET /api/reports/* |
| Search | GET /api/search?q=query |
| Email | POST /api/email/send, /send-template |
| Drive | GET /api/drive/files, /folders, /status |
| Upload | POST /api/upload, GET /api/upload/list |

---

## Database

**Development:** SQLite at `/data/astraterra-crm.db`
**Production:** PostgreSQL (Railway provides)

The database has 28 tables including:
- users, leads, contacts, properties, deals
- viewings, tasks, commissions, reports

---

## Support

Business: Astra Terra Properties
Email: admin@astraterra.ae
Phone: +971 4 570 3846
WhatsApp: +971 58 558 0053
Address: Oxford Tower, Office 502, Business Bay, Dubai
