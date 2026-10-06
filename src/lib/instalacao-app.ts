export const OPEN_INSTALL_EVENT = "escala-ceu:open-install-prompt";

export function isEscalaCeuInstalled() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

export function openEscalaCeuInstallPrompt() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_INSTALL_EVENT));
}
