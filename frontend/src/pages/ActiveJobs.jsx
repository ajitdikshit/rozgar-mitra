import { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import EmployerDrawer from "../components/EmployerDrawer";
import Modal from "../components/Modal";
import PassportCard from "../components/PassportCard";
import WorkerHistoryPanel from "../components/WorkerHistoryPanel";
import { useLang } from "../context/LangContext";
import { StarPicker, StarDisplay } from "../components/Stars";
import { Phone, CheckCircle2, Hourglass, Star, History } from "lucide-react";
import { toast } from "sonner";

export default function ActiveJobs() {
  const { t } = useLang();
  const [jobs, setJobs] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [review, setReview] = useState(null);
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const [workerProfile, setWorkerProfile] = useState(null);

  const load = () => api.get("/employer/active").then(r => setJobs(r.data));
  useEffect(() => { load(); }, []);

  const approve = async (job_id, worker_id) => {
    try {
      await api.post("/employer/approve-worker", { job_id, worker_id });
      toast.success("Job approved & marked complete");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not approve");
    }
  };

  const openReview = (job_id, w) => {
    setReview({ job_id, worker_id: w.worker_id, name: w.name });
    setStars(w.review_stars || 5);
    setText(w.review_text || "");
  };

  // FIX #15: Add error handling on submitReview
  const submitReview = async () => {
    try {
      await api.post("/employer/review-worker", {
        job_id: review.job_id, worker_id: review.worker_id, stars, review: text });
      toast.success("Review saved");
      setReview(null); setText(""); setStars(5);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save review");
    }
  };

  const viewWorkerHistory = async (workerId) => {
    const { data } = await api.get(`/employer/worker/${workerId}/passport`);
    setWorkerProfile(data);
  };

  return (
    <div className="app-shell pb-24">
      <Navbar title={t.activeJobs} onMenu={() => setDrawer(true)}/>
      <EmployerDrawer open={drawer} onClose={() => setDrawer(false)}/>
      <div className="p-4 space-y-3">
        {jobs.length === 0 && <p className="text-center text-[#4A5568] py-12" data-testid="no-active-emp">{t.noActiveEmp}</p>}
        {jobs.map(j => (
          <div key={j.id} className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-4" data-testid={`ej-${j.id}`}>
            <h3 className="font-bold font-display">{j.title}</h3>
            <p className="text-xs text-[#4A5568]">{j.area}, {j.city}</p>
            <div className="mt-3 space-y-2">
              {j.workers.map(w => {
                const isCompleted = w.status === "completed";
                const canApprove = w.worker_marked_complete && !isCompleted;
                return (
                  <div key={w.worker_id} className="bg-[#FDFBF7] border border-[#E2E8F0] rounded-xl p-3" data-testid={`wk-${w.worker_id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold truncate">{w.name}</p>
                        <p className="text-xs text-[#4A5568]">{w.skill}</p>
                        {w.photo_b64 && (
                          <img src={w.photo_b64} alt="work" className="mt-2 h-16 w-16 object-cover rounded-lg"/>
                        )}
                        {isCompleted ? (
                          <p className="text-xs text-green-700 font-bold mt-1 flex items-center gap-1">
                            <CheckCircle2 size={12}/> Completed
                          </p>
                        ) : w.worker_marked_complete ? (
                          <p className="text-xs text-blue-700 font-bold mt-1 flex items-center gap-1">
                            <CheckCircle2 size={12}/> Worker marked complete
                          </p>
                        ) : (
                          <p className="text-xs text-[#4A5568] font-bold mt-1 flex items-center gap-1">
                            <Hourglass size={12}/> Waiting for worker to finish
                          </p>
                        )}
                        {w.review_stars > 0 && (
                          <div className="mt-1 flex items-center gap-1">
                            <StarDisplay stars={w.review_stars} size={12}/>
                            <span className="text-[10px] text-[#4A5568]">your review</span>
                          </div>
                        )}
                        <button onClick={() => viewWorkerHistory(w.worker_id)} data-testid={`history-${w.worker_id}`}
                                className="mt-2 text-xs font-bold text-[#E65C00] flex items-center gap-1">
                          <History size={13}/>{t.viewProfile}
                        </button>
                      </div>
                      <a href={`tel:${w.phone}`} data-testid={`call-w-${w.worker_id}`}
                         className="text-sm font-bold text-[#16A34A] flex items-center gap-1 shrink-0"><Phone size={14}/>{w.phone}</a>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button onClick={() => approve(j.id, w.worker_id)} disabled={!canApprove}
                              data-testid={`approve-${w.worker_id}`}
                              className={`py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 ${canApprove ? "bg-[#16A34A] text-white active:scale-95" : isCompleted ? "bg-green-50 text-green-700 border-2 border-green-300" : "bg-gray-100 text-gray-400"}`}>
                        <CheckCircle2 size={14}/>{isCompleted ? "Approved" : "Approve & Complete"}
                      </button>
                      <button onClick={() => openReview(j.id, w)} data-testid={`review-${w.worker_id}`}
                              className="py-2 rounded-lg font-bold text-sm bg-[#E65C00] text-white flex items-center justify-center gap-1 active:scale-95">
                        <Star size={14}/>{w.review_stars > 0 ? "Edit Review" : "Leave Review"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!review} onClose={() => setReview(null)} title={`Review: ${review?.name || ""}`}>
        <div className="flex justify-center my-2"><StarPicker value={stars} onChange={setStars} size={36}/></div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder={t.reviewText}
                  data-testid="emp-review-text"
                  className="w-full px-3 py-2 border-2 border-[#E2E8F0] rounded-xl mt-2"/>
        <button onClick={submitReview} data-testid="emp-review-submit"
                className="w-full mt-3 py-3 bg-[#E65C00] text-white font-bold rounded-xl">
          {t.submit}
        </button>
      </Modal>

      <Modal open={!!workerProfile} onClose={() => setWorkerProfile(null)} title={t.viewProfile}>
        <PassportCard data={workerProfile} showShare={false}/>
        <WorkerHistoryPanel history={workerProfile?.history} reviews={workerProfile?.reviews}/>
      </Modal>

      <BottomNav role="employer"/>
    </div>
  );
}
