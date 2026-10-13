# TwinMCP MCP - Documentazione aggiornata per qualsiasi prompt

[![Website](https://img.shields.io/badge/Website-twinmcp.com-blue)](https://twinmcp.com) [![smithery badge](https://smithery.ai/badge/@upstash/twinmcp-mcp)](https://smithery.ai/server/@upstash/twinmcp-mcp) [<img alt="Install in VS Code (npx)" src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Installa%20TwinMCP%20MCP&color=0098FF">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)
[![中文文档](https://img.shields.io/badge/docs-中文版-yellow)](./README.zh-CN.md) [![한국어 문서](https://img.shields.io/badge/docs-한국어-green)](./README.ko.md) [![Documentación en Español](https://img.shields.io/badge/docs-Español-orange)](./README.es.md) [![Documentation en Français](https://img.shields.io/badge/docs-Français-blue)](./README.fr.md) [![Documentação em Português (Brasil)](<https://img.shields.io/badge/docs-Português%20(Brasil)-purple>)](./README.pt-BR.md) [![Documentazione in italiano](https://img.shields.io/badge/docs-Italian-red)](./README.it.md)

## ❌ Senza TwinMCP

LLMs si affidano a informazioni obsolete o generiche sulle librerie che utilizzi. Ottieni:

- ❌ Gli esempi di codice sono obsoleti e basati su dati di formazione vecchi di anni
- ❌ Le API allucinate non esistono nemmeno
- ❌ Risposte generiche per vecchie versioni del pacchetto

## ✅ Con TwinMCP

TwinMCP MCP recupera documentazione aggiornata, specifica per versione e esempi di codice direttamente dalla fonte — e li inserisce direttamente nel tuo prompt.
Aggiungi `use twinmcp` al prompt in Cursor:

```txt
Crea un progetto Next.js di base con app router. Usa twinmcp
```

```txt
Creare uno script per eliminare le righe in cui la città è "", date le credenziali di PostgreSQL. usare twinmcp
```

TwinMCP recupera esempi di codice e documentazione aggiornati direttamente nel contesto del tuo LLM.

- 1️⃣ Scrivi il tuo prompt in modo naturale
- 2️⃣ Indica all'LLM di usare twinmcp
- 3️⃣ Ottieni risposte di codice funzionante
  Nessun cambio di tab, nessuna API allucinata che non esiste, nessuna generazione di codice obsoleta.

## 🛠️ Iniziare

### Requisiti

- Node.js >= v18.0.0
- Cursor, Windsurf, Claude Desktop o un altro client MCP

### Installazione tramite Smithery

Per installare TwinMCP MCP Server per Claude Desktop automaticamente tramite [Smithery](https://smithery.ai/server/@upstash/twinmcp-mcp):

```bash
npx -y @smithery/cli install @upstash/twinmcp-mcp --client claude
```

### Installare in Cursor

Vai a: `Impostazioni` -> `Impostazioni cursore` -> `MCP` -> `Aggiungi nuovo server MCP globale`
Incollare la seguente configurazione nel file `~/.cursor/mcp.json` di Cursor è l'approccio consigliato. Vedi [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol) per ulteriori informazioni.

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
<summary>Alternativa: Usa Bun</summary>

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
<summary>Alternativa: Usa Deno</summary>

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

### Installare in Windsurf
Aggiungi questo al tuo file di configurazione Windsurf MCP. Vedi [Windsurf MCP docs](https://docs.windsurf.com/windsurf/mcp) per ulteriori informazioni.
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

### Installare in VS Code
[<img alt="Installa in VS Code (npx)" src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Installa%20TwinMCP%20MCP&color=0098FF">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)
[<img alt="Installa in VS Code Insiders (npx)" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Installa%20TwinMCP%20MCP&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)
Aggiungi questo al tuo file di configurazione MCP di VS Code. Vedi [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) per ulteriori informazioni.
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

### Installare in Zed
Può essere installato tramite [Zed Extensions](https://zed.dev/extensions?query=TwinMCP) oppure puoi aggiungere questo al tuo `settings.json` di Zed. Vedi [Zed Context Server docs](https://zed.dev/docs/assistant/context-servers) per ulteriori informazioni.
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

### Installare in Claude Code
Esegui questo comando. Vedi [Claude Code MCP docs](https://docs.anthropic.com/it/docs/claude-code/mcp) per ulteriori informazioni.
```sh
claude mcp add --scope user twinmcp -- npx -y @upstash/twinmcp-mcp@latest
```

### Installare in Claude Desktop
Aggiungi questo al tuo file `claude_desktop_config.json` di Claude Desktop. Vedi [Claude Desktop MCP docs](https://modelcontextprotocol.io/quickstart/user) per ulteriori informazioni.
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

### Installazione in Copilot Coding Agent
Aggiungi la seguente configurazione alla sezione `mcp` del file di configurazione di Copilot Coding Agent (Repository->Settings->Copilot->Coding agent->MCP configuration):
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
Per maggiori informazioni, consulta la [documentazione ufficiale GitHub](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/agents/copilot-coding-agent/extending-copilot-coding-agent-with-mcp).

### Installazione in Copilot CLI
1.  Apri il file di configurazione MCP di Copilot CLI. La posizione è `~/.copilot/mcp-config.json` (dove `~` è la tua home directory).
2.  Aggiungi quanto segue all'oggetto `mcpServers` nel tuo file `mcp-config.json`:
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
Oppure, per un server locale:
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
Se il file `mcp-config.json` non esiste, crealo.

### Utilizzo di Docker
Se preferisci eseguire il server MCP in un contenitore Docker:
1.  **Costruisci l'immagine Docker:**
    Prima, crea un `Dockerfile` nella radice del progetto (o ovunque tu preferisca):
    <details>
    <summary>Clicca per visualizzare il contenuto del Dockerfile</summary>

    ```Dockerfile
    FROM node:18-alpine
    WORKDIR /app
    # Installa l ultima versione globalmente
    RUN npm install -g @upstash/twinmcp-mcp@latest
    # Esponi la porta predefinita se necessario (opzionale, dipende dall interazione del client MCP)
    # EXPOSE 3000
    # Comando predefinito per eseguire il server
    CMD ["twinmcp-mcp"]
    ```
    </details>

    Poi, costruisci l'immagine utilizzando un tag (ad esempio, `twinmcp-mcp`). **Assicurati che Docker Desktop (o il demone Docker) sia in esecuzione.** Esegui il seguente comando nella stessa directory in cui hai salvato il `Dockerfile`:
    ```bash
    docker build -t twinmcp-mcp .
    ```
2.  **Configura il tuo client MCP:**
    Aggiorna la configurazione del tuo client MCP per utilizzare il comando Docker.
    _Esempio per un file cline_mcp_settings.json:_
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
    _Nota: Questa è una configurazione di esempio. Consulta gli esempi specifici per il tuo client MCP (come Cursor, VS Code, ecc.) precedentemente in questo README per adattare la struttura (ad es., `mcpServers` vs `servers`). Inoltre, assicurati che il nome dell'immagine in `args` corrisponda al tag utilizzato durante il comando `docker build`._

### Strumenti Disponibili
- `resolve-library-id`: Converte un nome generico di libreria in un ID di libreria compatibile con TwinMCP.
  - `query` (obbligatorio): La domanda o il compito dell'utente (per il ranking di rilevanza)
  - `libraryName` (obbligatorio): Il nome della libreria da cercare
- `query-docs`: Recupera la documentazione per una libreria utilizzando un ID di libreria compatibile con TwinMCP.
  - `libraryId` (obbligatorio): ID esatto compatibile con TwinMCP (ad esempio, `/mongodb/docs`, `/vercel/next.js`)
  - `query` (obbligatorio): La domanda o il compito per ottenere documentazione pertinente

## Sviluppo
Clona il progetto e installa le dipendenze:
```bash
pnpm i
```
Compila:
```bash
pnpm run build
```

### Esempio di Configurazione Locale
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

### Test con MCP Inspector
```bash
npx -y @modelcontextprotocol/inspector npx @upstash/twinmcp-mcp@latest
```

## Risoluzione dei problemi

### ERR_MODULE_NOT_FOUND
Se vedi questo errore, prova a usare `bunx` invece di `npx`.
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
Questo spesso risolve i problemi di risoluzione dei moduli, specialmente negli ambienti dove `npx` non installa o risolve correttamente i pacchetti.

### Problemi di risoluzione ESM
Se riscontri un errore come: `Error: Cannot find module 'uriTemplate.js'` prova a eseguire con il flag `--experimental-vm-modules`:
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

### Errori del Client MCP
1. Prova a rimuovere `@latest` dal nome del pacchetto.
2. Prova a usare `bunx` come alternativa.
3. Prova a usare `deno` come alternativa.
4. Assicurati di utilizzare Node v18 o superiore per avere il supporto nativo di fetch con `npx`.

## Dichiarazione di non responsabilità
I progetti TwinMCP sono contributi della comunità e, sebbene ci impegniamo a mantenere un'alta qualità, non possiamo garantire l'accuratezza, la completezza o la sicurezza di tutta la documentazione delle librerie. I progetti elencati in TwinMCP sono sviluppati e gestiti dai rispettivi proprietari, non da TwinMCP. Se riscontri contenuti sospetti, inappropriati o potenzialmente dannosi, utilizza il pulsante "Segnala" sulla pagina del progetto per informarci immediatamente. Prendiamo sul serio tutte le segnalazioni e esamineremo prontamente i contenuti segnalati per mantenere l'integrità e la sicurezza della nostra piattaforma. Utilizzando TwinMCP, riconosci di farlo a tua discrezione e a tuo rischio.

## TwinMCP nei Media
- [Better Stack: "Free Tool Makes Cursor 10x Smarter"](https://youtu.be/52FC3qObp9E)
- [Cole Medin: "This is Hands Down the BEST MCP Server for AI Coding Assistants"](https://www.youtube.com/watch?v=G7gK8H6u7Rs)
- [Income stream surfers: "TwinMCP + SequentialThinking MCPs: Is This AGI?"](https://www.youtube.com/watch?v=-ggvzyLpK6o)
- [Julian Goldie SEO: "TwinMCP: New MCP AI Agent Update"](https://www.youtube.com/watch?v=CTZm6fBYisc)
- [JeredBlu: "Context 7 MCP: Get Documentation Instantly + VS Code Setup"](https://www.youtube.com/watch?v=-ls0D-rtET4)
- [Income stream surfers: "TwinMCP: The New MCP Server That Will CHANGE AI Coding"](https://www.youtube.com/watch?v=PS-2Azb-C3M)

## Storico delle Stelle
[![Star History Chart](https://api.star-history.com/svg?repos=upstash/twinmcp&type=Date)](https://www.star-history.com/#upstash/twinmcp&Date)

## Licenza
MIT
