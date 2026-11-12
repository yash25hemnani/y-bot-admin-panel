// Helpers available in every EJS view as `h` (set on app.locals in app.ts).

import { DeviceStatus } from "../types/device.types";

const ICON_SPRITE = "/assets/img/icons.svg";

// Inline SVG from the sprite. Decorative: the text next to it carries the meaning.
export function icon(name: string): string {
  return `<svg class="icon" aria-hidden="true"><use href="${ICON_SPRITE}#i-${name}"></use></svg>`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const full = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

// "just now", "4 min ago", "3 h ago", "Yesterday 14:02", "3 Oct", "3 Oct 2025"
export function relativeTime(value: Date | string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < 12 * HOUR) return `${Math.floor(diff / HOUR)} h ago`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() >= today.getTime()) return `Today ${clock.format(date)}`;
  if (date.getTime() >= today.getTime() - DAY) return `Yesterday ${clock.format(date)}`;
  return date.getFullYear() === today.getFullYear() ? dayMonth.format(date) : dayMonthYear.format(date);
}

export function fullTime(value: Date | string | null | undefined): string {
  return value ? full.format(new Date(value)) : "";
}

// <time> element: relative text, exact time on hover and for screen readers via datetime
export function time(value: Date | string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  return `<time datetime="${date.toISOString()}" title="${fullTime(date)}">${relativeTime(date)}</time>`;
}

export function clockTime(value: Date | string): string {
  return clock.format(new Date(value));
}

const weekdayDayMonth = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

// "Today", "Yesterday", "Mon 10 Nov", or "10 Nov 2025" for other years
export function dayLabel(value: Date | string): string {
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - start.getTime()) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.getFullYear() === today.getFullYear() ? weekdayDayMonth.format(date) : dayMonthYear.format(date);
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

// Build a query string from the current filters, dropping empty values
export function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "" && value !== "all") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const STATUS_LABEL: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  revoked: "Switched off",
};
