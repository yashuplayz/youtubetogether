import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import YouTube from 'react-youtube';
import { Play, Link as LinkIcon, Users, LogOut, Video } from 'lucide-react';
import './index.css';

// Using local network or standard host. Change this for production!
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface User {
  id: string;
  username: string;
  roomId: string;
}

interface RoomData {
  id: string;
  videoId: string;
  state: string;
  currentTime: number;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [users, setUsers] = useState<User[]>([]);

  const [videoId, setVideoId] = useState('aqz-KE-bpKQ');
  const [videoInput, setVideoInput] = useState('');

  const playerRef = useRef<any>(null);
  const isExternalChange = useRef(false);

  useEffect(() => {
    // Check URL to see if it's a direct join link
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, []);

  useEffect(() => {
    if (!isJoined || !socket) return;

    socket.on('room-data', (data: RoomData) => {
      setVideoId(data.videoId);
      if (playerRef.current) {
        if (data.state === 'playing') {
          isExternalChange.current = true;
          playerRef.current.seekTo(data.currentTime);
          playerRef.current.playVideo();
        } else {
          isExternalChange.current = true;
          playerRef.current.seekTo(data.currentTime);
          playerRef.current.pauseVideo();
        }
      }
    });

    socket.on('users-update', (newUsers: User[]) => {
      setUsers(newUsers);
    });

    socket.on('play', ({ currentTime }) => {
      if (playerRef.current) {
        isExternalChange.current = true;
        playerRef.current.seekTo(currentTime);
        playerRef.current.playVideo();
      }
    });

    socket.on('pause', ({ currentTime }) => {
      if (playerRef.current) {
        isExternalChange.current = true;
        playerRef.current.seekTo(currentTime);
        playerRef.current.pauseVideo();
      }
    });

    socket.on('seek', ({ currentTime }) => {
      if (playerRef.current) {
        isExternalChange.current = true;
        playerRef.current.seekTo(currentTime);
      }
    });

    socket.on('change-video', ({ videoId }) => {
      setVideoId(videoId);
    });

    return () => {
      socket.off('room-data');
      socket.off('users-update');
      socket.off('play');
      socket.off('pause');
      socket.off('seek');
      socket.off('change-video');
    };
  }, [isJoined, socket]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomId.trim()) return;

    const newSocket = io(SOCKET_URL);

    newSocket.on('connect', () => {
      newSocket.emit('join-room', { roomId, username });
      setSocket(newSocket);
      setIsJoined(true);
      window.history.pushState({}, '', `?room=${roomId}`);
    });
  };

  const extractVideoId = (urlOrId: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = urlOrId.match(regExp);
    return (match && match[2].length === 11) ? match[2] : urlOrId;
  };

  const handleChangeVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoInput.trim() || !socket) return;

    const newVideoId = extractVideoId(videoInput);
    if (newVideoId.length === 11) {
      socket.emit('change-video', { videoId: newVideoId });
    }
    setVideoInput('');
  };

  const onPlayerReady = (event: any) => {
    playerRef.current = event.target;
  };

  const onStateChange = (event: any) => {
    if (!socket || !playerRef.current) return;

    const currentTime = playerRef.current.getCurrentTime();

    // YouTube Player States:
    // -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)

    if (isExternalChange.current) {
      // If it's starting to play or pause because of an external event, reset the block flag
      if (event.data === 1 || event.data === 2) {
        // Keep it true for buffering, but false after taking action
        setTimeout(() => { isExternalChange.current = false; }, 500);
      }
      return;
    }

    if (event.data === 1) { // Playing
      socket.emit('play', { currentTime });
    } else if (event.data === 2) { // Paused
      socket.emit('pause', { currentTime });
    } else if (event.data === 3) { // Buffering (acting like seek)
      socket.emit('seek', { currentTime });
    }
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Room link copied to clipboard!');
  };

  if (!isJoined) {
    return (
      <div className="app-container">
        <div className="login-screen">
          <div className="glass-panel">
            <h1>Greshhhhhhhhh</h1>
            <p>Watch YouTube together from anywhere.</p>
            <form onSubmit={handleJoin}>
              <div className="input-group">
                <label htmlFor="username">Your Name is it Greehma ?</label>
                <input
                  id="username"
                  type="text"
                  className="input-field"
                  placeholder="e.g. John Doe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label htmlFor="roomId">Room Code</label>
                <input
                  id="roomId"
                  type="text"
                  className="input-field"
                  placeholder="e.g. cute-date-123"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn">
                <Play size={18} /> Join Room
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
    },
  };

  return (
    <div className="app-container">
      <div className="room-container">
        <header className="header">
          <div className="header-left">
            <h2>SyncTube <span style={{ opacity: 0.5, fontSize: '0.9rem', fontWeight: 400 }}>Room: {roomId}</span></h2>
          </div>
          <div className="header-right">
            <button onClick={copyRoomLink} className="btn btn-small btn-secondary">
              <LinkIcon size={16} /> Copy Link
            </button>
            <button onClick={() => window.location.reload()} className="btn btn-small btn-secondary">
              <LogOut size={16} /> Leave
            </button>
          </div>
        </header>

        <main className="main-content">
          <div className="video-section">
            <div className="video-player-wrapper">
              <YouTube
                videoId={videoId}
                opts={opts}
                onReady={onPlayerReady}
                onStateChange={onStateChange}
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            <form className="video-controls" onSubmit={handleChangeVideo}>
              <input
                type="text"
                className="input-field"
                placeholder="Paste YouTube URL or Video ID here..."
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
              />
              <button type="submit" className="btn btn-small" style={{ width: 'auto', padding: '0 1.5rem' }}>
                <Video size={18} /> Change Video
              </button>
            </form>
          </div>

          <aside className="sidebar">
            <div className="users-panel">
              <h3><Users size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '8px' }} /> Watching Now ({users.length})</h3>
              <ul className="user-list">
                {users.map((user) => (
                  <li key={user.id} className="user-item">
                    <div className="user-avatar">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span>{user.username} {user.username === username ? '(You)' : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;
