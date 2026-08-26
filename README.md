# Clínica CEU Gestão

PROMPT MESTRE — TRANSFORMAÇÃO DO SISTEMA DESKTOP EM APLICAÇÃO WEB

PROJETO: GESTÃO DE SISTEMAS - CLÍNICA CEU

Estou anexando um arquivo ZIP contendo o projeto atual do meu sistema.

O sistema atual é uma aplicação desktop desenvolvida principalmente em Python + CustomTkinter/Tkinter, utilizando SQLite como banco de dados.

Quero transformar esse sistema desktop em uma aplicação WEB moderna, profissional, segura, multiusuário e acessível através de navegador.

IMPORTANTE: o ZIP anexado é a principal fonte de verdade sobre o sistema atual. Antes de modificar qualquer coisa, analise profundamente o código, banco de dados, telas, classes, funções, serviços, modelos, relacionamentos e regras de negócio existentes.

============================================================

1. OBJETIVO PRINCIPAL

============================================================

Transformar o atual:

Python

+

CustomTkinter/Tkinter

+

SQLite

+

Aplicação Windows local

em:

Aplicação Web

+

Frontend moderno

+

Backend/API seguro

+

PostgreSQL

+

Autenticação

+

Controle de permissões

+

Acesso multiusuário

+

Acesso por navegador

O sistema deverá ser acessível por computadores, notebooks, tablets e, quando possível, celulares.

O objetivo NÃO é simplesmente copiar visualmente as telas do programa antigo.

Quero uma EVOLUÇÃO WEB do sistema atual, preservando:

- funcionalidades;

- regras de negócio;

- relacionamentos;

- cálculos;

- validações;

- histórico;

- sugestões;

- conflitos;

- estoque;

- FEFO;

- enfermagem;

- rastreabilidade;

- sondas;

- escalas;

- permissões;

- demais comportamentos encontrados no projeto.

============================================================

2. REGRA MAIS IMPORTANTE — ANALISAR ANTES DE ALTERAR

============================================================

NÃO comece imediatamente recriando as telas.

Primeiro analise completamente o ZIP.

Leia e examine:

- código-fonte;

- banco SQLite;

- tabelas;

- relacionamentos;

- telas;

- classes;

- serviços;

- funções;

- modelos;

- consultas;

- regras de negócio;

- validações;

- exportações;

- permissões;

- configurações;

- funcionalidades de escala;

- funcionalidades de estoque;

- funcionalidades de enfermagem;

- funcionalidades de sondas.

Identifique também funcionalidades existentes no código que não estejam descritas neste prompt.

Se encontrar funcionalidades importantes que não foram mencionadas aqui, NÃO descarte essas funcionalidades.

Documente e preserve.

============================================================

3. PRIMEIRA FASE — DIAGNÓSTICO

============================================================

Antes de implementar a versão web, faça uma análise completa do projeto.

Apresente:

1. estrutura atual do projeto;

2. tecnologias utilizadas;

3. lista de telas;

4. lista de módulos;

5. lista de tabelas;

6. relacionamentos;

7. regras de negócio;

8. regras de validação;

9. regras da escala;

10. regras de estoque;

11. regras de enfermagem;

12. regras de sugestões;

13. regras de conflitos;

14. sistema de usuários;

15. sistema de permissões;

16. sistema de auditoria;

17. exportações;

18. dependências;

19. pontos críticos;

20. funcionalidades que precisam ser migradas;

21. funcionalidades que podem ser melhoradas.

Não apague ou substitua nada importante antes dessa análise.

============================================================

4. ARQUITETURA WEB

============================================================

A aplicação final deverá ser web.

Arquitetura conceitual:

NAVEGADOR

    ↓

FRONTEND WEB

    ↓

BACKEND / API

    ↓

POSTGRESQL

Pode utilizar a arquitetura disponível no Lovable, preferencialmente:

Frontend:

- React

- TypeScript

- Tailwind CSS

Banco:

- PostgreSQL

- Supabase PostgreSQL, se for a solução adequada

Autenticação:

- Supabase Auth ou solução equivalente segura

Storage:

- sistema de arquivos/storage adequado para anexos

A arquitetura deverá ser preparada para produção.

NÃO utilizar SQLite como banco final da aplicação web.

============================================================

5. MIGRAÇÃO DO BANCO

============================================================

O sistema atual utiliza:

SQLite

database/escala.db

Não quero perder os dados existentes.

Analise o banco atual e prepare uma estratégia de migração:

SQLite

    ↓

PostgreSQL

Preservar, quando possível:

- IDs;

- relacionamentos;

- escalas;

- médicos;

- colaboradoras;

- salas;

- especialidades;

- itens;

- materiais;

- medicamentos;

- procedimentos;

- configurações;

- histórico;

- demais dados.

Antes de qualquer alteração destrutiva, criar backup.

Não apagar o banco original.

============================================================

6. LOGIN

============================================================

Criar sistema de autenticação seguro.

Deve possuir:

- login;

- senha;

- logout;

- sessão;

- recuperação de acesso;

- usuário ativo/inativo.

Nunca armazenar senhas em texto puro.

============================================================

7. USUÁRIOS E PERMISSÕES

============================================================

O sistema atual possui usuários e permissões.

Preservar essa lógica.

Criar gerenciamento de usuários contendo:

- nome;

- login/e-mail;

- perfil;

- status;

- permissões.

Criar controle de acesso por módulo.

Possíveis perfis:

- Administrador;

- Administrador Master;

- Coordenação;

- Enfermagem;

- Secretaria;

- Visualização;

- outros perfis encontrados no sistema atual.

As permissões devem existir tanto no frontend quanto no backend.

Não adianta apenas esconder um botão.

Se o usuário não possuir permissão, a operação também deve ser bloqueada no backend.

============================================================

8. DASHBOARD

============================================================

Criar Dashboard moderno.

Título principal:

GESTÃO DE SISTEMAS

Abaixo:

CLÍNICA CEU

Não utilizar mais o título:

ESCALA CEU

O Dashboard deve mostrar indicadores como:

- colaboradoras ativas;

- médicos;

- salas;

- escalas;

- ausências;

- estoque;

- solicitações;

- enfermagem;

- alertas.

Os cards devem ser clicáveis.

Exemplo:

"3 colaboradores ausentes"

deve permitir clicar e visualizar:

- nome;

- setor;

- tipo de ausência;

- data inicial;

- data de retorno.

Também pode mostrar diretamente no Dashboard:

"Maria Silva — Férias — retorno 28/08/2026"

ou equivalente.

============================================================

9. ESCALA SEMANAL

============================================================

A escala é uma das funcionalidades mais importantes do sistema.

Preservar a lógica atual.

A escala deve permitir:

- semana;

- dia;

- sala;

- médico;

- colaboradoras;

- período;

- horários;

- observações.

Criar interface web extremamente fluida.

Deve possuir:

- semana anterior;

- próxima semana;

- dia anterior;

- próximo dia;

- escala base;

- clonar escala;

- visualizar grade;

- exportar;

- pesquisa;

- filtros.

============================================================

10. SUGESTÃO AUTOMÁTICA DE MÉDICOS

============================================================

Preservar a inteligência existente.

Quando uma sala for selecionada, o sistema deve sugerir médicos relacionados àquela sala.

Considerar os critérios existentes no projeto, como:

- médico cadastrado na sala;

- frequência histórica;

- dia da semana;

- histórico;

- outros critérios encontrados no código.

A sugestão deve ser usada para agilizar o trabalho.

IMPORTANTE:

SUGESTÃO NÃO É BLOQUEIO.

Se o sistema sugerir:

Dr. João

o usuário deve poder pesquisar e escolher:

Dr. Carlos

mesmo que Dr. Carlos não seja o médico normalmente associado àquela sala.

============================================================

11. SUGESTÃO DE COLABORADORAS

============================================================

Ao selecionar o médico, sugerir colaboradoras relacionadas a ele.

Considerar:

- médico padrão;

- colaboradoras favoritas;

- histórico;

- frequência;

- dia da semana;

- especialidade;

- treinamentos;

- ausência;

- conflitos;

- demais regras existentes.

Mas permitir pesquisa livre.

Ao começar a digitar o nome da colaboradora, devem aparecer TODAS as colaboradoras disponíveis para escolha.

Não limitar a pesquisa apenas às sugestões.

============================================================

12. REGRA IMPORTANTE — NÃO ALTERAR ESCOLHA DO USUÁRIO

============================================================

Se o usuário selecionar:

MÉDICO A

e depois selecionar uma colaboradora que normalmente trabalha com:

MÉDICO B

o sistema NÃO deve trocar automaticamente o médico para Médico B.

A escolha manual do usuário deve permanecer.

Pode mostrar um alerta:

"Esta colaboradora não está configurada como padrão para este médico. Deseja continuar?"

Botões:

CONTINUAR

CANCELAR

Se continuar:

Médico A permanece.

A colaboradora escolhida permanece.

A decisão manual do usuário prevalece.

============================================================

13. CONFLITOS DE ESCALA

============================================================

Detectar conflitos.

Médico:

Não permitir silenciosamente que o mesmo médico esteja em duas salas no mesmo horário.

Colaboradora:

Detectar se está em duas salas no mesmo horário.

Jornada:

Verificar horários.

Porém:

ALERTA NÃO SIGNIFICA NECESSARIAMENTE BLOQUEIO.

Quando a situação for administrativamente permitida, permitir que um usuário autorizado prossiga após confirmação.

============================================================

14. ESCALA BASE

============================================================

Preservar a funcionalidade:

ESCALA BASE

Permitir:

- criar;

- editar;

- visualizar;

- carregar;

- copiar para uma semana.

Nunca sobrescrever uma escala existente sem confirmação explícita.

============================================================

15. COLABORADORAS

============================================================

Criar gerenciamento completo de colaboradoras.

Preservar todos os campos encontrados no projeto atual.

Podem existir:

- nome;

- cargo;

- jornada;

- status;

- horário;

- setor;

- especialidades;

- secretaria;

- médico padrão;

- treinamentos;

- funções;

- observações;

- outros campos existentes.

Relacionamentos:

Colaboradora

→ Médicos

→ Treinamentos

→ Ausências

→ Banco de Horas

→ Escalas

============================================================

16. MÉDICOS

============================================================

CRUD completo.

Preservar os campos encontrados no sistema.

Incluindo, quando existentes:

- nome;

- apelido;

- CRM;

- especialidade principal;

- outras especialidades;

- procedimentos;

- observações;

- salas;

- colaboradoras favoritas.

============================================================

17. SALAS

============================================================

CRUD completo.

Preservar os campos existentes.

Relacionamentos:

Sala

→ Médicos

→ Colaboradoras

→ Aparelho de Ultrassom

============================================================

18. AUSÊNCIAS / FÉRIAS

============================================================

Criar módulo completo.

Permitir:

- cadastrar;

- editar;

- visualizar;

- filtrar;

- consultar;

- excluir conforme permissão.

Tipos:

- férias;

- ausência;

- atestado;

- outros tipos existentes.

A escala deve considerar essas informações.

O Dashboard deve mostrar quem está ausente.

============================================================

19. BANCO DE HORAS

============================================================

Preservar o módulo.

Permitir:

- visualizar saldo;

- registrar movimentações;

- calcular horas;

- visualizar histórico.

============================================================

20. TREINAMENTOS

============================================================

Preservar treinamentos.

Relacionar:

Colaboradora

+

Treinamento

+

Especialidade

+

Período

+

Instrutora

+

Status

Essas informações podem ser utilizadas nas sugestões da escala.

============================================================

21. MATERIAIS

============================================================

Criar gerenciamento de materiais.

A busca deve funcionar enquanto o usuário digita.

Exemplo:

digitando:

"compressa"

mostrar automaticamente:

- Compressa de gaze;

- Compressa estéril;

- outros materiais cadastrados.

Não exigir digitação do nome completo.

============================================================

22. ITENS / MATERIAIS / MEDICAMENTOS

============================================================

Preservar a estrutura atual.

Distinguir:

MATERIAL

MEDICAMENTO

Cada item pode possuir:

- código;

- nome;

- grupo;

- unidade;

- referência;

- ANVISA;

- custo;

- preço;

- ativo;

- controle de validade;

- outros campos encontrados no projeto.

============================================================

23. ESTOQUE / LOTES

============================================================

Criar módulo completo.

A tabela deve mostrar claramente:

- Produto;

- Lote;

- Validade;

- Quantidade;

- Localização;

- Data de entrada.

O nome do produto é obrigatório na visualização.

============================================================

24. DATA DE VALIDADE

============================================================

A interface deve utilizar padrão brasileiro:

DD-MM-AAAA

O usuário deve poder digitar apenas números.

Exemplo:

25082026

deve ser automaticamente formatado:

25-08-2026

Validar datas inválidas.

Internamente o banco pode utilizar:

YYYY-MM-DD

desde que a interface continue brasileira.

============================================================

25. ALERTA DE VENCIMENTO

============================================================

Criar configuração para definir quantos dias antes do vencimento o sistema deve alertar.

Exemplo:

30 dias.

Classificar:

NORMAL

PRÓXIMO DO VENCIMENTO

VENCIDO

Utilizar indicação visual.

Normal:

aparência padrão.

Próximo:

laranja.

Vencido:

vermelho.

O prazo deve ser configurável.

============================================================

26. FEFO

============================================================

Preservar:

FIRST EXPIRE, FIRST OUT

Exemplo:

Lote A — vence 10/09

Lote B — vence 20/09

Lote C — vence 05/10

O sistema sugere primeiro:

Lote A

============================================================

27. LOTE VENCIDO

============================================================

Bloquear utilização normal de lote vencido.

Mensagem:

"MATERIAL/MEDICAMENTO VENCIDO. Este lote não pode ser utilizado."

============================================================

28. SOLICITAÇÕES

============================================================

Permitir criar uma solicitação com vários itens.

Exemplo:

Compressa — 20

Luvas — 10

Seringa — 5

Status:

- Pendente;

- Parcialmente atendida;

- Atendida;

- Cancelada.

Permitir atendimento parcial.

Utilizar FEFO.

============================================================

29. ENFERMAGEM

============================================================

Criar módulo:

ENFERMAGEM

Submódulos:

- Pacientes;

- Atendimentos;

- Procedimentos;

- Relatórios;

- Sondas.

============================================================

30. PACIENTES

============================================================

Criar cadastro de pacientes.

Campos:

- nome;

- data de nascimento;

- prontuário;

- observações.

O prontuário deve ser criado automaticamente.

Começar:

1

2

3

4

5

...

Nunca duplicar.

============================================================

31. ATENDIMENTOS

============================================================

Permitir:

- novo atendimento;

- editar;

- visualizar;

- histórico;

- procedimento;

- profissional;

- sala;

- materiais;

- medicamentos;

- observações.

A busca de paciente não deve necessariamente ser obrigatória.

============================================================

32. PROCEDIMENTOS DE ENFERMAGEM

============================================================

Criar cadastro e edição de procedimentos.

Exemplo:

Biópsia hepática

Materiais associados:

- Compressa de gaze;

- Luvas;

- outros.

Quando o procedimento for selecionado, os materiais vinculados podem ser sugeridos automaticamente.

============================================================

33. CONSUMO DE MATERIAIS NA ENFERMAGEM

============================================================

Dentro do atendimento:

Materiais/Medicamentos Utilizados

Permitir:

- pesquisar item;

- selecionar;

- informar quantidade.

O sistema deve sugerir lote FEFO.

Ao salvar:

Atendimento

→ Material

→ Quantidade

→ Lote

→ Baixa do estoque

============================================================

34. RASTREABILIDADE

============================================================

Deve ser possível consultar:

Qual material foi usado?

Qual lote?

Em qual paciente?

Em qual atendimento?

Em qual procedimento?

Qual quantidade?

Qual data?

Quem registrou?

============================================================

35. SONDAS

============================================================

Criar módulo:

SONDAS

Com três controles.

CONTROLE 1:

Controle de desinfecção das sondas endocavitárias

Campos:

- Data;

- Protocolo;

- Nº da sonda;

- Horário início;

- Horário término;

- Assinatura;

- Observação.

Mostrar:

POP ENF 006 V03

CONTROLE 2:

Check-list troca do Rioscope - CUBA

Campos:

- Data da troca do produto;

- Próxima troca;

- Produto;

- Lote;

- Validade Rioscope;

- Responsável.

Mostrar:

POP ENF 006 V03

CONTROLE 3:

Controle teste da fita para eficácia da solução Rioscope Opa

Campos:

- Data do teste;

- Produto;

- Lote;

- Validade;

- Validade do produto na cuba;

- Responsável;

- Observação.

Mostrar:

POP ENF 006 V03

Esses três controles substituem planilhas manuais utilizadas atualmente.

============================================================

36. APARELHOS DE ULTRASSOM

============================================================

Preservar o cadastro atual.

Manter campos e relacionamentos encontrados no projeto.

Relacionar:

Sala

→ Aparelho

============================================================

37. BLOCO DE NOTAS

============================================================

Criar:

BLOCO DE NOTAS

Não utilizar mais:

"Bloco de notas da Marilia"

O módulo será utilizado por vários colaboradores.

Cada nota deverá guardar:

- título;

- conteúdo;

- criador;

- data;

- horário;

- data do lembrete;

- horário do lembrete;

- status.

Permitir:

- editar;

- excluir;

- visualizar.

O criador pode editar/excluir sua própria nota.

Administrador Master pode editar/excluir qualquer nota.

O horário deve possuir campo de entrada e controles para aumentar/diminuir o horário.

============================================================

38. SUGESTÕES

============================================================

Criar botão:

SUGESTÕES

Tela com:

Nome

Setor

Sugestão

O campo da sugestão não deve possuir limite artificial de caracteres.

Ao clicar:

ENVIAR

a sugestão deve ser salva.

O criador poderá:

- visualizar;

- editar;

- excluir sua própria sugestão.

Administrador Master poderá:

- visualizar;

- editar;

- excluir qualquer sugestão.

Objetivo:

utilizar as sugestões dos colaboradores como fonte de melhoria contínua.

============================================================

39. CONFIGURAÇÕES

============================================================

Criar:

CONFIGURAÇÕES

Permitir configurar:

- usuários;

- permissões;

- alertas;

- vencimentos;

- parâmetros;

- configurações encontradas no sistema atual.

============================================================

40. TELA SOBRE

============================================================

Em:

Configurações

→ Sobre

mostrar:

Sistema de Gestão - Clínica CEU

Desenvolvedor:

Tiago Cardoso

Ano de criação:

2026

WhatsApp:

(31) 97541-4498

Versão:

1.0.0

A versão deverá ser facilmente alterável futuramente.

============================================================

41. RELATÓRIOS

============================================================

Criar relatórios.

ESCALAS:

- por período;

- por médico;

- por colaboradora;

- por sala.

ESTOQUE:

- entradas;

- saídas;

- perdas;

- vencimentos;

- consumo.

ENFERMAGEM:

- atendimentos;

- procedimentos;

- materiais utilizados;

- medicamentos utilizados.

SONDAS:

- desinfecções;

- trocas;

- testes.

============================================================

42. EXPORTAÇÃO

============================================================

Sempre que fizer sentido:

- CSV;

- Excel;

- PDF;

- impressão.

Especialmente:

- escalas;

- relatórios;

- estoque;

- enfermagem;

- sondas.

============================================================

43. AUDITORIA

============================================================

O sistema deverá manter rastreabilidade.

Registrar:

- usuário;

- operação;

- tabela;

- registro;

- data/hora;

- valores anteriores;

- valores novos.

Especialmente em:

- estoque;

- lotes;

- movimentações;

- escalas;

- usuários;

- pacientes;

- enfermagem;

- sondas.

A auditoria deverá ser protegida.

Usuários comuns não poderão modificar ou apagar registros históricos de auditoria.

============================================================

44. SEGURANÇA

============================================================

Como o sistema poderá armazenar informações de pacientes e dados operacionais, implementar:

- HTTPS;

- autenticação;

- autorização;

- controle de sessão;

- proteção de rotas;

- validação backend;

- proteção contra SQL Injection;

- proteção contra manipulação de dados;

- controle de permissões;

- backups;

- logs;

- Row Level Security quando aplicável.

Não confiar apenas no frontend.

============================================================

45. CONCORRÊNCIA MULTIUSUÁRIO

============================================================

Vários usuários utilizarão o sistema simultaneamente.

Considerar:

- dois usuários editando a mesma escala;

- dois usuários consumindo o mesmo lote;

- dois usuários atendendo a mesma solicitação;

- atualizações simultâneas.

Operações críticas deverão utilizar transações.

Estoque nunca deve ficar negativo por causa de concorrência.

============================================================

46. DESIGN

============================================================

Criar uma interface:

- profissional;

- moderna;

- limpa;

- rápida;

- intuitiva;

- responsiva.

Identidade:

GESTÃO DE SISTEMAS

CLÍNICA CEU

Evitar excesso de cores.

Utilizar cores para estados:

Verde = normal

Laranja = atenção

Vermelho = vencido/erro

Azul = informação

============================================================

47. RESPONSIVIDADE

============================================================

Funcionamento em:

- Desktop;

- Notebook;

- Tablet;

- Celular.

No celular:

- menu responsivo;

- tabelas adaptadas;

- cards quando necessário;

- formulários responsivos.

Desktop continuará sendo o principal ambiente de trabalho.

============================================================

48. EXPERIÊNCIA DE USO

============================================================

A aplicação atual é utilizada diariamente.

FLUIDEZ É PRIORIDADE.

Evitar:

- telas desnecessárias;

- carregamentos longos;

- páginas recarregando sem necessidade;

- formulários excessivamente complexos.

Utilizar:

- busca instantânea;

- autocomplete;

- filtros;

- pesquisa;

- atalhos;

- modais quando apropriado;

- feedback visual;

- atualizações sem recarregar toda a página quando possível.

============================================================

49. ESCALA — EXPERIÊNCIA PRIORITÁRIA

============================================================

A montagem da escala deve ser muito rápida.

Fluxo ideal:

Sala

↓

Médico sugerido

↓

Colaboradoras sugeridas

↓

Usuário confirma ou altera

↓

Salvar

Sempre permitindo escolhas manuais.

============================================================

50. DASHBOARD INTERATIVO

============================================================

Indicadores devem ser clicáveis.

Exemplo:

3 colaboradores ausentes

Ao clicar:

Maria Silva — Férias — retorno 28/08

Joana Silva — Atestado — retorno 30/08

Ana Silva — Ausência — retorno 26/08

============================================================

51. NOTIFICAÇÕES

============================================================

Criar notificações para:

- ausências;

- vencimentos;

- solicitações;

- lembretes;

- conflitos;

- alertas de estoque.

============================================================

52. MODELO DE DADOS

============================================================

Criar um modelo relacional baseado no banco atual.

Entidades principais esperadas:

users

roles

permissions

collaborators

doctors

specialties

rooms

ultrasound_devices

schedules

schedule_base

schedule_collaborators

absences

vacations

trainings

bank_hours

items

materials

medications

lots

stock_movements

requests

request_items

patients

nursing_attendances

procedures

procedure_materials

attendance_materials

probe_disinfection

rioscope_changes

rioscope_tests

notes

suggestions

audit_logs

settings

IMPORTANTE:

Não crie tabelas simplesmente porque foram listadas acima se o código atual possuir outra estrutura mais adequada.

Analise primeiro o banco existente.

Adapte o modelo web preservando os relacionamentos atuais.

============================================================

53. TRANSAÇÕES DE ESTOQUE

============================================================

Operações de estoque devem ser transacionais.

Exemplo:

Atendimento

↓

Consumo

↓

Baixa do lote

↓

Movimentação registrada

Tudo deve ser consistente.

============================================================

54. DADOS DE PACIENTES

============================================================

Dados de pacientes devem ser protegidos.

Controlar:

- quem visualiza;

- quem cria;

- quem edita;

- quem exclui.

Quando possível utilizar arquivamento/soft delete para informações importantes em vez de exclusão física.

============================================================

55. NÃO FAZER

============================================================

NÃO:

- apagar funcionalidades existentes sem análise;

- simplificar regras de negócio importantes;

- substituir regras por mockups;

- criar apenas telas sem backend;

- criar apenas frontend;

- perder dados;

- descartar banco existente;

- usar SQLite como banco final;

- transformar sugestões em bloqueios;

- alterar automaticamente escolhas manuais;

- permitir estoque negativo;

- permitir utilização de lote vencido;

- permitir alteração da auditoria;

- colocar permissões apenas no frontend;

- inventar dados reais;

- criar funcionalidades falsas apenas para parecer que funcionam.

============================================================

56. FASE 0 — ANÁLISE

============================================================

Antes de implementar:

1. analisar ZIP;

2. analisar código;

3. analisar banco;

4. analisar telas;

5. identificar tabelas;

6. identificar relacionamentos;

7. identificar regras;

8. identificar funcionalidades adicionais;

9. identificar riscos;

10. apresentar diagnóstico.

============================================================

57. FASE 1 — ARQUITETURA

============================================================

Apresentar:

- arquitetura frontend;

- arquitetura backend;

- banco;

- autenticação;

- storage;

- permissões;

- segurança;

- estratégia de migração;

- modelo de dados;

- estratégia de deploy.

============================================================

58. FASE 2 — MIGRAÇÃO

============================================================

Criar estratégia:

SQLite

↓

PostgreSQL

Validar:

- quantidade de registros;

- IDs;

- relacionamentos;

- dados críticos.

============================================================

59. FASE 3 — IMPLEMENTAÇÃO

============================================================

Implementar preferencialmente nesta ordem:

1. Autenticação

2. Usuários e permissões

3. Dashboard

4. Colaboradoras

5. Médicos

6. Salas

7. Ausências/Férias

8. Escala

9. Escala Base

10. Materiais

11. Itens

12. Estoque/Lotes

13. Solicitações

14. Pacientes

15. Procedimentos

16. Enfermagem

17. Sondas

18. Aparelhos

19. Bloco de Notas

20. Sugestões

21. Relatórios

22. Configurações

23. Auditoria

A ordem pode ser alterada se a análise técnica mostrar uma dependência diferente.

============================================================

60. TESTES

============================================================

Após cada módulo testar:

- criação;

- edição;

- consulta;

- pesquisa;

- filtros;

- permissões;

- validações;

- erros;

- concorrência;

- banco.

ESCALA:

Sala

→ Médico

→ Colaboradora

→ Sugestão

→ Conflito

→ Salvamento

ESTOQUE:

Produto

→ Lote

→ Validade

→ FEFO

→ Solicitação

→ Atendimento

→ Baixa

→ Auditoria

ENFERMAGEM:

Paciente

→ Atendimento

→ Procedimento

→ Material

→ Lote

→ Consumo

→ Rastreabilidade

SONDAS:

Registro

→ Salvamento

→ Consulta

→ Edição

→ Histórico

============================================================

61. CRITÉRIO DE CONCLUSÃO

============================================================

Uma funcionalidade só deve ser considerada concluída quando estiver funcionando:

Interface

+

Backend

+

Banco

+

Regra de negócio

+

Validação

+

Permissão

+

Teste

Não considere uma tela concluída apenas porque ela aparece visualmente.

============================================================

62. RELATÓRIO DE CADA FASE

============================================================

Após cada fase informe:

FASE:

O que foi implementado:

Arquivos/áreas alteradas:

Banco alterado:

Regras implementadas:

Testes realizados:

Problemas encontrados:

Pendências:

Próxima fase:

============================================================

63. PRINCÍPIO FUNDAMENTAL

============================================================

O ZIP anexado é a fonte de verdade do sistema atual.

Este prompt representa os requisitos conhecidos.

Se o código ou banco revelar:

- uma regra;

- uma funcionalidade;

- uma tabela;

- um relacionamento;

- uma validação;

- uma integração;

que não esteja explicitamente descrita neste prompt, NÃO descarte.

Analise, documente e preserve quando fizer parte da lógica atual.

============================================================

64. RESULTADO FINAL

============================================================

Quero transformar o sistema atual em:

GESTÃO DE SISTEMAS

CLÍNICA CEU

Uma plataforma web profissional, centralizada e multiusuário para:

ESCALAS

+

COLABORADORAS

+

MÉDICOS

+

SALAS

+

AUSÊNCIAS

+

BANCO DE HORAS

+

TREINAMENTOS

+

MATERIAIS

+

MEDICAMENTOS

+

ESTOQUE

+

LOTES

+

FEFO

+

SOLICITAÇÕES

+

ENFERMAGEM

+

PACIENTES

+

PROCEDIMENTOS

+

RASTREABILIDADE

+

SONDAS

+

APARELHOS DE ULTRASSOM

+

BLOCO DE NOTAS

+

SUGESTÕES

+

RELATÓRIOS

+

CONFIGURAÇÕES

+

USUÁRIOS

+

PERMISSÕES

+

AUDITORIA

A nova aplicação deve ser uma EVOLUÇÃO do sistema atual, não uma reconstrução superficial.

============================================================

65. INSTRUÇÃO FINAL

============================================================

COMECE PELA ANÁLISE DO ZIP.

NÃO faça uma implementação completa imediatamente.

Primeiro:

1. leia o projeto;

2. leia o banco;

3. identifique os módulos;

4. identifique as regras;

5. identifique os relacionamentos;

6. identifique funcionalidades adicionais;

7. proponha a arquitetura;

8. proponha o modelo de dados;

9. apresente a estratégia de migração;

10. apresente os riscos.

Depois disso, implemente por fases.

PRIORIDADE ABSOLUTA:

1. PRESERVAR OS DADOS;

2. PRESERVAR AS REGRAS DE NEGÓCIO;

3. PRESERVAR A LÓGICA DA ESCALA;

4. PRESERVAR A INTEGRAÇÃO DO ESTOQUE;

5. PRESERVAR A RASTREABILIDADE DA ENFERMAGEM;

6. PRESERVAR OS CONTROLES DE SONDAS;

7. GARANTIR SEGURANÇA;

8. GARANTIR MULTIUSUÁRIO;

9. GARANTIR PERFORMANCE;

10. DEPOIS MELHORAR A INTERFACE.

Não quero uma aplicação que apenas pareça bonita.

Quero que o sistema realmente funcione como uma evolução web do programa que já utilizamos na Clínica CEU.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ceu-care-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8eebff10-cf7a-4ff9-b718-081e6b942201).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
