import type { ReactNode } from 'react';

interface AuthCardLayoutProps {
  title: string;
  subtitle: string;
  narrow?: boolean;
  children: ReactNode;
}

export function AuthCardLayout({ title, subtitle, narrow = false, children }: AuthCardLayoutProps) {
  return (
    <div className="auth-body">
      <div className={`auth-card${narrow ? ' auth-narrow' : ''}`}>
        <div className="auth-brand">
          <img src="/assets/images/logo.svg" alt="EduNexa logo" />
          <div className="auth-name">EduNexa</div>
          <div className="auth-tag">Complete School Management System</div>
        </div>

        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">{subtitle}</p>

        {children}

        <div className="auth-footer">
          <div>
            <a href="/public" style={{ color: '#4f46e5', fontWeight: 600 }}>
              Visit Public School Website
            </a>
          </div>
          <div className="mt-1">&copy; {new Date().getFullYear()} Abdurrahman. All rights reserved.</div>
        </div>
      </div>
    </div>
  );
}
