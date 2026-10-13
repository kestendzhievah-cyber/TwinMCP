# TwinMCP MCP - Dokumentasi Kode Terkini Untuk Setiap Permintaan

[![Website](https://img.shields.io/badge/Website-twinmcp.com-blue)](https://twinmcp.com) [![smithery badge](https://smithery.ai/badge/@upstash/twinmcp-mcp)](https://smithery.ai/server/@upstash/twinmcp-mcp) [<img alt="Install in VS Code (npx)" src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20TwinMCP%20MCP&color=0098FF">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)
[![English](https://img.shields.io/badge/docs-English-blue)](../README.md) [![繁體中文](https://img.shields.io/badge/docs-繁體中文-yellow)](./README.zh-TW.md) [![简体中文](https://img.shields.io/badge/docs-简体中文-yellow)](./README.zh-CN.md) [![日本語](https://img.shields.io/badge/docs-日本語-b7003a)](./README.ja.md) [![한국어 문서](https://img.shields.io/badge/docs-한국어-green)](./README.ko.md) [![Documentación en Español](https://img.shields.io/badge/docs-Español-orange)](./README.es.md) [![Documentation en Français](https://img.shields.io/badge/docs-Français-blue)](./README.fr.md) [![Documentação em Português (Brasil)](<https://img.shields.io/badge/docs-Português%20(Brasil)-purple>)](./README.pt-BR.md) [![Documentazione in italiano](https://img.shields.io/badge/docs-Italian-red)](./README.it.md) [![Dokumentasi Bahasa Indonesia](https://img.shields.io/badge/docs-Bahasa%20Indonesia-pink)](./README.id-ID.md) [![Dokumentation auf Deutsch](https://img.shields.io/badge/docs-Deutsch-darkgreen)](./README.de.md) [![Документация на русском языке](https://img.shields.io/badge/docs-Русский-darkblue)](./README.ru.md) [![Українська документація](https://img.shields.io/badge/docs-Українська-lightblue)](./README.uk.md) [![Türkçe Doküman](https://img.shields.io/badge/docs-Türkçe-blue)](./README.tr.md) [![Arabic Documentation](https://img.shields.io/badge/docs-Arabic-white)](./README.ar.md)

## ❌ Tanpa TwinMCP

LLM bergantung pada informasi yang sudah usang atau generik tentang pustaka yang Anda gunakan. Anda mendapatkan:

- ❌ Contoh kode yang sudah usang dan berdasarkan data pelatihan dari tahun lalu
- ❌ API yang diimajinasikan tidak pernah ada
- ❌ Jawaban generik untuk versi paket yang lama

## ✅ Dengan TwinMCP

TwinMCP MCP mengambil dokumentasi dan contoh kode terkini yang spesifik versi langsung dari sumbernya — dan menempatkannya langsung ke dalam prompt Anda.
Tambahkan `use twinmcp` ke prompt Anda di Cursor:

```txt
Buat middleware Next.js yang memeriksa JWT valid di cookie dan mengarahkan pengguna yang tidak terautentikasi ke `/login`. use twinmcp
```

```txt
Konfigurasikan skrip Cloudflare Worker untuk menyimpan respons API JSON selama lima menit. use twinmcp
```

TwinMCP mengambil contoh kode dan dokumentasi terkini langsung ke konteks LLM.

- 1️⃣ Tulis permintaan Anda secara alami
- 2️⃣ Beri tahu LLM untuk `use twinmcp`
- 3️⃣ Dapatkan jawaban kode yang berfungsi
  Tidak perlu berpindah tab, tidak ada API yang diimajinasikan yang tidak ada, tidak ada hasil kode usang.

## 📚 Menambahkan Proyek

Kunjungi [panduan penambahan proyek](https://twinmcp.com/docs/adding-libraries) untuk mempelajari cara menambahkan (atau memperbarui) pustaka favorit Anda ke TwinMCP.

## 🛠️ Instalasi

### Persyaratan

- Node.js >= v18.0.0
- Cursor, Windsurf, Claude Desktop, atau klien MCP lainnya
<details>
<summary><b>Menginstal melalui Smithery</b></summary>

Untuk menginstal TwinMCP MCP Server untuk klien apa pun secara otomatis melalui [Smithery](https://smithery.ai/server/@upstash/twinmcp-mcp):

```bash
npx -y @smithery/cli@latest install @upstash/twinmcp-mcp --client <NAMA_KLIEN> --key <KUNCI_SMITHERY_ANDA>
```

Anda dapat menemukan kunci Smithery Anda di [halaman web Smithery.ai](https://smithery.ai/server/@upstash/twinmcp-mcp).

</details>

<details>
<summary><b>Instal di Cursor</b></summary>

Pergi ke: `Settings` -> `Cursor Settings` -> `MCP` -> `Add new global MCP server`
Menyalin konfigurasi berikut ke file `~/.cursor/mcp.json` Anda adalah pendekatan yang direkomendasikan. Anda juga dapat menginstalnya di proyek tertentu dengan membuat `.cursor/mcp.json` di folder proyek Anda. Lihat [dokumentasi Cursor MCP](https://docs.cursor.com/context/model-context-protocol) untuk info lebih lanjut.
> Sejak Cursor 1.0, Anda dapat mengklik tombol instal di bawah untuk instalasi satu klik instan.

#### Koneksi Server Remote Cursor
[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=twinmcp&config=eyJ1cmwiOiJodHRwczovL21jcC5jb250ZXh0Ny5jb20vbWNwIn0%3D)
```json
{
  "mcpServers": {
    "twinmcp": {
      "url": "https://mcp.twinmcp.com/mcp"
    }
  }
}
```

#### Koneksi Server Lokal Cursor
[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=twinmcp&config=eyJjb21tYW5kIjoibnB4IC15IEB1cHN0YXNoL2NvbnRleHQ3LW1jcCJ9)
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  }
}
```
<details>
<summary>Alternatif: Gunakan Bun</summary>

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=twinmcp&config=eyJjb21tYW5kIjoiYnVueCAteSBAdXBzdGFzaC9jb250ZXh0Ny1tY3AifQ%3D%3D)
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "bunx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  }
}
```
</details>

<details>
<summary>Alternatif: Gunakan Deno</summary>

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=twinmcp&config=eyJjb21tYW5kIjoiZGVubyBydW4gLS1hbGxvdy1lbnYgLS1hbGxvdy1uZXQgbnBtOkB1cHN0YXNoL2NvbnRleHQ3LW1jcCJ9)
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "deno",
      "args": ["run", "--allow-env=NO_DEPRECATION,TRACE_DEPRECATION", "--allow-net", "npm:@upstash/twinmcp-mcp"]
    }
  }
}
```
</details>

</details>

<details>
<summary><b>Instal di Windsurf</b></summary>

Tambahkan ini ke file konfigurasi MCP Windsurf Anda. Lihat [dokumentasi MCP Windsurf](https://docs.windsurf.com/windsurf/mcp) untuk info lebih lanjut.

#### Koneksi Server Remote Windsurf

```json
{
  "mcpServers": {
    "twinmcp": {
      "serverUrl": "https://mcp.twinmcp.com/mcp"
    }
  }
}
```

#### Koneksi Server Lokal Windsurf

```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Instal di Trae</b></summary>

Gunakan fitur Tambah secara manual dan isi informasi konfigurasi JSON untuk server MCP tersebut.
Untuk detail lebih lanjut, kunjungi [dokumentasi Trae](https://docs.trae.ai/ide/model-context-protocol?_lang=en).

#### Koneksi Server Remote Trae

```json
{
  "mcpServers": {
    "twinmcp": {
      "url": "https://mcp.twinmcp.com/mcp"
    }
  }
}
```

#### Koneksi Server Lokal Trae

```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Instal di VS Code</b></summary>

[<img alt="Install in VS Code (npx)" src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20TwinMCP%20MCP&color=0098FF">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)
[<img alt="Install in VS Code Insiders (npx)" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20TwinMCP%20MCP&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)
Tambahkan ini ke file konfigurasi MCP VS Code Anda. Lihat [dokumentasi MCP VS Code](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) untuk info lebih lanjut.

#### Koneksi Server Remote VS Code

```json
"mcp": {
  "servers": {
    "twinmcp": {
      "type": "http",
      "url": "https://mcp.twinmcp.com/mcp"
    }
  }
}
```

#### Koneksi Server Lokal VS Code

```json
"mcp": {
  "servers": {
    "twinmcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Instal di Visual Studio 2022</b></summary>

Anda dapat mengonfigurasi TwinMCP MCP di Visual Studio 2022 dengan mengikuti [dokumentasi Server MCP Visual Studio](https://learn.microsoft.com/visualstudio/ide/mcp-servers?view=vs-2022).
Tambahkan ini ke file konfigurasi MCP Visual Studio Anda (lihat [dokumentasi Visual Studio](https://learn.microsoft.com/visualstudio/ide/mcp-servers?view=vs-2022) untuk detailnya):
```json
{
  "mcp": {
    "servers": {
      "twinmcp": {
        "type": "http",
        "url": "https://mcp.twinmcp.com/mcp"
      }
    }
  }
}
```
Atau, untuk server lokal:
```json
{
  "mcp": {
    "servers": {
      "twinmcp": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@upstash/twinmcp-mcp"]
      }
    }
  }
}
```
Untuk informasi dan pemecahan masalah lebih lanjut, lihat [dokumentasi Server MCP Visual Studio](https://learn.microsoft.com/visualstudio/ide/mcp-servers?view=vs-2022).
</details>

<details>
<summary><b>Instal di Zed</b></summary>

Dapat diinstal melalui [Ekstensi Zed](https://zed.dev/extensions?query=TwinMCP) atau Anda dapat menambahkan ini ke `settings.json` Zed Anda. Lihat [dokumentasi Server Konteks Zed](https://zed.dev/docs/assistant/context-servers) untuk info lebih lanjut.
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
</details>

<details>
<summary><b>Instal di Gemini CLI</b></summary>

Lihat [Konfigurasi Gemini CLI](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md) untuk detailnya.
1.  Buka file pengaturan Gemini CLI. Lokasinya adalah `~/.gemini/settings.json` (di mana `~` adalah direktori home Anda).
2.  Tambahkan berikut ini ke objek `mcpServers` di file `settings.json` Anda:
```json
{
  "mcpServers": {
    "twinmcp": {
      "httpUrl": "https://mcp.twinmcp.com/mcp"
    }
  }
}
```
Atau, untuk server lokal:
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  }
}
```
Jika objek `mcpServers` tidak ada, buatlah.
</details>

<details>
<summary><b>Instal di Claude Code</b></summary>

Jalankan perintah ini. Lihat [dokumentasi MCP Claude Code](https://docs.anthropic.com/id/docs/claude-code/mcp) untuk info lebih lanjut.

#### Koneksi Server Lokal Claude Code

```sh
claude mcp add --scope user twinmcp -- npx -y @upstash/twinmcp-mcp
```

#### Koneksi Server Remote Claude Code

```sh
claude mcp add --scope user --transport http twinmcp https://mcp.twinmcp.com/mcp
```
</details>

<details>
<summary><b>Instal di Claude Desktop</b></summary>

Tambahkan ini ke file `claude_desktop_config.json` Claude Desktop Anda. Lihat [dokumentasi MCP Claude Desktop](https://modelcontextprotocol.io/quickstart/user) untuk info lebih lanjut.
```json
{
  "mcpServers": {
    "TwinMCP": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  }
}
```
</details>

<details>
<summary>
<b>Instal di Cline</b>
</summary>

Anda dapat dengan mudah menginstal TwinMCP melalui [Pasar Server MCP Cline](https://cline.bot/mcp-marketplace) dengan mengikuti petunjuk berikut:
1. Buka **Cline**.
2. Klik ikon menu hamburger (☰) untuk masuk ke bagian **Server MCP**.
3. Gunakan bilah pencarian di tab **Marketplace** untuk menemukan *TwinMCP*.
4. Klik tombol **Instal**.
</details>

<details>
<summary><b>Instal di BoltAI</b></summary>

Buka halaman "Pengaturan" aplikasi, navigasikan ke "Plugin," dan masukkan JSON berikut:
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  }
}
```
Setelah disimpan, masukkan di obrolan `query-docs` diikuti oleh ID dokumentasi TwinMCP Anda (contoh: `query-docs /nuxt/ui`). Informasi lebih lanjut tersedia di [situs dokumentasi BoltAI](https://docs.boltai.com/docs/plugins/mcp-servers). Untuk BoltAI di iOS, [lihat panduan ini](https://docs.boltai.com/docs/boltai-mobile/mcp-servers).
</details>

<details>
<summary><b>Menggunakan Docker</b></summary>

Jika Anda lebih suka menjalankan server MCP dalam wadah Docker:
1. **Bangun Gambar Docker:**
   Pertama, buat `Dockerfile` di direktori utama proyek (atau di mana pun Anda inginkan):
   <details>
   <summary>Klik untuk melihat isi Dockerfile</summary>

   ```Dockerfile
   FROM node:18-alpine
   WORKDIR /app
   # Instal versi terbaru secara global
   RUN npm install -g @upstash/twinmcp-mcp
   # Ekspor port default jika diperlukan (opsional, tergantung pada interaksi klien MCP)
   # EXPOSE 3000
   # Perintah default untuk menjalankan server
   CMD ["twinmcp-mcp"]
   ```
   </details>

   Kemudian, bangun gambar menggunakan tag (contoh: `twinmcp-mcp`). **Pastikan Docker Desktop (atau daemon Docker) berjalan.** Jalankan perintah berikut di direktori yang sama tempat Anda menyimpan `Dockerfile`:
   ```bash
   docker build -t twinmcp-mcp .
   ```
2. **Konfigurasikan Klien MCP Anda:**
   Perbarui konfigurasi klien MCP Anda untuk menggunakan perintah Docker.
   _Contoh untuk cline_mcp_settings.json:_
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
   _Catatan: Ini adalah contoh konfigurasi. Silakan merujuk ke contoh spesifik untuk klien MCP Anda (seperti Cursor, VS Code, dll.) sebelumnya di README ini untuk menyesuaikan struktur (misalnya, `mcpServers` vs `servers`). Juga, pastikan nama gambar di `args` sesuai dengan tag yang digunakan saat perintah `docker build`._
</details>

<details>
<summary><b>Instal di Windows</b></summary>

Konfigurasi di Windows sedikit berbeda dibandingkan Linux atau macOS (_`Cline` digunakan sebagai contoh_). Prinsip yang sama berlaku untuk editor lainnya; lihat konfigurasi `command` dan `args`.
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
</details>

<details>
<summary><b>Instal di Augment Code</b></summary>

Untuk mengonfigurasi TwinMCP MCP di Augment Code, Anda dapat menggunakan antarmuka grafis atau konfigurasi manual.

### **A. Menggunakan UI Augment Code**
1. Klik menu hamburger.
2. Pilih **Pengaturan**.
3. Navigasikan ke bagian **Alat**.
4. Klik tombol **+ Tambah MCP**.
5. Masukkan perintah berikut:
   ```
   npx -y @upstash/twinmcp-mcp@latest
   ```
6. Beri nama MCP: **TwinMCP**.
7. Klik tombol **Tambah**.
   Setelah server MCP ditambahkan, Anda dapat mulai menggunakan fitur dokumentasi kode terkini TwinMCP langsung di Augment Code.
---

### **B. Konfigurasi Manual**
1. Tekan Cmd/Ctrl Shift P atau pergi ke menu hamburger di panel Augment
2. Pilih Edit Pengaturan
3. Di bawah Lanjutan, klik Edit di settings.json
4. Tambahkan konfigurasi server ke array `mcpServers` di objek `augment.advanced`
```json
"augment.advanced": {
  "mcpServers": [
    {
      "name": "twinmcp",
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  ]
}
```
Setelah server MCP ditambahkan, restart editor Anda. Jika Anda menerima kesalahan, periksa sintaks untuk memastikan tanda kurung atau koma penutup tidak hilang.
</details>

<details>
<summary><b>Instal di Roo Code</b></summary>

Tambahkan ini ke file konfigurasi MCP Roo Code Anda. Lihat [dokumentasi MCP Roo Code](https://docs.roocode.com/features/mcp/using-mcp-in-roo) untuk info lebih lanjut.

#### Koneksi Server Remote Roo Code

```json
{
  "mcpServers": {
    "twinmcp": {
      "type": "streamable-http",
      "url": "https://mcp.twinmcp.com/mcp"
    }
  }
}
```

#### Koneksi Server Lokal Roo Code

```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Instal di Zencoder</b></summary>

Untuk mengonfigurasi TwinMCP MCP di Zencoder, ikuti langkah-langkah berikut:
1. Pergi ke menu Zencoder (...)
2. Dari menu dropdown, pilih Alat Agen
3. Klik Tambah MCP Kustom
4. Tambahkan nama dan konfigurasi server dari bawah, dan pastikan untuk menekan tombol Instal
```json
{
    "command": "npx",
    "args": [
        "-y",
        "@upstash/twinmcp-mcp@latest"
    ]
}
```
Setelah server MCP ditambahkan, Anda dapat dengan mudah terus menggunakannya.
</details>

<details>
<summary><b>Instal di Amazon Q Developer CLI</b></summary>

Tambahkan ini ke file konfigurasi Amazon Q Developer CLI Anda. Lihat [dokumentasi Amazon Q Developer CLI](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-mcp-configuration.html) untuk detail lebih lanjut.
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
</details>

<details>
<summary><b>Instal di Qodo Gen</b></summary>

Lihat [dokumentasi Qodo Gen](https://docs.qodo.ai/qodo-documentation/qodo-gen/qodo-gen-chat/agentic-mode/agentic-tools-mcps) untuk detail lebih lanjut.
1. Buka panel obrolan Qodo Gen di VSCode atau IntelliJ.
2. Klik Hubungkan lebih banyak alat.
3. Klik + Tambah MCP baru.
4. Tambahkan konfigurasi berikut:
```json
{
  "mcpServers": {
    "twinmcp": {
      "url": "https://mcp.twinmcp.com/mcp"
    }
  }
}
```
</details>

<details>
<summary><b>Instal di JetBrains AI Assistant</b></summary>

Lihat [Dokumentasi JetBrains AI Assistant](https://www.jetbrains.com/help/ai-assistant/configure-an-mcp-server.html) untuk detail lebih lanjut.
1. Di IDE JetBrains pergi ke `Pengaturan` -> `Alat` -> `Asisten AI` -> `Protokol Konteks Model (MCP)`
2. Klik `+ Tambah`.
3. Klik pada `Perintah` di pojok kiri atas dialog dan pilih opsi Sebagai JSON dari daftar
4. Tambahkan konfigurasi ini dan klik `OK`
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  }
}
```
5. Klik `Terapkan` untuk menyimpan perubahan.
6. Dengan cara yang sama twinmcp dapat ditambahkan untuk JetBrains Junie di `Pengaturan` -> `Alat` -> `Junie` -> `Pengaturan MCP`
</details>

<details>
<summary><b>Instal di Warp</b></summary>

Lihat [Dokumentasi Protokol Konteks Model Warp](https://docs.warp.dev/knowledge-and-collaboration/mcp#adding-an-mcp-server) untuk detail.
1. Navigasikan `Pengaturan` > `AI` > `Kelola server MCP`.
2. Tambahkan server MCP baru dengan mengklik tombol `+ Tambah`.
3. Tempel konfigurasi yang diberikan di bawah:
```json
{
  "TwinMCP": {
    "command": "npx",
    "args": [
      "-y",
      "@upstash/twinmcp-mcp"
    ],
    "env": {},
    "working_directory": null,
    "start_on_launch": true
  }
}
```
4. Klik `Simpan` untuk menerapkan perubahan.
</details>

<details>
<summary><b>Instal di Opencode</b></summary>

Tambahkan ini ke file konfigurasi Opencode Anda. Lihat [dokumentasi MCP Opencode](https://opencode.ai/docs/mcp-servers) untuk info lebih lanjut.

#### Koneksi Server Remote Opencode

```json
"mcp": {
  "twinmcp": {
    "type": "remote",
    "url": "https://mcp.twinmcp.com/mcp",
    "enabled": true
  }
}
```

#### Koneksi Server Lokal Opencode

```json
{
  "mcp": {
    "twinmcp": {
      "type": "local",
      "command": ["npx", "-y", "@upstash/twinmcp-mcp"],
      "enabled": true
    }
  }
}
```
</details>

<details>
<summary><b>Instal di Copilot Coding Agent</b></summary>

## Menggunakan TwinMCP dengan Copilot Coding Agent
Tambahkan konfigurasi berikut ke bagian `mcp` file konfigurasi Copilot Coding Agent Anda Repositori->Pengaturan->Copilot->Coding agent->Konfigurasi MCP:
```json
{
  "mcpServers": {
    "twinmcp": {
      "type": "http",
      "url": "https://mcp.twinmcp.com/mcp",
      "tools": [
        "query-docs",
        "resolve-library-id"
      ]
    }
  }
}
```
Untuk informasi lebih lanjut, lihat [dokumentasi resmi GitHub](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/agents/copilot-coding-agent/extending-copilot-coding-agent-with-mcp).
</details>

<details>
<summary><b>Instal di Copilot CLI</b></summary>

1.  Buka file konfigurasi MCP Copilot CLI. Lokasinya adalah `~/.copilot/mcp-config.json` (di mana `~` adalah direktori home Anda).
2.  Tambahkan yang berikut ke objek `mcpServers` di file `mcp-config.json` Anda:
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
Atau, untuk server lokal:
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
Jika file `mcp-config.json` tidak ada, buatlah.
</details>

<details>
<summary><b>Instal di Kiro</b></summary>

Lihat [Dokumentasi Protokol Konteks Model Kiro](https://kiro.dev/docs/mcp/configuration/) untuk detail.
1. Navigasikan `Kiro` > `Server MCP`
2. Tambahkan server MCP baru dengan mengklik tombol `+ Tambah`.
3. Tempel konfigurasi yang diberikan di bawah:
```json
{
  "mcpServers": {
    "TwinMCP": {
    "command": "npx",
    "args": [
      "-y",
      "@upstash/twinmcp-mcp"
    ],
    "env": {},
    "disabled": false,
    "autoApprove": []
    }
  }
}
```
4. Klik `Simpan` untuk menerapkan perubahan.
</details>

<details>
<summary><b>Instal di OpenAI Codex</b></summary>

Lihat [OpenAI Codex](https://github.com/openai/codex) untuk informasi lebih lanjut.
Tambahkan konfigurasi berikut ke pengaturan server MCP OpenAI Codex Anda:

#### Koneksi Server Lokal

```toml
[mcp_servers.twinmcp]
args = ["-y", "@upstash/twinmcp-mcp"]
command = "npx"
```

#### Koneksi Server Jarak Jauh

```toml
[mcp_servers.twinmcp]
url = "https://mcp.twinmcp.com/mcp"
http_headers = { "TWINMCP_API_KEY" = "YOUR_API_KEY" }
```
</details>

<details>
<summary><b>Instal di LM Studio</b></summary>

Lihat [Dukungan MCP LM Studio](https://lmstudio.ai/blog/lmstudio-v0.3.17) untuk informasi lebih lanjut.

#### Instal satu klik:
[![Add MCP Server twinmcp to LM Studio](https://files.lmstudio.ai/deeplink/mcp-install-light.svg)](https://lmstudio.ai/install-mcp?name=twinmcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB1cHN0YXNoL2NvbnRleHQ3LW1jcCJdfQ%3D%3D)

#### Pengaturan manual:
1. Navigasikan ke `Program` (sisi kanan) > `Instal` > `Edit mcp.json`.
2. Tempel konfigurasi yang diberikan di bawah:
```json
{
  "mcpServers": {
    "TwinMCP": {
      "command": "npx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  }
}
```
3. Klik `Simpan` untuk menerapkan perubahan.
4. Aktifkan/nonaktifkan server MCP dari sisi kanan, di bawah `Program`, atau dengan mengklik ikon colokan di bagian bawah kotak obrolan.
</details>

## 🔨 Alat yang Tersedia
TwinMCP MCP menyediakan alat berikut yang dapat digunakan oleh LLM:
- `resolve-library-id`: Mengubah nama pustaka umum menjadi ID pustaka yang kompatibel dengan TwinMCP.
  - `query` (wajib): Pertanyaan atau tugas pengguna (untuk peringkat relevansi)
  - `libraryName` (wajib): Nama pustaka yang ingin dicari
- `query-docs`: Mengambil dokumentasi untuk pustaka menggunakan ID pustaka yang kompatibel dengan TwinMCP.
  - `libraryId` (wajib): ID pustaka yang kompatibel dengan TwinMCP (contoh: `/mongodb/docs`, `/vercel/next.js`)
  - `query` (wajib): Pertanyaan atau tugas untuk mendapatkan dokumentasi yang relevan

## 🛟 Tips

### Tambahkan Aturan
> Jika Anda tidak ingin menambahkan `use twinmcp` ke setiap permintaan, Anda dapat menentukan aturan sederhana di file `.windsurfrules` Anda di Windsurf atau dari bagian `Cursor Settings > Rules` di Cursor (atau yang setara di klien MCP Anda) untuk memanggil TwinMCP secara otomatis pada setiap pertanyaan kode:
>
> ```toml
> [[calls]]
> match = "when the user requests code examples, setup or configuration steps, or library/API documentation"
> tool  = "twinmcp"
> ```
>
> Mulai saat itu, Anda akan mendapatkan dokumen TwinMCP dalam setiap percakapan terkait tanpa mengetik sesuatu tambahan. Anda dapat menambahkan kasus penggunaan Anda ke bagian match.

### Gunakan ID Pustaka
> Jika Anda sudah tahu persis pustaka mana yang ingin digunakan, tambahkan ID TwinMCP-nya ke permintaan Anda. Dengan begitu, server MCP TwinMCP dapat melewati langkah pencocokan pustaka dan langsung mengambil dokumen.
>
> ```txt
> implementasikan otentikasi dasar dengan supabase. gunakan pustaka /supabase/supabase untuk api dan docs
> ```
>
> Sintaks garis miring memberi tahu alat MCP pustaka mana yang harus dimuat dokumennya.

## 💻 Pengembangan
Salin proyek dan instal dependensi:
```bash
pnpm i
```
Bangun:
```bash
pnpm run build
```
Jalankan server:
```bash
node packages/mcp/dist/index.js
```

### Argumen CLI
`twinmcp-mcp` menerima bendera CLI berikut:
- `--transport <stdio|http>` – Transportasi yang digunakan (`stdio` secara default).
- `--port <number>` – Port yang didengarkan saat menggunakan transport `http` (default `3000`).
  Contoh dengan transport http dan port 8080:
```bash
node packages/mcp/dist/index.js --transport http --port 8080
```
<details>
<summary><b>Contoh Konfigurasi Lokal</b></summary>

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
</details>

<details>
<summary><b>Pengujian dengan MCP Inspector</b></summary>

```bash
npx -y @modelcontextprotocol/inspector npx @upstash/twinmcp-mcp
```
</details>

## 🚨 Pemecahan Masalah
<details>
<summary><b>Kesalahan Modul Tidak Ditemukan</b></summary>

Jika Anda mengalami `ERR_MODULE_NOT_FOUND`, coba gunakan `bunx` alih-alih `npx`:
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "bunx",
      "args": ["-y", "@upstash/twinmcp-mcp"]
    }
  }
}
```
Ini sering menyelesaikan masalah penyelesaian modul di lingkungan di mana `npx` tidak menginstal atau menyelesaikan paket dengan benar.
</details>

<details>
<summary><b>Masalah Resolusi ESM</b></summary>

Untuk kesalahan seperti `Error: Cannot find module 'uriTemplate.js'`, coba gunakan bendera `--experimental-vm-modules`:
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
</details>

<details>
<summary><b>Masalah TLS/Sertifikat</b></summary>

Gunakan bendera `--experimental-fetch` untuk melewati masalah terkait TLS:
```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "npx",
      "args": ["-y", "--node-options=--experimental-fetch", "@upstash/twinmcp-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Kesalahan Umum Klien MCP</b></summary>

1. Coba tambahkan `@latest` ke nama paket
2. Gunakan `bunx` sebagai alternatif `npx`
3. Pertimbangkan menggunakan `deno` sebagai alternatif lain
4. Pastikan Anda menggunakan Node.js v18 atau lebih tinggi untuk dukungan fetch native
</details>

## ⚠️ Penafian
Proyek TwinMCP dikontribusikan oleh komunitas dan meskipun kami berusaha menjaga kualitas tinggi, kami tidak dapat menjamin keakuratan, kelengkapan, atau keamanan semua dokumentasi pustaka. Proyek yang terdaftar di TwinMCP dikembangkan dan dikelola oleh pemilik masing-masing, bukan oleh TwinMCP. Jika Anda menemukan konten yang mencurigakan, tidak pantas, atau berpotensi membahayakan, gunakan tombol "Laporkan" di halaman proyek untuk segera memberi tahu kami. Kami memperlakukan semua laporan dengan serius dan akan segera meninjau konten yang dilaporkan untuk menjaga integritas dan keamanan platform kami. Dengan menggunakan TwinMCP, Anda mengakui bahwa Anda melakukannya atas kebijaksanaan dan risiko Anda sendiri.

## 🤝 Terhubung dengan Kami
Tetap terbaru dan bergabunglah dengan komunitas kami:
- 📢 Ikuti kami di [X](https://x.com/twinmcpai) untuk berita dan pembaruan terbaru
- 🌐 Kunjungi [Situs Web](https://twinmcp.com) kami
- 💬 Bergabunglah dengan [Komunitas Discord](https://upstash.com/discord) kami

## 📺 TwinMCP Di Media
- [Better Stack: "Free Tool Makes Cursor 10x Smarter"](https://youtu.be/52FC3qObp9E)
- [Cole Medin: "This is Hands Down the BEST MCP Server for AI Coding Assistants"](https://www.youtube.com/watch?v=G7gK8H6u7Rs)
- [Income Stream Surfers: "TwinMCP + SequentialThinking MCPs: Is This AGI?"](https://www.youtube.com/watch?v=-ggvzyLpK6o)
- [Julian Goldie SEO: "TwinMCP: New MCP AI Agent Update"](https://www.youtube.com/watch?v=CTZm6fBYisc)
- [JeredBlu: "Context 7 MCP: Get Documentation Instantly + VS Code Setup"](https://www.youtube.com/watch?v=-ls0D-rtET4)
- [Income Stream Surfers: "TwinMCP: The New MCP Server That Will CHANGE AI Coding"](https://www.youtube.com/watch?v=PS-2Azb-C3M)
- [AICodeKing: "TwinMCP + Cline & RooCode: This MCP Server Makes CLINE 100X MORE EFFECTIVE!"](https://www.youtube.com/watch?v=qZfENAPMnyo)
- [Sean Kochel: "5 MCP Servers For Vibe Coding Glory (Just Plug-In & Go)"](https://www.youtube.com/watch?v=LqTQi8qexJM)

## ⭐ Sejarah Bintang
[![Star History Chart](https://api.star-history.com/svg?repos=upstash/twinmcp&type=Date)](https://www.star-history.com/#upstash/twinmcp&Date)

## 📄 Lisensi
MIT
