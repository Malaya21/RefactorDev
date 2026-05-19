const LEVEL_TITLES = [
  'Beginner',
  'Consistent',
  'Focused',
  'Habit Warrior',
  'Discipline Master'
];

function levelThreshold(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  const explicit = {
    1: 0,
    2: 100,
    3: 250,
    4: 500
  };

  if (explicit[safeLevel] !== undefined) return explicit[safeLevel];

  let threshold = explicit[4];
  for (let current = 5; current <= safeLevel; current += 1) {
    threshold += Math.round(250 * Math.pow(current - 3, 1.25));
  }
  return threshold;
}

export function xpToNextLevel(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  return levelThreshold(safeLevel + 1) - levelThreshold(safeLevel);
}

export function calculateLevel(xp) {
  const safeXp = Math.max(0, Number(xp) || 0);
  let level = 1;

  while (safeXp >= levelThreshold(level + 1)) {
    level += 1;
  }

  return level;
}

export function getLevelProgress(xp) {
  const safeXp = Math.max(0, Number(xp) || 0);
  const level = calculateLevel(safeXp);
  const levelStartXp = levelThreshold(level);
  const nextLevelXp = xpToNextLevel(level);
  const earnedInLevel = safeXp - levelStartXp;
  const remaining = Math.max(0, nextLevelXp - earnedInLevel);
  const progress = nextLevelXp ? Math.min(100, Math.round((earnedInLevel / nextLevelXp) * 100)) : 100;

  return {
    level,
    levelStartXp,
    nextLevelXp,
    earnedInLevel,
    remaining,
    progress
  };
}

export function getLevelTitle(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  if (safeLevel >= 20) return 'Discipline Master';
  if (safeLevel >= 10) return 'Habit Warrior';
  if (safeLevel >= 4) return 'Focused';
  if (safeLevel >= 2) return 'Consistent';
  return LEVEL_TITLES[0];
}
