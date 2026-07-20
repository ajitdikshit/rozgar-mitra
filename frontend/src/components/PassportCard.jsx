import { Share2, ShieldCheck, BadgeCheck } from "lucide-react";
import { StarDisplay } from "./Stars";
import { useLang } from "../context/LangContext";

const scoreColor = (s) =>
  s >= 80 ? "#16A34A" : s >= 60 ? "#EAB308" : s >= 40 ? "#E65C00" : "#DC2626";

export default function PassportCard({ data, showShare = true }) {
  const { t } = useLang();
  if (!data || !data.user) return null;
  const u = data.user;

  const handleShare = () => {
    const text = `🔨 Rozgar Mitra Work Passport\n👤 ${u.name} — ${u.skill}\n⭐ Score: ${data.reliability_score}/100\n✅ ${data.verified_jobs} verified jobs | ₹${data.total_earned} earned\n📞 Trusted on Rozgar Mitra`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] relative overflow-hidden fade-up"
         data-testid="passport-card">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#E65C00]/5 rounded-full -translate-y-12 translate-x-12"/>
      <div className="flex items-start gap-4 relative">
        <div className="w-20 h-20 flex items-center justify-center rounded-full border-4"
             style={{ borderColor: scoreColor(data.reliability_score) }}>
          <div className="text-center">
            <div className="text-2xl font-black font-display" style={{ color: scoreColor(data.reliability_score) }}>
              {data.reliability_score}
            </div>
            <div className="text-[9px] text-[#4A5568] font-bold tracking-wider -mt-0.5">/100</div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-[#4A5568]">{t.yourPassport}</p>
          <h2 className="text-xl font-extrabold font-display truncate">{u.name}</h2>
          <p className="text-sm text-[#4A5568] truncate">{u.skill} • {u.city}</p>
          {u.aadhaar_verified && (
            <div className="inline-flex items-center gap-1 mt-1 text-[#0EA5E9] text-xs font-bold">
              <ShieldCheck size={14}/> {t.aadhaarVerified}
            </div>
          )}
          {u.skill_test_passed && (
            <div className="inline-flex items-center gap-1 ml-2 mt-1 text-[#16A34A] text-xs font-bold">
              <BadgeCheck size={14}/> Skill Verified
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 relative">
        <Stat label={t.verifiedJobs} value={data.verified_jobs}/>
        <Stat label={t.avgRating} value={<><StarDisplay stars={data.avg_rating}/></>}/>
        <Stat label={t.totalEarned} value={`₹${data.total_earned}`}/>
        <Stat label={t.uniqueEmployers} value={data.unique_employers}/>
        <Stat label={t.repeatEmployers} value={data.repeat_employers}/>
        <Stat label={t.completionRate} value={`${data.completion_rate}%`}/>
      </div>

      {showShare && (
        <button onClick={handleShare} data-testid="whatsapp-share"
                className="w-full mt-4 bg-[#25D366] text-white py-3 px-4 rounded-xl font-bold flex items-center gap-2 justify-center active:scale-95 transition-transform">
          <Share2 size={18}/> {t.shareWhatsApp}
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-[#FDFBF7] rounded-xl p-2 text-center border border-[#E2E8F0]">
      <div className="text-base font-extrabold font-display text-[#1A202C]">{value}</div>
      <div className="text-[10px] text-[#4A5568] font-semibold uppercase tracking-wide leading-tight mt-0.5">{label}</div>
    </div>
  );
}

export function SkillBadge() {
  return (
    <span data-testid="skill-badge"
          className="inline-flex items-center gap-0.5 bg-[#16A34A]/10 text-[#16A34A] px-1.5 py-0.5 rounded-full text-[10px] font-extrabold">
      <BadgeCheck size={12}/>Skill
    </span>
  );
}

export function TrustedBadge() {
  const { t } = useLang();
  return (
    <span className="inline-flex items-center gap-1 bg-[#0EA5E9]/10 text-[#0EA5E9] px-2 py-0.5 rounded-full text-[11px] font-bold"
          data-testid="trusted-badge">
      <BadgeCheck size={14}/>{t.trusted}
    </span>
  );
}