# Correção do erro após criação de usuário

Foi corrigida a transição entre criação/login e abertura do painel. Após `signInWithPassword`, o aplicativo agora confirma que o usuário autenticado está disponível antes de navegar para `/dashboard`.

A rota protegida também passou a tolerar uma propagação momentânea da sessão, fazendo tentativas curtas antes de redirecionar para o login. Isso evita que uma conta recém-criada seja enviada prematuramente para a tela de erro global do roteador.

Os fluxos de login por e-mail ou usuário, cadastro automático, primeiro acesso e recuperação de senha foram preservados. A correção não altera permissões, perfis ou dados existentes.

## Ajuste adicional

A validação foi reforçada para usar `supabase.auth.getSession()` como primeira fonte de verdade durante a navegação. Isso evita depender de uma chamada de rede (`getUser`) no exato momento da transição e reduz o risco de falso redirecionamento para a tela global de erro. A proteção da rota continua fazendo tentativas curtas antes de enviar o usuário ao login.

## Correção da corrida no evento de autenticação

Também foi reproduzida a situação no endereço publicado: com a sessão persistida, acessar `/auth` redirecionava para `/dashboard`, que caía na tela global de erro. O root recebia `SIGNED_IN` e chamava `router.invalidate()` no mesmo instante em que o redirecionamento carregava a rota protegida. Essa invalidação concorrente podia executar o `beforeLoad` antes de a sessão estabilizar.

O evento `SIGNED_IN` deixou de invalidar a rota. A navegação normal do login carrega o dashboard, enquanto `SIGNED_OUT` continua invalidando e limpando o cache. Eventos de atualização apenas invalidam consultas, sem reiniciar a rota.

## Causa concreta identificada no Lovable

Com o usuário de teste `geti.ti`, a tentativa de login foi reproduzida no endereço publicado. O console exibiu `login is not defined`. No fluxo de autenticação por username, o retorno do `signInWithPassword` era desestruturado como `{ error }`, mas o código verificava `login.error`, referenciando uma variável inexistente. O retorno passou a ser armazenado em `const login`, mantendo a verificação de erro correta.
