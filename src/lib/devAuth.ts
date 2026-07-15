import { UserProfile } from '../App';

export const DEV_USERNAME = 'Nicholas Washington';
// Temporary development authentication module password
const DEV_PASSWORD = 'BANKAI1983';

export interface DevLoginResult {
  success: boolean;
  error?: string;
  user?: UserProfile;
}

/**
 * Validates development login credentials.
 * Authentication bypass is for DEVELOPMENT ONLY.
 * No MFA, Firebase auth, email verification, or one-time codes are required.
 */
export async function loginWithDevCredentials(username: string, password: string): Promise<DevLoginResult> {
  if (!username || username.trim().toLowerCase() !== DEV_USERNAME.toLowerCase()) {
    return {
      success: false,
      error: 'Invalid development username. Expected: Nicholas Washington.'
    };
  }

  if (password !== DEV_PASSWORD) {
    return {
      success: false,
      error: 'Access security password mismatch. Unauthorized.'
    };
  }

  const now = new Date().toISOString();
  const devUser: UserProfile = {
    userId: 'dev-nicholas-washington',
    name: DEV_USERNAME,
    displayName: DEV_USERNAME,
    email: 'nicholaswashingtonbackup2@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
    organization: 'EXOS Enterprise',
    role: 'Chairperson',
    meetingPermissions: ['create_meeting', 'join_meeting', 'invite_executive', 'moderate'],
    mfaEnabled: false,
    createdAt: now,
    lastSeenAt: now,
    sessionEstablishedAt: now,
    isDev: true // Marker for the development session
  };

  return {
    success: true,
    user: devUser
  };
}

/**
 * Helper to check if a user profile represents a development bypass session.
 */
export function isDevelopmentSession(user: any): boolean {
  return !!(user && (user.isDev || user.userId === 'dev-nicholas-washington'));
}
