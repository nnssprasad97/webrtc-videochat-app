'use client';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RoomClient({ roomId }: { roomId: string }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ [id: string]: RTCPeerConnection }>({});
  const [remoteStreams, setRemoteStreams] = useState<{ [id: string]: MediaStream }>({});
  const [chatMessages, setChatMessages] = useState<{ sender: string, text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const socketRef = useRef<Socket>();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const initRef = useRef(false);

  // Status mapping
  const numPeers = Object.keys(remoteStreams).length;
  let status = 'waiting';
  if (numPeers > 0) status = 'connected';
  else if (Object.keys(peers).length > 0) status = 'connecting';

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // 1. Get User Media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = currentStream;
        }

        // 2. Connect to Socket.IO
        const socket = io('/', { path: '/socket.io' });
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('join-room', roomId);
        });

        socket.on('user-connected', (userId: string) => {
          // A new user joined, initiate call
          createOffer(userId, currentStream, socket);
        });

        socket.on('offer', async (payload: { target: string, caller: string, sdp: RTCSessionDescriptionInit }) => {
          await handleOffer(payload, currentStream, socket);
        });

        socket.on('answer', async (payload: { target: string, caller: string, sdp: RTCSessionDescriptionInit }) => {
          await handleAnswer(payload);
        });

        socket.on('ice-candidate', async (payload: { target: string, caller: string, candidate: RTCIceCandidateInit | null }) => {
          await handleIceCandidate(payload);
        });

        socket.on('user-disconnected', (userId: string) => {
          removePeer(userId);
        });

        socket.on('chat-message', (payload: { sender: string, text: string }) => {
          setChatMessages((prev) => [...prev, payload]);
        });
      })
      .catch(err => {
        console.error("Failed to get local stream", err);
      });

      return () => {
        // Cleanup
        if (socketRef.current) socketRef.current.disconnect();
        setPeers(prevPeers => {
          Object.values(prevPeers).forEach(pc => pc.close());
          return {};
        });
        setRemoteStreams({});
        setStream(prevStream => {
          if (prevStream) {
            prevStream.getTracks().forEach(track => track.stop());
          }
          return null;
        });
      };
  }, [roomId]);

  // WebRTC Functions
  const stunServers = {
    iceServers: [
      { urls: process.env.NEXT_PUBLIC_STUN_SERVER || 'stun:stun.l.google.com:19302' }
    ]
  };

  const createPeerConnection = (userId: string, currentStream: MediaStream, socket: Socket) => {
    const pc = new RTCPeerConnection(stunServers);

    currentStream.getTracks().forEach(track => {
      pc.addTrack(track, currentStream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          target: userId,
          caller: socket.id,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [userId]: event.streams[0]
      }));
    };

    setPeers(prev => ({ ...prev, [userId]: pc }));
    return pc;
  };

  const createOffer = async (userId: string, currentStream: MediaStream, socket: Socket) => {
    const pc = createPeerConnection(userId, currentStream, socket);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', {
      target: userId,
      caller: socket.id,
      sdp: pc.localDescription
    });
  };

  const handleOffer = async (payload: { target: string, caller: string, sdp: RTCSessionDescriptionInit }, currentStream: MediaStream, socket: Socket) => {
    const pc = createPeerConnection(payload.caller, currentStream, socket);
    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', {
      target: payload.caller,
      caller: socket.id,
      sdp: pc.localDescription
    });
  };

  const handleAnswer = async (payload: { target: string, caller: string, sdp: RTCSessionDescriptionInit }) => {
    setPeers(prev => {
      const pc = prev[payload.caller];
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      }
      return prev;
    });
  };

  const handleIceCandidate = async (payload: { target: string, caller: string, candidate: RTCIceCandidateInit | null }) => {
    setPeers(prev => {
      const pc = prev[payload.caller];
      if (pc && payload.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(e => console.error(e));
      }
      return prev;
    });
  };

  const removePeer = (userId: string) => {
    setPeers(prev => {
      const newPeers = { ...prev };
      if (newPeers[userId]) {
        newPeers[userId].close();
        delete newPeers[userId];
      }
      return newPeers;
    });
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[userId];
      return newStreams;
    });
  };

  // Controls
  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const hangUp = () => {
    if (socketRef.current) socketRef.current.disconnect();
    setPeers(prevPeers => {
      Object.values(prevPeers).forEach(pc => pc.close());
      return {};
    });
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    router.push('/');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && socketRef.current) {
      socketRef.current.emit('chat-message', { text: chatInput });
      setChatInput('');
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-neutral-900 text-white">
      {/* Video Area */}
      <div className="flex-1 flex flex-col p-4 relative">
        <div className="absolute top-4 left-4 z-10 bg-black/50 px-4 py-2 rounded-lg backdrop-blur text-sm font-medium">
          {status === 'waiting' && <span data-test-id="status-waiting">Waiting for others...</span>}
          {status === 'connecting' && <span data-test-id="status-connecting">Connecting...</span>}
          {status === 'connected' && <span data-test-id="status-connected">Connected</span>}
        </div>

        <div 
          className="flex-1 grid gap-4 p-4 items-center justify-center min-h-0" 
          style={{ gridTemplateColumns: numPeers > 1 ? 'repeat(2, minmax(0, 1fr))' : '1fr' }}
          data-test-id="remote-video-container"
        >
          {Object.entries(remoteStreams).map(([id, remoteStream]) => (
            <VideoPlayer key={id} stream={remoteStream} />
          ))}
          {numPeers === 0 && (
             <div className="flex flex-col items-center justify-center text-neutral-500 w-full h-full border-2 border-dashed border-neutral-700 rounded-2xl">
               <Video size={48} className="mb-4 opacity-50" />
               <p>No one else is here yet.</p>
               <p className="text-sm">Share the URL to invite others.</p>
             </div>
          )}
        </div>

        {/* Local Video PIP */}
        <div className="absolute bottom-24 right-8 w-48 aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-neutral-800">
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover scale-x-[-1]"
            data-test-id="local-video"
          />
          {(isMuted || isVideoOff) && (
            <div className="absolute bottom-2 left-2 flex gap-1">
              {isMuted && <div className="bg-red-500 p-1 rounded"><MicOff size={12} /></div>}
              {isVideoOff && <div className="bg-red-500 p-1 rounded"><VideoOff size={12} /></div>}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="h-20 flex items-center justify-center gap-4 bg-neutral-800/80 rounded-2xl backdrop-blur-sm mx-auto px-8 w-fit shrink-0">
          <button 
            onClick={toggleMute} 
            data-test-id="mute-mic-button"
            className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-neutral-600 hover:bg-neutral-500'}`}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          
          <button 
            onClick={toggleVideo} 
            data-test-id="toggle-camera-button"
            className={`p-4 rounded-full transition-colors ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-neutral-600 hover:bg-neutral-500'}`}
          >
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>

          <button 
            onClick={hangUp} 
            data-test-id="hangup-button"
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors ml-4"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-full md:w-80 bg-neutral-950 border-l border-neutral-800 flex flex-col">
        <div className="p-4 border-b border-neutral-800 font-semibold flex items-center justify-between">
          <span>Room Chat</span>
          <span className="text-xs bg-neutral-800 px-2 py-1 rounded text-neutral-400 font-mono">{roomId.slice(0, 8)}...</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4" data-test-id="chat-log">
          {chatMessages.map((msg, i) => {
            const isMe = socketRef.current?.id === msg.sender;
            return (
              <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`} data-test-id="chat-message">
                <span className="text-[10px] text-neutral-500 mb-1 px-1">
                  {isMe ? 'You' : `Peer ${msg.sender.slice(0, 4)}`}
                </span>
                <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm ${isMe ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-neutral-800 text-neutral-200 rounded-tl-sm'}`}>
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSendChat} className="p-4 border-t border-neutral-800 flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            data-test-id="chat-input"
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
          />
          <button 
            type="submit" 
            data-test-id="chat-submit"
            className="p-2 rounded-full bg-emerald-600 hover:bg-emerald-500 transition-colors shrink-0 disabled:opacity-50"
            disabled={!chatInput.trim()}
          >
            <Send size={18} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}

// Helper Component for Remote Video
function VideoPlayer({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden bg-black shadow-lg relative border border-neutral-800 group">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
    </div>
  );
}
