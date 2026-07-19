import { useLocation, useNavigate } from "react-router-dom";
import { Search, Hammer, Clock, Mail, PlusSquare, Briefcase, Users, Activity } from "lucide-react";
import { useLang } from "../context/LangContext";

const WORKER_TABS = (t) => [
  { id: "search", to: "/w/jobs", icon: Search, label: t.search },
  { id: "active", to: "/w/active", icon: Hammer, label: t.active },
  { id: "pending", to: "/w/pending", icon: Clock, label: t.pending },
  { id: "invites", to: "/w/invites", icon: Mail, label: t.invites },
];
const EMPLOYER_TABS = (t) => [
  { id: "post", to: "/e/post", icon: PlusSquare, label: t.postJob },
  { id: "jobs", to: "/e/jobs", icon: Briefcase, label: t.myJobs },
  { id: "workers", to: "/e/workers", icon: Users, label: t.workers },
  { id: "active", to: "/e/active", icon: Activity, label: t.activeJobs },
];

export default function BottomNav({ role, badges = {} }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { t } = useLang();
  const tabs = role === "worker" ? WORKER_TABS(t) : EMPLOYER_TABS(t);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-[#E2E8F0] h-20 flex"
         style={{ maxWidth: "28rem", margin: "0 auto" }}
         data-testid="bottom-nav">
      {tabs.map(tab => {
        const active = loc.pathname === tab.to;
        const Icon = tab.icon;
        return (
          <button key={tab.id} onClick={() => nav(tab.to)} data-testid={`tab-${tab.id}`}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors ${active ? "text-[#E65C00]" : "text-[#4A5568]"}`}>
            <Icon size={22} strokeWidth={active ? 2.7 : 2}/>
            <span className={`text-[11px] ${active ? "font-bold" : "font-medium"}`}>{tab.label}</span>
            {badges[tab.id] > 0 && (
              <span data-testid={`badge-${tab.id}`}
                    className="absolute top-1.5 right-1/2 translate-x-5 bg-[#E65C00] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {badges[tab.id]}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
