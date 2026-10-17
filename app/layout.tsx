import type { Metadata, Viewport } from "next";
import { INVITATION } from "@/lib/invitation.config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${INVITATION.groom} & ${INVITATION.bride} — ${INVITATION.dateLabel}`,
  description: "Приглашение на свадьбу",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#efe6d8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="font-serif antialiased">{children}</body>
    </html>
  );
}
