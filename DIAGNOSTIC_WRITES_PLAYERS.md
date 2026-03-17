# Escritas na tabela `players` (runtime)

Lista exata de todos os pontos no código que fazem INSERT/UPDATE/UPSERT em `players`, com condição e se enviam `role='jogador'`.

---

## 1. AuthContext — ensurePlayerProfile

- **Ficheiro:** `src/contexts/AuthContext.tsx`
- **Função:** `ensurePlayerProfile`
- **Condição:** `fetchPlayerByUserId(userId)` retorna `null`; depois de tentar associar por email (RPC), ainda não há perfil.
- **Operação:** `supabase.from('players').insert(payload)`
- **Payload:** `user_id`, `name`, `email`, `role: PlayerRoles.jogador`, `team_id`, `is_active`, `federation_points`, `preferred_side`, `profile_completed: false`
- **Envia role='jogador'?** Sim — apenas em INSERT quando não existe linha para este `user_id` (e após tentativa de link por email).

---

## 2. AuthContext — link por email (RPC)

- **Ficheiro:** `src/contexts/AuthContext.tsx`
- **Função:** `ensurePlayerProfile`
- **Condição:** Existe uma linha em `players` com o mesmo email e `user_id` diferente do auth; RPC `link_player_profile_by_email` existe e corre.
- **Operação:** `supabase.rpc('link_player_profile_by_email')` → no backend: `UPDATE players SET user_id = auth.uid() WHERE ...`
- **Payload:** Não envia role; só atualiza `user_id`.
- **Envia role='jogador'?** Não.

---

## 3. RegisterScreen — registo novo (sem 409)

- **Ficheiro:** `src/screens/RegisterScreen.tsx`
- **Função:** handler de submit do registo
- **Condição:** Registo novo; `existingPlayer` por `user_id` não existe; então `else` com `upsert`.
- **Operação:** `supabase.from('players').upsert(payload, { onConflict: 'user_id' })`
- **Payload:** `user_id`, `team_id`, `name`, `email`, `phone`, `preferred_side`, `federation_points`, `is_active`, `role: PlayerRoles.jogador`, `profile_completed: true`
- **Envia role='jogador'?** Sim — em conflito o upsert faz UPDATE e pode sobrescrever role (evitar: usar insert quando não existe, ou lógica como CompleteProfileScreen).

---

## 4. RegisterScreen — já registado (409) e sem linha em players

- **Ficheiro:** `src/screens/RegisterScreen.tsx`
- **Função:** handler de registo, ramo `is409`, após `signIn` e `refreshPlayer`
- **Condição:** `existingUid && !existingPlayer` (existe sessão mas não existe linha com esse `user_id`).
- **Operação:** `supabase.from('players').upsert(..., { onConflict: 'user_id' })`
- **Payload:** inclui `role: PlayerRoles.jogador`
- **Envia role='jogador'?** Sim — pode criar/sobrescrever.

---

## 5. CompleteProfileScreen

- **Ficheiro:** `src/screens/CompleteProfileScreen.tsx`
- **Função:** `onSubmit`
- **Condição (update):** `player?.id` existe → `PlayersService.updateProfile(...)` (sem role).
- **Condição (insert):** `!player?.id` e não existe linha por `user_id` → `insert(payload)` com `role: PlayerRoles.jogador`.
- **Condição (update existente):** `!player?.id` mas existe linha por `user_id` → `update` apenas campos seguros (sem role).
- **Envia role='jogador'?** Só no INSERT de novo perfil; nunca no update de linha existente.

---

## 6. PlayersService.upsertProfile

- **Ficheiro:** `src/services/players.service.ts`
- **Função:** `upsertProfile`
- **Condição:** Chamado por terceiros (não usado atualmente no projeto). Se existir linha por `user_id`: update sem role; se não: insert com role jogador.
- **Envia role='jogador'?** Apenas no INSERT.

---

## 7. PlayersService.updateProfile / updateRole / activate / deactivate

- **Ficheiro:** `src/services/players.service.ts`
- **Função:** `updateProfile`, `updateRole`, `activate`, `deactivate`
- **Payload:** `updateProfile` não envia role; `updateRole` envia o role escolhido (pode ser admin).
- **Envia role='jogador'?** Só se for explicitamente passado em `updateRole`.

---

## 8. adminAuth.updatePlayerProfileAdmin

- **Ficheiro:** `src/services/adminAuth.ts`
- **Função:** `updatePlayerProfileAdmin`
- **Condição:** Admin edita perfil de outro jogador; payload pode incluir `role` (está em ALLOWED_PROFILE_UPDATE_KEYS).
- **Envia role='jogador'?** Só se o caller passar `role: 'jogador'` no objeto updates.

---

## 9. AddPlayerModal

- **Ficheiro:** `src/components/ui/AddPlayerModal.tsx`
- **Função:** submit do modal "Adicionar Jogador"
- **Operação:** `supabase.from('players').upsert(..., { onConflict: 'user_id' })`
- **Payload:** inclui `role` (variável do formulário).
- **Envia role='jogador'?** Conforme o valor escolhido no formulário (pode ser jogador ou outro).

---

## 10. PlayersService.createCoordinator

- **Ficheiro:** `src/services/players.service.ts`
- **Função:** `createCoordinator`
- **Condição:** Admin cria novo coordenador (novo user no Auth); upsert em players com o novo `user_id`.
- **Payload:** inclui `role: PlayerRoles.jogador` (o coordenador é criado como jogador e depois promovido noutro fluxo, ou o payload pode ser ajustado).
- **Envia role='jogador'?** Sim — para o novo user criado naquele momento.

---

## Resumo para overwrite do admin → jogador

- **Causa mais provável (confirmada pelos logs):** Não existir linha em `players` com `user_id = auth.uid()` do admin (linha do admin com `user_id` antigo ou null). Então `ensurePlayerProfile` faz **INSERT** com `role: jogador` → aparece uma segunda linha “do” admin com role jogador; a app usa sempre a linha com `user_id = auth.uid()`, por isso o admin aparece como jogador.
- **Correção aplicada:** Antes do INSERT, procurar por email; se existir uma linha com esse email, chamar RPC `link_player_profile_by_email` para atualizar `user_id` para `auth.uid()` e usar essa linha (mantendo role admin). Assim não se cria segunda linha nem se escreve jogador por cima do admin.
