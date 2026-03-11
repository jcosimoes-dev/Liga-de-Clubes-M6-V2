import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Badge, Toast, ToastType, Header, AddPlayerModal, RestrictedAccessModal, Input } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { PlayersService, updateUserPassword } from '../services';
import { UserPlus, ShieldCheck, Key, Lock, X, Loader2, ChevronDown, Search, Phone } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { PlayerRoles, validateRole, type PlayerRole } from '../domain/constants';
import { formatPhoneForWhatsApp, normalizePhoneForDb } from '../lib/phone';

type Player = Database['public']['Tables']['players']['Row'];

/**
 * Administração: apenas PESSOAS (Gerir Roles, Criar Jogadores).
 * Acesso restrito a Administrador. Jogos ficam em Gestão Desportiva.
 */
const RESTRICTED_MESSAGE_ADMIN =
  'Acesso Restrito: Esta área é reservada a Administradores. Contacta o responsável da equipa se precisares de acesso.';

const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Gera uma password aleatória (ex: Padel789) — 8 caracteres, letras e números. */
function generateRandomPassword(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  }
  return out;
}

/** Botões premium: cores sólidas, sombra, rounded-xl */
const BTN_PRIMARY =
  'w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_PRIMARY_INLINE =
  'py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
/** Inputs/selects: fundo cinza claro, bordas arredondadas */
const INPUT_MODERN =
  'w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:outline-none transition-colors text-gray-900 disabled:opacity-60';

export function AdminScreen() {
  const { player, isAdmin } = useAuth();
  const { navigate, goBack } = useNavigation();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedRole, setSelectedRole] = useState<PlayerRole>(PlayerRoles.jogador);
  const [promotingRole, setPromotingRole] = useState(false);
  const [promotionSuccess, setPromotionSuccess] = useState('');
  const [roleError, setRoleError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [selectedPlayerForReset, setSelectedPlayerForReset] = useState<Player | null>(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerDropdownOpen, setPlayerDropdownOpen] = useState(false);
  const [phoneEdit, setPhoneEdit] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [resetModalData, setResetModalData] = useState<{
    password: string;
    playerName: string;
    phone: string | null;
  } | null>(null);
  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (isAdmin) loadPlayers();
  }, [isAdmin]);

  useEffect(() => {
    setPhoneEdit(selectedPlayerForReset?.phone ?? '');
  }, [selectedPlayerForReset?.id, selectedPlayerForReset?.phone]);

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
        [PlayerRoles.jogador]: 'Jogador',
        [PlayerRoles.capitao]: 'Capitão',
        [PlayerRoles.coordenador]: 'Coordenador',
        [PlayerRoles.gestor]: 'Gestor',
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
            onClose={goBack}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Administração" />
      <div className="max-w-screen-md mx-auto px-4 sm:px-6 pt-6 pb-24 bg-gray-50 min-h-screen">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Header: título robusto "Painel de Controlo" */}
          <Card className="shadow-md rounded-2xl md:col-span-2 border border-gray-200 bg-white" padding="none">
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#1A237E]/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#1A237E]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 truncate">{player?.name}</h2>
                  <p className="text-sm font-semibold text-[#1A237E] tracking-tight">Painel de Controlo</p>
                </div>
              </div>
              <Badge variant="admin" size="sm" className="flex-shrink-0 text-[10px] font-semibold tracking-wider uppercase">
                Administrador
              </Badge>
            </div>
          </Card>

          {/* Card: Criar Jogador — barra azul, hover, ícone vibrante */}
          <Card className="shadow-md rounded-2xl border border-gray-200 flex flex-col min-h-[260px] overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-200" padding="none">
            <div className="flex min-h-[1px]">
              <div className="w-1 shrink-0 bg-blue-500 rounded-l-2xl" aria-hidden />
              <div className="flex-1 p-6 flex flex-col flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Criar Jogador</h3>
                </div>
                <p className="text-sm text-gray-500 mt-1.5">Novo utilizador na equipa (email e perfil).</p>
                <div className="flex justify-center items-center my-4 flex-1 min-h-[8rem]">
                  <img
                    src="/pwa192.png"
                    alt="Logótipo da Liga"
                    className="w-40 h-40 rounded-full object-cover object-center shadow-sm"
                  />
                </div>
                <div className="mt-auto pt-6">
                  <Button onClick={() => setShowAddModal(true)} className={BTN_PRIMARY}>
                    Adicionar Jogador
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Card: Gerir Funções — barra amarelo/laranja, legenda com badges */}
          <Card className="shadow-md rounded-2xl border border-gray-200 flex flex-col min-h-[260px] overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-200" padding="none">
            <div className="flex min-h-[1px]">
              <div className="w-1 shrink-0 bg-amber-500 rounded-l-2xl" aria-hidden />
              <div className="flex-1 p-6 flex flex-col flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Gerir Funções (Roles)</h3>
                </div>
                <p className="text-sm text-gray-500 mt-1.5">Alterar função de um jogador.</p>

                <div className="mt-4 space-y-3 flex-1">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Selecionar Jogador</label>
                    <select
                      value={selectedPlayerId}
                      onChange={(e) => setSelectedPlayerId(e.target.value)}
                      className={INPUT_MODERN}
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
                      className={INPUT_MODERN}
                      disabled={promotingRole}
                    >
                      <option value={PlayerRoles.jogador}>Jogador</option>
                      <option value={PlayerRoles.capitao}>Capitão</option>
                      <option value={PlayerRoles.coordenador}>Coordenador</option>
                      <option value={PlayerRoles.admin}>Administrador</option>
                    </select>
                  </div>
                  {promotionSuccess && (
                    <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                      {promotionSuccess}
                    </div>
                  )}
                  {roleError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                      {roleError}
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-4">
                  <Button
                    onClick={handleUpdateRole}
                    disabled={!selectedPlayerId || promotingRole}
                    className={BTN_PRIMARY}
                  >
                    {promotingRole ? 'A guardar...' : 'Guardar Role'}
                  </Button>
                  <p className="text-xs text-gray-600 mt-3 font-medium">Legenda de funções:</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700">Jogador</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800">Capitão</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">Coordenador</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">Gestor</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-800">Admin</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

        {/* Card: Redefinir palavra-passe — barra vermelho/rosa, ícone vibrante; overflow-visible para o dropdown não ser cortado */}
        <Card className="shadow-md rounded-2xl border border-gray-200 flex flex-col min-h-[260px] overflow-visible hover:-translate-y-1 hover:shadow-xl transition-all duration-200 md:col-span-2" padding="none">
          <div className="flex min-h-[1px] overflow-visible">
            <div className="w-1 shrink-0 bg-rose-500 rounded-l-2xl" aria-hidden />
            <div className="flex-1 p-6 flex flex-col flex-1 overflow-visible">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
                  <Key className="w-5 h-5 text-rose-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Redefinir palavra-passe</h3>
              </div>
              <p className="text-sm text-gray-500 mt-1.5">Escolhe um jogador, redefine a password e envia por WhatsApp.</p>

              <div className="mt-4 flex-1 flex flex-col overflow-visible">
                <label className="block text-sm font-medium text-gray-700 mb-1">Escolher jogador</label>
                <div className="relative overflow-visible">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 focus-within:bg-white transition-colors">
              <Search className="w-4 h-4 text-gray-400 ml-3 flex-shrink-0" aria-hidden />
              <input
                type="text"
                value={playerDropdownOpen ? playerSearchQuery : (selectedPlayerForReset?.name ?? '')}
                onChange={(e) => {
                  setPlayerSearchQuery(e.target.value);
                  setPlayerDropdownOpen(true);
                  if (!e.target.value.trim()) setSelectedPlayerForReset(null);
                }}
                onFocus={() => {
                  setPlayerDropdownOpen(true);
                  if (selectedPlayerForReset && !playerSearchQuery) setPlayerSearchQuery(selectedPlayerForReset.name);
                }}
                placeholder="Escreve o nome para pesquisar..."
                className="flex-1 min-w-0 py-3 pr-10 pl-0 border-0 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
                aria-expanded={playerDropdownOpen}
                aria-haspopup="listbox"
                aria-label="Pesquisar e escolher jogador"
              />
              <button
                type="button"
                onClick={() => setPlayerDropdownOpen((o) => !o)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-r-xl"
                aria-label={playerDropdownOpen ? 'Fechar lista' : 'Abrir lista'}
              >
                <ChevronDown className={`w-5 h-5 transition-transform ${playerDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {playerDropdownOpen && (() => {
              const q = playerSearchQuery.trim().toLowerCase();
              const filtered = players.filter(
                (p) =>
                  !q ||
                  p.name.toLowerCase().includes(q) ||
                  (p.email?.toLowerCase().includes(q) ?? false)
              );
              return (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    aria-hidden
                    onClick={() => setPlayerDropdownOpen(false)}
                  />
                  <ul
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-50 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-gray-300 bg-white shadow-xl py-1"
                  >
                    {filtered.map((p) => (
                      <li
                        key={p.id}
                        role="option"
                        aria-selected={selectedPlayerForReset?.id === p.id}
                        onClick={() => {
                          setSelectedPlayerForReset(p);
                          setPlayerSearchQuery('');
                          setPlayerDropdownOpen(false);
                        }}
                        className="px-4 py-2.5 cursor-pointer hover:bg-blue-50 text-gray-900 border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium">{p.name}</span>
                        {p.email && <span className="block text-sm text-gray-500 truncate">{p.email}</span>}
                      </li>
                    ))}
                    {filtered.length === 0 && (
                      <li className="px-4 py-3 text-sm text-gray-500">Nenhum jogador encontrado</li>
                    )}
                  </ul>
                </>
              );
            })()}
            </div>

            {selectedPlayerForReset && (
            <Card className="mt-4 rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden shadow-sm">
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{selectedPlayerForReset.name}</p>
                    <p className="text-sm text-gray-600 truncate">{selectedPlayerForReset.email || '—'}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2 border-t border-gray-200">
                  <div className="flex-1 min-w-0">
                    <Input
                      label="Telemóvel"
                      type="tel"
                      value={phoneEdit}
                      onChange={(e) => setPhoneEdit(e.target.value)}
                      placeholder="912 345 678 ou +351 912 345 678"
                      disabled={savingContact}
                      className="px-4 py-2.5 border-gray-200 rounded-xl focus:bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                  </div>
                  <Button
                    type="button"
                    className={`shrink-0 ${BTN_PRIMARY_INLINE}`}
                    onClick={async () => {
                      const normalized = normalizePhoneForDb(phoneEdit);
                      setSavingContact(true);
                      try {
                        const valueToStore = (normalized ?? phoneEdit.trim()) || null;
                        await PlayersService.updateProfile(selectedPlayerForReset.id, {
                          phone: valueToStore,
                        });
                        setSelectedPlayerForReset((prev) =>
                          prev ? { ...prev, phone: valueToStore } : null
                        );
                        setPlayers((prev) =>
                          prev.map((pl) =>
                            pl.id === selectedPlayerForReset.id ? { ...pl, phone: valueToStore } : pl
                          )
                        );
                        showToast('Sucesso! Contacto guardado. O link do WhatsApp usará este número.', 'success');
                      } catch (e) {
                        showToast(e instanceof Error ? e.message : 'Erro ao guardar contacto.', 'error');
                      } finally {
                        setSavingContact(false);
                      }
                    }}
                    disabled={savingContact}
                  >
                    {savingContact ? 'A guardar...' : 'Guardar contacto'}
                  </Button>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={async () => {
                      const p = selectedPlayerForReset;
                      const password = generateRandomPassword(8);
                      setResettingUserId(p.user_id);
                      try {
                        await updateUserPassword(p.user_id, password);
                        setResetModalData({
                          password,
                          playerName: p.name,
                          phone: p.phone ?? null,
                        });
                        showToast('Sucesso! Password redefinida.', 'success');
                      } catch (e) {
                        showToast(e instanceof Error ? e.message : 'Erro ao atualizar password no Supabase.', 'error');
                      } finally {
                        setResettingUserId(null);
                      }
                    }}
                    disabled={resettingUserId !== null}
                    className={`inline-flex items-center justify-center gap-2 ${BTN_PRIMARY}`}
                    title="Redefinir palavra-passe"
                    aria-label={`Redefinir palavra-passe de ${selectedPlayerForReset.name}`}
                  >
                    {resettingUserId === selectedPlayerForReset.user_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    Redefinir password
                  </button>
                </div>
              </div>
            </Card>
          )}

              </div>
            </div>
          </div>
            {resetModalData && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
              role="dialog"
              aria-modal="true"
              onClick={() => {
                const { playerName, phone, password } = resetModalData;
                const waNum = formatPhoneForWhatsApp(phone);
                if (waNum) {
                  window.open(
                    `https://wa.me/${waNum}?text=${encodeURIComponent(
                      `Olá ${playerName}, a tua password foi redefinida para: ${password}. Já podes entrar!`
                    )}`,
                    '_blank',
                    'noopener,noreferrer'
                  );
                }
                setResetModalData(null);
              }}
            >
              <div
                className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Nova password gerada</h3>
                  <button
                    type="button"
                    onClick={() => {
                      const { playerName, phone, password } = resetModalData;
                      const waNum = formatPhoneForWhatsApp(phone);
                      if (waNum) {
                        window.open(
                          `https://wa.me/${waNum}?text=${encodeURIComponent(
                            `Olá ${playerName}, a tua password foi redefinida para: ${password}. Já podes entrar!`
                          )}`,
                          '_blank',
                          'noopener,noreferrer'
                        );
                      }
                      setResetModalData(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Fechar"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-sm text-gray-600">Para <strong>{resetModalData.playerName}</strong> — já atualizada no Supabase.</p>
                  <p className="text-3xl font-mono font-bold text-center text-gray-900 tracking-wider bg-gray-100 py-4 px-4 rounded-lg break-all">
                    {resetModalData.password}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const waNum = formatPhoneForWhatsApp(resetModalData.phone);
                      if (waNum) {
                        window.open(
                          `https://wa.me/${waNum}?text=${encodeURIComponent(
                            `Olá ${resetModalData.playerName}, a tua password foi redefinida para: ${resetModalData.password}. Já podes entrar!`
                          )}`,
                          '_blank',
                          'noopener,noreferrer'
                        );
                      }
                      setResetModalData(null);
                    }}
                    disabled={!formatPhoneForWhatsApp(resetModalData.phone)}
                    className="w-full py-3 px-4 rounded-lg bg-[#25D366] text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
                  >
                    Enviar por WhatsApp
                  </button>
                  {!formatPhoneForWhatsApp(resetModalData.phone) && (
                    <p className="text-xs text-amber-700 text-center">
                      Sem telefone registado. Ao fechar, o WhatsApp não abrirá.
                    </p>
                  )}
                </div>
              </div>
            </div>
            )}
        </Card>

        <AddPlayerModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            loadPlayers();
            showToast('Sucesso! Jogador criado.', 'success');
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
      </div>
    </Layout>
  );
}
