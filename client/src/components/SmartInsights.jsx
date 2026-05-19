import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getStatus, isScheduledDay } from '../services/streakService';
import { addDays, formatDateKey, getDatesBetween, getWeekRange, todayKey } from '../utils/date';
import { getLevelProgress } from '../utils/levelSystem';
import Icon from './Icon/Icon';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function pct(done, scheduled) {
  return scheduled ? Math.round((done / scheduled) * 100) : 0;
}

function scoreClamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function analyzeRange(habits, dates) {
  let scheduled = 0;
  let done = 0;
  let missed = 0;
  const byDay = DAY_LABELS.map((label) => ({ label, scheduled: 0, done: 0 }));
  const byCategory = new Map();

  dates.forEach((dateKey) => {
    const date = new Date(`${dateKey}T12:00:00`);
    const day = byDay[date.getDay()];
    habits.forEach((habit) => {
      if (!isScheduledDay(habit, date)) return;
      const status = getStatus(habit, dateKey);
      scheduled++;
      day.scheduled++;
      if (!byCategory.has(habit.category)) byCategory.set(habit.category, { category: habit.category, scheduled: 0, done: 0, missed: 0 });
      const category = byCategory.get(habit.category);
      category.scheduled++;
      if (status === 'done') {
        done++;
        day.done++;
        category.done++;
      } else if (status === 'missed') {
        missed++;
        category.missed++;
      }
    });
  });

  return { scheduled, done, missed, rate: pct(done, scheduled), byDay, byCategory: [...byCategory.values()] };
}

function getHabitRate(habit, dates) {
  let scheduled = 0;
  let done = 0;
  dates.forEach((dateKey) => {
    const date = new Date(`${dateKey}T12:00:00`);
    if (!isScheduledDay(habit, date)) return;
    scheduled++;
    if (getStatus(habit, dateKey) === 'done') done++;
  });
  return { scheduled, done, rate: pct(done, scheduled) };
}

function getRecoveryScore(habits, dates) {
  let misses = 0;
  let recoveries = 0;
  habits.forEach((habit) => {
    dates.forEach((dateKey) => {
      if (getStatus(habit, dateKey) !== 'missed') return;
      misses++;
      const nextKey = addDays(dateKey, 1);
      if (getStatus(habit, nextKey) === 'done') recoveries++;
    });
  });
  return misses ? scoreClamp((recoveries / misses) * 100) : 72;
}

function getBestCategory(categories) {
  return categories
    .filter((category) => category.scheduled > 0)
    .map((category) => ({ ...category, rate: pct(category.done, category.scheduled) }))
    .sort((a, b) => b.rate - a.rate);
}

function buildInsights({ state, gamification }) {
  const habits = state.habits || [];
  const today = todayKey();
  const last30 = getDatesBetween(addDays(today, -29), today);
  const currentWeek = getWeekRange(new Date());
  const thisWeekDates = getDatesBetween(currentWeek.start, today);
  const previousWeekDates = thisWeekDates.map((dateKey) => addDays(dateKey, -7));
  const recent = analyzeRange(habits, last30);
  const thisWeek = analyzeRange(habits, thisWeekDates);
  const previousWeek = analyzeRange(habits, previousWeekDates);
  const totalDone = recent.done;

  if (!habits.length || totalDone < 3) {
    return {
      scores: [
        { label: 'Discipline', value: 0, icon: 'shieldCheck' },
        { label: 'Recovery', value: 0, icon: 'activity' },
        { label: 'Momentum', value: 0, icon: 'trendingUp' }
      ],
      insights: [
        {
          id: 'beginner',
          type: 'guidance',
          tone: 'violet',
          icon: 'brain',
          title: 'Smart Insights Warming Up',
          message: 'Complete habits for 3 days to unlock stronger behavior patterns.',
          priority: 99
        },
        {
          id: 'first-progress',
          type: 'motivation',
          tone: 'emerald',
          icon: 'sparkles',
          title: 'Start With One Clean Win',
          message: 'Mark one scheduled habit done today to begin building your productivity signal.',
          priority: 98
        }
      ]
    };
  }

  const longestCurrent = Math.max(0, ...habits.map((habit) => habit.streak?.current || 0));
  const recoveryScore = getRecoveryScore(habits, last30);
  const disciplineScore = scoreClamp((recent.rate * 0.68) + (Math.min(longestCurrent, 14) / 14 * 22) + (recoveryScore * 0.1));
  const momentumDelta = thisWeek.rate - previousWeek.rate;
  const momentumScore = scoreClamp(50 + momentumDelta + (thisWeek.rate * 0.35));
  const progress = getLevelProgress(gamification.totalXP || 0);
  const todaysScheduled = habits.filter((habit) => isScheduledDay(habit, new Date(`${today}T12:00:00`)));
  const remainingToday = todaysScheduled.filter((habit) => getStatus(habit, today) !== 'done').length;
  const insights = [];

  habits.forEach((habit) => {
    if ((habit.streak?.current || 0) >= 3 && isScheduledDay(habit, new Date(`${today}T12:00:00`)) && getStatus(habit, today) === 'pending') {
      insights.push({
        id: `risk-${habit.id}`,
        type: 'streak',
        tone: 'amber',
        icon: 'alertTriangle',
        title: 'Streak Risk',
        message: `${habit.title} is at streak risk. One miss will break your ${habit.streak.current}-day streak.`,
        priority: 1
      });
    }
  });

  if (momentumDelta >= 18) {
    insights.push({
      id: 'major-improvement',
      type: 'improvement',
      tone: 'emerald',
      icon: 'trendingUp',
      title: 'Major Improvement',
      message: `Your completion rate is up ${momentumDelta}% compared with last week.`,
      priority: 2
    });
  }

  const weakHabit = habits
    .map((habit) => ({ habit, ...getHabitRate(habit, thisWeekDates) }))
    .filter((item) => item.scheduled >= 2 && item.rate < 50)
    .sort((a, b) => a.rate - b.rate)[0];
  if (weakHabit) {
    insights.push({
      id: `weak-${weakHabit.habit.id}`,
      type: 'attention',
      tone: 'rose',
      icon: 'alertTriangle',
      title: 'Needs Attention',
      message: `${weakHabit.habit.title} is at ${weakHabit.rate}% this week. A smaller target may help you restart.`,
      priority: 3
    });
  }

  const bestDay = recent.byDay
    .filter((day) => day.scheduled >= 2)
    .map((day) => ({ ...day, rate: pct(day.done, day.scheduled) }))
    .sort((a, b) => b.rate - a.rate)[0];
  if (bestDay) {
    insights.push({
      id: 'best-day',
      type: 'productivity',
      tone: 'indigo',
      icon: 'barChart',
      title: 'Productivity Pattern',
      message: `${bestDay.label} is your strongest productivity day at ${bestDay.rate}%.`,
      priority: 5
    });
  }

  const weekday = recent.byDay.slice(1, 6).reduce((out, day) => ({ scheduled: out.scheduled + day.scheduled, done: out.done + day.done }), { scheduled: 0, done: 0 });
  const weekend = [recent.byDay[0], recent.byDay[6]].reduce((out, day) => ({ scheduled: out.scheduled + day.scheduled, done: out.done + day.done }), { scheduled: 0, done: 0 });
  const weekdayRate = pct(weekday.done, weekday.scheduled);
  const weekendRate = pct(weekend.done, weekend.scheduled);
  if (weekend.scheduled >= 3 && weekdayRate - weekendRate >= 25) {
    insights.push({
      id: 'weekend-drop',
      type: 'consistency',
      tone: 'amber',
      icon: 'activity',
      title: 'Weekend Consistency Dip',
      message: `Your weekend consistency drops by ${weekdayRate - weekendRate}% compared with weekdays.`,
      priority: 3
    });
  }

  const categories = getBestCategory(thisWeek.byCategory);
  if (categories.length >= 2 && categories[0].rate - categories[categories.length - 1].rate >= 20) {
    insights.push({
      id: 'category-gap',
      type: 'category',
      tone: 'violet',
      icon: 'target',
      title: 'Category Signal',
      message: `${categories[0].category} habits are stronger than ${categories[categories.length - 1].category} habits this week.`,
      priority: 5
    });
  }

  if (progress.remaining > 0) {
    insights.push({
      id: 'xp-next-level',
      type: 'motivation',
      tone: 'violet',
      icon: 'zap',
      title: 'Level Progress',
      message: `You are ${progress.remaining} XP away from Level ${progress.level + 1}.`,
      priority: 4
    });
  }

  if (remainingToday > 0 && remainingToday <= 2) {
    insights.push({
      id: 'perfect-day',
      type: 'motivation',
      tone: 'emerald',
      icon: 'trophy',
      title: 'Perfect Day Within Reach',
      message: `Complete ${remainingToday} more habit${remainingToday === 1 ? '' : 's'} for a Perfect Day push.`,
      priority: 4
    });
  }

  if (recoveryScore >= 70 && recent.missed >= 2) {
    insights.push({
      id: 'recovery',
      type: 'recovery',
      tone: 'teal',
      icon: 'shieldCheck',
      title: 'Fast Recovery',
      message: 'You recover quickly after missed habits. That comeback pattern is a strength.',
      priority: 5
    });
  }

  return {
    scores: [
      { label: 'Discipline', value: disciplineScore, icon: 'shieldCheck' },
      { label: 'Recovery', value: recoveryScore, icon: 'activity' },
      { label: 'Momentum', value: momentumScore, icon: 'trendingUp' }
    ],
    insights: insights.sort((a, b) => a.priority - b.priority).slice(0, 6)
  };
}

export default function SmartInsights({ compact = false }) {
  const { state, gamification } = useApp();
  const { scores, insights } = useMemo(() => buildInsights({ state, gamification }), [state, gamification]);

  return (
    <section className={`smart-insights ${compact ? 'smart-insights--compact' : ''}`}>
      <header className="smart-insights__header">
        <div>
          <span className="smart-insights__kicker"><Icon name="brain" size={15} /> Smart Insights</span>
          <h2>Productivity Assistant</h2>
        </div>
        <div className="smart-score-strip">
          {scores.map((score) => (
            <span className="smart-score" key={score.label}>
              <Icon name={score.icon} size={15} />
              <strong>{score.value}</strong>
              <small>{score.label}</small>
            </span>
          ))}
        </div>
      </header>
      <div className="smart-insights__grid">
        {insights.map((insight) => (
          <article className={`smart-insight smart-insight--${insight.tone}`} key={insight.id}>
            <span className="smart-insight__icon"><Icon name={insight.icon} size={18} /></span>
            <div>
              <strong>{insight.title}</strong>
              <p>{insight.message}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
