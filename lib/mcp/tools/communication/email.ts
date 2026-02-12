import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { z } from 'zod'
import { MCPTool, ValidationResult, ExecutionResult } from '../../core'
import { getCache } from '../../core'
import { rateLimiter } from '../../middleware'
import { getMetrics } from '../../utils'

const sendEmailSchema = z.object({
  to: z.string().email('Invalid email format'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  from: z.string().email().optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(),
    type: z.string()
  })).optional()
})

export class EmailTool implements MCPTool {
  id = 'email'
  name = 'Send Email'
  version = '1.0.0'
  category: 'communication' = 'communication'
  description = 'Send emails via Gmail or SMTP with advanced features'
  author = 'MCP Team'
  tags = ['email', 'gmail', 'smtp', 'communication']
  // Configuration OAuth2
  requiredConfig = [
    'email_credentials.client_id',
    'email_credentials.client_secret',
    'email_credentials.refresh_token',
    'email_credentials.email'
  ]
  optionalConfig = [
    'email_credentials.access_token',
    'email_credentials.name',
    'smtp_host', 
    'smtp_port', 
    'default_from'
  ]
  inputSchema = sendEmailSchema
  // Ajoutez ces propriétés manquantes
  capabilities = {
    async: false,
    batch: true,
    streaming: false,
    webhook: false
  }
  rateLimit = {
    requests: 100,
    period: '1h',
    strategy: 'sliding' as const
  }
  cache = {
    enabled: true,
    ttl: 300, // 5 minutes
    key: (args: any) => `email:${args.to}:${args.subject}`,
    strategy: 'memory' as const
  }

  async validate(args: any): Promise<ValidationResult> {
    try {
      const validated = await this.inputSchema.parseAsync(args)
      return { success: true, data: validated }
    } catch (error: any) {
      return {
        success: false,
        errors: error.errors?.map((e: z.ZodIssue) => ({
          path: e.path.join('.'),
          message: e.message
        })) || [{ path: 'unknown', message: 'Validation failed' }]
      }
    }
  }

  async beforeExecute(args: any): Promise<any> {
    console.log(`📧 Preparing to send email to ${args.to}`)
    return args
  }

  async afterExecute(result: ExecutionResult): Promise<ExecutionResult> {
    if (result.success) {
      console.log(`✅ Email sent successfully to ${result.data?.to}`)
    }
    return result
  }

  async onError(error: Error): Promise<void> {
    console.error(`❌ Email error: ${error.message}`)
  }

  async execute(args: any, config: any): Promise<ExecutionResult> {
    const startTime = Date.now()

    try {
      // Execute before hook
      await this.beforeExecute(args)

      // Validation des arguments
      const validation = await this.validate(args)
      if (!validation.success) {
        throw new Error(`Validation failed: ${validation.errors?.map(e => e.message).join(', ')}`)
      }

      // Vérifier les rate limits
      const userLimit = await rateLimiter.checkUserLimit(config.userId || 'anonymous', this.id, config.rateLimit || {})
      if (!userLimit) {
        throw new Error('Rate limit exceeded for email tool')
      }

      // Vérifier le cache
      const cache = getCache()
      const cacheKey = this.cache!.key(args)
      const cachedResult = await cache.get(cacheKey)

      if (cachedResult) {
        console.log(`📧 Email cache hit for ${args.to}`)
        getMetrics().track({
          toolId: this.id,
          userId: config.userId || 'anonymous',
          timestamp: new Date(),
          executionTime: Date.now() - startTime,
          cacheHit: true,
          success: true,
          apiCallsCount: 0,
          estimatedCost: 0
        })

        return {
          success: true,
          data: cachedResult,
          metadata: {
            executionTime: Date.now() - startTime,
            cacheHit: true,
            apiCallsCount: 0,
            cost: 0
          }
        }
      }

      // Envoi de l'email
      const result = await this.sendEmail(args, config)

      // Mettre en cache
      await cache.set(cacheKey, result, this.cache!.ttl)

      // Tracker les métriques
      getMetrics().track({
        toolId: this.id,
        userId: config.userId || 'anonymous',
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        cacheHit: false,
        success: true,
        apiCallsCount: 1,
        estimatedCost: 0.001 // Coût estimé par email
      })

      const execResult: ExecutionResult = {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          apiCallsCount: 1,
          cost: 0.001
        }
      }

      // Execute after hook
      return await this.afterExecute(execResult)

    } catch (error: any) {
      const executionTime = Date.now() - startTime

      getMetrics().track({
        toolId: this.id,
        userId: config.userId || 'anonymous',
        timestamp: new Date(),
        executionTime,
        cacheHit: false,
        success: false,
        errorType: error.name || 'EmailError',
        apiCallsCount: 1,
        estimatedCost: 0
      })

      return {
        success: false,
        error: error.message,
        metadata: {
          executionTime,
          cacheHit: false,
          apiCallsCount: 1,
          cost: 0
        }
      }
    }
  }

  private async sendEmail(args: any, config: any): Promise<any> {
    const creds = config.email_credentials
    if (creds?.client_id && creds?.client_secret && creds?.refresh_token) {
      // Real Gmail OAuth2 send
      try {
        const oauth2Client = new google.auth.OAuth2(
          creds.client_id,
          creds.client_secret,
          'https://developers.google.com/oauthplayground'
        );
        oauth2Client.setCredentials({
          refresh_token: creds.refresh_token,
          access_token: creds.access_token
        });
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: creds.email,
            clientId: creds.client_id,
            clientSecret: creds.client_secret,
            refreshToken: creds.refresh_token,
            accessToken: (await oauth2Client.getAccessToken()).token!
          }
        });
        const mailOptions = {
          from: args.from || `"${creds.name || 'MCP'}" <${creds.email}>`,
          to: args.to,
          subject: args.subject,
          text: args.body,
          html: `<div>${args.body}</div>`,
          cc: args.cc,
          bcc: args.bcc,
          attachments: args.attachments?.map((a: any) => ({
            filename: a.filename,
            content: Buffer.from(a.content, 'base64'),
            contentType: a.type
          }))
        };
        const info = await transporter.sendMail(mailOptions);
        return {
          messageId: info.messageId,
          to: args.to,
          subject: args.subject,
          status: 'sent',
          timestamp: new Date().toISOString(),
          provider: 'gmail',
          _simulation: false,
          metadata: {
            size: args.body.length,
            attachments: args.attachments?.length || 0,
            priority: args.priority || 'normal',
            response: info.response
          }
        };
      } catch (error: any) {
        console.error('Erreur lors de l\'envoi de l\'email:', error);
        throw new Error(`Échec de l'envoi de l'email: ${error.message}`);
      }
    }

    // Simulation mode — no real email sent
    return {
      messageId: `sim_${Date.now()}@twinmcp.local`,
      to: args.to,
      subject: args.subject,
      status: 'sent',
      timestamp: new Date().toISOString(),
      provider: 'simulation',
      _simulation: true,
      _note: 'Set email_credentials in config for real Gmail OAuth2 integration',
      metadata: {
        size: args.body.length,
        attachments: args.attachments?.length || 0,
        priority: args.priority || 'normal'
      }
    }
  }
}