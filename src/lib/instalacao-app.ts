export const OPEN_INSTALL_EVENT = "escala-ceu:open-install-prompt";
const INSTALLED_KEY = "escala-ceu:installed";

export function isEscalaCeuInstalled() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  try {
    if (window.localStorage.getItem(INSTALLED_KEY) === "1") return true;
  } catch {
    // Continua com a detecção pelo display-mode.
  }
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

export async function isEscalaCeuInstalledAsync() {
  if (isEscalaCeuInstalled()) return true;
  if (typeof navigator === "undefined") return false;
  const navegador = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string }>>;
  };
  if (!navegador.getInstalledRelatedApps) return false;
  try {
    const aplicativos = await navegador.getInstalledRelatedApps();
    return aplicativos.some((app) => app.id === "/" || app.id === "escala-ceu");
  } catch {
    return false;
  }
}

export function marcarEscalaCeuInstalado() {
  try {
    window.localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    // Storage pode estar indisponível no modo privado.
  }
}

export function openEscalaCeuInstallPrompt() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_INSTALL_EVENT));
}
