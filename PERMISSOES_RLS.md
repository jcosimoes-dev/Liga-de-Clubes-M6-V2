# Permissões RLS - Sistema M6

## Resumo dos Roles do Sistema

### 1. Jogador (Player)
Utilizador normal com acesso limitado aos seus próprios dados e visualização de informação geral.

### 2. Capitão (Captain)
Utilizador com permissões de gestão para criar e organizar jogos, equipas, duplas e resultados.

### 3. Coordenador (Coordinator)
Utilizador com acesso apenas de leitura a todas as tabelas do sistema.

### 4. Administrador (Admin)
Utilizador com acesso total (CRUD) a todas as tabelas do sistema.

---

## Matriz de Permissões por Role

### Tabela: `players` (Jogadores)

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| **Jogador** | ✅ Próprio perfil | ✅ Próprio perfil | ✅ Próprio perfil | ❌ |
| **Capitão** | ✅ Próprio perfil | ✅ Próprio perfil | ✅ Próprio perfil | ❌ |
| **Coordenador** | ✅ Todos | ❌ | ❌ | ❌ |
| **Admin** | ✅ Todos | ✅ Todos | ✅ Todos | ✅ Todos |

### Tabela: `teams` (Equipas)

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| **Jogador** | ✅ Todas | ❌ | ❌ | ❌ |
| **Capitão** | ✅ Todas | ✅ | ✅ | ❌ |
| **Coordenador** | ✅ Todas | ❌ | ❌ | ❌ |
| **Admin** | ✅ Todas | ✅ | ✅ | ✅ |

### Tabela: `games` (Jogos)

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| **Jogador** | ✅ Todos | ❌ | ❌ | ❌ |
| **Capitão** | ✅ Todos | ✅ | ✅ | ❌ |
| **Coordenador** | ✅ Todos | ❌ | ❌ | ❌ |
| **Admin** | ✅ Todos | ✅ | ✅ | ✅ |

### Tabela: `availabilities` (Disponibilidades)

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| **Jogador** | ✅ Própria | ✅ Própria | ✅ Própria | ✅ Própria |
| **Capitão** | ✅ Todas | ✅ Própria | ✅ Própria | ✅ Própria |
| **Coordenador** | ✅ Todas | ❌ | ❌ | ❌ |
| **Admin** | ✅ Todas | ✅ Todas | ✅ Todas | ✅ Todas |

### Tabela: `pairs` (Duplas)

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| **Jogador** | ✅ Próprias duplas | ❌ | ❌ | ❌ |
| **Capitão** | ✅ Todas | ✅ | ✅ | ❌ |
| **Coordenador** | ✅ Todas | ❌ | ❌ | ❌ |
| **Admin** | ✅ Todas | ✅ | ✅ | ✅ |

### Tabela: `results` (Resultados)

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| **Jogador** | ✅ Dos seus jogos | ❌ | ❌ | ❌ |
| **Capitão** | ✅ Todos | ✅ | ✅ | ❌ |
| **Coordenador** | ✅ Todos | ❌ | ❌ | ❌ |
| **Admin** | ✅ Todos | ✅ | ✅ | ✅ |

---

## Detalhes das Permissões por Role

### 1. Jogador (Player)

**Objetivo**: Gerir o próprio perfil e disponibilidade, visualizar informação geral.

#### Permissões:
- **players**: Ver e atualizar o próprio perfil
- **teams**: Ver todas as equipas (apenas leitura)
- **games**: Ver todos os jogos (apenas leitura)
- **availabilities**: Gerir a própria disponibilidade (CRUD completo)
- **pairs**: Ver as duplas em que está inserido
- **results**: Ver resultados dos jogos em que participou

### 2. Capitão (Captain)

**Objetivo**: Todas as permissões de Jogador + gerir jogos, equipas e resultados.

#### Permissões adicionais:
- **teams**: Criar e editar equipas
- **games**: Criar e editar jogos
- **availabilities**: Ver disponibilidades de todos os jogadores
- **pairs**: Criar e editar duplas
- **results**: Criar e editar resultados

### 3. Coordenador (Coordinator)

**Objetivo**: Acesso de leitura a todas as tabelas para supervisão.

#### Permissões:
- **Todas as tabelas**: Apenas SELECT (leitura)
- **Nenhuma operação de escrita** (INSERT, UPDATE, DELETE)

**Nota**: Role ainda não implementado completamente no sistema.

### 4. Administrador (Admin)

**Objetivo**: Controlo total do sistema.

#### Permissões:
- **Todas as tabelas**: Acesso CRUD completo
- **Pode apagar registos** em todas as tabelas
- **Pode gerir utilizadores** e promover/despromover roles

---

## Bootstrap (Primeiro Admin)

Quando **não existe nenhum admin** no sistema:

| Operação | Permissão | Descrição |
|----------|-----------|-----------|
| **Criar (INSERT)** | ✅ Sim | O primeiro utilizador pode criar o seu perfil como admin |
| **Atualizar (UPDATE)** | ✅ Sim | Pode promover-se a admin |

**Nota**: Estas permissões são **temporárias** e só funcionam até existir o primeiro admin.

## Políticas RLS Ativas por Tabela

### Tabela: `players`

**Total de políticas**: 9

```sql
-- Jogadores - Ver próprio perfil
"Players can view own profile"
  FOR SELECT USING (auth.uid() = user_id)

-- Jogadores - Criar próprio perfil
"Players can create own profile"
  FOR INSERT WITH CHECK (auth.uid() = user_id)

-- Jogadores - Atualizar próprio perfil
"Players can update own profile"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)

-- Admins - Ver todos os jogadores
"Admins can view all players"
  FOR SELECT USING (get_current_user_role() = 'admin')

-- Admins - Criar jogadores
"Admins can create any player"
  FOR INSERT WITH CHECK (get_current_user_role() = 'admin')

-- Admins - Atualizar jogadores
"Admins can update any player"
  FOR UPDATE USING (get_current_user_role() = 'admin')

-- Admins - Apagar jogadores
"Admins can delete any player"
  FOR DELETE USING (get_current_user_role() = 'admin')

-- Bootstrap - Criar primeiro admin
"Bootstrap: allow first profile creation"
  FOR INSERT WITH CHECK (auth.uid() = user_id AND NOT admin_exists())

-- Bootstrap - Promover a admin
"Bootstrap: allow first profile update"
  FOR UPDATE USING (auth.uid() = user_id AND NOT admin_exists())
```

### Tabela: `teams`

**Total de políticas**: 4

```sql
-- Todos - Ver equipas
"All authenticated users can view teams"
  FOR SELECT USING (true)

-- Capitão/Admin - Criar equipas
"Captains and admins can create teams"
  FOR INSERT WITH CHECK (get_current_user_role() IN ('captain', 'admin'))

-- Capitão/Admin - Atualizar equipas
"Captains and admins can update teams"
  FOR UPDATE USING (get_current_user_role() IN ('captain', 'admin'))

-- Admin - Apagar equipas
"Only admins can delete teams"
  FOR DELETE USING (get_current_user_role() = 'admin')
```

### Tabela: `games`

**Total de políticas**: 4

```sql
-- Todos - Ver jogos
"All authenticated users can view games"
  FOR SELECT USING (true)

-- Capitão/Admin - Criar jogos
"Captains and admins can create games"
  FOR INSERT WITH CHECK (get_current_user_role() IN ('captain', 'admin'))

-- Capitão/Admin - Atualizar jogos
"Captains and admins can update games"
  FOR UPDATE USING (get_current_user_role() IN ('captain', 'admin'))

-- Admin - Apagar jogos
"Only admins can delete games"
  FOR DELETE USING (get_current_user_role() = 'admin')
```

### Tabela: `availabilities`

**Total de políticas**: 5

```sql
-- Jogador - Ver própria disponibilidade
"Players can view own availability"
  FOR SELECT USING (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()))

-- Capitão/Admin - Ver todas disponibilidades
"Captains and admins can view all availabilities"
  FOR SELECT USING (get_current_user_role() IN ('captain', 'admin'))

-- Jogador - Criar disponibilidade
"Players can create own availability"
  FOR INSERT WITH CHECK (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()))

-- Jogador - Atualizar disponibilidade
"Players can update own availability"
  FOR UPDATE USING (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()))

-- Jogador - Apagar disponibilidade
"Players can delete own availability"
  FOR DELETE USING (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()))
```

### Tabela: `pairs`

**Total de políticas**: 5

```sql
-- Jogador - Ver próprias duplas
"Players can view own pairs"
  FOR SELECT USING (player1_id IN (SELECT id FROM players WHERE user_id = auth.uid())
                    OR player2_id IN (SELECT id FROM players WHERE user_id = auth.uid()))

-- Capitão/Admin - Ver todas duplas
"Captains and admins can view all pairs"
  FOR SELECT USING (get_current_user_role() IN ('captain', 'admin'))

-- Capitão/Admin - Criar duplas
"Captains and admins can create pairs"
  FOR INSERT WITH CHECK (get_current_user_role() IN ('captain', 'admin'))

-- Capitão/Admin - Atualizar duplas
"Captains and admins can update pairs"
  FOR UPDATE USING (get_current_user_role() IN ('captain', 'admin'))

-- Admin - Apagar duplas
"Only admins can delete pairs"
  FOR DELETE USING (get_current_user_role() = 'admin')
```

### Tabela: `results`

**Total de políticas**: 5

```sql
-- Jogador - Ver resultados dos seus jogos
"Players can view results for their games"
  FOR SELECT USING (game_id IN (
    SELECT DISTINCT game_id FROM pairs
    WHERE player1_id IN (SELECT id FROM players WHERE user_id = auth.uid())
       OR player2_id IN (SELECT id FROM players WHERE user_id = auth.uid())
  ))

-- Capitão/Admin - Ver todos resultados
"Captains and admins can view all results"
  FOR SELECT USING (get_current_user_role() IN ('captain', 'admin'))

-- Capitão/Admin - Criar resultados
"Captains and admins can create results"
  FOR INSERT WITH CHECK (get_current_user_role() IN ('captain', 'admin'))

-- Capitão/Admin - Atualizar resultados
"Captains and admins can update results"
  FOR UPDATE USING (get_current_user_role() IN ('captain', 'admin'))

-- Admin - Apagar resultados
"Only admins can delete results"
  FOR DELETE USING (get_current_user_role() = 'admin')
```

## Segurança

### Funções Helper (Evitam Recursão RLS)

#### `get_current_user_role()`
- Retorna o role do utilizador autenticado
- Usa `SECURITY DEFINER` para evitar recursão RLS
- Usado nas políticas de admin

#### `admin_exists()`
- Verifica se já existe algum admin no sistema
- Retorna `true` se existir pelo menos um admin
- Usado nas políticas de bootstrap

## Como Testar as Permissões

### Teste 1: Jogador vê apenas o seu perfil
```typescript
// Como jogador normal, só vejo os meus dados
const { data } = await supabase
  .from('players')
  .select('*')
  .eq('user_id', myUserId); // ✅ Funciona

const { data } = await supabase
  .from('players')
  .select('*'); // ❌ Retorna apenas o meu perfil, não todos
```

### Teste 2: Jogador atualiza o próprio perfil
```typescript
// Como jogador, posso atualizar os meus dados
const { error } = await supabase
  .from('players')
  .update({ phone: '912345678' })
  .eq('user_id', myUserId); // ✅ Funciona

const { error } = await supabase
  .from('players')
  .update({ phone: '912345678' })
  .eq('user_id', otherUserId); // ❌ Não funciona
```

### Teste 3: Admin vê todos os jogadores
```typescript
// Como admin, vejo todos os jogadores
const { data } = await supabase
  .from('players')
  .select('*'); // ✅ Retorna todos os jogadores
```

### Teste 4: Admin cria novo jogador
```typescript
// Como admin, posso criar jogadores
const { error } = await supabase
  .from('players')
  .insert({
    user_id: newUserId,
    name: 'Novo Jogador',
    // ...
  }); // ✅ Funciona

// Como jogador normal, NÃO posso criar outros jogadores
// (apenas o meu próprio perfil)
```

## Conclusão

O sistema de permissões RLS garante que:

1. ✅ **Jogadores só veem e editam os seus próprios dados**
2. ✅ **Admins têm controlo total**
3. ✅ **O primeiro utilizador pode tornar-se admin**
4. ✅ **Não há recursão RLS (evitada com funções SECURITY DEFINER)**
5. ✅ **Segurança garantida ao nível da base de dados**
