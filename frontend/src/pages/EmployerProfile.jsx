import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";
import { useNavigate } from "react-router-dom";

export default function EmployerProfile() {
  const { user } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  if (!user) return null;
  return (
    <div className="app-shell pb-24">
      <Navbar title={t.profile} onBack={() => nav(-1)}/>
      <div className="p-4 space-y-3" data-testid="emp-profile">
        <Row label={t.name} value={user.name}/>
        <Row label={t.company} value={user.company}/>
        <Row label={t.username} value={user.username}/>
        <Row label={t.phone} value={user.phone}/>
        <Row label={t.city} value={user.city}/>
        <Row label={t.area} value={user.area}/>
      </div>
      <BottomNav role="employer"/>
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div className="bg-white border-2 border-[#E2E8F0] rounded-xl p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-[#4A5568]">{label}</p>
      <p className="font-bold text-base mt-0.5">{value || "—"}</p>
    </div>
  );
}
