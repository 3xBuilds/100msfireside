export interface MentionData {
  inboxId: string;
  username: string;
  displayName?: string;
  fid?: string;
  startIndex: number;
  length: number;
}

export interface MentionableUser {
  inboxId: string;
  username: string;
  displayName?: string;
  fid?: string;
  pfp_url?: string;
}

export interface MessageWithMentions {
  text: string;
  mentions?: MentionData[];
}
