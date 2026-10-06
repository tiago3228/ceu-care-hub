# Lembretes

A aba **Lembretes** centraliza vencimentos, manutenções, autorizações, contratos, pagamentos, tarefas e outras pendências futuras. Cada lembrete possui título, descrição, categoria, data, hora, prioridade, recorrência, observações e preferências de popup/som.

## Privacidade e permissões

O usuário comum vê apenas seus próprios lembretes. A política RLS impede leitura, alteração e exclusão de registros de terceiros. Administradores têm acesso total; a permissão `lembretes_visualizar_todos` também pode liberar leitura geral. As permissões de adicionar, editar e excluir são independentes.

## Alertas

Quando o lembrete vence ou chega ao horário programado, o sistema mostra um aviso destacado no topo do aplicativo e pode abrir um popup automático. O popup pode ser dispensado durante a sessão. A preferência de som é salva em `profiles.preferencias_lembretes`; quando ativa, o navegador tenta reproduzir um sinal curto, respeitando bloqueios de autoplay do navegador.

## Recorrência e adiamento

Lembretes diários, semanais, mensais e anuais avançam para a próxima ocorrência ao serem concluídos. A recorrência personalizada usa o campo `recorrencia_dias`. O botão de adiamento registra o horário futuro e a operação na auditoria.

## Aplicação

Execute `supabase/migrations/20260911083000_lembretes.sql` no SQL Editor do Lovable antes de liberar a aba. Depois, atribua `lembretes` e as permissões específicas em **Usuários e permissões**.
