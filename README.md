# paseo-agy-history

A [Paseo](https://paseo.sh) provider plugin for the Antigravity CLI (`agy`) that keeps chat history across restarts.

## Why

Paseo's built-in Antigravity provider rebuilds an empty transcript every time it reopens a session, because `agy` does not replay past messages. The conversation context survives in `agy`, but the chat in Paseo looks blank.

This plugin forks the built-in provider and adds a local transcript:

- every timeline item Paseo receives is written to disk as a complete snapshot;
- when the session opens again with `history: "replay"`, the stored items are published before `session.ready`.

It also raises the `agy models` discovery timeout from 10 seconds to 30, which avoids `PROBE_TIMEOUT` failures on first open after a daemon restart.

## Requirements

- Paseo 0.13.1 or later
- Antigravity CLI (`agy`) 1.1.15 or later, installed and signed in on the daemon host

## Install

```bash
git clone https://github.com/fietiger/paseo-agy-history.git
paseo plugin install /absolute/path/to/paseo-agy-history
paseo plugin ls   # expect paseo-agy-history  running
```

Plugins are trusted, unsandboxed code, and the daemon needs `pluginsEnabled: true` in its `config.json`.

## Usage

Create agents with the **Antigravity (with history)** provider. The built-in **Antigravity** provider stays available and unchanged; the two are separate providers.

After a reload or a daemon restart, reopen the agent and the previous messages are shown again.

## Where transcripts live

```
<PASEO_HOME or ~/.paseo>/agy-history/transcripts/<conversationId>.json
```

Each file holds the most recent 400 timeline items for that conversation. Removing a file drops the stored display history; `agy` keeps its own copy of the conversation.

Known limits:

- only sessions created with this provider after installation have stored transcripts;
- sessions created with the built-in Antigravity provider cannot be backfilled from the plugin;
- Antigravity runs in full access mode, as with the built-in provider.

## Development

```bash
npm install --ignore-scripts
npm run typecheck
paseo plugin reload paseo-agy-history   # after editing source
```

## License

MIT
