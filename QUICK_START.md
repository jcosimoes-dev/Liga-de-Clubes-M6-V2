# Quick Start - Equipa M6

Guia rápido para começar a usar a aplicação.

---

## 1. Iniciar Aplicação

```bash
npm run dev
```

Abrir no browser: `http://localhost:5173`

---

## 2. Primeiro Acesso

### 2.1 Criar Capitão (Automático)
O **primeiro utilizador** a registar-se torna-se **capitão automaticamente**.

1. Clicar em "Criar conta"
2. Preencher:
   - Email: `capitao@m6.pt`
   - Password: `teste123456`
3. Completar perfil:
   - Nome: `Maria Capitão`
   - Telemóvel: `913456789`
   - Pontos: `250`
4. Ver menu com **4 itens** (Início, Calendário, Equipa, **Admin**) ✅

**Como confirmar**: Se vir o item "Admin" no menu inferior, é capitão!

### 2.2 Criar Jogadores
1. Fazer logout (ver secção 4)
2. Criar nova conta para cada jogador
3. Completar perfis

**Exemplo de jogadores**:
- `joao@m6.pt` - João Silva - 912345678 - 200 pts
- `pedro@m6.pt` - Pedro Costa - 913456789 - 180 pts
- `ana@m6.pt` - Ana Santos - 914567890 - 220 pts

---

## 3. Criar Primeiro Jogo

1. Login como capitão (`capitao@m6.pt`)
2. Ir para **Admin** (último item do menu)
3. Preencher formulário:
   - Jornada: `1`
   - Data: Próximo sábado às 19:00
   - Adversário: `Clube Rival`
   - Local: `Padel Club Lisboa`
   - Fase: `Regular`
4. Clicar "Criar e Abrir Convocatória"
5. Jogo criado e convocatória aberta automaticamente

---

## 4. Responder Disponibilidade

### Como Capitão
1. Ir para **Início**
2. Ver card "Próximo Jogo"
3. Clicar em **Confirmo**

### Como Jogador
1. Fazer logout:
```javascript
const { supabase } = await import('./src/lib/supabase.ts');
await supabase.auth.signOut();
window.location.reload();
```
2. Login como jogador (`joao@m6.pt`)
3. Ir para **Início**
4. Clicar em **Confirmo**, **Talvez** ou **Não posso**

---

## 5. Fechar Convocatória e Definir Duplas

1. Login como capitão
2. Ir para **Calendário**
3. Clicar no jogo criado
4. Clicar "Mostrar Área do Capitão"
5. Clicar "Fechar Convocatória"
6. Clicar "Definir Duplas"
7. Seleccionar jogadores confirmados (pelo menos 2)
8. Clicar "Criar Duplas"
9. Ver duplas criadas e ordenadas automaticamente

---

## 6. Registar Resultados

1. No mesmo jogo, área do capitão
2. Clicar "Registar Resultados"
3. Para cada dupla:
   - Sets Ganhos: `2`
   - Sets Perdidos: `1`
   - Notas: `Excelente jogo!` (opcional)
4. Clicar "Guardar e Concluir Jogo"
5. Ver jogo com estado "Concluído"

---

## 7. Navegação Rápida

### Bottom Menu
- **Início** - Próximo jogo e último resultado
- **Calendário** - Lista de todos os jogos com filtros
- **Equipa** - Lista de jogadores ordenada por pontos
- **Admin** - Criar jogos (apenas capitão)

### Atalhos
- Clicar num jogo → Ver detalhes
- Clicar em "Ver detalhes" → Detalhe completo

---

## 8. Testar no Mobile

1. Abrir DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Seleccionar iPhone SE ou similar
4. Testar navegação e funcionalidades

---

## 9. Funções Úteis (Console)

### Ver Utilizador Actual
```javascript
const { supabase } = await import('./src/lib/supabase.ts');
const { data: { user } } = await supabase.auth.getUser();
console.log(user);
```

### Ver Perfil Actual
```javascript
const { data: player } = await supabase
  .from('players')
  .select('*')
  .eq('user_id', user.id)
  .single();
console.log(player);
```

### Promover Outro Jogador a Capitão
```javascript
const { supabase } = await import('./src/lib/supabase.ts');
await supabase
  .from('players')
  .update({ is_captain: true })
  .eq('email', 'jogador@m6.pt');
window.location.reload();
```

### Limpar Base de Dados
```javascript
const { supabase } = await import('./src/lib/supabase.ts');
// ATENÇÃO: Apaga todos os jogos!
const { data: games } = await supabase.from('games').select('id');
for (const game of games) {
  await supabase.from('games').delete().eq('id', game.id);
}
console.log('✅ Jogos apagados');
```

---

## 10. Checklist Rápido

- [ ] Aplicação iniciada (`npm run dev`)
- [ ] Primeiro utilizador criado (capitão automático)
- [ ] Verificado menu Admin visível
- [ ] 2+ jogadores criados
- [ ] 1 jogo criado
- [ ] Disponibilidades respondidas
- [ ] Convocatória fechada
- [ ] Duplas definidas
- [ ] Resultados registados
- [ ] Testado no mobile

---

## Próximos Passos

Ver documentação completa:
- **CAPTAIN_BOOTSTRAP.md** - Como funciona o capitão automático
- **FASE2_MOBILE_TESTS.md** - Checklist completo de testes
- **FASE2_SUMMARY.md** - Resumo da implementação
- **README.md** - Documentação geral

---

## Ajuda

### Problemas Comuns

**Não vejo o menu Admin**
- Verificar que o utilizador é capitão (is_captain = true)
- Fazer reload da página

**Erro ao criar jogo**
- Verificar que está logado como capitão
- Verificar campos obrigatórios preenchidos

**Não vejo o jogo na lista**
- Ir para Calendário
- Verificar filtros (Estado: "Todos")

**Build falha**
```bash
npm run build
```
Se houver erros, reportar no console.

---

**Pronto para usar!** 🎾
