-- Formatação adicional para o Bloco de Notas.
-- Os valores padrão preservam o visual das notas existentes.
alter table public.notas
  add column if not exists tamanho_fonte text not null default 'medio',
  add column if not exists negrito boolean not null default false,
  add column if not exists italico boolean not null default false,
  add column if not exists sublinhado boolean not null default false;

alter table public.notas
  drop constraint if exists notas_tamanho_fonte_valido;
alter table public.notas
  add constraint notas_tamanho_fonte_valido
  check (tamanho_fonte in ('pequeno', 'medio', 'grande', 'muito_grande'));
