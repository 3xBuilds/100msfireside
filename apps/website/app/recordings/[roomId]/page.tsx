'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaDownload } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Image from 'next/image';
import { fetchRoomRecordings } from '@/utils/serverActions';
import { Card } from '@/components/UI/Card';
import Button from '@/components/UI/Button';

interface RecordingResponse {
  success: boolean;
  roomId: string;
  recordings: string[];
  chats: string[];
}

export default function RecordingsPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  
  const [recordings, setRecordings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchRecordingsData = async () => {
      try {
        setLoading(true);
        const response = await fetchRoomRecordings(roomId);

        console.log('Fetch recordings response:', response);

        if (!response.ok) {
          throw new Error('Failed to fetch recordings');
        }
        
        const data = response.data;
        console.log("THIS IS THE DATA", data);
        if (data.success && data.data.recordings.recordings.length > 0) {
          console.log("FUCKING RECORDING", data.data.recordings);
          setRecordings(data.data.recordings.recordings);
          setSelectedRecording(data.data.recordings.recordings[0]);
        } else {
          setError('No recordings found for this room');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recordings');
        toast.error('Failed to load recordings');
      } finally {
        setLoading(false);
      }
    };

    if (roomId) {
      fetchRecordingsData();
    }
  }, [roomId]);

  useEffect(() => {
    if (selectedRecording) {
      const audio = new Audio(selectedRecording);
      audio.preload = 'metadata';
      
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
      });
      
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });
      
      audio.addEventListener('play', () => {
        setIsPlaying(true);
      });
      
      audio.addEventListener('pause', () => {
        setIsPlaying(false);
      });
      
      setAudioRef(audio);
      
      return () => {
        audio.pause();
        audio.removeEventListener('loadedmetadata', () => {});
        audio.removeEventListener('timeupdate', () => {});
        audio.removeEventListener('ended', () => {});
        audio.removeEventListener('play', () => {});
        audio.removeEventListener('pause', () => {});
      };
    }
  }, [selectedRecording]);

  const handleBack = () => {
    router.back();
  };

  const togglePlayPause = () => {
    if (audioRef) {
      if (isPlaying) {
        audioRef.pause();
      } else {
        audioRef.play();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef) {
      audioRef.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleMute = () => {
    if (audioRef) {
      if (isMuted) {
        audioRef.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    if (selectedRecording) {
      const link = document.createElement('a');
      link.href = selectedRecording;
      link.download = `recording-${roomId}-${Date.now()}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Download started');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-white">Loading recordings...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📹</div>
            <h1 className="text-2xl font-bold mb-2 text-white">No Recordings Found</h1>
            <p className="text-white/60 mb-6">{error}</p>
            <Button
              variant="default"
              onClick={handleBack}
              className="flex items-center gap-2 mx-auto"
            >
              <FaArrowLeft />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="p-2 hover:text-orange-400"
          >
            <FaArrowLeft className="text-xl" />
          </Button>
          <h1 className="text-2xl font-bold text-white">Room Recordings</h1>
        </div>

        {/* Custom Audio Player */}
        {selectedRecording && (
          <Card variant="ghost" className="p-6 mb-8">
            {/* Fireside Logo - Larger thumbnail size */}
            {/* <div className="flex justify-center mb-6">
              <div className="w-32 h-32 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center p-4">
                <Image
                  src="/fireside-logo.svg"
                  alt="Fireside"
                  width={120}
                  height={120}
                  className="w-full h-full object-contain"
                />
              </div>
            </div> */}

            <div className="space-y-4">
              {/* Play/Pause and Download Buttons */}
              <div className="flex justify-center items-center gap-4">
                <Button
                  variant="default"
                  onClick={togglePlayPause}
                  className="w-16 h-16 rounded-full flex items-center justify-center p-0"
                >
                  {isPlaying ? <FaPause className="text-xl" /> : <FaPlay className="text-xl" />}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDownload}
                  className="p-3 hover:text-orange-400"
                >
                  <FaDownload className="text-xl" />
                </Button>
              </div>

              {/* Progress Bar with Mute Button */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-white/70">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #ea580c 0%, #ea580c ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) 100%)`
                    }}
                  />
                  {/* Mute Button positioned on the right side */}
                  <Button
                    variant="ghost"
                    onClick={toggleMute}
                    className="p-2 flex-shrink-0"
                  >
                    {isMuted ? <FaVolumeMute className="text-lg" /> : <FaVolumeUp className="text-lg" />}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Recordings List */}
        {recordings.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold mb-4">
              Available Recordings ({recordings.length})
            </h2>
            
            <div className="space-y-3">
              {recordings.map((recording, index) => (
                <Card
                  key={index}
                  variant={selectedRecording === recording ? "orange" : "ghost"}
                  className="p-4 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => {
                    setSelectedRecording(recording);
                    setIsPlaying(false);
                    setCurrentTime(0);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedRecording === recording ? 'bg-orange-600' : 'bg-white/20'
                    }`}>
                      <FaPlay className="text-white text-sm" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        Recording {index + 1}
                      </p>
                      <p className="text-white/60 text-sm">
                        {new Date().toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  {selectedRecording === recording && isPlaying && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      <span className="text-orange-500 text-sm font-medium">Playing</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No recordings message */}
        {recordings.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📹</div>
            <h2 className="text-white text-xl font-semibold mb-2">No Recordings Available</h2>
            <p className="text-white/60">This room doesn&apos;t have any recordings yet.</p>
          </div>
        )}
      </div>

      {/* Custom CSS for slider styling */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #ea580c;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #ea580c;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
