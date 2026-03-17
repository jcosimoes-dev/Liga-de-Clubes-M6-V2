# Relatório: 404 em "Gestão de Jogos" e reset da base de dados

## 1. Script/comando de reset aplicado à base de dados

Existem **dois** mecanismos de “limpeza” no projeto:

### A) Edge Function `reset-test-data` (Supabase)

**Ficheiro:** `supabase/functions/reset-test-data/index.ts`

Comportamento:
- Requer utilizador autenticado com `role = 'admin'` (tabela `players`).
- Apaga **todos** os registos (com `delete().neq('id', '0000...')`) nas tabelas:
  1. **results**
  2. **pairs**
  3. **availabilities**
  4. **games**

Não toca em: `players`, `teams`, nem em qualquer tabela de configuração ou sistema.

### B) Snippet no browser (QUICK_START.md / FASE2_MOBILE_TESTS.md)

```javascript
// Console (como capitão)
const { supabase } = await import('./src/lib/supabase.ts');
// Apaga todos os jogos (cascata apaga availabilities, pairs, results)
const { data: games } = await supabase.from('games').select('id');
for (const game of games) {
  await supabase.from('games').delete().eq('id', game.id);
}
console.log('✅ Dados limpos');
```

Este snippet apaga apenas da tabela **games** (e a cascata da BD pode apagar availabilities, pairs, results consoante as FKs).

---

## 2. Tabelas afectadas pelo reset

| Tabela            | Afectada por reset-test-data? | Afectada por snippet? | Tipo de dados        |
|-------------------|-------------------------------|------------------------|----------------------|
| **results**       | Sim (todos apagados)          | Sim (cascata)          | Operacionais         |
| **pairs**         | Sim (todos apagados)          | Sim (cascata)          | Operacionais         |
| **availabilities**| Sim (todos apagados)          | Sim (cascata)          | Operacionais         |
| **games**         | Sim (todos apagados)          | Sim (directo)          | Operacionais         |
| **players**       | Não                           | Não                    | Sistema/operacionais |
| **teams**         | Não                           | Não                    | Sistema/config       |

Nenhuma tabela de **configuração ou rotas** (ex.: rotas, slugs, paths) é alterada por estes resets. Não existe no projeto tabela que guarde o path `/gestao` ou o nome "gestao".

---

## 3. Dados de sistema/seed removidos?

- **Não.** Os resets só removem dados das tabelas **results**, **pairs**, **availabilities** e **games**.
- **players** e **teams** não são apagados. Não há seed de “rotas” ou “paths” na BD.

---

## 4. O que a página "Gestão de Jogos" espera ao montar

- **Auth:** utilizador com sessão; `canManageSport` ou `role` admin/coordenador/capitão (ou e-mail dono) para ver o ecrã.
- **Dados da BD ao montar:**
  - `loadOpenGames()` → `GamesService.getOpenGames()` (jogos com convocatória aberta).
  - `loadClosedGames()` → `GamesService.getByStatus('convocatoria_fechada')`.
  - `loadDashboard()` → ranking, estatísticas de equipa e época (quando há `effectiveTeamId` e `canManageSport`).

Com **games** vazios após o reset, as listas ficam vazias; a página **não** usa nenhum campo da BD para construir URLs, paths, `href` ou `src`.

---

## 5. Uso de dados da BD como path/url/href/src

- **Verificação no código:** não existe em toda a app nenhum `fetch("gestao")`, `href="gestao"`, `to="gestao"`, nem construção de URL a partir de campos da BD que possa gerar o recurso "gestao".
- O path `/gestao` é **fixo** no código:
  - `NavigationContext.tsx`: quando a rota é `sport-management`, faz `window.history.pushState(null, '', '/gestao')`.
  - `SportManagementScreen.tsx`: usa `pathname.endsWith('/gestao')` e localStorage `liga-gestao-active-tab` apenas para estado de UI e query params.

Conclusão: o pedido que falha com 404 para o recurso **"gestao"** é o **pedido do documento** (navegação) para o path **/gestao**, e não um fetch dinâmico baseado em dados da BD.

---

## 6. Causa raiz do 404

- O **navegador** pede o documento para o URL **/gestao** (ao abrir o link "Gestão de Jogos", ao refrescar em /gestao, ou ao aceder directamente a `/gestao`).
- Se o **servidor** (Vite em dev, ou o host em produção) não estiver configurado para devolver `index.html` em rotas SPA, responde **404** para `/gestao`.
- Isto **não** é causado por dados apagados no reset; é apenas configuração do servidor/SPA.

---

## 7. Correção aplicada (já presente no projeto)

- **Desenvolvimento (Vite):** em `vite.config.ts` o plugin `vitePluginSpaFallback` reescreve pedidos a `/gestao` (e outras rotas SPA) para `/index.html` antes do middleware de ficheiros estáticos.
- **Produção (Vercel):** em `vercel.json` existem rewrites para `/gestao` e `/gestao/:path*` → `/index.html`.

Nenhuma alteração à BD é necessária para resolver o 404. Não é preciso repor dados de configuração.

---

## 8. Se o 404 continuar a aparecer

- **Em dev:** garantir que estás a usar `npm run dev` (Vite com o plugin) e não a servir apenas a pasta `dist` com outro servidor.
- **Service Worker:** pode estar em cache uma resposta 404 para /gestao. Em DevTools → Application → Service Workers: "Unregister" ou activar "Update on reload" e recarregar.
- **Produção (build local):** se fizeres `npm run build` e `npx serve dist`, o `serve` não faz SPA fallback por defeito; para testar produção com fallback, usar um host que suporte rewrites (ex.: Vercel) ou configurar o `serve` para fallback para `index.html`.

---

## 9. Resumo

| Item | Conclusão |
|------|-----------|
| Script que causou o problema | Edge Function `reset-test-data` ou snippet QUICK_START/FASE2 (apagam apenas games/pairs/availabilities/results). |
| Tabelas afectadas | **results**, **pairs**, **availabilities**, **games**. |
| Registos obrigatórios em falta | Nenhum para o path /gestao; a página funciona com listas vazias. |
| Ficheiros frontend envolvidos | Nenhum usa dados da BD para o URL "gestao"; o path é fixo em `NavigationContext.tsx` e `SportManagementScreen.tsx`. |
| Correção | Servidor (Vite + Vercel) já configurado para servir `index.html` em `/gestao`. Nenhuma correção na BD necessária. |
| 404 para "gestao" | Deve deixar de ocorrer em dev com `npm run dev` e em produção na Vercel; em caso contrário, ver Service Worker e forma de servir o build. |
