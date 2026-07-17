import React, { useState, useEffect, useRef } from 'react';
import { Meeting, Message, Executive, ExecutiveId, Poll, Participant } from '../types';
import { exosAdapter, EXOS_EXECUTIVES } from '../lib/exosAdapter';
import { collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import WaveformVisualizer from './WaveformVisualizer';
import SharedWhiteboard from './SharedWhiteboard';
import { 
  ArrowLeft, Mic, MicOff, Volume2, ShieldAlert, Radio, Clock, Send, Users, 
  Cpu, FileText, CheckCircle, BarChart3, Palette, Plus, HelpCircle, AlertTriangle, 
  Paperclip, Share2, Award, Download, Flame, ShieldCheck, HelpCircleIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isDevelopmentSession } from '../lib/devAuth';

export interface RoomParticipant {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'owner' | 'moderator' | 'participant' | 'invited';
  isMuted: boolean;
  isSpeaking: boolean;
  isRaisingHand: boolean;
  isPresent: boolean;
  joinedAt: string;
}

interface MeetingRoomProps {
  meetingId: string;
  user: { email: string; name: string; role: string; avatar: string; isDev?: boolean; userId?: string };
  onLeaveMeeting: () => void;
  onNavigateToArchive: () => void;
}

export default function MeetingRoom({ meetingId, user, onLeaveMeeting, onNavigateToArchive }: MeetingRoomProps) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState('');
  const [activeTab, setActiveTab] = useState<'executives' | 'participants' | 'whiteboard' | 'polls' | 'summary'>('executives');
  
  // Real-time participants roster
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  
  // Controls
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [isPushingToTalk, setIsPushingToTalk] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Poll states
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  // Recording constraints
  const [consentApproved, setConsentApproved] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Simulation parameters for VAD/Waveform
  const [currentVADState, setCurrentVADState] = useState<'Listening' | 'Thinking' | 'Speaking' | 'Offline'>('Listening');

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load meeting & messages on start
  useEffect(() => {
    let active = true;
    const fetchSession = async () => {
      try {
        const m = await exosAdapter.getMeeting(meetingId);
        const msgs = await exosAdapter.getMessages(meetingId);
        if (active) {
          setMeeting(m);
          setMessages(msgs);
          setConsentApproved(m.recordingConsentApproved);
          setIsRecording(m.recordingStatus === 'recording');
        }
      } catch (err) {
        console.error('Failed to load meeting room state:', err);
      }
    };

    fetchSession();
    // Poll messages every 5 seconds to simulate team / executive dialogue
    const interval = setInterval(fetchSession, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [meetingId]);

  // Synchronize current user presence, mute, and speaking state in Firestore
  useEffect(() => {
    if (!meetingId || !user?.email) return;

    const participantRef = doc(db, 'meetings', meetingId, 'participants', user.email);
    
    const joinAndSync = async () => {
      try {
        let pRole: 'owner' | 'moderator' | 'participant' | 'invited' = 'participant';
        if (user.role === 'Chairperson') {
          pRole = 'owner';
        } else if (user.role === 'Auditor') {
          pRole = 'moderator';
        }

        await setDoc(participantRef, {
          id: user.email,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: pRole,
          isMuted: isMicMuted,
          isSpeaking: currentVADState === 'Speaking',
          isRaisingHand: false,
          isPresent: true,
          joinedAt: new Date().toISOString()
        });
      } catch (err) {
        if (err instanceof Error && (err.message.includes('permission') || err.message.includes('denied'))) {
          handleFirestoreError(err, OperationType.WRITE, `meetings/${meetingId}/participants/${user.email}`);
        }
        console.error('[EXOS] Failed to register participant session:', err);
      }
    };

    joinAndSync();

    // Setup real-time listener for the participants subcollection
    const participantsCol = collection(db, 'meetings', meetingId, 'participants');
    const unsubscribe = onSnapshot(participantsCol, (snapshot) => {
      const list: RoomParticipant[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as RoomParticipant);
      });
      setParticipants(list);

      // Check if current user has been removed or muted remotely
      const me = list.find(p => p.email === user.email);
      if (me) {
        if (me.isPresent === false) {
          alert("You have been removed from this meeting by the moderator.");
          onLeaveMeeting();
        } else if (me.isMuted !== isMicMuted) {
          setIsMicMuted(me.isMuted);
        }
      }
    }, (err) => {
      if (err instanceof Error && (err.message.includes('permission') || err.message.includes('denied'))) {
        handleFirestoreError(err, OperationType.GET, `meetings/${meetingId}/participants`);
      }
      console.error('[EXOS] Real-time participants listener failed:', err);
    });

    return () => {
      unsubscribe();
      // On unmount/leave, set isPresent to false
      updateDoc(participantRef, { isPresent: false }).catch(() => {});
    };
  }, [meetingId, user, isMicMuted, onLeaveMeeting]);

  // Sync mute & speaking changes to Firestore as they occur
  useEffect(() => {
    if (!meetingId || !user?.email) return;
    const participantRef = doc(db, 'meetings', meetingId, 'participants', user.email);
    updateDoc(participantRef, {
      isMuted: isMicMuted,
      isSpeaking: currentVADState === 'Speaking'
    }).catch(() => {});
  }, [isMicMuted, currentVADState, meetingId, user]);

  // Handle polls loading
  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const list = await exosAdapter.getPolls(meetingId);
        setPolls(list);
      } catch (e) {
        console.error('Failed to fetch polls:', e);
      }
    };
    fetchPolls();
    const interval = setInterval(fetchPolls, 5000);
    return () => clearInterval(interval);
  }, [meetingId]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Elapsed meeting timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Sending text message to EXOS adapter
  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || textInput.trim();
    if (!textToSend) return;

    if (!customText) setTextInput('');
    setCurrentVADState('Thinking');

    // Add immediate user message to UI for snappy response feel
    const tempUserMsg: Message = {
      id: `temp-u-${Date.now()}`,
      meetingId,
      senderId: user.email,
      senderName: user.name,
      senderType: 'human',
      text: textToSend,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // Direct call to EXOS Adapter which proxies server-side Gemini
      const data = await exosAdapter.sendMessage(
        meetingId,
        user.email,
        user.name,
        textToSend,
        meeting?.executives[0] || 'nova',
        isHandsFree || isPushingToTalk
      );

      // Refresh real messages list from server db
      const list = await exosAdapter.getMessages(meetingId);
      setMessages(list);

      // Playback simulated TTS audio from response if present!
      if (data.exosMessage.audioUrl) {
        const audioObj = new Audio(data.exosMessage.audioUrl);
        audioObj.play().catch(pErr => console.warn('Speech playback deferred by browser interaction limits:', pErr));
      }

      setCurrentVADState('Speaking');
      setTimeout(() => setCurrentVADState('Listening'), 3500);

    } catch (err) {
      console.error('EXOS pipeline error:', err);
      setCurrentVADState('Listening');
    }
  };

  // Push to talk action triggering mock speech-to-text
  const handlePushToTalkStart = () => {
    if (isMicMuted) return;
    setIsPushingToTalk(true);
    setCurrentVADState('Listening');
  };

  const handlePushToTalkEnd = () => {
    if (!isPushingToTalk) return;
    setIsPushingToTalk(false);
    
    // Simulate speaking a strategic phrase
    const executiveBriefs = [
      "Can we optimize our gross margins by hosting the clustering pipeline locally?",
      "Jarvis, is our current customer data storage completely protected from audit compliance risks?",
      "Nova, do we have enough runway to expedite this product launch to August 1st?",
      "Astra, can we test auto-scaling up to 200k concurrent requests?"
    ];
    const randomBrief = executiveBriefs[Math.floor(Math.random() * executiveBriefs.length)];
    handleSendMessage(undefined, randomBrief);
  };

  // Consent & Recording management
  const handleRequestRecordingConsent = async () => {
    try {
      const approved = await exosAdapter.requestRecordingConsent(meetingId);
      setConsentApproved(approved);
      if (meeting) {
        const updated = await exosAdapter.updateMeeting(meetingId, { recordingConsentApproved: true });
        setMeeting(updated);
      }
    } catch (e) {
      console.error('Consent failed:', e);
    }
  };

  const handleToggleRecording = async () => {
    if (!consentApproved) {
      alert("Recording permission and compliance consent are required before recording.");
      return;
    }
    const nextState = !isRecording;
    try {
      const updated = await exosAdapter.toggleRecording(meetingId, nextState);
      setIsRecording(nextState);
      setMeeting(updated);
    } catch (e) {
      console.error('Toggle recording failed:', e);
    }
  };

  // Compile Briefing summary
  const handleTriggerSummaryCompilation = async () => {
    setCurrentVADState('Thinking');
    try {
      await exosAdapter.generatePostMeetingArtifacts(meetingId);
      const updated = await exosAdapter.getMeeting(meetingId);
      setMeeting(updated);
      setActiveTab('summary');
    } catch (err) {
      console.error('Post meeting summary creation failed:', err);
    }
    setCurrentVADState('Listening');
  };

  // Poll elements creation
  const handleAddPollOption = () => {
    setPollOptions([...pollOptions, '']);
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pollQuestion.trim() || pollOptions.filter(Boolean).length < 2) return;

    try {
      const created = await exosAdapter.createPoll(meetingId, pollQuestion, pollOptions.filter(Boolean));
      setPolls([...polls, created]);
      setPollQuestion('');
      setPollOptions(['', '']);
    } catch (err) {
      console.error('Create poll failed:', err);
    }
  };

  const handleVote = async (pollId: string, index: number) => {
    try {
      const updated = await exosAdapter.voteInPoll(meetingId, pollId, index, user.email);
      setPolls(polls.map(p => p.id === pollId ? updated : p));
    } catch (e) {
      console.warn('Voting block (likely already voted):', e);
    }
  };

  // Custom regex based markdown and list parser
  const renderFormattedMarkdown = (text: string) => {
    // Regex transformations for beautiful corporate inline markdown text
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let content = line;
      
      // Headers
      if (content.startsWith('### ')) {
        return <h4 key={idx} className="text-xs font-bold text-white uppercase tracking-wider mt-3 mb-1">{content.replace('### ', '')}</h4>;
      }
      if (content.startsWith('## ')) {
        return <h3 key={idx} className="text-sm font-semibold text-white mt-4 mb-1.5 border-b border-white/5 pb-1">{content.replace('## ', '')}</h3>;
      }
      if (content.startsWith('# ')) {
        return <h2 key={idx} className="text-base font-bold text-blue-400 mt-5 mb-2">{content.replace('# ', '')}</h2>;
      }

      // Blockquote
      if (content.startsWith('> ')) {
        return (
          <blockquote key={idx} className="pl-3 border-l-2 border-blue-500/50 text-slate-400 italic my-2 text-xs">
            {content.replace('> ', '')}
          </blockquote>
        );
      }

      // Checklists/Bullet lists
      if (content.startsWith('- ') || content.startsWith('* ')) {
        const cleanText = content.replace(/^[-*]\s+/, '');
        return (
          <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 pl-2 py-0.5">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
            <span>{cleanText}</span>
          </div>
        );
      }

      // Bold/Italics
      const boldPattern = /\*\*(.*?)\*\*/g;
      const italicPattern = /\*(.*?)\*/g;
      
      // Handle inline code blocks
      const codePattern = /`(.*?)`/g;

      // Render line with inline HTML spans for bold/italic/code
      // Simulating a parsed line using innerHTML safely or split text segments
      return (
        <p key={idx} className="text-xs text-slate-300 leading-relaxed mb-1.5">
          {content.split('**').map((part, pIdx) => {
            if (pIdx % 2 === 1) {
              return <strong key={pIdx} className="text-white font-semibold">{part}</strong>;
            }
            return part.split('*').map((subPart, sIdx) => {
              if (sIdx % 2 === 1) {
                return <em key={sIdx} className="text-slate-200 italic">{subPart}</em>;
              }
              return subPart.split('`').map((codePart, cIdx) => {
                if (cIdx % 2 === 1) {
                  return <code key={cIdx} className="bg-slate-950 px-1 py-0.5 rounded text-blue-400 font-mono text-[10px]">{codePart}</code>;
                }
                return codePart;
              });
            });
          })}
        </p>
      );
    });
  };

  if (!meeting) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs">Connecting to EXOS gateway secure tunnel...</p>
        </div>
      </div>
    );
  }

  if (meeting.status === 'lobby') {
    return (
      <div className="min-h-screen bg-[#0A0A0B] bg-gradient-to-b from-[#0F0F12] to-[#0A0A0B] text-slate-100 flex flex-col justify-between relative overflow-hidden">
        {/* Compliance security banner */}
        <header className="bg-black/30 border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onLeaveMeeting}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="text-[9px] uppercase tracking-wider font-mono text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                {meeting.type.replace(/-/g, ' ')}
              </span>
              <h1 className="text-sm font-bold text-white mt-1">{meeting.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 text-xs rounded-full font-mono">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Secure Waiting Lobby</span>
          </div>
        </header>

        {/* Central visual & participants roster */}
        <main className="max-w-4xl w-full mx-auto p-6 flex-1 flex flex-col items-center justify-center text-center gap-8">
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/5 relative animate-pulse">
              <Radio className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Connecting to Executive Operating System</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
                You have successfully tunneled into the EXOS board gateway. Awaiting authorization from the Chairperson to begin the alignment session.
              </p>
            </div>
          </div>

          {/* Secure invite code block */}
          <div className="w-full max-w-md bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-300">Invite additional corporate members:</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/?invite=${meetingId}`}
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 select-all outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?invite=${meetingId}`);
                  alert("Secure boardroom invitation link copied to clipboard!");
                }}
                className="px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Copy Link
              </button>
            </div>
          </div>

          {/* Connected roster in lobby */}
          <div className="w-full max-w-md space-y-3 text-left">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-white/5 pb-1">Connected Members ({participants.filter(p => p.isPresent).length})</h3>
            <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-1">
              {participants.filter(p => p.isPresent).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No other members connected yet.</p>
              ) : (
                participants.filter(p => p.isPresent).map((p) => (
                  <div key={p.email} className="flex items-center justify-between p-2.5 bg-slate-900/40 border border-white/5 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <img src={p.avatar} alt={p.name} className="w-7 h-7 rounded-lg object-cover" />
                      <div>
                        <p className="text-xs font-semibold text-white">{p.name}</p>
                        <p className="text-[10px] font-mono text-slate-500 capitalize">{p.role}</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-green-400 font-mono bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                      <span className="w-1 h-1 bg-green-400 rounded-full" />
                      <span>Ready</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chairperson authorization action button */}
          {(user.role === 'Chairperson' || participants.find(p => p.email === user.email)?.role === 'owner') && (
            <div className="pt-4">
              <button
                onClick={async () => {
                  try {
                    await exosAdapter.updateMeeting(meetingId, { status: 'active' });
                  } catch (e) {
                    console.error('Failed to initiate meeting room:', e);
                  }
                }}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold tracking-wider uppercase shadow-xl shadow-blue-500/20 transition-all cursor-pointer hover:scale-105"
              >
                Start Official Session
              </button>
            </div>
          )}
        </main>

        {/* Footer info */}
        <footer className="p-4 text-center border-t border-white/5 text-[10px] font-mono text-slate-500">
          SECURE QUANTUM ENCRYPTED NODE CONNECTION • TRANSIT SPEED: 14ms
        </footer>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0A0A0B] bg-gradient-to-b from-[#0F0F12] to-[#0A0A0B] text-slate-100 flex flex-col overflow-hidden relative">
      
      {/* Development Mode top banner */}
      {isDevelopmentSession(user) && (
        <div id="room-top-dev-banner" className="bg-amber-500/15 border-b border-amber-500/20 text-amber-400 py-1.5 px-6 text-[11px] flex items-center justify-between font-medium z-20">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span><strong>DEVELOPMENT MODE:</strong> Authentication bypass enabled. Not for production.</span>
          </div>
          <div className="text-[9px] font-mono bg-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            Development Session
          </div>
        </div>
      )}

      {/* 1. COMPLIANCE & SECURITY HEADER */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            id="meeting-back-btn"
            onClick={onLeaveMeeting}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-white"
            title="Exit Room"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-wider font-mono text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                {meeting.type.replace(/-/g, ' ')}
              </span>
              <h2 className="text-sm font-bold text-white leading-none">{meeting.title}</h2>
            </div>
            
            {/* Auditable Security indicator */}
            <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1.5 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Elapsed: {formatTimer(elapsedSeconds)}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-green-500">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Secured Stream (AES-256)</span>
              </span>
              {isDevelopmentSession(user) && (
                <>
                  <span>•</span>
                  <span id="room-dev-indicator" className="flex items-center gap-1 text-amber-400 font-bold animate-pulse">
                    <span>Development Session</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recording constraints & permissions controller */}
        <div className="flex items-center gap-3">
          {consentApproved ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-white/5 px-3 py-1.5 rounded-xl">
              <button
                id="rec-toggle-btn"
                onClick={handleToggleRecording}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold rounded uppercase cursor-pointer transition-all ${
                  isRecording 
                    ? 'bg-red-500/20 border border-red-500/30 text-red-400 animate-pulse' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Radio className={`w-3 h-3 ${isRecording ? 'text-red-400' : 'text-slate-500'}`} />
                <span>{isRecording ? 'Recording Live' : 'Start Recording'}</span>
              </button>
              <span className="text-[9px] text-slate-500 font-mono hidden sm:inline">Consent Authorized</span>
            </div>
          ) : (
            <button
              id="request-consent-btn"
              onClick={handleRequestRecordingConsent}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 hover:border-purple-500/50 text-purple-400 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Authorize Recording Consent</span>
            </button>
          )}

          {/* Compile final report button */}
          <button
            id="compile-artifacts-btn"
            onClick={handleTriggerSummaryCompilation}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Complete & Compile</span>
          </button>
        </div>
      </header>

      {/* 2. SPLIT LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Timeline Feed & Microphones */}
        <section className="flex-1 flex flex-col bg-gradient-to-b from-[#0F0F12] to-[#0A0A0B] relative overflow-hidden">
          
          {/* Scrollable Conversation Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center px-8">
                <Cpu className="w-12 h-12 mb-3 text-blue-500/20 animate-pulse" />
                <h3 className="font-semibold text-sm text-slate-400">Secure EXOS Interface Ready</h3>
                <p className="text-[11px] text-slate-500 max-w-sm mt-1">
                  Say or write a strategic prompt below to communicate directly with authorized AI executives.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.senderType === 'human';
                const exec = EXOS_EXECUTIVES[m.senderId as ExecutiveId];

                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3.5 max-w-[85%] ${
                      isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    {/* Speaker Avatar Frame */}
                    <img
                      src={isUser ? user.avatar : (exec?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80')}
                      alt={m.senderName}
                      className="w-8 h-8 rounded-lg object-cover border border-white/5 flex-shrink-0"
                    />

                    {/* Speech bubble */}
                    <div className="space-y-1">
                      <div className={`flex items-center gap-2 text-[10px] font-mono text-slate-500 ${
                        isUser ? 'justify-end' : ''
                      }`}>
                        <span className="font-semibold text-slate-300">{m.senderName}</span>
                        <span>•</span>
                        <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>

                      <div className={`p-4 rounded-2xl border text-slate-300 shadow-sm ${
                        isUser 
                          ? 'bg-blue-600/10 border-blue-500/20 rounded-tr-none' 
                          : 'bg-slate-900/60 border-white/5 rounded-tl-none'
                      }`}>
                        {renderFormattedMarkdown(m.text)}

                        {m.audioUrl && (
                          <div className="mt-3.5 flex items-center gap-2 p-1.5 bg-slate-950/60 border border-white/5 rounded-lg w-fit">
                            <button
                              id={`play-${m.id}`}
                              onClick={() => {
                                const audio = new Audio(m.audioUrl);
                                audio.play();
                              }}
                              className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-md transition-all cursor-pointer text-[10px] font-mono font-bold uppercase flex items-center gap-1"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Replay Voice</span>
                            </button>
                            <span className="text-[9px] font-mono text-slate-500">EXOS Voice synthesis</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 3. CORE VOICE/WAVEFORM STAGE */}
          {(isHandsFree || isPushingToTalk || meeting.type.includes('voice')) && (
            <div className="px-6 py-2 bg-slate-950/40 border-t border-white/5">
              <WaveformVisualizer isActive={isPushingToTalk || currentVADState !== 'Offline'} status={currentVADState} />
            </div>
          )}

          {/* 4. CHAT CONTROLS / MIC INPUT TRAY */}
          <div className="p-4 bg-slate-950/60 border-t border-white/5 flex flex-col md:flex-row items-center gap-3">
            
            {/* Push to talk giant circular button */}
            <div className="flex items-center gap-2">
              <button
                id="mic-mute-toggle"
                onClick={() => setIsMicMuted(!isMicMuted)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isMicMuted 
                    ? 'bg-red-500/15 border-red-500/30 text-red-400' 
                    : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                }`}
                title={isMicMuted ? "Unmute Mic Channel" : "Mute Mic Channel"}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Circular push-to-talk */}
              <button
                id="ptt-button"
                onMouseDown={handlePushToTalkStart}
                onMouseUp={handlePushToTalkEnd}
                onTouchStart={handlePushToTalkStart}
                onTouchEnd={handlePushToTalkEnd}
                className={`h-11 px-5 text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition-all cursor-pointer select-none ${
                  isPushingToTalk 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white scale-95 shadow-inner' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10'
                }`}
              >
                {isPushingToTalk ? 'Speech Stream Active...' : 'Hold to Speak'}
              </button>

              {/* Hands free switch */}
              <button
                id="hands-free-toggle"
                onClick={() => {
                  setIsHandsFree(!isHandsFree);
                  setCurrentVADState(!isHandsFree ? 'Listening' : 'Offline');
                }}
                className={`p-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                  isHandsFree 
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' 
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                Hands-Free
              </button>
            </div>

            {/* Standard rich-text input bar */}
            <form onSubmit={(e) => handleSendMessage(e)} className="flex-1 w-full flex items-center gap-2">
              <input
                id="chat-text-input"
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Submit strategic briefing prompt..."
                className="flex-1 bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
              <button
                id="chat-send-btn"
                type="submit"
                className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all cursor-pointer active:scale-95 shadow-md shadow-blue-500/10"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

        {/* Right Side: Collapsible Workspace utility drawer */}
        <aside className="w-96 border-l border-white/5 bg-slate-950/40 flex flex-col overflow-hidden">
          
          {/* Tab Selection Header */}
          <div className="flex border-b border-white/5 bg-slate-950/60">
            {[
              { id: 'executives', label: 'AI Panel', icon: Cpu },
              { id: 'participants', label: 'Roster', icon: Users },
              { id: 'whiteboard', label: 'Canvas', icon: Palette },
              { id: 'polls', label: 'Polls', icon: BarChart3 },
              { id: 'summary', label: 'Post-Briefing', icon: FileText }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 px-1 text-[11px] font-mono uppercase tracking-wider font-semibold border-b-2 flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    activeTab === tab.id 
                      ? 'border-blue-500 text-blue-400 bg-white/[0.02]' 
                      : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.01]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Contents Frame */}
          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              
              {/* T1. EXECUTIVE BOARD STATUS CARDS */}
              {activeTab === 'executives' && (
                <motion.div
                  key="executives"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3.5"
                >
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Authorized AI Execs</h3>
                  {meeting.executives.map((eId) => {
                    const exec = EXOS_EXECUTIVES[eId];
                    if (!exec) return null;

                    // Dynamic status mapping for visuals
                    const isSpeaking = currentVADState === 'Speaking' && eId === 'nova';
                    const isThinking = currentVADState === 'Thinking' && eId === 'nova';

                    return (
                      <div
                        key={eId}
                        className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${
                          isSpeaking 
                            ? 'bg-blue-600/10 border-blue-500/40' 
                            : isThinking 
                            ? 'bg-purple-600/10 border-purple-500/40 animate-pulse'
                            : 'bg-slate-900/40 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <img src={exec.avatar} alt={exec.name} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-xs text-white leading-none">{exec.name}</h4>
                              <span className={`text-[8px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded ${
                                isSpeaking ? 'bg-blue-500/20 text-blue-400' :
                                isThinking ? 'bg-purple-500/20 text-purple-400' :
                                'bg-slate-800 text-slate-500'
                              }`}>
                                {isSpeaking ? 'Speaking' : isThinking ? 'Thinking' : 'Listening'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed mt-1.5">{exec.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}

              {/* T1.5. HUMAN ROSTER & MULTI-USER CONTROLS */}
              {activeTab === 'participants' && (
                <motion.div
                  key="participants"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Boardroom Roster</h3>
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      {participants.filter(p => p.isPresent).length} Active
                    </span>
                  </div>

                  {/* Share Invite Link Widget */}
                  <div className="p-3.5 bg-slate-900/40 border border-white/5 rounded-2xl space-y-2">
                    <p className="text-[11px] text-slate-400">Share secure boardroom link to invite additional members:</p>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/?invite=${meetingId}`}
                        className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] font-mono text-slate-300 outline-none select-all"
                      />
                      <button
                        onClick={() => {
                          const inviteUrl = `${window.location.origin}/?invite=${meetingId}`;
                          navigator.clipboard.writeText(inviteUrl);
                          alert("Boardroom secure invitation link copied to clipboard!");
                        }}
                        className="px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-bold font-mono uppercase transition-all cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Participants roster list */}
                  <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                    {participants.filter(p => p.isPresent).length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No active human participants detected.</p>
                    ) : (
                      participants.filter(p => p.isPresent).map((p) => {
                        const isMe = p.email === user.email;
                        // Check if current user is owner or moderator
                        const myParticipantState = participants.find(part => part.email === user.email);
                        const isCurrentUserMod = myParticipantState?.role === 'owner' || myParticipantState?.role === 'moderator';
                        
                        return (
                          <div 
                            key={p.email} 
                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                              isMe ? 'bg-blue-950/15 border-blue-500/10' : 'bg-slate-900/30 border-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-lg object-cover border border-white/10" />
                              <div className="text-left">
                                <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                                  <span>{p.name}</span>
                                  {isMe && <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1 rounded">You</span>}
                                </p>
                                <span className={`text-[9px] uppercase tracking-wider font-mono font-bold ${
                                  p.role === 'owner' ? 'text-red-400' :
                                  p.role === 'moderator' ? 'text-purple-400' :
                                  'text-slate-400'
                                }`}>
                                  {p.role}
                                </span>
                              </div>
                            </div>

                            {/* Status and Action Buttons */}
                            <div className="flex items-center gap-1.5">
                              {/* Mute indicator status */}
                              <span className={`p-1.5 rounded-lg border text-xs ${
                                p.isMuted 
                                  ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                  : p.isSpeaking 
                                  ? 'bg-green-500/10 border-green-500/20 text-green-400 animate-pulse'
                                  : 'bg-slate-800 border-white/5 text-slate-400'
                              }`} title={p.isMuted ? "Muted" : p.isSpeaking ? "Speaking" : "Active"}>
                                {p.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                              </span>

                              {/* Moderator controls: Mute remotely, Kick/Remove */}
                              {!isMe && isCurrentUserMod && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const pRef = doc(db, 'meetings', meetingId, 'participants', p.email);
                                        await updateDoc(pRef, { isMuted: !p.isMuted });
                                      } catch (err) {
                                        if (err instanceof Error && (err.message.includes('permission') || err.message.includes('denied'))) {
                                          handleFirestoreError(err, OperationType.UPDATE, `meetings/${meetingId}/participants/${p.email}`);
                                        }
                                        console.error('[EXOS] Failed to toggle remote mute:', err);
                                      }
                                    }}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-white/5 cursor-pointer text-[10px] font-mono"
                                    title="Toggle remote mute"
                                  >
                                    Mute
                                  </button>
                                  
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Are you sure you want to remove ${p.name} from the boardroom session?`)) {
                                        try {
                                          const pRef = doc(db, 'meetings', meetingId, 'participants', p.email);
                                          await updateDoc(pRef, { isPresent: false });
                                        } catch (err) {
                                          if (err instanceof Error && (err.message.includes('permission') || err.message.includes('denied'))) {
                                            handleFirestoreError(err, OperationType.UPDATE, `meetings/${meetingId}/participants/${p.email}`);
                                          }
                                          console.error('[EXOS] Failed to remove participant:', err);
                                        }
                                      }
                                    }}
                                    className="px-2 py-1 bg-red-950/20 hover:bg-red-950/40 text-red-400 rounded-lg border border-red-500/20 cursor-pointer text-[10px] font-mono"
                                    title="Remove participant"
                                  >
                                    Kick
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}

              {/* T2. COLLABORATIVE WHITEBOARD */}
              {activeTab === 'whiteboard' && (
                <motion.div
                  key="whiteboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full flex flex-col"
                >
                  <SharedWhiteboard meetingId={meetingId} />
                </motion.div>
              )}

              {/* T3. LIVE PARTICIPANT POLLS */}
              {activeTab === 'polls' && (
                <motion.div
                  key="polls"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-5"
                >
                  {/* Create Poll form */}
                  <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Initiate Live Poll</h4>
                    <form onSubmit={handleCreatePoll} className="space-y-3">
                      <div>
                        <input
                          id="poll-question-input"
                          type="text"
                          required
                          value={pollQuestion}
                          onChange={(e) => setPollQuestion(e.target.value)}
                          placeholder="Ask board matching question..."
                          className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        {pollOptions.map((opt, idx) => (
                          <input
                            key={idx}
                            id={`poll-opt-${idx}`}
                            type="text"
                            required
                            value={opt}
                            onChange={(e) => {
                              const updated = [...pollOptions];
                              updated[idx] = e.target.value;
                              setPollOptions(updated);
                            }}
                            placeholder={`Option ${idx + 1}`}
                            className="w-full bg-slate-950 border border-white/5 rounded-xl py-1.5 px-3 text-xs text-white outline-none"
                          />
                        ))}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          id="poll-add-opt"
                          type="button"
                          onClick={() => handleAddPollOption()}
                          className="flex-1 py-1.5 text-[10px] font-mono border border-white/10 hover:bg-white/[0.02] text-slate-300 rounded-lg"
                        >
                          + Option
                        </button>
                        <button
                          id="poll-submit"
                          type="submit"
                          className="flex-1 py-1.5 text-[10px] font-mono bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
                        >
                          Launch Poll
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Polls Listing */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-white/5 pb-1">Active Votes</h4>
                    {polls.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No active polls running.</p>
                    ) : (
                      polls.map((poll) => {
                        const totalVotes = Object.values(poll.votes).reduce((a: any, b: any) => (a as number) + (b as number), 0) as number;
                        const hasVoted = poll.votedUsers.includes(user.email);

                        return (
                          <div key={poll.id} className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl space-y-3">
                            <p className="text-xs font-semibold text-white">{poll.question}</p>
                            
                            <div className="space-y-2">
                              {poll.options.map((opt, idx) => {
                                const count = (poll.votes[idx] as number) || 0;
                                const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                                
                                return (
                                  <button
                                    key={idx}
                                    id={`vote-${poll.id}-${idx}`}
                                    onClick={() => handleVote(poll.id, idx)}
                                    disabled={hasVoted}
                                    className="w-full text-left p-2.5 bg-slate-950/60 hover:bg-slate-950 border border-white/5 rounded-xl text-xs relative overflow-hidden group cursor-pointer"
                                  >
                                    <div 
                                      className="absolute top-0 bottom-0 left-0 bg-blue-600/10 transition-all duration-500" 
                                      style={{ width: `${percent}%` }}
                                    />
                                    <div className="relative flex justify-between">
                                      <span className="font-medium text-slate-300">{opt}</span>
                                      <span className="font-mono text-blue-400 font-bold">{percent}% ({count})</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[9px] font-mono text-slate-500">Total votes: {totalVotes}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}

              {/* T4. POST-BRIEFING SCREEN */}
              {activeTab === 'summary' && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-5"
                >
                  {meeting.summary ? (
                    <div className="space-y-4">
                      
                      {/* Score Badge */}
                      <div className="p-4 bg-gradient-to-tr from-purple-950/20 to-blue-950/20 border border-purple-500/15 rounded-2xl text-center">
                        <Award className="w-7 h-7 text-yellow-500 mx-auto mb-1" />
                        <h4 className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Board Alignment Score</h4>
                        <p className="text-3xl font-extrabold text-white mt-0.5">{meeting.summary.score || 92}/100</p>
                      </div>

                      {/* Decison timeline */}
                      <div className="space-y-3.5">
                        <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1 border-b border-white/5 pb-1">
                          <CheckCircle className="w-4 h-4" />
                          <span>Logged Decisions</span>
                        </h4>
                        <ul className="space-y-2">
                          {meeting.summary.decisions.map((dec, i) => (
                            <li key={i} className="text-xs text-slate-300 leading-relaxed flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                              <span>{dec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Action tasks */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1 border-b border-white/5 pb-1">
                          <Plus className="w-4 h-4" />
                          <span>Delegated Tasks</span>
                        </h4>
                        <div className="space-y-2.5">
                          {meeting.summary.actionItems.map((item, idx) => (
                            <div key={idx} className="p-2.5 bg-slate-900 border border-white/5 rounded-xl text-xs">
                              <p className="font-semibold text-slate-200">{item.text}</p>
                              <p className="text-[10px] text-slate-500 mt-1">Assignee: {item.assignedTo} | Due: {item.dueDate}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        id="view-archives-redirect"
                        onClick={onNavigateToArchive}
                        className="w-full py-3 bg-[#0a122d] hover:bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-mono uppercase tracking-wider font-bold rounded-xl cursor-pointer"
                      >
                        View Full Archives Package
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <FileText className="w-12 h-12 mx-auto opacity-10 mb-2" />
                      <p className="text-xs font-semibold">Workspace Report Staged</p>
                      <p className="text-[10px] opacity-60 mt-1">Click "Complete & Compile" above to generate the formal strategic brief.</p>
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </aside>

      </div>
    </div>
  );
}
