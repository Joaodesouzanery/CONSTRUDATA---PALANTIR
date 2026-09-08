# QA de isolamento — WCR Saneamento × Compizzo

Prova em duas camadas que o que uma empresa grava (a) chega ao banco inteiro e (b) nunca aparece
para a outra.

## Camada 1 — o código · `npm run qa:isolamento` · já rodado, exit 0

Quatro conferências estáticas: todo store da troca de empresa sabe se limpar (43); toda linha que
sobe carimba `organization_id` (71 funções); toda escrita direta idem (5); as 100 tabelas do
inventário têm policy de SELECT por organização.

## Camada 2 — o banco · `docs/COLAR_NO_SQL_EDITOR.sql`

**Cole o arquivo inteiro no Supabase → SQL Editor, rode, e mande o resultado.** Ele grava só o
Bloco 1 (os quatro diretores) e lê o resto:

| Consulta | O que prova | Esperado |
|---|---|---|
| 1.R | os 4 diretores vinculados | 4 linhas, `diretor` / `active` / `tem_perfil = true` |
| 2.A | quais empresas existem | me diga qual é a Compizzo real |
| 2.B | contagem por empresa | só contagens — é a foto de hoje |
| 2.C | dado sem dono | **0** em todas |
| 2.D | dado apontando para obra de OUTRA empresa | **0** em todas — é o vazamento clássico |
| 2.E | RLS ligada e com policy de SELECT | `rls = true`, `select_policies ≥ 1` |

Se 2.C ou 2.D vier diferente de zero, me mande a linha — é grave e tem conserto por SQL.

## O que só a tela prova (opcional, quando quiser)

Entrar como diretor da WCR, criar um lançamento; trocar para a Compizzo pelo seletor de empresa;
o lançamento não pode aparecer. `pendenciasDeOutraEmpresa()` no indicador de sincronização é o
detector embutido — se aparecer "op estacionada", é ele funcionando. Modo demonstração **desligado**.
