# VaultPad

[Русская версия (README.ru.md)](README.ru.md) | [Server repository](https://github.com/Terciuss/VaultPadServer)

Encrypted data vault with zero-knowledge architecture. Desktop application for storing passwords, keys, documentation, and other sensitive information. All encryption and decryption happens locally -- the server never sees plaintext data.

## Installation

Download the latest release from [GitHub Releases](https://github.com/Terciuss/VaultPad/releases).

### macOS

1. Download `VaultPad-macOS-arm64.dmg` (Apple Silicon) or `VaultPad-macOS-x64.dmg` (Intel)
2. Open the DMG and drag **VaultPad** into `/Applications`
3. Before the first launch, open Terminal and run:
   ```bash
   xattr -cr /Applications/VaultPad.app
   ```
   This is required because the app is not signed with an Apple Developer ID. Without this step, macOS will block the application.

   Alternatively: **System Settings → Privacy & Security** → find "VaultPad was blocked" → click **Open Anyway**.

### Windows

1. Download `VaultPad-Windows-x64-setup.exe`
2. Run the installer and follow the prompts

### Linux

1. Download `VaultPad-Linux-x64.AppImage`
2. Make it executable and run:
   ```bash
   chmod +x VaultPad-Linux-x64.AppImage
   ./VaultPad-Linux-x64.AppImage
   ```

## Features

### Encryption & Security

- **Zero-knowledge encryption** -- AES-256-GCM with Argon2id key derivation, all crypto runs in Rust
- **Master password** -- encrypts all files by default; never leaves the device
- **Master password change** -- re-encrypts all V2 data (files, backups, verification token) with the new key
- **Per-file passwords** -- any file can use its own password instead of the master password
- **Password registry** -- auto-generated encrypted meta-file that stores custom passwords; synced across devices so all users with the master password can decrypt custom-password files
- **Dynamic password detection** -- encryption type is determined by data format (V2 = master key, V1 = custom password), no static flags
- **OS keychain integration** -- master password and per-file passwords stored in macOS Keychain / Windows Credential Manager / Linux Secret Service
- **PIN quick-unlock** -- 4-digit PIN for fast access after initial setup; optional
- **Auto-lock** -- configurable inactivity timer clears decrypted data from memory

### Editor

- **Rich-text editor** -- TipTap-based with toolbar: bold, italic, underline, strikethrough, code, code blocks, headings, text alignment, text color, highlight, clear formatting
- **Search and replace** -- find text with case-sensitive option, replace single or all occurrences
- **Auto-save** -- debounced content saving with unsaved data flush on app close
- **Word wrap** -- configurable line wrapping

### Storage & Sync

- **Offline-first** -- all data stored in a local SQLite database; no server required
- **Multi-server architecture** -- connect to multiple Go backends; each server gets its own local database
- **Smart sync** -- debounced push (60s after edit), periodic pull (120s), automatic online/offline detection
- **Conflict resolution** -- visual diff of local vs. remote versions, editable preview, keep-local / keep-remote / manual merge
- **Automatic backups** -- triggered by significant content changes and before sync; version history with visual diff and one-click restore

### Administration

- **Admin panel** -- user management (create, edit, delete) on the server
- **File access sharing** -- admins can grant/revoke per-file access for individual users
- **Auto-seeded admin** -- first server user is created automatically via seeder

### Interface

- **Localization** -- English and Russian via react-i18next
- **Theming** -- system, light, and dark modes
- **Native menu bar** -- Settings, New File, Lock, Add Server via OS menu
- **Resizable sidebar** -- draggable column divider with persisted width

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop framework | [Tauri 2](https://v2.tauri.app/) (Rust + system WebView) |
| Frontend | React 19, TypeScript, Vite 7, TailwindCSS 4 |
| Rich text editor | TipTap (StarterKit, Underline, Highlight, TextAlign, Color, TextStyle) |
| State management | Zustand |
| Localization | i18next + react-i18next |
| Encryption | AES-256-GCM (`aes-gcm`), Argon2id (`argon2`) |
| Local database | SQLite (`rusqlite`, bundled) |
| Secure storage | OS keychain (`keyring`) |
| Memory safety | `zeroize` for key/password cleanup |
| Server | Go, MySQL, JWT authentication |

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
├── src/                              # React frontend
│   ├── main.tsx                      # Entry point
│   ├── App.tsx                       # Root component, view routing, bootstrap
│   ├── components/
│   │   ├── InitScreen.tsx            # First launch: choose/create database
│   │   ├── MasterPasswordSetup.tsx   # Set master password (first time)
│   │   ├── UnlockScreen.tsx          # Enter master password
│   │   ├── PinSetup.tsx              # Set 4-digit PIN
│   │   ├── PinUnlock.tsx             # PIN unlock with auto-verify
│   │   ├── PinInput.tsx              # Reusable 4-cell PIN input
│   │   ├── SplashScreen.tsx          # Loading screen during bootstrap
│   │   ├── MainLayout.tsx            # Two-column layout, menu events, project management
│   │   ├── Sidebar.tsx               # File list with servers, drag-and-drop reorder
│   │   ├── ContentView.tsx           # Editor wrapper with debounced auto-save
│   │   ├── Editor.tsx                # TipTap rich-text editor
│   │   ├── EditorToolbar.tsx         # Formatting toolbar (bold, italic, code, etc.)
│   │   ├── SearchBar.tsx             # Search and replace in editor
│   │   ├── NewProjectDialog.tsx      # Create file with optional custom password
│   │   ├── EditProjectDialog.tsx     # Edit file name, switch password type
│   │   ├── DeleteProjectDialog.tsx   # Confirm deletion by typing file name
│   │   ├── CustomPasswordDialog.tsx  # Unlock file with custom password
│   │   ├── ChangeMasterPasswordDialog.tsx  # Change master password with re-encryption overlay
│   │   ├── PasswordRegistryView.tsx  # View auto-generated password registry
│   │   ├── BackupHistoryPanel.tsx    # Version history with diff and restore
│   │   ├── DiffView.tsx             # Visual diff between two HTML contents
│   │   ├── ConflictResolutionDialog.tsx  # Sync conflict resolution (diff, merge, choose)
│   │   ├── AddServerDialog.tsx       # Add new server connection
│   │   ├── ServerAuthDialog.tsx      # Server login (JWT)
│   │   ├── ServerMasterPasswordDialog.tsx  # Set/verify server master password
│   │   ├── AdminPanel.tsx            # Server admin: users, file access sharing
│   │   ├── SettingsPanel.tsx         # Theme, language, auto-lock, PIN, sync, storage
│   │   ├── LoginDialog.tsx           # Legacy server auth dialog
│   │   └── Spinner.tsx               # Reusable loading indicator
│   ├── hooks/
│   │   ├── useTauri.ts               # Memoized Tauri invoke wrappers
│   │   ├── useAutoLock.ts            # Inactivity timer
│   │   ├── useTheme.ts               # System/light/dark theme
│   │   ├── useSyncManager.ts         # Sync orchestrator: push/pull/online detection
│   │   └── useDebounce.ts            # Universal debounce hook
│   ├── store/
│   │   └── index.ts                  # Zustand store (view, session, settings, servers)
│   ├── i18n/
│   │   ├── index.ts                  # i18next initialization
│   │   └── locales/
│   │       ├── en.json               # English translations
│   │       └── ru.json               # Russian translations
│   ├── lib/
│   │   └── types.ts                  # Shared TypeScript types
│   └── App.css                       # TailwindCSS import
│
├── src-tauri/                        # Rust backend
│   ├── src/
│   │   ├── main.rs                   # Tauri entry point
│   │   ├── lib.rs                    # App setup, state, native menu, command registration
│   │   ├── keychain.rs               # OS keychain read/write/delete (JSON blob)
│   │   ├── models.rs                 # Project, DecryptedProject, ProjectBackup structs
│   │   ├── server_config.rs          # Multi-server config stored in keychain
│   │   ├── password_registry.rs      # Auto-generated password registry (build, import, merge)
│   │   ├── backup.rs                 # Significant-change detection for auto-backups
│   │   ├── crypto/
│   │   │   └── mod.rs                # AES-256-GCM, Argon2id, V1/V2 formats, key derivation
│   │   ├── commands/
│   │   │   ├── mod.rs                # Module exports
│   │   │   ├── projects.rs           # CRUD, dynamic password detection, keychain passwords
│   │   │   ├── settings.rs           # Master password, PIN, session, key caching, password change
│   │   │   ├── servers.rs            # Server management, auth, admin API, password change
│   │   │   ├── backups.rs            # Backup CRUD, restore, decrypt
│   │   │   ├── auth.rs               # Server authentication (JWT)
│   │   │   └── sync.rs               # Server sync (push, pull, conflict detection, registry)
│   │   └── storage/
│   │       ├── mod.rs                # StorageProvider trait
│   │       ├── local.rs              # SQLite implementation
│   │       └── remote.rs             # HTTP API client
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
- File names are also encrypted -- the server/database never sees plaintext names

## Security Model

- Master password and derived key are cached in Rust `AppState` (behind `Mutex`) during an unlocked session
- `zeroize` crate clears sensitive memory on lock/close
- PIN is validated via Argon2id hash stored in keychain; PIN is not used for encryption
- OS keychain protects stored passwords (macOS Keychain Access, Windows DPAPI, Linux Secret Service)
- Auto-lock clears all decrypted data after configurable inactivity period
- No password recovery by design -- losing the master password means losing data
- Master password change re-encrypts all V2 projects, their backups, and the verification token atomically
- Password registry is a V2-encrypted meta-file containing custom passwords for shared access; it syncs automatically and merges on conflict (remote entries preferred)

## Application Flow

```
Launch
  ├─ Saved session? ──► Has PIN? ──► PIN Unlock ──► Main
  │                         │
  │                         └─ No PIN ──► Auto-unlock ──► Main
  │
  └─ No session ──► Init Screen ──► Master Password Setup ──► PIN Setup (optional) ──► Main

Server flow (from Main):
  Add Server ──► Auth (JWT) ──► Set Server Master Password ──► Sync
                                                                │
                                                    ┌───────────┴───────────┐
                                                    │                       │
                                              No conflicts           Conflicts detected
                                                    │                       │
                                                    ▼                       ▼
                                              Files updated      Conflict Resolution Dialog
                                                                (diff, edit, keep local/remote)
```

## License

PolyForm Noncommercial License 1.0.0. See [LICENSE](LICENSE) for details.

Copyright (c) 2026 Pavel <mr.terks@yandex.ru>
