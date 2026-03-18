# Audio Debugging - Test Instructions

## What Was Added

Comprehensive logging has been added to track the audio lifecycle and identify the root cause of the muting issue.

### Logging Points

1. **Peer Updates** (`components/Conference.tsx`):
   - Logs join order of all peers
   - Logs each peer's track IDs
   - Fires whenever peer list changes

2. **Mute/Unmute Events** (`components/Footer.tsx`):
   - Logs who initiated the mute/unmute
   - Logs state BEFORE the toggle
   - Logs state AFTER the toggle (500ms delay)
   - Shows track IDs for all peers

## How to Test

1. **Open Browser Console** (Chrome DevTools or Safari Inspector)
2. **Clear console logs**
3. **Join 3 participants in this order**:
   - Person A joins
   - Person B joins  
   - Person C joins
4. **Have Person C start speaking/talking**
5. **Person A mutes** (taps mute button)
6. **Check audio**: Can Person B still hear Person C?
7. **Copy ALL console logs** from the browser

## What to Look For

In the console, you'll see logs like:

### When Peers Join:
```
[AUDIO DEBUG] Peer Update
Timestamp: 2024-01-XX...
Total peers: 3
Peer join order: [
  { id: "peer-1", name: "Person A", role: "speaker", hasAudio: true, audioTrackId: "track-123" },
  { id: "peer-2", name: "Person B", role: "listener", hasAudio: false, audioTrackId: null },
  { id: "peer-3", name: "Person C", role: "speaker", hasAudio: true, audioTrackId: "track-456" }
]
```

### When Mute Happens:
```
[AUDIO DEBUG] Mute/Unmute Event
Audio toggle initiated: { currentState: true, targetState: false, peerId: "peer-1", ... }
```

### After Mute (500ms delay):
```
[AUDIO DEBUG] After toggle - check console for peer updates
```

## What This Will Tell Us

1. **If track IDs change after mute** → This is an HMS SDK issue
2. **If track state changes but IDs stay same** → Audio routing issue
3. **If order of participants matters** → Subscription order bug
4. **If Person B's track suddenly disappears** → Track unsubscription bug

## Reporting Results

Please provide:
1. The FULL console output before Person A muted
2. The FULL console output when Person A muted
3. Which participant lost audio (Person B? Person C?)
4. Did the audio indicator still show for the speaking person?

This will definitively show if it's a 100ms SDK bug or our implementation.

