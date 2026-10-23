import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../core/auth/authContext";
import { playAlertSound } from "../core/alertSound";
import { markNotificationRead, watchNotifications } from "../core/services/notificationsService";
import { Icon } from "./ui";

const TOAST_MS = 12000;
const MAX_TOASTS = 4;

function shapeToast(item) {
  return {
    id: item.id,
    title: item.title ?? "New report",
    body: item.body ?? "",
    reportId: item.reportId ?? null,
  };
}

export default function ReportAlerts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);
  const seenRef = useRef(null);
  const timersRef = useRef(new Map());

  function dismiss(id) {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function openToast(toast) {
    if (toast.id) markNotificationRead(toast.id).catch(() => {});
    dismiss(toast.id);
    navigate("/dispatch");
  }

  useEffect(() => {
    if (!user) {
      seenRef.current = null;
      return undefined;
    }
    const timers = timersRef.current;
    const unsub = watchNotifications(
      user.uid,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const ids = new Set(items.map((i) => i.id));
        // First snapshot only records what already exists — no alert on load.
        if (seenRef.current === null) {
          seenRef.current = ids;
          return;
        }
        const fresh = items.filter(
          (i) => !seenRef.current.has(i.id) && i.type === "new_report" && !i.read,
        );
        seenRef.current = ids;
        if (fresh.length === 0) return;

        playAlertSound();
        setToasts((prev) => [...fresh.map(shapeToast), ...prev].slice(0, MAX_TOASTS));
        fresh.forEach((item) => {
          timersRef.current.set(
            item.id,
            setTimeout(() => dismiss(item.id), TOAST_MS),
          );
        });
      },
      () => {},
    );
    return () => {
      unsub();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [user]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="button"
          tabIndex={0}
          onClick={() => openToast(toast)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openToast(toast);
            }
          }}
          className="pointer-events-auto flex w-full cursor-pointer items-start gap-3 rounded-2xl border border-red-200 bg-white p-4 text-left shadow-xl shadow-slate-900/10 ring-1 ring-red-600/10 transition-transform hover:-translate-y-0.5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Icon name="alert" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">{toast.title}</span>
            {toast.body ? (
              <span className="mt-0.5 block break-words text-xs text-slate-500">
                {toast.body}
              </span>
            ) : null}
            <span className="mt-1 block text-[11px] font-medium text-red-600">
              Open in Dispatch →
            </span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismiss(toast.id);
            }}
            aria-label="Dismiss"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
