import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MENU_ICON_OPTIONS,
  MENU_ICONS,
  type MenuIconName,
  type MenuItemRecord,
  normalizarIconeMenu,
} from "@/lib/menu";

// A tabela é criada pela migration e ainda não aparece nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/configuracao-menu")({
  head: () => ({
    meta: [
      { title: "Configuração do menu | Clínica CEU" },
      {
        name: "description",
        content: "Personalize os grupos, textos e botões exibidos no menu principal.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfiguracaoMenu,
});

type FormMenu = {
  id: number | null;
  chave: string;
  grupo: string;
  grupoOrdem: string;
  rotulo: string;
  destino: string;
  icone: MenuIconName;
  modulo: string;
  ordem: string;
  ativo: boolean;
  somenteAdmin: boolean;
};

const VAZIO: FormMenu = {
  id: null,
  chave: "",
  grupo: "Geral",
  grupoOrdem: "100",
  rotulo: "",
  destino: "/dashboard",
  icone: "LayoutDashboard",
  modulo: "",
  ordem: "10",
  ativo: true,
  somenteAdmin: false,
};

function slugificar(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface MenuDbRow {
  id: unknown;
  chave: unknown;
  grupo: unknown;
  grupo_ordem: unknown;
  rotulo: unknown;
  destino: unknown;
  icone: unknown;
  modulo: unknown;
  ordem: unknown;
  ativo: unknown;
  somente_admin: unknown;
}

function carregarItens(): Promise<MenuItemRecord[]> {
  return db
    .from("menu_itens")
    .select("id,chave,grupo,grupo_ordem,rotulo,destino,icone,modulo,ordem,ativo,somente_admin")
    .order("grupo_ordem")
    .order("ordem")
    .order("rotulo")
    .then(({ data, error }: { data: MenuDbRow[] | null; error: Error | null }) => {
      if (error) throw error;
      return (data ?? []).map((item) => ({
        id: Number(item.id),
        chave: String(item.chave),
        grupo: String(item.grupo),
        grupoOrdem: Number(item.grupo_ordem ?? 100),
        rotulo: String(item.rotulo),
        destino: String(item.destino),
        icone: normalizarIconeMenu(item.icone),
        modulo: item.modulo ? String(item.modulo) : null,
        ordem: Number(item.ordem ?? 100),
        ativo: Boolean(item.ativo),
        somenteAdmin: Boolean(item.somente_admin),
      })) as MenuItemRecord[];
    });
}

function paraFormulario(item: MenuItemRecord): FormMenu {
  return {
    id: item.id,
    chave: item.chave,
    grupo: item.grupo,
    grupoOrdem: String(item.grupoOrdem),
    rotulo: item.rotulo,
    destino: item.destino,
    icone: item.icone,
    modulo: item.modulo ?? "",
    ordem: String(item.ordem),
    ativo: item.ativo,
    somenteAdmin: item.somenteAdmin ?? false,
  };
}

function ConfiguracaoMenu() {
  const { isAdmin, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormMenu | null>(null);

  const itens = useQuery({
    queryKey: ["menu-itens"],
    enabled: isAdmin,
    queryFn: carregarItens,
  });

  const salvar = useMutation({
    mutationFn: async (atual: FormMenu) => {
      const rotulo = atual.rotulo.trim();
      const destino = atual.destino.trim();
      const grupo = atual.grupo.trim();
      const chave = atual.id ? atual.chave.trim() : slugificar(atual.chave || rotulo);
      if (!rotulo) throw new Error("Informe o texto que aparecerá no menu.");
      if (!grupo) throw new Error("Informe o grupo do menu.");
      if (!chave) throw new Error("Informe um identificador para o botão.");
      if (!destino || (!destino.startsWith("/") && !/^https?:\/\//i.test(destino))) {
        throw new Error(
          "O destino deve ser uma rota interna (começando com /) ou uma URL http(s).",
        );
      }
      const grupoOrdem = Number(atual.grupoOrdem);
      const ordem = Number(atual.ordem);
      if (!Number.isInteger(grupoOrdem) || grupoOrdem < 0) {
        throw new Error("A ordem do grupo deve ser um número inteiro igual ou maior que zero.");
      }
      if (!Number.isInteger(ordem) || ordem < 0) {
        throw new Error("A ordem do botão deve ser um número inteiro igual ou maior que zero.");
      }
      const payload = {
        chave,
        grupo,
        grupo_ordem: grupoOrdem,
        rotulo,
        destino,
        icone: atual.icone,
        modulo: atual.modulo.trim() || null,
        ordem,
        ativo: atual.ativo,
        somente_admin: atual.somenteAdmin,
      };
      const consulta = atual.id
        ? await db.from("menu_itens").update(payload).eq("id", atual.id)
        : await db.from("menu_itens").insert(payload);
      if (consulta.error) {
        if (consulta.error.code === "23505") {
          throw new Error("Já existe um botão com este identificador.");
        }
        throw consulta.error;
      }
    },
    onSuccess: async () => {
      toast.success("Botão do menu salvo.");
      setForm(null);
      await queryClient.invalidateQueries({ queryKey: ["menu-itens"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const remover = useMutation({
    mutationFn: async (item: MenuItemRecord) => {
      const { error } = await db.from("menu_itens").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Botão removido do menu.");
      await queryClient.invalidateQueries({ queryKey: ["menu-itens"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  if (!carregandoSessao && !isAdmin) {
    return (
      <AppShell titulo="Configuração do menu">
        <div className="card-superficie max-w-md p-6 text-sm">
          Apenas administradores podem configurar o menu principal.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Configuração do menu"
      descricao="Altere os textos, grupos e botões exibidos na navegação principal."
      acoes={
        isAdmin && (
          <Button size="sm" onClick={() => setForm({ ...VAZIO })}>
            <Plus className="mr-1.5 size-4" /> Novo botão
          </Button>
        )
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3">
          <div className="card-superficie border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-950">
            <strong>Como funciona:</strong> o texto, grupo, ícone e ordem abaixo aparecem no menu de
            todos os usuários que possuem o módulo correspondente. Deixe o campo Módulo vazio para
            mostrar o botão a todos os usuários ativos.
          </div>
          {itens.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : itens.isError ? (
            <div className="card-superficie p-5 text-sm text-destructive">
              Não foi possível carregar os botões do menu. Confirme se a migration de configuração
              foi aplicada no banco de dados.
            </div>
          ) : (
            <div className="space-y-2">
              {(itens.data ?? []).map((item) => {
                const Icone = MENU_ICONS[item.icone];
                return (
                  <article
                    key={item.id}
                    className={`card-superficie flex items-center justify-between gap-3 p-4 ${
                      !item.ativo ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary">
                        <Icone className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.rotulo}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.grupo} · {item.destino}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.modulo ? `Módulo: ${item.modulo}` : "Visível para usuários ativos"}
                          {!item.ativo ? " · Oculto" : ""}
                          {item.somenteAdmin ? " · Somente administradores" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar botão"
                        onClick={() => setForm(paraFormulario(item))}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Apagar botão"
                        onClick={() => {
                          if (window.confirm(`Apagar o botão “${item.rotulo}” do menu?`)) {
                            remover.mutate(item);
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </article>
                );
              })}
              {!itens.data?.length && (
                <div className="card-superficie p-5 text-sm text-muted-foreground">
                  Nenhum botão cadastrado. Crie o primeiro botão para montar a navegação.
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card-superficie h-fit space-y-4 p-5">
          <div>
            <h2 className="font-semibold">{form?.id ? "Editar botão" : "Novo botão"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O identificador é usado apenas internamente e não aparece para os usuários.
            </p>
          </div>
          {form ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="menu-rotulo">Texto no menu</Label>
                <Input
                  id="menu-rotulo"
                  value={form.rotulo}
                  onChange={(event) =>
                    setForm((atual) => (atual ? { ...atual, rotulo: event.target.value } : atual))
                  }
                  placeholder="Ex.: Painel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="menu-chave">Identificador</Label>
                <Input
                  id="menu-chave"
                  value={form.chave}
                  disabled={!!form.id}
                  onChange={(event) =>
                    setForm((atual) => (atual ? { ...atual, chave: event.target.value } : atual))
                  }
                  placeholder="Ex.: painel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="menu-destino">Destino</Label>
                <Input
                  id="menu-destino"
                  value={form.destino}
                  onChange={(event) =>
                    setForm((atual) => (atual ? { ...atual, destino: event.target.value } : atual))
                  }
                  placeholder="Ex.: /dashboard"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ícone</Label>
                <Select
                  value={form.icone}
                  onValueChange={(value) =>
                    setForm((atual) => (atual ? { ...atual, icone: value as MenuIconName } : atual))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {MENU_ICON_OPTIONS.map((option) => {
                      const Icone = MENU_ICONS[option.value];
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            <Icone className="size-4" /> {option.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="menu-grupo">Grupo</Label>
                  <Input
                    id="menu-grupo"
                    value={form.grupo}
                    onChange={(event) =>
                      setForm((atual) => (atual ? { ...atual, grupo: event.target.value } : atual))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="menu-grupo-ordem">Ordem do grupo</Label>
                  <Input
                    id="menu-grupo-ordem"
                    type="number"
                    min="0"
                    value={form.grupoOrdem}
                    onChange={(event) =>
                      setForm((atual) =>
                        atual ? { ...atual, grupoOrdem: event.target.value } : atual,
                      )
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="menu-ordem">Ordem no grupo</Label>
                  <Input
                    id="menu-ordem"
                    type="number"
                    min="0"
                    value={form.ordem}
                    onChange={(event) =>
                      setForm((atual) => (atual ? { ...atual, ordem: event.target.value } : atual))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="menu-modulo">Módulo (opcional)</Label>
                  <Input
                    id="menu-modulo"
                    value={form.modulo}
                    onChange={(event) =>
                      setForm((atual) => (atual ? { ...atual, modulo: event.target.value } : atual))
                    }
                    placeholder="Ex.: salas"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(value) =>
                    setForm((atual) => (atual ? { ...atual, ativo: value } : atual))
                  }
                />
                Exibir no menu
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.somenteAdmin}
                  onCheckedChange={(value) =>
                    setForm((atual) => (atual ? { ...atual, somenteAdmin: value === true } : atual))
                  }
                />
                Exibir somente para administradores
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button onClick={() => salvar.mutate(form)} disabled={salvar.isPending}>
                  <Save className="mr-1.5 size-4" />
                  {salvar.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setForm({ ...VAZIO })}>
              <Plus className="mr-1.5 size-4" /> Adicionar botão
            </Button>
          )}
        </section>
      </div>
    </AppShell>
  );
}
