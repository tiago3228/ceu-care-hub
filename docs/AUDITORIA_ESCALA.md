# Permissões e cadastro da escala

Foram separadas as permissões de escala em `escalas_visualizar` (**Visualizar Escala**) e `escalas_editar` (**Editar Escala**). A permissão legada `escalas` continua válida para preservar acessos existentes. Usuários com o perfil `secretaria` ou `visualizacao` não recebem os controles de criar, editar, excluir ou gerar pela base; a regra também é validada no backend, não apenas na interface.

O cadastro de Colaboradoras recebeu o tipo **Recepção**, permitindo cadastrar funcionários da recepção com nome, cargo, jornada, horários, treinamentos, especialidades, vínculos com médicos e demais campos existentes. O tipo é utilizado pelas sugestões da escala como os demais tipos de colaborador.

## Configuração recomendada

Para secretárias, atribuir o perfil **Secretaria** e a permissão **Visualizar Escala**. Não atribuir **Editar Escala**. Para coordenadores ou administradores responsáveis pela montagem, atribuir **Editar Escala**.

## Perfis funcionais

O cadastro de usuários passou a aceitar os perfis **Recepção**, **Marcação**, **Comercial**, **Qualidade**, **RH**, **Manutenção**, **Médicos** e **Diretoria**, além dos perfis existentes. A migration `20260910171500_perfis_funcionais.sql` deve ser executada no SQL Editor do Lovable antes de cadastrar usuários com esses perfis.
