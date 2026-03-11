import { useState } from 'react';
import { LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';

interface HeaderProps {
  title: string;
  /** Se definido, mostra botão Voltar que chama esta função (ex.: goBack para regressar ao ecrã anterior). */
  onBack?: () => void;
  /** Conteúdo opcional à direita (ex.: botão Recalcular Pontos). No PC fica alinhado à direita no Header. */
  rightContent?: React.ReactNode;
}

export function Header({ title, onBack, rightContent }: HeaderProps) {
  const { session, signOut } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => setShowLogoutConfirm(true);
  const handleLogoutConfirm = () => {
    signOut();
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#121212]/95 backdrop-blur-md shadow-lg">
        {/* Mobile: flex md:hidden — Voltar + título + Sair + bola */}
        <div className="flex md:hidden px-4 py-3 items-center justify-between gap-2 w-full">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onBack();
                }}
                className="flex items-center gap-1.5 py-2 px-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-xs font-medium">Voltar</span>
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-gray-400 tracking-[0.2em] uppercase mb-0.5">Equipa M6 APC TRABLISA</p>
              <h2 className="text-lg font-bold text-white leading-tight truncate">{title}</h2>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {session && (
              <button
                type="button"
                onClick={handleLogoutClick}
                className="flex items-center gap-1.5 py-2 px-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Sair"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="text-[11px] font-medium">Sair</span>
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1A237E] to-[#B71C1C] flex items-center justify-center text-lg ring-2 ring-white/60 shadow-[0_0_16px_rgba(255,255,255,0.2)] shrink-0">
              🎾
            </div>
          </div>
        </div>

        {/* PC (Desktop): hidden md:flex — 100% largura. Esquerda: Voltar + título + bola. Direita: rightContent (ex. Recalcular Pontos). */}
        <div className="hidden md:flex flex-row justify-between items-center w-full px-6 py-4 lg:px-10 gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {onBack && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onBack();
                }}
                className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                aria-label="Voltar ao ecrã anterior"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-xl lg:text-2xl font-bold text-white leading-tight truncate">{title}</h2>
            <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-[#1A237E] to-[#B71C1C] flex items-center justify-center text-xl lg:text-2xl ring-2 ring-white/60 shadow-[0_0_16px_rgba(255,255,255,0.2)] shrink-0">
              🎾
            </div>
          </div>
          <div className="flex items-center justify-end shrink-0">
            {rightContent}
          </div>
        </div>
        <div className="h-[3px] w-full bg-gradient-to-r from-[#1A237E] to-[#B71C1C]" aria-hidden />
      </header>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Sair da sessão"
        message="Tem a certeza que deseja sair da sessão?"
        confirmText="Sair"
        cancelText="Cancelar"
        variant="warning"
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}
