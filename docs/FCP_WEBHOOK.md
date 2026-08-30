# Webhook do FCP — lançar produção pelo n8n

Permite que uma automação lance a **produção realizada** no Fluxo de Caixa Projetado sem ninguém
redigitar no app. Medição, recebimento e capital necessário recalculam sozinhos.

## Configurar

Supabase → Edge Functions → Secrets:

```
FCP_WEBHOOK_SECRET = <um segredo longo e aleatório>
```

⚠️ **Sem esse segredo a função fica fechada** (responde 503). Abrir por omissão deixaria qualquer
um escrever no fluxo de caixa da empresa.

Depois: `supabase functions deploy fcp-webhook`

## Chamar

```http
POST https://<projeto>.supabase.co/functions/v1/fcp-webhook
x-webhook-secret: <FCP_WEBHOOK_SECRET>
Content-Type: application/json

{
  "planoId": "uuid-do-plano",
  "origem": "n8n:producao-diaria",
  "lancamentos": [
    { "cidadeId": "bertioga", "semana": 3, "producao": 91.5 },
    { "cidadeId": "santos",   "semana": 3, "producao": 70   }
  ]
}
```

| campo | |
|---|---|
| `planoId` | o id do plano. Aparece na tela do FCP. |
| `origem` | texto livre, até 120 caracteres. **Vai para o log** — use algo que identifique o fluxo, porque "n8n" sozinho não ajuda quando há três automações no mesmo plano. |
| `cidadeId` | o id da cidade no plano (`bertioga`, `santos`…). |
| `semana` | número da semana do fluxo (1 = S1). |
| `producao` | serviços realizados. **`null` APAGA o lançamento** e a semana volta a usar o previsto — diferente de `0`, que quer dizer "a equipe não produziu nada". |

Máximo de 500 lançamentos por chamada.

## Respostas

| código | |
|---|---|
| 200 | tudo aplicado |
| **207** | lote parcial — parte aplicou, parte falhou. O corpo traz `detalhe.falhas`. |
| 400 | nada aplicou, ou corpo inválido |
| 401 | segredo errado |
| 503 | `FCP_WEBHOOK_SECRET` não configurado |

O 207 é deliberado: devolver 200 num lote que falhou pela metade faria o n8n marcar como sucesso.

## O que fica registrado

Cada lançamento vira uma linha no `audit_log` com **a origem declarada**, visível em
`/app/auditoria`. Uma escrita pelo app não tem origem e mostra o nome da pessoa; uma escrita pelo
webhook mostra a origem.

⚠️ Isso funciona porque a escrita passa pela RPC `fcp_lancar_producao`, e não por UPDATE direto: a
marca de origem tem escopo de **transação**, e só uma função garante que ela e o UPDATE aconteçam
juntos. Por UPDATE direto a marca vazaria para a próxima requisição da mesma conexão do pool — e a
escrita de uma pessoa sairia carimbada como n8n.

A RPC **não é liberada para usuário comum**: ela é `SECURITY DEFINER` e não checa a organização, o
que daria a qualquer um a capacidade de escrever no plano de outra obra. Só service role.
