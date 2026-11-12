# Lance tout Quartier General : dependances, liste des agents, hooks, serveur d'evenements, puis le bureau.
Set-Location $PSScriptRoot

if (-not (Test-Path node_modules)) { npm install }
npm run sync
node scripts/install-hooks.mjs

$server = Start-Process node -ArgumentList 'server/server.mjs' -NoNewWindow -PassThru
try {
    npm run dev -- --open
}
finally {
    if (-not $server.HasExited) { Stop-Process -Id $server.Id }
}
