import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

app.get('/', (req, res) => {
  res.send('SyncTube Server is running perfectly!');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

interface User {
  id: string;
  username: string;
  roomId: string;
}

interface Room {
  id: string;
  videoId: string;
  state: string; // 'playing', 'paused', 'buffering'
  currentTime: number;
  lastUpdateTime: number;
}

const rooms: Record<string, Room> = {};
const users: Record<string, User> = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    
    users[socket.id] = { id: socket.id, username, roomId };
    
    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        videoId: 'aqz-KE-bpKQ', // Default video (Big Buck Bunny or some lo-fi)
        state: 'paused',
        currentTime: 0,
        lastUpdateTime: Date.now()
      };
    }
    
    // Broadcast to room that someone joined
    socket.to(roomId).emit('user-joined', { username });
    
    // Send current room state to the newly joined user
    socket.emit('room-data', rooms[roomId]);
    
    // Send updated user list
    const roomUsers = Object.values(users).filter(u => u.roomId === roomId);
    io.to(roomId).emit('users-update', roomUsers);
  });

  socket.on('play', ({ currentTime }) => {
    const user = users[socket.id];
    if (user) {
      const room = rooms[user.roomId];
      if (room) {
        room.state = 'playing';
        room.currentTime = currentTime;
        room.lastUpdateTime = Date.now();
        socket.to(user.roomId).emit('play', { currentTime });
      }
    }
  });

  socket.on('pause', ({ currentTime }) => {
    const user = users[socket.id];
    if (user) {
      const room = rooms[user.roomId];
      if (room) {
        room.state = 'paused';
        room.currentTime = currentTime;
        room.lastUpdateTime = Date.now();
        socket.to(user.roomId).emit('pause', { currentTime });
      }
    }
  });

  socket.on('seek', ({ currentTime }) => {
    const user = users[socket.id];
    if (user) {
      const room = rooms[user.roomId];
      if (room) {
        room.currentTime = currentTime;
        room.lastUpdateTime = Date.now();
        socket.to(user.roomId).emit('seek', { currentTime });
      }
    }
  });

  socket.on('change-video', ({ videoId }) => {
    const user = users[socket.id];
    if (user) {
      const room = rooms[user.roomId];
      if (room) {
        room.videoId = videoId;
        room.state = 'paused';
        room.currentTime = 0;
        room.lastUpdateTime = Date.now();
        io.to(user.roomId).emit('change-video', { videoId });
      }
    }
  });

  socket.on('sync-time', ({ currentTime }) => {
    const user = users[socket.id];
    if (user) {
      const room = rooms[user.roomId];
      if (room) {
         // Optionally track and sync time. Client can periodically broadcast current time to others if they get out of sync,
         // but usually keeping the room state updated is enough.
         room.currentTime = currentTime;
         room.lastUpdateTime = Date.now();
      }
    }
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.roomId).emit('user-left', { username: user.username });
      delete users[socket.id];
      
      const roomUsers = Object.values(users).filter(u => u.roomId === user.roomId);
      io.to(user.roomId).emit('users-update', roomUsers);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
