import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

// Browser push when tab is hidden; sonner toast when visible.
export default function useNotifications() {
  const granted = useRef(typeof Notification !== "undefined" && Notification.permission === "granted");

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") { granted.current = true; return true; }
    if (Notification.permission === "denied") return false;
    const res = await Notification.requestPermission();
    granted.current = res === "granted";
    return granted.current;
  }, []);

  const notify = useCallback((title, body, onClick) => {
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (hidden && granted.current && typeof Notification !== "undefined") {
      try {
        const n = new Notification(title, { body, icon: "/favicon.ico", tag: title });
        if (onClick) n.onclick = () => { window.focus(); onClick(); };
      } catch { toast(title, { description: body }); }
    } else {
      toast(title, { description: body, action: onClick ? { label: "View", onClick } : undefined });
    }
  }, []);

  useEffect(() => {
    // Auto-prompt once after first user interaction (workers only call this hook).
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      const ask = () => { requestPermission(); window.removeEventListener("click", ask); };
      window.addEventListener("click", ask, { once: true });
      return () => window.removeEventListener("click", ask);
    }
  }, [requestPermission]);

  return { notify, requestPermission, isGranted: granted.current };
}

// Compare prev and next lists by id+status and emit notifications for changes.
export function diffAndNotify(prev, next, notify, mapper) {
  if (!prev) return;
  const prevMap = new Map(prev.map(x => [x.id, x]));
  for (const item of next) {
    const before = prevMap.get(item.id);
    const event = mapper(item, before);
    if (event) notify(event.title, event.body, event.onClick);
  }
}
