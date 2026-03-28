# 🌐 VPN ONBOARDING GUIDE: NEW TEAM MEMBER SETUP

**Document Version:** v5  
**Date:** March 28, 2026  
**Estimated Setup Time:** 10 minutes  

---

## ✅ PRE-REQUISITES

Before starting, ensure you have:

- [ ] Email invitation from Admin with VPN config attachment
- [ ] Computer (Windows, Mac, or Linux)
- [ ] 2FA app installed: Google Authenticator, Authy, or Microsoft Authenticator
- [ ] Admin approval to access KindSwap infrastructure

---

## 🖥️ STEP 1: DOWNLOAD VPN CLIENT

### Windows & Mac (Recommended: Tunnelblick)

```
1. Visit: https://tunnelblick.net/downloads.html
2. Download: Latest version for your OS
3. Install: Run installer, grant admin permissions
4. Restart: Computer (to activate VPN kernel)
```

### Linux (OpenVPN CLI)

```bash
# Ubuntu/Debian
$ sudo apt-get install openvpn

# Fedora/RedHat
$ sudo yum install openvpn

# Verify
$ openvpn --version
```

### Alternative: WireGuard (Faster, Modern)

```
Windows/Mac:
1. Download: https://www.wireguard.com/install/
2. Install and run

Linux:
$ sudo apt-get install wireguard wireguard-tools  # Ubuntu
$ sudo yum install wireguard-dkms wireguard-tools  # Fedora
```

---

## 📧 STEP 2: RECEIVE VPN CONFIGURATION

You'll receive an email with attachment: `kindswap-vpn-profile.ovpn`

### Save the File

```
Windows:
├─ Downloads folder is OK
└─ C:\Users\YourName\Downloads\kindswap-vpn-profile.ovpn

Mac:
├─ Downloads folder is OK
└─ /Users/YourName/Downloads/kindswap-vpn-profile.ovpn

Linux:
├─ Save to: ~/.config/kindswap-vpn-profile.ovpn
└─ Set permissions: chmod 600 kindswap-vpn-profile.ovpn
```

---

## 🔐 STEP 3: SETUP TWO-FACTOR AUTHENTICATION (TOTP)

### Install Authenticator App

Choose ONE:

**Option A: Google Authenticator (Recommended)**
- iPhone: App Store → search "Google Authenticator"
- Android: Google Play → search "Google Authenticator"
- Web: https://myaccount.google.com/security (sync across devices)

**Option B: Authy**
- iPhone: App Store → search "Authy"
- Android: Google Play → search "Authy"
- Desktop: https://authy.com/download (backup if phone lost)

**Option C: Microsoft Authenticator**
- iPhone: App Store → search "Microsoft Authenticator"
- Android: Google Play → search "Microsoft Authenticator"

### Configure TOTP Secret

```
You'll receive: Secret key + QR code

IMPORTANT: Save secret key in secure location!
├─ Example: "JBSWY3DPEBLW64TMMQQ7" (never share!)
└─ Use: If app lost, reinstall and enter secret manually

Step 1: Open Authenticator app
Step 2: Tap + (Add account)
Step 3: Scan QR code OR enter secret manually
Step 4: Label: "KindSwap VPN"
Step 5: Save

Result: Shows 6-digit code (changes every 30 seconds)
```

---

## 🔗 STEP 4: CONNECT TO VPN (Windows - Tunnelblick)

### First-Time Connection

```
1. Open Tunnelblick (desktop app)
2. Finder → Applications → Tunnelblick.app → Open
3. "Add a new configuration..."
4. Select: kindswap-vpn-profile.ovpn
5. Tunnelblick imports configuration
6. Authorize: Enter Mac password (Tunnelblick needs elevated access)
```

### Connect

```
1. Tunnelblick menu icon (top-right corner)
2. Click: "kindswap-vpn-profile"
3. "Connect"
4. Prompt: Enter username
5. Prompt: Enter password
6. Prompt: Enter 6-digit TOTP code
   ├─ Open Google Authenticator
   ├─ Find "KindSwap VPN"
   ├─ Copy 6-digit code (valid for 30 seconds)
   └─ Paste into VPN prompt
7. Wait: "Connected" message appears
8. Status: Tunnelblick menu shows "Connected"
```

---

## 🔗 STEP 5: CONNECT TO VPN (macOS - Tunnelblick)

```
Same as Windows above, but:

1. Finder → Applications → Tunnelblick.app
2. Double-click kindswap-vpn-profile.ovpn
3. Tunnelblick opens and imports
4. Click "Connect"
5. Enter credentials (username, password, TOTP)
6. Status: Connected (check menu bar)
```

---

## 🔗 STEP 6: CONNECT TO VPN (Linux - OpenVPN CLI)

### First-Time Connection

```bash
# Navigate to config directory
$ cd ~/.config/

# Connect to VPN (interactive mode)
$ sudo openvpn --config kindswap-vpn-profile.ovpn

# Prompt: Enter username
# Prompt: Enter password
# Prompt: Enter 6-digit code (from Google Authenticator)

# Wait for: "Initialization Sequence Completed"
# Status: Connected!

# Keep terminal window open (ctrl+c to disconnect)
```

### Automated Script (Save Credentials)

```bash
# Create file: /home/user/.config/kindswap-creds.txt
$ cat > ~/.config/kindswap-creds.txt << EOF
<username>
<password>
<6-digit code>
EOF

# Set permissions (hide from others)
$ chmod 600 ~/.config/kindswap-creds.txt

# Connect
$ sudo openvpn --config kindswap-vpn-profile.ovpn \
    --auth-user-pass ~/.config/kindswap-creds.txt

# WARNING: Storing password is less secure!
# 6-digit code changes every 30s, so update manually each time:
$ echo -e "username\npassword\n123456" | \
    sudo openvpn --config kindswap-vpn-profile.ovpn \
    --auth-user-pass /dev/stdin
```

---

## 🔗 STEP 7: CONNECT TO VPN (WireGuard - Faster Alternative)

### Import Configuration

```
Windows/Mac:
1. Open WireGuard app
2. "Add Tunnel"
3. "Add existing tunnel(s) from file"
4. Select: kindswap-vpn-profile.conf
5. "Add Tunnel"
6. Click "Activate"

Linux:
$ sudo wg-quick up /path/to/kindswap-vpn-profile.conf
$ sudo wg show  # Verify connection
```

### Benefits vs OpenVPN

```
WireGuard Advantages:
├─ Faster (lower latency)
├─ Simpler configuration
├─ Less CPU usage
├─ Supports modern protocols
└─ Auto-reconnect if interrupted

When to use WireGuard:
├─ If bandwidth is critical
├─ If you have latency issues
├─ If you prefer modern tech
└─ If organization supports it (check with admin)
```

---

## ✅ STEP 8: VERIFY VPN CONNECTION

### Test Connectivity

```bash
# Check your VPN IP (should be 10.50.x.x)
$ curl https://httpbin.org/ip

# Expected output:
# {
#   "origin": "10.50.50.5"  # VPN IP!
# }

# Access admin endpoint (only works with VPN)
$ curl https://admin.kindswap.world/health

# Without VPN (on regular internet):
# ❌ 403 Forbidden (Access Denied)

# With VPN:
# ✅ 200 OK { "status": "healthy" }
```

### Check VPN Status in GUI

```
Tunnelblick (Mac/Windows):
├─ Menu icon shows: Green dot (connected)
├─ Click menu → "VPN Details"
└─ Show: Local IP (10.50.x.x), bytes transferred

WireGuard:
├─ App shows: "Activated"
├─ Transfer: ... Received, ... Sent
└─ Peers: Connected

Command-line:
$ sudo wg show  # WireGuard
$ sudo openvpn --status /tmp/openvpn-status.txt  # OpenVPN
```

---

## 🔑 STEP 9: SECURE YOUR TOTP SECRET

### Backup Secret Key

```
CRITICAL: Save secret key in secure location!

Option 1: Password Manager
├─ App: 1Password, LastPass, Bitwarden
├─ Store: Secret key + label "KindSwap VPN"
└─ Benefit: Encrypted, synced, easy recovery

Option 2: Paper Backup
├─ Write: Secret key on paper
├─ Store: Physical safe (home/office)
└─ Benefit: No digital theft risk

Option 3: Authy Cloud Backup
├─ App: Authy (has built-in backup)
├─ Feature: Multi-device sync
└─ Benefit: Recover if phone lost
```

### If You Lose Access

```
1. Contact: DevOps team (emergency number)
2. Verify: Your identity (employee ID, etc)
3. Action: Admin re-generates TOTP secret
4. Receive: New secret + QR code
5. Setup: Add to new authenticator app
6. Timeline: 24 hours (security process)
```

---

## 🔌 STEP 10: AUTO-CONNECT ON STARTUP (Optional)

### Tunnelblick (Mac)

```
1. Open Tunnelblick menu
2. Preferences → Configurations
3. Right-click "kindswap-vpn-profile" → Edit
4. Check: "Connect when Tunnelblick launches"
5. Check: "Reconnect if disconnected"
6. Save
```

### Linux (systemd)

```bash
# Create systemd service
$ sudo cat > /etc/systemd/system/openvpn-kindswap.service << EOF
[Unit]
Description=KindSwap VPN
After=network-online.target

[Service]
Type=notify
ExecStart=/usr/sbin/openvpn --config /path/to/kindswap-vpn-profile.ovpn
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable
$ sudo systemctl daemon-reload
$ sudo systemctl enable openvpn-kindswap
$ sudo systemctl start openvpn-kindswap

# Verify
$ sudo systemctl status openvpn-kindswap
```

---

## 🆘 TROUBLESHOOTING

### Problem: "Connection Refused"

```
Cause: VPN gateway unreachable
Solution:
1. Check internet connection: ping 8.8.8.8
2. Check firewall: Ensure UDP/TCP ports not blocked
3. Verify config file: Not corrupted
4. Contact: DevOps if still failing
```

### Problem: "Wrong Password or TOTP"

```
Cause 1: Incorrect username/password
Solution: Verify credentials email from admin

Cause 2: TOTP code expired
Solution: TOTP expires every 30 seconds!
├─ Copy code → paste immediately
├─ If delayed: Re-enter (get new code)
└─ Example: Don't copy at :28s, wait for :00s

Cause 3: Device time out of sync
Solution: Sync device time
├─ Mac: System Preferences → Date & Time → Set Automatically
├─ Windows: Settings → Time & Language → Set time automatically
└─ Linux: $ sudo systemctl enable systemd-timesyncd
```

### Problem: Disconnects After 1 Hour

```
Cause: Session timeout
Solution:
1. Increase timeout (admin can change)
2. Auto-reconnect: Enable in Tunnelblick/WireGuard
3. Or: Manually reconnect every hour
```

### Problem: Slow Speed / High Latency

```
Cause: OpenVPN (high overhead)
Solution: Switch to WireGuard (much faster)
├─ WireGuard: 1-10ms latency increase
├─ OpenVPN: 50-100ms latency increase
└─ Ask admin for WireGuard config
```

---

## 📞 SUPPORT

**Still need help?**

```
Contact: DevOps Team
├─ Email: devops@kindswap.xyz
├─ Slack: #devops-help
└─ Escalate: @devops-oncall (emergencies)
```

---

## ✅ ONBOARDING CHECKLIST

- [ ] VPN client installed (Tunnelblick/WireGuard/OpenVPN)
- [ ] Config file saved (.ovpn)
- [ ] 2FA app installed (Google Authenticator/Authy/Microsoft)
- [ ] TOTP secret added to 2FA app
- [ ] TOTP secret backed up securely
- [ ] Successfully connected to VPN
- [ ] Verified IP is 10.50.x.x
- [ ] Accessed admin.kindswap.world (200 OK)
- [ ] Added to Slack #devops channel
- [ ] Completed security training

**Status:** Ready to work! 🚀

---

**Document:** VPN ONBOARDING GUIDE  
**Status:** ✅ COMPLETE  
**Version:** v5  
**Last Updated:** March 28, 2026
