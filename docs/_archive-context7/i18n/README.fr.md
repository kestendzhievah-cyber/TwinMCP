# TwinMCP MCP - Documentation à jour pour vos prompts

[![Site Web](https://img.shields.io/badge/Website-twinmcp.com-blue)](https://twinmcp.com) [![badge smithery](https://smithery.ai/badge/@upstash/twinmcp-mcp)](https://smithery.ai/server/@upstash/twinmcp-mcp) [<img alt="Installer dans VS Code (npx)" src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Installer%20TwinMCP%20MCP&color=0098FF">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)

## ❌ Sans TwinMCP

Les LLMs s’appuient sur des informations obsolètes ou génériques concernant les bibliothèques que vous utilisez. Vous obtenez :

- ❌ Des exemples de code obsolètes, basés sur des données d’entraînement vieilles d’un an
- ❌ Des APIs inventées qui n’existent même pas
- ❌ Des réponses génériques pour d’anciennes versions de packages

## ✅ Avec TwinMCP

TwinMCP MCP récupère la documentation et les exemples de code à jour, spécifiques à la version, directement à la source — et les place dans votre prompt.
Ajoutez `use twinmcp` à votre prompt dans Cursor :

```txt
Crée un projet Next.js basique avec app router. use twinmcp
```

```txt
Crée un script pour supprimer les lignes où la ville est "" avec des identifiants PostgreSQL. use twinmcp
```

TwinMCP apporte des exemples de code et de la documentation à jour directement dans le contexte de votre LLM.

- 1️⃣ Rédigez votre prompt naturellement
- 2️⃣ Dites au LLM `use twinmcp`
- 3️⃣ Obtenez des réponses de code qui fonctionnent
  Plus besoin de changer d’onglet, plus d’APIs inventées, plus de code obsolète.

## 🛠️ Démarrage

### Prérequis

- Node.js >= v18.0.0
- Cursor, Windsurf, Claude Desktop ou un autre client MCP

### Installation via Smithery

Pour installer TwinMCP MCP Server pour Claude Desktop automatiquement via [Smithery](https://smithery.ai/server/@upstash/twinmcp-mcp) :

```bash
npx -y @smithery/cli install @upstash/twinmcp-mcp --client claude
```

### Installation dans Cursor

Allez dans : `Settings` -> `Cursor Settings` -> `MCP` -> `Add new global MCP server`
La méthode recommandée est de coller la configuration suivante dans votre fichier `~/.cursor/mcp.json`. Voir la [documentation Cursor MCP](https://docs.cursor.com/context/model-context-protocol) pour plus d’informations.

```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp@latest"]
    }
  }
}
```

<details>
<summary>Alternative : Utiliser Bun</summary>

```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "bunx",
      "args": ["-y", "@upstash/twinmcp-mcp@latest"]
    }
  }
}
```
</details>

<details>
<summary>Alternative : Utiliser Deno</summary>

```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "deno",
      "args": ["run", "--allow-net", "npm:@upstash/twinmcp-mcp"]
    }
  }
}
```
</details>

### Installation dans Windsurf
Ajoutez ceci à votre fichier de configuration MCP Windsurf. Voir la [documentation Windsurf MCP](https://docs.windsurf.com/windsurf/mcp) pour plus d’informations.
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp@latest"]
    }
  }
}
```

### Installation dans VS Code
[<img alt="Installer dans VS Code (npx)" src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Installer%20TwinMCP%20MCP&color=0098FF">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)
[<img alt="Installer dans VS Code Insiders (npx)" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Installer%20TwinMCP%20MCP&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)
Ajoutez ceci à votre fichier de configuration MCP VS Code. Voir la [documentation VS Code MCP](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) pour plus d'informations.
```json
{
  "servers": {
    "TwinMCP": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp@latest"]
    }
  }
}
```

### Installation dans Zed
Peut être installé via [Zed Extensions](https://zed.dev/extensions?query=TwinMCP) ou en ajoutant ceci à votre `settings.json` Zed. Voir la [documentation Zed Context Server](https://zed.dev/docs/assistant/context-servers).
```json
{
  "context_servers": {
    "TwinMCP": {
      "source": "custom",
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}
```

### Installation dans Claude Code
Exécutez cette commande. Voir la [documentation Claude Code MCP](https://docs.anthropic.com/fr/docs/claude-code/mcp).
```sh
claude mcp add --scope user twinmcp -- npx -y @upstash/twinmcp-mcp@latest
```

### Installation dans Claude Desktop
Ajoutez ceci à votre fichier `claude_desktop_config.json`. Voir la [documentation Claude Desktop MCP](https://modelcontextprotocol.io/quickstart/user).
```json
{
  "mcpServers": {
    "TwinMCP": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp@latest"]
    }
  }
}
```

### Installation dans BoltAI
Ouvrez la page "Settings" de l'application, naviguez jusqu'à "Plugins", et entrez le JSON suivant :
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp@latest"]
    }
  }
}
```
Une fois enregistré, saisissez dans le chat `query-docs` suivi de votre ID de documentation TwinMCP (par exemple, `query-docs /nuxt/ui`). Plus d'informations sont disponibles sur le [site de documentation BoltAI](https://docs.boltai.com/docs/plugins/mcp-servers). Pour BoltAI sur iOS, [consultez ce guide](https://docs.boltai.com/docs/boltai-mobile/mcp-servers).

### Installation dans Copilot Coding Agent
Ajoutez la configuration suivante à la section `mcp` de votre fichier de configuration Copilot Coding Agent (Repository->Settings->Copilot->Coding agent->MCP configuration) :
```json
{
  "mcpServers": {
    "twinmcp": {
      "type": "http",
      "url": "https://mcp.twinmcp.com/mcp",
      "tools": ["query-docs", "resolve-library-id"]
    }
  }
}
```
Pour plus d'informations, consultez la [documentation officielle GitHub](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/agents/copilot-coding-agent/extending-copilot-coding-agent-with-mcp).

### Installation dans Copilot CLI
1.  Ouvrez le fichier de configuration MCP de Copilot CLI. L'emplacement est `~/.copilot/mcp-config.json` (où `~` est votre répertoire personnel).
2.  Ajoutez ce qui suit à l'objet `mcpServers` dans votre fichier `mcp-config.json` :
```json
{
  "mcpServers": {
    "twinmcp": {
      "type": "http",
      "url": "https://mcp.twinmcp.com/mcp",
      "headers": {
        "TWINMCP_API_KEY": "YOUR_API_KEY"
      },
      "tools": ["query-docs", "resolve-library-id"]
    }
  }
}
```
Ou, pour un serveur local :
```json
{
  "mcpServers": {
    "twinmcp": {
      "type": "local",
      "command": "npx",
      "tools": ["query-docs", "resolve-library-id"],
      "args": ["-y", "@upstash/twinmcp-mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}
```
Si le fichier `mcp-config.json` n'existe pas, créez-le.

### Utilisation avec Docker
Si vous préférez exécuter le serveur MCP dans un conteneur Docker :
1.  **Construisez l’image Docker :**
    Créez un `Dockerfile` à la racine du projet (ou ailleurs) :
    <details>
    <summary>Voir le contenu du Dockerfile</summary>

    ```Dockerfile
    FROM node:18-alpine
    WORKDIR /app
    # Installer la dernière version en global
    RUN npm install -g @upstash/twinmcp-mcp@latest
    # Exposer le port par défaut si besoin (optionnel)
    # EXPOSE 3000
    # Commande par défaut
    CMD ["twinmcp-mcp"]
    ```
    </details>

    Puis, construisez l’image :
    ```bash
    docker build -t twinmcp-mcp .
    ```
2.  **Configurez votre client MCP :**
    Mettez à jour la configuration de votre client MCP pour utiliser la commande Docker.
    _Exemple pour un fichier cline_mcp_settings.json :_
    ```json
    {
      "mcpServers": {
        "Сontext7": {
          "autoApprove": [],
          "disabled": false,
          "timeout": 60,
          "command": "docker",
          "args": ["run", "-i", "--rm", "twinmcp-mcp"],
          "transportType": "stdio"
        }
      }
    }
    ```
    _Note : Ceci est un exemple. Adaptez la structure selon votre client MCP (voir plus haut dans ce README). Assurez-vous que le nom de l’image dans `args` correspond au tag utilisé lors du build._

### Installation sous Windows
La configuration sous Windows est légèrement différente par rapport à Linux ou macOS (_`Cline` est utilisé dans l'exemple_). Le même principe s'applique à d'autres éditeurs; référez-vous à la configuration de `command` et `args`.
```json
{
  "mcpServers": {
    "github.com/upstash/twinmcp-mcp": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@upstash/twinmcp-mcp@latest"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Outils disponibles
- `resolve-library-id` : Résout un nom de bibliothèque général en un ID compatible TwinMCP.
  - `libraryName` (obligatoire)
- `query-docs` : Récupère la documentation d’une bibliothèque via un ID TwinMCP.
  - `libraryId` (obligatoire)

## Développement
Clonez le projet et installez les dépendances :
```bash
pnpm i
```
Build :
```bash
pnpm run build
```

### Exemple de configuration locale
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["tsx", "/path/to/folder/twinmcp-mcp/src/index.ts"]
    }
  }
}
```

### Tester avec MCP Inspector
```bash
npx -y @modelcontextprotocol/inspector npx @upstash/twinmcp-mcp@latest
```

## Dépannage

### ERR_MODULE_NOT_FOUND
Si vous voyez cette erreur, essayez d’utiliser `bunx` à la place de `npx`.
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "bunx",
      "args": ["-y", "@upstash/twinmcp-mcp@latest"]
    }
  }
}
```
Cela résout souvent les problèmes de résolution de modules, surtout si `npx` n’installe ou ne résout pas correctement les packages.

### Problèmes de résolution ESM
Si vous rencontrez une erreur comme : `Error: Cannot find module 'uriTemplate.js'` essayez d'exécuter avec le drapeau `--experimental-vm-modules` :
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "--node-options=--experimental-vm-modules", "@upstash/twinmcp-mcp@1.0.6"]
    }
  }
}
```

### Erreurs client MCP
1. Essayez de retirer `@latest` du nom du package.
2. Essayez d'utiliser `bunx` comme alternative.
3. Essayez d'utiliser `deno` comme alternative.
4. Assurez-vous d'utiliser Node v18 ou supérieur pour avoir le support natif de fetch avec `npx`.

## Clause de non-responsabilité
Les projets TwinMCP sont des contributions de la communauté, et bien que nous nous efforcions de maintenir une haute qualité, nous ne pouvons garantir l'exactitude, l'exhaustivité ou la sécurité de toute la documentation des bibliothèques. Les projets listés dans TwinMCP sont développés et maintenus par leurs propriétaires respectifs, et non par TwinMCP. Si vous rencontrez un contenu suspect, inapproprié ou potentiellement nuisible, veuillez utiliser le bouton "Signaler" sur la page du projet pour nous le faire savoir immédiatement. Nous prenons tous les signalements au sérieux et examinerons rapidement les contenus signalés pour maintenir l'intégrité et la sécurité de notre plateforme. En utilisant TwinMCP, vous reconnaissez que vous le faites à votre propre discrétion et à vos risques et périls.

## TwinMCP dans les médias
- [Better Stack: "Free Tool Makes Cursor 10x Smarter"](https://youtu.be/52FC3qObp9E)
- [Cole Medin: "This is Hands Down the BEST MCP Server for AI Coding Assistants"](https://www.youtube.com/watch?v=G7gK8H6u7Rs)
- [Income stream surfers: "TwinMCP + SequentialThinking MCPs: Is This AGI?"](https://www.youtube.com/watch?v=-ggvzyLpK6o)
- [Julian Goldie SEO: "TwinMCP: New MCP AI Agent Update"](https://www.youtube.com/watch?v=CTZm6fBYisc)
- [JeredBlu: "Context 7 MCP: Get Documentation Instantly + VS Code Setup"](https://www.youtube.com/watch?v=-ls0D-rtET4)
- [Income stream surfers: "TwinMCP: The New MCP Server That Will CHANGE AI Coding"](https://www.youtube.com/watch?v=PS-2Azb-C3M)
- [AICodeKing: "TwinMCP + Cline & RooCode: This MCP Server Makes CLINE 100X MORE EFFECTIVE!"](https://www.youtube.com/watch?v=qZfENAPMnyo)
- [Sean Kochel: "5 MCP Servers For Vibe Coding Glory (Just Plug-In & Go)"](https://www.youtube.com/watch?v=LqTQi8qexJM)

## Historique des stars
[![Graphique d'historique des stars](https://api.star-history.com/svg?repos=upstash/twinmcp&type=Date)](https://www.star-history.com/#upstash/twinmcp&Date)

## Licence
MIT
