# Bootstrap do Capitão - Guia Rápido

## Como Confirmar que é Capitão

### ✅ Método 1: Menu Visual (Mais Fácil)

Após fazer login, verificar o **menu inferior**:

- **É Capitão**: Ver 4 itens → Início | Calendário | Equipa | **Admin**
- **Não é Capitão**: Ver 3 itens → Início | Calendário | Equipa

---

### ✅ Método 2: Console do Browser

1. Abrir DevTools (pressionar **F12**)
2. Ir para tab **Console**
3. Copiar e colar:

```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: { user } } = await supabase.auth.getUser();
const { data: player } = await supabase
  .from('players')
  .select('*')
  .eq('user_id', user.id)
  .single();

console.log('🎯 Nome:', player.name);
console.log('📧 Email:', player.email);
console.log('👑 É Capitão:', player.is_captain);
```

**Resultado esperado se for capitão**:
```
🎯 Nome: Maria Capitão
📧 Email: capitao@m6.pt
👑 É Capitão: true
```

---

### ✅ Método 3: Ecrã Equipa

1. Ir para **Equipa** (menu inferior)
2. Ver a sua entrada na lista
3. Se tiver badge **"Capitão"** → É capitão ✅

---

## Como Funciona

### Bootstrap Automático

O **primeiro utilizador** a registar-se na aplicação torna-se **capitão automaticamente**.

Isto acontece através de:
- Trigger na base de dados
- Executa antes de inserir jogador
- Verifica se é o primeiro (count = 0)
- Se sim, marca `is_captain = true`

**Sem configuração manual necessária!**

---

## Promover Outro Jogador a Capitão

### Via Console (Recomendado)

```javascript
const { supabase } = await import('./src/lib/supabase.ts');

// Promover por email
await supabase
  .from('players')
  .update({ is_captain: true })
  .eq('email', 'jogador@m6.pt');

window.location.reload();
```

### Via Ecrã Admin

1. Login como capitão
2. Ir para **Admin**
3. Ver secção "Promover Capitão"
4. Copiar código
5. Executar no console

---

## Troubleshooting

### Não vejo menu Admin

**Verificar se é capitão**:
```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: { user } } = await supabase.auth.getUser();
const { data: player } = await supabase
  .from('players')
  .select('is_captain, name')
  .eq('user_id', user.id)
  .single();

console.log(player);
```

**Se `is_captain = false`, promover manualmente**:
```javascript
await supabase
  .from('players')
  .update({ is_captain: true })
  .eq('user_id', user.id);

window.location.reload();
```

### Ver Todos os Capitães

```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: captains } = await supabase
  .from('players')
  .select('name, email, is_captain')
  .eq('is_captain', true);

console.table(captains);
```

---

## Documentação Completa

Ver **CAPTAIN_BOOTSTRAP.md** para:
- Explicação técnica detalhada
- Múltiplos capitães
- Remover capitão
- Casos extremos
- Segurança e RLS

---

## Resumo

1. **Primeiro utilizador** → Capitão automático ✅
2. **Verificar**: Ver menu Admin ou console
3. **Promover outros**: Via console com email
4. **Múltiplos capitães**: Permitido

**Mais simples**: Registar e está feito!
