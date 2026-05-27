import { create } from "zustand";

export type NotificationTone = "error" | "info" | "success";

export type NotificationItem = {
  id: string;
  title: string;
  message?: string;
  tone: NotificationTone;
};

type NotificationStore = {
  items: NotificationItem[];
  push: (item: Omit<NotificationItem, "id">) => void;
  dismiss: (id: string) => void;
};

export const useNotificationStore = create<NotificationStore>((set) => ({
  items: [],
  push: (item) =>
    set((state) => ({
      items: [
        ...state.items,
        {
          ...item,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      ],
    })),
  dismiss: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
}));

export function notifyError(title: string, message?: string) {
  useNotificationStore.getState().push({
    tone: "error",
    title,
    message,
  });
}

export function notifyInfo(title: string, message?: string) {
  useNotificationStore.getState().push({
    tone: "info",
    title,
    message,
  });
}
