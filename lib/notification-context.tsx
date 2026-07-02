import { createContext, useContext, ReactNode } from "react";
import { useNotifications, type NotificationItem } from "@/hooks/use-notifications";

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  push: (message: string, type?: NotificationItem["type"]) => void;
  markAllRead: () => void;
  clear: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const notif = useNotifications();

  return (
    <NotificationContext.Provider value={notif}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotificationContext must be inside NotificationProvider");
  return ctx;
}
