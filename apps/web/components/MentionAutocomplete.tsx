"use client";

import React, { useEffect, useRef } from 'react';
import type { MentionableUser } from '@/utils/mentions';

interface MentionAutocompleteProps {
  users: MentionableUser[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (user: MentionableUser) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  users,
  selectedIndex,
  position,
  onSelect,
  onKeyDown,
}) => {
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex]);

  if (users.length === 0) return null;

  return (
    <div
      className="absolute z-50 min-w-[200px] max-w-[300px] bg-black border border-gray-700 rounded-lg shadow-xl overflow-hidden"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onKeyDown={onKeyDown}
    >
      <ul ref={listRef} className="max-h-[200px] overflow-y-auto">
        {users.map((user, index) => (
          <li
            key={user.inboxId}
            className={`px-3 py-2 cursor-pointer transition-colors ${
              index === selectedIndex
                ? 'bg-neutral-orange/20 text-neutral-orange'
                : 'hover:bg-gray-700 text-white'
            }`}
            onClick={() => onSelect(user)}
            onMouseEnter={() => {
              // Optional: could update selectedIndex on hover
            }}
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">@{user.username}</div>
                {user.displayName && (
                  <div className="text-sm text-gray-400 truncate">{user.displayName}</div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      
    </div>
  );
};

export default MentionAutocomplete;
