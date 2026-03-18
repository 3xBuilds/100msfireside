'use client';

import { useEffect, useRef, useMemo } from 'react';
import { AgoraPeer } from '@/contexts/AgoraContext';

// Type for role mention items
type RoleMentionItem = { type: 'role'; role: string; label: string; color: string; icon: string };

// Type for mentionable items (either a peer or a role)
type MentionItem = 
  | { type: 'peer'; peer: AgoraPeer }
  | RoleMentionItem;

interface MentionPopupProps {
  peers: AgoraPeer[];
  query: string;
  onSelect: (peer: AgoraPeer | null, displayText: string) => void;
  onClose: () => void;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
}

// Role display order and styling
const ROLE_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  host: { label: 'Host', color: 'bg-fireside-orange', order: 0 },
  'co-host': { label: 'Co-Host', color: 'bg-purple-500', order: 1 },
  speaker: { label: 'Speaker', color: 'bg-green-500', order: 2 },
  listener: { label: 'Listener', color: 'bg-gray-500', order: 3 },
};

// Mentionable roles
const MENTIONABLE_ROLES: RoleMentionItem[] = [
  { type: 'role', role: 'host', label: 'Host', color: 'bg-fireside-orange', icon: '👑' },
  { type: 'role', role: 'co-host', label: 'Co-Host', color: 'bg-purple-500', icon: '⭐' },
  { type: 'role', role: 'speaker', label: 'Speakers', color: 'bg-green-500', icon: '🎤' },
  { type: 'role', role: 'listener', label: 'Listeners', color: 'bg-gray-500', icon: '👂' },
];

export function MentionPopup({
  peers,
  query,
  onSelect,
  onClose,
  selectedIndex,
  onSelectedIndexChange,
}: MentionPopupProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Parse peer metadata to get avatar and other info
  const getPeerMeta = (peer: AgoraPeer) => {
    try {
      const meta = peer.metadata ? JSON.parse(peer.metadata) : {};
      return {
        avatar: meta.avatar || '',
        fid: meta.fid || '',
        wallet: meta.wallet || '',
      };
    } catch {
      return { avatar: '', fid: '', wallet: '' };
    }
  };

  // Filter roles based on query
  const filteredRoles = useMemo(() => {
    const searchTerm = query.toLowerCase();
    return MENTIONABLE_ROLES.filter(item => 
      item.role.includes(searchTerm) || item.label.toLowerCase().includes(searchTerm)
    );
  }, [query]);

  // Filter and sort peers based on query
  const filteredPeers = useMemo(() => {
    return peers
      .filter((peer) => {
        const searchTerm = query.toLowerCase();
        const name = peer.name?.toLowerCase() || '';
        return name.includes(searchTerm);
      })
      .sort((a, b) => {
        // Sort by role priority, then alphabetically
        const roleA = ROLE_CONFIG[a.roleName || '']?.order ?? 99;
        const roleB = ROLE_CONFIG[b.roleName || '']?.order ?? 99;
        if (roleA !== roleB) return roleA - roleB;
        return (a.name || '').localeCompare(b.name || '');
      })
      .slice(0, 6); // Limit peers to leave room for roles
  }, [peers, query]);

  // Combined list: roles first, then peers
  const combinedItems: MentionItem[] = useMemo(() => {
    const peerItems: MentionItem[] = filteredPeers.map(peer => ({ type: 'peer', peer }));
    return [...filteredRoles, ...peerItems].slice(0, 8);
  }, [filteredRoles, filteredPeers]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex];
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onSelectedIndexChange(
            selectedIndex < combinedItems.length - 1 ? selectedIndex + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          onSelectedIndexChange(
            selectedIndex > 0 ? selectedIndex - 1 : combinedItems.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (combinedItems[selectedIndex]) {
            const item = combinedItems[selectedIndex];
            if (item.type === 'role') {
              onSelect(null, item.role);
            } else {
              onSelect(item.peer, item.peer.name || 'Unknown');
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          e.preventDefault();
          if (combinedItems[selectedIndex]) {
            const item = combinedItems[selectedIndex];
            if (item.type === 'role') {
              onSelect(null, item.role);
            } else {
              onSelect(item.peer, item.peer.name || 'Unknown');
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, combinedItems, onSelect, onClose, onSelectedIndexChange]);

  if (combinedItems.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-2 bg-black/90 backdrop-blur-lg border border-fireside-orange/20 rounded-lg shadow-lg overflow-hidden z-50">
        <div className="px-4 py-3 text-sm text-white/50 text-center">
          No participants or roles found
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-black/90 backdrop-blur-lg border border-fireside-orange/20 rounded-lg shadow-lg overflow-hidden z-50 max-h-[280px] overflow-y-auto"
    >
      <div className="px-3 py-2 text-xs text-white/40 border-b border-white/10">
        Mention someone or a role
      </div>
      <div className="py-1">
        {combinedItems.map((item, index) => {
          const isSelected = index === selectedIndex;

          if (item.type === 'role') {
            return (
              <button
                key={`role-${item.role}`}
                ref={(el) => { itemRefs.current[index] = el; }}
                onClick={() => onSelect(null, item.role)}
                className={`w-full px-3 py-2 flex items-center gap-3 transition-colors ${
                  isSelected ? 'bg-fireside-orange/20' : 'hover:bg-white/5'
                }`}
              >
                <div className={`w-8 h-8 rounded-full ${item.color} flex items-center justify-center text-sm flex-shrink-0`}>
                  {item.icon}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white">@{item.role}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium ${item.color}`}>
                      ROLE
                    </span>
                  </div>
                  <span className="text-xs text-white/40">Mention all {item.label.toLowerCase()}</span>
                </div>
                {isSelected && <span className="text-xs text-white/40 flex-shrink-0">↵</span>}
              </button>
            );
          }

          // Peer item
          const peer = item.peer;
          const meta = getPeerMeta(peer);
          const roleConfig = ROLE_CONFIG[peer.roleName || ''] || ROLE_CONFIG.listener;

          return (
            <button
              key={peer.id}
              ref={(el) => { itemRefs.current[index] = el; }}
              onClick={() => onSelect(peer, peer.name || 'Unknown')}
              className={`w-full px-3 py-2 flex items-center gap-3 transition-colors ${
                isSelected
                  ? 'bg-fireside-orange/20'
                  : 'hover:bg-white/5'
              }`}
            >
              {/* Avatar */}
              {meta.avatar ? (
                <img
                  src={meta.avatar}
                  alt={peer.name || 'User'}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                  }}
                />
              ) : null}
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-br from-fireside-orange to-fireside-purple flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ${
                  meta.avatar ? 'hidden' : ''
                }`}
              >
                {(peer.name || 'U').slice(0, 2).toUpperCase()}
              </div>

              {/* Name and role */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white truncate">
                    {peer.name || 'Unknown'}
                  </span>
                  {roleConfig.label && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium ${roleConfig.color}`}
                    >
                      {roleConfig.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <span className="text-xs text-white/40 flex-shrink-0">
                  ↵
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
