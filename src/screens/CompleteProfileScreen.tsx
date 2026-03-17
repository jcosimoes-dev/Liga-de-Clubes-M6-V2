import { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Input, Header, Toast, ToastType } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { supabase } from '../lib/supabase';
import { TeamsService, PlayersService } from '../services';
import { PreferredSides, PlayerRoles, type PreferredSide } from '../domain/constants';

const FALLBACK_TEAM_ID = '00000000-0000-0000-0000-000000000001';

const SIDE_OPTIONS: { value: PreferredSide; label: string }[] = [
  { value: PreferredSides.left, label: 'Esquerda' },
  { value: PreferredSides.right, label: 'Direita' },
  { value: PreferredSides.both, label: 'Ambos' },
];

function isPreferredSide(value: string): value is PreferredSide {
  return value === PreferredSides.left || value === PreferredSides.right || value === PreferredSides.both;
}

function getErrorMessage(err: unknown): string {
  if (!err) return 'Erro ao guardar perfil';
  if (err instanceof Error) return err.message || 'Erro inesperado';
  if (typeof err === 'object' && err && 'message' in err) {
    const m = (err as any).message;
    return typeof m === 'string' ? m : 'Erro inesperado';
  }
  return String(err);
}

/**
 * Ecrã de Perfil do Jogador: editar Telefone, Lado Preferido, Pontos de Federação e Alterar Password.
 */
export function CompleteProfileScreen() {
  const { navigate } = useNavigation();
  const { user, player, refreshPlayer, signOut, loading: authLoading } = useAuth();

  const [form, setForm] = useState({
    phone: '',
    federation_points: 0,
    preferred_side: PreferredSides.both as PreferredSide,
  });

  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });
  const hasInitializedFormFromPlayer = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ name: 'login' });
      return;
    }
    if (!player) {
      hasInitializedFormFromPlayer.current = false;
      return;
    }
    if (!hasInitializedFormFromPlayer.current) {
      hasInitializedFormFromPlayer.current = true;
      const side = isPreferredSide(String(player.preferred_side ?? '')) ? (player.preferred_side as PreferredSide) : PreferredSides.both;
      setForm({
        phone: player.phone ?? '',
        federation_points:
          player.federation_points != null && Number.isFinite(Number(player.federation_points))
            ? Number(player.federation_points)
            : 0,
        preferred_side: side,
      });
    }
  }, [authLoading, user, player, navigate]);

  const onSubmit = async () => {
    const phoneTrim = form.phone?.trim() ?? '';
    if (!phoneTrim) {
      showToast('O telemóvel é obrigatório.', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUserId = sessionData.session?.user?.id;
      if (!sessionUserId) {
        showToast('Sessão inválida. Faz login novamente.', 'error');
        return;
      }
      const user_id = String(sessionUserId).trim();

      const federationPoints = Number.isFinite(form.federation_points) && form.federation_points >= 0
        ? form.federation_points
        : 0;

      let team_id: string = player?.team_id ?? '';
      if (!team_id) {
        try {
          const teams = await TeamsService.getAll();
          team_id = teams?.[0]?.id ?? FALLBACK_TEAM_ID;
        } catch {
          team_id = FALLBACK_TEAM_ID;
        }
      }
      if (!team_id) team_id = FALLBACK_TEAM_ID;

      const displayName =
        player?.name ||
        (user?.user_metadata?.name as string) ||
        user?.email?.split('@')[0] ||
        'Utilizador';

      const preferred_side: PreferredSide = isPreferredSide(form.preferred_side) ? form.preferred_side : PreferredSides.both;

      if (player?.id) {
        await PlayersService.updateProfile(player.id, {
          name: (displayName.trim() || 'Utilizador'),
          phone: phoneTrim || null,
          federation_points: federationPoints,
          preferred_side,
        });
      } else {
        // Nunca sobrescrever role existente: se já existe linha para user_id, só atualizar campos seguros.
        const { data: existing } = await supabase
          .from('players')
          .select('id, role')
          .eq('user_id', user_id)
          .maybeSingle();
        const existingRole = (existing as { role?: string } | null)?.role;
        if (existing?.id) {
          // Linha já existe — atualizar apenas campos permitidos (NUNCA role).
          console.log('[CompleteProfileScreen] Linha já existe: user_id=%s, role atual=%s — NÃO escrever role.', user_id, existingRole);
          const { error: updateErr } = await supabase
            .from('players')
            .update({
              name: displayName.trim() || 'Utilizador',
              phone: phoneTrim || null,
              federation_points: federationPoints,
              preferred_side,
              team_id,
              is_active: true,
              profile_completed: true,
            })
            .eq('id', existing.id);
          if (updateErr) {
            if (updateErr.message?.includes('foreign key') || updateErr.message?.includes('team_id') || updateErr.code === '23503') {
              throw new Error('A equipa associada não existe. Contacta o administrador.');
            }
            throw updateErr;
          }
        } else {
          // Novo perfil — criar com role jogador.
          const payload = {
            user_id,
            team_id,
            name: displayName.trim() || 'Utilizador',
            phone: phoneTrim || null,
            is_active: true,
            federation_points: federationPoints,
            preferred_side,
            role: PlayerRoles.jogador,
            profile_completed: true,
            email: (player?.email ?? user?.email ?? '').trim() || '',
          };
          console.log('[CompleteProfileScreen] Novo perfil: user_id=%s, role=%s (apenas em INSERT).', user_id, payload.role);
          const { error } = await supabase
            .from('players')
            .insert(payload);
          if (error) {
            if (error.code === '23505') {
              // Conflito: linha foi criada entretanto — atualizar sem tocar na role.
              const { data: after } = await supabase.from('players').select('id, role').eq('user_id', user_id).maybeSingle();
              if ((after as { id?: string })?.id) {
                await supabase.from('players').update({
                  name: payload.name,
                  phone: payload.phone,
                  federation_points: payload.federation_points,
                  preferred_side: payload.preferred_side,
                  team_id: payload.team_id,
                  profile_completed: true,
                }).eq('id', (after as { id: string }).id);
              }
            } else {
              if (error.message?.includes('foreign key') || error.message?.includes('team_id') || error.code === '23503') {
                throw new Error('A equipa associada não existe. Contacta o administrador.');
              }
              throw error;
            }
          }
        }
      }

      await refreshPlayer();
      showToast('Perfil guardado!', 'success');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: string }).message)
        : getErrorMessage(err);
      const details = err && typeof err === 'object' && 'details' in err ? (err as { details?: string }).details : undefined;
      showToast(details ? `${msg} (${details})` : msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const onAlterarPassword = async () => {
    const newPwd = passwordForm.newPassword.trim();
    const confirmPwd = passwordForm.confirm.trim();
    if (newPwd.length < 6) {
      showToast('A nova palavra-passe deve ter pelo menos 6 caracteres.', 'error');
      return;
    }
    if (newPwd !== confirmPwd) {
      showToast('As palavras-passe não coincidem.', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      showToast('Palavra-passe alterada com sucesso.', 'success');
      setPasswordForm({ newPassword: '', confirm: '' });
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <Header title="Perfil" />
        <div className="max-w-screen-sm mx-auto px-4 pt-4">
          <p className="text-gray-500">A carregar sessão...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Perfil" />
      <div
        className="max-w-screen-sm mx-auto px-4 pt-4 pb-6 overflow-y-auto overscroll-contain"
        style={{ maxHeight: 'calc(100vh - 8rem)' }}
      >
        <div className="space-y-4">
          <Card>
            <div className="space-y-3">
              <div>
                <Input
                  label="Telemóvel (obrigatório)"
                  type="tel"
                  value={form.phone}
                  onChange={(e: any) => setForm((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="912 345 678 ou +351 912 345 678"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Ex.: 912 345 678 ou +351 912 345 678 — usado para envio de convites por WhatsApp. Podes usar espaços ou traços; o prefixo 351 é opcional.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lado Preferido</label>
                <select
                  value={form.preferred_side}
                  onChange={(e) => setForm((s) => ({ ...s, preferred_side: e.target.value as PreferredSide }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-base"
                >
                  {SIDE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pontos Acumulados Liga</label>
                <div className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                  {player?.liga_points != null && Number.isFinite(Number(player.liga_points)) ? Number(player.liga_points) : 0}
                </div>
                <p className="mt-1 text-xs text-gray-500">Calculado pela App (Vitória=10, Presença=3). Apenas leitura.</p>
              </div>

              <Input
                label="Pontos de Federação (FPP)"
                type="number"
                value={form.federation_points}
                onChange={(e: any) =>
                  setForm((s) => ({ ...s, federation_points: parseInt(e.target.value || '0', 10) || 0 }))
                }
                placeholder="0"
              />
              <p className="text-xs text-gray-500 -mt-1">
                O teu Total combina os pontos ganhos nesta App com o teu ranking nacional oficial.
              </p>

              <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
                <label className="block text-sm font-semibold text-gray-800 mb-1">Total de Pontos (Liga + FPP)</label>
                <p className="text-xl font-bold text-amber-900 tabular-nums">
                  {(player?.liga_points != null && Number.isFinite(Number(player.liga_points)) ? Number(player.liga_points) : 0) + (Number.isFinite(form.federation_points) ? form.federation_points : 0)}
                </p>
              </div>

              <Button fullWidth variant="primary" onClick={onSubmit} disabled={saving}>
                {saving ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Alterar palavra-passe</h3>
            <div className="space-y-3">
              <Input
                label="Nova palavra-passe"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((s) => ({ ...s, newPassword: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
              <Input
                label="Confirmar nova palavra-passe"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((s) => ({ ...s, confirm: e.target.value }))}
                placeholder="Repetir a nova palavra-passe"
              />
              <Button
                variant="secondary"
                onClick={onAlterarPassword}
                disabled={changingPassword || !passwordForm.newPassword.trim() || !passwordForm.confirm.trim()}
              >
                {changingPassword ? 'A alterar...' : 'Alterar palavra-passe'}
              </Button>
            </div>
          </Card>

          <Button
            fullWidth
            variant="ghost"
            onClick={async () => {
              try {
                await signOut();
                showToast('Sessão terminada.', 'info');
              } catch {
                showToast('Erro ao terminar sessão.', 'error');
              } finally {
                navigate({ name: 'login' });
              }
            }}
          >
            Sair
          </Button>

          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
      </div>
    </Layout>
  );
}
