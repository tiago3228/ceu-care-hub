import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { MODULOS, PERFIS, type PerfilValor } from "@/lib/modulos";
import { criarUsuario, definirSenha } from "@/lib/admin.functions";
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
  setor: string | null;
  ativo: boolean;
  papel: PerfilValor | null;
  modulos: string[];
}

async function carregarUsuarios(): Promise<UsuarioLinha[]> {
  const [perfis, papeis, permissoes] = await Promise.all([
    supabase.from("profiles").select("id, nome, setor, ativo").order("nome"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("usuario_permissoes").select("user_id, modulo"),
  ]);
  return (perfis.data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
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

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", setor: "" });
  const [papel, setPapel] = useState<PerfilValor>("secretaria");
  const [modulos, setModulos] = useState<string[]>([]);

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
      toast.error(e instanceof z.ZodError ? e.issues[0].message : (e as Error).message),
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
      await supabase.from("user_roles").delete().eq("user_id", id);
      const { error } = await supabase.from("user_roles").insert({ user_id: id, role: novo });
      if (error) throw error;
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
                <Select value={papel} onValueChange={(v) => setPapel(v as PerfilValor)}>
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
              <Button
                className="w-full"
                onClick={() => criar.mutate()}
                disabled={criar.isPending}
              >
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
        <div className="space-y-4">
          {(usuarios.data ?? []).map((u) => (
            <section key={u.id} className="card-superficie p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {u.nome || "(sem nome)"}
                    {u.id === sessao?.userId && (
                      <Badge variant="outline" className="ml-2 align-middle text-[10px]">
                        você
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{u.setor ?? "Setor não informado"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={u.papel ?? undefined}
                    onValueChange={(v) => trocarPapel.mutate({ id: u.id, novo: v as PerfilValor })}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Sem perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERFIS.map((p) => (
                        <SelectItem key={p.valor} value={p.valor}>
                          {p.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={u.ativo}
                      onCheckedChange={(v) => alternarAtivo.mutate({ id: u.id, ativo: v })}
                    />
                    {u.ativo ? "Ativo" : "Inativo"}
                  </label>
                  <SenhaInline onSalvar={(senha) => resetarSenha.mutate({ id: u.id, senha })} />
                </div>
              </div>

              <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
                {MODULOS.map((m) => (
                  <label key={m.chave} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={u.modulos.includes(m.chave)}
                      onCheckedChange={(v) =>
                        alternarModulo.mutate({ id: u.id, modulo: m.chave, ligar: !!v })
                      }
                    />
                    <span className="truncate text-muted-foreground">{m.rotulo}</span>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
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
