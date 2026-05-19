import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon/Icon';
import { useApp } from '../context/AppContext';
import { buildLeaderboardEntry, subscribeToWeeklyLeaderboard } from '../services/leaderboardService';
import { getWeekRange } from '../utils/date';

function initials(name) {
  return String(name || 'R')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'R';
}

function getMotivationLabel(entry, rank) {
  if (rank === 1) return 'Top Performer';
  if ((entry.currentStreak || 0) >= 7) return 'Consistency King';
  if ((entry.weeklyXP || 0) >= 150) return 'On Fire';
  return 'Rising Star';
}

function rankIcon(rank) {
  if (rank === 1) return 'crown';
  if (rank <= 3) return 'medal';
  return 'trophy';
}

function Avatar({ entry }) {
  return (
    <span className="leaderboard-avatar" aria-hidden="true">
      {entry.photoURL
        ? <img src={entry.photoURL} alt="" referrerPolicy="no-referrer" />
        : initials(entry.displayName)}
    </span>
  );
}

function PodiumCard({ entry, rank, current }) {
  if (!entry) return null;
  return (
    <article className={`podium-card podium-card--${rank} ${current ? 'is-current-user' : ''}`}>
      <span className="podium-card__rank"><Icon name={rankIcon(rank)} size={20} /> #{rank}</span>
      <Avatar entry={entry} />
      <div className="podium-card__body">
        <strong>{entry.displayName}</strong>
        <span>{getMotivationLabel(entry, rank)}</span>
      </div>
      <div className="podium-card__stats">
        <span>Level {entry.level || 1} - {entry.weeklyXP || 0} XP</span>
        <span>{entry.currentStreak || 0} Day Streak</span>
      </div>
    </article>
  );
}

function LeaderboardRow({ entry, rank, current }) {
  return (
    <li className={`leaderboard-row ${current ? 'is-current-user' : ''}`}>
      <span className="leaderboard-rank">#{rank}</span>
      <Avatar entry={entry} />
      <div className="leaderboard-user">
        <strong>{entry.displayName}</strong>
        <span>{getMotivationLabel(entry, rank)}</span>
      </div>
      <span className="leaderboard-pill">Lvl {entry.level || 1}</span>
      <span className="leaderboard-score"><Icon name="zap" size={16} /> {entry.weeklyXP || 0}</span>
      <span className="leaderboard-streak"><Icon name="flame" size={16} /> {entry.currentStreak || 0}</span>
      <span className="leaderboard-completed"><Icon name="checkCircle" size={16} /> {entry.completedThisWeek || 0}</span>
    </li>
  );
}

export default function LeaderboardPage() {
  const { auth, state, gamification } = useApp();
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);
  const week = useMemo(() => getWeekRange(new Date()), []);

  useEffect(() => {
    setError(null);
    return subscribeToWeeklyLeaderboard(week.weekKey, setEntries, (leaderboardError) => {
      console.warn('[ReflectFlow leaderboard] realtime listener failed', leaderboardError);
      setError('Leaderboard is reconnecting. Your progress is still being tracked.');
    });
  }, [week.weekKey]);

  const fallbackCurrentEntry = useMemo(() => auth.user?.uid
    ? buildLeaderboardEntry({ user: auth.user, habits: state.habits, gamification })
    : null, [auth.user, state.habits, gamification]);

  const rankedEntries = useMemo(() => {
    const list = [...entries];
    if (fallbackCurrentEntry && !list.some((entry) => entry.uid === fallbackCurrentEntry.uid)) {
      list.push(fallbackCurrentEntry);
    }
    return list
      .sort((a, b) => {
        if ((b.weeklyXP || 0) !== (a.weeklyXP || 0)) return (b.weeklyXP || 0) - (a.weeklyXP || 0);
        if ((b.currentStreak || 0) !== (a.currentStreak || 0)) return (b.currentStreak || 0) - (a.currentStreak || 0);
        return (b.completedThisWeek || 0) - (a.completedThisWeek || 0);
      })
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [entries, fallbackCurrentEntry]);

  const currentEntry = rankedEntries.find((entry) => entry.uid === auth.user?.uid) || fallbackCurrentEntry;
  const topThree = rankedEntries.slice(0, 3);

  return (
    <section className="section active leaderboard-page">
      <header className="section-header leaderboard-header">
        <div>
          <h1>Weekly Leaderboard</h1>
          <p className="subtitle">{week.start} to {week.end} - ranked by weekly XP, streak, then completions</p>
        </div>
        {currentEntry && (
          <div className="your-rank-card glass">
            <span>Your Rank</span>
            <strong>#{currentEntry.rank || '-'}</strong>
            <small>{currentEntry.weeklyXP || 0} XP this week</small>
          </div>
        )}
      </header>

      {error && <div className="auth-alert leaderboard-alert">{error}</div>}

      <div className="podium-grid">
        {topThree.map((entry) => (
          <PodiumCard key={entry.uid} entry={entry} rank={entry.rank} current={entry.uid === auth.user?.uid} />
        ))}
      </div>

      <article className="leaderboard-table glass">
        <header className="leaderboard-table__head">
          <span>Rank</span>
          <span></span>
          <span>Player</span>
          <span>Level</span>
          <span>XP</span>
          <span>Streak</span>
          <span>Done</span>
        </header>
        {rankedEntries.length ? (
          <ol className="leaderboard-list">
            {rankedEntries.map((entry) => (
              <LeaderboardRow key={entry.uid} entry={entry} rank={entry.rank} current={entry.uid === auth.user?.uid} />
            ))}
          </ol>
        ) : (
          <div className="empty-state leaderboard-empty">
            <span className="empty-icon"><Icon name="trophy" size={38} /></span>
            <h3>No weekly rankings yet</h3>
            <p>Complete habits to publish your first weekly score.</p>
          </div>
        )}
      </article>
    </section>
  );
}
