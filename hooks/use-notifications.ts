import { useState, useRef, useCallback } from "react";

export type NotificationItem = {
  id: string;
  message: string;
  type: "info" | "success" | "warning";
  timestamp: Date;
  read: boolean;
};

let globalIdCounter = 0;

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const push = useCallback((message: string, type: NotificationItem["type"] = "info") => {
    const id = `notif-${Date.now()}-${++globalIdCounter}`;
    setNotifications((prev) => [
      { id, message, type, timestamp: new Date(), read: false },
      ...prev.slice(0, 49), // max 50
    ]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, push, markAllRead, clear, unreadCount };
}

/**
 * diffDetector — bandingkan data lama vs baru dan kembalikan pesan perubahan status.
 * Generik untuk SO, PO, Shipment.
 */
export function detectStatusChanges<T extends { id: number; status: string }>(
  prev: T[],
  next: T[],
  label: (item: T) => string
): string[] {
  const prevMap = new Map(prev.map((i) => [i.id, i.status]));
  const messages: string[] = [];

  for (const item of next) {
    const oldStatus = prevMap.get(item.id);
    if (oldStatus && oldStatus !== item.status) {
      messages.push(`${label(item)}: ${oldStatus} → ${item.status}`);
    }
  }
  return messages;
}

export function detectPaymentChanges<T extends { id: number; paymentStatus: string }>(
  prev: T[],
  next: T[],
  label: (item: T) => string
): string[] {
  const prevMap = new Map(prev.map((i) => [i.id, i.paymentStatus]));
  const messages: string[] = [];

  for (const item of next) {
    const oldStatus = prevMap.get(item.id);
    if (oldStatus && oldStatus !== item.paymentStatus) {
      messages.push(`Pembayaran ${label(item)}: ${oldStatus} → ${item.paymentStatus}`);
    }
  }
  return messages;
}
