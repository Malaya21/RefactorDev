import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import HabitsPage from './pages/HabitsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import NotesPage from './pages/NotesPage';
import SettingsPage from './pages/SettingsPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ToastContainer from './components/Toast/ToastContainer';
import { useApp } from './context/AppContext';

function AuthGate({ children }) {
  const { auth } = useApp();
  const location = useLocation();

  if (auth.loading) return <AuthLoader />;
  if (!auth.user) return <Navigate to="/login" replace state={{ from: location }} />;

  return children;
}

function PublicOnly({ children }) {
  const { auth } = useApp();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  if (auth.user) return <Navigate to={from} replace />;

  return children;
}

function AuthLoader() {
  return (
    <div className="auth-shell">
      <div className="auth-card glass auth-card--loading">
        <span className="loader-ring" aria-hidden="true" />
        <p>Restoring your ReflectFlow session...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route element={<AuthGate><AppLayout /></AuthGate>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
