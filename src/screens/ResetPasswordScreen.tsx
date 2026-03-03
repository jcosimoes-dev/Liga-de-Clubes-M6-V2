import { useState, FormEvent } from 'react';
import { Layout } from '../components/layout/Layout';
import { Input, Button, Card, Toast, ToastType } from '../components/ui';
import { useNavigation } from '../contexts/NavigationContext';
import { supabase } from '../lib/supabase';
import { Lock } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 6;

export function ResetPasswordScreen() {
  const { navigate } = useNavigation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  const canSubmit =
    password.length >= MIN_PASSWORD_LENGTH &&
    confirmPassword.length >= MIN_PASSWORD_LENGTH &&
    password === confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) {
      setError('As palavras-passe devem ter pelo menos 6 caracteres e coincidir.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: password.trim() });
      if (updateError) throw updateError;
      showToast('Palavra-passe alterada com sucesso. Inicia sessão com a nova password.', 'success');
      setPassword('');
      setConfirmPassword('');
      navigate({ name: 'login' });
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao atualizar palavra-passe. Tenta novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showNav={false}>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Nova palavra-passe</h1>
            <p className="text-sm text-gray-600">Introduz e confirma a nova palavra-passe (mín. 6 caracteres).</p>
          </div>

          <Card>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nova palavra-passe</label>
                <Input
                  type="password"
                  placeholder="Mín. 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar palavra-passe</label>
                <Input
                  type="password"
                  placeholder="Repete a palavra-passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" fullWidth disabled={!canSubmit || loading}>
                {loading ? 'A guardar...' : 'Guardar e ir para o Login'}
              </Button>
            </form>
          </Card>

          <p className="text-center text-sm text-gray-500 mt-4">
            Após guardar, serás redirecionado para o início de sessão.
          </p>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}
