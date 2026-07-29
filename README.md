# DayTasks

**Get your tasks done, simply.** A todo.txt task manager for macOS, Windows, and Linux.

Your tasks live in a plain `todo.txt` file in folders you choose — readable and editable in any app, terminal, or todo.txt tool, on any device. Sync the folder with Dropbox and your tasks follow you. DayTasks is the cross-platform successor to the original [GTK/Vala DayTasks](https://github.com/thejambi/DayTasks) for Linux.

Built with [Tauri 2](https://tauri.app), Svelte 5, and the same stack as its siblings [P.S. Notes](https://github.com/thejambi/ps-notes) and [DayJournal](https://github.com/thejambi/day-journal). The installers are a few megabytes.

## How it works

- **Standard todo.txt format**: priorities `(A)`, projects `+home`, contexts `@phone`, creation and completion dates, `due:2026-08-01` due dates with overdue highlighting. Whatever DayTasks writes reads cleanly in todo.txt-cli, mobile todo.txt apps, or a bare terminal.
- **One place to write**: the bar at the top adds tasks (full syntax welcome) and edits them — double-click any task (or press Enter on it) and it jumps up into the bar.
- **Multi-line details**: Shift+Enter in the bar adds detail lines to a task, shown indented and dimmed under it in the list. In the file they're stored on one line with a visible ` --- ` separator, so the task still reads naturally anywhere. (Files containing sleek's invisible line-break character or the original DayTasks' bare `---` display correctly too.)
- **Priorities that survive**: completing a `(A)` task preserves the priority as `pri:A` (the todo.txt-cli convention); un-completing restores it.
- **Projects and contexts are first-class**: the sidebar lists every `+project` and `@context` with open-task counts — click to filter, and the tokens inside tasks are clickable too.
- **Your file order is sacred**: the list displays priority-first with completed tasks at the bottom, but the file on disk keeps its own line order, so other tools see no churn.
- **Archive** moves completed tasks to `done.txt`, spec-style.
- **Multiple folders**: keep separate todo.txt setups (work, personal, …) and switch from the Folders menu.
- Every action saves immediately with crash-safe atomic writes, and the folder is watched — edits from other apps or devices appear within a second.

Open **Aa → Keyboard shortcuts** in-app for the full list. Highlights: `Cmd/Ctrl+1–9` set priority (A)–(I), `Cmd/Ctrl+0` clears (the original DayTasks keys), Space completes, `Cmd/Ctrl+E` archives.

## Development setup

Prerequisites:

1. **Node.js** 20+ (`node --version`)
2. **Rust** (stable) — install via [rustup](https://rustup.rs):
   ```sh
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
3. Platform extras:
   - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
   - **Windows:** [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and WebView2 (preinstalled on Windows 11)
   - **Linux:** WebKitGTK and friends:
     ```sh
     sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf \
       build-essential curl wget file libssl-dev
     ```

Then:

```sh
npm install
npm run tauri dev     # run the app with hot reload
npm run check         # typecheck the frontend (svelte-check)
cd src-tauri && cargo check   # typecheck the Rust side
```

The first `tauri dev` compiles all Rust dependencies and takes a few minutes; subsequent runs are seconds. Note: in dev mode macOS shows a generic Dock icon — the real icon only appears in built bundles.

## Building installers locally

```sh
npm run tauri build
```

Artifacts land in `src-tauri/target/release/bundle/`:

| Platform | Output |
|---|---|
| macOS | `macos/DayTasks.app` and `dmg/DayTasks_<version>_<arch>.dmg` |
| Windows | `nsis/*.exe` (installer) and `msi/*.msi` |
| Linux | `deb/*.deb` and `appimage/*.AppImage` |

A locally built app runs without complaint on the machine that built it. Distributing to *other* machines unsigned means Gatekeeper (macOS: right-click → Open) or SmartScreen (Windows: More info → Run anyway) warnings.

## CI builds (all platforms at once)

`.github/workflows/build.yml` builds macOS (universal), Windows, and Linux on GitHub Actions:

- **Tag a release:** `git tag v0.2.0 && git push origin v0.2.0`
- **Or run manually:** GitHub → Actions → Build → Run workflow

Download installers from the run's **Artifacts** section. To bump the app version, update `version` in both `package.json` and `src-tauri/tauri.conf.json`. The app icon regenerates from `icon-source.png` with `npm run tauri icon icon-source.png`.

## Project layout

```
src/                        # Frontend (SvelteKit + Svelte 5)
  routes/+page.svelte       # Layout composition, keyboard shortcuts
  lib/app.svelte.ts         # Shared reactive state + all actions
  lib/todo.ts               # todo.txt engine: parse, build, sort, details
  lib/settings.ts           # Persisted preferences (store plugin)
  lib/components/           # Toolbar (titlebar), Sidebar, TaskList, Overlays
src-tauri/                  # Backend (Rust)
  src/lib.rs                # Commands: save_note (atomic writes), really_quit
  tauri.conf.json           # Window config (macOS overlay titlebar), bundling
  tauri.windows.conf.json   # Windows override: no native decorations
  capabilities/default.json # Permission grants for plugins
```

Almost all logic is TypeScript; the Rust side is a thin set of filesystem commands for atomic saves and clean shutdown.

## License

GPL-3.0, same as the original DayTasks.
