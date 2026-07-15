import { Meeting, Message, Executive, ExecutiveId, Poll, WhiteboardElement, MeetingSummary } from '../types';

const API_BASE = '/api';

// Cache for offline support
const offlineCache = {
  getMeetings: (): Meeting[] => {
    try {
      return JSON.parse(localStorage.getItem('emp_meetings') || '[]');
    } catch {
      return [];
    }
  },
  saveMeetings: (meetings: Meeting[]) => {
    localStorage.setItem('emp_meetings', JSON.stringify(meetings));
  },
  getMessages: (meetingId: string): Message[] => {
    try {
      return JSON.parse(localStorage.getItem(`emp_messages_${meetingId}`) || '[]');
    } catch {
      return [];
    }
  },
  saveMessages: (meetingId: string, messages: Message[]) => {
    localStorage.setItem(`emp_messages_${meetingId}`, JSON.stringify(messages));
  },
};

export const EXOS_EXECUTIVES: Record<ExecutiveId, Executive> = {
  nova: {
    id: 'nova',
    name: 'Nova',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
    status: 'Offline',
    voice: 'Zephyr',
    description: 'Chief Operating Officer & Strategic Advisor. Excels in operational efficiency, metrics, scaling, and market expansion.',
    availability: 'Available for Board Meetings & 1-on-1 Strategy',
  },
  astra: {
    id: 'astra',
    name: 'Astra',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
    status: 'Offline',
    voice: 'Kore',
    description: 'Chief Technology Officer. Advisor on product design, architecture, engineering scaling, tech stack selection, and AI.',
    availability: 'Available for Technical Audits & Workshops',
  },
  fuego: {
    id: 'fuego',
    name: 'Fuego',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
    status: 'Offline',
    voice: 'Fenrir',
    description: 'Chief Growth & Marketing Officer. Expert in branding, launch campaigns, viral mechanics, user acquisition, and SEO.',
    availability: 'Available for Marketing Brainstorms & Workshops',
  },
  jarvis: {
    id: 'jarvis',
    name: 'Jarvis',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
    status: 'Offline',
    voice: 'Charon',
    description: 'General Counsel & Risk Officer. Specializes in compliance, data privacy, terms drafting, audits, and risk modeling.',
    availability: 'Available for Policy Review & Auditing',
  },
  sisters: {
    id: 'sisters',
    name: 'Sisters (CFO Co-heads)',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=150&h=150&q=80',
    status: 'Offline',
    voice: 'Puck',
    description: 'Joint Chief Financial Officers. Experts in unit economics, margin optimization, runway management, and financial projections.',
    availability: 'Available for Financial Modeling & Audits',
  },
  board: {
    id: 'board',
    name: 'Executive Board',
    avatar: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=150&h=150&q=80',
    status: 'Offline',
    voice: 'Multi-Speaker',
    description: 'A collaborative forum representing Nova, Astra, Fuego, Jarvis, and Sisters. Bounces ideas in a highly unified executive discussion.',
    availability: 'Available for Strategic Workshops & Full Board Review',
  },
};

export const exosAdapter = {
  isOnline: () => navigator.onLine,

  async getMeetings(): Promise<Meeting[]> {
    try {
      const response = await fetch(`${API_BASE}/meetings`);
      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      offlineCache.saveMeetings(data);
      return data;
    } catch (e) {
      console.warn('Using offline meeting cache:', e);
      return offlineCache.getMeetings();
    }
  },

  async getMeeting(id: string): Promise<Meeting> {
    try {
      const response = await fetch(`${API_BASE}/meetings/${id}`);
      if (!response.ok) throw new Error('Meeting not found');
      return await response.json();
    } catch (e) {
      console.warn(`Meeting ${id} fetch failed, checking offline cache:`, e);
      const meetings = offlineCache.getMeetings();
      const cached = meetings.find(m => m.id === id);
      if (cached) return cached;
      throw e;
    }
  },

  async createMeeting(meeting: Omit<Meeting, 'id' | 'status' | 'recordingStatus' | 'recordingConsentApproved' | 'recordingConsentRequested'>): Promise<Meeting> {
    const response = await fetch(`${API_BASE}/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meeting),
    });
    if (!response.ok) throw new Error('Failed to create meeting');
    const newMeeting = await response.json();
    
    // Update local offline cache
    const current = offlineCache.getMeetings();
    offlineCache.saveMeetings([newMeeting, ...current]);
    return newMeeting;
  },

  async deleteMeeting(id: string): Promise<void> {
    await fetch(`${API_BASE}/meetings/${id}`, { method: 'DELETE' });
    const current = offlineCache.getMeetings();
    offlineCache.saveMeetings(current.filter(m => m.id !== id));
  },

  async updateMeeting(id: string, updates: Partial<Meeting>): Promise<Meeting> {
    const response = await fetch(`${API_BASE}/meetings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update meeting');
    const updated = await response.json();
    
    const current = offlineCache.getMeetings();
    offlineCache.saveMeetings(current.map(m => m.id === id ? { ...m, ...updated } : m));
    return updated;
  },

  async getMessages(meetingId: string): Promise<Message[]> {
    try {
      const response = await fetch(`${API_BASE}/meetings/${meetingId}/messages`);
      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      offlineCache.saveMessages(meetingId, data);
      return data;
    } catch (e) {
      console.warn('Using offline messages cache:', e);
      return offlineCache.getMessages(meetingId);
    }
  },

  async sendMessage(
    meetingId: string, 
    senderId: string, 
    senderName: string, 
    text: string, 
    executiveId?: ExecutiveId,
    isVoice = false
  ): Promise<{ userMessage: Message; exosMessage: Message }> {
    const response = await fetch(`${API_BASE}/meetings/${meetingId}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId, senderName, text, executiveId, isVoice }),
    });
    if (!response.ok) throw new Error('Failed to communicate with EXOS');
    const data = await response.json();

    // Cache updated messages
    const currentMessages = offlineCache.getMessages(meetingId);
    const updatedList = [...currentMessages, data.userMessage, data.exosMessage];
    offlineCache.saveMessages(meetingId, updatedList);

    return data;
  },

  async requestRecordingConsent(meetingId: string): Promise<boolean> {
    const response = await fetch(`${API_BASE}/meetings/${meetingId}/recording/request-consent`, {
      method: 'POST',
    });
    const data = await response.json();
    return data.approved;
  },

  async toggleRecording(meetingId: string, start: boolean): Promise<Meeting> {
    const response = await fetch(`${API_BASE}/meetings/${meetingId}/recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: start ? 'start' : 'stop' }),
    });
    return await response.json();
  },

  async getPolls(meetingId: string): Promise<Poll[]> {
    const response = await fetch(`${API_BASE}/meetings/${meetingId}/polls`);
    return await response.json();
  },

  async createPoll(meetingId: string, question: string, options: string[]): Promise<Poll> {
    const response = await fetch(`${API_BASE}/meetings/${meetingId}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, options }),
    });
    return await response.json();
  },

  async voteInPoll(meetingId: string, pollId: string, optionIndex: number, userId: string): Promise<Poll> {
    const response = await fetch(`${API_BASE}/meetings/${meetingId}/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionIndex, userId }),
    });
    return await response.json();
  },

  async getWhiteboard(meetingId: string): Promise<WhiteboardElement[]> {
    const response = await fetch(`${API_BASE}/meetings/${meetingId}/whiteboard`);
    return await response.json();
  },

  async saveWhiteboardElement(meetingId: string, element: WhiteboardElement): Promise<WhiteboardElement> {
    const response = await fetch(`${API_BASE}/meetings/${meetingId}/whiteboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(element),
    });
    return await response.json();
  },

  async clearWhiteboard(meetingId: string): Promise<void> {
    await fetch(`${API_BASE}/meetings/${meetingId}/whiteboard`, { method: 'DELETE' });
  },

  async generatePostMeetingArtifacts(meetingId: string): Promise<MeetingSummary> {
    const response = await fetch(`${API_BASE}/meetings/${meetingId}/post-summary`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to generate summary');
    return await response.json();
  },
};
