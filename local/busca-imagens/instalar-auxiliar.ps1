$ErrorActionPreference = 'Stop'

$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$destination = Join-Path $env:LOCALAPPDATA 'CEU\BuscaImagens'
$taskName = 'CEU - Auxiliar Busca de Imagens'
$files = @('bridge.py', 'clipboard_win.py', 'config.example.json', 'iniciar-auxiliar.bat')

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
  throw 'Python 3 Launcher (py.exe) não encontrado. Instale Python 3 para Windows e execute novamente.'
}

$version = & py -3 --version 2>&1
if ($LASTEXITCODE -ne 0) {
  throw 'Python 3 não pôde ser iniciado. Instale Python 3 para Windows e execute novamente.'
}

$pythonExecutable = (& py -3 -c 'import sys; print(sys.executable)' 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $pythonExecutable -PathType Leaf)) {
  throw 'Não foi possível localizar o executável Python 3 usado pelo launcher py.exe.'
}
$pythonw = Join-Path (Split-Path -Parent $pythonExecutable) 'pythonw.exe'
if (-not (Test-Path -LiteralPath $pythonw -PathType Leaf)) {
  throw "pythonw.exe não encontrado ao lado do Python ($pythonExecutable). Reinstale Python 3 incluindo pythonw.exe."
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

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$bridgePath = Join-Path $destination 'bridge.py'
$arguments = '"{0}" --config "{1}"' -f $bridgePath, $configPath
$action = New-ScheduledTaskAction -Execute $pythonw -Argument $arguments -WorkingDirectory $destination
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Force | Out-Null

function Test-AuxiliarPort {
  $client = [System.Net.Sockets.TcpClient]::new()
  $pending = $null
  try {
    $pending = $client.BeginConnect('127.0.0.1', 8765, $null, $null)
    if (-not $pending.AsyncWaitHandle.WaitOne(500)) {
      return $false
    }
    $client.EndConnect($pending)
    return $client.Connected
  } catch {
    return $false
  } finally {
    if ($pending -and $pending.AsyncWaitHandle) {
      $pending.AsyncWaitHandle.Close()
    }
    $client.Close()
  }
}

$alreadyRunning = Test-AuxiliarPort
if (-not $alreadyRunning) {
  Start-ScheduledTask -TaskName $taskName
  $started = $false
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (Test-AuxiliarPort) {
      $started = $true
      break
    }
  }
} else {
  $started = $true
}

Write-Host 'Auxiliar copiado para:' $destination
Write-Host 'Python detectado:' $version
Write-Host 'Tarefa agendada para o usuário:' $identity
Write-Host ''
Write-Host 'O auxiliar será iniciado sem janela nesta sessão e nos próximos logons.'
Write-Host 'O config.json existente foi preservado.'
if ($started) {
  Write-Host 'Auxiliar ativo em http://127.0.0.1:8765.'
} else {
  Write-Warning 'A tarefa foi registrada, mas o auxiliar não abriu a porta. Confira config.json; depois salve e execute este instalador novamente.'
}
Write-Host 'Na primeira conexão, permita o acesso local ao portal no navegador.'
Write-Host 'O auxiliar roda como o usuário atual, sem serviço Windows, administrador ou senha SMB.'
