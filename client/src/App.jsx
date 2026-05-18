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

function getRedirectTarget(location) {
  const from = location.state?.from?.pathname || '/';
  return from === '/login' || from === '/register' ? '/' : from;
}

function logRouteGuard(guard, decision, details) {
  console.info(`[ReflectFlow route] ${guard}: ${decision}`, details);
}

function AuthGate({ children }) {
  const { auth } = useApp();
  const location = useLocation();

  if (auth.loading) {
    logRouteGuard('protected', 'waiting for auth initialization', {
      path: location.pathname,
      initialized: auth.initialized,
      uid: null
    });
    return <AuthLoader />;
  }

  if (!auth.user) {
    logRouteGuard('protected', 'redirecting unauthenticated user to login', {
      path: location.pathname,
      initialized: auth.initialized,
      uid: null
    });
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  logRouteGuard('protected', 'rendering protected route', {
    path: location.pathname,
    initialized: auth.initialized,
    uid: auth.user.uid
  });

  return children;
}

function PublicOnly({ children }) {
  const { auth } = useApp();
  const location = useLocation();
  const from = getRedirectTarget(location);

  if (auth.loading) {
    logRouteGuard('public', 'rendering public route while auth initializes', {
      path: location.pathname,
      initialized: auth.initialized,
      uid: null
    });
    return children;
  }

  if (auth.user) {
    logRouteGuard('public', 'redirecting authenticated user away from auth page', {
      path: location.pathname,
      redirectTo: from,
      initialized: auth.initialized,
      uid: auth.user.uid
    });
    return <Navigate to={from} replace />;
  }

  logRouteGuard('public', 'rendering public route for unauthenticated user', {
    path: location.pathname,
    initialized: auth.initialized,
    uid: null
  });

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
