"use client";
import { useEffect, useState } from "react";
import { useNavigateWithLoader } from "../utils/useNavigateWithLoader";
import FiresideLogo from "./UI/firesideLogo";
import { useRewardContext } from "@/contexts/RewardContext";
import Background from "./UI/Background";
import { fetchRoomSummary } from "@/utils/serverActions";
import Image from "next/image";

interface RoomSummary {
  room: {
    name: string;
    host: {
      name: string;
      username: string;
      image: string;
      fid: string;
    };
  };
  statistics: {
    maxSpeakers: number;
    maxListeners: number;
    totalTipsUSD: number;
  };
}

interface RoomEndScreenProps {
  onComplete: () => void;
  roomId: string;
}

export default function RoomEndScreen({onComplete, roomId}: RoomEndScreenProps) {
  const { rewardData, clearRewardData } = useRewardContext();
  const navigate = useNavigateWithLoader();
  const [timeLeft, setTimeLeft] = useState(10);
  const [roomSummary, setRoomSummary] = useState<RoomSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch room summary on mount
  useEffect(() => {
    async function loadRoomSummary() {
      try {
        setIsLoading(true);
        const response = await fetchRoomSummary(roomId);
        if (response.ok && response.data.success) {
          setRoomSummary(response.data.data);
        }
      } catch (error) {
        console.error("[RoomEndScreen] Error fetching room summary:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadRoomSummary();
  }, [roomId]);

  console.log("[RoomEndScreen] rewardData:", rewardData);
  console.log("[RoomEndScreen] roomSummary:", roomSummary);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          navigate("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onComplete, navigate]);

  const handleGoHome = () => {
    clearRewardData();
    navigate("/");
  };

  return (
    <div className="fixed inset-0 z-[100] gradient-orange-bg bg-black flex items-start justify-start overflow-y-auto">
      <div className="text-center max-w-md mx-auto px-4 py-4">
        {/* Fireside Logo */}
        <div className="mby-2">
          <FiresideLogo className="w-32 mx-auto" />
        </div>

        {/* Thank You Message */}
        <h1 className="text-2xl font-bold text-white mb-6">
          Thank you for joining!
        </h1>

        {/* Room Summary Card */}
        {!isLoading && roomSummary && (
          <div className="mb-6 gradient-orange-bg border flex flex-col items-start border-neutral-orange/30 rounded-lg p-4">
            {/* Room Name */}
            <h2 className="text-xl font-bold mb-3 gradient-fire-text">
              {roomSummary.room.name}
            </h2>

            {/* Host Info */}
            <div className="flex items-center justify-center mb-4 pb-2 ">
              <div className="relative w-8 h-8 rounded-full overflow-hidden mr-3">
                {roomSummary.room.host.image ? (
                  <Image
                    src={roomSummary.room.host.image}
                    alt={roomSummary.room.host.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-orange/20 flex items-center justify-center text-white font-bold">
                    {roomSummary.room.host.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="text-left">
                <p className="text-white font-semibold">{roomSummary.room.host.name}</p>
                <p className="text-gray-400 text-sm">Host</p>
              </div>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-2">
              {/* Max Speakers */}
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-2xl font-bold text-white mb-1">
                  {roomSummary.statistics.maxSpeakers}
                </div>
                <div className="text-xs text-gray-400">Max Speakers</div>
              </div>

              {/* Max Listeners */}
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-2xl font-bold text-white mb-1">
                  {roomSummary.statistics.maxListeners}
                </div>
                <div className="text-xs text-gray-400">Max Listeners</div>
              </div>

              {/* Total Tips */}
              <div className="bg-black/20 rounded-lg p-3">
                <div className="text-2xl font-bold text-yellow-400 mb-1">
                  ${roomSummary.statistics.totalTipsUSD.toFixed(0)}
                </div>
                <div className="text-xs text-gray-400">Total Tips</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mb-6 gradient-orange-bg border border-neutral-orange/30 rounded-lg p-8">
            <div className="animate-pulse">
              <div className="h-6 bg-white/10 rounded w-3/4 mx-auto mb-4"></div>
              <div className="h-12 bg-white/10 rounded-full w-12 mx-auto mb-4"></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="h-16 bg-white/10 rounded"></div>
                <div className="h-16 bg-white/10 rounded"></div>
                <div className="h-16 bg-white/10 rounded"></div>
              </div>
            </div>
          </div>
        )}
          
        {/* Reward Display for Host */}
        {rewardData && rewardData.totalReward > 0 && (
          <>
            <h2 className="text-neutral-green text-left text-sm mb-2">Hosting Rewards:</h2>
            <div className="mb-6 gradient-green-bg border border-neutral-green/30 rounded-lg p-4">
              <p className="text-yellow-400 font-bold text-3xl mb-2">
                +{rewardData.totalReward} FIRE
              </p>
              <p className="text-sm text-gray-300 mb-3">🎉 Hosting Reward Earned!</p>
              <div className="text-xs text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Base Reward:</span>
                  <span className="text-white">{rewardData.baseReward} FIRE</span>
                </div>
                {rewardData.milestoneReward > 0 && (
                  <div className="flex justify-between">
                    <span>Milestone Bonus ({rewardData.milestone}+ participants):</span>
                    <span className="text-yellow-400">+{rewardData.milestoneReward} FIRE</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-600">
                  <span>Total Participants:</span>
                  <span className="text-white">{rewardData.participantCount}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Countdown Message */}
        <p className="text-gray-400 text-sm mb-4">
          You will be redirected to home page in{" "}
          <span className="text-fireside-orange font-bold">{timeLeft}</span>{" "}
          seconds
        </p>

        {/* Countdown Progress Bar */}
        <div className="mb-4">
          <div className="w-full bg-white/20 rounded-full h-2">
            <div
              className="bg-neutral-orange h-2 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${((10 - timeLeft) / 10) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Go Home Button */}
        <button
          onClick={handleGoHome}
          className="w-full rounded-xl gradient-orange-bg bg-neutral-orange/10 border border-neutral-orange/20 px-8 py-3 text-sm font-semibold hover:bg-neutral-orange/20 transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
