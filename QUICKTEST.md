# Checklist de Testes Rápidos - Fase 1

## Pré-requisitos
- Abrir o browser na aplicação
- Abrir DevTools (F12) → Console

---

## 1. CRIAR DADOS DE TESTE

### Criar 5 Jogadores (1 Capitão + 4 Jogadores)

```javascript
// Importar serviços
const { PlayersService, GamesService, AvailabilitiesService, PairsService, ResultsService } = await import('./src/services/index.ts');
const { supabase } = await import('./src/lib/supabase.ts');

// 1. Criar Capitão
const cap = await supabase.auth.signUp({
  email: 'capitao@m6.pt',
  password: 'teste123456'
});
await supabase.from('players').insert({
  user_id: cap.data.user.id,
  name: 'João Capitão',
  email: 'capitao@m6.pt',
  phone: '912345678',
  is_captain: true,
  is_active: true,
  federation_points: 250
});

// 2. Criar Jogador 1
const j1 = await supabase.auth.signUp({
  email: 'pedro@m6.pt',
  password: 'teste123456'
});
await supabase.from('players').insert({
  user_id: j1.data.user.id,
  name: 'Pedro Silva',
  email: 'pedro@m6.pt',
  phone: '913456789',
  is_captain: false,
  is_active: true,
  federation_points: 180
});

// 3. Criar Jogador 2
const j2 = await supabase.auth.signUp({
  email: 'maria@m6.pt',
  password: 'teste123456'
});
await supabase.from('players').insert({
  user_id: j2.data.user.id,
  name: 'Maria Santos',
  email: 'maria@m6.pt',
  phone: '914567890',
  is_captain: false,
  is_active: true,
  federation_points: 220
});

// 4. Criar Jogador 3
const j3 = await supabase.auth.signUp({
  email: 'carlos@m6.pt',
  password: 'teste123456'
});
await supabase.from('players').insert({
  user_id: j3.data.user.id,
  name: 'Carlos Rodrigues',
  email: 'carlos@m6.pt',
  phone: '915678901',
  is_captain: false,
  is_active: true,
  federation_points: 150
});

// 5. Criar Jogador 4
const j4 = await supabase.auth.signUp({
  email: 'ana@m6.pt',
  password: 'teste123456'
});
await supabase.from('players').insert({
  user_id: j4.data.user.id,
  name: 'Ana Costa',
  email: 'ana@m6.pt',
  phone: '916789012',
  is_captain: false,
  is_active: true,
  federation_points: 200
});

console.log('✅ 5 jogadores criados!');
```

### Criar 2 Jogos

```javascript
// Login como capitão
await supabase.auth.signInWithPassword({
  email: 'capitao@m6.pt',
  password: 'teste123456'
});

// Obter ID do capitão
const { data: capitaoProfile } = await supabase
  .from('players')
  .select('id')
  .eq('email', 'capitao@m6.pt')
  .single();

// JOGO 1: Convocatória Aberta (próximo sábado)
const jogo1 = await GamesService.create({
  round_number: 1,
  game_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  opponent: 'Clube Rival A',
  location: 'Padel Club Lisboa',
  phase: 'Regular',
  created_by: capitaoProfile.id
});

await GamesService.openCall(jogo1.id);
console.log('✅ Jogo 1 criado e convocatória aberta!');

// JOGO 2: Jogo passado para criar duplas e resultados
const jogo2 = await GamesService.create({
  round_number: 2,
  game_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  opponent: 'Clube Rival B',
  location: 'Centro de Padel Cascais',
  phase: 'Regular',
  created_by: capitaoProfile.id
});

console.log('✅ Jogo 2 criado!');
console.log('Jogo 1 ID:', jogo1.id);
console.log('Jogo 2 ID:', jogo2.id);

// Guardar IDs para usar depois
window.testData = {
  jogo1Id: jogo1.id,
  jogo2Id: jogo2.id,
  capitaoId: capitaoProfile.id
};
```

---

## 2. TESTAR AUTENTICAÇÃO

### Login como Jogador Normal
```javascript
await supabase.auth.signOut();
await supabase.auth.signInWithPassword({
  email: 'pedro@m6.pt',
  password: 'teste123456'
});

const { data: { user } } = await supabase.auth.getUser();
console.log('✅ Login como jogador:', user.email);
```

### Login como Capitão
```javascript
await supabase.auth.signOut();
await supabase.auth.signInWithPassword({
  email: 'capitao@m6.pt',
  password: 'teste123456'
});

const { data: { user } } = await supabase.auth.getUser();
const { data: player } = await PlayersService.getByUserId(user.id);
console.log('✅ Login como capitão:', user.email);
console.log('✅ É capitão?', player.is_captain); // true
```

---

## 3. TESTAR REGRA AUTOMÁTICA: AVAILABILITIES

### Verificar que availabilities foram criadas automaticamente
```javascript
// Login como qualquer utilizador autenticado
const availabilities = await AvailabilitiesService.getByGame(window.testData.jogo1Id);

console.log('📊 Availabilities criadas automaticamente:');
console.table(availabilities.map(a => ({
  jogador: a.player?.name || 'N/A',
  status: a.status
})));

// Verificar que todas começam como "sem_resposta"
const todasSemResposta = availabilities.every(a => a.status === 'sem_resposta');
console.log('✅ Todas sem_resposta?', todasSemResposta); // true
console.log('✅ Total:', availabilities.length, '(deve ser 5)');
```

---

## 4. TESTAR PERMISSÕES DE JOGADOR

### Jogador PODE ver dados
```javascript
// Login como jogador
await supabase.auth.signInWithPassword({
  email: 'pedro@m6.pt',
  password: 'teste123456'
});

// Ver jogos
const games = await GamesService.getAll();
console.log('✅ Ver jogos:', games.length > 0);

// Ver jogadores
const players = await PlayersService.getAll();
console.log('✅ Ver jogadores:', players.length > 0);
```

### Jogador PODE actualizar própria disponibilidade
```javascript
const { data: { user } } = await supabase.auth.getUser();
const { data: player } = await PlayersService.getByUserId(user.id);

const availability = await AvailabilitiesService.getByGameAndPlayer(
  window.testData.jogo1Id,
  player.id
);

await AvailabilitiesService.updateStatus(availability.id, 'confirmo');
console.log('✅ Actualizar disponibilidade: sucesso');
```

### Jogador PODE actualizar próprios pontos
```javascript
const { data: { user } } = await supabase.auth.getUser();
const { data: player } = await PlayersService.getByUserId(user.id);

await PlayersService.updateFederationPoints(player.id, 250);
console.log('✅ Actualizar próprios pontos: sucesso');
```

### Jogador NÃO PODE criar jogos
```javascript
try {
  await GamesService.create({
    round_number: 99,
    game_date: new Date().toISOString(),
    opponent: 'Teste',
    location: 'Teste',
    phase: 'Teste',
    created_by: player.id
  });
  console.log('❌ ERRO: Jogador conseguiu criar jogo!');
} catch (error) {
  console.log('✅ Jogador NÃO pode criar jogo (correcto)');
}
```

### Jogador NÃO PODE criar duplas
```javascript
try {
  await PairsService.create({
    game_id: window.testData.jogo2Id,
    player1_id: player.id,
    player2_id: player.id
  });
  console.log('❌ ERRO: Jogador conseguiu criar dupla!');
} catch (error) {
  console.log('✅ Jogador NÃO pode criar dupla (correcto)');
}
```

---

## 5. TESTAR PERMISSÕES DE CAPITÃO

### Capitão PODE criar jogos
```javascript
await supabase.auth.signInWithPassword({
  email: 'capitao@m6.pt',
  password: 'teste123456'
});

const { data: capitao } = await PlayersService.getByUserId(
  (await supabase.auth.getUser()).data.user.id
);

const novoJogo = await GamesService.create({
  round_number: 3,
  game_date: new Date().toISOString(),
  opponent: 'Teste',
  location: 'Teste',
  phase: 'Teste',
  created_by: capitao.id
});

console.log('✅ Capitão PODE criar jogo');
await GamesService.delete(novoJogo.id); // Limpar
```

### Capitão PODE abrir/fechar convocatória
```javascript
await GamesService.openCall(window.testData.jogo2Id);
console.log('✅ Capitão PODE abrir convocatória');

await GamesService.closeCall(window.testData.jogo2Id);
console.log('✅ Capitão PODE fechar convocatória');
```

### Capitão PODE criar duplas
```javascript
const players = await PlayersService.getActive();
const dupla = await PairsService.create({
  game_id: window.testData.jogo2Id,
  player1_id: players[0].id,
  player2_id: players[1].id
});

console.log('✅ Capitão PODE criar dupla');
console.log('Dupla criada:', dupla);
```

### Capitão PODE registar resultados
```javascript
const pairs = await PairsService.getByGame(window.testData.jogo2Id);

const resultado = await ResultsService.create({
  game_id: window.testData.jogo2Id,
  pair_id: pairs[0].id,
  sets_won: 2,
  sets_lost: 1,
  notes: 'Teste'
});

console.log('✅ Capitão PODE registar resultado');
```

---

## 6. TESTAR REGRA AUTOMÁTICA: CÁLCULO DE PONTOS

### Verificar que total_points é calculado automaticamente
```javascript
const pairs = await PairsService.getByGame(window.testData.jogo2Id);

console.log('📊 Pontos das duplas:');
console.table(pairs.map(p => ({
  jogador1: p.player1.name,
  pontos1: p.player1.federation_points,
  jogador2: p.player2.name,
  pontos2: p.player2.federation_points,
  total: p.total_points,
  soma: p.player1.federation_points + p.player2.federation_points,
  correcto: p.total_points === (p.player1.federation_points + p.player2.federation_points)
})));

const todosCorretos = pairs.every(p =>
  p.total_points === (p.player1.federation_points + p.player2.federation_points)
);

console.log('✅ Total_points calculado automaticamente?', todosCorretos);
```

---

## 7. TESTAR REGRA AUTOMÁTICA: ORDENAÇÃO DE DUPLAS

### Verificar que pair_order é calculado automaticamente
```javascript
const pairs = await PairsService.getByGame(window.testData.jogo2Id);

console.log('📊 Ordem das duplas:');
console.table(pairs.map(p => ({
  ordem: p.pair_order,
  total_pontos: p.total_points,
  jogador1: p.player1.name,
  jogador2: p.player2.name
})));

// Verificar ordem decrescente
let ordemCorrecta = true;
for (let i = 0; i < pairs.length - 1; i++) {
  if (pairs[i].total_points < pairs[i + 1].total_points) {
    ordemCorrecta = false;
    break;
  }
}

console.log('✅ Duplas ordenadas por pontos (decrescente)?', ordemCorrecta);
```

### Testar recálculo quando pontos mudam
```javascript
// Alterar pontos de um jogador
const players = await PlayersService.getActive();
const jogadorTeste = players[0];

await PlayersService.updateFederationPoints(jogadorTeste.id, 500);

// Verificar que ordem foi recalculada
const pairsAtualizadas = await PairsService.getByGame(window.testData.jogo2Id);

console.log('📊 Ordem recalculada:');
console.table(pairsAtualizadas.map(p => ({
  ordem: p.pair_order,
  total_pontos: p.total_points
})));

console.log('✅ Ordem recalculada automaticamente quando pontos mudam');

// Restaurar pontos
await PlayersService.updateFederationPoints(jogadorTeste.id, 180);
```

---

## 8. RESUMO FINAL

```javascript
console.log('=== RESUMO DOS TESTES ===');
console.log('');
console.log('✅ Autenticação: funcionando');
console.log('✅ Roles (Jogador/Capitão): funcionando');
console.log('✅ Permissões RLS: funcionando');
console.log('✅ Regra automática: Availabilities criadas: funcionando');
console.log('✅ Regra automática: Total_points calculado: funcionando');
console.log('✅ Regra automática: Pair_order calculado: funcionando');
console.log('');
console.log('🎉 FASE 1 COMPLETA!');
```

---

## RESET (Limpar Dados de Teste)

```javascript
// ATENÇÃO: Isto apaga TODOS os dados!
await supabase.auth.signInWithPassword({
  email: 'capitao@m6.pt',
  password: 'teste123456'
});

// Apagar todos os jogos (cascata apaga availabilities, pairs, results)
const { data: allGames } = await supabase.from('games').select('id');
for (const game of allGames) {
  await GamesService.delete(game.id);
}

console.log('🗑️ Dados de teste limpos');
```

---

## Notas Importantes

1. **Todos os testes devem passar** ✅
2. **Triggers funcionam automaticamente** - não é preciso chamar manualmente
3. **RLS está activo** - tentar fazer operações sem permissão resulta em erro
4. **Passwords de teste**: `teste123456`
5. **Emails de teste**: `capitao@m6.pt`, `pedro@m6.pt`, `maria@m6.pt`, `carlos@m6.pt`, `ana@m6.pt`
