import { useState } from "react";
import { Home, Users, Calendar, Trophy, Settings, History, LogOut } from "lucide-react";
import { useNavigation } from "../../contexts/NavigationContext";
import { useAuth } from "../../contexts/AuthContext";
import { PlayerRoles } from "../../domain/constants";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export type NavTabId = "home" | "team" | "calendar" | "history" | "sport-management" | "admin";

function isActiveRoute(currentRoute: string, tabRoute: string, tabId: NavTabId) {
  if (tabId === "home") return currentRoute === "home" || currentRoute === "game";
  if (tabId === "history") return currentRoute === "history";
  return currentRoute === tabRoute;
}

const btnBase =
  "relative z-10 flex flex-col items-center justify-center h-full min-h-[44px] px-2 transition-colors pointer-events-auto";

export function BottomNav() {
  const { route, navigate } = useNavigation();
  const { isAdmin, canManageSport, role, signOut } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const showAdminTab = Boolean(role === PlayerRoles.admin || isAdmin);
  const showGestaoTab = Boolean(
    canManageSport ||
      role === PlayerRoles.admin ||
      role === PlayerRoles.coordenador ||
      role === PlayerRoles.capitao
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom z-50 pointer-events-none"
      role="navigation"
      aria-label="Menu principal"
    >
      <div className="flex justify-around items-center h-16 w-full max-w-screen-sm mx-auto pointer-events-none">
        <button
          type="button"
          onClick={() => navigate({ name: "home" })}
          className={`${btnBase} ${isActiveRoute(route.name, "home", "home") ? "text-blue-600" : "text-gray-600"}`}
        >
          <Home className="w-6 h-6 shrink-0" />
          <span className="text-xs mt-0.5 truncate px-0.5">Início</span>
        </button>

        <button
          type="button"
          onClick={() => navigate({ name: "team" })}
          className={`${btnBase} ${isActiveRoute(route.name, "team", "team") ? "text-blue-600" : "text-gray-600"}`}
        >
          <Users className="w-6 h-6 shrink-0" />
          <span className="text-xs mt-0.5 truncate px-0.5">Equipa</span>
        </button>

        <button
          type="button"
          onClick={() => navigate({ name: "calendar" })}
          className={`${btnBase} ${isActiveRoute(route.name, "calendar", "calendar") ? "text-blue-600" : "text-gray-600"}`}
        >
          <Calendar className="w-6 h-6 shrink-0" />
          <span className="text-xs mt-0.5 truncate px-0.5">Calendário</span>
        </button>

        <button
          type="button"
          onClick={() => navigate({ name: "history" })}
          className={`${btnBase} ${isActiveRoute(route.name, "history", "history") ? "text-blue-600" : "text-gray-600"}`}
        >
          <History className="w-6 h-6 shrink-0" />
          <span className="text-xs mt-0.5 truncate px-0.5">Histórico</span>
        </button>

        {showGestaoTab && (
          <button
            type="button"
            onClick={() => navigate({ name: "sport-management" })}
            className={`${btnBase} ${isActiveRoute(route.name, "sport-management", "sport-management") ? "text-blue-600" : "text-gray-600"}`}
          >
            <Trophy className="w-6 h-6 shrink-0" />
            <span className="text-xs mt-0.5 truncate px-0.5">Gestão de Jogos</span>
          </button>
        )}

        {showAdminTab && (
          <button
            type="button"
            onClick={() => navigate({ name: "admin" })}
            className={`${btnBase} ${isActiveRoute(route.name, "admin", "admin") ? "text-blue-600" : "text-gray-600"}`}
          >
            <Settings className="w-6 h-6 shrink-0" />
            <span className="text-xs mt-0.5 truncate px-0.5">Admin</span>
          </button>
        )}

        {/* Sair: visível só em ecrãs largos (PC); no telemóvel fica no Header */}
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className={`hidden md:flex ${btnBase} text-gray-600 hover:text-red-600`}
          aria-label="Sair da sessão"
        >
          <LogOut className="w-6 h-6 shrink-0" />
          <span className="text-xs mt-0.5 truncate px-0.5">Sair</span>
        </button>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Sair da sessão"
        message="Tem a certeza que deseja sair da sessão?"
        confirmText="Sair"
        cancelText="Cancelar"
        variant="warning"
        onConfirm={async () => {
          setShowLogoutConfirm(false);
          await signOut();
          // signOut() em AuthContext faz location.href = '/' e recarrega a app
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </nav>
  );
}
