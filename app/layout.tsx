
import "../styles/globals.css";
import { ReactNode } from "react";
import { Metadata } from "next";
import Providers from "@/utils/providers/providers";
import BottomNavigation from "@/components/BottomNavigation";

export async function generateMetadata(): Promise<Metadata> {
  const URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
  return {
    title: "Fireside 100ms",
    description: "This is Fireside 100ms - Drop-in audio chat with interesting people",
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://100msfireside-kolt.vercel.app/pfp.png",
        button: {
          title: `Tune in!`,
          action: {
            type: "launch_frame",
            name: "Fireside 100ms",
            url: URL,
            splashImageUrl: "https://100msfireside-kolt.vercel.app/pfp.png",
            splashBackgroundColor: "#3b0404",
          },
        },
      }),
    },
  };
}

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <Providers>
          {children}
          <BottomNavigation />
        </Providers>
      </body>
    </html>
  );
}
