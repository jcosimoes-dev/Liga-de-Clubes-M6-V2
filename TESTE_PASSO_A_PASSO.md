# Teste Passo-a-Passo: Bootstrap Admin

## CRÍTICO: Leia TUDO Antes de Começar

Este guia vai ajudá-lo a testar e diagnosticar o problema com o botão "Configurar Sistema".

---

## Passo 1: Preparar Ambiente

### 1.1 - Limpar Cache Completo
1. Fechar TODOS os separadores do browser com a aplicação
2. Abrir Developer Tools (F12)
3. Ir a "Application" (Chrome) ou "Storage" (Firefox)
4. Clicar em "Clear site data" ou similar
5. Fechar o browser completamente
6. Reabrir o browser

### 1.2 - Abrir Console ANTES de Carregar a Página
1. Abrir browser
2. **PRIMEIRO:** Abrir Developer Tools (F12)
3. Ir ao tab "Console"
4. Clicar no ícone "⚙️" (Settings) e **desativar** qualquer filtro
5. Garantir que vê logs de todos os níveis (Verbose, Info, Warnings, Errors)
6. **DEPOIS:** Carregar a aplicação

---

## Passo 2: Fazer Login

### 2.1 - Login
1. Fazer login com credenciais válidas
2. **VERIFICAR NA CONSOLA:** Deve ver logs do tipo `[AuthContext]` ou similar
3. **VERIFICAR URL:** Deve estar em `#home` ou `/#home`

### 2.2 - Confirmar HomeScreen
1. Deve ver a página "Início"
2. Deve ver um card azul "Configuração Inicial" com:
   - Ícone de escudo (Shield)
   - Texto "Promova-se a Administrador para gerir equipas..."
   - Botão "Configurar Sistema"

**SE NÃO VIR O CARD:** Já é admin! Este processo só funciona para não-admins.

---

## Passo 3: Clicar "Configurar Sistema"

### 3.1 - Antes de Clicar
1. **LIMPAR A CONSOLA:** Clicar no botão 🚫 "Clear console"
2. Garantir que a consola está visível
3. Tab "Network" deve estar aberto em paralelo (noutra janela ou split)

### 3.2 - Clicar no Botão
1. Clicar UMA VEZ no botão "Configurar Sistema"
2. **IMEDIATAMENTE OLHAR PARA A CONSOLA**

### 3.3 - Logs Esperados na Consola

Deve ver **EXATAMENTE** isto (pela ordem):

```
[HomeScreen] Botão "Configurar Sistema" clicado
[HomeScreen] A navegar para: bootstrap
[NavigationContext] navigate chamado com: {name: "bootstrap"}
[NavigationContext] Hash gerado: #bootstrap
[NavigationContext] window.location.hash definido: #bootstrap
```

**DEPOIS** deve ver (pode demorar 1-2 segundos):

```
[NavigationContext] hashchange detectado: #bootstrap
[NavigationContext] Rota parseada: {name: "bootstrap"}
[App] Rota actual: bootstrap
[App] Renderizando BootstrapScreen
[BootstrapScreen] Componente BootstrapScreen a inicializar
[BootstrapScreen] Render - Player: {id: "...", name: "...", ...}
[BootstrapScreen] Render - Loading: false
[BootstrapScreen] Render - Success: false
[BootstrapScreen] useEffect - Componente montado
[BootstrapScreen] useEffect - Player: {id: "...", name: "...", ...}
[BootstrapScreen] useEffect - VITE_SUPABASE_URL: https://...
```

### 3.4 - Verificar URL
- A URL deve mudar para `#bootstrap` ou `/#bootstrap`

### 3.5 - Verificar Interface
- Deve ver nova página com:
  - Título: "Bem-vindo ao Sistema M6"
  - Card azul com informações do utilizador
  - Botão azul "Tornar-me Administrador"

---

## Passo 4: Clicar "Tornar-me Administrador"

### 4.1 - Preparar Network Tab
1. **ABRIR TAB NETWORK** (ao lado da consola)
2. **LIMPAR NETWORK:** Clicar no botão 🚫 "Clear"
3. **FILTRAR:** Selecionar "Fetch/XHR" ou "All"
4. Deixar visível enquanto clica

### 4.2 - Clicar no Botão
1. Clicar UMA VEZ no botão "Tornar-me Administrador"
2. **OLHAR PARA A CONSOLA**
3. **OLHAR PARA O NETWORK TAB**

### 4.3 - Logs Esperados na Consola

```
[BootstrapScreen] BOTÃO CLICADO - Event: [objeto]
[BootstrapScreen] BOTÃO CLICADO - Loading: false
[BootstrapScreen] BOTÃO CLICADO - Disabled: false
[BootstrapScreen] A chamar handleBootstrap...
[BootstrapScreen] handleBootstrap INICIADO
[BootstrapScreen] Player actual: {id: "...", name: "...", ...}
[BootstrapScreen] A obter sessão...
[BootstrapScreen] Sessão obtida: VÁLIDA
[BootstrapScreen] URL da Edge Function: https://mybiclqjikhooezyflca.supabase.co/functions/v1/bootstrap-admin
[BootstrapScreen] A fazer fetch...
```

**NESTE MOMENTO:** Deve aparecer NO NETWORK TAB:
- Uma chamada POST para `bootstrap-admin`
- Status: (pendente...) ou já concluída

**DEPOIS** (quando a resposta chegar):
```
[BootstrapScreen] Resposta recebida - Status: 200 OK
[BootstrapScreen] Resultado JSON: {success: true, ...}
[BootstrapScreen] SUCESSO! A recarregar em 1.5s...
```

**OU** (se houver erro):
```
[BootstrapScreen] Resposta recebida - Status: 403 Forbidden
[BootstrapScreen] Erro na resposta: {error: "Já existe um administrador..."}
```

### 4.4 - Verificar Interface
- Botão deve mostrar spinner e texto "A promover..."
- **SE SUCESSO:** Card verde "Promovido a Administrador! A recarregar..."
- **SE ERRO:** Card vermelho com mensagem de erro

### 4.5 - Após Sucesso
1. Página recarrega automaticamente (1.5 segundos)
2. URL volta para `#home`
3. Card "Configuração Inicial" **DESAPARECE**
4. Badge do utilizador muda para "Administrador" (vermelho)

---

## Diagnóstico de Problemas

### Problema A: Não Vejo Nenhum Log na Consola

**Causa:** Consola não está configurada corretamente ou página não recarregou

**Soluções:**
1. Garantir que consola está aberta ANTES de carregar a página
2. Verificar filtros da consola (devem estar TODOS ativos)
3. Hard refresh: Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)
4. Verificar que não está em modo "incognito/privado" com extensões que bloqueiam

---

### Problema B: Vejo Logs do HomeScreen mas NÃO Vejo Logs de "bootstrap"

**Causa:** Navegação para bootstrap falhou

**Soluções:**
1. Verificar na consola se aparece algum erro em vermelho
2. Copiar TODOS os logs e partilhar
3. Verificar se a URL mudou (deve ser `#bootstrap`)

**Logs que deve partilhar:**
```
(copiar TUDO da consola)
```

---

### Problema C: Vejo BootstrapScreen MAS Não Vejo Logs ao Clicar no Botão

**Causa:** Botão pode estar disabled ou evento não está a ser capturado

**Soluções:**
1. Verificar se o botão está visível e clicável (não deve estar disabled)
2. Tentar clicar várias vezes (devagar, uma de cada vez)
3. Inspecionar o botão (right-click → Inspect) e verificar se tem `disabled` attribute
4. Copiar TODOS os logs da consola

**No Inspector (Elements tab):**
- Procurar por `<button type="button"...`
- Verificar se tem `disabled` ou classe `cursor-not-allowed`

---

### Problema D: Vejo Logs do Botão MAS Não Há Chamada no Network

**Causa:** Fetch está a falhar antes de ser enviado

**Soluções:**
1. Verificar logs da consola para mensagens de erro
2. Verificar se o log `[BootstrapScreen] A fazer fetch...` aparece
3. Verificar se aparece algum erro ANTES do fetch (ex: sessão inválida)

**Partilhar:**
- Print do Network tab (vazio)
- TODOS os logs desde o clique do botão

---

### Problema E: Há Chamada no Network MAS com Erro

**Status 401 Unauthorized:**
- Sessão expirada
- **Solução:** Logout e login novamente

**Status 403 Forbidden:**
- Já existe um admin
- **Solução:** Usar funcionalidade "Promover Jogador" como admin

**Status 404 Not Found:**
- Edge Function não existe ou URL errada
- **Solução:** Verificar se `bootstrap-admin` está deployed no Supabase Dashboard

**Status 500 Internal Server Error:**
- Erro na Edge Function
- **Solução:** Verificar logs da Edge Function no Supabase Dashboard

---

### Problema F: Chamada com Status 200 MAS Não Recarrega

**Causa:** JavaScript pode estar a falhar no setTimeout ou reload

**Soluções:**
1. Verificar se aparece o log `[BootstrapScreen] SUCESSO! A recarregar em 1.5s...`
2. Aguardar 2-3 segundos para garantir
3. Se não recarregar, fazer refresh manual (F5)
4. Verificar se card "Configuração Inicial" desapareceu

---

## Informações para Partilhar se Continuar com Problemas

Se após seguir TODOS os passos acima ainda não funcionar, partilhe:

### 1. Logs Completos da Consola
```
(Copiar TUDO, desde o início até ao fim)
```

### 2. Screenshot do Network Tab
- Com filtro "Fetch/XHR" ativo
- Mostrando se há ou não há chamadas

### 3. URL Actual
```
https://....#??
```

### 4. Informação do Utilizador
- Nome do utilizador autenticado
- Role actual (visível no BootstrapScreen)

### 5. Screenshot da Interface
- Mostrar o BootstrapScreen completo
- Incluir o botão "Tornar-me Administrador"

---

## Comandos Úteis para Testar na Consola do Browser

### Verificar Supabase URL
```javascript
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
```

### Verificar Sessão Manualmente
```javascript
const { data } = await window.supabase.auth.getSession();
console.log('Sessão:', data.session);
```

### Testar Fetch Manualmente
```javascript
const { data } = await window.supabase.auth.getSession();
const response = await fetch('https://mybiclqjikhooezyflca.supabase.co/functions/v1/bootstrap-admin', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${data.session.access_token}`,
    'Content-Type': 'application/json',
  }
});
console.log('Status:', response.status);
const result = await response.json();
console.log('Resultado:', result);
```

---

## Notas Finais

- **PACIÊNCIA:** Siga CADA passo cuidadosamente
- **LOGS SÃO CRÍTICOS:** Sem logs, não consigo diagnosticar
- **NETWORK TAB:** Essencial para ver se há chamada ou não
- **LIMPAR CACHE:** Muitos problemas são resolvidos com refresh completo

## Resumo do Fluxo Esperado

```
1. Login → HomeScreen (#home)
2. Ver card "Configuração Inicial"
3. Clicar "Configurar Sistema"
4. Navegar para #bootstrap
5. Ver BootstrapScreen
6. Clicar "Tornar-me Administrador"
7. Ver spinner "A promover..."
8. Chamada POST para /functions/v1/bootstrap-admin
9. Resposta 200 OK
10. Card verde "Promovido a Administrador"
11. Reload após 1.5s
12. Voltar para #home
13. Card "Configuração Inicial" desapareceu
14. Badge "Administrador" visível
```

Se QUALQUER um destes passos falhar, identifique qual e partilhe os logs!
