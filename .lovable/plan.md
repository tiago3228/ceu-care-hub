# Exportar a escala semanal em JPEG ou planilha

## Objetivo
Na página da Escala semanal, adicionar dois botões no topo da grade:

1. **Exportar JPEG** — gera uma imagem da escala da semana exibida (dias, salas, médicos, colaboradoras e horários), pronta para imprimir ou enviar por WhatsApp/e-mail.
2. **Exportar planilha** — baixa um arquivo `.xlsx` (Excel) com a escala da semana: data, dia da semana, sala, médico, colaboradoras, horário início/fim, observações e status de compatibilidade.

## Como vai funcionar

### Botões na página `escala.tsx`
- Dois botões com ícones (`ImageDown` e `FileSpreadsheet`) ao lado dos controles de semana.
- Ficam desabilitados enquanto os dados da semana estão carregando ou quando a semana está vazia.
- Exportam sempre a semana atualmente exibida (segue a navegação de semanas).

### Exportar planilha (.xlsx)
- Biblioteca `xlsx` (SheetJS, client-side — sem servidor).
- Uma aba "Escala" com cabeçalho: Data, Dia da semana, Sala, Médico, Colaboradoras, Início, Fim, Observações, Status.
- Datas formatadas em DD/MM/AAAA; colaboradoras separadas por vírgula.
- Nome do arquivo: `escala-semana-AAAA-MM-DD.xlsx` (segunda-feira da semana).

### Exportar JPEG
- Biblioteca `html-to-image` (client-side).
- A grade da semana ganha uma `ref` no container; o botão captura esse elemento e gera um JPEG com fundo claro e escala 2x para boa nitidez.
- Nome do arquivo: `escala-semana-AAAA-MM-DD.jpg`.

## Detalhes técnicos
- Somente frontend: `src/routes/_authenticated/escala.tsx` + novo helper `src/lib/exportar-escala.ts`.
- Dependências novas: `xlsx`, `html-to-image` (instaladas via bun).
- Sem mudanças em banco, RLS ou regras de negócio.
- Validação: abrir a escala com a sessão de teste no Playwright, clicar nos dois botões e conferir que os arquivos são gerados (download interceptado) sem erros de console.
