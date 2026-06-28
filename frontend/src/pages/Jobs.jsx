import { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import { useLang } from "../context/LangContext";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import WorkerDrawer from "../components/WorkerDrawer";
import { useAuth } from "../context/AuthContext";
import { TrustedBadge } from "../components/PassportCard";
import { StarDisplay } from "../components/Stars";
import { MapPin, Calendar, IndianRupee, Users, Check, UserCircle } from "lucide-react";
import Modal from "../components/Modal";
import EmployerProfilePanel from "../components/EmployerProfilePanel";

const SKILLS = ["Plumber", "Electrician", "Painter", "Mason", "Carpenter", "Driver", "Helper", "AC Technician"];

export default function Jobs() {
  const { t } = useLang();
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [skill, setSkill] = useState(user?.skill || "");
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [badges, setBadges] = useState({ active: 0, pending: 0, invites: 0 });
  const [employerProfile, setEmployerProfile] = useState(null);

  const load = async () => {
    const params = {};
    if (skill) params.skill = skill;
    if (q) params.q = q;
    const { data } = await api.get("/worker/jobs", { params });
    setJobs(data);
  };

  // FIX #8: Poll badge counts on an interval so they update without a page reload
  const loadBadges = useCallback(async () => {
    try {
      const [appsRes, invitesRes] = await Promise.all([
        api.get("/worker/applications"),
        api.get("/worker/invites"),
      ]);
      const pending = appsRes.data.filter(a => a.status === "pending" || a.status === "offer_pending").length;
      const active = appsRes.data.filter(a => a.status === "hired").length;
      const invites = invitesRes.data.filter(i => i.status === "pending").length;
      setBadges({ pending, active, invites });
    } catch { /* silent — badges are non-critical */ }
  }, []);

  useEffect(() => { load(); }, [skill, q]);

  useEffect(() => {
    loadBadges();
    const id = setInterval(loadBadges, 5000);
    return () => clearInterval(id);
  }, [loadBadges]);

  const apply = async (id) => {
    await api.post("/worker/apply", { job_id: id });
    load();
    loadBadges();
  };

  const viewEmployer = async (employerId) => {
    const { data } = await api.get(`/worker/employer/${employerId}/profile`);
    setEmployerProfile(data);
  };

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.search} subtitle={t.findWork} onMenu={() => setDrawer(true)}/>
      <WorkerDrawer open={drawer} onClose={() => setDrawer(false)}/>

      <div className="p-4 space-y-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.searchPlaceholder}
               data-testid="job-search"
               className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-xl bg-white outline-none focus:border-[#E65C00]"/>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <Chip active={!skill} onClick={() => setSkill("")} tid="filter-all">{t.allSkills}</Chip>
          {SKILLS.map(s => (
            <Chip key={s} active={skill === s} onClick={() => setSkill(s)} tid={`filter-${s}`}>{s}</Chip>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-3">
        {jobs.length === 0 && <p className="text-center text-[#4A5568] py-10" data-testid="no-jobs">{t.noJobs}</p>}
        {jobs.map(j => {
          const left = Math.max(0, j.workers_needed - j.hired_count);
          const pct = Math.min(100, (j.hired_count / j.workers_needed) * 100);
          return (
            <div key={j.id} className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-4 fade-up"
                 data-testid={`job-${j.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold font-display text-base truncate">{j.title}</h3>
                  <p className="text-xs text-[#4A5568] flex items-center gap-1"><MapPin size={12}/>{j.area}, {j.city}</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-lg flex items-center"><IndianRupee size={16}/>{j.budget}</p>
                  {j.employer_trusted && <TrustedBadge/>}
                </div>
              </div>
              <p className="text-sm mt-2 text-[#4A5568] line-clamp-2">{j.description}</p>
              <div className="flex items-center justify-between mt-3 text-xs">
                <button onClick={() => viewEmployer(j.employer_id)} data-testid={`emp-profile-${j.id}`}
                        className="text-left text-[#E65C00] font-bold flex items-center gap-1">
                  <UserCircle size={14}/>{t.viewEmployer}
                </button>
                {j.employer_avg_rating > 0 && <StarDisplay stars={j.employer_avg_rating}/>}
              </div>
              <p className="text-xs text-[#4A5568] mt-1">{j.employer_company || j.employer_name}</p>
              {j.workers_needed > 1 && (
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-bold flex items-center gap-1"><Users size={12}/>{j.hired_count}/{j.workers_needed}</span>
                    <span className="text-[#4A5568]">{left} {t.spotsLeft}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[#E65C00]" style={{ width: `${pct}%` }}/>
                  </div>
                </div>
              )}
              <button onClick={() => apply(j.id)} disabled={j.applied || left === 0}
                      data-testid={`apply-${j.id}`}
                      className={`w-full mt-3 py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2 ${j.applied ? "bg-green-100 text-green-700" : left === 0 ? "bg-gray-100 text-gray-400" : "bg-[#E65C00] text-white active:scale-95 transition-transform"}`}>
                {j.applied ? <><Check size={18}/>{t.applied}</> : t.applyNow}
              </button>
            </div>
          );
        })}
      </div>

      <Modal open={!!employerProfile} onClose={() => setEmployerProfile(null)} title={t.employerProfile}>
        <EmployerProfilePanel data={employerProfile}/>
      </Modal>

      <BottomNav role="worker" badges={badges}/>
    </div>
  );
}

function Chip({ children, active, onClick, tid }) {
  return (
    <button onClick={onClick} data-testid={tid}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold border-2 ${active ? "bg-[#1A202C] text-white border-[#1A202C]" : "bg-white border-[#E2E8F0] text-[#4A5568]"}`}>
      {children}
    </button>
  );
}
