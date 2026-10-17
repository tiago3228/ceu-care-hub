-- Vincula materiais que chegaram com medico_id nulo usando os nomes presentes
-- nas pastas e nos arquivos originais. O que não for identificado permanece em Outros.
with candidatos as (
  select
    material.id as material_id,
    medico.id as medico_id,
    row_number() over (
      partition by material.id
      order by
        case when split.segment = regexp_replace(split.segment, '\.[^.]+$', '') then 0 else 1 end,
        length(split.segment)
    ) as posicao
  from public.laudos_materiais material
  cross join lateral regexp_split_to_table(coalesce(material.caminho_origem, ''), '/') as split(segment)
  join public.medicos medico
    on public.normalizar_nome_medico_laudos(medico.nome) = public.normalizar_nome_medico_laudos(
      regexp_replace(
        regexp_replace(btrim(split.segment), '\.[^.]+$', ''),
        '^(ajuda|atalhos)\s+',
        '',
        'i'
      )
    )
  join public.laudos_medicos biblioteca on biblioteca.medico_id = medico.id
  where material.medico_id is null
)
update public.laudos_materiais material
set medico_id = candidatos.medico_id,
    atualizado_em = now()
from candidatos
where candidatos.material_id = material.id
  and candidatos.posicao = 1;
