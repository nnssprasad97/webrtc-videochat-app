import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join-room', (roomId: string) => {
      socket.join(roomId);
      // Broadcast to others in the room that a user has connected
      socket.to(roomId).emit('user-connected', socket.id);

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        socket.to(roomId).emit('user-disconnected', socket.id);
      });

      // WebRTC Signaling: relay offer, answer, and ice-candidate
      socket.on('offer', (payload: { target: string, caller: string, sdp: RTCSessionDescriptionInit }) => {
        io.to(payload.target).emit('offer', payload);
      });

      socket.on('answer', (payload: { target: string, caller: string, sdp: RTCSessionDescriptionInit }) => {
        io.to(payload.target).emit('answer', payload);
      });

      socket.on('ice-candidate', (payload: { target: string, caller: string, candidate: RTCIceCandidateInit | null }) => {
        io.to(payload.target).emit('ice-candidate', payload);
      });

      // Text Chat
      socket.on('chat-message', (payload: { text: string }) => {
        // Send back to the room, including the sender
        io.to(roomId).emit('chat-message', { sender: socket.id, text: payload.text });
      });
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
