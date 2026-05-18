import { NavLink } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { globalLongestStreak } from '../../services/analyticsService';

const links = [
  { to: '/', icon: '📊', label: 'Dashboard' },
  { to: '/habits', icon: '✅', label: 'Daily Habits' },
  { to: '/analytics', icon: '📈', label: 'Analytics' },
  { to: '/notes', icon: '📝', label: 'Notes' },
  { to: '/settings', icon: '⚙️', label: 'Settings' }
];

export default function Sidebar() {
  const { state, ui, auth, actions } = useApp();
  const userLabel = auth.user?.displayName || auth.user?.email || 'ReflectFlow user';

  return (
    <>
      <aside className={`sidebar glass ${ui.sidebarOpen ? 'open' : ''}`} id="sidebar" aria-hidden={!ui.sidebarOpen}>
        <div className="sidebar__brand">
          <span className="brand-icon">✦</span>
          <span className="brand-text">ReflectFlow</span>
        </div>
        <nav className="sidebar__nav" aria-label="Main navigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              onClick={() => actions.toggleSidebar(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{link.icon}</span><span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <div className="sidebar-user">
            <div className="sidebar-user__avatar" aria-hidden="true">{userLabel.charAt(0).toUpperCase()}</div>
            <div className="sidebar-user__meta">
              <span>Signed in as</span>
              <strong title={userLabel}>{userLabel}</strong>
            </div>
          </div>
          <div className="streak-float">
            <span className="streak-flame">🔥</span>
            <div>
              <span className="streak-label">Best Streak</span>
              <span className="streak-value">{globalLongestStreak(state)}</span>
            </div>
          </div>
          <button type="button" className="btn btn--secondary sidebar-logout" onClick={() => actions.logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <div className={`sidebar-overlay ${ui.sidebarOpen ? 'active' : ''}`} onClick={() => actions.toggleSidebar(false)} aria-hidden="true" />
    </>
  );
}
