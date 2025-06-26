import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Header } from './components/layout/header';
import { Sidebar } from './components/layout/sidebar';
import { HomePage } from './pages/home';
import { PostsPage } from './pages/posts';
import { MessagesPage } from './pages/messages';
import { CalendarPage } from './pages/calendar';
import { ProfilePage } from './pages/profile';
import { AnnouncementsPage } from './pages/announcements';
import { UsersPage } from './pages/users';
import { ReportsPage } from './pages/reports';
import { TodosPage } from './pages/todos';
import { GroupsPage } from './pages/groups';
import { GroupDetail } from './components/groups/group-detail';
import { AuthPage } from './pages/auth';
import { ResetPassword } from './components/auth/reset-password';
import { HelpChatPage } from './pages/helpchat';
import { PollsPage } from './pages/polls';
import { useAuthStore } from './store/auth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/auth" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  return user?.role === 'admin' ? children : <Navigate to="/" replace />;
}

function TeacherOrAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  return user?.role === 'admin' || user?.role === 'teacher' ? children : <Navigate to="/" replace />;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Sidebar />
      <main className="pb-16 transition-all duration-300 ease-in-out md:pb-0 md:pl-64">
        <div className="container mx-auto px-4 py-8">
          <Routes location={location}>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/posts"
              element={
                <ProtectedRoute>
                  <PostsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <CalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/announcements"
              element={
                <ProtectedRoute>
                  <AnnouncementsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <ReportsPage />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/todos"
              element={
                <ProtectedRoute>
                  <TodosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups"
              element={
                <ProtectedRoute>
                  <GroupsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups/:id"
              element={
                <ProtectedRoute>
                  <GroupDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/:id"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/helpchat"
              element={
                <ProtectedRoute>
                  <HelpChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/polls"
              element={
                <ProtectedRoute>
                  <PollsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      <Toaster position="top-center" />
    </div>
  );
}

function App() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
          <Toaster position="top-center" />
        </div>
      </Router>
    );
  }

  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}

export default App;