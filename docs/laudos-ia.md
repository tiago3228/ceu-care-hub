# Análise assistiva por IA em Laudos

O editor em `SALAS > Laudos > Digitar laudos` exibe **Analisar com IA** na barra superior. A análise não é executada ao abrir ou salvar um documento. Antes do envio, a interface informa que o texto será encaminhado ao provedor externo e pede confirmação explícita.

## Integração e configuração

O servidor chama a API de chat completions da OpenAI. Para habilitar o recurso no ambiente de execução do projeto Lovable, configure os segredos no servidor (nunca no frontend):

- `LAUDOS_IA_API_KEY` — chave autorizada para essa integração; sem ela a função falha sem enviar conteúdo a qualquer provedor.
- `LAUDOS_IA_MODEL` — opcional; modelo compatível com Chat Completions e saída JSON. O padrão no código é `gpt-4o-mini`.

A configuração desses segredos e a autorização organizacional para o provedor devem ser feitas pelo responsável pelo projeto no ambiente Lovable. Não inclua os segredos em `.env` versionado, commits, código cliente ou logs. A integração não está habilitada apenas por esta alteração no repositório; a disponibilidade real depende de configurar os segredos e validar o runtime do projeto.

## Proteções implementadas

- A função de servidor exige sessão Supabase válida e permissão `salas`.
- Confere se o médico está na biblioteca e se o documento, quando salvo, pertence ao médico informado, sob as políticas RLS atuais.
- Limita o texto enviado a 20.000 caracteres e aplica timeout de 45 segundos.
- Envia ao modelo somente o texto digitado, sem título, identificadores, metadados adicionais ou contexto paciente separado.
- Não grava a solicitação nem a resposta, e não registra o conteúdo clínico em logs próprios.
- Valida o formato da resposta no servidor antes de devolver ao navegador.
- A resposta aparece em diálogo separado e nunca altera, substitui ou salva o laudo.

Embora nenhum identificador seja enviado no payload do provedor, o texto do laudo pode conter dados pessoais ou de saúde. O usuário deve confirmar o envio somente se o provedor e o uso estiverem autorizados para o ambiente. O recurso é consultivo: o médico responsável deve revisar o laudo completo e definir o diagnóstico final.

## Verificação após configuração

1. Configure os segredos somente no ambiente servidor do Lovable.
2. Publique/execute o projeto no ambiente Lovable; não presuma que esta configuração local equivale ao runtime hospedado.
3. Abra um laudo e confirme que o clique em **Analisar com IA** apenas abre o aviso, sem requisição ao provedor.
4. Cancele e confirme que nenhum conteúdo foi enviado.
5. Em um ambiente autorizado, confirme a análise e verifique resposta estruturada, timeout/erro e preservação byte-a-byte do conteúdo do editor antes/depois.
6. Teste com texto vazio, acima do limite, sessão sem permissão, médico fora da biblioteca e documento vinculado a outro médico.
