import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './dashboard-layout.css';

interface DashboardLayoutProps {
  breadcrumb?: ReactNode;
  children: ReactNode;
}

function DashboardLayout({ breadcrumb, children }: DashboardLayoutProps) {
  return (
    <div className="dash-layout">
      <header className="dash-header">
        <Link to="/dashboard" className="dash-brand">
          <span className="dash-brand-dot" />
          <span className="dash-brand-text">研究面板</span>
        </Link>
        {breadcrumb && <nav className="dash-breadcrumb">{breadcrumb}</nav>}
      </header>
      <main className="dash-main">{children}</main>
    </div>
  );
}

export default DashboardLayout;
