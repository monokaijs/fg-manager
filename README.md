<div align="center">
  <img src="https://raw.githubusercontent.com/tauri-apps/tauri/dev/app-icon.png" width="128" alt="Logo" />
  <h1>FG-Manager</h1>
  <p><strong>A blazingly fast, automated, and native desktop game manager.</strong></p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=flat-square" alt="Platforms" />
  <img src="https://img.shields.io/badge/Tech-Rust%20%7C%20Tauri%20%7C%20React-orange?style=flat-square" alt="Tech Stack" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

## Overview

**FG-Manager** is a modern, cross-platform desktop manager explicitly designed for processing, downloading, and natively managing deeply compressed game archives.

Built with performance and aesthetics in mind, FG-Manager completely automates the heavy-lifting: background downloads, native unpacking queues, and reverse-engineering Windows setup executables to deploy and launch your digital library gracefully.

## ✨ Features

- **Blazing Fast Networking**: Direct multi-threaded downloading with zero manual part-handling.
- **Native Unarchive Engine**: Packaged with a customized native Rust `unrar` bridge—files unpack directly onto your disk without dependency on 7-Zip or WinRAR.
- **Hands-Free Installation Pipeline**: Automates the highly manual process of installing setup wizards, completely bridging the gap between clicking 'Download' and 'Play'.
- **Resource Efficient**: Uses a fraction of the memory and CPU of traditional Electron apps, thanks to the core being written natively in Rust under the Tauri framework.
- **Premium User Experience**: Designed with a clean, modern React + TailwindCSS interface, rendering 60FPS micro-animations seamlessly across platforms.

## 🛠️ Tech Stack

- **Frontend Core:** React, Vite, TailwindCSS (Shadcn UI base)
- **Backend Systems:** Rust (Tauri 2.0 Core)
- **Native APIs:** `tokio` (Async networking), `innoextract` (binary parsing), and robust asynchronous process spawning.

## 📥 Installation

Officially supported releases are actively compiled for Windows (x86_64, ARM64) and Linux via GitHub Actions.

1. Navigate to the [Releases Sidebar](../../releases).
2. Download the installer matching your OS:
   - **Windows:** `.msi` or `.exe` installer (Includes both x64 and ARM architecture binaries).
   - **Linux:** `.deb` or `.AppImage` package.
3. Install and run FG-Manager natively on your system.
