import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  FolderKanban,
  Clock,
  UserX,
  Lock,
} from 'lucide-react';
import { formatDateTimeDDMMYYYY } from '../utils/dateUtils';

export const AuthScreen: React.FC = () => {
  const {
    currentUser,
    userProfile,
    loading,
    loginWithGoogle,
    logout,
    refreshProfile,
  } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // If user is authenticated with Google
  if (currentUser) {
    // 1. Account Deactivated
    if (userProfile?.approvalStatus === 'DISABLED') {
      return (
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4 selection:bg-rose-600 selection:text-white">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center animate-in fade-in">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-5 border border-rose-200">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Account Deactivated</h2>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Your account (<span className="font-mono font-medium text-slate-800">{currentUser.email}</span>) has been deactivated by a System Administrator. Please contact management to re-enable your access.
            </p>
            <button
              onClick={() => logout()}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition shadow-xs cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    // 2. Access Request Rejected
    if (userProfile?.approvalStatus === 'REJECTED') {
      return (
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4 selection:bg-rose-600 selection:text-white">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center animate-in fade-in">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-5 border border-rose-200">
              <UserX className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Not Approved</h2>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Your registration request for <span className="font-mono font-medium text-slate-800">{currentUser.email}</span> was reviewed by an Administrator and was not approved. Please reach out to your system administrator if you believe this was done in error.
            </p>
            <button
              onClick={() => logout()}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition shadow-xs cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    // 3. Waiting for Administrator Approval
    // (Rendered for all authenticated users who have not yet been approved)
    const displayName = currentUser.displayName || userProfile?.name || currentUser.email?.split('@')[0] || 'Google User';
    const photoURL = currentUser.photoURL || userProfile?.photoURL;
    const email = currentUser.email || userProfile?.email || '';
    const role = userProfile?.role || 'SALESPERSON';
    const createdAtStr = userProfile?.createdAt ? formatDateTimeDDMMYYYY(userProfile.createdAt) : 'Submitted recently';

    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4 selection:bg-amber-600 selection:text-white">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-7 sm:p-8 border border-slate-200 text-center animate-in fade-in">
          {/* Amber Clock Icon with Pulse */}
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-xs">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
            Waiting for Admin Approval
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm mb-5 leading-relaxed">
            Your Google account has been registered with AB TRACKER. Only approved users can access the system. An Administrator must confirm your account in System Settings before you can proceed.
          </p>

          {/* User Account Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left mb-5 space-y-2.5 text-xs">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-200 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-2xs">
                  {displayName ? displayName[0].toUpperCase() : 'U'}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">
                  {displayName}
                </div>
                <div className="text-[11px] font-mono text-slate-500 truncate">
                  {email}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500">Access Status:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                PENDING APPROVAL
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Assigned Role:</span>
              <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                {role}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Registration Date:</span>
              <span className="font-mono text-slate-600 text-[11px]">
                {createdAtStr}
              </span>
            </div>
          </div>

          {/* Live notification note */}
          <div className="mb-6 p-2.5 bg-blue-50/70 border border-blue-200/70 rounded-lg text-left flex items-start gap-2 text-[11px] text-blue-900">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              This page will automatically admit you as soon as an Administrator approves your account in the System Settings panel.
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={async () => {
                setRefreshing(true);
                await refreshProfile();
                setTimeout(() => setRefreshing(false), 500);
              }}
              disabled={refreshing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-xs cursor-pointer active:scale-[0.99]"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Check Approval Status Now
            </button>
            <button
              onClick={() => logout()}
              className="w-full py-2.5 px-4 text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium rounded-xl border border-slate-300 transition text-xs cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not Authenticated: Render Google Sign In
  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col justify-center items-center p-4 sm:p-6 antialiased selection:bg-blue-600 selection:text-white">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="relative text-center mb-8 max-w-sm">
        <div className="inline-flex items-center justify-center p-3.5 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl shadow-xl shadow-blue-500/20 mb-3.5 border border-blue-400/30">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          AB TRACKER
        </h1>
        <p className="text-slate-400 text-sm mt-1 font-normal">
          Scaffolding & Rental Operations Portal
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-7 sm:p-9 border border-slate-200/90">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Sign In with Google
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 font-normal leading-relaxed">
            Use your authorized Google account to access your scaffolding projects and commercial ledger.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 font-medium animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Primary Google Login Button */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting || loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 font-semibold rounded-xl border border-slate-300 shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group active:scale-[0.99]"
          >
            {submitting || loading ? (
              <span className="flex items-center gap-2 text-slate-600 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                Connecting to Google...
              </span>
            ) : (
              <>
                {/* Official Google 'G' Icon */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="text-sm font-semibold tracking-tight text-slate-800 group-hover:text-slate-900">
                  Continue with Google
                </span>
              </>
            )}
          </button>
        </div>

        {/* Feature Highlights / Security Guarantees */}
        <div className="mt-7 pt-6 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center gap-2.5 text-xs text-slate-600">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Approval Required: Only approved users can access</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-600">
            <FolderKanban className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Salesperson Isolation: View your own assigned projects only</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
            <span>Role-Based Access: Roles & permissions managed in Settings</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-slate-400 font-normal">
          Authorized personnel only. New Google accounts require admin approval.
        </div>
      </div>
    </div>
  );
};
