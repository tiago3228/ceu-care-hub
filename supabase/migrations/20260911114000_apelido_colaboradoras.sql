-- Apelido curto usado nas escalas e exportações, preservando o nome civil completo.
alter table public.colaboradoras add column if not exists apelido text;
