import React, { useState } from 'react';
import { Shield, Mail, Lock, CheckCircle, ArrowRight, UserCheck, KeyRound, User, Briefcase, Key, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithGoogle, syncUserProfile, signInWithEmail, signUpWithEmail } from '../lib/firebase';
import { UserProfile } from '../App';
import { loginWithDevCredentials, DEV_USERNAME } from '../lib/devAuth';

// Toggle to enable/disable MFA requirement during development
const EXTENSIBLE_MFA_ENABLED = false;

interface AuthScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [devUsername, setDevUsername] = useState(DEV_USERNAME);
  const [devPassword, setDevPassword] = useState('');

  const [email, setEmail] = useState('nicholaswashingtonbackup2@gmail.com');
  const [password, setPassword] = useState('123456'); // Standard corporate test password
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'Chairperson' | 'Executive' | 'Auditor' | 'Observer'>('Chairperson');
  const [step, setStep] = useState<'login' | 'mfa'>('login');
  const [mfaCode, setMfaCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDevLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await loginWithDevCredentials(devUsername, devPassword);
      if (!result.success || !result.user) {
        throw new Error(result.error || 'Access denied.');
      }

      const profile = result.user;

      // Sync active session on Express server so backend APIs can run with current identity
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          name: profile.name,
          role: profile.role,
          avatar: profile.avatar,
          mfaEnabled: false,
          idToken: null // indicate local development bypass
        })
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to synchronize development session on the server.');
      }

      // Navigate directly into the Executive Meeting Platform
      onLoginSuccess(profile);
    } catch (err: any) {
      console.error('[EXOS] Dev login failure:', err);
      setError(err.message || 'Access denied.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please fill in your corporate credential email.');
      return;
    }
    if (!password) {
      setError('Please enter your access security password.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      let firebaseUser;
      let profile;

      if (isSignUp) {
        if (!displayName.trim()) {
          throw new Error('Please enter your full displayName for your corporate ID.');
        }
        // Real register
        firebaseUser = await signUpWithEmail(email, password);
        profile = await syncUserProfile(firebaseUser, displayName, selectedRole);
      } else {
        // Real login
        firebaseUser = await signInWithEmail(email, password);
        profile = await syncUserProfile(firebaseUser);
      }

      const idToken = await firebaseUser.getIdToken();

      // Establish secure EXOS session with credentials
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          name: profile.name,
          role: profile.role,
          avatar: profile.avatar,
          mfaEnabled: EXTENSIBLE_MFA_ENABLED,
          idToken
        })
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to establish secure session with EXOS Operating System');
      }

      if (EXTENSIBLE_MFA_ENABLED) {
        setIsLoading(false);
        setStep('mfa');
      } else {
        onLoginSuccess({
          ...profile,
          mfaEnabled: false
        });
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || 'Failed to authenticate corporate credentials.';
      if (err.code === 'auth/invalid-credential') {
        errMsg = 'Invalid corporate credentials. Check email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'This email is already registered. Try logging in.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Security password must be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Invalid corporate email format.';
      }
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length < 4) {
      setError('Please enter your 6-digit corporate security MFA token.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      onLoginSuccess({
        userId: 'local-credentials-nicholas',
        name: 'Nicholas Washington',
        displayName: 'Nicholas Washington',
        email,
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
        organization: 'EXOS Enterprise',
        role: 'Chairperson',
        meetingPermissions: ['create_meeting', 'join_meeting', 'invite_executive', 'moderate'],
        mfaEnabled: true,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      });
    } catch (err: any) {
      setError('MFA token validation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const user = await signInWithGoogle();
      const idToken = await user.getIdToken();
      const profile = await syncUserProfile(user);
      
      // Establish secure session with EXOS
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          name: profile.name,
          role: profile.role,
          avatar: profile.avatar,
          mfaEnabled: EXTENSIBLE_MFA_ENABLED,
          idToken
        })
      });
      
      if (!sessionResponse.ok) {
        throw new Error('Failed to establish secure session with EXOS Operating System');
      }
      
      if (EXTENSIBLE_MFA_ENABLED) {
        setStep('mfa');
      } else {
        onLoginSuccess({
          ...profile,
          mfaEnabled: false
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication with EXOS failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black px-4 relative overflow-hidden">
      
      {/* Background Decorative Rings */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Auth Content Container */}
      <div className="w-full max-w-md bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10 overflow-hidden">
        
        {/* Glow Header accent */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-teal-500" />

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white font-sans">
            EXOS Client Portal
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Executive Operating System Authentication
          </p>
        </div>

        {/* Development Mode Banner */}
        <div id="dev-mode-banner" className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl text-xs mb-6 text-left space-y-1">
          <div className="font-bold tracking-wider uppercase flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            DEVELOPMENT MODE
          </div>
          <p className="text-slate-300 font-sans text-[11px]">Authentication bypass enabled.</p>
          <p className="text-slate-500 text-[9px] uppercase font-mono font-bold">Not for production.</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs mb-4 text-center">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'login' ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Active simple development login */}
              <form onSubmit={handleDevLoginSubmit} className="space-y-4">
                <div className="text-left">
                  <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Development Bypass Authentication
                  </h3>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="dev-auth-username"
                      type="text"
                      required
                      value={devUsername}
                      onChange={(e) => setDevUsername(e.target.value)}
                      className="w-full bg-slate-900/60 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all outline-none"
                      placeholder="Nicholas Washington"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="dev-auth-password"
                      type="password"
                      required
                      value={devPassword}
                      onChange={(e) => setDevPassword(e.target.value)}
                      className="w-full bg-slate-900/60 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all outline-none"
                      placeholder="BANKAI1983"
                    />
                  </div>
                </div>

                <button
                  id="btn-dev-login-submit"
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm py-3.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Access Platform</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* SSO Google Login & Firebase Form partition: Left intact but disabled */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                  <span className="bg-slate-950 px-3 text-slate-500 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    Production Authentication (Disabled)
                  </span>
                </div>
              </div>

              <div className="opacity-30 pointer-events-none select-none relative space-y-4">
                <div className="absolute inset-0 bg-transparent z-50 cursor-not-allowed" title="Production credentials disabled in Development Mode" />
                
                {/* INTACT ORIGINAL FORM BODY */}
                <div className="space-y-4">
                  {isSignUp && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                          Full Name
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            id="auth-name"
                            type="text"
                            disabled
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-slate-900/60 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none"
                            placeholder="Nicholas Washington"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                          Corporate Role
                        </label>
                        <div className="relative">
                          <Briefcase className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <select
                            id="auth-role"
                            disabled
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value as any)}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none appearance-none"
                          >
                            <option value="Chairperson" className="bg-slate-950">Chairperson</option>
                            <option value="Executive" className="bg-slate-950">Executive</option>
                            <option value="Auditor" className="bg-slate-950">Auditor</option>
                            <option value="Observer" className="bg-slate-950">Observer</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                      Corporate Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-email"
                        type="email"
                        disabled
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-900/60 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none"
                        placeholder="name@exos-portal.com"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Password
                      </label>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-password"
                        type="password"
                        disabled
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-900/60 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button
                    id="btn-login-submit"
                    type="button"
                    disabled
                    className="w-full bg-blue-600/50 text-white/50 font-medium text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 mt-2"
                  >
                    <span>{isSignUp ? "Initialize Operating Profile" : "Verify Credentials"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-slate-950 px-3 text-slate-500">Secure Single Sign-On</span>
                    </div>
                  </div>

                  <button
                    id="btn-google-login"
                    type="button"
                    disabled
                    className="w-full bg-gradient-to-r from-blue-600/50 to-purple-600/50 text-white/50 font-semibold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-3"
                  >
                    <span>Google Security Login</span>
                  </button>

                  <div className="text-center mt-6 pt-2">
                    <button
                      type="button"
                      disabled
                      className="text-xs text-blue-400/50 cursor-not-allowed"
                    >
                      {isSignUp 
                        ? "Already have an EXOS profile? Sign In" 
                        : "Need a corporate credential profile? Register"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="mfa"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleMfaSubmit}
              className="space-y-4 text-center"
            >
              <div className="inline-flex p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl mb-2 text-purple-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-medium text-white">MFA Verification</h2>
              <p className="text-xs text-slate-400 px-6">
                Enter the multi-factor security code generated on your designated corporate security device.
              </p>

              <div className="py-4">
                <input
                  id="mfa-input"
                  type="text"
                  maxLength={6}
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="0 0 0 0 0 0"
                  className="w-48 text-center bg-slate-900 border border-white/20 rounded-xl py-3 text-2xl font-mono tracking-widest text-blue-400 focus:outline-none focus:border-blue-500 transition-all outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  id="btn-mfa-back"
                  type="button"
                  onClick={() => setStep('login')}
                  className="flex-1 bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white rounded-xl py-2.5 text-xs font-medium cursor-pointer"
                >
                  Back
                </button>
                <button
                  id="btn-mfa-verify"
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl py-2.5 text-xs font-medium cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Authenticate</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-slate-500 pt-3">
                Secure Session expires in 60 minutes. Logged audibly on EXOS audit network.
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
