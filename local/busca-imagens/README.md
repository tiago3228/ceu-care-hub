# Auxiliar local — Buscar imagens

Este auxiliar permite que a tela **Rede → Buscar imagens** consulte, diretamente do navegador, os índices SQLite dos servidores `192.168.0.249` e `192.168.0.174`. O auxiliar roda no computador Windows do usuário, consulta os dois bancos em modo somente leitura e devolve os resultados diretamente ao navegador. Nome, prontuário, data, resultado e caminho do exame não passam por funções ou tabelas do portal. A única chamada externa do auxiliar é para validar a sessão e a permissão do usuário com Supabase; ela não contém filtros nem resultados clínicos.

O auxiliar não é um serviço do Windows nem roda como administrador. Inicie-o na sessão do usuário com acesso aos compartilhamentos SMB. Assim, usa as permissões de rede já disponíveis no Windows e não armazena senhas. Ele escuta apenas em `127.0.0.1`; não abra porta no firewall nem o exponha na LAN.

## Pré-requisitos

- Windows 10/11 com Python 3 e o launcher `py.exe`.
- A estação deve conseguir ler, com a conta Windows atual, os dois arquivos `dicomfinder.db` e as pastas de exames nos compartilhamentos dos servidores.
- Compartilhe somente as pastas necessárias, com leitura para quem pesquisa. Não compartilhe a unidade inteira nem use `C$`.
- Navegador Chromium atualizado. O primeiro acesso pode mostrar o prompt de permissão de rede local; permita-o somente para o domínio autorizado do portal.
- Na configuração, use a URL HTTPS exata do portal e a chave Supabase pública (`publishable`/`anon`). Nunca coloque uma chave `service_role` neste computador.

## Instalação

1. Copie a pasta `local/busca-imagens` para a estação Windows ou baixe os arquivos do repositório.
2. Abra PowerShell nessa pasta e execute `powershell -ExecutionPolicy Bypass -File .\instalar-auxiliar.ps1`.
3. Edite `%LOCALAPPDATA%\CEU\BuscaImagens\config.json`.
4. Preencha `allowed_origins` com apenas a origem do portal, por exemplo `https://portal.sua-clinica.com` — sem barra final e sem caminho.
5. Preencha `supabase_url` e `supabase_publishable_key` com os valores públicos já usados pelo portal.
6. No Explorer de cada servidor, localize a pasta do aplicativo `APLICATIVO DE BUSCAR DICOM` — a pasta onde está `run_app2.bat`. O BAT muda o diretório de trabalho para a própria pasta e o código usa `dicomfinder.db` por caminho relativo. Compartilhe essa pasta com leitura (somente leitura para a estação) usando o nome de compartilhamento `indice`. Se usar outro nome, ajuste `database_path` no JSON. Com `indice`, os caminhos do exemplo são `\\192.168.0.249\indice\dicomfinder.db` e `\\192.168.0.174\indice\dicomfinder.db`.
7. Os caminhos de imagens usam os compartilhamentos confirmados: no `.174`, `G:\WTT\Storage\dicom` → `\\192.168.0.174\dicom`; no `.249`, `D:\LEGADO` → `\\192.168.0.249\legado` e `E:\LEGADO` → `\\192.168.0.249\legado2`.
8. Na estação, confirme no Explorer que os caminhos de índice e as três pastas de imagem abrem com sua conta do Windows.
9. Execute `iniciar-auxiliar.bat` e mantenha a janela aberta enquanto usa o módulo.

Não informe senhas em `config.json`. Configure permissões SMB no Windows. O botão de abrir leva o Explorador do computador do usuário diretamente à pasta de origem do exame; ele não copia nem altera os DICOMs.

## Segurança e comportamento

- Conexão local somente em `127.0.0.1:8765`, sem escuta em IP de rede.
- Origem do portal comparada literalmente com `allowed_origins`; curingas são recusados.
- A cada busca e abertura, o auxiliar valida o JWT com Supabase Auth e verifica `tem_modulo(..., 'buscar_imagens')` usando a sessão do usuário. Essa validação leva somente o token de sessão e a chave de permissão ao Supabase, nunca os filtros ou resultados clínicos.
- Os bancos são abertos com `mode=ro` e `PRAGMA query_only=ON`; o auxiliar não migra, combina nem escreve nos índices.
- Os filtros são enviados por `POST`; o auxiliar desativa logs HTTP para não registrar nome, prontuário ou filtros.
- Resultados ficam apenas em memória no navegador e no auxiliar; os IDs temporários para abrir uma pasta expiram após 15 minutos.
- O navegador abre o Explorador local via auxiliar e caminho UNC mapeado; não navega diretamente para `file://` ou SMB.
- `modulo=buscar_imagens` precisa ser concedido a cada usuário autorizado na administração do portal. Administradores existentes já têm acesso por regra do sistema.

## Limitações a confirmar na clínica

O nome `indice` é o nome sugerido para compartilhar, não uma configuração que o instalador cria automaticamente. As pastas compartilhadas devem permitir apenas leitura e ficar acessíveis na estação. Os mapeamentos agora apontam D: para `\\192.168.0.249\legado` e E: para `\\192.168.0.249\legado2`; confirme que cada compartilhamento corresponde à raiz indexada. Se a raiz física for diferente, ajuste `unc_root` para que o caminho relativo do exame continue válido.

O servidor `.174` deve ter somente o índice de `G:\WTT\Storage\dicom`. Se um índice estiver indisponível, a pesquisa ainda retorna resultados do outro e apresenta um aviso; se ambos estiverem inacessíveis, não retorna resultados.
