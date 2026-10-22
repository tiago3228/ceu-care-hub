-- Fecha as duas falhas de segurança apontadas pela verificação:
-- 1) escalas_enfermagem: policies existentes (tem_modulo/pode_editar) não eram
--    aplicadas porque o RLS estava desativado. Basta ativá-lo.
-- 2) estoque_pendencias: sem RLS e sem policies. Policies criadas no mesmo
--    padrão da tabela lotes (módulo "estoque"), apenas para authenticated.

ALTER TABLE public.escalas_enfermagem ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.estoque_pendencias ENABLE ROW LEVEL SECURITY;

-- Ninguém usa o app anonimamente: o acesso é sempre autenticado.
REVOKE ALL ON public.escalas_enfermagem FROM anon;
REVOKE ALL ON public.estoque_pendencias FROM anon;

CREATE POLICY estoque_pendencias_select
  ON public.estoque_pendencias
  FOR SELECT
  TO authenticated
  USING (tem_modulo(auth.uid(), 'estoque'::text));

CREATE POLICY estoque_pendencias_insert
  ON public.estoque_pendencias
  FOR INSERT
  TO authenticated
  WITH CHECK (pode_editar(auth.uid(), 'estoque'::text));

CREATE POLICY estoque_pendencias_update
  ON public.estoque_pendencias
  FOR UPDATE
  TO authenticated
  USING (pode_editar(auth.uid(), 'estoque'::text))
  WITH CHECK (pode_editar(auth.uid(), 'estoque'::text));

CREATE POLICY estoque_pendencias_delete
  ON public.estoque_pendencias
  FOR DELETE
  TO authenticated
  USING (pode_editar(auth.uid(), 'estoque'::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_pendencias TO authenticated;
GRANT SELECT ON public.escalas_enfermagem TO authenticated;
GRANT ALL ON public.escalas_enfermagem, public.estoque_pendencias TO service_role;