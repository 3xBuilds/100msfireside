import config from '../config';
import type { HMSCreateRoomResponse, HMSRoomCodeResponse } from '../schemas';

export class HMSAPI {
  private baseUrl = 'https://api.100ms.live/v2';
  private managementToken: string;
  private templateId: string;

  constructor() {
    this.managementToken = config.hundredMsManagementToken;
    this.templateId = config.hundredMsTemplateId;
    
    if (!this.managementToken) {
      throw new Error('HUNDRED_MS_MANAGEMENT_TOKEN is required');
    }
    
    if (!this.templateId) {
      throw new Error('HUNDRED_MS_TEMPLATE_ID is required');
    }
  }

  private async makeRequest<T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.managementToken}`
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorObj: any;
      try {
        errorObj = JSON.parse(errorText);
      } catch (e) {
        errorObj = { message: errorText };
      }

      console.log('100ms API error response:', errorObj);
      
      if (errorObj.message && 
          (errorObj.message.includes('duplicate') || 
           errorObj.message.includes('already exists') ||
           errorObj.code === 'room_name_taken') || errorObj.message.includes('room not active')) {
        throw new Error(`duplicate:${errorObj.message}`);
      }
      
      throw new Error(`100ms API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async createRoom(name: string, description: string): Promise<HMSCreateRoomResponse> {
    const sanitizedName = name.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Fireside Room';
    
    try {
      return await this.makeRequest<HMSCreateRoomResponse>('/rooms', 'POST', {
        name: sanitizedName,
        description,
        template_id: this.templateId
      });
    } catch (error: any) {
      if (error.message && error.message.includes('duplicate')) {
        console.log(`Room name "${sanitizedName}" already exists, trying with random suffix`);
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const uniqueName = `${sanitizedName} ${randomSuffix}`;
        
        try {
          return await this.makeRequest<HMSCreateRoomResponse>('/rooms', 'POST', {
            name: uniqueName,
            description,
            template_id: this.templateId
          });
        } catch (retryError) {
          console.error('Failed to create room even with random suffix:', retryError);
          throw retryError;
        }
      }
      throw error;
    }
  }

  async generateRoomCodes(roomId: string): Promise<HMSRoomCodeResponse[]> {
    return this.makeRequest<HMSRoomCodeResponse[]>(`/room-codes/room/${roomId}`, 'POST');
  }

  async getRoomCodes(roomId: string): Promise<{ data: HMSRoomCodeResponse[] }> {
    return this.makeRequest<{ data: HMSRoomCodeResponse[] }>(`/room-codes/room/${roomId}`, 'GET');
  }

  async endRoom(roomId: string, reason: string = 'The session has ended', lock: boolean = true): Promise<void> {
    return this.makeRequest<void>(`/active-rooms/${roomId}/end-room`, 'POST', {
      reason,
      lock
    });
  }

  async getRecordingAssets(roomId: string): Promise<{
    success: boolean;
    roomId: string;
    recordings: string[];
    chats: string[];
  }> {

    try {
      const recordingAssets = await this.makeRequest<any>(
        `/recording-assets?room_id=${roomId}`, 
        'GET'
      );

      const convertS3ToPublicUrl = (s3Url: string) => {
        return s3Url.replace('s3://fireside-100ms/', 'https://fireside-100ms.s3.ap-south-1.amazonaws.com/');
      };

      const recordings = recordingAssets.data
        .filter((asset: any) => asset.type === 'room-composite')
        .map((asset: any) => convertS3ToPublicUrl(asset.path));
      
      const chats = recordingAssets.data
        .filter((asset: any) => asset.type === 'chat')
        .map((asset: any) => convertS3ToPublicUrl(asset.path));

      return {
        success: true,
        roomId: roomId,
        recordings: recordings,
        chats: chats
      };
    } catch (error) {
      throw new Error(`Failed to fetch recording assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listRoomPeers(roomId: string): Promise<{
    success: boolean;
    peers: Array<{
      id: string;
      name: string;
      user_id?: string;
      metadata?: string;
      role: string;
      joined_at: string;
      left_at?: string;
    }>;
    count: number;
  }> {
    try {
      const response = await this.makeRequest<{
        peers: Record<string, {
          id: string;
          name: string;
          user_id?: string;
          metadata?: string;
          role: string;
          joined_at: string;
          left_at?: string;
        }>;
      }>(`/active-rooms/${roomId}/peers`, 'GET');

      console.log("Peers response from HMS:", response);

      // Convert peers object to array (no need to filter by left_at)
      const peersObj = response?.peers || {};
      const activePeers = Object.values(peersObj);

      return {
        success: true,
        peers: activePeers,
        count: activePeers.length
      };
    } catch (error: any) {
      // If room is not active or doesn't exist, return empty peers
      if (error.message && (
        error.message.includes('room not active') || 
        error.message.includes('session not active') ||
        error.message.includes('404')
      )) {
        console.log(`Room ${roomId} is not active, returning 0 peers`);
        return {
          success: true,
          peers: [],
          count: 0
        };
      }
      throw new Error(`Failed to fetch room peers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async startRecording(roomId: string): Promise<any> {
    const url = `/recordings/room/${roomId}/start`;
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.managementToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({resolution: {
        width: 1280,
        height: 720
      }}),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to start recording: ${JSON.stringify(error)}`);
    }

    return response.json();
  }
}
