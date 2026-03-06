import { ReactNode, useCallback } from 'react';
import { CATEGORY_STYLES, type GameCategory } from '../../domain/categoryTheme';

interface CategoryCardProps {
  category: GameCategory;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Se definido, o cartão é clicável (usa div com onClick; evita <button> para não ter button inside button). */
  onClick?: () => void;
}

/**
 * Cartão de categoria (verde/azul). Usa sempre <div> no exterior (nunca <button>) para evitar
 * "button inside button" na consola; se onClick for passado, aplica cursor-pointer e role="button".
 */
export function CategoryCard({ category, header, children, className = '', onClick }: CategoryCardProps) {
  const styles = CATEGORY_STYLES[category];
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );
  return (
    <div
      role={onClick ? 'button' : 'group'}
      aria-roledescription="cartão"
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`rounded-xl overflow-hidden bg-white shadow-lg border border-gray-100 flex flex-col ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {header != null && (
        <div className={`px-4 py-3 ${styles.headerGradient} ${styles.headerText}`}>
          {header}
        </div>
      )}
      <div className="p-4 flex-1">{children}</div>
    </div>
  );
}
