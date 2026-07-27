import { Languages } from "lucide-react";
import { useLang } from "../context/LangContext";

// Every job the backend returns already carries BOTH the localized text
// (title/description, swapped server-side to the viewer's language) and
// the original text (original_title/original_description/original_language)
// in the same response — see backend/translate.py::localize_job. So this
// badge/toggle is purely client-side, no network call on tap.
//
// Fully controlled: the parent owns the "showing original?" state (usually
// a Set of job ids, since a list has many jobs at once) and passes it in.
export default function TranslatedBadge({ job, showingOriginal, onToggle }) {
  const { languages } = useLang();
  if (!job || !job.is_translated) return null;

  const langMeta = languages.find(l => l.code === job.original_language);
  const label = langMeta ? langMeta.native : job.original_language;

  return (
    <button onClick={onToggle} data-testid={`translated-badge-${job.id || ""}`}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0EA5E9] bg-[#0EA5E9]/10 px-2 py-1 rounded-full mt-1">
      <Languages size={11}/>
      {showingOriginal
        ? "Showing original — tap to translate"
        : `Translated from ${label} · View original`}
    </button>
  );
}

// Given a job and whether the toggle is currently set to "show original",
// returns the title/description that should actually be rendered.
export function displayText(job, showingOriginal) {
  if (!job) return { title: "", description: "" };
  if (showingOriginal && job.is_translated) {
    return { title: job.original_title, description: job.original_description };
  }
  return { title: job.title, description: job.description };
}
