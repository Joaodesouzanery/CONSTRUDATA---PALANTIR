# Conferir a SUPERA na tela — 2 minutos

Este roteiro existe porque um teste automatizado prova que **a conta está certa**, mas só a tela
prova que **os campos existem e conversam**. São coisas diferentes, e a segunda é a que importa
para você.

O teste equivalente é `src/features/torre-de-controle/utils/superaFimAFim.test.ts` — ele percorre
exatamente estes mesmos passos, no mesmo pedido.

**Os três números que decidem:**

| | |
|---|---:|
| Saldo do serviço | **R$ 453.765,94** |
| Diferença (Δ) do serviço | **R$ 23,54** |
| Diferença do material | **R$ 0,00** |

---

## Passo 1 · Abrir a obra

**Torre de Controle → Obras → Detalhe da obra → SUPERA.** O card **CONTRATO** fica abaixo do Cronograma.

---

## Passo 2 · Lançar os dois valores do contrato

Aba **Resumo** → *Cadastrar contrato*:

| Campo | Valor |
|---|---|
| Contratante | SUPERA EMPREENDIMENTOS |
| Nº do contrato | (o que estiver no contrato) |
| **Valor de serviço (R$)** | `592324,14` |
| **Valor de material (R$)** | `607620,00` |

Salvar.

✅ **Confira no topo:** *Contratado* **R$ 1.199.944,14**, com "serviço R$ 592.324,14 · material
R$ 607.620,00" logo abaixo.

---

## Passo 3 · Colar a composição

Aba **Composição** → *Importar planilha ou colar* → **Colar do Excel**.

Cole exatamente isto (é o contrato, cláusula 6):

```
ITEM	DESCRIÇÃO	UN	QTD	Mão de obra	Material
1	Pintura epóxi em piso	m²	12.794,06	28,94	
2	Pintura epóxi em paredes	m²	5.337,40	27,65	
3	Pintura epóxi demarcações e sinalizações	m	6.962,01	8,75	
4	Pintura de meio-fio com poliuretano	m²	473,55	28,70	
5	Faturamento direto	vb	1,00		607.620,00
```

> As colunas são separadas por **TAB**. Copiando daqui já vem certo; copiando do Excel também.

Clique em **Ler o que colei**.

✅ **Confira a tela de conferência:** 5 itens · serviço **R$ 592.347,68** · material
**R$ 607.620,00**. As unidades devem sair `m²`, `m²`, **`m`**, `m²`, `vb` — repare que a linha 3 é
metro **linear**, não m².

Clique em **Substituir a composição por estes 5 itens**.

---

## Passo 4 · ⚠️ O número que prova o conserto

Volte para a aba **Resumo**.

✅ **Deve aparecer, discreto e em cinza claro:**

> Serviço: a composição soma **+ R$ 23,54 (0,004%)** em relação ao valor do contrato —
> arredondamento de preço unitário.

✅ **E o material NÃO deve ter linha nenhuma** (diferença zero).

❌ **Se aparecer R$ 607.643,54, o conserto não pegou** — era esse o defeito: o material sendo
contado como serviço. Me avise.

---

## Passo 5 · A Área/Extensão em duas parcelas

Ainda no Detalhe da obra, seção **Edificação**.

✅ **Área / Extensão: `18.605,01 m² + 6.962,01 m`**

São duas parcelas de propósito. Somar daria 25.567,02 — metro quadrado com metro linear, um número
que não significa nada.

---

## Passo 6 · Lançar as duas notas

Aba **Medições** → *Lançar nota*. Duas notas:

| Data | NF | Descrição | Valor | Abate de | Situação | Entrada? |
|---|---|---|---:|---|---|---|
| 10/06/2026 | 1041 | Entrada Serviço | `59232,45` | Serviço | **Recebido** em 12/06 | ✅ marcar |
| 15/07/2026 | 1088 | 2ª medição | `79325,75` | Serviço | **A receber** 05/09 | — |

Salvar.

---

## Passo 7 · O saldo

✅ **No topo do card:**

| | |
|---|---:|
| Faturado | **R$ 138.558,20** |
| **Saldo do serviço** | **R$ 453.765,94** ✅ |
| Execução | 23,4% |

✅ **Na aba Medições:** a 2ª medição em **âmbar** ("a receber 05/09"), não em vermelho — ela ainda
está no prazo. Vermelho é só para nota vencida.

---

## Passo 8 · O Financeiro

**Financeiro → Pagamentos.**

✅ Dois títulos da obra SUPERA: um **pago** de R$ 59.232,45 e um **pendente** de R$ 79.325,75 com
vencimento 05/09.

⚠️ Se você já tinha lançado esses recebimentos à mão em Entradas/Saídas, o sistema avisa ao salvar
o contrato, mostrando os dois lado a lado. Apague o manual, senão a receita conta duas vezes.

---

## Passo 9 · A Carteira

**Torre de Controle → Obras → Carteira.**

✅ A linha da SUPERA: serviço 592.324,14 · material 607.620,00 · faturado 138.558,20 · saldo
**453.765,94**.

---

## Deu tudo certo?

Então está resolvido. Se algum número divergir, me diga **qual passo** e **o que apareceu** — com o
passo eu sei exatamente onde olhar.
