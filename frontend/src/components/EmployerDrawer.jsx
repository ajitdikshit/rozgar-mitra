import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { Building2, History, Star, LogOut, X } from "lucide-react";

export default function EmployerDrawer({ open, onClose }) {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useLang();
  if (!open) return null;
  const go = (p) => { onClose(); nav(p); };
  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55]" onClick={onClose} data-testid="drawer-overlay"/>
      <div className="fixed inset-y-0 left-0 w-4/5 max-w-xs bg-white shadow-2xl z-[60] drawer-anim flex flex-col"
           data-testid="employer-drawer">
        <div className="bg-[#1A202C] text-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-orange-300">{t.employer}</p>
              <h2 className="text-2xl font-extrabold font-display mt-1">{user?.name}</h2>
              <p className="text-sm text-gray-300">{user?.company}</p>
            </div>
            <button onClick={onClose} data-testid="drawer-close" className="p-1"><X size={22}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <Item icon={Building2} label={t.profile} onClick={() => go("/e/profile")} tid="emp-menu-profile"/>
          <Item icon={History} label={t.history} onClick={() => go("/e/history")} tid="emp-menu-history"/>
          <Item icon={Star} label={t.reviews} onClick={() => go("/e/reviews")} tid="emp-menu-reviews"/>
          <div className="border-t my-3"/>
          <Item icon={LogOut} label={t.logout} onClick={logout} tid="emp-menu-logout" danger/>
        </div>
      </div>
    </>
  );
}

function Item({ icon: Icon, label, onClick, tid, danger }) {
  return (
    <button onClick={onClick} data-testid={tid}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-gray-100 ${danger ? "text-red-600" : ""}`}>
      <Icon size={20} strokeWidth={2.4}/>
      <span className="font-bold text-base">{label}</span>
    </button>
  );
}
