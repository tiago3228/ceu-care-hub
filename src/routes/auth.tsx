import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { criarPrimeiroAdmin, existeAdmin, listarSetoresPublicos } from "@/lib/admin.functions";
import { criarContaPublica, resolverLogin } from "@/lib/auth-account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | Gestão de Sistemas - Clínica CEU" },
      {
        name: "description",
        content:
          "Acesso restrito ao sistema de gestão da Clínica CEU: escalas, estoque e enfermagem.",
      },
      { property: "og:title", content: "Entrar | Gestão de Sistemas - Clínica CEU" },
      {
        property: "og:description",
        content: "Acesso restrito da equipe ao sistema de gestão da Clínica CEU.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaAuth,
});

const schema = z.object({
  login: z.string().trim().min(1, "Informe seu usuário ou e-mail").max(255),
  senha: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72),
});

function PaginaAuth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [nome, setNome] = useState("");
  const [cadastro, setCadastro] = useState(false);
  const [username, setUsername] = useState("");
  const [setor, setSetor] = useState("");
  const setores = useQuery({
    queryKey: ["setores-publicos"],
    queryFn: () => listarSetoresPublicos(),
  });
  const [carregando, setCarregando] = useState(false);
  const admin = useQuery({ queryKey: ["existe-admin"], queryFn: () => existeAdmin() });
  const primeiroAcesso = admin.data?.existe === false;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (cadastro) {
      setCarregando(true);
      try {
        const conta = await criarContaPublica({ data: { nome, username, setor, email, senha } });
        if (!conta.cadastroAutomatico) {
          toast.success("Cadastro realizado. Aguarde a aprovação do administrador.");
          setCadastro(false);
          return;
        }
        const login = await supabase.auth.signInWithPassword({ email, password: senha });
        if (login.error) throw login.error;
        toast.success("Conta criada. Bem-vindo!");
        navigate({ to: "/dashboard", replace: true });
      } catch (erro) {
        toast.error(erro instanceof Error ? erro.message : "Não foi possível criar a conta.");
      } finally {
        setCarregando(false);
      }
      return;
    }
    const parsed = schema.safeParse({ login: email, senha });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setCarregando(true);
    try {
      if (primeiroAcesso) {
        await criarPrimeiroAdmin({
          data: {
            email: email.trim().toLowerCase(),
            senha: parsed.data.senha,
            nome: nome.trim() || (email.split("@")[0] ?? "Administrador"),
          },
        });
        const login = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: parsed.data.senha,
        });
        if (login.error) throw login.error;
        toast.success("Administrador master criado. Bem-vindo!");
      } else {
        const resolvido = await resolverLogin({ data: { login: parsed.data.login } });
        const { error } = await supabase.auth.signInWithPassword({
          email: resolvido.email,
          password: parsed.data.senha,
        });
        if (error) throw error;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : "Não foi possível entrar";
      toast.error(msg.includes("Invalid login credentials") ? "E-mail ou senha incorretos." : msg);
    } finally {
      setCarregando(false);
    }
  }

  async function recuperar() {
    const parsed = z.string().email().safeParse(email.trim());
    if (!parsed.success) {
      toast.error("Informe seu e-mail para receber o link de redefinição.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link de redefinição para seu e-mail.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div>
          <p className="font-display text-sm uppercase tracking-[0.2em] text-sidebar-primary">
            Clínica CEU
          </p>
          <h2 className="mt-6 max-w-md font-display text-3xl font-semibold leading-tight">
            Gestão de escalas, estoque e enfermagem em um só lugar.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-sidebar-foreground/70">
            Escala semanal com sugestões inteligentes, controle de lotes por validade (FEFO) e
            rastreabilidade completa dos atendimentos.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-sidebar-foreground/70">
          <li>• Histórico e auditoria de cada alteração</li>
          <li>• Permissões por módulo e por perfil</li>
          <li>• Dados migrados do sistema atual</li>
        </ul>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={enviar} className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-foreground">
            {primeiroAcesso ? "Primeiro acesso" : cadastro ? "Criar usuário" : "Entrar"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {primeiroAcesso
              ? "Crie a conta do administrador master do sistema."
              : cadastro
                ? "Sua conta será criada com as permissões padrão do setor."
                : "Use seu usuário ou e-mail e sua senha."}
          </p>

          <div className="mt-7 space-y-4">
            {(primeiroAcesso || cadastro) && (
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={120}
                  placeholder="Ex.: Ana Souza"
                />
              </div>
            )}
            {cadastro && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Usuário</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder="Ex.: joao.silva"
                    maxLength={40}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="setor">Setor</Label>
                  <select
                    id="setor"
                    value={setor}
                    onChange={(e) => setSetor(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    required
                  >
                    <option value="">
                      {setores.isLoading
                        ? "Carregando setores..."
                        : setores.isError
                          ? "Não foi possível carregar setores"
                          : "Selecione o setor"}
                    </option>
                    {(setores.data ?? []).map((s) => (
                      <option key={s.id} value={s.nome}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{cadastro ? "E-mail" : "Usuário ou e-mail"}</Label>
              <Input
                id="email"
                type="text"
                autoComplete="username"
                placeholder={cadastro ? "seu.email@empresa.com" : "Ex.: admin ou seu e-mail"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete={primeiroAcesso || cadastro ? "new-password" : "current-password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  maxLength={72}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                >
                  {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button type="submit" className="mt-6 w-full" disabled={carregando}>
            {carregando
              ? "Aguarde..."
              : primeiroAcesso
                ? "Criar acesso"
                : cadastro
                  ? "Criar usuário"
                  : "Entrar"}
          </Button>

          {!primeiroAcesso && !cadastro && (
            <button
              type="button"
              onClick={recuperar}
              className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Esqueci minha senha
            </button>
          )}

          {!primeiroAcesso && (
            <button
              type="button"
              onClick={() => setCadastro((v) => !v)}
              className="mt-3 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {cadastro ? "Já tenho uma conta" : "Criar Usuário"}
            </button>
          )}

          <p className="mt-8 text-xs text-muted-foreground">
            Por segurança, as senhas do sistema anterior não foram migradas. Cada usuário define uma
            nova senha no primeiro acesso.
          </p>
        </form>
      </div>
    </div>
  );
}
