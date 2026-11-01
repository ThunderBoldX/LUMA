# LUMA v1.2.1

First public packaging of LUMA, with 19 radio presets, a 10-band equalizer, saved-track metadata, optional AudD recognition, Discord IPC integration and an OBS browser overlay.

Publication changes: clean source layout, MIT license, Ukrainian/English documentation, original banner, real interface screenshots, reproducible Windows build commands, allowlisted release packaging and SHA-256 checksums. Runtime behavior has not intentionally changed.

## Install / Встановлення

Download `LUMA-v1.2.1-windows-x64.zip`, extract the complete folder, install Node.js 22.13+ from https://nodejs.org/ if it is not installed, then run `LUMA.exe`. Microsoft Edge is recommended. Keep the folder writable. The package does not bundle Node.js and the executable is unsigned.

Завантажте `LUMA-v1.2.1-windows-x64.zip`, розпакуйте всю папку, встановіть Node.js 22.13+ із https://nodejs.org/, якщо його немає, і запустіть `LUMA.exe`. Рекомендований Microsoft Edge. Папка має бути доступною для запису. Node.js не входить до архіву; виконуваний файл не має цифрового підпису.

Compare `Get-FileHash .\LUMA-v1.2.1-windows-x64.zip -Algorithm SHA256` with `SHA256SUMS.txt`.

Optional integrations need setup: AudD requires your token and quota; Discord requires your Application ID, uploaded `luma` artwork and desktop Discord. Names are saved, not song audio files. Internet access and station availability are required. Linux/macOS native releases and an iPhone app are not provided. See the README for source preview limitations and test evidence.
