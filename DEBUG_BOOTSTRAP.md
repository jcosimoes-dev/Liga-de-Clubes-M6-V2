# Guia de Debug do Bootstrap

## Problema Resolvido

O botão "Configurar Sistema" não disparava nenhuma chamada de rede porque:

1. **Rota 'bootstrap' estava em falta no NavigationContext**
   - A rota não estava definida no tipo `Route`
   - Não havia case para 'bootstrap' em `parseHash()` e `routeToHash()`
   - Quando clicava no botão, a navegação falhava silenciosamente

## Correções Aplicadas

### 1. Adicionada Rota 'bootstrap' ao NavigationContext
- Tipo `Route` atualizado com `{ name: 'bootstrap' }`
- `parseHash()` agora reconhece `#bootstrap`
- `routeToHash()` agora gera `#bootstrap` corretamente

### 2. Console Logs Extensivos Adicionados

#### HomeScreen
```
[HomeScreen] Botão "Configurar Sistema" clicado
[HomeScreen] A navegar para: bootstrap
```

#### NavigationContext
```
[NavigationContext] navigate chamado com: { name: 'bootstrap' }
[NavigationContext] Hash gerado: #bootstrap
[NavigationContext] window.location.hash definido: #bootstrap
[NavigationContext] hashchange detectado: #bootstrap
[NavigationContext] Rota parseada: { name: 'bootstrap' }
```

#### BootstrapScreen
```
[BootstrapScreen] Componente montado
[BootstrapScreen] Player: { id: '...', name: '...', role: 'jogador' }
[BootstrapScreen] Botão "Tornar-me Administrador" clicado
[BootstrapScreen] handleBootstrap INICIADO
[BootstrapScreen] Player actual: { ... }
[BootstrapScreen] A obter sessão...
[BootstrapScreen] Sessão obtida: VÁLIDA
[BootstrapScreen] URL da Edge Function: https://...
[BootstrapScreen] A fazer fetch...
[BootstrapScreen] Resposta recebida - Status: 200 OK
[BootstrapScreen] Resultado JSON: { success: true, ... }
[BootstrapScreen] SUCESSO! A recarregar em 1.5s...
[BootstrapScreen] A recarregar página...
```

## Como Testar

### 1. Abrir Consola do Navegador
- Chrome/Edge: F12 → Console
- Firefox: F12 → Console
- Safari: Cmd+Option+C

### 2. Limpar Logs Anteriores
```javascript
console.clear()
```

### 3. Clicar em "Configurar Sistema"

Deve ver IMEDIATAMENTE:
```
[HomeScreen] Botão "Configurar Sistema" clicado
[HomeScreen] A navegar para: bootstrap
[NavigationContext] navigate chamado com: {name: "bootstrap"}
[NavigationContext] Hash gerado: #bootstrap
```

### 4. URL Deve Mudar
Deve ver na barra de endereços:
```
https://seu-dominio/#bootstrap
```

### 5. BootstrapScreen Deve Carregar
Deve ver:
```
[BootstrapScreen] Componente montado
[BootstrapScreen] Player: {...}
```

### 6. Clicar em "Tornar-me Administrador"

Deve ver NO TAB NETWORK (XHR/Fetch):
```
POST https://sua-url.supabase.co/functions/v1/bootstrap-admin
Status: 200 (ou erro específico)
```

E na consola:
```
[BootstrapScreen] Botão "Tornar-me Administrador" clicado
[BootstrapScreen] handleBootstrap INICIADO
[BootstrapScreen] A fazer fetch...
```

## Cenários de Erro

### Erro: Sessão não encontrada
```
[BootstrapScreen] Sessão não encontrada
```
**Solução:** Logout e login novamente

### Erro: 401 Unauthorized
```
[BootstrapScreen] Resposta recebida - Status: 401 Unauthorized
```
**Solução:** Token expirado, fazer logout e login

### Erro: 403 Forbidden
```
[BootstrapScreen] Erro na resposta: { error: "Já existe um administrador..." }
```
**Solução:** Bootstrap já foi executado, usar "Promover Jogador"

### Erro: 404 Not Found
```
[BootstrapScreen] Resposta recebida - Status: 404 Not Found
```
**Solução:** Edge Function não está deployada ou URL incorreta

### Erro: 500 Internal Server Error
```
[BootstrapScreen] Resposta recebida - Status: 500 Internal Server Error
```
**Solução:** Verificar logs da Edge Function no Supabase Dashboard

## Verificar Edge Function Deployada

1. Ir ao Supabase Dashboard
2. Navegar para "Edge Functions"
3. Confirmar que `bootstrap-admin` aparece na lista
4. Status deve ser "Active" ou "Deployed"

## Verificar Variáveis de Ambiente

O ficheiro `.env` deve conter:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

E a Edge Function automaticamente tem acesso a:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Se Nada Aparecer na Consola

1. **Refresh completo:** Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)
2. **Limpar cache:** Settings → Clear browsing data
3. **Verificar que a consola está aberta ANTES de clicar**
4. **Verificar que não há filtros ativos na consola**

## Fluxo Completo Esperado

```
1. HomeScreen renderiza
2. Utilizador vê card "Configuração Inicial" (se não for admin)
3. Clica em "Configurar Sistema"
4. URL muda para #bootstrap
5. BootstrapScreen é montado
6. Utilizador vê nome e role actual
7. Clica em "Tornar-me Administrador"
8. Botão mostra spinner "A promover..."
9. Fetch é feito para Edge Function
10. Se sucesso: mensagem verde + reload em 1.5s
11. Se erro: mensagem vermelha com detalhes
12. Após reload: URL volta a #home
13. Card "Configuração Inicial" desaparece (porque agora é admin)
14. Tab "Administração" fica acessível
```

## Próximos Passos se Tudo Funcionar

1. O card "Configuração Inicial" desaparece automaticamente (porque `!isAdmin` fica falso)
2. Badge do player muda para "Administrador" (vermelho)
3. Acesso ao AdminScreen fica disponível
4. Pode promover outros jogadores

## Se Continuar com Problemas

Partilhe os logs completos da consola do navegador, incluindo:
- Todos os `[HomeScreen]` logs
- Todos os `[NavigationContext]` logs
- Todos os `[BootstrapScreen]` logs
- Qualquer erro em vermelho
- Screenshot do tab Network mostrando (ou não) a chamada
