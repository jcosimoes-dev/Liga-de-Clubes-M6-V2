# Bootstrap do Capitão

## Como Funciona

### Primeiro Utilizador = Capitão Automático

O **primeiro utilizador** a registar-se na aplicação torna-se **automaticamente Capitão**.

Isto é feito através de um trigger na base de dados que:
1. Verifica se é o primeiro jogador a ser inserido
2. Se sim, marca `is_captain = true` automaticamente
3. Não requer nenhuma acção manual

---

## Como Confirmar que é Capitão

### Método 1: Verificar Menu
1. Fazer login
2. Verificar bottom navigation
3. **Se vir 4 itens** (Início, Calendário, Equipa, **Admin**) → É Capitão ✅
4. **Se vir 3 itens** (sem Admin) → Não é Capitão ❌

### Método 2: Console do Browser
1. Abrir DevTools (F12)
2. Ir para Console
3. Executar:

```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: { user } } = await supabase.auth.getUser();
const { data: player } = await supabase
  .from('players')
  .select('*')
  .eq('user_id', user.id)
  .single();

console.log('É Capitão:', player.is_captain);
console.log('Nome:', player.name);
console.log('Email:', player.email);
```

**Resultado esperado**:
```
É Capitão: true
Nome: João Silva
Email: joao@m6.pt
```

### Método 3: Ver Badge na Equipa
1. Ir para ecrã **Equipa**
2. Ver a sua entrada na lista
3. **Se tiver badge "Capitão"** → É Capitão ✅

---

## Promover Outro Jogador a Capitão

Pode existir **mais do que um capitão**.

### Via Console (Recomendado)
1. Abrir DevTools (F12)
2. Ir para Console
3. Executar:

```javascript
const { supabase } = await import('./src/lib/supabase.ts');

// Promover por email
await supabase
  .from('players')
  .update({ is_captain: true })
  .eq('email', 'maria@m6.pt');

// OU promover por nome
await supabase
  .from('players')
  .update({ is_captain: true })
  .eq('name', 'Maria Santos');

window.location.reload();
```

### Via Ecrã Admin
1. Login como capitão
2. Ir para **Admin**
3. Ver secção "Promover Capitão"
4. Copiar código do console
5. Substituir email
6. Executar no console

---

## Remover Capitão

Para remover privilégios de capitão:

```javascript
const { supabase } = await import('./src/lib/supabase.ts');

await supabase
  .from('players')
  .update({ is_captain: false })
  .eq('email', 'jogador@m6.pt');

window.location.reload();
```

**ATENÇÃO**: Certifique-se que existe pelo menos 1 capitão activo!

---

## Cenários Comuns

### Cenário 1: Primeira Vez (App Vazia)
1. Registar primeiro utilizador
2. Completar perfil
3. Automaticamente é capitão
4. Ver menu Admin disponível

### Cenário 2: Já Existem Jogadores
1. Registar novo utilizador
2. Completar perfil
3. **NÃO** é capitão (porque não é o primeiro)
4. Não vê menu Admin
5. Capitão existente pode promovê-lo via console

### Cenário 3: Múltiplos Capitães
1. Primeiro utilizador é capitão
2. Promover outros jogadores via console
3. Todos os capitães vêem menu Admin
4. Todos podem gerir jogos, duplas, resultados

---

## Verificação Rápida da BD

Ver todos os capitães:

```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: captains } = await supabase
  .from('players')
  .select('name, email, is_captain')
  .eq('is_captain', true);

console.table(captains);
```

Ver total de jogadores:

```javascript
const { data: players } = await supabase
  .from('players')
  .select('name, email, is_captain');

console.table(players);
```

---

## Troubleshooting

### Não vejo menu Admin mas sou o primeiro utilizador

1. Verificar no console:
```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: players } = await supabase
  .from('players')
  .select('*')
  .order('created_at', { ascending: true });

console.log('Primeiro jogador:', players[0]);
console.log('É capitão?', players[0].is_captain);
```

2. Se `is_captain = false`, promover manualmente:
```javascript
await supabase
  .from('players')
  .update({ is_captain: true })
  .eq('id', players[0].id);

window.location.reload();
```

### Vários utilizadores mas nenhum é capitão

Promover o primeiro manualmente:

```javascript
const { supabase } = await import('./src/lib/supabase.ts');

// Ver todos
const { data: players } = await supabase
  .from('players')
  .select('*')
  .order('created_at', { ascending: true });

console.log('Jogadores:', players.map(p => ({ name: p.name, captain: p.is_captain })));

// Promover o primeiro
await supabase
  .from('players')
  .update({ is_captain: true })
  .eq('id', players[0].id);

window.location.reload();
```

### Quero mudar o capitão

1. Remover privilégios do actual:
```javascript
const { supabase } = await import('./src/lib/supabase.ts');
await supabase
  .from('players')
  .update({ is_captain: false })
  .eq('email', 'antigo@m6.pt');
```

2. Promover novo:
```javascript
await supabase
  .from('players')
  .update({ is_captain: true })
  .eq('email', 'novo@m6.pt');

window.location.reload();
```

---

## Segurança

### Row Level Security (RLS)

- Apenas **jogadores autenticados** podem ver outros jogadores
- Apenas **capitães** podem criar/editar jogos
- Apenas **capitães** podem fechar convocatórias
- Apenas **capitães** podem criar duplas
- Apenas **capitães** podem registar resultados
- **Qualquer jogador** pode responder à sua própria disponibilidade

### Permissões do Capitão

O capitão tem acesso a:
- ✅ Menu Admin
- ✅ Criar jogos
- ✅ Fechar convocatória
- ✅ Definir duplas
- ✅ Registar resultados
- ✅ Ver todas as disponibilidades
- ✅ Promover outros capitães (via console)

---

## Resumo

✅ **Primeiro utilizador** → Capitão automático
✅ **Verificar status** → Menu Admin ou console
✅ **Promover outros** → Via console com email
✅ **Múltiplos capitães** → Permitido
✅ **Remover capitão** → Via console (manter pelo menos 1)

**Mais fácil**: Simplesmente registar o primeiro utilizador e está feito!
