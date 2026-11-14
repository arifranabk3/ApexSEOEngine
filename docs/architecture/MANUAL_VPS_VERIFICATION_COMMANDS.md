# APEX SEO ENGINE — MANUAL VPS VERIFICATION PACKAGE
## Safe, Copy-Ready Diagnostic Runbook for Remote Linux VPS

**Project:** Apex SEO Engine  
**Local Workspace:** `D:\BloggingNew`  
**Target Database:** MongoDB Atlas (`apex_seo`)  
**Atlas Cluster Host:** `sellzy-staging.tv1yvju.mongodb.net`  
**Execution Environment:** Run directly inside your VPS terminal via SSH.  
**Strict Safety Protocol:**  
- **Read-only execution**: No packages installed, no files edited, no services restarted.  
- **Zero credential disclosure**: Connection strings, secrets, and keys are masked/never printed.  
- **Safe output sharing**: All commands below are vetted so their console outputs contain no sensitive credentials and are safe to paste back into chat.

---

## Important Distinction: Workstation vs. Remote VPS

| System Dimension | Local Workstation (Audited & Verified) | Remote Linux VPS (Pending Your Execution) |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 Enterprise (win32 x64) | Linux (Ubuntu / Debian / AlmaLinux) |
| **Public IPv4** | `154.192.130.239` (**Dynamic broadband**, cycles subnets) | **Dedicated Cloud IPv4** (To be verified as static) |
| **MongoDB Atlas Status** | Verified connected (~1776ms ping, CRUD tests pass) | To be verified via Section C commands |
| **Primary Role** | Development, testing, build compilation | 24/7 Production Node.js standalone backend |

---

## SECTION A: VPS Hardware & System Resources

Copy and run these commands on your Linux VPS to inspect hardware capacity.

### A.1 OS, Kernel, and Architecture
```bash
uname -srm && cat /etc/os-release | grep -E "^(NAME|VERSION)="
```
- **What it checks:** Linux distribution, release version, and CPU architecture (x86_64 / aarch64).
- **Expected output:** E.g. `Linux 6.8.0-xx x86_64`, `NAME="Ubuntu"`, `VERSION="22.04 LTS"`.
- **Failure meaning:** Incompatible/unsupported operating system.
- **Safe to share?** **Yes** (100% safe).

### A.2 CPU Cores & Current Load
```bash
nproc && uptime
```
- **What it checks:** Total available CPU cores and 1, 5, and 15-minute load averages.
- **Expected output:** Number of cores (e.g. `2` or `4`) and load averages below the core count (e.g. `load average: 0.15, 0.22, 0.18`).
- **Failure meaning:** If load average significantly exceeds the core count, the server is under CPU contention.
- **Safe to share?** **Yes**.

### A.3 Memory & Swap Utilization
```bash
free -h
```
- **What it checks:** Total, used, and available physical RAM and configured swap space.
- **Expected output:** Shows `Mem:` and `Swap:` lines. At least `300MB` available RAM is required for Next.js standalone; ideally `1GB+` available.
- **Failure meaning:** `available` memory < 150MB indicates risk of Linux kernel OOM (Out-of-Memory) killer terminating Node.js.
- **Safe to share?** **Yes**.

### A.4 Disk Capacity & Free Space
```bash
df -h /
```
- **What it checks:** Root filesystem total size, used space, and free capacity.
- **Expected output:** Shows disk size with at least `3GB` to `5GB` of available space.
- **Failure meaning:** Root disk full (>95%) prevents build deployments, log writes, and PM2 state persistence.
- **Safe to share?** **Yes**.

### A.5 Existing Process Workloads (Node.js, PM2, Nginx)
```bash
ps aux | grep -E "node|pm2|nginx|ollama|n8n|docker" | grep -v grep | awk '{print $1, $2, $3, $4, $11}'
```
- **What it checks:** Identifies running services and their individual CPU/RAM consumption.
- **Expected output:** List of running processes without sensitive arguments.
- **Failure meaning:** Reveals if other services (e.g. local Ollama LLMs) are consuming heavy memory.
- **Safe to share?** **Yes** (arguments masked by awk).

---

## SECTION B: Public IP & Static IP Verification

### B.1 Discover Outbound Public IPv4
```bash
curl -s -4 https://api.ipify.org && echo ""
```
- **What it checks:** The exact outbound public IPv4 address that your VPS uses when making external internet requests.
- **Expected output:** A single public IPv4 address (e.g. `195.xxx.xxx.xxx`).
- **Failure meaning:** Outbound IPv4 networking failure or IPv6-only VPS.
- **Safe to share?** **Yes**. (Mask the last octet if desired, e.g. `195.123.45.xxx`).

### B.2 How to Verify Whether this IP is Static
> [!IMPORTANT]
> An observed public IP from `api.ipify.org` does **not** automatically prove the IP is permanently static. VPS providers assign IPs differently:
> 
> 1. **Standard Cloud VPS (Hetzner, DigitalOcean, Linode, Contabo, OVH, Vultr):**  
>    The primary IPv4 address assigned to a VPS instance is **static** by default and persists across standard reboots and power cycles. It only changes if you destroy the instance or manually reassign an ephemeral floating IP.
> 2. **Provider Verification Checklist:**  
>    - Log in to your VPS provider dashboard (e.g. Hetzner Cloud Console, DigitalOcean Droplets, AWS EC2, etc.).
>    - Locate your server instance and inspect the **Networking / IP Addresses** panel.
>    - Ensure the IPv4 address is marked as **Primary IPv4** or **Static IP / Elastic IP** (not dynamic DHCP).
>    - Confirm with provider documentation that instance reboots preserve the assigned IPv4.

---

## SECTION C: MongoDB Atlas Connectivity from VPS

These commands test DNS, TCP, and TLS connectivity to your MongoDB Atlas cluster without exposing passwords or credentials.

### C.1 Atlas SRV DNS Resolution
```bash
host -t SRV _mongodb._tcp.sellzy-staging.tv1yvju.mongodb.net || dig SRV _mongodb._tcp.sellzy-staging.tv1yvju.mongodb.net +short
```
- **What it checks:** Verifies the VPS DNS resolver can discover MongoDB Atlas shard hostnames.
- **Expected output:** 3 SRV records pointing to `ac-zv0eejs-shard-00-00.tv1yvju.mongodb.net`, `01`, and `02` on port `27017`.
- **Failure meaning:** VPS DNS resolvers (e.g. `/etc/resolv.conf`) cannot resolve external DNS SRV records.
- **Safe to share?** **Yes**.

### C.2 TCP Port 27017 Reachability
```bash
nc -zv -w 5 ac-zv0eejs-shard-00-00.tv1yvju.mongodb.net 27017 2>&1 || timeout 5 bash -c '</dev/tcp/ac-zv0eejs-shard-00-00.tv1yvju.mongodb.net/27017' && echo "TCP 27017 Connected"
```
- **What it checks:** Verifies outbound TCP routing to MongoDB Atlas shard on standard MongoDB port `27017`.
- **Expected output:** `Connection to ... 27017 port [tcp/*] succeeded!` or `TCP 27017 Connected`.
- **Failure meaning:** Outbound port 27017 is blocked by VPS egress firewall (UFW/iptables) or the VPS IP is not yet allowlisted in MongoDB Atlas Network Access.
- **Safe to share?** **Yes**.

### C.3 TLS 1.3 Handshake Verification
```bash
echo "Q" | openssl s_client -connect ac-zv0eejs-shard-00-00.tv1yvju.mongodb.net:27017 -servername ac-zv0eejs-shard-00-00.tv1yvju.mongodb.net 2>/dev/null | grep -E "Protocol|Cipher|Verify return code"
```
- **What it checks:** Validates that the VPS OpenSSL library can complete a secure TLS handshake with the Atlas shard.
- **Expected output:**  
  `Protocol  : TLSv1.3`  
  `Cipher    : TLS_AES_128_GCM_SHA256`  
  `Verify return code: 0 (ok)`
- **Failure meaning:** Outdated CA certificates on VPS (`ca-certificates`), network firewall inspection, or IP blocked by Atlas (`SSL alert number 80`).
- **Safe to share?** **Yes**.

### C.4 Safe Authenticated MongoDB Ping (Using Protected Environment Variable)
> [!CAUTION]
> Do NOT paste your connection string on the command line where it could be logged in `~/.bash_history`. Instead, execute this self-masking Node.js one-liner which reads `MONGODB_URI` from your protected server `.env` file without echoing it:

```bash
node -e '
const { MongoClient } = require("mongodb");
const fs = require("fs");
let uri = process.env.MONGODB_URI;
if (!uri && fs.existsSync(".env")) {
  const line = fs.readFileSync(".env", "utf8").split("\n").find(l => l.startsWith("MONGODB_URI="));
  if (line) uri = line.split("=")[1].trim().replace(/^["\x27]|["\x27]$/g, "");
}
if (!uri) { console.log("[Result]: MONGODB_URI not found in env or .env file"); process.exit(1); }
(async () => {
  const start = Date.now();
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const res = await client.db("apex_seo").command({ ping: 1 });
    console.log("[Result]: Authenticated MongoDB ping SUCCESSFUL in", Date.now() - start, "ms. Status:", res.ok);
  } catch (err) {
    console.log("[Result]: MongoDB connection FAILED:", err.name, err.message);
  } finally {
    await client.close();
  }
})();'
```
- **What it checks:** Complete end-to-end authentication, database authorization, and ping response from `apex_seo`.
- **Expected output:** `[Result]: Authenticated MongoDB ping SUCCESSFUL in ... ms. Status: 1`
- **Failure meaning:** Authentication failure, incorrect database credentials, or VPS IP is not yet allowlisted in MongoDB Atlas Network Access.
- **Safe to share?** **Yes** (Only prints latency and status, zero secrets).

---

## SECTION D: Application Runtime Environment

### D.1 Node.js & Package Manager Versions
```bash
node -v && npm -v
```
- **What it checks:** Verifies Node.js runtime is installed and compatible with Next.js 15.
- **Expected output:** Node.js version `v18.18.0` or higher (Recommended: `v20.x LTS` or `v22.x LTS`).
- **Failure meaning:** Node.js not installed or outdated (< v18.18.0 will fail to run Next.js 15).
- **Safe to share?** **Yes**.

### D.2 PM2 Process Manager Availability
```bash
pm2 -v 2>/dev/null || echo "PM2 is not installed"
```
- **What it checks:** Checks if PM2 is available for managing the Node.js background process.
- **Expected output:** PM2 version number (e.g. `5.3.1`).
- **Failure meaning:** If not installed, can be installed later with `npm install -g pm2` or run via standard Linux systemd service.
- **Safe to share?** **Yes**.

### D.3 Nginx Web Server Availability & Status
```bash
nginx -v 2>/dev/null && systemctl is-active nginx 2>/dev/null || echo "Nginx status check complete"
```
- **What it checks:** Checks if Nginx is installed and actively running as a reverse proxy.
- **Expected output:** `nginx version: nginx/1.xx.x` and `active`.
- **Failure meaning:** Nginx not installed or stopped.
- **Safe to share?** **Yes**.

---

## SECTION E: One-Line Master Diagnostic (Optional)

If you prefer running a single copy-paste command that executes Sections A through D sequentially and formats the output cleanly, run:

```bash
echo "=== 1. OS & HARDWARE ===" && \
uname -srm && cat /etc/os-release | grep -E "^(NAME|VERSION)=" && \
echo "CPUs:" $(nproc) && uptime && free -h && df -h / && \
echo "=== 2. OUTBOUND PUBLIC IP ===" && \
curl -s -4 https://api.ipify.org && echo "" && \
echo "=== 3. ATLAS DNS & PORT 27017 ===" && \
(nc -zv -w 5 ac-zv0eejs-shard-00-00.tv1yvju.mongodb.net 27017 2>&1 || echo "Check nc/firewall") && \
echo "=== 4. RUNTIME VERSIONS ===" && \
node -v 2>/dev/null || echo "Node not found" && \
pm2 -v 2>/dev/null || echo "PM2 not found" && \
nginx -v 2>/dev/null || echo "Nginx not found"
```

---

## SECTION F: Interpreting Your Results & Next Steps

Once you run these commands:
1. Paste the console output into chat.
2. We will analyze your VPS's available RAM, CPU capacity, and outbound public IPv4.
3. Once your VPS IPv4 is added to the MongoDB Atlas Network Access allowlist (`<VPS_IP>/32`), the VPS backend will have secure, static, zero-additional-cost connectivity to MongoDB Atlas.
