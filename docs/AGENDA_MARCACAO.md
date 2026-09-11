# Minha Agenda de Marcação

A Minha Agenda é um complemento pessoal ao Clinux para acompanhamento de pacientes pendentes, contatos, autorizações, retornos e lembretes. Cada registro possui proprietário (`user_id`/`created_by`) e não é compartilhado entre usuários comuns.

## Segurança

A migration `20260911082000_agenda_marcacao.sql` aplica RLS no banco. Usuários comuns só podem consultar, inserir, editar e excluir registros próprios, conforme suas permissões. Administradores podem consultar, editar e excluir registros de todas as agendas. A tela também filtra os registros e oferece o filtro de colaborador somente para administradores.

## Permissões

Atribuir `agenda_marcacao` para visualizar a agenda. Atribuir, conforme a função, `agenda_marcacao_adicionar`, `agenda_marcacao_editar`, `agenda_marcacao_excluir` e `agenda_marcacao_relatorios`. A aplicação nunca substitui as políticas RLS.

## Funcionalidades

A tela oferece calendário mensal responsivo, resumo por status, pesquisa instantânea por paciente/telefone/exame/observação/convênio/médico, filtros por status e unidade, cadastro de campos obrigatórios e complementares, lembretes, abertura do WhatsApp com mensagem editável e registro de auditoria para criação, edição, exclusão e acionamento do WhatsApp.

## Aplicação

Executar a migration no SQL Editor do Lovable antes de liberar o módulo para os usuários. Depois, atribuir o módulo e as permissões específicas em Usuários e permissões.
