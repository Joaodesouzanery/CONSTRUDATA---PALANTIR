# Atlântico — Vídeos (Remotion)

Vídeos programáticos da plataforma feitos com [Remotion](https://www.remotion.dev/) — o framework React para criar vídeos com código.

> **Por que Remotion:** você escreve um vídeo como se fosse um componente React. Cada frame é uma renderização determinística — mesmo input gera mesmo output. Isso permite versionar vídeos no git, fazer A/B testing, e regenerar com novos números **sem retrabalho de edição**.

---

## O que tem aqui

| ID | Descrição | Duração | Resolução | Onde usar |
|---|---|---|---|---|
| **`HeroLoop`** | Loop animado de fundo da landing — 4 módulos conectados pulsando | 15s | 1920×1080 (16:9) | Background do `<HeroSection>` ou seção de Ontologia |
| **`ProductDemo30s`** | Demo curto: dor → solução → demo das telas → resultados → CTA | 30s | 1920×1080 (16:9) | Landing page, email frio, Twitter, embed em outras páginas |
| **`LinkedInTeaser60s`** | Vertical (9:16) para Reels/Stories/TikTok/Shorts | 60s | 1080×1920 (9:16) | LinkedIn, Instagram, TikTok, YouTube Shorts |

---

## Instalação (1 vez só)

> **Requer:** Node 18+ instalado no PC.

```bash
cd videos
npm install
```

Isso baixa Remotion 4 + uma cópia do Chromium (~300 MB) que vai ser usada para renderizar. Demora ~3-5 minutos na primeira vez.

**Importante:** essa pasta é **standalone** — tem o próprio `package.json` e o próprio `node_modules`. Não interfere no `npm install` da plataforma principal.

---

## Como usar

### 1. Preview interativo (Studio)

Abre uma interface visual onde você pode rolar pelos frames, ver o resultado em tempo real, ajustar e testar:

```bash
cd videos
npm run preview
```

Vai abrir `http://localhost:3000` no navegador. Clique em qualquer composição da lista lateral.

**Use isso enquanto estiver editando os componentes** — a cada save do `.tsx`, o studio recarrega automaticamente.

### 2. Renderizar (gera o MP4)

```bash
cd videos

# Renderiza apenas o Hero Loop
npm run render:hero

# Renderiza apenas o Product Demo 30s
npm run render:demo

# Renderiza apenas o LinkedIn vertical
npm run render:linkedin

# Renderiza os 3 de uma vez
npm run render:all
```

Os MP4s saem em `videos/out/`:
- `videos/out/hero-loop.mp4`
- `videos/out/product-demo-30s.mp4`
- `videos/out/linkedin-teaser-60s.mp4`

Tempo de renderização aproximado por vídeo: 1-3 minutos (depende do PC).

---

## Como integrar o HeroLoop na landing

Substitua a imagem estática do hero por um `<video>`:

```tsx
// Em src/features/landing/components/HeroSection.tsx
<video
  src="/videos/hero-loop.mp4"
  autoPlay
  loop
  muted
  playsInline
  className="absolute inset-0 w-full h-full object-cover opacity-65"
/>
```

E copie o MP4 renderizado para `public/videos/hero-loop.mp4`:

```bash
mkdir -p public/videos
cp videos/out/hero-loop.mp4 public/videos/hero-loop.mp4
```

A Vercel serve esse arquivo automaticamente. Tamanho típico: ~3-5 MB para 15s @ 1080p.

---

## Estrutura do código

```
videos/
├── package.json              ← deps (Remotion 4 + React)
├── tsconfig.json             ← TypeScript isolado deste subprojeto
├── remotion.config.ts        ← config global de renderização
├── README.md                 ← este arquivo
├── .gitignore                ← ignora node_modules, out/, *.mp4
└── src/
    ├── index.ts              ← entry point (registerRoot)
    ├── Root.tsx              ← lista todas as composições
    ├── shared/
    │   └── theme.ts          ← cores e fontes da marca (igual à plataforma)
    ├── HeroLoop/
    │   └── HeroLoop.tsx      ← composição 1
    ├── ProductDemo30s/
    │   └── ProductDemo30s.tsx ← composição 2
    └── LinkedInTeaser60s/
        └── LinkedInTeaser60s.tsx ← composição 3
```

---

## Como criar um novo vídeo

1. **Crie a pasta** em `src/MeuVideo/MeuVideo.tsx`
2. **Exporte um React.FC** que retorna `<AbsoluteFill>` com seu conteúdo
3. **Use os hooks Remotion**:
   - `useCurrentFrame()` — frame atual (0 a durationInFrames)
   - `useVideoConfig()` — `{fps, width, height, durationInFrames}`
   - `interpolate(frame, [in1, in2], [out1, out2])` — animar valores
   - `spring({frame, fps})` — animação com easing natural
   - `<Sequence from={X} durationInFrames={Y}>` — agrupar timing
4. **Registre em `Root.tsx`** com `<Composition id="MeuVideo" .../>`
5. **Adicione um script** em `package.json`: `"render:meu": "remotion render MeuVideo out/meu.mp4"`
6. **Renderize** com `npm run render:meu`

---

## Cheat sheet do Remotion

```tsx
import { AbsoluteFill, useCurrentFrame, interpolate, spring, Sequence } from 'remotion'

// 1. Posicionamento absoluto que cobre tudo
<AbsoluteFill style={{ background: '#000' }}>
  ...
</AbsoluteFill>

// 2. Animar opacidade ao longo de 60 frames
const opacity = interpolate(frame, [0, 60], [0, 1])

// 3. Animar com easing natural (spring)
const scale = spring({ frame, fps, config: { damping: 12 } })

// 4. Agrupar cenas em sequência (Sequence trabalha com offsets)
<Sequence from={0} durationInFrames={90}>
  <CenaA />
</Sequence>
<Sequence from={90} durationInFrames={150}>
  <CenaB />
</Sequence>
```

Documentação completa: https://www.remotion.dev/docs

---

## Troubleshooting

### "Cannot find module 'remotion'"
Você não rodou `npm install` dentro da pasta `videos/`. Faça isso primeiro.

### Renderização demora muito
- Reduza `Config.setConcurrency(2)` em `remotion.config.ts` se seu PC tem pouca RAM
- Reduza `durationInFrames` durante o desenvolvimento (testes mais rápidos)
- Use `npm run preview` para iterar visualmente em vez de renderizar a cada mudança

### O preview não atualiza
- Salve o arquivo `.tsx` (Ctrl+S no VS Code)
- Recarregue a página do studio (F5)
- Se persistir: pare (Ctrl+C) e rode de novo `npm run preview`

### Renderização falha com erro do Chromium
- Tente: `npx remotion versions` (vê se Chromium está instalado)
- Tente: `npx remotion install` para reinstalar a dependência

### Quero mudar texto sem renderizar
**Não dá.** Remotion é programático: para mudar texto, você edita o `.tsx` e renderiza de novo. A vantagem é que isso é trivialmente fácil — abrir o arquivo, mudar a string, rodar `npm run render:demo`. 2 minutos.

---

## Próximos vídeos sugeridos (para criar quando precisar)

| Sugestão | Duração | Quando criar |
|---|---|---|
| `FullDemo5min` | 5 min | Para enviar como "vídeo demo completo" antes de uma reunião |
| `RDOTour` | 90s | Tour específico do módulo RDO (treinamento) |
| `FVSTour` | 90s | Tour específico do módulo Qualidade |
| `CaseStudyEngeneves` | 120s | Após o piloto — números reais do cliente |
| `OnboardingExpectativa` | 60s | Vídeo que vai pro cliente assim que assina o contrato |
| `TestimonialTemplate` | 30s | Template para gravar depoimento de cliente (insere logo + nome) |
| `LinkedInPostA` `LinkedInPostB` ... | 30s cada | Para os 30 posts que você publica/mês — cada um pode ter seu vídeo |

**Dica de produtividade:** quando tiver 10+ vídeos, use o **Remotion props** (parametrização) para reaproveitar a mesma composição com dados diferentes. Aí você gera 10 vídeos rodando 1 script só.
