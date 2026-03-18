"use client";

import { useState } from 'react';
import { useGlobalContext } from '@/utils/providers/globalContext';
import { Card } from './UI/Card';
import Button from './UI/Button';

interface AdsPurchaseFormProps {
  handleETHPayment: (price:number, formData: FormData) => void;
  handleERC20Payment: (price:number, formData: FormData) => void;
  loading?: boolean;
}

export default function AdsPurchaseForm({ handleERC20Payment, handleETHPayment, loading = false }: AdsPurchaseFormProps) {
  const { user } = useGlobalContext();
  const [title, setTitle] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [rooms, setRooms] = useState<string>('1');
  const [minutes, setMinutes] = useState<string>('5');
  const [minParticipants, setMinParticipants] = useState<string>('1');
  const [price, setPrice] = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);

  const BASE_PRICE = 1; // Base price per room per minute per 10 participants in ETH

  const quotePrice = () => {
      const r = Number(rooms) || 0;
      const m = Number(minutes) || 0;
      const mp = Number(minParticipants) || 0;
      const priceCalc = r * m * (Math.floor(mp / 10) + 1) * BASE_PRICE;
      return priceCalc;
  };

  // Auto-calculate quote when inputs change
  const handleRoomsChange = (value: string) => {
    setRooms(value);
    const r = Number(value) || 0;
    const m = Number(minutes) || 0;
    const mp = Number(minParticipants) || 0;
    if (r > 0 && m > 0 && mp > 0) {
      const calculatedPrice = r * m * (Math.floor(mp / 10) + 1) * BASE_PRICE;
      setPrice(calculatedPrice);
    } else {
      setPrice(null);
    }
  };

  const handleMinutesChange = (value: string) => {
    setMinutes(value);
    const r = Number(rooms) || 0;
    const m = Number(value) || 0;
    const mp = Number(minParticipants) || 0;
    if (r > 0 && m > 0 && mp > 0) {
      const calculatedPrice = r * m * (Math.floor(mp / 10) + 1) * BASE_PRICE;
      setPrice(calculatedPrice);
    } else {
      setPrice(null);
    }
  };

  const handleMinParticipantsChange = (value: string) => {
    setMinParticipants(value);
    const r = Number(rooms) || 0;
    const m = Number(minutes) || 0;
    const mp = Number(value) || 0;
    if (r > 0 && m > 0 && mp > 0) {
      const calculatedPrice = r * m * (Math.floor(mp / 10) + 1) * BASE_PRICE;
      setPrice(calculatedPrice);
    } else {
      setPrice(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
    }
  };

  const handleSubmit = (paymentMethod: 'ETH' | 'USDC') => {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('rooms', rooms);
    formData.append('minutes', minutes);
    formData.append('minParticipants', minParticipants);
    formData.append('paymentMethod', paymentMethod);
    if (selectedImage) {
      formData.append('image', selectedImage);
    }

    const price = quotePrice();
    
    if(paymentMethod === 'USDC') {
      handleERC20Payment(price, formData);
    }
    else if (paymentMethod === 'ETH') {
      handleETHPayment(price, formData);
    }
  };

  const isFormValid = title && selectedImage && Number(rooms) > 0 && Number(minutes) > 0 && Number(minParticipants) > 0;

  return (
    <div className="min-h-screen flex items-start justify-center p-4 pb-32">
      <div className="p-1">
        <h1 className="gradient-fire-text text-2xl font-bold">Start Sponsoring</h1>
        <h2 className='mb-4 text-sm text-gray-400'>Make your banner pop up on the very next Fireside!</h2>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="ad-title" className="text-gray-300 text-sm block mb-2">Title</label>
            <input 
              id="ad-title"
              type="text"
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="Your ad title" 
              className="w-full px-4 py-3 text-base rounded-md bg-white/5 text-white border border-white/10 focus:border-fireside-orange focus:outline-none focus:ring-2 focus:ring-fireside-orange/50 transition-all" 
              required
            />
          </div>
          
          <div>
            <label htmlFor="ad-image" className="text-gray-300 text-sm block mb-2">Image</label>
            <input 
              id="ad-image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-4 py-3 text-base rounded-md bg-white/5 text-white border border-white/10 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-fireside-orange file:text-white hover:file:bg-orange-600 file:cursor-pointer cursor-pointer focus:border-fireside-orange focus:outline-none focus:ring-2 focus:ring-fireside-orange/50 transition-all"
              required
            />
            {selectedImage && (
              <div className="mt-2">
                <img 
                  src={URL.createObjectURL(selectedImage)} 
                  alt="Preview" 
                  className="w-full aspect-[5/1] object-cover rounded border border-white/10"
                />
                <p className="text-gray-400 text-xs mt-1">{selectedImage.name}</p>
              </div>
            )}
            <p className="text-gray-400 text-xs mt-1">Upload a 1500x300 image for best visibility</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ad-rooms" className="text-gray-300 text-sm block mb-2">Number of Firesides</label>
              <input 
                id="ad-rooms"
                type="number" 
                inputMode="numeric"
                value={rooms} 
                onChange={e => handleRoomsChange(e.target.value)} 
                placeholder="1"
                className="w-full px-4 py-3 text-base rounded-md bg-white/5 text-white border border-white/10 focus:border-fireside-orange focus:outline-none focus:ring-2 focus:ring-fireside-orange/50 transition-all" 
                required
              />
            </div>
            <div>
              <label htmlFor="ad-minutes" className="text-gray-300 text-sm block mb-2">Minutes each Fireside</label>
              <input 
                id="ad-minutes"
                type="number" 
                inputMode="numeric"
                value={minutes} 
                onChange={e => handleMinutesChange(e.target.value)} 
                placeholder="5"
                className="w-full px-4 py-3 text-base rounded-md bg-white/5 text-white border border-white/10 focus:border-fireside-orange focus:outline-none focus:ring-2 focus:ring-fireside-orange/50 transition-all" 
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="ad-participants" className="text-gray-300 text-sm block mb-2">Minimum participants</label>
            <input
              id="ad-participants"
              type="number"
              inputMode="numeric"
              value={minParticipants}
              onChange={e => handleMinParticipantsChange(e.target.value)}
              placeholder="1"
              className="w-full px-4 py-3 text-base rounded-md bg-white/5 text-white border border-white/10 focus:border-fireside-orange focus:outline-none focus:ring-2 focus:ring-fireside-orange/50 transition-all"
              required
            />
            <p className="text-gray-400 text-xs mt-2">Ads will begin automatically once a room meets this audience size.</p>
          </div>

          {price !== null && (
            <div className="bg-fireside-orange/10 border border-fireside-orange/30 rounded-md p-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-medium">Estimated Price:</span>
                <span className="text-fireside-orange text-xl font-bold">${price.toFixed(4)}</span>
              </div>
            </div>
          )}
        
          <div className="grid grid-cols-1 gap-3 pt-2">
            {/* <Button 
              variant='action'
              type="button"
              onClick={() => handleSubmit('ETH')} 
              disabled={loading || !isFormValid} 
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : 'Pay with ETH'}
            </Button> */}
            <Button
            variant='action' 
              type="button"
              onClick={() => handleSubmit('USDC')} 
              disabled={loading || !isFormValid} 
              className="bg-fireside-orange hover:bg-orange-600 active:bg-orange-700 text-white px-4 py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : 'Pay with USDC'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}