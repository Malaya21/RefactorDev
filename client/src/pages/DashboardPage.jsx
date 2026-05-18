import { useApp } from '../context/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { Achievements, ProductivityRing, StatsGrid, StreakList, TodaySummary, WeeklyOverview } from '../components/Dashboard/DashboardWidgets';

export default function DashboardPage() {
  const { quote } = useApp();
  const { stats } = useAnalytics();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <section className="section active">
      <header className="section-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">{greeting}! Let&apos;s make today count.</p>
        </div>
        <ProductivityRing score={stats.score} />
      </header>
      <div className="quote-card glass animate-fade-in">
        <blockquote>&quot;{quote.text}&quot;</blockquote>
        <cite>- {quote.author}</cite>
      </div>
      <StatsGrid />
      <div className="dashboard-grid">
        <article className="card glass"><h2>Today&apos;s Summary</h2><TodaySummary /></article>
        <article className="card glass"><h2>Weekly Overview</h2><WeeklyOverview /></article>
        <article className="card glass"><h2>Current Streaks</h2><StreakList /></article>
        <article className="card glass achievements-card"><h2>Achievements</h2><Achievements /></article>
      </div>
    </section>
  );
}
