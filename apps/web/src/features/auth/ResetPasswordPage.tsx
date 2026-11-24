import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPasswordSchema, type ResetPasswordInput } from '@school-erp/contracts';
import { ApiClientError, apiFetch } from '../../api/client';
import { AuthCardLayout } from './AuthCardLayout';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: searchParams.get('token') ?? '' },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setNotice(`${res.message} You can now sign in with your new password.`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to reset password');
    }
  }

  return (
    <AuthCardLayout
      title="Reset Password"
      subtitle="Enter your reset token and choose a new password (min 10 characters)."
      narrow
    >
      {notice && <div className="alert alert-success py-2 small">{notice}</div>}
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-3">
          <label htmlFor="rp-token" className="form-label small fw-semibold">
            Reset Token
          </label>
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-key" aria-hidden="true" />
            </span>
            <input
              id="rp-token"
              type="text"
              placeholder="Paste reset token"
              className={`form-control ${errors.token ? 'is-invalid' : ''}`}
              {...register('token')}
            />
            {errors.token && <div className="invalid-feedback">{errors.token.message}</div>}
          </div>
        </div>

        <div className="mb-3">
          <label htmlFor="rp-password" className="form-label small fw-semibold">
            New Password
          </label>
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-lock" aria-hidden="true" />
            </span>
            <input
              id="rp-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Minimum 10 characters"
              autoComplete="new-password"
              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              className={`form-control ${errors.newPassword ? 'is-invalid' : ''}`}
              {...register('newPassword')}
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
            {errors.newPassword && <div className="invalid-feedback">{errors.newPassword.message}</div>}
          </div>
        </div>

        <button type="submit" className="btn btn-auth" disabled={isSubmitting}>
          {isSubmitting ? 'Updating...' : 'Update Password'}
        </button>
      </form>

      <div className="auth-links mt-3">
        <Link to="/login">
          <i className="bi bi-arrow-left me-1" aria-hidden="true" />
          Back to Sign In
        </Link>
        <Link to="/forgot-password">Request a new token</Link>
      </div>
    </AuthCardLayout>
  );
}
