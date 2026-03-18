"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IoIosArrowForward } from "react-icons/io";

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

interface RoomsListProps {
  rooms: Room[];
}

export default function RoomsList({ rooms }: RoomsListProps) {
  const [redirectingRoomId, setRedirectingRoomId] = useState<string | null>(null);
  const router = useRouter();
    
  // Handle room click
  const handleRoomClick = (room: Room) => {
    setRedirectingRoomId(room._id);
    router.push(`/call/${room._id}`);
  };

  if (rooms.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 text-white/40 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <p className="text-white/60 text-lg">No rooms available yet</p>
        <p className="text-white/40 mt-2">
          Be the first to create a room!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rooms.map((room) => (
        <div
          key={room._id}
          className={`border border-white/20 rounded-lg p-2 cursor-pointer flex items-center justify-between hover:bg-white/10 transition-colors group ${redirectingRoomId === room._id ? 'animate-pulse' : ''}`}
          onClick={() => handleRoomClick(room)}
        >
          <div className="flex flex-col sm:flex-row w-[90%] sm:items-start sm:justify-between gap-3 pr-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium truncate w-full text-white group-hover:text-fireside-orange transition-colors break-words">
                {room.name}
              </h3>
              <div className="flex gap-2 text-white items-center text-xs">
                <p className="text-white/70 mt-1 break-words leading-relaxed">
                  Hosted by:{" "}
                </p>
                <div className="flex items-center gap-1 ">
                  <div className="w-5 aspect-square rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    {room?.host?.pfp_url ? (
                      <img
                        src={room?.host?.pfp_url}
                        alt="Host"
                        className="w-5 aspect-square rounded-full object-cover"
                      />
                    ) : (
                      <svg
                        className="w-4 h-4 text-white/60"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="truncate">
                    {room.host?.displayName ||
                      room.host?.username ||
                      `FID: ${room.host?.fid}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button className="text-white hover:text-fireside-orange aspect-square rounded-md transition-colors w-[10%]">
            {redirectingRoomId === room._id ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500 mx-auto"></div>
            ) : (
              <IoIosArrowForward className="mx-auto text-xl" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}