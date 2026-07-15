import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AuthScreen from './components/AuthScreen';
import MeetingLobby from './components/MeetingLobby';
import MeetingRoom from './components/MeetingRoom';
import MeetingArchive from './components/MeetingArchive';
import { signOutUser } from './lib/firebase';

export interface UserProfile {
  userId: string;
  name: string; // compatibility with existing views
  displayName: string;
  email: string;
  avatar: string;
  organization: string;
  role: 'Chairperson' | 'Executive' | 'Auditor' | 'Observer';
  meetingPermissions: string[];
  mfaEnabled: boolean;
  createdAt: string;
  lastSeenAt: string;
  sessionEstablishedAt?: string;
  isDev?: boolean;
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentPage, setCurrentPage] = useState<'auth' | 'lobby' | 'room' | 'archive'>('auth');
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);

  // Check persistent session on load
  useEffect(() => {
    // 1. Check for invite link parameter in URL query
    const urlParams = new URLSearchParams(window.location.search);
    const inviteMeetingId = urlParams.get('invite') || urlParams.get('join');
    if (inviteMeetingId) {
      console.log(`[EXOS] Detected secure invite link for meeting: ${inviteMeetingId}`);
      localStorage.setItem('pending_invite_meeting_id', inviteMeetingId);
      // Clean up search query parameter to keep URL clean
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const savedUser = localStorage.getItem('emp_user_session');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as UserProfile;
        const establishedTime = parsed.sessionEstablishedAt || parsed.createdAt;
        const elapsedMs = Date.now() - new Date(establishedTime).getTime();
        const oneHourMs = 60 * 60 * 1000;

        if (elapsedMs < oneHourMs) {
          setUser(parsed);
          setCurrentPage('lobby');
        } else {
          // Session expired
          console.warn("[EXOS] Session has expired. Please sign in again.");
          localStorage.removeItem('emp_user_session');
          signOutUser().catch(() => {});
        }
      } catch {
        localStorage.removeItem('emp_user_session');
      }
    }
  }, []);

  // Redirect to pending meeting invite on successful login
  useEffect(() => {
    if (user && currentPage !== 'room') {
      const pendingMeetingId = localStorage.getItem('pending_invite_meeting_id');
      if (pendingMeetingId) {
        localStorage.removeItem('pending_invite_meeting_id');
        console.log(`[EXOS] Redirecting user directly to invited meeting: ${pendingMeetingId}`);
        handleJoinMeeting(pendingMeetingId);
      }
    }
  }, [user, currentPage]);

  // Periodic absolute session duration check (60 minutes)
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => {
      const savedUser = localStorage.getItem('emp_user_session');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser) as UserProfile;
          const establishedTime = parsed.sessionEstablishedAt || parsed.createdAt;
          const elapsedMs = Date.now() - new Date(establishedTime).getTime();
          const oneHourMs = 60 * 60 * 1000;

          if (elapsedMs >= oneHourMs) {
            console.warn("[EXOS] Absolute session expired (60m). Logging out.");
            handleLogout();
          }
        } catch {
          handleLogout();
        }
      }
    }, 20000); // Check every 20s

    return () => clearInterval(intervalId);
  }, [user]);

  const handleLoginSuccess = (profile: UserProfile) => {
    const enrichedProfile = {
      ...profile,
      sessionEstablishedAt: new Date().toISOString()
    };
    setUser(enrichedProfile);
    localStorage.setItem('emp_user_session', JSON.stringify(enrichedProfile));
    setCurrentPage('lobby');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('emp_user_session');
    setCurrentPage('auth');
    setCurrentMeetingId(null);
    signOutUser().catch(err => {
      console.error('Failed to sign out from Firebase:', err);
    });
  };

  const handleJoinMeeting = (meetingId: string) => {
    setCurrentMeetingId(meetingId);
    setCurrentPage('room');
  };

  const handleLeaveMeeting = () => {
    setCurrentMeetingId(null);
    setCurrentPage('lobby');
  };

  return (
    <div className="bg-[#0A0A0B] bg-gradient-to-b from-[#0F0F12] to-[#0A0A0B] min-h-screen text-slate-100 font-sans selection:bg-blue-500/30 selection:text-white overflow-hidden">
      <AnimatePresence mode="wait">
        
        {currentPage === 'auth' && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full min-h-screen"
          >
            <AuthScreen onLoginSuccess={handleLoginSuccess} />
          </motion.div>
        )}

        {currentPage === 'lobby' && user && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full min-h-screen"
          >
            <MeetingLobby
              user={user}
              onJoinMeeting={handleJoinMeeting}
              onLogout={handleLogout}
              onNavigateToArchive={() => setCurrentPage('archive')}
            />
          </motion.div>
        )}

        {currentPage === 'room' && user && currentMeetingId && (
          <motion.div
            key="room"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="w-full h-screen"
          >
            <MeetingRoom
              meetingId={currentMeetingId}
              user={user}
              onLeaveMeeting={handleLeaveMeeting}
              onNavigateToArchive={() => setCurrentPage('archive')}
            />
          </motion.div>
        )}

        {currentPage === 'archive' && user && (
          <motion.div
            key="archive"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-screen"
          >
            <MeetingArchive
              onBackToLobby={() => setCurrentPage('lobby')}
              onJoinMeeting={handleJoinMeeting}
            />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
