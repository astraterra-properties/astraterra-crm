# Astraterra CRM - Quick Start Guide

**Status:** Day 2 Complete (~70%)  
**Last Updated:** February 20, 2026

---

## 🚀 How to Start the CRM

### 1. Start Backend Server

```bash
cd /data/.openclaw/workspace/astraterra-crm/backend
PORT=3001 node server.js
```

**Expected Output:**
```
🔄 Using SQLite database for development
✅ SQLite database connected at: /data/.openclaw/workspace/data/astraterra-crm.db
🚀 Astraterra CRM Backend Server
📍 Server running on port 3001
🔗 http://localhost:3001
```

### 2. Start Frontend (In another terminal)

```bash
cd /data/.openclaw/workspace/astraterra-crm/frontend
npm run dev
```

**Expected Output:**
```
▲ Next.js 15.x.x
- Local: http://localhost:3000
Ready in Xms
```

### 3. Access the CRM

Open browser: **http://localhost:3000**

**Login Credentials:**

**Option 1 - Joseph's Account:**
- Email: `joseph@astraterra.ae`
- Password: `joseph123`

**Option 2 - Admin Account:**
- Email: `admin@astraterra.ae`
- Password: `admin123`

---

## 📁 What's Available Now

### ✅ Working Pages:
1. **Login** - http://localhost:3000/login
2. **Dashboard** - http://localhost:3000/dashboard
3. **Leads** - http://localhost:3000/leads

### ⏳ Coming Soon:
4. Contacts
5. Properties
6. Deals
7. Viewings
8. Tasks

---

## 📊 Database Info

**Type:** SQLite (development)  
**Location:** `/data/.openclaw/workspace/data/astraterra-crm.db`  
**Data:** 737 real clients imported from Google Sheets

**To view database:**
```bash
sqlite3 /data/.openclaw/workspace/data/astraterra-crm.db

# View clients
SELECT COUNT(*) FROM contacts;

# View recent clients
SELECT name, phone, email FROM contacts LIMIT 10;
```

---

## 🛠️ Common Tasks

### Check if Backend is Running
```bash
curl http://localhost:3001/api/health
```

### View Backend Logs
```bash
tail -f /tmp/crm-backend.log
```

### Re-import Google Sheets Data
```bash
cd /data/.openclaw/workspace/astraterra-crm
node scripts/import-google-sheets-clients.js
```

### Reset Database (⚠️ Deletes all data!)
```bash
rm /data/.openclaw/workspace/data/astraterra-crm.db
node scripts/init-sqlite.js
```

---

## 📋 API Endpoints

**Base URL:** `http://localhost:3001/api`

### Authentication
- `POST /auth/login` - Login
- `POST /auth/register` - Register new user
- `GET /auth/me` - Get current user

### Leads
- `GET /leads` - Get all leads
- `GET /leads/:id` - Get single lead
- `POST /leads` - Create lead
- `PUT /leads/:id` - Update lead
- `DELETE /leads/:id` - Delete lead

### Contacts
- `GET /contacts` - Get all contacts
- `POST /contacts` - Create contact
- `PUT /contacts/:id` - Update contact
- `DELETE /contacts/:id` - Delete contact

### Properties
- `GET /properties` - Get all properties
- `POST /properties` - Create property
- `PUT /properties/:id` - Update property
- `DELETE /properties/:id` - Delete property

### Deals
- `GET /deals` - Get all deals
- `GET /deals/stats` - Deal statistics
- `POST /deals` - Create deal
- `PUT /deals/:id` - Update deal

### Viewings
- `GET /viewings` - Get all viewings
- `GET /viewings/upcoming` - Upcoming viewings
- `POST /viewings` - Schedule viewing
- `PUT /viewings/:id` - Update viewing

### Tasks
- `GET /tasks` - Get all tasks
- `GET /tasks/my-tasks` - My tasks
- `POST /tasks` - Create task
- `PUT /tasks/:id` - Update task
- `POST /tasks/:id/complete` - Mark complete

### Dashboard
- `GET /dashboard/stats` - Dashboard statistics
- `GET /dashboard/activity` - Recent activity
- `GET /dashboard/recent-leads` - Recent leads

### Reports
- `GET /reports/sales` - Sales report
- `GET /reports/pipeline` - Pipeline report
- `GET /reports/agents` - Agent performance
- `GET /reports/properties` - Property stats

---

## 🐛 Troubleshooting

### Backend won't start
**Error:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Kill existing process
pkill -f "node server.js"

# Try again
cd /data/.openclaw/workspace/astraterra-crm/backend
PORT=3001 node server.js
```

### Can't login
**Error:** `Invalid credentials`

**Solution:**
```bash
# Reset admin password
sqlite3 /data/.openclaw/workspace/data/astraterra-crm.db
UPDATE users SET password_hash = '$2b$10$...' WHERE email = 'admin@astraterra.ae';

# Or re-initialize database
node scripts/init-sqlite.js
```

### Frontend won't connect to backend
**Error:** `Failed to fetch`

**Solution:**
- Check backend is running on port 3001
- Check browser console for CORS errors
- Verify token in localStorage

---

## 📝 Development Notes

### Adding a New Page

1. Create page file:
```bash
mkdir frontend/app/your-page
touch frontend/app/your-page/page.tsx
```

2. Copy from existing page (e.g., leads):
```bash
cp frontend/app/leads/page.tsx frontend/app/your-page/page.tsx
```

3. Modify for your data:
- Change API endpoint
- Update interface types
- Adjust form fields
- Update table columns

### Adding a New API Route

1. Create route file:
```bash
touch backend/routes/your-route.js
```

2. Copy from existing route:
```bash
cp backend/routes/leads.js backend/routes/your-route.js
```

3. Register in server.js:
```javascript
const yourRoute = require('./routes/your-route');
app.use('/api/your-route', yourRoute);
```

---

## 🎯 Next Steps

**Priority 1 - Contacts Page:**
- Copy `frontend/app/leads/page.tsx`
- Rename to `frontend/app/contacts/page.tsx`
- Change API endpoint to `/api/contacts`
- Adjust fields for contacts schema
- Test CRUD operations

**Priority 2 - Properties Page:**
- Similar to contacts
- Use `/api/properties` endpoint
- Add property-specific fields

**Priority 3 - Navigation:**
- Create sidebar component
- Add to layout.tsx
- Link all pages

**Priority 4 - Testing:**
- Test all API endpoints
- Test frontend flows
- Fix bugs

**Priority 5 - Deployment:**
- Setup PostgreSQL
- Deploy backend
- Deploy frontend
- Configure domain

---

## 📞 Support

**Project Owner:** Joseph Dib Toubia  
**Phone:** +971585580053  
**Email:** joseph@astraterra.ae

**Project Location:** `/data/.openclaw/workspace/astraterra-crm/`

**Documentation:**
- BUILD-LOG.md - Full development history
- PROJECT-PLAN.md - Original project plan
- DAY-2-SUMMARY.md - Day 2 completion report
- QUICKSTART.md - This file

---

**Last Updated:** 2026-02-20 12:45 UTC  
**Version:** Day 2 (70% Complete)
