# Bloco de Notas pessoal

O Bloco de Notas foi ajustado para funcionar como um espaço privado por usuário. A consulta da aplicação filtra as notas pelo usuário autenticado, e a migration `20260911081500_notas_pessoais.sql` reforça a mesma regra no Row Level Security do banco.

Cada usuário pode visualizar, criar, editar, concluir/reabrir e excluir somente notas cujo `created_by` seja seu próprio usuário. A regra vale inclusive para administradores e para chamadas diretas à API; não existe exceção de leitura, edição ou exclusão para outro usuário.

Para aplicar no banco do Lovable, executar a migration no SQL Editor. Notas antigas sem `created_by` preenchido não ficarão visíveis para nenhum usuário, preservando a privacidade; elas podem ser tratadas posteriormente mediante decisão explícita de propriedade.
