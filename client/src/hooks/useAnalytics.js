import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import * as analytics from '../services/analyticsService';

export function useAnalytics() {
  const { state } = useApp();
  return useMemo(() => ({
    stats: analytics.todayStats(state),
    longest: analytics.globalLongestStreak(state),
    weekly: analytics.getDailyCompletion(state, 7),
    monthly: analytics.getMonthlyData(state),
    trend: analytics.getDailyCompletion(state, 14),
    heatmap: analytics.getHeatmapData(state),
    successRates: analytics.getSuccessRates(state),
    topBottom: analytics.getTopBottom(state)
  }), [state]);
}
