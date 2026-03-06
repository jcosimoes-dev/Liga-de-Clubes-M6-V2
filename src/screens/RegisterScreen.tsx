import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Input, Header, Toast, ToastType } from '../components/ui';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getAuthErrorMessage, MIN_PASSWORD_LENGTH } from '../lib/authErrors';
import { TeamsService } from '../services';
import { PlayerRoles } from '../domain/constants';

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidTeamId(id: string | null | undefined): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getErrorMessage(e: unknown): string {
  return getAuthErrorMessage(e);
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

export function RegisterScreen() {
  const { navigate } = useNavigation();
  const { signUp, refreshPlayer } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

    setLoading(true);
    try {
      // Resolver team_id (UUID obrigatório, FK para teams) ANTES de signUp para evitar 500 por team_id_fkey
      let teamId: string = DEFAULT_TEAM_ID;
      try {
        const teams = await TeamsService.getAll();
        const firstId = teams?.[0]?.id;
        if (isValidTeamId(firstId)) teamId = firstId!.trim();
      } catch {
        // manter DEFAULT_TEAM_ID (Equipa Principal da migração)
      }
      if (!isValidTeamId(teamId)) {
        setFormError('Nenhuma equipa configurada. Contacta o administrador.');
        showToast('Nenhuma equipa configurada.', 'error');
        setLoading(false);
        return;
      }

      try {
        await signUp(trimmedEmail, trimmedPassword, trimmedName || undefined);
      } catch (authErr: unknown) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[Register] signUp error:', {
            code: (authErr as { code?: string })?.code,
            status: (authErr as { status?: number })?.status,
            message: (authErr as { message?: string })?.message,
          });
        }
        throw authErr;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) {
        await refreshPlayer();
        showToast('Conta criada.', 'success');
        navigate({ name: 'home' });
        return;
      }

      const { error: upsertError } = await supabase
        .from('players')
        .upsert(
          {
            user_id: uid,
            team_id: teamId,
            name: trimmedName || trimmedEmail.split('@')[0] || 'Utilizador',
            email: trimmedEmail.toLowerCase(),
            federation_points: 0,
            is_active: true,
            role: PlayerRoles.jogador,
            preferred_side: 'both',
            profile_completed: true,
            points_updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (upsertError) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[Register] Erro ao inserir/atualizar players — diagnóstico:', {
            message: upsertError.message,
            code: upsertError.code,
            details: upsertError.details,
            hint: upsertError.hint,
            team_id: teamId,
          });
        }
        if (upsertError.message?.includes('foreign key') || upsertError.message?.includes('team_id') || upsertError.code === '23503') {
          throw new Error('A equipa associada não existe. Contacta o administrador.');
        }
        throw upsertError;
      }

      await refreshPlayer();

      setFormError(null);
      showToast('Conta criada ✅', 'success');
      navigate({ name: 'home' });
    } catch (e: any) {
      const msg = getErrorMessage(e);
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Header title="Criar conta" />
      <div className="max-w-screen-sm mx-auto px-4 pt-4 space-y-4">
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