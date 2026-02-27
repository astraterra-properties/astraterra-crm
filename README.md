# Astraterra CRM

Internal CRM platform for Astraterra Properties — managing leads, properties, pipeline, email marketing, and operations.

## 🌐 Live URL
**https://crm.astraterra.ae**

## 🏗️ Architecture

| Layer | Stack | Hosting |
|-------|-------|---------|
| Frontend | Next.js 14 (App Router) | Vercel |
| Backend | Node.js + Express | Railway |
| Database | SQLite (dev) / PostgreSQL (prod) | Railway |

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- npm

### Backend
```bash
cd backend
cp .env.example .env
# Fill in your values in .env
npm install
npm start
# Runs on http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
# Set NEXT_PUBLIC_API_URL in .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
npm run dev
# Runs on http://localhost:3000
```

## 🔑 Default Login
- **Email:** joseph@astraterra.ae
- **Password:** joseph123
> ⚠️ Change the password after first login via Profile Settings

## 📁 Key Features
- Dashboard with live KPIs
- Lead management (Kanban pipeline)
- Property listings + owner management
- Client database with matching engine
- Email marketing (Brevo integration)
- Social media management
- Team management
- 30 Dubai communities + 15 developers database

## 🔧 Environment Variables
See `backend/.env.example` for all required variables.

## 📞 Support
Contact: admin@astraterra.ae
