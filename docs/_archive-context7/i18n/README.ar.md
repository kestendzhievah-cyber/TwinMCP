# TwinMCP MCP - توثيق أكواد محدث لأي أمر برمجي

[![Website](https://img.shields.io/badge/Website-twinmcp.com-blue)](https://twinmcp.com) [![smithery badge](https://smithery.ai/badge/@upstash/twinmcp-mcp)](https://smithery.ai/server/@upstash/twinmcp-mcp) [<img alt="Install in VS Code (npx)" src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20TwinMCP%20MCP&color=0098FF">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22twinmcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Ftwinmcp-mcp%40latest%22%5D%7D)

## ❌ بدون TwinMCP

تعتمد النماذج اللغوية الكبيرة على معلومات قديمة أو عامة حول المكتبات التي تستخدمها. مما يؤدي إلى:

- ❌ أمثلة أكواد قديمة مبنية على بيانات تدريب مضى عليها وقت طويل
- ❌ واجهات برمجة تطبيقات وهمية غير موجودة
- ❌ إجابات عامة لنسخ قديمة من الحزم

## ✅ مع TwinMCP

يستخرج TwinMCP MCP التوثيق والأمثلة البرمجية المحدثة مباشرة من المصدر — ويضعها في طلبك للنموذج.
أضف `use twinmcp` إلى طلبك في Cursor:

```txt
أنشئ مشروع Next.js بسيط باستخدام app router. use twinmcp
```

```txt
أنشئ سكربت لحذف الصفوف التي تكون فيها المدينة فارغة "" باستخدام بيانات اعتماد PostgreSQL. use twinmcp
```

يقوم TwinMCP بجلب الأمثلة المحدثة والتوثيق المناسب مباشرة إلى السياق.

- 1️⃣ اكتب طلبك بشكل طبيعي
- 2️⃣ أخبر النموذج بـ `use twinmcp`
- 3️⃣ احصل على أكواد تعمل مباشرة
  لا حاجة للتنقل بين التبويبات، لا واجهات برمجة تطبيقات وهمية، لا أكواد قديمة.

## 🛠️ البدء

### المتطلبات

- Node.js إصدار 18.0.0 أو أعلى
- Cursor، Windsurf، Claude Desktop أو أي عميل MCP آخر

### التثبيت عبر Smithery

لتثبيت TwinMCP MCP Server تلقائيًا لـ Claude Desktop:

```bash
npx -y @smithery/cli install @upstash/twinmcp-mcp --client claude
```

### التثبيت في Cursor

اذهب إلى: `Settings` -> `Cursor Settings` -> `MCP` -> `Add new global MCP server`
أو أضف هذا إلى ملف `~/.cursor/mcp.json`:

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

### التثبيت باستخدام Bun

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

### التثبيت باستخدام Deno

```json
{
  "mcpServers": {
    "twinmcp": {
      "command": "deno",
      "args": ["run", "--allow-env", "--allow-net", "npm:@upstash/twinmcp-mcp"]
    }
  }
}
```

### التثبيت في Windsurf

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

### التثبيت في VS Code

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

### التثبيت في Zed

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

### التثبيت في Claude Code

```sh
claude mcp add --scope user twinmcp -- npx -y @upstash/twinmcp-mcp@latest
```

### التثبيت في Claude Desktop

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

### التثبيت في BoltAI

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

### التثبيت في Copilot Coding Agent

أضف التكوين التالي إلى قسم `mcp` في ملف إعدادات Copilot Coding Agent الخاص بك Repository->Settings->Copilot->Coding agent->MCP configuration:

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

لمزيد من المعلومات، راجع [التوثيق الرسمي على GitHub](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/agents/copilot-coding-agent/extending-copilot-coding-agent-with-mcp).

### باستخدام Docker

**Dockerfile:**

```Dockerfile
FROM node:18-alpine
WORKDIR /app
RUN npm install -g @upstash/twinmcp-mcp@latest
CMD ["twinmcp-mcp"]
```

**بناء الصورة:**

```bash
docker build -t twinmcp-mcp .
```

**التهيئة داخل العميل:**

```json
{
  "mcpServers": {
    "TwinMCP": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "twinmcp-mcp"],
      "transportType": "stdio"
    }
  }
}
```

### التثبيت في Windows

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

### الأدوات المتوفرة

- `resolve-library-id`: يحول اسم مكتبة عام إلى معرف متوافق مع TwinMCP.
  - `query` (مطلوب): سؤال أو مهمة المستخدم (لترتيب الصلة)
  - `libraryName` (مطلوب): اسم المكتبة للبحث عنها
- `query-docs`: يستخرج التوثيق حسب المعرف.
  - `libraryId` (مطلوب): معرف TwinMCP المتوافق الدقيق (مثل `/mongodb/docs`, `/vercel/next.js`)
  - `query` (مطلوب): السؤال أو المهمة للحصول على توثيق ذي صلة

## التطوير

```bash
pnpm i
pnpm run build
```

**التهيئة المحلية:**

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

**الاختبار باستخدام MCP Inspector:**

```bash
npx -y @modelcontextprotocol/inspector npx @upstash/twinmcp-mcp@latest
```

## استكشاف الأخطاء

### ERR_MODULE_NOT_FOUND

استخدم `bunx` بدلاً من `npx`.

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

### مشاكل في ESM

جرّب إضافة:

```json
{
  "command": "npx",
  "args": ["-y", "--node-options=--experimental-vm-modules", "@upstash/twinmcp-mcp@1.0.6"]
}
```

### أخطاء عميل MCP

1. أزل `@latest`
2. جرّب `bunx`
3. جرّب `deno`
4. تأكد أنك تستخدم Node v18 أو أحدث

## إخلاء مسؤولية

المشاريع المدرجة في TwinMCP مساهم بها من المجتمع، ولا يمكن ضمان دقتها أو أمانها بشكل كامل. الرجاء الإبلاغ عن أي محتوى مريب باستخدام زر "الإبلاغ".

## TwinMCP في الإعلام

- [Better Stack: "أداة مجانية تجعل Cursor أذكى 10x"](https://youtu.be/52FC3qObp9E)
- [Cole Medin: "أفضل MCP Server لمساعدين الذكاء الاصطناعي البرمجيين"](https://www.youtube.com/watch?v=G7gK8H6u7Rs)
- [TwinMCP + SequentialThinking: هل هذا AGI؟](https://www.youtube.com/watch?v=-ggvzyLpK6o)
- [تحديث جديد من TwinMCP MCP](https://www.youtube.com/watch?v=CTZm6fBYisc)
- [إعداد TwinMCP في VS Code](https://www.youtube.com/watch?v=-ls0D-rtET4)
- [TwinMCP: MCP جديد سيغير البرمجة](https://www.youtube.com/watch?v=PS-2Azb-C3M)
- [Cline & RooCode + TwinMCP: قوة مضاعفة](https://www.youtube.com/watch?v=qZfENAPMnyo)
- [أفضل 5 MCP Servers لتجربة برمجة ساحرة](https://www.youtube.com/watch?v=LqTQi8qexJM)

## سجل النجوم

[![Star History Chart](https://api.star-history.com/svg?repos=upstash/twinmcp&type=Date)](https://www.star-history.com/#upstash/twinmcp&Date)

## الترخيص

MIT
