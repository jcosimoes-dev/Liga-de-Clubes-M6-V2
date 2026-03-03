import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { supabase } from '../lib/supabase';
import { PlayerRoles } from '../domain/constants';
import { Shield, CheckCircle, AlertCircle } from 'lucide-react';

export function BootstrapScreen() {
  console.log('[BootstrapScreen] Componente BootstrapScreen a inicializar');

  const { player } = useAuth();
  const { navigate } = useNavigation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [success, setSuccess] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    currentUserId: string | null;
    adminsCount: number;
    adminsList: Array<{ id: string; name: string; role: string }>;
    loading: boolean;
  }>({
    currentUserId: null,
    adminsCount: 0,
    adminsList: [],
    loading: true,
  });

  console.log('[BootstrapScreen] Render - Player:', player);
  console.log('[BootstrapScreen] Render - Loading:', loading);
  console.log('[BootstrapScreen] Render - Success:', success);

  useEffect(() => {
    console.log('[BootstrapScreen] useEffect - Componente montado');
    console.log('[BootstrapScreen] useEffect - Player:', player);
    console.log('[BootstrapScreen] useEffect - VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);

    const fetchDebugInfo = async () => {
      try {
        console.log('[BootstrapScreen] A buscar informações de debug...');

        // Get current user ID
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id || null;
        console.log('[BootstrapScreen] Current user ID:', currentUserId);

        // Get all admins
        const { data: admins, error: adminsError } = await supabase
          .from('players')
          .select('id, name, role')
          .eq('role', PlayerRoles.admin);

        if (adminsError) {
          console.error('[BootstrapScreen] Erro ao buscar admins:', adminsError);
        } else {
          console.log('[BootstrapScreen] Admins encontrados:', admins);
        }

        setDebugInfo({
          currentUserId,
          adminsCount: admins?.length || 0,
          adminsList: admins || [],
          loading: false,
        });
      } catch (err) {
        console.error('[BootstrapScreen] Erro ao buscar debug info:', err);
        setDebugInfo(prev => ({ ...prev, loading: false }));
      }
    };

    fetchDebugInfo();
  }, [player]);

  const handleBootstrap = async () => {
    console.log('[BootstrapScreen] handleBootstrap INICIADO');
    console.log('[BootstrapScreen] Player actual:', player);

    setLoading(true);
    setError('');
    setErrorDetails('');

    try {
      console.log('[BootstrapScreen] A chamar RPC bootstrap_first_admin()...');

      const { data, error: rpcError } = await supabase
        .rpc('bootstrap_first_admin');

      console.log('[BootstrapScreen] Resposta RPC - data:', data);
      console.log('[BootstrapScreen] Resposta RPC - error:', rpcError);

      if (rpcError) {
        console.error('[BootstrapScreen] Erro RPC:', rpcError);
        const errorMsg = rpcError.message || 'Erro desconhecido';
        const errorDetails = (rpcError as any).details || '';
        setError(errorMsg);
        setErrorDetails(errorDetails);
        setLoading(false);
        return;
      }

      if (!data) {
        console.error('[BootstrapScreen] RPC retornou null/undefined');
        setError('Resposta inválida da RPC');
        setErrorDetails('A função retornou null ou undefined');
        setLoading(false);
        return;
      }

      if (data.ok === true) {
        console.log('[BootstrapScreen] SUCESSO! Player promovido:', data);
        setSuccess(true);

        setTimeout(() => {
          console.log('[BootstrapScreen] A navegar para Admin e recarregar...');
          navigate({ name: 'admin' });
          window.location.reload();
        }, 1500);
        return;
      }

      if (data.error === 'admin_already_exists') {
        console.log('[BootstrapScreen] Admin já existe');
        setError('Já existe um administrador');
        setErrorDetails('Peça ao administrador para o promover.');
        setLoading(false);
        return;
      }

      console.error('[BootstrapScreen] RPC retornou erro:', data);
      setError(data.error || 'Erro ao promover para administrador');
      setErrorDetails('Verifique a consola para mais detalhes.');
      setLoading(false);
    } catch (err) {
      console.error('[BootstrapScreen] EXCEÇÃO durante bootstrap:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar bootstrap';
      setError(errorMessage);
      setErrorDetails('Verifique a consola do navegador para mais detalhes.');
      setLoading(false);
    }
  };

  return (
    <Layout title="Configuração Inicial">
      <div className="max-w-md mx-auto">
        <Card>
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Bem-vindo ao Sistema M6
              </h2>
              <p className="text-sm text-gray-600">
                Configuração inicial do sistema. Promova-se a Administrador para começar.
              </p>
            </div>

            {player && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Utilizador:</strong> {player.name}
                </p>
                <p className="text-sm text-blue-900">
                  <strong>Role actual:</strong> {player.role === PlayerRoles.player ? 'Jogador' : player.role}
                </p>
              </div>
            )}

            <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg space-y-3">
              <h3 className="text-sm font-bold text-yellow-900 flex items-center gap-2">
                🔍 Informações de Debug
              </h3>

              {debugInfo.loading ? (
                <p className="text-xs text-yellow-700">A carregar informações...</p>
              ) : (
                <div className="space-y-2 text-xs text-yellow-900">
                  <div className="p-2 bg-yellow-100 rounded">
                    <p className="font-semibold mb-1">Utilizador Autenticado:</p>
                    <p className="font-mono text-[10px] break-all">
                      {debugInfo.currentUserId || 'NÃO AUTENTICADO'}
                    </p>
                  </div>

                  <div className="p-2 bg-yellow-100 rounded">
                    <p className="font-semibold mb-1">
                      Administradores no Sistema: {debugInfo.adminsCount}
                    </p>
                    {debugInfo.adminsCount > 0 ? (
                      <div className="space-y-1 mt-2">
                        {debugInfo.adminsList.map((admin) => (
                          <div key={admin.id} className="p-2 bg-yellow-200 rounded">
                            <p className="font-semibold">{admin.name}</p>
                            <p className="font-mono text-[10px] break-all opacity-75">
                              ID: {admin.id}
                            </p>
                            <p className="text-[10px] uppercase font-bold text-yellow-800">
                              {admin.role}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-yellow-700 mt-1">
                        ✅ Nenhum administrador encontrado (pode promover-se!)
                      </p>
                    )}
                  </div>

                  {player && (
                    <div className="p-2 bg-purple-100 border border-purple-300 rounded">
                      <p className="font-semibold text-purple-900 mb-1">Player Atual:</p>
                      <p className="text-[10px] text-purple-800">
                        <span className="font-semibold">Player ID:</span>
                        <br />
                        <span className="font-mono break-all">{player.id}</span>
                      </p>
                      <p className="text-[10px] text-purple-800 mt-1">
                        <span className="font-semibold">Player user_id:</span>
                        <br />
                        <span className="font-mono break-all">{player.user_id || 'NULL'}</span>
                      </p>
                    </div>
                  )}

                  {debugInfo.currentUserId && player && debugInfo.currentUserId === player.user_id && (
                    <div className="p-2 bg-green-100 border border-green-300 rounded">
                      <p className="text-green-800 font-semibold">
                        ✅ User ID corresponde ao Player.user_id (CORRETO!)
                      </p>
                    </div>
                  )}

                  {debugInfo.currentUserId && player && debugInfo.currentUserId !== player.user_id && (
                    <div className="p-2 bg-red-100 border border-red-300 rounded">
                      <p className="text-red-800 font-semibold">
                        ⚠️ ERRO: User ID NÃO corresponde ao Player.user_id
                      </p>
                      <p className="text-[10px] mt-1">
                        <span className="font-semibold">Auth User ID:</span>
                        <br />
                        <span className="font-mono break-all">{debugInfo.currentUserId}</span>
                      </p>
                      <p className="text-[10px] mt-1">
                        <span className="font-semibold">Player.user_id:</span>
                        <br />
                        <span className="font-mono break-all">{player.user_id || 'NULL'}</span>
                      </p>
                      <p className="text-red-700 font-semibold text-[11px] mt-2">
                        O player será recriado automaticamente ao clicar em "Tornar-me Administrador"
                      </p>
                    </div>
                  )}

                  {debugInfo.currentUserId && !player && (
                    <div className="p-2 bg-orange-100 border border-orange-300 rounded">
                      <p className="text-orange-800 font-semibold">
                        ⚠️ Player não encontrado para este user_id
                      </p>
                      <p className="text-orange-700 text-[11px] mt-1">
                        Será criado automaticamente ao clicar em "Tornar-me Administrador"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 justify-center text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <p className="text-sm font-semibold">
                    Promovido a Administrador! A recarregar...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-900 mb-1">
                      Erro ao Configurar Sistema
                    </p>
                    <p className="text-sm text-red-700">{error}</p>
                    {errorDetails && (
                      <p className="text-xs text-red-600 mt-1">{errorDetails}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!success && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('[BootstrapScreen] BOTÃO CLICADO - Event:', e);
                    console.log('[BootstrapScreen] BOTÃO CLICADO - Loading:', loading);
                    console.log('[BootstrapScreen] BOTÃO CLICADO - Disabled:', loading);
                    console.log('[BootstrapScreen] A chamar handleBootstrap...');
                    handleBootstrap();
                  }}
                  disabled={loading}
                  className={`w-full px-4 py-2 text-white font-medium rounded-lg transition-colors ${
                    loading
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      A promover...
                    </span>
                  ) : (
                    'Tornar-me Administrador'
                  )}
                </button>

                <p className="text-xs text-gray-500">
                  Esta funcionalidade só está disponível quando ainda não existe nenhum administrador no sistema.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
