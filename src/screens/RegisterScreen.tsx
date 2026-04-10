import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Input, Header, Toast, ToastType } from '../components/ui';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getAuthErrorMessage, MIN_PASSWORD_LENGTH } from '../lib/authErrors';
import { normalizePhoneForDb } from '../lib/phone';
import { PlayerRoles, PreferredSides, validatePreferredSide, type PreferredSide } from '../domain/constants';
import { OFFICIAL_M6_TEAM_ID } from '../domain/teamConstants';

/** ID da equipa principal (FK teams). Usado no registo de novos jogadores. */
const DEFAULT_TEAM_ID = OFFICIAL_M6_TEAM_ID;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidTeamId(id: string | null | undefined): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getErrorMessage(e: unknown): string {
  return getAuthErrorMessage(e);
}

/** Valida telemóvel: 9 dígitos PT (9xx, 2xx, 3xx) ou com +351. */
function validatePhone(raw: string | null | undefined): string | null {
  const normalized = normalizePhoneForDb(raw);
  if (!normalized) return 'Indica o teu telemóvel.';
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 9) return 'O telemóvel deve ter pelo menos 9 dígitos.';
  if (digits.startsWith('351') && digits.length !== 12) return 'Formato de telemóvel inválido.';
  if (!digits.startsWith('351') && digits.length !== 9) return 'Indica um número português de 9 dígitos (ex: 912 345 678).';
  return null;
}

function validateSignUp(email: string, password: string): string | null {
  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();
  if (!trimmedEmail) return 'Indica o teu email.';
  if (!EMAIL_REGEX.test(trimmedEmail)) return 'Email inválido.';
  if (!trimmedPassword) return 'Indica uma palavra-passe.';
  if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
    return `A palavra-passe deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres (maiúsculas, minúsculas e números).`;
  }
  return null;
}

const POSITION_OPTIONS: { value: PreferredSide; label: string }[] = [
  { value: PreferredSides.left, label: 'Esquerda' },
  { value: PreferredSides.right, label: 'Direita' },
  { value: PreferredSides.both, label: 'Ambos' },
];

export function RegisterScreen() {
  const { navigate } = useNavigation();
  const { signUp, refreshPlayer, signOut } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [preferred_side, setPreferred_side] = useState<PreferredSide>(PreferredSides.both);
  const [federation_points, setFederation_points] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  const onSubmit = async () => {
    setFormError(null);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedName = name.trim();

    const validationError = validateSignUp(trimmedEmail, trimmedPassword);
    if (validationError) {
      setFormError(validationError);
      showToast(validationError, 'error');
      return;
    }
    const phoneError = validatePhone(phone);
    if (phoneError) {
      setFormError(phoneError);
      showToast(phoneError, 'error');
      return;
    }
    const sideError = validatePreferredSide(preferred_side);
    if (sideError) {
      setFormError('Seleciona a tua posição de jogo.');
      showToast('Seleciona a tua posição de jogo.', 'error');
      return;
    }
    const points = typeof federation_points === 'number' ? federation_points : Number(federation_points) || 0;
    if (points < 0) {
      setFormError('Pontos de Federação não podem ser negativos.');
      showToast('Pontos de Federação não podem ser negativos.', 'error');
      return;
    }
    const phoneNormalized = normalizePhoneForDb(phone) || null;

    setLoading(true);
    try {
      // Usar ID da equipa principal; garante que existe na tabela teams para evitar players_team_id_fkey
      const teamId = DEFAULT_TEAM_ID;
      if (!isValidTeamId(teamId)) {
        setFormError('Nenhuma equipa configurada. Contacta o administrador.');
        showToast('Nenhuma equipa configurada.', 'error');
        setLoading(false);
        return;
      }

      let uid: string | undefined;
      try {
        await signUp(trimmedEmail, trimmedPassword, trimmedName || undefined);
        const { data: sessionData } = await supabase.auth.getSession();
        uid = sessionData.session?.user?.id;
      } catch (authErr: unknown) {
        const code = (authErr as { code?: string })?.code;
        const msg = String((authErr as { message?: string })?.message ?? '');
        const is409 = code === '23505' || msg.includes('already registered') || msg.includes('already exists') || msg.includes('User already registered');
        if (is409) {
          try {
            await supabase.auth.signInWithPassword({ email: trimmedEmail, password: trimmedPassword });
            await refreshPlayer();
            const { data: sessionData } = await supabase.auth.getSession();
            const existingUid = sessionData.session?.user?.id;
            const { data: existingPlayer } = existingUid
              ? await supabase.from('players').select('id').eq('user_id', existingUid).maybeSingle()
              : { data: null };
            if (existingUid && !existingPlayer) {
              const teamId = DEFAULT_TEAM_ID;
              const { error: insertErr } = await supabase.from('players').insert({
                user_id: existingUid,
                team_id: teamId,
                name: trimmedName || trimmedEmail.split('@')[0] || 'Utilizador',
                email: trimmedEmail.toLowerCase(),
                phone: phoneNormalized,
                preferred_side,
                federation_points: points,
                is_active: true,
                role: PlayerRoles.jogador,
                profile_completed: true,
              });
              if (!insertErr) await refreshPlayer();
            }
            showToast('Já tens conta. Entrada efetuada.', 'success');
            navigate({ name: 'home' });
            return;
          } catch (signInErr) {
            throw authErr;
          }
        }
        throw authErr;
      }

      if (!uid) {
        await refreshPlayer();
        navigate({ name: 'home' });
        return;
      }

      // Evitar sobrescrever role de utilizadores existentes (admin/coordenador/capitão)
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id, role')
        .eq('user_id', uid)
        .maybeSingle();

      if (existingPlayer?.id) {
        // Já existe perfil: atualizar apenas campos seguros (nunca role)
        const { error: updateError } = await supabase
          .from('players')
          .update({
            name: trimmedName || trimmedEmail.split('@')[0] || 'Utilizador',
            email: trimmedEmail.toLowerCase(),
            phone: phoneNormalized,
            preferred_side,
            federation_points: points,
            is_active: true,
            team_id: teamId,
            profile_completed: true,
          })
          .eq('user_id', uid);
        if (updateError) {
          if (updateError.message?.includes('foreign key') || updateError.message?.includes('team_id') || updateError.code === '23503') {
            throw new Error('A equipa associada não existe. Contacta o administrador.');
          }
          throw updateError;
        }
      } else {
        // Novo utilizador: apenas INSERT (em conflito não sobrescrever role)
        const payload = {
          user_id: uid,
          team_id: teamId,
          name: trimmedName || trimmedEmail.split('@')[0] || 'Utilizador',
          email: trimmedEmail.toLowerCase(),
          phone: phoneNormalized,
          preferred_side,
          federation_points: points,
          is_active: true,
          role: PlayerRoles.jogador,
          profile_completed: true,
        };
        const { error: insertError } = await supabase
          .from('players')
          .insert(payload);

        if (insertError) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[Register] Erro ao inserir players:', insertError.message, insertError.code);
          }
          if (insertError.code === '23505') {
            await refreshPlayer();
            navigate({ name: 'home' });
            return;
          }
          if (insertError.message?.includes('foreign key') || insertError.message?.includes('team_id') || insertError.code === '23503') {
            throw new Error('A equipa associada não existe. Contacta o administrador.');
          }
          await refreshPlayer();
          navigate({ name: 'home' });
          return;
        }
      }

      await refreshPlayer();
      setFormError(null);
      showToast('Conta criada com sucesso.', 'success');
      navigate({ name: 'home' });
    } catch (e: any) {
      const msg = getErrorMessage(e);
      try {
        await signOut();
      } catch {
        // ignora falha ao terminar sessão
      }
      setFormError(msg);
      showToast(`${msg} Podes tentar novamente ou fazer login se já tens conta.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showNav={false}>
      <Header title="Criar conta" />
      <div className="max-w-screen-sm mx-auto px-4 pt-4 pb-6 space-y-4">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <img
              src="/pwa192.png"
              alt="Liga de Clubes M6"
              className="w-24 h-24 rounded-full object-cover shadow-md border border-gray-200"
            />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Criar conta</h1>
          <p className="text-sm text-gray-600 mt-1">Preenche os dados para te juntares à equipa.</p>
        </div>
        <Card>
          <div className="space-y-3">
            <Input label="Nome" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="João Silva" />
            <Input
              label="Email"
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              type="email"
              autoComplete="email"
            />
            <Input
              label="Telemóvel"
              type="tel"
              value={phone}
              onChange={(e: any) => setPhone(e.target.value)}
              placeholder="912 345 678 ou +351 912 345 678"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Posição de jogo</label>
              <div className="flex gap-2 flex-wrap">
                {POSITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPreferred_side(opt.value)}
                    className={`flex-1 min-w-[80px] py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      preferred_side === opt.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="Pontos de Federação"
              type="number"
              min={0}
              value={federation_points === 0 ? '' : String(federation_points)}
              onChange={(e: any) => {
                const v = e.target.value;
                if (v === '') setFederation_points(0);
                else {
                  const n = parseInt(v, 10);
                  if (!Number.isNaN(n) && n >= 0) setFederation_points(n);
                }
              }}
              placeholder="0"
            />
            <Input
              label="Password"
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              placeholder={`Mín. ${MIN_PASSWORD_LENGTH} caracteres (maiúsc., minúsc., números)`}
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
            />

            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {formError}
              </div>
            )}

            <Button fullWidth variant="primary" onClick={onSubmit} disabled={loading}>
              {loading ? 'A criar...' : 'Criar conta'}
            </Button>

            <Button fullWidth variant="ghost" onClick={() => navigate({ name: 'login' })} disabled={loading}>
              Já tenho conta
            </Button>
          </div>
        </Card>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </Layout>
  );
}
