"use client";
import { useEffect, useState } from "react";
import {
  useHMSActions,
  useHMSStore,
  selectLocalPeer,
  selectIsConnectedToRoom,
} from "@100mslive/react-sdk";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { TipNotificationProvider } from "@/contexts/TipNotificationContext";
import Conference from "@/components/Conference";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RoleChangeHandler from "@/components/RoleChangeHandler";
import AdsOverlay from "@/components/AdsOverlay";
import { Loader } from "@/components/Loader";
import { toast } from "react-toastify";
import sdk from "@farcaster/miniapp-sdk";
import { useNavigateWithLoader } from "@/utils/useNavigateWithLoader";
import {
  fetchAPI,
  fetchRoomCodes,
  addParticipantToRoom,
  removeParticipantFromRoom,
  fetchHMSActivePeers,
  removeHMSPeer,
} from "@/utils/serverActions";
import { useAccount } from "wagmi";
import Overlays from "./Overlays";
import { useXMTPClient } from "@/hooks";

interface RoomCode {
  id: string;
  code: string;
  room_id: string;
  role: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface CallClientProps {
  roomId: string;
}

export default function CallClient({ roomId }: CallClientProps) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const {address} = useAccount()

  const { user } = useGlobalContext();
  const hmsActions = useHMSActions();

  const localPeer = useHMSStore(selectLocalPeer);
  const isConnected = useHMSStore(selectIsConnectedToRoom);

  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize XMTP on backend when call starts
  const { initialized: xmtpInitialized, inboxId: xmtpInboxId, isLoading: xmtpLoading, error: xmtpError, initializeClient: initXMTP } = useXMTPClient();

  // Initialize XMTP on component mount (when user joins call)
  useEffect(() => {
    if (user && !xmtpInitialized && !xmtpLoading) {
      initXMTP();
    }
  }, [user, xmtpInitialized, xmtpLoading, initXMTP]);

  // Log XMTP initialization status
  useEffect(() => {
    if (xmtpInitialized && xmtpInboxId) {
      console.log('[XMTP] Backend client initialized:', xmtpInboxId);
    }
    if (xmtpError) {
      console.error('[XMTP] Initialization error:', xmtpError);
    }
  }, [xmtpInitialized, xmtpInboxId, xmtpError]);

  // Function to handle role limit reached error
  const handleRoleLimitError = async (hmsRoomId: string, userFid: number) => {
    try {
      
      // Fetch active peers from HMS room
      const peersResponse = await fetchHMSActivePeers(hmsRoomId);
      
      if (!peersResponse.ok || !peersResponse.data?.peers) {
        console.error('[Role Limit] Failed to fetch active peers');
        return false;
      }

      // Find peer with matching fid in metadata
      const peers = Object.values(peersResponse.data.peers) as any[];

      const duplicatePeer = peers.find((peer) => {
        try {
          if (peer.metadata) {
            const metadata = JSON.parse(peer.metadata);
            return metadata.fid === userFid;
          }
        } catch (e) {
          console.error('[Role Limit] Error parsing peer metadata:', e);
        }
        return false;
      });

      if (duplicatePeer) {
        
        // Remove the duplicate peer using HMS Management API
        const removeResponse = await removeHMSPeer(
          hmsRoomId, 
          duplicatePeer.id, 
          duplicatePeer.role || 'listener',
          'Removing duplicate session'
        );
        
        if (removeResponse.ok) {
          
          // Wait a bit for the removal to process
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          return true;
        } else {
          console.error('[Role Limit] Failed to remove duplicate peer:', removeResponse);
          return false;
        }
      } else {
        return false;
      }
    } catch (error) {
      console.error('[Role Limit] Error handling role limit:', error);
      return false;
    }
  };

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
    const attemptJoin = async (retryCount = 0): Promise<void> => {
      const env = process.env.NEXT_PUBLIC_ENV;

      var token: any = "";
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      if (!user) {
        setError("User not authenticated");
        setIsJoining(false);
        return;
      }

      const response = await fetchRoomCodes(roomId);

      if (!response.ok) {
        throw new Error(response.data.error || "Failed to fetch room codes");
      }

      const roomCodes: RoomCode[] = response.data.data.roomCodes;

      let roomCode = "";
      let role = "listener";
      let hmsRoomId = "";

      const roomResponse = await fetchAPI(
        `${URL}/api/rooms/public/${roomId}`
      );

      if (roomResponse.ok) {
        // Extract HMS room ID from room data
        hmsRoomId = roomResponse.data.data.room.hms_room_id || "";
        
        if (roomResponse.data.data.room.host?._id === user._id) {
          const hostCode = roomCodes.find((code) => code.role === "host");
          if (hostCode) {
            roomCode = hostCode.code;
            role = "host";
          }
        }
      }

      if (!roomCode) {
        try {
          const response = await fetchAPI(
            `${URL}/api/rooms/protected/${roomId}/my-code`,
            {
              authToken: token,
            }
          );

          if (response.ok && response.data.success) {
            roomCode = response.data.data.code;
            role = response.data.data.role;
          } else {
            console.error("Failed to get user role:", response.data.error);
            // Fallback to listener role
            const listenerCode = roomCodes.find(
              (code) => code.role === "listener"
            );
            if (listenerCode) {
              roomCode = listenerCode.code;
              role = "listener";
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          // Fallback to listener role
          const listenerCode = roomCodes.find(
            (code) => code.role === "listener"
          );
          if (listenerCode) {
            roomCode = listenerCode.code;
            role = "listener";
          }
        }
      }

      if (!roomCode) {
        throw new Error("No valid room code found");
      }

      const authToken = await hmsActions.getAuthTokenByRoomCode({
        roomCode: roomCode,
      });


      await hmsActions.join({
        userName: user.displayName || "Wanderer",
        authToken,
        settings: {
          isAudioMuted: true,
          isVideoMuted: true,
        },
        
        rememberDeviceSelection: true,
        metaData: JSON.stringify({
          avatar: user.pfp_url,
          role: role,
          fid: user.fid,
          wallet: user.wallet || "0x1ce256752fBa067675F09291d12A1f069f34f5e8",
        }),
      });

      setIsJoining(false);
    };

    const joinRoom = async () => {
      try {
        await attemptJoin();
      } catch (err: any) {
        console.error("[HMS Action - CallClient] Error joining room:", {
          error: err,
          message: err?.message,
          timestamp: new Date().toISOString(),
        });

        // Check if error is "role limit reached"
        const errorMessage = err?.message?.toLowerCase() || "";
        if (errorMessage.includes("role limit reached")) {

          try {
            // Get HMS room ID from the room data
            const roomResponse = await fetchAPI(
              `${URL}/api/rooms/public/${roomId}`
            );
            
            if (roomResponse.ok && roomResponse.data.data.room.roomId && user?.fid) {
              const hmsRoomId = roomResponse.data.data.room.roomId;
              const removed = await handleRoleLimitError(hmsRoomId, user.fid);
              
              if (removed) {
                // Retry joining
                await attemptJoin(1);
                return;
              }
            }
          } catch (retryErr) {
            console.error("[HMS Action - CallClient] Error during retry:", retryErr);
          }
        }

        setError(err instanceof Error ? err.message : "Failed to join room");
        setIsJoining(false);
        toast.error("Failed to join room. Please try again.");
      }
    };
    
    if (user && roomId) {
      joinRoom();
    }
  }, [roomId, user, hmsActions]);

  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);

  useEffect(() => {
    if (isConnected && localPeer && user && !hasJoinedRoom) {
      const role = localPeer.roleName;

      // Only auto-mute on initial join, not on subsequent peer updates
      if (role === "host" || role === "co-host" || role === "speaker") {
        hmsActions.setLocalAudioEnabled(false);
      }

      // Add user as participant in Redis when they successfully join
      const addParticipantToRedis = async () => {
        const env = process.env.NEXT_PUBLIC_ENV;

        var token: any = "";
        if (env !== "DEV") {
          token = (await sdk.quickAuth.getToken()).token;
        }

        try {
          const response = await addParticipantToRoom(
            roomId,
            {
              userFid: user.fid,
              role: role || "listener",
            },
            token
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
      setHasJoinedRoom(true); // Mark that we've completed the initial join process
    }
  }, [isConnected, localPeer, hmsActions, user, roomId, hasJoinedRoom]);

  // Cleanup: Remove user from Redis participants when component unmounts or user leaves
  useEffect(() => {
    const removeParticipantFromRedis = async () => {
      const env = process.env.NEXT_PUBLIC_ENV;

      var token: any = "";
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      if (user?.fid) {
        try {
          await removeParticipantFromRoom(
            roomId,
            {
              userFid: user.fid,
            },
            token
          );
          // User removed from Redis participants
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
      // Also remove on component unmount
      removeParticipantFromRedis();
    };
  }, [user, roomId]);

  const navigate = useNavigateWithLoader();

  if (error && error !== "Failed to fetch room codes") {
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

  if (error === "Failed to fetch room codes") {
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