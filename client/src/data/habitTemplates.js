export const INTERESTS = [
  { id: 'fitness', label: 'Fitness' },
  { id: 'health', label: 'Health' },
  { id: 'coding', label: 'Coding' },
  { id: 'career', label: 'Career' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'reading', label: 'Reading' },
  { id: 'discipline', label: 'Discipline' },
  { id: 'finance', label: 'Finance' },
  { id: 'communication', label: 'Communication' },
  { id: 'mental-health', label: 'Mental Health' }
];

export const HABIT_TEMPLATES_BY_INTEREST = {
  fitness: [
    { title: 'Move for 30 minutes', description: 'Walk, train, stretch, or play.', category: 'Fitness', target: '30 minutes', frequency: 'daily' },
    { title: 'Strength training session', description: 'Build strength with a focused workout.', category: 'Fitness', target: '3 sessions per week', frequency: 'custom', customDays: [1, 3, 5] }
  ],
  health: [
    { title: 'Drink enough water', description: 'Keep a steady hydration rhythm.', category: 'Health', target: '2 liters', frequency: 'daily' },
    { title: 'Sleep before midnight', description: 'Protect recovery and energy.', category: 'Health', target: 'Before 12:00 AM', frequency: 'daily' }
  ],
  coding: [
    { title: 'Code for 45 minutes', description: 'Practice or build one useful piece.', category: 'Learning', target: '45 minutes', frequency: 'daily' },
    { title: 'Solve one coding problem', description: 'Keep problem-solving skills warm.', category: 'Career', target: '1 problem', frequency: 'daily' }
  ],
  career: [
    { title: 'Plan tomorrow at work', description: 'Pick the next most important task.', category: 'Career', target: '5 minute plan', frequency: 'custom', customDays: [1, 2, 3, 4, 5] },
    { title: 'Improve one professional skill', description: 'Small deliberate practice for your craft.', category: 'Career', target: '20 minutes', frequency: 'daily' }
  ],
  productivity: [
    { title: 'Review top 3 priorities', description: 'Start with the few things that matter.', category: 'Productivity', target: 'Top 3 list', frequency: 'daily' },
    { title: 'One focused work block', description: 'No distractions, one clear outcome.', category: 'Productivity', target: '45 minutes', frequency: 'daily' }
  ],
  reading: [
    { title: 'Read 10 pages', description: 'Let pages compound quietly.', category: 'Learning', target: '10 pages', frequency: 'daily' },
    { title: 'Capture one idea from reading', description: 'Write one useful note from what you read.', category: 'Learning', target: '1 note', frequency: 'daily' }
  ],
  discipline: [
    { title: 'Wake up on time', description: 'Start the day with one clean promise kept.', category: 'Lifestyle', target: 'Chosen wake time', frequency: 'daily' },
    { title: 'Finish one hard task first', description: 'Do the thing you would otherwise delay.', category: 'Discipline', target: '1 task', frequency: 'daily' }
  ],
  finance: [
    { title: 'Track daily spending', description: 'Keep money visible and intentional.', category: 'Finance', target: 'Log expenses', frequency: 'daily' },
    { title: 'Review budget weekly', description: 'Check the plan before the week runs away.', category: 'Finance', target: '10 minutes', frequency: 'custom', customDays: [0] }
  ],
  communication: [
    { title: 'Send one thoughtful update', description: 'Keep people aligned before they have to ask.', category: 'Communication', target: '1 update', frequency: 'custom', customDays: [1, 2, 3, 4, 5] },
    { title: 'Practice active listening', description: 'One conversation with full attention.', category: 'Communication', target: '1 conversation', frequency: 'daily' }
  ],
  'mental-health': [
    { title: 'Take a mindful pause', description: 'Slow down and reset your nervous system.', category: 'Mindfulness', target: '5 minutes', frequency: 'daily' },
    { title: 'Write a short reflection', description: 'Name what you feel and what you need.', category: 'Mindfulness', target: '3 sentences', frequency: 'daily' }
  ]
};

export function getHabitTemplatesForInterests(interests) {
  const seen = new Set();
  return interests.flatMap((interest) => HABIT_TEMPLATES_BY_INTEREST[interest] || [])
    .filter((template) => {
      if (seen.has(template.title)) return false;
      seen.add(template.title);
      return true;
    })
    .slice(0, 8);
}
