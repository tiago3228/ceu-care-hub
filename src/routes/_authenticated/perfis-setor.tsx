import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AppShell } from "@/components/AppShell";
import { useSessao } from "@/hooks/use-sessao";
import { MODULOS, MODULOS_PESSOAIS_PADRAO } from "@/lib/modulos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";

type PapelSetor = Database["public"]["Enums"]["app_role"];

export const Route = createFileRoute("/_authenticated/perfis-setor")({ component: PerfisSetor });
function PerfisSetor() {
  const { isAdmin, isLoading } = useSessao();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<PapelSetor>("secretaria");
  const [modulos, setModulos] = useState<string[]>([...MODULOS_PESSOAIS_PADRAO]);
  const [editarId, setEditarId] = useState<number | null>(null);
  const [editarNome, setEditarNome] = useState("");
  const [editarPapel, setEditarPapel] = useState<PapelSetor>("secretaria");
  const [editarModulos, setEditarModulos] = useState<string[]>([]);
  const setores = useQuery({
    queryKey: ["setores-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("setores").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const configuracao = useQuery({
    queryKey: ["cadastro-automatico"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_acesso")
        .select("valor")
        .eq("chave", "cadastro_automatico")
        .maybeSingle();
      return data?.valor !== false;
    },
  });
  const alternarCadastro = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("configuracoes_acesso")
        .update({ valor: !(configuracao.data ?? true) })
        .eq("chave", "cadastro_automatico");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cadastro-automatico"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const salvar = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Informe o nome do setor.");
      const { error } = await supabase.from("setores").insert({
        nome: nome.trim(),
        papel_padrao: papel,
        permissoes_padrao: modulos.filter((modulo) => modulo !== "ramais_editar"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Setor criado.");
      setNome("");
      setModulos([...MODULOS_PESSOAIS_PADRAO]);
      qc.invalidateQueries({ queryKey: ["setores-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const atualizar = useMutation({
    mutationFn: async () => {
      if (editarId === null) throw new Error("Selecione um setor para editar.");
      if (!editarNome.trim()) throw new Error("Informe o nome do setor.");
      const { error } = await supabase
        .from("setores")
        .update({
          nome: editarNome.trim(),
          papel_padrao: editarPapel,
          permissoes_padrao: editarModulos.filter((modulo) => modulo !== "ramais_editar"),
        })
        .eq("id", editarId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissões do setor atualizadas.");
      setEditarId(null);
      setEditarNome("");
      setEditarPapel("secretaria");
      setEditarModulos([]);
      qc.invalidateQueries({ queryKey: ["setores-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const iniciarEdicao = (setor: {
    id: number;
    nome?: string | null;
    papel_padrao?: PapelSetor | null;
    permissoes_padrao?: unknown;
  }) => {
    setEditarId(setor.id);
    setEditarNome(setor.nome ?? "");
    setEditarPapel(setor.papel_padrao ?? "secretaria");
    setEditarModulos(
      (Array.isArray(setor.permissoes_padrao) ? setor.permissoes_padrao : []).filter(
        (modulo: unknown): modulo is string =>
          typeof modulo === "string" && modulo !== "ramais_editar",
      ),
    );
  };
  const cancelarEdicao = () => {
    setEditarId(null);
    setEditarNome("");
    setEditarPapel("secretaria");
    setEditarModulos([]);
  };
  const remover = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("setores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Setor removido.");
      qc.invalidateQueries({ queryKey: ["setores-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!isLoading && !isAdmin)
    return (
      <AppShell titulo="Perfis por Setor">
        <p className="text-sm text-muted-foreground">Apenas administradores têm acesso.</p>
      </AppShell>
    );
  return (
    <AppShell
      titulo="Perfis por Setor"
      descricao="Setores e permissões aplicadas automaticamente no cadastro"
    >
      <div className="mb-4 flex items-center justify-between rounded-md border border-border bg-card p-4">
        <div>
          <p className="font-medium">Cadastro automático</p>
          <p className="text-xs text-muted-foreground">
            {configuracao.data === false
              ? "Novos usuários aguardam aprovação."
              : "Novos usuários entram com as permissões do setor."}
          </p>
        </div>
        <Button variant="outline" onClick={() => alternarCadastro.mutate()}>
          {configuracao.data === false ? "Ativar automático" : "Exigir aprovação"}
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <section className="card-superficie space-y-4 p-5">
          <h2 className="font-medium">Novo setor</h2>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Recepção"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Perfil padrão</Label>
            <Select
              value={papel}
              onValueChange={(valor) => {
                setPapel(valor as PapelSetor);
                if (valor !== "admin_master" && valor !== "administrador") {
                  setModulos((atuais) => atuais.filter((modulo) => modulo !== "ramais_editar"));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "secretaria",
                  "recepcao",
                  "marcacao",
                  "comercial",
                  "qualidade",
                  "rh",
                  "manutencao",
                  "medicos",
                  "diretoria",
                  "enfermagem",
                  "sondas",
                ].map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Permissões padrão</Label>
            <p className="text-xs text-muted-foreground">
              Edição de Ramais é individual e só pode ser concedida a administradores.
            </p>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
              {[...MODULOS]
                .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"))
                .map((m) => (
                  <label className="flex items-center gap-2 text-sm" key={m.chave}>
                    <Checkbox
                      disabled={m.chave === "ramais_editar"}
                      checked={modulos.includes(m.chave)}
                      onCheckedChange={(v) =>
                        setModulos((xs) =>
                          v ? [...new Set([...xs, m.chave])] : xs.filter((x) => x !== m.chave),
                        )
                      }
                    />
                    {m.rotulo}
                  </label>
                ))}
            </div>
          </div>
          <Button
            className="w-full"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || atualizar.isPending}
          >
            <Plus className="mr-1.5 size-4" />
            Criar setor
          </Button>
        </section>
        <section className="space-y-3">
          {(setores.data ?? []).map((s) => (
            <div className="card-superficie flex items-start justify-between gap-3 p-5" key={s.id}>
              <div>
                <p className="font-medium">{s.nome}</p>
                <p className="text-xs text-muted-foreground">
                  Perfil: {s.papel_padrao} · {s.permissoes_padrao?.length ?? 0} permissões padrão
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {(s.permissoes_padrao ?? []).join(", ") || "Nenhuma permissão adicional"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Editar permissões do setor"
                  aria-label={`Editar permissões de ${s.nome}`}
                  onClick={() => iniciarEdicao(s)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Excluir setor"
                  onClick={() => confirm(`Excluir o setor ${s.nome}?`) && remover.mutate(s.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {!setores.data?.length && (
            <p className="text-sm text-muted-foreground">Nenhum setor encontrado.</p>
          )}
        </section>
      </div>
      <Dialog
        open={editarId !== null}
        onOpenChange={(aberto) => {
          if (!aberto) cancelarEdicao();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar permissões do setor</DialogTitle>
            <DialogDescription>
              Altere o nome, o perfil e os módulos que serão aplicados aos novos usuários deste
              setor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="editar-setor-nome">Nome do setor</Label>
              <Input
                id="editar-setor-nome"
                value={editarNome}
                onChange={(e) => setEditarNome(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil padrão</Label>
              <Select
                value={editarPapel}
                onValueChange={(valor) => {
                  setEditarPapel(valor as PapelSetor);
                  if (valor !== "admin_master" && valor !== "administrador") {
                    setEditarModulos((atuais) =>
                      atuais.filter((modulo) => modulo !== "ramais_editar"),
                    );
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "secretaria",
                    "recepcao",
                    "marcacao",
                    "comercial",
                    "qualidade",
                    "rh",
                    "manutencao",
                    "medicos",
                    "diretoria",
                    "enfermagem",
                    "sondas",
                  ].map((valor) => (
                    <SelectItem key={valor} value={valor}>
                      {valor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissões padrão</Label>
              <p className="text-xs text-muted-foreground">
                Edição de Ramais é individual e só pode ser concedida a administradores.
              </p>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
                {[...MODULOS]
                  .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"))
                  .map((modulo) => (
                    <label className="flex items-center gap-2 text-sm" key={modulo.chave}>
                      <Checkbox
                        disabled={modulo.chave === "ramais_editar"}
                        checked={editarModulos.includes(modulo.chave)}
                        onCheckedChange={(marcado) =>
                          setEditarModulos((atuais) =>
                            marcado
                              ? [...new Set([...atuais, modulo.chave])]
                              : atuais.filter((atual) => atual !== modulo.chave),
                          )
                        }
                      />
                      {modulo.rotulo}
                    </label>
                  ))}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={cancelarEdicao}>
                Cancelar
              </Button>
              <Button disabled={atualizar.isPending} onClick={() => atualizar.mutate()}>
                <Pencil className="mr-1.5 size-4" />
                {atualizar.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
