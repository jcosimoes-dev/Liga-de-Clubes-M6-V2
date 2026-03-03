# Guia de Bootstrap Admin e Sistema de Roles

## Resumo das Alterações

Sistema completo de roles implementado com 3 níveis de acesso:

### Roles Disponíveis

1. **Admin** - Acesso total
   - Criar jogos
   - Promover jogadores a capitão/coordenador/admin
   - Criar coordenadores
   - Ver todos os jogadores da equipa

2. **Capitão** - Operações
   - Criar jogos
   - Gerir duplas e resultados
   - Ver apenas os próprios dados (RLS)

3. **Coordenador** - Leitura
   - Acesso de leitura
   - Não joga (não aparece em convocatórias)

4. **Jogador** - Participante
   - Confirmar disponibilidade
   - Ver jogos
   - Actualizar próprio perfil

## Como Fazer Bootstrap (Primeira Vez)

### Passo 1: Login
1. Faça login com a conta que criou
2. Complete o perfil se necessário

### Passo 2: Bootstrap para Admin
1. No ecrã inicial, verá um card "Configuração Inicial" (apenas se ainda não for admin)
2. Clique em "Configurar Sistema" - será navegado para /bootstrap
3. Na página de bootstrap:
   - Verá o seu nome e role actual
   - Clique em "Tornar-me Administrador"
   - O botão mostrará um spinner e "A promover..."
   - Se houver erro, verá mensagem detalhada com status e código
4. Aguarde o reload automático (1.5 segundos após sucesso)

### Passo 3: Verificar Role
1. Após reload, navegue para "Administração"
2. No topo, verá um card com o seu nome e role "Administrador" (badge vermelho)
3. As secções de promoção e coordenador estarão visíveis

## Estrutura das Permissões

### AdminScreen

**Visível para todos (admin + capitão):**
- Card do Role (mostra role actual)
- Criar Novo Jogo

**Visível apenas para Admin:**
- Promover Jogador
- Adicionar Coordenador

### Backend Seguro

A função RPC `get_team_players_for_admin()` garante:
- Valida que o utilizador é admin (server-side)
- Devolve apenas {id, name, role}
- Bypass RLS com SECURITY DEFINER
- Não expõe dados sensíveis

## Ficheiros Modificados

1. **supabase/functions/bootstrap-admin/index.ts** (novo)
   - Edge Function para auto-promoção a admin
   - Valida que não existe nenhum admin
   - Promove o utilizador actual

2. **src/screens/BootstrapScreen.tsx** (novo)
   - Interface para bootstrap inicial
   - Chama a Edge Function
   - Reload automático após sucesso

3. **src/screens/AdminScreen.tsx** (actualizado)
   - Card de role no topo
   - Secções de promoção/coordenador apenas para admin
   - Usa RPC `getTeamPlayersForAdmin()`

4. **src/screens/HomeScreen.tsx** (actualizado)
   - Card de "Configuração Inicial" para não-admins
   - Botão para aceder ao bootstrap

5. **src/App.tsx** (actualizado)
   - Rota 'bootstrap' adicionada

## Testar Diferentes Roles

### Como Admin
1. Login como admin
2. Ver que as secções "Promover Jogador" e "Adicionar Coordenador" estão visíveis
3. Dropdown mostra todos os jogadores da equipa

### Como Capitão
1. Criar utilizador de teste com role "capitão" (via Admin)
2. Login como capitão
3. Ver que as secções de promoção/coordenador NÃO aparecem
4. Pode criar jogos normalmente

### Como Coordenador
1. Criar coordenador (via Admin)
2. Login como coordenador
3. Acesso de leitura apenas

## Segurança

### RLS (Row Level Security)
- Jogadores/Capitães veem apenas os próprios dados
- Admins usam RPC com SECURITY DEFINER para bypass controlado
- Coordenadores criados via server-side (não podem auto-registar)

### Edge Function Bootstrap
- Valida que não existe nenhum admin
- Operação única (apenas funciona na primeira vez)
- Usa Service Role Key (server-side)

## Próximos Passos

1. Login com a sua conta
2. Execute o bootstrap (Configurar Sistema)
3. Torne-se Administrador
4. Crie utilizadores de teste se necessário
5. Promova jogadores a capitão/coordenador conforme necessário

## Troubleshooting

### Botão "Configurar Sistema" não funciona
**CORRIGIDO:** A rota 'bootstrap' foi adicionada ao NavigationContext. Agora funciona!
Se ainda tiver problemas:
1. Limpar cache do navegador (Ctrl+Shift+R ou Cmd+Shift+R)
2. Abrir consola do navegador (F12) e verificar logs `[HomeScreen]`, `[NavigationContext]` e `[BootstrapScreen]`
3. Ver ficheiro `DEBUG_BOOTSTRAP.md` para guia completo de debugging com todos os cenários
4. Confirmar que está autenticado (fazer logout e login se necessário)

### "Já existe um administrador"
**Motivo:** Bootstrap só funciona se não houver nenhum admin
**Solução:** Use a funcionalidade "Promover Jogador" (como admin) para gerir roles

### Erro 401 ou "Não autenticado"
**Motivo:** Sessão expirada ou inválida
**Solução:**
1. Fazer logout
2. Fazer login novamente
3. Tentar o bootstrap novamente

### Erro 403 ou "Bootstrap não permitido"
**Motivo:** Já existe um administrador no sistema
**Solução:**
1. Contactar o administrador existente
2. Ou verificar na tabela `players` (Supabase Dashboard) e remover role='admin' temporariamente

### Erro 404 ou "Perfil de jogador não encontrado"
**Motivo:** O utilizador autenticado não tem registo na tabela players
**Solução:**
1. Completar o perfil no ecrã "Complete o seu perfil"
2. Verificar que o registo foi criado com sucesso

### Erro 500 ou "Erro ao promover"
**Motivo:** Erro interno do servidor
**Solução:**
1. Verificar logs da Edge Function no Supabase Dashboard
2. Verificar que as variáveis de ambiente estão configuradas
3. Tentar novamente após alguns segundos

### Não vejo as secções de Admin após bootstrap
**Solução:**
1. Aguardar o reload automático (1.5s)
2. Se não recarregar, fazer refresh manual (F5)
3. Verificar o badge do role no topo do AdminScreen
4. Se ainda aparecer "Jogador", fazer logout e login novamente
5. Verificar no Supabase que o role='admin' no registo da tabela players

### Dropdown vazio na secção "Promover Jogador"
**Motivo:** A RPC `get_team_players_for_admin()` valida role server-side
**Solução:**
- Se não é admin, devolve vazio (por design)
- Verificar que o role é realmente 'admin'
- Verificar que existem outros jogadores na mesma equipa
