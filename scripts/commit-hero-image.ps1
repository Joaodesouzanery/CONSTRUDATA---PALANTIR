# commit-hero-image.ps1
#
# Atalho: roda git add + commit + push da imagem nova do hero.
# Use depois de rodar setup-hero-image.ps1.

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

Write-Host ""
Write-Host "=== Atlântico - Commit da Imagem do Hero ===" -ForegroundColor Cyan
Write-Host ""

# Verifica se há mudança no arquivo
$status = git status --porcelain src/assets/atlantico-hero.jpg
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "[INFO] Nenhuma mudança detectada em src/assets/atlantico-hero.jpg" -ForegroundColor Yellow
    Write-Host "       Rode setup-hero-image.ps1 primeiro." -ForegroundColor Yellow
    Read-Host "Pressione ENTER para sair"
    exit 0
}

# Add
git add src/assets/atlantico-hero.jpg
Write-Host "[OK] git add" -ForegroundColor Green

# Commit
git commit -m "feat(landing): nova imagem hero do porto Atlântico"
Write-Host "[OK] git commit" -ForegroundColor Green

# Push
git push origin main
Write-Host "[OK] git push" -ForegroundColor Green

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  IMAGEM PUBLICADA COM SUCESSO!" -ForegroundColor Green
Write-Host "  A Vercel deve atualizar em ~2 minutos." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Pressione ENTER para sair"
