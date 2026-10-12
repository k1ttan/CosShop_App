import type { Metadata } from "next";
import { Be_Vietnam_Pro, Playfair_Display } from "next/font/google";
import "./globals.css";

const vietnameseSans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-vietnamese-sans",
  display: "swap",
});
const elegantSerif = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  variable: "--font-elegant-serif",
  display: "swap",
});

import dynamic from "next/dynamic";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const FloatingChatWidget = dynamic(
  () => import("@/components/chat/FloatingChatWidget").then((mod) => mod.FloatingChatWidget),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "CosRent | Thuê trang phục cosplay",
  description: "Tìm kiếm và đặt thuê trang phục cosplay dễ dàng cùng CosRent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var saved = localStorage.getItem('cosrent-theme');
                if (saved === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className={`${vietnameseSans.variable} ${elegantSerif.variable} antialiased bg-background text-foreground transition-colors duration-200`}>
        <ThemeProvider>
          {children}
          <FloatingChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
