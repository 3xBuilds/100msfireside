'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface TipNotification {
  id: string;
  tipper: {
    username: string;
    pfp_url: string;
  };
  recipients: Array<{
    username?: string;
    role?: string;
    pfp_url?: string;
    id?: string;
  }>;
  amount: {
    usd: number;
    currency: string;
    native: number;
  };
  timestamp: string;
}

interface TipNotificationContextType {
  addTipNotification: (notification: Omit<TipNotification, 'id'>) => void;
  notifications: TipNotification[];
  removeNotification: (id: string) => void;
}

const TipNotificationContext = createContext<TipNotificationContextType | undefined>(undefined);

export function TipNotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<TipNotification[]>([]);

  const addTipNotification = useCallback((notification: Omit<TipNotification, 'id'>) => {
    const newNotification: TipNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random()}`,
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== newNotification.id));
    }, 5000);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <TipNotificationContext.Provider value={{ addTipNotification, notifications, removeNotification }}>
      {children}
    </TipNotificationContext.Provider>
  );
}

export function useTipNotificationContext() {
  const context = useContext(TipNotificationContext);
  if (context === undefined) {
    throw new Error('useTipNotificationContext must be used within a TipNotificationProvider');
  }
  return context;
}
