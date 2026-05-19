import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import HabitsPage from './pages/HabitsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import NotesPage from './pages/NotesPage';
import SettingsPage from './pages/SettingsPage';
import Login from './pages/Login';
import Register from './pages/Register';
import OnboardingPage from './pages/OnboardingPage';
import ToastContainer from './components/Toast/ToastContainer';
import { useApp } from './context/AppContext';
import Icon from './components/Icon/Icon';

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

  if (!auth.onboardingChecked) {
    logRouteGuard('protected', 'waiting for onboarding status', {
      path: location.pathname,
      initialized: auth.initialized,
      uid: auth.user.uid
    });
    return <AuthLoader />;
  }

  if (auth.onboardingRequired && location.pathname !== '/onboarding') {
    logRouteGuard('protected', 'redirecting user to onboarding', {
      path: location.pathname,
      initialized: auth.initialized,
      uid: auth.user.uid
    });
    return <Navigate to="/onboarding" replace />;
  }

  if (!auth.onboardingRequired && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
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

function XpFeedback() {
  const { ui } = useApp();
  if (!ui.xpFeedback?.length) return null;

  return (
    <div className="xp-feedback-stack" aria-live="polite" aria-atomic="false">
      {ui.xpFeedback.map((item) => (
        <div className={`xp-feedback ${item.leveledUp ? 'xp-feedback--level' : ''}`} key={item.id}>
          <Icon name={item.leveledUp ? 'trophy' : 'zap'} size={17} />
          <span>+{item.amount} XP{item.leveledUp ? ' - Level up!' : ''}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <>
      <ToastContainer />
      <XpFeedback />
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/onboarding" element={<AuthGate><OnboardingPage /></AuthGate>} />
        <Route element={<AuthGate><AppLayout /></AuthGate>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
