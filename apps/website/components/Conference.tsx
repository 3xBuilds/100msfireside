"use client";

import { useAgoraContext, AgoraPeer } from "@/contexts/AgoraContext";
import {
  useSpeakerRequestEvent,
  useSpeakerRejectionEvent,
  useTipEvent,
  useRoomEndedEvent,
  useHandRaiseEvent,
} from "@/utils/events";
import PeerWithContextMenu from "./PeerWithContextMenu";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useAuthToken } from "@/hooks/useAuthToken";
import { motion, AnimatePresence } from "framer-motion";
import RoomEndScreen from "./RoomEndScreen";
import { toast } from "react-toastify";
import {
  fetchRoomDetails,
  endRoom,
  startRecording,
  fetchAPI,
  updateParticipantRole,
} from "@/utils/serverActions";

import { HandRaiseSparks, ScrollingName } from "./experimental";
import { FirelightField } from "./experimental";
import AvatarContextMenu from "./AvatarContextMenu";
import PanelMember from "./PanelMember";
import ListenerMember from "./ListenerMember";
import TippingDrawer from "./TippingDrawer";
import TipsDisplay from "./TipsDisplay";
import AdsOverlay from "./AdsOverlay";
import { Card } from "./UI/Card";
import { DotIcon } from "lucide-react";
import { GoDotFill } from "react-icons/go";
import { useRewardContext } from "@/contexts/RewardContext";
// import AudioRecoveryBanner from "./AudioRecoveryBanner";

export default function Conference({ roomId }: { roomId: string }) {
  const { localPeer, remotePeers, leave, isConnected, audioLevels, sendCustomEvent } = useAgoraContext();
  const allPeers = (() => {
    const peers: AgoraPeer[] = [];
    if (localPeer) peers.push(localPeer);
    remotePeers.forEach((p) => peers.push(p));
    return peers;
  })();
  const router = useRouter();
  const { user } = useGlobalContext();
  const { getToken } = useAuthToken();
  const { rewardData, clearRewardData } = useRewardContext();

  // Audio debugging: Track all peer state changes
  useEffect(() => {
    console.group("[AUDIO DEBUG] Peer Update");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Total peers:", allPeers.length);
    console.log(
      "Peer join order:",
      allPeers.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.roleName,
        hasAudio: !!p.audioTrack,
        audioTrackId: p.audioTrack,
      }))
    );
    console.groupEnd();
  }, [allPeers]);

  // Ref to track previous peers for empty room detection
  const previousPeersRef = useRef<any[]>([]);

  // Local state for optimistic updates
  const [peers, setPeers] = useState(allPeers);
  const [removedPeers, setRemovedPeers] = useState<Set<string>>(new Set());
  const [isEndingRoom, setIsEndingRoom] = useState(false);
  const [flicker, setFlicker] = useState(0.6);
  const [reactions, setReactions] = useState<
    { id: string; emoji: string; left: number }[]
  >([]);

  // Speaker request management
  interface SpeakerRequest {
    peerId: string;
    fid: string;
    peerName?: string;
    peerAvatar?: string | null;
    timestamp?: string;
  }

  const [speakerRequests, setSpeakerRequests] = useState<SpeakerRequest[]>([]);
  const [showSpeakerRequestsDrawer, setShowSpeakerRequestsDrawer] =
    useState(false);

  const [roomEnded, setRoomEnded] = useState(false);
  const wasConnectedRef = useRef(false);
  const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const [showAvatarContextMenu, setShowAvatarContextMenu] = useState(false);
  const [showTippingDrawer, setShowTippingDrawer] = useState(false);
  const [handRaisedPeers, setHandRaisedPeers] = useState<Set<string>>(new Set());

  //function to fetch room details and save name and description in a useState. Call the function in useEffect
  const [roomDetails, setRoomDetails] = useState<{
    name: string;
    description: string;
    recordingEnabled?: boolean;
  } | null>(null);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [showRecordingDropdown, setShowRecordingDropdown] = useState(false);
  const recordingDropdownRef = useRef<HTMLDivElement>(null);

  const { rejectSpeakerRequest } = useSpeakerRejectionEvent();

  const handleReject = (request: SpeakerRequest) => {
    // Validate the request object
    if (!request || !request.peerId) {
      console.error("Invalid speaker request received for rejection");
      return;
    }

    // Remove from state
    setSpeakerRequests((prevRequests) =>
      prevRequests.filter((req) => req.peerId !== request.peerId)
    );

    // Trigger the SPEAKER_REJECTED event
    rejectSpeakerRequest(request.fid);
  };

  const handleSpeakerRequest = (event: any) => {
    // Extract peer ID from the event
    const peerId = event.peerId || (event.detail && event.detail.peerId);

    console.log("[HMS Event - Conference] Speaker request received", {
      peerId,
      event,
      localRole: localPeer?.roleName,
      timestamp: new Date().toISOString(),
    });

    if (!peerId) {
      console.error(
        "[HMS Event - Conference] Speaker request missing peer ID",
        event
      );
      return;
    }

    // Only hosts and co-hosts should see requests
    if (localPeer?.roleName === "host" || localPeer?.roleName === "co-host") {
      setSpeakerRequests((prevRequests) => {
        // Check if this request already exists
        const exists = prevRequests.some((req) => req.peerId === peerId);
        if (exists) return prevRequests;

        // Create a new request object that matches our interface
        const newRequest: SpeakerRequest = {
          peerId: peerId,
          fid: event.fid,
          peerName: "Unknown User", // Default name if not provided
          timestamp: new Date().toISOString(), // Current timestamp
        };

        // Try to find peer in room to get their name
        const peer = allPeers.find(
          (p) => JSON.parse(p.metadata as string).fid === event.fid
        );
        if (peer && peer.name) {
          newRequest.peerName = peer.name;
        }

        if (peer && JSON.parse(peer.metadata as string).avatar) {
          newRequest.peerAvatar = JSON.parse(peer.metadata as string).avatar;
        }

        // Add the new request
        return [...prevRequests, newRequest];
      });

      // Show toast notification with the peer name if available
      const peer = allPeers.find((p) => p.id === peerId);
      const displayName = peer?.name || "Someone";
      toast.success(`${displayName} has requested to speak`, {
        autoClose: 3000,
        toastId: `speaker-request-${peerId}-${Date.now()}`,
      });
    }
  };

  // Use the custom hook for speaker requests
  useSpeakerRequestEvent((msg) => {
    console.log("[HMS Event - Conference] Speaker request event received", {
      peer: msg.peer,
      timestamp: new Date().toISOString(),
    });
    handleSpeakerRequest({ peerId: msg.peerId, fid: msg.peer });
  });


  // Hand raise event listener
  useHandRaiseEvent((msg) => {
    console.log("[Agora Event - Conference] Hand raise event received", {
      peerId: msg.peerId,
      peerName: msg.peerName,
      raised: msg.raised,
      timestamp: new Date().toISOString(),
    });

    if (msg.raised) {
      setHandRaisedPeers((prev) => {
        const next = new Set(prev);
        next.add(msg.peerId);
        return next;
      });

      // Show toast notification for hosts and co-hosts
      if (localPeer?.roleName === "host" || localPeer?.roleName === "co-host") {
        toast.info(`✋ ${msg.peerName} raised their hand`, {
          autoClose: 3000,
          toastId: `hand-raise-${msg.peerId}-${Date.now()}`,
        });
      }
    } else {
      setHandRaisedPeers((prev) => {
        const next = new Set(prev);
        next.delete(msg.peerId);
        return next;
      });
    }
  });

  // Hand raise is now handled via custom events (useSpeakerRequestEvent above)
  // Room ended is handled via useRoomEndedEvent
  useRoomEndedEvent(() => {
    console.log("[Agora Event - Conference] Room ended, showing end screen");
    setRoomEnded(true);
  });

  // Fallback: detect Agora disconnect and check if room has ended.
  // Covers the race condition where the ENDED_REWARD event is missed because
  // the backend killed the Agora channel before the event could be polled.
  useEffect(() => {
    if (isConnected) {
      wasConnectedRef.current = true;
      return;
    }

    // Only act on a true->false transition (not on initial mount)
    if (!wasConnectedRef.current || roomEnded) return;

    let cancelled = false;
    const checkRoomStatus = async () => {
      try {
        const response = await fetchRoomDetails(roomId);
        if (cancelled) return;
        const status = response.data?.data?.room?.status;
        if (status === 'ended') {
          console.log("[Conference] Agora disconnected and room is ended, showing end screen");
          setRoomEnded(true);
        }
      } catch (err) {
        // Network error — don't trigger end screen on connectivity issues
        console.warn("[Conference] Failed to check room status after disconnect:", err);
      }
    };

    checkRoomStatus();
    return () => { cancelled = true; };
  }, [isConnected, roomEnded, roomId]);

  useEffect(() => {
    async function getRoomDetails() {
      try {
        const response = await fetchRoomDetails(roomId);
        if (response.data.success) {
          setRoomDetails({
            name: response.data.data.room.name,
            description: response.data.data.room.description,
            recordingEnabled: response.data.data.room.recordingEnabled,
          });
        }
      } catch (error) {
        console.error("Error fetching room details:", error);
      }
    }

    getRoomDetails();
  }, [roomId]);

  // Function to handle ending room when empty - memoized with useCallback
  const handleEmptyRoom = useCallback(async () => {
    // Only the host should end the room
    if (!localPeer || localPeer.roleName !== "host" || isEndingRoom) return;

    try {
      setIsEndingRoom(true);

      // Call API to end the room (skip if in test mode)
      if (!user?._id) {
        console.log("[Conference] Test mode: skipping room end API call");
        await leave();
        router.push("/");
        return;
      }
      const response = await endRoom(roomId, user._id);

      if (!response.ok) {
        console.error("Failed to end empty room:", response.data.error);
        setIsEndingRoom(false);
        return;
      }

      // Leave the room
      await leave();
      router.push("/");
    } catch (error) {
      console.error("Error ending empty room:", error);
      setIsEndingRoom(false);
    }
  }, [roomId, user, localPeer, isEndingRoom, leave, router]);

  // REMOVED: Problematic iOS WebKit audio fix that manipulated remote peer volumes
  // This was causing the bug where random participants would be muted when others toggled audio
  // The setVolume() API should only be used for actual volume control, not muting/unmuting
  // Local audio should be controlled with setLocalAudioEnabled() only

  useEffect(() => {
    // Update local peers when 100ms peers change
    const uniquePeers = new Map();
    allPeers.forEach((peer) => {
      if (!removedPeers.has(peer.id)) {
        uniquePeers.set(peer.id, peer);
      }
    });

    // Get peers and sort by role priority: host > co-host > speaker > listener
    const currentPeers = Array.from(uniquePeers.values());

    // Define role priority order
    const rolePriority: { [key: string]: number } = {
      host: 1,
      "co-host": 2,
      speaker: 3,
      listener: 4,
    };

    // Sort peers by role priority
    const sortedPeers = currentPeers.sort((a, b) => {
      const roleA = a.roleName?.toLowerCase() || "listener";
      const roleB = b.roleName?.toLowerCase() || "listener";

      return (rolePriority[roleA] || 5) - (rolePriority[roleB] || 5);
    });

    setPeers(sortedPeers);

    // Check if room is empty and should be ended
    // Use a timer to ensure we don't end the room during transient states
    let emptyRoomTimer: NodeJS.Timeout | null = null;

    if (currentPeers.length === 0 && previousPeersRef.current.length > 0) {
      // Wait 10 seconds before ending the room to ensure it's really empty
      emptyRoomTimer = setTimeout(() => {
        // We'll re-use the latest allPeers value when the timeout executes
        if (allPeers.length === 0) {
          handleEmptyRoom();
        } else {
        }
      }, 10000); // 10 second delay
    }

    // Update the previous peers reference
    previousPeersRef.current = currentPeers;

    // Clear timeout if component unmounts or peers change
    return () => {
      if (emptyRoomTimer) {
        clearTimeout(emptyRoomTimer);
      }
    };
  }, [allPeers, removedPeers, handleEmptyRoom]);

  useEffect(() => {
    // Handle optimistic peer removal
    const handlePeerRemoved = (event: CustomEvent) => {
      const { peerId } = event.detail;
      setRemovedPeers((prev) => new Set(prev).add(peerId));
    };

    // Handle peer restoration if removal failed
    const handlePeerRestored = (event: CustomEvent) => {
      const { peerId } = event.detail;
      setRemovedPeers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(peerId);
        return newSet;
      });
    };

    // Handle click outside to close recording dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (
        recordingDropdownRef.current &&
        !recordingDropdownRef.current.contains(event.target as Node)
      ) {
        setShowRecordingDropdown(false);
      }
    };

    // Add event listeners
    window.addEventListener("peerRemoved", handlePeerRemoved as EventListener);
    window.addEventListener(
      "peerRestored",
      handlePeerRestored as EventListener
    );
    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup
    return () => {
      window.removeEventListener(
        "peerRemoved",
        handlePeerRemoved as EventListener
      );
      window.removeEventListener(
        "peerRestored",
        handlePeerRestored as EventListener
      );
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle speaker requests
  // useEffect(() => {
  //   // Listen for speaker request events

  //   // Listen for speaker rejection events
  //   const handleSpeakerRejection = (event: CustomEvent) => {
  //     const { peerId } = event.detail;

  //     // Remove the rejected request
  //     setSpeakerRequests((prevRequests) =>
  //       prevRequests.filter(request => request.peerId !== peerId)
  //     );
  //   };

  //   // Add event listeners
  //   window.addEventListener('SPEAKER_REQUESTED', handleSpeakerRequest as EventListener);
  //   window.addEventListener('SPEAKER_REJECTED', handleSpeakerRejection as EventListener);

  //   // Cleanup
  //   return () => {
  //     window.removeEventListener('SPEAKER_REQUESTED', handleSpeakerRequest as EventListener);
  //     window.removeEventListener('SPEAKER_REJECTED', handleSpeakerRejection as EventListener);
  //   };
  // }, [localPeer?.roleName]);

  // Handle request approval and rejection
  const handleApproveRequest = async (request: SpeakerRequest) => {
    if (!request || !request.peerId) {
      console.error("Invalid speaker request for approval", request);
      return;
    }

    try {
      // Remove from requests first
      setSpeakerRequests((prevRequests) =>
        prevRequests.filter((req) => req.peerId !== request.peerId)
      );

      // Change role via backend API
      const env = process.env.NEXT_PUBLIC_ENV;
      let token: any = "";
      if (env !== "DEV") {
        token = await getToken();
      }

      await updateParticipantRole(roomId, request.fid, "speaker", token);

      // Clear hand-raised state for this peer
      setHandRaisedPeers((prev) => {
        const next = new Set(prev);
        next.delete(request.fid);
        return next;
      });

      // Notify the peer to switch to speaker role
      sendCustomEvent('ROLE_UPDATED', { targetFid: String(request.fid), newRole: 'speaker' });

      console.log(`Approved speaker request for peer: ${request.peerId}`);
    } catch (error) {
      console.error("Error approving speaker request:", error);
    }
  };

  const handleAvatarClick = (personId: string) => {
    const peer = allPeers.find((p) => p.id === personId);
    if (peer) {
      setSelectedPeer(peer);
      setShowAvatarContextMenu(true);
      setShowTippingDrawer(false);
    }
  };

  // Sponsorship hooks removed as part of ads migration

  // Note: Microphone permissions are now handled in CallClient.tsx during initial room join
  // to prevent repeated permission prompts when Conference component re-renders

  // Sponsorship hooks removed as part of ads migration

  // Handle start recording
  const handleStartRecording = async () => {
    if (!localPeer || isStartingRecording) return;

    // Only host and co-host can start recording
    if (localPeer.roleName !== "host" && localPeer.roleName !== "co-host") {
      toast.error("Only hosts and co-hosts can start recording");
      return;
    }

    try {
      setIsStartingRecording(true);

      let token: string | null = null;
      const env = process.env.NEXT_PUBLIC_ENV;

      if (env !== "DEV") {
        const authResult = await getToken();
        token = authResult;
      }

      const response = await startRecording(roomId, token);

      if (!response.ok) {
        throw new Error(response.data?.message || "Failed to start recording");
      }

      // Update local state optimistically
      setRoomDetails((prev) =>
        prev ? { ...prev, recordingEnabled: true } : null
      );

      toast.success("Recording started successfully");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to start recording"
      );
    } finally {
      setIsStartingRecording(false);
    }
  };

  if (roomEnded) {
    return <RoomEndScreen roomId={roomId} onComplete={() => { clearRewardData(); router.push("/"); }} />;
  } else {
    // Only show speaker requests button for hosts and co-hosts
    const canManageSpeakers =
      localPeer?.roleName === "host" || localPeer?.roleName === "co-host";

    // Prepare peers for CampfireCircle
    const storytellers = peers.filter(
      (peer) =>
        peer.roleName?.toLowerCase() === "host" ||
        peer.roleName?.toLowerCase() === "co-host"
    );
    const speakers = peers.filter(
      (peer) => peer.roleName?.toLowerCase() === "speaker"
    );
    const listeners = peers.filter(
      (peer) => peer.roleName?.toLowerCase() === "listener"
    );

    // Transform peers to format expected by experimental components
    const transformPeer = (peer: AgoraPeer, isHandRaised: boolean = false) => ({
      id: peer.id,
      name: peer.name,
      img: peer.metadata ? JSON.parse(peer.metadata).avatar : undefined,
      role:
        peer.roleName === "host"
          ? "Host"
          : peer.roleName === "co-host"
          ? "Co-host"
          : "Speaker",
      speaking: (audioLevels.get(peer.uid) || 0) > 5,
      muted: !peer.audioTrack,
      handRaised: isHandRaised,
      peer: peer,
    });

    const campfirePeople = [...storytellers, ...speakers].map((p) =>
      transformPeer(p)
    );
    const listenerPeople = listeners.map((p) => transformPeer(p));

    // Transform speaker requests to hand raise format
    const handsRaised = speakerRequests.map((req) => {
      const peer = allPeers.find((p) => p.id === req.peerId);
      return {
        id: req.peerId,
        name: req.peerName || peer?.name || "Unknown",
        img:
          req.peerAvatar ||
          (peer?.metadata ? JSON.parse(peer.metadata).avatar : undefined),
        speaking: false,
      };
    });

    return (
      <div className="relative min-h-screen">
        <FirelightField flicker={flicker} />

        <Card className="bg-fireside-orange/5 gradient-orange-bg m-3 p-3 rounded-2xl">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-[200px] ">
              <h1 className="text-lg font-bold gradient-fire-text">
                {roomDetails?.name}
              </h1>
              <p className="text-sm text-gray-300">
                {roomDetails?.description}
              </p>
            </div>
            <div className="">
              <TipsDisplay roomId={roomId} />
            </div>
          </div>

          <div
            className="px-2 rounded-lg py-1 mt-2 relative justify-end flex w-full"
            ref={recordingDropdownRef}
          >
            {roomDetails?.recordingEnabled === true ? (
              <div className="flex items-center self-end">
                <GoDotFill className="w-4 h-4 text-neutral-red animate-pulse ml-2" />
                <span className="text-neutral-red text-sm ml-1">Recording</span>
              </div>
            ) : (
              <>
                <div
                  className="flex items-center cursor-pointer hover:bg-white/5 rounded-lg transition-colors self-end bg-white/5"
                  onClick={() => {
                    if (
                      localPeer?.roleName === "host" ||
                      localPeer?.roleName === "co-host"
                    ) {
                      setShowRecordingDropdown(!showRecordingDropdown);
                    }
                  }}
                >
                  <GoDotFill className="w-4 h-4 text-gray-500 ml-2" />
                  <span className="text-gray-500 text-sm ml-1">
                    Not Recording
                  </span>
                  {(localPeer?.roleName === "host" ||
                    localPeer?.roleName === "co-host") && (
                    <svg
                      className={`w-4 h-4 text-gray-500 ml-auto mr-2 transition-transform ${
                        showRecordingDropdown ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  )}
                </div>

                {/* Dropdown Menu */}
                {showRecordingDropdown &&
                  (localPeer?.roleName === "host" ||
                    localPeer?.roleName === "co-host") && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-50">
                      <div className="bg-black/90 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowRecordingDropdown(false);
                            handleStartRecording();
                          }}
                          disabled={isStartingRecording}
                          className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-red-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <circle cx="10" cy="10" r="3" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-white">
                              {isStartingRecording
                                ? "Starting..."
                                : "Start Recording"}
                            </div>
                            <div className="text-xs text-gray-400">
                              Begin recording this fireside
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        </Card>

        {/* Tip Statistics Display */}
        <div className="px-3"></div>

        <div className="pb-32 px-3 relative z-10 mt-4">
          {/* Speaker Requests Button */}
          {/* {canManageSpeakers && speakerRequests.length > 0 && (
            <div className="flex w-full mb-4 mt-8">
              <Button
                variant="ghost"
                onClick={() => setShowSpeakerRequestsDrawer(true)}
                className="flex items-center gap-2 w-full text-center justify-center"
              >
                <span>Speaker Requests</span>
                <span className="bg-white text-fireside-orange rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {speakerRequests.length}
                <p className="text-gray-400 text-sm">
                  {roomDetails?.description || ""}
                </p>
              </Card>
            </div> */}

          {/* Speakers Grid */}
          {campfirePeople.length > 0 && (
            <div className="mb-6">
              <div
                className="text-xs mb-3"
                style={{ color: "rgba(255,255,255,.55)" }}
              >
                Panel ({campfirePeople.length})
              </div>
              <div className="grid grid-cols-4 gap-3">
                {campfirePeople.map((p, index) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    <PanelMember
                      id={p.id}
                      name={p.name}
                      img={p.img}
                      role={p.role}
                      speaking={p.speaking}
                      muted={p.muted}
                      onClick={handleAvatarClick}
                      isHandRaised={handRaisedPeers.has(
                        p.peer?.metadata ? JSON.parse(p.peer.metadata as string).fid : ''
                      )}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Hand Raise Requests */}
          {handsRaised.length > 0 && (
            <div className="mb-6">
              <div
                className="text-xs mb-3"
                style={{ color: "rgba(255,255,255,.55)" }}
              >
                Speaker requests ({speakerRequests.length})
              </div>
              <div className="space-y-2">
                {handsRaised.map((p, index) => {
                  const request = speakerRequests.find(
                    (req) => req.peerId === p.id
                  );
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, scale: 0.8, height: 0 }}
                      animate={{ opacity: 1, scale: 1, height: "auto" }}
                      exit={{ opacity: 0, scale: 0.8, height: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="flex items-center justify-between rounded-2xl px-3 py-2 backdrop-blur-sm relative"
                      style={{
                        border: "1px solid rgba(255,255,255,.08)",
                        background: "rgba(0,0,0,.14)",
                      }}
                    >
                      <HandRaiseSparks id={`hand-${p.id}`} />
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="rounded-xl overflow-hidden flex-shrink-0"
                          style={{
                            width: "36px",
                            height: "36px",
                          }}
                        >
                          <img
                            src={
                              p.img ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`
                            }
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <ScrollingName
                            name={p.name}
                            className="text-sm"
                            style={{ color: "rgba(255,255,255,.92)" }}
                          />
                          <div
                            className="text-xs"
                            style={{ color: "rgba(255,255,255,.55)" }}
                          >
                            raised hand
                          </div>
                        </div>
                      </div>
                      {canManageSpeakers && request && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleApproveRequest(request)}
                            className="rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm"
                            style={{
                              border: "1px solid rgba(255,255,255,.08)",
                              background: "rgba(34,197,94,.15)",
                              color: "rgba(34,197,94,1)",
                            }}
                          >
                            Invite
                          </button>
                          <button
                            onClick={() => handleReject(request)}
                            className="rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm"
                            style={{
                              border: "1px solid rgba(255,255,255,.08)",
                              background: "rgba(239,68,68,.15)",
                              color: "rgba(239,68,68,1)",
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Listeners */}
          {listenerPeople.length > 0 && (
            <div>
              <div
                className="text-xs mb-3"
                style={{ color: "rgba(255,255,255,.55)" }}
              >
                Listeners ({listenerPeople.length})
              </div>
              <div
                className="rounded-2xl p-3 backdrop-blur-sm"
                style={{
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "rgba(0,0,0,.10)",
                }}
              >
                <div className="grid grid-cols-6 gap-3">
                  {listenerPeople.map((p, index) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                    >
                      <ListenerMember
                        id={p.id}
                        name={p.name}
                        img={p.img}
                        onClick={handleAvatarClick}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Speaker Requests Drawer */}
        {/* <SpeakerRequestsDrawer
            isOpen={showSpeakerRequestsDrawer}
            onClose={() => setShowSpeakerRequestsDrawer(false)}
            requests={speakerRequests} 
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            roomId={roomId}
          /> */}

        {/* Avatar Context Menu */}
        {selectedPeer && (
          <AvatarContextMenu
            peer={selectedPeer}
            isVisible={showAvatarContextMenu}
            onClose={() => {
              setShowAvatarContextMenu(false);
              setSelectedPeer(null);
            }}
            onOpenTipDrawer={() => {
              setShowAvatarContextMenu(false);
              setShowTippingDrawer(true);
            }}
          />
        )}

        {/* Tipping Drawer - Rendered after to appear above */}
        {selectedPeer && (
          <TippingDrawer
            peer={selectedPeer}
            isOpen={showTippingDrawer}
            onClose={() => {
              setShowTippingDrawer(false);
              setSelectedPeer(null);
              setShowAvatarContextMenu(false);
            }}
          />
        )}
      </div>
    );
  }
}
