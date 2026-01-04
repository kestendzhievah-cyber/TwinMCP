#!/usr/bin/env node

// Script de vérification rapide de l'API MCP
const https = require('https')
const http = require('http')

const API_BASE = 'http://localhost:3000/api/v1/mcp'
const API_KEY = 'mcp-default-key-12345'

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http

    const req = client.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        ...options.headers
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          })
        } catch {
          resolve({
            status: res.statusCode,
            data
          })
        }
      })
    })

    req.on('error', reject)

    if (options.body) {
      req.write(JSON.stringify(options.body))
    }
    req.end()
  })
}

async function testAPI() {
  console.log('🧪 Test de l\'API MCP...\n')

  try {
    // 1. Health Check
    console.log('🔍 1. Health Check')
    const health = await makeRequest(`${API_BASE}/health`)
    console.log(`   Status: ${health.status} ${health.status === 200 ? '✅' : '❌'}`)
    if (health.status === 200) {
      console.log(`   Version: ${health.data.apiVersion}`)
      console.log(`   Registry: ${health.data.services.registry.status}`)
    }
    console.log('')

    // 2. Liste des outils
    console.log('📋 2. Liste des outils')
    const tools = await makeRequest(`${API_BASE}/tools`)
    console.log(`   Status: ${tools.status} ${tools.status === 200 ? '✅' : '❌'}`)
    if (tools.status === 200) {
      console.log(`   Total: ${tools.data.totalCount} outils`)
      console.log(`   Outils: ${tools.data.tools.map(t => t.name).join(', ')}`)
    }
    console.log('')

    // 3. Test Email
    console.log('📧 3. Test Email')
    const email = await makeRequest(`${API_BASE}/execute`, {
      method: 'POST',
      body: {
        toolId: 'email',
        args: {
          to: 'test@example.com',
          subject: 'Test API MCP',
          body: 'Email envoyé via l\'API MCP !'
        }
      }
    })
    console.log(`   Status: ${email.status} ${email.status === 200 ? '✅' : '❌'}`)
    if (email.status === 200) {
      console.log(`   Message ID: ${email.data.result.messageId}`)
      console.log(`   Cache hit: ${email.data.metadata.cacheHit}`)
    }
    console.log('')

    // 4. Test Calendar
    console.log('📅 4. Test Calendar')
    const calendar = await makeRequest(`${API_BASE}/execute`, {
      method: 'POST',
      body: {
        toolId: 'calendar',
        args: {
          startDate: '2024-01-01',
          endDate: '2024-01-07'
        }
      }
    })
    console.log(`   Status: ${calendar.status} ${calendar.status === 200 ? '✅' : '❌'}`)
    if (calendar.status === 200) {
      console.log(`   Événements: ${calendar.data.result.events.length}`)
    }
    console.log('')

    // 5. Test GitHub
    console.log('🐙 5. Test GitHub')
    const github = await makeRequest(`${API_BASE}/execute`, {
      method: 'POST',
      body: {
        toolId: 'github',
        args: {
          owner: 'octocat',
          repo: 'Hello-World',
          action: 'issues'
        }
      }
    })
    console.log(`   Status: ${github.status} ${github.status === 200 ? '✅' : '❌'}`)
    if (github.status === 200) {
      console.log(`   Issues: ${github.data.result.issues.length}`)
    }
    console.log('')

    // 6. Métriques
    console.log('📊 6. Métriques')
    const metrics = await makeRequest(`${API_BASE}/metrics?period=day`)
    console.log(`   Status: ${metrics.status} ${metrics.status === 200 ? '✅' : '❌'}`)
    if (metrics.status === 200) {
      console.log(`   Exécutions: ${metrics.data.systemStats.totalExecutions}`)
      console.log(`   Taux succès: ${Math.round((1 - metrics.data.systemStats.errorRate) * 100)}%`)
    }
    console.log('')

    console.log('✅ Tests terminés !')
    console.log('\n📚 Documentation:')
    console.log('   - README-MCP.md (documentation complète)')
    console.log('   - README-IMPLEMENTATION.md (guide technique)')
    console.log('   - README-SUCCESS.md (résumé accomplissements)')
    console.log('\n🧪 Tests:')
    console.log('   - npm test (tests unitaires)')
    console.log('   - npm run test:coverage (coverage)')
    console.log('\n🚀 API:')
    console.log(`   - Base URL: ${API_BASE}`)
    console.log(`   - API Key: ${API_KEY}`)

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message)
    console.log('\n💡 Assurez-vous que le serveur MCP est démarré:')
    console.log('   npm run dev')
  }
}

// Exécuter les tests si appelé directement
if (require.main === module) {
  testAPI()
}

module.exports = { testAPI, makeRequest }
