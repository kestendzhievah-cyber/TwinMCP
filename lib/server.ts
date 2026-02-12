import express, { Request, Response } from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

// Configuration pour ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes API
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    message: 'TwinMCP Express Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

app.get('/api/agents', (req: Request, res: Response) => {
  res.json({
    agents: [
      {
        id: 1,
        name: 'Support Agent',
        status: 'active',
        model: 'gpt-4',
        conversations: 1250
      },
      {
        id: 2,
        name: 'Sales Agent',
        status: 'active',
        model: 'claude-3',
        conversations: 890
      }
    ],
    total: 2
  })
})

app.post('/api/agents', (req: Request, res: Response): void => {
  const { name, type, model } = req.body

  if (!name || !type) {
    res.status(400).json({
      error: 'Name and type are required'
    })
    return
  }

  res.json({
    success: true,
    agent: {
      id: Date.now(),
      name,
      type,
      model: model || 'gpt-4',
      status: 'created',
      createdAt: new Date().toISOString()
    }
  })
})

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 TwinMCP Express Server running on http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`)
  console.log(`🤖 Agents API: http://localhost:${PORT}/api/agents`)
})
