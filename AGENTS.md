# Atomic

Atomic is a personal knowledge base that turns freeform markdown notes ("atoms") into a semantically-connected, AI-augmented knowledge graph. It runs as a Tauri desktop app, a headless HTTP server, or both simultaneously.

## Core Concepts

**Atoms** are the fundamental unit — markdown notes with optional source URLs and hierarchical tags. When an atom is created or updated, an asynchronous pipeline automatically:
1. Chunks the content using markdown-aware boundaries (respecting code blocks, headers, paragraphs)
2. Generates vector embeddings via the configured AI provider
3. Extracts and assigns tags using LLM structured outputs (if auto-tagging is enabled)
4. Builds semantic edges to other atoms based on embedding similarity

This pipeline is fire-and-forget from the caller's perspective — the caller receives the saved atom immediately while embedding/tagging runs in the background, with progress reported via callbacks.

**Tags** form a hierarchical tree. Auto-extracted tags are organized under category parents (Topics, People, Locations, Organizations, Events). Tags serve as both organizational structure and scoping mechanism for wiki generation and chat conversations.

**Wiki articles** are LLM-synthesized summaries of all atoms under a given tag, with inline citations linking back to source atoms. They support incremental updates — when new atoms are tagged, only the new content is sent to the LLM to integrate into the existing article.

**Chat** is an agentic RAG system. Conversations can be scoped to specific tags, and the agent has tools to search the knowledge base semantically during conversation. Responses stream back through the same callback system used by embeddings.

**Canvas** is a spatial visualization where atoms are positioned using d3-force simulation. Atoms sharing tags are linked, and a custom similarity force pulls semantically-related atoms together. Positions are persisted so the layout is stable across sessions.

## Architecture: Core + Thin Wrappers

The central architectural principle is the separation of **business logic** from **transport**. All domain logic lives in `atomic-core`, a standalone Rust crate with no framework dependencies. Every client is a thin wrapper that adapts `atomic-core` to a specific transport mechanism.

```
                    ┌─────────────────┐
                    │   atomic-core   │
                    │  (all logic)    │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    ┌─────────────┐  ┌──────────────┐  ┌──────────┐
    │  src-tauri   │  │atomic-server │  │atomic-mcp│
    │ (Tauri IPC)  │  │ (REST + WS)  │  │  (MCP)   │
    └──────┬──────┘  └──────┬───────┘  └──────────┘
           │                │
    ┌──────▼──────┐  ┌──────▼───────┐
    │   React UI   │  │  HTTP clients│
    │(Tauri or HTTP)│  │ (iOS, etc.) │
    └─────────────┘  └──────────────┘
```

### `atomic-core` — The Facade

`AtomicCore` is a `Clone` wrapper around `Arc<Database>` that exposes every operation: CRUD, search, embedding, wiki generation, chat, clustering, tag compaction, and import. It is completely transport-agnostic.

The key design decision is **callback-based eventing**: operations that produce async events (embedding, chat) accept `Fn(EmbeddingEvent)` or `Fn(ChatEvent)` closures. The core doesn't know or care how events are delivered — it just calls the closure. This makes it usable from any Rust context without pulling in Tauri, actix, or any framework.

### `src-tauri` — Desktop Wrapper

The Tauri app stores `AtomicCore` in managed state and exposes ~40 commands. Each command is a thin wrapper: unpack IPC args, call `core.method()`, return the result. For evented operations, it creates closures that bridge `EmbeddingEvent`/`ChatEvent` → `app_handle.emit()`, which the React frontend listens to via Tauri's `listen()` API.

The Tauri app also spawns an embedded actix-web server on port 44380 for the browser extension and MCP integration.

### `atomic-server` — Headless HTTP Wrapper

The standalone server wraps `atomic-core` with a full REST API (~47 endpoints) plus a WebSocket endpoint. The same thin-wrapper pattern applies: each route handler unpacks HTTP request params, calls `core.method()`, returns JSON.

Events flow through `tokio::sync::broadcast` — route handlers send `ServerEvent` variants into the channel, and WebSocket clients receive them. The event bridge converts `atomic-core` callbacks into broadcast messages, mirroring how Tauri bridges them to `app_handle.emit()`.

Authentication uses named, revocable API tokens stored as SHA-256 hashes. A default token is auto-created on first run. Managed via CLI subcommands or REST endpoints.

### Frontend Transport Abstraction

The React frontend defines a `Transport` interface with `invoke()` and `subscribe()` methods. At startup, it auto-detects whether Tauri IPC is available:
- **TauriTransport**: Direct pass-through to Tauri's `invoke()` and `listen()`
- **HttpTransport**: Maps Tauri command names to HTTP specs (method, path, body/query transforms) via a command map, and normalizes WebSocket `ServerEvent` messages back into the same event names the Tauri transport uses

This means the React code is transport-unaware — it calls `transport.invoke('create_atom', args)` and `transport.subscribe('embedding-complete', handler)` regardless of whether it's running inside Tauri or connected to `atomic-server` over HTTP.

## AI Provider Abstraction

AI capabilities are pluggable via trait-based providers:
- `EmbeddingProvider` — batch embedding generation
- `LlmProvider` — chat completions
- `StreamingLlmProvider` — streaming completions with tool calling

Two implementations exist: **OpenRouter** (cloud, default) and **Ollama** (local). Factory functions return `Arc<dyn Trait>` based on the configured provider type. Adding a new provider requires implementing the traits and adding a factory branch — no changes to embedding, wiki, chat, or any consumer code.

Provider configuration is stored in the settings table (SQLite key-value pairs). OpenRouter uses separate model settings for embedding, tagging, wiki, and chat. Ollama auto-discovers available models from the running server.

### `ios/` — Native iOS App

A SwiftUI app that connects to `atomic-server` over HTTP. It's another thin client — no local database, no Rust bindings, just a REST API client. Focused on reading and writing atoms on the go.

The project uses **XcodeGen** (`project.yml`) to generate the Xcode project, so `AtomicMobile.xcodeproj` is a build artifact — edit `project.yml` and Swift sources, not the `.xcodeproj` directly.

Key files:
- `ios/project.yml` — XcodeGen project definition (deployment target, build settings)
- `ios/AtomicMobile/AtomicApp.swift` — Entry point, routes to setup or main view
- `ios/AtomicMobile/APIClient.swift` — HTTP client for `atomic-server` REST API
- `ios/AtomicMobile/AtomStore.swift` — Observable state management
- `ios/AtomicMobile/Theme.swift` — Colors matching the shared design system
- `ios/AtomicMobile/Models.swift` — Codable models matching server JSON shapes

Development is fully headless (no Xcode GUI required). Uses `xcodebuild` + `xcrun simctl` from the terminal, with screen sharing to view the simulator.

## Workspace Structure

```
Cargo.toml                  # Workspace root
crates/atomic-core/         # All business logic (no framework deps)
crates/atomic-server/       # Headless REST + WebSocket server
crates/atomic-mcp/          # Standalone MCP server binary
crates/mcp-bridge/          # HTTP-to-stdio MCP bridge
src-tauri/                  # Tauri desktop app (thin wrapper)
src/                        # React frontend (TypeScript)
ios/                        # Native iOS app (SwiftUI, HTTP client)
scripts/                    # Import, build, and database utilities
```

## Tech Stack

- **Core**: Rust, SQLite + sqlite-vec (vector search), rusqlite, tokio, reqwest
- **Desktop**: Tauri v2
- **Server**: actix-web, clap (CLI), tokio broadcast channels
- **Frontend**: React 18, TypeScript, Vite 6, Tailwind CSS v4, Zustand 5
- **iOS**: SwiftUI, Swift 6, XcodeGen, URLSession
- **Editor**: CodeMirror 6 (markdown editing), react-markdown (rendering)
- **Canvas**: d3-force (simulation), react-zoom-pan-pinch (interaction)
- **Virtualization**: @tanstack/react-virtual
- **AI**: OpenRouter or Ollama (pluggable), tiktoken for token counting

## Common Commands

```bash
# Development
npm run tauri dev             # Desktop app (frontend + Tauri)
npm run dev                   # Frontend only
cargo check                   # Check all workspace crates
cargo test                    # Run all tests
cargo check -p atomic-core    # Check specific crate

# Standalone server
cargo run -p atomic-server -- --db-path /path/to/atomic.db serve --port 8080

# Token management
cargo run -p atomic-server -- --db-path /path/to/atomic.db token create --name "my-laptop"
cargo run -p atomic-server -- --db-path /path/to/atomic.db token list
cargo run -p atomic-server -- --db-path /path/to/atomic.db token revoke <token-id>

# iOS app (headless dev workflow)
cd ios && xcodegen generate                      # Regenerate .xcodeproj from project.yml
xcodebuild -project ios/AtomicMobile.xcodeproj \
  -scheme AtomicMobile \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
xcrun simctl install booted <path-to-.app>       # Install on running simulator
xcrun simctl launch booted com.atomic.mobile     # Launch app
xcrun simctl terminate booted com.atomic.mobile  # Stop app before reinstall
open -a Simulator                                # Show simulator window (view via screen sharing)

# Production
npm run tauri build
npm run release:patch         # Bump version and build
```

## Database

SQLite with sqlite-vec extension. Location varies by platform:
- macOS: `~/Library/Application Support/com.atomic.app/atomic.db`
- Linux: `~/.local/share/com.atomic.app/atomic.db`

Migrations run automatically on startup. The schema includes tables for atoms, tags, chunks, embeddings, wiki articles, conversations, messages, semantic edges, atom positions, settings, and API tokens.

Similarity is computed from sqlite-vec's Euclidean distance on normalized vectors: `similarity = 1.0 - (distance / 2.0)`. Default thresholds: 0.7 for related atoms, 0.3 for semantic search and wiki chunk selection.

## Design System

Dark theme (Obsidian-inspired). Backgrounds: `#1e1e1e`/`#252525`/`#2d2d2d`. Accent: purple (`#7c3aed`). Three-panel layout: fixed-width left panel (tag tree, navigation), flexible main view (canvas/grid/list), overlay right drawer (editor, viewer, wiki, chat).

Frontend state is managed by Zustand stores: `atoms`, `tags`, `ui`, `settings`, `wiki`, `chat`. The `ui` store tracks selected tag filter, drawer state, view mode, and search query. View mode (canvas/grid/list) persists to localStorage.
