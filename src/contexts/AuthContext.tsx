import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        
        // Failsafe: Ensure nicolainformatica@gmail.com is always Root, even if created previously
        const isRoot = firebaseUser.email === 'nicolainformatica@gmail.com';
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
           const data = userDoc.data();
           if (isRoot && data.role !== 'Root') {
               await setDoc(userRef, { role: 'Root' }, { merge: true });
           }
        }

        const unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
             const data = docSnap.data();
             setProfile(data);
             
             // Check if we need to start or stop location sharing
             if (data.shareLiveLocation && navigator.geolocation) {
                // start tracking if not already set up globally
                // To avoid multiple watchers, we handle it in a separate effect
             }
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
        watchId = navigator.geolocation.watchPosition(
           (pos) => {
              updateDoc(doc(db, 'users', user.uid), {
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

  // Clean up live location on app close (best effort)
  useEffect(() => {
     const handleBeforeUnload = () => {
        if (user && profile?.shareLiveLocation) {
           // We try to remove liveLocation when they close the app, though beacon is better
           // We'll leave it simple for now, and handle old locations in the UI
        }
     };
     window.addEventListener('beforeunload', handleBeforeUnload);
     return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, profile?.shareLiveLocation]);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
