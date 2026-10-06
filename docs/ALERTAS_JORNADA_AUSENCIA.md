# Alertas de jornada e ausência

A inclusão de uma colaboradora na escala agora verifica a jornada cadastrada e as ausências vigentes para a data da escala. Colaboradoras com jornada contendo `Meio` ou `Parcial` geram alerta com nome, horários quando disponíveis e a mensagem de que podem não cobrir a agenda toda. O alerta não bloqueia a coordenadora: ela escolhe explicitamente **Não** ou **Sim, adicionar**.

Na ficha de colaboradoras foi adicionado o controle **Marcar como ausente** e o campo **Motivo da ausência**. Ao salvar, é criada uma ausência vigente na tabela existente `ausencias`, com início na data atual e fim em 2099-12-31. Ao retirar a marcação, a ausência vigente dessa colaboradora é removida. Ao tentar incluí-la em uma escala dentro desse período, o sistema exibe o nome, motivo e solicita confirmação.

A validação foi feita com build de produção, Prettier e verificação de diferenças. A migration de ausências já existente é reaproveitada; nenhuma tabela nova é necessária.
