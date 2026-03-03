# 👑 PROMOVER-ME A CAPITÃO AGORA

## ⚡ INSTRUÇÕES RÁPIDAS

### 1. Abrir Console
Pressionar **F12** → Tab **Console**

### 2. Copiar e Colar Este Código

```javascript
// PROMOÇÃO IMEDIATA DO UTILIZADOR ACTUAL
(async () => {
  try {
    const { supabase } = await import('./src/lib/supabase.ts');

    // Obter utilizador actual
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Erro ao obter utilizador:', userError);
      return;
    }

    console.log('👤 Utilizador:', user.email);

    // Promover a capitão
    const { error: updateError } = await supabase
      .from('players')
      .update({ is_captain: true })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('❌ Erro ao promover:', updateError);
      return;
    }

    console.log('✅ PROMOVIDO A CAPITÃO COM SUCESSO!');
    console.log('🔄 A recarregar aplicação...');

    // Reload automático
    setTimeout(() => {
      window.location.reload();
    }, 1000);

  } catch (err) {
    console.error('❌ Erro:', err);
  }
})();
```

### Passo 3: Pressionar Enter

A aplicação irá:
1. Promover o seu utilizador a capitão
2. Mostrar mensagem de sucesso
3. Recarregar automaticamente

### Passo 4: Confirmar

Após o reload, ver menu inferior com **4 itens**:
- Início
- Calendário
- Equipa
- **Admin** ✅

---

## 📋 Verificação Manual (Opcional)

Para confirmar que é capitão:

```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: { user } } = await supabase.auth.getUser();
const { data: player } = await supabase
  .from('players')
  .select('name, email, is_captain')
  .eq('user_id', user.id)
  .single();

console.log('👑 Status Capitão:', player.is_captain);
console.log('📧 Email:', player.email);
console.log('🎯 Nome:', player.name);
```

---

## ⚠️ IMPORTANTE

**Este script é apenas para bootstrap inicial!**

- Use apenas UMA VEZ para promover o primeiro capitão
- Depois de ter um capitão, use o ecrã Admin para promover outros
- Não partilhe este script com jogadores normais
- Após promoção bem-sucedida, pode apagar este ficheiro

---

## 🔧 Troubleshooting

### Erro: "Cannot find module"

Se aparecer erro de módulo, tente:

```javascript
const supabase = window.supabase || (() => {
  const { createClient } = window.supabaseJs;
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
})();

const { data: { user } } = await supabase.auth.getUser();
await supabase.from('players').update({ is_captain: true }).eq('user_id', user.id);
window.location.reload();
```

### Não Funciona?

Verificar se está autenticado:

```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: { user } } = await supabase.auth.getUser();
console.log('Autenticado:', !!user);
console.log('Email:', user?.email);
```

Se não estiver autenticado:
1. Fazer login na aplicação primeiro
2. Depois executar o script de promoção

---

## ✅ Próximos Passos

Após promoção bem-sucedida:

1. ✅ Ver menu Admin
2. ✅ Ir para Admin
3. ✅ Criar primeiro jogo
4. ✅ Usar secção "Promover Capitão" para futuros capitães

**Este ficheiro pode ser apagado após bootstrap.**
