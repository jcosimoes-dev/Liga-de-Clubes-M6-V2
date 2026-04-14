import { useState } from "react";
import { Home, Users, Calendar, Trophy, History, LogOut } from "lucide-react";
import { useNavigation } from "../../contexts/NavigationContext";
import { useAuth } from "../../contexts/AuthContext";
import { PlayerRoles } from "../../domain/constants";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export type NavTabId = "home" | "team" | "calendar" | "history" | "sport-management" | "admin";

function isActiveRoute(currentRoute: string, tabId: NavTabId) {
  if (tabId === "home") return currentRoute === "home" || currentRoute === "game";
  return currentRoute === tabId;
}

const btnBase =
  "relative z-10 flex flex-col items-center justify-center h-full min-h-[44px] px-1 transition-colors pointer-events-auto";

export function BottomNav() {
  const { route, navigate } = useNavigation();
  const { canManageSport, role, signOut } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const canAccessGestao =
    canManageSport ||
    role === PlayerRoles.admin ||
    role === PlayerRoles.coordenador ||
    role === PlayerRoles.capitao;

  const handleGestao = () => {
    if (canAccessGestao) {
      navigate({ name: "sport-management" });
    } else {
      navigate({ name: "home", params: { accessDenied: true } });
    }
  };

  const navItems = [
    {
      id: "home" as NavTabId,
      label: "Início",
      icon: <Home className="w-6 h-6 shrink-0" />,
      onClick: () => navigate({ name: "home" }),
    },
    {
      id: "team" as NavTabId,
      label: "Equipa",
      icon: <Users className="w-6 h-6 shrink-0" />,
      onClick: () => navigate({ name: "team" }),
    },
    {
      id: "calendar" as NavTabId,
      label: "Calendário",
      icon: <Calendar className="w-6 h-6 shrink-0" />,
      onClick: () => navigate({ name: "calendar" }),
    },
    {
      id: "history" as NavTabId,
      label: "Histórico",
      icon: <History className="w-6 h-6 shrink-0" />,
      onClick: () => navigate({ name: "history" }),
    },
    {
      id: "sport-management" as NavTabId,
      label: "Gestão",
      icon: <Trophy className="w-6 h-6 shrink-0" />,
      onClick: handleGestao,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom z-50 pointer-events-none"
      role="navigation"
      aria-label="Menu principal"
    >
      <div className="flex justify-around items-center h-16 w-full max-w-screen-sm mx-auto pointer-events-none">
        {navItems.map(({ id, label, icon, onClick }) => {
          const active = isActiveRoute(route.name, id);
          const isLocked = id === "sport-management" && !canAccessGestao;
          return (
            <button
              key={id}
              type="button"
              onClick={onClick}
              aria-label={label}
              className={`${btnBase} ${active ? "text-blue-600" : isLocked ? "text-gray-400" : "text-gray-600"}`}
            >
              {icon}
              <span className="text-[10px] mt-0.5 truncate px-0.5">{label}</span>
              {isLocked && (
                <span className="absolute top-1 right-1 text-[8px] leading-none">🔒</span>
              )}
            </button>
          );
        })}

        {/* Sair — visível em todos os ecrãs */}
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className={`${btnBase} text-gray-600 hover:text-red-600`}
          aria-label="Sair da sessão"
        >
          <LogOut className="w-6 h-6 shrink-0" />
          <span className="text-[10px] mt-0.5 truncate px-0.5">Sair</span>
        </button>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Sair da sessão"
        message="Tem a certeza que deseja sair da sessão?"
        confirmText="Sair"
        cancelText="Cancelar"
        variant="warning"
        onConfirm={() => { signOut(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </nav>
  );
}
