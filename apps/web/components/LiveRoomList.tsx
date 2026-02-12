"use client";

import { useState, useEffect, useCallback } from "react";
import { FaHeadphones } from "react-icons/fa";
import { IoIosRefresh } from "react-icons/io";
import { toast } from "react-toastify";
import { useGlobalContext } from "@/utils/providers/globalContext";
import UserDisplay from "./UserDisplay";
import SearchBar from "./UI/SearchBar";
import TopicSelector from "./TopicSelector";
import CreateRoomModal from "./CreateRoomModal";
import Countdown from "./Countdown";
import sdk from "@farcaster/miniapp-sdk";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  updateUserTopics,
  fetchUserByHandle,
  fetchAllRooms,
  fetchAPI,
  startRoom,
  skipRecurringRoom,
} from "@/utils/serverActions";
import { useNavigateWithLoader } from "@/utils/useNavigateWithLoader";
import { MdOutlineSchedule } from "react-icons/md";
import { GoDotFill } from "react-icons/go";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/UI/drawer";
import { Card } from "@/components/UI/Card";
import Button from "@/components/UI/Button";
import { useAccount } from "wagmi";

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
  strength: number;
  sponsorshipEnabled?: boolean;
  adsEnabled?: boolean;
  topics: string[];
  isRecurring?: boolean;
  recurrenceType?: 'daily' | 'weekly' | null;
  recurrenceDay?: number | null;
}

interface LiveRoomListProps {
  rooms?: Room[];
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

export default function LiveRoomList({ rooms }: LiveRoomListProps) {
  const [localRooms, setLocalRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const { user, setUser, isUserLoading } = useGlobalContext();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming'>('live');
  const router = useRouter();

  const [myUpcomingRooms, setMyUpcomingRooms] = useState<Room[]>([]);

  const navigate = useNavigateWithLoader()
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  const handleTopicSubmit = async (selectedTopics: string[]) => {
    try {
      var token: any = "";
      const env = process.env.NEXT_PUBLIC_ENV;

      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      const res = await updateUserTopics(selectedTopics, token);
      console.log("res", res);
      if (res.data.success) {
        toast.success("Topics updated!");

        // Refetch user
        const userData = await fetchUserByHandle(token);
        console.log("userData", userData);
        if (userData.data.success) {
          setUser(userData.data.data.user);
        }
      } else {
        toast.error(res.data.error || "Failed to update topics");
      }
    } catch (err) {
      console.error("Error updating topics:", err);
      toast.error(err instanceof Error ? err.message : "Error updating topics");
    }
  };

  // Fetch rooms client-side when user is loaded
  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await fetchAllRooms();

      if (response.data.success) {
        setLocalRooms(response.data.data.rooms);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Error loading rooms. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyUpcomingRooms = async () => {
    try{
      var token:any ;
                const env = process.env.NEXT_PUBLIC_ENV;
                if (env !== "DEV" && !token) {
                  token = ((await sdk.quickAuth.getToken()).token);
                }
      const response = await fetchAPI(`${URL}/api/rooms/protected/upcoming`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });

      console.log("Fetch my upcoming rooms response:", response);

      if(response.data.success){
        // Sort rooms by start time (closest first)
        const sortedRooms = response.data.data.rooms.sort((a: Room, b: Room) => 
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
        setMyUpcomingRooms(sortedRooms);
        console.log("My upcoming rooms:", sortedRooms);
      } else {
        console.error("Failed to fetch upcoming rooms:", response.data.error);
      }

    }
    catch(error){
      console.error("Error fetching my upcoming rooms:", error);
      toast.error("Failed to load your scheduled rooms");
    }
  }

  const handleGoLive = async (roomId: string) => {
    try {
      var token: any = "";
      const env = process.env.NEXT_PUBLIC_ENV;

      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      toast.loading("Starting room...", { toastId: "starting-room" });

      const response = await startRoom(roomId, user?.wallet || '', token);

      if (response.data.success) {
        const updatedRoom = response.data.data;
        toast.dismiss("starting-room");
        toast.success("Room started successfully!");
        
        // Navigate to the call page with the room ID
        navigate(`/call/${updatedRoom._id}`);
      } else {
        toast.dismiss("starting-room");
        toast.error(response.data.error || "Failed to start room");
      }
    } catch (error) {
      console.error("Error starting room:", error);
      toast.dismiss("starting-room");
      toast.error("Error starting room?. Please try again.");
    }
  };

  const handleSkipRoom = async (roomId: string) => {
    try {
      var token: any = "";
      const env = process.env.NEXT_PUBLIC_ENV;

      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      toast.loading("Skipping to next occurrence...", { toastId: "skipping-room" });

      const response = await skipRecurringRoom(roomId, token);

      if (response.data.success) {
        toast.dismiss("skipping-room");
        toast.success("Skipped to next occurrence!");
        
        // Refresh the upcoming rooms list
        await fetchMyUpcomingRooms();
      } else {
        toast.dismiss("skipping-room");
        toast.error(response.data.error || "Failed to skip room");
      }
    } catch (error) {
      console.error("Error skipping room:", error);
      toast.dismiss("skipping-room");
      toast.error("Error skipping room. Please try again.");
    }
  };


  // Fetch rooms when user is loaded
  useEffect(() => {
    if (!isUserLoading && user) {
      fetchRooms();
      fetchMyUpcomingRooms();
    }
  }, [user, isUserLoading]);

  // Handle initial rooms prop if provided
  useEffect(() => {
    if (rooms && rooms.length > 0) {
      setLocalRooms(rooms);
      setLoading(false);
    }
  }, [rooms]);

  useEffect(() => {
    // Pick a random welcome message
    const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
    setWelcomeMessage(welcomeMessages[randomIndex]);
  }, []);

  // Filter only live/ongoing rooms
  const liveRooms = localRooms.filter((room) => room?.status === "ongoing");
  const upcomingRooms = localRooms
    .filter((room) => room?.status === "upcoming" && room?.startTime > new Date().toISOString())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Auto-switch to appropriate tab based on available rooms
  useEffect(() => {
    if (!loading && !isUserLoading) {
      if (liveRooms.length === 0 && upcomingRooms.length > 0) {
        setActiveTab('upcoming');
      } else {
        setActiveTab('live');
      }
    }
  }, [liveRooms.length, upcomingRooms.length, loading, isUserLoading]);

  return (
    <div className="pt-16 min-h-screen pb-20">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
        <div className="text-left mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            Welcome,{" "}
            {isUserLoading ? (
              <div className="h-8 w-40 bg-white/20 rounded animate-pulse"></div>
            ) : (
              <UserDisplay />
            )}
          </h1>
        </div>

        {user && user?.adEarnings ? <Card className=" bg-fireside-green/10 border-fireside-green/30 text-fireside-green/50 rounded-md w-full p-2 text-xs font-medium text-white mb-6 ">
            Listener Rewards: <span className="gradient-money-text text-xl block font-bold mt-1">{user?.adEarnings.totalFire.toFixed(2)} $FIRE</span> 
        </Card> : <Card className=" bg-fireside-green/10 border-fireside-green/30 rounded-md w-full p-2 text-xs font-bold text-fireside-green/50 mb-6 flex justify-center items-center">
            Earn Listener Rewards by joining sponsored rooms! 
        </Card>}

        {/* <div className="mb-6">
          <SearchBar className="w-full" />
        </div> */}

        {/* Loading state - show when user is loading or rooms are loading */}
        {(isUserLoading || loading) && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                variant="ghost"
                className="flex items-center gap-2 w-full p-4 animate-pulse"
              >
                <div className="w-12 h-12 bg-white/20 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-white/20 rounded mb-2"></div>
                  <div className="h-3 bg-white/10 rounded w-2/3"></div>
                </div>
                <div className="h-6 w-16 bg-white/20 rounded"></div>
              </Card>
            ))}
          </div>
        )}

        {/* Topic selection if user.topics is empty */}
        {!isUserLoading && user?.topics?.length === 0 && (
          <TopicSelector onSubmit={handleTopicSubmit} />
        )}

        {/* Live Rooms Display */}
        {!loading && !isUserLoading && user && user?.topics?.length > 0 && (
          <div>
            {/* Your Schedule Button */}
            {myUpcomingRooms.length > 0 && (
              <div className="mb-6">
                <Drawer>
                  <DrawerTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="flex items-center gap-2 w-full justify-center text-white"
                    >
                      <MdOutlineSchedule className="text-lg text-white" />
                      Your Schedule ({myUpcomingRooms.length})
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="bg-black">
                    <DrawerHeader>
                      <DrawerTitle className="text-white text-xl font-bold">Your Scheduled Rooms</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                      {myUpcomingRooms.map((room) => (
                        <Card
                          key={room?._id}
                          variant="ghost"
                          className="p-4 backdrop-blur-sm text-white"
                        >
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Image
                                width={1080}
                                height={1080}
                                src={room?.host?.pfp_url}
                                alt={room?.host?.displayName}
                                className="w-12 h-12 rounded-full border-2 border-white"
                              />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 justify-between">
                                <h3 className="text-lg text-white font-bold truncate">
                                  {room?.name}
                                  {room?.isRecurring && (
                                    <span className="ml-2 text-xs text-orange-400">
                                      🔁
                                    </span>
                                  )}
                                </h3>
                                <div className="bg-black/30 rounded-full px-2 pb-1">
                                  <Countdown
                                    targetTime={room?.startTime}
                                    className="text-yellow-200 text-xs"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 mt-2">
                                {room?.isRecurring && (
                                  <DrawerClose asChild>
                                    <Button
                                      variant="ghost"
                                      onClick={() => handleSkipRoom(room?._id)}
                                      className="text-sm rounded-lg "
                                    >
                                      Skip
                                    </Button>
                                  </DrawerClose>
                                )}
                                <DrawerClose asChild>
                                  <Button
                                    variant="default"
                                    onClick={() => handleGoLive(room?._id)}
                                    className="text-sm rounded-lg w-full"
                                  >
                                    Start
                                  </Button>
                                </DrawerClose>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
            )}

            {/* Toggle Buttons */}
            <div className="mb-6 flex gap-3 w-full">
              <Button
                variant="action"
                active={activeTab === 'live'}
                onClick={() => setActiveTab('live')}
                className="w-1/2"
              >
                <GoDotFill className="inline mb-1 mr-1 animate-pulse" />
                Live
              </Button>
              <Button
                variant="action"
                active={activeTab === 'upcoming'}
                onClick={() => setActiveTab('upcoming')}
                className="w-1/2"
              >
                <MdOutlineSchedule className="inline mb-1 mr-1" />
                Upcoming
              </Button>
            </div>

            {/* Live Conversations Tab */}
            {activeTab === 'live' && (
              <div>
                {liveRooms.length > 0 ? (
                  <div className="space-y-3">
                    {liveRooms.map((room) => {
                      const roomHasAds = room?.adsEnabled ?? room?.sponsorshipEnabled ?? false;
                      return (
                        <Card
                          onClick={() => router.push(`/call/${room?._id}`)}
                          key={room?._id}
                          variant={"ghost"}
                          className={`flex items-center gap-3 w-full p-4 font-bold cursor-pointer hover:opacity-80 transition-opacity ${roomHasAds ? "bg-fireside-orange/10 border-fireside-orange/30 text-white" : "bg-fireside-green/5 border-fireside-green/20 text-white"} `}
                        >
                        <div className="relative">
                          <Image
                            src={`${process.env.NEXT_PUBLIC_URL}/waves.gif`}
                            width={1920}
                            height={1080}
                            alt="Fireside Logo"
                            className="w-12 h-12 rounded-full absolute left-0 top-0 p-1 brightness-0 invert grayscale opacity-70"
                          />
                          <Image
                            width={1080}
                            height={1080}
                            src={room?.host?.pfp_url}
                            alt={room?.host?.displayName}
                            className="w-12 h-12 rounded-full border-2 border-white"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg text-white font-bold truncate">
                              {room?.name.slice(0, 30)}
                              {room?.name.length > 30 ? "..." : ""}
                            </h3>
                            <span className="text-white flex gap-1 items-center justify-center ml-2">
                              {room?.strength || 0} <FaHeadphones />
                            </span>
                          </div>
                          <p className="text-white/80 text-sm truncate">
                            {room?.description.slice(0, 60)}
                            {room?.description.length > 60 ? "..." : ""}
                          </p>
                          <p className="text-white/70 text-xs">
                            Host: {room?.host?.displayName || room?.host?.username}
                          </p>
                        </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-left">
                    <p className="text-white/70 mb-4 text-lg">
                      No live conversations right now
                    </p>
                    <Button
                      variant="action"
                      active={true}
                      className=" text-white px-6 py-2 rounded-md font-semibold"
                      onClick={() => setShowCreateModal(true)}
                    >
                      Create a Room
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Upcoming Conversations Tab */}
            {activeTab === 'upcoming' && (
              <div>
                {upcomingRooms.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingRooms.map((room) => (
                      <Card
                      variant="ghost"
                        onClick={() => navigate(`/room/${room?._id}`)}
                        key={room?._id}
                        className="relative flex items-center gap-3 w-full p-4 font-bold cursor-pointer hover:opacity-80 transition-opacity text-white"
                      >
                        <div className="relative">
                          <Image
                            width={1080}
                            height={1080}
                            src={room?.host?.pfp_url}
                            alt={room?.host?.displayName}
                            className="w-12 h-12 rounded-full border-2 border-white"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg text-white font-bold truncate">
                              {room?.name.slice(0, 30)}
                              {room?.name.length > 30 ? "..." : ""}
                            </h3>
                          </div>
                          <p className="text-white/70 text-xs">
                            Host: {room?.host?.displayName || room?.host?.username}
                          </p>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/10 rounded-full px-2 pb-1">
                          <Countdown
                            targetTime={room?.startTime}
                            className="text-yellow-200 text-xs"
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-left">
                    <p className="text-white/70 mb-4 text-lg">
                      No upcoming conversations scheduled
                    </p>
                    <Button
                    className=" text-white px-6 py-2 rounded-md font-semibold"
                      variant="action"
                      active={true}
                      onClick={() => setShowCreateModal(true)}
                    >
                      Create a Room
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* CreateRoomModal */}
            <CreateRoomModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}