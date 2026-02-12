// Exemples d'utilisation de l'API MCP

const API_BASE = 'http://localhost:3000/api/v1/mcp'
const API_KEY = 'mcp-default-key-12345'

// Exemple 1: Lister les outils disponibles
async function listTools() {
  const response = await fetch(`${API_BASE}/tools`, {
    headers: {
      'x-api-key': API_KEY
    }
  })

  const data = await response.json()
  console.log('Outils disponibles:', data.tools.map((t: { name: string }) => t.name))
}

// Exemple 2: Envoyer un email
async function sendEmail() {
  const response = await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      toolId: 'email',
      args: {
        to: 'recipient@example.com',
        subject: 'Email from MCP API',
        body: 'Hello! This email was sent using the MCP API.'
      }
    })
  })

  const data = await response.json()
  console.log('Email sent:', data.result)
}

// Exemple 3: Créer une page Notion
async function createNotionPage() {
  const response = await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      toolId: 'notion',
      args: {
        title: 'New Page from API',
        content: 'This page was created using the MCP API',
        parentId: 'optional-parent-id'
      }
    })
  })

  const data = await response.json()
  console.log('Notion page created:', data.result.url)
}

// Exemple 4: Exécution asynchrone
async function asyncExecution() {
  const response = await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      toolId: 'github',
      args: {
        owner: 'myuser',
        repo: 'myrepo',
        action: 'create_issue',
        data: {
          title: 'Issue created from API',
          body: 'This issue was created using the MCP API'
        }
      },
      async: true
    })
  })

  const data = await response.json()
  console.log('Job queued:', data.jobId)

  // Vérifier le statut
  const statusResponse = await fetch(`${API_BASE}/queue/${data.jobId}`, {
    headers: {
      'x-api-key': API_KEY
    }
  })

  const status = await statusResponse.json()
  console.log('Job status:', status.status)
}

// Exemple 5: Batch execution
async function batchExecution() {
  const tools = [
    {
      toolId: 'email',
      args: {
        to: 'user1@example.com',
        subject: 'Batch Email 1',
        body: 'First email'
      }
    },
    {
      toolId: 'email',
      args: {
        to: 'user2@example.com',
        subject: 'Batch Email 2',
        body: 'Second email'
      }
    }
  ]

  const promises = tools.map(tool =>
    fetch(`${API_BASE}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(tool)
    })
  )

  const responses = await Promise.all(promises)
  const results = await Promise.all(responses.map(r => r.json()))

  console.log('Batch results:', results.map(r => r.result))
}

// Exemple 6: Monitoring
async function getMetrics() {
  const response = await fetch(`${API_BASE}/metrics?period=day`, {
    headers: {
      'x-api-key': API_KEY
    }
  })

  const data = await response.json()
  console.log('System metrics:', data.systemStats)
  console.log('Top tools:', data.topTools.slice(0, 5))
  console.log('Error analysis:', data.errorAnalysis.byType.slice(0, 5))
}

// Exemple 7: Health check
async function healthCheck() {
  const response = await fetch(`${API_BASE}/health`)
  const data = await response.json()

  console.log('Health status:', data.status)
  console.log('Services:', data.services)
  console.log('Performance:', data.performance)
}

// Exemple 8: Error handling
async function robustExecution() {
  try {
    const response = await fetch(`${API_BASE}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        toolId: 'nonexistent-tool',
        args: {}
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('API Error:', error.error)

      if (response.status === 429) {
        console.log('Rate limited - implement retry logic')
      } else if (response.status === 400) {
        console.log('Validation error:', error.details)
      }
    }
  } catch (error) {
    console.error('Network error:', error)
  }
}

// Exemple 9: Authentification JWT
async function jwtAuthentication() {
  // 1. Obtenir un JWT token (simulation)
  const jwtToken = 'your-jwt-token-here'

  const response = await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({
      toolId: 'email',
      args: {
        to: 'jwt@example.com',
        subject: 'JWT Auth Test',
        body: 'This email was sent using JWT authentication'
      }
    })
  })

  const data = await response.json()
  console.log('JWT result:', data.result)
}

// Exemple 10: Webhook handling (pour les outils qui supportent les webhooks)
async function webhookExample() {
  // Configuration d'un webhook pour les jobs asynchrones
  const webhookUrl = 'https://your-app.com/webhook/mcp'

  const response = await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      toolId: 'github',
      args: {
        owner: 'myuser',
        repo: 'myrepo',
        action: 'issues'
      },
      async: true,
      webhook: webhookUrl
    })
  })

  const data = await response.json()
  console.log('Webhook configured for job:', data.jobId)
}

// Exemple d'utilisation
async function main() {
  console.log('🚀 MCP API Examples\n')

  try {
    await listTools()
    console.log('')

    await sendEmail()
    console.log('')

    await createNotionPage()
    console.log('')

    await healthCheck()
    console.log('')

    await getMetrics()
    console.log('')

  } catch (error) {
    console.error('Error:', error)
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main()
}

export {
  listTools,
  sendEmail,
  createNotionPage,
  asyncExecution,
  batchExecution,
  getMetrics,
  healthCheck,
  robustExecution,
  jwtAuthentication,
  webhookExample
}
