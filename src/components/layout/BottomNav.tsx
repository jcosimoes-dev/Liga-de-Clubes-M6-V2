import { useState } from "react";
import { Home, Users, Calendar, Trophy, Settings, LogOut, History } from "lucide-react";
import { useNavigation } from "../../contexts/NavigationContext";
import { useAuth } from "../../contexts/AuthContext";
import { PlayerRoles } from "../../domain/constants";
import { RestrictedAccessModal } from "../ui";

export type NavTabId = "home" | "team" | "calendar" | "history" | "sport-management" | "admin";

const RESTRICTED_MESSAGE_SPORT =
  "Acesso Restrito: Esta área é reservada a Coordenadores e Administradores. Contacta o responsável da equipa se precisares de acesso.";
const RESTRICTED_MESSAGE_ADMIN =
  "Acesso Restrito: Esta área é reservada a Administradores. Contacta o responsável da equipa se precisares de acesso.";

const TAB_ITEMS: Array<{
  id: NavTabId;
  route: string;
  label: string;
  icon: typeof Home;
}> = [
  { id: "home", route: "home", label: "Início", icon: Home },
  { id: "team", route: "team", label: "Equipa", icon: Users },
  { id: "calendar", route: "calendar", label: "Calendário", icon: Calendar },
  { id: "history", route: "history", label: "Histórico", icon: History },
  { id: "sport-management", route: "sport-management", label: "Gestão de Jogos", icon: Trophy },
  { id: "admin", route: "admin", label: "Admin", icon: Settings },
];

function isActiveRoute(currentRoute: string, tabRoute: string, tabId: NavTabId) {
  if (tabId === "home") return currentRoute === "home" || currentRoute === "game";
  if (tabId === "history") return currentRoute === "history";
  return currentRoute === tabRoute;
}

export function BottomNav() {
  const { route, navigate } = useNavigation();
  const { isAdmin, canManageSport, signOut, role } = useAuth();
  const [restrictModal, setRestrictModal] = useState<{ message: string } | null>(null);

  // Admin: apenas role 'admin'. Gestão de Jogos: admin, coordenador ou capitão (evitar coordenador perder acesso).
  const showAdminTab = role === PlayerRoles.admin || isAdmin;
  const showGestaoTab = canManageSport || role === PlayerRoles.admin || role === PlayerRoles.coordenador || role === PlayerRoles.capitao;

  const handleTabClick = (tab: (typeof TAB_ITEMS)[number]) => {
    if (tab.id === "sport-management" && !canManageSport) {
      setRestrictModal({ message: RESTRICTED_MESSAGE_SPORT });
      return;
    }
    if (tab.id === "admin" && !isAdmin) {
      setRestrictModal({ message: RESTRICTED_MESSAGE_ADMIN });
      return;
    }
    navigate({ name: tab.route as any });
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  const visibleTabs = TAB_ITEMS.filter((tab) => {
    if (tab.id === "sport-management") return showGestaoTab;
    if (tab.id === "admin") return showAdminTab;
    return true;
  });

  if (typeof window !== 'undefined' && role === 'admin' && !showAdminTab) {
    console.warn('[BottomNav] Role é admin mas showAdminTab é false. isAdmin=', isAdmin);
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom z-50">
        <div className="flex justify-around items-center h-16 max-w-screen-sm mx-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActiveRoute(route.name, tab.route, tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-0 ${
                  active ? "text-blue-600" : "text-gray-600"
                }`}
                type="button"
              >
                <Icon className="w-6 h-6 shrink-0" />
                <span className="text-xs mt-1 truncate px-0.5">{tab.label}</span>
              </button>
            );
          })}

          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center flex-1 h-full transition-colors text-gray-600 hover:text-red-600 min-w-0"
            type="button"
          >
            <LogOut className="w-6 h-6 shrink-0" />
            <span className="text-xs mt-1">Sair</span>
          </button>
        </div>
      </nav>

      <RestrictedAccessModal
        isOpen={!!restrictModal}
        message={restrictModal?.message}
        onClose={() => setRestrictModal(null)}
      />
    </>
  );
}
