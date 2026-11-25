# Paper2Prototype Isolated Sandbox Runner

This service runs generated Python experiments inside a dedicated, resource-constrained Docker container with **no network access**, **stripped environment variables**, **non-root UID**, **read/write confined to an ephemeral `/tmp` directory**, and **CPU/memory/timeout limits**.

## Run with Docker (Recommended)

```bash
docker build -t p2p-sandbox ./sandbox-runner

docker run -d \
  --name p2p-sandbox \
  --network none \
  --cpus="1.0" \
  --memory="512m" \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=256m \
  -p 8080:8080 \
  -e SANDBOX_API_KEY="replace-with-strong-secret" \
  p2p-sandbox
```

> Note: When `--network none` is used for maximum isolation, place a reverse proxy or use a container network bridge where only the Supabase Edge Function gateway can reach port 8080, while outbound internet from the container remains blocked via firewall/iptables.

Then configure Supabase Edge Function secrets:

```bash
supabase secrets set SANDBOX_API_URL=https://your-sandbox-host.example.com
supabase secrets set SANDBOX_API_KEY=replace-with-strong-secret
```
