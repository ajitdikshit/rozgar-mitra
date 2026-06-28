import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";

const ACCOUNTS = [
  { username: "raju", label: "Raju (Plumber)", role: "worker" },
  { username: "suresh", label: "Suresh (Electrician)", role: "worker" },
  { username: "ramesh", label: "Ramesh (Employer)", role: "employer" },
  { username: "priya", label: "Priya (Employer)", role: "employer" },
];

export default function DemoBar() {
  const { login } = useAuth();
  const { lang, toggle } = useLang();
  const nav = useNavigate();
  const quick = async (u) => {
    try {
      const user = await login(u, "demo123");
      nav(user.role === "worker" ? "/w/jobs" : "/e/post");
    } catch { /* silent */ }
  };
  return (
    <div className="bg-yellow-100 border-b-2 border-yellow-300 px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar"
         data-testid="demo-bar">
      <span className="text-xs font-bold uppercase text-yellow-900 whitespace-nowrap">DEMO</span>
      {ACCOUNTS.map(a => (
        <button key={a.username} onClick={() => quick(a.username)}
                data-testid={`demo-${a.username}`}
                className="text-xs font-bold bg-white px-3 py-1.5 rounded-full border border-yellow-400 hover:bg-yellow-50 whitespace-nowrap">
          {a.label}
        </button>
      ))}
      <button onClick={toggle} data-testid="lang-toggle"
              className="ml-auto text-xs font-bold bg-[#1A202C] text-white px-3 py-1.5 rounded-full whitespace-nowrap">
        {lang === "en" ? "हिं" : "EN"}
      </button>
    </div>
  );
}
