import express from 'express'
import type { Request, Response } from 'express'

// Créer une instance Express pour les API personnalisées
const app = express()

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes d'exemple
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    message: 'TwinMCP API is running',
    timestamp: new Date().toISOString()
  })
})

app.get('/api/agents/status', (req: Request, res: Response) => {
  res.json({
    agents: [
      { id: 1, name: 'Support Agent', status: 'active' },
      { id: 2, name: 'Sales Agent', status: 'active' },
      { id: 3, name: 'Analytics Agent', status: 'idle' }
    ],
    total: 3
  })
})

app.post('/api/agents/create', (req: Request, res: Response): void => {
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
      status: 'creating',
      createdAt: new Date().toISOString()
    }
  })
})

// Export pour utilisation dans Next.js
export default app
export { app as expressApp }
