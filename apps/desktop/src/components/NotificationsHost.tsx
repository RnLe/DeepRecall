import { useEffect, useRef, useState } from "react";
import {
  X,
  CheckCircle2,
  Info,
  AlertTriangle,
  AlertOctagon,
} from "lucide-react";

export type NotificationKind = "success" | "info" | "warning" | "error";

export type NotificationPayload = {
  title: string;
  description?: string;
  kind?: NotificationKind;
  durationMs?: number;
};

interface NotificationItem extends NotificationPayload {
  id: string;
}

const EVENT_NAME = "deeprecall:notification";
const KIND_STYLES: Record<NotificationKind, string> = {
  success: "border-emerald-400/40 bg-emerald-500/10 text-emerald-50",
  info: "border-sky-400/40 bg-sky-500/10 text-sky-50",
  warning: "border-amber-400/40 bg-amber-500/10 text-amber-50",
  error: "border-rose-400/40 bg-rose-500/10 text-rose-50",
};

const KIND_ICONS: Record<NotificationKind, typeof Info> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertOctagon,
};

export function emitNotification(payload: NotificationPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<NotificationPayload>(EVENT_NAME, { detail: payload })
  );
}

export function NotificationsHost() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    function addNotification(payload: NotificationPayload) {
      const id = crypto.randomUUID();
      setItems((prev) => [...prev, { ...payload, id }]);

      const timeout = setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
        timersRef.current.delete(id);
      }, payload.durationMs ?? 5000);

      timersRef.current.set(id, timeout);
    }

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<NotificationPayload>;
      addNotification(customEvent.detail);
    };

    window.addEventListener(EVENT_NAME, handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      timersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timersRef.current.clear();
    };
  }, []);

  if (!items.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-end gap-3 px-4 py-6">
      {items.map((item) => {
        const kind: NotificationKind = item.kind ?? "info";
        const Icon = KIND_ICONS[kind];

        const dismiss = () => {
          setItems((prev) => prev.filter((notice) => notice.id !== item.id));
          const timer = timersRef.current.get(item.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(item.id);
          }
        };

        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg shadow-black/40 backdrop-blur ${KIND_STYLES[kind]}`}
          >
            <Icon className="mt-1 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight">
                {item.title}
              </p>
              {item.description ? (
                <p className="mt-1 text-xs leading-relaxed text-white/80">
                  {item.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full p-1 text-white/70 transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
