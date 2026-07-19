import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
         onClick={onClose} data-testid="modal-backdrop">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 fade-up max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()} data-testid="modal-content">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold font-display">{title}</h3>
          <button onClick={onClose} data-testid="modal-close"
                  className="p-2 -mr-2 rounded-full hover:bg-gray-100"><X size={22}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}
