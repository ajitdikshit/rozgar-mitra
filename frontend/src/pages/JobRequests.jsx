import { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import WorkerDrawer from "../components/WorkerDrawer";
import Modal from "../components/Modal";
import EmployerProfilePanel from "../components/EmployerProfilePanel";
import { useLang } from "../context/LangContext";
import { Check, X, Phone, MailOpen, UserCircle } from "lucide-react";

export default function JobRequests() {
  const { t } = useLang();
  const [list, setList] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [employerProfile, setEmployerProfile] = useState(null);

  const load = async () => {
    const { data } = await api.get("/worker/invites");
    setList(data);
  };
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, []);

  const respond = async (id, action) => {
    await api.post(`/worker/invite/${id}/respond?action=${action}`);
    load();
  };

  const viewEmployer = async (employerId) => {
    const { data } = await api.get(`/worker/employer/${employerId}/profile`);
    setEmployerProfile(data);
  };

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.invites} onMenu={() => setDrawer(true)}/>
      <WorkerDrawer open={drawer} onClose={() => setDrawer(false)}/>
      <div className="p-4 space-y-3">
        {list.length === 0 && (
          <div className="text-center py-12 text-[#4A5568]" data-testid="no-invites">
            <MailOpen size={40} className="mx-auto mb-2 opacity-40"/>
            <p>{t.noInvites}</p>
          </div>
        )}
        {list.map(inv => (
          <div key={inv.id} className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-4" data-testid={`invite-${inv.id}`}>
            <p className="text-xs font-bold uppercase tracking-widest text-[#E65C00]">{t.invitedFor}</p>
            <h3 className="font-bold font-display text-lg">{inv.job?.title}</h3>
            <p className="text-sm text-[#4A5568]">{inv.job?.area}, {inv.job?.city}</p>
            <p className="text-sm mt-1"><b>₹{inv.job?.budget}</b> • {inv.employer_name}</p>
            <button onClick={() => viewEmployer(inv.employer_id)} data-testid={`emp-profile-inv-${inv.id}`}
                    className="mt-2 text-xs font-bold text-[#E65C00] flex items-center gap-1">
              <UserCircle size={14}/>{t.viewEmployer}
            </button>
            {inv.status === "pending" && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button onClick={() => respond(inv.id, "decline")} data-testid={`decline-${inv.id}`}
                        className="py-2.5 bg-white border-2 border-[#E2E8F0] font-bold rounded-xl flex items-center justify-center gap-1">
                  <X size={16}/>{t.decline}
                </button>
                <button onClick={() => respond(inv.id, "accept")} data-testid={`accept-${inv.id}`}
                        className="py-2.5 bg-[#16A34A] text-white font-bold rounded-xl flex items-center justify-center gap-1">
                  <Check size={16}/>{t.accept}
                </button>
              </div>
            )}
            {inv.status === "accepted" && (
              <a href={`tel:${inv.employer_phone}`} data-testid={`call-inv-${inv.id}`}
                 className="mt-3 block text-center w-full bg-[#16A34A] text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2">
                <Phone size={16}/>{inv.employer_phone}
              </a>
            )}
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
