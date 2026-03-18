import { RtcTokenBuilder, RtcRole } from 'agora-token';
import config from '../config';

export class AgoraAPI {
  private appId: string;
  private appCertificate: string;
  private customerKey: string;
  private customerSecret: string;
  private baseUrl = 'https://api.agora.io';

  constructor() {
    this.appId = config.agoraAppId;
    this.appCertificate = config.agoraAppCertificate;
    this.customerKey = config.agoraCustomerKey;
    this.customerSecret = config.agoraCustomerSecret;

    if (!this.appId) {
      throw new Error('AGORA_APP_ID is required');
    }

    if (!this.appCertificate) {
      throw new Error('AGORA_APP_CERTIFICATE is required');
    }
  }

  private getBasicAuth(): string {
    const credentials = Buffer.from(`${this.customerKey}:${this.customerSecret}`).toString('base64');
    return `Basic ${credentials}`;
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
        'Authorization': this.getBasicAuth()
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorObj: any;
      try {
        errorObj = JSON.parse(errorText);
      } catch {
        errorObj = { message: errorText };
      }
      console.log('Agora API error response:', errorObj);
      throw new Error(`Agora API error: ${response.status} - ${errorText}`);
    }

    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text);
  }

  /**
   * Generate an RTC token for a user to join a channel.
   * @param channelName - The Agora channel name (stored as roomId in DB)
   * @param uid - Numeric user ID (use FID)
   * @param role - Application role (host/co-host/speaker/listener)
   * @param expirationSeconds - Token TTL in seconds (default 24 hours)
   */
  generateToken(
    channelName: string,
    uid: number,
    role: 'host' | 'co-host' | 'speaker' | 'listener',
    expirationSeconds: number = 86400
  ): string {
    // host, co-host, speaker can publish audio; listener is subscriber only
    const agoraRole = role === 'listener' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationSeconds;

    return RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.appCertificate,
      channelName,
      uid,
      agoraRole,
      privilegeExpiredTs,
      privilegeExpiredTs
    );
  }

  /**
   * Query active users in a channel.
   * Replaces HMS listRoomPeers.
   */
  async listChannelUsers(channelName: string): Promise<{
    success: boolean;
    peers: Array<{ uid: number }>;
    count: number;
  }> {
    try {
      const response = await this.makeRequest<any>(
        `/dev/v1/channel/user/${this.appId}/${channelName}`,
        'GET'
      );

      if (!response.data || !response.data.channel_exist) {
        return { success: true, peers: [], count: 0 };
      }

      const broadcasters = (response.data.broadcasters || []).map((uid: number) => ({ uid }));
      const audience = (response.data.audience || []).map((uid: number) => ({ uid }));
      const allUsers = [...broadcasters, ...audience];

      return {
        success: true,
        peers: allUsers,
        count: allUsers.length
      };
    } catch (error: any) {
      if (error.message && (error.message.includes('404') || error.message.includes('channel not found'))) {
        return { success: true, peers: [], count: 0 };
      }
      throw new Error(`Failed to fetch channel users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Kick all users from a channel (end room).
   * Replaces HMS endRoom.
   */
  async endChannel(channelName: string): Promise<void> {
    await this.makeRequest<any>(
      `/dev/v1/kicking-rule`,
      'POST',
      {
        appid: this.appId,
        cname: channelName,
        time: 0, // 0 = permanent ban (effectively ends the channel)
        privileges: ['join_channel']
      }
    );
  }

  /**
   * Remove a specific user from a channel.
   * Replaces HMS removePeer.
   */
  async removeUser(channelName: string, uid: number, banMinutes: number = 5): Promise<void> {
    await this.makeRequest<any>(
      `/dev/v1/kicking-rule`,
      'POST',
      {
        appid: this.appId,
        cname: channelName,
        uid,
        time: banMinutes,
        privileges: ['join_channel']
      }
    );
  }

  /**
   * Acquire a resource for cloud recording.
   */
  async acquireRecordingResource(channelName: string, uid: number): Promise<string> {
    const response = await this.makeRequest<any>(
      `/v1/apps/${this.appId}/cloud_recording/acquire`,
      'POST',
      {
        cname: channelName,
        uid: String(uid),
        clientRequest: {
          resourceExpiredHour: 24
        }
      }
    );
    return response.resourceId;
  }

  /**
   * Start cloud recording (composite mode).
   */
  async startRecording(
    channelName: string,
    uid: number,
    resourceId: string,
    token: string
  ): Promise<{ sid: string; resourceId: string }> {
    const response = await this.makeRequest<any>(
      `/v1/apps/${this.appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
      'POST',
      {
        cname: channelName,
        uid: String(uid),
        clientRequest: {
          token,
          recordingConfig: {
            channelType: 1, // live broadcast
            streamTypes: 0, // audio only
            maxIdleTime: 300,
            transcodingConfig: {
              width: 640,
              height: 480,
              fps: 15,
              bitrate: 500
            }
          },
          storageConfig: {
            vendor: 1, // AWS S3
            region: config.awsRegion === 'us-east-1' ? 0 : 1,
            bucket: config.s3BucketName,
            accessKey: config.awsAccessKeyId,
            secretKey: config.awsSecretAccessKey,
            fileNamePrefix: ['recordings', channelName]
          }
        }
      }
    );
    return { sid: response.sid, resourceId };
  }

  /**
   * Stop cloud recording.
   */
  async stopRecording(
    channelName: string,
    uid: number,
    resourceId: string,
    sid: string
  ): Promise<any> {
    return this.makeRequest<any>(
      `/v1/apps/${this.appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
      'POST',
      {
        cname: channelName,
        uid: String(uid),
        clientRequest: {}
      }
    );
  }

  /**
   * Get recording files from S3 for a channel.
   * Since Agora cloud recording stores to S3 directly, we query the bucket.
   */
  async getRecordingAssets(channelName: string): Promise<{
    success: boolean;
    roomId: string;
    recordings: string[];
    chats: string[];
  }> {
    // Agora stores recordings directly to S3. The files are at:
    // s3://{bucket}/recordings/{channelName}/...
    // We construct the public URL pattern
    const baseUrl = `https://${config.s3BucketName}.s3.${config.awsRegion}.amazonaws.com/recordings/${channelName}`;

    return {
      success: true,
      roomId: channelName,
      recordings: [`${baseUrl}/`],
      chats: []
    };
  }
}
