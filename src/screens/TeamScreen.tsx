import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, Badge, Loading, Button, Input, ConfirmDialog, Toast, ToastType, Header } from '../components/ui';
import { PlayersService } from '../services';
import { supabase } from '../lib/supabase';
import { MIN_PASSWORD_LENGTH } from '../lib/authErrors';
import { normalizePhoneForDb } from '../lib/phone';
import { Trophy, X, Save, Trash2, Mail, KeyRound, Pencil, ArrowLeftRight, ArrowLeft, ArrowRight, Lock, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PlayerRoles, PreferredSides, validatePreferredSide, validateRole, type PreferredSide, type PlayerRole } from '../domain/constants';

export function TeamScreen() {
  const { player: currentPlayer, isAdmin, mustChangePassword, refreshPlayer } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    federation_points: 0,
    preferred_side: PreferredSides.right,
    role: PlayerRoles.jogador as PlayerRole,
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [changePasswordNew, setChangePasswordNew] = useState('');
  const [changePasswordConfirm, setChangePasswordConfirm] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  /** Ordenação da lista (admin): por Total (Liga+FPP) ou só por FPP */
  const [sortByPoints, setSortByPoints] = useState<'total' | 'federation'>('total');

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
      setPlayers(activeOnly);
      // Diagnóstico: comparar currentUser com a linha que aparece na lista
      if (typeof console !== 'undefined' && console.log && currentPlayer) {
        const authUserId = currentPlayer.user_id;
        const inList = activeOnly.find((p: any) => p?.user_id === authUserId || p?.id === currentPlayer?.id);
        console.log('[TeamScreen.loadPlayers] currentPlayer do AuthContext: id=%s, user_id=%s, email=%s, role=%s', currentPlayer.id, currentPlayer.user_id, currentPlayer.email, currentPlayer.role);
        console.log('[TeamScreen.loadPlayers] Linha do mesmo user na lista (getAll/getTeamPlayers):', inList ? { id: inList.id, user_id: inList.user_id, email: inList.email, role: inList.role } : 'NENHUMA (user_id não encontrado na lista)');
      }
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const isOwnProfile = (player: any) => player.user_id === currentPlayer?.user_id || player.id === currentPlayer?.id;
  const canEdit = (player: any) => isOwnProfile(player) || isAdmin;

  const totalPoints = (p: any) => (p?.liga_points ?? 0) + (p?.federation_points ?? 0);
  const displayPlayers = useMemo(() => {
    const list = [...players];
    if (isAdmin && sortByPoints === 'total') {
      return list.sort((a, b) => totalPoints(b) - totalPoints(a));
    }
    return list.sort((a, b) => (b.federation_points ?? 0) - (a.federation_points ?? 0));
  }, [players, isAdmin, sortByPoints]);

  const startEdit = (player: any) => {
    setEditingId(player.id);
    const role = player.role && [PlayerRoles.admin, PlayerRoles.gestor, PlayerRoles.coordenador, PlayerRoles.capitao, PlayerRoles.jogador].includes(player.role)
      ? player.role
      : PlayerRoles.jogador;
    setEditForm({
      name: player.name ?? '',
      federation_points: player.federation_points ?? 0,
      preferred_side: (player.preferred_side || PreferredSides.right) as PreferredSide,
      role: role as PlayerRole,
      phone: player.phone ?? '',
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

    const editingPlayer = players.find((p: { id?: string }) => p?.id === editingId);
    const roleActual = editingPlayer && typeof editingPlayer === 'object' && 'role' in editingPlayer ? (editingPlayer as { role?: string }).role : null;
    const roleNovaPretendida = editForm.role ?? null;
    const roleMudou = isAdmin && roleNovaPretendida != null && roleNovaPretendida !== roleActual;

    if (roleMudou) {
      const roleErr = validateRole(roleNovaPretendida);
      if (roleErr) {
        showToast(roleErr, 'error');
        return;
      }
    }

    const profileUpdates: Parameters<typeof PlayersService.updateProfile>[1] = {
      name: editForm.name,
      federation_points: editForm.federation_points,
      preferred_side: editForm.preferred_side,
      phone: normalizePhoneForDb(editForm.phone) ?? (editForm.phone.trim() || null),
    };

    setSaving(true);
    try {
      if (roleMudou) {
        const id = editingId;
        const role = roleNovaPretendida;
        console.log('A enviar para o Supabase (RPC admin_set_player_role):', { id, role });
        const { data: rpcData, error: rpcError } = await supabase.rpc('admin_set_player_role', {
          p_target_player_id: id,
          p_new_role: role,
        });
        const firstRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const roleDevolvida = firstRow && typeof firstRow === 'object' && 'role' in firstRow ? (firstRow as { role: string }).role : null;
        if (rpcError || !firstRow || roleDevolvida !== roleNovaPretendida) {
          showToast(rpcError?.message ?? 'A função não foi alterada.', 'error');
          return;
        }
      }

      await PlayersService.updateProfile(editingId, profileUpdates);
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

  const AVATAR_COLORS = ['bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'];
  const getAvatarColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];

  const getRoleBarColor = (role: string) => {
    if (role === PlayerRoles.coordenador || role === PlayerRoles.admin || role === PlayerRoles.gestor) return 'bg-[#1A237E]';
    if (role === PlayerRoles.capitao) return 'bg-emerald-500';
    return 'bg-slate-500';
  };

  const getRoleStripBg = (role: string) => {
    if (role === PlayerRoles.coordenador || role === PlayerRoles.admin || role === PlayerRoles.gestor) return 'bg-blue-100';
    if (role === PlayerRoles.capitao) return 'bg-green-100';
    return 'bg-slate-100';
  };

  const getRoleBadge = (role: string) => {
    const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
    if (role === PlayerRoles.admin) return <span className={`${base} bg-blue-100 text-blue-800`}>Admin</span>;
    if (role === PlayerRoles.gestor) return <span className={`${base} bg-blue-100 text-blue-800`}>Gestor</span>;
    if (role === PlayerRoles.coordenador) return <span className={`${base} bg-blue-100 text-blue-800`}>Coordenador</span>;
    if (role === PlayerRoles.capitao) return <span className={`${base} bg-green-100 text-green-800`}>Capitão</span>;
    if (role === PlayerRoles.jogador) return <span className={`${base} bg-gray-100 text-gray-700`}>Jogador</span>;
    return null;
  };

  const getSideIcon = (side: string) => {
    switch (side) {
      case PreferredSides.left: return <ArrowLeft className="w-3.5 h-3.5 text-gray-500 shrink-0" aria-hidden />;
      case PreferredSides.right: return <ArrowRight className="w-3.5 h-3.5 text-gray-500 shrink-0" aria-hidden />;
      case PreferredSides.both: return <ArrowLeftRight className="w-3.5 h-3.5 text-gray-500 shrink-0" aria-hidden />;
      default: return null;
    }
  };

  const getSideText = (side: string) => {
    switch (side) {
      case PreferredSides.left: return 'Esq';
      case PreferredSides.right: return 'Dir';
      case PreferredSides.both: return 'Ambos';
      default: return '';
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changePasswordNew.length < MIN_PASSWORD_LENGTH) {
      showToast(`A nova password deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`, 'error');
      return;
    }
    if (changePasswordNew !== changePasswordConfirm) {
      showToast('As passwords não coincidem.', 'error');
      return;
    }
    if (!currentPlayer?.id) {
      showToast('Perfil não encontrado.', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: changePasswordNew });
      if (error) throw error;
      await PlayersService.updateProfile(currentPlayer.id, { must_change_password: false });
      setChangePasswordNew('');
      setChangePasswordConfirm('');
      await refreshPlayer();
      showToast('Password alterada com sucesso. Já podes continuar a usar a app normalmente.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao alterar password.', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Layout>
      <Header title="Equipa" />
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-6 space-y-4 bg-gray-50 min-h-screen">
        {currentPlayer && (
          <div className="w-full max-w-[400px]">
            <Card padding="none" className={`overflow-hidden rounded-2xl shadow-md ${mustChangePassword ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-slate-50'} p-0`}>
              <div className="flex min-h-[1px]">
                <div className="w-1 shrink-0 bg-[#1e293b] rounded-l-2xl" aria-hidden />
                <div className="flex-1 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <KeyRound className={`w-4 h-4 shrink-0 ${mustChangePassword ? 'text-amber-700' : 'text-[#1e293b]'}`} aria-hidden />
                    <h3 className="font-bold text-[#1e293b] text-sm">Alterar password</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {mustChangePassword
                      ? 'Estás a usar uma password temporária. Define uma nova password da tua preferência.'
                      : 'Podes alterar a tua password aqui.'}
                  </p>
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Nova password</label>
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-gray-400 focus-within:border-gray-400 bg-gray-50">
                        <span className="pl-2.5 text-gray-400 shrink-0" aria-hidden>
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="password"
                          value={changePasswordNew}
                          onChange={(e) => setChangePasswordNew(e.target.value)}
                          placeholder={`Mín. ${MIN_PASSWORD_LENGTH} caracteres`}
                          minLength={MIN_PASSWORD_LENGTH}
                          required
                          disabled={changingPassword}
                          className="flex-1 py-1.5 pr-2.5 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent text-gray-900 placeholder-gray-400 disabled:opacity-60"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-0.5">Confirmar nova password</label>
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-gray-400 focus-within:border-gray-400 bg-gray-50">
                        <span className="pl-2.5 text-gray-400 shrink-0" aria-hidden>
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="password"
                          value={changePasswordConfirm}
                          onChange={(e) => setChangePasswordConfirm(e.target.value)}
                          placeholder="Repete a password"
                          minLength={MIN_PASSWORD_LENGTH}
                          required
                          disabled={changingPassword}
                          className="flex-1 py-1.5 pr-2.5 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent text-gray-900 placeholder-gray-400 disabled:opacity-60"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl shadow-sm hover:shadow transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {changingPassword ? (
                        <>
                          <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                          A guardar...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 shrink-0" aria-hidden />
                          Guardar nova password
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          </div>
        )}

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Ordenar por:</span>
            <button
              type="button"
              onClick={() => setSortByPoints('total')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sortByPoints === 'total' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Total
            </button>
            <button
              type="button"
              onClick={() => setSortByPoints('federation')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sortByPoints === 'federation' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              FPP
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayPlayers.map((player, index) => (
          <Card key={player.id} padding="none" className="overflow-hidden rounded-2xl hover:shadow-lg transition-all bg-white shadow-sm p-0">
            {editingId === player.id ? (
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Editar Perfil</h3>
                  <button type="button" onClick={cancelEdit} className="text-gray-500 hover:text-gray-700 p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <Input label="Nome" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                <Input label="Pontos de Federação" type="number" value={editForm.federation_points} onChange={(e) => setEditForm({ ...editForm, federation_points: parseInt(e.target.value) || 0 })} />
                <Input label="Telemóvel" type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="912 345 678 ou +351 912 345 678" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lado Preferencial</label>
                  <select value={editForm.preferred_side} onChange={(e) => setEditForm({ ...editForm, preferred_side: e.target.value as PreferredSide })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value={PreferredSides.left}>Esquerda</option>
                    <option value={PreferredSides.right}>Direita</option>
                    <option value={PreferredSides.both}>Ambos</option>
                  </select>
                </div>
                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Função (Role)</label>
                    <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as PlayerRole })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value={PlayerRoles.jogador}>Jogador</option>
                      <option value={PlayerRoles.capitao}>Capitão</option>
                      <option value={PlayerRoles.coordenador}>Coordenador</option>
                      <option value={PlayerRoles.admin}>Administrador</option>
                    </select>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={saveEdit} disabled={saving} className="flex-1"><Save className="w-4 h-4 mr-2 inline" />{saving ? 'A guardar...' : 'Guardar'}</Button>
                  <Button onClick={cancelEdit} variant="secondary">Cancelar</Button>
                </div>
              </div>
            ) : (
              <>
                <div className={`h-2 shrink-0 rounded-t-2xl ${getRoleStripBg(player.role)}`} aria-hidden />
                <div className="flex min-h-[1px]">
                  <div className={`w-1 shrink-0 rounded-bl-2xl ${getRoleBarColor(player.role)}`} aria-hidden />
                  <div className="flex-1 p-4 flex flex-col min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1 flex items-center gap-3">
                        <span className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${getAvatarColor(index)}`} aria-hidden>
                          {(player.name || '?').trim().split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase() || '?'}
                        </span>
                        <div className="min-w-0">
                          <h3
                            role={canEdit(player) ? 'button' : undefined}
                            tabIndex={canEdit(player) ? 0 : undefined}
                            onClick={() => canEdit(player) && startEdit(player)}
                            onKeyDown={(e) => canEdit(player) && (e.key === 'Enter' || e.key === ' ') && startEdit(player)}
                            className={`font-bold text-gray-900 truncate ${canEdit(player) ? 'cursor-pointer hover:text-blue-600' : ''}`}
                          >
                            {player.name}
                          </h3>
                      {isAdmin && player.email && (
                        <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-600">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="break-all text-xs">{player.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {getRoleBadge(player.role)}
                        {!player.is_active && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">Inactivo</span>}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    #{index + 1}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium text-gray-700">Liga: <span className="font-semibold text-amber-700 tabular-nums">{player.liga_points ?? 0}</span></span>
                  <span className="font-medium text-gray-700">FPP: <span className="font-semibold text-gray-900 tabular-nums">{player.federation_points ?? 0}</span></span>
                  <span className="font-medium text-gray-700">Total: <span className="font-bold text-amber-900 tabular-nums">{totalPoints(player)}</span></span>
                </div>

                {player.preferred_side && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    {getSideIcon(player.preferred_side)}
                    <span>Lado: {getSideText(player.preferred_side)}</span>
                  </div>
                )}

                {(canEdit(player) || isAdmin) && (
                  <div className="mt-4 pt-3 border-t border-gray-200 flex gap-2 bg-gray-100 -mx-4 -mb-4 px-4 pb-4 rounded-b-2xl">
                    <button
                      type="button"
                      onClick={() => startEdit(player)}
                      className="flex-1 flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 py-2 text-sm font-medium rounded-lg transition-colors"
                      disabled={deleting}
                    >
                      <Pencil className="w-4 h-4 shrink-0" />
                      {isAdmin ? 'Editar' : 'Editar perfil'}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => deletePlayer(player.id, player.name)}
                        className="flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 py-2 px-3 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                        disabled={deleting}
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        Remover
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            </>
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
