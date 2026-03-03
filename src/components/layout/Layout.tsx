import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  showNav?: boolean;
}

export function Layout({ children, title, showNav = true }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className={`${showNav ? 'pb-20' : 'pb-4'}`}>
        {title && (
          <h1 className="sr-only">{title}</h1>
        )}
        {children}
      </main>

      {showNav && <BottomNav />}
    </div>
  );
}
