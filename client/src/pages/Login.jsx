import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getAuthErrorMessage, loginUser } from '../services/authService';
import { useApp } from '../context/AppContext';
import GoogleAuthButton from '../components/Auth/GoogleAuthButton';

function validate(email, password) {
  const errors = {};

  if (!email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.';

  if (!password) errors.password = 'Password is required.';

  return errors;
}

export default function Login() {
  const { actions, auth } = useApp();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState('');

  console.info('[ReflectFlow auth] Login form render', {
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
    const nextErrors = validate(form.email, form.password);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      actions.toast('Please fix the highlighted fields.', 'warning');
      return;
    }

    setLoading('password');
    setSubmitError('');

    try {
      await loginUser(form.email, form.password);
      actions.toast('Welcome back to ReflectFlow', 'success');
    } catch (error) {
      const message = getAuthErrorMessage(error);
      setSubmitError(message);
      actions.toast(message, 'error', 5200);
    } finally {
      setLoading('');
    }
  };

  const handleGoogleStart = () => {
    setLoading('google');
    setSubmitError('');
    setErrors({});
  };

  const handleGoogleSuccess = ({ isNewUser }) => {
    actions.toast(isNewUser ? 'Google account connected. Welcome to ReflectFlow!' : 'Signed in with Google', 'success');
    setLoading('');
  };

  const handleGoogleError = (message) => {
    setSubmitError(message);
    actions.toast(message, 'error', 5200);
    setLoading('');
  };

  return (
    <main className="auth-shell">
      <section className="auth-card glass" aria-labelledby="login-title">
        <div className="auth-brand">
          <span className="brand-icon">✦</span>
          <span>ReflectFlow</span>
        </div>
        <header className="auth-header">
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to keep your habit dashboard private and persistent.</p>
        </header>

        <GoogleAuthButton
          loading={loading === 'google'}
          disabled={loading === 'password'}
          onStart={handleGoogleStart}
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
        />

        <div className="auth-divider"><span>or sign in with email</span></div>

        <form className="auth-form" onSubmit={submit} noValidate>
          <label>
            Email
            <input
              autoComplete="email"
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              placeholder="you@example.com"
            />
            {errors.email && <span id="login-email-error" className="field-error">{errors.email}</span>}
          </label>

          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              placeholder="Your password"
            />
            {errors.password && <span id="login-password-error" className="field-error">{errors.password}</span>}
          </label>

          {submitError && <div className="auth-alert" role="alert">{submitError}</div>}

          <button type="submit" className="btn btn--primary auth-submit" disabled={!!loading}>
            {loading === 'password' ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          New to ReflectFlow? <Link to="/register" state={{ from: location.state?.from }}>Create an account</Link>
        </p>
      </section>
    </main>
  );
}
