import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { EmptyState, LoadingState } from './components/States';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';

function ProtectedShell() {
  const { session, isLoading } = useAuth();
  if (isLoading) return <LoadingState label="Checking session..." />;
  if (!session) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function ModulePlaceholder({ name }: { name: string }) {
  return (
    <EmptyState
      title={`${name} Module`}
      description="Scheduled in Phases 1–3 of the implementation plan."
    />
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/students" element={<ModulePlaceholder name="Students" />} />
        <Route path="/staff" element={<ModulePlaceholder name="Staff" />} />
        <Route path="/attendance" element={<ModulePlaceholder name="Attendance" />} />
        <Route path="/exams" element={<ModulePlaceholder name="Examinations" />} />
        <Route path="/fees" element={<ModulePlaceholder name="Fees & Billing" />} />
        <Route path="/settings" element={<ModulePlaceholder name="Settings" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
