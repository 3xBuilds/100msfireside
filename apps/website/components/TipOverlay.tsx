'use client';

import { useState, useEffect } from 'react';
import { useTipEvent } from '@/utils/events';
import { motion, AnimatePresence } from 'framer-motion';
import { useTipNotificationContext } from '@/contexts/TipNotificationContext';

interface TipNotification {
  id: string;
  tipper: {
    username: string;
    pfp_url: string;
  };
  recipients: Array<{
    username?: string;
    role?: string;
  }>;
  amount: {
    usd: number;
    currency: string;
    native: number;
  };
  timestamp: string;
}

interface Particle {
  id: number;
  x: number;
  delay: number;
  duration: number;
}

export default function TipOverlay() {
  const [notifications, setNotifications] = useState<TipNotification[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const { notifications: contextNotifications } = useTipNotificationContext();

  // Handle notifications from context (local tips from tipper)
  useEffect(() => {
    contextNotifications.forEach((contextNotif) => {
      // Check if we already have this notification to avoid duplicates
      setNotifications((prev) => {
        const exists = prev.some((n) => n.id === contextNotif.id);
        if (exists) return prev;
        
        // Add the notification
        const newNotifications = [...prev, contextNotif];

        // Create particles for the tip
        if (contextNotif.amount.currency === 'ETH' || contextNotif.amount.currency === 'USDC' || contextNotif.amount.currency === 'FIRE') {
          const particleCount = Math.min(50, Math.max(5, Math.floor(contextNotif.amount.usd * 5)));
          
          const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => ({
            id: Date.now() + i,
            x: Math.random() * 100,
            delay: Math.random() * 0.5,
            duration: 5 + Math.random() * 3,
          }));
          setParticles((prevParticles) => [...prevParticles, ...newParticles]);

          setTimeout(() => {
            setParticles((prevParticles) => prevParticles.filter((p) => !newParticles.find((np) => np.id === p.id)));
          }, 5000);
        }

        // Remove the notification after 5 seconds
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== contextNotif.id));
        }, 5000);

        return newNotifications;
      });
    });
  }, [contextNotifications]);

  // Handle notifications from HMS events (tips from others)
  useTipEvent((data: any) => {
    const notification: TipNotification = {
      id: `${Date.now()}-${Math.random()}`,
      tipper: data.tipper,
      recipients: data.recipients,
      amount: data.amount,
      timestamp: data.timestamp,
    };

    setNotifications((prev) => [...prev, notification]);

    // Create particles based on currency
    if (data.amount.currency === 'ETH' || data.amount.currency === 'USDC' || data.amount.currency === 'FIRE') {
      // Calculate particle count based on tip amount (min 10, max 150)
      const particleCount = Math.min(50, Math.max(5, Math.floor(data.amount.usd * 5)));
      
      const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 5 + Math.random() * 3,
      }));
      setParticles((prev) => [...prev, ...newParticles]);

      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
      }, 5000);
    }

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    }, 5000);
  });

  const getRecipientText = (recipients: TipNotification['recipients']) => {
    if (recipients.length === 0) return 'someone';
    if (recipients[0].username) {
      return recipients.map((r) => r.username).join(', ');
    }
    if (recipients[0].role) {
      return recipients.map((r) => r.role === 'host' ? r.role : `${r.role}s`).join(', ');
    }
    return 'someone';
  };

  const getCurrencyIcon = (currency: string, amount: number) => {
    // Special emojis based on tip amount
    if (amount > 100) {
      return '💎'; // Diamond for tips over $100
    }
    if (amount > 50) {
      return '🎆'; // Fireworks for tips over $50
    }
    if (amount > 25) {
      return '🍾'; // Champagne for tips over $25
    }
    
    // Default currency-based emojis
    switch (currency) {
      case 'FIRE':
        return '🔥';
      default:
        return '💵';
    }
  };

  const getCurrencyGradient = (currency: string) => {
    switch (currency) {
      case 'ETH':
        return 'gradient-indigo-bg border-fireside-indigo/30';
      case 'USDC':
        return 'gradient-blue-bg border-fireside-blue/30';
      case 'FIRE':
        return 'gradient-orange-bg border-fireside-orange/30';
      default:
        return 'gradient-green-bg border-fireside-green/30';
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Particles */}
      <AnimatePresence>
        {particles.map((particle) => {
          const currency = notifications[notifications.length - 1]?.amount.currency || 'ETH';
          const amount = notifications[notifications.length - 1]?.amount.usd || 0;
          const icon = getCurrencyIcon(currency, amount);
          
          return (
            <motion.div
              key={particle.id}
              className="absolute text-2xl"
              initial={{ y: -50, opacity: 0.7, rotate: 0 }}
              animate={{ y: '100vh', opacity: 0, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                ease: 'easeIn',
              }}
              style={{
                left: `${particle.x}%`,
              }}
            >
              {icon}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Notifications */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center">
        <AnimatePresence>
          {notifications.map((notification, index) => (
            <motion.div
              key={notification.id}
              className={`${getCurrencyGradient(notification.amount.currency)} border-[1px] rounded-full px-4 py-2 shadow-lg backdrop-blur-sm`}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{
                duration: 0.3,
                delay: index * 0.1,
                ease: 'easeInOut',
              }}
            >
              <p className="text-white text-xs font-medium whitespace-nowrap">
                {notification.tipper.username} tipped {getRecipientText(notification.recipients)} ${notification.amount.usd.toFixed(2)} in {notification.amount.currency}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}