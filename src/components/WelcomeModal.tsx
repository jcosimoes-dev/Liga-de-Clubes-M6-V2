import { FileText, Hand, MessageCircle, Calendar, Trophy, ArrowRight } from 'lucide-react';

const WELCOME_STORAGE_KEY = 'liga-m6-hasSeenWelcome';

export function getHasSeenWelcome(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(WELCOME_STORAGE_KEY) === 'true';
}

export function setHasSeenWelcome(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
}

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GUIDES = [
  {
    icon: FileText,
    title: 'Perfil',
    text: 'Garante que o teu telemóvel e lado de jogo estão corretos para seres convocado.',
  },
  {
    icon: Hand,
    title: 'Disponibilidade',
    text: 'Clica em "Sim" nos jogos abertos para avisares o Coordenador que podes jogar.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    text: 'Se fores o selecionado, recebes a convocatória oficial no teu WhatsApp.',
  },
  {
    icon: Calendar,
    title: 'Calendário',
    text: 'Usa o botão do Google Calendar para agendares o jogo num clique.',
  },
  {
    icon: Trophy,
    title: 'Pontos',
    text: 'Pontos da Liga dependem do resultado da equipa na eliminatória e se jogaste (valores como 9,38 ou 3,13). O Total soma Liga + FPP.',
  },
] as const;

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  if (!isOpen) return null;

  const handleClose = () => {
    setHasSeenWelcome();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradiente subtil no topo (verde clarinho → branco) */}
        <div className="absolute inset-x-0 top-0 h-40 rounded-t-2xl bg-gradient-to-b from-emerald-50/90 to-white pointer-events-none" aria-hidden />

        {/* Cabeçalho */}
        <div className="relative p-6 pb-4 text-center border-b border-gray-100">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg mb-4" aria-hidden>
            <span className="text-4xl">🎾</span>
          </div>
          <h2 id="welcome-modal-title" className="text-xl md:text-2xl font-bold text-gray-900">
            Bem-vindo à Liga M6!
          </h2>
          <p className="text-sm text-gray-500 mt-1">Guia prático para começares</p>
        </div>

        {/* Conteúdo */}
        <div className="p-6 pt-4 space-y-4 flex-1">
          {GUIDES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-emerald-600">
                <Icon className="w-5 h-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
                <p className="text-sm text-gray-600 mt-0.5">{text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Botão 3D verde — relevo e efeito de pressão */}
        <div className="relative p-6 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-4 px-6 rounded-xl bg-green-50 text-green-900 font-bold border border-green-200 border-b-4 border-b-green-800 transition-all duration-150 ease-out active:translate-y-[2px] active:border-b active:border-b-green-800 hover:bg-green-100 flex items-center justify-center gap-2"
          >
            <span className="text-xl" aria-hidden>🎾</span>
            <span>Vamos a isto!</span>
            <ArrowRight className="w-5 h-5 flex-shrink-0" aria-hidden />
          </button>
        </div>

        {/* Marca de água: silhueta da bola no canto */}
        <div className="absolute bottom-4 right-4 pointer-events-none select-none opacity-[0.05]" aria-hidden>
          <span className="text-[8rem] leading-none">🎾</span>
        </div>
      </div>
    </div>
  );
}
