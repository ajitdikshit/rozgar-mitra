from dotenv import load_dotenv
from pathlib import Path
from contextlib import asynccontextmanager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from collections import defaultdict, deque

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from skill_tests import SKILL_TESTS

# ----- DB -----
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
JWT_EXPIRE_DAYS = 30

# Photo size limit: ~2MB base64
PHOTO_MAX_BYTES = 2 * 1024 * 1024

# ----- Helpers -----
def now_iso():
    return datetime.now(timezone.utc).isoformat()

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_token(user_id: str, role: str) -> str:
    return pyjwt.encode(
        {"sub": user_id, "role": role,
         "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)},
        JWT_SECRET, algorithm=JWT_ALG)

def new_id() -> str:
    return str(uuid.uuid4())

# Rate limit: 10 login attempts/min per (IP + username)
_login_attempts = defaultdict(deque)
def get_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    return request.client.host if request.client else "unknown"

def login_rate_ok(key: str) -> bool:
    q = _login_attempts[key]
    now = datetime.now(timezone.utc)
    while q and (now - q[0]).total_seconds() > 60:
        q.popleft()
    if len(q) >= 10:
        return False
    q.append(now)
    return True

security = HTTPBearer(auto_error=False)

async def get_current_user(request: Request, creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    token = creds.credentials if creds else None
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    user.pop("password_hash", None)
    return user

def require_worker(user: dict = Depends(get_current_user)):
    if user["role"] != "worker":
        raise HTTPException(403, "Workers only")
    return user

def require_employer(user: dict = Depends(get_current_user)):
    if user["role"] != "employer":
        raise HTTPException(403, "Employers only")
    return user

# ----- Models -----
class RegisterIn(BaseModel):
    username: str
    # FIX #10: Minimum password length of 6 characters
    password: str = Field(..., min_length=6)
    role: Literal["worker", "employer"]
    name: str
    phone: str
    city: str
    area: Optional[str] = ""
    # worker
    skill: Optional[str] = None
    experience_years: Optional[int] = 0
    aadhaar_verified: Optional[bool] = False
    # employer
    company: Optional[str] = None

class LoginIn(BaseModel):
    username: str
    password: str

class JobIn(BaseModel):
    title: str
    skill: str
    description: str
    city: str
    area: str
    address: str
    budget: int
    workers_needed: int = 1
    deadline: Optional[str] = None

class ApplyIn(BaseModel):
    job_id: str

class InviteIn(BaseModel):
    worker_id: str
    job_id: str

class RateEmployerIn(BaseModel):
    job_id: str
    # FIX #11: Clamp stars to valid 1-5 range
    stars: int = Field(..., ge=1, le=5)
    tags: List[str] = []
    review: str = ""

class CompleteWorkerIn(BaseModel):
    job_id: str
    worker_id: str
    # FIX #11: Clamp stars to valid 1-5 range
    stars: int = Field(..., ge=1, le=5)
    review: str = ""

class ApproveWorkerIn(BaseModel):
    job_id: str
    worker_id: str

class ReviewWorkerIn(BaseModel):
    job_id: str
    worker_id: str
    # FIX #11: Clamp stars to valid 1-5 range
    stars: int = Field(..., ge=1, le=5)
    review: str = ""

class AvailabilityIn(BaseModel):
    available: bool

class UrgentIn(BaseModel):
    enable: bool

class PhotoIn(BaseModel):
    job_id: str
    photo_b64: str  # data URL

class SkillTestIn(BaseModel):
    answers: List[int]  # length 5, each 0-3

# ----- Worker passport calc -----
async def compute_passport(worker_id: str) -> dict:
    user = await db.users.find_one({"id": worker_id}, {"_id": 0, "password_hash": 0})
    if not user:
        return {}
    records = await db.work_records.find({"worker_id": worker_id}, {"_id": 0}).to_list(2000)
    employer_ids = [r["employer_id"] for r in records]
    unique_employers = len(set(employer_ids))
    repeat_employers = len([e for e in set(employer_ids) if employer_ids.count(e) > 1])
    total_earned = sum(r.get("amount", 0) for r in records)
    avg_rating = round(sum(r.get("stars", 0) for r in records) / len(records), 1) if records else 0
    # FIX #2: Only count truly "completed" apps — "hired" means still in progress
    apps = await db.applications.find({"worker_id": worker_id}, {"_id": 0}).to_list(2000)
    hired_apps = [a for a in apps if a["status"] in ("completed", "rejected_by_employer")]
    completed = [a for a in hired_apps if a["status"] == "completed"]
    completion_rate = round(100 * len(completed) / len(hired_apps), 0) if hired_apps else 100
    # reliability score 0-100
    rel = min(100, int(
        25 * min(1, len(records) / 5) +
        25 * (avg_rating / 5) +
        20 * (completion_rate / 100) +
        15 * min(1, unique_employers / 5) +
        15 * min(1, repeat_employers / 2)
    ))
    return {
        "user": user,
        "reliability_score": rel,
        "verified_jobs": len(records),
        "avg_rating": avg_rating,
        "total_earned": total_earned,
        "unique_employers": unique_employers,
        "repeat_employers": repeat_employers,
        "completion_rate": completion_rate,
    }

async def compute_employer_trust(employer_id: str) -> dict:
    jobs = await db.jobs.find({"employer_id": employer_id}, {"_id": 0}).to_list(2000)
    completed_jobs = [j for j in jobs if j["status"] == "completed"]
    reviews = await db.employer_reviews.find({"employer_id": employer_id}, {"_id": 0}).to_list(2000)
    avg = round(sum(r["stars"] for r in reviews) / len(reviews), 1) if reviews else 0
    trusted = len(completed_jobs) >= 3 and avg >= 4.0
    return {
        "jobs_posted": len(jobs),
        "jobs_completed": len(completed_jobs),
        "avg_rating": avg,
        "review_count": len(reviews),
        "trusted": trusted,
    }

async def enrich_worker_history(worker_id: str) -> dict:
    records = await db.work_records.find({"worker_id": worker_id}, {"_id": 0}).sort("date", -1).to_list(50)
    revs = await db.worker_reviews.find({"worker_id": worker_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    history = []
    for r in records:
        emp = await db.users.find_one({"id": r["employer_id"]}, {"_id": 0, "password_hash": 0, "name": 1, "company": 1})
        history.append({**r,
                        "employer_name": emp.get("name") if emp else "",
                        "employer_company": emp.get("company") if emp else ""})
    reviews = []
    for rev in revs:
        emp = await db.users.find_one({"id": rev["employer_id"]}, {"_id": 0, "password_hash": 0, "name": 1})
        reviews.append({**rev, "employer_name": emp.get("name") if emp else ""})
    return {"history": history, "reviews": reviews}

RESERVED_SPOT_STATUSES = ("hired", "completed", "offer_pending")

async def count_reserved_spots(job_id: str) -> int:
    return await db.applications.count_documents(
        {"job_id": job_id, "status": {"$in": list(RESERVED_SPOT_STATUSES)}})

async def worker_can_see_employer_phone(worker_id: str, employer_id: str) -> bool:
    apps = await db.applications.find(
        {"worker_id": worker_id, "status": "hired"}, {"_id": 0, "job_id": 1}
    ).to_list(500)
    for a in apps:
        job = await db.jobs.find_one({"id": a["job_id"], "employer_id": employer_id}, {"_id": 0, "id": 1})
        if job:
            return True
    inv = await db.invites.find_one(
        {"worker_id": worker_id, "employer_id": employer_id, "status": "accepted"}, {"_id": 0, "id": 1}
    )
    return inv is not None

async def maybe_start_job(job_id: str, workers_needed: int):
    hired = await db.applications.count_documents(
        {"job_id": job_id, "status": {"$in": ["hired", "completed"]}})
    if hired >= workers_needed:
        await db.jobs.update_one({"id": job_id}, {"$set": {"status": "in_progress"}})

# ====== LIFESPAN (replaces deprecated on_event) ======
# FIX #16: Use lifespan context manager instead of deprecated @app.on_event
@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed()
    try:
        os.makedirs("/app/memory", exist_ok=True)
        with open("/app/memory/test_credentials.md", "w") as f:
            f.write("""# Rozgar Mitra — Test Credentials\n\nAll demo accounts share password: `demo123`\n\n## Workers\n- Username: `raju` / Pwd: `demo123` — Plumber, Delhi/Rohini\n- Username: `suresh` / Pwd: `demo123` — Electrician, Delhi/Dwarka\n\n## Employers\n- Username: `ramesh` / Pwd: `demo123` — Ramesh Construction Pvt Ltd\n- Username: `priya` / Pwd: `demo123` — Sharma Homes\n""")
    except Exception as e:
        logging.warning(f"Could not write test_credentials.md: {e}")
    yield
    client.close()

# ----- App -----
app = FastAPI(title="Rozgar Mitra API", lifespan=lifespan)
api = APIRouter(prefix="/api")

# ====== AUTH ======
@api.post("/auth/register")
async def register(body: RegisterIn):
    body.username = body.username.lower().strip()
    if await db.users.find_one({"username": body.username}):
        raise HTTPException(400, "Username already taken")
    user_doc = {
        "id": new_id(),
        "username": body.username,
        "password_hash": hash_pw(body.password),
        "role": body.role,
        "name": body.name,
        "phone": body.phone,
        "city": body.city,
        "area": body.area or "",
        "skill": body.skill,
        "experience_years": body.experience_years or 0,
        "aadhaar_verified": bool(body.aadhaar_verified),
        "company": body.company,
        "available": True,
        "urgent_until": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    user_doc.pop("password_hash")
    user_doc.pop("_id", None)
    token = make_token(user_doc["id"], user_doc["role"])
    return {"token": token, "user": user_doc}

@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    ip = get_client_ip(request)
    body.username = body.username.lower().strip()
    rate_key = f"{ip}:{body.username}"
    if not login_rate_ok(rate_key):
        raise HTTPException(429, "Too many login attempts. Try again in a minute.")
    user = await db.users.find_one({"username": body.username})
    if not user or not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid username or password")
    user.pop("password_hash")
    user.pop("_id", None)
    token = make_token(user["id"], user["role"])
    return {"token": token, "user": user}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ====== WORKER ======
@api.get("/worker/jobs")
async def list_open_jobs(skill: Optional[str] = None, q: Optional[str] = None,
                         user: dict = Depends(require_worker)):
    query = {"status": "open"}
    if skill:
        query["skill"] = skill
    jobs = await db.jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    apps = await db.applications.find({"worker_id": user["id"]}, {"_id": 0}).to_list(2000)
    applied_ids = {a["job_id"] for a in apps if a["status"] in ("pending", "offer_pending", "hired", "completed")}
    out = []
    for j in jobs:
        emp = await db.users.find_one({"id": j["employer_id"]}, {"_id": 0, "password_hash": 0, "phone": 0})
        trust = await compute_employer_trust(j["employer_id"])
        hired = await db.applications.count_documents({"job_id": j["id"], "status": {"$in": ["hired", "completed"]}})
        if q:
            ql = q.lower()
            if ql not in j["title"].lower() and ql not in j["city"].lower() and ql not in (j.get("area") or "").lower():
                continue
        out.append({**j,
                    "employer_name": emp.get("name") if emp else "",
                    "employer_company": emp.get("company") if emp else "",
                    "employer_trusted": trust["trusted"],
                    "employer_avg_rating": trust["avg_rating"],
                    "hired_count": hired,
                    "applied": j["id"] in applied_ids})
    return out

@api.post("/worker/apply")
async def apply_job(body: ApplyIn, user: dict = Depends(require_worker)):
    job = await db.jobs.find_one({"id": body.job_id}, {"_id": 0})
    if not job or job["status"] != "open":
        raise HTTPException(400, "Job not open")
    existing = await db.applications.find_one({"job_id": body.job_id, "worker_id": user["id"]})
    if existing and existing["status"] in ("pending", "offer_pending", "hired"):
        raise HTTPException(400, "Already applied")
    doc = {"id": new_id(), "job_id": body.job_id, "worker_id": user["id"],
           "status": "pending", "created_at": now_iso()}
    await db.applications.insert_one(doc)
    return {"ok": True}

@api.post("/worker/withdraw/{job_id}")
async def withdraw(job_id: str, user: dict = Depends(require_worker)):
    await db.applications.update_one(
        {"job_id": job_id, "worker_id": user["id"], "status": "pending"},
        {"$set": {"status": "withdrawn"}})
    return {"ok": True}

@api.get("/worker/applications")
async def my_applications(user: dict = Depends(require_worker)):
    apps = await db.applications.find({"worker_id": user["id"],
                                       "status": {"$in": ["pending", "offer_pending", "hired", "rejected_by_employer"]}},
                                      {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for a in apps:
        job = await db.jobs.find_one({"id": a["job_id"]}, {"_id": 0})
        if not job:
            continue
        emp = await db.users.find_one({"id": job["employer_id"]}, {"_id": 0, "password_hash": 0})
        reveal_phone = a["status"] == "hired"
        out.append({**a, "job": job,
                    "employer_name": emp.get("name") if emp else "",
                    "employer_phone": emp.get("phone") if (emp and reveal_phone) else None})
    return out

@api.post("/worker/offer/{app_id}/respond")
async def respond_hire_offer(app_id: str, action: str, user: dict = Depends(require_worker)):
    app = await db.applications.find_one({"id": app_id, "worker_id": user["id"]})
    if not app or app["status"] != "offer_pending":
        raise HTTPException(404, "Offer not found")
    job = await db.jobs.find_one({"id": app["job_id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found")
    if action == "accept":
        await db.applications.update_one(
            {"id": app_id},
            {"$set": {"status": "hired", "accepted_at": now_iso()}})
        await maybe_start_job(app["job_id"], job.get("workers_needed", 1))
    elif action == "decline":
        await db.applications.update_one(
            {"id": app_id},
            {"$set": {"status": "rejected_by_worker", "rejected_at": now_iso()}})
    else:
        raise HTTPException(400, "Bad action")
    return {"ok": True}

@api.get("/worker/invites")
async def my_invites(user: dict = Depends(require_worker)):
    invites = await db.invites.find({"worker_id": user["id"],
                                     "status": {"$in": ["pending", "accepted"]}},
                                    {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for inv in invites:
        job = await db.jobs.find_one({"id": inv["job_id"]}, {"_id": 0})
        emp = await db.users.find_one({"id": inv["employer_id"]}, {"_id": 0, "password_hash": 0})
        reveal = inv["status"] == "accepted"
        out.append({**inv, "job": job,
                    "employer_name": emp.get("name") if emp else "",
                    "employer_phone": emp.get("phone") if (emp and reveal) else None})
    return out

@api.post("/worker/invite/{invite_id}/respond")
async def respond_invite(invite_id: str, action: str, user: dict = Depends(require_worker)):
    inv = await db.invites.find_one({"id": invite_id, "worker_id": user["id"]})
    if not inv:
        raise HTTPException(404, "Invite not found")
    if action == "accept":
        await db.invites.update_one({"id": invite_id}, {"$set": {"status": "accepted"}})
        # Upsert an application record with hired status
        await db.applications.update_one(
            {"job_id": inv["job_id"], "worker_id": user["id"]},
            {"$setOnInsert": {"id": new_id(), "job_id": inv["job_id"], "worker_id": user["id"],
                              "created_at": now_iso()},
             "$set": {"status": "hired"}}, upsert=True)
        # FIX #4: Only move job to in_progress if all needed workers are now hired
        job = await db.jobs.find_one({"id": inv["job_id"]}, {"_id": 0})
        if job and job["status"] == "open":
            hired_count = await db.applications.count_documents(
                {"job_id": inv["job_id"], "status": {"$in": ["hired", "completed"]}})
            if hired_count >= job.get("workers_needed", 1):
                await db.jobs.update_one({"id": inv["job_id"]}, {"$set": {"status": "in_progress"}})
    elif action == "decline":
        await db.invites.update_one({"id": invite_id}, {"$set": {"status": "declined"}})
    else:
        raise HTTPException(400, "Bad action")
    return {"ok": True}

@api.get("/worker/active")
async def active_job(user: dict = Depends(require_worker)):
    app = await db.applications.find_one({"worker_id": user["id"], "status": "hired"}, {"_id": 0})
    if not app:
        return None
    job = await db.jobs.find_one({"id": app["job_id"]}, {"_id": 0})
    emp = await db.users.find_one({"id": job["employer_id"]}, {"_id": 0, "password_hash": 0})
    return {"application": app, "job": job,
            "employer_name": emp.get("name"), "employer_phone": emp.get("phone"),
            "employer_company": emp.get("company")}

@api.post("/worker/upload-photo")
async def upload_photo(body: PhotoIn, user: dict = Depends(require_worker)):
    # FIX #12: Enforce photo size limit (~2MB base64)
    if len(body.photo_b64) > PHOTO_MAX_BYTES:
        raise HTTPException(400, "Photo too large. Please upload an image under 1.5 MB.")
    await db.applications.update_one(
        {"job_id": body.job_id, "worker_id": user["id"], "status": "hired"},
        {"$set": {"photo_b64": body.photo_b64, "photo_at": now_iso()}})
    return {"ok": True}

@api.post("/worker/mark-complete")
async def mark_complete(body: RateEmployerIn, user: dict = Depends(require_worker)):
    app = await db.applications.find_one({"job_id": body.job_id, "worker_id": user["id"], "status": "hired"})
    if not app:
        raise HTTPException(404, "No active job")
    # FIX #13: Require photo upload before marking complete
    if not app.get("photo_b64"):
        raise HTTPException(400, "Please upload a work photo before marking complete.")
    job = await db.jobs.find_one({"id": body.job_id})
    if not job:
        raise HTTPException(404, "Job not found")
    await db.applications.update_one({"id": app["id"]}, {"$set": {"worker_marked_complete": True,
                                                                  "worker_marked_at": now_iso()}})
    review = {
        "id": new_id(),
        "employer_id": job["employer_id"],
        "worker_id": user["id"],
        "job_id": body.job_id,
        "stars": body.stars,
        "tags": body.tags,
        "review": body.review,
        "created_at": now_iso(),
    }
    existing = await db.employer_reviews.find_one({"job_id": body.job_id, "worker_id": user["id"]})
    if not existing:
        await db.employer_reviews.insert_one(review)
    return {"ok": True}

@api.get("/worker/history")
async def work_history(user: dict = Depends(require_worker)):
    records = await db.work_records.find({"worker_id": user["id"]}, {"_id": 0}).sort("date", -1).to_list(500)
    out = []
    for r in records:
        emp = await db.users.find_one({"id": r["employer_id"]}, {"_id": 0, "password_hash": 0})
        out.append({**r, "employer_name": emp.get("name") if emp else "",
                    "employer_company": emp.get("company") if emp else ""})
    return out

@api.get("/worker/reviews")
async def my_reviews(user: dict = Depends(require_worker)):
    revs = await db.worker_reviews.find({"worker_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for r in revs:
        emp = await db.users.find_one({"id": r["employer_id"]}, {"_id": 0, "password_hash": 0})
        out.append({**r, "employer_name": emp.get("name") if emp else ""})
    avg = round(sum(r["stars"] for r in revs) / len(revs), 1) if revs else 0
    return {"reviews": out, "avg": avg, "count": len(revs)}

@api.get("/worker/passport")
async def my_passport(user: dict = Depends(require_worker)):
    return await compute_passport(user["id"])

@api.get("/worker/employer/{employer_id}/profile")
async def employer_profile_for_worker(employer_id: str, user: dict = Depends(require_worker)):
    emp = await db.users.find_one({"id": employer_id, "role": "employer"}, {"_id": 0, "password_hash": 0})
    if not emp:
        raise HTTPException(404, "Employer not found")
    trust = await compute_employer_trust(employer_id)
    jobs = await db.jobs.find({"employer_id": employer_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    public_jobs = [{"id": j["id"], "title": j["title"], "skill": j["skill"],
                    "budget": j["budget"], "status": j["status"],
                    "city": j["city"], "area": j["area"],
                    "created_at": j.get("created_at")} for j in jobs]
    revs = await db.employer_reviews.find({"employer_id": employer_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    reviews_out = []
    for r in revs:
        w = await db.users.find_one({"id": r["worker_id"]}, {"_id": 0, "password_hash": 0, "name": 1})
        reviews_out.append({**r, "worker_name": w.get("name") if w else ""})
    reveal_phone = await worker_can_see_employer_phone(user["id"], employer_id)
    return {
        "user": {k: emp[k] for k in ("id", "name", "company", "city", "area") if k in emp},
        "phone": emp.get("phone") if reveal_phone else None,
        "stats": trust,
        "jobs": public_jobs,
        "reviews": reviews_out,
    }

@api.post("/worker/availability")
async def set_availability(body: AvailabilityIn, user: dict = Depends(require_worker)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"available": body.available}})
    return {"ok": True}

@api.post("/worker/urgent")
async def set_urgent(body: UrgentIn, user: dict = Depends(require_worker)):
    val = (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat() if body.enable else None
    await db.users.update_one({"id": user["id"]}, {"$set": {"urgent_until": val}})
    return {"ok": True, "urgent_until": val}

@api.get("/worker/skill-test")
async def get_skill_test(user: dict = Depends(require_worker)):
    skill = user.get("skill")
    questions = SKILL_TESTS.get(skill)
    if not questions:
        raise HTTPException(404, "No test available for your skill yet")
    public = [{"q": q["q"], "options": q["options"]} for q in questions]
    return {"skill": skill, "questions": public,
            "passed": bool(user.get("skill_test_passed")),
            "score": user.get("skill_test_score", 0)}

@api.post("/worker/skill-test")
async def submit_skill_test(body: SkillTestIn, user: dict = Depends(require_worker)):
    skill = user.get("skill")
    questions = SKILL_TESTS.get(skill)
    if not questions:
        raise HTTPException(404, "No test available for your skill")
    if len(body.answers) != len(questions):
        raise HTTPException(400, "Wrong number of answers")
    # FIX #14: Enforce 24-hour cooldown between retakes (unless not yet passed)
    last_at = user.get("skill_test_at")
    if last_at and not user.get("skill_test_passed"):
        try:
            last_dt = datetime.fromisoformat(last_at)
            if (datetime.now(timezone.utc) - last_dt).total_seconds() < 86400:
                raise HTTPException(429, "Please wait 24 hours before retaking the test.")
        except HTTPException:
            raise
        except Exception:
            pass
    correct = sum(1 for i, ans in enumerate(body.answers) if ans == questions[i]["answer"])
    passed = correct >= 4  # need 4 of 5
    update = {"skill_test_score": correct, "skill_test_passed": passed,
              "skill_test_at": now_iso()}
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    return {"score": correct, "total": len(questions), "passed": passed}

# ====== EMPLOYER ======
@api.post("/employer/jobs")
async def post_job(body: JobIn, user: dict = Depends(require_employer)):
    doc = {
        "id": new_id(),
        "employer_id": user["id"],
        "title": body.title, "skill": body.skill, "description": body.description,
        "city": body.city, "area": body.area, "address": body.address,
        "budget": body.budget, "workers_needed": body.workers_needed,
        "deadline": body.deadline,
        "status": "open", "created_at": now_iso(),
    }
    await db.jobs.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/employer/jobs")
async def my_jobs(user: dict = Depends(require_employer)):
    jobs = await db.jobs.find({"employer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for j in jobs:
        applicants = await db.applications.find({"job_id": j["id"]}, {"_id": 0}).to_list(500)
        enriched = []
        for a in applicants:
            w = await db.users.find_one({"id": a["worker_id"]}, {"_id": 0, "password_hash": 0})
            if not w:
                continue
            psp = await compute_passport(a["worker_id"])
            enriched.append({**a,
                             "worker_name": w["name"], "worker_skill": w.get("skill"),
                             "worker_city": w["city"], "worker_phone": w["phone"] if a["status"] in ("hired", "completed") else None,
                             "aadhaar_verified": w.get("aadhaar_verified", False),
                             "skill_test_passed": w.get("skill_test_passed", False),
                             "reliability_score": psp.get("reliability_score", 0),
                             "verified_jobs": psp.get("verified_jobs", 0)})
        hired = len([a for a in applicants if a["status"] in ("hired", "completed")])
        out.append({**j, "applicants": enriched, "hired_count": hired})
    return out

@api.post("/employer/applicants/{app_id}/decide")
async def decide_applicant(app_id: str, action: str, user: dict = Depends(require_employer)):
    app = await db.applications.find_one({"id": app_id})
    if not app:
        raise HTTPException(404, "Not found")
    job = await db.jobs.find_one({"id": app["job_id"]})
    if not job or job["employer_id"] != user["id"]:
        raise HTTPException(403, "Not your job")
    if action == "hire":
        reserved = await count_reserved_spots(app["job_id"])
        if reserved >= job["workers_needed"]:
            raise HTTPException(400, "All spots filled")
        await db.applications.update_one(
            {"id": app_id},
            {"$set": {"status": "offer_pending", "offered_at": now_iso()}})
    elif action == "pass":
        await db.applications.update_one({"id": app_id}, {"$set": {"status": "rejected_by_employer"}})
    else:
        raise HTTPException(400, "Bad action")
    return {"ok": True}

@api.delete("/employer/applicants/{app_id}")
async def remove_applicant(app_id: str, user: dict = Depends(require_employer)):
    app = await db.applications.find_one({"id": app_id})
    if not app:
        raise HTTPException(404, "Not found")
    job = await db.jobs.find_one({"id": app["job_id"]})
    if not job or job["employer_id"] != user["id"]:
        raise HTTPException(403, "Not your job")
    if app["status"] != "rejected_by_worker":
        raise HTTPException(400, "Can only remove offers the worker declined")
    await db.applications.delete_one({"id": app_id})
    return {"ok": True}

@api.get("/employer/workers")
async def browse_workers(skill: Optional[str] = None, q: Optional[str] = None,
                         user: dict = Depends(require_employer)):
    query = {"role": "worker", "available": True}
    if skill:
        query["skill"] = skill
    workers = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    out = []
    now = datetime.now(timezone.utc)
    for w in workers:
        if q:
            ql = q.lower()
            if ql not in w["name"].lower() and ql not in w["city"].lower() and ql not in (w.get("area") or "").lower():
                continue
        psp = await compute_passport(w["id"])
        urgent = False
        if w.get("urgent_until"):
            try:
                urgent = datetime.fromisoformat(w["urgent_until"]) > now
            except Exception:
                urgent = False
        out.append({**w, "phone": None,  # hidden until hired
                    "reliability_score": psp.get("reliability_score", 0),
                    "verified_jobs": psp.get("verified_jobs", 0),
                    "avg_rating": psp.get("avg_rating", 0),
                    "urgent_available": urgent})
    out.sort(key=lambda x: (not x["urgent_available"], -x["reliability_score"]))
    return out

@api.get("/employer/worker/{worker_id}/passport")
async def get_worker_passport(worker_id: str, user: dict = Depends(require_employer)):
    psp = await compute_passport(worker_id)
    if not psp:
        raise HTTPException(404, "Worker not found")
    # FIX #9: Check specifically whether THIS employer has hired this worker
    has_hired = await db.applications.find_one(
        {"worker_id": worker_id, "status": {"$in": ["hired", "completed"]}})
    employer_has_hired = False
    if has_hired:
        job_check = await db.jobs.find_one({"id": has_hired["job_id"], "employer_id": user["id"]})
        employer_has_hired = job_check is not None
    if not employer_has_hired:
        psp["user"]["phone"] = None
    hist = await enrich_worker_history(worker_id)
    psp.update(hist)
    return psp

@api.get("/employer/worker/{worker_id}/history")
async def get_worker_history(worker_id: str, user: dict = Depends(require_employer)):
    w = await db.users.find_one({"id": worker_id, "role": "worker"}, {"_id": 0, "password_hash": 0, "id": 1})
    if not w:
        raise HTTPException(404, "Worker not found")
    return await enrich_worker_history(worker_id)

@api.post("/employer/invite")
async def send_invite(body: InviteIn, user: dict = Depends(require_employer)):
    job = await db.jobs.find_one({"id": body.job_id, "employer_id": user["id"]})
    if not job:
        raise HTTPException(404, "Job not found")
    existing = await db.invites.find_one({"job_id": body.job_id, "worker_id": body.worker_id, "status": "pending"})
    if existing:
        raise HTTPException(400, "Invite already sent")
    doc = {"id": new_id(), "job_id": body.job_id, "worker_id": body.worker_id,
           "employer_id": user["id"], "status": "pending", "created_at": now_iso()}
    await db.invites.insert_one(doc)
    return {"ok": True}

@api.get("/employer/active")
async def employer_active(user: dict = Depends(require_employer)):
    jobs = await db.jobs.find({"employer_id": user["id"], "status": {"$in": ["in_progress"]}},
                              {"_id": 0}).to_list(500)
    out = []
    for j in jobs:
        hired = await db.applications.find(
            {"job_id": j["id"], "status": {"$in": ["hired", "completed"]}}, {"_id": 0}
        ).to_list(500)
        ws = []
        for a in hired:
            w = await db.users.find_one({"id": a["worker_id"]}, {"_id": 0, "password_hash": 0})
            if not w:
                continue
            review = await db.worker_reviews.find_one(
                {"job_id": j["id"], "worker_id": w["id"]}, {"_id": 0})
            ws.append({"application_id": a["id"], "worker_id": w["id"],
                       "name": w["name"], "skill": w.get("skill"),
                       "phone": w["phone"], "photo_b64": a.get("photo_b64"),
                       "status": a["status"],
                       "worker_marked_complete": a.get("worker_marked_complete", False),
                       "review_stars": review["stars"] if review else None,
                       "review_text": review["review"] if review else None})
        out.append({**j, "workers": ws})
    return out

@api.post("/employer/approve-worker")
async def approve_worker(body: ApproveWorkerIn, user: dict = Depends(require_employer)):
    job = await db.jobs.find_one({"id": body.job_id, "employer_id": user["id"]})
    if not job:
        raise HTTPException(404, "Job not found")
    app = await db.applications.find_one({"job_id": body.job_id, "worker_id": body.worker_id, "status": "hired"})
    if not app:
        raise HTTPException(404, "Worker not on this job")
    if not app.get("worker_marked_complete"):
        raise HTTPException(400, "Worker has not marked the job complete yet")
    await db.applications.update_one(
        {"id": app["id"]},
        {"$set": {"status": "completed", "completed_at": now_iso()}})
    # FIX #1: approve-worker writes stars=0 placeholder; review-worker updates it later
    # This is intentional — work record is created here, rating added via review-worker
    rec_exists = await db.work_records.find_one({"job_id": body.job_id, "worker_id": body.worker_id})
    if not rec_exists:
        await db.work_records.insert_one({
            "id": new_id(), "worker_id": body.worker_id, "employer_id": user["id"],
            "job_id": body.job_id, "title": job["title"], "skill": job["skill"],
            "amount": job["budget"], "stars": 0,
            "date": now_iso(),
        })
    remaining = await db.applications.count_documents({"job_id": body.job_id, "status": "hired"})
    if remaining == 0:
        await db.jobs.update_one({"id": body.job_id}, {"$set": {"status": "completed"}})
    return {"ok": True}

@api.post("/employer/review-worker")
async def review_worker(body: ReviewWorkerIn, user: dict = Depends(require_employer)):
    job = await db.jobs.find_one({"id": body.job_id, "employer_id": user["id"]})
    if not job:
        raise HTTPException(404, "Job not found")
    app = await db.applications.find_one(
        {"job_id": body.job_id, "worker_id": body.worker_id,
         "status": {"$in": ["hired", "completed"]}})
    if not app:
        raise HTTPException(404, "Worker not on this job")
    existing = await db.worker_reviews.find_one({"job_id": body.job_id, "worker_id": body.worker_id})
    review_doc = {
        "worker_id": body.worker_id, "employer_id": user["id"],
        "job_id": body.job_id, "stars": body.stars, "review": body.review,
        "created_at": now_iso(),
    }
    if existing:
        await db.worker_reviews.update_one({"id": existing["id"]}, {"$set": review_doc})
    else:
        await db.worker_reviews.insert_one({"id": new_id(), **review_doc})
    # Reflect rating on the work record
    await db.work_records.update_one(
        {"job_id": body.job_id, "worker_id": body.worker_id},
        {"$set": {"stars": body.stars}})
    return {"ok": True}

@api.post("/employer/complete-worker")
async def complete_worker(body: CompleteWorkerIn, user: dict = Depends(require_employer)):
    # Kept for backward compatibility — performs approve + review together.
    job = await db.jobs.find_one({"id": body.job_id, "employer_id": user["id"]})
    if not job:
        raise HTTPException(404, "Job not found")
    app = await db.applications.find_one({"job_id": body.job_id, "worker_id": body.worker_id, "status": "hired"})
    if not app:
        raise HTTPException(404, "Worker not on this job")
    if not app.get("worker_marked_complete"):
        raise HTTPException(400, "Worker has not marked the job complete yet")
    await db.applications.update_one({"id": app["id"]}, {"$set": {"status": "completed", "completed_at": now_iso()}})
    existing = await db.worker_reviews.find_one({"job_id": body.job_id, "worker_id": body.worker_id})
    if not existing:
        await db.worker_reviews.insert_one({
            "id": new_id(), "worker_id": body.worker_id, "employer_id": user["id"],
            "job_id": body.job_id, "stars": body.stars, "review": body.review,
            "created_at": now_iso()})
    rec_exists = await db.work_records.find_one({"job_id": body.job_id, "worker_id": body.worker_id})
    if not rec_exists:
        await db.work_records.insert_one({
            "id": new_id(), "worker_id": body.worker_id, "employer_id": user["id"],
            "job_id": body.job_id, "title": job["title"], "skill": job["skill"],
            "amount": job["budget"], "stars": body.stars,
            "date": now_iso()})
    remaining = await db.applications.count_documents({"job_id": body.job_id, "status": "hired"})
    if remaining == 0:
        await db.jobs.update_one({"id": body.job_id}, {"$set": {"status": "completed"}})
    return {"ok": True}

@api.get("/employer/history")
async def employer_history(user: dict = Depends(require_employer)):
    jobs = await db.jobs.find({"employer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    trust = await compute_employer_trust(user["id"])
    return {"jobs": jobs, "stats": trust}

@api.get("/employer/reviews")
async def employer_reviews_received(user: dict = Depends(require_employer)):
    revs = await db.employer_reviews.find({"employer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for r in revs:
        w = await db.users.find_one({"id": r["worker_id"]}, {"_id": 0, "password_hash": 0})
        out.append({**r, "worker_name": w["name"] if w else ""})
    avg = round(sum(r["stars"] for r in revs) / len(revs), 1) if revs else 0
    return {"reviews": out, "avg": avg, "count": len(revs)}

@api.get("/employer/trust")
async def employer_trust(user: dict = Depends(require_employer)):
    return await compute_employer_trust(user["id"])

# ====== SEED ======
DEMO_USERS = [
    {"username": "raju", "password": "demo123", "role": "worker", "name": "Raju Kumar",
     "phone": "9123456701", "city": "Delhi", "area": "Rohini", "skill": "Plumber",
     "experience_years": 6, "aadhaar_verified": True},
    {"username": "suresh", "password": "demo123", "role": "worker", "name": "Suresh Yadav",
     "phone": "9123456702", "city": "Delhi", "area": "Dwarka", "skill": "Electrician",
     "experience_years": 4, "aadhaar_verified": True},
    {"username": "ramesh", "password": "demo123", "role": "employer", "name": "Ramesh Builders",
     "phone": "9876543210", "city": "Delhi", "area": "Rohini", "company": "Ramesh Construction Pvt Ltd"},
    {"username": "priya", "password": "demo123", "role": "employer", "name": "Priya Sharma",
     "phone": "9876543211", "city": "Delhi", "area": "Dwarka", "company": "Sharma Homes"},
]

DEMO_JOBS = [
    {"title": "Bathroom Tap Replacement", "skill": "Plumber",
     "description": "Replace 2 leaking taps in master bathroom. All materials provided.",
     "city": "Delhi", "area": "Rohini", "address": "H-no 23, Sector 8, Rohini",
     "budget": 800, "workers_needed": 1, "employer_username": "ramesh"},
    {"title": "Ceiling Fan Wiring", "skill": "Electrician",
     "description": "Install 3 new ceiling fans. Tools needed.",
     "city": "Delhi", "area": "Dwarka", "address": "Flat 402, Sector 12, Dwarka",
     "budget": 1500, "workers_needed": 2, "employer_username": "priya"},
    {"title": "Kitchen Sink Drain Cleaning", "skill": "Plumber",
     "description": "Blocked kitchen drain. Quick fix needed today.",
     "city": "Delhi", "area": "Dwarka", "address": "Plot 14, Sector 12",
     "budget": 600, "workers_needed": 1, "employer_username": "priya"},
]

async def seed():
    try:
        await db.users.create_index("username", unique=True)
        await db.jobs.create_index("employer_id")
        await db.applications.create_index([("job_id", 1), ("worker_id", 1)])
        await db.invites.create_index([("worker_id", 1), ("status", 1)])
        await db.work_records.create_index("worker_id")
    except Exception:
        pass
    for u in DEMO_USERS:
        exists = await db.users.find_one({"username": u["username"]})
        if exists:
            continue
        doc = {
            "id": new_id(),
            "username": u["username"],
            "password_hash": hash_pw(u["password"]),
            "role": u["role"], "name": u["name"], "phone": u["phone"],
            "city": u["city"], "area": u["area"],
            "skill": u.get("skill"), "experience_years": u.get("experience_years", 0),
            "aadhaar_verified": u.get("aadhaar_verified", False),
            "company": u.get("company"),
            "available": True, "urgent_until": None,
            "created_at": now_iso(),
        }
        await db.users.insert_one(doc)
    for j in DEMO_JOBS:
        existing = await db.jobs.find_one({"title": j["title"]})
        if existing:
            continue
        emp = await db.users.find_one({"username": j["employer_username"]})
        if not emp:
            continue
        await db.jobs.insert_one({
            "id": new_id(), "employer_id": emp["id"],
            "title": j["title"], "skill": j["skill"], "description": j["description"],
            "city": j["city"], "area": j["area"], "address": j["address"],
            "budget": j["budget"], "workers_needed": j["workers_needed"],
            "deadline": None, "status": "open", "created_at": now_iso(),
        })
    # FIX #3: Seed historic work records using real job IDs tied to real employer IDs
    raju = await db.users.find_one({"username": "raju"})
    ramesh = await db.users.find_one({"username": "ramesh"})
    if raju and ramesh:
        existing = await db.work_records.find_one({"worker_id": raju["id"], "title": "Pipe Repair Job"})
        if not existing:
            # Create real job documents so job_id references are valid
            job1_id = new_id()
            job2_id = new_id()
            await db.jobs.insert_many([
                {"id": job1_id, "employer_id": ramesh["id"], "title": "Pipe Repair Job",
                 "skill": "Plumber", "description": "Historic seed job", "city": "Delhi",
                 "area": "Rohini", "address": "Seed", "budget": 1200, "workers_needed": 1,
                 "deadline": None, "status": "completed", "created_at": now_iso()},
                {"id": job2_id, "employer_id": ramesh["id"], "title": "Water Tank Cleaning",
                 "skill": "Plumber", "description": "Historic seed job", "city": "Delhi",
                 "area": "Rohini", "address": "Seed", "budget": 900, "workers_needed": 1,
                 "deadline": None, "status": "completed", "created_at": now_iso()},
            ])
            await db.applications.insert_many([
                {"id": new_id(), "job_id": job1_id, "worker_id": raju["id"],
                 "status": "completed", "created_at": now_iso()},
                {"id": new_id(), "job_id": job2_id, "worker_id": raju["id"],
                 "status": "completed", "created_at": now_iso()},
            ])
            await db.work_records.insert_many([
                {"id": new_id(), "worker_id": raju["id"], "employer_id": ramesh["id"],
                 "job_id": job1_id, "title": "Pipe Repair Job", "skill": "Plumber",
                 "amount": 1200, "stars": 5, "date": now_iso()},
                {"id": new_id(), "worker_id": raju["id"], "employer_id": ramesh["id"],
                 "job_id": job2_id, "title": "Water Tank Cleaning", "skill": "Plumber",
                 "amount": 900, "stars": 4, "date": now_iso()},
            ])
            await db.worker_reviews.insert_many([
                {"id": new_id(), "worker_id": raju["id"], "employer_id": ramesh["id"],
                 "job_id": job1_id, "stars": 5, "review": "Quick and clean work.",
                 "created_at": now_iso()},
                {"id": new_id(), "worker_id": raju["id"], "employer_id": ramesh["id"],
                 "job_id": job2_id, "stars": 4, "review": "Polite and on time.",
                 "created_at": now_iso()},
            ])

app.include_router(api)

# FIX #17: CORS_ORIGINS defaults to restrictive value; set to * only if explicitly configured
cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
