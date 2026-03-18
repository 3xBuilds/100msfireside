import CallClient from '@/components/CallClient';
import { fetchAPI } from '@/utils/serverActions';
import { Metadata } from 'next';
import { RewardProvider } from '@/contexts/RewardContext';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const response = await fetchAPI(`${URL}/api/rooms/public/${params.id}`);

  const data = response.data;

  console.log("Room metadata response:", data);

  const hostName = data.data.room?.host?.displayName;
  const roomName = data.data.room.name;
  const description = `Hosted by ${hostName}. ${data.data.room.description || 'Join the conversation on Fireside.'}`;
  const ogImageUrl = `${process.env.NEXT_PUBLIC_URL}/api/og/room/${params.id}`;
  const roomUrl = `${process.env.NEXT_PUBLIC_URL}/call/${params.id}`;

  console.log("Host name:", hostName);

  return {
    title: `${roomName} | Fireside`,
    description: description,
    openGraph: {
      title: roomName,
      description: description,
      url: roomUrl,
      siteName: 'Fireside',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${roomName} - Hosted by ${hostName}`,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: roomName,
      description: description,
      images: [ogImageUrl],
    },
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: ogImageUrl,
        button: {
          title: "Tune in!",
          action: {
            type: "launch_frame",
            name: "Fireside",
            url: roomUrl,
            splashImageUrl: "https://firesidebase.vercel.app/fireside-logo.svg",
            splashBackgroundColor: "#000000",
          },
        },
      }),
    },
  };
}

export default function CallPage({ params }: { params: { id: string } }) {
  return (
    <RewardProvider>
      <CallClient roomId={params.id} />
    </RewardProvider>
  );
}
