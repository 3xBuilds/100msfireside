"use client";

import { useState, useEffect, Suspense } from "react";
import { FaPlay } from "react-icons/fa";
import { Card } from "@/components/UI/Card";
import Button from "@/components/UI/Button";
import { toast } from "react-toastify";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useRouter } from "next/navigation";

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
}

interface RecordingsProps {
  rooms: Room[];
}

export default function Recordings({ rooms }: RecordingsProps) {

  const [localRooms, setLocalRooms] = useState<Room[]>(rooms || []);
  const [loading, setLoading] = useState(!rooms || rooms.length === 0);
  const { user, setUser, isUserLoading } = useGlobalContext();
  const router = useRouter();

  // Refresh rooms client-side
  const refreshRooms = async () => {
    try {
      setLoading(true);
      const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${URL}/api/rooms/public/recorded`);
      const data = await response.json();
      
      if (data.success) {
        setLocalRooms(data.data.rooms);
        toast.success("Rooms refreshed!");
      }
    } catch (error) {
      console.error("Error refreshing rooms:", error);
      toast.error("Error refreshing rooms. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rooms && rooms.length > 0) {
      setLocalRooms(rooms);
      setLoading(false);
    }
  }, [rooms]);

  const handlePlayRecording = (roomId: string) => {
    router.push(`/recordings/${roomId}`);
  };

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
        <div className="text-left mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white mb-2">
            Explore <span className="text-orange-500">Recordings</span>
          </h1>
          <p className="text-white/70 text-sm">Missed the live action? Catch up on all the tea you missed!</p>
        </div>

        <div className="space-y-4">
          {localRooms.length === 0 ? (
            <div className="text-white/70 text-center py-8">
              No recordings available yet.
            </div>
          ) : (
            localRooms.map((room) => (
              <Card
                key={room._id}
                variant="ghost"
                className="p-4 flex items-center justify-between"
              >
                <div className="w-[85%]">
                  <h4 className="text-lg font-bold text-white">
                    {room.name}
                  </h4>
                  <p className="text-white/70 text-sm">
                    {room.description?.slice(0, 50)}{room.description?.length > 50 ? "..." : ""}
                  </p>
                  <p className="text-white/60 text-xs mt-1">
                    Host: {room.host?.displayName || room.host?.username}
                  </p>
                </div>
                <Button 
                  variant="default"
                  onClick={() => { handlePlayRecording(room._id) }} 
                  className="w-[15%] aspect-square rounded flex items-center justify-center p-0"
                >
                  <FaPlay className="" />
                </Button>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}