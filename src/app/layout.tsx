import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_CONFIG } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_CONFIG.name} | ${APP_CONFIG.tagline}`,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
