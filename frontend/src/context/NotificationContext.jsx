import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";

const NotificationContext = createContext(null);

function readPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export function diffAndNotify(prev, next, notify, mapper) {
  if (!prev) return;
  const prevMap = new Map(prev.map(x => [x.id, x]));
  for (const item of next) {
    const before = prevMap.get(item.id);
    const event = mapper(item, before);
    if (event) notify(event.title, event.body, event.onClick);
  }
}

export function NotificationProvider({ children }) {
  const [permission, setPermission] = useState(readPermission);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") {
      setPermission("granted");
      return true;
    }
    if (Notification.permission === "denied") {
      setPermission("denied");
      toast.error("Notifications blocked. Enable them in your browser site settings.");
      return false;
    }
    const res = await Notification.requestPermission();
    setPermission(res);
    if (res === "granted") toast.success("Notifications enabled");
    return res === "granted";
  }, []);

  const notify = useCallback((title, body, onClick) => {
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    const granted = readPermission() === "granted";
    if (hidden && granted && typeof Notification !== "undefined") {
      try {
        const n = new Notification(title, { body, tag: title });
        if (onClick) n.onclick = () => { window.focus(); onClick(); };
      } catch {
        toast(title, { description: body, action: onClick ? { label: "View", onClick } : undefined });
      }
    } else {
      toast(title, { description: body, action: onClick ? { label: "View", onClick } : undefined });
    }
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    const ask = () => { requestPermission(); };
    window.addEventListener("click", ask, { once: true });
    return () => window.removeEventListener("click", ask);
  }, [requestPermission]);

  return (
    <NotificationContext.Provider value={{ permission, requestPermission, notify, isGranted: permission === "granted" }}>
      <WorkerNotificationWatcher notify={notify}/>
      {children}
    </NotificationContext.Provider>
  );
}

function WorkerNotificationWatcher({ notify }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const appsRef = useRef(null);
  const inviteIdsRef = useRef(null);

  useEffect(() => {
    if (!user || user.role !== "worker") return;

    const poll = async () => {
      try {
        const [appsRes, invitesRes] = await Promise.all([
          api.get("/worker/applications"),
          api.get("/worker/invites"),
        ]);
        const apps = appsRes.data;
        const invites = invitesRes.data;

        diffAndNotify(appsRef.current, apps, notify, (a, before) => {
          if (!before) return null;
          if (before.status === "pending" && a.status === "offer_pending") {
            return {
              title: "Hire offer received!",
              body: `${a.job.title} — ₹${a.job.budget}. Accept or decline in Pending.`,
              onClick: () => nav("/w/pending"),
            };
          }
          if (before.status === "offer_pending" && a.status === "hired") {
            return {
              title: "Job confirmed!",
              body: `${a.job.title} is now active.`,
              onClick: () => nav("/w/active"),
            };
          }
          if (before.status === "pending" && a.status === "rejected_by_employer") {
            return { title: "Application result", body: `${a.job.title}: not selected this time` };
          }
          return null;
        });
        appsRef.current = apps;

        const ids = new Set(invites.filter(i => i.status === "pending").map(i => i.id));
        if (inviteIdsRef.current) {
          for (const inv of invites) {
            if (inv.status === "pending" && !inviteIdsRef.current.has(inv.id)) {
              notify("New job invite", `${inv.employer_name}: ${inv.job?.title}`, () => nav("/w/invites"));
            }
          }
        }
        inviteIdsRef.current = ids;
      } catch { /* polling is best-effort */ }
    };

    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [user, notify, nav]);

  return null;
}

export default function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
