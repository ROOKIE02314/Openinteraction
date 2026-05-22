import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import './dashboard-layout.css';

interface DashboardLayoutProps {
  title?: string;
  subtitle?: string;
  breadcrumb?: ReactNode;
  children: ReactNode;
}

function DashboardLayout({ title, subtitle, breadcrumb, children }: DashboardLayoutProps) {
  return (
    <div className="dash-layout">
      <Sidebar />
      <div className="dash-column">
        <header className="dash-header">
          <div className="dash-header-titles">
            {title && <h1 className="dash-header-title">{title}</h1>}
            {subtitle && <p className="dash-header-subtitle">{subtitle}</p>}
          </div>
          <div className="dash-header-meta">
            {breadcrumb && <nav className="dash-breadcrumb">{breadcrumb}</nav>}
            <Link to="/dashboard" className="dash-brand">
              <span className="dash-brand-dot" />
              <span className="dash-brand-text">研究面板</span>
            </Link>
          </div>
        </header>
        <main className="dash-main">{children}</main>
      </div>
    </div>
  );
}

export default DashboardLayout;
