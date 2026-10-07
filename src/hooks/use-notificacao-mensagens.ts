import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type MensagemNotificavel = {
  id: number;
  remetente_id: string;
  destinatario_id: string;
};

function emitirSomNotificacao() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const contexto = new AudioContextClass();
    const oscilador = contexto.createOscillator();
    const ganho = contexto.createGain();
    oscilador.type = "sine";
    oscilador.frequency.setValueAtTime(880, contexto.currentTime);
    oscilador.frequency.exponentialRampToValueAtTime(660, contexto.currentTime + 0.12);
    ganho.gain.setValueAtTime(0.0001, contexto.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.12, contexto.currentTime + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.0001, contexto.currentTime + 0.2);
    oscilador.connect(ganho);
    ganho.connect(contexto.destination);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.2);
    void oscilador.addEventListener("ended", () => contexto.close());
  } catch {
    // O navegador pode bloquear áudio automático; o alerta visual continua ativo.
  }
}

export function useNotificacaoMensagens(
  mensagens: MensagemNotificavel[] | undefined,
  userId: string | undefined,
  titulo: string,
) {
  const [novaMensagem, setNovaMensagem] = useState(false);
  const maiorIdAnterior = useRef<number | null>(null);

  useEffect(() => {
    if (!mensagens?.length) return;
    const maiorId = Math.max(...mensagens.map((mensagem) => mensagem.id));
    if (maiorIdAnterior.current === null) {
      maiorIdAnterior.current = maiorId;
      return;
    }
    if (maiorId <= maiorIdAnterior.current) return;

    const recebeuMensagem = mensagens.some(
      (mensagem) => mensagem.id > maiorIdAnterior.current! && mensagem.destinatario_id === userId,
    );
    maiorIdAnterior.current = maiorId;
    if (!recebeuMensagem) return;

    setNovaMensagem(true);
    toast.info(`Nova mensagem de ${titulo}`, {
      description: "Abra a conversa para visualizar.",
    });
    emitirSomNotificacao();
  }, [mensagens, titulo, userId]);

  return {
    novaMensagem,
    dispensar: () => setNovaMensagem(false),
  };
}
