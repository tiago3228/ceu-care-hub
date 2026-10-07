-- Corrige o trigger de edição dos fornecedores e seus documentos.
-- Essas tabelas usam atualizado_em, enquanto touch_updated_at tenta acessar updated_at.
create or replace function public.touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_fornecedores_touch on public.fornecedores;
create trigger trg_fornecedores_touch
before update on public.fornecedores
for each row execute function public.touch_atualizado_em();

drop trigger if exists trg_fornecedor_documentos_touch on public.fornecedor_documentos;
create trigger trg_fornecedor_documentos_touch
before update on public.fornecedor_documentos
for each row execute function public.touch_atualizado_em();
