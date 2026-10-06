import { useEffect, useState } from "react";
import { Download, Plus, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isEscalaCeuInstalled, OPEN_INSTALL_EVENT } from "@/lib/instalacao-app";

const DISMISS_KEY = "escala-ceu:install-dismissed-at";
const DISMISS_DAYS = 14;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function wasDismissedRecently() {
  try {
    const value = localStorage.getItem(DISMISS_KEY);
    return Boolean(value) && Date.now() - Number(value) < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

export function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onOpen = () => {
      if (isEscalaCeuInstalled()) return;
      setIosHelp(isIos());
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener(OPEN_INSTALL_EVENT, onOpen);
    window.addEventListener("appinstalled", onInstalled);

    if (!isEscalaCeuInstalled() && !wasDismissedRecently() && isIos()) {
      setIosHelp(true);
      const timer = window.setTimeout(() => setVisible(true), 2500);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
        window.removeEventListener(OPEN_INSTALL_EVENT, onOpen);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener(OPEN_INSTALL_EVENT, onOpen);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Storage pode estar indisponível no modo privado.
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="pointer-events-auto w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-xl">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Download className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Instalar Escala CEU</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Instale a Escala CEU no seu dispositivo para acessar a gestão da clínica de forma
              rápida e prática.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar aviso de instalação"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        {iosHelp && !deferred ? (
          <ol className="mt-3 space-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <Share2 className="size-4 text-primary" /> 1. Toque em Compartilhar no Safari.
            </li>
            <li className="flex items-center gap-2">
              <Plus className="size-4 text-primary" /> 2. Escolha “Adicionar à Tela de Início”.
            </li>
          </ol>
        ) : (
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="flex-1" onClick={install}>
              Instalar aplicativo
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Agora não
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
