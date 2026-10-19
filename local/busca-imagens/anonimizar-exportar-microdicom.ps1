$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms

function Select-Folder([string]$description) {
  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
  $dialog.Description = $description
  $dialog.ShowNewFolderButton = $false
  try {
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
      return $null
    }
    return $dialog.SelectedPath
  } finally {
    $dialog.Dispose()
  }
}

function Select-MicroDicom {
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Title = 'Selecione o mDicom.exe do MicroDicom 2026.2'
  $dialog.Filter = 'MicroDicom (mDicom.exe)|mDicom.exe|Executaveis (*.exe)|*.exe'
  $dialog.FileName = 'mDicom.exe'
  $dialog.CheckFileExists = $true
  $dialog.Multiselect = $false
  try {
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
      return $null
    }
    return $dialog.FileName
  } finally {
    $dialog.Dispose()
  }
}

try {
  Write-Host 'Selecione a pasta de origem com as imagens DICOM.'
  $source = Select-Folder 'Selecione a pasta que contem as imagens DICOM'
  if (-not $source) {
    Write-Host 'Operacao cancelada.'
    exit 0
  }

  Write-Host 'Selecione o executavel mDicom.exe do MicroDicom 2026.2.'
  $microDicom = Select-MicroDicom
  if (-not $microDicom) {
    Write-Host 'Operacao cancelada.'
    exit 0
  }

  $source = [System.IO.Path]::GetFullPath($source).TrimEnd('\')
  if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw 'A pasta de origem selecionada nao esta acessivel.'
  }
  if (-not (Test-Path -LiteralPath $microDicom -PathType Leaf)) {
    throw 'O executavel do MicroDicom nao foi encontrado.'
  }

  $sourceHasFiles = Get-ChildItem -LiteralPath $source -File -Recurse -ErrorAction Stop |
    Select-Object -First 1
  if (-not $sourceHasFiles) {
    throw 'A pasta de origem selecionada nao contem arquivos.'
  }

  $desktop = [Environment]::GetFolderPath('Desktop')
  $outputRoot = Join-Path $desktop 'IMAGENS PACS'
  New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

  do {
    $runName = 'Lote_' + (Get-Date -Format 'yyyyMMdd_HHmmss')
    $runRoot = Join-Path $outputRoot $runName
    if (Test-Path -LiteralPath $runRoot) { Start-Sleep -Seconds 1 }
  } while (Test-Path -LiteralPath $runRoot)

  $anonymizedFolder = Join-Path $runRoot 'DICOM_ANONIMIZADOS'
  $jpegFolder = Join-Path $runRoot 'JPG_EMAIL'
  New-Item -ItemType Directory -Path $anonymizedFolder | Out-Null
  New-Item -ItemType Directory -Path $jpegFolder | Out-Null

  Write-Host 'Etapa 1 de 2: anonimizando copias DICOM com o template Default...'
  & $microDicom `
    -anonymize `
    -in $source `
    -out $anonymizedFolder `
    -template 'Default' `
    -fileNameText '_anon' `
    -fileNameTextPosition 'end' `
    -showUI
  $anonymizeExitCode = $LASTEXITCODE
  if ($null -ne $anonymizeExitCode -and $anonymizeExitCode -ne 0) {
    throw "A anonimizacao do MicroDicom retornou o codigo $anonymizeExitCode. Confira a janela do programa."
  }

  $anonymizedFiles = @(Get-ChildItem -LiteralPath $anonymizedFolder -File -Recurse -ErrorAction Stop)
  if ($anonymizedFiles.Count -eq 0) {
    throw 'O MicroDicom nao criou arquivos anonimizados. Confira se a pasta contem DICOMs.'
  }

  Write-Host 'Etapa 2 de 2: convertendo as copias anonimizadas para JPEG...'
  & $microDicom `
    -scanAndConvert `
    -format jpeg `
    -overlay anonymous `
    -in $anonymizedFolder `
    -out $jpegFolder `
    -showUI
  $convertExitCode = $LASTEXITCODE
  if ($null -ne $convertExitCode -and $convertExitCode -ne 0) {
    throw "A conversao JPEG do MicroDicom retornou o codigo $convertExitCode. Confira a janela do programa."
  }

  $jpegFiles = @(Get-ChildItem -LiteralPath $jpegFolder -File -Recurse -ErrorAction Stop |
    Where-Object { $_.Extension -in '.jpg', '.jpeg' } |
    Sort-Object FullName)
  if ($jpegFiles.Count -eq 0) {
    throw 'O MicroDicom nao criou arquivos JPEG.'
  }

  # Use nomes neutros para que o nome original do arquivo nao apareca nos anexos.
  $index = 1
  foreach ($file in $jpegFiles) {
    Rename-Item -LiteralPath $file.FullName -NewName ('imagem_{0:D4}.jpg' -f $index)
    $index++
  }

  Write-Host ''
  Write-Host 'Concluido.'
  Write-Host "Arquivos DICOM anonimizados: $($anonymizedFiles.Count)"
  Write-Host "Arquivos JPEG: $($jpegFiles.Count)"
  Write-Host "Pasta de saida: $runRoot"
  Write-Host 'Revise cada imagem para identificar texto identificavel gravado nos pixels antes de compartilhar.'
  Start-Process -FilePath (Join-Path $env:WINDIR 'explorer.exe') -ArgumentList ('"' + $jpegFolder + '"')
} catch {
  Write-Host ''
  Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'Os arquivos originais nao foram modificados. Confira a mensagem do MicroDicom e tente novamente.'
  Read-Host 'Pressione Enter para fechar'
  exit 1
}
