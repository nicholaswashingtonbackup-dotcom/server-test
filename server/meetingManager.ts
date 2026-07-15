import fs from 'fs';
import path from 'path';
import { loadServerConfig } from './config';

export interface Participant {
  userId: string;
  name: string;
  role: 'owner' | 'moderator' | 'participant' | 'observer';
  clientType: string;
  joinedAt: string;
}

export interface Executive {
  id: string;
  name: string;
  role: string;
}

export interface MeetingState {
  id: string;
  title: string;
  type: 'one-on-one' | 'board' | 'strategy' | 'emergency' | 'workshop' | 'voice-only' | 'text-only' | 'hybrid';
  status: 'lobby' | 'active' | 'completed';
  startTime: string;
  endTime?: string;
  recordingStatus: 'idle' | 'recording' | 'stopped';
  executives: string[]; // virtual executives authorized
  humans: Map<string, Participant>; // active human participants joined
  messages: any[];
}

class MeetingManager {
  private activeMeetings = new Map<string, MeetingState>();
  private config = loadServerConfig();

  constructor() {
    this.loadFromArchive();
  }

  /**
   * Load metadata from existing archived directories on startup
   */
  private loadFromArchive() {
    try {
      const archiveDir = path.resolve(process.cwd(), this.config.meeting.archive_path);
      if (!fs.existsSync(archiveDir)) return;

      const items = fs.readdirSync(archiveDir);
      for (const item of items) {
        const itemPath = path.join(archiveDir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          const metaPath = path.join(itemPath, 'metadata.json');
          if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            const state: MeetingState = {
              id: meta.id,
              title: meta.title,
              type: meta.type || 'board',
              status: meta.status || 'completed',
              startTime: meta.startTime,
              endTime: meta.endTime,
              recordingStatus: meta.recordingStatus || 'idle',
              executives: meta.executives || [],
              humans: new Map(),
              messages: []
            };
            this.activeMeetings.set(state.id, state);
          }
        }
      }
      console.log(`[EXOS-MEETING] Loaded ${this.activeMeetings.size} meetings from archive directory.`);
    } catch (err) {
      console.error('[EXOS-MEETING] Failed to load archived meetings:', err);
    }
  }

  /**
   * Creates a new meeting
   */
  public createMeeting(title: string, type: any, authorizedExecutives: string[]): MeetingState {
    const meetingId = `meeting-${Date.now()}`;
    const newState: MeetingState = {
      id: meetingId,
      title: title || 'Executive Strategic Alignment',
      type: type || 'board',
      status: 'lobby',
      startTime: new Date().toISOString(),
      recordingStatus: 'idle',
      executives: authorizedExecutives || ['nova'],
      humans: new Map(),
      messages: []
    };

    this.activeMeetings.set(meetingId, newState);
    this.saveMeetingFolder(meetingId, newState);
    console.log(`[EXOS-MEETING] Authoritative meeting state initialized: "${newState.title}" [ID: ${meetingId}]`);
    return newState;
  }

  /**
   * Joins a human participant to a meeting
   */
  public joinParticipant(meetingId: string, participant: Omit<Participant, 'joinedAt'>): { success: boolean; error?: string; meeting?: MeetingState } {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) {
      return { success: false, error: 'Meeting not found.' };
    }

    if (meeting.status === 'completed') {
      return { success: false, error: 'Cannot join an archived or closed meeting session.' };
    }

    // Check capacity limit: max 5 humans!
    if (meeting.humans.size >= this.config.meeting.max_humans && !meeting.humans.has(participant.userId)) {
      return { 
        success: false, 
        error: `Meeting has reached its maximum human capacity of ${this.config.meeting.max_humans} members.` 
      };
    }

    const newParticipant: Participant = {
      ...participant,
      joinedAt: new Date().toISOString()
    };

    meeting.humans.set(participant.userId, newParticipant);
    
    // Automatically transition to 'active' on first human joining if currently lobby
    if (meeting.status === 'lobby' && meeting.humans.size > 0) {
      meeting.status = 'active';
    }

    this.saveMeetingFolder(meetingId, meeting);
    console.log(`[EXOS-MEETING] Human participant ${participant.name} (${participant.role}) joined meeting: ${meetingId}. Capacity: ${meeting.humans.size}/5`);
    return { success: true, meeting };
  }

  /**
   * Human participant leaves a meeting
   */
  public leaveParticipant(meetingId: string, userId: string): boolean {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) return false;

    const removed = meeting.humans.delete(userId);
    if (removed) {
      this.saveMeetingFolder(meetingId, meeting);
      console.log(`[EXOS-MEETING] Human participant [ID: ${userId}] left meeting ${meetingId}. Current capacity: ${meeting.humans.size}/5`);
    }
    return removed;
  }

  /**
   * Retrieves active meeting state
   */
  public getMeeting(meetingId: string): MeetingState | undefined {
    return this.activeMeetings.get(meetingId);
  }

  /**
   * Lists all active or archived meetings
   */
  public listMeetings(): MeetingState[] {
    return Array.from(this.activeMeetings.values());
  }

  /**
   * Sets meeting recording status
   */
  public setRecording(meetingId: string, status: 'idle' | 'recording' | 'stopped'): boolean {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) return false;

    meeting.recordingStatus = status;
    this.saveMeetingFolder(meetingId, meeting);
    return true;
  }

  /**
   * Closes/archives the meeting session
   */
  public closeMeeting(meetingId: string, summaryMarkdown?: string, decisions?: string[], actionItems?: any[]): { success: boolean; error?: string } {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) {
      return { success: false, error: 'Meeting not found.' };
    }

    meeting.status = 'completed';
    meeting.endTime = new Date().toISOString();
    
    // Write summary and action items files
    this.saveMeetingFolder(meetingId, meeting);
    this.writeArchiveArtifacts(meetingId, summaryMarkdown, decisions, actionItems);
    
    console.log(`[EXOS-MEETING] Authoritative meeting archived and closed successfully: ${meetingId}`);
    return { success: true };
  }

  /**
   * Appends an authoritative meeting message (human or executive)
   */
  public addMessage(meetingId: string, message: any): void {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) return;

    meeting.messages.push(message);
    this.saveTranscript(meetingId, meeting.messages);
  }

  /**
   * Save meeting folder structural files
   */
  private saveMeetingFolder(meetingId: string, state: MeetingState) {
    try {
      const folderPath = path.resolve(process.cwd(), this.config.meeting.archive_path, meetingId);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        fs.mkdirSync(path.join(folderPath, 'recordings'), { recursive: true });
        fs.mkdirSync(path.join(folderPath, 'artifacts'), { recursive: true });
        fs.mkdirSync(path.join(folderPath, 'exports'), { recursive: true });
      }

      // Prepare clean serializable metadata (omit Map object)
      const serializableMeta = {
        id: state.id,
        title: state.title,
        type: state.type,
        status: state.status,
        startTime: state.startTime,
        endTime: state.endTime,
        recordingStatus: state.recordingStatus,
        executives: state.executives,
        humansJoinedCount: state.humans.size,
        humansList: Array.from(state.humans.values())
      };

      fs.writeFileSync(
        path.join(folderPath, 'metadata.json'),
        JSON.stringify(serializableMeta, null, 2),
        'utf8'
      );
    } catch (err) {
      console.error(`[EXOS-MEETING] Error saving meeting folder for ${meetingId}:`, err);
    }
  }

  /**
   * Save transcript file inside the meeting folder
   */
  private saveTranscript(meetingId: string, messages: any[]) {
    try {
      const folderPath = path.resolve(process.cwd(), this.config.meeting.archive_path, meetingId);
      if (!fs.existsSync(folderPath)) return;

      fs.writeFileSync(
        path.join(folderPath, 'transcript.json'),
        JSON.stringify(messages, null, 2),
        'utf8'
      );
    } catch (err) {
      console.error(`[EXOS-MEETING] Error saving transcript for ${meetingId}:`, err);
    }
  }

  /**
   * Writes detailed summary and decisions markdown artifacts on closure
   */
  private writeArchiveArtifacts(meetingId: string, summary?: string, decisions?: string[], actionItems?: any[]) {
    try {
      const folderPath = path.resolve(process.cwd(), this.config.meeting.archive_path, meetingId);
      if (!fs.existsSync(folderPath)) return;

      // Never overwrite existing compiled files if they exist
      const summaryPath = path.join(folderPath, 'summary.md');
      if (!fs.existsSync(summaryPath)) {
        fs.writeFileSync(
          summaryPath,
          summary || `# Executive Meeting Summary\n\nMeeting session completed with alignment.`,
          'utf8'
        );
      }

      const decisionsPath = path.join(folderPath, 'decisions.md');
      if (!fs.existsSync(decisionsPath)) {
        const decisionsMd = decisions 
          ? `# Executive Strategic Decisions Reached\n\n` + decisions.map(d => `- [APPROVED] ${d}`).join('\n')
          : `# Executive Strategic Decisions Reached\n\nNo structured decisions were logged.`;
        fs.writeFileSync(decisionsPath, decisionsMd, 'utf8');
      }

      const actionItemsPath = path.join(folderPath, 'action_items.md');
      if (!fs.existsSync(actionItemsPath)) {
        const actionMd = actionItems
          ? `# Action Items Dispatch Queue\n\n` + actionItems.map(item => `- [ ] **${item.assignedTo || 'Unassigned'}**: ${item.text} (Due: ${item.dueDate || 'N/A'})`).join('\n')
          : `# Action Items Dispatch Queue\n\nNo pending action items were dispatched.`;
        fs.writeFileSync(actionItemsPath, actionMd, 'utf8');
      }
    } catch (err) {
      console.error(`[EXOS-MEETING] Error compiling closed meeting artifacts:`, err);
    }
  }
}

export const meetingManager = new MeetingManager();
