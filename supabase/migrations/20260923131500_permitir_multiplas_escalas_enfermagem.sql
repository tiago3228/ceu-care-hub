-- A escala de enfermagem agora usa tabelas de relacionamento para várias colaboradoras.
-- A restrição antiga impedia mais de uma escala da mesma colaboradora no mesmo dia
-- e causava conflito ao preencher a segunda-feira ou mais de um procedimento.
alter table if exists public.escalas_enfermagem
drop constraint if exists escalas_enfermagem_colaboradora_dia_unique;
