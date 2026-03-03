import { HTMLAttributes, ReactNode } from 'react';
import { CATEGORY_STYLES, type GameCategory } from '../../domain/categoryTheme';

interface CategoryCardProps extends HTMLAttributes<HTMLDivElement> {
  category: GameCategory;
  header?: ReactNode;
  children: ReactNode;
}

export function CategoryCard({ category, header, children, className = '', ...props }: CategoryCardProps) {
  const styles = CATEGORY_STYLES[category];
  return (
    <div
      className={`rounded-xl overflow-hidden bg-white shadow-lg border border-gray-100 flex flex-col ${className}`}
      {...props}
    >
      {header && (
        <div className={`px-4 py-3 ${styles.headerGradient} ${styles.headerText}`}>
          {header}
        </div>
      )}
      <div className="p-4 flex-1">{children}</div>
    </div>
  );
}
