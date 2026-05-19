import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateLevel } from '../utils/levelSystem';
import { getStatus, isScheduledDay } from './streakService';

export const XP_REWARDS = {
  COMPLETE_HABIT: 10,
  DAILY_STREAK: 20,
  STREAK_7: 50,
  STREAK_30: 200,
  PERFECT_DAY: 30
};

export const DEFAULT_GAMIFICATION = {
  totalXP: 0,
  currentLevel: 1,
  completedHabitsCount: 0,
  streakBonus: 0,
  todayXP: 0
};

function gamificationRef(uid) {
  return doc(db, 'users', uid, 'gamification', 'main');
}

function xpEventRef(uid, eventId) {
  return doc(db, 'users', uid, 'xpEvents', eventId);
}

function toEventId(dateKey, habitId, type) {
  return `${dateKey}_${habitId}_${type}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function getTodayScheduledHabits(habits, dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  return habits.filter((habit) => isScheduledDay(habit, date));
}

function getPerfectDayAward(habitsAfterCompletion, dateKey) {
  const scheduled = getTodayScheduledHabits(habitsAfterCompletion, dateKey);
  const completed = scheduled.filter((habit) => getStatus(habit, dateKey) === 'completed');
  return scheduled.length > 0 && completed.length === scheduled.length;
}

function buildCompletionAwards({ habitAfter, habitsAfterCompletion, dateKey }) {
  const awards = [
    {
      id: toEventId(dateKey, habitAfter.id, 'complete'),
      type: 'complete_habit',
      xp: XP_REWARDS.COMPLETE_HABIT,
      streakBonus: 0
    }
  ];

  const streak = habitAfter.streak?.current || 0;
  if (streak >= 2) {
    awards.push({
      id: toEventId(dateKey, habitAfter.id, 'daily-streak'),
      type: 'daily_streak',
      xp: XP_REWARDS.DAILY_STREAK,
      streakBonus: XP_REWARDS.DAILY_STREAK
    });
  }

  if (streak === 7) {
    awards.push({
      id: toEventId(dateKey, habitAfter.id, 'streak-7'),
      type: 'streak_7',
      xp: XP_REWARDS.STREAK_7,
      streakBonus: XP_REWARDS.STREAK_7
    });
  }

  if (streak === 30) {
    awards.push({
      id: toEventId(dateKey, habitAfter.id, 'streak-30'),
      type: 'streak_30',
      xp: XP_REWARDS.STREAK_30,
      streakBonus: XP_REWARDS.STREAK_30
    });
  }

  if (getPerfectDayAward(habitsAfterCompletion, dateKey)) {
    awards.push({
      id: toEventId(dateKey, 'all', 'perfect-day'),
      type: 'perfect_day',
      xp: XP_REWARDS.PERFECT_DAY,
      streakBonus: 0
    });
  }

  return awards;
}

export function subscribeToGamification(uid, callback, onError) {
  if (!uid) return () => {};
  return onSnapshot(gamificationRef(uid), (snapshot) => {
    callback(snapshot.exists() ? { ...DEFAULT_GAMIFICATION, ...snapshot.data() } : DEFAULT_GAMIFICATION);
  }, onError);
}

export async function ensureGamificationProfile(uid) {
  if (!uid) throw new Error('Invalid user ID for gamification profile');
  const ref = gamificationRef(uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    await setDoc(ref, {
      ...DEFAULT_GAMIFICATION,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

export async function awardHabitCompletionXP(uid, { habitBefore, habitAfter, habitsAfterCompletion, dateKey }) {
  if (!uid || !habitAfter?.id || !dateKey) {
    throw new Error('Invalid XP award payload');
  }

  if (getStatus(habitBefore || {}, dateKey) === 'completed') {
    return { awardedXP: 0, leveledUp: false, events: [] };
  }

  const awards = buildCompletionAwards({ habitAfter, habitsAfterCompletion, dateKey });
  const profileRef = gamificationRef(uid);

  return runTransaction(db, async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    const current = profileSnapshot.exists()
      ? { ...DEFAULT_GAMIFICATION, ...profileSnapshot.data() }
      : DEFAULT_GAMIFICATION;

    const eventSnapshots = await Promise.all(awards.map((award) => transaction.get(xpEventRef(uid, award.id))));
    const newAwards = awards.filter((_, index) => !eventSnapshots[index].exists());
    const awardedXP = newAwards.reduce((sum, award) => sum + award.xp, 0);
    const awardedStreakBonus = newAwards.reduce((sum, award) => sum + award.streakBonus, 0);

    if (!awardedXP) {
      return { awardedXP: 0, leveledUp: false, events: [] };
    }

    const previousLevel = current.currentLevel || calculateLevel(current.totalXP || 0);
    const nextTotalXP = (current.totalXP || 0) + awardedXP;
    const nextLevel = calculateLevel(nextTotalXP);
    const nextDailyXP = {
      ...(current.dailyXP || {}),
      [dateKey]: ((current.dailyXP || {})[dateKey] || 0) + awardedXP
    };

    transaction.set(profileRef, {
      totalXP: nextTotalXP,
      currentLevel: nextLevel,
      completedHabitsCount: (current.completedHabitsCount || 0) + (newAwards.some((award) => award.type === 'complete_habit') ? 1 : 0),
      streakBonus: (current.streakBonus || 0) + awardedStreakBonus,
      todayXP: nextDailyXP[dateKey],
      dailyXP: nextDailyXP,
      updatedAt: serverTimestamp()
    }, { merge: true });

    newAwards.forEach((award) => {
      transaction.set(xpEventRef(uid, award.id), {
        type: award.type,
        xp: award.xp,
        habitId: habitAfter.id,
        dateKey,
        createdAt: serverTimestamp()
      });
    });

    return {
      awardedXP,
      leveledUp: nextLevel > previousLevel,
      previousLevel,
      currentLevel: nextLevel,
      events: newAwards.map((award) => award.type)
    };
  });
}
