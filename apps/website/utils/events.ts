import { useEffect, useCallback } from "react";
import { useAgoraContext } from "@/contexts/AgoraContext";

/**
 * Generic hook for custom events via Agora data stream
 */
function useCustomEvent<T>(
  type: string,
  onEvent?: (msg: T) => void
): { sendEvent: (data: T) => void } {
  const { sendCustomEvent, onCustomEvent } = useAgoraContext();

  useEffect(() => {
    if (!onEvent) return;
    const cleanup = onCustomEvent(type, onEvent);
    return cleanup;
  }, [type, onEvent, onCustomEvent]);

  const sendEvent = useCallback(
    (data: T) => {
      sendCustomEvent(type, data);
    },
    [type, sendCustomEvent]
  );

  return { sendEvent };
}

/**
 * Custom hook for handling speaker requests
 */
export const useSpeakerRequestEvent = (
  onEvent?: (msg: { peer: string; peerId: string }) => void
) => {
  const { sendEvent } = useCustomEvent<{ peer: string; peerId: string }>(
    "SPEAKER_REQUESTED",
    onEvent
  );

  const requestToSpeak = (fid: string, peerId: string) => {
    sendEvent({ peer: fid, peerId });
  };

  return { requestToSpeak, sendEvent };
};

/**
 * Custom hook for handling speaker rejections
 */
export const useSpeakerRejectionEvent = (
  onEvent?: (msg: { peer: string }) => void
) => {
  const { sendEvent } = useCustomEvent<{ peer: string }>(
    "SPEAKER_REJECTED",
    onEvent
  );

  const rejectSpeakerRequest = (peerId: string) => {
    sendEvent({ peer: peerId });
  };

  return { rejectSpeakerRequest, sendEvent };
};

/**
 * Custom hook for handling room ended events
 */
export const useRoomEndedEvent = (
  onEvent?: (msg: { message: string }) => void
) => {
  const { sendEvent } = useCustomEvent<{ message: string }>(
    "ENDED_REWARD",
    onEvent
  );

  const endRoomReward = (message: string = "Room has been ended by the host.") => {
    sendEvent({ message });
  };

  return { endRoomReward, sendEvent };
};

/**
 * Custom hook for handling emoji reactions
 */
export const useEmojiReactionEvent = (
  onEvent?: (msg: {
    emoji: string;
    sender: string;
    id?: number;
    position?: number;
    fontSize?: string;
  }) => void
) => {
  const { sendEvent } = useCustomEvent<{
    emoji: string;
    sender: string;
    id?: number;
    position?: number;
    fontSize?: string;
  }>("EMOJI_REACTION", onEvent);

  const sendEmoji = (emoji: string, sender: string) => {
    sendEvent({ emoji, sender });
  };

  return { sendEmoji, sendEvent };
};

/**
 * Custom hook for handling new sponsor events
 */
export const useNewSponsorEvent = (
  onEvent?: (msg: { sponsorName: string }) => void
) => {
  const { sendEvent } = useCustomEvent<{ sponsorName: string }>(
    "NEW_SPONSOR",
    onEvent
  );

  const notifyNewSponsor = (sponsorName: string) => {
    sendEvent({ sponsorName });
  };

  return { notifyNewSponsor, sendEvent };
};

/**
 * Custom hook for handling active sponsor events
 */
export const useActiveSponsor = (
  onEvent?: (msg: { sponsorshipId?: string; roomId?: string }) => void
) => {
  const { sendEvent } = useCustomEvent<{
    sponsorshipId?: string;
    roomId?: string;
  }>("ACTIVE_SPONSOR", onEvent);

  const activateSponsor = (sponsorshipId?: string, roomId?: string) => {
    sendEvent({ sponsorshipId, roomId });
  };

  return { activateSponsor, sendEvent };
};

/**
 * Custom hook for handling sponsor status events
 */
export const useSponsorStatusEvent = (
  onEvent?: (msg: {
    userId: string;
    status: string;
    sponsorshipId?: string;
  }) => void
) => {
  const { sendEvent } = useCustomEvent<{
    userId: string;
    status: string;
    sponsorshipId?: string;
  }>("SPONSOR_STATUS", onEvent);

  const notifySponsorStatus = (
    userId: string,
    status: string,
    sponsorshipId?: string
  ) => {
    sendEvent({ userId, status, sponsorshipId });
  };

  return { notifySponsorStatus, sendEvent };
};

/**
 * Custom hook for handling ads control events
 */
export const useAdsControlEvent = (
  onEvent?: (msg: { action: "start" | "stop"; roomId: string }) => void
) => {
  const { sendEvent } = useCustomEvent<{
    action: "start" | "stop";
    roomId: string;
  }>("ADS_CONTROL", onEvent);

  const notifyAdsControl = (action: "start" | "stop", roomId: string) => {
    sendEvent({ action, roomId });
  };

  return { notifyAdsControl, sendEvent };
};

/**
 * Tip event message interface
 */
export interface TipEventMessage {
  roomId: string;
  tipper: {
    username: string;
    pfp_url: string;
  };
  recipients: Array<{
    username?: string;
    pfp_url?: string;
    role?: string;
    id?: string;
  }>;
  amount: {
    usd: number;
    currency: string;
    native: number;
  };
  timestamp: string;
}

/**
 * Custom hook for handling tip notification events
 */
export const useTipEvent = (onEvent?: (msg: TipEventMessage) => void) => {
  const { sendEvent } = useCustomEvent<TipEventMessage>(
    "TIP_RECEIVED",
    onEvent
  );

  const sendTipNotification = (tipData: TipEventMessage) => {
    sendEvent(tipData);
  };

  return { sendTipNotification, sendEvent };
};

/**
 * Sound played event message interface
 */
export interface SoundPlayedMessage {
  soundId: string;
  soundName: string;
  soundEmoji: string;
  senderName: string;
  senderAvatar?: string;
  timestamp: number;
}

/**
 * Custom hook for handling soundboard sound played events
 */
export const useSoundPlayedEvent = (
  onEvent?: (msg: SoundPlayedMessage) => void
) => {
  const { sendEvent } = useCustomEvent<SoundPlayedMessage>(
    "SOUND_PLAYED",
    onEvent
  );

  const notifySoundPlayed = (
    soundId: string,
    soundName: string,
    soundEmoji: string,
    senderName: string,
    senderAvatar?: string
  ) => {
    sendEvent({
      soundId,
      soundName,
      soundEmoji,
      senderName,
      senderAvatar,
      timestamp: Date.now(),
    });
  };

  return { notifySoundPlayed, sendEvent };
};

/**
 * Custom hook for handling soundboard stop events
 */
export const useSoundStoppedEvent = (
  onEvent?: (msg: { stoppedBy: string }) => void
) => {
  const { sendEvent } = useCustomEvent<{ stoppedBy: string }>(
    "SOUND_STOPPED",
    onEvent
  );

  const notifySoundStopped = (stoppedBy: string) => {
    sendEvent({ stoppedBy });
  };

  return { notifySoundStopped, sendEvent };
};

/**
 * Hand raise event message interface
 */
export interface HandRaiseMessage {
  peerId: string;
  peerName: string;
  peerAvatar?: string;
  raised: boolean;
}

/**
 * Custom hook for handling hand raise events
 */
export const useHandRaiseEvent = (
  onEvent?: (msg: HandRaiseMessage) => void
) => {
  const { sendEvent } = useCustomEvent<HandRaiseMessage>(
    "HAND_RAISED",
    onEvent
  );

  const notifyHandRaise = (
    peerId: string,
    peerName: string,
    raised: boolean,
    peerAvatar?: string
  ) => {
    sendEvent({ peerId, peerName, peerAvatar, raised });
  };

  return { notifyHandRaise, sendEvent };
};