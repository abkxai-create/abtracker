import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
} from 'firebase/firestore';
import { auth, googleProvider, db, COLLECTIONS, testConnection } from '../firebase';
import { UserProfile, UserRole, UserApprovalStatus } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  allUsers: UserProfile[];
  pendingUsersCount: number;
  updateUserRole: (uid: string, role: UserRole) => Promise<void>;
  updateUserSalesperson: (uid: string, salespersonId: string, salespersonName: string) => Promise<void>;
  updateUserStatus: (uid: string, status: UserApprovalStatus) => Promise<void>;
  approveUser: (uid: string, role?: UserRole, salespersonId?: string, salespersonName?: string) => Promise<void>;
  rejectUser: (uid: string) => Promise<void>;
  removeUser: (uid: string) => Promise<void>;
  previewSalespersonId: string | null;
  previewSalespersonName: string | null;
  setPreviewSalesperson: (spId: string | null, spName?: string | null) => void;
  activeSalespersonId: string | undefined;
  activeSalespersonName: string | undefined;
  isSalespersonRole: boolean;
  isAdminRole: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // Admin preview switcher for testing salesperson view
  const [previewSalespersonId, setPreviewSalespersonId] = useState<string | null>(null);
  const [previewSalespersonName, setPreviewSalespersonName] = useState<string | null>(null);

  // Test connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  // Listen to Auth State and subscribe to real-time self profile changes
  useEffect(() => {
    let unsubSelfProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setCurrentUser(fbUser);
      if (fbUser) {
        setLoading(true);
        try {
          await loadOrCreateUserProfile(fbUser);
        } catch (err) {
          console.error('Failed to load or create profile:', err);
        } finally {
          setLoading(false);
        }

        // Real-time listener on own profile doc so approvals trigger immediate entry
        try {
          const selfDocRef = doc(db, COLLECTIONS.USERS, fbUser.uid);
          unsubSelfProfile = onSnapshot(
            selfDocRef,
            (snap) => {
              if (snap.exists()) {
                const profile = snap.data() as UserProfile;
                setUserProfile(profile);
              }
            },
            (err) => {
              console.warn('Real-time self profile listener notice:', err.message);
            }
          );
        } catch (err) {
          console.warn('Could not attach self profile listener:', err);
        }
      } else {
        if (unsubSelfProfile) {
          unsubSelfProfile();
          unsubSelfProfile = null;
        }
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubSelfProfile) {
        unsubSelfProfile();
      }
    };
  }, []);

  // Listen to Users collection in real-time for Admins
  useEffect(() => {
    if (!currentUser) {
      setAllUsers([]);
      return;
    }

    const cleanEmail = (currentUser.email || '').toLowerCase().trim();
    const isRootAdmin = cleanEmail === 'abkxai@gmail.com';
    const isProfileAdmin = userProfile?.role === 'ADMIN';

    // Only administrators are permitted to listen to the all-users collection
    if (!isRootAdmin && !isProfileAdmin) {
      setAllUsers([]);
      return;
    }

    try {
      const usersColRef = collection(db, COLLECTIONS.USERS);
      const unsub = onSnapshot(
        usersColRef,
        (snapshot) => {
          const users: UserProfile[] = [];
          snapshot.forEach((d) => {
            users.push(d.data() as UserProfile);
          });
          // Sort by createdAt descending (newest first)
          users.sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
          setAllUsers(users);

          const myUpdatedProfile = users.find((u) => u.uid === currentUser.uid);
          if (myUpdatedProfile) {
            setUserProfile(myUpdatedProfile);
          }
        },
        (error) => {
          console.warn('Users snapshot listener notice:', error.message);
        }
      );

      return () => unsub();
    } catch (err) {
      console.error('Error attaching users listener:', err);
    }
  }, [currentUser?.uid, currentUser?.email, userProfile?.role, userProfile?.approvalStatus]);

  // Load or create user profile from Firestore upon Google sign-in
  const loadOrCreateUserProfile = async (fbUser: FirebaseUser) => {
    const userDocRef = doc(db, COLLECTIONS.USERS, fbUser.uid);
    const userSnapshot = await getDoc(userDocRef);

    const now = new Date().toISOString();
    const cleanEmail = (fbUser.email || '').toLowerCase().trim();
    const isRootAdmin = cleanEmail === 'abkxai@gmail.com';

    if (userSnapshot.exists()) {
      const existingData = userSnapshot.data() as UserProfile;

      // Determine authoritative role and status: root admin is always ADMIN & APPROVED
      const effectiveRole: UserRole = isRootAdmin ? 'ADMIN' : (existingData.role || 'SALESPERSON');
      const effectiveStatus: UserApprovalStatus = isRootAdmin
        ? 'APPROVED'
        : (existingData.approvalStatus || 'PENDING');

      const updatedData: UserProfile = {
        ...existingData,
        name: existingData.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
        email: fbUser.email || existingData.email || '',
        photoURL: fbUser.photoURL || existingData.photoURL || '',
        role: effectiveRole,
        approvalStatus: effectiveStatus,
        isFirstUser: isRootAdmin ? true : (existingData.isFirstUser || false),
        updatedAt: now,
      };

      // If root admin was not ADMIN or APPROVED in store, or photo changed, update Firestore
      if (
        (isRootAdmin && (existingData.role !== 'ADMIN' || existingData.approvalStatus !== 'APPROVED')) ||
        existingData.photoURL !== updatedData.photoURL ||
        existingData.email !== updatedData.email ||
        !existingData.name
      ) {
        updateDoc(userDocRef, {
          photoURL: updatedData.photoURL,
          email: updatedData.email,
          name: updatedData.name,
          role: updatedData.role,
          approvalStatus: updatedData.approvalStatus,
          isFirstUser: updatedData.isFirstUser,
          updatedAt: now,
        }).catch(console.warn);
      }

      setUserProfile(updatedData);
      return;
    }

    // New User Profile Creation
    // Root Admin (abkxai@gmail.com) is immediately APPROVED as ADMIN.
    // All other users are created with approvalStatus: 'PENDING' and role: 'SALESPERSON'.
    const newProfile: UserProfile = {
      uid: fbUser.uid,
      name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
      email: fbUser.email || '',
      photoURL: fbUser.photoURL || '',
      authMethod: 'GOOGLE',
      role: isRootAdmin ? 'ADMIN' : 'SALESPERSON',
      approvalStatus: isRootAdmin ? 'APPROVED' : 'PENDING',
      isFirstUser: isRootAdmin,
      createdAt: now,
      updatedAt: now,
    };

    // This setDoc will succeed because firestore.rules explicitly allows
    // isRootAdmin OR request.resource.data.approvalStatus == 'PENDING'
    await setDoc(userDocRef, newProfile);
    setUserProfile(newProfile);
  };

  /**
   * Primary Login: Google OAuth Popup
   */
  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await loadOrCreateUserProfile(result.user);
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        setLoading(false);
        return;
      }
      setLoading(false);
      throw new Error(err.message || 'Google sign-in could not be completed. Please try again.');
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUserProfile(null);
      setCurrentUser(null);
      setPreviewSalespersonId(null);
      setPreviewSalespersonName(null);
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!currentUser) return;
    try {
      const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  };

  // Administrator: Update User Role (ADMIN, SALESPERSON, STAFF)
  const updateUserRole = async (uid: string, role: UserRole) => {
    const docRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(docRef, { role, updatedAt: new Date().toISOString() });
  };

  // Administrator: Link or Change Salesperson profile for a user
  const updateUserSalesperson = async (uid: string, salespersonId: string, salespersonName: string) => {
    const docRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(docRef, {
      salespersonId: salespersonId || '',
      salespersonName: salespersonName || '',
      updatedAt: new Date().toISOString(),
    });
  };

  // Administrator: Update Approval Status (APPROVED, DISABLED, REJECTED, PENDING)
  const updateUserStatus = async (uid: string, status: UserApprovalStatus) => {
    const docRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(docRef, { approvalStatus: status, updatedAt: new Date().toISOString() });
  };

  // Administrator: Approve User (sets approvalStatus to 'APPROVED', optional role & salesperson)
  const approveUser = async (
    uid: string,
    role?: UserRole,
    salespersonId?: string,
    salespersonName?: string
  ) => {
    const docRef = doc(db, COLLECTIONS.USERS, uid);
    const updates: Partial<UserProfile> = {
      approvalStatus: 'APPROVED',
      updatedAt: new Date().toISOString(),
    };
    if (role) updates.role = role;
    if (salespersonId !== undefined) updates.salespersonId = salespersonId;
    if (salespersonName !== undefined) updates.salespersonName = salespersonName;
    await updateDoc(docRef, updates);
  };

  // Administrator: Reject User
  const rejectUser = async (uid: string) => {
    const docRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(docRef, {
      approvalStatus: 'REJECTED',
      updatedAt: new Date().toISOString(),
    });
  };

  // Administrator: Remove User
  const removeUser = async (uid: string) => {
    const docRef = doc(db, COLLECTIONS.USERS, uid);
    await deleteDoc(docRef);
  };

  // Administrator Preview Switcher (Allows Admins to preview salesperson project isolation)
  const setPreviewSalesperson = (spId: string | null, spName?: string | null) => {
    setPreviewSalespersonId(spId);
    setPreviewSalespersonName(spName || null);
  };

  const cleanEmail = (currentUser?.email || '').toLowerCase().trim();
  const isRootAdmin = cleanEmail === 'abkxai@gmail.com';
  const isAdminRole = isRootAdmin || (userProfile?.role === 'ADMIN' && userProfile?.approvalStatus === 'APPROVED');
  const isSalespersonRole = !isAdminRole && userProfile?.role === 'SALESPERSON';

  // Active salesperson identity applied to project queries:
  // - If logged-in user is SALESPERSON: strictly userProfile.salespersonId
  // - If Admin in preview mode: previewSalespersonId
  // - If Admin in standard mode: undefined (all projects)
  const activeSalespersonId = isSalespersonRole
    ? userProfile?.salespersonId
    : previewSalespersonId || undefined;

  const activeSalespersonName = isSalespersonRole
    ? userProfile?.salespersonName
    : previewSalespersonName || (isAdminRole ? 'Administrator' : undefined);

  const pendingUsersCount = allUsers.filter((u) => u.approvalStatus === 'PENDING').length;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        loginWithGoogle,
        logout,
        refreshProfile,
        allUsers,
        pendingUsersCount,
        updateUserRole,
        updateUserSalesperson,
        updateUserStatus,
        approveUser,
        rejectUser,
        removeUser,
        previewSalespersonId,
        previewSalespersonName,
        setPreviewSalesperson,
        activeSalespersonId,
        activeSalespersonName,
        isSalespersonRole,
        isAdminRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
