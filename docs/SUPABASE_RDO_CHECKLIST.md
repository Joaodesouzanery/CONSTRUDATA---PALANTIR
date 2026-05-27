# Checklist Supabase - RDO primeiro

Este checklist permite aplicar o backend sem precisar escrever SQL manualmente.

## 1. Conectar o projeto

```bash
supabase login
supabase link --project-ref wtovivsmvenjbuhdemzv
```

## 2. Conferir antes de aplicar

```bash
supabase db push --dry-run
```

Se o dry-run estiver limpo, aplicar:

```bash
supabase db push
```

## 3. Publicar a Edge Function do parser

```bash
supabase functions deploy parse-rdo-sabesp
```

## 4. Configurar segredo da IA no Supabase

Use um segredo no Supabase, nunca no frontend:

```bash
supabase secrets set GEMINI_API_KEY=cole_a_chave_aqui
```

Opcional:

```bash
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

Tambem aceitamos `LOVABLE_API_KEY` ou `AI_GATEWAY_API_KEY` como fallback, mas a preferencia do parser agora e usar a Gemini API direta quando `GEMINI_API_KEY` existir.

## 5. O que fica pronto no RDO

- `rdo_sabesp`: RDO Sabesp estruturado por organizacao.
- `rdo_sabesp_assets`: fotos originais, anexos, assinaturas e PDFs salvos por organizacao e usuario/perfil.
- `rdo_sabesp_parser_runs`: auditoria de cada tentativa de IA/OCR, com status, modelo, resultado e erro.
- Bucket privado `rdo-sabesp-photos`: storage das fotos/assinaturas.
- RLS: usuario autenticado so acessa dados da propria organizacao.

## 6. Ordem dos proximos modulos

1. RDO e fotos por perfil.
2. Qualidade.
3. Medicao.
4. Planejamento.
5. Torre de Controle.
6. Gestao 360.
7. Relatorio 360.
8. Autenticacao, convites e permissoes finas.

## Regra de seguranca

`SUPABASE_SERVICE_ROLE_KEY` e chaves de IA nunca entram em `src/`, Vite, React ou bundle do navegador. Elas ficam apenas em Supabase secrets, Vercel environment variables ou ambiente local seguro.
