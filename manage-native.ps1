param(
 [Parameter(Mandatory=$true)][ValidateSet('Install','Restore','Check')][string]$Action,
 [Parameter(Mandatory=$true)][string]$AppDir,
 [string]$StateDir=(Join-Path $PSScriptRoot '.local-state'),
 [string]$DisplayName='Commander'
)
$ErrorActionPreference='Stop'
try {
 $jarvisNode=(Get-Command node.exe -ErrorAction Stop).Source
 $jarvisWorker=Join-Path $PSScriptRoot 'native-patch.cjs'
 $jarvisOptions=@('--app-dir',$AppDir,'--state-dir',$StateDir)
 if($Action -eq 'Install'){
   & $jarvisNode $jarvisWorker build @jarvisOptions --name $DisplayName
   if($LASTEXITCODE -ne 0){throw 'Build failed; application files were not replaced.'}
   & $jarvisNode $jarvisWorker install @jarvisOptions
 } elseif($Action -eq 'Restore') {
   & $jarvisNode $jarvisWorker restore @jarvisOptions
 } else {
   & $jarvisNode $jarvisWorker check @jarvisOptions
 }
 if($LASTEXITCODE -ne 0){throw 'Operation stopped. Read the message above; keep the backup directory.'}
 Write-Host 'Completed. Open DSH manually when ready.'
} catch {Write-Error $_.Exception.Message;exit 1}
