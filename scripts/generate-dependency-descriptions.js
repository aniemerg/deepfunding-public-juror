#!/usr/bin/env node

/**
 * Generate human-readable descriptions from comprehensive dependency data
 */

const fs = require('fs')
const path = require('path')

const data = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../design/comprehensive_dependency_data.json'),
    'utf-8'
  )
)

/**
 * Generate a concise description from usage_summary
 */
function generateDescription(depUrl, usageSummary) {
  const parts = []

  // Start with usage class
  const usageClass = usageSummary.usage_class
  if (usageClass === 'Pervasive') {
    parts.push('Critical infrastructure used throughout the project.')
  } else if (usageClass === 'RuntimeFeature' || usageClass === 'FeatureFocused') {
    parts.push('Core runtime functionality.')
  } else if (usageClass === 'SinglePoint') {
    parts.push('Focused functionality for specific use cases.')
  } else if (usageClass === 'Utility') {
    parts.push('Utility providing specific features.')
  } else if (usageClass === 'DevExperience' || usageClass === 'Dev_experience') {
    parts.push('Development tooling and developer experience.')
  } else if (usageClass === 'Build Tooling' || usageClass === 'Build_tooling' || usageClass === 'build_tooling') {
    parts.push('Build and compilation tooling.')
  } else if (usageClass === 'test_support') {
    parts.push('Test support and testing infrastructure.')
  } else if (usageClass === 'Unused') {
    parts.push('Currently unused in the project.')
  } else if (usageClass) {
    parts.push(`${usageClass} dependency.`)
  }

  // Add primary role description
  if (usageSummary.usage_roles && usageSummary.usage_roles.length > 0) {
    const primaryRole = usageSummary.usage_roles[0]
    parts.push(primaryRole.description)
  }

  // Add context about where it's used
  const contexts = []
  if (usageSummary.appears_in_runtime_code) contexts.push('runtime')
  if (usageSummary.appears_in_test_code) contexts.push('tests')
  if (usageSummary.appears_in_build_or_docs) contexts.push('build/docs')

  if (contexts.length > 0) {
    parts.push(`Used in ${contexts.join(', ')}.`)
  }

  return parts.join(' ')
}

/**
 * Generate detailed info for expandable section
 */
function generateDetailedInfo(usageSummary) {
  const details = {
    usageClass: usageSummary.usage_class,
    contexts: [],
    responsibilities: usageSummary.responsibilities_provided_by_dependency || [],
    roles: usageSummary.usage_roles?.map(r => r.role_name) || []
  }

  if (usageSummary.appears_in_runtime_code) details.contexts.push('Runtime code')
  if (usageSummary.appears_in_test_code) details.contexts.push('Test code')
  if (usageSummary.appears_in_build_or_docs) details.contexts.push('Build/Docs')

  return details
}

// Test on various repositories and dependencies
const examples = [
  {
    repo: 'https://github.com/ethereum/go-ethereum',
    deps: [
      'https://github.com/holiman/uint256',
      'https://github.com/cockroachdb/pebble',
      'https://github.com/consensys/gnark-crypto',
      'https://github.com/cespare/cp'
    ]
  },
  {
    repo: 'https://github.com/0xmiden/miden-vm',
    deps: [
      'https://github.com/0xpolygonmiden/crypto',
      'https://github.com/blake3-team/blake3',
      'https://github.com/dtolnay/thiserror'
    ]
  },
  {
    repo: 'https://github.com/a16z/helios',
    deps: [
      'https://github.com/tokio-rs/bytes',
      'https://github.com/dotenv-rs/dotenv',
      'https://github.com/detegr/rust-ctrlc'
    ]
  }
]

console.log('='.repeat(80))
console.log('DEPENDENCY DESCRIPTION GENERATION EXAMPLES')
console.log('='.repeat(80))
console.log()

for (const example of examples) {
  const repoData = data.repositories[example.repo]
  if (!repoData) {
    console.log(`⚠️  Repository not found: ${example.repo}`)
    continue
  }

  console.log(`\n📦 PARENT: ${repoData.repo_summary.name}`)
  console.log(`Purpose: ${repoData.repo_summary.purpose}`)
  console.log('\n' + '-'.repeat(80))

  for (const depUrl of example.deps) {
    const dep = repoData.dependencies[depUrl]
    if (!dep) {
      console.log(`\n❌ Dependency not found: ${depUrl}`)
      continue
    }

    const depName = depUrl.replace('https://github.com/', '')

    console.log(`\n🔧 DEPENDENCY: ${depName}`)
    console.log(`Weight: ${dep.weight.toFixed(6)} (Rank #${dep.weight_rank})`)
    console.log()
    console.log('GENERATED DESCRIPTION:')
    console.log(`  ${generateDescription(depUrl, dep.usage_summary)}`)
    console.log()

    const details = generateDetailedInfo(dep.usage_summary)
    console.log('EXPANDABLE DETAILS:')
    console.log(`  Usage Type: ${details.usageClass}`)
    console.log(`  Used in: ${details.contexts.join(', ')}`)

    if (details.roles.length > 0) {
      console.log(`  Roles:`)
      details.roles.forEach(role => console.log(`    • ${role}`))
    }

    if (details.responsibilities.length > 0 && details.responsibilities.length <= 3) {
      console.log(`  Key Responsibilities:`)
      details.responsibilities.forEach(resp => {
        const shortened = resp.length > 100 ? resp.substring(0, 97) + '...' : resp
        console.log(`    • ${shortened}`)
      })
    }

    console.log()
  }

  console.log('\n' + '='.repeat(80))
}
