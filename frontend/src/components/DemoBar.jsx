import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { useNavigate } from "react-router-dom";

const ACCOUNTS = [
  { username: "arjun",   label: "Arjun (Electrician)", role: "worker" },
  { username: "deepak",  label: "Deepak (Electrician)", role: "worker" },
  { username: "kavita",  label: "Kavita (Painter)",     role: "worker" },
  { username: "sunita",  label: "Sunita (Employer)",    role: "employer" },
  { username: "vikram",  label: "Vikram (Employer)",    role: "employer" },
  { username: "nandini", label: "Nandini (Employer)",   role: "employer" },
  { username: "raju", label: "Raju (Plumber)",   role: "worker" },
  { username: "suresh", label: "Suresh (Electrician)",   role: "worker" },
  { username: "ramesh", label: "ramesh (Employer)",   role: "employer" },
  { username: "priya", label: "Priya (Employer)",   role: "employer" }
  
];

export default function DemoBar() {
  const { login, user } = useAuth();
  const { lang, toggle } = useLang();
  const nav = useNavigate();

  const quick = async (account) => {
    if (user?.username === account.username) return;
    try {
      const u = await login(account.username, "demo123");
      nav(u.role === "worker" ? "/w/jobs" : "/e/post", { replace: true });
    } catch { /* silent */ }
  };

  return (
    <div className="bg-yellow-100 border-b-2 border-yellow-300 px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar"
         data-testid="demo-bar">
      <span className="text-xs font-bold uppercase text-yellow-900 whitespace-nowrap">DEMO</span>
      {ACCOUNTS.map(a => (
        <button key={a.username} onClick={() => quick(a)}
                data-testid={`demo-${a.username}`}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                  user?.username === a.username
                    ? "bg-yellow-400 border-yellow-500 text-yellow-900"
                    : "bg-white border-yellow-400 hover:bg-yellow-50"
                }`}>
          {a.label}
        </button>
      ))}
      <button onClick={toggle} data-testid="lang-toggle"
              className="ml-auto text-xs font-bold bg-[#1A202C] text-white px-3 py-1.5 rounded-full whitespace-nowrap shrink-0">
        {lang === "en" ? "हिं" : "EN"}
      </button>
    </div>
  );
}