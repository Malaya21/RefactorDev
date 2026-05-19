import {
  collectionGroup,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCurrentWeekDates, getWeekRange } from '../utils/date';
import { calculateLevel } from '../utils/levelSystem';
import { getHabitStatusForDate } from '../utils/historyHelpers';

const LEADERBOARD_LIMIT = 50;

function leaderboardRef(uid) {
  return doc(db, 'users', uid, 'leaderboard', 'current');
}

function userLabel(user) {
  return user?.displayName || user?.email?.split('@')[0] || 'ReflectFlow user';
}

export function getWeeklyXP(gamification, weekDates = getCurrentWeekDates()) {
  const dailyXP = gamification?.dailyXP || {};
  return weekDates.reduce((sum, dateKey) => sum + Number(dailyXP[dateKey] || 0), 0);
}

export function getCompletedThisWeek(habits, weekDates = getCurrentWeekDates()) {
  return (habits || []).reduce((total, habit) => {
    return total + weekDates.filter((dateKey) => getHabitStatusForDate(habit, dateKey) === 'done').length;
  }, 0);
}

export function getCurrentStreakScore(habits) {
  return (habits || []).reduce((max, habit) => Math.max(max, habit.streak?.current || 0), 0);
}

export function buildLeaderboardEntry({ user, habits, gamification, date = new Date() }) {
  const week = getWeekRange(date);
  const weekDates = getCurrentWeekDates(date);
  return {
    uid: user.uid,
    displayName: userLabel(user),
    photoURL: user.photoURL || '',
    weekKey: week.weekKey,
    weekStart: week.start,
    weekEnd: week.end,
    weeklyXP: getWeeklyXP(gamification, weekDates),
    currentStreak: getCurrentStreakScore(habits),
    completedThisWeek: getCompletedThisWeek(habits, weekDates),
    level: gamification?.currentLevel || calculateLevel(gamification?.totalXP || 0),
    totalXP: gamification?.totalXP || 0
  };
}

export async function syncLeaderboardEntry(uid, entry) {
  if (!uid || !entry?.uid || uid !== entry.uid) {
    throw new Error('Invalid leaderboard entry owner');
  }

  await setDoc(leaderboardRef(uid), {
    ...entry,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export function subscribeToWeeklyLeaderboard(weekKey, callback, onError) {
  if (!weekKey) return () => {};
  const q = query(
    collectionGroup(db, 'leaderboard'),
    where('weekKey', '==', weekKey),
    orderBy('weeklyXP', 'desc'),
    limit(LEADERBOARD_LIMIT)
  );

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs
      .map((entryDoc) => ({ id: entryDoc.id, ...entryDoc.data() }))
      .sort((a, b) => {
        if ((b.weeklyXP || 0) !== (a.weeklyXP || 0)) return (b.weeklyXP || 0) - (a.weeklyXP || 0);
        if ((b.currentStreak || 0) !== (a.currentStreak || 0)) return (b.currentStreak || 0) - (a.currentStreak || 0);
        return (b.completedThisWeek || 0) - (a.completedThisWeek || 0);
      });
    callback(entries);
  }, onError);
}
