import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SANKET — Mine Intelligence",
  description:
    "A mining knowledge assistant grounded in DGMS SANKET coal and non-coal accident inquiries. Ask questions, inspect evidence and prepare an officer briefing.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
