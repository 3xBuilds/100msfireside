"use client";
import { useEffect, useRef, useState } from "react";
import { useAgoraContext } from "@/contexts/AgoraContext";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useAuthToken } from "@/hooks/useAuthToken";
import { TipNotificationProvider } from "@/contexts/TipNotificationContext";
import Conference from "@/components/Conference";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RoleChangeHandler from "@/components/RoleChangeHandler";
import AdsOverlay from "@/components/AdsOverlay";
import { Loader } from "@/components/Loader";
import { toast } from "react-toastify";
import { useNavigateWithLoader } from "@/utils/useNavigateWithLoader";
import {
  fetchAPI,
  addParticipantToRoom,
  removeParticipantFromRoom,
} from "@/utils/serverActions";
import { useAccount } from "wagmi";
import Overlays from "./Overlays";

interface CallClientProps {
  roomId: string;
}

export default function CallClient({ roomId }: CallClientProps) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const {address} = useAccount()

  const { user } = useGlobalContext();
  const { getToken } = useAuthToken();
  const { join, leave, isConnected, localPeer, setLocalAudioEnabled } = useAgoraContext();

  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasJoinStarted = useRef(false);

  useEffect(() => {
    // Request wake lock to keep screen active
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('[Wake Lock] Failed to acquire wake lock:', err);
      }
    };
    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release();
      }
    };
  }, []);

  useEffect(() => {
    if (hasJoinStarted.current) return;

    const attemptJoin = async (): Promise<void> => {
      if (hasJoinStarted.current) return;
      hasJoinStarted.current = true;

      const env = process.env.NEXT_PUBLIC_ENV;

      let authToken = "";
      if (env !== "DEV") {
        authToken = await getToken();
      }

      if (!user) {
        setError("User not authenticated");
        setIsJoining(false);
        hasJoinStarted.current = false;
        return;
      }

      try {
        // Fetch Agora token and channel info from backend
        const response = await fetchAPI(
          `${URL}/api/rooms/protected/${roomId}/my-code`,
          {
            authToken,
          }
        );

        if (!response.ok || !response.data.success) {
          throw new Error(response.data.error || "Failed to fetch room token");
        }

        const { role, token: agoraToken, channelName, uid, appId } = response.data.data;

        console.log("[Agora - CallClient] Received token and channel info:", response.data.data);

        // Join Agora channel with the user's role-based token
        await join(
          appId,
          channelName,
          agoraToken,
          uid,
          role,
          JSON.stringify({
            avatar: user.pfp_url,
            role: role,
            fid: user.privyId,
            wallet: user.wallet || "0x1ce256752fBa067675F09291d12A1f069f34f5e8",
          })
        );

        setIsJoining(false);
      } catch (err: any) {
        console.error("[Agora - CallClient] Error joining room:", {
          error: err,
          message: err?.message,
          timestamp: new Date().toISOString(),
        });

        setError(err instanceof Error ? err.message : "Failed to join room");
        setIsJoining(false);
        toast.error("Failed to join room. Please try again.");
      }
    };
    
    if (user && roomId) {
      attemptJoin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user]);

  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);

  useEffect(() => {
    if (isConnected && localPeer && user && !hasJoinedRoom) {
      const role = localPeer.roleName;

      // Only auto-mute on initial join, not on subsequent peer updates
      if (role === "host" || role === "co-host" || role === "speaker") {
        setLocalAudioEnabled(false);
      }

      // Add user as participant in Redis when they successfully join
      const addParticipantToRedis = async () => {
        const env = process.env.NEXT_PUBLIC_ENV;

        let authToken = "";
        if (env !== "DEV") {
          authToken = await getToken();
        }

        try {
          const response = await addParticipantToRoom(
            roomId,
            {
              userFid: user.privyId,
              role: role || "listener",
            },
            authToken
          );

          if (response.ok && response.data.success) {
            // User added to Redis participants
          } else {
            console.error(
              "Failed to add user to Redis participants:",
              response.data.error
            );
          }
        } catch (error) {
          console.error("Error adding participant to Redis:", error);
        }
      };

      addParticipantToRedis();
      setHasJoinedRoom(true);
    }
  }, [isConnected, localPeer, setLocalAudioEnabled, user, roomId, hasJoinedRoom]);

  // Cleanup: Remove user from Redis participants when component unmounts or user leaves
  useEffect(() => {
    const removeParticipantFromRedis = async () => {
      const env = process.env.NEXT_PUBLIC_ENV;

      let authToken = "";
      if (env !== "DEV") {
        authToken = await getToken();
      }

      if (user?.privyId) {
        try {
          await removeParticipantFromRoom(
            roomId,
            {
              userFid: user.privyId,
            },
            authToken
          );
        } catch (error) {
          console.error("Error removing participant from Redis:", error);
        }
      }
    };

    // Remove participant on page unload/refresh
    const handleBeforeUnload = () => {
      removeParticipantFromRedis();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      removeParticipantFromRedis();
    };
  }, [user, roomId]);

  const navigate = useNavigateWithLoader();

  if (error && error !== "Failed to fetch room token") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Error Joining Room
          </h1>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (error === "Failed to fetch room token") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Room has already ended
          </h1>
          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (isJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <TipNotificationProvider>
      <div className="min-h-screen">
        <RoleChangeHandler />
        <Header roomId={roomId} />
        <Overlays roomId={roomId} />
        <Conference roomId={roomId} />
        <Footer roomId={roomId} />
      </div>
    </TipNotificationProvider>
  );
}