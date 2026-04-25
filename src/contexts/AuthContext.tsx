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
      if (firebaseUser && firebaseUser.emailVerified) {
        
        const isRoot = firebaseUser.email === 'nicolainformatica@gmail.com';
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        try {
           const userDoc = await getDoc(userRef);
           if (!userDoc.exists()) {
             // Create initial profile
             await setDoc(userRef, { 
                uid: firebaseUser.uid, 
                email: firebaseUser.email, 
                role: isRoot ? 'Root' : 'Guest',
                accountStatus: isRoot ? 'approved' : 'pending',
                displayName: firebaseUser.displayName || 'Nuovo Utente',
                photoURL: firebaseUser.photoURL || '',
                createdAt: serverTimestamp(),
                points: 0,
                shareLiveLocation: false
             });
           } else {
             const data = userDoc.data();
             const updates: any = {};
             if (isRoot && data.role !== 'Root') updates.role = 'Root';
             if (isRoot && data.accountStatus !== 'approved') updates.accountStatus = 'approved';
             if (!data.accountStatus) updates.accountStatus = 'approved'; // Migrate legacy users automatically to approved
             if (Object.keys(updates).length > 0) {
                 await updateDoc(userRef, updates);
             }
           }
        } catch (e) {
           console.error("Error setting up user profile", e);
        }

        const unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
             setProfile(docSnap.data());
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
