import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../core/auth/authContext";
import {
  markAllNotificationsRead,
  markNotificationRead,
  watchNotifications,
} from "../core/services/notificationsService";
import { Icon } from "./ui";

const PANEL_WIDTH = 320;
const PANEL_MAX_HEIGHT = 384;

function timeAgo(ts) {
  const date = typeof ts?.toDate === "function" ? ts.toDate() : ts ? new Date(ts) : null;
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!user) return undefined;
    const unsub = watchNotifications(
      user.uid,
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
    return unsub;
  }, [user]);

  useEffect(() => {
    function onClick(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const panelWidth = useMemo(
    () => Math.min(PANEL_WIDTH, window.innerWidth - 16),
    [],
  );

  const position = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const left = Math.min(Math.max(8, rect.right - width), maxLeft);

    const panelH = panelRef.current?.offsetHeight ?? 0;
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = panelH > 0 && spaceBelow < panelH && spaceAbove > spaceBelow;
    let top = openUp ? rect.top - panelH - 8 : rect.bottom + 8;
    top = Math.max(8, Math.min(top, viewportH - 8 - (panelH || 0)));

    setCoords({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open, position, items]);

  const unread = useMemo(() => items.filter((i) => !i.read).length, [items]);

  async function openItem(item) {
    if (!item.read) await markNotificationRead(item.id).catch(() => {});
    setOpen(false);
    if (item.reportId) navigate("/dispatch");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <Icon name="bell" className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: coords?.top ?? 0,
            left: coords?.left ?? -9999,
            width: coords?.width ?? panelWidth,
            maxHeight: PANEL_MAX_HEIGHT,
          }}
          className="z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unread > 0 ? (
              <button
                onClick={() => markAllNotificationsRead(items)}
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                You're all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => openItem(item)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                        item.read ? "" : "bg-blue-50/40"
                      }`}
                    >
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          item.read ? "bg-slate-200" : "bg-blue-600"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {item.title ?? "Update"}
                        </span>
                        {item.body ? (
                          <span className="mt-0.5 block line-clamp-2 break-words text-xs text-slate-500">
                            {item.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {timeAgo(item.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
