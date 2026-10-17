# Análise assistiva por IA em Laudos

O editor em `SALAS > Laudos > Digitar laudos` exibe **Analisar com IA** na barra superior. A análise não é executada ao abrir ou salvar um documento. Antes do envio, a interface informa que o texto será encaminhado ao provedor externo e pede confirmação explícita.

## Integração e configuração

O servidor chama uma API compatível com **OpenAI Chat Completions**. Por padrão, usa o endpoint compatível do **Gemini API Free Tier**, sem cobrança dentro das quotas gratuitas. Também é possível apontar para outro provedor compatível. Para habilitar o recurso no ambiente de execução do projeto Lovable, configure os segredos no servidor (nunca no frontend):

- `LAUDOS_IA_API_KEY` — chave autorizada para essa integração; sem ela a função falha sem enviar conteúdo a qualquer provedor.
- `GEMINI_API_KEY` — alternativa para a chave do Gemini; usada quando `LAUDOS_IA_API_KEY` não estiver definida.
- `LAUDOS_IA_API_URL` — opcional; o padrão gratuito é `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`.
- `LAUDOS_IA_MODEL` — opcional; o padrão gratuito é `gemini-2.5-flash`.

Como fallback adicional, o servidor aceita `OPENAI_API_KEY` quando as chaves específicas não estiverem definidas.

**Atenção sobre privacidade:** a documentação do Gemini informa que, no Free Tier, o conteúdo pode ser usado para melhoria dos produtos. Não envie dados identificáveis de pacientes sem autorização institucional e sem validar a política de privacidade aplicável. O diálogo do sistema pede confirmação antes de cada envio.

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

1. Crie uma chave gratuita no [Google AI Studio](https://aistudio.google.com/apikey).
2. Configure `GEMINI_API_KEY` somente nos Secrets do ambiente servidor do Lovable.
3. Deixe `LAUDOS_IA_API_URL` e `LAUDOS_IA_MODEL` vazios para usar o padrão gratuito, ou configure ambos para outro endpoint compatível.
4. Publique/execute o projeto no ambiente Lovable; não presuma que esta configuração local equivale ao runtime hospedado.
5. Abra um laudo e confirme que o clique em **Analisar com IA** apenas abre o aviso, sem requisição ao provedor.
6. Cancele e confirme que nenhum conteúdo foi enviado.
7. Em um ambiente autorizado, confirme a análise e verifique resposta estruturada, timeout/erro e preservação byte-a-byte do conteúdo do editor antes/depois.
8. Teste com texto vazio, acima do limite, sessão sem permissão, médico fora da biblioteca e documento vinculado a outro médico.
