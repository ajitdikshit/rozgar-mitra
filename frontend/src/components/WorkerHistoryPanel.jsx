import { StarDisplay } from "./Stars";
import { useLang } from "../context/LangContext";

export default function WorkerHistoryPanel({ history = [], reviews = [] }) {
  const { t } = useLang();
  return (
    <div className="mt-4 space-y-4">
      <section>
        <h4 className="text-xs font-bold uppercase tracking-widest text-[#4A5568] mb-2">{t.pastWork}</h4>
        {history.length === 0 && (
          <p className="text-sm text-[#4A5568] py-2">{t.noHistory}</p>
        )}
        {history.map(r => (
          <div key={r.id} className="bg-[#FDFBF7] border border-[#E2E8F0] rounded-xl p-3 mb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-sm">{r.title}</p>
                <p className="text-xs text-[#4A5568]">{r.skill} • {r.employer_company || r.employer_name}</p>
              </div>
              <span className="font-bold text-sm">₹{r.amount}</span>
            </div>
            <div className="mt-1 flex justify-between items-center">
              <StarDisplay stars={r.stars}/>
              <span className="text-[10px] text-[#4A5568]">{r.date?.slice(0, 10)}</span>
            </div>
          </div>
        ))}
      </section>
      {reviews.length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-widest text-[#4A5568] mb-2">{t.reviews}</h4>
          {reviews.map(r => (
            <div key={r.id} className="bg-[#FDFBF7] border border-[#E2E8F0] rounded-xl p-3 mb-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#4A5568]">{r.employer_name}</p>
                <StarDisplay stars={r.stars}/>
              </div>
              {r.review && <p className="text-sm mt-1 text-[#1A202C]">{r.review}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
