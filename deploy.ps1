# Cloudflare Pages 배포 스크립트
# 사용법: PowerShell에서 이 파일 실행
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== Cloudflare Pages 배포 ===" -ForegroundColor Cyan
Write-Host "프로젝트: pharmacy-inventory"
Write-Host "URL: https://pharmacy-inventory-4pv.pages.dev"
Write-Host ""

# 로그인 확인
$whoami = & "C:\Program Files\nodejs\npx.cmd" wrangler whoami 2>&1
if ($whoami -match "not authenticated") {
    Write-Host "Cloudflare 로그인이 필요합니다." -ForegroundColor Yellow
    Write-Host "브라우저가 열리면 로그인을 완료해 주세요..." -ForegroundColor Yellow
    & "C:\Program Files\nodejs\npx.cmd" wrangler login
}

Write-Host "배포 중..." -ForegroundColor Green
& "C:\Program Files\nodejs\npx.cmd" wrangler pages deploy public --project-name pharmacy-inventory --commit-dirty=true

Write-Host ""
Write-Host "배포 완료! Ctrl+F5로 새로고침 후 확인:" -ForegroundColor Green
Write-Host "https://pharmacy-inventory-4pv.pages.dev"