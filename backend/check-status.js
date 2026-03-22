/**
 * Backend Status Checker
 * Verifies all required configuration and dependencies
 * Run: node check-status.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Backend Setup...\n');

let allGood = true;

// Check 1: .env file exists
console.log('1️⃣  Checking .env file...');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('   ✅ .env file exists');

  // Read and check critical variables
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars = envContent.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, value] = line.split('=');
      if (key && value) acc[key.trim()] = value.trim();
      return acc;
    }, {});

  // Check Super Admin Wallet
  if (envVars.SUPER_ADMIN_WALLET && envVars.SUPER_ADMIN_WALLET.length > 30) {
    console.log('   ✅ SUPER_ADMIN_WALLET is configured');
  } else {
    console.log('   ❌ SUPER_ADMIN_WALLET is missing or invalid');
    allGood = false;
  }

  // Check Database Config
  const dbVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingDbVars = dbVars.filter(v => !envVars[v]);
  if (missingDbVars.length === 0) {
    console.log('   ✅ Database configuration complete');
  } else {
    console.log(`   ⚠️  Missing database vars: ${missingDbVars.join(', ')}`);
  }
} else {
  console.log('   ❌ .env file not found');
  console.log('   💡 Copy .env.example to .env and configure it');
  allGood = false;
}

console.log('');

// Check 2: node_modules installed
console.log('2️⃣  Checking dependencies...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('   ✅ node_modules exists');
} else {
  console.log('   ❌ node_modules not found');
  console.log('   💡 Run: npm install');
  allGood = false;
}

console.log('');

// Check 3: Critical files exist
console.log('3️⃣  Checking critical files...');
const criticalFiles = [
  'src/database/entities/admin.entity.ts',
  'src/database/repositories/admin.repository.ts',
  'src/api/dto/admin.dto.ts',
  'src/api/services/admin.service.ts',
  'src/api/controllers/admin.controller.ts',
  'src/api/guards/admin.guard.ts',
  'src/api/guards/super-admin.guard.ts',
  'src/api/admin.module.ts',
  'src/database/seed-admin.ts',
];

const missingFiles = criticalFiles.filter(file => !fs.existsSync(path.join(__dirname, file)));
if (missingFiles.length === 0) {
  console.log('   ✅ All critical RBAC files exist');
} else {
  console.log('   ❌ Missing files:');
  missingFiles.forEach(file => console.log(`      - ${file}`));
  allGood = false;
}

console.log('');

// Check 4: Build output
console.log('4️⃣  Checking build output...');
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log('   ✅ dist/ folder exists (build successful)');
} else {
  console.log('   ⚠️  dist/ folder not found');
  console.log('   💡 Run: npm run build');
}

console.log('');

// Check 5: Package.json scripts
console.log('5️⃣  Checking npm scripts...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
const requiredScripts = ['start:dev', 'build', 'seed:admin'];
const missingScripts = requiredScripts.filter(s => !packageJson.scripts[s]);
if (missingScripts.length === 0) {
  console.log('   ✅ All required npm scripts exist');
  console.log('      - npm run start:dev ✓');
  console.log('      - npm run build ✓');
  console.log('      - npm run seed:admin ✓');
} else {
  console.log(`   ❌ Missing scripts: ${missingScripts.join(', ')}`);
  allGood = false;
}

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Final summary
if (allGood) {
  console.log('✅ All checks passed! Ready to start.');
  console.log('');
  console.log('📋 Next steps:');
  console.log('   1. Start the server: npm run start:dev');
  console.log('   2. Wait for "Nest application successfully started"');
  console.log('   3. Run seed script: npm run seed:admin');
  console.log('   4. Test endpoints (see verify-setup.md)');
  console.log('');
} else {
  console.log('❌ Some checks failed. Please fix the issues above.');
  console.log('');
  console.log('📋 Quick fixes:');
  console.log('   - Missing .env? Copy .env.example to .env');
  console.log('   - Missing dependencies? Run: npm install');
  console.log('   - Missing files? Ensure RBAC implementation is complete');
  console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
