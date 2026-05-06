import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Extends the Zod prototype with .openapi() — must be called before any schema
// uses .openapi(). Importing this module triggers the side effect once.
extendZodWithOpenApi(z);
