import { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import EmployerDrawer from "../components/EmployerDrawer";
import Modal from "../components/Modal";
import PassportCard from "../components/PassportCard";
import WorkerHistoryPanel from "../components/WorkerHistoryPanel";
import { useLang } from "../context/LangContext";
import { Zap, ShieldCheck, BadgeCheck } from "lucide-react";

const SKILLS = ["Plumber", "Electrician", "Painter", "Mason", "Carpenter", "Driver", "Helper", "AC Technician"];

export default function BrowseWorkers() {
  const { t } = useLang();
  const [list, setList] = useState([]);
  const [skill, setSkill] = useState("");
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [passport, setPassport] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    const params = {};
    if (skill) params.skill = skill;
    if (q) params.q = q;
    const { data } = await api.get("/employer/workers", { params });
    setList(data);
  };
  useEffect(() => { load(); }, [skill, q]);

  const openPassport = async (w) => {
    const { data } = await api.get(`/employer/worker/${w.id}/passport`);
    setPassport(data);
  };

  const openInvite = async (worker_id) => {
    const { data } = await api.get("/employer/jobs");
    setJobs(data.filter(j => j.status === "open"));
    setInviting({ worker_id });
  };
  const sendInvite = async (job_id) => {
    await api.post("/employer/invite", { worker_id: inviting.worker_id, job_id });
    setInviting(false);
    setPassport(null);
  };

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.workers} onMenu={() => setDrawer(true)}/>
      <EmployerDrawer open={drawer} onClose={() => setDrawer(false)}/>
      <div className="p-4 space-y-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.searchPlaceholder}
               data-testid="worker-search"
               className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-xl bg-white"/>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <Chip active={!skill} onClick={() => setSkill("")} tid="wfilter-all">{t.allSkills}</Chip>
          {SKILLS.map(s => <Chip key={s} active={skill === s} onClick={() => setSkill(s)} tid={`wfilter-${s}`}>{s}</Chip>)}
        </div>
      </div>
      <div className="px-4 space-y-3">
        {list.map(w => (
          <div key={w.id} className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-4" data-testid={`worker-${w.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold flex items-center gap-1">
                  {w.name}
                  {w.aadhaar_verified && <ShieldCheck size={14} className="text-[#0EA5E9]"/>}
                  {w.skill_test_passed && <BadgeCheck size={14} className="text-[#16A34A]" data-testid={`bw-skill-${w.id}`}/>}
                  {w.urgent_available && (
                    <span data-testid={`urgent-${w.id}`}
                          className="inline-flex items-center gap-1 ml-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full pulse-dot"/>LIVE
                    </span>
                  )}
                </p>
                <p className="text-xs text-[#4A5568]">{w.skill} • {w.area}, {w.city}</p>
                <p className="text-xs mt-1">⭐ {w.reliability_score} • {w.verified_jobs} jobs</p>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => openPassport(w)} data-testid={`view-${w.id}`}
                        className="text-xs bg-[#1A202C] text-white px-3 py-1.5 rounded-full font-bold">{t.viewProfile}</button>
                <button onClick={() => openInvite(w.id)} data-testid={`invite-${w.id}`}
                        className="text-xs bg-[#E65C00] text-white px-3 py-1.5 rounded-full font-bold">Invite</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!passport && !inviting} onClose={() => setPassport(null)} title={t.viewProfile}>
        <PassportCard data={passport} showShare={false}/>
        <WorkerHistoryPanel history={passport?.history} reviews={passport?.reviews}/>
        {passport && (
          <button onClick={() => openInvite(passport.user.id)} data-testid="modal-invite"
                  className="w-full mt-3 py-3 bg-[#E65C00] text-white font-bold rounded-xl">
            {t.sendInvite}
          </button>
        )}
      </Modal>

      <Modal open={!!inviting} onClose={() => setInviting(false)} title={t.sendInvite}>
        {jobs.length === 0 && <p className="text-sm text-[#4A5568]">No open jobs to invite to. Post a job first.</p>}
        {jobs.map(j => (
          <button key={j.id} onClick={() => sendInvite(j.id)} data-testid={`invite-job-${j.id}`}
                  className="w-full text-left bg-white border-2 border-[#E2E8F0] rounded-xl p-3 mb-2 active:bg-gray-50">
            <p className="font-bold">{j.title}</p>
            <p className="text-xs text-[#4A5568]">{j.skill} • ₹{j.budget}</p>
          </button>
        ))}
      </Modal>

      <BottomNav role="employer"/>
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
