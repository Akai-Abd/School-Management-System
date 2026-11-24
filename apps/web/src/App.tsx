import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { LoadingState } from './components/States';
import { useAuth } from './context/AuthContext';
import { AcademicPage } from './features/academic/AcademicPage';
import { AccountingPage } from './features/accounting/AccountingPage';
import { AttendancePage } from './features/attendance/AttendancePage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ExamsPage } from './features/exams/ExamsPage';
import { FeesPage } from './features/fees/FeesPage';
import { HomeworkPage } from './features/homework/HomeworkPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { OnlineExamsPage } from './features/online-exams/OnlineExamsPage';
import { HostelPage } from './features/operations/HostelPage';
import { LibraryPage } from './features/operations/LibraryPage';
import { TransportPage } from './features/operations/TransportPage';
import { PlatformPage } from './features/platform/PlatformPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { StaffPage } from './features/staff/StaffPage';
import { StudentsPage } from './features/students/StudentsPage';
import { TimetablePage } from './features/timetable/TimetablePage';
import { WebsitePage } from './features/website/WebsitePage';

function LandingRedirect() {
  useEffect(() => {
    window.location.replace('/public');
  }, []);
  return <LoadingState label="Opening school website..." />;
}

function ProtectedShell({ redirectUnauthenticatedTo }: { redirectUnauthenticatedTo?: 'login' | 'landing' }) {
  const { session, isLoading } = useAuth();
  if (isLoading) return <LoadingState label="Checking session..." />;
  if (!session) {
    return redirectUnauthenticatedTo === 'landing' ? <LandingRedirect /> : <Navigate to="/login" replace />;
  }
  return <AppLayout />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedShell redirectUnauthenticatedTo="landing" />}>
        <Route path="/" element={<DashboardPage />} />
      </Route>
      <Route element={<ProtectedShell />}>
        <Route path="/academic" element={<AcademicPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/timetable" element={<TimetablePage />} />
        <Route path="/exams" element={<ExamsPage />} />
        <Route path="/online-exams" element={<OnlineExamsPage />} />
        <Route path="/homework" element={<HomeworkPage />} />
        <Route path="/fees" element={<FeesPage />} />
        <Route path="/accounting" element={<AccountingPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/transport" element={<TransportPage />} />
        <Route path="/hostel" element={<HostelPage />} />
        <Route path="/website" element={<WebsitePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/platform" element={<PlatformPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
