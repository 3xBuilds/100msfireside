'use client'

import { useState, useEffect } from 'react';
import { useNavigateWithLoader } from '@/utils/useNavigateWithLoader';
import { useGlobalContext } from '@/utils/providers/globalContext';
import { toast } from 'react-toastify';
import { topics } from '@/utils/constants';
import sdk from "@farcaster/miniapp-sdk";
import { MdClose } from 'react-icons/md';
import { createRoom } from '@/utils/serverActions';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from "@/components/UI/drawer";
import Button from './UI/Button';
import DateTimePicker from './UI/DateTimePicker';
import { useAccount } from 'wagmi';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getCurrentLocalDateTime = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localISOTime = new Date(now.getTime() - offset).toISOString();
  return localISOTime.slice(0, 16);
};

const convertLocalDateTimeToUTC = (localDateTime: string) => {
  return new Date(localDateTime);
};

export default function CreateRoomModal({ isOpen, onClose }: CreateRoomModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly'>('weekly');
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const navigate = useNavigateWithLoader();
  const { user } = useGlobalContext();

  const {address} = useAccount()

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: ''
      });
      setStartTime(null);
      setShowSchedule(false);
      setSelectedTags([]);
      setAdsEnabled(Boolean(user?.autoAdsEnabled));
      setNameError('');
      setIsRecurring(false);
      setRecurrenceType('weekly');
      setRecordingEnabled(true);
    }
  }, [isOpen, user]);

  const createRoomHandler = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (formData.name.trim() === '') {
      setNameError('Room name cannot be empty.');
      toast.error('Room name is required');
      return;
    }

    if (selectedTags.length === 0) {
      toast.error('Please select at least one topic tag.');
      return;
    }

    if (showSchedule && !startTime) {
      toast.error('Please select a start time.');
      return;
    }
    
    setNameError('');
    setLoading(true);
    
    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      let token: any = null;
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      const roomData = {
        ...formData,
        startTime: startTime ? startTime.toISOString() : new Date().toISOString(),
        host: user?.fid || '',
        topics: selectedTags,
        adsEnabled,
        sponsorshipEnabled: adsEnabled,
        isRecurring: showSchedule ? isRecurring : false,
        recurrenceType: (showSchedule && isRecurring) ? recurrenceType : null,
        recurrenceDay: null,
        recordingEnabled,
        wallet: address as string,
      };

      console.log('Creating room with data:', roomData);

      const response = await createRoom(roomData, token);      
      
      if (response.ok && response.data.success) {
        toast.success('Room created successfully!');
        setFormData({ name: '', description: '' });
        setStartTime(null);
        setShowSchedule(false);
        setSelectedTags([]);
        setAdsEnabled(Boolean(user?.autoAdsEnabled));
        setIsRecurring(false);
        setRecurrenceType('weekly');
        setRecordingEnabled(true);
        onClose();

        const now = new Date();
        
        if (!startTime || now >= startTime) {
          navigate('/call/' + response.data.data._id);
        } else {
          window?.location.reload();
        }
      } else {
        toast.error(response.data?.error || 'Failed to create room');
      }
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error(error instanceof Error ? error.message : 'Error creating room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const scheduleRoom = () => {
    if (!showSchedule) {
      setShowSchedule(true);
      const oneHourLater = new Date();
      oneHourLater.setHours(oneHourLater.getHours() + 1);
      setStartTime(oneHourLater);
    } else {
      createRoomHandler();
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="bg-black/95 backdrop-blur-lg text-white gradient-orange-bg ">
        <DrawerHeader className="border-b border-orange-500/30">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-2xl font-semibold text-white">Create New Room</DrawerTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2"
              aria-label="Close"
            >
              <MdClose size={24} />
            </button>
          </div>
        </DrawerHeader>
        
        <div className="px-4 py-6 max-h-[90vh] overflow-y-auto">
          <div className="max-w-lg mx-auto space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Room Name*
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setNameError(e.target.value.trim() === '' ? 'Room name cannot be empty.' : '');
                }}
                className={`w-full bg-white/10 text-white p-3 rounded-lg border ${nameError ? 'border-fireside-red' : 'border-orange-500/30'} focus:outline-none focus:border-orange-500 transition-colors text-base`}
                placeholder="Enter room name"
              />
              {nameError && <p className="text-fireside-red text-sm mt-1">{nameError}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-white/10 text-white p-3 rounded-lg border border-orange-500/30 focus:outline-none focus:border-orange-500 transition-colors text-base min-h-[80px]"
                rows={3}
                placeholder="Describe your room (optional)"
              />
            </div>

            {showSchedule && (
              <>
                <DateTimePicker
                  label="Start Time"
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="Select start time"
                  required
                  minDate={new Date()}
                />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-300">
                      This is a regular show
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsRecurring(!isRecurring)}
                      className={`w-14 h-7 rounded-full p-1 flex items-center transition-colors ${isRecurring ? 'bg-fireside-orange' : 'bg-white/20'}`}
                    >
                      <span
                        className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${isRecurring ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>

                  {isRecurring && (
                    <div className="space-y-3 pl-2 border-l-2 border-orange-500/30">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Frequency
                        </label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setRecurrenceType('daily')}
                            className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${
                              recurrenceType === 'daily'
                                ? 'bg-orange-500 text-white'
                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                            }`}
                          >
                            Daily
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecurrenceType('weekly')}
                            className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${
                              recurrenceType === 'weekly'
                                ? 'bg-orange-500 text-white'
                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                            }`}
                          >
                            Weekly
                          </button>
                        </div>
                      </div>


                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Topics (up to 3)*
              </label>
              <div className="flex flex-wrap gap-2">
                {topics.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter(t => t !== tag));
                      } else if (selectedTags.length < 3) {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {selectedTags.length === 0 && <p className="text-fireside-red text-sm mt-1">Please select at least one topic.</p>}
              {selectedTags.length > 3 && <p className="text-fireside-red text-sm mt-1">You can select up to 3 topics only.</p>}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Enable ads for this room
                </label>
                <p className="text-xs text-gray-400">
                  Suitable ads will play automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdsEnabled(!adsEnabled)}
                className={`w-12 h-7 rounded-full p-1 flex items-center transition-colors ${adsEnabled ? 'bg-fireside-orange' : 'bg-white/20'}`}
              >
                <span
                  className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${adsEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="pr-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Record this room
                </label>
                <p className="text-xs text-gray-400">
                  Recording will be available after the room ends.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecordingEnabled(!recordingEnabled)}
                className={`w-12 h-7 rounded-full p-1 flex items-center transition-colors ${recordingEnabled ? 'bg-fireside-orange' : 'bg-white/20'}`}
              >
                <span
                  className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${recordingEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
             
          </div>
        </div>
        
        <DrawerFooter className="border-t border-orange-500/20">
          <div className="flex justify-between w-full">
            {!showSchedule ? (
              <>
                <Button
                  variant={'action'}                
                  disabled={loading}
                  onClick={createRoomHandler}
                  className="gradient-fire w-[70%] text-white font-medium"
                >
                  {loading ? 'Igniting...' : 'Fire up!'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={scheduleRoom}
                  className="text-gray-300 w-[30%] ml-3 hover:text-white"
                >
                  📅
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowSchedule(false);
                    setStartTime(null);
                  }}
                  className="text-gray-300  w-[30%] hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  disabled={loading}
                  onClick={scheduleRoom}
                  className="gradient-fire rounded-lg w-[70%] ml-3 text-white font-medium"
                >
                  {loading ? 'Scheduling...' : 'Schedule Room'}
                </Button>
              </>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}