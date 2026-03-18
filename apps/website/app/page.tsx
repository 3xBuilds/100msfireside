import AllowNotifications from '@/components/AllowNotifications';
import HighTrafficDrawer from '@/components/HighTrafficDrawer';
import LiveRoomList from '@/components/LiveRoomList';
import NavigationWrapper from '@/components/NavigationWrapper';
import MainHeader from '@/components/UI/MainHeader';
import { Metadata } from 'next';

export interface Room {
  _id: string;
  name: string;
  description: string;
  host: {
    fid: string;
    username: string;
    displayName: string;
    pfp_url: string;
  };
  status: string;
  startTime: string;
  strength: number;
  sponsorshipEnabled?: boolean;
  adsEnabled?: boolean;
  topics: string[];
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    return {
      title: "Fireside",
      description: "This is Fireside - Drop-in audio chat with interesting people",
      other: {
        "fc:frame": JSON.stringify({
          version: "next",
          imageUrl: "https://firesidebase.vercel.app/fireside_banner.png",
          button: {
            title: `Tune in!`,
            action: {
              type: "launch_frame",
              name: "Fireside",
              url: URL,
              splashImageUrl: "https://firesidebase.vercel.app/app-icon.png",
              splashBackgroundColor: "#000000",
            },
          },
        }),
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: "Fireside",
      description: "This is Fireside - Drop-in audio chat with interesting people",
    };
  }
}

export default async function Home() {
  return (
    <>
      <MainHeader/>
      <LiveRoomList />
      <AllowNotifications />
      {/* <HighTrafficDrawer /> */}
      <NavigationWrapper />
    </>
  );
}