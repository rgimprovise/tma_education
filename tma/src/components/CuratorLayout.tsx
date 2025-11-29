import { ReactNode } from 'react';
import { CuratorTabBar } from './CuratorTabBar';
import './CuratorLayout.css';

interface CuratorLayoutProps {
  children: ReactNode;
}

export function CuratorLayout({ children }: CuratorLayoutProps) {
  return (
    <div className="curator-layout">
      <CuratorTabBar />
      <div className="curator-content">
        {children}
      </div>
    </div>
  );
}

