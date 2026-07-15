import React, { useState, useEffect } from 'react';
import { Meeting, MeetingType, ExecutiveId, Executive } from '../types';
import { exosAdapter, EXOS_EXECUTIVES } from '../lib/exosAdapter';
import { 
  Calendar, Video, Clock, Plus, UserPlus, Sliders, Volume2, Mic, Eye, Search, Trash2, 
  Settings2, HelpCircle, HardDrive, Cpu, Wifi, LogOut, Check, ArrowRight, UserCircle, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isDevelopmentSession } from '../lib/devAuth';

interface MeetingLobbyProps {
  user: { email: string; name: string; role: string; avatar: string; isDev?: boolean; userId?: string };
  onJoinMeeting: (meetingId: string) => void;
  onLogout: () => void;
  onNavigateToArchive: () => void;
}

export default function MeetingLobby({ user, onJoinMeeting, onLogout, onNavigateToArchive }: MeetingLobbyProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // New meeting form states
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<MeetingType>('one-on-one');
  const [selectedExecutives, setSelectedExecutives] = useState<ExecutiveId[]>(['nova']);
  const [newParticipants, setNewParticipants] = useState<string>('Nicholas Washington');

  // Device settings states
  const [micDevice, setMicDevice] = useState('Default Internal Microphone');
  const [speakerDevice, setSpeakerDevice] = useState('Default System Speakers');
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [connectionLatency, setConnectionLatency] = useState(14); // 14ms ping to EXOS

  // Load meetings
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const list = await exosAdapter.getMeetings();
        setMeetings(list);
      } catch (err) {
        console.error('Failed to load meetings in lobby:', err);
      }
    };
    fetchMeetings();
    const interval = setInterval(fetchMeetings, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const created = await exosAdapter.createMeeting({
        title: newTitle,
        type: newType,
        executives: selectedExecutives,
        participants: newParticipants.split(',').map(p => p.trim()).filter(Boolean),
        startTime: new Date().toISOString(),
      });
      setMeetings([created, ...meetings]);
      setIsCreateOpen(false);
      setNewTitle('');
      onJoinMeeting(created.id); // auto join created meeting room!
    } catch (err) {
      console.error('Create meeting failed:', err);
    }
  };

  const handleDeleteMeeting = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await exosAdapter.deleteMeeting(id);
      setMeetings(meetings.filter(m => m.id !== id));
    } catch (err) {
      console.error('Delete meeting failed:', err);
    }
  };

  const handleExecToggle = (id: ExecutiveId) => {
    if (selectedExecutives.includes(id)) {
      if (selectedExecutives.length > 1) {
        setSelectedExecutives(selectedExecutives.filter(eId => eId !== id));
      }
    } else {
      setSelectedExecutives([...selectedExecutives, id]);
    }
  };

  const filteredMeetings = meetings.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0A0A0B] bg-gradient-to-b from-[#0F0F12] to-[#0A0A0B] text-slate-100 flex flex-col relative overflow-x-hidden">
      
      {/* Development Mode top header banner */}
      {isDevelopmentSession(user) && (
        <div id="lobby-top-dev-banner" className="bg-amber-500/15 border-b border-amber-500/20 text-amber-400 py-2 px-6 text-xs flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span><strong>DEVELOPMENT MODE:</strong> Authentication bypass enabled. Not for production.</span>
          </div>
          <div className="text-[10px] font-mono bg-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            Development Session
          </div>
        </div>
      )}

      {/* Premium Glass Top Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            E
          </div>
          <div>
            <span className="font-semibold text-sm tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">EXOS</span>
            <span className="text-[10px] font-mono text-blue-400 block -mt-1 uppercase tracking-wider">Thin Client v1.2</span>
          </div>
        </div>

        {/* Status indicator pill */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-full font-mono">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span>EXOS Connected</span>
          </div>
          {isDevelopmentSession(user) && (
            <div id="lobby-dev-badge" className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-full font-mono font-bold animate-pulse">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
              <span>Development Session</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* User profile widget */}
          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
            <img src={user.avatar} alt="User Avatar" className="w-6 h-6 rounded-lg object-cover" />
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-white leading-none">{user.name}</p>
              <p className="text-[9px] text-slate-400 leading-none mt-1">
                {user.role} {isDevelopmentSession(user) && <span className="text-amber-400 font-bold ml-1">(Dev)</span>}
              </p>
            </div>
          </div>

          <button
            id="lobby-settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 bg-slate-900 border border-white/10 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
            title="Hardware Device Diagnostics"
          >
            <Sliders className="w-4.5 h-4.5" />
          </button>

          <button
            id="lobby-logout-btn"
            onClick={onLogout}
            className="p-2 bg-red-950/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all cursor-pointer"
            title="Terminate Session"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </nav>

      {/* Main Lobby Stage Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side Panel: Primary Actions, Search, & Meetings list */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Boardrooms & Sessions</h1>
              <p className="text-xs text-slate-400 mt-1">Select an active session or initialize a new executive alignment.</p>
            </div>

            <button
              id="lobby-create-btn"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-500/25 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Initiate Session</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="lobby-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active, scheduled, or previous archived board meetings..."
              className="w-full bg-slate-950/60 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {/* Sessions List */}
          <div className="space-y-4">
            {filteredMeetings.length === 0 ? (
              <div className="p-8 bg-white/[0.02] border border-white/5 rounded-2xl text-center text-slate-500">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20 text-slate-400" />
                <p className="text-xs font-medium">No matching executive meetings found.</p>
              </div>
            ) : (
              filteredMeetings.map((m) => {
                const isLobby = m.status === 'lobby';
                const isActive = m.status === 'active';
                const isCompleted = m.status === 'completed';

                return (
                  <div
                    key={m.id}
                    onClick={() => onJoinMeeting(m.id)}
                    className="p-5 bg-gradient-to-r from-slate-900/60 to-slate-950/60 hover:from-slate-900/90 hover:to-slate-950/90 border border-white/5 hover:border-white/10 rounded-2xl transition-all duration-300 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Meeting Type Icon Frame */}
                      <div className={`p-3 rounded-xl ${
                        isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        isLobby ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        <Video className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-slate-100 group-hover:text-blue-400 transition-colors">
                            {m.title}
                          </h3>
                          <span className={`text-[9px] uppercase tracking-wider font-mono px-2 py-0.5 rounded ${
                            isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 animate-pulse' :
                            isLobby ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' :
                            'bg-slate-800/80 text-slate-400'
                          }`}>
                            {m.status}
                          </span>
                        </div>

                        {/* Meeting Metadata Sublines */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="capitalize">{m.type.replace(/-/g, ' ')}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">
                            Participants: {m.participants.length} human
                          </span>
                        </div>

                        {/* Selected Executives List Displays */}
                        <div className="flex items-center gap-1.5 mt-3">
                          <span className="text-[10px] text-slate-500">EXOS Executives:</span>
                          <div className="flex -space-x-1.5">
                            {m.executives.map((eId) => {
                              const exec = EXOS_EXECUTIVES[eId];
                              return (
                                <img
                                  key={eId}
                                  src={exec?.avatar}
                                  alt={exec?.name}
                                  className="w-5.5 h-5.5 rounded-full border border-slate-900 object-cover"
                                  title={exec?.name}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side CTA or status reports */}
                    <div className="flex items-center gap-3 justify-end">
                      {isCompleted ? (
                        <button
                          id={`lobby-summary-${m.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToArchive();
                          }}
                          className="px-3 py-1.5 text-xs bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 text-purple-400 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Briefing Pack</span>
                        </button>
                      ) : (
                        <button
                          id={`lobby-join-${m.id}`}
                          className="px-4 py-2 text-xs bg-slate-800 hover:bg-blue-600 rounded-xl text-slate-200 hover:text-white transition-all cursor-pointer flex items-center gap-1 group-hover:translate-x-1"
                        >
                          <span>{isLobby ? 'Join Lobby' : 'Join Room'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        id={`lobby-share-${m.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const inviteUrl = `${window.location.origin}/?invite=${m.id}`;
                          navigator.clipboard.writeText(inviteUrl);
                          alert(`Secure invitation link for "${m.title}" copied to clipboard!`);
                        }}
                        className="p-2 text-slate-500 hover:text-blue-400 rounded-xl transition-all"
                        title="Copy Secure Invite Link"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      <button
                        id={`lobby-del-${m.id}`}
                        onClick={(e) => handleDeleteMeeting(m.id, e)}
                        className="p-2 text-slate-500 hover:text-red-400 rounded-xl transition-all"
                        title="Remove Session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Side Panel: AI Executives Index & Device Health Panel */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Executive Operating System Index */}
          <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-md">
            <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5 uppercase font-mono mb-4">
              <Cpu className="w-4.5 h-4.5 text-blue-400" />
              <span>EXOS Board Members</span>
            </h2>

            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {(Object.values(EXOS_EXECUTIVES) as Executive[]).map((exec) => (
                <div key={exec.id} className="flex gap-3 p-2 hover:bg-white/[0.02] rounded-xl transition-all">
                  <img src={exec.avatar} alt={exec.name} className="w-9 h-9 rounded-xl object-cover border border-white/10" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-slate-200">{exec.name}</span>
                      <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 rounded uppercase font-mono">{exec.voice}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{exec.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Secure Hardware Diagnostics Panel */}
          <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-md">
            <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5 uppercase font-mono mb-4">
              <Settings2 className="w-4.5 h-4.5 text-blue-400" />
              <span>Hardware Diagnostics</span>
            </h2>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Microphone Input:</span>
                <span className="font-mono text-blue-400">{micDevice.substring(0, 20)}...</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Speaker Channel:</span>
                <span className="font-mono text-blue-400">{speakerDevice.substring(0, 20)}...</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Noise Suppression:</span>
                <span className="font-mono text-green-400">Enabled (VAD Ready)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Tunnel Ping (Latency):</span>
                <span className="font-mono text-green-400">{connectionLatency} ms (Fast)</span>
              </div>
            </div>
          </div>

          {/* Button link to Archive */}
          <button
            id="lobby-archives-btn"
            onClick={onNavigateToArchive}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#0a122c] hover:bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-semibold tracking-wider uppercase cursor-pointer transition-all"
          >
            <Calendar className="w-4 h-4" />
            <span>View Briefing Archives</span>
          </button>
        </section>
      </main>

      {/* CREATE MEETING MODAL - GLASS UI OVERLAY */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 p-6 rounded-3xl w-full max-w-lg shadow-2xl relative"
            >
              <h2 className="text-lg font-bold text-white mb-2">Initialize EXOS Workspace Session</h2>
              <p className="text-xs text-slate-400 mb-6">Set meeting parameters and select the AI Executive board members to authorize.</p>

              <form onSubmit={handleCreateMeeting} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Meeting Agenda / Title</label>
                  <input
                    id="new-meeting-title"
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Q3 Latency Mitigation & Margin Alignment"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white placeholder-slate-500 focus:border-blue-500 transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Meeting Modality</label>
                    <select
                      id="new-meeting-type"
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as MeetingType)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none"
                    >
                      <option value="one-on-one">One-on-One Session</option>
                      <option value="one-on-one-voice">One-on-One Voice</option>
                      <option value="one-on-one-text">One-on-One Text Only</option>
                      <option value="board">Executive Board Meeting</option>
                      <option value="workshop">Executive Workshop Session</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Human Participants</label>
                    <input
                      id="new-meeting-parts"
                      type="text"
                      value={newParticipants}
                      onChange={(e) => setNewParticipants(e.target.value)}
                      placeholder="Comma separated names"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                {/* AI Executive Selector Grid */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Authorize AI Board Members</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(Object.values(EXOS_EXECUTIVES) as Executive[]).map((exec) => {
                      const isSelected = selectedExecutives.includes(exec.id);
                      return (
                        <div
                          key={exec.id}
                          onClick={() => handleExecToggle(exec.id)}
                          className={`p-2.5 border rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-blue-600/15 border-blue-500 text-white' 
                              : 'bg-slate-950/60 border-white/5 text-slate-400 hover:border-white/10'
                          }`}
                        >
                          <img src={exec.avatar} alt={exec.name} className="w-7 h-7 rounded-lg object-cover mb-1.5" />
                          <span className="text-[10px] font-semibold block leading-none">{exec.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    id="create-modal-cancel"
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="flex-1 bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white rounded-xl py-2.5 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="create-modal-submit"
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-xs font-medium cursor-pointer text-center"
                  >
                    Initialize Workspace
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HARDWARE DIAGNOSTIC CONFIG OVERLAY */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl"
            >
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-1.5">
                <Sliders className="w-5 h-5 text-blue-400" />
                <span>Diagnostics & Hardware</span>
              </h2>
              <p className="text-xs text-slate-400 mb-6">Diagnose client micro-channels, audio streams, and suppression parameters.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Mic className="w-3.5 h-3.5" />
                    <span>Microphone Node</span>
                  </label>
                  <select
                    id="settings-mic"
                    value={micDevice}
                    onChange={(e) => setMicDevice(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-300 outline-none"
                  >
                    <option value="Default Internal Microphone">Default MacBook Pro Microphone</option>
                    <option value="External USB Audio Node">External Enterprise USB Audio Node</option>
                    <option value="Acoustic Boundary Array">Acoustic Boundary Array (360° Matrix)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Audio Playback Stream</span>
                  </label>
                  <select
                    id="settings-speaker"
                    value={speakerDevice}
                    onChange={(e) => setSpeakerDevice(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-300 outline-none"
                  >
                    <option value="Default System Speakers">Default System Spatial Speakers</option>
                    <option value="Auditory Monitors (Core)">Acoustic Auditory Monitors (PCM Stereo)</option>
                    <option value="External Studio Bridge">External Studio Sound Bridge (CoreAudio)</option>
                  </select>
                </div>

                {/* Noise suppression toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-white/5 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Neural Noise Suppression</p>
                    <p className="text-[10px] text-slate-500">Cancel echo feedback loop and high room hums</p>
                  </div>
                  <input
                    id="settings-suppress"
                    type="checkbox"
                    checked={noiseSuppression}
                    onChange={(e) => setNoiseSuppression(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-900 border-white/10 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* Latency meter */}
                <div className="p-3.5 bg-slate-950/40 border border-white/5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-medium text-slate-300">EXOS Gateway Link Status</span>
                  </div>
                  <span className="text-xs font-mono text-green-400">Connected (14ms)</span>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  id="settings-close"
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-xs font-medium cursor-pointer"
                >
                  Confirm Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
