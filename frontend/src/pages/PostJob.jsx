import { useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import EmployerDrawer from "../components/EmployerDrawer";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { CheckCircle2 } from "lucide-react";

const SKILLS = ["Plumber", "Electrician", "Painter", "Mason", "Carpenter", "Driver", "Helper", "AC Technician"];

export default function PostJob() {
  const { t } = useLang();
  const { user } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "", skill: "Plumber", description: "",
    city: user?.city || "", area: user?.area || "", address: "",
    budget: 500, workers_needed: 1, deadline: ""
  });
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post("/employer/jobs", {
        ...form,
        budget: Number(form.budget) || 0,
        workers_needed: Number(form.workers_needed) || 1,
        deadline: form.deadline || null,
      });
      setDone(true);
      setForm({ ...form, title: "", description: "", address: "" });
      setTimeout(() => setDone(false), 2500);
    } finally { setBusy(false); }
  };

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.postJob} onMenu={() => setDrawer(true)}/>
      <EmployerDrawer open={drawer} onClose={() => setDrawer(false)}/>
      {done && (
        <div className="m-4 bg-green-50 border-2 border-green-300 rounded-xl p-3 flex items-center gap-2" data-testid="post-success">
          <CheckCircle2 className="text-green-600"/> <span className="font-bold text-green-800">Job posted!</span>
        </div>
      )}
      <form onSubmit={submit} className="p-4 space-y-3">
        <Field label={t.title} val={form.title} onChange={v => upd("title", v)} tid="post-title" required/>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-[#4A5568]">{t.skill}</label>
          <select value={form.skill} onChange={e => upd("skill", e.target.value)}
                  data-testid="post-skill"
                  className="w-full mt-1 px-4 py-3 border-2 border-[#E2E8F0] rounded-xl bg-white">
            {SKILLS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-[#4A5568]">{t.description}</label>
          <textarea value={form.description} onChange={e => upd("description", e.target.value)} rows={3}
                    data-testid="post-desc" required
                    className="w-full mt-1 px-4 py-3 border-2 border-[#E2E8F0] rounded-xl outline-none focus:border-[#E65C00]"/>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t.city} val={form.city} onChange={v => upd("city", v)} tid="post-city" required/>
          <Field label={t.area} val={form.area} onChange={v => upd("area", v)} tid="post-area" required/>
        </div>
        <Field label={t.address} val={form.address} onChange={v => upd("address", v)} tid="post-address" required/>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t.budget + " (₹)"} val={form.budget} onChange={v => upd("budget", v)} type="number" tid="post-budget"/>
          <Field label={t.workersNeeded} val={form.workers_needed} onChange={v => upd("workers_needed", v)} type="number" tid="post-workers"/>
        </div>
        <Field label={t.deadline} val={form.deadline} onChange={v => upd("deadline", v)} type="date" tid="post-deadline"/>
        <button type="submit" disabled={busy} data-testid="post-submit"
                className="w-full py-4 bg-[#E65C00] text-white font-bold text-lg rounded-xl shadow active:scale-95 transition-transform disabled:opacity-60">
          {busy ? "..." : t.postJobCta}
        </button>
      </form>
      <BottomNav role="employer"/>
    </div>
  );
}
function Field({ label, val, onChange, type = "text", tid, required }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-widest text-[#4A5568]">{label}</label>
      <input type={type} value={val} onChange={e => onChange(e.target.value)} required={required}
             data-testid={tid}
             className="w-full mt-1 px-4 py-3 border-2 border-[#E2E8F0] rounded-xl bg-white outline-none focus:border-[#E65C00]"/>
    </div>
  );
}
