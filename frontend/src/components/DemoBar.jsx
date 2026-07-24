import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import LanguagePicker, { LanguagePickerButton } from "./LanguagePicker";
import { useNavigate } from "react-router-dom";

const ACCOUNTS = [
  { username: "arjun",   label: "Arjun (Electrician)", role: "worker" },
  { username: "deepak",  label: "Deepak (Electrician)", role: "worker" },
  { username: "kavita",  label: "Kavita (Painter)",     role: "worker" },
  { username: "sunita",  label: "Sunita (Employer)",    role: "employer" },
  { username: "vikram",  label: "Vikram (Employer)",    role: "employer" },
  { username: "nandini", label: "Nandini (Employer)",   role: "employer" },
];

export default function DemoBar() {
  const { login, user } = useAuth();
  const [langOpen, setLangOpen] = useState(false);
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
      <div className="ml-auto shrink-0">
        <LanguagePickerButton onClick={() => setLangOpen(true)} testId="lang-toggle"/>
      </div>
      <LanguagePicker open={langOpen} onClose={() => setLangOpen(false)}/>
    </div>
  );
}