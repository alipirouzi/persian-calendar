# Security — controls, evidence, and gaps

**Last reviewed:** 2026-07-31
**System:** the static site at <https://time.automated.ink/>, its GitHub repository and
CI/CD pipeline, and the Hetzner host that serves it.

## Scope statement — read this first

**SOC 2 Type II is an organizational audit, not a property of software.** It assesses an
entity's control environment — policies, personnel, vendor management, incident response,
change management — over an observation period, and it is performed by a licensed CPA firm
producing an attestation report. Nothing in this repository, and nothing in this document,
constitutes SOC 2 compliance, certification, or evidence of an audit.

What this document *is*: an honest inventory of the technical controls actually implemented
for this project, mapped to the SOC 2 Trust Services Criteria they would support, together
with the gaps that remain open. It is intended to be useful input to an audit, and useful
to whoever operates this system — not to imply an audit has happened.

Criteria referenced: **Security (CC6)**, **Change Management (CC8)**, **Availability
(A1)**, **Confidentiality (C1)**, **Privacy (P)**.

## The single most important fact about this system

**It is a static site that processes no personal data.** No accounts, no login, no forms
submitted anywhere, no cookies, no analytics, no third-party requests, no server-side
state, no database. Every conversion and clock frame is computed in the visitor's browser.
The server's entire job is to return files.

That collapses most of the attack surface and most of the privacy surface. There is no user
data to breach, no session to hijack, no injection sink, no authorization model to get
wrong. Several controls below are "trivially satisfied" not through diligence but because
the architecture leaves nothing to protect. That is a legitimate and deliberate security
property — but it also means these controls would need real design work if the system ever
grew a backend.

## Control inventory

### Access control (CC6.1, CC6.2, CC6.3)

| Control | Implementation | Evidence |
|---|---|---|
| No password authentication | `PasswordAuthentication no` in effective sshd config | verified 2026-07-31 |
| Key-only SSH; root login restricted | `PermitRootLogin prohibit-password` | verified 2026-07-31 |
| Reduced auth attempt surface | `MaxAuthTries 3` (was 6) | `/etc/ssh/sshd_config.d/90-hardening.conf` |
| X11 forwarding disabled | `X11Forwarding no` (was `yes`) | same file |
| Dedicated non-root deploy identity | user `deploy` (uid 1001); CI no longer authenticates as root | `id deploy` |
| Deploy key cannot get a shell | `authorized_keys` entry is `command="/usr/local/bin/time-app-deploy",restrict` — `restrict` disables pty, port/agent/X11 forwarding, and user rc | verified: a request for `whoami` and a request for `cat /etc/shadow` both ran the deploy script instead and leaked nothing |
| Deploy credentials never in the repo | `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS` exist only as GitHub Actions secrets; the private key was generated, installed, and deleted from local disk in one session and never echoed | secret list, 2026-07-31 |
| Host key pinning in CI | `DEPLOY_KNOWN_HOSTS` is pre-seeded, so a rebuilt or spoofed host fails the deploy instead of being trusted | `.github/workflows/ci.yml` |

### Network security (CC6.6, CC6.7)

| Control | Implementation | Evidence |
|---|---|---|
| Host firewall enabled with an allowlist | `ufw` active (was inactive), default deny inbound / allow outbound / deny routed, enabled at boot | `ufw status verbose` |
| Only necessary ports reachable | three allows: **22/tcp, 80/tcp, 443/tcp**, IPv4 and IPv6 | same |
| No unintended public listeners | audited before enabling the firewall: only 22, 80, 443 bound publicly; the co-tenant application's Postgres and MinIO listen on the docker network only, never on a host port | `ss -tulpn`, 2026-07-31 |
| TLS terminated at the edge | Caddy terminates TLS for `time.automated.ink` and reverse-proxies to the container over an internal docker network; the container itself is never published to the host | `/opt/caddy/Caddyfile`, `/opt/time/docker-compose.yml` |
| Browser-side hardening | CSP `default-src 'self'` with no external origins (every asset self-hosted), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`; HSTS added by Caddy | `deploy/security-headers.conf`; verified live in response headers |

### Change management (CC8.1)

| Control | Implementation | Evidence |
|---|---|---|
| All changes go through version control | no manual edits to the running site; the only path to production is a commit on `master` | `.github/workflows/ci.yml` |
| Automated gates before deploy | the deploy job `needs: [dotnet, site]` — it cannot run unless `dotnet build -warnaserror`, 19 NUnit tests, 46 Vitest tests (including bit-exact parity against `System.Globalization.PersianCalendar` for ~110,000 days), and 13 Playwright E2E tests have all passed | same |
| Deploys are health-verified, not fire-and-forget | after shipping the image, CI polls `https://time.automated.ink/health` and asserts the page contains the expected mount point; the run **fails** if the site does not become healthy within 3 minutes | same |
| Deploy actions are constrained | the host executes one fixed script for the deploy key — load image, `compose up -d`, prune. CI cannot run arbitrary commands even if the workflow were modified | `/usr/local/bin/time-app-deploy` |
| Deploy audit trail | every deploy is a GitHub Actions run: who pushed, which commit, which jobs passed, what the deploy step output, and when — retained in the repository's run history | GitHub Actions run history |
| Rollback path is documented | previous images remain on the host and are retagged to `time-app:current` to revert | README, "Rolling back" |

### Vulnerability and patch management (CC7.1)

| Control | Implementation | Evidence |
|---|---|---|
| Automatic OS security updates | `unattended-upgrades` enabled | verified 2026-07-31 |
| Host fully patched at review time | 14 pending updates applied; pending count **0** afterwards | `apt`, 2026-07-31 |
| Container base images pinned to a minor version | `node:22-alpine` (build stage, not shipped) and `nginx:1.27-alpine` (runtime) | `Dockerfile` |
| Minimal runtime surface | the shipped image contains nginx plus static files — no application runtime, no interpreter, no package manager in the serving path | `Dockerfile` |
| No third-party client code | zero external origins; no CDN scripts, no analytics tags, no fonts loaded from a third party. Supply-chain risk is confined to build-time npm dependencies, which do not execute in visitors' browsers beyond the bundled output | CSP + `Site/package.json` |

### Logging and monitoring (CC7.2)

| Control | Implementation | Evidence |
|---|---|---|
| System and service logs | `journald` on the host; nginx access/error logs inside the container | host default |
| Brute-force mitigation | `fail2ban` enabled and active, one jail: `sshd` | `fail2ban-client status`, 2026-07-31 |
| Container liveness | `HEALTHCHECK` in the image polls `http://127.0.0.1:8080/health` every 30 s; `restart: unless-stopped` recovers a failed container | `Dockerfile`, compose file |
| Deploy audit trail | GitHub Actions run history (see Change Management) | — |

### Availability (A1.1, A1.2)

| Control | Implementation | Evidence |
|---|---|---|
| Automatic restart | every container on the host carries `restart: unless-stopped`, verified before the Docker daemon upgrade so all services self-heal across a daemon restart | `docker inspect`, 2026-07-31 |
| Fast recovery | the site is static; a total loss is recovered by re-running CI, which rebuilds and redeploys from source in a couple of minutes |  — |
| No stateful data to lose | nothing is persisted by this application; there is no database, volume, or user content in scope | — |

### Confidentiality and privacy (C1.1, P1–P8, GDPR)

| Control | Implementation |
|---|---|
| No personal data processed | no accounts, no forms, no submissions, no cookies, no analytics, no fingerprinting, no logging of user input — the site never sends anything about the visitor anywhere |
| No client-side persistence of personal data | `localStorage` holds exactly one value: the chosen UI language (`en` / `fa`). It is a preference, not personal data, and never leaves the browser |
| No third-party processors in the serving path | all assets self-hosted; CSP forbids external origins, so a rogue dependency cannot exfiltrate to a third party at runtime |
| GDPR posture | trivial **by design**: with no personal data collected there is no processing to find a lawful basis for, no data subject rights machinery required, no DPA needed with a sub-processor for user data, and no cross-border transfer of personal data. The hosting provider (Hetzner) is EU-based |
| Confidentiality of secrets | the only secrets in scope are the three GitHub Actions deploy secrets; nothing sensitive is committed and the repository contains no credentials |

## Known gaps — open and honest

These are real. None of them is mitigated by something not listed above.

### Host and infrastructure

1. **Pending kernel reboot.** `libc6` and two kernels (`linux-image-7.0.0-27`,
   `linux-image-7.0.0-28`) were installed but the host has not been restarted, so
   already-running processes still use the pre-upgrade kernel and libc. The patched libc is
   on disk but not in use. A reboot was deliberately deferred because it would also drop a
   co-tenant production application; it needs a maintenance window.

2. **The `deploy` user is in the `docker` group, which is root-equivalent.** Anyone able to
   use `DEPLOY_SSH_KEY` could in principle `docker run -v /:/host` and own the machine. The
   **forced command is the only control preventing this** — the key cannot open a shell or
   pass arguments. That makes `DEPLOY_SSH_KEY` a high-value secret and makes the wrapper
   script security-critical: it must never be changed to accept arbitrary input. Further
   hardening (validating the loaded image name/tag before `compose up`, or moving to a
   rootless/socket-proxy setup) would remove the reliance on the wrapper alone.

3. **Docker published ports bypass ufw.** Docker inserts its own iptables rules ahead of
   ufw's INPUT chain, so a container that publishes a port is reachable from the internet
   **even if ufw does not allow it**. Today this is harmless — only 80 and 443 are
   published, and those are intentionally open — but any future container publishing a port
   would be silently exposed with no matching ufw rule. The ufw allowlist must not be
   treated as a complete description of what is reachable.

4. **`AllowTcpForwarding yes` remains globally** for interactive and root logins. The
   deploy key is unaffected (`restrict` disables forwarding for it), but this is optional
   further hardening that was not done.

5. **Root `authorized_keys` has not been triaged.** Three keys are present and none were
   removed. One has no comment and no known provenance; one is labelled `coolify` and is
   very likely dead now that Coolify has been decommissioned for this project; one
   (`paraphe-deploy`) belongs to a co-tenant application and **still authenticates as
   root**, i.e. it has not been migrated to the forced-command pattern used here. This
   requires an owner decision, not a technical fix.

6. **Single host, single region, no redundancy.** One Hetzner VM in one location serves the
   site. There is no failover, no load balancer, no second region. Host loss means an
   outage until the host is replaced.

7. **Co-tenancy.** This host also runs an unrelated production application. A compromise or
   resource exhaustion in either affects the other. There is no isolation boundary beyond
   Docker.

### Operations

8. **No centralized log retention.** Logs live only on the host in `journald` and inside
   containers. They are not shipped anywhere, not retained to a defined schedule, and would
   be lost with the host. Post-incident forensics would be severely limited. Container
   restarts discard nginx logs.

9. **No uptime alerting.** Nobody is notified if the site goes down between deploys. The
   only automated health check runs *during* a deploy; after that, an outage is discovered
   by a human visiting the site. This is the largest operational gap.

10. **Hetzner backups not verified.** Whether snapshots/backups are enabled for this VM was
    not confirmed, and no restore has ever been tested. An unverified backup is not a
    backup. (The application itself is stateless and rebuildable from git — the exposure is
    the host configuration described in this document, which exists only as manual changes
    on the box, not as code.)

11. **Host configuration is not infrastructure-as-code.** The firewall rules, sshd
    hardening, deploy user, and forced-command script were applied by hand and exist only
    on the running host. Rebuilding it correctly depends on this document being accurate.

12. **No formal incident response, access review, or vendor management process.** These are
    organizational controls, and SOC 2 turns primarily on them. Nothing here substitutes.

### Product

13. **Farsi quote translations have not been proofread by a native speaker.** The 366 Farsi
    texts in `Site/public/quotes.json` were produced for this project. This is a content
    accuracy risk, not a security risk, but it is a known unverified claim being served to
    users.

## Reporting a vulnerability

Open a GitHub issue for anything non-sensitive. For anything exploitable, contact the
repository owner directly rather than filing publicly.
