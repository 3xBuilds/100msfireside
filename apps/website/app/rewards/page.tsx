"use client";

import { RewardsHistory } from '@/components/RewardsHistory';
import Header from '@/components/Header';

export default function RewardsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">🎁 Rewards</h1>
          <p className="text-gray-400">
            Earn FIRE tokens for daily logins, hosting rooms, and achieving milestones
          </p>
        </div>

        <div className="mb-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">How to Earn Rewards</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <p className="font-medium">Daily Login</p>
                <p className="text-sm text-gray-400">
                  Claim tokens every 24 hours just for logging in
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎤</span>
              <div>
                <p className="font-medium">Host Rooms</p>
                <p className="text-sm text-gray-400">
                  Earn base rewards for hosting fireside chats
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <p className="font-medium">Participant Milestones</p>
                <p className="text-sm text-gray-400">
                  Earn bonus rewards when your room reaches 10, 50, 100, or 250+ participants
                </p>
              </div>
            </div>
          </div>
        </div>

        <RewardsHistory />
      </main>
    </div>
  );
}
