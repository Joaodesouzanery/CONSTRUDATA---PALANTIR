# setup-hero-image.ps1
#
# Script auto-instalador da imagem de fundo do Hero da Landing Page.
#
# COMO USAR:
#  1. Salve a imagem do porto Atlântico (a com o arco laranja) em qualquer
#     lugar do seu PC. Pode ser Desktop, Downloads, ou onde quiser.
#  2. Clique com o botão direito neste arquivo .ps1 e escolha "Run with PowerShell"
#     OU abra um PowerShell e rode:
#       powershell -ExecutionPolicy Bypass -File scripts/setup-hero-image.ps1
#  3. O script abre uma janela do Windows pedindo o arquivo de imagem.
#  4. Selecione o arquivo. Pronto.
#
# O QUE O SCRIPT FAZ:
#  - Abre uma janela nativa do Windows para você selecionar o arquivo
#  - Valida que é uma imagem (jpg/jpeg/png/webp)
#  - Valida tamanho (até 5 MB)
#  - Faz backup da imagem atual (atlantico-hero.jpg → atlantico-hero.backup.jpg)
#  - Copia para src/assets/atlantico-hero.jpg sobrescrevendo
#  - Mostra confirmação visual

$ErrorActionPreference = "Stop"

# ── Caminhos ────────────────────────────────────────────────────────────────
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$assetsDir   = Join-Path $projectRoot "src\assets"
$targetFile  = Join-Path $assetsDir "atlantico-hero.jpg"
$backupFile  = Join-Path $assetsDir "atlantico-hero.backup.jpg"

Write-Host ""
Write-Host "=== Atlântico - Setup da Imagem do Hero ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pasta do projeto: $projectRoot" -ForegroundColor Gray
Write-Host "Destino:          $targetFile" -ForegroundColor Gray
Write-Host ""

# ── Verifica que a pasta de assets existe ──────────────────────────────────
if (-not (Test-Path $assetsDir)) {
    Write-Host "[ERRO] Pasta src/assets não encontrada. Você está rodando o script da pasta correta?" -ForegroundColor Red
    Read-Host "Pressione ENTER para sair"
    exit 1
}

# ── Abre o seletor de arquivo do Windows ───────────────────────────────────
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = "Selecione a imagem do hero da Atlântico (porto/guindastes/arco laranja)"
$dialog.Filter = "Imagens (*.jpg;*.jpeg;*.png;*.webp)|*.jpg;*.jpeg;*.png;*.webp"
$dialog.InitialDirectory = [Environment]::GetFolderPath("Downloads")

Write-Host "Abrindo seletor de arquivo... (procure a janela na barra de tarefas)" -ForegroundColor Yellow
Write-Host ""

$result = $dialog.ShowDialog()

if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
    Write-Host "[CANCELADO] Nenhum arquivo selecionado." -ForegroundColor Yellow
    Read-Host "Pressione ENTER para sair"
    exit 0
}

$sourceFile = $dialog.FileName
Write-Host "Arquivo selecionado: $sourceFile" -ForegroundColor Green
Write-Host ""

# ── Valida tamanho ─────────────────────────────────────────────────────────
$sourceInfo = Get-Item $sourceFile
$sizeMB = [math]::Round($sourceInfo.Length / 1MB, 2)

if ($sourceInfo.Length -gt 5MB) {
    Write-Host "[ERRO] Arquivo muito grande ($sizeMB MB). Máximo: 5 MB." -ForegroundColor Red
    Write-Host "       Use um conversor online (tinyjpg.com) para reduzir antes." -ForegroundColor Yellow
    Read-Host "Pressione ENTER para sair"
    exit 1
}

Write-Host "Tamanho do arquivo: $sizeMB MB ✓" -ForegroundColor Green

# ── Backup do arquivo atual ────────────────────────────────────────────────
if (Test-Path $targetFile) {
    Copy-Item -Path $targetFile -Destination $backupFile -Force
    Write-Host "Backup criado:      atlantico-hero.backup.jpg ✓" -ForegroundColor Green
}

# ── Copia o arquivo novo ───────────────────────────────────────────────────
Copy-Item -Path $sourceFile -Destination $targetFile -Force
Write-Host "Imagem copiada para src/assets/atlantico-hero.jpg ✓" -ForegroundColor Green
Write-Host ""

# ── Sucesso ────────────────────────────────────────────────────────────────
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  IMAGEM CONFIGURADA COM SUCESSO!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor White
Write-Host ""
Write-Host "  1. git add src/assets/atlantico-hero.jpg" -ForegroundColor Gray
Write-Host "  2. git commit -m 'feat(landing): nova imagem hero do porto'" -ForegroundColor Gray
Write-Host "  3. git push" -ForegroundColor Gray
Write-Host ""
Write-Host "Ou rode:" -ForegroundColor White
Write-Host "  scripts/commit-hero-image.ps1" -ForegroundColor Gray
Write-Host ""
Read-Host "Pressione ENTER para sair"
