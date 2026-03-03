# FASE 2 - Checklist de Testes Mobile

## Pré-requisitos
- Aplicação a correr (`npm run dev`)
- Abrir no browser mobile ou usar DevTools (F12) → Toggle device toolbar (Ctrl+Shift+M)
- Configurar viewport para 375x667 (iPhone SE) ou similar

---

## 1. REGISTO E LOGIN

### 1.1 Criar Primeiro Utilizador (Capitão Automático)
**IMPORTANTE**: O primeiro utilizador torna-se capitão automaticamente!

- [ ] Abrir aplicação
- [ ] Ver ecrã de Login
- [ ] Clicar em "Criar conta"
- [ ] Preencher:
  - Email: `capitao@m6.pt`
  - Password: `teste123456`
  - Confirmar Password: `teste123456`
- [ ] Clicar em "Criar conta"
- [ ] Redireccionado para "Complete o seu perfil"

### 1.2 Completar Perfil do Capitão
- [ ] Preencher:
  - Nome: `Maria Capitão`
  - Telemóvel: `913456789`
  - Pontos de Federação: `250`
- [ ] Clicar em "Continuar"
- [ ] Redireccionado para ecrã Início
- [ ] Ver bottom navigation com **4 itens** (Início, Calendário, Equipa, **Admin**) ✅
- [ ] Confirmar que é capitão vendo o item "Admin"

### 1.3 Criar Jogador Normal
- [ ] Fazer logout (ver instruções na secção 7)
- [ ] Registar nova conta:
  - Email: `jogador@m6.pt`
  - Password: `teste123456`
- [ ] Completar perfil:
  - Nome: `João Jogador`
  - Telemóvel: `912345678`
  - Pontos: `200`
- [ ] Redireccionado para ecrã Início
- [ ] Ver bottom navigation com **3 itens** (Início, Calendário, Equipa) ✅
- [ ] Confirmar que NÃO é capitão (sem item "Admin")

---

## 2. NAVEGAÇÃO

### 2.1 Bottom Navigation
- [ ] Clicar em cada item do menu:
  - [ ] Início → Ver ecrã de Início
  - [ ] Calendário → Ver lista de jogos
  - [ ] Equipa → Ver lista de jogadores
  - [ ] Admin (só capitão) → Ver formulário criar jogo

### 2.2 Estados Visuais
- [ ] Item activo destacado a azul
- [ ] Outros itens a cinzento
- [ ] Transição suave entre ecrãs

---

## 3. CRIAR JOGO (CAPITÃO)

### 3.1 Formulário
- [ ] Login como capitão (`capitao@m6.pt`)
- [ ] Ir para Admin
- [ ] Preencher formulário:
  - Jornada: `1`
  - Data: Próximo sábado, 19:00
  - Adversário: `Clube Rival`
  - Local: `Padel Club Lisboa`
  - Fase: `Regular`
- [ ] Clicar em "Criar e Abrir Convocatória"
- [ ] Redireccionado para detalhe do jogo
- [ ] Ver badge "Aberta"

### 3.2 Verificar Availabilities
- [ ] Ver secção "Disponibilidades"
- [ ] Ver todos os jogadores com "Sem resposta"
- [ ] Total: 2 jogadores (João + Maria)

---

## 4. RESPONDER DISPONIBILIDADE

### 4.1 Como Jogador
- [ ] Fazer logout
- [ ] Login como jogador (`teste1@m6.pt`)
- [ ] Ir para Início
- [ ] Ver card "Próximo Jogo"
- [ ] Clicar num dos 3 botões:
  - [ ] Confirmo (verde)
  - [ ] Talvez (amarelo)
  - [ ] Não posso (vermelho)
- [ ] Ver botão seleccionado destacado
- [ ] Clicar em "Ver detalhes"
- [ ] Ver a sua disponibilidade actualizada na lista

### 4.2 Como Capitão
- [ ] Fazer logout
- [ ] Login como capitão (`capitao@m6.pt`)
- [ ] Ir para Calendário
- [ ] Clicar no jogo criado
- [ ] Marcar disponibilidade como "Confirmo"
- [ ] Ver 2 jogadores confirmados na lista

---

## 5. FECHAR CONVOCATÓRIA E CRIAR DUPLAS (CAPITÃO)

### 5.1 Fechar Convocatória
- [ ] Como capitão, abrir detalhe do jogo
- [ ] Clicar em "Mostrar Área do Capitão"
- [ ] Ver botão "Fechar Convocatória"
- [ ] Clicar no botão
- [ ] Badge muda para "Fechada"
- [ ] Ver botão "Definir Duplas"

### 5.2 Definir Duplas
- [ ] Clicar em "Definir Duplas"
- [ ] Ver lista de jogadores confirmados
- [ ] Seleccionar 2 jogadores (checkbox)
- [ ] Ver contador "(2 jogadores)"
- [ ] Clicar em "Criar Duplas"
- [ ] Ver nova secção "Duplas (1)"
- [ ] Ver:
  - Dupla 1
  - Nomes dos 2 jogadores
  - Pontos individuais
  - Total de pontos
  - Badge com total

### 5.3 Verificar Ordem Automática
- [ ] Criar mais jogadores com pontos diferentes (via console ou UI)
- [ ] Criar duplas
- [ ] Verificar que duplas aparecem ordenadas por pontos (decrescente)
- [ ] Dupla com mais pontos é Dupla 1, etc.

---

## 6. REGISTAR RESULTADOS (CAPITÃO)

### 6.1 Formulário de Resultados
- [ ] Como capitão, no detalhe do jogo
- [ ] Ver botão "Registar Resultados" (só aparece se há duplas)
- [ ] Clicar no botão
- [ ] Ver formulário para cada dupla:
  - [ ] Sets Ganhos (0-3)
  - [ ] Sets Perdidos (0-3)
  - [ ] Notas (opcional)

### 6.2 Preencher e Guardar
- [ ] Dupla 1:
  - Sets Ganhos: `2`
  - Sets Perdidos: `1`
  - Notas: `Excelente jogo!`
- [ ] Clicar em "Guardar e Concluir Jogo"
- [ ] Badge muda para "Concluído"
- [ ] Ver nova secção "Resultados"
- [ ] Ver badge verde "2 - 1" na dupla

---

## 7. ECRÃ CALENDÁRIO

### 7.1 Lista de Jogos
- [ ] Ir para Calendário
- [ ] Ver todos os jogos criados
- [ ] Ver para cada jogo:
  - [ ] Jornada
  - [ ] Badge de estado
  - [ ] Data e hora
  - [ ] Adversário
  - [ ] Local
  - [ ] Badge de fase

### 7.2 Filtros
- [ ] Testar filtro de Estado:
  - [ ] Seleccionar "Aberta"
  - [ ] Ver apenas jogos com convocatória aberta
  - [ ] Seleccionar "Concluído"
  - [ ] Ver apenas jogos concluídos
- [ ] Testar filtro de Fase:
  - [ ] Seleccionar "Regular"
  - [ ] Ver apenas jogos da fase regular

### 7.3 Navegação
- [ ] Clicar num jogo
- [ ] Redireccionado para detalhe
- [ ] Ver botão "Voltar"
- [ ] Clicar em "Voltar"
- [ ] Voltar para Calendário

---

## 8. ECRÃ EQUIPA

### 8.1 Lista de Jogadores
- [ ] Ir para Equipa
- [ ] Ver lista de todos os jogadores
- [ ] Ver para cada jogador:
  - [ ] Nome
  - [ ] Telemóvel
  - [ ] Pontos de federação
  - [ ] Badge "Capitão" (se aplicável)
  - [ ] Número de ranking (#1, #2, etc)

### 8.2 Ordenação
- [ ] Verificar que jogadores estão ordenados por pontos (decrescente)
- [ ] Jogador com mais pontos é #1

---

## 9. FLUXO COMPLETO

### 9.1 Criar Jogo Completo
- [ ] Login como capitão
- [ ] Criar novo jogo (Admin)
- [ ] Ver jogo na Início
- [ ] Responder disponibilidade "Confirmo"
- [ ] Login como jogador
- [ ] Responder disponibilidade "Confirmo"
- [ ] Login como capitão
- [ ] Fechar convocatória
- [ ] Definir duplas (2 jogadores)
- [ ] Registar resultados
- [ ] Ver jogo concluído no Calendário
- [ ] Ver resultados no detalhe

---

## 10. TESTES DE UI/UX

### 10.1 Responsividade
- [ ] Testar em diferentes tamanhos:
  - [ ] 320px (iPhone 5/SE)
  - [ ] 375px (iPhone 6/7/8)
  - [ ] 414px (iPhone Plus)
- [ ] Verificar que nada quebra
- [ ] Texto legível
- [ ] Botões clicáveis

### 10.2 Touch Targets
- [ ] Todos os botões têm pelo menos 44x44px
- [ ] Fácil clicar com o dedo
- [ ] Espaçamento adequado entre elementos

### 10.3 Estados de Loading
- [ ] Ver spinner ao carregar dados
- [ ] Ver texto "A carregar..."
- [ ] Sem flash de conteúdo

### 10.4 Feedback Visual
- [ ] Botões mudam de cor ao clicar (active state)
- [ ] Badges com cores apropriadas:
  - [ ] Azul: Aberta
  - [ ] Amarelo: Fechada
  - [ ] Verde: Concluído
  - [ ] Vermelho: Cancelado
- [ ] Disponibilidades com ícones e cores:
  - [ ] Verde: Confirmo
  - [ ] Vermelho: Não posso
  - [ ] Amarelo: Talvez
  - [ ] Cinzento: Sem resposta

---

## 11. CASOS EXTREMOS

### 11.1 Sem Dados
- [ ] Ver "Sem jogos agendados" quando não há jogos
- [ ] Ver "Sem jogadores" quando não há jogadores
- [ ] Ver "Sem duplas" quando jogo não tem duplas

### 11.2 Muitos Jogadores
- [ ] Criar 10+ jogadores
- [ ] Ver scroll suave na lista
- [ ] Ver todos os jogadores

### 11.3 Logout
```javascript
// Console
const { supabase } = await import('./src/lib/supabase.ts');
await supabase.auth.signOut();
window.location.reload();
```
- [ ] Redireccionado para Login
- [ ] Não consegue aceder a ecrãs protegidos

---

## 12. CHECKLIST FINAL

- [ ] Todas as funcionalidades testadas
- [ ] UI mobile-first funcional
- [ ] Navegação fluida
- [ ] Sem erros no console
- [ ] Build sem erros (`npm run build`)
- [ ] Performance aceitável

---

## RESET (Limpar Base de Dados)

Para recomeçar os testes:

```javascript
// Console (como capitão)
const { supabase } = await import('./src/lib/supabase.ts');

// Apagar todos os jogos (cascata apaga availabilities, pairs, results)
const { data: games } = await supabase.from('games').select('id');
for (const game of games) {
  await supabase.from('games').delete().eq('id', game.id);
}

console.log('✅ Dados limpos');
```

---

## Resultado Esperado

✅ Aplicação funcional no mobile
✅ Todos os fluxos completos
✅ UI limpa e profissional
✅ Sem bugs críticos
