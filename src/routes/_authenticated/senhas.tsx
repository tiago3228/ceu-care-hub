import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Eye,
  EyeOff,
  Copy,
  Globe,
  KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  salvarSenha,
  excluirSenha,
  revelarSenha,
  registrarCopiaLogin,
} from "@/lib/senhas.functions";

export const Route = createFileRoute("/_authenticated/senhas")({
  head: () => ({
    meta: [
      { title: "Senhas | Gestão de Sistemas - Clínica CEU" },
      {
        name: "description",
        content:
          "Cofre de credenciais da Clínica CEU: acessos de sistemas e sites com senha protegida, permissões e auditoria.",
      },
      { property: "og:title", content: "Senhas | Gestão de Sistemas - Clínica CEU" },
      {
        property: "og:description",
        content: "Centralize com segurança os acessos utilizados pela equipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaSenhas,
});

const TODAS = "__todas__";
const SEM_VALOR = "__nenhuma__";
const CATEGORIAS = [
  "Sistemas",
  "E-mails",
  "Bancos",
  "Operadoras",
  "Equipamentos",
  "Sites",
  "Outros",
];
const SEGUNDOS_REVELADA = 20;

interface Credencial {
  id: number;
  nome: string;
  url: string | null;
  login: string;
  observacoes: string | null;
  categoria: string | null;
  created_at: string;
  updated_at: string;
}

interface FormSenha {
  id: number | null;
  nome: string;
  url: string;
  login: string;
  senha: string;
  observacoes: string;
  categoria: string;
}

const VAZIO: FormSenha = {
  id: null,
  nome: "",
  url: "",
  login: "",
  senha: "",
  observacoes: "",
  categoria: "",
};

function PaginaSenhas() {
  const { temModulo, somenteLeitura, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState(TODAS);
  const [form, setForm] = useState<FormSenha | null>(null);
  const [verSenhaForm, setVerSenhaForm] = useState(false);
  const [excluir, setExcluir] = useState<Credencial | null>(null);
  const [revelada, setRevelada] = useState<{ id: number; senha: string } | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const podeVer = temModulo("senhas");
  const podeGerenciar = !somenteLeitura && podeVer;
  const podeRevelar = temModulo("senhas_revelar");

  const senhas = useQuery({
    queryKey: ["senhas"],
    enabled: podeVer,
    queryFn: async (): Promise<Credencial[]> => {
      const { data, error } = await supabase
        .from("senhas")
        .select("id, nome, url, login, observacoes, categoria, created_at, updated_at")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Credencial[];
    },
  });

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (senhas.data ?? [])
      .filter((s) =>
        !termo
          ? true
          : [s.nome, s.url, s.login, s.observacoes]
              .filter(Boolean)
              .some((c) => (c as string).toLowerCase().includes(termo)),
      )
      .filter((s) => categoria === TODAS || (s.categoria ?? "") === categoria);
  }, [senhas.data, busca, categoria]);

  const salvar = useMutation({
    mutationFn: async (f: FormSenha) =>
      salvarSenha({
        data: {
          id: f.id,
          nome: f.nome.trim(),
          url: f.url.trim() || null,
          login: f.login.trim(),
          senha: f.senha,
          observacoes: f.observacoes.trim() || null,
          categoria: f.categoria || null,
        },
      }),
    onSuccess: () => {
      toast.success("Credencial salva.");
      setForm(null);
      setVerSenhaForm(false);
      queryClient.invalidateQueries({ queryKey: ["senhas"] });
    },
    onError: (e) => toast.error(mensagem(e)),
  });

  const remover = useMutation({
    mutationFn: async (c: Credencial) => excluirSenha({ data: { id: c.id } }),
    onSuccess: () => {
      toast.success("Credencial excluída.");
      setExcluir(null);
      queryClient.invalidateQueries({ queryKey: ["senhas"] });
    },
    onError: (e) => toast.error(mensagem(e)),
  });

  async function alternarRevelar(c: Credencial) {
    if (revelada?.id === c.id) {
      setRevelada(null);
      return;
    }
    try {
      const r = await revelarSenha({ data: { id: c.id, motivo: "revelar" } });
      setRevelada({ id: c.id, senha: r.senha });
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setRevelada(null), SEGUNDOS_REVELADA * 1000);
    } catch (e) {
      toast.error(mensagem(e));
    }
  }

  async function copiar(texto: string, rotulo: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${rotulo} copiado.`);
    } catch {
      toast.error(`Não foi possível copiar o ${rotulo.toLowerCase()}.`);
    }
  }

  async function copiarLogin(c: Credencial) {
    await copiar(c.login, "Login");
    registrarCopiaLogin({ data: { id: c.id } }).catch(() => undefined);
  }

  async function copiarSenha(c: Credencial) {
    try {
      const r = await revelarSenha({ data: { id: c.id, motivo: "copiar" } });
      await copiar(r.senha, "Senha");
    } catch (e) {
      toast.error(mensagem(e));
    }
  }

  function abrirSite(c: Credencial) {
    if (!c.url) return;
    const destino = c.url.startsWith("http") ? c.url : `https://${c.url}`;
    window.open(destino, "_blank", "noopener,noreferrer");
  }

  function validarEEnviar() {
    if (!form) return;
    if (form.nome.trim().length < 2) return toast.error("Informe o nome do sistema.");
    if (!form.login.trim()) return toast.error("Informe o login.");
    if (!form.senha) return toast.error("Informe a senha.");
    if (form.url.trim()) {
      try {
        const u = new URL(
          form.url.trim().startsWith("http") ? form.url.trim() : `https://${form.url.trim()}`,
        );
        if (!u.hostname.includes(".")) throw new Error();
      } catch {
        return toast.error("Informe um endereço de site válido.");
      }
    }
    salvar.mutate(form);
  }

  if (!carregandoSessao && !podeVer) {
    return (
      <AppShell titulo="Senhas">
        <div className="card-superficie max-w-md p-6 text-sm text-muted-foreground">
          Você não tem permissão para acessar o cofre de senhas.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Senhas"
      descricao="Cofre de credenciais dos sistemas utilizados pela equipe"
      acoes={
        podeGerenciar && (
          <Button
            size="sm"
            onClick={() => {
              setVerSenhaForm(false);
              setForm({ ...VAZIO });
            }}
          >
            <Plus className="mr-1.5 size-4" /> Nova senha
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Pesquisar senhas..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Pesquisar senhas"
          />
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-[190px]" aria-label="Filtrar por categoria">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as categorias</SelectItem>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {senhas.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : senhas.isError ? (
        <div className="card-superficie p-6 text-sm text-muted-foreground">
          Não foi possível carregar as credenciais.
        </div>
      ) : lista.length === 0 ? (
        <div className="card-superficie p-6 text-sm text-muted-foreground">
          Nenhuma credencial encontrada.
        </div>
      ) : (
        <div className="card-superficie overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Sistema</th>
                <th className="hidden px-3 py-2 md:table-cell">Site</th>
                <th className="px-3 py-2">Login</th>
                <th className="px-3 py-2">Senha</th>
                <th className="hidden px-3 py-2 lg:table-cell">Observações</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="border-t border-border/60 align-top">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <KeyRound className="size-4 text-muted-foreground" />
                      {c.nome}
                    </div>
                    {c.categoria && (
                      <p className="text-xs text-muted-foreground">{c.categoria}</p>
                    )}
                  </td>
                  <td className="hidden max-w-[220px] truncate px-3 py-2 md:table-cell">
                    {c.url ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="break-all">{c.login}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Copiar login"
                        onClick={() => copiarLogin(c)}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="font-mono">
                        {revelada?.id === c.id ? revelada.senha : "••••••••"}
                      </span>
                      {podeRevelar && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={
                              revelada?.id === c.id ? "Ocultar senha" : "Revelar senha"
                            }
                            onClick={() => alternarRevelar(c)}
                          >
                            {revelada?.id === c.id ? (
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label="Copiar senha"
                            onClick={() => copiarSenha(c)}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="hidden max-w-[260px] px-3 py-2 text-muted-foreground lg:table-cell">
                    {c.observacoes ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {c.url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Abrir site"
                          onClick={() => abrirSite(c)}
                        >
                          <Globe className="size-4" />
                        </Button>
                      )}
                      {podeGerenciar && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="Editar credencial"
                            onClick={() => {
                              setVerSenhaForm(false);
                              setForm({
                                id: c.id,
                                nome: c.nome,
                                url: c.url ?? "",
                                login: c.login,
                                senha: "",
                                observacoes: c.observacoes ?? "",
                                categoria: c.categoria ?? "",
                              });
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label="Excluir credencial"
                            onClick={() => setExcluir(c)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!form}
        onOpenChange={(a) => {
          if (!a) {
            setForm(null);
            setVerSenhaForm(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar credencial" : "Nova senha"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="nome">Nome do sistema/site *</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="url">Site / URL</Label>
                <Input
                  id="url"
                  placeholder="https://sistema.exemplo.com.br"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="login">Login / Usuário *</Label>
                <Input
                  id="login"
                  autoComplete="off"
                  value={form.login}
                  onChange={(e) => setForm({ ...form, login: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="senha">
                  Senha {form.id ? "(informe para substituir)" : "*"}
                </Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={verSenhaForm ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.senha}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={verSenhaForm ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setVerSenhaForm((v) => !v)}
                  >
                    {verSenhaForm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Select
                  value={form.categoria || SEM_VALOR}
                  onValueChange={(v) =>
                    setForm({ ...form, categoria: v === SEM_VALOR ? "" : v })
                  }
                >
                  <SelectTrigger id="categoria">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_VALOR}>Sem categoria</SelectItem>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  rows={3}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button disabled={salvar.isPending} onClick={validarEEnviar}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluir} onOpenChange={(a) => !a && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir esta credencial?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não poderá ser desfeita. Credencial: {excluir?.nome}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluir && remover.mutate(excluir)}>
              Confirmar exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function mensagem(e: unknown) {
  const texto = e instanceof Error ? e.message : "Não foi possível concluir a ação.";
  return texto.includes("[object") ? "Não foi possível concluir a ação." : texto;
}
