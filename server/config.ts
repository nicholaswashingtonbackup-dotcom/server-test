import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';

export interface ServerConfig {
  server: {
    host: string;
    port: number;
    tls: {
      enabled: boolean;
      certPath?: string;
      keyPath?: string;
    };
  };
  meeting: {
    max_humans: number;
    archive_path: string;
  };
  websocket: {
    enabled: boolean;
    heartbeat: number;
    reconnect_timeout: number;
  };
  permissions: string[];
}

let loadedConfig: ServerConfig | null = null;

export function loadServerConfig(): ServerConfig {
  if (loadedConfig) return loadedConfig;

  const yamlPath = path.resolve(process.cwd(), 'meeting_server.yaml');
  try {
    if (fs.existsSync(yamlPath)) {
      const fileContents = fs.readFileSync(yamlPath, 'utf8');
      const doc = yaml.load(fileContents) as any;
      
      loadedConfig = {
        server: {
          host: doc?.server?.host || '0.0.0.0',
          port: doc?.server?.port || 3000,
          tls: {
            enabled: doc?.server?.tls?.enabled || false,
            certPath: doc?.server?.tls?.certPath,
            keyPath: doc?.server?.tls?.keyPath,
          }
        },
        meeting: {
          max_humans: doc?.meeting?.max_humans ?? 5,
          archive_path: doc?.meeting?.archive_path || 'meetings/'
        },
        websocket: {
          enabled: doc?.websocket?.enabled ?? true,
          heartbeat: doc?.websocket?.heartbeat ?? 30,
          reconnect_timeout: doc?.websocket?.reconnect_timeout ?? 60
        },
        permissions: doc?.permissions || ['owner', 'moderator', 'participant', 'observer']
      };
      
      console.log('[EXOS-CONFIG] Server configuration loaded from meeting_server.yaml successfully.');
    } else {
      throw new Error('meeting_server.yaml not found');
    }
  } catch (error) {
    console.warn('[EXOS-CONFIG] Warning: Could not parse meeting_server.yaml. Using robust default configuration.', error);
    loadedConfig = {
      server: {
        host: '0.0.0.0',
        port: 3000,
        tls: { enabled: false }
      },
      meeting: {
        max_humans: 5,
        archive_path: 'meetings/'
      },
      websocket: {
        enabled: true,
        heartbeat: 30,
        reconnect_timeout: 60
      },
      permissions: ['owner', 'moderator', 'participant', 'observer']
    };
  }

  // Create meetings archive directory if it doesn't exist
  try {
    const archiveFullPath = path.resolve(process.cwd(), loadedConfig.meeting.archive_path);
    if (!fs.existsSync(archiveFullPath)) {
      fs.mkdirSync(archiveFullPath, { recursive: true });
      console.log(`[EXOS-CONFIG] Created meetings archive directory at: ${archiveFullPath}`);
    }
  } catch (dirErr) {
    console.error('[EXOS-CONFIG] Failed to initialize meetings directory:', dirErr);
  }

  return loadedConfig;
}
