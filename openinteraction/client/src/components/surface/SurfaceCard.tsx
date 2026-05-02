import { type ReactNode } from 'react';
import './surface.css';

interface SurfaceCardProps {
  children: ReactNode;
  className?: string;
}

function SurfaceCard({ children, className = '' }: SurfaceCardProps) {
  return (
    <div className={`surface-card ${className}`}>
      {children}
    </div>
  );
}

export default SurfaceCard;
