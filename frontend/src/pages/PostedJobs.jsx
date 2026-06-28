import { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import EmployerDrawer from "../components/EmployerDrawer";
import Modal from "../components/Modal";
import PassportCard from "../components/PassportCard";
import WorkerHistoryPanel from "../components/WorkerHistoryPanel";
import { useLang } from "../context/LangContext";
import { ChevronDown, ChevronUp, Check, X, ShieldCheck, BadgeCheck, UserCircle, Clock, Trash2 } from "lucide-react";

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
  const [workerProfile, setWorkerProfile] = useState(null);
  const load = () => api.get("/employer/jobs").then(r => setJobs(r.data));
  useEffect(() => { load(); }, []);
  const decide = async (id, action) => { await api.post(`/employer/applicants/${id}/decide?action=${action}`); load(); };
  const removeApplicant = async (id) => { await api.delete(`/employer/applicants/${id}`); load(); };

  const viewWorkerProfile = async (workerId) => {
    const { data } = await api.get(`/employer/worker/${workerId}/passport`);
    setWorkerProfile(data);
  };

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.myJobs} onMenu={() => setDrawer(true)}/>
      <EmployerDrawer open={drawer} onClose={() => setDrawer(false)}/>
      <div className="p-4 space-y-3">
        {jobs.length === 0 && <p className="text-center text-[#4A5568] py-10">No jobs posted yet.</p>}
        {jobs.map(j => {
          const isOpen = expanded === j.id;
          const applicants = j.applicants.filter(a => a.status === "pending");
          const awaiting = j.applicants.filter(a => a.status === "offer_pending");
          const declined = j.applicants.filter(a => a.status === "rejected_by_worker");
          const hired = j.applicants.filter(a => a.status === "hired" || a.status === "completed");
          return (
            <div key={j.id} className="bg-white border-2 border-[#E2E8F0] rounded-2xl overflow-hidden" data-testid={`pj-${j.id}`}>
              <button onClick={() => setExpanded(isOpen ? null : j.id)} className="w-full p-4 text-left flex items-start gap-2"
                      data-testid={`expand-${j.id}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold font-display">{j.title}</h3>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLOR[j.status] || "bg-gray-100"}`}>{j.status.replace("_"," ")}</span>
                  </div>
                  <p className="text-xs text-[#4A5568]">{j.skill} • ₹{j.budget} • {j.hired_count}/{j.workers_needed} {t.hired}</p>
                </div>
                {isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
              </button>
              {isOpen && (
                <div className="border-t border-[#E2E8F0] p-4 space-y-3 bg-[#FDFBF7]">
                  {hired.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">{t.active}</p>
                      {hired.map(a => (
                        <ApplicantCard key={a.id} a={a} hideActions onViewProfile={() => viewWorkerProfile(a.worker_id)}/>
                      ))}
                    </div>
                  )}
                  {awaiting.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#EAB308] mb-1">{t.awaitingWorker}</p>
                      {awaiting.map(a => (
                        <ApplicantCard key={a.id} a={a} hideActions awaiting onViewProfile={() => viewWorkerProfile(a.worker_id)}/>
                      ))}
                    </div>
                  )}
                  {declined.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-red-600 mb-1">{t.rejectedByWorker}</p>
                      {declined.map(a => (
                        <ApplicantCard key={a.id} a={a} hideActions rejected
                                       onViewProfile={() => viewWorkerProfile(a.worker_id)}
                                       onRemove={() => removeApplicant(a.id)}/>
                      ))}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#4A5568] mb-1">{t.applicants}</p>
                    {applicants.length === 0 ? (
                      <p className="text-sm text-[#4A5568] py-2">{t.noApplicants}</p>
                    ) : (
                      applicants.map(a => (
                        <ApplicantCard key={a.id} a={a}
                                       onHire={() => decide(a.id, "hire")}
                                       onPass={() => decide(a.id, "pass")}
                                       onViewProfile={() => viewWorkerProfile(a.worker_id)}/>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={!!workerProfile} onClose={() => setWorkerProfile(null)} title={t.viewProfile}>
        <PassportCard data={workerProfile} showShare={false}/>
        <WorkerHistoryPanel history={workerProfile?.history} reviews={workerProfile?.reviews}/>
      </Modal>

      <BottomNav role="employer"/>
    </div>
  );
}

function ApplicantCard({ a, onHire, onPass, hideActions, onViewProfile, awaiting, rejected, onRemove }) {
  const { t } = useLang();
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 mb-2" data-testid={`applicant-${a.id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold flex items-center gap-1">{a.worker_name}
            {a.aadhaar_verified && <ShieldCheck size={14} className="text-[#0EA5E9]"/>}
            {a.skill_test_passed && <BadgeCheck size={14} className="text-[#16A34A]" data-testid={`skill-${a.id}`}/>}
          </p>
          <p className="text-xs text-[#4A5568]">{a.worker_skill} • {a.worker_city}</p>
          <p className="text-xs mt-1">⭐ Score {a.reliability_score} • {a.verified_jobs} verified jobs</p>
          <button onClick={onViewProfile} data-testid={`profile-${a.id}`}
                  className="mt-2 text-xs font-bold text-[#E65C00] flex items-center gap-1">
            <UserCircle size={13}/>{t.viewProfile}
          </button>
          {awaiting && (
            <p className="mt-2 text-xs text-[#EAB308] font-bold flex items-center gap-1">
              <Clock size={12} className="pulse-dot"/>{t.waitingForWorker}
            </p>
          )}
          {rejected && (
            <p className="mt-2 text-xs text-red-600 font-bold">{t.rejectedByWorker}</p>
          )}
        </div>
        {!hideActions && (
          <div className="flex gap-1 shrink-0">
            <button onClick={onPass} data-testid={`pass-${a.id}`}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:scale-95">
              <X size={18}/>
            </button>
            <button onClick={onHire} data-testid={`hire-${a.id}`}
                    className="w-10 h-10 rounded-full bg-[#16A34A] text-white flex items-center justify-center active:scale-95">
              <Check size={18}/>
            </button>
          </div>
        )}
        {rejected && onRemove && (
          <button onClick={onRemove} data-testid={`remove-${a.id}`}
                  className="shrink-0 px-3 py-2 rounded-lg bg-red-50 text-red-600 font-bold text-xs flex items-center gap-1">
            <Trash2 size={14}/>{t.remove}
          </button>
        )}
        {hideActions && !rejected && a.worker_phone && (
          <a href={`tel:${a.worker_phone}`} className="text-sm font-bold text-[#16A34A] shrink-0">{a.worker_phone}</a>
        )}
      </div>
    </div>
  );
}
