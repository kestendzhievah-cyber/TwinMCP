// Types globaux pour l'application

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
      apiKeyData?: {
        id: string;
        userId: string;
        keyPrefix: string;
        quotaRequestsPerMinute: number;
        quotaRequestsPerDay: number;
      };
    }
  }

  interface Request {
    query: Record<string, string | string[] | undefined>;
    params: Record<string, string>;
    body: any;
    headers: Record<string, string>;
    method: string;
    url: string;
  }

  interface ServerResponse {
    status(code: number): ServerResponse;
    json(data: any): ServerResponse;
    send(data: any): ServerResponse;
    end(): ServerResponse;
  }

  type NextFunction = (err?: any) => void;
}

export {};
