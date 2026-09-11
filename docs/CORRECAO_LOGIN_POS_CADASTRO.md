# Correção do erro após criação de usuário

Foi corrigida a transição entre criação/login e abertura do painel. Após `signInWithPassword`, o aplicativo agora confirma que o usuário autenticado está disponível antes de navegar para `/dashboard`.

A rota protegida também passou a tolerar uma propagação momentânea da sessão, fazendo tentativas curtas antes de redirecionar para o login. Isso evita que uma conta recém-criada seja enviada prematuramente para a tela de erro global do roteador.

Os fluxos de login por e-mail ou usuário, cadastro automático, primeiro acesso e recuperação de senha foram preservados. A correção não altera permissões, perfis ou dados existentes.

## Ajuste adicional

A validação foi reforçada para usar `supabase.auth.getSession()` como primeira fonte de verdade durante a navegação. Isso evita depender de uma chamada de rede (`getUser`) no exato momento da transição e reduz o risco de falso redirecionamento para a tela global de erro. A proteção da rota continua fazendo tentativas curtas antes de enviar o usuário ao login.
