/**
 * Sistema de design por categoria — Alverca Padel Club
 * Liga: Azul Profundo → Vermelho/Bordô
 * Torneios: Verde Esmeralda → Verde Floresta
 * MIX: Azul Turquesa → Azul Oceano
 * Treinos: Laranja Vibrante → Âmbar
 */

export type GameCategory = 'Liga' | 'Torneio' | 'Mix' | 'Treino';

export function getCategoryFromPhase(phase: string | null | undefined): GameCategory {
  if (!phase) return 'Liga';
  const p = String(phase).trim();
  if (['Qualificação', 'Regionais', 'Nacionais'].includes(p)) return 'Liga';
  if (p === 'Treino') return 'Treino';
  if (p === 'Mix') return 'Mix';
  if (p === 'Torneio' || /quartos|meia|final/i.test(p)) return 'Torneio';
  if (/treino/i.test(p)) return 'Treino';
  if (/qualificação|regionais|nacionais/i.test(p)) return 'Liga';
  if (/torneio|quartos|meia|final/i.test(p)) return 'Torneio';
  if (/mix/i.test(p)) return 'Mix';
  return 'Liga';
}

export const CATEGORY_STYLES: Record<GameCategory, {
  headerGradient: string;
  headerText: string;
  buttonClasses: string;
  iconBg: string;
}> = {
  Liga: {
    headerGradient: 'bg-gradient-to-r from-blue-900 via-blue-800 to-red-800',
    headerText: 'text-white',
    buttonClasses: 'bg-blue-700 hover:bg-blue-800 text-white shadow-md hover:shadow-lg hover:shadow-blue-500/30 transition-all',
    iconBg: 'bg-blue-100 text-blue-700',
  },
  Torneio: {
    headerGradient: 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-green-800',
    headerText: 'text-white',
    buttonClasses: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg hover:shadow-emerald-500/30 transition-all',
    iconBg: 'bg-emerald-100 text-emerald-700',
  },
  Mix: {
    headerGradient: 'bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-600',
    headerText: 'text-white',
    buttonClasses: 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-md hover:shadow-lg hover:shadow-cyan-400/40 transition-all',
    iconBg: 'bg-cyan-100 text-cyan-700',
  },
  Treino: {
    headerGradient: 'bg-gradient-to-r from-orange-400 via-orange-500 to-amber-600',
    headerText: 'text-white',
    buttonClasses: 'bg-orange-500 hover:bg-orange-600 text-white shadow-md hover:shadow-lg hover:shadow-orange-500/30 transition-all',
    iconBg: 'bg-orange-100 text-orange-700',
  },
};

export const GRID_CLASSES = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
