import { useState, FormEvent } from 'react';
import { Layout } from '../components/layout/Layout';
import { Input, Button, Card, Toast, ToastType } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { supabase } from '../lib/supabase';
import { User, Lock } from 'lucide-react';

export function LoginScreen() {
  const { signIn } = useAuth();
  const { navigate } = useNavigation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // ✅ OFFLINE: não tenta autenticar (evita Failed to fetch + refresh token requests)
    if (!navigator.onLine) {
      showToast('Sem internet. Liga-te para iniciar sessão.', 'error');
      setError('Sem internet. Liga-te para iniciar sessão.');
      return;
    }

    setLoading(true);

    try {
      await signIn(email.trim().toLowerCase(), password);
      navigate({ name: 'home' });
    } catch (err: any) {
      const msg = err?.message ?? '';
      const status = err?.status ?? err?.code;

      // Se falhou por rede (às vezes navigator.onLine ainda diz true)
      if (
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('network') ||
        status === 0
      ) {
        showToast('Falha de ligação. Verifica a internet e tenta novamente.', 'error');
        setError('Falha de ligação. Verifica a internet e tenta novamente.');
        return;
      }

      setError('Email ou palavra-passe incorretos');

      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Login] Falha no login — detalhe para diagnóstico:', {
          message: msg,
          status,
          email_tentado: email ? `${email.slice(0, 3)}***@${(email.split('@')[1] || '')}` : '(vazio)',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const e = email.trim().toLowerCase();

    if (!e) {
      showToast('Introduz o teu email acima e clica novamente.', 'info');
      return;
    }

    // ✅ OFFLINE: não tenta chamar supabase
    if (!navigator.onLine) {
      showToast('Sem internet. Liga-te para pedir a reposição da palavra-passe.', 'error');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      showToast(
        'Email enviado! Verifica a caixa de entrada e clica no link para redefinir a palavra-passe.',
        'success'
      );
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network')) {
        showToast('Falha de ligação. Verifica a internet e tenta novamente.', 'error');
      } else {
        showToast(msg || 'Erro ao enviar email. Tenta novamente.', 'error');
      }
    }
  };

  return (
    <Layout showNav={false}>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <img
                src="/pwa192.png"
                alt="Liga de Clubes M6"
                className="w-28 h-28 rounded-full object-cover shadow-md border border-gray-200"
              />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">🎾 Equipa M6 APC TRABLISA</h1>
            <p className="text-lg text-gray-600">Gestão da equipa e dos jogos</p>

            {/* ✅ Informação suave de offline (sem assustar) */}
            {!navigator.onLine && (
              <p className="mt-3 text-sm text-red-600">
                Estás offline — para entrar tens de ligar a internet.
              </p>
            )}
          </div>

          <Card>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>Email</span>
                  </div>
                </label>
                <Input
                  type="email"
                  placeholder="exemplo@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span>Palavra-passe</span>
                  </div>
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="text-base"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <Button type="submit" fullWidth disabled={loading} size="lg">
                {loading ? 'A entrar...' : 'Entrar'}
              </Button>

              <div className="pt-4 space-y-2 text-center border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => navigate({ name: 'register' })}
                  className="block w-full text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  Criar conta
                </button>

                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="block w-full text-sm text-gray-500 hover:text-blue-600 transition-colors"
                >
                  Esqueci-me da palavra-passe
                </button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}