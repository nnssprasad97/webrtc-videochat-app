'use client';

import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';
import { Video } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  const handleCreateRoom = () => {
    const roomId = uuidv4();
    router.push(`/room/${roomId}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-slate-100 p-24">
      <div className="z-10 max-w-5xl w-full flex-col items-center justify-center font-sans text-sm flex gap-8">
        <Video size={80} className="text-emerald-500 mb-4 drop-shadow-lg" />
        <h1 className="text-5xl font-extrabold tracking-tight text-white drop-shadow-md">
          WebRTC Video Chat
        </h1>
        <p className="text-center text-xl text-slate-400 max-w-lg leading-relaxed">
          Create a secure, peer-to-peer video chat room. Share the room link to invite up to 3 others.
        </p>
        
        <button
          onClick={handleCreateRoom}
          className="group rounded-full border border-transparent px-8 py-4 transition-all bg-emerald-600 hover:bg-emerald-500 hover:scale-105 text-white font-semibold text-xl flex items-center gap-3 shadow-lg hover:shadow-emerald-500/25"
        >
          <Video size={24} />
          Start a Meeting
        </button>
      </div>
    </main>
  );
}
