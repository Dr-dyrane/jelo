"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./me-notification-bell.module.css";

export function MeNotificationBell({
  previewOnly = false,
}: {
  previewOnly?: boolean;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (previewOnly) return;
    let active = true;
    void fetch("/api/me/notifications", { cache: "no-store" })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{ unreadCount?: number }>)
          : null,
      )
      .then((payload) => {
        if (active && payload)
          setUnreadCount(Math.max(0, payload.unreadCount ?? 0));
      })
      .catch(() => {
        // The account remains usable; the inbox route can be opened directly.
      });
    return () => {
      active = false;
    };
  }, [previewOnly]);

  return (
    <Link
      className={styles.bell}
      href="/me/notifications"
      aria-label={
        unreadCount
          ? `${unreadCount} unread order notifications`
          : "Order notifications"
      }
    >
      <Bell size={21} strokeWidth={1.7} aria-hidden="true" />
      {unreadCount ? (
        <span aria-hidden="true">
          {Math.min(unreadCount, 9)}
          {unreadCount > 9 ? "+" : ""}
        </span>
      ) : null}
    </Link>
  );
}
