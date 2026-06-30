import { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import EmployerDrawer from "../components/EmployerDrawer";
import Modal from "../components/Modal";
import PassportCard from "../components/PassportCard";
import { useLang } from "../context/LangContext";
import { ChevronDown, ChevronUp, Check, X, ShieldCheck, BadgeCheck, FileUser } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLOR = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
};

export default function PostedJobs() {
  const { t } = useLang();
  const [jobs, setJobs] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [passport, setPassport] = useState(null);
  const [loadingPassport, setLoadingPassport] = useState(false);

  // THE FIX: Cache Buster forces live data from MongoDB
  const load = () => api.get(`/employer/jobs?_t=${Date.now()}`).then(r => setJobs(r.data));
  useEffect(() => { load(); }, []);

  const decide = async (id, action) => {
    try {
      await api.post(`/employer/applicants/${id}/decide?action=${action}`);
      toast.success(action === "hire" ? "Worker Hired!" : "Applicant passed.");
      load();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Something went wrong.");
    }
  };

  const viewPassport = async (worker_id) => {
    setLoadingPassport(true);
    try {
      const { data } = await api.get(`/employer/worker/${worker_id}/passport`);
      setPassport(data);
    } catch (e) {
      // worker not yet hired
    } finally {
      setLoadingPassport(false);
    }
  };

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.myJobs} onMenu={() => setDrawer(true)}/>
      <EmployerDrawer open={drawer} onClose={() => setDrawer(false)}/>
      <div className="p-4 space-y-3">
        {jobs.length === 0 && <p className="text-center text-[#4A5568] py-10">No jobs posted yet.</p>}
        {jobs.map(j => {
          const isOpen = expanded === j.id;
          const pending = j.applicants.filter(a => a.status === "pending" || a.status === "offer_pending");
          const hired = j.applicants.filter(a => a.status === "hired" || a.status === "completed");
          return (
            <div key={j.id} className="bg-white border-2 border-[#E2E8F0] rounded-2xl overflow-hidden" data-testid={`pj-${j.id}`}>
              <button onClick={() => setExpanded(isOpen ? null : j.id)} className="w-full p-4 text-left flex items-start gap-2"
                      data-testid={`expand-${j.id}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold font-display">{j.title}</h3>
                    {/* UI TWEAK: Show "ACTIVE" when backend shifts the job to in_progress */}
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLOR[j.status] || "bg-gray-100"}`}>
                      {j.status === "in_progress" ? "ACTIVE" : j.status.replace("_"," ")}
                    </span>
                  </div>
                  <p className="text-xs text-[#4A5568]">{j.skill} • ₹{j.budget} • {j.hired_count}/{j.workers_needed} {t.hired}</p>
                </div>
                {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
              </button>
              {isOpen && (
                <div className="border-t border-[#E2E8F0] p-4 space-y-3 bg-[#FDFBF7]">
                  {hired.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">{t.hired}</p>
                      {hired.map(a => (
                        <ApplicantCard key={a.id} a={a} hideActions
                                       onViewPassport={() => viewPassport(a.worker_id)}/>
                      ))}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#4A5568] mb-1">{t.applicants}</p>
                    {pending.length === 0 ? (
                      <p className="text-sm text-[#4A5568] py-2">{t.noApplicants}</p>
                    ) : (
                      pending.map(a => (
                        <ApplicantCard key={a.id} a={a}
                                       onHire={() => decide(a.id, "hire")}
                                       onPass={() => decide(a.id, "pass")}
                                       onViewPassport={() => viewPassport(a.worker_id)}/>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={!!passport} onClose={() => setPassport(null)} title="Worker Passport">
        <PassportCard data={passport} showShare={false}/>
      </Modal>

      <BottomNav role="employer"/>
    </div>
  );
}

function ApplicantCard({ a, onHire, onPass, onViewPassport, hideActions }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 mb-2" data-testid={`applicant-${a.id}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-bold flex items-center gap-1">{a.worker_name}
            {a.aadhaar_verified && <ShieldCheck size={14} className="text-[#0EA5E9]"/>}
            {a.skill_test_passed && <BadgeCheck size={14} className="text-[#16A34A]" data-testid={`skill-${a.id}`}/>}
          </p>
          <p className="text-xs text-[#4A5568]">{a.worker_skill} • {a.worker_city}</p>
          <p className="text-xs mt-1">⭐ Score {a.reliability_score} • {a.verified_jobs} verified jobs</p>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={onViewPassport} data-testid={`passport-${a.id}`}
                  className="w-9 h-9 rounded-full bg-[#E65C00]/10 text-[#E65C00] flex items-center justify-center active:scale-95"
                  title="View Passport">
            <FileUser size={16}/>
          </button>
          {!hideActions && (
            <>
              <button onClick={onPass} data-testid={`pass-${a.id}`}
                      className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95">
                <X size={18}/>
              </button>
              <button onClick={onHire} data-testid={`hire-${a.id}`}
                      className="w-9 h-9 rounded-full bg-[#16A34A] text-white flex items-center justify-center active:scale-95">
                <Check size={18}/>
              </button>
            </>
          )}
          {hideActions && a.worker_phone && (
            <a href={`tel:${a.worker_phone}`} className="text-sm font-bold text-[#16A34A]">{a.worker_phone}</a>
          )}
        </div>
      </div>
    </div>
  );
}