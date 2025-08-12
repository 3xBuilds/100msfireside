"use client";

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { PlusIcon, MagnifyingGlassIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { PlusIcon as PlusIconSolid, MagnifyingGlassIcon as MagnifyingGlassIconSolid, PhoneIcon as PhoneIconSolid } from '@heroicons/react/24/solid';
import CreateRoomModal from './CreateRoomModal';

export default function BottomNavigation() {
  const pathname = usePathname();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const navItems = [
    {
      name: 'Create Room',
      href: '#',
      icon: PlusIcon,
      iconSolid: PlusIconSolid,
      action: () => setIsCreateModalOpen(true),
    },
    {
      name: 'Explore',
      href: '/explore',
      icon: MagnifyingGlassIcon,
      iconSolid: MagnifyingGlassIconSolid,
    },
    {
      name: 'My Calls',
      href: '/my-calls',
      icon: PhoneIcon,
      iconSolid: PhoneIconSolid,
    },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb">
        <div className="flex justify-around items-center py-2 px-4">
          {navItems.map((item) => {
            const isActive = item.href !== '#' && pathname === item.href;
            const IconComponent = isActive ? item.iconSolid : item.icon;
            
            if (item.action) {
              return (
                <button
                  key={item.name}
                  onClick={item.action}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                    isActive
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
                  }`}
                >
                  <IconComponent className="h-6 w-6 mb-1" />
                  <span className="text-xs font-medium">{item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                  isActive
                    ? 'text-orange-600 bg-orange-50'
                    : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
                }`}
              >
                <IconComponent className="h-6 w-6 mb-1" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Add padding to body to account for fixed bottom navigation */}
      <style jsx global>{`
        body {
          padding-bottom: 80px;
        }
        .safe-area-pb {
          padding-bottom: env(safe-area-inset-bottom);
        }
      `}</style>
    </>
  );
}
