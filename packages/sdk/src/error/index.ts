export class TwinMCPError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TwinMCPError";
  }
}
