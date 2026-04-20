import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import LaPiazza from './pages/LaPiazza';
import IlBaule from './pages/IlBaule';
import LaMappa from './pages/LaMappa';
import IlCircolo from './pages/IlCircolo';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          
          <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="piazza" replace />} />
            <Route path="piazza" element={<LaPiazza />} />
            <Route path="baule" element={<IlBaule />} />
            <Route path="mappa" element={<LaMappa />} />
            <Route path="circolo" element={<IlCircolo />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
