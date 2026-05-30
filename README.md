# WebRTC Video Chat Application

This is a production-ready multi-peer video chat application built with Next.js, WebRTC, Socket.IO, and Tailwind CSS. It supports dynamic room creation, peer-to-peer audio/video streaming, text chat, and a mesh topology for up to 4 participants.

## Features
- **Next.js & TypeScript**: A modern, type-safe frontend and API structure.
- **WebRTC**: Real-time peer-to-peer video and audio communication.
- **Socket.IO**: Reliable WebSocket signaling server running alongside Next.js.
- **Mesh Topology**: Direct P2P connection among multiple participants in a room.
- **Call Controls**: Mute microphone, disable camera, hang up.
- **Text Chat**: Real-time messaging within rooms.
- **Dockerized**: Fully containerized for easy deployment.

## Prerequisites
- Docker and Docker Compose
- Node.js (for local development)

## Setup and Running

1. **Environment Variables**: The project includes a `.env.example`. It uses Google's public STUN server.
2. **Run with Docker Compose**:
   ```bash
   docker-compose up --build -d
   ```
3. **Access the application**: Open `http://localhost:3000` in your browser.

## Testing Multi-Peer Call Locally
1. Ensure the app is running either via Docker or `npm run dev`.
2. Open `http://localhost:3000` in your browser.
3. Click "Start a Meeting" to create a new dynamic room.
4. Copy the URL from your address bar and open it in 2-3 additional browser tabs or separate windows.
5. Grant camera and microphone permissions in each tab.
6. The app will automatically establish WebRTC peer-to-peer connections (Mesh topology) and display all video streams in a grid.
7. Test text chat by typing a message and clicking the send button—messages will broadcast via WebSockets.

## Architecture & Signaling Flow
- **Frontend**: Built with Next.js App Router and React hooks to manage complex peer-to-peer connections and media states.
- **Signaling Server**: A custom `server.ts` entry point initializes an HTTP server sharing the same port for Next.js routing and a Socket.IO instance for WebRTC signaling.
- **WebRTC Mesh Topology**: The client maintains a `Map` of `RTCPeerConnection`s keyed by each peer's socket ID.
- **Signaling Events**:
  - `join-room`: Sent by the client to join a specific UUID-based room.
  - `user-connected`: Broadcasted to existing peers to trigger an `offer`.
  - `offer` / `answer`: Standard SDP exchange payload.
  - `ice-candidate`: Exchanged asynchronously for Trickle ICE.
  - `chat-message`: Broadcasts text messages within the room.
  - `disconnect`: Server notifies remaining peers to clean up and remove the video element.
- **NAT Traversal**: Configured to use a public STUN server (`stun.l.google.com:19302`) to resolve ICE candidates for peer connectivity.

---
**Signed by:** nnssprasad
