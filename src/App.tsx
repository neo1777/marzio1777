import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import LaPiazza from './pages/LaPiazza';
import IlBaule from './pages/IlBaule';
import LaMappa from './pages/LaMappa';
import LAlberone from './pages/LAlberone';
import IlBivacco from './pages/IlBivacco';
import ProfiloPersonale from './pages/ProfiloPersonale';
import AdminPanel from './pages/AdminPanel';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Landing />} />
          
          <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="piazza" replace />} />
            <Route path="piazza" element={<LaPiazza />} />
            <Route path="bivacco" element={<IlBivacco />} />
            <Route path="baule" element={<IlBaule />} />
            <Route path="mappa" element={<LaMappa />} />
            <Route path="alberone" element={<LAlberone />} />
            <Route path="profilo" element={<ProfiloPersonale />} />
            <Route path="admin" element={<AdminPanel />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
