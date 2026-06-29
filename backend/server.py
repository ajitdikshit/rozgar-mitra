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
    applied_ids = {a["job_id"] for a in apps if a["status"] in ("pending", "hired", "completed")}
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
    if existing and existing["status"] in ("pending", "hired"):
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
                                       "status": {"$in": ["pending", "hired", "rejected_by_employer"]}},
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
    if not job:
        return None
    emp = await db.users.find_one({"id": job["employer_id"]}, {"_id": 0, "password_hash": 0})
    # Co-workers: other hired workers on the same job
    co_apps = await db.applications.find(
        {"job_id": app["job_id"], "status": "hired", "worker_id": {"$ne": user["id"]}},
        {"_id": 0}).to_list(50)
    co_workers = []
    for ca in co_apps:
        w = await db.users.find_one({"id": ca["worker_id"]}, {"_id": 0, "password_hash": 0, "phone": 0})
        if w:
            co_workers.append({"id": w["id"], "name": w["name"], "skill": w.get("skill"),
                                "city": w.get("city"), "aadhaar_verified": w.get("aadhaar_verified", False)})
    return {"application": app, "job": job,
            "employer_name": emp.get("name"), "employer_phone": emp.get("phone"),
            "employer_company": emp.get("company"),
            "co_workers": co_workers}

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
        # FIX #5: Re-count inside the same operation to reduce race window
        hired = await db.applications.count_documents({"job_id": app["job_id"], "status": {"$in": ["hired", "completed"]}})
        if hired >= job["workers_needed"]:
            raise HTTPException(400, "All spots filled")
        await db.applications.update_one({"id": app_id}, {"$set": {"status": "hired"}})
        # Move job to in_progress only when fully staffed
        new_hired = hired + 1
        if new_hired >= job["workers_needed"]:
            await db.jobs.update_one({"id": app["job_id"]}, {"$set": {"status": "in_progress"}})
    elif action == "pass":
        await db.applications.update_one({"id": app_id}, {"$set": {"status": "rejected_by_employer"}})
    else:
        raise HTTPException(400, "Bad action")
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
    return psp

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
    jobs = await db.jobs.find({"employer_id": user["id"], "status": {"$in": ["open", "in_progress"]}},
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
    # Only return jobs that have at least one hired/active worker
    return [j for j in out if j["workers"]]

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
    # Workers
    {"username": "arjun",  "password": "demo123", "role": "worker",   "name": "Arjun Mehta",
     "phone": "9811001001", "city": "Mumbai", "area": "Andheri",   "skill": "Electrician",
     "experience_years": 7, "aadhaar_verified": True,
     "skill_test_passed": True,  "skill_test_score": 5},
    {"username": "deepak", "password": "demo123", "role": "worker",   "name": "Deepak Rawat",
     "phone": "9811002002", "city": "Mumbai", "area": "Borivali",  "skill": "Electrician",
     "experience_years": 3, "aadhaar_verified": True,
     "skill_test_passed": True,  "skill_test_score": 4},
    {"username": "kavita", "password": "demo123", "role": "worker",   "name": "Kavita Sharma",
     "phone": "9811003003", "city": "Mumbai", "area": "Malad",     "skill": "Painter",
     "experience_years": 2, "aadhaar_verified": False,
     "skill_test_passed": False, "skill_test_score": 2},
    # Employers
    {"username": "sunita",  "password": "demo123", "role": "employer", "name": "Sunita Kapoor",
     "phone": "9922001001", "city": "Mumbai", "area": "Andheri",  "company": "SunBuild Constructions"},
    {"username": "vikram",  "password": "demo123", "role": "employer", "name": "Vikram Malhotra",
     "phone": "9922002002", "city": "Mumbai", "area": "Bandra",   "company": "Vikram Interiors"},
    {"username": "nandini", "password": "demo123", "role": "employer", "name": "Nandini Iyer",
     "phone": "9922003003", "city": "Mumbai", "area": "Powai",    "company": "Nandini Residency"},
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

    # ── 1. Create users ───────────────────────────────────────
    for u in DEMO_USERS:
        if await db.users.find_one({"username": u["username"]}):
            continue
        await db.users.insert_one({
            "id": new_id(), "username": u["username"],
            "password_hash": hash_pw(u["password"]),
            "role": u["role"], "name": u["name"], "phone": u["phone"],
            "city": u["city"], "area": u["area"],
            "skill": u.get("skill"), "experience_years": u.get("experience_years", 0),
            "aadhaar_verified": u.get("aadhaar_verified", False),
            "company": u.get("company"),
            "available": True, "urgent_until": None,
            "skill_test_passed": u.get("skill_test_passed", False),
            "skill_test_score": u.get("skill_test_score", 0),
            "skill_test_at": now_iso() if u.get("skill_test_passed") else None,
            "created_at": now_iso(),
        })

    arjun   = await db.users.find_one({"username": "arjun"})
    deepak  = await db.users.find_one({"username": "deepak"})
    kavita  = await db.users.find_one({"username": "kavita"})
    sunita  = await db.users.find_one({"username": "sunita"})
    vikram  = await db.users.find_one({"username": "vikram"})
    nandini = await db.users.find_one({"username": "nandini"})
    if not all([arjun, deepak, kavita, sunita, vikram, nandini]):
        return

    # ── 2. Completed history ──────────────────────────────────
    # Gives workers a rich Work Passport + all 3 employers get Trusted badge (3+ completed, avg >= 4)
    if not await db.work_records.find_one({"worker_id": arjun["id"]}):
        history = [
            # Arjun x Sunita — 3 jobs (gives Sunita trusted badge)
            {"emp": sunita,  "w": arjun,  "title": "Main Panel Upgrade",        "skill": "Electrician", "budget": 3500, "ws": 5, "wr": "Arjun is brilliant — zero mistakes, works fast.",          "es": 5, "er": "Excellent employer, paid immediately.",     "et": ["fairPayment","onTime"]},
            {"emp": sunita,  "w": arjun,  "title": "Office Wiring Work",         "skill": "Electrician", "budget": 2800, "ws": 5, "wr": "Very professional, cleaned up after work.",                "es": 4, "er": "Safe site, good communication.",            "et": ["safeWorkplace","respectful"]},
            {"emp": sunita,  "w": arjun,  "title": "Generator Connection",       "skill": "Electrician", "budget": 1800, "ws": 4, "wr": "Good work, minor delay but quality was great.",            "es": 5, "er": "Paid on time, very cooperative.",           "et": ["fairPayment","onTime"]},
            # Deepak x Vikram — 3 jobs (gives Vikram trusted badge)
            {"emp": vikram,  "w": deepak, "title": "Apartment Rewiring",         "skill": "Electrician", "budget": 4200, "ws": 5, "wr": "Deepak handled complex wiring with confidence.",           "es": 5, "er": "Great employer, very respectful.",          "et": ["respectful","fairPayment"]},
            {"emp": vikram,  "w": deepak, "title": "Switchboard Installation",   "skill": "Electrician", "budget": 1200, "ws": 4, "wr": "Neat work, came on time.",                                 "es": 4, "er": "Paid same day, smooth experience.",         "et": ["fairPayment","onTime"]},
            {"emp": vikram,  "w": deepak, "title": "CCTV Power Wiring",          "skill": "Electrician", "budget": 900,  "ws": 5, "wr": "Excellent — understood the job without much explanation.", "es": 5, "er": "Clean site, tools provided.",               "et": ["safeWorkplace","onTime"]},
            # Arjun x Nandini — 1 job; Deepak x Nandini — 1 job; Kavita x Nandini — 1 job (gives Nandini trusted badge)
            {"emp": nandini, "w": arjun,  "title": "Villa Electrical Inspection","skill": "Electrician", "budget": 2000, "ws": 5, "wr": "Arjun spotted 3 hidden faults. Outstanding.",             "es": 5, "er": "Premium employer, everything organized.",   "et": ["respectful","fairPayment","onTime"]},
            {"emp": nandini, "w": deepak, "title": "Outdoor Light Fitting",      "skill": "Electrician", "budget": 1500, "ws": 4, "wr": "Did well in tight outdoor conditions.",                    "es": 4, "er": "Fair payment, friendly team.",              "et": ["fairPayment","respectful"]},
            {"emp": nandini, "w": kavita, "title": "Living Room Painting",       "skill": "Painter",     "budget": 5500, "ws": 4, "wr": "Kavita's colour sense is excellent.",                      "es": 4, "er": "Gave clear brief, easy to work with.",      "et": ["respectful","onTime"]},
            # Extra Kavita history x Vikram
            {"emp": vikram,  "w": kavita, "title": "Bedroom Feature Wall",       "skill": "Painter",     "budget": 2200, "ws": 5, "wr": "Perfect finish, zero drips, highly recommend.",           "es": 5, "er": "Paid on time, materials provided.",          "et": ["fairPayment","safeWorkplace"]},
        ]
        job_docs = []
        for x in history:
            jid = new_id()
            x["jid"] = jid
            job_docs.append({"id": jid, "employer_id": x["emp"]["id"], "title": x["title"],
                             "skill": x["skill"], "description": "Historic completed job.",
                             "city": "Mumbai", "area": x["emp"]["area"], "address": "Seed Address",
                             "budget": x["budget"], "workers_needed": 1,
                             "deadline": None, "status": "completed", "created_at": now_iso()})
        await db.jobs.insert_many(job_docs)
        await db.applications.insert_many([
            {"id": new_id(), "job_id": x["jid"], "worker_id": x["w"]["id"],
             "status": "completed", "worker_marked_complete": True, "created_at": now_iso()} for x in history])
        await db.work_records.insert_many([
            {"id": new_id(), "worker_id": x["w"]["id"], "employer_id": x["emp"]["id"],
             "job_id": x["jid"], "title": x["title"], "skill": x["skill"],
             "amount": x["budget"], "stars": x["ws"], "date": now_iso()} for x in history])
        await db.worker_reviews.insert_many([
            {"id": new_id(), "worker_id": x["w"]["id"], "employer_id": x["emp"]["id"],
             "job_id": x["jid"], "stars": x["ws"], "review": x["wr"], "created_at": now_iso()} for x in history])
        await db.employer_reviews.insert_many([
            {"id": new_id(), "employer_id": x["emp"]["id"], "worker_id": x["w"]["id"],
             "job_id": x["jid"], "stars": x["es"], "tags": x["et"], "review": x["er"], "created_at": now_iso()} for x in history])

    # ── 3. Open jobs for browsing ─────────────────────────────
    open_jobs = [
        # Electrician jobs
        {"title": "New Flat Full Wiring",        "skill": "Electrician", "emp": sunita,
         "desc": "3BHK flat in Andheri needs complete internal wiring from scratch. 4-day work.",
         "area": "Andheri",  "address": "Wing B, Flat 704, Sunshine Towers, Andheri West",
         "budget": 8500, "needed": 2},  # multi-worker — covers co-worker feature
        {"title": "Office UPS Wiring",           "skill": "Electrician", "emp": vikram,
         "desc": "Wire 3 UPS units to server room and 2 cabins. Tools provided.",
         "area": "Bandra",   "address": "3rd Floor, Commerce House, Bandra Kurla Complex",
         "budget": 3200, "needed": 1},
        {"title": "Streetlight Pole Wiring",     "skill": "Electrician", "emp": nandini,
         "desc": "Connect 8 new streetlight poles in residential complex. Safety gear mandatory.",
         "area": "Powai",    "address": "Gate 2, Nandini Residency, Powai",
         "budget": 6000, "needed": 1},
        # Painter jobs
        {"title": "3BHK Full Exterior Paint",    "skill": "Painter",     "emp": sunita,
         "desc": "Full exterior painting of 3-floor bungalow. Asian Paints Apex to be used.",
         "area": "Juhu",     "address": "Plot 12, Juhu Scheme, Mumbai",
         "budget": 18000, "needed": 1},
        {"title": "Interior Wall Texture Work",  "skill": "Painter",     "emp": nandini,
         "desc": "Sand texture finish for 4 rooms. Material will be provided by owner.",
         "area": "Powai",    "address": "Tower C, Flat 1203, Nandini Residency",
         "budget": 9000, "needed": 1},
    ]
    job_refs = {}
    for jd in open_jobs:
        ex = await db.jobs.find_one({"title": jd["title"]})
        if ex:
            job_refs[jd["title"]] = ex
            continue
        doc = {"id": new_id(), "employer_id": jd["emp"]["id"], "title": jd["title"],
               "skill": jd["skill"], "description": jd["desc"],
               "city": "Mumbai", "area": jd["area"], "address": jd["address"],
               "budget": jd["budget"], "workers_needed": jd["needed"],
               "deadline": None, "status": "open", "created_at": now_iso()}
        await db.jobs.insert_one(doc)
        job_refs[jd["title"]] = doc

    wiring  = job_refs.get("New Flat Full Wiring")       # 2-worker job
    ups     = job_refs.get("Office UPS Wiring")
    street  = job_refs.get("Streetlight Pole Wiring")
    ext     = job_refs.get("3BHK Full Exterior Paint")
    texture = job_refs.get("Interior Wall Texture Work")

    # ── 4. Active jobs (in-progress) ─────────────────────────
    # Arjun HIRED on "New Flat Full Wiring" (multi-worker — slot 1)
    # → Arjun sees: Active Job page, employer phone, photo upload, mark complete
    if wiring and not await db.applications.find_one({"job_id": wiring["id"], "worker_id": arjun["id"]}):
        await db.applications.insert_one({"id": new_id(), "job_id": wiring["id"],
            "worker_id": arjun["id"], "status": "hired", "created_at": now_iso()})

    # Deepak HIRED on "New Flat Full Wiring" (slot 2 — same job as Arjun)
    # → Deepak sees co-worker Arjun on his Active Job page
    if wiring and not await db.applications.find_one({"job_id": wiring["id"], "worker_id": deepak["id"]}):
        await db.applications.insert_one({"id": new_id(), "job_id": wiring["id"],
            "worker_id": deepak["id"], "status": "hired", "created_at": now_iso()})
        # Both hired — job moves to in_progress
        await db.jobs.update_one({"id": wiring["id"]}, {"$set": {"status": "in_progress"}})

    # Kavita HIRED on "Interior Wall Texture Work" (single-worker active job)
    # → Kavita sees: Active Job page with Nandini's contact
    if texture and not await db.applications.find_one({"job_id": texture["id"], "worker_id": kavita["id"]}):
        await db.applications.insert_one({"id": new_id(), "job_id": texture["id"],
            "worker_id": kavita["id"], "status": "hired", "created_at": now_iso()})
        await db.jobs.update_one({"id": texture["id"]}, {"$set": {"status": "in_progress"}})

    # ── 5. Pending application ────────────────────────────────
    # Arjun PENDING on "Office UPS Wiring" (can't be hired — already on wiring job,
    # but pending shows in Pending Jobs tab)
    if ups and not await db.applications.find_one({"job_id": ups["id"], "worker_id": arjun["id"]}):
        await db.applications.insert_one({"id": new_id(), "job_id": ups["id"],
            "worker_id": arjun["id"], "status": "pending", "created_at": now_iso()})

    # Kavita PENDING on "3BHK Full Exterior Paint" (her skill matches)
    if ext and not await db.applications.find_one({"job_id": ext["id"], "worker_id": kavita["id"]}):
        await db.applications.insert_one({"id": new_id(), "job_id": ext["id"],
            "worker_id": kavita["id"], "status": "pending", "created_at": now_iso()})

    # ── 6. Rejected application ───────────────────────────────
    # Deepak REJECTED from "Streetlight Pole Wiring" (shows rejected card with delete)
    if street and not await db.applications.find_one({"job_id": street["id"], "worker_id": deepak["id"]}):
        await db.applications.insert_one({"id": new_id(), "job_id": street["id"],
            "worker_id": deepak["id"], "status": "rejected_by_employer", "created_at": now_iso()})

    # ── 7. Invite — Vikram invited Arjun to "Office UPS Wiring" ──
    # → Arjun sees pending invite in Job Requests tab
    if ups and not await db.invites.find_one({"job_id": ups["id"], "worker_id": arjun["id"]}):
        await db.invites.insert_one({"id": new_id(), "job_id": ups["id"],
            "worker_id": arjun["id"], "employer_id": vikram["id"],
            "status": "pending", "created_at": now_iso()})

    # Vikram also invited Deepak to "Office UPS Wiring"
    if ups and not await db.invites.find_one({"job_id": ups["id"], "worker_id": deepak["id"]}):
        await db.invites.insert_one({"id": new_id(), "job_id": ups["id"],
            "worker_id": deepak["id"], "employer_id": vikram["id"],
            "status": "pending", "created_at": now_iso()})

    # ── 8. Urgent mode — Arjun is Available NOW ──────────────
    await db.users.update_one(
        {"id": arjun["id"]},
        {"$set": {"urgent_until": (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat()}})

    try:
        os.makedirs("/app/memory", exist_ok=True)
        with open("/app/memory/test_credentials.md", "w") as f:
            f.write("""# Demo Accounts — All passwords: demo123

Workers:
  arjun  — Electrician, Mumbai/Andheri  (Aadhaar ✓, Skill Test ✓ 5/5, Urgent NOW)
  deepak — Electrician, Mumbai/Borivali (Aadhaar ✓, Skill Test ✓ 4/5)
  kavita — Painter, Mumbai/Malad        (Skill Test ✗ 2/5)

Employers:
  sunita  — SunBuild Constructions (Trusted ✓)
  vikram  — Vikram Interiors        (Trusted ✓)
  nandini — Nandini Residency       (Trusted ✓)
""")
    except Exception:
        pass

app.include_router(api)

cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)