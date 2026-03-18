import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

interface RoomData {
  room: {
    name: string;
    host: {
      fid: number;
      displayName: string;
      username: string;
      pfp_url: string;
    };
  };
}

interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
}

/**
 * Fetch user info from Neynar API by FID
 */
async function fetchNeynarUser(fid: number): Promise<NeynarUser | null> {
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  
  if (!neynarApiKey) {
    console.warn('[OG Image] NEYNAR_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          'x-api-key': neynarApiKey,
        },
      }
    );

    if (!response.ok) {
      console.error('[OG Image] Neynar API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.users && data.users.length > 0) {
      return data.users[0];
    }

    return null;
  } catch (error) {
    console.error('[OG Image] Error fetching user from Neynar:', error);
    return null;
  }
}

/**
 * Fetch room data from backend
 */
async function fetchRoomData(roomId: string): Promise<RoomData | null> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  
  try {
    const response = await fetch(`${backendUrl}/api/rooms/public/${roomId}`);
    
    if (!response.ok) {
      console.error('[OG Image] Room API error:', response.status);
      return null;
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('[OG Image] Error fetching room data:', error);
    return null;
  }
}

/**
 * Truncate room name to fit within character limit
 */
function truncateRoomName(name: string, maxLength: number = 50): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id;

    // Fetch room data
    const roomData = await fetchRoomData(roomId);
    
    if (!roomData) {
      // Return fallback image on error
      return new ImageResponse(
        (
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#1a1a1a',
              color: 'white',
              fontSize: 48,
              fontWeight: 700,
            }}
          >
            Fireside
          </div>
        ),
        {
          width: 1200,
          height: 630,
        }
      );
    }

    // Fetch fresh host data from Neynar for latest profile picture
    const neynarUser = await fetchNeynarUser(roomData.room.host.fid);
    
    // Use Neynar pfp if available, fallback to room data pfp
    const hostPfp = neynarUser?.pfp_url || roomData.room.host.pfp_url;
    const hostUsername = neynarUser?.username || roomData.room.host.username;
    const roomName = truncateRoomName(roomData.room.name);

    // Get the base URL for assets
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://firesidebase.vercel.app';

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          {/* Background Image */}
          <img
            src={`${baseUrl}/assets/og-background.png`}
            alt="background"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          {/* Content Container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              padding: '80px',
            }}
          >
            {/* Room Name Card */}
            <div
              style={{
                display: 'flex',
                padding: '20px 48px',
                maxWidth: '90%',
                textAlign: 'center',
                marginBottom: '10px',
              }}
            >
              <p
                style={{
                  color: 'white',
                  fontSize: 48,
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {roomName}
              </p>
            </div>

            {/* Host Info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                borderTop: '2px solid rgba(255, 255, 255, 0.5)',
                paddingTop: '16px',
              }}
            >
              <span
                style={{
                  color: 'white',
                  fontSize: 24,
                  fontWeight: 600,
                }}
              >
                by
              </span>
              
              {/* Host Profile Picture */}
              <img
                src={hostPfp}
                alt="host"
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '10px',
                  objectFit: 'cover',
                  background: 'white',
                }}
              />
              
              {/* Host Username */}
              <div
                style={{
                  alignContent: 'flex-start',
                  display: 'flex',
                  color: 'white'
                }}
              >
                <span
                  style={{
                    color: '#f78635',
                    fontSize: 24,
                    fontWeight: 900,
                  }}
                >
                  {hostUsername}
                </span>
              </div>
            </div>

            {/* Fireside Logo (bottom right) */}
            {/* <div
              style={{
                display: 'flex',
                position: 'absolute',
                bottom: '40px',
                right: '60px',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 48,
                }}
              >
                🔥
              </div>
              <span
                style={{
                  color: 'white',
                  fontSize: 36,
                  fontWeight: 700,
                  letterSpacing: '2px',
                }}
              >
                FIRESIDE
              </span>
            </div> */}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('[OG Image] Error generating image:', error);
    
    // Return fallback image on error
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            color: 'white',
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          Fireside
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }
}
