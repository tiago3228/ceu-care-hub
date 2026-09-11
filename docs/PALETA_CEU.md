# Paleta visual Clínica CEU

A paleta oficial informada para a marca foi aplicada aos tokens globais do design system, evitando alterações isoladas em componentes e mantendo a consistência em todo o aplicativo.

| Cor | HEX | Uso principal |
|---|---|---|
| Light Blue | `#00AEEF` | Ações primárias, foco, destaques e identidade ativa |
| Deep Blue-Purple | `#1D3589` | Sidebar, títulos institucionais e contraste de marca |
| Intermediate Blue | `#3B5BAA` | Navegação secundária, acentos e estados de apoio |
| White | `#FFFFFF` | Cards e superfícies claras |

Os valores foram convertidos para OKLCH nos tokens `:root` e `.dark`, preservando o padrão técnico já usado no arquivo `src/styles.css`. Os estados semânticos de sucesso, alerta e erro foram mantidos para não prejudicar a leitura operacional de escalas, estoque e monitoramento.

A alteração é global e abrange login, painel, menu lateral, botões, campos, cards, abas, tabelas, diálogos e demais componentes que usam os tokens semânticos do tema.
