import { useAnalytics } from '../hooks/useAnalytics';
import { COLORS } from '../services/analyticsService';

export default function AnalyticsPage() {
  const { weekly, monthly, trend, heatmap, successRates, topBottom } = useAnalytics();
  const totalCompleted = weekly.reduce((sum, day) => sum + day.completed, 0);
  const totalScheduled = weekly.reduce((sum, day) => sum + day.scheduled, 0);
  const avg = totalScheduled ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
  const activeDays = weekly.filter((day) => day.scheduled > 0 && day.pct > 0).length;

  return (
    <section className="section active analytics-page">
      <header className="section-header analytics-header">
        <div>
          <h1>Analytics</h1>
          <p className="subtitle">Insights into your growth</p>
        </div>
      </header>

      <div className="analytics-summary analytics-summary--react">
        <Metric label="weekly avg" value={`${avg}%`} />
        <Metric label="completions" value={`${totalCompleted} / ${totalScheduled}`} />
        <Metric label="active days" value={activeDays} />
      </div>

      <div className="analytics-grid analytics-grid--react">
        <article className="card glass analytics-card analytics-card--chart">
          <CardHeader title="Weekly Progress" hint="Last 7 days completion rate" />
          <BarChart data={weekly} />
        </article>

        <article className="card glass analytics-card analytics-card--chart">
          <CardHeader title="Monthly Completion" hint="Last 3 weeks" />
          <BarChart data={monthly} />
        </article>

        <article className="card glass analytics-card analytics-card--rates">
          <CardHeader title="Success Rates" hint="Per habit, last 7 days" />
          <SuccessRates rates={successRates} />
        </article>

        <article className="card glass analytics-card analytics-card--top">
          <CardHeader title="Top Performers" hint="Best and most at-risk habits" />
          <TopHabits topBottom={topBottom} />
        </article>

        <article className="card glass analytics-card analytics-card--heatmap span-2">
          <CardHeader title="Activity Heatmap" hint="Recent habit activity" />
          <Heatmap cells={heatmap} />
        </article>

        <article className="card glass analytics-card analytics-card--trend">
          <CardHeader title="Productivity Trend" hint="14-day completion trend" />
          <BarChart data={trend} compact />
        </article>
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <span className="analytics-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}

function CardHeader({ title, hint }) {
  return (
    <div className="analytics-card__header">
      <h2>{title}</h2>
      <p>{hint}</p>
    </div>
  );
}

function BarChart({ data, compact = false }) {
  const max = Math.max(...data.map((item) => item.pct), 100);
  return (
    <div className={`analytics-bars ${compact ? 'analytics-bars--compact' : ''}`}>
      {data.map((item, index) => {
        const height = item.pct === 0 ? 5 : Math.max((item.pct / max) * 100, 8);
        return (
          <div className="analytics-bar-item" key={item.date || item.label}>
            <div className="analytics-bar-track">
              <div
                className={`analytics-bar-fill ${item.pct === 0 ? 'analytics-bar-fill--empty' : ''}`}
                style={{
                  height: `${height}%`,
                  background: item.pct === 0 ? undefined : `linear-gradient(180deg, ${COLORS[index % COLORS.length]}, ${COLORS[(index + 2) % COLORS.length]}aa)`
                }}
              />
            </div>
            <span>{item.label}</span>
            <small>{item.pct}%</small>
          </div>
        );
      })}
    </div>
  );
}

function SuccessRates({ rates }) {
  if (!rates.length) return <p className="analytics-empty">Add habits to see success rates.</p>;
  return (
    <div className="success-rates success-rates--react">
      {rates.map((rate, index) => (
        <div className="rate-row rate-row--react" key={rate.id}>
          <span className="rate-title" title={rate.title}>{rate.title}</span>
          <div className="rate-bar">
            <div
              className="rate-fill"
              style={{
                width: `${rate.rate === 0 ? 0 : Math.max(rate.rate, 8)}%`,
                background: COLORS[index % COLORS.length]
              }}
            />
          </div>
          <span className="rate-pct">{rate.rate}%</span>
        </div>
      ))}
    </div>
  );
}

function TopHabits({ topBottom }) {
  return (
    <div className="top-habits top-habits--react">
      <div className="top-item best">
        <span className="label">Most Completed (7 days)</span>
        <strong>{topBottom.best?.title || '-'}</strong>
        <span className="val">{topBottom.best?.rate ? `${topBottom.best.rate}% this week` : 'No completions yet'}</span>
      </div>
      <div className="top-item worst">
        <span className="label">Needs Attention</span>
        <strong>{topBottom.worst?.title || '-'}</strong>
        <span className="val">{topBottom.worst ? `${topBottom.worst.rate}% this week` : 'No data yet'}</span>
      </div>
    </div>
  );
}

function Heatmap({ cells }) {
  if (!cells.length) return <p className="analytics-empty">No activity yet.</p>;
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-grid heatmap-grid--react">
        {cells.map((cell) => (
          <div
            key={cell.date}
            className={`heatmap-cell level-${cell.level}`}
            title={`${cell.date}: ${cell.completed}/${cell.scheduled} habits`}
          />
        ))}
      </div>
    </div>
  );
}
