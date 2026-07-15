export type ExecutiveId = 'nova' | 'astra' | 'fuego' | 'jarvis' | 'sisters' | 'board';

export interface Executive {
  id: ExecutiveId;
  name: string;
  avatar: string;
  status: 'Speaking' | 'Thinking' | 'Listening' | 'Busy' | 'Offline' | 'Typing';
  voice: string;
  description: string;
  availability: string;
}

export interface Message {
  id: string;
  meetingId: string;
  senderId: string;
  senderName: string;
  senderType: 'human' | 'executive';
  text: string;
  timestamp: string;
  isStreaming?: boolean;
  isVoice?: boolean;
  audioUrl?: string;
}

export interface Participant {
  id: string;
  name: string;
  role: 'Chairperson' | 'Executive' | 'Auditor' | 'Observer';
  email: string;
  isCameraOn: boolean;
  isMicOn: boolean;
  isScreenSharing: boolean;
  isRaisingHand: boolean;
  isPresent: boolean;
}

export interface Task {
  id: string;
  text: string;
  assignedTo: string;
  dueDate: string;
  status: 'pending' | 'completed';
}

export interface TimelineItem {
  time: string;
  event: string;
}

export interface Artifact {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string;
  uploadedBy: string;
  timestamp: string;
}

export interface MeetingSummary {
  summary: string;
  decisions: string[];
  actionItems: Task[];
  risks: string[];
  openQuestions: string[];
  timeline: TimelineItem[];
  score: number; // meeting score out of 100
  artifactList: Artifact[];
}

export type MeetingType = 'one-on-one' | 'one-on-one-voice' | 'one-on-one-text' | 'board' | 'workshop';

export interface Meeting {
  id: string;
  title: string;
  type: MeetingType;
  status: 'lobby' | 'active' | 'completed';
  startTime: string;
  endTime?: string;
  executives: ExecutiveId[];
  participants: string[]; // participant ids
  recordingStatus: 'idle' | 'recording' | 'stopped';
  recordingConsentApproved: boolean;
  recordingConsentRequested: boolean;
  summary?: MeetingSummary;
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, number>; // option index -> vote count
  votedUsers: string[]; // user emails or ids
  active: boolean;
}

export interface WhiteboardElement {
  id: string;
  type: 'path' | 'text' | 'rect' | 'circle';
  points?: number[];
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color: string;
}
