/**
 * Ecrã de recuperação quando há erro de recursão RLS (42P17).
 * Limpa o estado e mostra botão "Recarregar App" em vez de crashar.
 */
export default function ProfileLoadErrorScreen() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-[#121212] px-6"
      role="alert"
    >
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl" aria-hidden>
          ⚠️
        </div>
        <h1 className="text-xl font-bold text-white">
          Erro ao carregar perfil
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Ocorreu um erro de recursão nas políticas da base de dados. Verifica as políticas RLS no Supabase ou contacta o administrador.
        </p>
        <button
          type="button"
          onClick={handleReload}
          className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg transition-colors"
        >
          Recarregar App
        </button>
      </div>
    </div>
  );
}
