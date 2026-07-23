import { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import WorkerDrawer from "../components/WorkerDrawer";
import { useLang } from "../context/LangContext";
import { StarPicker } from "../components/Stars";
import { Phone, Camera, CheckCircle2, Users, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { CardSkeleton } from "../components/Skeletons";

const TAGS_KEYS = ["safeWorkplace", "fairPayment", "onTime", "respectful"];

export default function ActiveJob() {
  const { t } = useLang();
  const [activeJobs, setActiveJobs] = useState([]);  // now an array
  const [drawer, setDrawer] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load array of active jobs
  const load = () =>
    api
      .get("/worker/active")
      .then((r) => setActiveJobs(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.active} onMenu={() => setDrawer(true)} />
      <WorkerDrawer open={drawer} onClose={() => setDrawer(false)} />
      <div className="p-4 space-y-6">
        {loading && <CardSkeleton />}
        {!loading && activeJobs.length === 0 && (
          <p className="text-center text-[#4A5568] py-12" data-testid="no-active">
            {t.noActiveJob}
          </p>
        )}
        {!loading && activeJobs.map((jobData) => (
          <JobCard key={jobData.application.id} data={jobData} reload={load} />
        ))}
      </div>
      <BottomNav role="worker" />
    </div>
  );
}

// Isolated logic per job
function JobCard({ data, reload }) {
  const { t } = useLang();
  const [photo, setPhoto] = useState(null);
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState([]);
  const [review, setReview] = useState("");
  const [showRate, setShowRate] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Destructure for easier access
  const job = data.job;
  const coWorkers = data.co_workers || [];

  const uploadPhoto = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target.result;
      try {
        await api.post("/worker/upload-photo", {
          job_id: job.id,
          photo_b64: b64,
        });
        setPhoto(b64);
        toast.success(t.photoSaved || "Photo saved");
      } catch (e) {
        toast.error(e?.response?.data?.detail || "Could not upload photo");
      }
    };
    reader.readAsDataURL(f);
  };

  const submitComplete = async () => {
    if (!photo) {
      toast.error("Please upload a work photo before marking complete.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/worker/mark-complete", {
        job_id: job.id,
        stars,
        tags,
        review,
      });
      setDone(true);
      setShowRate(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not mark job complete");
    } finally {
      setBusy(false);
    }
  };

  const toggleTag = (k) =>
    setTags((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  // Job marked as completed
  if (done) {
    return (
      <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6 text-center fade-up">
        <CheckCircle2 className="mx-auto text-green-600 mb-2" size={48} />
        <h3 className="text-xl font-bold font-display">{t.thanks}</h3>
        <p className="text-sm text-[#4A5568] mt-1">
          Your work record has been added to your passport.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 border-b border-gray-200 pb-6">
      {/* Job details */}
      <div className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-5">
        <p className="text-xs uppercase font-bold tracking-widest text-[#E65C00]">
          {t.activeJobTitle}
        </p>
        <h2 className="text-2xl font-extrabold font-display mt-1">
          {job.title}
        </h2>
        <p className="text-sm text-[#4A5568] mt-1">
          {job.area}, {job.city}
        </p>
        <p className="text-sm mt-2">{job.description}</p>
        <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
          <p className="text-xs font-bold uppercase text-[#4A5568]">
            {t.employerProfile}
          </p>
          <p className="font-bold">
            {data.employer_company || data.employer_name}
          </p>
          <a
            href={`tel:${data.employer_phone}`}
            data-testid="call-employer"
            className="mt-2 w-full bg-[#16A34A] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Phone size={18} />
            {t.callEmployer}: {data.employer_phone}
          </a>
        </div>
      </div>

      {/* Co-workers section */}
      {coWorkers.length > 0 && (
        <div className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#4A5568] flex items-center gap-1 mb-3">
            <Users size={14} /> Co-workers on this job ({coWorkers.length})
          </p>
          <div className="space-y-2">
            {coWorkers.map((cw) => (
              <div
                key={cw.id}
                className="flex items-center justify-between bg-[#FDFBF7] border border-[#E2E8F0] rounded-xl px-3 py-2"
              >
                <div>
                  <p className="font-bold text-sm flex items-center gap-1">
                    {cw.name}
                    {cw.aadhaar_verified && (
                      <ShieldCheck size={13} className="text-[#0EA5E9]" />
                    )}
                  </p>
                  <p className="text-xs text-[#4A5568]">
                    {cw.skill} • {cw.city}
                  </p>
                </div>
                <span className="text-xs text-[#4A5568] bg-gray-100 px-2 py-1 rounded-full font-bold">
                  Teammate
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#4A5568] mt-2">
            📵 Phone numbers are private — contact through employer
          </p>
        </div>
      )}

      {/* Photo upload */}
      <label
        className="block bg-white border-2 border-dashed border-[#E2E8F0] rounded-2xl p-5 text-center cursor-pointer active:bg-gray-50"
        data-testid="photo-upload-label"
      >
        <Camera className="mx-auto mb-2 text-[#E65C00]" size={28} />
        <p className="font-bold">{photo ? t.photoSaved : t.uploadPhoto}</p>
        <p className="text-xs text-[#4A5568] mt-1">{t.takeSelfie}</p>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={uploadPhoto}
          className="hidden"
          data-testid="photo-input"
        />
        {photo && (
          <img src={photo} alt="work" className="mt-3 rounded-xl max-h-48 mx-auto" />
        )}
      </label>

      {/* Mark complete / rate */}
      {!showRate ? (
        <button
          onClick={() => setShowRate(true)}
          data-testid="mark-complete-btn"
          className="w-full py-4 bg-[#E65C00] text-white font-bold text-lg rounded-xl shadow active:scale-95 transition-transform"
        >
          {t.markComplete}
        </button>
      ) : (
        <div className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-5">
          <h3 className="font-bold font-display text-lg">{t.rateEmployer}</h3>
          <div className="flex justify-center my-3">
            <StarPicker value={stars} onChange={setStars} size={36} />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#4A5568] mb-2">
            {t.quickTags}
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {TAGS_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => toggleTag(k)}
                data-testid={`tag-${k}`}
                className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 ${
                  tags.includes(k)
                    ? "bg-[#E65C00] text-white border-[#E65C00]"
                    : "bg-white border-[#E2E8F0] text-[#4A5568]"
                }`}
              >
                {t[k]}
              </button>
            ))}
          </div>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={3}
            placeholder={t.reviewText}
            data-testid="review-text"
            className="w-full px-3 py-2 border-2 border-[#E2E8F0] rounded-xl outline-none focus:border-[#E65C00]"
          />
          <button
            onClick={submitComplete}
            disabled={busy}
            data-testid="submit-rate"
            className="w-full mt-3 py-3 bg-[#E65C00] text-white font-bold rounded-xl active:scale-95 disabled:opacity-60"
          >
            {busy ? "..." : t.submit}
          </button>
        </div>
      )}
    </div>
  );
}