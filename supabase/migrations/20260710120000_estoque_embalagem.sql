-- Estoque: embalagem como facilitador de cadastro (estoque continua em unidades).
-- qtd_por_embalagem = un por embalagem (ex.: 96 un/caixa); unidade_embalagem = rótulo (ex.: "caixa").
-- Ambos opcionais; itens sem embalagem seguem contando por unidade (comportamento atual).

ALTER TABLE public.suprimentos_estoque_itens
  ADD COLUMN IF NOT EXISTS qtd_por_embalagem numeric,
  ADD COLUMN IF NOT EXISTS unidade_embalagem text;
