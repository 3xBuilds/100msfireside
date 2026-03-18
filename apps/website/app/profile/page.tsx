'use client'

import { useGlobalContext } from '@/utils/providers/globalContext';
import { useAuthToken } from '@/hooks/useAuthToken';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import NavigationWrapper from '@/components/NavigationWrapper';
import { IoIosArrowBack } from 'react-icons/io';
import { IoRefreshOutline } from 'react-icons/io5';
import { FaXTwitter } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { fetchUserRooms, refreshUserProfile, updateAdsPreference } from '@/utils/serverActions';
import { Card } from '@/components/UI/Card';
import Navigation from '@/components/Navigation';
import MainHeader from '@/components/UI/MainHeader';
import { useNavigateWithLoader } from '@/utils/useNavigateWithLoader';
import Button from '@/components/UI/Button';

export default function ProfilePage() {
  const { user, setUser } = useGlobalContext();
  const { getToken } = useAuthToken();
  const router = useRouter();
  const navigate = useNavigateWithLoader();
  const [hostedRooms, setHostedRooms] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [totalAudience, setTotalAudience] = useState<number>(0);
  const [maxAudience, setMaxAudience] = useState<any>(null);
  const [autoAdsEnabled, setAutoAdsEnabled] = useState<boolean>(false);
  const [adsPrefLoading, setAdsPrefLoading] = useState<boolean>(false);
  const [adsPrefSaving, setAdsPrefSaving] = useState<boolean>(false);
  const adsPrefFetchedForRef = useRef<string | number | null>(null);

  // Platform icons mapping
  const platformIcons: { [key: string]: React.ReactNode } = {
    'x': <FaXTwitter className="w-4 h-4" />,
    'twitter': <FaXTwitter className="w-4 h-4" />,
  };

  // Platform URL mapping
  const platformUrls: { [key: string]: string } = {
    'x': 'https://x.com/',
    'twitter': 'https://twitter.com/',
  };

  const handleSocialClick = (platform: string, username: string) => {
    const baseUrl = platformUrls[platform.toLowerCase()];
    if (baseUrl) {
      window.open(`${baseUrl}${username}`, '_blank');
    }
  };

  const buildAuthHeaders = async () => {
    const env = process.env.NEXT_PUBLIC_ENV;
    if (env === 'DEV') {
      return { Authorization: 'Bearer dev' } as HeadersInit;
    }
    const tokenResponse = await getToken();
    if (!tokenResponse) {
      throw new Error('Missing auth token');
    }
    return {
      Authorization: `Bearer ${tokenResponse}`,
    } as HeadersInit;
  };

  useEffect(() => {
    if (!user) {
      adsPrefFetchedForRef.current = null;
      return;
    }
    setAutoAdsEnabled(Boolean(user.autoAdsEnabled));
    if (adsPrefFetchedForRef.current === user.privyId) return;
    adsPrefFetchedForRef.current = user.privyId;

    const loadPreference = async () => {
      try {
        setAdsPrefLoading(true);
        const headers = await buildAuthHeaders();
        const res = await fetch('/api/profile/ads-preference', {
          method: 'GET',
          headers,
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error('Failed to fetch ads preference');
        }
        const data = await res.json();
        const pref = Boolean(
          data.autoAdsEnabled ??
            data?.data?.autoAdsEnabled ??
            data?.data?.user?.autoAdsEnabled
        );
        setAutoAdsEnabled(pref);
        setUser((prev: any) => (prev ? { ...prev, autoAdsEnabled: pref } : prev));
      } catch (error) {
        console.error('Failed to load ads preference', error);
      } finally {
        setAdsPrefLoading(false);
      }
    };

    loadPreference();
  }, [user, setUser]);

  const handleToggleAdsPreference = async () => {
    if (!user) {
      toast.error('Please sign in to update preferences');
      return;
    }
    const nextValue = !autoAdsEnabled;
    setAutoAdsEnabled(nextValue);
    setAdsPrefSaving(true);
    try {
      const headers = await buildAuthHeaders();

      let token:any = null;

      if(process.env.NEXT_PUBLIC_ENV !== 'DEV'){
        const tokenResponse = await getToken();
        token = tokenResponse;
      }

      const res = await updateAdsPreference(nextValue, token);
     
      console.log('Ads preference update response:', res);
      if (!res.ok) {
        throw new Error('Failed to update preference');
      }
      
      const persisted = Boolean(
          res?.data?.autoAdsEnabled ??
          nextValue
      );
      setAutoAdsEnabled(persisted);
      setUser((prev: any) => (prev ? { ...prev, autoAdsEnabled: persisted } : prev));
      toast.success(`Auto ads ${persisted ? 'enabled' : 'disabled'} for new rooms`);
    } catch (error) {
      console.error('Failed to update ads preference', error);
      setAutoAdsEnabled(!nextValue);
      toast.error('Could not update ads preference');
    } finally {
      setAdsPrefSaving(false);
    }
  };

  useEffect(() => {
    if (user) {
      // Fetch hosted rooms details from API
      fetchUserRooms(user.username)
        .then(response => {
          if (response.ok) {
            // console.log('Fetched hosted rooms:', response.data.data);
            setHostedRooms(response.data.data.rooms || []);
            setTotalAudience(response.data.data.totalAudienceEngaged || 0);
            setMaxAudience(response.data.data.maxAudienceEngaged || 0);
          }
        });

      
        
    } else {
      setHostedRooms([]);
    }
  }, [user, router]);


  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-white mt-4">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <MainHeader/>
      <div className="min-h-screen pb-32">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
          
          <Card variant="ghost" className="bg-transparent pt-16 border-0">
            {/* Profile Picture and Refresh Button */}
            <Card variant="ghost" className="text-center p-4 relative flex items-center gap-4 justify-start">
              <div className="flex items-center justify-center">
                {user.pfp_url ? (
                  <img 
                    src={user.pfp_url} 
                    alt="Profile" 
                    className="w-24 h-24 rounded-full object-cover border-2 border-fireside-orange"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className='flex flex-col gap-2 items-start'>
                <p className="fire text-lg font-bold gradient-fire-text">
                  {user.username.slice(0,20) || 'Not set'}
                </p>
                {user.socials && Object.keys(user.socials).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(user.socials).map(([platform, username]) => (
                      <Button
                        key={platform}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSocialClick(platform, String(username))}
                        className="flex items-center space-x-2 bg-white text-fireside-orange"
                      >
                        <div className="flex items-center justify-center">
                          {platformIcons[platform.toLowerCase()] || (
                            <span className="text-xs font-medium text-gray-300 uppercase">
                              {platform.charAt(0)}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium">
                          @{String(username)}
                        </span>
                      </Button>
                    ))}
                  </div>
              )}
              </div>
              
              
              
            </Card>

            {/* Statistics Section */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-white mb-4">Statistics</h2>
              <div className="grid grid-cols-2 gap-3">
                {/* Total Hosted Rooms Card */}
                <Card variant="white" className="rounded-xl p-4 shadow-md hover:shadow-xl transition-shadow">
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="text-fireside-orange/80 text-xs font-medium mb-1 text-center">
                      Hosted Rooms
                    </p>
                    <p className="gradient-fire-text text-3xl font-bold">{hostedRooms?.length || 0}</p>
                  </div>
                </Card>

                {/* Total Audience Engaged Card */}
                <Card variant="orange" className="rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="text-white/80 text-xs font-medium mb-1 text-center">
                      Audience Engaged
                    </p>
                    <p className="text-white text-3xl font-bold">{totalAudience}</p>
                  </div>
                </Card>

                {/* Max Audience Engaged Card - Full Width */}
                <Card variant="ghost" className="col-span-2 rounded-xl p-4 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white/80 text-sm font-medium">
                        Max Audience Engaged
                      </p>
                      <p className="text-white text-2xl font-bold">{maxAudience?.participantCount || 0}</p>
                    </div>
                    {maxAudience && (
                      <Card variant="orange" onClick={()=>{navigate(`/recordings/${maxAudience.roomId}`)}} className='backdrop-blur-sm rounded-lg p-2'>
                        <h2 className='gradient-fire-text text-lg font-bold mb-1 text-white'>{maxAudience?.name}</h2>
                        <p className='text-xs text-white/70 font-semibold'>Hosted on {new Date(maxAudience?.startTime).toDateString()}</p>
                      </Card>
                    )}
                  </div>
                </Card>

                {/* <div className="col-span-2 bg-fireside-orange rounded-xl p-5 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/80 text-sm font-medium mb-0">
                        Total Earnings
                      </p>
                      <p className="text-white/60 text-xs mb-2">
                        Earnings from tips + ads
                      </p>
                    </div>
                    <p className="text-white text-2xl font-bold">$0</p>
                  </div>
                </div> */}
              </div>
            </div>

            {/* Previous Spaces Section */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-white mb-4">Hosted Firesides</h2>
              <div className="flex space-x-2 overflow-x-auto ">
                {hostedRooms.length === 0 ? (
                  <Card variant="ghost" className="w-full h-32 px-10 text-nowrap flex items-center justify-center text-gray-400">
                    No hosted firesides yet.
                  </Card>
                ) : (
                  hostedRooms.map((room, idx) => (
                    <Card
                      variant="ghost"
                      key={room._id || idx}
                      onClick={() => navigate(`/recordings/${room.roomId}`)}
                      className="w-[250px] relative flex-shrink-0 p-2 h-32 bg-fireside-orange/10 border-fireside-orange/20 flex flex-col justify-start text-white rounded-lg cursor-pointer hover:bg-fireside-orange/20 transition-colors"
                    >
                      <div className="font-bold text-lg mb-1">{room.name}</div>
                      <div className="text-xs text-gray-300 mb-1 truncate">{room.description.slice(0, 150)}</div>
                      <div className="text-xs text-fireside-orange mb-1">Tags: {room.topics?.join(', ')}</div>
                      <div className="absolute bottom-2 left-2 text-[0.6rem] text-fireside-orange px-2 py-1 font-bold rounded-full bg-white text mb-1">{room.participantCount} attended</div>
                      <div className="absolute bottom-2 right-2 text-[0.6rem] bg-fireside-orange px-2 py-1 font-bold rounded-full text-white mb-1">{new Date(room.startTime).toDateString()}</div>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Ads Preference */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-white mb-4">Monetization</h2>
              <Card variant="ghost" className="flex items-center justify-between p-4 bg-fireside-orange/10 border border-fireside-orange/30 rounded-xl">
                <div className="flex-1 pr-4 text-left">
                  <p className="text-white font-semibold">Automatically enable ads for new rooms</p>
                  <p className="text-white/70 text-sm">
                    Hosts who opt in will start serving ads once participant thresholds are met.
                  </p>
                </div>
                <button
                  onClick={handleToggleAdsPreference}
                  disabled={adsPrefLoading || adsPrefSaving}
                  className={`w-14 h-7 rounded-full p-1 flex items-center transition-colors ${autoAdsEnabled ? 'bg-fireside-orange' : 'bg-white/20'} ${adsPrefLoading || adsPrefSaving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${autoAdsEnabled ? 'translate-x-7' : 'translate-x-0'}`}
                  />
                </button>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 ">
              <div className="w-full">
                {/* <button
                  onClick={() => router.push('/')}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-md transition-colors"
                >
                  <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Explore Rooms
                </button> */}
                
                <Button
                  variant="default"
                  onClick={() => window.history.back()}
                  className="w-full"
                >
                  <IoIosArrowBack className="inline mr-2" />
                  Go Back
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <NavigationWrapper />
    </>
  );
}
