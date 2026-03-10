import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { session, signOut } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => setShowLogoutConfirm(true);
  const handleLogoutConfirm = () => {
    signOut();
    // signOut() faz location.href = '/' e recarrega a app; modal fica visível até o reload
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#121212]/95 backdrop-blur-md shadow-lg">
        <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs text-gray-400 tracking-[0.2em] uppercase mb-0.5">
              Equipa M6 APC TRABLISA
            </p>
            <h2 className="text-lg sm:text-2xl font-bold text-white leading-tight truncate">
              {title}
            </h2>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            {/* Sair: só no Header em telemóvel (ecrãs pequenos); no PC fica na BottomNav */}
            {session && (
              <div className="flex md:hidden items-center">
                <button
                  type="button"
                  onClick={handleLogoutClick}
                  className="flex items-center gap-1 sm:gap-1.5 py-2 px-2 sm:px-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Sair da sessão"
                >
                  <LogOut className="w-4 h-4 sm:w-4 sm:h-4 shrink-0" />
                  <span className="text-[11px] sm:text-xs font-medium tracking-wide hidden sm:inline">
                    Sair
                  </span>
                </button>
              </div>
            )}
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#1A237E] to-[#B71C1C] flex items-center justify-center text-lg sm:text-2xl ring-2 ring-white/60 shadow-[0_0_16px_rgba(255,255,255,0.2)] shrink-0">
              🎾
            </div>
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
