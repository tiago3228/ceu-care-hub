-- Permite destacar notas importantes no topo do Bloco de Notas.
-- O valor padrão mantém todas as notas existentes como não fixadas.
alter table public.notas
  add column if not exists fixada boolean not null default false;

create index if not exists notas_created_by_fixada_idx
  on public.notas (created_by, fixada desc, data_criacao desc, id desc);
