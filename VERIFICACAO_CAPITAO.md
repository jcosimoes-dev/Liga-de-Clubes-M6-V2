# ✅ Verificação de Capitão

## Como Confirmar que é Capitão

### 1. Verificação Visual (Menu)

Após login, verificar o **menu inferior**:

```
╔════════════════════════════════════════╗
║                                        ║
║    SE VIR 4 ITENS → É CAPITÃO ✅      ║
║                                        ║
║    [Início] [Calendário] [Equipa] [Admin]
║                                        ║
╚════════════════════════════════════════╝

╔════════════════════════════════════════╗
║                                        ║
║    SE VIR 3 ITENS → NÃO É CAPITÃO ❌  ║
║                                        ║
║    [Início] [Calendário] [Equipa]     ║
║                                        ║
╚════════════════════════════════════════╝
```

---

### 2. Verificação por Console

Abrir DevTools (F12) → Console → Executar:

```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: { user } } = await supabase.auth.getUser();
const { data: player } = await supabase
  .from('players')
  .select('name, email, is_captain')
  .eq('user_id', user.id)
  .single();

console.log('═══════════════════════════════════');
console.log('👤 Nome:', player.name);
console.log('📧 Email:', player.email);
console.log('👑 Capitão:', player.is_captain ? '✅ SIM' : '❌ NÃO');
console.log('═══════════════════════════════════');
```

**Resultado esperado se for capitão**:
```
═══════════════════════════════════
👤 Nome: Maria Capitão
📧 Email: capitao@m6.pt
👑 Capitão: ✅ SIM
═══════════════════════════════════
```

---

### 3. Verificação no Ecrã Equipa

1. Ir para **Equipa** (menu inferior)
2. Procurar o seu nome na lista
3. Verificar se tem badge **"Capitão"**

---

## Funcionalidades Exclusivas do Capitão

Após ser promovido, deve ter acesso a:

### Menu Admin
- ✅ Ver item "Admin" no menu inferior
- ✅ Clicar em Admin e ver ecrã de gestão

### Criar Jogos
- ✅ Formulário "Criar Jogo" no ecrã Admin
- ✅ Criar novo jogo com todos os campos

### Fechar Convocatória
- ✅ Botão "Fechar Convocatória" no detalhe do jogo
- ✅ Fechar convocatória e selecionar jogadores

### Definir Duplas
- ✅ Formulário de duplas após fechar convocatória
- ✅ Definir 4 duplas (8 jogadores)

### Registar Resultados
- ✅ Formulário de resultados após definir duplas
- ✅ Registar pontuação de cada dupla

### Promover Outros Capitães
- ✅ Ver secção "Promover Capitão" no Admin
- ✅ Instruções para promover via console

---

## Troubleshooting

### Problema: Menu Admin não aparece

**Solução 1**: Recarregar página
```javascript
window.location.reload();
```

**Solução 2**: Fazer logout e login novamente

**Solução 3**: Verificar is_captain na base de dados
```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: { user } } = await supabase.auth.getUser();
const { data: player } = await supabase
  .from('players')
  .select('is_captain')
  .eq('user_id', user.id)
  .single();

if (!player.is_captain) {
  console.log('❌ Não é capitão. A promover...');
  await supabase
    .from('players')
    .update({ is_captain: true })
    .eq('user_id', user.id);
  window.location.reload();
} else {
  console.log('✅ É capitão mas menu não aparece. Recarregando...');
  window.location.reload();
}
```

---

### Problema: Outros utilizadores vêem Admin

**Causa**: Outros utilizadores também são capitães

**Verificar todos os capitães**:
```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: captains } = await supabase
  .from('players')
  .select('name, email, is_captain')
  .eq('is_captain', true);

console.table(captains);
```

**Remover capitão**:
```javascript
await supabase
  .from('players')
  .update({ is_captain: false })
  .eq('email', 'jogador@m6.pt');
```

---

### Problema: Nenhum utilizador é capitão

**Promover utilizador atual**:
```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: { user } } = await supabase.auth.getUser();
await supabase
  .from('players')
  .update({ is_captain: true })
  .eq('user_id', user.id);
window.location.reload();
```

---

## Checklist Final

Após promoção, verificar:

- [ ] Menu inferior mostra 4 itens
- [ ] Item "Admin" está visível
- [ ] Clicar em "Admin" abre ecrã de gestão
- [ ] Ver formulário "Criar Jogo"
- [ ] Ver secção "Promover Capitão"
- [ ] Ir para Equipa e ver badge "Capitão" no perfil
- [ ] Criar jogo de teste
- [ ] Fechar convocatória de teste
- [ ] Ver opções de duplas e resultados

---

## Segurança

### Menu Admin
O menu Admin **APENAS** aparece se:
- ✅ Utilizador está autenticado
- ✅ Player tem `is_captain = true`

**Código**: `src/components/layout/BottomNav.tsx`
```typescript
const { isCaptain } = useAuth();

if (isCaptain) {
  navItems.push({ name: 'admin', icon: Settings, label: 'Admin' });
}
```

### AuthContext
O `isCaptain` é carregado do player:
```typescript
isCaptain: player?.is_captain ?? false
```

**Código**: `src/contexts/AuthContext.tsx`

### Row Level Security (RLS)
Mesmo que alguém tente aceder às funções de capitão:
- ❌ Políticas RLS impedem criação de jogos por não-capitães
- ❌ Políticas RLS impedem fechar convocatórias
- ❌ Políticas RLS impedem criar duplas
- ❌ Políticas RLS impedem registar resultados

**Segurança garantida na base de dados!**

---

## Próximos Passos

Após confirmar que é capitão:

1. ✅ Criar primeiro jogo
2. ✅ Convidar outros jogadores a registarem-se
3. ✅ Jogadores responderem à disponibilidade
4. ✅ Fechar convocatória
5. ✅ Definir duplas
6. ✅ Registar resultados

**Documentação**:
- `QUICK_START.md` - Guia passo a passo
- `FASE2_MOBILE_TESTS.md` - Checklist de testes
- `CAPTAIN_BOOTSTRAP.md` - Detalhes técnicos

---

## Suporte

Se após seguir todos os passos ainda não conseguir:

1. Verificar se está autenticado
2. Verificar consola do browser por erros
3. Verificar base de dados (queries acima)
4. Fazer logout/login
5. Limpar cache do browser

**Último recurso**: Criar novo utilizador (será capitão automático)
