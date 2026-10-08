import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { emitirSomNotificacao } from "@/lib/notification-sound";

type MensagemNotificavel = {
  id: number;
  remetente_id: string;
  destinatario_id: string;
};

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
