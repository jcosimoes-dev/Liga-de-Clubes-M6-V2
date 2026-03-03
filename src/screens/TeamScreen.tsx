import { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, Badge, Loading, Button, Input, ConfirmDialog, Toast, ToastType, Header } from '../components/ui';
import { PlayersService } from '../services';
import { User, Trophy, Edit2, X, Save, Trash2, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PlayerRoles, PreferredSides, validatePreferredSide, validateRole, type PreferredSide, type PlayerRole } from '../domain/constants';

export function TeamScreen() {
  const { player: currentPlayer, isAdmin } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    federation_points: 0,
    preferred_side: PreferredSides.right,
    role: PlayerRoles.player as PlayerRole,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      let data: any[] = [];
      try {
        const all = await PlayersService.getAll();
        data = all ?? [];
      } catch {
        data = await PlayersService.getTeamPlayers(currentPlayer?.team_id);
      }
      const activeOnly = data.filter((p: any) => p?.is_active === true);
      const sorted = activeOnly.sort((a: { federation_points: number }, b: { federation_points: number }) => (b.federation_points ?? 0) - (a.federation_points ?? 0));
      setPlayers(sorted);
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const isOwnProfile = (player: any) => player.user_id === currentPlayer?.user_id || player.id === currentPlayer?.id;
  const canEdit = (player: any) => isOwnProfile(player) || isAdmin;

  const startEdit = (player: any) => {
    setEditingId(player.id);
    const role = player.role && [PlayerRoles.player, PlayerRoles.captain, PlayerRoles.coordinator, PlayerRoles.admin].includes(player.role)
      ? player.role
      : PlayerRoles.player;
    setEditForm({
      name: player.name ?? '',
      federation_points: player.federation_points ?? 0,
      preferred_side: (player.preferred_side || PreferredSides.right) as PreferredSide,
      role: role as PlayerRole,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const prefErr = validatePreferredSide(editForm.preferred_side);
    if (prefErr) {
      showToast(prefErr, 'error');
      return;
    }
    if (isAdmin && editForm.role) {
      const roleErr = validateRole(editForm.role);
      if (roleErr) {
        showToast(roleErr, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const updates: Parameters<typeof PlayersService.updateProfile>[1] = {
        name: editForm.name,
        federation_points: editForm.federation_points,
        preferred_side: editForm.preferred_side,
      };
      if (isAdmin && editForm.role) updates.role = editForm.role;
      await PlayersService.updateProfile(editingId, updates);
      await loadPlayers();
      setEditingId(null);
      showToast('Perfil atualizado com sucesso', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar perfil';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deletePlayer = (playerId: string, playerName: string) => {
    if (!isAdmin) {
      return;
    }
    setConfirmDelete({ id: playerId, name: playerName });
  };

  const confirmDeletePlayer = async () => {
    if (!confirmDelete) return;

    setDeleting(true);
    const playerName = confirmDelete.name;

    try {
      await PlayersService.deletePlayer(confirmDelete.id);
      await loadPlayers();
      setConfirmDelete(null);
      showToast(`${playerName} foi removido da equipa com sucesso`, 'success');
    } catch (error) {
      console.error('Erro ao remover jogador:', error);
      showToast('Erro ao remover jogador. Por favor tente novamente', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Header title="Equipa" />
        <div className="max-w-screen-sm mx-auto px-4 pt-4">
          <Loading text="A carregar equipa..." />
        </div>
      </Layout>
    );
  }

  const getRoleBadge = (role: string) => {
    if (role === PlayerRoles.admin) return <Badge variant="admin" size="sm">Admin</Badge>;
    return null;
  };

  const getSideText = (side: string) => {
    switch (side) {
      case PreferredSides.left: return 'Esq';
      case PreferredSides.right: return 'Dir';
      case PreferredSides.both: return 'Ambos';
      default: return '';
    }
  };

  return (
    <Layout>
      <Header title="Equipa" />
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {players.map((player, index) => (
          <Card key={player.id} className="hover:shadow-lg transition-all">
            {editingId === player.id ? (
              <div className="space-y-4 p-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Editar Perfil</h3>
                  <button
                    onClick={cancelEdit}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <Input
                  label="Nome"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />

                <Input
                  label="Pontos de Federação"
                  type="number"
                  value={editForm.federation_points}
                  onChange={(e) => setEditForm({ ...editForm, federation_points: parseInt(e.target.value) || 0 })}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lado Preferencial
                  </label>
                  <select
                    value={editForm.preferred_side}
                    onChange={(e) => setEditForm({ ...editForm, preferred_side: e.target.value as PreferredSide })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={PreferredSides.left}>Esquerda</option>
                    <option value={PreferredSides.right}>Direita</option>
                    <option value={PreferredSides.both}>Ambos</option>
                  </select>
                </div>

                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Função (Role)</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as PlayerRole })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={PlayerRoles.player}>Jogador</option>
                      <option value={PlayerRoles.captain}>Capitão</option>
                      <option value={PlayerRoles.coordinator}>Coordenador</option>
                      <option value={PlayerRoles.admin}>Administrador</option>
                    </select>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={saveEdit}
                    disabled={saving}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'A guardar...' : 'Guardar'}
                  </Button>
                  <Button
                    onClick={cancelEdit}
                    variant="secondary"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 p-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <User className="w-5 h-5 text-gray-600 flex-shrink-0" />
                      <h3
                        role={canEdit(player) ? 'button' : undefined}
                        tabIndex={canEdit(player) ? 0 : undefined}
                        onClick={() => canEdit(player) && startEdit(player)}
                        onKeyDown={(e) => canEdit(player) && (e.key === 'Enter' || e.key === ' ') && startEdit(player)}
                        className={`font-semibold text-gray-900 ${canEdit(player) ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
                      >
                        {player.name}
                      </h3>
                    </div>
                    {isAdmin && player.email && (
                      <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span className="break-all">{player.email}</span>
                      </div>
                    )}
                    {getRoleBadge(player.role)}
                    {!player.is_active && (
                      <Badge variant="default" size="sm" className="ml-1">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-gray-400">#{index + 1}</div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-base text-gray-900">
                    <Trophy className="w-5 h-5" />
                    <span className="font-semibold">{player.federation_points} pontos</span>
                  </div>
                  {player.preferred_side && (
                    <div className="text-sm text-gray-600 ml-7">
                      Lado: {getSideText(player.preferred_side)}
                    </div>
                  )}
                </div>

                {(canEdit(player) || isAdmin) && (
                  <div className="flex gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => startEdit(player)}
                      className="flex-1 flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 py-2.5 text-sm font-medium"
                      disabled={deleting}
                    >
                      <Edit2 className="w-4 h-4" />
                      {isAdmin ? 'Editar perfil' : 'Editar meu perfil'}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => deletePlayer(player.id, player.name)}
                        className="flex-1 flex items-center justify-center gap-2 text-red-600 hover:text-red-700 py-2.5 text-sm font-medium disabled:opacity-50"
                        disabled={deleting}
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}

        {players.length === 0 && (
          <Card className="col-span-full">
            <p className="text-center text-gray-600">Sem jogadores</p>
          </Card>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Remover Jogador"
        message={`Tem a certeza que quer remover ${confirmDelete?.name} da equipa?\n\nO jogador será removido da lista, mas o histórico de jogos será mantido.`}
        confirmText="Remover"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={confirmDeletePlayer}
        onCancel={() => setConfirmDelete(null)}
      />

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </Layout>
  );
}
