# Scripts de operação

Scripts auxiliares do projeto Atlântico — rotinas que não fazem parte do
build, mas ajudam na operação do dia a dia.

## Imagem do Hero da Landing Page

A imagem de fundo do Hero (`src/assets/atlantico-hero.jpg`) é um arquivo
binário que precisa ser substituído manualmente quando você quer atualizar.

### Setup (uma vez por troca de imagem)

1. **Salve a imagem desejada** em qualquer pasta do seu PC (ex.: Desktop ou Downloads).
   - Formatos aceitos: JPG, JPEG, PNG, WEBP
   - Tamanho máximo: 5 MB
   - Recomendado: 1920×1080 ou 2048×2048

2. **Clique com o botão direito** em [`scripts/setup-hero-image.ps1`](./setup-hero-image.ps1) → **Run with PowerShell**

   Ou abra um PowerShell na pasta do projeto e rode:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/setup-hero-image.ps1
   ```

3. O script abre uma **janela do Windows** pedindo o arquivo da imagem.
   Selecione e clique **Abrir**.

4. O script:
   - ✅ Valida que é uma imagem
   - ✅ Valida o tamanho (≤5 MB)
   - ✅ Faz backup da imagem anterior (`atlantico-hero.backup.jpg`)
   - ✅ Copia para `src/assets/atlantico-hero.jpg`

### Publicar (commit + push)

Depois do setup, rode:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/commit-hero-image.ps1
```

Isso faz `git add` + `git commit` + `git push origin main` da imagem nova.
A Vercel publica automaticamente em ~2 minutos.

### Tudo em 1 linha

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-hero-image.ps1; powershell -ExecutionPolicy Bypass -File scripts/commit-hero-image.ps1
```

### Por que script em vez de eu (Claude) colocar a imagem direto?

O assistente de IA não tem acesso direto aos bytes de imagens enviadas no chat —
ele consegue **ver** a imagem visualmente, mas não consegue **escrever** o arquivo
binário no seu disco. Por isso a parte de "carregar a imagem" precisa ser feita
no seu PC, e esses scripts deixam o processo rápido (~30 segundos).
