'use server'

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  authToken?: string | null;
  cache?: RequestCache;
};

/**
 * Single server action for making API requests from the server side
 * 
 * This ensures all API calls originate from Vercel servers, not the client
 * 
 * @param url - The URL to fetch from
 * @param options - Request options (method, body, headers, authToken, cache)
 * @returns Response object with data, status and ok flag
 */
export async function fetchAPI(url: string, options: FetchOptions = {}) {
  try {
    console.log(`Server fetch to: ${url} with options:`, options);
    const {
      method = 'GET',
      body,
      headers = {},
      authToken,
      cache
    } = options;

    // Set up headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };

    // Add auth header if provided
    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    // Create request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      cache,
    };

    // Add body for non-GET requests
    if (method !== 'GET' && body !== undefined) {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    // Make the request
    const response = await fetch(url, requestOptions);
    
    // Parse response
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error(`Error parsing JSON response from ${url}:`, parseError);
      return {
        data: { success: false, error: 'Invalid server response' },
        status: response.status,
        ok: false
      };
    }

    console.log("response", data);    
    
    // Return formatted response
    return {
      data,
      status: response.status,
      ok: response.ok
    };
  } catch (error) {
    console.error(`Server fetch error for ${url}:`, error);
    return {
      data: { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error occurred' 
      },
      status: 500,
      ok: false
    };
  }
}

// Client-callable server actions for specific components

/**
 * Fetch user profile rooms (for profile page)
 */
export async function fetchUserRooms(username: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/public/username/${username}`);
}

/**
 * Fetch user profile by FID (for ViewProfileModal)
 */
export async function fetchUserByFid(fid: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/public/${fid}`);
}

/**
 * Update user profile (for profile page)
 */
export async function refreshUserProfile(token: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/protected/update?query=profile`, {
    method: 'PATCH',
    authToken: token
  });
}

/**
 * Update user notification token
 */
export async function updateUserNotificationToken(notificationToken: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  console.log("Updating user notification token:", notificationToken);
  return fetchAPI(`${URL}/api/users/protected/update`, {
    method: 'PATCH',
    body: { token: notificationToken },
    authToken: token
  });
}

/**
 * Fetch room recordings (for recordings page)
 */
export async function fetchRoomRecordings(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/recordings`);
}

/**
 * Fetch room codes (for CallClient)
 */
export async function fetchRoomCodes(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/codes`);
}

/**
 * Add participant to room
 */
export async function addParticipantToRoom(roomId: string, userData: any, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/join`, {
    method: 'POST',
    body: userData,
    authToken: token
  });
}

/**
 * Remove participant from room
 */
export async function removeParticipantFromRoom(roomId: string, userData: any, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/leave`, {
    method: 'POST',
    body: userData,
    authToken: token
  });
}

/**
 * Fetch chat messages for a room
 */
export async function fetchChatMessages(roomId: string, limit: number = 50) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const response = await fetchAPI(`${URL}/api/rooms/public/${roomId}/messages?limit=${limit}`);
  
  if (!response.ok || !response.data.success) {
    return response;
  }
  
  // Messages already include user data from the backend
  return response;
}

/**
 * Send a chat message to a room
 */
export async function sendChatMessage(
  roomId: string, 
  messageData: { message: string; replyToId?: string; userFid?: string }, 
  token: string | null = null
) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/messages`, {
    method: 'POST',
    body: messageData,
    authToken: token
  });
}

/**
 * Confirm a Bankr AI transaction execution
 */
export async function confirmBankrTransaction(
  roomId: string,
  messageId: string,
  data: { txHash?: string; status: 'confirmed' | 'failed' },
  token: string | null = null
) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/messages/${messageId}/confirm-transaction`, {
    method: 'POST',
    body: data,
    authToken: token
  });
}

/**
 * Fetch room details by room ID
 */
export async function fetchRoomDetails(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}`);
}

/**
 * End a room session
 */
export async function endRoom(roomId: string, userId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/${roomId}/end`, {
    method: 'POST',
    body: { userId }
  });
}

/**
 * Update user topics
 */
export async function updateUserTopics(topics: string[], token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/protected/topics`, {
    method: 'PATCH',
    body: { topics },
    authToken: token
  });
}

/**
 * Fetch user profile by handle
 */
export async function fetchUserByHandle(token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/protected/handle`, {
    method: 'POST',
    authToken: token
  });
}

/**
 * Fetch rooms by topics
 */
export async function fetchRoomsByTopics(topics: string[]) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/by-topics`, {
    method: 'POST',
    body: { topics }
  });
}

/**
 * Fetch all public rooms
 */
export async function fetchAllRooms() {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/`);
}

/**
 * End a protected room session
 */
export async function endProtectedRoom(roomId: string, userId: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/end`, {
    method: 'POST',
    body: { userId },
    authToken: token
  });
}

/**
 * Fetch room participants
 */
export async function fetchRoomParticipants(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/participants`);
}

export async function fetchLiveParticipants(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/participants-live`);
}

/**
 * Fetch room participants by role
 */
export async function fetchRoomParticipantsByRole(roomId: string, role: string, activeOnly: boolean = true) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/participants?role=${role}&activeOnly=${activeOnly}`);
}

/**
 * Update room participant role
 */
export async function updateParticipantRole(roomId: string, userFid: string, newRole: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/participants`, {
    method: 'PUT',
    body: {
      userFid,
      newRole
    },
    authToken: token
  });
}

/**
 * Transfer host role
 */
export async function transferHostRole(roomId: string, userFid: string, newRole: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/${roomId}/participants`, {
    method: 'PUT',
    body: {
      userFid,
      newRole
    }
  });
}

/**
 * Search for users and rooms
 */
export async function searchUsersAndRooms(query: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/search?q=${encodeURIComponent(query.trim())}`);
}

/**
 * Create a new room
 */
export async function createRoom(roomData: {
  name: string;
  description: string;
  host: string;
  startTime: string;
  topics: string[];
}, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected`, {
    method: 'POST',
    body: roomData,
    authToken: token
  });
}

/**
 * Create a sponsorship for a room
 */
// Sponsorship actions removed as part of ads migration

/**
 * Fetch pending sponsorships for a room (host only)
 */
//

/**
 * Update sponsorship status (approve or decline)
 */
//

/**
 * Fetch sponsorship status for a user
 */
//

/**
 * Withdraw a sponsorship request
 */
//

/**
 * Activate an approved sponsorship after successful payment
 */
//

/**
 * Fetch live sponsorships for a room
 */
//

/**
 * Update room (for setting reminders or other updates)
 */
export async function updateRoom(
  roomId: string, 
  updateData: {
    interested?: string;
    status?: string;
    endTime?: string;
    participants?: string[];
    action?: 'add' | 'remove';
  }, 
  token: string | null = null
) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}`, {
    method: 'PUT',
    body: updateData,
    authToken: token
  });
}

/**
 * Start a room (create Agora channel and set status to ongoing)
 */
export async function startRoom(roomId: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/start/${roomId}`, {
    method: 'POST',
    authToken: token
  });
}

/**
 * Fetch active peers in a room via backend API (Agora)
 */
export async function fetchActivePeers(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/participants-live`);
}

/**
 * Remove a peer from a room via backend API (Agora)
 */
export async function removeActivePeer(roomId: string, userFid: string, reason: string = '') {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/leave`, {
    method: 'POST',
    body: {
      userFid,
      reason,
      kicked: true,
    }
  });
}

/**
 * Update user ads preference
 */
export async function updateAdsPreference(autoAdsEnabled: boolean, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/profile/ads-preference`, {
    method: 'PUT',
    body: { autoAdsEnabled },
    authToken: token
  });
}

/**
 * Save a tip record to Redis
 */
export async function saveTipRecord(
  roomId: string,
  tipData: {
    tipper: {
      userId: string;
      username: string;
      pfp_url: string;
    };
    recipients: Array<{
      userId?: string;
      username?: string;
      pfp_url?: string;
      role?: string;
    }>;
    amount: {
      usd: number;
      currency: string;
      native: number;
    };
  },
  token: string | null = null
) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/tips`, {
    method: 'POST',
    body: tipData,
    authToken: token
  });
}

/**
 * Fetch tip statistics for a room
 */
export async function fetchRoomTips(roomId: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/tips`, {
    method: 'GET',
    authToken: token
  });
}

/**
 * Fetch all live rooms with their tip statistics
 */
export async function fetchLiveRoomsTips() {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/live-tips`, {
    method: 'GET',
  });
}

/**
 * Fetch room summary (room details, host info, peak statistics, and tips)
 */
export async function fetchRoomSummary(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/summary`, {
    method: 'GET',
  });
}

/**
 * Skip recurring room occurrence
 */
export async function skipRecurringRoom(roomId: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/skip`, {
    method: 'PUT',
    authToken: token
  });
}

export async function startRecording(roomId: string, token: string | null = null) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  
  return fetchAPI(`${baseUrl}/api/rooms/protected/start-recording/${roomId}`, {
    method: 'POST',
    authToken: token
  });
}

/**
 * Check login reward eligibility
 */
export async function checkLoginEligibility(token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rewards/protected/check-login-eligibility`, {
    method: 'GET',
    authToken: token
  });
}

/**
 * Claim login reward
 */
export async function claimLoginReward(token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rewards/protected/claim-login`, {
    method: 'POST',
    authToken: token
  });
}