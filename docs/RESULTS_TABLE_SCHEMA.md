# Referência: Colunas da tabela `results`

O código envia exatamente estes nomes. Confirma no Supabase (Table Editor ou SQL) que a tabela tem colunas com os **mesmos nomes**.

## Campos enviados no INSERT

| Coluna      | Tipo   | Obrigatório | Descrição                          |
|-------------|--------|-------------|------------------------------------|
| `game_id`   | uuid   | Sim         | ID do jogo (FK → games.id)         |
| `pair_id`   | uuid   | Sim         | ID da dupla (FK → pairs.id)        |
| `created_by`| uuid   | Sim*        | ID do utilizador auth (FK → auth.users.id) |
| `set1_casa` | integer| Sim         | Pontos casa no Set 1               |
| `set1_fora` | integer| Sim         | Pontos fora no Set 1               |
| `set2_casa` | integer| Sim         | Pontos casa no Set 2               |
| `set2_fora` | integer| Sim         | Pontos fora no Set 2               |
| `set3_casa` | integer| Opcional    | Pontos casa no Set 3 (se 1-1)      |
| `set3_fora` | integer| Opcional    | Pontos fora no Set 3 (se 1-1)      |

\* Se a coluna `created_by` referenciar `auth.users(id)`, usa `user.id` do Supabase Auth.

## Para verificar no Supabase

```sql
-- Listar colunas da tabela results
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'results'
ORDER BY ordinal_position;
```
