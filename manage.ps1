<#
.SYNOPSIS
    Sylvie TaskList 本地运维脚本（桌面端构建 + 本机数据 + MCP 探活）。

.DESCRIPTION
    封装 tasklist-monorepo 的常用操作：安装依赖、开发模式、打包、类型检查、Lint、清理、
    图标生成与截图回归；同时提供本机数据目录的查看、备份、重置，以及 MCP Server 探活。
    全部为本机操作，不依赖 Docker。

.PARAMETER Action
    要执行的操作，默认 status：
      status      环境 / 运行状态 / 数据文件 / 构建产物 / MCP 端口一览
      install     安装依赖（pnpm install，首次或其他包变更后执行）
      dev         开发模式（electron-forge start + Vite HMR）
      package     打包为免安装目录（apps/electron/dist）
      make        生成 Windows 安装包（Squirrel + ZIP，apps/electron/dist/make）
      check       依次执行 typecheck 与 lint
      typecheck   全仓库类型检查
      lint        全仓库 ESLint（--max-warnings 0）
      test        运行单元测试（Vitest：core / utils / mcp）
      clean       清理构建产物与缓存（.vite / dist / out / .turbo）
      icon        重新生成应用图标（assets 下的 PNG / ICO / 托盘图）
      screenshot  截图回归（可配合 -View / -Category）
      data        在资源管理器中打开数据目录
      backup      备份 tasks.json / settings.json 到 backups/<时间戳>
      reset       删除数据文件（会先自动备份，需输入 YES 确认）
      mcp         探测 MCP Server，输出可粘贴到客户端的配置

.PARAMETER View
    screenshot 的视图：main（默认）、settings、task。

.PARAMETER Category
    screenshot -View settings 时要打开的分类（如「MCP 服务」「配置文件」）。

.PARAMETER Output
    screenshot 的输出文件；默认 artifacts/screenshots/<view>-<时间戳>.png。

.PARAMETER Force
    reset 跳过二次确认。

.PARAMETER Port
    mcp 探测的起始端口，默认 37821（最多向后尝试 10 个）。

.EXAMPLE
    pwsh ./manage.ps1 status

.EXAMPLE
    pwsh ./manage.ps1 dev

.EXAMPLE
    pwsh ./manage.ps1 make

.EXAMPLE
    pwsh ./manage.ps1 check

.EXAMPLE
    pwsh ./manage.ps1 screenshot -View settings -Category 'MCP 服务'

.EXAMPLE
    pwsh ./manage.ps1 backup

.EXAMPLE
    pwsh ./manage.ps1 reset -Force

.EXAMPLE
    pwsh ./manage.ps1 mcp
#>
#Requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet(
        'status', 'install', 'dev', 'package', 'make',
        'check', 'typecheck', 'lint', 'test', 'clean', 'icon',
        'screenshot', 'data', 'backup', 'reset', 'mcp'
    )]
    [string]$Action = 'status',

    [ValidateSet('main', 'settings', 'task')]
    [string]$View = 'main',

    [string]$Category,

    [string]$Output,

    [switch]$Force,

    [ValidateRange(1024, 65535)]
    [int]$Port = 37821
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# 统一以 UTF-8 输出，避免中文在重定向/管道中乱码
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptRoot = $PSScriptRoot
$MonorepoRoot = Join-Path $ScriptRoot 'tasklist-monorepo'
$BackupsDir = Join-Path $ScriptRoot 'backups'
$ArtifactsDir = Join-Path $ScriptRoot 'artifacts'

$DataDir = $(
    # 开发模式与打包后的产品名大小写/空格可能不同，取第一个已存在的目录
    $roaming = [Environment]::GetFolderPath('ApplicationData')
    $candidates = @(
        (Join-Path $roaming 'Sylvie TaskList'),
        (Join-Path $roaming 'Sylvie Task List')
    )
    $found = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($found) { $found } else { $candidates[0] }
)
$TasksFile = Join-Path $DataDir 'tasks.json'
$SettingsFile = Join-Path $DataDir 'settings.json'

$DistExe = Join-Path $MonorepoRoot 'apps/electron/dist/Sylvie TaskList-win32-x64/SylvieTaskList.exe'
$MakeDir = Join-Path $MonorepoRoot 'apps/electron/dist/make'

function Write-Section {
    param([Parameter(Mandatory)][string]$Title)
    Write-Host ('-' * 44) -ForegroundColor DarkGray
    Write-Host "== $Title ==" -ForegroundColor Cyan
}

function Write-Ok {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  $Message" -ForegroundColor Green
}

function Write-Info {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  $Message" -ForegroundColor Gray
}

function Write-Warn {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  $Message" -ForegroundColor Yellow
}

function Assert-NodePrerequisites {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw '未找到 node 命令，请先安装 Node.js 20.11 或更高版本。'
    }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw '未找到 pnpm 命令，请执行 corepack enable（或 npm install -g pnpm）。'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $MonorepoRoot 'package.json'))) {
        throw "未找到 monorepo 目录：$MonorepoRoot"
    }

    $nodeVersion = (& node --version).Trim().TrimStart('v')
    $nodeMajor = [int]($nodeVersion.Split('.')[0])
    if ($nodeMajor -lt 20) {
        throw "Node.js 版本过低（$nodeVersion），需要 >= 20.11。"
    }
}

function Invoke-Pnpm {
    param(
        [Parameter(Mandatory)][string[]]$PnpmArgs,
        [string]$WorkingDirectory = $MonorepoRoot
    )

    Push-Location $WorkingDirectory
    $previousPreference = $ErrorActionPreference
    try {
        # 原生命令的告警走 stderr，放宽避免被当成终止错误
        $ErrorActionPreference = 'Continue'
        & pnpm @PnpmArgs
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
        Pop-Location
    }

    if ($exitCode -ne 0) {
        throw "pnpm $($PnpmArgs -join ' ') 执行失败（退出码 $exitCode）。"
    }
}

function Get-AppProcesses {
    try {
        return @(
            Get-CimInstance Win32_Process -Filter "Name='electron.exe' OR Name='SylvieTaskList.exe'" -ErrorAction SilentlyContinue |
                Where-Object { $_.ExecutablePath -and $_.ExecutablePath -like '*sylvie-tasklist*' }
        )
    }
    catch {
        return @()
    }
}

function Get-McpEndpoint {
    param(
        [int]$StartPort = $Port,
        [int]$Tries = 10
    )

    for ($offset = 0; $offset -lt $Tries; $offset += 1) {
        $candidate = $StartPort + $offset
        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:$candidate/health" -TimeoutSec 1 -ErrorAction Stop
            if ($null -ne $response -and $response.ok -eq $true) {
                return [pscustomobject]@{
                    Port    = $candidate
                    Version = $response.version
                    Server  = $response.server
                }
            }
        }
        catch {
            # 端口未监听，继续试探下一个
        }
    }

    return $null
}

function Get-TasksSummary {
    param([Parameter(Mandatory)][string]$Path)

    try {
        $data = (Get-Content -LiteralPath $Path -Raw -Encoding UTF8) | ConvertFrom-Json
        $taskCount = @($data.tasks).Count
        $groupCount = @($data.groups).Count
        return "共 $taskCount 个任务 / $groupCount 个分组"
    }
    catch {
        return '无法解析（文件可能损坏）'
    }
}

function Get-SettingsSummary {
    param([Parameter(Mandatory)][string]$Path)

    try {
        $settings = (Get-Content -LiteralPath $Path -Raw -Encoding UTF8) | ConvertFrom-Json
        $theme = [string]$settings.'appearance.theme'
        $themeText = switch ($theme) {
            'light' { '亮色' }
            'dark' { '暗色' }
            'system' { '跟随系统' }
            default { $theme }
        }
        $mcpText = if ($settings.'mcp.serverEnabled' -eq $true) { '开启' } else { '关闭' }
        return "主题 $themeText，MCP $mcpText"
    }
    catch {
        return '无法解析（文件可能损坏）'
    }
}

function Format-FileInfo {
    param([Parameter(Mandatory)][string]$Path)

    $item = Get-Item -LiteralPath $Path
    $sizeKb = [math]::Round($item.Length / 1KB, 1)
    return "$($item.LastWriteTime.ToString('MM-dd HH:mm')) 更新，$sizeKb KB"
}

function Show-Status {
    Write-Section '环境'

    $nodeVersion = if (Get-Command node -ErrorAction SilentlyContinue) {
        (& node --version).Trim()
    }
    else { '未安装' }
    $pnpmVersion = if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        (& pnpm --version).Trim()
    }
    else { '未安装' }
    Write-Info "Node.js     $nodeVersion"
    Write-Info "pnpm        $pnpmVersion"

    if (Test-Path -LiteralPath (Join-Path $MonorepoRoot 'node_modules')) {
        Write-Info '依赖        已安装（node_modules）'
    }
    else {
        Write-Warn '依赖        未安装，执行：pwsh ./manage.ps1 install'
    }

    Write-Section '运行状态'

    $processes = @(Get-AppProcesses)
    if ($processes.Count -gt 0) {
        $pids = ($processes | ForEach-Object { $_.ProcessId }) -join ', '
        Write-Ok "应用        运行中（PID $pids）"
    }
    else {
        Write-Info '应用        未运行'
    }

    $endpoint = Get-McpEndpoint
    if ($null -ne $endpoint) {
        Write-Ok "MCP         http://127.0.0.1:$($endpoint.Port)/mcp（v$($endpoint.Version)）"
    }
    else {
        Write-Info "MCP         未监听 $Port 起的端口（设置 → MCP 服务 中开启）"
    }

    Write-Section '数据文件'

    if (-not (Test-Path -LiteralPath $DataDir)) {
        Write-Warn "数据目录尚未创建：$DataDir"
        Write-Info '首次启动应用后会自动生成示例数据。'
    }
    else {
        Write-Info "目录        $DataDir"

        if (Test-Path -LiteralPath $TasksFile) {
            Write-Info "tasks.json  $(Get-TasksSummary -Path $TasksFile)（$(Format-FileInfo -Path $TasksFile)）"
        }
        else {
            Write-Warn 'tasks.json  缺失（下次启动会重新生成）'
        }

        if (Test-Path -LiteralPath $SettingsFile) {
            Write-Info "settings.json  $(Get-SettingsSummary -Path $SettingsFile)（$(Format-FileInfo -Path $SettingsFile)）"
        }
        else {
            Write-Warn 'settings.json  缺失（下次启动会写入默认配置）'
        }
    }

    Write-Section '构建产物'

    if (Test-Path -LiteralPath $DistExe) {
        $exe = Get-Item -LiteralPath $DistExe
        $sizeMb = [math]::Round($exe.Length / 1MB, 1)
        Write-Ok "免安装包    $($exe.LastWriteTime.ToString('MM-dd HH:mm')) 构建，$sizeMb MB"
        Write-Info "路径        $DistExe"
    }
    else {
        Write-Info '免安装包    未构建（pwsh ./manage.ps1 package）'
    }

    if (Test-Path -LiteralPath $MakeDir) {
        $installer = Get-ChildItem -LiteralPath $MakeDir -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Extension -in @('.exe', '.nupkg') } |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($null -ne $installer) {
            Write-Ok "安装包      $($installer.Name)（$($installer.LastWriteTime.ToString('MM-dd HH:mm'))）"
            Write-Info "路径        $MakeDir"
        }
    }
    else {
        Write-Info '安装包      未生成（pwsh ./manage.ps1 make）'
    }
}

function Invoke-Backup {
    $sources = @(@($TasksFile, $SettingsFile) | Where-Object { Test-Path -LiteralPath $_ })
    if ($sources.Count -eq 0) {
        throw "没有可备份的数据文件：$DataDir"
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $target = Join-Path $BackupsDir $stamp
    New-Item -ItemType Directory -Path $target -Force | Out-Null

    foreach ($source in $sources) {
        Copy-Item -LiteralPath $source -Destination $target
    }

    return $target
}

function Invoke-ResetData {
    $sources = @(@($TasksFile, $SettingsFile) | Where-Object { Test-Path -LiteralPath $_ })
    if ($sources.Count -eq 0) {
        Write-Warn "数据目录中没有 tasks.json / settings.json：$DataDir"
        return
    }

    if (-not $Force) {
        Write-Warn '将删除 tasks.json 与 settings.json（下次启动重新生成示例数据）。'
        $answer = Read-Host '输入 YES 继续'
        if ($answer -ne 'YES') {
            Write-Host '已取消。' -ForegroundColor Yellow
            return
        }
    }

    $backupPath = Invoke-Backup
    Write-Info "已备份到 $backupPath"

    foreach ($source in $sources) {
        Remove-Item -LiteralPath $source -Force
    }
    Write-Ok '数据文件已删除，下次启动会重新生成。'
}

function Invoke-Screenshot {
    Assert-NodePrerequisites

    if ($Category -and $View -ne 'settings') {
        Write-Warn '仅 -View settings 支持 -Category，已忽略。'
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    if ($Output) {
        $resolved = if ([System.IO.Path]::IsPathRooted($Output)) {
            $Output
        }
        else {
            Join-Path (Get-Location).Path $Output
        }
    }
    else {
        $directory = Join-Path $ArtifactsDir 'screenshots'
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
        $resolved = Join-Path $directory "$View-$stamp.png"
    }

    $parent = Split-Path -Parent $resolved
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $previousCapture = $env:TASKLIST_CAPTURE
    $previousView = $env:TASKLIST_CAPTURE_VIEW
    $previousCategory = $env:TASKLIST_CAPTURE_CATEGORY
    try {
        $env:TASKLIST_CAPTURE = $resolved
        $env:TASKLIST_CAPTURE_VIEW = if ($View -ne 'main') { $View } else { $null }
        $env:TASKLIST_CAPTURE_CATEGORY = if ($Category -and $View -eq 'settings') { $Category } else { $null }

        Write-Info "视图 $View$(if ($Category -and $View -eq 'settings') { " · 分类 $Category" })"
        Invoke-Pnpm -PnpmArgs @('desktop:dev')
    }
    finally {
        $env:TASKLIST_CAPTURE = $previousCapture
        $env:TASKLIST_CAPTURE_VIEW = $previousView
        $env:TASKLIST_CAPTURE_CATEGORY = $previousCategory
    }

    if (Test-Path -LiteralPath $resolved) {
        Write-Ok "截图已保存：$resolved"
    }
    else {
        throw "截图未生成：$resolved"
    }
}

try {
    switch ($Action) {
        'status' {
            Show-Status
        }

        'install' {
            Assert-NodePrerequisites
            Invoke-Pnpm -PnpmArgs @('install')
            Write-Ok '依赖安装完成。'
        }

        'dev' {
            Assert-NodePrerequisites
            Invoke-Pnpm -PnpmArgs @('desktop:dev')
        }

        'package' {
            Assert-NodePrerequisites
            Invoke-Pnpm -PnpmArgs @('desktop:package')
            if (-not (Test-Path -LiteralPath $DistExe)) {
                throw "打包完成但未找到可执行文件：$DistExe"
            }
            Write-Ok "免安装包：$DistExe"
        }

        'make' {
            Assert-NodePrerequisites
            Invoke-Pnpm -PnpmArgs @('desktop:make')
            Write-Ok "安装包目录：$MakeDir"
        }

        'check' {
            Assert-NodePrerequisites
            Invoke-Pnpm -PnpmArgs @('typecheck')
            Invoke-Pnpm -PnpmArgs @('lint')
            Write-Ok '类型检查与 ESLint 均通过。'
        }

        'typecheck' {
            Assert-NodePrerequisites
            Invoke-Pnpm -PnpmArgs @('typecheck')
        }

        'lint' {
            Assert-NodePrerequisites
            Invoke-Pnpm -PnpmArgs @('lint')
        }

        'test' {
            Assert-NodePrerequisites
            Invoke-Pnpm -PnpmArgs @('test')
        }

        'clean' {
            Assert-NodePrerequisites
            Write-Warn '将删除 .vite / dist / out / .turbo 等构建产物（不影响任务数据）。'
            Invoke-Pnpm -PnpmArgs @('clean')
            Write-Ok '构建产物已清理。'
        }

        'icon' {
            Assert-NodePrerequisites
            Invoke-Pnpm -PnpmArgs @('--filter', '@sylvie/electron', 'icon')
            Write-Ok '图标已重新生成（apps/electron/assets）。'
        }

        'screenshot' {
            Invoke-Screenshot
        }

        'data' {
            if (-not (Test-Path -LiteralPath $DataDir)) {
                Write-Warn "数据目录尚未创建：$DataDir"
                Write-Info '首次启动应用后会自动生成。'
                exit 0
            }
            Start-Process explorer.exe -ArgumentList $DataDir
            Write-Ok "已打开：$DataDir"
        }

        'backup' {
            $path = Invoke-Backup
            Write-Ok "备份完成：$path"
        }

        'reset' {
            Invoke-ResetData
        }

        'mcp' {
            $endpoint = Get-McpEndpoint
            if ($null -eq $endpoint) {
                Write-Warn "未探测到 MCP Server（$Port 起 10 个端口）。"
                Write-Info '请先在 设置 → MCP 服务 中开启开关；应用需保持运行。'
                exit 0
            }

            Write-Ok "MCP Server 运行中：http://127.0.0.1:$($endpoint.Port)/mcp（v$($endpoint.Version)）"
            Write-Host ('-' * 44) -ForegroundColor DarkGray
            Write-Host '客户端配置（粘贴到 mcpServers；VS Code 使用 servers 根键）：' -ForegroundColor Cyan
            $config = [pscustomobject]@{
                mcpServers = [pscustomobject]@{
                    'sylvie-tasklist' = [pscustomobject]@{
                        type = 'http'
                        url  = "http://127.0.0.1:$($endpoint.Port)/mcp"
                    }
                }
            }
            $config | ConvertTo-Json -Depth 5
        }
    }
}
catch {
    Write-Host "执行失败：$($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

exit 0
