import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { HABIT_TEMPLATES_BY_INTEREST, INTERESTS } from '../data/habitTemplates';

export default function OnboardingPage() {
  const { auth, actions } = useApp();
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const previewCount = useMemo(() => {
    const titles = new Set();
    selected.forEach((interest) => {
      (HABIT_TEMPLATES_BY_INTEREST[interest] || []).forEach((habit) => titles.add(habit.title));
    });
    return Math.min(titles.size, 8);
  }, [selected]);

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  if (auth.onboardingChecked && !auth.onboardingRequired) {
    return <Navigate to="/" replace />;
  }

  const toggleInterest = (id) => {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  };

  const finish = async () => {
    setSaving(true);
    const completed = await actions.finishOnboarding(selected);
    setSaving(false);
    if (completed) {
      navigate('/', { replace: true });
    }
  };

  return (
    <main className="onboarding-page">
      <section className="onboarding-panel glass" aria-labelledby="onboarding-title">
        <div className="auth-brand onboarding-brand">
          <span className="brand-icon">✦</span>
          <span>ReflectFlow</span>
        </div>

        <header className="onboarding-header">
          <span className="onboarding-kicker">First setup</span>
          <h1 id="onboarding-title">Choose the habits you want your days to lean toward.</h1>
          <p>Select a few interests and ReflectFlow will create starter habits you can edit later.</p>
        </header>

        <div className="interest-grid" role="list" aria-label="Habit interests">
          {INTERESTS.map((interest) => {
            const active = selected.includes(interest.id);
            const templateCount = HABIT_TEMPLATES_BY_INTEREST[interest.id]?.length || 0;
            return (
              <button
                type="button"
                key={interest.id}
                className={`interest-card ${active ? 'selected' : ''}`}
                onClick={() => toggleInterest(interest.id)}
                aria-pressed={active}
              >
                <span className="interest-card__check" aria-hidden="true">{active ? '✓' : '+'}</span>
                <strong>{interest.label}</strong>
                <small>{templateCount} starter habits</small>
              </button>
            );
          })}
        </div>

        <footer className="onboarding-footer">
          <div>
            <strong>{selected.length} selected</strong>
            <span>{previewCount ? `${previewCount} starter habits will be created` : 'Pick at least one interest'}</span>
          </div>
          <button type="button" className="btn btn--primary" disabled={!selected.length || saving} onClick={finish}>
            {saving ? 'Creating habits...' : 'Create my dashboard'}
          </button>
        </footer>
      </section>
    </main>
  );
}
