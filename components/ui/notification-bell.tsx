"use client";

import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationItem } from "@/hooks/use-notifications";

interface NotificationBellProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onClear: () => void;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  return `${hours} jam lalu`;
}

const typeStyles: Record<NotificationItem["type"], string> = {
  info: "bg-blue-50 border-l-2 border-blue-400",
  success: "bg-green-50 border-l-2 border-green-500",
  warning: "bg-yellow-50 border-l-2 border-yellow-500",
};

const typeDot: Record<NotificationItem["type"], string> = {
  info: "bg-blue-400",
  success: "bg-green-500",
  warning: "bg-yellow-500",
};

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkAllRead,
  onClear,
}: NotificationBellProps) {
  return (
    <DropdownMenu onOpenChange={(open) => { if (open) onMarkAllRead(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Notifikasi</span>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Tandai semua dibaca" onClick={onMarkAllRead}>
                  <CheckCheck className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Hapus semua" onClick={onClear}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-sm">Belum ada notifikasi</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 ${typeStyles[n.type]} ${!n.read ? "opacity-100" : "opacity-60"}`}
              >
                <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${typeDot[n.type]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{n.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.timestamp)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer polling indicator */}
        <div className="flex items-center gap-1.5 border-t border-border px-4 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-xs text-muted-foreground">Auto-refresh aktif (30 detik)</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
