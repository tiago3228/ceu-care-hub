# Apelidos na escala

Foi adicionado o campo **Apelido para a escala/JPEG** ao cadastro de colaboradoras. O primeiro nome é sugerido automaticamente quando uma colaboradora é cadastrada ou quando uma ficha antiga sem apelido é aberta. O administrador pode editar o apelido livremente, com limite de 50 caracteres.

O cadastro de médicos já possuía o campo **Apelido**, que passou a ser usado de forma consistente na seleção e na escala.

Quando existe apelido, ele é usado em:

- Seleção de médicos e colaboradoras na montagem da escala.
- Grade visual da escala.
- Exportação JPEG da escala.
- Exportação de planilha e textos derivados da escala.

O nome completo continua preservado no cadastro, na busca e nos dados administrativos. A migration `20260911114000_apelido_colaboradoras.sql` adiciona a coluna de forma idempotente.
