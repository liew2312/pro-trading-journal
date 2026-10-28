param(
    [string]$AndroidSdk = "$env:LOCALAPPDATA/Android/Sdk",
    [string]$JavaHome = 'C:/Program Files/Android/Android Studio/jbr'
)
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = $JavaHome
$env:Path = "$JavaHome/bin;$env:Path"
$project = $PSScriptRoot
$out = Join-Path $project 'build/manual'
New-Item -ItemType Directory -Force -Path "$out/classes", "$out/dex" | Out-Null
$platform = Get-ChildItem "$AndroidSdk/platforms" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$buildTools = Get-ChildItem "$AndroidSdk/build-tools" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$androidJar = Join-Path $platform.FullName 'android.jar'
$tools = $buildTools.FullName
function Check { if ($LASTEXITCODE -ne 0) { throw "Build failed (exit $LASTEXITCODE)" } }
& "$JavaHome/bin/javac.exe" -encoding UTF-8 --release 8 -classpath $androidJar -d "$out/classes" "$project/app/src/main/java/com/mangacapture/app/MainActivity.java"
Check
& "$JavaHome/bin/jar.exe" cf "$out/classes.jar" -C "$out/classes" .
Check
& "$tools/d8.bat" --lib $androidJar --min-api 26 --output "$out/dex" "$out/classes.jar"
Check
$manifest = (Get-Content "$project/app/src/main/AndroidManifest.xml" -Raw).Replace('<manifest ', '<manifest package="com.mangacapture.app" ')
[IO.File]::WriteAllText("$out/AndroidManifest.xml", $manifest)
& "$tools/aapt2.exe" link -I $androidJar -A "$project/app/src/main/assets" --manifest "$out/AndroidManifest.xml" --min-sdk-version 26 --target-sdk-version 35 --version-code 6 --version-name '0.6' -o "$out/unsigned.apk"
Check
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open("$out/unsigned.apk", 'Update')
try { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$out/dex/classes.dex", 'classes.dex') | Out-Null } finally { $zip.Dispose() }
& "$tools/zipalign.exe" -f 4 "$out/unsigned.apk" "$out/aligned.apk"
Check
if (!(Test-Path "$out/debug.keystore")) {
    & "$JavaHome/bin/keytool.exe" -genkeypair -keystore "$out/debug.keystore" -storepass android -keypass android -alias androiddebugkey -dname 'CN=Manga Capture Development' -keyalg RSA -keysize 2048 -validity 10000
    Check
}
& "$tools/apksigner.bat" sign --ks "$out/debug.keystore" --ks-pass pass:android --out "$out/MangaCapture.apk" "$out/aligned.apk"
Check
& "$tools/apksigner.bat" verify --verbose "$out/MangaCapture.apk"
Check
Write-Output "APK: $out/MangaCapture.apk"
