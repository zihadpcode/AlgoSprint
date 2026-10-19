const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31_536_000], ["month", 2_592_000], ["day", 86_400], ["hour", 3600], ["minute", 60]];
/** "5 minutes ago" style text; anything under a minute is "just now". */
export function relativeTime(date: Date | string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(date).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (!Number.isFinite(abs) || abs < 60) return "just now";
  const [unit, size] = units.find(([, length]) => abs >= length)!;
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.trunc(seconds / size), unit);
}
