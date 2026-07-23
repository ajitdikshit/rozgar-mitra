import { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import WorkerDrawer from "../components/WorkerDrawer";
import PassportCard from "../components/PassportCard";
import { useLang } from "../context/LangContext";
import { useAuth } from "../context/AuthContext";
import { Zap, GraduationCap, BadgeCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PassportSkeleton } from "../components/Skeletons";

export default function Passport() {
  const { t } = useLang();
  const { user, refreshMe } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const urgent = user?.urgent_until && new Date(user.urgent_until) > new Date();

  useEffect(() => {
    api.get("/worker/passport").then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  const toggleUrgent = async () => {
    await api.post("/worker/urgent", { enable: !urgent });
    await refreshMe();
  };

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.yourPassport} onMenu={() => setDrawer(true)}/>
      <WorkerDrawer open={drawer} onClose={() => setDrawer(false)}/>
      <div className="p-4 space-y-4">
        {loading ? <PassportSkeleton /> : <PassportCard data={data}/>}
        <button onClick={() => nav("/w/skill-test")} data-testid="skill-test-cta"
                className={`w-full py-4 font-bold text-lg rounded-xl flex items-center justify-center gap-2 border-2 ${user?.skill_test_passed ? "bg-green-50 border-green-400 text-green-700" : "bg-white border-[#E2E8F0] text-[#1A202C]"}`}>
          {user?.skill_test_passed ? (
            <><BadgeCheck size={20}/> Skill Verified — Retake test</>
          ) : (
            <><GraduationCap size={20}/> Take the Skill Test</>
          )}
        </button>
        <button onClick={toggleUrgent} data-testid="urgent-toggle"
                className={`w-full py-4 font-bold text-lg rounded-xl flex items-center justify-center gap-2 border-2 ${urgent ? "bg-green-50 border-green-400 text-green-700" : "bg-[#1A202C] border-[#1A202C] text-white"}`}>
          {urgent ? (
            <><span className="w-2 h-2 bg-green-500 rounded-full pulse-dot"/> {t.urgentActive}</>
          ) : (
            <><Zap size={20}/> {t.urgentNow}</>
          )}
        </button>
      </div>
      <BottomNav role="worker"/>
    </div>
  );
}
