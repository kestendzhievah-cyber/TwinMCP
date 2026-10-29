import { Command } from "commander";
import pc from "picocolors";
import figlet from "figlet";
import { registerAuthCommands } from "./commands/auth.js";
import { registerSetupCommand } from "./commands/setup.js";
import { registerDocsCommands } from "./commands/docs.js";
import { registerConnectCommand } from "./commands/connect.js";
import { registerHostingCommands } from "./commands/hosting.js";
import { setBaseUrl } from "./utils/api.js";
import { VERSION } from "./constants.js";

const brand = {
  primary: pc.green,
  dim: pc.dim,
};

const program = new Command();

program
  .name("twinmcp")
  .description("TwinMCP CLI - host MCP servers, connect AI clients, and run local tools")
  .version(VERSION)
  .option("--base-url <url>", "TwinMCP API origin (default https://twinmcp.fr)")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.baseUrl) {
      setBaseUrl(opts.baseUrl);
    }
  })
  .addHelpText(
    "after",
    `
Examples:
  ${brand.dim("# Log in with a full-access API key from the dashboard")}
  ${brand.primary("twinmcp login")}

  ${brand.dim("# Create a server and install MCPs on it")}
  ${brand.primary("twinmcp servers create my-tools")}
  ${brand.primary("twinmcp mcp search brave")}
  ${brand.primary("twinmcp mcp install my-tools fetch")}

  ${brand.dim("# Connect an AI client (writes the URL and a key bound to the server)")}
  ${brand.primary("twinmcp setup --server my-tools --cursor")}
  ${brand.primary("twinmcp url my-tools --router")}

  ${brand.dim("# Run local tools (local-agent server) on this machine")}
  ${brand.primary("twinmcp connect --server my-desktop")}

  ${brand.dim("# Query library documentation")}
  ${brand.primary('twinmcp library react "how to use hooks"')}
  ${brand.primary('twinmcp docs /facebook/react "useEffect examples"')}

Without a global install, prefix commands with ${brand.primary("npx @twinmcp/cli")}.
Visit ${brand.primary("https://twinmcp.fr")}
`
  );

registerHostingCommands(program);
registerAuthCommands(program);
registerSetupCommand(program);
registerDocsCommands(program);
registerConnectCommand(program);

program.action(() => {
  console.log("");
  const banner = figlet.textSync("TwinMCP", { font: "ANSI Shadow" });
  console.log(brand.primary(banner));
  console.log(brand.dim("  Managed MCP servers for every AI client"));
  console.log("");

  console.log("  Quick start:");
  console.log(`    ${brand.primary("twinmcp login")}`);
  console.log(`    ${brand.primary("twinmcp servers list")}`);
  console.log(`    ${brand.primary("twinmcp setup --server <slug>")}`);
  console.log("");

  console.log(`  Run ${brand.primary("twinmcp --help")} for all commands and options`);
  console.log(`  Visit ${brand.primary("https://twinmcp.fr")}`);
  console.log("");
});

program.parse();
