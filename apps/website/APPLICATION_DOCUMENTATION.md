# Fireside 100ms - Complete Application Documentation

## Table of Contents
1. [Overview](#overview)
2. [Application Architecture](#application-architecture)
3. [Core Features](#core-features)
4. [100ms Implementation Details](#100ms-implementation-details)
5. [User Roles & Permissions](#user-roles--permissions)
6. [Room Management](#room-management)
7. [Real-time Features](#real-time-features)
8. [Technical Implementation](#technical-implementation)
9. [File Structure](#file-structure)

---

## Overview

**Fireside** is a Clubhouse-style social audio platform built with Next.js 14 and 100ms SDK. It enables users to create and join audio rooms for live conversations with multiple roles, real-time chat, sponsorships, and recording capabilities.

### Key Technologies
- **Frontend**: Next.js 14, React 18, TypeScript
- **Real-time Communication**: 100ms SDK (`@100mslive/react-sdk`)
- **Authentication**: Farcaster Miniapp SDK
- **Blockchain**: Base Network (Ethereum L2)
- **Database**: MongoDB
- **Caching**: Redis
- **Styling**: Tailwind CSS

---

## Application Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Home Page  │  │  Room List   │  │   Profile    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│                   ┌────────▼─────────┐                      │
│                   │  100ms SDK        │                      │
│                   │  HMSRoomProvider  │                      │
│                   └────────┬──────────┘                      │
│                            │                                │
│                   ┌────────▼──────────┐                      │
│                   │  Conference UI    │                      │
│                   │  - Audio/Video    │                      │
│                   │  - Chat           │                      │
│                   │  - Screen Share   │                      │
│                   └────────┬──────────┘                      │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   100ms Cloud   │
                    │   Infrastructure │
                    └─────────────────┘
```

### Component Hierarchy

```
Root Layout (app/layout.tsx)
├── Providers (utils/providers/providers.tsx)
│   ├── HMSRoomProvider (100ms SDK)
│   ├── GlobalProvider (User context)
│   ├── RainbowProvider (Wallet)
│   └── MiniKitProvider (Farcaster)
├── Background Component
└── ToastContainer

Home Page (app/page.tsx)
├── MainHeader
├── LiveRoomList
├── AllowNotifications
└── NavigationWrapper

Room/Call Page (app/call/[id]/page.tsx)
├── Header
│   ├── Room info
│   └── Toggle Chat
├── CallClient (100ms integration)
│   ├── Conference Component
│   ├── Footer (Audio controls)
│   └── Role handlers
└── Chat Component
```

---

## Core Features

### 1. **Audio Rooms**
Real-time audio conversation rooms with role-based access control.

#### Features:
- **Multiple Participants**: Support for unlimited concurrent users
- **Audio Quality**: High-quality audio streaming via 100ms infrastructure
- **Real-time Synchronization**: Instant audio delivery to all participants
- **Mute/Unmute Controls**: Individual and remote mute capabilities
- **Role-based Audio**: Different roles have different audio publishing permissions

**100ms Implementation**:
- Uses `useAudioToggle` hook for mic controls
- Leverages `selectPeers` to track all participants
- Audio tracks managed via `HMSTrack` interface
- Automatic audio level indicators

### 2. **Real-time Chat**
In-room text chat with message persistence.

#### Features:
- **Live Chat**: Real-time message delivery via 100ms broadcast messages
- **Message Persistence**: Chat history stored in Redis for future joins
- **User Identification**: Messages include user profile pictures and names
- **Auto-scroll**: Automatically scrolls to latest messages
- **Emoji Reactions**: Real-time emoji reaction system
- **Message Types**: Regular messages, emoji reactions, system messages

**100ms Implementation**:
- Uses `sendBroadcastMessage()` for real-time delivery
- Listens to `selectHMSMessages` for incoming messages
- Broadcast messages sent as JSON with metadata
- Messages include user FID for identification

### 3. **Screen Sharing**
Full desktop/browser screen sharing capabilities.

#### Features:
- **Screen Capture**: Share entire screen or specific windows
- **Multi-user Share**: Multiple participants can share simultaneously
- **High Quality**: Optimized video quality for screen content
- **Separate View**: Screen shares displayed in dedicated section
- **Presenter Badges**: Clear indication of who is sharing

**100ms Implementation**:
- Uses `selectPeersScreenSharing` to identify sharers
- `ScreenTile` component displays video track
- `useVideo` hook attaches video to DOM element
- Automatic subscription to screen tracks

### 4. **User Roles System**
Four-tier role hierarchy with specific permissions.

#### Roles Overview:

**1. Host** (Room Creator)
- Full control over room
- Manage all participants
- Can promote/demote users
- End room at any time
- Approve/reject sponsorships
- Manage speaker requests
- View analytics
- Can transfer host privileges

**2. Co-host** (Host Designated)
- Manage speakers and listeners
- Approve speaker requests
- Promote to speaker
- Cannot access host context menu
- Cannot transfer host
- Can mute/remove participants
- Manage chat if permissions set

**3. Speaker** (Active Participant)
- Can speak (publish audio)
- Can request to speak (if listener)
- Auto-promoted when request approved
- Can self-demote to listener
- Can raise hand for attention
- Can be moved back to listener by hosts

**4. Listener** (Default Role)
- Listen only (no audio publishing)
- Can request to speak
- Can send chat messages
- Can use emoji reactions
- Can raise hand
- Cannot speak until promoted

**100ms Implementation**:
- Role management via `hmsActions.changeRoleOfPeer()`
- Role-based permissions in `selectPermissions`
- Custom events for role change notifications
- Persistent role storage in backend

### 5. **Speaker Requests**
Listeners can request permission to speak.

#### Flow:
1. Listener clicks "Raise Hand" or requests to speak
2. Request sent to hosts/co-hosts via HMS message
3. Hosts see notification badge in header
4. Host approves/rejects request
5. Approvals trigger role change to "speaker"
6. Request tracking prevents duplicates

**100ms Implementation**:
- Uses custom broadcast messages for requests
- `useSpeakerRequestEvent()` hook listens for requests
- Request drawer shows all pending requests
- Optimistic UI updates for instant feedback

### 6. **Live Room Management**

#### Room Creation:
- **Scheduled Rooms**: Set future start times
- **Topics/Tags**: Categorize rooms by interests
- **Sponsorship Toggle**: Enable/disable ad sponsorships
- **Description**: Rich room descriptions
- **Access Control**: Different room codes for different roles

#### Room Lifecycle:
1. **Created**: Room created with host
2. **Scheduled**: Waiting for start time
3. **Live**: Active conversation
4. **Recording**: Session being recorded
5. **Ended**: Automatically ends when empty (10 seconds)

**100ms Implementation**:
- Room codes fetched from backend
- Different codes for host, speaker, listener roles
- Auto-join uses role-appropriate code
- Empty room detection via peer count
- Host-triggered room ending

### 7. **Sponsorship System**
Monetization through user-submitted advertisements.

#### Sponsor Features:
- **Upload Banner**: Image-based advertisements
- **Duration Selection**: 5-30 minute campaigns
- **Payment Integration**: USDC/USDT payments
- **Status Tracking**: Pending → Approved → Active → Completed
- **Real-time Display**: Banner shown during active sponsorship
- **Analytics**: Track impressions and view counts

#### Host Features:
- **Approve Requests**: Review sponsorship submissions
- **Set Pricing**: Configure per-minute rates
- **View Pending**: See all waiting sponsorships
- **Activate/Reject**: Control when ads run
- **Revenue Tracking**: See earnings from sponsorships

**100ms Implementation**:
- Sponsorship status via HMS broadcast messages
- Status events trigger UI updates
- Active sponsor displayed in room header
- Countdown timer for sponsor duration
- Custom toast notifications for status changes

### 8. **User Profiles**
Complete user profile system with social features.

#### Profile Features:
- **Farcaster Integration**: Auto-pull from Farcaster network
- **Avatar Display**: Profile pictures throughout app
- **Bio**: User descriptions
- **Topics**: Interest tracking
- **Social Links**: External social media
- **Room History**: Previous hosts/participations
- **Follow System**: Track favorite users

**100ms Implementation**:
- User metadata passed in 100ms join payload
- Display names shown in conference
- Profile context menu on peers
- User avatars on chat messages

### 9. **Hand Raising**
Visual feedback system for attention.

#### Features:
- **Raise Hand**: Button in footer
- **Visual Indicator**: Hand icon on user avatar
- **Persistent State**: Hand stays raised until acknowledged
- **Host Notifications**: Toast for hosts
- **Auto-clear**: Dismisses when role changes

**100ms Implementation**:
- Uses `hmsActions.changeMetadata()` to set hand state
- Listens to `selectHasPeerHandRaised` hook
- Broadcast to all peers via HMS notifications

### 10. **Mute/Unmute System**
Comprehensive audio control system.

#### Mic States:
1. **Enabled**: Mic active, audio broadcasting
2. **Muted**: Mic active but audio blocked
3. **Disabled**: Mic permission not granted
4. **Remote Muted**: Host/co-host muted your mic

#### Features:
- **Self-mute**: Personal toggle control
- **Remote mute**: Hosts can mute any participant
- **Mute-all**: Host can mute entire room
- **Mute on join**: Auto-mute for new participants
- **Visual indicators**: Mic icon shows status
- **Permission checks**: Role-based mute privileges

**100ms Implementation**:
- Uses `toggleAudio()` from `useAVToggle` hook
- `selectIsLocalAudioEnabled` for state tracking
- Remote mute via `hmsActions.setRemoteMuteEnabled()`
- Permission checks via `selectPermissions`

### 11. **Device Management**
Audio/video device configuration.

#### Features:
- **Device Selection**: Choose microphone/camera
- **Volume Control**: Adjust input/output levels
- **Quality Settings**: Configure audio codec
- **Echo Cancellation**: Built-in noise suppression
- **Device Switching**: Hot-swap devices mid-call

**100ms Implementation**:
- `getAvailableDevices()` for device listing
- `changeAudioInputDevice()` for mic switching
- `setVolume()` for audio level control
- HMS audio processing handles echo cancellation

### 12. **Recordings**
Session recording and playback.

#### Features:
- **Auto-record**: Record all live sessions
- **Playback**: Replay recordings with sync chat
- **Download**: Export recordings
- **Search**: Find recordings by room/topic
- **Transcript**: Speech-to-text transcripts (future)

**100ms Implementation**:
- Uses 100ms recording APIs
- Recording started via backend trigger
- Recorded tracks stored in cloud
- Playback uses pre-recorded audio tracks

### 13. **Notifications**
Real-time notification system.

#### Notification Types:
- **Peer joined/left**: User presence updates
- **Speaker request**: When listener wants to speak
- **Sponsorship status**: Approvals/rejections
- **Role changes**: When promoted/demoted
- **Room ending**: Countdown notifications
- **Hand raised**: Attention notifications

**100ms Implementation**:
- Uses `useHMSNotifications()` hook
- Notification types from `HMSNotificationTypes`
- Custom toast system with react-toastify
- Persistent notifications until dismissed

### 14. **Chat Features**

#### Message Types:
1. **Regular Messages**: Text from participants
2. **System Messages**: Join/leave announcements
3. **Emoji Reactions**: Quick reactions to current topic
4. **Broadcast Messages**: Cross-room announcements

#### Advanced Features:
- **Message Persistence**: Redis-backed history
- **User Mentions**: @username tagging
- **Image Attachments**: Share images in chat
- **Message Reactions**: Add emoji to messages
- **Chat History**: Load past messages on join

**100ms Implementation**:
- `selectHMSMessages` for message list
- `sendBroadcastMessage()` for sending
- JSON format includes user metadata
- Backend persistence for history

### 15. **Peer Management**
Advanced participant control.

#### Context Menu Features:
- **View Profile**: See full user profile
- **Make Speaker**: Promote to speaker
- **Make Listener**: Demote to listener
- **Make Co-host**: Promote to co-host
- **Mute/Unmute**: Remote mic control
- **Remove**: Kick from room
- **Transfer Host**: Give host privileges

**100ms Implementation**:
- Uses `hmsActions.changeRoleOfPeer(peer.id, newRole)`
- `hmsActions.removePeer(peer.id)` for removals
- Permission checks before actions
- Optimistic UI updates

---

## 100ms Implementation Details

### SDK Integration

#### Provider Setup (app/layout.tsx)
```typescript
<HMSRoomProvider>
  {children}
</HMSRoomProvider>
```

**Purpose**: Wraps entire application to provide 100ms context
**Exports**: `hmsStore`, `hmsActions`, hooks

#### Core Hooks Usage

**1. State Management**
```typescript
useHMSStore(selectPeers)           // All participants
useHMSStore(selectLocalPeer)       // Current user
useHMSStore(selectRoom)           // Room info
useHMSStore(selectHMSMessages)    // Chat messages
```

**2. Actions**
```typescript
useHMSActions()                   // Room actions
const actions = useHMSActions();
actions.join({...})
actions.leave()
actions.changeRoleOfPeer(id, role)
actions.setRemoteMuteEnabled(peerId, enabled)
```

**3. Media Tracks**
```typescript
useVideo({ trackId })            // Attach video to DOM
useAVToggle()                    // Mic/camera controls
useAudioLevel()                   // Audio levels
```

#### Join Flow (CallClient.tsx)

**Step 1**: Fetch Room Codes
```typescript
const response = await fetchRoomCodes(roomId);
const roomCodes = response.data.data.roomCodes;
```

**Step 2**: Determine Role
```typescript
// Host check
const hostCode = roomCodes.find(code => code.role === "host");
// Or fetch user's assigned role
const userCode = await fetchUserRole(roomId);
```

**Step 3**: Get Auth Token
```typescript
const authToken = await hmsActions.getAuthTokenByRoomCode({
  roomCode: selectedCode.code
});
```

**Step 4**: Join Room
```typescript
await hmsActions.join({
  userName: user.displayName,
  authToken: authToken,
  metaData: JSON.stringify({
    avatar: user.pfp_url,
    role: role,
    fid: user.fid,
    wallet: user.wallet || "",
  })
});
```

**Step 5**: Auto-mute on Join
```typescript
if (role === "host" || role === "co-host" || role === "speaker") {
  await hmsActions.setEnabledTrack(HMSTrackType.AUDIO, false);
  // Local audio track is muted but exists
}
```

#### Conference Display (Conference.tsx)

**Peer Grid Layout**
```typescript
// Sort peers by role priority
const sortedPeers = currentPeers.sort((a, b) => {
  const priority = { 'host': 1, 'co-host': 2, 'speaker': 3, 'listener': 4 };
  return priority[a.roleName] - priority[b.roleName];
});
```

**Screen Sharing Section**
```typescript
const presenters = useHMSStore(selectPeersScreenSharing);
{presenters.map(peer => <ScreenTile peer={peer} />)}
```

**Remote User Tracking**
```typescript
// Listen for new peers
agoraClient.on("user-published", async (user, mediaType) => {
  await agoraClient.subscribe(user, mediaType);
  const remoteAudioTrack = user.audioTrack;
  remoteAudioTrack?.play();
});
```

#### Audio Controls (Footer.tsx)

**Mute Toggle**
```typescript
const { isLocalAudioEnabled, toggleAudio } = useAVToggle();

<button onClick={toggleAudio}>
  {isLocalAudioEnabled ? "Mute" : "Unmute"}
</button>
```

**Remote Mute**
```typescript
const mutePeer = (peerId: string) => {
  hmsActions.setRemoteMuteEnabled(peerId, true);
};
```

#### Screen Sharing

**Start Sharing**
```typescript
const screenshare = await hmsActions.setEnabledTrack(HMSTrackType.VIDEO, true);
```

**Display Screen**
```typescript
const { videoRef } = useVideo({
  trackId: screenshareVideoTrack?.id
});
<video ref={videoRef} autoPlay />
```

#### Chat Integration

**Send Message**
```typescript
const messageWithMetadata = JSON.stringify({
  text: messageText,
  userFid: user.fid,
  type: 'chat'
});
hmsActions.sendBroadcastMessage(messageWithMetadata);
```

**Receive Messages**
```typescript
const messages = useHMSStore(selectHMSMessages);
messages.map(msg => <ChatMessage message={msg} />);
```

#### Custom Events

**Speaker Request Event**
```typescript
// Listener side
requestToSpeak(user.fid);

// Host side
useSpeakerRequestEvent((msg) => {
  setSpeakerRequests([...speakerRequests, { peer: msg.peer }]);
});
```

**Sponsorship Status Event**
```typescript
useSponsorStatusEvent((msg) => {
  if (msg.status === "approved") {
    setShowSponsorDrawer(true);
  }
});
```

---

## User Roles & Permissions

### Role Permissions Matrix

| Action | Host | Co-host | Speaker | Listener |
|--------|------|---------|---------|----------|
| Publish Audio | ✅ | ✅ | ✅ | ❌ |
| Publish Video | ✅ | ✅ | ❌ | ❌ |
| Chat | ✅ | ✅ | ✅ | ✅ |
| Raise Hand | ✅ | ✅ | ✅ | ✅ |
| Request Speaker | ❌ | ❌ | ❌ | ✅ |
| Manage Roles | ✅ | ✅ (limited) | ❌ | ❌ |
| Remove Peers | ✅ | ✅ | ❌ | ❌ |
| End Room | ✅ | ❌ | ❌ | ❌ |
| Screen Share | ✅ | ✅ | ❌ | ❌ |
| Approve Sponsors | ✅ | ❌ | ❌ | ❌ |
| Manage Chat | ✅ | ✅* | ❌ | ❌ |

*Depends on template permissions

---

## Room Management

### Room Lifecycle States

1. **Created**: Room object created in database
2. **Scheduled**: Waiting for start time
3. **Live**: 100ms room active, participants joining
4. **Recording**: Recording in progress
5. **Ended**: No participants, auto-closed after 10s

### Room Codes System

**Purpose**: Secure, role-based access to rooms

**Structure**:
```typescript
interface RoomCode {
  id: string;
  code: string;        // 100ms room code
  room_id: string;
  role: string;        // 'host' | 'co-host' | 'speaker' | 'listener'
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
```

**Usage Flow**:
1. Host creates room → Get host code
2. Listeners join → Get listener code
3. Backend generates codes via 100ms Management API
4. Codes stored in MongoDB
5. Clients fetch appropriate code before join

### Auto-room Ending

**Trigger**: When room becomes empty
**Delay**: 10 seconds (prevents accidental ending during transitions)
**Logic**: 
```typescript
if (currentPeers.length === 0 && previousPeers.length > 0) {
  setTimeout(() => {
    if (allPeers.length === 0) {
      endRoom();
    }
  }, 10000);
}
```

---

## Real-time Features

### 1. Audio Synchronization
- 100ms handles all audio routing
- Automatic echo cancellation
- Noise suppression
- Adaptive bitrate based on connection
- WebRTC for peer-to-peer when possible

### 2. Video Quality
- Automatic quality adjustment
- Bandwidth-aware streaming
- Multiple resolution support
- Priority-based delivery (video > audio)

### 3. Network Resilience
- Automatic reconnection on disconnect
- Graceful degradation
- Connection quality indicators
- Fallback servers

### 4. Cross-platform
- Web: Chrome, Firefox, Safari, Edge
- iOS Safari: iOS 11+
- Android: Chrome, Firefox

---

## Technical Implementation

### Server Actions (utils/serverActions.ts)

**Key Functions**:
```typescript
fetchAllRooms()              // Get live rooms
fetchRoomCodes(roomId)        // Get role codes
createRoom(roomData)          // Create new room
endRoom(roomId, userId)       // End active room
fetchChatMessages(roomId)     // Get chat history
sendChatMessage(roomId, msg)  // Send chat
createSponsorship(data)       // Submit ad
fetchRoomDetails(roomId)      // Get room info
addParticipantToRoom()        // Track join
removeParticipantFromRoom()   // Track leave
```

### Authentication Flow

**Farcaster Integration**:
```typescript
const token = await sdk.quickAuth.getToken();
// Use token for authenticated API calls
```

**User Context**:
```typescript
const { user } = useGlobalContext();
// Access: user.fid, user.username, user.pfp_url
```

### State Management

**Global Context** (utils/providers/globalContext.tsx):
- User data
- Loading states
- Authentication status

**100ms Store**:
- Peers list
- Room state
- Media tracks
- Messages
- Permissions

### Event System (utils/events.ts)

**Custom Events**:
```typescript
useSpeakerRequestEvent()      // Speaker requests
useSpeakerRejectionEvent()    // Rejection notifications
useNewSponsorEvent()          // New sponsorships
useSponsorStatusEvent()       // Approval/rejection
useEmojiReactionEvent()       // Emoji reactions
```

---

## File Structure

```
/app
  /call/[id]          # Call page with Conference
  /clean              # Agora demo implementation
  /profile            # User profile
  /recordings         # Recording listings
  /room/[roomid]      # Room detail page
  /user/[username]    # User profile page
  page.tsx            # Home page
  layout.tsx          # Root layout

/components
  Conference.tsx      # Main conference UI
  CallClient.tsx      # 100ms join logic
  Footer.tsx          # Audio controls, chat toggle
  Header.tsx          # Room header
  Chat.tsx            # Chat component
  SpeakerRequestsDrawer.tsx
  SponsorDrawer.tsx
  PendingSponsorshipsDrawer.tsx
  RoomSponsor.tsx
  PeerWithContextMenu.tsx
  UserContextMenu.tsx
  ScreenTile.tsx
  ... (20+ components)

/utils
  /providers          # Context providers
  /events             # Custom event hooks
  /schemas            # Database schemas
  /contract           # Smart contract ABIs
  serverActions.ts    # API calls
  constants.ts        # App constants

/styles
  globals.css         # Global styles

/public
  ... static assets
```

---

## 100ms Specific Implementation

### Track Management

**Local Audio Track**:
```typescript
// Get mic track
const audioTrack = useHMSStore(selectLocalPeer)?.audioTrack;

// Control audio
audioTrack.setEnabled(true);   // Unmute
audioTrack.setEnabled(false);  // Mute
audioTrack.setVolume(50);      // Set volume
```

**Video Track**:
```typescript
// Attach video
const { videoRef } = useVideo({
  trackId: peer.videoTrack
});
<video ref={videoRef} autoPlay />
```

### Peer Management

**Get All Peers**:
```typescript
const peers = useHMSStore(selectPeers);
const hostPeers = peers.filter(p => p.roleName === 'host');
const speakers = peers.filter(p => p.roleName === 'speaker');
```

**Change Role**:
```typescript
const changeRole = (peerId: string, newRole: string) => {
  hmsActions.changeRoleOfPeer(peerId, newRole);
};
```

### Notifications

**Subscribe to Events**:
```typescript
const notification = useHMSNotifications();

useEffect(() => {
  if (notification?.type === HMSNotificationTypes.ROOM_ENDED) {
    // Handle room end
  }
}, [notification]);
```

### Permissions

**Check Permissions**:
```typescript
const permissions = useHMSStore(selectPermissions);
const canMute = Boolean(permissions?.mute);
const canRemove = Boolean(permissions?.removeOthers);
```

---

## Summary

### 100ms is Used For:
1. **Audio/Video Streaming**: All real-time media
2. **Role Management**: Host, co-host, speaker, listener
3. **Permissions**: Mute, remove, manage controls
4. **Chat**: Broadcast messages for real-time chat
5. **Screen Sharing**: Video tracks for desktop capture
6. **Notifications**: Room and peer events
7. **Tracks**: Microphone, camera, screen sharing
8. **Quality Control**: Bitrate, resolution, connection

### Application Adds:
1. **User Authentication**: Farcaster integration
2. **Room Persistence**: MongoDB storage
3. **Chat History**: Redis persistence
4. **Sponsorships**: Custom monetization
5. **Profile System**: User management
6. **Scheduling**: Future room creation
7. **Recordings**: Session capture
8. **Social Features**: Topics, follows, history

---

## Key 100ms Hooks Reference

```typescript
// State Selectors
useHMSStore(selectPeers)              // All participants
useHMSStore(selectLocalPeer)          // Current user
useHMSStore(selectRoom)              // Room details
useHMSStore(selectHMSMessages)       // Chat messages
useHMSStore(selectPermissions)       // User permissions

// Actions
useHMSActions()                       // Room actions
useAVToggle()                         // Mic/camera toggle
useVideo()                            // Video track hook
useHMSNotifications()                 // Event notifications

// Handlers
useSpeakerRequestEvent()              // Custom speaker events
useSpeakerRejectionEvent()           // Rejection events
useSponsorStatusEvent()              // Sponsorship status
```

---

**Documentation Version**: 1.0
**Last Updated**: January 2025
**Maintained By**: Fireside Development Team

