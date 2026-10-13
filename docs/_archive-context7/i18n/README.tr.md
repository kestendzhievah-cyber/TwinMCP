# TwinMCP MCP - Herhangi Bir Prompt İçin Güncel Kod Belgeleri

[![Website](https://img.shields.io/badge/Website-twinmcp.com-blue)](https://twinmcp.com) [![smithery badge](https://smithery.ai/badge/@upstash/twinmcp-mcp)](https://smithery.ai/server/@upstash/twinmcp-mcp) [<img alt="VS Code'da Yükle (npx)" src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=TwinMCP%20MCP%20Y%C3%BCkle&color=0098FF">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)
[![中文文档](https://img.shields.io/badge/docs-中文版-yellow)](./README.zh-CN.md) [![한국어 문서](https://img.shields.io/badge/docs-한국어-green)](./README.ko.md) [![Documentación en Español](https://img.shields.io/badge/docs-Español-orange)](./README.es.md) [![Documentation en Français](https://img.shields.io/badge/docs-Français-blue)](./README.fr.md) [![Documentação em Português (Brasil)](<https://img.shields.io/badge/docs-Português%20(Brasil)-purple>)](./README.pt-BR.md) [![Documentazione in italiano](https://img.shields.io/badge/docs-Italian-red)](./README.it.md) [![Dokumentasi Bahasa Indonesia](https://img.shields.io/badge/docs-Bahasa%20Indonesia-pink)](./README.id-ID.md) [![Dokumentation auf Deutsch](https://img.shields.io/badge/docs-Deutsch-darkgreen)](./README.de.md) [![Документация на русском языке](https://img.shields.io/badge/docs-Русский-darkblue)](./README.ru.md) [![Türkçe Doküman](https://img.shields.io/badge/docs-Türkçe-blue)](./README.tr.md)

## ❌ TwinMCP Olmadan

LLM'ler, kullandığınız kütüphaneler hakkında güncel olmayan veya genel bilgilere güvenir. Karşılaştığınız sorunlar:

- ❌ Kod örnekleri eskidir ve bir yıllık eğitim verilerine dayanır
- ❌ Halüsinasyon yapılan API'ler gerçekte mevcut değildir
- ❌ Eski paket sürümleri için genel cevaplar alırsınız

## ✅ TwinMCP İle

TwinMCP MCP, güncel ve sürüme özel belgeleri ve kod örneklerini doğrudan kaynağından çeker ve doğrudan prompt'unuza yerleştirir.
Cursor'da prompt'unuza `use twinmcp` ekleyin:

```txt
Next.js ile app router kullanan basit bir proje oluştur. use twinmcp
```

```txt
PostgreSQL kimlik bilgileriyle şehir değeri "" olan satırları silmek için bir betik oluştur. use twinmcp
```

TwinMCP, güncel kod örneklerini ve belgelerini doğrudan LLM'inizin içeriğine getirir.

- 1️⃣ Prompt'unuzu doğal bir şekilde yazın
- 2️⃣ LLM'e `use twinmcp` kullanmasını söyleyin
- 3️⃣ Çalışan kod cevapları alın
  Sekme değiştirme, var olmayan halüsinasyon API'ler, güncel olmayan kod üretimleri yok.

## 🛠️ Başlangıç

### Gereksinimler

- Node.js >= v18.0.0
- Cursor, Windsurf, Claude Desktop veya başka bir MCP İstemcisi

### Smithery aracılığıyla kurulum

TwinMCP MCP Server'ı Claude Desktop için [Smithery](https://smithery.ai/server/@upstash/twinmcp-mcp) aracılığıyla otomatik olarak kurmak için:

```bash
npx -y @smithery/cli install @upstash/twinmcp-mcp --client claude
```

### Cursor'da Kurulum

Şu yolu izleyin: `Settings` -> `Cursor Settings` -> `MCP` -> `Add new global MCP server`
Aşağıdaki yapılandırmayı Cursor `~/.cursor/mcp.json` dosyanıza yapıştırmanız önerilen yaklaşımdır. Ayrıca, proje klasörünüzde `.cursor/mcp.json` oluşturarak belirli bir projeye de kurabilirsiniz. Daha fazla bilgi için [Cursor MCP belgelerine](https://docs.cursor.com/context/model-context-protocol) bakabilirsiniz.

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
<summary>Alternatif: Bun Kullanın</summary>

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
<summary>Alternatif: Deno Kullanın</summary>

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

### Windsurf'te Kurulum
Bunu Windsurf MCP yapılandırma dosyanıza ekleyin. Daha fazla bilgi için [Windsurf MCP belgelerine](https://docs.windsurf.com/windsurf/mcp) bakabilirsiniz.
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

### VS Code'da Kurulum
[<img alt="VS Code'da Yükle (npx)" src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=TwinMCP%20MCP%20Y%C3%BCkle&color=0098FF">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)
[<img alt="VS Code Insiders'da Yükle (npx)" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=TwinMCP%20MCP%20Y%C3%BCkle&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)
Bunu VS Code MCP yapılandırma dosyanıza ekleyin. Daha fazla bilgi için [VS Code MCP belgelerine](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) bakabilirsiniz.
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

### Zed'de Kurulum
[Zed Uzantıları](https://zed.dev/extensions?query=TwinMCP) aracılığıyla kurulabilir veya Zed `settings.json` dosyanıza ekleyebilirsiniz. Daha fazla bilgi için [Zed Context Server belgelerine](https://zed.dev/docs/assistant/context-servers) bakabilirsiniz.
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

### Claude Code'da Kurulum
Bu komutu çalıştırın. Daha fazla bilgi için [Claude Code MCP belgelerine](https://docs.anthropic.com/en/docs/claude-code/mcp) bakabilirsiniz.
```sh
claude mcp add --scope user twinmcp -- npx -y @upstash/twinmcp-mcp@latest
```

### Claude Desktop'ta Kurulum
Bunu Claude Desktop `claude_desktop_config.json` dosyanıza ekleyin. Daha fazla bilgi için [Claude Desktop MCP belgelerine](https://modelcontextprotocol.io/quickstart/user) bakabilirsiniz.
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

### Copilot Coding Agent Kurulumu
Aşağıdaki yapılandırmayı Copilot Coding Agent'ın `mcp` bölümüne ekleyin (Repository->Settings->Copilot->Coding agent->MCP configuration):
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
Daha fazla bilgi için [resmi GitHub dokümantasyonuna](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/agents/copilot-coding-agent/extending-copilot-coding-agent-with-mcp) bakabilirsiniz.

### Docker Kullanımı
MCP sunucusunu bir Docker konteynerinde çalıştırmayı tercih ederseniz:
1.  **Docker Görüntüsü Oluşturun:**
    Önce, proje kökünde (veya tercih ettiğiniz herhangi bir yerde) bir `Dockerfile` oluşturun:
    <details>
    <summary>Dockerfile içeriğini görmek için tıklayın</summary>

    ```Dockerfile
    FROM node:18-alpine
    WORKDIR /app
    # En son sürümü global olarak yükleyin
    RUN npm install -g @upstash/twinmcp-mcp@latest
    # Gerekirse varsayılan portu açın (isteğe bağlı, MCP istemci etkileşimine bağlıdır)
    # EXPOSE 3000
    # Sunucuyu çalıştırmak için varsayılan komut
    CMD ["twinmcp-mcp"]
    ```
    </details>

    Ardından, bir etiket (örneğin, `twinmcp-mcp`) kullanarak görüntüyü oluşturun. **Docker Desktop'un (veya Docker daemon'un) çalıştığından emin olun.** `Dockerfile`'ı kaydettiğiniz dizinde aşağıdaki komutu çalıştırın:
    ```bash
    docker build -t twinmcp-mcp .
    ```
2.  **MCP İstemcinizi Yapılandırın:**
    MCP istemcinizin yapılandırmasını Docker komutunu kullanacak şekilde güncelleyin.
    _cline_mcp_settings.json için örnek:_
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
    _Not: Bu bir örnek yapılandırmadır. Yapıyı uyarlamak için MCP istemcinize (Cursor, VS Code vb.) özel örneklere bakın (örneğin, `mcpServers` ve `servers` farkı). Ayrıca, `args` içindeki görüntü adının `docker build` komutu sırasında kullanılan etiketle eşleştiğinden emin olun._

### Kullanılabilir Araçlar
- `resolve-library-id`: Genel bir kütüphane adını TwinMCP uyumlu bir kütüphane ID'sine dönüştürür.
  - `query` (gerekli): Kullanıcının sorusu veya görevi (alaka sıralaması için)
  - `libraryName` (gerekli): Aranacak kütüphane adı
- `query-docs`: TwinMCP uyumlu bir kütüphane ID'si kullanarak bir kütüphane için belgeleri getirir.
  - `libraryId` (gerekli): TwinMCP uyumlu tam kütüphane ID'si (örneğin, `/mongodb/docs`, `/vercel/next.js`)
  - `query` (gerekli): İlgili belgeleri almak için soru veya görev

## Geliştirme
Projeyi klonlayın ve bağımlılıkları yükleyin:
```bash
pnpm i
```
Derleyin:
```bash
pnpm run build
```

### Yerel Yapılandırma Örneği
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

### MCP Inspector ile Test Etme
```bash
npx -y @modelcontextprotocol/inspector npx @upstash/twinmcp-mcp@latest
```

## Sorun Giderme

### ERR_MODULE_NOT_FOUND
Bu hatayı görürseniz, `npx` yerine `bunx` kullanmayı deneyin.
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
Bu, özellikle `npx`'in paketleri düzgün şekilde yüklemediği veya çözemediği ortamlarda modül çözümleme sorunlarını genellikle çözer.

### ESM Çözümleme Sorunları
`Error: Cannot find module 'uriTemplate.js'` gibi bir hatayla karşılaşırsanız, `--experimental-vm-modules` bayrağıyla çalıştırmayı deneyin:
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

### MCP İstemci Hataları
1. Paket adından `@latest` ifadesini kaldırmayı deneyin.
2. Alternatif olarak `bunx` kullanmayı deneyin.
3. Alternatif olarak `deno` kullanmayı deneyin.
4. `npx` ile yerel fetch desteğine sahip olmak için Node v18 veya daha yüksek bir sürüm kullandığınızdan emin olun.

## Sorumluluk Reddi
TwinMCP projeleri topluluk katkılıdır ve yüksek kaliteyi korumaya çalışsak da, tüm kütüphane belgelerinin doğruluğunu, eksiksizliğini veya güvenliğini garanti edemeyiz. TwinMCP'de listelenen projeler, TwinMCP tarafından değil, ilgili sahipleri tarafından geliştirilmekte ve sürdürülmektedir. Şüpheli, uygunsuz veya potansiyel olarak zararlı içerikle karşılaşırsanız, lütfen bizi hemen bilgilendirmek için proje sayfasındaki "Bildir" düğmesini kullanın. Tüm bildirimleri ciddiye alıyoruz ve platformumuzun bütünlüğünü ve güvenliğini korumak için işaretlenen içeriği hızla inceleyeceğiz. TwinMCP'yi kullanarak, bunu kendi takdirinizle ve riskinizle yaptığınızı kabul etmiş olursunuz.

## TwinMCP Medyada
- [Better Stack: "Ücretsiz Araç Cursor'u 10 Kat Daha Akıllı Yapıyor"](https://youtu.be/52FC3qObp9E)
- [Cole Medin: "Bu, Tartışmasız AI Kodlama Asistanları İçin EN İYİ MCP Sunucusudur"](https://www.youtube.com/watch?v=G7gK8H6u7Rs)
- [Income stream surfers: "TwinMCP + SequentialThinking MCP'leri: Bu AGI mi?"](https://www.youtube.com/watch?v=-ggvzyLpK6o)
- [Julian Goldie SEO: "TwinMCP: Yeni MCP AI Aracı Güncellemesi"](https://www.youtube.com/watch?v=CTZm6fBYisc)
- [JeredBlu: "Context 7 MCP: Belgeleri Anında Alın + VS Code Kurulumu"](https://www.youtube.com/watch?v=-ls0D-rtET4)
- [Income stream surfers: "TwinMCP: AI Kodlamayı DEĞİŞTİRECEK Yeni MCP Sunucusu"](https://www.youtube.com/watch?v=PS-2Azb-C3M)
- [AICodeKing: "TwinMCP + Cline & RooCode: Bu MCP Sunucusu CLINE'ı 100 KAT DAHA ETKİLİ YAPIYOR!"](https://www.youtube.com/watch?v=qZfENAPMnyo)
- [Sean Kochel: "Vibe Kodlama İhtişamı İçin 5 MCP Sunucusu (Tak ve Çalıştır)"](https://www.youtube.com/watch?v=LqTQi8qexJM)

## Yıldız Geçmişi
[![Yıldız Geçmişi Grafiği](https://api.star-history.com/svg?repos=upstash/twinmcp&type=Date)](https://www.star-history.com/#upstash/twinmcp&Date)

## Lisans
MIT
