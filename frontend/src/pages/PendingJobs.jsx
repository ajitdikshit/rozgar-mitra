import { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import WorkerDrawer from "../components/WorkerDrawer";
import Modal from "../components/Modal";
import EmployerProfilePanel from "../components/EmployerProfilePanel";
import { useLang } from "../context/LangContext";
import { Clock, X, UserCircle, Check, Briefcase } from "lucide-react";

export default function PendingJobs() {
  const { t } = useLang();
  const [apps, setApps] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [employerProfile, setEmployerProfile] = useState(null);

  const load = async () => {
    const { data } = await api.get("/worker/applications");
    setApps(data.filter(a => a.status !== "hired"));
  };
  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id); }, []);

  const withdraw = async (id) => { await api.post(`/worker/withdraw/${id}`); load(); };

  const respondOffer = async (appId, action) => {
    await api.post(`/worker/offer/${appId}/respond?action=${action}`);
    load();
  };

  const viewEmployer = async (employerId) => {
    const { data } = await api.get(`/worker/employer/${employerId}/profile`);
    setEmployerProfile(data);
  };

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.pending} onMenu={() => setDrawer(true)}/>
      <WorkerDrawer open={drawer} onClose={() => setDrawer(false)}/>
      <div className="p-4 space-y-3">
        {apps.length === 0 && <p className="text-center text-[#4A5568] py-12" data-testid="no-pending">{t.noPending}</p>}
        {apps.map(a => (
          <div key={a.id} className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-4" data-testid={`pending-${a.job_id}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold font-display">{a.job.title}</h3>
                <p className="text-xs text-[#4A5568]">{a.job.area}, {a.job.city}</p>
              </div>
              <span className="font-bold">₹{a.job.budget}</span>
            </div>
            <button onClick={() => viewEmployer(a.job.employer_id)} data-testid={`emp-profile-${a.job_id}`}
                    className="mt-2 text-xs font-bold text-[#E65C00] flex items-center gap-1">
              <UserCircle size={14}/>{t.viewEmployer}: {a.employer_name}
            </button>
            <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
              {a.status === "pending" && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[#EAB308] font-bold text-sm">
                    <Clock size={16} className="pulse-dot"/> {t.waitingForDecision}
                  </span>
                  <button onClick={() => withdraw(a.job_id)} data-testid={`withdraw-${a.job_id}`}
                          className="text-red-600 text-sm font-bold flex items-center gap-1">
                    <X size={14}/>{t.withdraw}
                  </button>
                </div>
              )}
              {a.status === "offer_pending" && (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-[#E65C00] font-bold text-sm">
                    <Briefcase size={16}/>{t.offerReceived}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => respondOffer(a.id, "decline")} data-testid={`decline-offer-${a.id}`}
                            className="py-2.5 bg-white border-2 border-[#E2E8F0] font-bold rounded-xl flex items-center justify-center gap-1 text-sm">
                      <X size={16}/>{t.declineOffer}
                    </button>
                    <button onClick={() => respondOffer(a.id, "accept")} data-testid={`accept-offer-${a.id}`}
                            className="py-2.5 bg-[#16A34A] text-white font-bold rounded-xl flex items-center justify-center gap-1 text-sm">
                      <Check size={16}/>{t.acceptOffer}
                    </button>
                  </div>
                </div>
              )}
              {a.status === "rejected_by_employer" && (
                <p className="text-red-600 font-bold text-sm">{t.rejected}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!employerProfile} onClose={() => setEmployerProfile(null)} title={t.employerProfile}>
        <EmployerProfilePanel data={employerProfile}/>
      </Modal>

      <BottomNav role="worker"/>
    </div>
  );
}
