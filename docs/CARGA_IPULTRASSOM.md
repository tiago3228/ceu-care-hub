# Carga IPULTRASSOM.ods

A planilha foi analisada e gerou uma carga de **23 equipamentos com IP** para a aba Aparelhos de US / Equipamentos.

## Mapeamento aplicado

As colunas foram mapeadas para localização, AETitle, IP, porta, observações e Worklist. Endereços `192.168.0.x` foram classificados como MATRIZ; endereços `192.168.1.x` como MN; equipamentos de Mamografia foram mantidos com localização Mamografia. As linhas sem IP, cabeçalhos, LIS sem aparelho e Portátil sem endereço não foram inventadas nem incluídas como equipamentos cadastráveis.

## Campos ausentes

A planilha não trouxe patrimônio nem número de série para os registros importados. Para não deixar os campos obrigatórios vazios, a carga usa valores temporários com prefixo `PENDENTE-`, que devem ser substituídos pela equipe na ficha de cada equipamento.

## Senhas

A planilha contém informações de senha. Por segurança, nenhuma senha foi colocada no SQL, no Git ou na listagem. As senhas devem ser preenchidas pela ficha de equipamento após a migration, usando o campo protegido; o servidor fará a cifragem AES-256-GCM e registrará a operação de revelação/cópia quando necessário.

## Aplicação

1. Execute a migration `supabase/migrations/20260911084000_equipamentos_us.sql` no SQL Editor do Lovable.
2. Execute `supabase/seed/20260911_carga_equipamentos_us.sql` no mesmo ambiente.
3. Abra a aba **Aparelhos de US / Equipamentos**.
4. Substitua os valores `PENDENTE-` de patrimônio e serial.
5. Cadastre as senhas individualmente pela ficha, sem colá-las no SQL.

A carga usa `where not exists` pelo patrimônio temporário e evita duplicação do histórico do lote quando executada novamente.
