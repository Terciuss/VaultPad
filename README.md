# VaultPad

Encrypted data vault with zero-knowledge architecture. Desktop application for storing passwords, keys, documentation, and other sensitive information. All encryption and decryption happens locally -- the server never sees plaintext data.

## Features

- **Zero-knowledge encryption** -- AES-256-GCM with Argon2id key derivation, all crypto runs in Rust
- **Master password** -- encrypts all projects by default; never leaves the device
- **Per-project passwords** -- any project can use its own password instead of the master password
- **Dynamic password detection** -- encryption type is determined by data format (V2 = master key, V1 = custom password), no static flags
- **OS keychain integration** -- master password and per-project passwords are stored in the system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **PIN quick-unlock** -- 4-digit PIN for fast access after initial setup; optional
- **Auto-lock** -- configurable inactivity timer clears decrypted data from memory
- **Auto-save** -- debounced content saving with unsaved data flush on app close
- **Offline-first** -- all data stored in a local SQLite database; no server required
- **Optional server sync** -- connect to a Go backend for cross-device synchronization (server only stores encrypted blobs)
- **Localization** -- English and Russian via react-i18next
- **Theming** -- system, light, and dark modes
- **Native menu bar** -- Settings, New Project, Lock, Server Connect via OS menu
- **Resizable sidebar** -- draggable column divider with persisted width

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop framework | [Tauri 2](https://v2.tauri.app/) (Rust + system WebView) |
| Frontend | React 19, TypeScript, Vite 7, TailwindCSS 4 |
| State management | Zustand |
| Localization | i18next + react-i18next |
| Encryption | AES-256-GCM (`aes-gcm`), Argon2id (`argon2`) |
| Local database | SQLite (`rusqlite`, bundled) |
| Secure storage | OS keychain (`keyring`) |
| Memory safety | `zeroize` for key/password cleanup |

## Prerequisites

- **Node.js** 18+
- **Rust** 1.70+ (with `cargo`)
- **System dependencies** for Tauri 2: see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Getting Started

```bash
# Install frontend dependencies
npm install

# Run in development mode (hot-reload frontend + Rust backend)
npm run tauri dev

# Build production binary
npm run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
client/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Root component, view routing, bootstrap
│   ├── components/
│   │   ├── InitScreen.tsx        # First launch: choose/create database
│   │   ├── MasterPasswordSetup.tsx  # Set master password (first time)
│   │   ├── UnlockScreen.tsx      # Enter master password
│   │   ├── PinSetup.tsx          # Set 4-digit PIN
│   │   ├── PinUnlock.tsx         # PIN unlock with auto-verify
│   │   ├── PinInput.tsx          # Reusable 4-cell PIN input
│   │   ├── SplashScreen.tsx      # Loading screen during bootstrap
│   │   ├── MainLayout.tsx        # Two-column layout, menu events, project management
│   │   ├── Sidebar.tsx           # Project list with edit/delete actions
│   │   ├── ContentView.tsx       # Editor with debounced auto-save
│   │   ├── Editor.tsx            # Textarea abstraction (Tiptap-ready)
│   │   ├── NewProjectDialog.tsx  # Create project with optional custom password
│   │   ├── EditProjectDialog.tsx # Edit project name, switch password type
│   │   ├── DeleteProjectDialog.tsx  # Confirm deletion by typing project name
│   │   ├── CustomPasswordDialog.tsx # Unlock project with custom password
│   │   ├── SettingsPanel.tsx     # Theme, language, auto-lock, PIN, session
│   │   ├── LoginDialog.tsx       # Server authentication (for sync)
│   │   └── Spinner.tsx           # Reusable loading indicator
│   ├── hooks/
│   │   ├── useTauri.ts           # Memoized Tauri invoke wrappers
│   │   ├── useAutoLock.ts        # Inactivity timer
│   │   └── useTheme.ts           # System/light/dark theme
│   ├── store/
│   │   └── index.ts              # Zustand store (view, session, settings)
│   ├── i18n/
│   │   ├── index.ts              # i18next initialization
│   │   └── locales/
│   │       ├── en.json           # English translations
│   │       └── ru.json           # Russian translations
│   ├── lib/
│   │   └── types.ts              # Shared TypeScript types
│   └── App.css                   # TailwindCSS import
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri entry point
│   │   ├── lib.rs                # App setup, state, native menu, command registration
│   │   ├── keychain.rs           # OS keychain read/write/delete
│   │   ├── models.rs             # Project, DecryptedProject structs
│   │   ├── crypto/
│   │   │   └── mod.rs            # AES-256-GCM, Argon2id, V1/V2 formats, key caching
│   │   ├── commands/
│   │   │   ├── mod.rs            # Module exports
│   │   │   ├── projects.rs       # CRUD, dynamic password detection, keychain passwords
│   │   │   ├── settings.rs       # Master password, PIN, session, key caching
│   │   │   ├── auth.rs           # Server authentication (JWT)
│   │   │   └── sync.rs           # Server synchronization
│   │   └── storage/
│   │       ├── mod.rs            # StorageProvider trait
│   │       ├── local.rs          # SQLite implementation
│   │       └── remote.rs         # HTTP API client
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── package.json
└── vite.config.ts
```

## Encryption Architecture

```
User enters master password
        │
        ▼
Argon2id(password, salt) ──► 256-bit key
        │
        ▼
AES-256-GCM(key, nonce, plaintext) ──► ciphertext
        │
        ▼
Stored as: version_byte || nonce(12) || ciphertext
```

- **V2 format** (byte `0x02`): encrypted with cached master key (fast, no Argon2id per operation)
- **V1 format** (any other first byte): encrypted with custom password via full Argon2id derivation
- New random nonce generated for every encryption operation
- Project names are also encrypted -- the server/database never sees plaintext names

## Security Model

- Master password and derived key are cached in Rust `AppState` (behind `Mutex`) during an unlocked session
- `zeroize` crate clears sensitive memory on lock/close
- PIN is validated via Argon2id hash stored in keychain; PIN is not used for encryption
- OS keychain protects stored passwords (macOS Keychain Access, Windows DPAPI, Linux Secret Service)
- Auto-lock clears all decrypted data after configurable inactivity period
- No password recovery by design -- losing the master password means losing data

## Application Flow

```
Launch
  ├─ Saved session? ──► Has PIN? ──► PIN Unlock ──► Main
  │                         │
  │                         └─ No PIN ──► Auto-unlock ──► Main
  │
  └─ No session ──► Init Screen ──► Master Password Setup ──► PIN Setup (optional) ──► Main
```

## License

PolyForm Noncommercial License 1.0.0. See [LICENSE](LICENSE) for details.

Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
