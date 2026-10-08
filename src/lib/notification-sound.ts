const eventosJaNotificados = new Map<string, Set<string>>();
const MAX_EVENTOS_GUARDADOS = 500;

function chaveArmazenamento(userId: string) {
  return `ceu-care:lembretes-com-som:${userId}`;
}

function eventosDoUsuario(userId: string) {
  const emMemoria = eventosJaNotificados.get(userId);
  if (emMemoria) return emMemoria;

  let eventos = new Set<string>();
  try {
    const salvo = window.localStorage.getItem(chaveArmazenamento(userId));
    const valores: unknown = salvo ? JSON.parse(salvo) : [];
    if (Array.isArray(valores)) {
      eventos = new Set(valores.filter((valor): valor is string => typeof valor === "string"));
    }
  } catch {
    // localStorage pode estar indisponível; o cache em memória ainda evita repetições nesta sessão.
  }
  eventosJaNotificados.set(userId, eventos);
  return eventos;
}

function persistirEventos(userId: string, eventos: Set<string>) {
  const recentes = [...eventos].slice(-MAX_EVENTOS_GUARDADOS);
  eventos.clear();
  recentes.forEach((evento) => eventos.add(evento));
  try {
    window.localStorage.setItem(chaveArmazenamento(userId), JSON.stringify(recentes));
  } catch {
    // Áudio é complementar; falha de armazenamento não deve impedir os alertas visuais.
  }
}

/** Marca lembretes já ativos no carregamento inicial para não repetir o bip após atualizar a página. */
export function marcarLembretesJaNotificados(userId: string, eventosNovos: string[]) {
  if (typeof window === "undefined") return;
  const eventos = eventosDoUsuario(userId);
  eventosNovos.forEach((evento) => eventos.add(evento));
  persistirEventos(userId, eventos);
}

/** Reserva o evento antes de tocar: o mesmo lembrete não emite som duas vezes, inclusive após refresh. */
export function reservarSomParaLembrete(userId: string, evento: string) {
  if (typeof window === "undefined") return false;
  const eventos = eventosDoUsuario(userId);
  if (eventos.has(evento)) return false;
  eventos.add(evento);
  persistirEventos(userId, eventos);
  return true;
}

/** Emite um bip curto e discreto; se o navegador bloquear áudio, o alerta visual permanece. */
export function emitirSomNotificacao() {
  if (typeof window === "undefined") return;
  const AudioContextClass =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const contexto = new AudioContextClass();
    const tocar = () => {
      if (contexto.state !== "running") {
        void contexto.close();
        return;
      }
      const oscilador = contexto.createOscillator();
      const ganho = contexto.createGain();
      oscilador.type = "sine";
      oscilador.frequency.setValueAtTime(880, contexto.currentTime);
      oscilador.frequency.exponentialRampToValueAtTime(660, contexto.currentTime + 0.12);
      ganho.gain.setValueAtTime(0.0001, contexto.currentTime);
      ganho.gain.exponentialRampToValueAtTime(0.045, contexto.currentTime + 0.01);
      ganho.gain.exponentialRampToValueAtTime(0.0001, contexto.currentTime + 0.18);
      oscilador.connect(ganho);
      ganho.connect(contexto.destination);
      oscilador.addEventListener("ended", () => void contexto.close(), { once: true });
      oscilador.start();
      oscilador.stop(contexto.currentTime + 0.18);
    };

    if (contexto.state === "suspended") {
      void contexto
        .resume()
        .then(tocar)
        .catch(() => void contexto.close());
    } else {
      tocar();
    }
  } catch {
    // Alguns navegadores bloqueiam áudio automático ou não implementam Web Audio.
  }
}
