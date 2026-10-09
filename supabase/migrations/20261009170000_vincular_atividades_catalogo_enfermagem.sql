-- Cada linha do cronograma aponta para uma atividade cadastrada na lista reutilizável.
alter table public.atividades_enfermagem
  add column if not exists catalogo_id bigint references public.atividades_enfermagem_catalogo(id) on delete restrict;

-- Vincula registros atuais pelo nome preservando o título já armazenado.
update public.atividades_enfermagem semanal
set catalogo_id = catalogo.id
from public.atividades_enfermagem_catalogo catalogo
where semanal.catalogo_id is null
  and btrim(semanal.titulo) = catalogo.titulo;

alter table public.atividades_enfermagem
  alter column catalogo_id set not null;

create index if not exists atividades_enfermagem_catalogo_id_idx
  on public.atividades_enfermagem (catalogo_id);
