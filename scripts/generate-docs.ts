import { writeFileSync } from 'fs'
import { join } from 'path'
import { docsGenerator } from '../lib/mcp/utils/docs-generator'

async function generateDocs() {
  console.log('📚 Generating MCP documentation...')

  try {
    // Générer la documentation Markdown
    const markdown = await docsGenerator.generateMarkdown()

    // Écrire dans le README
    writeFileSync(join(process.cwd(), 'README-MCP.md'), markdown)

    // Générer OpenAPI spec
    const openapi = await docsGenerator.generateOpenAPI()
    writeFileSync(
      join(process.cwd(), 'openapi-spec.json'),
      JSON.stringify(openapi, null, 2)
    )

    console.log('✅ Documentation generated successfully!')
    console.log('📄 README-MCP.md')
    console.log('📋 openapi-spec.json')

  } catch (error) {
    console.error('❌ Error generating documentation:', error)
    process.exit(1)
  }
}

generateDocs()
