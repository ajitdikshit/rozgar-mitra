import { useEffect, useState } from "react";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CheckCircle2, XCircle, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { QuizSkeleton } from "../components/Skeletons";

export default function SkillTest() {
  const nav = useNavigate();
  const { refreshMe } = useAuth();
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get("/worker/skill-test").then(r => setData(r.data))
      .catch(e => toast.error(e?.response?.data?.detail || "Test not available"));
  }, []);

  const submit = async () => {
    const arr = data.questions.map((_, i) => answers[i] ?? -1);
    if (arr.some(a => a === -1)) {
      toast.error("Please answer all questions");
      return;
    }
    const { data: res } = await api.post("/worker/skill-test", { answers: arr });
    setResult(res);
    await refreshMe();
  };

  if (!data) {
    return (
      <div className="app-shell pb-12 min-h-screen">
        <Navbar title="Skill Test" onBack={() => nav(-1)}/>
        <div className="p-4 space-y-4">
          <QuizSkeleton />
          <QuizSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell pb-12 min-h-screen">
      <Navbar title="Skill Test" subtitle={data.skill} onBack={() => nav(-1)}/>
      {result ? (
        <div className="p-6 fade-up">
          <div className={`rounded-2xl p-6 text-center border-2 ${result.passed ? "bg-green-50 border-green-400" : "bg-orange-50 border-orange-400"}`}
               data-testid="result-card">
            {result.passed
              ? <CheckCircle2 className="mx-auto text-green-600 mb-2" size={56}/>
              : <XCircle className="mx-auto text-orange-600 mb-2" size={56}/>}
            <h2 className="text-3xl font-black font-display">{result.score}/{result.total}</h2>
            <p className="mt-1 font-bold">{result.passed ? "Skill Verified!" : "Try again — you need 4 of 5"}</p>
            <p className="text-sm text-[#4A5568] mt-2">
              {result.passed
                ? "A Skill ✓ badge will now show on your applications."
                : "Review your trade basics and retry anytime."}
            </p>
            <button onClick={() => { setResult(null); setAnswers({}); if (result.passed) nav("/w/passport"); else api.get("/worker/skill-test").then(r => setData(r.data)); }}
                    data-testid="result-cta"
                    className="mt-5 w-full py-3 bg-[#E65C00] text-white font-bold rounded-xl">
              {result.passed ? "Back to Passport" : "Retry"}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="bg-[#1A202C] text-white rounded-2xl p-4 flex items-center gap-3">
            <GraduationCap size={28} className="text-orange-300"/>
            <div>
              <p className="text-xs uppercase tracking-widest text-orange-300">{data.skill} Practical Test</p>
              <p className="text-sm">5 questions • pass 4 to earn the Skill ✓ badge</p>
            </div>
          </div>
          {data.questions.map((q, qi) => (
            <div key={qi} className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-4" data-testid={`q-${qi}`}>
              <p className="font-bold mb-3"><span className="text-[#E65C00]">Q{qi+1}.</span> {q.q}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  return (
                    <button key={oi} onClick={() => setAnswers(p => ({ ...p, [qi]: oi }))}
                            data-testid={`q${qi}-opt${oi}`}
                            className={`w-full text-left p-3 rounded-xl border-2 text-sm ${selected ? "bg-orange-50 border-[#E65C00]" : "bg-white border-[#E2E8F0]"}`}>
                      <span className="font-bold mr-2">{String.fromCharCode(65 + oi)}.</span>{opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button onClick={submit} data-testid="submit-test"
                  className="w-full py-4 bg-[#E65C00] text-white font-bold text-lg rounded-xl shadow active:scale-95">
            Submit Test
          </button>
        </div>
      )}
    </div>
  );
}
