import { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import { useLang } from "../context/LangContext";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import WorkerDrawer from "../components/WorkerDrawer";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import { TrustedBadge } from "../components/PassportCard";
import { StarDisplay } from "../components/Stars";
import { MapPin, IndianRupee, Users, Check, BadgeCheck, Star, Briefcase, TrendingUp, TrendingDown, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ListSkeleton } from "../components/Skeletons";

import { SKILLS } from "../constants/skills";

export default function Jobs() {
  const { t } = useLang();
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [skill, setSkill] = useState(user?.skill || "");

  // Reset skill filter when user account switches
  useEffect(() => {
    setSkill(user?.skill || "");
  }, [user?.username]);
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [badges, setBadges] = useState({ active: 0, pending: 0, invites: 0 });
  const [empModal, setEmpModal] = useState(null); // employer trust info
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const params = {};
    if (skill) params.skill = skill;
    if (q) params.q = q;
    try {
      const { data } = await api.get("/worker/jobs", { params });
      setJobs(data);
    } finally {
      setLoading(false);
    }
  };

  const loadBadges = useCallback(async () => {
    try {
      const [appsRes, invitesRes] = await Promise.all([
        api.get("/worker/applications"),
        api.get("/worker/invites"),
      ]);
      const pending = appsRes.data.filter(a => a.status === "pending").length;
      const active = appsRes.data.filter(a => a.status === "hired").length;
      const invites = invitesRes.data.filter(i => i.status === "pending").length;
      setBadges({ pending, active, invites });
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [skill, q]);

  useEffect(() => {
    loadBadges();
    const id = setInterval(loadBadges, 5000);
    return () => clearInterval(id);
  }, [loadBadges]);

  const apply = async (id) => {
    try {
      await api.post("/worker/apply", { job_id: id });
      load();
      loadBadges();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not apply");
    }
  };  

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.search} subtitle={t.findWork} onMenu={() => setDrawer(true)}/>
      <WorkerDrawer open={drawer} onClose={() => setDrawer(false)}/>

      <div className="p-4 space-y-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.searchPlaceholder}
               data-testid="job-search"
               className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-xl bg-white outline-none focus:border-[#E65C00]"/>
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <Chip active={!skill} onClick={() => setSkill("")} tid="filter-all">{t.allSkills}</Chip>
            {SKILLS.map(s => (
              <Chip key={s} active={skill === s} onClick={() => setSkill(s)} tid={`filter-${s}`}>{s}</Chip>
            ))}
          </div>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-[#FDFBF7] to-transparent"/>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {loading && <ListSkeleton count={4} />}
        {!loading && jobs.length === 0 && <p className="text-center text-[#4A5568] py-10" data-testid="no-jobs">{t.noJobs}</p>}
        {!loading && jobs.map(j => {
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
                  {j.pay_verdict && <PayBadge verdict={j.pay_verdict}/>}
                </div>
              </div>
              {j.pay_verdict && j.pay_verdict !== "fair" && (
                <p className="text-[11px] mt-1 text-[#4A5568]">
                  Market range for {j.skill} in {j.city}: ₹{j.pay_suggested_min}–₹{j.pay_suggested_max}
                </p>
              )}
              <p className="text-sm mt-2 text-[#4A5568] line-clamp-2">{j.description}</p>
              {j.photo_b64 && (
                <img src={j.photo_b64} alt="Problem" data-testid={`job-photo-${j.id}`}
                     className="w-full h-36 object-cover rounded-xl mt-2 border border-[#E2E8F0]"/>
              )}

              {/* Employer info row — tappable to see trust details */}
              <button onClick={() => setEmpModal(j)} data-testid={`emp-info-${j.id}`}
                      className="w-full mt-3 flex items-center justify-between bg-[#FDFBF7] border border-[#E2E8F0] rounded-xl px-3 py-2 active:bg-gray-100">
                <span className="text-xs text-[#4A5568]">{t.employerProfile}: <b>{j.employer_company || j.employer_name}</b></span>
                <div className="flex items-center gap-1">
                  {j.employer_avg_rating > 0 && <StarDisplay stars={j.employer_avg_rating}/>}
                  <span className="text-[10px] text-[#E65C00] font-bold ml-1">View Employer ›</span>
                </div>
              </button>

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
              {(() => {
                const wrongSkill = user?.skill && j.skill !== user.skill && !j.applied;
                return (
                  <button onClick={() => !wrongSkill && apply(j.id)}
                          disabled={j.applied || left === 0 || wrongSkill}
                          data-testid={`apply-${j.id}`}
                          title={wrongSkill ? `This job requires a ${j.skill}` : ""}
                          className={`w-full mt-3 py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2
                            ${j.applied ? "bg-green-100 text-green-700"
                              : left === 0 ? "bg-gray-100 text-gray-400"
                              : wrongSkill ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-[#E65C00] text-white active:scale-95 transition-transform"}`}>
                    {j.applied
                      ? <><Check size={18}/>{t.applied}</>
                      : wrongSkill
                      ? `Requires ${j.skill}`
                      : t.applyNow}
                  </button>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Employer Trust Modal */}
      <Modal open={!!empModal} onClose={() => setEmpModal(null)} title="Employer Info">
        {empModal && (
          <div className="space-y-3">
            <div className="bg-[#1A202C] text-white rounded-2xl p-4">
              <p className="font-extrabold text-lg font-display">{empModal.employer_company || empModal.employer_name}</p>
              <p className="text-xs text-gray-300">{empModal.city}, {empModal.area}</p>
              <div className="flex items-center gap-2 mt-2">
                {empModal.employer_trusted && (
                  <span className="inline-flex items-center gap-1 bg-[#0EA5E9]/20 text-[#0EA5E9] px-2 py-1 rounded-full text-xs font-bold">
                    <BadgeCheck size={13}/> Trusted Employer
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <InfoStat icon={<Star size={16} className="text-[#EAB308]"/>} label="Avg Rating" value={empModal.employer_avg_rating > 0 ? `${empModal.employer_avg_rating} / 5` : "No ratings yet"}/>
              <InfoStat icon={<Briefcase size={16} className="text-[#E65C00]"/>} label="This Job" value={`₹${empModal.budget}`}/>
            </div>
            <div className="bg-[#FDFBF7] border border-[#E2E8F0] rounded-xl p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[#4A5568] mb-1">Job Description</p>
              <p className="text-sm">{empModal.description}</p>
            </div>
            <div className="bg-[#FDFBF7] border border-[#E2E8F0] rounded-xl p-3 text-sm">
              <p><span className="font-bold">Address:</span> {empModal.address}</p>
              {empModal.deadline && <p className="mt-1"><span className="font-bold">Deadline:</span> {empModal.deadline}</p>}
            </div>
          </div>
        )}
      </Modal>

      <BottomNav role="worker" badges={badges}/>
    </div>
  );
}

function PayBadge({ verdict }) {
  if (verdict === "above_market") {
    return (
      <span className="mt-1 inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
        <TrendingUp size={11}/> Above Market
      </span>
    );
  }
  if (verdict === "below_market") {
    return (
      <span className="mt-1 inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
        <TrendingDown size={11}/> Below Market
      </span>
    );
  }
  return (
    <span className="mt-1 inline-flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
      <ShieldCheck size={11}/> Fair Pay
    </span>
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

function InfoStat({ icon, label, value }) {
  return (
    <div className="bg-[#FDFBF7] border border-[#E2E8F0] rounded-xl p-3 flex items-center gap-2">
      {icon}
      <div>
        <p className="text-[10px] text-[#4A5568] font-bold uppercase">{label}</p>
        <p className="font-bold text-sm">{value}</p>
      </div>
    </div>
  );
}
