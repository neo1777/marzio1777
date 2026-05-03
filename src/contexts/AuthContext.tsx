import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

const ROOT_EMAIL = 'nicolainformatica@gmail.com';
// Cut-off for the historical "approve users without accountStatus" migration.
// Profiles created before this date are pre-RBAC and grandfathered into 'approved';
// any newer doc missing accountStatus is an anomaly and stays 'pending'.
const LEGACY_CUTOFF = Timestamp.fromDate(new Date('2024-01-01T00:00:00Z'));

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser && firebaseUser.emailVerified) {

        const isRoot = firebaseUser.email === ROOT_EMAIL;
        const userRef = doc(db, 'users', firebaseUser.uid);

        try {
           const userDoc = await getDoc(userRef);
           if (!userDoc.exists()) {
             await setDoc(userRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role: isRoot ? 'Root' : 'Guest',
                accountStatus: isRoot ? 'approved' : 'pending',
                displayName: firebaseUser.displayName || 'Nuovo Utente',
                photoURL: firebaseUser.photoURL || '',
                createdAt: serverTimestamp(),
                points: 0,
                shareLiveLocation: false,
             });
           } else {
             const data = userDoc.data();
             const updates: Record<string, unknown> = {};
             if (isRoot && data.role !== 'Root') updates.role = 'Root';
             if (isRoot && data.accountStatus !== 'approved') updates.accountStatus = 'approved';
             if (!data.accountStatus) {
               const isLegacy = data.createdAt instanceof Timestamp && data.createdAt < LEGACY_CUTOFF;
               if (isLegacy) {
                 updates.accountStatus = 'approved';
               } else {
                 console.warn('[AuthContext] Profile without accountStatus past legacy cutoff — defaulting to pending', { uid: firebaseUser.uid });
                 updates.accountStatus = 'pending';
               }
             }
             if (Object.keys(updates).length > 0) {
                 await updateDoc(userRef, updates);
             }
           }
        } catch (e) {
           console.error("Error setting up user profile", e);
        }

        const unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
             setProfile(docSnap.data() as UserProfile);
          }
          setLoading(false);
        });
        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
     let watchId: number | null = null;
     if (user && profile?.shareLiveLocation && navigator.geolocation) {
        // First ensure user_locations document exists with basic info
        setDoc(doc(db, 'user_locations', user.uid), {
           userId: user.uid,
           displayName: profile.displayName || user.displayName || 'Utente',
           photoURL: profile.photoURL || user.photoURL || '',
           shareLiveLocation: true
        }, { merge: true }).catch(console.error);

        watchId = navigator.geolocation.watchPosition(
           (pos) => {
              updateDoc(doc(db, 'user_locations', user.uid), {
                 liveLocation: {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    updatedAt: serverTimestamp()
                 }
              }).catch(console.error);
           },
           (err) => console.warn('Geolocation error:', err),
           { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
     }
     
     return () => {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
     };
  }, [user, profile?.shareLiveLocation]);

  useEffect(() => {
     const handleBeforeUnload = () => {
        // Cannot reliably do async things here, but trying to set offline
     };
     window.addEventListener('beforeunload', handleBeforeUnload);
     return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
