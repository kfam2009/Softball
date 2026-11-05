param(
  [Parameter(Mandatory = $true)]
  [string]$Action
)

$ErrorActionPreference = "Stop"
$uri = "http://localhost:8136/api/scorebug/$Action"

try {
  Invoke-RestMethod -Method Post -Uri $uri -TimeoutSec 2 | Out-Null
  exit 0
} catch {
  try {
    Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 2 | Out-Null
    exit 0
  } catch {
    exit 1
  }
}
