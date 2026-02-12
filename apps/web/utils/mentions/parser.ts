import type { MentionData, MentionableUser } from './types';

const MENTION_REGEX = /\B@([\w][\w.-]*)/g;

export function extractMentions(text: string, users?: MentionableUser[]): MentionData[] {
  const mentions: MentionData[] = [];
  let match;
  
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const username = match[1];
    
    // Try to find the user in the mentionableUsers list
    const user = users?.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (user) {
      mentions.push({
        inboxId: user.inboxId,
        username: user.username,
        displayName: user.displayName,
        fid: user.fid,
        startIndex: match.index,
        length: match[0].length,
      });
    }
  }
  
  return mentions;
}

export function replaceMentionsWithPlaceholders(
  text: string,
  mentions: MentionData[]
): string {
  let result = text;
  const sortedMentions = [...mentions].sort((a, b) => b.startIndex - a.startIndex);
  
  for (const mention of sortedMentions) {
    const before = result.substring(0, mention.startIndex);
    const after = result.substring(mention.startIndex + mention.length);
    result = before + `@${mention.username}` + after;
  }
  
  return result;
}

export function restoreMentions(text: string, mentions: MentionData[]): string {
  return text;
}

export function findMentionAtCursor(text: string, cursorPosition: number): { username: string; start: number; end: number } | null {
  const beforeCursor = text.substring(0, cursorPosition);
  const afterCursor = text.substring(cursorPosition);
  
  const beforeMatch = beforeCursor.match(/@([\w.-]*)$/);
  if (!beforeMatch) return null;
  
  const afterMatch = afterCursor.match(/^([\w.-]*)/);
  const username = beforeMatch[1] + (afterMatch ? afterMatch[1] : '');
  const start = cursorPosition - beforeMatch[1].length - 1;
  const end = cursorPosition + (afterMatch ? afterMatch[1].length : 0);
  
  return { username, start, end };
}

export function insertMention(
  text: string,
  cursorPosition: number,
  username: string
): { newText: string; newCursorPosition: number } {
  const mention = findMentionAtCursor(text, cursorPosition);
  
  if (!mention) {
    return { newText: text, newCursorPosition: cursorPosition };
  }
  
  const before = text.substring(0, mention.start);
  const after = text.substring(mention.end);
  const newText = before + `@${username} ` + after;
  const newCursorPosition = mention.start + username.length + 2;
  
  return { newText, newCursorPosition };
}
