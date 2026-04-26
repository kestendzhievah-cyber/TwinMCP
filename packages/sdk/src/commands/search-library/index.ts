import { Command } from "@commands/command";
import type { Library, SearchLibraryOptions } from "@commands/types";
import type { ApiSearchResponse } from "./types";
import type { Requester } from "@http";
import { TwinMCPError } from "@error";
import { formatLibrary, formatLibrariesAsText } from "@utils/format";

const DEFAULT_TYPE = "json";

export class SearchLibraryCommand extends Command<Library[] | string> {
  private readonly responseType: "json" | "txt";

  constructor(query: string, libraryName: string, options?: SearchLibraryOptions) {
    if (!query || !libraryName) {
      throw new TwinMCPError("query and libraryName are required");
    }

    const queryParams: Record<string, string | number | undefined> = {};

    queryParams.query = query;
    queryParams.libraryName = libraryName;

    super({ method: "GET", query: queryParams }, "v2/libs/search");

    this.responseType = options?.type ?? DEFAULT_TYPE;
  }

  public override async exec(client: Requester): Promise<Library[] | string> {
    const { result } = await client.request<ApiSearchResponse>({
      method: this.request.method || "GET",
      path: [this.endpoint],
      query: this.request.query,
    });

    if (result === undefined) {
      throw new TwinMCPError("Request did not return a result");
    }

    const libraries = result.results.map(formatLibrary);

    if (this.responseType === "txt") {
      return formatLibrariesAsText(libraries);
    }

    return libraries;
  }
}
