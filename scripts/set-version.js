#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Get git commit hash
  const gitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

  console.log(`Setting version to: ${gitHash.slice(0, 7)}`);

  // Write to .env.local for Next.js build
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = '';

  // Read existing .env.local if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    // Remove any existing NEXT_PUBLIC_GIT_COMMIT line
    envContent = envContent.split('\n').filter(line => !line.startsWith('NEXT_PUBLIC_GIT_COMMIT=')).join('\n');
  }

  // Append new value
  envContent += `\nNEXT_PUBLIC_GIT_COMMIT=${gitHash}\n`;

  fs.writeFileSync(envPath, envContent);
  console.log(`Version written to .env.local`);
} catch (error) {
  console.error('Error setting version:', error.message);
  // Don't fail the build if git is not available
  console.log('Continuing without version...');
}
