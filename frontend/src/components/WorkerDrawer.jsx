import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { User, History, Star, LogOut, X, Power, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../api/axios";
import useNotifications from "../hooks/useNotifications";

export default function WorkerDrawer({ open, onClose }) {
  const nav = useNavigate();
  const { user, logout, refreshMe } = useAuth();
  const { t } = useLang();
  const [available, setAvailable] = useState(user?.available ?? true);
  const [score, setScore] = useState(0);
  const { requestPermission } = useNotifications();
  const [notifState, setNotifState] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  useEffect(() => {
    if (open) {
      api.get("/worker/passport").then(r => setScore(r.data.reliability_score || 0)).catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const toggleAvailable = async () => {
    const next = !available;
    setAvailable(next);
    await api.post("/worker/availability", { available: next });
    await refreshMe();
  };

  const go = (path) => { onClose(); nav(path); };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55]" onClick={onClose}
           data-testid="drawer-overlay"/>
      <div className="fixed inset-y-0 left-0 w-4/5 max-w-xs bg-white shadow-2xl z-[60] drawer-anim flex flex-col"
           data-testid="worker-drawer">
        <div className="bg-[#1A202C] text-white p-5 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-orange-300">{t.worker}</p>
              <h2 className="text-2xl font-extrabold font-display mt-1">{user?.name}</h2>
              <p className="text-sm text-gray-300">{user?.skill} • {user?.city}</p>
            </div>
            <button onClick={onClose} data-testid="drawer-close" className="p-1"><X size={22}/></button>
          </div>
          <div className="mt-4 bg-white/10 rounded-xl p-3">
            <div className="flex justify-between text-xs mb-1.5"><span>{t.reliabilityScore}</span><span className="font-bold">{score}/100</span></div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-[#E65C00] rounded-full transition-all" style={{ width: `${score}%` }}/>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <button onClick={toggleAvailable} data-testid="toggle-availability"
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl mb-2 ${available ? "bg-green-50 border-2 border-green-300" : "bg-gray-100 border-2 border-gray-300"}`}>
            <span className="flex items-center gap-2 font-bold text-sm">
              <Power size={18}/>{available ? t.youAreOnline : t.youAreOffline}
            </span>
            <span className={`w-10 h-6 rounded-full relative ${available ? "bg-green-500" : "bg-gray-400"}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${available ? "left-[18px]" : "left-0.5"}`}/>
            </span>
          </button>

          <DrawerItem icon={User} label={t.profile} onClick={() => go("/w/profile")} tid="menu-profile"/>
          <DrawerItem icon={History} label={t.history} onClick={() => go("/w/history")} tid="menu-history"/>
          <DrawerItem icon={Star} label={t.reviews} onClick={() => go("/w/reviews")} tid="menu-reviews"/>
          <DrawerItem icon={User} label={t.yourPassport} onClick={() => go("/w/passport")} tid="menu-passport"/>
          {notifState !== "unsupported" && (
            <button onClick={async () => {
                      if (notifState === "granted") return;
                      if (notifState === "denied") {
                        alert("Notifications are blocked in your browser. Go to browser Settings → Site permissions → Notifications to allow.");
                        return;
                      }
                      const ok = await requestPermission();
                      setNotifState(ok ? "granted" : "denied");
                    }}
                    data-testid="menu-notif"
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-gray-100">
              <Bell size={20} strokeWidth={2.4}
                    className={notifState === "granted" ? "text-green-500" : notifState === "denied" ? "text-red-400" : ""}/>
              <span className="font-bold text-base">
                {notifState === "granted" ? "Notifications Enabled ✓"
                  : notifState === "denied" ? "Notifications Blocked"
                  : "Enable Notifications"}
              </span>
            </button>
          )}
          <div className="border-t my-3"/>
          <DrawerItem icon={LogOut} label={t.logout} onClick={logout} tid="menu-logout" danger/>
        </div>
      </div>
    </>
  );
}

function DrawerItem({ icon: Icon, label, onClick, tid, danger }) {
  return (
    <button onClick={onClick} data-testid={tid}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-gray-100 ${danger ? "text-red-600" : ""}`}>
      <Icon size={20} strokeWidth={2.4}/>
      <span className="font-bold text-base">{label}</span>
    </button>
  );
}