import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { MODULOS, PERFIS, type PerfilValor } from "@/lib/modulos";
import { criarUsuario, definirSenha, editarUsuario, excluirUsuario } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e permissões | Clínica CEU" },
      {
        name: "description",
        content:
          "Cadastro de usuários, perfis de acesso e permissões por módulo do sistema da Clínica CEU.",
      },
      { property: "og:title", content: "Usuários e permissões | Clínica CEU" },
      {
        property: "og:description",
        content: "Gerencie perfis e permissões por módulo da equipe da Clínica CEU.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaUsuarios,
});

interface UsuarioLinha {
  id: string;
  nome: string;
  username: string | null;
  email: string | null;
  setor_id: number | null;
  setor: string | null;
  ativo: boolean;
  papel: PerfilValor | null;
  modulos: string[];
}

const MODULOS_PERFIL_SONDAS = [
  "sondas",
  "sondas_adicionar",
  "sondas_editar",
  "sondas_excluir",
  "sondas_relatorios",
  "sondas_manutencao",
  "equipamentos_us",
  "senhas",
  "senhas_adicionar",
  "senhas_editar",
  "senhas_excluir",
  "senhas_revelar",
  "ramais",
  "notas",
];

async function carregarUsuarios(): Promise<UsuarioLinha[]> {
  const [perfis, papeis, permissoes] = await Promise.all([
    (supabase as any)
      .from("profiles")
      .select("id, nome, username, login, setor, setor_id, ativo")
      .order("nome"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("usuario_permissoes").select("user_id, modulo"),
  ]);
  return (perfis.data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    username: p.username,
    email: p.login,
    setor_id: p.setor_id,
    setor: p.setor,
    ativo: p.ativo,
    papel: ((papeis.data ?? []).find((r) => r.user_id === p.id)?.role as PerfilValor) ?? null,
    modulos: (permissoes.data ?? []).filter((m) => m.user_id === p.id).map((m) => m.modulo),
  }));
}

const novoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  senha: z.string().min(8, "Senha com no mínimo 8 caracteres").max(72),
  setor: z.string().trim().max(120),
});

function PaginaUsuarios() {
  const { isAdmin, sessao, isLoading: carregandoSessao } = useSessao();
  const queryClient = useQueryClient();
  const usuarios = useQuery({ queryKey: ["usuarios"], queryFn: carregarUsuarios });
  const setores = useQuery({
    queryKey: ["setores-admin-usuarios"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("setores")
        .select("id,nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", setor: "" });
  const [papel, setPapel] = useState<PerfilValor>("secretaria");
  const [modulos, setModulos] = useState<string[]>([]);
  const [setoresAbertos, setSetoresAbertos] = useState<Set<string>>(new Set());
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UsuarioLinha | null>(null);
  const [editar, setEditar] = useState<UsuarioLinha | null>(null);
  const [edicao, setEdicao] = useState({
    nome: "",
    username: "",
    email: "",
    setorId: "",
    setor: "",
    senha: "",
  });
  const gruposPorSetor = useMemo(() => {
    const grupos = new Map<string, UsuarioLinha[]>();
    for (const usuario of usuarios.data ?? []) {
      const setor = usuario.setor?.trim() || "Sem setor";
      grupos.set(setor, [...(grupos.get(setor) ?? []), usuario]);
    }
    return [...grupos.entries()].sort(([a], [b]) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
    );
  }, [usuarios.data]);
  const usuarioAberto =
    usuarios.data?.find((usuario) => usuario.id === usuarioSelecionado?.id) ?? usuarioSelecionado;
  const alternarSetor = (setor: string) => {
    setSetoresAbertos((atuais) => {
      const proximo = new Set(atuais);
      if (proximo.has(setor)) proximo.delete(setor);
      else proximo.add(setor);
      return proximo;
    });
  };

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    queryClient.invalidateQueries({ queryKey: ["sessao"] });
  };

  const criar = useMutation({
    mutationFn: async () => {
      const parsed = novoSchema.parse(form);
      await criarUsuario({
        data: {
          nome: parsed.nome,
          email: parsed.email,
          senha: parsed.senha,
          setor: parsed.setor || null,
          papel,
          modulos,
        },
      });
    },
    onSuccess: () => {
      toast.success("Usuário criado com acesso liberado.");
      setForm({ nome: "", email: "", senha: "", setor: "" });
      setModulos([]);
      setAberto(false);
      invalidar();
    },
    onError: (e) =>
      toast.error(
        e instanceof z.ZodError
          ? (e.issues[0]?.message ?? "Dados inválidos")
          : (e as Error).message,
      ),
  });

  const alternarAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("profiles").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Situação atualizada.");
      invalidar();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const trocarPapel = useMutation({
    mutationFn: async ({ id, novo }: { id: string; novo: PerfilValor }) => {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: id, role: novo }, { onConflict: "user_id,role" });
      if (error) throw error;
      const { error: limparErro } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", id)
        .neq("role", novo);
      if (limparErro) throw limparErro;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      invalidar();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const alternarModulo = useMutation({
    mutationFn: async ({ id, modulo, ligar }: { id: string; modulo: string; ligar: boolean }) => {
      if (ligar) {
        const { error } = await supabase
          .from("usuario_permissoes")
          .upsert({ user_id: id, modulo }, { onConflict: "user_id,modulo" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("usuario_permissoes")
          .delete()
          .eq("user_id", id)
          .eq("modulo", modulo);
        if (error) throw error;
      }
    },
    onSuccess: invalidar,
    onError: (e) => toast.error((e as Error).message),
  });

  const resetarSenha = useMutation({
    mutationFn: async ({ id, senha }: { id: string; senha: string }) => {
      z.string().min(8).max(72).parse(senha);
      await definirSenha({ data: { userId: id, senha } });
    },
    onSuccess: () => toast.success("Senha redefinida."),
    onError: () => toast.error("Informe uma senha com no mínimo 8 caracteres."),
  });
  const excluir = useMutation({
    mutationFn: async (usuario: UsuarioLinha) => {
      await excluirUsuario({ data: { userId: usuario.id } });
    },
    onSuccess: () => {
      toast.success("Usuário excluído.");
      invalidar();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const atualizar = useMutation({
    mutationFn: async () => {
      if (!editar) return;
      const setorSelecionado = (setores.data ?? []).find(
        (s: any) => String(s.id) === edicao.setorId,
      );
      await editarUsuario({
        data: {
          userId: editar.id,
          nome: edicao.nome,
          username: edicao.username,
          email: edicao.email,
          setorId: setorSelecionado?.id ?? null,
          setor: setorSelecionado?.nome ?? (edicao.setor || null),
          ativo: editar.ativo,
          papel: editar.papel ?? "secretaria",
          modulos: editar.modulos,
          senha: edicao.senha,
        },
      });
    },
    onSuccess: () => {
      toast.success("Colaborador atualizado.");
      setEditar(null);
      invalidar();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!carregandoSessao && !isAdmin) {
    return (
      <AppShell titulo="Usuários e permissões">
        <div className="card-superficie max-w-md p-6">
          <p className="text-sm text-foreground">
            Você não tem permissão para gerenciar usuários. Fale com a coordenação.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Usuários e permissões"
      descricao="Perfis de acesso e liberação de módulos, como no sistema anterior"
      acoes={
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button size="sm">Novo usuário</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo usuário</DialogTitle>
              <DialogDescription>
                O usuário entra com e-mail e a senha inicial definida aqui.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="n-nome">Nome</Label>
                  <Input
                    id="n-nome"
                    value={form.nome}
                    maxLength={120}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="n-setor">Setor</Label>
                  <Input
                    id="n-setor"
                    value={form.setor}
                    maxLength={120}
                    onChange={(e) => setForm({ ...form, setor: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="n-email">E-mail</Label>
                  <Input
                    id="n-email"
                    type="email"
                    value={form.email}
                    maxLength={255}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="n-senha">Senha inicial</Label>
                  <Input
                    id="n-senha"
                    type="password"
                    value={form.senha}
                    maxLength={72}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Perfil</Label>
                <Select
                  value={papel}
                  onValueChange={(v) => {
                    const novoPapel = v as PerfilValor;
                    setPapel(novoPapel);
                    if (novoPapel === "sondas") setModulos(MODULOS_PERFIL_SONDAS);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERFIS.map((p) => (
                      <SelectItem key={p.valor} value={p.valor}>
                        {p.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Administradores acessam todos os módulos automaticamente.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Módulos liberados</Label>
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
                  {MODULOS.map((m) => (
                    <label key={m.chave} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={modulos.includes(m.chave)}
                        onCheckedChange={(v) =>
                          setModulos((atual) =>
                            v ? [...atual, m.chave] : atual.filter((x) => x !== m.chave),
                          )
                        }
                      />
                      <span className="truncate">{m.rotulo}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={() => criar.mutate()} disabled={criar.isPending}>
                {criar.isPending ? "Criando..." : "Criar usuário"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {usuarios.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {gruposPorSetor.map(([setor, membros]) => (
            <section key={setor} className="card-superficie overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-secondary/40"
                onClick={() => alternarSetor(setor)}
                aria-expanded={setoresAbertos.has(setor)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {setoresAbertos.has(setor) ? (
                    <ChevronDown className="size-4 shrink-0" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0" />
                  )}
                  <span className="truncate font-semibold text-foreground">{setor}</span>
                </span>
                <Badge variant="secondary">
                  {membros.length} {membros.length === 1 ? "usuário" : "usuários"}
                </Badge>
              </button>
              {setoresAbertos.has(setor) && (
                <div className="space-y-2 border-t border-border bg-secondary/10 p-3">
                  {membros.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-4 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-secondary/40"
                      onClick={() => setUsuarioSelecionado(u)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {u.nome || "(sem nome)"}
                          {u.id === sessao?.userId && (
                            <Badge variant="outline" className="ml-2 align-middle text-[10px]">
                              você
                            </Badge>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {u.username ? `@${u.username} · ` : ""}
                          {u.email ?? "E-mail não informado"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge variant={u.ativo ? "secondary" : "destructive"}>
                          {u.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                        <Badge variant="outline">{u.modulos.length} permissões</Badge>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
      <Dialog
        open={!!usuarioAberto}
        onOpenChange={(aberto) => !aberto && setUsuarioSelecionado(null)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Permissões do usuário</DialogTitle>
            <DialogDescription>
              Selecione os módulos liberados para {usuarioAberto?.nome || "este usuário"}.
            </DialogDescription>
          </DialogHeader>
          {usuarioAberto && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                <div>
                  <p className="font-medium text-foreground">
                    {usuarioAberto.nome || "(sem nome)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {usuarioAberto.email ?? "E-mail não informado"} ·{" "}
                    {usuarioAberto.setor ?? "Sem setor"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={usuarioAberto.papel ?? "secretaria"}
                    disabled={
                      usuarioAberto.id === sessao?.userId && usuarioAberto.papel === "admin_master"
                    }
                    onValueChange={(v) =>
                      trocarPapel.mutate({ id: usuarioAberto.id, novo: v as PerfilValor })
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Sem perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERFIS.map((perfil) => (
                        <SelectItem key={perfil.valor} value={perfil.valor}>
                          {perfil.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={usuarioAberto.ativo}
                      onCheckedChange={(ativo) =>
                        alternarAtivo.mutate({ id: usuarioAberto.id, ativo })
                      }
                    />
                    {usuarioAberto.ativo ? "Ativo" : "Inativo"}
                  </label>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {MODULOS.map((modulo) => (
                  <label
                    key={modulo.chave}
                    className="flex items-center gap-2 rounded-md border border-border/70 p-2 text-sm"
                  >
                    <Checkbox
                      checked={usuarioAberto.modulos.includes(modulo.chave)}
                      onCheckedChange={(ligar) =>
                        alternarModulo.mutate({
                          id: usuarioAberto.id,
                          modulo: modulo.chave,
                          ligar: !!ligar,
                        })
                      }
                    />
                    <span className="truncate text-muted-foreground">{modulo.rotulo}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <SenhaInline
                  onSalvar={(senha) => resetarSenha.mutate({ id: usuarioAberto.id, senha })}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditar(usuarioAberto);
                    setEdicao({
                      nome: usuarioAberto.nome,
                      username: usuarioAberto.username ?? "",
                      email: usuarioAberto.email ?? "",
                      setorId: usuarioAberto.setor_id ? String(usuarioAberto.setor_id) : "",
                      setor: usuarioAberto.setor ?? "",
                      senha: "",
                    });
                    setUsuarioSelecionado(null);
                  }}
                >
                  Editar dados
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={usuarioAberto.id === sessao?.userId || excluir.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Excluir definitivamente ${usuarioAberto.nome || "este usuário"}?`,
                      )
                    ) {
                      excluir.mutate(usuarioAberto);
                      setUsuarioSelecionado(null);
                    }
                  }}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Excluir usuário
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!editar} onOpenChange={(v) => !v && setEditar(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar colaborador</DialogTitle>
            <DialogDescription>
              Altere usuário, e-mail, setor, situação ou redefina a senha.
            </DialogDescription>
          </DialogHeader>
          {editar && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input
                  value={edicao.nome}
                  onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Usuário</Label>
                <Input
                  value={edicao.username}
                  onChange={(e) => setEdicao({ ...edicao, username: e.target.value.toLowerCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={edicao.email}
                  onChange={(e) => setEdicao({ ...edicao, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Select
                  value={edicao.setorId || "sem-setor"}
                  onValueChange={(v) =>
                    setEdicao({ ...edicao, setorId: v === "sem-setor" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem-setor">Sem setor</SelectItem>
                    {(setores.data ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nova senha (opcional)</Label>
                <Input
                  type="password"
                  value={edicao.senha}
                  onChange={(e) => setEdicao({ ...edicao, senha: e.target.value })}
                  placeholder="Deixe vazio para não alterar"
                />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Switch
                  checked={editar.ativo}
                  onCheckedChange={(v) => setEditar({ ...editar, ativo: v })}
                />{" "}
                Usuário ativo
              </label>
            </div>
          )}
          <Button
            className="w-full"
            disabled={atualizar.isPending}
            onClick={() => atualizar.mutate()}
          >
            {atualizar.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SenhaInline({ onSalvar }: { onSalvar: (senha: string) => void }) {
  const [abrir, setAbrir] = useState(false);
  const [senha, setSenha] = useState("");
  if (!abrir)
    return (
      <Button variant="outline" size="sm" onClick={() => setAbrir(true)}>
        Redefinir senha
      </Button>
    );
  return (
    <div className="flex items-center gap-2">
      <Input
        type="password"
        value={senha}
        maxLength={72}
        placeholder="Nova senha"
        className="w-40"
        onChange={(e) => setSenha(e.target.value)}
      />
      <Button
        size="sm"
        onClick={() => {
          onSalvar(senha);
          setSenha("");
          setAbrir(false);
        }}
      >
        Salvar
      </Button>
    </div>
  );
}
