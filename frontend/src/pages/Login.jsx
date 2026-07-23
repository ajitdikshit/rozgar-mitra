import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import DemoBar from "../components/DemoBar";
import { useNavigate } from "react-router-dom";
import { Hammer, Building2 } from "lucide-react";
import { SKILLS } from "../constants/skills";

export default function Login() {
  const { login, register } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("worker");
  const [form, setForm] = useState({ username: "", password: "", name: "", phone: "",
                                     city: "", area: "", skill: "Plumber", experience_years: 1,
                                     company: "", aadhaar_verified: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const user = mode === "login"
        ? await login(form.username, form.password)
        : await register({ ...form, role });
      nav(user.role === "worker" ? "/w/jobs" : "/e/post");
    } catch (er) {
      const d = er?.response?.data?.detail;
      setErr(typeof d === "string" ? d : "Something went wrong");
    } finally { setBusy(false); }
  };

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="app-shell">
      <DemoBar/>
      <div className="p-6">
        <div className="text-center mb-6 mt-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E65C00] text-white shadow-lg mb-3">
            <Hammer size={32} strokeWidth={2.5}/>
          </div>
          <h1 className="text-3xl font-black font-display">{t.appName}</h1>
          <p className="text-sm text-[#4A5568]">{t.tagline}</p>
        </div>

        <div className="flex gap-2 mb-5 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setMode("login")} data-testid="tab-login"
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm ${mode === "login" ? "bg-white shadow" : "text-[#4A5568]"}`}>
            {t.login}
          </button>
          <button onClick={() => setMode("register")} data-testid="tab-register"
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm ${mode === "register" ? "bg-white shadow" : "text-[#4A5568]"}`}>
            {t.register}
          </button>
        </div>

        {mode === "register" && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button onClick={() => setRole("worker")} data-testid="role-worker"
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 ${role === "worker" ? "border-[#E65C00] bg-orange-50" : "border-gray-200"}`}>
              <Hammer size={22}/>
              <span className="font-bold text-sm">{t.worker}</span>
            </button>
            <button onClick={() => setRole("employer")} data-testid="role-employer"
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 ${role === "employer" ? "border-[#E65C00] bg-orange-50" : "border-gray-200"}`}>
              <Building2 size={22}/>
              <span className="font-bold text-sm">{t.employer}</span>
            </button>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <Field label={t.username} val={form.username} onChange={v => upd("username", v)} tid="input-username"/>
          <Field label={t.password} val={form.password} onChange={v => upd("password", v)} type="password" tid="input-password"/>
          {mode === "register" && (
            <>
              <Field label={t.name} val={form.name} onChange={v => upd("name", v)} tid="input-name"/>
              <Field label={t.phone} val={form.phone} onChange={v => upd("phone", v)} tid="input-phone"/>
              <Field label={t.city} val={form.city} onChange={v => upd("city", v)} tid="input-city"/>
              <Field label={t.area} val={form.area} onChange={v => upd("area", v)} tid="input-area"/>
              {role === "worker" ? (
                <>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#4A5568]">{t.skill}</label>
                    <select value={form.skill} onChange={e => upd("skill", e.target.value)}
                            data-testid="input-skill"
                            className="w-full mt-1 px-4 py-3 border-2 border-[#E2E8F0] rounded-xl bg-white">
                      {SKILLS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <Field label={t.experience} val={form.experience_years} onChange={v => upd("experience_years", parseInt(v) || 0)} type="number" tid="input-exp"/>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.aadhaar_verified} onChange={e => upd("aadhaar_verified", e.target.checked)} data-testid="input-aadhaar"/>
                    {t.aadhaarVerified}
                  </label>
                </>
              ) : (
                <Field label={t.company} val={form.company} onChange={v => upd("company", v)} tid="input-company"/>
              )}
            </>
          )}
          {err && <p className="text-red-600 text-sm font-bold" data-testid="error-msg">{err}</p>}
          <button type="submit" disabled={busy} data-testid="submit-btn"
                  className="w-full py-4 bg-[#E65C00] text-white font-bold text-lg rounded-xl shadow active:scale-95 transition-transform disabled:opacity-60">
            {busy ? "..." : mode === "login" ? t.login : t.continue}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, val, onChange, type = "text", tid }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-widest text-[#4A5568]">{label}</label>
      <input type={type} value={val} onChange={e => onChange(e.target.value)}
             data-testid={tid}
             className="w-full mt-1 px-4 py-3 border-2 border-[#E2E8F0] rounded-xl bg-white text-base focus:border-[#E65C00] outline-none"/>
    </div>
  );
}
