# Sentry Setup Guide

## Overview

This project now has enhanced Sentry error tracking with:
- ✅ Source maps enabled for accurate error locations
- ✅ Browser extension error filtering
- ✅ Automated source map uploads to Sentry

## Configuration Steps

### 1. Get Your Sentry Auth Token

1. Go to [Sentry.io](https://sentry.io)
2. Navigate to **Settings** → **Account** → **API** → **Auth Tokens**
3. Click **"Create New Token"**
4. Configure the token:
   - **Name**: `kindswap-frontend-sourcemaps`
   - **Scopes**: Check these boxes:
     - ✅ `project:read`
     - ✅ `project:releases`
     - ✅ `org:read`
   - Click **"Create Token"**
5. Copy the token (you won't see it again!)

### 2. Configure `.sentryclirc`

Edit the `.sentryclirc` file in the project root:

```ini
[defaults]
url=https://sentry.io/
org=your-org-slug           # ← Replace with your Sentry org slug
project=kindswap-frontend   # ← Verify this matches your project name

[auth]
token=YOUR_SENTRY_AUTH_TOKEN  # ← Paste your token here
```

**To find your org slug:**
- Go to Sentry dashboard
- Your URL looks like: `https://sentry.io/organizations/YOUR-ORG-SLUG/`
- Copy the `YOUR-ORG-SLUG` part

**To find your project name:**
- Go to **Settings** → **Projects**
- Find "kindswap-frontend" (or whatever you named it)
- Use that exact name in the config

### 3. Alternative: Use Environment Variables

Instead of storing the token in `.sentryclirc`, you can use environment variables:

```bash
# Linux/Mac
export SENTRY_AUTH_TOKEN="your-token-here"
export SENTRY_ORG="your-org-slug"
export SENTRY_PROJECT="kindswap-frontend"

# Windows PowerShell
$env:SENTRY_AUTH_TOKEN="your-token-here"
$env:SENTRY_ORG="your-org-slug"
$env:SENTRY_PROJECT="kindswap-frontend"

# Windows CMD
set SENTRY_AUTH_TOKEN=your-token-here
set SENTRY_ORG=your-org-slug
set SENTRY_PROJECT=kindswap-frontend
```

If using environment variables, you can leave `.sentryclirc` as-is.

### 4. Update Package Version (Optional)

Edit `package.json` to set a proper version for release tracking:

```json
{
  "version": "1.0.0"  // ← Update this for each release
}
```

The release will be tracked in Sentry as: `kindswap-frontend@1.0.0`

## Build Commands

### Development Build (No Source Maps)
```bash
npm run build:dev
```
- Fast build for testing
- No source maps uploaded

### Production Build (With Source Maps)
```bash
npm run build:prod
```
- Builds the app
- Generates source maps
- Uploads source maps to Sentry
- Use this for deployments!

### Regular Build
```bash
npm run build
```
- Just builds the app (no Sentry upload)

## Verification

After running `npm run build:prod`, you should see:

```
✓ built in X.XXs
> Injecting source maps...
✓ Source maps injected
> Uploading source maps...
✓ Uploaded X source maps
```

Then in Sentry:
1. Go to **Settings** → **Projects** → **kindswap-frontend** → **Source Maps**
2. You should see your release: `kindswap-frontend@X.X.X`
3. Click on it to verify all files are uploaded

## What Changed

### Files Modified

1. **[vite.config.ts](./vite.config.ts)**
   - Enabled `sourcemap: true` for production builds
   - Source content included in maps for better debugging

2. **[src/main.tsx](./src/main.tsx)**
   - Enhanced error filtering (lines 65-112)
   - Filters out:
     - Browser extension errors
     - Backbone.js errors (from extensions)
     - Phantom Sentry paths
     - Network failures
     - ResizeObserver loops

3. **[package.json](./package.json)**
   - Added `@sentry/cli` dependency
   - Added `build:prod` script
   - Added `sentry:sourcemaps` script

4. **[.sentryclirc](./.sentryclirc)** (New)
   - Sentry CLI configuration
   - **IMPORTANT**: Add to `.gitignore` (already done)

5. **[.gitignore](./.gitignore)**
   - Added `.sentryclirc` to prevent token leaks

## Expected Results

After deployment:

### Before (Current State)
```
❌ Error: Object has no method 'updateFrom'
   at ../../sentry/scripts/views.js:389
```
- Fake file path
- Can't debug
- No idea what's causing it

### After (With Source Maps)
```
✅ Error: [Filtered - Browser Extension]
   Backbone.js error from extension detected
```
OR if it's a real error in your code:
```
✅ Error: Actual error message
   at src/components/YourComponent.tsx:42
```
- Real file path
- Can click through to source
- Actual debugging context

## CI/CD Integration

If you're using GitHub Actions or similar:

```yaml
- name: Build and upload source maps
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: your-org-slug
    SENTRY_PROJECT: kindswap-frontend
  run: npm run build:prod
```

Store the token in your CI/CD secrets, not in the repo!

## Troubleshooting

### "Error: Invalid token" when uploading
- Double-check your token in `.sentryclirc`
- Make sure it has the right scopes (`project:releases`)
- Try regenerating the token

### Source maps not appearing in Sentry
- Verify the release name matches: `kindswap-frontend@X.X.X`
- Check that `package.json` version is updated
- Look for upload errors in build logs

### Still seeing the `updateFrom` error
- It takes one deploy cycle to filter it out
- Check browser console for `[Sentry] Filtered...` messages
- If it persists with a real file path, investigate that file

### Build is slower now
- Source maps add ~10-30 seconds to build time
- Only use `build:prod` for actual deployments
- Use `build:dev` for local testing

## Support

- **Sentry Docs**: https://docs.sentry.io/platforms/javascript/sourcemaps/
- **CLI Docs**: https://docs.sentry.io/cli/
- **Error Analysis**: See [SENTRY_ERROR_ANALYSIS.md](../SENTRY_ERROR_ANALYSIS.md)

## Security Notes

⚠️ **NEVER commit `.sentryclirc` with a real token to git!**
- It's already in `.gitignore`
- Use environment variables in CI/CD
- Rotate tokens if accidentally exposed

✅ **Source maps are safe to upload to Sentry**
- Only your team can access them
- They help with debugging production errors
- Not exposed to end users
