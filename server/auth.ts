import crypto from 'crypto';

export interface UserSession {
  token: string;
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'moderator' | 'participant' | 'observer';
  clientType: 'desktop_browser' | 'android' | 'tablet' | 'ios' | 'web_portal' | 'voice_device';
  createdAt: string;
  lastSeenAt: string;
  isDev: boolean;
}

class AuthManager {
  private activeSessions = new Map<string, UserSession>();
  
  // Dev credentials - kept securely server-side for development bypass
  private DEV_USERNAME = 'Nicholas Washington';
  private DEV_PASSWORD = 'BANKAI1983';

  /**
   * Validates credentials and creates a secure session token
   */
  public authenticateDev(username: string, password: string, clientType: any): { success: boolean; token?: string; error?: string; session?: UserSession } {
    if (username.trim().toLowerCase() !== this.DEV_USERNAME.toLowerCase()) {
      return { success: false, error: 'Invalid development username.' };
    }
    if (password !== this.DEV_PASSWORD) {
      return { success: false, error: 'Access security password mismatch.' };
    }

    const token = `exos-token-${crypto.randomBytes(16).toString('hex')}`;
    const session: UserSession = {
      token,
      userId: 'dev-nicholas-washington',
      email: 'nicholaswashingtonbackup2@gmail.com',
      name: this.DEV_USERNAME,
      role: 'owner', // Default dev user as Chairperson has 'owner' permissions
      clientType: clientType || 'desktop_browser',
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      isDev: true
    };

    this.activeSessions.set(token, session);
    return { success: true, token, session };
  }

  /**
   * Registers or updates an active session from token verification
   */
  public registerSession(session: UserSession): void {
    this.activeSessions.set(session.token, session);
  }

  /**
   * Resolves a session token to a user session
   */
  public getSession(token: string): UserSession | undefined {
    const session = this.activeSessions.get(token);
    if (session) {
      // Update activity timestamp
      session.lastSeenAt = new Date().toISOString();
      this.activeSessions.set(token, session);
    }
    return session;
  }

  /**
   * Destroys an active session
   */
  public revokeSession(token: string): boolean {
    return this.activeSessions.delete(token);
  }

  /**
   * Lists all active human sessions
   */
  public getActiveSessions(): UserSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Validates if a user has sufficient permission for an operation
   */
  public hasPermission(role: string, requiredRole: string): boolean {
    const roleHierarchy: Record<string, number> = {
      owner: 4,
      moderator: 3,
      participant: 2,
      observer: 1
    };

    const userLevel = roleHierarchy[role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return userLevel >= requiredLevel;
  }
}

export const authManager = new AuthManager();
