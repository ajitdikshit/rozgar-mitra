import { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useLang } from "../context/LangContext";
import { useNavigate } from "react-router-dom";
import { TrustedBadge } from "../components/PassportCard";

export default function EmployerHistory() {
  const { t } = useLang();
  const nav = useNavigate();
  const [data, setData] = useState({ jobs: [], stats: {} });
  useEffect(() => { api.get("/employer/history").then(r => setData(r.data)); }, []);
  return (
    <div className="app-shell pb-24">
      <Navbar title={t.history} onBack={() => nav(-1)}/>
      <div className="p-4 space-y-3">
        <div className="bg-[#1A202C] text-white rounded-2xl p-5 grid grid-cols-2 gap-3" data-testid="emp-stats">
          <Stat label={t.jobsPosted} value={data.stats.jobs_posted}/>
          <Stat label={t.jobsCompleted} value={data.stats.jobs_completed}/>
          <Stat label={t.avgRating} value={data.stats.avg_rating}/>
          <Stat label="Reviews" value={data.stats.review_count}/>
          {data.stats.trusted && <div className="col-span-2"><TrustedBadge/></div>}
        </div>
        {data.jobs.map(j => (
          <div key={j.id} className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-4" data-testid={`eh-${j.id}`}>
            <p className="font-bold">{j.title}</p>
            <p className="text-xs text-[#4A5568]">{j.skill} • ₹{j.budget} • {j.status}</p>
          </div>
        ))}
      </div>
      <BottomNav role="employer"/>
    </div>
  );
}
function Stat({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-orange-300">{label}</p>
      <p className="text-3xl font-extrabold font-display">{value ?? 0}</p>
    </div>
  );
}
