$ErrorActionPreference = 'Stop'

$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$destination = Join-Path $env:LOCALAPPDATA 'CEU\BuscaImagens'
$files = @('bridge.py', 'config.example.json', 'iniciar-auxiliar.bat')

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
  throw 'Python 3 Launcher (py.exe) não encontrado. Instale Python 3 para Windows e execute novamente.'
}

$version = & py -3 --version 2>&1
if ($LASTEXITCODE -ne 0) {
  throw 'Python 3 não pôde ser iniciado. Instale Python 3 para Windows e execute novamente.'
}

New-Item -ItemType Directory -Force -Path $destination | Out-Null
foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $source $file) -Destination (Join-Path $destination $file) -Force
}

$configPath = Join-Path $destination 'config.json'
if (-not (Test-Path -LiteralPath $configPath)) {
  $providedConfig = Join-Path $source 'config.json'
  if (Test-Path -LiteralPath $providedConfig) {
    Copy-Item -LiteralPath $providedConfig -Destination $configPath
  } else {
    Copy-Item -LiteralPath (Join-Path $destination 'config.example.json') -Destination $configPath
  }
}

Write-Host 'Auxiliar copiado para:' $destination
Write-Host 'Python detectado:' $version
Write-Host ''
Write-Host 'Próximos passos:'
Write-Host '1. Confira config.json e os caminhos de rede. Em atualizações, a configuração existente é preservada.'
Write-Host '2. Se o pacote incluiu config.json, ele só foi copiado quando ainda não havia configuração local.'
Write-Host '3. Execute iniciar-auxiliar.bat e mantenha a janela aberta durante as buscas.'
Write-Host '4. Na primeira conexão, permita ao portal acessar o serviço local no navegador.'
Write-Host ''
Write-Host 'O auxiliar roda como seu usuário, em 127.0.0.1, sem instalar serviço do Windows ou salvar senha SMB.'
