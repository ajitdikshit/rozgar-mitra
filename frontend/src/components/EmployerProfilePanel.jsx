import { TrustedBadge } from "./PassportCard";
import { StarDisplay } from "./Stars";
import { useLang } from "../context/LangContext";
import { Phone } from "lucide-react";

const STATUS_COLOR = {
  open: "text-blue-700",
  in_progress: "text-orange-700",
  completed: "text-green-700",
};

export default function EmployerProfilePanel({ data }) {
  const { t } = useLang();
  if (!data?.user) return null;
  const u = data.user;
  const stats = data.stats || {};

  return (
    <div className="space-y-4">
      <div className="bg-[#1A202C] text-white rounded-2xl p-5">
        <p className="text-xs uppercase tracking-widest text-orange-300">{t.employerProfile}</p>
        <h2 className="text-xl font-extrabold font-display mt-1">{u.company || u.name}</h2>
        {u.company && <p className="text-sm text-gray-300">{u.name}</p>}
        <p className="text-xs text-gray-400 mt-1">{u.area}, {u.city}</p>
        {stats.trusted && <div className="mt-2"><TrustedBadge/></div>}
        {data.phone && (
          <a href={`tel:${data.phone}`}
             className="mt-3 w-full bg-[#16A34A] text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2">
            <Phone size={16}/>{data.phone}
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniStat label={t.jobsPosted} value={stats.jobs_posted}/>
        <MiniStat label={t.jobsCompleted} value={stats.jobs_completed}/>
        <MiniStat label={t.avgRating} value={stats.avg_rating || "—"}/>
        <MiniStat label={t.reviews} value={stats.review_count}/>
      </div>

      <section>
        <h4 className="text-xs font-bold uppercase tracking-widest text-[#4A5568] mb-2">{t.employerHistory}</h4>
        {(data.jobs || []).length === 0 && (
          <p className="text-sm text-[#4A5568] py-2">{t.noHistory}</p>
        )}
        {(data.jobs || []).map(j => (
          <div key={j.id} className="bg-[#FDFBF7] border border-[#E2E8F0] rounded-xl p-3 mb-2">
            <p className="font-bold text-sm">{j.title}</p>
            <p className="text-xs text-[#4A5568]">{j.skill} • ₹{j.budget}</p>
            <p className={`text-[10px] font-bold uppercase mt-1 ${STATUS_COLOR[j.status] || "text-gray-600"}`}>
              {j.status?.replace("_", " ")}
            </p>
          </div>
        ))}
      </section>

      {(data.reviews || []).length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-widest text-[#4A5568] mb-2">{t.reviewsFromWorkers}</h4>
          {data.reviews.map(r => (
            <div key={r.id} className="bg-[#FDFBF7] border border-[#E2E8F0] rounded-xl p-3 mb-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#4A5568]">{r.worker_name}</p>
                <StarDisplay stars={r.stars}/>
              </div>
              {r.review && <p className="text-sm mt-1">{r.review}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-[#FDFBF7] border border-[#E2E8F0] rounded-xl p-2 text-center">
      <p className="text-lg font-extrabold font-display">{value ?? 0}</p>
      <p className="text-[10px] text-[#4A5568] font-semibold uppercase">{label}</p>
    </div>
  );
}
