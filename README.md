# Rozgar Mitra — रोज़गार मित्र

Trust-based, mobile-first job marketplace connecting blue-collar Indian workers
(plumbers, electricians, painters, masons, carpenters, drivers, helpers, AC technicians)
with employers. Built with **FastAPI + MongoDB + React**.

> _Trusted work, fair pay._ — भरोसेमंद काम, सही दाम

## Features
- Phone numbers hidden until both parties commit
- **Digital Work Passport** — reliability score, ratings, earnings, repeat-employer count
- Three trust signals: Aadhaar Verified · Skill Verified (5-Q practical MCQ test per trade) · Trusted Employer badge
- Hindi / English one-tap toggle · WhatsApp passport share · 8-hour "Available NOW" pulse
- Browser push notifications · Decoupled Approve & Review flow

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ and Yarn
- MongoDB (local or Atlas)

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then edit MONGO_URL, DB_NAME, JWT_SECRET
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env             # set REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

Visit http://localhost:3000. Use the yellow demo bar to log in instantly.

## Demo Accounts (auto-seeded on first run)
| Username | Role                 | Password |
|----------|----------------------|----------|
| raju     | Worker (Plumber)     | demo123  |
| suresh   | Worker (Electrician) | demo123  |
| ramesh   | Employer             | demo123  |
| priya    | Employer             | demo123  |

**Note:** For production, comment out `await seed()` inside the `lifespan` function in `backend/server.py`.

## Architecture
```
/
├── backend/    FastAPI + Motor (async MongoDB) + JWT auth  (server.py, skill_tests.py)
└── frontend/   React 19 + Tailwind + shadcn/ui (mobile-first max-w-md SPA)
```
All API routes prefixed `/api`. JWT sent as `Authorization: Bearer <token>`.

## Tech Stack
FastAPI · Motor · PyJWT · bcrypt · React 19 · React Router v7 · Tailwind CSS · shadcn/ui · lucide-react · sonner

## License
MIT
