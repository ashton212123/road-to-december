const TZ = "Asia/Manila";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

/** Today's date as YYYY-MM-DD in Asia/Manila, regardless of server TZ. */
export function todayManilaISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function dayKeyForDate(isoDate: string): DayKey {
  // Parsing as UTC noon avoids DST/timezone edge cases shifting the weekday.
  const d = new Date(`${isoDate}T12:00:00Z`);
  return DAY_KEYS[d.getUTCDay()];
}

export function todayDayKey(): DayKey {
  return dayKeyForDate(todayManilaISO());
}

export function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function isPastOrToday(isoDate: string): boolean {
  return daysBetween(isoDate, todayManilaISO()) >= 0;
}

export function manilaHourNow(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = parts.find((p) => p.type === "hour")?.value;
  return hour ? Number(hour) : new Date().getHours();
}

export function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday (ISO) of the week containing `dateISO`. */
export function mondayOf(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
