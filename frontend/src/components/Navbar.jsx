import { Menu, ChevronLeft } from "lucide-react";
import { useLang } from "../context/LangContext";

export default function Navbar({ title, subtitle, onMenu, onBack, right }) {
  const { lang, toggle } = useLang();
  return (
    <div className="sticky top-0 z-40 bg-white border-b-2 border-[#E2E8F0] px-4 py-3 flex items-center gap-3"
         data-testid="navbar">
      {onBack ? (
        <button onClick={onBack} data-testid="nav-back" className="p-2 -ml-2 rounded-full active:bg-gray-100">
          <ChevronLeft size={24} strokeWidth={2.5}/>
        </button>
      ) : onMenu ? (
        <button onClick={onMenu} data-testid="nav-menu" className="p-2 -ml-2 rounded-full active:bg-gray-100">
          <Menu size={24} strokeWidth={2.5}/>
        </button>
      ) : null}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-extrabold font-display truncate">{title}</h1>
        {subtitle && <p className="text-xs text-[#4A5568] truncate">{subtitle}</p>}
      </div>
      {right || (
        <button onClick={toggle} data-testid="nav-lang"
                className="text-xs font-bold bg-gray-100 px-3 py-1.5 rounded-full">
          {lang === "en" ? "हिं" : "EN"}
        </button>
      )}
    </div>
  );
}
