-- Preferências visuais do Bloco de Notas.
-- São opcionais para preservar todas as notas já existentes.
alter table public.notas
  add column if not exists cor text not null default 'padrao',
  add column if not exists fonte text not null default 'padrao',
  add column if not exists urgente boolean not null default false;

alter table public.notas
  drop constraint if exists notas_cor_valida;
alter table public.notas
  add constraint notas_cor_valida check (cor in ('padrao', 'azul', 'verde', 'amarela', 'vermelha', 'roxa'));

alter table public.notas
  drop constraint if exists notas_fonte_valida;
alter table public.notas
  add constraint notas_fonte_valida check (fonte in ('padrao', 'serifada', 'monoespaco', 'manuscrita'));
