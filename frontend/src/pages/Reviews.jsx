import { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useLang } from "../context/LangContext";
import { useNavigate } from "react-router-dom";
import { StarDisplay } from "../components/Stars";
import { RowListSkeleton } from "../components/Skeletons";
import { Skeleton } from "../components/ui/skeleton";

export default function Reviews() {
  const { t } = useLang();
  const nav = useNavigate();
  const [data, setData] = useState({ reviews: [], avg: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/worker/reviews").then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);
  return (
    <div className="app-shell pb-24">
      <Navbar title={t.reviews} onBack={() => nav(-1)}/>
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="bg-[#1A202C] rounded-2xl p-5 text-center space-y-2" data-testid="avg-card-skeleton">
            <Skeleton className="h-3 w-24 mx-auto bg-white/10" />
            <Skeleton className="h-12 w-16 mx-auto bg-white/20" />
            <Skeleton className="h-3 w-20 mx-auto bg-white/10" />
          </div>
        ) : (
          <div className="bg-[#1A202C] text-white rounded-2xl p-5 text-center" data-testid="avg-card">
            <p className="text-xs uppercase tracking-widest text-orange-300">{t.avgRating}</p>
            <p className="text-5xl font-black font-display">{data.avg}</p>
            <div className="flex justify-center mt-1"><StarDisplay stars={data.avg} size={20}/></div>
            <p className="text-xs text-gray-300 mt-1">{data.count} reviews</p>
          </div>
        )}
        {loading && <RowListSkeleton count={3} />}
        {!loading && data.reviews.map(r => (
          <div key={r.id} className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-4" data-testid={`review-${r.id}`}>
            <div className="flex justify-between">
              <p className="font-bold">{r.employer_name}</p>
              <StarDisplay stars={r.stars}/>
            </div>
            {r.review && <p className="text-sm text-[#4A5568] mt-1">{r.review}</p>}
          </div>
        ))}
      </div>
      <BottomNav role="worker"/>
    </div>
  );
}
