import { NavLink } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { globalLongestStreak } from '../../services/analyticsService';
import { getLevelProgress, getLevelTitle } from '../../utils/levelSystem';
import Icon from '../Icon/Icon';

const links = [
  { to: '/', icon: 'layoutDashboard', label: 'Dashboard' },
  { to: '/habits', icon: 'listChecks', label: 'Daily Habits' },
  { to: '/analytics', icon: 'barChart', label: 'Analytics' },
  { to: '/notes', icon: 'notebookPen', label: 'Notes' },
  { to: '/settings', icon: 'settings', label: 'Settings' }
];

function getInitials(userLabel) {
  return userLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'R';
}

export default function Sidebar() {
  const { state, ui, auth, gamification, actions } = useApp();
  const userLabel = auth.user?.displayName || auth.user?.email || 'ReflectFlow user';
  const providerLabel = auth.user?.provider === 'google.com' || auth.user?.provider === 'google'
    ? 'Signed in with Google'
    : 'Signed in with email';
  const levelProgress = getLevelProgress(gamification.totalXP || 0);
  const levelTitle = getLevelTitle(levelProgress.level);

  return (
    <>
      <aside className={`sidebar glass ${ui.sidebarOpen ? 'open' : ''}`} id="sidebar" aria-hidden={!ui.sidebarOpen}>
        <div className="sidebar__brand">
          <span className="brand-icon"><Icon name="sparkles" size={19} /></span>
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
              <span className="nav-icon"><Icon name={link.icon} size={19} /></span><span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <div className="sidebar-user">
            <div className="sidebar-user__avatar" aria-hidden="true">
              {auth.user?.photoURL
                ? <img src={auth.user.photoURL} alt="" referrerPolicy="no-referrer" />
                : getInitials(userLabel)}
            </div>
            <div className="sidebar-user__meta">
              <span>{providerLabel}</span>
              <strong title={userLabel}>{userLabel}</strong>
            </div>
          </div>
          <div className="streak-float">
            <span className="streak-flame"><Icon name="flame" size={18} /></span>
            <div>
              <span className="streak-label">Best Streak</span>
              <span className="streak-value">{globalLongestStreak(state)}</span>
            </div>
          </div>
          <div className="sidebar-xp">
            <div className="sidebar-xp__top">
              <strong><Icon name="trophy" size={15} /> Level {levelProgress.level}</strong>
              <span>{levelTitle}</span>
            </div>
            <div className="xp-progress xp-progress--compact" aria-label={`${levelProgress.progress}% progress to next level`}>
              <span style={{ width: `${levelProgress.progress}%` }}><i /></span>
            </div>
            <div className="sidebar-xp__bottom">
              <span>{gamification.totalXP || 0} XP</span>
              <span>{levelProgress.remaining} next</span>
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
