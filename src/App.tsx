import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

const Layout = lazy(() => import('./components/Layout'));
const Landing = lazy(() => import('./pages/Landing'));
const LaPiazza = lazy(() => import('./pages/LaPiazza'));
const IlBaule = lazy(() => import('./pages/IlBaule'));
const LaMappa = lazy(() => import('./pages/LaMappa'));
const LAlberone = lazy(() => import('./pages/LAlberone'));
const IlAinulindale = lazy(() => import('./pages/IlAinulindale'));
const IlBivacco = lazy(() => import('./pages/IlBivacco'));
const IlCinematografo = lazy(() => import('./pages/IlCinematografo'));
const ProfiloPersonale = lazy(() => import('./pages/ProfiloPersonale'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Istruzioni = lazy(() => import('./pages/Istruzioni'));
const IlCampoDeiGiochi = lazy(() => import('./pages/IlCampoDeiGiochi'));
const GameLobby = lazy(() => import('./pages/GameLobby'));
const GameCreator = lazy(() => import('./pages/GameCreator'));
const GamePlayRouter = lazy(() => import('./pages/GamePlayRouter'));
const GameResults = lazy(() => import('./pages/GameResults'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  return <>{children}</>;
}

const LoadingFallback = () => (
  <div className="h-screen w-full flex justify-center items-center bg-[#F7F5F0]">
    <Loader2 className="animate-spin text-[#2D5A27]" size={48} />
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
            <Route path="/" element={<Landing />} />
            
            <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="piazza" replace />} />
              <Route path="piazza" element={<LaPiazza />} />
              <Route path="bivacco" element={<IlBivacco />} />
              <Route path="baule" element={<IlBaule />} />
              <Route path="mappa" element={<LaMappa />} />
              <Route path="cinematografo" element={<IlCinematografo />} />
              <Route path="giochi" element={<IlCampoDeiGiochi />} />
              <Route path="giochi/nuovo" element={<GameCreator />} />
              <Route path="giochi/:eventId/lobby" element={<GameLobby />} />
              <Route path="giochi/:eventId/play" element={<GamePlayRouter />} />
              <Route path="giochi/:eventId/results" element={<GameResults />} />
              <Route path="alberone" element={<LAlberone />} />
              <Route path="ainulindale/*" element={<IlAinulindale />} />
              <Route path="profilo" element={<ProfiloPersonale />} />
              <Route path="admin" element={<AdminPanel />} />
              <Route path="istruzioni" element={<Istruzioni />} />
            </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
