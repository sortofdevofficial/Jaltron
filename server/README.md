# JALTRON knowledge engine

A small, self-owned answer server for JALTRON. It runs no language model and needs no API key. It fetches public reference sources, picks the relevant sentences and returns a short cited answer. The browser keeps working offline with `data/kb.json` and direct Wikipedia if this server is down.

## Requirements

- Node.js 18 or newer
- 512 MB RAM is enough. The process typically stays under 100 MB.
- Open port 11904 (or set another port).

## Wispbyte / Pterodactyl panel

The panel Console is **not a shell**: `cd`, `sudo` and `bash setup.sh` do nothing there. Use the panel instead.

1. Open **Startup** and choose a **Node.js 18+** runtime. Switch/reinstall before uploading if the current egg is Minecraft/Java.
2. Open **Files**, go to the server root (`/home/container`) and upload:
   - `kb-server.js`
   - `index.js`
   - `package.json`
   - `selftest.js` (optional)
3. In **Startup**, set the startup command to `node kb-server.js` (or `npm start`; or set the main file to `index.js`).
4. Note the **Server Address** at the top of the panel. The server listens on `SERVER_PORT` first, so the allocated port is used automatically.
5. Press **Start**. The console should print `jaltron-kb on <port> (node vXX)`.
6. Open `http://<Server Address>/api/health`. Then point the Vercel rewrite at the same address.

## Root VPS (SSH)

Copy the `server/` folder to the VPS, then:

```sh
cd server
sudo bash setup.sh
```

The script checks Node, installs `/opt/jaltron-kb/kb-server.js`, creates `/etc/jaltron-kb.env`, writes the `jaltron-kb` systemd unit (320 MB memory cap, 50% CPU, read-only filesystem) and starts it.

Without systemd it prints a `nohup` command instead.

Config in `/etc/jaltron-kb.env`:

```
PORT=11904
DAILY_CAP=3000
```

After changing it: `sudo systemctl restart jaltron-kb`.

## Test

```sh
curl -s http://127.0.0.1:11904/api/health
curl -s "http://127.0.0.1:11904/api/ask?q=capital%20of%20France"
curl -s -X POST http://127.0.0.1:11904/api/ask \
  -H 'content-type: application/json' \
  -d '{"message":"why is the sky blue"}'
```

On the VPS you can also run `node selftest.js`; it uses fixtures and no network.

## Expose it

The live deployment is `https://jaltron.wisp.uno` (Wispbyte, port 11903); `vercel.json` rewrites `/api/ai/*` there. On a root VPS, open the chosen port in the firewall and forward it, then point the same rewrite at `http://<host>:<port>/api/*`. Only general questions cross that link: the browser never sends tasks, bank data, chat history or identity.

Requests are limited to 30 per 10 minutes per browser and 200 per hour per IP, with a global daily cap and 4 concurrent answers. Messages are capped at 500 characters and never logged; logs contain only status, duration, kind and length.

## Sources

Wikipedia and Wikidata, Free Dictionary, Datamuse, Open Library, Crossref, Open-Meteo, Frankfurter (ECB), CoinGecko and Stack Exchange. All public and keyless. Wikimedia requires the descriptive `User-Agent` this server sends. Answers link to the source they used. Weather, currency, crypto and current leaders are cached for minutes only; the browser never stores them.

## Troubleshooting

- `journalctl -u jaltron-kb -n 50` — service log.
- `systemctl status jaltron-kb` — restart loop or memory limit.
- Health works locally but not remotely: firewall or port forwarding.
- Upstream `429` from Wikimedia: check the `User-Agent` was not changed.
- If the server is down, JALTRON falls back to the offline pack and direct Wikipedia; no error is shown.
