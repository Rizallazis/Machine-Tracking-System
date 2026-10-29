import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { MachineList } from './pages/MachineList';
import { MachineDetail } from './pages/MachineDetail';
import { QRScanner } from './pages/QRScanner';
import { MovementForm } from './pages/MovementForm';
import { ConditionPage } from './pages/ConditionPage';
import { HistoryPage } from './pages/HistoryPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { AuditPage } from './pages/AuditPage';
import { OfflineMovementSync } from './components/OfflineMovementSync';
import { UserRole } from '@machine-tracking/shared';
import { ToastProvider, PageLoader } from './context/ToastContext';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <PageLoader message="Memeriksa sesi login..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <OfflineMovementSync />
      <main className="flex-1">
        <div className="motion-page" key={window.location.pathname}>{children}</div>
      </main>
      <BottomNav />
    </div>
  );
};

const RoleRoute: React.FC<{ children: React.ReactNode; allowedRoles: UserRole[] }> = ({
  children,
  allowedRoles
}) => {
  const { hasRole } = useAuth();
  if (!hasRole(...allowedRoles)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            }
          />

          <Route
            path="/machines"
            element={
              <ProtectedLayout>
                <MachineList />
              </ProtectedLayout>
            }
          />

          <Route
            path="/machines/:id"
            element={
              <ProtectedLayout>
                <MachineDetail />
              </ProtectedLayout>
            }
          />

          <Route
            path="/scan"
            element={
              <ProtectedLayout>
                <QRScanner />
              </ProtectedLayout>
            }
          />

          <Route
            path="/move"
            element={
              <ProtectedLayout>
                <MovementForm />
              </ProtectedLayout>
            }
          />

          <Route
            path="/conditions"
            element={
              <ProtectedLayout>
                <ConditionPage />
              </ProtectedLayout>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedLayout>
                <HistoryPage />
              </ProtectedLayout>
            }
          />

          <Route
            path="/master"
            element={
              <ProtectedLayout>
                <RoleRoute allowedRoles={[UserRole.ADMIN, UserRole.IE]}>
                  <MasterDataPage />
                </RoleRoute>
              </ProtectedLayout>
            }
          />

          <Route
            path="/audit"
            element={
              <ProtectedLayout>
                <RoleRoute allowedRoles={[UserRole.ADMIN, UserRole.IE]}>
                  <AuditPage />
                </RoleRoute>
              </ProtectedLayout>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ToastProvider>
  );
};

export default App;
