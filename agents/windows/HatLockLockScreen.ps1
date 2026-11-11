# ==============================================================================
# HatLock Windows Security — Topmost Lock Screen Overlay Window
# Developed by Luxeenet for HatLock PRO Universal Fleet Protection
# ==============================================================================

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase -ErrorAction SilentlyContinue

$DataDir = "C:\ProgramData\Luxeenet\HatLock"
$FlagPath = Join-Path $DataDir "restricted.flag"
$RestrictionJsonPath = Join-Path $DataDir "restriction.json"

# Load restriction data
$reason = "Scheduled instalment payment defaulted beyond permissible grace period."
$outstanding = "TZS 150,000"
$instructions = "Pay via M-Pesa / HatPesa Paybill 552200 or contact your equipment financing branch manager."
$support = "support@luxeenet.com | +255 700 000 000"
$deviceDetails = "Lenovo Workstation"
$agreementNumber = "HP-2026-001"

if (Test-Path $RestrictionJsonPath) {
    try {
        $info = Get-Content -Path $RestrictionJsonPath -Raw | ConvertFrom-Json
        if ($info.reason) { $reason = $info.reason }
        if ($info.outstandingAmountTZS) { $outstanding = "TZS " + [string]$info.outstandingAmountTZS }
        if ($info.paymentInstructions) { $instructions = $info.paymentInstructions }
        if ($info.supportContact) { $support = $info.supportContact }
        if ($info.deviceDetails) { $deviceDetails = $info.deviceDetails }
        if ($info.agreementNumber) { $agreementNumber = $info.agreementNumber }
    } catch {}
}

# Construct WPF XAML Window
[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="HatLock Security Lockdown"
        WindowStyle="None"
        WindowState="Maximized"
        Topmost="True"
        ShowInTaskbar="False"
        ResizeMode="NoResize"
        Background="#080c14"
        Cursor="Arrow">
    <Grid VerticalAlignment="Center" HorizontalAlignment="Center" Margin="30">
        <Border Background="#0f172a"
                CornerRadius="20"
                Padding="40"
                BorderBrush="#ef4444"
                BorderThickness="2"
                Width="720">
            <Border.Effect>
                <DropShadowEffect BlurRadius="30" Color="#ef4444" Opacity="0.35" ShadowDepth="0"/>
            </Border.Effect>
            <StackPanel>
                <!-- Badge -->
                <Border Background="#1e293b" CornerRadius="12" Padding="12,6" HorizontalAlignment="Center" Margin="0,0,0,16" BorderBrush="#38bdf8" BorderThickness="1">
                    <TextBlock Text="HATLOCK PRO HARDWARE SECURITY HUB" FontSize="11" FontWeight="Bold" Foreground="#38bdf8" HorizontalAlignment="Center"/>
                </Border>

                <!-- Title -->
                <TextBlock Text="DEVICE RESTRICTED" FontSize="28" FontWeight="ExtraBold" Foreground="#f87171" HorizontalAlignment="Center" Margin="0,0,0,6"/>
                <TextBlock Text="HARDWARE ACCESS HAS BEEN TEMPORARILY RESTRICTED" FontSize="13" FontWeight="SemiBold" Foreground="#94a3b8" HorizontalAlignment="Center" Margin="0,0,0,24"/>

                <!-- Details Panel -->
                <Border Background="#090d16" CornerRadius="14" Padding="24" Margin="0,0,0,20" BorderBrush="#1e293b" BorderThickness="1">
                    <StackPanel>
                        <!-- Device Info -->
                        <Grid Margin="0,0,0,14">
                            <Grid.ColumnDefinitions>
                                <ColumnDefinition Width="*"/>
                                <ColumnDefinition Width="*"/>
                            </Grid.ColumnDefinitions>
                            <StackPanel Grid.Column="0">
                                <TextBlock Text="MANAGED HARDWARE" FontSize="10" FontWeight="Bold" Foreground="#64748b"/>
                                <TextBlock Text="$deviceDetails" FontSize="13" FontWeight="Bold" Foreground="#f1f5f9" Margin="0,2,0,0"/>
                            </StackPanel>
                            <StackPanel Grid.Column="1">
                                <TextBlock Text="AGREEMENT NUMBER" FontSize="10" FontWeight="Bold" Foreground="#64748b"/>
                                <TextBlock Text="$agreementNumber" FontSize="13" FontWeight="Bold" Foreground="#38bdf8" Margin="0,2,0,0"/>
                            </StackPanel>
                        </Grid>

                        <Separator Background="#1e293b" Margin="0,4,0,14"/>

                        <!-- Reason -->
                        <TextBlock Text="REASON FOR RESTRICTION" FontSize="10" FontWeight="Bold" Foreground="#64748b" Margin="0,0,0,4"/>
                        <TextBlock Text="$reason" FontSize="12.5" FontWeight="SemiBold" Foreground="#fca5a5" TextWrapping="Wrap" Margin="0,0,0,14"/>

                        <!-- Outstanding Amount -->
                        <TextBlock Text="OUTSTANDING BALANCE DUE" FontSize="10" FontWeight="Bold" Foreground="#64748b" Margin="0,0,0,4"/>
                        <TextBlock Text="$outstanding" FontSize="18" FontWeight="ExtraBold" Foreground="#34d399" Margin="0,0,0,14"/>

                        <!-- Payment instructions -->
                        <TextBlock Text="PAYMENT INSTRUCTIONS" FontSize="10" FontWeight="Bold" Foreground="#64748b" Margin="0,0,0,4"/>
                        <TextBlock Text="$instructions" FontSize="12" Foreground="#e2e8f0" TextWrapping="Wrap" Margin="0,0,0,14"/>

                        <!-- Support Contact -->
                        <TextBlock Text="LUXEENET FLEET SUPPORT" FontSize="10" FontWeight="Bold" Foreground="#64748b" Margin="0,0,0,4"/>
                        <TextBlock Text="$support" FontSize="13" FontWeight="Bold" Foreground="#38bdf8"/>
                    </StackPanel>
                </Border>

                <!-- Footer notice -->
                <TextBlock Text="The device watchdog checks for payment confirmation every 15 seconds. Once verified, this workstation will unlock automatically."
                           FontSize="11"
                           Foreground="#64748b"
                           TextWrapping="Wrap"
                           TextAlignment="Center"
                           HorizontalAlignment="Center"/>
            </StackPanel>
        </Border>
    </Grid>
</Window>
"@

try {
    $reader = New-Object System.Xml.XmlNodeReader $xaml
    $window = [System.Windows.Markup.XamlReader]::Load($reader)

    # Prevent closure while restriction flag exists
    $window.add_Closing({
        param($sender, $e)
        if (Test-Path $FlagPath) {
            $e.Cancel = $true
        }
    })

    # Re-focus if deactivated
    $window.add_Deactivated({
        param($sender, $e)
        if (Test-Path $FlagPath) {
            $sender.Topmost = $true
            $sender.Activate()
        }
    })

    # Background timer checking if restriction was lifted
    $dispatcherTimer = New-Object System.Windows.Threading.DispatcherTimer
    $dispatcherTimer.Interval = [TimeSpan]::FromSeconds(3)
    $dispatcherTimer.add_Tick({
        if (-not (Test-Path $FlagPath)) {
            $dispatcherTimer.Stop()
            $window.Close()
        }
    })
    $dispatcherTimer.Start()

    [void]$window.ShowDialog()
} catch {
    try {
        Add-Content -Path (Join-Path $DataDir "lockscreen.err") -Value ("[" + (Get-Date).ToString("o") + "] " + $_.Exception.ToString()) -ErrorAction SilentlyContinue
    } catch {}
}
