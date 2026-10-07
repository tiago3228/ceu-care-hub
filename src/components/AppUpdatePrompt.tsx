import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type RegistrationWithBinding = ServiceWorkerRegistration & { __ceuUpdateBound?: boolean };

export function AppUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    const showWaiting = (next: ServiceWorkerRegistration) => {
      if (!cancelled && next.waiting) {
        setRegistration(next);
        setVisible(true);
      }
    };

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((next) => {
        if (cancelled) return;
        showWaiting(next);
        const typed = next as RegistrationWithBinding;
        if (!typed.__ceuUpdateBound) {
          typed.__ceuUpdateBound = true;
          next.addEventListener("updatefound", () => {
            const worker = next.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller)
                showWaiting(next);
            });
          });
        }
        void next.update().catch(() => undefined);
      })
      .catch(() => undefined);

    const onControllerChange = () => {
      if (!cancelled) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!visible || !registration) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <div className="pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xl">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <RefreshCw className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium">Nova versão disponível</p>
        <Button
          size="sm"
          onClick={() => {
            registration.waiting?.postMessage({ type: "SKIP_WAITING" });
            setVisible(false);
          }}
        >
          Atualizar agora
        </Button>
        <button
          type="button"
          aria-label="Fechar aviso de atualização"
          onClick={() => setVisible(false)}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
