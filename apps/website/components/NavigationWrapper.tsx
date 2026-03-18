'use client'

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

export default function NavigationWrapper() {
  const pathname = usePathname();
  
  // Don't show navigation on call pages
  if (pathname?.startsWith('/call/')) {
    return null;
  }
  
  return <Navigation />;
}
