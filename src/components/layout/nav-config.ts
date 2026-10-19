import { BookMarked, Bookmark, ChartNoAxesColumn, Code2, Gauge, LayoutDashboard, Mic, NotebookPen, Route, ShieldCheck, Trophy, UserRound } from "lucide-react";

/** Primary destinations in the top bar. */
export const PRIMARY_NAV = [
  { href: "/problems", label: "Practice", icon: Code2 },
  { href: "/roadmaps", label: "Roadmaps", icon: Route },
  { href: "/mock-interview", label: "Interviews", icon: Mic },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
] as const;

/** Personal pages in the profile menu (signed-in only). */
export const ACCOUNT_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/review", label: "Review later", icon: BookMarked },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

export const ADMIN_NAV = { href: "/admin", label: "Admin", icon: ShieldCheck } as const;
export const DASHBOARD_ICON = Gauge;

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
