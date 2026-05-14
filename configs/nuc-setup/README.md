# NUC Setup — Jarvis (Nico)

## Voraussetzungen
- Ubuntu 24.04 auf NUC (192.168.178.112)
- Ollama als Docker-Container (infra-ollama, Port 11434)
- Python 3.12, Rust toolchain, Node.js 22

## Installation
```bash
cd ~/docker/Jarvis-Nico
python3 -m venv .venv
source .venv/bin/activate
pip install maturin
cd src/openjarvis_rust && maturin develop --release && cd ../..
pip install -e ".[server]"
cd frontend && npm ci && npm run build && cd ..
```

## Konfiguration
```bash
cp configs/nuc-setup/config.toml ~/.openjarvis/config.toml
cp configs/nuc-setup/jarvis.service ~/.config/systemd/user/jarvis.service
systemctl --user daemon-reload
systemctl --user enable --now jarvis
loginctl enable-linger $(whoami)
```

## SSL-Zertifikat generieren
```bash
mkdir -p ~/.openjarvis/ssl
openssl req -x509 -newkey rsa:2048 \
  -keyout ~/.openjarvis/ssl/key.pem \
  -out ~/.openjarvis/ssl/cert.pem \
  -days 3650 -nodes \
  -subj "/CN=Jarvis-Nico" \
  -addext "subjectAltName=IP:192.168.178.112"
```

## Firewall
```bash
sudo ufw allow from 192.168.178.0/24 to any port 8100 proto tcp comment "Jarvis WebUI"
```

## Zugriff
- WebUI: https://192.168.178.112:8100
- API: gleiche URL mit Header Authorization: Bearer <API_KEY>
- Telegram: @ico_assistantsfe_bot
