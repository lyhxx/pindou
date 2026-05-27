import { useEffect } from "react";
import {
  notifyError,
  useNotificationStore,
} from "../../shared/notifications/notificationStore";

const AUTO_DISMISS_MS = 4800;

export function NotificationViewport() {
  const items = useNotificationStore((state) => state.items);
  const dismiss = useNotificationStore((state) => state.dismiss);

  useEffect(() => {
    function handleWindowError(event: ErrorEvent) {
      notifyError("页面出现异常", event.message || "发生了未预期的运行时错误");
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === "string"
            ? event.reason
            : "发生了未处理的异步错误";
      notifyError("操作失败", reason);
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const timers = items.map((item) =>
      window.setTimeout(() => dismiss(item.id), AUTO_DISMISS_MS),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismiss, items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="notification-viewport" aria-live="polite">
      {items.map((item) => (
        <section
          key={item.id}
          className={`notification-card notification-card--${item.tone}`}
        >
          <div className="notification-card__content">
            <strong>{item.title}</strong>
            {item.message ? <p>{item.message}</p> : null}
          </div>
          <button
            aria-label="关闭提示"
            className="notification-card__close"
            onClick={() => dismiss(item.id)}
            type="button"
          >
            ×
          </button>
        </section>
      ))}
    </div>
  );
}
