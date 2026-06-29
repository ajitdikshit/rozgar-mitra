import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import WorkerDrawer from "../components/WorkerDrawer";
import { useLang } from "../context/LangContext";
import { Clock, X, Trash2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useNotifications, { diffAndNotify } from "../hooks/useNotifications";
import { toast } from "sonner";

export default function PendingJobs() {
  const { t } = useLang();
  const nav = useNavigate();
  const [apps, setApps] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    // persist dismissed rejected apps across refreshes
    try { return new Set(JSON.parse(localStorage.getItem("rm_dismissed") || "[]")); }
    catch { return new Set(); }
  });
  const prevRef = useRef(null);
  const { notify } = useNotifications();

  const load = async () => {
    const { data } = await api.get("/worker/applications");
    diffAndNotify(prevRef.current, data, notify, (a, before) => {
      if (!before) return null;
      if (before.status === "pending" && a.status === "hired") {
        return { title: "You're hired!", body: `${a.job.title} — ₹${a.job.budget}`,
                 onClick: () => nav("/w/active") };
      }
      if (before.status === "pending" && a.status === "rejected_by_employer") {
        return { title: "Application result", body: `${a.job.title}: not selected this time` };
      }
      return null;
    });
    prevRef.current = data;
    setApps(data);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withdraw = async (job_id) => {
    try {
      await api.post(`/worker/withdraw/${job_id}`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not withdraw");
    }
  };

  const dismiss = (app_id) => {
    const next = new Set(dismissed);
    next.add(app_id);
    setDismissed(next);
    localStorage.setItem("rm_dismissed", JSON.stringify([...next]));
  };

  // hired apps go to Active Job tab — hide them here
  // dismissed rejected apps are hidden
  const visible = apps.filter(a =>
    a.status !== "hired" &&
    !(a.status === "rejected_by_employer" && dismissed.has(a.id))
  );

  const pendingCount = visible.filter(a => a.status === "pending").length;
  const rejectedCount = visible.filter(a => a.status === "rejected_by_employer").length;

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.pending} onMenu={() => setDrawer(true)}/>
      <WorkerDrawer open={drawer} onClose={() => setDrawer(false)}/>
      <div className="p-4 space-y-3">
        {visible.length === 0 && (
          <p className="text-center text-[#4A5568] py-12" data-testid="no-pending">
            {t.noPending}
          </p>
        )}

        {/* Pending section */}
        {pendingCount > 0 && (
          <p className="text-xs font-bold uppercase tracking-widest text-[#4A5568]">
            Waiting for response ({pendingCount})
          </p>
        )}
        {visible.filter(a => a.status === "pending").map(a => (
          <div key={a.id} className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-4"
               data-testid={`pending-${a.job_id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold font-display truncate">{a.job.title}</h3>
                <p className="text-xs text-[#4A5568]">{a.job.area}, {a.job.city}</p>
              </div>
              <span className="font-bold shrink-0">₹{a.job.budget}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
              <span className="flex items-center gap-2 text-[#EAB308] font-bold text-sm">
                <Clock size={16} className="pulse-dot"/> {t.waitingForDecision}
              </span>
              <button onClick={() => withdraw(a.job_id)} data-testid={`withdraw-${a.job_id}`}
                      className="text-red-600 text-sm font-bold flex items-center gap-1 active:scale-95">
                <X size={14}/>{t.withdraw}
              </button>
            </div>
          </div>
        ))}

        {/* Rejected section */}
        {rejectedCount > 0 && (
          <p className="text-xs font-bold uppercase tracking-widest text-red-500 mt-4">
            Not selected ({rejectedCount})
          </p>
        )}
        {visible.filter(a => a.status === "rejected_by_employer").map(a => (
          <div key={a.id} className="bg-red-50 border-2 border-red-200 rounded-2xl p-4"
               data-testid={`rejected-${a.job_id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold font-display truncate text-[#1A202C]">{a.job.title}</h3>
                <p className="text-xs text-[#4A5568]">{a.job.area}, {a.job.city}</p>
              </div>
              <span className="font-bold shrink-0 text-[#4A5568]">₹{a.job.budget}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-red-200 flex items-center justify-between">
              <span className="flex items-center gap-2 text-red-600 font-bold text-sm">
                <XCircle size={16}/> {t.rejected}
              </span>
              <button onClick={() => dismiss(a.id)} data-testid={`dismiss-${a.job_id}`}
                      className="flex items-center gap-1 text-sm font-bold text-[#4A5568] bg-white border border-red-200 px-3 py-1.5 rounded-full active:scale-95">
                <Trash2 size={13}/> Delete
              </button>
            </div>
          </div>
        ))}


      </div>
      <BottomNav role="worker"/>
    </div>
  );
}