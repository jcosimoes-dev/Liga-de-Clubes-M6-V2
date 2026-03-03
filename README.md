# Equipa M6 - Gestão de Equipa de Padel

Aplicação web mobile-first para gestão de jogos, convocatórias, disponibilidades, duplas e resultados da equipa de padel "Equipa M6".

## Estado Actual: FASE 2 COMPLETA ✅

### Fase 1 (Backend)
- ✅ Autenticação por email/password implementada
- ✅ Roles (Jogador/Capitão) implementados
- ✅ Permissões RLS configuradas e testadas
- ✅ Regras automáticas funcionais (triggers)
- ✅ Serviços TypeScript completos

### Fase 2 (UI Mobile-First)
- ✅ Navegação com bottom menu
- ✅ Ecrãs de autenticação (Login/Registo/Perfil)
- ✅ Ecrã Início com próximo jogo
- ✅ Ecrã Calendário com filtros
- ✅ Ecrã Detalhe do Jogo completo
- ✅ Área do Capitão (fechar convocatória, duplas, resultados)
- ✅ Ecrã Equipa
- ✅ Ecrã Admin
- ✅ Design limpo e mobile-first

**Como testar**: Ver `FASE2_MOBILE_TESTS.md` para checklist completo

---

## 🚀 Quick Start

### Bootstrap do Primeiro Capitão

**IMPORTANTE**: O primeiro utilizador a registar-se torna-se capitão automaticamente.

#### Se já existe utilizador (promoção manual):

1. Fazer login na aplicação
2. Abrir DevTools (F12) → Console
3. Copiar e colar:

```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: { user } } = await supabase.auth.getUser();
await supabase.from('players').update({ is_captain: true }).eq('user_id', user.id);
window.location.reload();
```

4. Verificar menu com 4 itens (incluindo "Admin")

**Ver**: `BOOTSTRAP_NOW.txt` para instruções completas

#### Se é novo utilizador:

1. Registar primeira conta
2. Completar perfil
3. Automaticamente é capitão
4. Ver menu Admin disponível

---

## Arquitectura

### Stack Tecnológico
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Base de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **Icons**: Lucide React

### Estrutura do Projeto

```
src/
├── lib/
│   ├── supabase.ts           # Cliente Supabase configurado
│   └── database.types.ts     # Tipos TypeScript do schema
├── contexts/
│   └── AuthContext.tsx       # Context de autenticação
├── services/
│   ├── index.ts              # Export centralizado
│   ├── players.service.ts    # Serviço de jogadores
│   ├── games.service.ts      # Serviço de jogos
│   ├── availabilities.service.ts  # Serviço de disponibilidades
│   ├── pairs.service.ts      # Serviço de duplas
│   └── results.service.ts    # Serviço de resultados
├── App.tsx
└── main.tsx

supabase/
└── migrations/
    ├── create_players_table.sql
    ├── create_games_table.sql
    ├── create_availabilities_table.sql
    ├── create_pairs_table.sql
    └── create_results_table.sql
```

## Modelo de Dados

### Tabelas

1. **players** - Jogadores da equipa
   - Perfil do jogador
   - Pontos de federação
   - Estado (activo/inactivo)
   - Role (capitão ou jogador)

2. **games** - Jogos da equipa
   - Informações do jogo (jornada, data, adversário, local, fase)
   - Estado (draft, convocatoria_aberta, convocatoria_fechada, concluido, cancelado)

3. **availabilities** - Disponibilidades dos jogadores para cada jogo
   - Estado (sem_resposta, confirmo, nao_posso, talvez)
   - Criadas automaticamente quando jogo é criado

4. **pairs** - Duplas de cada jogo
   - 2 jogadores por dupla
   - Pontos totais (calculados automaticamente)
   - Ordem da dupla (calculada automaticamente)

5. **results** - Resultados de cada dupla
   - Sets ganhos e perdidos
   - Notas opcionais

### Automatismos (Database Triggers)

1. **Convocatória Automática**
   - Quando um jogo é criado, availabilities são criadas automaticamente para todos os jogadores activos
   - Estado inicial: "sem_resposta"

2. **Cálculo de Pontos**
   - total_points de cada dupla = soma dos federation_points dos 2 jogadores
   - Calculado automaticamente ao criar/actualizar dupla

3. **Ordenação de Duplas**
   - pair_order é recalculado automaticamente
   - Ordem decrescente por total_points
   - Recalculado quando: dupla criada, actualizada, eliminada, ou pontos dos jogadores alterados

4. **Timestamps**
   - updated_at actualizado automaticamente em todas as tabelas

## Segurança (Row Level Security)

### Jogador Normal
**PODE:**
- Ver todos os dados (jogadores, jogos, duplas, resultados)
- Actualizar próprio perfil
- Actualizar próprios pontos de federação
- Actualizar própria disponibilidade

**NÃO PODE:**
- Criar jogos
- Alterar estado de jogos
- Criar/editar duplas
- Registar resultados
- Gerir outros jogadores

### Capitão (is_captain = true)
**PODE TUDO:**
- Todas as permissões de jogador normal
- Criar, editar e eliminar jogos
- Abrir/fechar convocatórias
- Criar e gerir duplas
- Registar e editar resultados
- Gerir jogadores (activar, desactivar, promover a capitão)

## Funcionalidades Principais

### 1. Autenticação
- Registo por email e password
- Login
- Gestão de sessão automática
- Carregamento automático do perfil do jogador

### 2. Gestão de Jogadores
- Listar jogadores activos
- Editar perfil (nome, email, telemóvel, pontos de federação)
- Activar/desactivar jogadores (capitão)
- Promover a capitão (capitão)

### 3. Gestão de Jogos
- Criar jogos (capitão)
- Abrir convocatória (capitão)
- Responder a convocatória (todos)
- Fechar convocatória (capitão)
- Visualizar resumo de disponibilidades

### 4. Gestão de Duplas
- Sugerir duplas baseadas em pontos de federação
- Criar duplas manualmente (capitão)
- Visualizar duplas ordenadas por pontos
- Editar duplas (capitão)

### 5. Gestão de Resultados
- Registar resultados por dupla (capitão)
- Visualizar resumo do jogo (vitória/derrota/empate)
- Marcar jogo como concluído (capitão)

### 6. Partilha
- Gerar texto formatado para WhatsApp
- Partilhar detalhes do jogo

## Como Usar

### 1. Setup Inicial

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
# Já configurado em .env
```

### 2. Autenticação

```typescript
import { useAuth } from './contexts/AuthContext';

function MyComponent() {
  const { signIn, signUp, signOut, user, player, isCaptain } = useAuth();

  // Registar
  await signUp('email@example.com', 'password', 'Nome', '912345678');

  // Login
  await signIn('email@example.com', 'password');

  // Logout
  await signOut();

  // Verificar se é capitão
  if (isCaptain) {
    // Mostrar opções de capitão
  }
}
```

### 3. Usar Serviços

```typescript
import { PlayersService, GamesService, AvailabilitiesService, PairsService, ResultsService } from './services';

// Listar jogadores activos
const players = await PlayersService.getActive();

// Criar jogo (capitão)
const game = await GamesService.create({
  round_number: 1,
  game_date: new Date().toISOString(),
  opponent: 'Equipa Rival',
  location: 'Clube Lisboa',
  phase: 'Regular',
  created_by: captainId,
});

// Responder a convocatória
await AvailabilitiesService.updateByGameAndPlayer(
  gameId,
  playerId,
  'confirmo'
);

// Criar duplas (capitão)
await PairsService.create({
  game_id: gameId,
  player1_id: player1Id,
  player2_id: player2Id,
});

// Registar resultado (capitão)
await ResultsService.create({
  game_id: gameId,
  pair_id: pairId,
  sets_won: 2,
  sets_lost: 1,
});
```

## Testes

Consultar o ficheiro `TESTING.md` para guia completo de testes.

## Estados do Jogo

1. **draft** - Rascunho (jogo criado mas convocatória não aberta)
2. **convocatoria_aberta** - Convocatória aberta (jogadores podem responder)
3. **convocatoria_fechada** - Convocatória fechada (capitão define duplas)
4. **concluido** - Jogo concluído (resultados registados)
5. **cancelado** - Jogo cancelado

## Estados de Disponibilidade

1. **sem_resposta** - Jogador ainda não respondeu (estado inicial)
2. **confirmo** - Jogador confirmou presença
3. **nao_posso** - Jogador não pode ir
4. **talvez** - Jogador não tem certeza

## Próximos Passos

- [ ] Implementar interface de utilizador (UI)
- [ ] Criar componentes React para cada funcionalidade
- [ ] Adicionar navegação entre ecrãs
- [ ] Implementar design mobile-first
- [ ] Adicionar notificações
- [ ] Adicionar estatísticas de jogador
- [ ] Adicionar histórico de jogos

## Desenvolvido para

**Equipa M6** - Equipa de Padel
