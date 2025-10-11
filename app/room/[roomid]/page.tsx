"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { fetchRoomDetails, updateRoom } from "@/utils/serverActions";
import Countdown from "@/components/Countdown";
import sdk from "@farcaster/miniapp-sdk";
import Image from "next/image";
import Header from "@/components/Header";

interface Room {
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
  topics: string[];
  sponsorshipEnabled: boolean;
  interested: string[];
}

export default function UpcomingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isUserLoading } = useGlobalContext();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingReminder, setSettingReminder] = useState(false);
  const [hasReminder, setHasReminder] = useState(false);

  const roomId = params.roomid as string;

  useEffect(() => {
    const loadRoomDetails = async () => {
      try {
        const response = await fetchRoomDetails(roomId);
        
        if (response.data.success) {
            console.log("Room details:", response.data.data);
          setRoom(response.data.data.room);
          
          // Check if user already has a reminder set
          if (user && response.data.data.interested) {
            setHasReminder(response.data.data.interested.includes(user.fid));
          }
        } else {
          toast.error("Failed to load room details");
        }
      } catch (error) {
        console.error("Error loading room:", error);
        toast.error("Error loading room details");
      } finally {
        setLoading(false);
      }
    };

    if (roomId) {
      loadRoomDetails();
    }
  }, [roomId, user]);

  const handleSetReminder = async () => {
    if (!user) {
      toast.error("Please log in to set reminders");
      return;
    }

    try {
      setSettingReminder(true);
      
      var token: any = "";
      const env = process.env.NEXT_PUBLIC_ENV;

      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      const response = await updateRoom(
        roomId,
        { interested: user.fid },
        token
      );

      if (response.data.success) {
        setHasReminder(true);
        toast.success("Reminder set! You'll be notified when the room starts.");
      } else {
        toast.error(response.data.error || "Failed to set reminder");
      }
    } catch (error) {
      console.error("Error setting reminder:", error);
      toast.error("Failed to set reminder");
    } finally {
      setSettingReminder(false);
    }
  };

  const joinRoom = () => {
    router.push(`/call/${roomId}`);
  };

  if (loading) {
    return (
      <div className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <div className="bg-white/5 rounded-lg p-8 animate-pulse">
            <div className="h-8 bg-white/20 rounded mb-4"></div>
            <div className="h-4 bg-white/10 rounded mb-2"></div>
            <div className="h-4 bg-white/10 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <div className="text-center text-white">
            <h1 className="text-2xl font-bold mb-4">Room Not Found</h1>
            <p className="text-white/70 mb-6">The room you're looking for doesn't exist.</p>
            <button
              onClick={() => router.push("/")}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-md font-semibold"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isUpcoming = room.status === "upcoming";
  const isLive = room.status === "ongoing";

  return (
    
    <div className="pt-16 min-h-screen">
        <Header/>
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="rounded-lg text-white">
          {/* Room Header */}
          <div className="flex items-start gap-4 mb-6">
            
              <Image
                src={room.host.pfp_url}
                alt={room.host.displayName}
                width={80}
                height={80}
                className="w-12 h-12 aspect-square rounded-full border-2 border-fireside-orange"
              />
          
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold text-white">{room.name}</h1>
                
              </div>
              
              <p className="text-white/90 text-sm mb-2">{room.description}</p>
              
              <div className="flex items-center gap-2 text-xs text-white/80">
                <span className="">Hosted by</span>
                <span className="font-semibold">
                  {room.host.displayName || room.host.username}
                </span>
              </div>
            </div>
          </div>

          {/* Countdown Section */}
          {isUpcoming && (
            <div className="bg-white/10 rounded-lg p-6 mb-6 text-center">
              <div className="text-3xl font-mono font-bold">
                <Countdown 
                  targetTime={room.startTime} 
                  className="gradient-fire-text text-nowrap"
                />
              </div>
              <p className="text-white/70 text-sm mt-2">
                Scheduled for {new Date(room.startTime).toLocaleString()}
              </p>
            </div>
          )}

          {/* Topics */}
          {room.topics && room.topics.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-white">Topics:</h3>
              <div className="flex flex-wrap gap-2">
                {room.topics.map((topic, index) => (
                  <span
                    key={index}
                    className="bg-white/20 px-3 py-1 rounded-full text-sm"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            {isUpcoming && (
              <button
                onClick={handleSetReminder}
                disabled={settingReminder || hasReminder || isUserLoading}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  hasReminder
                    ? "bg-green-600 text-white cursor-not-allowed"
                    : settingReminder
                    ? "opacity-50 cursor-not-allowed"
                    : "gradient-fire text-white hover:bg-gray-100"
                }`}
              >
                {settingReminder
                  ? "Setting Reminder..."
                  : hasReminder
                  ? "Reminder Set ✓"
                  : "Set Reminder"}
              </button>
            )}
            
            {isLive && (
              <button
                onClick={joinRoom}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Join Room
              </button>
            )}
            
            <button
              onClick={() => router.push("/")}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}