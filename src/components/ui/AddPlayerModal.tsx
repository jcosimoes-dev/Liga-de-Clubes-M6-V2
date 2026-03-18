import { useState, useEffect } from 'react';
import { X, UserPlus } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { supabase } from '../../lib/supabase';
import { getAuthErrorMessage, isEmailAlreadyRegistered, MIN_PASSWORD_LENGTH, PASSWORD_REQUIREMENTS } from '../../lib/authErrors';
import { PlayerRoles, PreferredSides, type PlayerRole, type PreferredSide } from '../../domain/constants';

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

const ROLE_OPTIONS: { value: PlayerRole; label: string }[] = [
  { value: PlayerRoles.jogador, label: 'Jogador' },
  { value: PlayerRoles.capitao, label: 'Capitão' },
  { value: PlayerRoles.coordenador, label: 'Coordenador' },
  { value: PlayerRoles.admin, label: 'Administrador' },
];

const SIDE_OPTIONS: { value: PreferredSide; label: string }[] = [
  { value: PreferredSides.left, label: 'Esquerda' },
  { value: PreferredSides.right, label: 'Direita' },
  { value: PreferredSides.both, label: 'Ambos' },
];

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (message: string) => void;
  teamId?: string | null;
}

function getErrorMessage(err: unknown): string {
  // Erros Auth (signUp/signIn) — usar helper para código e mensagem
  const authMsg = getAuthErrorMessage(err);
  if (authMsg !== 'Erro ao criar conta. Tenta novamente.') return authMsg;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('team') || msg.includes('team_id')) return 'Falta ID da equipa. Contacta o administrador.';
    if (msg.includes('foreign key')) return 'A equipa associada não existe. Confirma o team_id.';
    return err.message;
  }
  if (typeof err === 'string') return err;
  return 'Erro inesperado. Tenta novamente.';
}

/**
 * Adicionar Jogador (Admin): quadro único com Nome, Email, Password, Role, Telefone, Pontos Federação, Lado Preferido.
 * Ao clicar 'Criar Jogador': auth.signUp + insert/upsert na tabela players com TODOS os dados; modal fecha imediatamente.
 */
export function AddPlayerModal({ isOpen, onClose, onSuccess, onError, teamId }: AddPlayerModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<PlayerRole>(PlayerRoles.jogador);
  const [phone, setPhone] = useState('');
  const [federationPoints, setFederationPoints] = useState<number>(0);
  const [preferredSide, setPreferredSide] = useState<PreferredSide>(PreferredSides.both);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const effectiveTeamId = teamId ?? DEFAULT_TEAM_ID;

  // KeyboardAvoidingView-style: quando o teclado virtual reduz a viewport (mobile), adiciona padding para o conteúdo subir
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => {
      const heightDiff = window.innerHeight - vv.height;
      setKeyboardOffset(heightDiff > 50 ? heightDiff : 0);
    };
    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
    handler();
    return () => {
      vv.removeEventListener('resize', handler);
      vv.removeEventListener('scroll', handler);
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Sessão inválida. Faz login novamente.');
      }
      const adminSession = { access_token: sessionData.session.access_token, refresh_token: sessionData.session.refresh_token ?? '' };

      if (!effectiveTeamId) {
        throw new Error('Falta ID da equipa. Define uma equipa no perfil de administrador.');
      }

      const emailTrim = email.trim().toLowerCase();
      const passwordToUse = typeof password === 'string' ? password : '';
      if (passwordToUse.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`A palavra-passe deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres. ${PASSWORD_REQUIREMENTS}`);
      }

      // 1) signUp primeiro. Se email já existe, prosseguir para signIn e depois upsert.
      let newUserId: string;
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailTrim,
        password: passwordToUse,
        options: { data: { full_name: name.trim() } },
      });

      const isAlreadyRegistered = signUpError && isEmailAlreadyRegistered(signUpError);

      if (signUpError && !isAlreadyRegistered) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[AddPlayerModal] signUp error:', {
            code: (signUpError as { code?: string })?.code,
            status: (signUpError as { status?: number })?.status,
            message: (signUpError as { message?: string })?.message,
          });
        }
        throw signUpError;
      }

      if (signUpData?.user?.id) {
        newUserId = signUpData.user.id;
      } else if (isAlreadyRegistered) {
        // Utilizador já existe no Auth: obter user_id via signIn para depois fazer upsert na tabela players
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: emailTrim,
          password: passwordToUse,
        });
        if (signInError || !signInData?.user?.id) {
          throw new Error('Este email já está registado. Use a palavra-passe correta ou utilize "Repor palavra-passe" no Admin.');
        }
        newUserId = signInData.user.id;
      } else {
        throw new Error('Conta criada mas utilizador não devolvido. Tenta novamente.');
      }

      // Repor sessão do Admin IMEDIATAMENTE — o signUp troca a sessão para o novo user e o NavigationContext
      // pode mostrar "Acesso Negado" se a sessão não for reposta a tempo (tem 5s de margem em admin).
      if (adminSession.access_token && adminSession.refresh_token) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
        // Pequena pausa para o AuthContext aplicar a sessão e evitar race com o upsert
        await new Promise((r) => setTimeout(r, 300));
      }

      const points = Number.isFinite(federationPoints) && federationPoints >= 0 ? federationPoints : 0;
      const preferredSideStr = String(preferredSide ?? 'both').toLowerCase().trim();
      const payload = {
        user_id: newUserId,
        name: name.trim(),
        email: emailTrim,
        role: role || 'jogador',
        team_id: effectiveTeamId,
        phone: phone.trim() || null,
        federation_points: points,
        preferred_side: ['left', 'right', 'both'].includes(preferredSideStr) ? preferredSideStr : 'both',
      };

      console.log('Tentando criar com payload:', payload);

      // 1) Tentar RPC admin_upsert_player (SECURITY DEFINER, contorna RLS; evita falhas de permissão INSERT)
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_upsert_player', {
        p_user_id: newUserId,
        p_name: payload.name,
        p_email: payload.email,
        p_role: payload.role,
        p_team_id: effectiveTeamId,
        p_phone: payload.phone,
        p_federation_points: payload.federation_points,
        p_preferred_side: payload.preferred_side as string,
      });

      if (!rpcError && rpcData?.ok) {
        // RPC sucedeu
      } else if (rpcData?.error === 'not_admin') {
        // Fallback: Admin hardcoded sem linha em players — usar upsert directo
        // Não enviar updated_at nem points_updated_at — o Supabase gere-os automaticamente via trigger/default
        const { error: upsertError } = await supabase
          .from('players')
          .upsert(
            {
              user_id: newUserId,
              name: payload.name,
              email: payload.email,
              role: payload.role,
              team_id: effectiveTeamId,
              is_active: true,
              preferred_side: payload.preferred_side as string,
              phone: payload.phone,
              federation_points: payload.federation_points,
            },
            { onConflict: 'user_id' }
          );

        if (upsertError) {
          console.error('Erro detalhado no INSERT (fallback upsert):', upsertError);
          if (
            upsertError.message?.toLowerCase?.().includes('foreign key') ||
            upsertError.message?.toLowerCase?.().includes('team_id') ||
            upsertError.code === '23503'
          ) {
            throw new Error(
              'A equipa associada não existe ou é inválida. Confirma o teu team_id (perfil de administrador) e a tabela teams.'
            );
          }
          throw new Error(upsertError.message || upsertError.code || 'Não foi possível guardar o jogador.');
        }
      } else {
        console.error('Erro detalhado no INSERT (RPC admin_upsert_player):', rpcError, rpcData);
        if (rpcData?.error === 'invalid_team_id') {
          throw new Error(
            'A equipa associada não existe ou é inválida. Confirma o teu team_id (perfil de administrador) e a tabela teams.'
          );
        }
        throw new Error(
          (rpcData?.error as string) || rpcError?.message || rpcError?.code || 'Não foi possível guardar o jogador.'
        );
      }

      setName('');
      setEmail('');
      setPassword('');
      setRole(PlayerRoles.jogador);
      setPhone('');
      setFederationPoints(0);
      setPreferredSide(PreferredSides.both);
      setError('');
      setLoading(false);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro detalhado no INSERT:', err);
      const msg = getErrorMessage(err);
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]"
        style={{ maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <UserPlus className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Adicionar Jogador</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Área scrollável (ScrollView): max 80vh; padding inferior quando teclado abre (KeyboardAvoidingView-style) */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          style={{
            paddingBottom: keyboardOffset > 0 ? keyboardOffset : 'env(safe-area-inset-bottom, 0)',
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="p-4 space-y-2.5"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <Input
              label="Nome completo"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              required
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao.silva@exemplo.com"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Mín. ${MIN_PASSWORD_LENGTH} caracteres (maiúsc., minúsc., números)`}
              required
              minLength={MIN_PASSWORD_LENGTH}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Função (Role)</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as PlayerRole)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-base"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Telefone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="912345678"
            />

            <Input
              label="Pontos de Federação"
              type="number"
              value={federationPoints}
              onChange={(e) => setFederationPoints(parseInt(e.target.value || '0', 10) || 0)}
              placeholder="0"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lado Preferido</label>
              <select
                value={preferredSide}
                onChange={(e) => setPreferredSide(e.target.value as PreferredSide)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-base"
              >
                {SIDE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading}
              >
                {loading ? 'A processar...' : 'Criar Jogador'}
              </Button>
            </div>
            {loading && (
              <p className="text-xs text-gray-500 text-center pt-1">
                Pode demorar alguns segundos. Aguarda a resposta do servidor.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
