import Modal from "./Modal";
import { useLang } from "../context/LangContext";
import { Check, Globe } from "lucide-react";

// A tappable list of every supported language, shown in its own native
// script plus the English name (so someone unsure of a script can still
// find it). Replaces the old binary EN/HI toggle button.
export default function LanguagePicker({ open, onClose }) {
  const { lang, setLang, languages, t } = useLang();

  const pick = (code) => {
    setLang(code);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t.languageToggle || "Language"}>
      <div className="space-y-1.5" data-testid="language-picker-list">
        {languages.map((l) => {
          const active = l.code === lang;
          return (
            <button
              key={l.code}
              onClick={() => pick(l.code)}
              data-testid={`lang-option-${l.code}`}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                active
                  ? "bg-orange-50 border-[#E65C00]"
                  : "bg-white border-[#E2E8F0] active:bg-gray-50"
              }`}
            >
              <div>
                <p className="font-bold text-base">{l.native}</p>
                {l.english !== l.native && (
                  <p className="text-xs text-[#4A5568]">{l.english}</p>
                )}
              </div>
              {active && <Check size={20} className="text-[#E65C00] shrink-0" />}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// Small reusable trigger button — a globe icon + the current language's
// native label — used in place of the old raw toggle button.
export function LanguagePickerButton({ onClick, testId = "nav-lang" }) {
  const { languages, lang } = useLang();
  const current = languages.find((l) => l.code === lang);
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="flex items-center gap-1.5 text-xs font-bold bg-gray-100 px-3 py-1.5 rounded-full active:scale-95"
    >
      <Globe size={13} />
      {current ? current.native : "EN"}
    </button>
  );
}
