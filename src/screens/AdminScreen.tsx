import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Badge, Toast, ToastType, Header, AddPlayerModal, RestrictedAccessModal } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { PlayersService } from '../services';
import { supabase } from '../lib/supabase';
import { Crown, Shield, UserPlus, KeyRound } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { PlayerRoles, validateRole, type PlayerRole } from '../domain/constants';

type Player = Database['public']['Tables']['players']['Row'];

/**
 * Administração: apenas PESSOAS (Gerir Roles, Criar Jogadores).
 * Acesso restrito a Administrador. Jogos ficam em Gestão Desportiva.
 */
const RESTRICTED_MESSAGE_ADMIN =
  'Acesso Restrito: Esta área é reservada a Administradores. Contacta o responsável da equipa se precisares de acesso.';

export function AdminScreen() {
  const { player, isAdmin } = useAuth();
  const { navigate } = useNavigation();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedRole, setSelectedRole] = useState<PlayerRole>(PlayerRoles.player);
  const [promotingRole, setPromotingRole] = useState(false);
  const [promotionSuccess, setPromotionSuccess] = useState('');
  const [roleError, setRoleError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [resetEmailPlayerId, setResetEmailPlayerId] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (isAdmin) loadPlayers();
  }, [isAdmin]);

  const loadPlayers = async () => {
    try {
      const teamPlayers = await PlayersService.getTeamPlayersForAdmin();
      setPlayers(teamPlayers ?? []);
    } catch (err) {
      console.error('Erro ao carregar jogadores:', err);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedPlayerId) return;
    const roleErr = validateRole(selectedRole);
    if (roleErr) {
      setRoleError(roleErr);
      return;
    }

    setPromotingRole(true);
    setPromotionSuccess('');
    setRoleError('');
    try {
      await PlayersService.updateRole(selectedPlayerId, selectedRole);
      const updatedPlayer = players.find((p) => p.id === selectedPlayerId);
      const roleLabels: Record<PlayerRole, string> = {
        [PlayerRoles.player]: 'Jogador',
        [PlayerRoles.captain]: 'Capitão',
        [PlayerRoles.coordinator]: 'Coordenador',
        [PlayerRoles.admin]: 'Administrador',
      };
      setPromotionSuccess(
        `${updatedPlayer?.name ?? 'Jogador'} foi atualizado para ${roleLabels[selectedRole]} com sucesso!`
      );
      setSelectedPlayerId('');
      await loadPlayers();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Erro ao atualizar role');
    } finally {
      setPromotingRole(false);
    }
  };

  if (!isAdmin) {
    return (
      <Layout>
        <Header title="Administração" />
        <div className="max-w-screen-sm mx-auto px-4 pt-4">
          <RestrictedAccessModal
            isOpen
            message={RESTRICTED_MESSAGE_ADMIN}
            onClose={() => navigate({ name: 'home' })}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Administração" />
      <div className="max-w-screen-sm mx-auto px-4 pt-4 pb-6 space-y-4">
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{player?.name}</h3>
                <p className="text-xs text-gray-600">Administrador</p>
              </div>
            </div>
            <Badge variant="danger">Administrador</Badge>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Criar Jogador
            </h2>
            <Button onClick={() => setShowAddModal(true)}>Adicionar Jogador</Button>
          </div>
          <p className="text-sm text-gray-600">Cria um novo utilizador na equipa (email e perfil).</p>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Gerir Funções (Roles)
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selecionar Jogador</label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={promotingRole}
              >
                <option value="">Escolha um jogador...</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Função (Role)</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as PlayerRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={promotingRole}
              >
                <option value={PlayerRoles.player}>Jogador</option>
                <option value={PlayerRoles.captain}>Capitão</option>
                <option value={PlayerRoles.coordinator}>Coordenador</option>
                <option value={PlayerRoles.admin}>Administrador</option>
              </select>
            </div>

            {promotionSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">{promotionSuccess}</p>
              </div>
            )}

            {roleError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{roleError}</p>
              </div>
            )}

            <Button
              onClick={handleUpdateRole}
              disabled={!selectedPlayerId || promotingRole}
              fullWidth
            >
              {promotingRole ? 'A guardar...' : 'Guardar Role'}
            </Button>

            <p className="text-xs text-gray-500">
              Jogador: Início, Calendário, Equipa. Capitão: + Gestão Desportiva (jogos, convocatórias, duplas, resultados).
              Coordenador: + Pontos Federação. Administrador: controlo total.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Redefinir palavra-passe
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            Define a palavra-passe do jogador para a password padrão. Avisa o jogador para a mudar ao entrar.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={resetEmailPlayerId}
              onChange={(e) => setResetEmailPlayerId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sendingReset}
            >
              <option value="">Escolher jogador...</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.email ? `(${p.email})` : ''}
                </option>
              ))}
            </select>
            <Button
              disabled={!resetEmailPlayerId || sendingReset}
              onClick={async () => {
                if (!resetEmailPlayerId) return;
                setSendingReset(true);
                try {
                  const { data, error: fnError } = await supabase.functions.invoke('reset-player-password', {
                    body: { playerId: resetEmailPlayerId },
                  });
                  if (fnError) throw fnError;
                  if (data?.error) throw new Error(data.error);
                  const password = data?.password ?? 'Mudar123!';
                  showToast(
                    `Sucesso! A password do jogador foi alterada para: ${password}. Avisa o jogador para a mudar ao entrar.`,
                    'success'
                  );
                  setResetEmailPlayerId('');
                } catch (e) {
                  showToast(e instanceof Error ? e.message : 'Erro ao redefinir password.', 'error');
                } finally {
                  setSendingReset(false);
                }
              }}
            >
              {sendingReset ? 'A redefinir...' : 'Redefinir para Password Padrão'}
            </Button>
          </div>
        </Card>

        <AddPlayerModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            loadPlayers();
            showToast('Jogador criado com sucesso.', 'success');
            setShowAddModal(false);
            navigate({ name: 'admin' });
          }}
          onError={(msg) => showToast(msg, 'error')}
          teamId={player?.team_id ?? undefined}
        />

        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>
    </Layout>
  );
}
