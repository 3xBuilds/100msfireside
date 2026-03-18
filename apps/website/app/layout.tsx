import "../styles/globals.css";
import { ReactNode } from "react";
import { Metadata } from "next";
import Providers from "@/utils/providers/providers";
import Background from "@/components/UI/Background";
import { DebugLoggerProvider, DebugLoggerDisplay } from "@/components/DebugLogger";
import RewardClaimDrawer from "@/components/RewardClaimDrawer";

interface RootLayoutProps {
  children: ReactNode;
}

// Enable debug mode via URL param or environment
const isDebugEnabled = process.env.NEXT_PUBLIC_DEBUG === 'true';

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, viewport-fit=cover, height=device-height" />
      </head>
      <body className="text-white relative max-h-screen overflow-x-hidden mb-40">
        <DebugLoggerProvider defaultEnabled={isDebugEnabled}>
          <Background />
          <div className="relative z-10 h-full">
            <Providers>{children}</Providers>
          </div>
          <RewardClaimDrawer />
          {/* <DebugLoggerDisplay /> */}
        </DebugLoggerProvider>
      </body>
    </html>
  );
}
