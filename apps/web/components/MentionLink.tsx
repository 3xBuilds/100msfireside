"use client";

import React from 'react';
import sdk from '@farcaster/miniapp-sdk';
import type { MentionData } from '@/utils/mentions';

interface MentionLinkProps {
  mention: MentionData;
}

export const MentionLink: React.FC<MentionLinkProps> = ({ mention }) => {
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (mention.fid) {
      try {
        await sdk.actions.viewProfile({ 
          fid: parseInt(mention.fid)
        });
      } catch (error) {
        console.error('Failed to open profile:', error);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/20 text-white transition-colors font-medium cursor-pointer"
      disabled={!mention.fid}
    >
      @{mention.username}
    </button>
  );
};

export default MentionLink;
