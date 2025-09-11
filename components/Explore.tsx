"use client";

import { useState, useEffect, Suspense } from "react";
import { FaPlay } from "react-icons/fa";
import { IoIosRefresh } from "react-icons/io";
import toast from "react-hot-toast";
import { useGlobalContext } from "@/utils/providers/globalContext";
import RoomsList from "./RoomsList";
import UserDisplay from "./UserDisplay";
import SearchBar from "./UI/SearchBar";
import TopicSelector from "./TopicSelector";
import CreateRoomModal from "./CreateRoomModal";
import sdk from "@farcaster/miniapp-sdk";
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

interface ExploreProps {
  rooms: Room[];
}

// Array of different welcome messages
const welcomeMessages = [
  "Which conversation would you like to join today?",
  "Ready to join an interesting discussion?",
  "Discover exciting conversations happening now!",
  "Find your next fascinating discussion!",
  "What topic interests you the most right now?",
  "Connect with others in meaningful conversations!",
  "Explore live discussions and join the conversation!",
  "Looking for an engaging chat? We've got you covered!",
  "Jump into a conversation that catches your interest!",
  "Ready to share your thoughts in a live discussion?",
];

export default function Explore({ rooms }: ExploreProps) {

  const [localRooms, setLocalRooms] = useState<Room[]>(rooms || []);
  const [loading, setLoading] = useState(!rooms || rooms.length === 0);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const { user, setUser } = useGlobalContext();
  // Add state for selected tab
  const [selectedTab, setSelectedTab] = useState(0);
  const [isUserLoading, setIsUserLoading] = useState(true);
  // Handle topic selection and PATCH request
  const handleTopicSubmit = async (selectedTopics: string[]) => {
    try {
      var token: any = "";
      const env = process.env.NEXT_PUBLIC_ENV;

      if (env !== "DEV") {
        token = ((await sdk.quickAuth.getToken()).token);
      }

      const res = await fetch("/api/protected/handleUser", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ topics: selectedTopics }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Topics updated!");
        // Refetch user
        const userRes = await fetch("/api/protected/handleUser", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
        });
        const userData = await userRes.json();
        setUser(userData.user);
      } else {
        toast.error(data.error || "Failed to update topics");
      }
    } catch (err) {
      toast.error("Error updating topics");
    }
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [topicRooms, setTopicRooms] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Fetch rooms by user's topics
  useEffect(() => {
    const fetchRoomsByTopics = async () => {
      if (user?.topics?.length > 0) {
        try {
          const res = await fetch("/api/rooms/by-topics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topics: user.topics }),
          });
          const data = await res.json();
          if (data.success) {
            setTopicRooms(data.rooms);
          }
        } catch (err) {
          setTopicRooms([]);
        }
      }
    };
    fetchRoomsByTopics();
  }, [user?.topics]);

  // Refresh rooms client-side
  const refreshRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/rooms");
      const data = await response.json();
      if (data.success) {
        setLocalRooms(data.rooms);
        toast.success("Rooms refreshed!");
      }
    } catch (error) {
      console.error("Error refreshing rooms:", error);
      toast.error("Error refreshing rooms. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle search function
  // const handleSearch = (query: string) => {
  //   if (!query.trim()) {
  //     setSearchResults([]);
  //     return;
  //   }

  //   setIsLoading(true);

  //   // Filter rooms based on search query
  //   const filteredRooms = localRooms.filter(
  //     (room) =>
  //       room.name.toLowerCase().includes(query.toLowerCase()) ||
  //       room.description.toLowerCase().includes(query.toLowerCase()) ||
  //       room.host.username.toLowerCase().includes(query.toLowerCase()) ||
  //       room.host.displayName.toLowerCase().includes(query.toLowerCase())
  //   );

  //   // Convert to search results format
  //   const results = filteredRooms.map((room) => ({
  //     id: room._id,
  //     title: room.name,
  //     image: room.host.pfp_url,
  //     description: room.description,
  //     hostName: room.host.displayName || room.host.username,
  //   }));

  //   setSearchResults(results);
  //   setIsLoading(false);
  // };

  useEffect(() => {
    console.log("Rooms prop changed:", rooms);
    if (rooms && rooms.length > 0) {
      console.log("Setting localRooms with data from props");
      setLocalRooms(rooms);
      setLoading(false); // Set loading to false once we have rooms
    }
  }, [rooms]);

  useEffect(() => {
    // Pick a random welcome message
    const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
    setWelcomeMessage(welcomeMessages[randomIndex]);
  }, []);
  
  // Update loading state when user data changes
  useEffect(() => {
    if (user !== undefined) {
      setIsUserLoading(false);
    }
  }, [user]);

  const router = useRouter();

  const handlePlayRecording = (roomId: string) => {
    router.push(`/recordings/${roomId}`);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
        <div className="text-left mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white mb-2">
            Welcome, {isUserLoading ? (
              <div className="h-8 w-40 bg-white/20 rounded animate-pulse"></div>
            ) : (
              <UserDisplay />
            )}
          </h1>
          <p className="text-white/70 text-sm">{welcomeMessage}</p>
        </div>

        <div className="mb-6">
          <SearchBar className="w-full" />
        </div>

        {/* Loading state - placeholder skeletons for categories and rooms */}
        {isUserLoading && (
          <div>
            <h2 className="text-white text-xl font-bold mb-4">
              Explore what you like!
            </h2>
            {/* Placeholder for category tabs */}
            <div className="flex gap-2 mb-6 overflow-x-scroll hide-scrollbar">
              {[1, 2, 3, 4, 5].map((i) => (
                <div 
                  key={i}
                  className="px-4 py-2 rounded-lg bg-white/10 animate-pulse w-24 h-9"
                ></div>
              ))}
            </div>
            
            {/* Placeholder for rooms */}
            <div className="mb-10">
              <div className="h-7 w-32 bg-orange-400/50 rounded animate-pulse mb-2"></div>
              <div className="mb-4">
                <div className="h-6 w-24 bg-orange-500/50 rounded animate-pulse mb-2"></div>
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="border border-orange-500/50 rounded-lg p-4 bg-white/5 backdrop-blur-sm flex items-center justify-between"
                    >
                      <div className="w-4/5">
                        <div className="h-6 w-4/5 bg-white/20 rounded animate-pulse mb-2"></div>
                        <div className="h-4 w-full bg-white/10 rounded animate-pulse mb-2"></div>
                        <div className="h-3 w-1/3 bg-white/10 rounded animate-pulse mb-2"></div>
                        <div className="flex gap-1 mt-2">
                          {[1, 2].map((j) => (
                            <div
                              key={j}
                              className="h-5 w-16 bg-orange-600/50 rounded-full animate-pulse"
                            ></div>
                          ))}
                        </div>
                      </div>
                      <div className="h-9 w-12 bg-orange-600/50 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Placeholder for recordings */}
              <div className="mb-4">
                <div className="h-6 w-24 bg-white/30 rounded animate-pulse mb-2"></div>
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="border border-white/20 rounded-lg p-4 bg-white/5 backdrop-blur-sm flex items-center justify-between"
                    >
                      <div className="w-[85%]">
                        <div className="h-6 w-4/5 bg-white/20 rounded animate-pulse mb-2"></div>
                        <div className="h-4 w-full bg-white/10 rounded animate-pulse mb-2"></div>
                        <div className="h-3 w-1/3 bg-white/10 rounded animate-pulse mb-2"></div>
                        <div className="flex gap-1 mt-2">
                          {[1, 2].map((j) => (
                            <div
                              key={j}
                              className="h-5 w-16 bg-orange-600/50 rounded-full animate-pulse"
                            ></div>
                          ))}
                        </div>
                      </div>
                      <div className="w-[15%] aspect-square rounded bg-gradient-to-br from-orange-500/50 to-red-500/50 animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Topic selection if user.topics is empty */}
        {!isUserLoading && user?.topics?.length === 0 && (
          <TopicSelector onSubmit={handleTopicSubmit} />
        )}

        {!isUserLoading && user?.topics?.length > 0 && (
          <div>
            <h2 className="text-white text-xl font-bold mb-4">
              Explore what you like!
            </h2>
            {/* Tabs for topics */}
              <div className="flex gap-2 mb-6 overflow-x-scroll hide-scrollbar">
              {user.topics.map((topic: string, idx: number) => (
                <button
                  key={topic}
                  className={`px-4 leading-none text-nowrap py-2 rounded-lg font-semibold transition-colors text-white ${
                    selectedTab === idx
                      ? "gradient-fire font-bold border-white border-2"
                      : "bg-white/10 border-transparent"
                  }`}
                  onClick={() => setSelectedTab(idx)}
                >
                  {topic}
                </button>
              ))}
            </div>
            {/* Tab content for selected topic */}
            {(() => {
              const topic = user.topics[selectedTab] as string;
              const ongoingRooms = topicRooms.filter(
                (r) => r.status === "ongoing" && r.topics.includes(topic)
              );
              const endedRooms = topicRooms.filter(
                (r) => r.status === "ended" && r.topics.includes(topic)
              );
              return (
                <div key={topic} className="mb-10">
                  <h3 className="text-lg font-bold text-orange-400 mb-2">
                    {topic}
                  </h3>
                  {/* Ongoing rooms for this topic */}
                  {ongoingRooms.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-md font-semibold text-orange-500 mb-2">
                        Live Now!
                      </h4>
                      <div className="space-y-4">
                        {ongoingRooms.map((room) => (
                          <div
                            key={room._id}
                            className="border border-orange-500 rounded-lg p-4 bg-white/5 backdrop-blur-sm flex items-center justify-between cursor-pointer hover:bg-orange-900/20 transition-colors"
                            onClick={() =>
                              (window.location.href = `/call/${room._id}`)
                            }
                          >
                            <div>
                              <h4 className="text-lg font-bold text-white">
                                {room.name}
                              </h4>
                              <p className="text-white/70 text-sm">
                                {room.description.slice(0,50)}{room.description.length>50?"...":""}
                              </p>
                              <p className="text-white/60 text-xs mt-1">
                                Host:{" "}
                                {room.host?.displayName || room.host?.username}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {room.topics.map((t: string) => (
                                  <span
                                    key={t}
                                    className="px-2 py-1 bg-orange-600 text-white text-xs rounded-full"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <span className="bg-orange-600 text-white px-4 py-2 rounded font-bold">
                              Live
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Ended rooms for this topic */}
                  {endedRooms.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-md font-semibold text-white mb-2">
                        Recordings
                      </h4>
                      <div className="space-y-4">
                        {endedRooms.map((room) => (
                          <div
                            key={room._id}
                            className="border border-white/20 rounded-lg p-4 bg-white/5 backdrop-blur-sm flex items-center justify-between"
                          >
                            <div className="w-[85%]">
                              <h4 className="text-lg font-bold text-white">
                                {room.name}
                              </h4>
                              <p className="text-white/70 text-sm">
                                {room.description.slice(0,50)}{room.description.length>50?"...":""}
                              </p>
                              <p className="text-white/60 text-xs mt-1">
                                Host:{" "}
                                {room.host?.displayName || room.host?.username}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {room.topics.map((t: string) => (
                                  <span
                                    key={t}
                                    className="px-2 py-1 bg-orange-600 text-white text-xs rounded-full"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button onClick={()=>{handlePlayRecording(room.roomId)}} className=" text-white w-[15%] aspect-square gradient-fire rounded flex items-center justify-center font-bold">
                              <FaPlay className="" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* No rooms for this topic */}
                  {ongoingRooms.length === 0 && endedRooms.length === 0 && (
                    <div className="text-white/70 mb-4">
                      This topic hasn&apos;t been discussed yet. Be the first
                      one to bring it to light.
                    </div>
                  )}
                  {/* Button to create room for this topic if no rooms exist */}
                  {ongoingRooms.length === 0 && endedRooms.length === 0 && (
                    <button
                      className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-md font-semibold"
                      onClick={() => setShowCreateModal(true)}
                    >
                      Create Room
                    </button>
                  )}
                </div>
              );
            })()}
            {/* CreateRoomModal */}
            <CreateRoomModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
            />
          </div>
        )}

        {/* Rooms List and other sections remain unchanged (commented out) */}
      </div>
    </div>
  );
}
