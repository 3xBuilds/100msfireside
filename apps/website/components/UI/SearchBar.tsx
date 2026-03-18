import React, { useState, useRef, useEffect } from 'react';
import { useNavigateWithLoader } from '@/utils/useNavigateWithLoader';
import { twMerge } from 'tailwind-merge';
import { IoSearchOutline } from 'react-icons/io5';
import { searchUsersAndRooms } from '@/utils/serverActions';


const SearchBar: React.FC<{ className?: string }> = ({ className }) => {
  const [value, setValue] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showResultsList, setShowResultsList] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigateWithLoader();

  useEffect(() => {
    setShowResultsList(isFocused && results.length > 0);

    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        setShowResultsList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFocused, results]);

  const handleSearch = async (searchValue: string) => {
    if (!searchValue.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const response = await searchUsersAndRooms(searchValue);
      const data = response.data;

      if (data.success) {
        // Flatten results for display
        const userResults = (data.data.users || []).map((user: any) => ({
          id: user.fid,
          title: user.displayName || user.username,
          image: user.pfp_url,
          type: 'user',
          raw: user
        }));
        const roomResults = (data.data.rooms || []).map((room: any) => ({
          id: room.roomId,
          title: room.name,
          image: undefined,
          type: 'room',
          tags: room.topics,
          raw: room
        }));
        setResults([...userResults, ...roomResults]);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(value);
    }
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <div
        className={twMerge(
          'flex items-center px-3 py-2 border border-white/30 bg-white/10 rounded-lg',
          isFocused ? 'ring-1 ring-white/50' : '',
          className
        )}
      >
        <IoSearchOutline className="text-white/70 mr-2" size={18} />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (e.target.value.trim()) {
              handleSearch(e.target.value);
            } else {
              setResults([]);
            }
          }}
          onFocus={() => setIsFocused(true)}
          placeholder={'Search users or rooms...'}
          className={twMerge(
            'w-full bg-transparent outline-none text-white placeholder-white/50'
          )}
          onKeyDown={handleKeyDown}
        />
        {loading && (
          <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></div>
        )}
      </div>

      {/* Search Results */}
      {showResultsList && (
        <div
          className={twMerge(
            'absolute z-10 mt-1 w-full bg-black/80 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg max-h-60 overflow-y-auto'
          )}
        >
          {results.map((result) => (
            <div
              key={result.id}
              className={twMerge(
                'flex items-center p-3 cursor-pointer hover:bg-white/10 transition-colors'
              )}
              onClick={() => {
                setShowResultsList(false);
                if (result.type === 'user' && result.raw?.username) {
                  navigate(`/user/${result.raw.username}`);
                }
                if (result.type === 'room' && result.raw?._id) {
                  navigate(`/call/${result.raw._id}`);
                }
              }}
            >
              {result.image && (
                <div className="w-8 h-8 mr-3 rounded-full overflow-hidden flex-shrink-0">
                  <img src={result.image} alt={result.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="text-white text-sm font-medium truncate">
                {result.title}
                {result.type === 'room' && result.tags && (
                  <span className="ml-2 text-xs text-pink-400">[{result.tags.join(', ')}]</span>
                )}
              </div>
              {result.type === 'user' && (
                <span className="ml-2 text-xs text-blue-400">User</span>
              )}
              {result.type === 'room' && (
                <span className="ml-2 text-xs text-orange-400">Room</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
