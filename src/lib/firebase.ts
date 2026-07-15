import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if available
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Cloud Storage
export const storage = getStorage(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// App Check Readiness Scaffold
// Future production environments can activate App Check using the following scaffold:
// import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
// if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
//   initializeAppCheck(app, {
//     provider: new ReCaptchaEnterpriseProvider('YOUR_RECAPTCHA_SITE_KEY'),
//     isTokenAutoRefreshEnabled: true
//   });
// }

// Google Sign-In helper using popup (iframe compatible)
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

// Email/Password Sign-In helper
export async function signInWithEmail(email: string, password: string): Promise<User> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error('Email Sign-In Error:', error);
    throw error;
  }
}

// Email/Password Sign-Up helper
export async function signUpWithEmail(email: string, password: string): Promise<User> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error('Email Sign-Up Error:', error);
    throw error;
  }
}

// Sign-Out helper
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign-Out Error:', error);
    throw error;
  }
}

// Check/Sync User Profile with Firestore
export async function syncUserProfile(user: User, customDisplayName?: string, customRole?: 'Chairperson' | 'Executive' | 'Auditor' | 'Observer') {
  const userRef = doc(db, 'users', user.uid);
  try {
    const userSnap = await getDoc(userRef);
    const now = new Date().toISOString();
    
    let profile: any;
    
    if (userSnap.exists()) {
      const existingData = userSnap.data();
      profile = {
        userId: user.uid,
        name: existingData.name || existingData.displayName || customDisplayName || user.displayName || 'Nicholas Washington',
        displayName: existingData.displayName || customDisplayName || user.displayName || 'Nicholas Washington',
        email: existingData.email || user.email || '',
        avatar: existingData.avatar || user.photoURL || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
        organization: existingData.organization || 'EXOS Enterprise',
        role: existingData.role || customRole || 'Chairperson',
        meetingPermissions: existingData.meetingPermissions || ['create_meeting', 'join_meeting', 'invite_executive', 'moderate'],
        mfaEnabled: existingData.mfaEnabled || false,
        createdAt: existingData.createdAt || now,
        lastSeenAt: now
      };
      
      // Update last seen in Firestore
      await setDoc(userRef, { lastSeenAt: now }, { merge: true });
    } else {
      const finalName = customDisplayName || user.displayName || 'Nicholas Washington';
      profile = {
        userId: user.uid,
        name: finalName,
        displayName: finalName,
        email: user.email || '',
        avatar: user.photoURL || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
        organization: 'EXOS Enterprise',
        role: customRole || 'Chairperson',
        meetingPermissions: ['create_meeting', 'join_meeting', 'invite_executive', 'moderate'],
        mfaEnabled: false, // Leave MFA off during development, but schema supports it
        createdAt: now,
        lastSeenAt: now
      };
      
      // Save newly registered user to Firestore
      await setDoc(userRef, profile);
    }
    return profile;
  } catch (error) {
    console.error('Error syncing user profile in Firestore:', error);
    const now = new Date().toISOString();
    const finalName = customDisplayName || user.displayName || 'Nicholas Washington';
    // Return local representation if Firestore fails or offline
    return {
      userId: user.uid,
      name: finalName,
      displayName: finalName,
      email: user.email || '',
      avatar: user.photoURL || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
      organization: 'EXOS Enterprise',
      role: customRole || ('Chairperson' as const),
      meetingPermissions: ['create_meeting', 'join_meeting', 'invite_executive', 'moderate'],
      mfaEnabled: false,
      createdAt: now,
      lastSeenAt: now
    };
  }
}
