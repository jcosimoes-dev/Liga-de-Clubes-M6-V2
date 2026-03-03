# Guia de Testes - Equipa M6

Este documento explica como testar a lógica implementada para a aplicação de gestão da Equipa M6.

## Estrutura Implementada

### 1. Base de Dados (Supabase)
- **5 Tabelas**: players, games, availabilities, pairs, results
- **Row Level Security (RLS)** activado em todas as tabelas
- **Triggers automáticos** para:
  - Criar availabilities quando um jogo é criado
  - Calcular total_points das duplas
  - Recalcular pair_order das duplas

### 2. Autenticação
- **AuthContext** (`src/contexts/AuthContext.tsx`)
  - Gestão de sessão automática
  - Funções: `signUp`, `signIn`, `signOut`
  - Carregamento automático do perfil do jogador
  - Verificação de role (isCaptain)

### 3. Serviços
- **PlayersService**: Gestão de jogadores
- **GamesService**: Gestão de jogos
- **AvailabilitiesService**: Gestão de disponibilidades
- **PairsService**: Gestão de duplas
- **ResultsService**: Gestão de resultados

---

## Como Testar

### Pré-requisitos
1. Abrir a consola do browser (F12)
2. Importar os serviços necessários

### Console Setup
```javascript
// Importar o cliente Supabase e serviços
import { supabase } from './src/lib/supabase';
import { PlayersService, GamesService, AvailabilitiesService, PairsService, ResultsService } from './src/services';
```

---

## Cenários de Teste

### 1. AUTENTICAÇÃO

#### Registar novo jogador
```javascript
// Registar como jogador normal
const { error } = await supabase.auth.signUp({
  email: 'jogador1@example.com',
  password: 'password123',
});

// Criar perfil manualmente (normalmente feito pelo AuthContext)
const { data: user } = await supabase.auth.getUser();
await supabase.from('players').insert({
  user_id: user.user.id,
  name: 'João Silva',
  email: 'jogador1@example.com',
  phone: '912345678',
  is_active: true,
  is_captain: false,
  federation_points: 150,
});
```

#### Login
```javascript
const { error } = await supabase.auth.signInWithPassword({
  email: 'jogador1@example.com',
  password: 'password123',
});
```

#### Criar Capitão (para testes)
```javascript
// Primeiro criar jogador normal, depois promover a capitão
const { data: player } = await PlayersService.getByUserId(user.user.id);
await PlayersService.makeCaptain(player.id);
```

---

### 2. GESTÃO DE JOGADORES

#### Listar todos os jogadores
```javascript
const players = await PlayersService.getAll();
console.table(players);
```

#### Listar jogadores activos
```javascript
const activePlayers = await PlayersService.getActive();
console.table(activePlayers);
```

#### Actualizar pontos de federação
```javascript
const player = await PlayersService.getById('player-id');
await PlayersService.updateFederationPoints(player.id, 200);
```

#### Desactivar jogador (apenas capitão)
```javascript
await PlayersService.deactivate('player-id');
```

---

### 3. GESTÃO DE JOGOS

#### Criar novo jogo (apenas capitão)
```javascript
const { data: captain } = await supabase.auth.getUser();
const { data: captainProfile } = await PlayersService.getByUserId(captain.user.id);

const game = await GamesService.create({
  round_number: 1,
  game_date: new Date('2024-03-15T19:00:00').toISOString(),
  opponent: 'Equipa Rival',
  location: 'Clube de Padel Lisboa',
  phase: 'Regular',
  created_by: captainProfile.id,
});

console.log('Jogo criado:', game);
```

**NOTA**: Ao criar o jogo, as availabilities são criadas AUTOMATICAMENTE para todos os jogadores activos com status "sem_resposta".

#### Verificar availabilities criadas automaticamente
```javascript
const availabilities = await AvailabilitiesService.getByGame(game.id);
console.table(availabilities);
```

#### Abrir convocatória
```javascript
await GamesService.openCall(game.id);
```

#### Obter jogo com todas as relações
```javascript
const fullGame = await GamesService.getById(game.id);
console.log('Jogo completo:', fullGame);
```

---

### 4. GESTÃO DE DISPONIBILIDADES

#### Jogador responde à convocatória
```javascript
// Obter availability do jogador
const { data: player } = await supabase.auth.getUser();
const { data: playerProfile } = await PlayersService.getByUserId(player.user.id);

const availability = await AvailabilitiesService.getByGameAndPlayer(
  game.id,
  playerProfile.id
);

// Confirmar presença
await AvailabilitiesService.updateStatus(availability.id, 'confirmo');
```

#### Verificar resumo de disponibilidades
```javascript
const summary = await AvailabilitiesService.getSummary(game.id);
console.log('Resumo:', summary);
// Output: { sem_resposta: 2, confirmo: 4, nao_posso: 1, talvez: 1, total: 8 }
```

#### Obter jogadores confirmados
```javascript
const confirmed = await AvailabilitiesService.getConfirmedPlayers(game.id);
console.table(confirmed);
```

---

### 5. GESTÃO DE DUPLAS

#### Fechar convocatória
```javascript
await GamesService.closeCall(game.id);
```

#### Obter sugestões de duplas (baseado em pontos)
```javascript
const suggestions = await PairsService.suggestPairs(game.id);
console.table(suggestions);
```

#### Criar duplas manualmente (apenas capitão)
```javascript
const pair1 = await PairsService.create({
  game_id: game.id,
  player1_id: 'player-id-1',
  player2_id: 'player-id-2',
});

const pair2 = await PairsService.create({
  game_id: game.id,
  player1_id: 'player-id-3',
  player2_id: 'player-id-4',
});

const pair3 = await PairsService.create({
  game_id: game.id,
  player1_id: 'player-id-5',
  player2_id: 'player-id-6',
});
```

**NOTA**: O `total_points` e `pair_order` são calculados AUTOMATICAMENTE pelos triggers.

#### Verificar duplas ordenadas
```javascript
const pairs = await PairsService.getByGame(game.id);
console.table(pairs.map(p => ({
  ordem: p.pair_order,
  jogador1: p.player1.name,
  jogador2: p.player2.name,
  pontos: p.total_points,
})));
```

#### Testar recálculo automático
```javascript
// Alterar pontos de um jogador
await PlayersService.updateFederationPoints('player-id-1', 300);

// Verificar que pair_order foi recalculado
const updatedPairs = await PairsService.getByGame(game.id);
console.table(updatedPairs.map(p => ({
  ordem: p.pair_order,
  pontos: p.total_points,
})));
```

---

### 6. GESTÃO DE RESULTADOS

#### Registar resultado de uma dupla (apenas capitão)
```javascript
const result1 = await ResultsService.create({
  game_id: game.id,
  pair_id: pair1.id,
  sets_won: 2,
  sets_lost: 1,
  notes: 'Boa performance',
});
```

#### Registar múltiplos resultados
```javascript
await ResultsService.createMultiple([
  {
    game_id: game.id,
    pair_id: pair2.id,
    sets_won: 2,
    sets_lost: 0,
  },
  {
    game_id: game.id,
    pair_id: pair3.id,
    sets_won: 1,
    sets_lost: 2,
  },
]);
```

#### Obter resumo do jogo
```javascript
const summary = await ResultsService.getGameSummary(game.id);
console.log('Resumo do jogo:', summary);
// Output: { totalSetsWon: 5, totalSetsLost: 3, pairsWithResults: 3, outcome: 'Vitória' }
```

#### Marcar jogo como concluído
```javascript
await GamesService.complete(game.id);
```

---

### 7. PARTILHAR NO WHATSAPP

#### Gerar texto para WhatsApp
```javascript
const game = await GamesService.getById(game.id);
const whatsappText = GamesService.formatForWhatsApp(game);
console.log(whatsappText);

// Para partilhar:
const url = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
window.open(url, '_blank');
```

---

## Verificar Permissões (RLS)

### Jogador Normal
```javascript
// Login como jogador
await supabase.auth.signInWithPassword({
  email: 'jogador1@example.com',
  password: 'password123',
});

// PODE:
// - Ver todos os jogos, jogadores, duplas, resultados
const games = await GamesService.getAll(); // ✓ Sucesso

// - Actualizar própria disponibilidade
await AvailabilitiesService.updateStatus(availabilityId, 'confirmo'); // ✓ Sucesso

// - Actualizar próprios pontos
await PlayersService.updateFederationPoints(ownPlayerId, 200); // ✓ Sucesso

// NÃO PODE:
// - Criar jogos
await GamesService.create({ ... }); // ✗ Erro: RLS violation

// - Criar duplas
await PairsService.create({ ... }); // ✗ Erro: RLS violation

// - Registar resultados
await ResultsService.create({ ... }); // ✗ Erro: RLS violation
```

### Capitão
```javascript
// Login como capitão
await supabase.auth.signInWithPassword({
  email: 'capitao@example.com',
  password: 'password123',
});

// PODE FAZER TUDO:
// - Criar jogos ✓
// - Abrir/Fechar convocatórias ✓
// - Criar duplas ✓
// - Registar resultados ✓
// - Gerir jogadores (activar, desactivar, promover) ✓
```

---

## Testar Automatismos

### 1. Convocatória Automática
```javascript
// Criar 5 jogadores activos
for (let i = 1; i <= 5; i++) {
  await supabase.from('players').insert({
    user_id: `test-user-${i}`,
    name: `Jogador ${i}`,
    email: `jogador${i}@test.com`,
    is_active: true,
    federation_points: i * 50,
  });
}

// Criar jogo
const game = await GamesService.create({
  round_number: 1,
  game_date: new Date().toISOString(),
  opponent: 'Teste',
  location: 'Teste',
  phase: 'Regular',
  created_by: captainId,
});

// Verificar que 5 availabilities foram criadas automaticamente
const availabilities = await AvailabilitiesService.getByGame(game.id);
console.log(`${availabilities.length} availabilities criadas`); // 5
console.log('Todos com status "sem_resposta":',
  availabilities.every(a => a.status === 'sem_resposta')
); // true
```

### 2. Cálculo Automático de Pontos
```javascript
// Criar dupla com 2 jogadores
const pair = await PairsService.create({
  game_id: gameId,
  player1_id: playerId1, // 100 pontos
  player2_id: playerId2, // 150 pontos
});

console.log(pair.total_points); // 250 (calculado automaticamente)
```

### 3. Ordenação Automática de Duplas
```javascript
// Criar 3 duplas
await PairsService.createMultiple([
  { game_id: gameId, player1_id: 'p1', player2_id: 'p2' }, // 100 + 150 = 250
  { game_id: gameId, player1_id: 'p3', player2_id: 'p4' }, // 200 + 200 = 400
  { game_id: gameId, player1_id: 'p5', player2_id: 'p6' }, // 180 + 120 = 300
]);

const pairs = await PairsService.getByGame(gameId);
console.log(pairs.map(p => ({ ordem: p.pair_order, pontos: p.total_points })));
// Output:
// [
//   { ordem: 1, pontos: 400 },
//   { ordem: 2, pontos: 300 },
//   { ordem: 3, pontos: 250 }
// ]
```

---

## Fluxo Completo de um Jogo

```javascript
// 1. Capitão cria jogo
const game = await GamesService.create({
  round_number: 1,
  game_date: new Date('2024-03-15T19:00:00').toISOString(),
  opponent: 'Equipa Rival',
  location: 'Clube Lisboa',
  phase: 'Regular',
  created_by: captainId,
});
// → Availabilities criadas automaticamente para todos jogadores activos

// 2. Capitão abre convocatória
await GamesService.openCall(game.id);

// 3. Jogadores respondem
await AvailabilitiesService.updateByGameAndPlayer(game.id, player1Id, 'confirmo');
await AvailabilitiesService.updateByGameAndPlayer(game.id, player2Id, 'confirmo');
await AvailabilitiesService.updateByGameAndPlayer(game.id, player3Id, 'nao_posso');
// ...

// 4. Capitão verifica respostas
const summary = await AvailabilitiesService.getSummary(game.id);
console.log(summary);

// 5. Capitão fecha convocatória
await GamesService.closeCall(game.id);

// 6. Capitão define duplas
const suggestions = await PairsService.suggestPairs(game.id);
await PairsService.createMultiple(
  suggestions.map(s => ({
    game_id: game.id,
    player1_id: s.player1.id,
    player2_id: s.player2.id,
  }))
);
// → total_points e pair_order calculados automaticamente

// 7. Verificar duplas ordenadas
const pairs = await PairsService.getByGame(game.id);
console.table(pairs);

// 8. Após o jogo, capitão regista resultados
await ResultsService.createMultiple([
  { game_id: game.id, pair_id: pairs[0].id, sets_won: 2, sets_lost: 1 },
  { game_id: game.id, pair_id: pairs[1].id, sets_won: 2, sets_lost: 0 },
  { game_id: game.id, pair_id: pairs[2].id, sets_won: 1, sets_lost: 2 },
]);

// 9. Verificar resultado final
const gameSummary = await ResultsService.getGameSummary(game.id);
console.log(gameSummary); // { totalSetsWon: 5, totalSetsLost: 3, outcome: 'Vitória' }

// 10. Marcar jogo como concluído
await GamesService.complete(game.id);

// 11. Partilhar no WhatsApp
const whatsappText = GamesService.formatForWhatsApp(game);
console.log(whatsappText);
```

---

## Notas Importantes

1. **Autenticação é obrigatória**: Todas as operações requerem autenticação
2. **Roles são verificados pelo RLS**: As políticas da BD garantem que apenas capitães podem criar/editar certos dados
3. **Triggers funcionam automaticamente**: Não é necessário calcular manualmente pontos ou ordem
4. **Availabilities são criadas automaticamente**: Ao criar um jogo, não é preciso criar manualmente as disponibilidades
5. **RLS está activo**: Tentar fazer operações sem permissão resultará em erro

---

## Próximos Passos

Após validar a lógica:
1. Implementar interface de utilizador (UI)
2. Criar componentes React para cada funcionalidade
3. Adicionar navegação entre ecrãs
4. Implementar design mobile-first
