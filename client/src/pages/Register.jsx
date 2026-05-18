import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getAuthErrorMessage, registerUser } from '../services/authService';
import { useApp } from '../context/AppContext';

function validate(name, email, password, confirmPassword) {
  const errors = {};

  if (name.trim().length > 60) errors.name = 'Name must be 60 characters or less.';
  if (!email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.';

  if (!password) errors.password = 'Password is required.';
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters.';

  if (!confirmPassword) errors.confirmPassword = 'Confirm your password.';
  else if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';

  return errors;
}

export default function Register() {
  const { actions, auth } = useApp();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  console.info('[ReflectFlow auth] Register form render', {
    authLoading: auth.loading,
    initialized: auth.initialized,
    uid: auth.user?.uid || null
  });

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setSubmitError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(form.name, form.email, form.password, form.confirmPassword);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      actions.toast('Please fix the highlighted fields.', 'warning');
      return;
    }

    setLoading(true);
    setSubmitError('');

    try {
      await registerUser(form.email, form.password, form.name);
      actions.toast('Account created. Welcome to ReflectFlow!', 'success');
    } catch (error) {
      const message = getAuthErrorMessage(error);
      setSubmitError(message);
      actions.toast(message, 'error', 5200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card glass" aria-labelledby="register-title">
        <div className="auth-brand">
          <span className="brand-icon">✦</span>
          <span>ReflectFlow</span>
        </div>
        <header className="auth-header">
          <h1 id="register-title">Create your account</h1>
          <p>Start tracking habits with a private Firebase-backed sign-in.</p>
        </header>

        <form className="auth-form" onSubmit={submit} noValidate>
          <label>
            Name
            <input
              autoComplete="name"
              type="text"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'register-name-error' : undefined}
              placeholder="Optional display name"
            />
            {errors.name && <span id="register-name-error" className="field-error">{errors.name}</span>}
          </label>

          <label>
            Email
            <input
              autoComplete="email"
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'register-email-error' : undefined}
              placeholder="you@example.com"
            />
            {errors.email && <span id="register-email-error" className="field-error">{errors.email}</span>}
          </label>

          <label>
            Password
            <input
              autoComplete="new-password"
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'register-password-error' : undefined}
              placeholder="At least 6 characters"
            />
            {errors.password && <span id="register-password-error" className="field-error">{errors.password}</span>}
          </label>

          <label>
            Confirm Password
            <input
              autoComplete="new-password"
              type="password"
              value={form.confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value)}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'register-confirm-error' : undefined}
              placeholder="Repeat password"
            />
            {errors.confirmPassword && <span id="register-confirm-error" className="field-error">{errors.confirmPassword}</span>}
          </label>

          {submitError && <div className="auth-alert" role="alert">{submitError}</div>}

          <button type="submit" className="btn btn--primary auth-submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login" state={{ from: location.state?.from }}>Sign in</Link>
        </p>
      </section>
    </main>
  );
}
