"use client";

import { useEffect, useState } from "react";

/** Live-updating clock. Re-renders every second on the minute. */
export function useClock(): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Format a Date as HH:MM:SS in 24h mono clock style. */
export function formatClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Format the date portion e.g. "Mon 14 Oct 2024". */
export function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
