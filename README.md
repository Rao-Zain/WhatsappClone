# HexaChat — WhatsApp Clone (MERN)

A full-stack real-time messaging app with one-to-one and group chats,
audio/video calling, and a chat-request system.

**Live demo:** https://hexachat.hexalogicx.com/

## Screenshots
<img width="414" height="825" alt="image" src="https://github.com/user-attachments/assets/83b303a6-d5c1-49e0-8ee9-e4823cf76dc1" />
<img width="1453" height="903" alt="image" src="https://github.com/user-attachments/assets/e96efa00-4be4-40c2-8b9b-86452dc580ea" />
<img width="1919" height="891" alt="image" src="https://github.com/user-attachments/assets/8487f26b-a96c-4c6b-b97c-078b226b2344" />
<img width="1468" height="917" alt="image" src="https://github.com/user-attachments/assets/398ea3b4-289e-4b5b-9b58-938c82063b80" />
<img width="468" height="806" alt="image" src="https://github.com/user-attachments/assets/a4e85ad5-4fc9-43d0-86f7-1ac2a3494447" />
<img width="460" height="666" alt="image" src="https://github.com/user-attachments/assets/33c8e552-a8f0-4416-9aac-2755fb2c92e9" />


## Features
- Real-time messaging with Socket.IO: online status, typing indicators, read receipts
- One-to-one and group audio/video calls (WebRTC with Socket.IO signaling)
- Group chats with group management
- Chat requests: a user must send a request first, and chatting is enabled
  only if the recipient accepts (otherwise the sender is blocked)
- Replies, reactions, forwarding, starring, and message deletion
- Image and document sharing with file uploads
- JWT authentication with email OTP verification
- Responsive UI for desktop and mobile

## Tech Stack
MongoDB, Express.js, React.js, Node.js, Socket.IO, WebRTC, JWT

## Getting Started
1. Clone the repo and run `npm install` in the client and server folders
2. Create a `.env` file in the server folder (see `.env.example`)
3. Start the server and the client with `npm run dev`

## Architecture notes
- **Signaling:** WebRTC offers/answers/ICE candidates are exchanged over Socket.IO.
- **Connectivity:** STUN for discovery, plus a TURN relay for users behind
  restrictive NATs/firewalls, which fixed intermittent call failures.
- **Group calls:** (describe: mesh or SFU, and how many participants it supports)
- **Chat requests:** stored in the ChatRequest collection and enforced on
  the server, so a blocked or unaccepted sender cannot message.

## Author
Muhammad Zain Ul Abideen — github.com/Rao-Zain
