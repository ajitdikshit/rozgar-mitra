import { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useLang } from "../context/LangContext";
import { useNavigate } from "react-router-dom";
import { StarDisplay } from "../components/Stars";
import { RowListSkeleton } from "../components/Skeletons";

export default function History() {
  const { t } = useLang();
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/worker/history").then(r => setList(r.data)).finally(() => setLoading(false));
  }, []);
  return (
    <div className="app-shell pb-24">
      <Navbar title={t.history} onBack={() => nav(-1)}/>
      <div className="p-4 space-y-3">
        {loading && <RowListSkeleton count={4} />}
        {!loading && list.length === 0 && <p className="text-center text-[#4A5568] py-12" data-testid="no-history">No verified jobs yet.</p>}
        {!loading && list.map(r => (
          <div key={r.id} className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-4" data-testid={`work-${r.id}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold font-display">{r.title}</h3>
                <p className="text-xs text-[#4A5568]">{r.employer_company || r.employer_name}</p>
              </div>
              <span className="font-extrabold">₹{r.amount}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <StarDisplay stars={r.stars}/>
              <span className="text-xs text-[#4A5568]">{r.date?.slice(0,10)}</span>
            </div>
          </div>
        ))}
      </div>
      <BottomNav role="worker"/>
    </div>
  );
}
