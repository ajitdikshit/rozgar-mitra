import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import WorkerDrawer from "../components/WorkerDrawer";
import { useLang } from "../context/LangContext";
import { Check, X, MailOpen } from "lucide-react";
import useNotifications from "../hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function JobRequests() {
  const { t } = useLang();
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const prevIds = useRef(null);
  const { notify } = useNotifications();
  const load = async () => {
    const { data } = await api.get("/worker/invites");
    const ids = new Set(data.filter(i => i.status === "pending").map(i => i.id));
    if (prevIds.current) {
      for (const inv of data) {
        if (inv.status === "pending" && !prevIds.current.has(inv.id)) {
          notify("New job invite", `${inv.employer_name}: ${inv.job?.title}`,
                 () => nav("/w/invites"));
        }
      }
    }
    prevIds.current = ids;
    setList(data);
  };
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respond = async (id, action) => {
    try {
      await api.post(`/worker/invite/${id}/respond?action=${action}`);
      if (action === "accept") {
        nav("/w/active", { replace: true });
      } else {
        load();
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not respond to invite");
    }
  };

  // Only show pending invites — accepted ones move to Active Job, declined are dismissed
  const visible = list.filter(inv => inv.status === "pending");

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.invites} onMenu={() => setDrawer(true)}/>
      <WorkerDrawer open={drawer} onClose={() => setDrawer(false)}/>
      <div className="p-4 space-y-3">
        {visible.length === 0 && (
          <div className="text-center py-12 text-[#4A5568]" data-testid="no-invites">
            <MailOpen size={40} className="mx-auto mb-2 opacity-40"/>
            <p>{t.noInvites}</p>
          </div>
        )}
        {visible.map(inv => (
          <div key={inv.id} className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-4" data-testid={`invite-${inv.id}`}>
            <p className="text-xs font-bold uppercase tracking-widest text-[#E65C00]">{t.invitedFor}</p>
            <h3 className="font-bold font-display text-lg">{inv.job?.title}</h3>
            <p className="text-sm text-[#4A5568]">{inv.job?.area}, {inv.job?.city}</p>
            <p className="text-sm mt-1"><b>₹{inv.job?.budget}</b> • {inv.employer_name}</p>
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
          </div>
        ))}
      </div>
      <BottomNav role="worker"/>
    </div>
  );
}