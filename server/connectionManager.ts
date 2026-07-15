export interface ActiveConnection {
  connectionId: string;
  userId: string;
  name: string;
  role: string;
  clientType: 'desktop_browser' | 'android' | 'tablet' | 'ios' | 'web_portal' | 'voice_device';
  meetingId: string;
  lastPing: number;
  ipAddress: string;
}

class ConnectionManager {
  private activeConnections = new Map<string, ActiveConnection>();

  /**
   * Tracks/registers a live connection
   */
  public registerConnection(
    connectionId: string, 
    userId: string, 
    name: string, 
    role: string, 
    clientType: any, 
    meetingId: string,
    ipAddress?: string
  ): ActiveConnection {
    const conn: ActiveConnection = {
      connectionId,
      userId,
      name,
      role,
      clientType: clientType || 'desktop_browser',
      meetingId,
      lastPing: Date.now(),
      ipAddress: ipAddress || '127.0.0.1'
    };

    this.activeConnections.set(connectionId, conn);
    console.log(`[EXOS-CONN] Active connection established for [${conn.clientType}] ${name} [ID: ${connectionId}] in meeting ${meetingId}.`);
    return conn;
  }

  /**
   * Updates last ping timestamp for heartbeats
   */
  public registerHeartbeat(connectionId: string): boolean {
    const conn = this.activeConnections.get(connectionId);
    if (!conn) return false;
    
    conn.lastPing = Date.now();
    this.activeConnections.set(connectionId, conn);
    return true;
  }

  /**
   * Removes a connection
   */
  public removeConnection(connectionId: string): boolean {
    const removed = this.activeConnections.delete(connectionId);
    if (removed) {
      console.log(`[EXOS-CONN] Closed connection: ${connectionId}`);
    }
    return removed;
  }

  /**
   * Lists all active connections in a specific meeting
   */
  public getMeetingConnections(meetingId: string): ActiveConnection[] {
    return Array.from(this.activeConnections.values()).filter(c => c.meetingId === meetingId);
  }

  /**
   * Lists all active connections on the server
   */
  public getAllConnections(): ActiveConnection[] {
    return Array.from(this.activeConnections.values());
  }

  /**
   * Purges dead/stale connections (e.g. older than heartbeat window + threshold)
   */
  public purgeStaleConnections(timeoutSeconds: number): ActiveConnection[] {
    const now = Date.now();
    const threshold = timeoutSeconds * 1000;
    const purged: ActiveConnection[] = [];

    for (const [id, conn] of this.activeConnections.entries()) {
      if (now - conn.lastPing > threshold) {
        purged.push(conn);
        this.activeConnections.delete(id);
        console.log(`[EXOS-CONN] Purging stale connection [ID: ${id}] for ${conn.name} (No ping in ${timeoutSeconds}s).`);
      }
    }

    return purged;
  }
}

export const connectionManager = new ConnectionManager();
