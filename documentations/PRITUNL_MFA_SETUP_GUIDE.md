# PRITUNL VPN MFA SETUP GUIDE

**Objective:** Enable TOTP-based MFA on all Pritunl VPN profiles  
**Target Users:** All developers, DevOps, smart contract engineers  
**MFA Standard:** RFC 6238 TOTP (Time-based One-Time Password)  
**Supported Apps:** Google Authenticator, Authy, Microsoft Authenticator, 1Password, FreeOTP

---

## PART 1: ADMIN SETUP (Pritunl Server)

### Step 1.1: Access Pritunl Admin Panel

1. **Navigate to Pritunl admin URL:**
   ```
   https://vpn.kindswap.world/admin
   ```

2. **Login with admin credentials** (see [SECRET: Pritunl Admin Credentials](./SECRET_MANAGEMENT.md))

3. **Verify you're in Organization Admin view**
   - Look for "Servers" tab in main menu
   - Should show list of active VPN servers

### Step 1.2: Enable MFA on Pritunl Server

1. **Click on the Server name** (e.g., "kindswap-prod-server")

2. **Navigate to Settings tab**

3. **Locate "Enable MFA" option**
   - Check the box: ☑️ **Enable MFA**
   - MFA Type: Select **TOTP (RFC 6238)**

4. **Configure MFA Requirements**
   ```
   MFA Provider: TOTP
   MFA Enforced: YES (required for all users)
   MFA Grace Period: 24 hours (for new users during onboarding)
   ```

5. **Click "Save"** to apply settings

### Step 1.3: Configure MFA Backup Codes

1. **In Settings tab, look for "MFA Backup Codes"**

2. **Generate backup codes:**
   - Click "Generate Backup Codes"
   - System generates 10 single-use codes
   - Store codes in secure location (password manager)

3. **Share with team:**
   - Email backup codes to infrastructure leads
   - Use for emergency access if user loses authenticator device

### Step 1.4: Disable Access Without MFA (Enforcement)

1. **In Settings tab, find "Allow MFA Bypass"**
   - Set to: **NO** (MFA cannot be skipped)

2. **Set "MFA Required After Days":**
   - Value: **1** (enforces MFA setup immediately after account creation)

3. **Click "Save"**

---

## PART 2: USER VPN PROFILE SETUP

### Step 2.1: User Obtains VPN Profile

**For each team member:**

1. **User logs into Pritunl user portal:**
   ```
   https://vpn.kindswap.world
   ```
   (or provided user portal URL)

2. **User navigates to "Downloads"** section

3. **Download VPN profile:**
   - Profile format: `.conf` or `.ovpn` file
   - Save to secure location (user's computer)

### Step 2.2: User Installs Authenticator App

**Choose ONE of the following (all RFC 6238 compliant):**

**Option A: Google Authenticator** (Most common)
- **iOS:** App Store search "Google Authenticator"
- **Android:** Google Play Store search "Google Authenticator"
- **Download:** Free, no account required

**Option B: Authy** (Recommended for backup sync)
- **iOS:** App Store search "Authy"
- **Android:** Google Play Store search "Authy"
- **Benefit:** Cloud backup of TOTP secrets (if enabled)
- **Download:** Free (premium backup options available)

**Option C: Microsoft Authenticator** (If using Microsoft ecosystem)
- **iOS/Android:** Microsoft app store
- **Benefit:** Integrates with Azure AD

**Option D: 1Password** (If using 1Password password manager)
- **Included:** 1Password app (v7+)
- **Benefit:** TOTP and passwords in one place

**Option E: FreeOTP** (If using Red Hat ecosystem)
- **iOS/Android:** Free and open-source
- **Benefit:** No cloud dependencies

### Step 2.3: Generate TOTP Secret

**In Pritunl user portal:**

1. **Navigate to user account settings** (usually top-right menu)

2. **Look for "Two-Factor Authentication"** or **"MFA"** section

3. **Click "Enable MFA"** or "Generate QR Code"

4. **Pritunl displays:**
   - 🔷 **QR Code** (large square barcode)
   - 📝 **Manual Entry Key** (if QR code doesn't work)
     ```
     Example: JBSWY3DPEBLW64TMMQ======
     ```

### Step 2.4: Scan QR Code in Authenticator App

**Using Google Authenticator (example; other apps similar):**

1. **Open Google Authenticator app**

2. **Tap "+" button** (add new account)

3. **Select "Scan a QR code"** option

4. **Point phone camera at Pritunl QR code**
   - Ensure good lighting
   - Frame entire QR code within screen
   - App will auto-detect and scan

5. **Verify success:**
   - New entry appears in Authenticator app
   - Label shows: "Pritunl (vpn.kindswap.world)"
   - 6-digit number appears and changes every 30 seconds

**If QR code won't scan:**

1. **Select "Enter setup key"** instead
2. **Manually type the key** from Pritunl (e.g., JBSWY3DPEBLW64TMMQ======)
3. **Select account type: Time-based (TOTP)**
4. **Enter account name: Pritunl or kindswap-vpn**
5. **Press Save**

### Step 2.5: Enter TOTP Code to Confirm

**Back in Pritunl web portal:**

1. **After scanning QR code, you'll see "Verify Code" field**

2. **In Authenticator app, find Pritunl entry**
   - Note the 6-digit code
   - It changes every 30 seconds

3. **Type 6-digit code in Pritunl "Verify Code" field**

4. **Click "Verify"** or "Confirm"

5. **Success message appears:**
   ```
   ✓ Two-factor authentication enabled successfully
   ```

6. **Pritunl displays backup codes (if applicable):**
   - Save these codes in password manager
   - Use if you lose access to authenticator

### Step 2.6: Install VPN Client

**Choose VPN client for your OS:**

**Windows:**
- **OpenVPN GUI** (official client)
- **WireGuard** (if Pritunl supports)
- Download from [openvpn.net](https://openvpn.net/client/)

**macOS:**
- **Tunnelblick** (popular, free)
- **Viscosity** (commercial, more features)
- **OpenVPN Connect**
- Download from [openvpn.net](https://openvpn.net/client/) or App Store

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install openvpn

# CentOS/RHEL
sudo yum install openvpn

# Or use WireGuard if supported
sudo apt-get install wireguard
```

### Step 2.7: Import VPN Profile

**After VPN client is installed:**

1. **Open VPN client application**

2. **Look for "Import Profile"** or "Open Configuration File"**

3. **Navigate to downloaded .ovpn/.conf file** (from Step 2.1)

4. **Select and import** the profile

5. **Profile now appears in VPN client**
   - Named: "kindswap-vpn" or similar

---

## PART 3: CONNECTING WITH MFA

### Step 3.1: First Connection (New Device/Profile)

1. **Open VPN client**

2. **Select kindswap-vpn profile**

3. **Click "Connect"**

4. **Prompt appears: "Enter MFA Code"**

5. **In Authenticator app:**
   - Open Pritunl entry
   - Note 6-digit code (changes every 30 seconds)

6. **Enter code in VPN client prompt**

7. **Connection establishes:**
   - Green checkmark/indicator appears
   - Status shows "Connected"

### Step 3.2: Subsequent Connections (Same Device)

**Note:** MFA behavior depends on Pritunl configuration:

**Scenario A: MFA required every connection**
- Every connect → Enter 6-digit code from app

**Scenario B: MFA remembers device**
- First connect on device → Enter code
- Future connects from same device → May skip MFA (depends on config)

### Step 3.3: If TOTP Code Expires During Login

**TOTP codes are time-based and expire every 30 seconds:**

1. **If code becomes invalid during entry:**
   - Wait for next code to appear (usually 1-2 seconds)
   - Enter new code

2. **If connection fails:**
   - Disconnect and try again
   - Use new 6-digit code from app

3. **If "Code Invalid" error after 30+ seconds:**
   - Check that phone time and server time are synchronized
   - See [Troubleshooting](#troubleshooting) below

---

## PART 4: BACKUP & RECOVERY

### Step 4.1: Save Backup Codes

**Pritunl provides 10 single-use backup codes:**

1. **When MFA is first enabled, Pritunl generates codes:**
   ```
   12345-ABC12
   23456-BCD23
   34567-CDE34
   ...etc (10 total)
   ```

2. **Each code is valid for 1 backup login only**

3. **Store codes in:**
   - ✅ Password manager (1Password, Bitwarden, LastPass)
   - ✅ Printed paper in secure location
   - ❌ Email (not secure)
   - ❌ Cloud notes without encryption

### Step 4.2: Using Backup Code

**If you lose access to authenticator device:**

1. **VPN connection prompt appears: "Enter MFA Code"**

2. **Select "Backup Code"** option (if available) or use menu

3. **Enter one backup code** (e.g., 12345-ABC12)

4. **Connection established**

5. **Important:** Re-setup TOTP on new device immediately after

### Step 4.3: Re-Setup TOTP (New Device or Lost Phone)

**If your authenticator device is lost/stolen:**

1. **Contact Pritunl administrator** (infrastructure lead)

2. **Admin navigates to user management in Pritunl:**
   - Select user account
   - Reset MFA settings

3. **User receives new QR code** and repeats [Step 2.3 - 2.5](#step-24-scan-qr-code-in-authenticator-app)

---

## PART 5: TEAM MEMBER ONBOARDING CHECKLIST

**Use this checklist for each new team member:**

### Phase 1: Account Creation
- [ ] Create Pritunl user account (admin)
- [ ] Assign to appropriate group (backend, smartcontract, devops, etc.)
- [ ] Set initial password (temporary)
- [ ] Send user account setup instructions (this document)

### Phase 2: User Setup
- [ ] User downloads VPN profile from portal
- [ ] User downloads and installs authenticator app
- [ ] User scans QR code in Pritunl portal
- [ ] User verifies MFA setup with 6-digit code
- [ ] Pritunl confirms MFA enabled

### Phase 3: VPN Client Setup
- [ ] User downloads VPN client (OpenVPN/WireGuard)
- [ ] User imports VPN profile
- [ ] User performs test connection with MFA code
- [ ] Connection successful (shows "Connected")

### Phase 4: Verification
- [ ] User can reach staging.kindswap.world (VPN-only)
- [ ] User can reach kindswap.world (public, but verify routing)
- [ ] User can reach admin.kindswap.world (VPN-only)
- [ ] User receives backup codes and stores securely

### Phase 5: Documentation
- [ ] User bookmarks Pritunl portal URL
- [ ] User saves this document for future reference
- [ ] User has infrastructure team contact info
- [ ] User completes security awareness training

---

## TROUBLESHOOTING

### Issue 1: "Invalid TOTP Code" Error

**Symptom:** Entering code from Authenticator returns "Invalid" or "Expired"

**Causes:**
1. Device time is out of sync with server
2. Typing code too slowly after 30-second expiration
3. Incorrect account scanned (MFA disabled on this user)

**Solutions:**
```
1. Sync device time:
   - iPhone/iPad: Settings → General → Date & Time → Toggle "Set Automatically" OFF then ON
   - Android: Settings → System → Date & time → Toggle "Use network-provided time" OFF then ON
   - Computer: Set system time to NTP server
   
2. Type faster:
   - Enter code within 15-20 seconds of reading (not at 25+ seconds)
   - If code expires, wait for next one
   
3. Verify MFA enabled:
   - Log into user portal
   - Check that MFA shows "Enabled" status
```

### Issue 2: QR Code Won't Scan

**Symptom:** Camera won't recognize QR code, or app doesn't scan

**Solutions:**
```
1. Ensure good lighting (natural light preferred)
2. Hold phone 6-8 inches from screen
3. Keep phone level (not at angle)
4. Use "Enter setup key manually" instead:
   - Select "Can't scan?" in app
   - Type manual key (e.g., JBSWY3DPEBLW64TMMQ======)
   - Select TOTP type
   - Enter Pritunl as account name
```

### Issue 3: Lost Authenticator Device (Phone Stolen/Lost)

**Solution:** Use backup code
```
1. When VPN prompt appears, select "Backup Code" option
2. Enter one saved backup code
3. Contact infrastructure immediately for MFA reset
4. Re-setup TOTP on new device using new QR code
```

### Issue 4: VPN Client Won't Prompt for MFA

**Symptom:** Connect button clicked but no MFA prompt appears

**Causes:**
1. VPN profile doesn't have MFA enabled
2. VPN client app is outdated

**Solutions:**
```
1. Delete and re-download VPN profile from Pritunl portal
2. Delete old profile from VPN client
3. Import fresh profile
4. Try connecting again

OR

1. Update VPN client:
   - OpenVPN: Visit openvpn.net and download latest
   - WireGuard: Update via package manager or App Store
2. Re-import profile
3. Try connecting again
```

### Issue 5: Time Zone Mismatch (Long Connections)

**Symptom:** Using VPN from different time zone; codes don't work

**Important:** TOTP is UTC-based, NOT local time

**Solution:**
```
✓ Your phone and computer time should be synchronized to UTC (or automatic NTP)
✓ Do NOT manually change time zone in authenticator app
✓ Keep "Automatic date & time" enabled on all devices
✓ TOTP will work correctly regardless of your location
```

---

## SECURITY BEST PRACTICES

### ✅ DO:
- ✅ Enable backup code storage in password manager
- ✅ Use "Automatic date & time" on all devices
- ✅ Regenerate backup codes quarterly
- ✅ Report lost/stolen devices immediately to infrastructure
- ✅ Use strong VPN profile passwords (25+ chars, mixed case, symbols, numbers)

### ❌ DON'T:
- ❌ Screenshot TOTP codes (keep only in authenticator app)
- ❌ Take photos of QR codes (difficult to recreate if lost)
- ❌ Store backup codes in unencrypted email
- ❌ Share TOTP secret/codes with others
- ❌ Use generic Authenticator account names (use "Pritunl kindswap" not just "work")

---

## FAQ

**Q: Can I use the same Authenticator account on multiple devices?**  
A: Yes, if using Authy or other cloud-sync apps. Google Authenticator doesn't sync automatically.

**Q: What if my phone breaks and I can't get my codes?**  
A: Use one of your backup codes. Then contact infrastructure to reset MFA.

**Q: How often do TOTP codes change?**  
A: Every 30 seconds. Each code is valid for its time window only.

**Q: Can I turn off MFA after it's enabled?**  
A: No - MFA is enforced by Pritunl policy and cannot be disabled by users.

**Q: What if I'm offline - can I still use VPN?**  
A: TOTP works offline (phone generates codes based on internal clock). VPN connection needs internet obviously.

**Q: Is TOTP more secure than SMS codes?**  
A: Yes. TOTP (RFC 6238) is mathematically secure. SMS codes are vulnerable to SIM swap attacks.

---

## SUPPORT

**For MFA/VPN issues, contact:**
- Pritunl Admin: [See SECRET_MANAGEMENT.md for admin contact]
- Infrastructure Team: infrastructure@kindswap.world

**Escalation (Security Incident):**
- Device lost/stolen: Contact immediately, notify security team
- Backup codes compromised: Request MFA reset

---

*Last Updated: March 28, 2026*  
*Document Status: Draft for Team Review*  
*MFA Standard: RFC 6238 TOTP (Time-based One-Time Password)*
