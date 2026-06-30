# Rozgar Mitra — रोज़गार मित्र

> **Trusted work, fair pay.** — भरोसेमंद काम, सही दाम

A mobile-first job marketplace connecting India's 450M+ informal skilled workers with employers — built around a **Digital Work Passport** trust system that gives every worker a verifiable, portable track record.

---

## The Problem

India's informal labour market has no memory. A plumber with 10 years of experience and a first-timer look identical to a new employer — there is no way to tell them apart. This causes three compounding failures:

- **Workers** are underpaid because they can't prove their skill level. A highly skilled electrician and a barely competent one get quoted the same rate. Skilled workers earn 20–35% below their real market value.
- **Employers** waste 3–5 hours per hire on informal verification (calling neighbours, WhatsApp groups) with no guarantee of reliability. 1 in 4 informal hires ends in a dispute, no-show, or redo.
- **Phone numbers are the only trust signal** — shared before any commitment, leading to harassment, ghosting, and zero accountability when things go wrong.

Existing solutions fail in specific ways: platforms like Urban Company serve only the premium segment and trap worker reputations in a walled garden. Government certificates have no feedback loop from real job performance. WhatsApp networks are geographically bounded and socially exclusive.

---

## The Solution

Rozgar Mitra creates the trust infrastructure this market has always needed:

| Feature | What it solves |
|---------|----------------|
| **Digital Work Passport** | Portable reliability score built from real completed jobs, ratings, repeat employers — travels with the worker everywhere |
| **Scenario-based Skill Tests** | 5-question practical MCQ per trade — proves real-world competency, not textbook knowledge |
| **Phone Privacy System** | Numbers hidden until both sides commit — eliminates harassment and ghosting |
| **Employer Trust Score** | Workers can vet employers too — accountability on both sides |
| **Direct Invite System** | Employers reach skilled workers directly, matched by trade |

---

## Complete Feature List

### Worker Features
- **Search Jobs** — search open jobs by title or city using free text; filter by any of 25 skill categories using chip buttons
- **Apply to Jobs** — one-tap apply with live spot count (e.g. "2 of 3 spots filled")
- **View Employer Info** — tap any job card to see employer name, company, trust badge, avg rating, full job description, address and deadline before applying
- **Withdraw Application** — cancel a pending application before the employer decides
- **Pending Applications** — see all applications with live status (waiting / rejected); rejected cards show in red with a Delete button to dismiss
- **Job Invites** — receive direct invites from employers; accept (enters Active Job instantly) or decline; accepted invites disappear from the list
- **Active Job** — view current job details, employer company and phone number (revealed only after hiring), one-tap call button
- **Co-worker Visibility** — see names and skills of other workers hired on the same multi-worker job; phone numbers stay private
- **Work Photo Upload** — upload a photo of completed work before marking the job done
- **Mark Job Complete** — mark work done and rate the employer (1–5 stars) with quick tags (Safe Workplace, Fair Payment, On Time, Respectful) and a written review
- **Digital Work Passport** — reliability score (0–100) computed from: jobs completed, average rating, completion rate, unique employers, repeat employers
- **Passport Stats** — verified job count, total earnings, average rating, unique employers, repeat employer count
- **Share Passport** — share Work Passport via WhatsApp
- **Skill Verification Test** — 5-question scenario-based MCQ test per trade; pass/fail badge displayed to all employers; 24-hour cooldown on retakes
- **Aadhaar Verified Badge** — trust signal displayed on profile and all job cards
- **Urgent / Available NOW** — 8-hour pulse that surfaces the worker at the top of all employer searches
- **Availability Toggle** — set yourself as available or unavailable to employers
- **Work History** — full log of all verified completed jobs with employer name, amount earned, and star rating
- **Reviews Received** — all employer reviews with ratings and tags
- **Profile Page** — view and manage personal information
- **Hindi / English Toggle** — full bilingual UI; every label, button, status message, and navigation item in both languages

### Employer Features
- **Post Jobs** — create a job with title, skill required, description, city, area, full address, budget, number of workers needed, and deadline
- **Browse Workers** — search workers by name or city using free text; filter by any of 25 skill categories; sorted by reliability score with Urgent NOW workers at the top
- **View Worker Passport** — full Digital Work Passport before hiring — reliability score, verified jobs, average rating, total earnings, skill test badge, Aadhaar badge
- **Hire or Pass Applicants** — one-tap decide on each applicant; hired workers' phone numbers are revealed automatically
- **Send Direct Invites** — invite specific workers to a job; invite modal only shows jobs that match the worker's skill
- **Posted Jobs Dashboard** — expand any job to see all applicants and hired workers; passport icon on each applicant for quick view
- **Active Jobs Dashboard** — see all in-progress jobs with hired workers; worker photo displayed after upload; approve completed work; leave star rating and written review per worker
- **Approve Worker** — clicking Approve before worker marks done shows an error toast; approve unlocks only after worker uploads photo and marks complete
- **Employer Trust Score** — auto-computed: Trusted badge earned after 3+ completed jobs with average rating ≥ 4.0; visible to workers on all job cards and invite notifications
- **Employer History** — full completed job history with stats
- **Reviews Received** — all worker reviews with ratings, tags, and written feedback
- **Profile Page** — view and manage company information

### Trust & Privacy
- Worker phone number hidden until employer hires them
- Employer phone number hidden until worker accepts an invite or is hired
- Worker passport (without phone) visible to employers before hiring
- Employer trust score and average rating visible to workers before applying
- All mutations verified server-side — workers can only act on their own applications, employers only on their own jobs

### Platform
- **25 supported trades** with dedicated skill filter chips
- **18 skill tests** — 5 scenario-based practical questions per trade
- **Demo Bar** — instant account switching between all demo accounts for presentations
- **Live badge counts** — Pending, Active, and Invite counts update every 5 seconds without page refresh
- **Browser push notifications** — get notified when hired or when an invite arrives
- **Login rate limiting** — brute-force protection (10 attempts per minute per IP)
- **Responsive design** — full width on mobile, centered column on desktop/tablet
- **Bilingual** — English and Hindi, toggle in one tap

---

## Tech Stack

| | |
|-|-|
| **Backend** | FastAPI, Motor (async MongoDB), PyJWT, bcrypt |
| **Frontend** | React 19, React Router v7, Tailwind CSS, shadcn/ui, lucide-react |
| **Database** | MongoDB with compound indexes on all hot query paths |
| **Auth** | JWT (30-day tokens) |

---

## Quick Start

### Backend
```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Mac / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env        # fill in MONGO_URL, JWT_SECRET
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env        # set REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

Visit **http://localhost:3000**

---

## Environment Variables

**`backend/.env`**
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=rozgar_mitra
JWT_SECRET=your-long-random-secret-key
CORS_ORIGINS=http://localhost:3000
```

**`frontend/.env`**
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## Demo Accounts

All passwords: `demo123`

| Username | Role | Details |
|----------|------|---------|
| `arjun` | Worker — Electrician | Skill test 5/5 ✓, Aadhaar ✓, Urgent NOW, active job, co-worker visible, pending invite |
| `deepak` | Worker — Electrician | Skill test 4/5 ✓, Aadhaar ✓, active job (co-worker: Arjun), rejected application |
| `kavita` | Worker — Painter | Skill test failed ✗, no Aadhaar — shows contrast vs verified workers |
| `sunita` | Employer | Trusted ✓, active job with Arjun + Deepak, posted jobs, history |
| `vikram` | Employer | Trusted ✓, sent invites to Arjun & Deepak |
| `nandini` | Employer | Trusted ✓, active job with Kavita, history across all workers |

> To reset the demo: drop all MongoDB collections and restart the backend — seed runs automatically.

---

## Supported Trades (25)

Plumber · Electrician · Painter · Mason · Carpenter · Driver · Helper · AC Technician · Welder · Gardener · Cook · Security Guard · Cleaner / Sweeper · Tailor · Beautician · Delivery Boy · Caretaker / Nurse · Tutor / Teacher · Mechanic · Tiler · Waterproofing Expert · Glass / Aluminium Worker · Lift Technician · CCTV Technician · Solar Panel Technician

18 of 25 trades have full 5-question scenario-based skill tests.

---

## Project Structure

```
Rozgar-Mitra/
├── backend/
│   ├── server.py          # FastAPI app — all routes, auth, seed
│   ├── skill_tests.py     # 18 trade question banks (5 MCQs each)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/         # One file per screen
    │   ├── components/    # Navbar, BottomNav, DemoBar, PassportCard, Modal, Stars
    │   ├── context/       # AuthContext, LangContext (EN/HI)
    │   ├── api/           # axios with JWT interceptor
    │   └── hooks/         # useNotifications
    └── .env.example
```

---

*Built for the **Sama Initiative — Build for Good Hackathon 2025***
*Theme: Technology for underserved communities in India*

---

## License

MIT
