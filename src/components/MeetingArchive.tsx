import { useState, useEffect } from 'react';
import { Meeting } from '../types';
import { exosAdapter } from '../lib/exosAdapter';
import { 
  ArrowLeft, Search, Calendar, Award, FileText, CheckCircle, HelpCircle, 
  AlertTriangle, Users, BookOpen, Clock, Download, ChevronRight, Zap
} from 'lucide-react';
import { motion } from 'motion/react';

interface MeetingArchiveProps {
  onBackToLobby: () => void;
  onJoinMeeting: (meetingId: string) => void;
}

export default function MeetingArchive({ onBackToLobby, onJoinMeeting }: MeetingArchiveProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const list = await exosAdapter.getMeetings();
        const completed = list.filter(m => m.status === 'completed');
        setMeetings(completed);
        if (completed.length > 0) {
          setSelectedMeeting(completed[0]);
        }
      } catch (err) {
        console.error('Failed to load archive:', err);
      }
    };
    fetchMeetings();
  }, []);

  const filteredMeetings = meetings.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.summary?.summary && m.summary.summary.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDownloadJSON = (meeting: Meeting) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(meeting, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `EXOS_${meeting.id}_Archive.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] bg-gradient-to-b from-[#0F0F12] to-[#0A0A0B] text-slate-200 flex flex-col h-screen overflow-hidden">
      
      {/* Top Header */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            id="archive-back-btn"
            onClick={onBackToLobby}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span>EXOS Boardroom Archives</span>
            </h1>
            <p className="text-[10px] text-slate-400">Search and review historic briefings, decisions, and action packages.</p>
          </div>
        </div>

        {/* Global search */}
        <div className="relative w-72 hidden md:block">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="archive-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript records, summaries..."
            className="w-full bg-slate-900 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
      </header>

      {/* Workspace split */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Meeting List */}
        <aside className="w-80 border-r border-white/5 bg-slate-950/20 overflow-y-auto p-4 flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Previous Briefings</h2>
          {filteredMeetings.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">No completed briefing packages found.</p>
          ) : (
            filteredMeetings.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedMeeting(m)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 relative overflow-hidden group ${
                  selectedMeeting?.id === m.id 
                    ? 'bg-blue-600/10 border-blue-500/40' 
                    : 'bg-slate-900/40 border-white/5 hover:border-white/10 hover:bg-slate-900/60'
                }`}
              >
                {selectedMeeting?.id === m.id && (
                  <div className="absolute top-0 bottom-0 left-0 w-1 bg-blue-500" />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-xs text-slate-200 line-clamp-1 group-hover:text-blue-400 transition-colors">
                    {m.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(m.startTime).toLocaleDateString()}</span>
                  </div>

                  {m.summary?.score && (
                    <div className="mt-2.5 flex items-center gap-1">
                      <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase font-mono">
                        Score: {m.summary.score}/100
                      </span>
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 self-center" />
              </div>
            ))
          )}
        </aside>

        {/* Right Side: Archive Details Dashboard */}
        <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-[#0F0F12] to-[#0A0A0B]">
          {selectedMeeting ? (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Archive Title Card */}
              <div className="p-6 bg-slate-900/50 border border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest font-semibold">Verified Briefing Package</span>
                  <h2 className="text-xl font-bold text-white mt-1">{selectedMeeting.title}</h2>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      {new Date(selectedMeeting.startTime).toLocaleString()}
                    </span>
                    <span className="text-slate-700">•</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-slate-500" />
                      {selectedMeeting.participants.length} Active Participants
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 self-start md:self-center">
                  <button
                    id="archive-download"
                    onClick={() => handleDownloadJSON(selectedMeeting)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-800 border border-white/10 hover:border-white/20 hover:bg-slate-700 text-white rounded-xl transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON</span>
                  </button>
                  <button
                    id="archive-rejoin"
                    onClick={() => onJoinMeeting(selectedMeeting.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 animate-pulse" />
                    <span>Re-enter Room</span>
                  </button>
                </div>
              </div>

              {/* Bento Box Analytics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                
                {/* Score panel */}
                <div className="md:col-span-4 p-5 bg-gradient-to-br from-blue-950/20 to-purple-950/20 border border-blue-500/10 rounded-2xl flex flex-col items-center justify-center text-center">
                  <Award className="w-8 h-8 text-yellow-500 mb-2" />
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold">Alignment Score</span>
                  <span className="text-4xl font-extrabold text-white mt-1 font-sans">
                    {selectedMeeting.summary?.score || 90}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-2 px-4 leading-relaxed">Based on prompt clarity, collaborative decisions, and audit validation.</p>
                </div>

                {/* Summary narrative */}
                <div className="md:col-span-8 p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>Executive Summary</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {selectedMeeting.summary?.summary || "No narrative generated for this boardroom alignment."}
                  </p>
                </div>
              </div>

              {/* Decisions & Actions tab split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Verified Board Decisions */}
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-white/5 pb-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>Board Decisions Logged</span>
                  </h3>
                  {selectedMeeting.summary?.decisions && selectedMeeting.summary.decisions.length > 0 ? (
                    <ul className="space-y-3">
                      {selectedMeeting.summary.decisions.map((dec, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                          <span className="leading-relaxed">{dec}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">No official decisions logged.</p>
                  )}
                </div>

                {/* Assigned Action Items */}
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-white/5 pb-2">
                    <Zap className="w-4 h-4" />
                    <span>Assigned Action Tasks</span>
                  </h3>
                  {selectedMeeting.summary?.actionItems && selectedMeeting.summary.actionItems.length > 0 ? (
                    <div className="space-y-3">
                      {selectedMeeting.summary.actionItems.map((task) => (
                        <div key={task.id} className="p-2.5 bg-slate-950/40 border border-white/5 rounded-xl flex items-center justify-between text-xs gap-2">
                          <div>
                            <p className="font-semibold text-slate-200">{task.text}</p>
                            <p className="text-[10px] text-slate-500 mt-1">Assignee: {task.assignedTo} | Due: {task.dueDate}</p>
                          </div>
                          <span className={`px-2 py-0.5 text-[9px] uppercase font-mono rounded ${
                            task.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                          }`}>
                            {task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No action tasks assigned.</p>
                  )}
                </div>
              </div>

              {/* Risks & Questions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Compliance Risks Cataloged</span>
                  </h3>
                  {selectedMeeting.summary?.risks && selectedMeeting.summary.risks.length > 0 ? (
                    <ul className="space-y-2.5">
                      {selectedMeeting.summary.risks.map((risk, i) => (
                        <li key={i} className="text-xs text-slate-400 leading-relaxed flex gap-2">
                          <span className="text-red-500 font-bold">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">No legal or system risks cataloged.</p>
                  )}
                </div>

                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4" />
                    <span>Open Strategic Questions</span>
                  </h3>
                  {selectedMeeting.summary?.openQuestions && selectedMeeting.summary.openQuestions.length > 0 ? (
                    <ul className="space-y-2.5">
                      {selectedMeeting.summary.openQuestions.map((q, i) => (
                        <li key={i} className="text-xs text-slate-400 leading-relaxed flex gap-2">
                          <span className="text-blue-500 font-bold">?</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">No open items remain outstanding.</p>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
              <Calendar className="w-12 h-12 opacity-10 mb-2" />
              <span>Select a briefing record to load data logs.</span>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
