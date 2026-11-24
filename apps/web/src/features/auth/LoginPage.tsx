import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { loginSchema, type DemoQuickSigninRole, type LoginInput } from '@school-erp/contracts';
import { ApiClientError, apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { AuthCardLayout } from './AuthCardLayout';

const QUICK_ROLES: Array<{ role: DemoQuickSigninRole; label: string; icon: string }> = [
  { role: 'super_admin', label: 'Superadmin', icon: 'bi-shield-lock-fill' },
  { role: 'school_admin', label: 'Admin', icon: 'bi-person-badge-fill' },
  { role: 'teacher', label: 'Teacher', icon: 'bi-easel-fill' },
  { role: 'parent', label: 'Parent', icon: 'bi-people-fill' },
  { role: 'student', label: 'Student', icon: 'bi-mortarboard-fill' },
  { role: 'accountant', label: 'Accountant', icon: 'bi-calculator-fill' },
  { role: 'librarian', label: 'Librarian', icon: 'bi-book-half' },
  { role: 'driver', label: 'Driver', icon: 'bi-bus-front-fill' },
  { role: 'hostel_warden', label: 'Hostel', icon: 'bi-building' },
];

export function LoginPage() {
  const { login, quickSignin } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busyRole, setBusyRole] = useState<DemoQuickSigninRole | null>(null);

  const demoConfig = useQuery({
    queryKey: ['auth', 'demo-config'],
    queryFn: () => apiFetch<{ quickSigninEnabled: boolean }>('/api/v1/auth/demo-config'),
    retry: false,
    staleTime: 300_000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      await login(values);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'MFA_REQUIRED') {
        setMfaRequired(true);
        setServerError('Enter your 6-digit authenticator code.');
      } else {
        setServerError(err instanceof ApiClientError ? err.message : 'Unable to sign in');
      }
    }
  }

  async function handleQuickSignin(role: DemoQuickSigninRole) {
    setServerError(null);
    setBusyRole(role);
    try {
      await quickSignin(role);
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : 'Quick sign-in unavailable');
    } finally {
      setBusyRole(null);
    }
  }

  return (
    <AuthCardLayout title="Sign In" subtitle="Use your school account to access your dashboard.">
      {serverError && (
        <div className="alert alert-danger py-2 small" role="alert">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-3">
          <label htmlFor="email" className="form-label small fw-semibold">
            Email address
          </label>
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-envelope" aria-hidden="true" />
            </span>
            <input
              id="email"
              type="email"
              placeholder="you@school.edu"
              autoComplete="username"
              className={`form-control ${errors.email ? 'is-invalid' : ''}`}
              {...register('email')}
            />
            {errors.email && <div className="invalid-feedback">{errors.email.message}</div>}
          </div>
        </div>

        <div className="mb-1">
          <label htmlFor="password" className="form-label small fw-semibold">
            Password
          </label>
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-lock" aria-hidden="true" />
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              className={`form-control ${errors.password ? 'is-invalid' : ''}`}
              {...register('password')}
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              style={{ borderTopRightRadius: 11, borderBottomRightRadius: 11, borderColor: '#d7dee8' }}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
            </button>
            {errors.password && <div className="invalid-feedback">{errors.password.message}</div>}
          </div>
        </div>

        {mfaRequired && (
          <div className="mt-3">
            <label htmlFor="totpCode" className="form-label small fw-semibold">
              Authenticator Code (6 digits)
            </label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-shield-check" aria-hidden="true" />
              </span>
              <input
                id="totpCode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                className="form-control"
                {...register('totpCode')}
              />
            </div>
          </div>
        )}

        <div className="auth-links">
          <div className="form-check m-0">
            <input id="rememberMe" type="checkbox" className="form-check-input" {...register('rememberMe')} />
            <label htmlFor="rememberMe" className="form-check-label">
              Remember me
            </label>
          </div>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button type="submit" className="btn btn-auth mt-2" disabled={isSubmitting || busyRole !== null}>
          {isSubmitting ? 'Signing in...' : 'Sign In'}{' '}
          <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
        </button>
      </form>

      {demoConfig.data?.quickSigninEnabled && (
        <div className="role-section">
          <div className="role-heading">
            <span>Quick sign in</span>
            <i className="bi bi-lightning-charge-fill" aria-hidden="true" />
          </div>
          <div className="role-grid">
            {QUICK_ROLES.map((item) => (
              <button
                key={item.role}
                type="button"
                className="role-btn"
                title={`Sign in as ${item.label}`}
                disabled={busyRole !== null || isSubmitting}
                onClick={() => handleQuickSignin(item.role)}
              >
                <i className={`bi ${item.icon}`} aria-hidden="true" />
                <span>{busyRole === item.role ? 'Signing in...' : item.label}</span>
              </button>
            ))}
          </div>
          <div className="text-muted small mt-2">
            <i className="bi bi-info-circle me-1" aria-hidden="true" />
            Development/demo mode only. Disabled when running in production.
          </div>
        </div>
      )}
    </AuthCardLayout>
  );
}
