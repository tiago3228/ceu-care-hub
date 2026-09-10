export type MetodoMonitoramento = "http_browser" | "icmp_backend" | "tcp_backend";
export type StatusMonitoramento = "online" | "offline";

export interface ResultadoMonitoramento {
  status: StatusMonitoramento;
  tempoRespostaMs: number | null;
  metodo: MetodoMonitoramento;
  erro: string | null;
}

export interface MonitoramentoIp {
  verificar(ip: string, timeoutMs: number): Promise<ResultadoMonitoramento>;
}

/**
 * Adaptador atual para execução somente no navegador.
 * A interface MonitoramentoIp permite trocar este adaptador por uma chamada
 * a backend/Edge Function ICMP ou TCP sem alterar a tela do módulo.
 */
export const monitoramentoHttpBrowser: MonitoramentoIp = {
  async verificar(ip, timeoutMs) {
    const inicio = performance.now();
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(`http://${ip}`, { mode: "no-cors", signal: controller.signal });
      return {
        status: "online",
        tempoRespostaMs: Math.round(performance.now() - inicio),
        metodo: "http_browser",
        erro: null,
      };
    } catch (error) {
      return {
        status: "offline",
        tempoRespostaMs: Math.round(performance.now() - inicio),
        metodo: "http_browser",
        erro: error instanceof Error ? error.message : "Falha na verificação HTTP",
      };
    } finally {
      window.clearTimeout(timer);
    }
  },
};

export function obterMonitoramentoAtual(): MonitoramentoIp {
  return monitoramentoHttpBrowser;
}
