import { ReactNode } from 'react';
import { CATEGORY_STYLES, type GameCategory } from '../../domain/categoryTheme';

interface CategoryCardProps {
  category: GameCategory;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Cartão de categoria (verde/azul). O elemento principal é SEMPRE <div> — nunca <button> —
 * para evitar o erro "button cannot appear as a descendant of button" quando o conteúdo tem botões.
 * Não usar role="button" nem onClick no wrapper; o conteúdo pode conter <Button> ou <button>.
 */
export function CategoryCard({ category, header, children, className = '' }: CategoryCardProps) {
  const styles = CATEGORY_STYLES[category];
  return (
    <div
      className={`rounded-xl overflow-hidden bg-white shadow-lg border border-gray-100 flex flex-col ${className}`}
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
