"""
DiZpatch Port Forwarder for Windows / WSL2 Podman
Forwards local Windows ports (127.0.0.1) directly to the Podman machine WSL2 interface.
Enables seamless access to:
  - Kafka UI:               http://localhost:8080
  - Work Order Service:     http://localhost:8001
  - Provider Service:       http://localhost:8002
  - Assignment Service:     http://localhost:8003
  - Notification Service:   http://localhost:8004
  - PostgreSQL:             localhost:5432
  - Kafka:                  localhost:9092, localhost:29092
"""
import asyncio
import os
import subprocess
import sys

PORTS = [8080, 8001, 8002, 8003, 8004, 5432, 9092, 29092, 5173]


def get_wsl_ip() -> str:
    # Allow manual override via env
    if os.environ.get("WSL_TARGET_IP"):
        return os.environ["WSL_TARGET_IP"]

    for distro in ["podman-machine-default", "podman-machine-default-arm64"]:
        try:
            out = subprocess.check_output(
                ["wsl", "-d", distro, "-u", "root", "ip", "-4", "addr", "show", "eth0"],
                text=True,
                timeout=3,
                stderr=subprocess.DEVNULL,
            )
            for line in out.splitlines():
                parts = line.strip().split()
                if len(parts) >= 2 and parts[0] == "inet":
                    return parts[1].split("/")[0]
        except Exception:
            continue
    return "127.0.0.1"


async def pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    try:
        while not reader.at_eof():
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except Exception:
        pass
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass


async def handle_client(
    client_reader: asyncio.StreamReader,
    client_writer: asyncio.StreamWriter,
    target_host: str,
    target_port: int,
):
    try:
        target_reader, target_writer = await asyncio.open_connection(
            target_host, target_port
        )
    except Exception:
        client_writer.close()
        return

    await asyncio.gather(
        pipe(client_reader, target_writer),
        pipe(target_reader, client_writer),
        return_exceptions=True,
    )


async def main():
    target_ip = get_wsl_ip()
    print("=" * 60)
    print(f" DiZpatch Windows Port Forwarder -> WSL2 IP: {target_ip}")
    print("=" * 60)

    servers = []
    for port in PORTS:
        try:
            server = await asyncio.start_server(
                lambda r, w, p=port: handle_client(r, w, target_ip, p),
                "127.0.0.1",
                port,
            )
            servers.append(server)
            print(f"  ✔ Forwarding http://localhost:{port} -> {target_ip}:{port}")
        except Exception as e:
            print(f"  ⚠ Could not bind 127.0.0.1:{port}: {e}")

    print("=" * 60)
    print(" Port forwarding active. Press Ctrl+C to stop.")
    print("=" * 60)

    try:
        await asyncio.gather(*(s.serve_forever() for s in servers))
    except (asyncio.CancelledError, KeyboardInterrupt):
        pass


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
