import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@school-erp/contracts';
import { ApiClientError, apiFetch } from '../../api/client';
import { AuthCardLayout } from './AuthCardLayout';

export function ForgotPasswordPage() {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setNotice(res.message);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to process request');
    }
  }

  return (
    <AuthCardLayout
      title="Forgot Password"
      subtitle="Enter your account email and we will prepare a reset link."
      narrow
    >
      {notice && <div className="alert alert-success py-2 small">{notice}</div>}
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-3">
          <label htmlFor="fp-email" className="form-label small fw-semibold">
            Email address
          </label>
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-envelope" aria-hidden="true" />
            </span>
            <input
              id="fp-email"
              type="email"
              placeholder="you@school.edu"
              className={`form-control ${errors.email ? 'is-invalid' : ''}`}
              {...register('email')}
            />
            {errors.email && <div className="invalid-feedback">{errors.email.message}</div>}
          </div>
        </div>

        <button type="submit" className="btn btn-auth" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Request Reset Link'}
        </button>
      </form>

      <div className="auth-links mt-3">
        <Link to="/login">
          <i className="bi bi-arrow-left me-1" aria-hidden="true" />
          Back to Sign In
        </Link>
        <Link to="/reset-password">Have a reset token?</Link>
      </div>
    </AuthCardLayout>
  );
}
