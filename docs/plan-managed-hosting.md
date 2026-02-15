# Managed Hosting & Monetization Strategy

## Vision

Atomic is fully open source. Anyone can self-host. The monetization strategy is offering managed infrastructure so users get a personal knowledge base with an MCP endpoint in minutes, without dealing with servers, SSL, backups, or updates.

The core pitch: **"You own your data. We handle the ops."**

## Three-Tier Model

### 1. Self-Hosted (Free)

- User runs Atomic on their own hardware
- Full control, full responsibility
- Updates via GitHub releases
- Target: developers, homelabbers, privacy maximalists

### 2. Managed Hosting (~$5-15/mo)

- We spin up an isolated VM per customer (Fly.io Machines or Firecracker)
- Automated setup: SSL, DNS, backups, auto-updates
- **Value prop**: "Get a personal knowledge base with an MCP server endpoint in 5 minutes"
- Target: AI power users, knowledge workers, anyone who doesn't want to manage infra

### 3. Deploy to Your Cloud (Free)

- One-click deploy to the user's own DigitalOcean/AWS/GCP account
- Published as a DO 1-Click App, AWS AMI, or CloudFormation template
- Cloud-init handles setup (install Atomic, configure Caddy for SSL, set up backups)
- We never see credentials, never have SSH access — it's their droplet/instance
- Optional self-update agent that polls GitHub releases
- Target: teams and individuals who want sovereignty with minimal setup

| | Self-Hosted | Managed | Your Cloud |
|---|---|---|---|
| Runs on | Your hardware | Our infra | Your DO/AWS/GCP account |
| Setup | Manual | 5 minutes | One-click, ~10 min |
| Updates | You pull releases | Automatic | Optional update agent |
| Backups | You manage | We manage (encrypted) | Automated to your S3/Spaces |
| SSL/DNS | You configure | We handle | Automated via cloud-init |
| Price | Free | ~$5-15/mo | Free (you pay cloud directly) |

## Data Privacy & Encryption at Rest

A key differentiator is the trust story. Most SaaS knowledge bases (Notion, Roam, etc.) have full access to user data and the code isn't auditable. Atomic can offer a much stronger guarantee because the code is open source.

### Passphrase-Based Encryption

Users set a passphrase (essentially a recovery key) which we never store. The flow:

1. User sets a passphrase during setup
2. Passphrase is run through a KDF (Argon2) to derive a 256-bit encryption key
3. SQLCipher encrypts every SQLite page with AES-256
4. On startup, user provides passphrase via HTTPS to unlock the database

This means:

| State | Who can access data? |
|---|---|
| VM stopped | Only the passphrase holder |
| VM running | The running process (and theoretically the host operator) |
| Backups in storage | Only the passphrase holder |
| User forgets passphrase | **Nobody** — data is unrecoverable |

The unrecoverability is actually proof of integrity — if we could recover data without the passphrase, the encryption would be theater.

### Trust Claims by Tier

- **Self-hosted**: N/A — user has full control
- **Managed**: *"We don't access your data"* — encrypted at rest, open source code is auditable, no human SSH access to VMs, but the running process holds the key in memory
- **Deploy to your cloud**: *"We can't access your data"* — we never have credentials to the user's infrastructure. This is the strongest guarantee.

### What Would Make Managed Fully Zero-Knowledge

Confidential computing (AMD SEV-SNP, Intel TDX) encrypts VM memory at the hardware level — the hypervisor can't read guest RAM even while the VM runs. This would close the "key in memory" gap for the managed tier. Not yet available on Fly.io; partially available on AWS (Nitro Enclaves) and Azure. Worth revisiting as the ecosystem matures.

## Managed Tier: Implementation

### Infrastructure Options to Investigate

- **Fly.io Machines** — API-driven VM orchestration, Firecracker under the hood, per-VM billing, persistent volumes. Likely the fastest path to MVP. Worth investigating whether it supports the isolation and automation needs.
- **Raw Firecracker** — maximum control, but requires building the entire orchestration layer (networking, storage, scheduling, health checks). Only worth it at significant scale.
- **Hetzner + Firecracker** — cheapest compute in Europe, good for cost-sensitive pricing. More operational burden.

### What the Management Plane Needs

- **Provisioning**: spin up a new VM from a published image, attach persistent volume, configure DNS
- **Updates**: replace binary on VM, restart process (blue/green: boot new VM, migrate db, swap network)
- **Backups**: cron job copies encrypted SQLite file to object storage (trivial with SQLite)
- **Monitoring**: health checks, restart on failure, alerting
- **Custom domains**: users want `knowledge.theirdomain.com` — Caddy with automatic ACME certs
- **Escape hatch**: users can download their full SQLite database at any time (reduces churn anxiety)

## Deploy-to-Your-Cloud Tier: Implementation

### DigitalOcean 1-Click App

- Publish a marketplace image with Atomic pre-installed
- Cloud-init script handles: Caddy setup, systemd service, firewall, backup cron to DO Spaces
- User gets a droplet in their account, billed by DO

### AWS AMI / CloudFormation

- Publish an AMI with Atomic pre-installed
- CloudFormation template provisions: EC2 instance, security group, Route53 record, S3 bucket for backups
- More setup friction than DO but covers enterprise users

### Value-Add Services (Free Tier)

These create engagement without requiring infrastructure access:

- **Update agent** — daemon that polls GitHub releases API, self-updates the binary. No auth, no phone-home.
- **Backup scripts** — bundled, user configures destination.
- **Health ping** — optional opt-in heartbeat to our status service (zero data content). Enables alerting if their instance goes down.

## Strategic Notes

- The free and deploy-to-your-cloud tiers are **marketing funnels** for managed hosting. Most people will try self-hosting, hit the operational friction, and upgrade.
- The managed tier is where the margin lives — charge $10/mo for a VM that costs $3-5.
- The deploy-to-your-cloud tier costs almost nothing to support but builds trust and community.
- The MCP endpoint is the current hook — people are building AI agent workflows and need stable, authenticated endpoints. Self-hosting means dealing with DNS, TLS, NAT traversal. Turning that into a signup flow is real value.

## Prior Art

- **Plausible Analytics** — open source, offers managed hosting, similar model
- **Supabase** — open source Postgres platform, managed + self-hosted tiers
- **PocketBase** — single-binary backend, community-hosted options
- **Pikapods** — managed hosting for open source apps
- **Bitwarden** — open source password manager, freemium managed hosting
