
/**
 * Client
**/

import * as runtime from './runtime/library';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions

export type PrismaPromise<T> = $Public.PrismaPromise<T>


export type ClientPayload<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
  name: "Client"
  objects: {
    modules: ModuleOnClientPayload<ExtArgs>[]
    environmentVariables: EnvironmentVariablePayload<ExtArgs>[]
  }
  scalars: $Extensions.GetResult<{
    id: string
    name: string
    domain: string | null
    apiKeys: Prisma.JsonValue
    settings: Prisma.JsonValue | null
    createdAt: Date
    updatedAt: Date
  }, ExtArgs["result"]["client"]>
  composites: {}
}

/**
 * Model Client
 * 
 */
export type Client = runtime.Types.DefaultSelection<ClientPayload>
export type ModulePayload<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
  name: "Module"
  objects: {
    clients: ModuleOnClientPayload<ExtArgs>[]
  }
  scalars: $Extensions.GetResult<{
    id: string
    name: string
    description: string | null
    version: string | null
  }, ExtArgs["result"]["module"]>
  composites: {}
}

/**
 * Model Module
 * 
 */
export type Module = runtime.Types.DefaultSelection<ModulePayload>
export type ModuleOnClientPayload<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
  name: "ModuleOnClient"
  objects: {
    client: ClientPayload<ExtArgs>
    module: ModulePayload<ExtArgs>
  }
  scalars: $Extensions.GetResult<{
    id: string
    clientId: string
    moduleId: string
    enabled: boolean
  }, ExtArgs["result"]["moduleOnClient"]>
  composites: {}
}

/**
 * Model ModuleOnClient
 * 
 */
export type ModuleOnClient = runtime.Types.DefaultSelection<ModuleOnClientPayload>
export type EnvironmentVariablePayload<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
  name: "EnvironmentVariable"
  objects: {
    client: ClientPayload<ExtArgs>
  }
  scalars: $Extensions.GetResult<{
    id: string
    key: string
    value: string
    environment: Environment
    clientId: string
  }, ExtArgs["result"]["environmentVariable"]>
  composites: {}
}

/**
 * Model EnvironmentVariable
 * 
 */
export type EnvironmentVariable = runtime.Types.DefaultSelection<EnvironmentVariablePayload>
export type UserPayload<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
  name: "User"
  objects: {
    orders: OrderPayload<ExtArgs>[]
    cart: CartPayload<ExtArgs> | null
    mcpConfigurations: MCPConfigurationPayload<ExtArgs>[]
    products: ProductPayload<ExtArgs>[]
  }
  scalars: $Extensions.GetResult<{
    id: string
    email: string
    name: string | null
    avatar: string | null
    role: Role
    createdAt: Date
    updatedAt: Date
  }, ExtArgs["result"]["user"]>
  composites: {}
}

/**
 * Model User
 * 
 */
export type User = runtime.Types.DefaultSelection<UserPayload>
export type CategoryPayload<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
  name: "Category"
  objects: {
    products: ProductPayload<ExtArgs>[]
  }
  scalars: $Extensions.GetResult<{
    id: string
    name: string
    description: string | null
    createdAt: Date
  }, ExtArgs["result"]["category"]>
  composites: {}
}

/**
 * Model Category
 * 
 */
export type Category = runtime.Types.DefaultSelection<CategoryPayload>
export type ProductPayload<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
  name: "Product"
  objects: {
    category: CategoryPayload<ExtArgs>
    seller: UserPayload<ExtArgs>
    orderItems: OrderItemPayload<ExtArgs>[]
    mcpConfigurations: MCPConfigurationPayload<ExtArgs>[]
    cartItems: CartItemPayload<ExtArgs>[]
  }
  scalars: $Extensions.GetResult<{
    id: string
    name: string
    description: string
    price: number
    image: string | null
    categoryId: string
    sellerId: string
    status: Status
    createdAt: Date
    updatedAt: Date
  }, ExtArgs["result"]["product"]>
  composites: {}
}

/**
 * Model Product
 * 
 */
export type Product = runtime.Types.DefaultSelection<ProductPayload>
export type OrderPayload<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
  name: "Order"
  objects: {
    user: UserPayload<ExtArgs>
    items: OrderItemPayload<ExtArgs>[]
  }
  scalars: $Extensions.GetResult<{
    id: string
    userId: string
    total: number
    status: OrderStatus
    createdAt: Date
    updatedAt: Date
  }, ExtArgs["result"]["order"]>
  composites: {}
}

/**
 * Model Order
 * 
 */
export type Order = runtime.Types.DefaultSelection<OrderPayload>
export type OrderItemPayload<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
  name: "OrderItem"
  objects: {
    order: OrderPayload<ExtArgs>
    product: ProductPayload<ExtArgs>
  }
  scalars: $Extensions.GetResult<{
    id: string
    orderId: string
    productId: string
    quantity: number
    price: number
  }, ExtArgs["result"]["orderItem"]>
  composites: {}
}

/**
 * Model OrderItem
 * 
 */
export type OrderItem = runtime.Types.DefaultSelection<OrderItemPayload>
export type CartPayload<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
  name: "Cart"
  objects: {
    user: UserPayload<ExtArgs>
    items: CartItemPayload<ExtArgs>[]
  }
  scalars: $Extensions.GetResult<{
    id: string
    userId: string
  }, ExtArgs["result"]["cart"]>
  composites: {}
}

/**
 * Model Cart
 * 
 */
export type Cart = runtime.Types.DefaultSelection<CartPayload>
export type CartItemPayload<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
  name: "CartItem"
  objects: {
    cart: CartPayload<ExtArgs>
    product: ProductPayload<ExtArgs>
  }
  scalars: $Extensions.GetResult<{
    id: string
    cartId: string
    productId: string
    quantity: number
  }, ExtArgs["result"]["cartItem"]>
  composites: {}
}

/**
 * Model CartItem
 * 
 */
export type CartItem = runtime.Types.DefaultSelection<CartItemPayload>
export type MCPConfigurationPayload<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
  name: "MCPConfiguration"
  objects: {
    user: UserPayload<ExtArgs>
    product: ProductPayload<ExtArgs> | null
  }
  scalars: $Extensions.GetResult<{
    id: string
    name: string
    description: string | null
    configData: Prisma.JsonValue
    status: ConfigStatus
    userId: string
    productId: string | null
    createdAt: Date
    updatedAt: Date
  }, ExtArgs["result"]["mCPConfiguration"]>
  composites: {}
}

/**
 * Model MCPConfiguration
 * 
 */
export type MCPConfiguration = runtime.Types.DefaultSelection<MCPConfigurationPayload>

/**
 * Enums
 */

export const Environment: {
  DEVELOPMENT: 'DEVELOPMENT',
  STAGING: 'STAGING',
  PRODUCTION: 'PRODUCTION'
};

export type Environment = (typeof Environment)[keyof typeof Environment]


export const Role: {
  BUYER: 'BUYER',
  SELLER: 'SELLER',
  ADMIN: 'ADMIN'
};

export type Role = (typeof Role)[keyof typeof Role]


export const Status: {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  DRAFT: 'DRAFT'
};

export type Status = (typeof Status)[keyof typeof Status]


export const OrderStatus: {
  PENDING: 'PENDING',
  PAID: 'PAID',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
};

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]


export const ConfigStatus: {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  TESTING: 'TESTING',
  ERROR: 'ERROR'
};

export type ConfigStatus = (typeof ConfigStatus)[keyof typeof ConfigStatus]


/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Clients
 * const clients = await prisma.client.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  T extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof T ? T['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<T['log']> : never : never,
  ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Clients
   * const clients = await prisma.client.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<T, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): Promise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => Promise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<R>


  $extends: $Extensions.ExtendsHook<'extends', Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.client`: Exposes CRUD operations for the **Client** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Clients
    * const clients = await prisma.client.findMany()
    * ```
    */
  get client(): Prisma.ClientDelegate<ExtArgs>;

  /**
   * `prisma.module`: Exposes CRUD operations for the **Module** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Modules
    * const modules = await prisma.module.findMany()
    * ```
    */
  get module(): Prisma.ModuleDelegate<ExtArgs>;

  /**
   * `prisma.moduleOnClient`: Exposes CRUD operations for the **ModuleOnClient** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ModuleOnClients
    * const moduleOnClients = await prisma.moduleOnClient.findMany()
    * ```
    */
  get moduleOnClient(): Prisma.ModuleOnClientDelegate<ExtArgs>;

  /**
   * `prisma.environmentVariable`: Exposes CRUD operations for the **EnvironmentVariable** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more EnvironmentVariables
    * const environmentVariables = await prisma.environmentVariable.findMany()
    * ```
    */
  get environmentVariable(): Prisma.EnvironmentVariableDelegate<ExtArgs>;

  /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs>;

  /**
   * `prisma.category`: Exposes CRUD operations for the **Category** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Categories
    * const categories = await prisma.category.findMany()
    * ```
    */
  get category(): Prisma.CategoryDelegate<ExtArgs>;

  /**
   * `prisma.product`: Exposes CRUD operations for the **Product** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Products
    * const products = await prisma.product.findMany()
    * ```
    */
  get product(): Prisma.ProductDelegate<ExtArgs>;

  /**
   * `prisma.order`: Exposes CRUD operations for the **Order** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Orders
    * const orders = await prisma.order.findMany()
    * ```
    */
  get order(): Prisma.OrderDelegate<ExtArgs>;

  /**
   * `prisma.orderItem`: Exposes CRUD operations for the **OrderItem** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more OrderItems
    * const orderItems = await prisma.orderItem.findMany()
    * ```
    */
  get orderItem(): Prisma.OrderItemDelegate<ExtArgs>;

  /**
   * `prisma.cart`: Exposes CRUD operations for the **Cart** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Carts
    * const carts = await prisma.cart.findMany()
    * ```
    */
  get cart(): Prisma.CartDelegate<ExtArgs>;

  /**
   * `prisma.cartItem`: Exposes CRUD operations for the **CartItem** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CartItems
    * const cartItems = await prisma.cartItem.findMany()
    * ```
    */
  get cartItem(): Prisma.CartItemDelegate<ExtArgs>;

  /**
   * `prisma.mCPConfiguration`: Exposes CRUD operations for the **MCPConfiguration** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MCPConfigurations
    * const mCPConfigurations = await prisma.mCPConfiguration.findMany()
    * ```
    */
  get mCPConfiguration(): Prisma.MCPConfigurationDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql

  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export type Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export type Args<T, F extends $Public.Operation> = $Public.Args<T, F>
  export type Payload<T, F extends $Public.Operation> = $Public.Payload<T, F>
  export type Result<T, A, F extends $Public.Operation> = $Public.Result<T, A, F>
  export type Exact<T, W> = $Public.Exact<T, W>

  /**
   * Prisma Client JS version: 5.0.0
   * Query Engine version: 6b0aef69b7cdfc787f822ecd7cdc76d5f1991584
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */

  /**
   * From https://github.com/sindresorhus/type-fest/
   * Matches a JSON object.
   * This type can be useful to enforce some input to be JSON-compatible or as a super-type to be extended from. 
   */
  export type JsonObject = {[Key in string]?: JsonValue}

  /**
   * From https://github.com/sindresorhus/type-fest/
   * Matches a JSON array.
   */
  export interface JsonArray extends Array<JsonValue> {}

  /**
   * From https://github.com/sindresorhus/type-fest/
   * Matches any valid JSON value.
   */
  export type JsonValue = string | number | boolean | JsonObject | JsonArray | null

  /**
   * Matches a JSON object.
   * Unlike `JsonObject`, this type allows undefined and read-only properties.
   */
  export type InputJsonObject = {readonly [Key in string]?: InputJsonValue | null}

  /**
   * Matches a JSON array.
   * Unlike `JsonArray`, readonly arrays are assignable to this type.
   */
  export interface InputJsonArray extends ReadonlyArray<InputJsonValue | null> {}

  /**
   * Matches any valid value that can be used as an input for operations like
   * create and update as the value of a JSON field. Unlike `JsonValue`, this
   * type allows read-only arrays and read-only object properties and disallows
   * `null` at the top level.
   *
   * `null` cannot be used as the value of a JSON field because its meaning
   * would be ambiguous. Use `Prisma.JsonNull` to store the JSON null value or
   * `Prisma.DbNull` to clear the JSON value and set the field to the database
   * NULL value instead.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-by-null-values
   */
  export type InputJsonValue = string | number | boolean | InputJsonObject | InputJsonArray

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }
  type HasSelect = {
    select: any
  }
  type HasInclude = {
    include: any
  }
  type CheckSelect<T, S, U> = T extends SelectAndInclude
    ? 'Please either choose `select` or `include`'
    : T extends HasSelect
    ? U
    : T extends HasInclude
    ? U
    : S

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => Promise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Client: 'Client',
    Module: 'Module',
    ModuleOnClient: 'ModuleOnClient',
    EnvironmentVariable: 'EnvironmentVariable',
    User: 'User',
    Category: 'Category',
    Product: 'Product',
    Order: 'Order',
    OrderItem: 'OrderItem',
    Cart: 'Cart',
    CartItem: 'CartItem',
    MCPConfiguration: 'MCPConfiguration'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }


  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.Args}, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs']>
  }

  export type TypeMap<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    meta: {
      modelProps: 'client' | 'module' | 'moduleOnClient' | 'environmentVariable' | 'user' | 'category' | 'product' | 'order' | 'orderItem' | 'cart' | 'cartItem' | 'mCPConfiguration'
      txIsolationLevel: Prisma.TransactionIsolationLevel
    },
    model: {
      Client: {
        payload: ClientPayload<ExtArgs>
        fields: Prisma.ClientFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ClientFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ClientPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ClientFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ClientPayload>
          }
          findFirst: {
            args: Prisma.ClientFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ClientPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ClientFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ClientPayload>
          }
          findMany: {
            args: Prisma.ClientFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ClientPayload>[]
          }
          create: {
            args: Prisma.ClientCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ClientPayload>
          }
          createMany: {
            args: Prisma.ClientCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.ClientDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ClientPayload>
          }
          update: {
            args: Prisma.ClientUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ClientPayload>
          }
          deleteMany: {
            args: Prisma.ClientDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.ClientUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.ClientUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ClientPayload>
          }
          aggregate: {
            args: Prisma.ClientAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateClient>
          }
          groupBy: {
            args: Prisma.ClientGroupByArgs<ExtArgs>,
            result: $Utils.Optional<ClientGroupByOutputType>[]
          }
          count: {
            args: Prisma.ClientCountArgs<ExtArgs>,
            result: $Utils.Optional<ClientCountAggregateOutputType> | number
          }
        }
      }
      Module: {
        payload: ModulePayload<ExtArgs>
        fields: Prisma.ModuleFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ModuleFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModulePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ModuleFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModulePayload>
          }
          findFirst: {
            args: Prisma.ModuleFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModulePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ModuleFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModulePayload>
          }
          findMany: {
            args: Prisma.ModuleFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModulePayload>[]
          }
          create: {
            args: Prisma.ModuleCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModulePayload>
          }
          createMany: {
            args: Prisma.ModuleCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.ModuleDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModulePayload>
          }
          update: {
            args: Prisma.ModuleUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModulePayload>
          }
          deleteMany: {
            args: Prisma.ModuleDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.ModuleUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.ModuleUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModulePayload>
          }
          aggregate: {
            args: Prisma.ModuleAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateModule>
          }
          groupBy: {
            args: Prisma.ModuleGroupByArgs<ExtArgs>,
            result: $Utils.Optional<ModuleGroupByOutputType>[]
          }
          count: {
            args: Prisma.ModuleCountArgs<ExtArgs>,
            result: $Utils.Optional<ModuleCountAggregateOutputType> | number
          }
        }
      }
      ModuleOnClient: {
        payload: ModuleOnClientPayload<ExtArgs>
        fields: Prisma.ModuleOnClientFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ModuleOnClientFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModuleOnClientPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ModuleOnClientFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModuleOnClientPayload>
          }
          findFirst: {
            args: Prisma.ModuleOnClientFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModuleOnClientPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ModuleOnClientFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModuleOnClientPayload>
          }
          findMany: {
            args: Prisma.ModuleOnClientFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModuleOnClientPayload>[]
          }
          create: {
            args: Prisma.ModuleOnClientCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModuleOnClientPayload>
          }
          createMany: {
            args: Prisma.ModuleOnClientCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.ModuleOnClientDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModuleOnClientPayload>
          }
          update: {
            args: Prisma.ModuleOnClientUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModuleOnClientPayload>
          }
          deleteMany: {
            args: Prisma.ModuleOnClientDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.ModuleOnClientUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.ModuleOnClientUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ModuleOnClientPayload>
          }
          aggregate: {
            args: Prisma.ModuleOnClientAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateModuleOnClient>
          }
          groupBy: {
            args: Prisma.ModuleOnClientGroupByArgs<ExtArgs>,
            result: $Utils.Optional<ModuleOnClientGroupByOutputType>[]
          }
          count: {
            args: Prisma.ModuleOnClientCountArgs<ExtArgs>,
            result: $Utils.Optional<ModuleOnClientCountAggregateOutputType> | number
          }
        }
      }
      EnvironmentVariable: {
        payload: EnvironmentVariablePayload<ExtArgs>
        fields: Prisma.EnvironmentVariableFieldRefs
        operations: {
          findUnique: {
            args: Prisma.EnvironmentVariableFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<EnvironmentVariablePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.EnvironmentVariableFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<EnvironmentVariablePayload>
          }
          findFirst: {
            args: Prisma.EnvironmentVariableFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<EnvironmentVariablePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.EnvironmentVariableFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<EnvironmentVariablePayload>
          }
          findMany: {
            args: Prisma.EnvironmentVariableFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<EnvironmentVariablePayload>[]
          }
          create: {
            args: Prisma.EnvironmentVariableCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<EnvironmentVariablePayload>
          }
          createMany: {
            args: Prisma.EnvironmentVariableCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.EnvironmentVariableDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<EnvironmentVariablePayload>
          }
          update: {
            args: Prisma.EnvironmentVariableUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<EnvironmentVariablePayload>
          }
          deleteMany: {
            args: Prisma.EnvironmentVariableDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.EnvironmentVariableUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.EnvironmentVariableUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<EnvironmentVariablePayload>
          }
          aggregate: {
            args: Prisma.EnvironmentVariableAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateEnvironmentVariable>
          }
          groupBy: {
            args: Prisma.EnvironmentVariableGroupByArgs<ExtArgs>,
            result: $Utils.Optional<EnvironmentVariableGroupByOutputType>[]
          }
          count: {
            args: Prisma.EnvironmentVariableCountArgs<ExtArgs>,
            result: $Utils.Optional<EnvironmentVariableCountAggregateOutputType> | number
          }
        }
      }
      User: {
        payload: UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>,
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>,
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      Category: {
        payload: CategoryPayload<ExtArgs>
        fields: Prisma.CategoryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CategoryFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CategoryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CategoryFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CategoryPayload>
          }
          findFirst: {
            args: Prisma.CategoryFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CategoryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CategoryFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CategoryPayload>
          }
          findMany: {
            args: Prisma.CategoryFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CategoryPayload>[]
          }
          create: {
            args: Prisma.CategoryCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CategoryPayload>
          }
          createMany: {
            args: Prisma.CategoryCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.CategoryDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CategoryPayload>
          }
          update: {
            args: Prisma.CategoryUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CategoryPayload>
          }
          deleteMany: {
            args: Prisma.CategoryDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.CategoryUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.CategoryUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CategoryPayload>
          }
          aggregate: {
            args: Prisma.CategoryAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateCategory>
          }
          groupBy: {
            args: Prisma.CategoryGroupByArgs<ExtArgs>,
            result: $Utils.Optional<CategoryGroupByOutputType>[]
          }
          count: {
            args: Prisma.CategoryCountArgs<ExtArgs>,
            result: $Utils.Optional<CategoryCountAggregateOutputType> | number
          }
        }
      }
      Product: {
        payload: ProductPayload<ExtArgs>
        fields: Prisma.ProductFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ProductFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ProductPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ProductFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ProductPayload>
          }
          findFirst: {
            args: Prisma.ProductFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ProductPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ProductFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ProductPayload>
          }
          findMany: {
            args: Prisma.ProductFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ProductPayload>[]
          }
          create: {
            args: Prisma.ProductCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ProductPayload>
          }
          createMany: {
            args: Prisma.ProductCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.ProductDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ProductPayload>
          }
          update: {
            args: Prisma.ProductUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ProductPayload>
          }
          deleteMany: {
            args: Prisma.ProductDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.ProductUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.ProductUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<ProductPayload>
          }
          aggregate: {
            args: Prisma.ProductAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateProduct>
          }
          groupBy: {
            args: Prisma.ProductGroupByArgs<ExtArgs>,
            result: $Utils.Optional<ProductGroupByOutputType>[]
          }
          count: {
            args: Prisma.ProductCountArgs<ExtArgs>,
            result: $Utils.Optional<ProductCountAggregateOutputType> | number
          }
        }
      }
      Order: {
        payload: OrderPayload<ExtArgs>
        fields: Prisma.OrderFieldRefs
        operations: {
          findUnique: {
            args: Prisma.OrderFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.OrderFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderPayload>
          }
          findFirst: {
            args: Prisma.OrderFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.OrderFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderPayload>
          }
          findMany: {
            args: Prisma.OrderFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderPayload>[]
          }
          create: {
            args: Prisma.OrderCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderPayload>
          }
          createMany: {
            args: Prisma.OrderCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.OrderDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderPayload>
          }
          update: {
            args: Prisma.OrderUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderPayload>
          }
          deleteMany: {
            args: Prisma.OrderDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.OrderUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.OrderUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderPayload>
          }
          aggregate: {
            args: Prisma.OrderAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateOrder>
          }
          groupBy: {
            args: Prisma.OrderGroupByArgs<ExtArgs>,
            result: $Utils.Optional<OrderGroupByOutputType>[]
          }
          count: {
            args: Prisma.OrderCountArgs<ExtArgs>,
            result: $Utils.Optional<OrderCountAggregateOutputType> | number
          }
        }
      }
      OrderItem: {
        payload: OrderItemPayload<ExtArgs>
        fields: Prisma.OrderItemFieldRefs
        operations: {
          findUnique: {
            args: Prisma.OrderItemFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderItemPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.OrderItemFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderItemPayload>
          }
          findFirst: {
            args: Prisma.OrderItemFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderItemPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.OrderItemFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderItemPayload>
          }
          findMany: {
            args: Prisma.OrderItemFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderItemPayload>[]
          }
          create: {
            args: Prisma.OrderItemCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderItemPayload>
          }
          createMany: {
            args: Prisma.OrderItemCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.OrderItemDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderItemPayload>
          }
          update: {
            args: Prisma.OrderItemUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderItemPayload>
          }
          deleteMany: {
            args: Prisma.OrderItemDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.OrderItemUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.OrderItemUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<OrderItemPayload>
          }
          aggregate: {
            args: Prisma.OrderItemAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateOrderItem>
          }
          groupBy: {
            args: Prisma.OrderItemGroupByArgs<ExtArgs>,
            result: $Utils.Optional<OrderItemGroupByOutputType>[]
          }
          count: {
            args: Prisma.OrderItemCountArgs<ExtArgs>,
            result: $Utils.Optional<OrderItemCountAggregateOutputType> | number
          }
        }
      }
      Cart: {
        payload: CartPayload<ExtArgs>
        fields: Prisma.CartFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CartFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CartFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartPayload>
          }
          findFirst: {
            args: Prisma.CartFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CartFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartPayload>
          }
          findMany: {
            args: Prisma.CartFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartPayload>[]
          }
          create: {
            args: Prisma.CartCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartPayload>
          }
          createMany: {
            args: Prisma.CartCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.CartDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartPayload>
          }
          update: {
            args: Prisma.CartUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartPayload>
          }
          deleteMany: {
            args: Prisma.CartDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.CartUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.CartUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartPayload>
          }
          aggregate: {
            args: Prisma.CartAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateCart>
          }
          groupBy: {
            args: Prisma.CartGroupByArgs<ExtArgs>,
            result: $Utils.Optional<CartGroupByOutputType>[]
          }
          count: {
            args: Prisma.CartCountArgs<ExtArgs>,
            result: $Utils.Optional<CartCountAggregateOutputType> | number
          }
        }
      }
      CartItem: {
        payload: CartItemPayload<ExtArgs>
        fields: Prisma.CartItemFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CartItemFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartItemPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CartItemFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartItemPayload>
          }
          findFirst: {
            args: Prisma.CartItemFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartItemPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CartItemFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartItemPayload>
          }
          findMany: {
            args: Prisma.CartItemFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartItemPayload>[]
          }
          create: {
            args: Prisma.CartItemCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartItemPayload>
          }
          createMany: {
            args: Prisma.CartItemCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.CartItemDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartItemPayload>
          }
          update: {
            args: Prisma.CartItemUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartItemPayload>
          }
          deleteMany: {
            args: Prisma.CartItemDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.CartItemUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.CartItemUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<CartItemPayload>
          }
          aggregate: {
            args: Prisma.CartItemAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateCartItem>
          }
          groupBy: {
            args: Prisma.CartItemGroupByArgs<ExtArgs>,
            result: $Utils.Optional<CartItemGroupByOutputType>[]
          }
          count: {
            args: Prisma.CartItemCountArgs<ExtArgs>,
            result: $Utils.Optional<CartItemCountAggregateOutputType> | number
          }
        }
      }
      MCPConfiguration: {
        payload: MCPConfigurationPayload<ExtArgs>
        fields: Prisma.MCPConfigurationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MCPConfigurationFindUniqueArgs<ExtArgs>,
            result: $Utils.PayloadToResult<MCPConfigurationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MCPConfigurationFindUniqueOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<MCPConfigurationPayload>
          }
          findFirst: {
            args: Prisma.MCPConfigurationFindFirstArgs<ExtArgs>,
            result: $Utils.PayloadToResult<MCPConfigurationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MCPConfigurationFindFirstOrThrowArgs<ExtArgs>,
            result: $Utils.PayloadToResult<MCPConfigurationPayload>
          }
          findMany: {
            args: Prisma.MCPConfigurationFindManyArgs<ExtArgs>,
            result: $Utils.PayloadToResult<MCPConfigurationPayload>[]
          }
          create: {
            args: Prisma.MCPConfigurationCreateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<MCPConfigurationPayload>
          }
          createMany: {
            args: Prisma.MCPConfigurationCreateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          delete: {
            args: Prisma.MCPConfigurationDeleteArgs<ExtArgs>,
            result: $Utils.PayloadToResult<MCPConfigurationPayload>
          }
          update: {
            args: Prisma.MCPConfigurationUpdateArgs<ExtArgs>,
            result: $Utils.PayloadToResult<MCPConfigurationPayload>
          }
          deleteMany: {
            args: Prisma.MCPConfigurationDeleteManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          updateMany: {
            args: Prisma.MCPConfigurationUpdateManyArgs<ExtArgs>,
            result: Prisma.BatchPayload
          }
          upsert: {
            args: Prisma.MCPConfigurationUpsertArgs<ExtArgs>,
            result: $Utils.PayloadToResult<MCPConfigurationPayload>
          }
          aggregate: {
            args: Prisma.MCPConfigurationAggregateArgs<ExtArgs>,
            result: $Utils.Optional<AggregateMCPConfiguration>
          }
          groupBy: {
            args: Prisma.MCPConfigurationGroupByArgs<ExtArgs>,
            result: $Utils.Optional<MCPConfigurationGroupByOutputType>[]
          }
          count: {
            args: Prisma.MCPConfigurationCountArgs<ExtArgs>,
            result: $Utils.Optional<MCPConfigurationCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<'define', Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'

  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources

    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat

    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: Array<LogLevel | LogDefinition>
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findMany'
    | 'findFirst'
    | 'create'
    | 'createMany'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => Promise<T>,
  ) => Promise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type ClientCountOutputType
   */


  export type ClientCountOutputType = {
    modules: number
    environmentVariables: number
  }

  export type ClientCountOutputTypeSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    modules?: boolean | ClientCountOutputTypeCountModulesArgs
    environmentVariables?: boolean | ClientCountOutputTypeCountEnvironmentVariablesArgs
  }

  // Custom InputTypes

  /**
   * ClientCountOutputType without action
   */
  export type ClientCountOutputTypeArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClientCountOutputType
     */
    select?: ClientCountOutputTypeSelect<ExtArgs> | null
  }


  /**
   * ClientCountOutputType without action
   */
  export type ClientCountOutputTypeCountModulesArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: ModuleOnClientWhereInput
  }


  /**
   * ClientCountOutputType without action
   */
  export type ClientCountOutputTypeCountEnvironmentVariablesArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: EnvironmentVariableWhereInput
  }



  /**
   * Count Type ModuleCountOutputType
   */


  export type ModuleCountOutputType = {
    clients: number
  }

  export type ModuleCountOutputTypeSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    clients?: boolean | ModuleCountOutputTypeCountClientsArgs
  }

  // Custom InputTypes

  /**
   * ModuleCountOutputType without action
   */
  export type ModuleCountOutputTypeArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleCountOutputType
     */
    select?: ModuleCountOutputTypeSelect<ExtArgs> | null
  }


  /**
   * ModuleCountOutputType without action
   */
  export type ModuleCountOutputTypeCountClientsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: ModuleOnClientWhereInput
  }



  /**
   * Count Type UserCountOutputType
   */


  export type UserCountOutputType = {
    orders: number
    mcpConfigurations: number
    products: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    orders?: boolean | UserCountOutputTypeCountOrdersArgs
    mcpConfigurations?: boolean | UserCountOutputTypeCountMcpConfigurationsArgs
    products?: boolean | UserCountOutputTypeCountProductsArgs
  }

  // Custom InputTypes

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }


  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountOrdersArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: OrderWhereInput
  }


  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountMcpConfigurationsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: MCPConfigurationWhereInput
  }


  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountProductsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: ProductWhereInput
  }



  /**
   * Count Type CategoryCountOutputType
   */


  export type CategoryCountOutputType = {
    products: number
  }

  export type CategoryCountOutputTypeSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    products?: boolean | CategoryCountOutputTypeCountProductsArgs
  }

  // Custom InputTypes

  /**
   * CategoryCountOutputType without action
   */
  export type CategoryCountOutputTypeArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryCountOutputType
     */
    select?: CategoryCountOutputTypeSelect<ExtArgs> | null
  }


  /**
   * CategoryCountOutputType without action
   */
  export type CategoryCountOutputTypeCountProductsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: ProductWhereInput
  }



  /**
   * Count Type ProductCountOutputType
   */


  export type ProductCountOutputType = {
    orderItems: number
    mcpConfigurations: number
    cartItems: number
  }

  export type ProductCountOutputTypeSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    orderItems?: boolean | ProductCountOutputTypeCountOrderItemsArgs
    mcpConfigurations?: boolean | ProductCountOutputTypeCountMcpConfigurationsArgs
    cartItems?: boolean | ProductCountOutputTypeCountCartItemsArgs
  }

  // Custom InputTypes

  /**
   * ProductCountOutputType without action
   */
  export type ProductCountOutputTypeArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProductCountOutputType
     */
    select?: ProductCountOutputTypeSelect<ExtArgs> | null
  }


  /**
   * ProductCountOutputType without action
   */
  export type ProductCountOutputTypeCountOrderItemsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: OrderItemWhereInput
  }


  /**
   * ProductCountOutputType without action
   */
  export type ProductCountOutputTypeCountMcpConfigurationsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: MCPConfigurationWhereInput
  }


  /**
   * ProductCountOutputType without action
   */
  export type ProductCountOutputTypeCountCartItemsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: CartItemWhereInput
  }



  /**
   * Count Type OrderCountOutputType
   */


  export type OrderCountOutputType = {
    items: number
  }

  export type OrderCountOutputTypeSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    items?: boolean | OrderCountOutputTypeCountItemsArgs
  }

  // Custom InputTypes

  /**
   * OrderCountOutputType without action
   */
  export type OrderCountOutputTypeArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderCountOutputType
     */
    select?: OrderCountOutputTypeSelect<ExtArgs> | null
  }


  /**
   * OrderCountOutputType without action
   */
  export type OrderCountOutputTypeCountItemsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: OrderItemWhereInput
  }



  /**
   * Count Type CartCountOutputType
   */


  export type CartCountOutputType = {
    items: number
  }

  export type CartCountOutputTypeSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    items?: boolean | CartCountOutputTypeCountItemsArgs
  }

  // Custom InputTypes

  /**
   * CartCountOutputType without action
   */
  export type CartCountOutputTypeArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartCountOutputType
     */
    select?: CartCountOutputTypeSelect<ExtArgs> | null
  }


  /**
   * CartCountOutputType without action
   */
  export type CartCountOutputTypeCountItemsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: CartItemWhereInput
  }



  /**
   * Models
   */

  /**
   * Model Client
   */


  export type AggregateClient = {
    _count: ClientCountAggregateOutputType | null
    _min: ClientMinAggregateOutputType | null
    _max: ClientMaxAggregateOutputType | null
  }

  export type ClientMinAggregateOutputType = {
    id: string | null
    name: string | null
    domain: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ClientMaxAggregateOutputType = {
    id: string | null
    name: string | null
    domain: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ClientCountAggregateOutputType = {
    id: number
    name: number
    domain: number
    apiKeys: number
    settings: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ClientMinAggregateInputType = {
    id?: true
    name?: true
    domain?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ClientMaxAggregateInputType = {
    id?: true
    name?: true
    domain?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ClientCountAggregateInputType = {
    id?: true
    name?: true
    domain?: true
    apiKeys?: true
    settings?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ClientAggregateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Client to aggregate.
     */
    where?: ClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Clients to fetch.
     */
    orderBy?: ClientOrderByWithRelationInput | ClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Clients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Clients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Clients
    **/
    _count?: true | ClientCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ClientMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ClientMaxAggregateInputType
  }

  export type GetClientAggregateType<T extends ClientAggregateArgs> = {
        [P in keyof T & keyof AggregateClient]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateClient[P]>
      : GetScalarType<T[P], AggregateClient[P]>
  }




  export type ClientGroupByArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: ClientWhereInput
    orderBy?: ClientOrderByWithAggregationInput | ClientOrderByWithAggregationInput[]
    by: ClientScalarFieldEnum[] | ClientScalarFieldEnum
    having?: ClientScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ClientCountAggregateInputType | true
    _min?: ClientMinAggregateInputType
    _max?: ClientMaxAggregateInputType
  }


  export type ClientGroupByOutputType = {
    id: string
    name: string
    domain: string | null
    apiKeys: JsonValue
    settings: JsonValue | null
    createdAt: Date
    updatedAt: Date
    _count: ClientCountAggregateOutputType | null
    _min: ClientMinAggregateOutputType | null
    _max: ClientMaxAggregateOutputType | null
  }

  type GetClientGroupByPayload<T extends ClientGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ClientGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ClientGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ClientGroupByOutputType[P]>
            : GetScalarType<T[P], ClientGroupByOutputType[P]>
        }
      >
    >


  export type ClientSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    domain?: boolean
    apiKeys?: boolean
    settings?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    modules?: boolean | Client$modulesArgs<ExtArgs>
    environmentVariables?: boolean | Client$environmentVariablesArgs<ExtArgs>
    _count?: boolean | ClientCountOutputTypeArgs<ExtArgs>
  }, ExtArgs["result"]["client"]>

  export type ClientSelectScalar = {
    id?: boolean
    name?: boolean
    domain?: boolean
    apiKeys?: boolean
    settings?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ClientInclude<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    modules?: boolean | Client$modulesArgs<ExtArgs>
    environmentVariables?: boolean | Client$environmentVariablesArgs<ExtArgs>
    _count?: boolean | ClientCountOutputTypeArgs<ExtArgs>
  }


  type ClientGetPayload<S extends boolean | null | undefined | ClientArgs> = $Types.GetResult<ClientPayload, S>

  type ClientCountArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = 
    Omit<ClientFindManyArgs, 'select' | 'include'> & {
      select?: ClientCountAggregateInputType | true
    }

  export interface ClientDelegate<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Client'], meta: { name: 'Client' } }
    /**
     * Find zero or one Client that matches the filter.
     * @param {ClientFindUniqueArgs} args - Arguments to find a Client
     * @example
     * // Get one Client
     * const client = await prisma.client.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends ClientFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, ClientFindUniqueArgs<ExtArgs>>
    ): Prisma__ClientClient<$Types.GetResult<ClientPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one Client that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {ClientFindUniqueOrThrowArgs} args - Arguments to find a Client
     * @example
     * // Get one Client
     * const client = await prisma.client.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends ClientFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, ClientFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__ClientClient<$Types.GetResult<ClientPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first Client that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientFindFirstArgs} args - Arguments to find a Client
     * @example
     * // Get one Client
     * const client = await prisma.client.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends ClientFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, ClientFindFirstArgs<ExtArgs>>
    ): Prisma__ClientClient<$Types.GetResult<ClientPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first Client that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientFindFirstOrThrowArgs} args - Arguments to find a Client
     * @example
     * // Get one Client
     * const client = await prisma.client.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends ClientFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, ClientFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__ClientClient<$Types.GetResult<ClientPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more Clients that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Clients
     * const clients = await prisma.client.findMany()
     * 
     * // Get first 10 Clients
     * const clients = await prisma.client.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const clientWithIdOnly = await prisma.client.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends ClientFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ClientFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Types.GetResult<ClientPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a Client.
     * @param {ClientCreateArgs} args - Arguments to create a Client.
     * @example
     * // Create one Client
     * const Client = await prisma.client.create({
     *   data: {
     *     // ... data to create a Client
     *   }
     * })
     * 
    **/
    create<T extends ClientCreateArgs<ExtArgs>>(
      args: SelectSubset<T, ClientCreateArgs<ExtArgs>>
    ): Prisma__ClientClient<$Types.GetResult<ClientPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many Clients.
     *     @param {ClientCreateManyArgs} args - Arguments to create many Clients.
     *     @example
     *     // Create many Clients
     *     const client = await prisma.client.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends ClientCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ClientCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Client.
     * @param {ClientDeleteArgs} args - Arguments to delete one Client.
     * @example
     * // Delete one Client
     * const Client = await prisma.client.delete({
     *   where: {
     *     // ... filter to delete one Client
     *   }
     * })
     * 
    **/
    delete<T extends ClientDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, ClientDeleteArgs<ExtArgs>>
    ): Prisma__ClientClient<$Types.GetResult<ClientPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one Client.
     * @param {ClientUpdateArgs} args - Arguments to update one Client.
     * @example
     * // Update one Client
     * const client = await prisma.client.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends ClientUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, ClientUpdateArgs<ExtArgs>>
    ): Prisma__ClientClient<$Types.GetResult<ClientPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more Clients.
     * @param {ClientDeleteManyArgs} args - Arguments to filter Clients to delete.
     * @example
     * // Delete a few Clients
     * const { count } = await prisma.client.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends ClientDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ClientDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Clients.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Clients
     * const client = await prisma.client.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends ClientUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, ClientUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Client.
     * @param {ClientUpsertArgs} args - Arguments to update or create a Client.
     * @example
     * // Update or create a Client
     * const client = await prisma.client.upsert({
     *   create: {
     *     // ... data to create a Client
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Client we want to update
     *   }
     * })
    **/
    upsert<T extends ClientUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, ClientUpsertArgs<ExtArgs>>
    ): Prisma__ClientClient<$Types.GetResult<ClientPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of Clients.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientCountArgs} args - Arguments to filter Clients to count.
     * @example
     * // Count the number of Clients
     * const count = await prisma.client.count({
     *   where: {
     *     // ... the filter for the Clients we want to count
     *   }
     * })
    **/
    count<T extends ClientCountArgs>(
      args?: Subset<T, ClientCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ClientCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Client.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ClientAggregateArgs>(args: Subset<T, ClientAggregateArgs>): Prisma.PrismaPromise<GetClientAggregateType<T>>

    /**
     * Group by Client.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClientGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ClientGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ClientGroupByArgs['orderBy'] }
        : { orderBy?: ClientGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ClientGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetClientGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Client model
   */
  readonly fields: ClientFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Client.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__ClientClient<T, Null = never, ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> implements Prisma.PrismaPromise<T> {
    private readonly _dmmf;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);

    modules<T extends Client$modulesArgs<ExtArgs> = {}>(args?: Subset<T, Client$modulesArgs<ExtArgs>>): Prisma.PrismaPromise<$Types.GetResult<ModuleOnClientPayload<ExtArgs>, T, 'findMany'>| Null>;

    environmentVariables<T extends Client$environmentVariablesArgs<ExtArgs> = {}>(args?: Subset<T, Client$environmentVariablesArgs<ExtArgs>>): Prisma.PrismaPromise<$Types.GetResult<EnvironmentVariablePayload<ExtArgs>, T, 'findMany'>| Null>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }



  /**
   * Fields of the Client model
   */ 
  interface ClientFieldRefs {
    readonly id: FieldRef<"Client", 'String'>
    readonly name: FieldRef<"Client", 'String'>
    readonly domain: FieldRef<"Client", 'String'>
    readonly apiKeys: FieldRef<"Client", 'Json'>
    readonly settings: FieldRef<"Client", 'Json'>
    readonly createdAt: FieldRef<"Client", 'DateTime'>
    readonly updatedAt: FieldRef<"Client", 'DateTime'>
  }
    

  // Custom InputTypes

  /**
   * Client findUnique
   */
  export type ClientFindUniqueArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * Filter, which Client to fetch.
     */
    where: ClientWhereUniqueInput
  }


  /**
   * Client findUniqueOrThrow
   */
  export type ClientFindUniqueOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * Filter, which Client to fetch.
     */
    where: ClientWhereUniqueInput
  }


  /**
   * Client findFirst
   */
  export type ClientFindFirstArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * Filter, which Client to fetch.
     */
    where?: ClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Clients to fetch.
     */
    orderBy?: ClientOrderByWithRelationInput | ClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Clients.
     */
    cursor?: ClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Clients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Clients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Clients.
     */
    distinct?: ClientScalarFieldEnum | ClientScalarFieldEnum[]
  }


  /**
   * Client findFirstOrThrow
   */
  export type ClientFindFirstOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * Filter, which Client to fetch.
     */
    where?: ClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Clients to fetch.
     */
    orderBy?: ClientOrderByWithRelationInput | ClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Clients.
     */
    cursor?: ClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Clients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Clients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Clients.
     */
    distinct?: ClientScalarFieldEnum | ClientScalarFieldEnum[]
  }


  /**
   * Client findMany
   */
  export type ClientFindManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * Filter, which Clients to fetch.
     */
    where?: ClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Clients to fetch.
     */
    orderBy?: ClientOrderByWithRelationInput | ClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Clients.
     */
    cursor?: ClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Clients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Clients.
     */
    skip?: number
    distinct?: ClientScalarFieldEnum | ClientScalarFieldEnum[]
  }


  /**
   * Client create
   */
  export type ClientCreateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * The data needed to create a Client.
     */
    data: XOR<ClientCreateInput, ClientUncheckedCreateInput>
  }


  /**
   * Client createMany
   */
  export type ClientCreateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Clients.
     */
    data: ClientCreateManyInput | ClientCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * Client update
   */
  export type ClientUpdateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * The data needed to update a Client.
     */
    data: XOR<ClientUpdateInput, ClientUncheckedUpdateInput>
    /**
     * Choose, which Client to update.
     */
    where: ClientWhereUniqueInput
  }


  /**
   * Client updateMany
   */
  export type ClientUpdateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Clients.
     */
    data: XOR<ClientUpdateManyMutationInput, ClientUncheckedUpdateManyInput>
    /**
     * Filter which Clients to update
     */
    where?: ClientWhereInput
  }


  /**
   * Client upsert
   */
  export type ClientUpsertArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * The filter to search for the Client to update in case it exists.
     */
    where: ClientWhereUniqueInput
    /**
     * In case the Client found by the `where` argument doesn't exist, create a new Client with this data.
     */
    create: XOR<ClientCreateInput, ClientUncheckedCreateInput>
    /**
     * In case the Client was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ClientUpdateInput, ClientUncheckedUpdateInput>
  }


  /**
   * Client delete
   */
  export type ClientDeleteArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
    /**
     * Filter which Client to delete.
     */
    where: ClientWhereUniqueInput
  }


  /**
   * Client deleteMany
   */
  export type ClientDeleteManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Clients to delete
     */
    where?: ClientWhereInput
  }


  /**
   * Client.modules
   */
  export type Client$modulesArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleOnClient
     */
    select?: ModuleOnClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleOnClientInclude<ExtArgs> | null
    where?: ModuleOnClientWhereInput
    orderBy?: ModuleOnClientOrderByWithRelationInput | ModuleOnClientOrderByWithRelationInput[]
    cursor?: ModuleOnClientWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ModuleOnClientScalarFieldEnum | ModuleOnClientScalarFieldEnum[]
  }


  /**
   * Client.environmentVariables
   */
  export type Client$environmentVariablesArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnvironmentVariable
     */
    select?: EnvironmentVariableSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: EnvironmentVariableInclude<ExtArgs> | null
    where?: EnvironmentVariableWhereInput
    orderBy?: EnvironmentVariableOrderByWithRelationInput | EnvironmentVariableOrderByWithRelationInput[]
    cursor?: EnvironmentVariableWhereUniqueInput
    take?: number
    skip?: number
    distinct?: EnvironmentVariableScalarFieldEnum | EnvironmentVariableScalarFieldEnum[]
  }


  /**
   * Client without action
   */
  export type ClientArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Client
     */
    select?: ClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ClientInclude<ExtArgs> | null
  }



  /**
   * Model Module
   */


  export type AggregateModule = {
    _count: ModuleCountAggregateOutputType | null
    _min: ModuleMinAggregateOutputType | null
    _max: ModuleMaxAggregateOutputType | null
  }

  export type ModuleMinAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    version: string | null
  }

  export type ModuleMaxAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    version: string | null
  }

  export type ModuleCountAggregateOutputType = {
    id: number
    name: number
    description: number
    version: number
    _all: number
  }


  export type ModuleMinAggregateInputType = {
    id?: true
    name?: true
    description?: true
    version?: true
  }

  export type ModuleMaxAggregateInputType = {
    id?: true
    name?: true
    description?: true
    version?: true
  }

  export type ModuleCountAggregateInputType = {
    id?: true
    name?: true
    description?: true
    version?: true
    _all?: true
  }

  export type ModuleAggregateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Module to aggregate.
     */
    where?: ModuleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Modules to fetch.
     */
    orderBy?: ModuleOrderByWithRelationInput | ModuleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ModuleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Modules from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Modules.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Modules
    **/
    _count?: true | ModuleCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ModuleMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ModuleMaxAggregateInputType
  }

  export type GetModuleAggregateType<T extends ModuleAggregateArgs> = {
        [P in keyof T & keyof AggregateModule]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateModule[P]>
      : GetScalarType<T[P], AggregateModule[P]>
  }




  export type ModuleGroupByArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: ModuleWhereInput
    orderBy?: ModuleOrderByWithAggregationInput | ModuleOrderByWithAggregationInput[]
    by: ModuleScalarFieldEnum[] | ModuleScalarFieldEnum
    having?: ModuleScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ModuleCountAggregateInputType | true
    _min?: ModuleMinAggregateInputType
    _max?: ModuleMaxAggregateInputType
  }


  export type ModuleGroupByOutputType = {
    id: string
    name: string
    description: string | null
    version: string | null
    _count: ModuleCountAggregateOutputType | null
    _min: ModuleMinAggregateOutputType | null
    _max: ModuleMaxAggregateOutputType | null
  }

  type GetModuleGroupByPayload<T extends ModuleGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ModuleGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ModuleGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ModuleGroupByOutputType[P]>
            : GetScalarType<T[P], ModuleGroupByOutputType[P]>
        }
      >
    >


  export type ModuleSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    description?: boolean
    version?: boolean
    clients?: boolean | Module$clientsArgs<ExtArgs>
    _count?: boolean | ModuleCountOutputTypeArgs<ExtArgs>
  }, ExtArgs["result"]["module"]>

  export type ModuleSelectScalar = {
    id?: boolean
    name?: boolean
    description?: boolean
    version?: boolean
  }

  export type ModuleInclude<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    clients?: boolean | Module$clientsArgs<ExtArgs>
    _count?: boolean | ModuleCountOutputTypeArgs<ExtArgs>
  }


  type ModuleGetPayload<S extends boolean | null | undefined | ModuleArgs> = $Types.GetResult<ModulePayload, S>

  type ModuleCountArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = 
    Omit<ModuleFindManyArgs, 'select' | 'include'> & {
      select?: ModuleCountAggregateInputType | true
    }

  export interface ModuleDelegate<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Module'], meta: { name: 'Module' } }
    /**
     * Find zero or one Module that matches the filter.
     * @param {ModuleFindUniqueArgs} args - Arguments to find a Module
     * @example
     * // Get one Module
     * const module = await prisma.module.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends ModuleFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, ModuleFindUniqueArgs<ExtArgs>>
    ): Prisma__ModuleClient<$Types.GetResult<ModulePayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one Module that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {ModuleFindUniqueOrThrowArgs} args - Arguments to find a Module
     * @example
     * // Get one Module
     * const module = await prisma.module.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends ModuleFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, ModuleFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__ModuleClient<$Types.GetResult<ModulePayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first Module that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleFindFirstArgs} args - Arguments to find a Module
     * @example
     * // Get one Module
     * const module = await prisma.module.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends ModuleFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, ModuleFindFirstArgs<ExtArgs>>
    ): Prisma__ModuleClient<$Types.GetResult<ModulePayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first Module that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleFindFirstOrThrowArgs} args - Arguments to find a Module
     * @example
     * // Get one Module
     * const module = await prisma.module.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends ModuleFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, ModuleFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__ModuleClient<$Types.GetResult<ModulePayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more Modules that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Modules
     * const modules = await prisma.module.findMany()
     * 
     * // Get first 10 Modules
     * const modules = await prisma.module.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const moduleWithIdOnly = await prisma.module.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends ModuleFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ModuleFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Types.GetResult<ModulePayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a Module.
     * @param {ModuleCreateArgs} args - Arguments to create a Module.
     * @example
     * // Create one Module
     * const Module = await prisma.module.create({
     *   data: {
     *     // ... data to create a Module
     *   }
     * })
     * 
    **/
    create<T extends ModuleCreateArgs<ExtArgs>>(
      args: SelectSubset<T, ModuleCreateArgs<ExtArgs>>
    ): Prisma__ModuleClient<$Types.GetResult<ModulePayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many Modules.
     *     @param {ModuleCreateManyArgs} args - Arguments to create many Modules.
     *     @example
     *     // Create many Modules
     *     const module = await prisma.module.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends ModuleCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ModuleCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Module.
     * @param {ModuleDeleteArgs} args - Arguments to delete one Module.
     * @example
     * // Delete one Module
     * const Module = await prisma.module.delete({
     *   where: {
     *     // ... filter to delete one Module
     *   }
     * })
     * 
    **/
    delete<T extends ModuleDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, ModuleDeleteArgs<ExtArgs>>
    ): Prisma__ModuleClient<$Types.GetResult<ModulePayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one Module.
     * @param {ModuleUpdateArgs} args - Arguments to update one Module.
     * @example
     * // Update one Module
     * const module = await prisma.module.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends ModuleUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, ModuleUpdateArgs<ExtArgs>>
    ): Prisma__ModuleClient<$Types.GetResult<ModulePayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more Modules.
     * @param {ModuleDeleteManyArgs} args - Arguments to filter Modules to delete.
     * @example
     * // Delete a few Modules
     * const { count } = await prisma.module.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends ModuleDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ModuleDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Modules.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Modules
     * const module = await prisma.module.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends ModuleUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, ModuleUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Module.
     * @param {ModuleUpsertArgs} args - Arguments to update or create a Module.
     * @example
     * // Update or create a Module
     * const module = await prisma.module.upsert({
     *   create: {
     *     // ... data to create a Module
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Module we want to update
     *   }
     * })
    **/
    upsert<T extends ModuleUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, ModuleUpsertArgs<ExtArgs>>
    ): Prisma__ModuleClient<$Types.GetResult<ModulePayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of Modules.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleCountArgs} args - Arguments to filter Modules to count.
     * @example
     * // Count the number of Modules
     * const count = await prisma.module.count({
     *   where: {
     *     // ... the filter for the Modules we want to count
     *   }
     * })
    **/
    count<T extends ModuleCountArgs>(
      args?: Subset<T, ModuleCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ModuleCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Module.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ModuleAggregateArgs>(args: Subset<T, ModuleAggregateArgs>): Prisma.PrismaPromise<GetModuleAggregateType<T>>

    /**
     * Group by Module.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ModuleGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ModuleGroupByArgs['orderBy'] }
        : { orderBy?: ModuleGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ModuleGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetModuleGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Module model
   */
  readonly fields: ModuleFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Module.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__ModuleClient<T, Null = never, ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> implements Prisma.PrismaPromise<T> {
    private readonly _dmmf;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);

    clients<T extends Module$clientsArgs<ExtArgs> = {}>(args?: Subset<T, Module$clientsArgs<ExtArgs>>): Prisma.PrismaPromise<$Types.GetResult<ModuleOnClientPayload<ExtArgs>, T, 'findMany'>| Null>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }



  /**
   * Fields of the Module model
   */ 
  interface ModuleFieldRefs {
    readonly id: FieldRef<"Module", 'String'>
    readonly name: FieldRef<"Module", 'String'>
    readonly description: FieldRef<"Module", 'String'>
    readonly version: FieldRef<"Module", 'String'>
  }
    

  // Custom InputTypes

  /**
   * Module findUnique
   */
  export type ModuleFindUniqueArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Module
     */
    select?: ModuleSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleInclude<ExtArgs> | null
    /**
     * Filter, which Module to fetch.
     */
    where: ModuleWhereUniqueInput
  }


  /**
   * Module findUniqueOrThrow
   */
  export type ModuleFindUniqueOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Module
     */
    select?: ModuleSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleInclude<ExtArgs> | null
    /**
     * Filter, which Module to fetch.
     */
    where: ModuleWhereUniqueInput
  }


  /**
   * Module findFirst
   */
  export type ModuleFindFirstArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Module
     */
    select?: ModuleSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleInclude<ExtArgs> | null
    /**
     * Filter, which Module to fetch.
     */
    where?: ModuleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Modules to fetch.
     */
    orderBy?: ModuleOrderByWithRelationInput | ModuleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Modules.
     */
    cursor?: ModuleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Modules from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Modules.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Modules.
     */
    distinct?: ModuleScalarFieldEnum | ModuleScalarFieldEnum[]
  }


  /**
   * Module findFirstOrThrow
   */
  export type ModuleFindFirstOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Module
     */
    select?: ModuleSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleInclude<ExtArgs> | null
    /**
     * Filter, which Module to fetch.
     */
    where?: ModuleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Modules to fetch.
     */
    orderBy?: ModuleOrderByWithRelationInput | ModuleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Modules.
     */
    cursor?: ModuleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Modules from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Modules.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Modules.
     */
    distinct?: ModuleScalarFieldEnum | ModuleScalarFieldEnum[]
  }


  /**
   * Module findMany
   */
  export type ModuleFindManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Module
     */
    select?: ModuleSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleInclude<ExtArgs> | null
    /**
     * Filter, which Modules to fetch.
     */
    where?: ModuleWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Modules to fetch.
     */
    orderBy?: ModuleOrderByWithRelationInput | ModuleOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Modules.
     */
    cursor?: ModuleWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Modules from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Modules.
     */
    skip?: number
    distinct?: ModuleScalarFieldEnum | ModuleScalarFieldEnum[]
  }


  /**
   * Module create
   */
  export type ModuleCreateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Module
     */
    select?: ModuleSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleInclude<ExtArgs> | null
    /**
     * The data needed to create a Module.
     */
    data: XOR<ModuleCreateInput, ModuleUncheckedCreateInput>
  }


  /**
   * Module createMany
   */
  export type ModuleCreateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Modules.
     */
    data: ModuleCreateManyInput | ModuleCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * Module update
   */
  export type ModuleUpdateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Module
     */
    select?: ModuleSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleInclude<ExtArgs> | null
    /**
     * The data needed to update a Module.
     */
    data: XOR<ModuleUpdateInput, ModuleUncheckedUpdateInput>
    /**
     * Choose, which Module to update.
     */
    where: ModuleWhereUniqueInput
  }


  /**
   * Module updateMany
   */
  export type ModuleUpdateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Modules.
     */
    data: XOR<ModuleUpdateManyMutationInput, ModuleUncheckedUpdateManyInput>
    /**
     * Filter which Modules to update
     */
    where?: ModuleWhereInput
  }


  /**
   * Module upsert
   */
  export type ModuleUpsertArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Module
     */
    select?: ModuleSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleInclude<ExtArgs> | null
    /**
     * The filter to search for the Module to update in case it exists.
     */
    where: ModuleWhereUniqueInput
    /**
     * In case the Module found by the `where` argument doesn't exist, create a new Module with this data.
     */
    create: XOR<ModuleCreateInput, ModuleUncheckedCreateInput>
    /**
     * In case the Module was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ModuleUpdateInput, ModuleUncheckedUpdateInput>
  }


  /**
   * Module delete
   */
  export type ModuleDeleteArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Module
     */
    select?: ModuleSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleInclude<ExtArgs> | null
    /**
     * Filter which Module to delete.
     */
    where: ModuleWhereUniqueInput
  }


  /**
   * Module deleteMany
   */
  export type ModuleDeleteManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Modules to delete
     */
    where?: ModuleWhereInput
  }


  /**
   * Module.clients
   */
  export type Module$clientsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleOnClient
     */
    select?: ModuleOnClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleOnClientInclude<ExtArgs> | null
    where?: ModuleOnClientWhereInput
    orderBy?: ModuleOnClientOrderByWithRelationInput | ModuleOnClientOrderByWithRelationInput[]
    cursor?: ModuleOnClientWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ModuleOnClientScalarFieldEnum | ModuleOnClientScalarFieldEnum[]
  }


  /**
   * Module without action
   */
  export type ModuleArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Module
     */
    select?: ModuleSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleInclude<ExtArgs> | null
  }



  /**
   * Model ModuleOnClient
   */


  export type AggregateModuleOnClient = {
    _count: ModuleOnClientCountAggregateOutputType | null
    _min: ModuleOnClientMinAggregateOutputType | null
    _max: ModuleOnClientMaxAggregateOutputType | null
  }

  export type ModuleOnClientMinAggregateOutputType = {
    id: string | null
    clientId: string | null
    moduleId: string | null
    enabled: boolean | null
  }

  export type ModuleOnClientMaxAggregateOutputType = {
    id: string | null
    clientId: string | null
    moduleId: string | null
    enabled: boolean | null
  }

  export type ModuleOnClientCountAggregateOutputType = {
    id: number
    clientId: number
    moduleId: number
    enabled: number
    _all: number
  }


  export type ModuleOnClientMinAggregateInputType = {
    id?: true
    clientId?: true
    moduleId?: true
    enabled?: true
  }

  export type ModuleOnClientMaxAggregateInputType = {
    id?: true
    clientId?: true
    moduleId?: true
    enabled?: true
  }

  export type ModuleOnClientCountAggregateInputType = {
    id?: true
    clientId?: true
    moduleId?: true
    enabled?: true
    _all?: true
  }

  export type ModuleOnClientAggregateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which ModuleOnClient to aggregate.
     */
    where?: ModuleOnClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ModuleOnClients to fetch.
     */
    orderBy?: ModuleOnClientOrderByWithRelationInput | ModuleOnClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ModuleOnClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ModuleOnClients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ModuleOnClients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ModuleOnClients
    **/
    _count?: true | ModuleOnClientCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ModuleOnClientMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ModuleOnClientMaxAggregateInputType
  }

  export type GetModuleOnClientAggregateType<T extends ModuleOnClientAggregateArgs> = {
        [P in keyof T & keyof AggregateModuleOnClient]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateModuleOnClient[P]>
      : GetScalarType<T[P], AggregateModuleOnClient[P]>
  }




  export type ModuleOnClientGroupByArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: ModuleOnClientWhereInput
    orderBy?: ModuleOnClientOrderByWithAggregationInput | ModuleOnClientOrderByWithAggregationInput[]
    by: ModuleOnClientScalarFieldEnum[] | ModuleOnClientScalarFieldEnum
    having?: ModuleOnClientScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ModuleOnClientCountAggregateInputType | true
    _min?: ModuleOnClientMinAggregateInputType
    _max?: ModuleOnClientMaxAggregateInputType
  }


  export type ModuleOnClientGroupByOutputType = {
    id: string
    clientId: string
    moduleId: string
    enabled: boolean
    _count: ModuleOnClientCountAggregateOutputType | null
    _min: ModuleOnClientMinAggregateOutputType | null
    _max: ModuleOnClientMaxAggregateOutputType | null
  }

  type GetModuleOnClientGroupByPayload<T extends ModuleOnClientGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ModuleOnClientGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ModuleOnClientGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ModuleOnClientGroupByOutputType[P]>
            : GetScalarType<T[P], ModuleOnClientGroupByOutputType[P]>
        }
      >
    >


  export type ModuleOnClientSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    clientId?: boolean
    moduleId?: boolean
    enabled?: boolean
    client?: boolean | ClientArgs<ExtArgs>
    module?: boolean | ModuleArgs<ExtArgs>
  }, ExtArgs["result"]["moduleOnClient"]>

  export type ModuleOnClientSelectScalar = {
    id?: boolean
    clientId?: boolean
    moduleId?: boolean
    enabled?: boolean
  }

  export type ModuleOnClientInclude<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    client?: boolean | ClientArgs<ExtArgs>
    module?: boolean | ModuleArgs<ExtArgs>
  }


  type ModuleOnClientGetPayload<S extends boolean | null | undefined | ModuleOnClientArgs> = $Types.GetResult<ModuleOnClientPayload, S>

  type ModuleOnClientCountArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = 
    Omit<ModuleOnClientFindManyArgs, 'select' | 'include'> & {
      select?: ModuleOnClientCountAggregateInputType | true
    }

  export interface ModuleOnClientDelegate<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ModuleOnClient'], meta: { name: 'ModuleOnClient' } }
    /**
     * Find zero or one ModuleOnClient that matches the filter.
     * @param {ModuleOnClientFindUniqueArgs} args - Arguments to find a ModuleOnClient
     * @example
     * // Get one ModuleOnClient
     * const moduleOnClient = await prisma.moduleOnClient.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends ModuleOnClientFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, ModuleOnClientFindUniqueArgs<ExtArgs>>
    ): Prisma__ModuleOnClientClient<$Types.GetResult<ModuleOnClientPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one ModuleOnClient that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {ModuleOnClientFindUniqueOrThrowArgs} args - Arguments to find a ModuleOnClient
     * @example
     * // Get one ModuleOnClient
     * const moduleOnClient = await prisma.moduleOnClient.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends ModuleOnClientFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, ModuleOnClientFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__ModuleOnClientClient<$Types.GetResult<ModuleOnClientPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first ModuleOnClient that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleOnClientFindFirstArgs} args - Arguments to find a ModuleOnClient
     * @example
     * // Get one ModuleOnClient
     * const moduleOnClient = await prisma.moduleOnClient.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends ModuleOnClientFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, ModuleOnClientFindFirstArgs<ExtArgs>>
    ): Prisma__ModuleOnClientClient<$Types.GetResult<ModuleOnClientPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first ModuleOnClient that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleOnClientFindFirstOrThrowArgs} args - Arguments to find a ModuleOnClient
     * @example
     * // Get one ModuleOnClient
     * const moduleOnClient = await prisma.moduleOnClient.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends ModuleOnClientFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, ModuleOnClientFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__ModuleOnClientClient<$Types.GetResult<ModuleOnClientPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more ModuleOnClients that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleOnClientFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ModuleOnClients
     * const moduleOnClients = await prisma.moduleOnClient.findMany()
     * 
     * // Get first 10 ModuleOnClients
     * const moduleOnClients = await prisma.moduleOnClient.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const moduleOnClientWithIdOnly = await prisma.moduleOnClient.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends ModuleOnClientFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ModuleOnClientFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Types.GetResult<ModuleOnClientPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a ModuleOnClient.
     * @param {ModuleOnClientCreateArgs} args - Arguments to create a ModuleOnClient.
     * @example
     * // Create one ModuleOnClient
     * const ModuleOnClient = await prisma.moduleOnClient.create({
     *   data: {
     *     // ... data to create a ModuleOnClient
     *   }
     * })
     * 
    **/
    create<T extends ModuleOnClientCreateArgs<ExtArgs>>(
      args: SelectSubset<T, ModuleOnClientCreateArgs<ExtArgs>>
    ): Prisma__ModuleOnClientClient<$Types.GetResult<ModuleOnClientPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many ModuleOnClients.
     *     @param {ModuleOnClientCreateManyArgs} args - Arguments to create many ModuleOnClients.
     *     @example
     *     // Create many ModuleOnClients
     *     const moduleOnClient = await prisma.moduleOnClient.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends ModuleOnClientCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ModuleOnClientCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a ModuleOnClient.
     * @param {ModuleOnClientDeleteArgs} args - Arguments to delete one ModuleOnClient.
     * @example
     * // Delete one ModuleOnClient
     * const ModuleOnClient = await prisma.moduleOnClient.delete({
     *   where: {
     *     // ... filter to delete one ModuleOnClient
     *   }
     * })
     * 
    **/
    delete<T extends ModuleOnClientDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, ModuleOnClientDeleteArgs<ExtArgs>>
    ): Prisma__ModuleOnClientClient<$Types.GetResult<ModuleOnClientPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one ModuleOnClient.
     * @param {ModuleOnClientUpdateArgs} args - Arguments to update one ModuleOnClient.
     * @example
     * // Update one ModuleOnClient
     * const moduleOnClient = await prisma.moduleOnClient.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends ModuleOnClientUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, ModuleOnClientUpdateArgs<ExtArgs>>
    ): Prisma__ModuleOnClientClient<$Types.GetResult<ModuleOnClientPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more ModuleOnClients.
     * @param {ModuleOnClientDeleteManyArgs} args - Arguments to filter ModuleOnClients to delete.
     * @example
     * // Delete a few ModuleOnClients
     * const { count } = await prisma.moduleOnClient.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends ModuleOnClientDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ModuleOnClientDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ModuleOnClients.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleOnClientUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ModuleOnClients
     * const moduleOnClient = await prisma.moduleOnClient.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends ModuleOnClientUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, ModuleOnClientUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ModuleOnClient.
     * @param {ModuleOnClientUpsertArgs} args - Arguments to update or create a ModuleOnClient.
     * @example
     * // Update or create a ModuleOnClient
     * const moduleOnClient = await prisma.moduleOnClient.upsert({
     *   create: {
     *     // ... data to create a ModuleOnClient
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ModuleOnClient we want to update
     *   }
     * })
    **/
    upsert<T extends ModuleOnClientUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, ModuleOnClientUpsertArgs<ExtArgs>>
    ): Prisma__ModuleOnClientClient<$Types.GetResult<ModuleOnClientPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of ModuleOnClients.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleOnClientCountArgs} args - Arguments to filter ModuleOnClients to count.
     * @example
     * // Count the number of ModuleOnClients
     * const count = await prisma.moduleOnClient.count({
     *   where: {
     *     // ... the filter for the ModuleOnClients we want to count
     *   }
     * })
    **/
    count<T extends ModuleOnClientCountArgs>(
      args?: Subset<T, ModuleOnClientCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ModuleOnClientCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ModuleOnClient.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleOnClientAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ModuleOnClientAggregateArgs>(args: Subset<T, ModuleOnClientAggregateArgs>): Prisma.PrismaPromise<GetModuleOnClientAggregateType<T>>

    /**
     * Group by ModuleOnClient.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ModuleOnClientGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ModuleOnClientGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ModuleOnClientGroupByArgs['orderBy'] }
        : { orderBy?: ModuleOnClientGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ModuleOnClientGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetModuleOnClientGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ModuleOnClient model
   */
  readonly fields: ModuleOnClientFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ModuleOnClient.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__ModuleOnClientClient<T, Null = never, ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> implements Prisma.PrismaPromise<T> {
    private readonly _dmmf;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);

    client<T extends ClientArgs<ExtArgs> = {}>(args?: Subset<T, ClientArgs<ExtArgs>>): Prisma__ClientClient<$Types.GetResult<ClientPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    module<T extends ModuleArgs<ExtArgs> = {}>(args?: Subset<T, ModuleArgs<ExtArgs>>): Prisma__ModuleClient<$Types.GetResult<ModulePayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }



  /**
   * Fields of the ModuleOnClient model
   */ 
  interface ModuleOnClientFieldRefs {
    readonly id: FieldRef<"ModuleOnClient", 'String'>
    readonly clientId: FieldRef<"ModuleOnClient", 'String'>
    readonly moduleId: FieldRef<"ModuleOnClient", 'String'>
    readonly enabled: FieldRef<"ModuleOnClient", 'Boolean'>
  }
    

  // Custom InputTypes

  /**
   * ModuleOnClient findUnique
   */
  export type ModuleOnClientFindUniqueArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleOnClient
     */
    select?: ModuleOnClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleOnClientInclude<ExtArgs> | null
    /**
     * Filter, which ModuleOnClient to fetch.
     */
    where: ModuleOnClientWhereUniqueInput
  }


  /**
   * ModuleOnClient findUniqueOrThrow
   */
  export type ModuleOnClientFindUniqueOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleOnClient
     */
    select?: ModuleOnClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleOnClientInclude<ExtArgs> | null
    /**
     * Filter, which ModuleOnClient to fetch.
     */
    where: ModuleOnClientWhereUniqueInput
  }


  /**
   * ModuleOnClient findFirst
   */
  export type ModuleOnClientFindFirstArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleOnClient
     */
    select?: ModuleOnClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleOnClientInclude<ExtArgs> | null
    /**
     * Filter, which ModuleOnClient to fetch.
     */
    where?: ModuleOnClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ModuleOnClients to fetch.
     */
    orderBy?: ModuleOnClientOrderByWithRelationInput | ModuleOnClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ModuleOnClients.
     */
    cursor?: ModuleOnClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ModuleOnClients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ModuleOnClients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ModuleOnClients.
     */
    distinct?: ModuleOnClientScalarFieldEnum | ModuleOnClientScalarFieldEnum[]
  }


  /**
   * ModuleOnClient findFirstOrThrow
   */
  export type ModuleOnClientFindFirstOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleOnClient
     */
    select?: ModuleOnClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleOnClientInclude<ExtArgs> | null
    /**
     * Filter, which ModuleOnClient to fetch.
     */
    where?: ModuleOnClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ModuleOnClients to fetch.
     */
    orderBy?: ModuleOnClientOrderByWithRelationInput | ModuleOnClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ModuleOnClients.
     */
    cursor?: ModuleOnClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ModuleOnClients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ModuleOnClients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ModuleOnClients.
     */
    distinct?: ModuleOnClientScalarFieldEnum | ModuleOnClientScalarFieldEnum[]
  }


  /**
   * ModuleOnClient findMany
   */
  export type ModuleOnClientFindManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleOnClient
     */
    select?: ModuleOnClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleOnClientInclude<ExtArgs> | null
    /**
     * Filter, which ModuleOnClients to fetch.
     */
    where?: ModuleOnClientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ModuleOnClients to fetch.
     */
    orderBy?: ModuleOnClientOrderByWithRelationInput | ModuleOnClientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ModuleOnClients.
     */
    cursor?: ModuleOnClientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ModuleOnClients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ModuleOnClients.
     */
    skip?: number
    distinct?: ModuleOnClientScalarFieldEnum | ModuleOnClientScalarFieldEnum[]
  }


  /**
   * ModuleOnClient create
   */
  export type ModuleOnClientCreateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleOnClient
     */
    select?: ModuleOnClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleOnClientInclude<ExtArgs> | null
    /**
     * The data needed to create a ModuleOnClient.
     */
    data: XOR<ModuleOnClientCreateInput, ModuleOnClientUncheckedCreateInput>
  }


  /**
   * ModuleOnClient createMany
   */
  export type ModuleOnClientCreateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ModuleOnClients.
     */
    data: ModuleOnClientCreateManyInput | ModuleOnClientCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * ModuleOnClient update
   */
  export type ModuleOnClientUpdateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleOnClient
     */
    select?: ModuleOnClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleOnClientInclude<ExtArgs> | null
    /**
     * The data needed to update a ModuleOnClient.
     */
    data: XOR<ModuleOnClientUpdateInput, ModuleOnClientUncheckedUpdateInput>
    /**
     * Choose, which ModuleOnClient to update.
     */
    where: ModuleOnClientWhereUniqueInput
  }


  /**
   * ModuleOnClient updateMany
   */
  export type ModuleOnClientUpdateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ModuleOnClients.
     */
    data: XOR<ModuleOnClientUpdateManyMutationInput, ModuleOnClientUncheckedUpdateManyInput>
    /**
     * Filter which ModuleOnClients to update
     */
    where?: ModuleOnClientWhereInput
  }


  /**
   * ModuleOnClient upsert
   */
  export type ModuleOnClientUpsertArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleOnClient
     */
    select?: ModuleOnClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleOnClientInclude<ExtArgs> | null
    /**
     * The filter to search for the ModuleOnClient to update in case it exists.
     */
    where: ModuleOnClientWhereUniqueInput
    /**
     * In case the ModuleOnClient found by the `where` argument doesn't exist, create a new ModuleOnClient with this data.
     */
    create: XOR<ModuleOnClientCreateInput, ModuleOnClientUncheckedCreateInput>
    /**
     * In case the ModuleOnClient was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ModuleOnClientUpdateInput, ModuleOnClientUncheckedUpdateInput>
  }


  /**
   * ModuleOnClient delete
   */
  export type ModuleOnClientDeleteArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleOnClient
     */
    select?: ModuleOnClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleOnClientInclude<ExtArgs> | null
    /**
     * Filter which ModuleOnClient to delete.
     */
    where: ModuleOnClientWhereUniqueInput
  }


  /**
   * ModuleOnClient deleteMany
   */
  export type ModuleOnClientDeleteManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which ModuleOnClients to delete
     */
    where?: ModuleOnClientWhereInput
  }


  /**
   * ModuleOnClient without action
   */
  export type ModuleOnClientArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ModuleOnClient
     */
    select?: ModuleOnClientSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ModuleOnClientInclude<ExtArgs> | null
  }



  /**
   * Model EnvironmentVariable
   */


  export type AggregateEnvironmentVariable = {
    _count: EnvironmentVariableCountAggregateOutputType | null
    _min: EnvironmentVariableMinAggregateOutputType | null
    _max: EnvironmentVariableMaxAggregateOutputType | null
  }

  export type EnvironmentVariableMinAggregateOutputType = {
    id: string | null
    key: string | null
    value: string | null
    environment: Environment | null
    clientId: string | null
  }

  export type EnvironmentVariableMaxAggregateOutputType = {
    id: string | null
    key: string | null
    value: string | null
    environment: Environment | null
    clientId: string | null
  }

  export type EnvironmentVariableCountAggregateOutputType = {
    id: number
    key: number
    value: number
    environment: number
    clientId: number
    _all: number
  }


  export type EnvironmentVariableMinAggregateInputType = {
    id?: true
    key?: true
    value?: true
    environment?: true
    clientId?: true
  }

  export type EnvironmentVariableMaxAggregateInputType = {
    id?: true
    key?: true
    value?: true
    environment?: true
    clientId?: true
  }

  export type EnvironmentVariableCountAggregateInputType = {
    id?: true
    key?: true
    value?: true
    environment?: true
    clientId?: true
    _all?: true
  }

  export type EnvironmentVariableAggregateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which EnvironmentVariable to aggregate.
     */
    where?: EnvironmentVariableWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EnvironmentVariables to fetch.
     */
    orderBy?: EnvironmentVariableOrderByWithRelationInput | EnvironmentVariableOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: EnvironmentVariableWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EnvironmentVariables from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EnvironmentVariables.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned EnvironmentVariables
    **/
    _count?: true | EnvironmentVariableCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: EnvironmentVariableMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: EnvironmentVariableMaxAggregateInputType
  }

  export type GetEnvironmentVariableAggregateType<T extends EnvironmentVariableAggregateArgs> = {
        [P in keyof T & keyof AggregateEnvironmentVariable]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEnvironmentVariable[P]>
      : GetScalarType<T[P], AggregateEnvironmentVariable[P]>
  }




  export type EnvironmentVariableGroupByArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: EnvironmentVariableWhereInput
    orderBy?: EnvironmentVariableOrderByWithAggregationInput | EnvironmentVariableOrderByWithAggregationInput[]
    by: EnvironmentVariableScalarFieldEnum[] | EnvironmentVariableScalarFieldEnum
    having?: EnvironmentVariableScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: EnvironmentVariableCountAggregateInputType | true
    _min?: EnvironmentVariableMinAggregateInputType
    _max?: EnvironmentVariableMaxAggregateInputType
  }


  export type EnvironmentVariableGroupByOutputType = {
    id: string
    key: string
    value: string
    environment: Environment
    clientId: string
    _count: EnvironmentVariableCountAggregateOutputType | null
    _min: EnvironmentVariableMinAggregateOutputType | null
    _max: EnvironmentVariableMaxAggregateOutputType | null
  }

  type GetEnvironmentVariableGroupByPayload<T extends EnvironmentVariableGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EnvironmentVariableGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof EnvironmentVariableGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], EnvironmentVariableGroupByOutputType[P]>
            : GetScalarType<T[P], EnvironmentVariableGroupByOutputType[P]>
        }
      >
    >


  export type EnvironmentVariableSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    key?: boolean
    value?: boolean
    environment?: boolean
    clientId?: boolean
    client?: boolean | ClientArgs<ExtArgs>
  }, ExtArgs["result"]["environmentVariable"]>

  export type EnvironmentVariableSelectScalar = {
    id?: boolean
    key?: boolean
    value?: boolean
    environment?: boolean
    clientId?: boolean
  }

  export type EnvironmentVariableInclude<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    client?: boolean | ClientArgs<ExtArgs>
  }


  type EnvironmentVariableGetPayload<S extends boolean | null | undefined | EnvironmentVariableArgs> = $Types.GetResult<EnvironmentVariablePayload, S>

  type EnvironmentVariableCountArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = 
    Omit<EnvironmentVariableFindManyArgs, 'select' | 'include'> & {
      select?: EnvironmentVariableCountAggregateInputType | true
    }

  export interface EnvironmentVariableDelegate<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['EnvironmentVariable'], meta: { name: 'EnvironmentVariable' } }
    /**
     * Find zero or one EnvironmentVariable that matches the filter.
     * @param {EnvironmentVariableFindUniqueArgs} args - Arguments to find a EnvironmentVariable
     * @example
     * // Get one EnvironmentVariable
     * const environmentVariable = await prisma.environmentVariable.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends EnvironmentVariableFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, EnvironmentVariableFindUniqueArgs<ExtArgs>>
    ): Prisma__EnvironmentVariableClient<$Types.GetResult<EnvironmentVariablePayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one EnvironmentVariable that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {EnvironmentVariableFindUniqueOrThrowArgs} args - Arguments to find a EnvironmentVariable
     * @example
     * // Get one EnvironmentVariable
     * const environmentVariable = await prisma.environmentVariable.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends EnvironmentVariableFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, EnvironmentVariableFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__EnvironmentVariableClient<$Types.GetResult<EnvironmentVariablePayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first EnvironmentVariable that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnvironmentVariableFindFirstArgs} args - Arguments to find a EnvironmentVariable
     * @example
     * // Get one EnvironmentVariable
     * const environmentVariable = await prisma.environmentVariable.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends EnvironmentVariableFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, EnvironmentVariableFindFirstArgs<ExtArgs>>
    ): Prisma__EnvironmentVariableClient<$Types.GetResult<EnvironmentVariablePayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first EnvironmentVariable that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnvironmentVariableFindFirstOrThrowArgs} args - Arguments to find a EnvironmentVariable
     * @example
     * // Get one EnvironmentVariable
     * const environmentVariable = await prisma.environmentVariable.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends EnvironmentVariableFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, EnvironmentVariableFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__EnvironmentVariableClient<$Types.GetResult<EnvironmentVariablePayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more EnvironmentVariables that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnvironmentVariableFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all EnvironmentVariables
     * const environmentVariables = await prisma.environmentVariable.findMany()
     * 
     * // Get first 10 EnvironmentVariables
     * const environmentVariables = await prisma.environmentVariable.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const environmentVariableWithIdOnly = await prisma.environmentVariable.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends EnvironmentVariableFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, EnvironmentVariableFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Types.GetResult<EnvironmentVariablePayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a EnvironmentVariable.
     * @param {EnvironmentVariableCreateArgs} args - Arguments to create a EnvironmentVariable.
     * @example
     * // Create one EnvironmentVariable
     * const EnvironmentVariable = await prisma.environmentVariable.create({
     *   data: {
     *     // ... data to create a EnvironmentVariable
     *   }
     * })
     * 
    **/
    create<T extends EnvironmentVariableCreateArgs<ExtArgs>>(
      args: SelectSubset<T, EnvironmentVariableCreateArgs<ExtArgs>>
    ): Prisma__EnvironmentVariableClient<$Types.GetResult<EnvironmentVariablePayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many EnvironmentVariables.
     *     @param {EnvironmentVariableCreateManyArgs} args - Arguments to create many EnvironmentVariables.
     *     @example
     *     // Create many EnvironmentVariables
     *     const environmentVariable = await prisma.environmentVariable.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends EnvironmentVariableCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, EnvironmentVariableCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a EnvironmentVariable.
     * @param {EnvironmentVariableDeleteArgs} args - Arguments to delete one EnvironmentVariable.
     * @example
     * // Delete one EnvironmentVariable
     * const EnvironmentVariable = await prisma.environmentVariable.delete({
     *   where: {
     *     // ... filter to delete one EnvironmentVariable
     *   }
     * })
     * 
    **/
    delete<T extends EnvironmentVariableDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, EnvironmentVariableDeleteArgs<ExtArgs>>
    ): Prisma__EnvironmentVariableClient<$Types.GetResult<EnvironmentVariablePayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one EnvironmentVariable.
     * @param {EnvironmentVariableUpdateArgs} args - Arguments to update one EnvironmentVariable.
     * @example
     * // Update one EnvironmentVariable
     * const environmentVariable = await prisma.environmentVariable.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends EnvironmentVariableUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, EnvironmentVariableUpdateArgs<ExtArgs>>
    ): Prisma__EnvironmentVariableClient<$Types.GetResult<EnvironmentVariablePayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more EnvironmentVariables.
     * @param {EnvironmentVariableDeleteManyArgs} args - Arguments to filter EnvironmentVariables to delete.
     * @example
     * // Delete a few EnvironmentVariables
     * const { count } = await prisma.environmentVariable.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends EnvironmentVariableDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, EnvironmentVariableDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more EnvironmentVariables.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnvironmentVariableUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many EnvironmentVariables
     * const environmentVariable = await prisma.environmentVariable.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends EnvironmentVariableUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, EnvironmentVariableUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one EnvironmentVariable.
     * @param {EnvironmentVariableUpsertArgs} args - Arguments to update or create a EnvironmentVariable.
     * @example
     * // Update or create a EnvironmentVariable
     * const environmentVariable = await prisma.environmentVariable.upsert({
     *   create: {
     *     // ... data to create a EnvironmentVariable
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the EnvironmentVariable we want to update
     *   }
     * })
    **/
    upsert<T extends EnvironmentVariableUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, EnvironmentVariableUpsertArgs<ExtArgs>>
    ): Prisma__EnvironmentVariableClient<$Types.GetResult<EnvironmentVariablePayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of EnvironmentVariables.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnvironmentVariableCountArgs} args - Arguments to filter EnvironmentVariables to count.
     * @example
     * // Count the number of EnvironmentVariables
     * const count = await prisma.environmentVariable.count({
     *   where: {
     *     // ... the filter for the EnvironmentVariables we want to count
     *   }
     * })
    **/
    count<T extends EnvironmentVariableCountArgs>(
      args?: Subset<T, EnvironmentVariableCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], EnvironmentVariableCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a EnvironmentVariable.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnvironmentVariableAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends EnvironmentVariableAggregateArgs>(args: Subset<T, EnvironmentVariableAggregateArgs>): Prisma.PrismaPromise<GetEnvironmentVariableAggregateType<T>>

    /**
     * Group by EnvironmentVariable.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EnvironmentVariableGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends EnvironmentVariableGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: EnvironmentVariableGroupByArgs['orderBy'] }
        : { orderBy?: EnvironmentVariableGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, EnvironmentVariableGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEnvironmentVariableGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the EnvironmentVariable model
   */
  readonly fields: EnvironmentVariableFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for EnvironmentVariable.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__EnvironmentVariableClient<T, Null = never, ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> implements Prisma.PrismaPromise<T> {
    private readonly _dmmf;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);

    client<T extends ClientArgs<ExtArgs> = {}>(args?: Subset<T, ClientArgs<ExtArgs>>): Prisma__ClientClient<$Types.GetResult<ClientPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }



  /**
   * Fields of the EnvironmentVariable model
   */ 
  interface EnvironmentVariableFieldRefs {
    readonly id: FieldRef<"EnvironmentVariable", 'String'>
    readonly key: FieldRef<"EnvironmentVariable", 'String'>
    readonly value: FieldRef<"EnvironmentVariable", 'String'>
    readonly environment: FieldRef<"EnvironmentVariable", 'Environment'>
    readonly clientId: FieldRef<"EnvironmentVariable", 'String'>
  }
    

  // Custom InputTypes

  /**
   * EnvironmentVariable findUnique
   */
  export type EnvironmentVariableFindUniqueArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnvironmentVariable
     */
    select?: EnvironmentVariableSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: EnvironmentVariableInclude<ExtArgs> | null
    /**
     * Filter, which EnvironmentVariable to fetch.
     */
    where: EnvironmentVariableWhereUniqueInput
  }


  /**
   * EnvironmentVariable findUniqueOrThrow
   */
  export type EnvironmentVariableFindUniqueOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnvironmentVariable
     */
    select?: EnvironmentVariableSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: EnvironmentVariableInclude<ExtArgs> | null
    /**
     * Filter, which EnvironmentVariable to fetch.
     */
    where: EnvironmentVariableWhereUniqueInput
  }


  /**
   * EnvironmentVariable findFirst
   */
  export type EnvironmentVariableFindFirstArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnvironmentVariable
     */
    select?: EnvironmentVariableSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: EnvironmentVariableInclude<ExtArgs> | null
    /**
     * Filter, which EnvironmentVariable to fetch.
     */
    where?: EnvironmentVariableWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EnvironmentVariables to fetch.
     */
    orderBy?: EnvironmentVariableOrderByWithRelationInput | EnvironmentVariableOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for EnvironmentVariables.
     */
    cursor?: EnvironmentVariableWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EnvironmentVariables from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EnvironmentVariables.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EnvironmentVariables.
     */
    distinct?: EnvironmentVariableScalarFieldEnum | EnvironmentVariableScalarFieldEnum[]
  }


  /**
   * EnvironmentVariable findFirstOrThrow
   */
  export type EnvironmentVariableFindFirstOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnvironmentVariable
     */
    select?: EnvironmentVariableSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: EnvironmentVariableInclude<ExtArgs> | null
    /**
     * Filter, which EnvironmentVariable to fetch.
     */
    where?: EnvironmentVariableWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EnvironmentVariables to fetch.
     */
    orderBy?: EnvironmentVariableOrderByWithRelationInput | EnvironmentVariableOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for EnvironmentVariables.
     */
    cursor?: EnvironmentVariableWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EnvironmentVariables from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EnvironmentVariables.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of EnvironmentVariables.
     */
    distinct?: EnvironmentVariableScalarFieldEnum | EnvironmentVariableScalarFieldEnum[]
  }


  /**
   * EnvironmentVariable findMany
   */
  export type EnvironmentVariableFindManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnvironmentVariable
     */
    select?: EnvironmentVariableSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: EnvironmentVariableInclude<ExtArgs> | null
    /**
     * Filter, which EnvironmentVariables to fetch.
     */
    where?: EnvironmentVariableWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of EnvironmentVariables to fetch.
     */
    orderBy?: EnvironmentVariableOrderByWithRelationInput | EnvironmentVariableOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing EnvironmentVariables.
     */
    cursor?: EnvironmentVariableWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` EnvironmentVariables from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` EnvironmentVariables.
     */
    skip?: number
    distinct?: EnvironmentVariableScalarFieldEnum | EnvironmentVariableScalarFieldEnum[]
  }


  /**
   * EnvironmentVariable create
   */
  export type EnvironmentVariableCreateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnvironmentVariable
     */
    select?: EnvironmentVariableSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: EnvironmentVariableInclude<ExtArgs> | null
    /**
     * The data needed to create a EnvironmentVariable.
     */
    data: XOR<EnvironmentVariableCreateInput, EnvironmentVariableUncheckedCreateInput>
  }


  /**
   * EnvironmentVariable createMany
   */
  export type EnvironmentVariableCreateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many EnvironmentVariables.
     */
    data: EnvironmentVariableCreateManyInput | EnvironmentVariableCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * EnvironmentVariable update
   */
  export type EnvironmentVariableUpdateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnvironmentVariable
     */
    select?: EnvironmentVariableSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: EnvironmentVariableInclude<ExtArgs> | null
    /**
     * The data needed to update a EnvironmentVariable.
     */
    data: XOR<EnvironmentVariableUpdateInput, EnvironmentVariableUncheckedUpdateInput>
    /**
     * Choose, which EnvironmentVariable to update.
     */
    where: EnvironmentVariableWhereUniqueInput
  }


  /**
   * EnvironmentVariable updateMany
   */
  export type EnvironmentVariableUpdateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to update EnvironmentVariables.
     */
    data: XOR<EnvironmentVariableUpdateManyMutationInput, EnvironmentVariableUncheckedUpdateManyInput>
    /**
     * Filter which EnvironmentVariables to update
     */
    where?: EnvironmentVariableWhereInput
  }


  /**
   * EnvironmentVariable upsert
   */
  export type EnvironmentVariableUpsertArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnvironmentVariable
     */
    select?: EnvironmentVariableSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: EnvironmentVariableInclude<ExtArgs> | null
    /**
     * The filter to search for the EnvironmentVariable to update in case it exists.
     */
    where: EnvironmentVariableWhereUniqueInput
    /**
     * In case the EnvironmentVariable found by the `where` argument doesn't exist, create a new EnvironmentVariable with this data.
     */
    create: XOR<EnvironmentVariableCreateInput, EnvironmentVariableUncheckedCreateInput>
    /**
     * In case the EnvironmentVariable was found with the provided `where` argument, update it with this data.
     */
    update: XOR<EnvironmentVariableUpdateInput, EnvironmentVariableUncheckedUpdateInput>
  }


  /**
   * EnvironmentVariable delete
   */
  export type EnvironmentVariableDeleteArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnvironmentVariable
     */
    select?: EnvironmentVariableSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: EnvironmentVariableInclude<ExtArgs> | null
    /**
     * Filter which EnvironmentVariable to delete.
     */
    where: EnvironmentVariableWhereUniqueInput
  }


  /**
   * EnvironmentVariable deleteMany
   */
  export type EnvironmentVariableDeleteManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which EnvironmentVariables to delete
     */
    where?: EnvironmentVariableWhereInput
  }


  /**
   * EnvironmentVariable without action
   */
  export type EnvironmentVariableArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EnvironmentVariable
     */
    select?: EnvironmentVariableSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: EnvironmentVariableInclude<ExtArgs> | null
  }



  /**
   * Model User
   */


  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    email: string | null
    name: string | null
    avatar: string | null
    role: Role | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    email: string | null
    name: string | null
    avatar: string | null
    role: Role | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email: number
    name: number
    avatar: number
    role: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    email?: true
    name?: true
    avatar?: true
    role?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email?: true
    name?: true
    avatar?: true
    role?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email?: true
    name?: true
    avatar?: true
    role?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }


  export type UserGroupByOutputType = {
    id: string
    email: string
    name: string | null
    avatar: string | null
    role: Role
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    name?: boolean
    avatar?: boolean
    role?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    orders?: boolean | User$ordersArgs<ExtArgs>
    cart?: boolean | User$cartArgs<ExtArgs>
    mcpConfigurations?: boolean | User$mcpConfigurationsArgs<ExtArgs>
    products?: boolean | User$productsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    email?: boolean
    name?: boolean
    avatar?: boolean
    role?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserInclude<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    orders?: boolean | User$ordersArgs<ExtArgs>
    cart?: boolean | User$cartArgs<ExtArgs>
    mcpConfigurations?: boolean | User$mcpConfigurationsArgs<ExtArgs>
    products?: boolean | User$productsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeArgs<ExtArgs>
  }


  type UserGetPayload<S extends boolean | null | undefined | UserArgs> = $Types.GetResult<UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = 
    Omit<UserFindManyArgs, 'select' | 'include'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends UserFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>
    ): Prisma__UserClient<$Types.GetResult<UserPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one User that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__UserClient<$Types.GetResult<UserPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends UserFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>
    ): Prisma__UserClient<$Types.GetResult<UserPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__UserClient<$Types.GetResult<UserPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends UserFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Types.GetResult<UserPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
    **/
    create<T extends UserCreateArgs<ExtArgs>>(
      args: SelectSubset<T, UserCreateArgs<ExtArgs>>
    ): Prisma__UserClient<$Types.GetResult<UserPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many Users.
     *     @param {UserCreateManyArgs} args - Arguments to create many Users.
     *     @example
     *     // Create many Users
     *     const user = await prisma.user.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends UserCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
    **/
    delete<T extends UserDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, UserDeleteArgs<ExtArgs>>
    ): Prisma__UserClient<$Types.GetResult<UserPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends UserUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, UserUpdateArgs<ExtArgs>>
    ): Prisma__UserClient<$Types.GetResult<UserPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends UserDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends UserUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
    **/
    upsert<T extends UserUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, UserUpsertArgs<ExtArgs>>
    ): Prisma__UserClient<$Types.GetResult<UserPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> implements Prisma.PrismaPromise<T> {
    private readonly _dmmf;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);

    orders<T extends User$ordersArgs<ExtArgs> = {}>(args?: Subset<T, User$ordersArgs<ExtArgs>>): Prisma.PrismaPromise<$Types.GetResult<OrderPayload<ExtArgs>, T, 'findMany'>| Null>;

    cart<T extends User$cartArgs<ExtArgs> = {}>(args?: Subset<T, User$cartArgs<ExtArgs>>): Prisma__CartClient<$Types.GetResult<CartPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    mcpConfigurations<T extends User$mcpConfigurationsArgs<ExtArgs> = {}>(args?: Subset<T, User$mcpConfigurationsArgs<ExtArgs>>): Prisma.PrismaPromise<$Types.GetResult<MCPConfigurationPayload<ExtArgs>, T, 'findMany'>| Null>;

    products<T extends User$productsArgs<ExtArgs> = {}>(args?: Subset<T, User$productsArgs<ExtArgs>>): Prisma.PrismaPromise<$Types.GetResult<ProductPayload<ExtArgs>, T, 'findMany'>| Null>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }



  /**
   * Fields of the User model
   */ 
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly name: FieldRef<"User", 'String'>
    readonly avatar: FieldRef<"User", 'String'>
    readonly role: FieldRef<"User", 'Role'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes

  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }


  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }


  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }


  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }


  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }


  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }


  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }


  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
  }


  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }


  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }


  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
  }


  /**
   * User.orders
   */
  export type User$ordersArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderInclude<ExtArgs> | null
    where?: OrderWhereInput
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    cursor?: OrderWhereUniqueInput
    take?: number
    skip?: number
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }


  /**
   * User.cart
   */
  export type User$cartArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cart
     */
    select?: CartSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartInclude<ExtArgs> | null
    where?: CartWhereInput
  }


  /**
   * User.mcpConfigurations
   */
  export type User$mcpConfigurationsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MCPConfiguration
     */
    select?: MCPConfigurationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: MCPConfigurationInclude<ExtArgs> | null
    where?: MCPConfigurationWhereInput
    orderBy?: MCPConfigurationOrderByWithRelationInput | MCPConfigurationOrderByWithRelationInput[]
    cursor?: MCPConfigurationWhereUniqueInput
    take?: number
    skip?: number
    distinct?: MCPConfigurationScalarFieldEnum | MCPConfigurationScalarFieldEnum[]
  }


  /**
   * User.products
   */
  export type User$productsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
    where?: ProductWhereInput
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    cursor?: ProductWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ProductScalarFieldEnum | ProductScalarFieldEnum[]
  }


  /**
   * User without action
   */
  export type UserArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: UserInclude<ExtArgs> | null
  }



  /**
   * Model Category
   */


  export type AggregateCategory = {
    _count: CategoryCountAggregateOutputType | null
    _min: CategoryMinAggregateOutputType | null
    _max: CategoryMaxAggregateOutputType | null
  }

  export type CategoryMinAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    createdAt: Date | null
  }

  export type CategoryMaxAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    createdAt: Date | null
  }

  export type CategoryCountAggregateOutputType = {
    id: number
    name: number
    description: number
    createdAt: number
    _all: number
  }


  export type CategoryMinAggregateInputType = {
    id?: true
    name?: true
    description?: true
    createdAt?: true
  }

  export type CategoryMaxAggregateInputType = {
    id?: true
    name?: true
    description?: true
    createdAt?: true
  }

  export type CategoryCountAggregateInputType = {
    id?: true
    name?: true
    description?: true
    createdAt?: true
    _all?: true
  }

  export type CategoryAggregateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Category to aggregate.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Categories
    **/
    _count?: true | CategoryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CategoryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CategoryMaxAggregateInputType
  }

  export type GetCategoryAggregateType<T extends CategoryAggregateArgs> = {
        [P in keyof T & keyof AggregateCategory]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCategory[P]>
      : GetScalarType<T[P], AggregateCategory[P]>
  }




  export type CategoryGroupByArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: CategoryWhereInput
    orderBy?: CategoryOrderByWithAggregationInput | CategoryOrderByWithAggregationInput[]
    by: CategoryScalarFieldEnum[] | CategoryScalarFieldEnum
    having?: CategoryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CategoryCountAggregateInputType | true
    _min?: CategoryMinAggregateInputType
    _max?: CategoryMaxAggregateInputType
  }


  export type CategoryGroupByOutputType = {
    id: string
    name: string
    description: string | null
    createdAt: Date
    _count: CategoryCountAggregateOutputType | null
    _min: CategoryMinAggregateOutputType | null
    _max: CategoryMaxAggregateOutputType | null
  }

  type GetCategoryGroupByPayload<T extends CategoryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CategoryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CategoryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CategoryGroupByOutputType[P]>
            : GetScalarType<T[P], CategoryGroupByOutputType[P]>
        }
      >
    >


  export type CategorySelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    description?: boolean
    createdAt?: boolean
    products?: boolean | Category$productsArgs<ExtArgs>
    _count?: boolean | CategoryCountOutputTypeArgs<ExtArgs>
  }, ExtArgs["result"]["category"]>

  export type CategorySelectScalar = {
    id?: boolean
    name?: boolean
    description?: boolean
    createdAt?: boolean
  }

  export type CategoryInclude<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    products?: boolean | Category$productsArgs<ExtArgs>
    _count?: boolean | CategoryCountOutputTypeArgs<ExtArgs>
  }


  type CategoryGetPayload<S extends boolean | null | undefined | CategoryArgs> = $Types.GetResult<CategoryPayload, S>

  type CategoryCountArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = 
    Omit<CategoryFindManyArgs, 'select' | 'include'> & {
      select?: CategoryCountAggregateInputType | true
    }

  export interface CategoryDelegate<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Category'], meta: { name: 'Category' } }
    /**
     * Find zero or one Category that matches the filter.
     * @param {CategoryFindUniqueArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends CategoryFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, CategoryFindUniqueArgs<ExtArgs>>
    ): Prisma__CategoryClient<$Types.GetResult<CategoryPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one Category that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {CategoryFindUniqueOrThrowArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends CategoryFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, CategoryFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__CategoryClient<$Types.GetResult<CategoryPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first Category that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryFindFirstArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends CategoryFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, CategoryFindFirstArgs<ExtArgs>>
    ): Prisma__CategoryClient<$Types.GetResult<CategoryPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first Category that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryFindFirstOrThrowArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends CategoryFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, CategoryFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__CategoryClient<$Types.GetResult<CategoryPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more Categories that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Categories
     * const categories = await prisma.category.findMany()
     * 
     * // Get first 10 Categories
     * const categories = await prisma.category.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const categoryWithIdOnly = await prisma.category.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends CategoryFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, CategoryFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Types.GetResult<CategoryPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a Category.
     * @param {CategoryCreateArgs} args - Arguments to create a Category.
     * @example
     * // Create one Category
     * const Category = await prisma.category.create({
     *   data: {
     *     // ... data to create a Category
     *   }
     * })
     * 
    **/
    create<T extends CategoryCreateArgs<ExtArgs>>(
      args: SelectSubset<T, CategoryCreateArgs<ExtArgs>>
    ): Prisma__CategoryClient<$Types.GetResult<CategoryPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many Categories.
     *     @param {CategoryCreateManyArgs} args - Arguments to create many Categories.
     *     @example
     *     // Create many Categories
     *     const category = await prisma.category.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends CategoryCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, CategoryCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Category.
     * @param {CategoryDeleteArgs} args - Arguments to delete one Category.
     * @example
     * // Delete one Category
     * const Category = await prisma.category.delete({
     *   where: {
     *     // ... filter to delete one Category
     *   }
     * })
     * 
    **/
    delete<T extends CategoryDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, CategoryDeleteArgs<ExtArgs>>
    ): Prisma__CategoryClient<$Types.GetResult<CategoryPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one Category.
     * @param {CategoryUpdateArgs} args - Arguments to update one Category.
     * @example
     * // Update one Category
     * const category = await prisma.category.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends CategoryUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, CategoryUpdateArgs<ExtArgs>>
    ): Prisma__CategoryClient<$Types.GetResult<CategoryPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more Categories.
     * @param {CategoryDeleteManyArgs} args - Arguments to filter Categories to delete.
     * @example
     * // Delete a few Categories
     * const { count } = await prisma.category.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends CategoryDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, CategoryDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Categories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Categories
     * const category = await prisma.category.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends CategoryUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, CategoryUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Category.
     * @param {CategoryUpsertArgs} args - Arguments to update or create a Category.
     * @example
     * // Update or create a Category
     * const category = await prisma.category.upsert({
     *   create: {
     *     // ... data to create a Category
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Category we want to update
     *   }
     * })
    **/
    upsert<T extends CategoryUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, CategoryUpsertArgs<ExtArgs>>
    ): Prisma__CategoryClient<$Types.GetResult<CategoryPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of Categories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryCountArgs} args - Arguments to filter Categories to count.
     * @example
     * // Count the number of Categories
     * const count = await prisma.category.count({
     *   where: {
     *     // ... the filter for the Categories we want to count
     *   }
     * })
    **/
    count<T extends CategoryCountArgs>(
      args?: Subset<T, CategoryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CategoryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Category.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CategoryAggregateArgs>(args: Subset<T, CategoryAggregateArgs>): Prisma.PrismaPromise<GetCategoryAggregateType<T>>

    /**
     * Group by Category.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CategoryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CategoryGroupByArgs['orderBy'] }
        : { orderBy?: CategoryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CategoryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCategoryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Category model
   */
  readonly fields: CategoryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Category.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__CategoryClient<T, Null = never, ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> implements Prisma.PrismaPromise<T> {
    private readonly _dmmf;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);

    products<T extends Category$productsArgs<ExtArgs> = {}>(args?: Subset<T, Category$productsArgs<ExtArgs>>): Prisma.PrismaPromise<$Types.GetResult<ProductPayload<ExtArgs>, T, 'findMany'>| Null>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }



  /**
   * Fields of the Category model
   */ 
  interface CategoryFieldRefs {
    readonly id: FieldRef<"Category", 'String'>
    readonly name: FieldRef<"Category", 'String'>
    readonly description: FieldRef<"Category", 'String'>
    readonly createdAt: FieldRef<"Category", 'DateTime'>
  }
    

  // Custom InputTypes

  /**
   * Category findUnique
   */
  export type CategoryFindUniqueArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where: CategoryWhereUniqueInput
  }


  /**
   * Category findUniqueOrThrow
   */
  export type CategoryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where: CategoryWhereUniqueInput
  }


  /**
   * Category findFirst
   */
  export type CategoryFindFirstArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Categories.
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Categories.
     */
    distinct?: CategoryScalarFieldEnum | CategoryScalarFieldEnum[]
  }


  /**
   * Category findFirstOrThrow
   */
  export type CategoryFindFirstOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Categories.
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Categories.
     */
    distinct?: CategoryScalarFieldEnum | CategoryScalarFieldEnum[]
  }


  /**
   * Category findMany
   */
  export type CategoryFindManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Categories to fetch.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Categories.
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    distinct?: CategoryScalarFieldEnum | CategoryScalarFieldEnum[]
  }


  /**
   * Category create
   */
  export type CategoryCreateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * The data needed to create a Category.
     */
    data: XOR<CategoryCreateInput, CategoryUncheckedCreateInput>
  }


  /**
   * Category createMany
   */
  export type CategoryCreateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Categories.
     */
    data: CategoryCreateManyInput | CategoryCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * Category update
   */
  export type CategoryUpdateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * The data needed to update a Category.
     */
    data: XOR<CategoryUpdateInput, CategoryUncheckedUpdateInput>
    /**
     * Choose, which Category to update.
     */
    where: CategoryWhereUniqueInput
  }


  /**
   * Category updateMany
   */
  export type CategoryUpdateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Categories.
     */
    data: XOR<CategoryUpdateManyMutationInput, CategoryUncheckedUpdateManyInput>
    /**
     * Filter which Categories to update
     */
    where?: CategoryWhereInput
  }


  /**
   * Category upsert
   */
  export type CategoryUpsertArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * The filter to search for the Category to update in case it exists.
     */
    where: CategoryWhereUniqueInput
    /**
     * In case the Category found by the `where` argument doesn't exist, create a new Category with this data.
     */
    create: XOR<CategoryCreateInput, CategoryUncheckedCreateInput>
    /**
     * In case the Category was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CategoryUpdateInput, CategoryUncheckedUpdateInput>
  }


  /**
   * Category delete
   */
  export type CategoryDeleteArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter which Category to delete.
     */
    where: CategoryWhereUniqueInput
  }


  /**
   * Category deleteMany
   */
  export type CategoryDeleteManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Categories to delete
     */
    where?: CategoryWhereInput
  }


  /**
   * Category.products
   */
  export type Category$productsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
    where?: ProductWhereInput
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    cursor?: ProductWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ProductScalarFieldEnum | ProductScalarFieldEnum[]
  }


  /**
   * Category without action
   */
  export type CategoryArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CategoryInclude<ExtArgs> | null
  }



  /**
   * Model Product
   */


  export type AggregateProduct = {
    _count: ProductCountAggregateOutputType | null
    _avg: ProductAvgAggregateOutputType | null
    _sum: ProductSumAggregateOutputType | null
    _min: ProductMinAggregateOutputType | null
    _max: ProductMaxAggregateOutputType | null
  }

  export type ProductAvgAggregateOutputType = {
    price: number | null
  }

  export type ProductSumAggregateOutputType = {
    price: number | null
  }

  export type ProductMinAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    price: number | null
    image: string | null
    categoryId: string | null
    sellerId: string | null
    status: Status | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ProductMaxAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    price: number | null
    image: string | null
    categoryId: string | null
    sellerId: string | null
    status: Status | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ProductCountAggregateOutputType = {
    id: number
    name: number
    description: number
    price: number
    image: number
    categoryId: number
    sellerId: number
    status: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ProductAvgAggregateInputType = {
    price?: true
  }

  export type ProductSumAggregateInputType = {
    price?: true
  }

  export type ProductMinAggregateInputType = {
    id?: true
    name?: true
    description?: true
    price?: true
    image?: true
    categoryId?: true
    sellerId?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ProductMaxAggregateInputType = {
    id?: true
    name?: true
    description?: true
    price?: true
    image?: true
    categoryId?: true
    sellerId?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ProductCountAggregateInputType = {
    id?: true
    name?: true
    description?: true
    price?: true
    image?: true
    categoryId?: true
    sellerId?: true
    status?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ProductAggregateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Product to aggregate.
     */
    where?: ProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Products to fetch.
     */
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Products from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Products.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Products
    **/
    _count?: true | ProductCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ProductAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ProductSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ProductMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ProductMaxAggregateInputType
  }

  export type GetProductAggregateType<T extends ProductAggregateArgs> = {
        [P in keyof T & keyof AggregateProduct]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateProduct[P]>
      : GetScalarType<T[P], AggregateProduct[P]>
  }




  export type ProductGroupByArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: ProductWhereInput
    orderBy?: ProductOrderByWithAggregationInput | ProductOrderByWithAggregationInput[]
    by: ProductScalarFieldEnum[] | ProductScalarFieldEnum
    having?: ProductScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ProductCountAggregateInputType | true
    _avg?: ProductAvgAggregateInputType
    _sum?: ProductSumAggregateInputType
    _min?: ProductMinAggregateInputType
    _max?: ProductMaxAggregateInputType
  }


  export type ProductGroupByOutputType = {
    id: string
    name: string
    description: string
    price: number
    image: string | null
    categoryId: string
    sellerId: string
    status: Status
    createdAt: Date
    updatedAt: Date
    _count: ProductCountAggregateOutputType | null
    _avg: ProductAvgAggregateOutputType | null
    _sum: ProductSumAggregateOutputType | null
    _min: ProductMinAggregateOutputType | null
    _max: ProductMaxAggregateOutputType | null
  }

  type GetProductGroupByPayload<T extends ProductGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ProductGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ProductGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ProductGroupByOutputType[P]>
            : GetScalarType<T[P], ProductGroupByOutputType[P]>
        }
      >
    >


  export type ProductSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    description?: boolean
    price?: boolean
    image?: boolean
    categoryId?: boolean
    sellerId?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    category?: boolean | CategoryArgs<ExtArgs>
    seller?: boolean | UserArgs<ExtArgs>
    orderItems?: boolean | Product$orderItemsArgs<ExtArgs>
    mcpConfigurations?: boolean | Product$mcpConfigurationsArgs<ExtArgs>
    cartItems?: boolean | Product$cartItemsArgs<ExtArgs>
    _count?: boolean | ProductCountOutputTypeArgs<ExtArgs>
  }, ExtArgs["result"]["product"]>

  export type ProductSelectScalar = {
    id?: boolean
    name?: boolean
    description?: boolean
    price?: boolean
    image?: boolean
    categoryId?: boolean
    sellerId?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ProductInclude<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    category?: boolean | CategoryArgs<ExtArgs>
    seller?: boolean | UserArgs<ExtArgs>
    orderItems?: boolean | Product$orderItemsArgs<ExtArgs>
    mcpConfigurations?: boolean | Product$mcpConfigurationsArgs<ExtArgs>
    cartItems?: boolean | Product$cartItemsArgs<ExtArgs>
    _count?: boolean | ProductCountOutputTypeArgs<ExtArgs>
  }


  type ProductGetPayload<S extends boolean | null | undefined | ProductArgs> = $Types.GetResult<ProductPayload, S>

  type ProductCountArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = 
    Omit<ProductFindManyArgs, 'select' | 'include'> & {
      select?: ProductCountAggregateInputType | true
    }

  export interface ProductDelegate<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Product'], meta: { name: 'Product' } }
    /**
     * Find zero or one Product that matches the filter.
     * @param {ProductFindUniqueArgs} args - Arguments to find a Product
     * @example
     * // Get one Product
     * const product = await prisma.product.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends ProductFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, ProductFindUniqueArgs<ExtArgs>>
    ): Prisma__ProductClient<$Types.GetResult<ProductPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one Product that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {ProductFindUniqueOrThrowArgs} args - Arguments to find a Product
     * @example
     * // Get one Product
     * const product = await prisma.product.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends ProductFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, ProductFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__ProductClient<$Types.GetResult<ProductPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first Product that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductFindFirstArgs} args - Arguments to find a Product
     * @example
     * // Get one Product
     * const product = await prisma.product.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends ProductFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, ProductFindFirstArgs<ExtArgs>>
    ): Prisma__ProductClient<$Types.GetResult<ProductPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first Product that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductFindFirstOrThrowArgs} args - Arguments to find a Product
     * @example
     * // Get one Product
     * const product = await prisma.product.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends ProductFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, ProductFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__ProductClient<$Types.GetResult<ProductPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more Products that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Products
     * const products = await prisma.product.findMany()
     * 
     * // Get first 10 Products
     * const products = await prisma.product.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const productWithIdOnly = await prisma.product.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends ProductFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ProductFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Types.GetResult<ProductPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a Product.
     * @param {ProductCreateArgs} args - Arguments to create a Product.
     * @example
     * // Create one Product
     * const Product = await prisma.product.create({
     *   data: {
     *     // ... data to create a Product
     *   }
     * })
     * 
    **/
    create<T extends ProductCreateArgs<ExtArgs>>(
      args: SelectSubset<T, ProductCreateArgs<ExtArgs>>
    ): Prisma__ProductClient<$Types.GetResult<ProductPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many Products.
     *     @param {ProductCreateManyArgs} args - Arguments to create many Products.
     *     @example
     *     // Create many Products
     *     const product = await prisma.product.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends ProductCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ProductCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Product.
     * @param {ProductDeleteArgs} args - Arguments to delete one Product.
     * @example
     * // Delete one Product
     * const Product = await prisma.product.delete({
     *   where: {
     *     // ... filter to delete one Product
     *   }
     * })
     * 
    **/
    delete<T extends ProductDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, ProductDeleteArgs<ExtArgs>>
    ): Prisma__ProductClient<$Types.GetResult<ProductPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one Product.
     * @param {ProductUpdateArgs} args - Arguments to update one Product.
     * @example
     * // Update one Product
     * const product = await prisma.product.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends ProductUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, ProductUpdateArgs<ExtArgs>>
    ): Prisma__ProductClient<$Types.GetResult<ProductPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more Products.
     * @param {ProductDeleteManyArgs} args - Arguments to filter Products to delete.
     * @example
     * // Delete a few Products
     * const { count } = await prisma.product.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends ProductDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, ProductDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Products.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Products
     * const product = await prisma.product.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends ProductUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, ProductUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Product.
     * @param {ProductUpsertArgs} args - Arguments to update or create a Product.
     * @example
     * // Update or create a Product
     * const product = await prisma.product.upsert({
     *   create: {
     *     // ... data to create a Product
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Product we want to update
     *   }
     * })
    **/
    upsert<T extends ProductUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, ProductUpsertArgs<ExtArgs>>
    ): Prisma__ProductClient<$Types.GetResult<ProductPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of Products.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductCountArgs} args - Arguments to filter Products to count.
     * @example
     * // Count the number of Products
     * const count = await prisma.product.count({
     *   where: {
     *     // ... the filter for the Products we want to count
     *   }
     * })
    **/
    count<T extends ProductCountArgs>(
      args?: Subset<T, ProductCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ProductCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Product.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ProductAggregateArgs>(args: Subset<T, ProductAggregateArgs>): Prisma.PrismaPromise<GetProductAggregateType<T>>

    /**
     * Group by Product.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProductGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ProductGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ProductGroupByArgs['orderBy'] }
        : { orderBy?: ProductGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ProductGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetProductGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Product model
   */
  readonly fields: ProductFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Product.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__ProductClient<T, Null = never, ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> implements Prisma.PrismaPromise<T> {
    private readonly _dmmf;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);

    category<T extends CategoryArgs<ExtArgs> = {}>(args?: Subset<T, CategoryArgs<ExtArgs>>): Prisma__CategoryClient<$Types.GetResult<CategoryPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    seller<T extends UserArgs<ExtArgs> = {}>(args?: Subset<T, UserArgs<ExtArgs>>): Prisma__UserClient<$Types.GetResult<UserPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    orderItems<T extends Product$orderItemsArgs<ExtArgs> = {}>(args?: Subset<T, Product$orderItemsArgs<ExtArgs>>): Prisma.PrismaPromise<$Types.GetResult<OrderItemPayload<ExtArgs>, T, 'findMany'>| Null>;

    mcpConfigurations<T extends Product$mcpConfigurationsArgs<ExtArgs> = {}>(args?: Subset<T, Product$mcpConfigurationsArgs<ExtArgs>>): Prisma.PrismaPromise<$Types.GetResult<MCPConfigurationPayload<ExtArgs>, T, 'findMany'>| Null>;

    cartItems<T extends Product$cartItemsArgs<ExtArgs> = {}>(args?: Subset<T, Product$cartItemsArgs<ExtArgs>>): Prisma.PrismaPromise<$Types.GetResult<CartItemPayload<ExtArgs>, T, 'findMany'>| Null>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }



  /**
   * Fields of the Product model
   */ 
  interface ProductFieldRefs {
    readonly id: FieldRef<"Product", 'String'>
    readonly name: FieldRef<"Product", 'String'>
    readonly description: FieldRef<"Product", 'String'>
    readonly price: FieldRef<"Product", 'Float'>
    readonly image: FieldRef<"Product", 'String'>
    readonly categoryId: FieldRef<"Product", 'String'>
    readonly sellerId: FieldRef<"Product", 'String'>
    readonly status: FieldRef<"Product", 'Status'>
    readonly createdAt: FieldRef<"Product", 'DateTime'>
    readonly updatedAt: FieldRef<"Product", 'DateTime'>
  }
    

  // Custom InputTypes

  /**
   * Product findUnique
   */
  export type ProductFindUniqueArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * Filter, which Product to fetch.
     */
    where: ProductWhereUniqueInput
  }


  /**
   * Product findUniqueOrThrow
   */
  export type ProductFindUniqueOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * Filter, which Product to fetch.
     */
    where: ProductWhereUniqueInput
  }


  /**
   * Product findFirst
   */
  export type ProductFindFirstArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * Filter, which Product to fetch.
     */
    where?: ProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Products to fetch.
     */
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Products.
     */
    cursor?: ProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Products from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Products.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Products.
     */
    distinct?: ProductScalarFieldEnum | ProductScalarFieldEnum[]
  }


  /**
   * Product findFirstOrThrow
   */
  export type ProductFindFirstOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * Filter, which Product to fetch.
     */
    where?: ProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Products to fetch.
     */
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Products.
     */
    cursor?: ProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Products from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Products.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Products.
     */
    distinct?: ProductScalarFieldEnum | ProductScalarFieldEnum[]
  }


  /**
   * Product findMany
   */
  export type ProductFindManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * Filter, which Products to fetch.
     */
    where?: ProductWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Products to fetch.
     */
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Products.
     */
    cursor?: ProductWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Products from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Products.
     */
    skip?: number
    distinct?: ProductScalarFieldEnum | ProductScalarFieldEnum[]
  }


  /**
   * Product create
   */
  export type ProductCreateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * The data needed to create a Product.
     */
    data: XOR<ProductCreateInput, ProductUncheckedCreateInput>
  }


  /**
   * Product createMany
   */
  export type ProductCreateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Products.
     */
    data: ProductCreateManyInput | ProductCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * Product update
   */
  export type ProductUpdateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * The data needed to update a Product.
     */
    data: XOR<ProductUpdateInput, ProductUncheckedUpdateInput>
    /**
     * Choose, which Product to update.
     */
    where: ProductWhereUniqueInput
  }


  /**
   * Product updateMany
   */
  export type ProductUpdateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Products.
     */
    data: XOR<ProductUpdateManyMutationInput, ProductUncheckedUpdateManyInput>
    /**
     * Filter which Products to update
     */
    where?: ProductWhereInput
  }


  /**
   * Product upsert
   */
  export type ProductUpsertArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * The filter to search for the Product to update in case it exists.
     */
    where: ProductWhereUniqueInput
    /**
     * In case the Product found by the `where` argument doesn't exist, create a new Product with this data.
     */
    create: XOR<ProductCreateInput, ProductUncheckedCreateInput>
    /**
     * In case the Product was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ProductUpdateInput, ProductUncheckedUpdateInput>
  }


  /**
   * Product delete
   */
  export type ProductDeleteArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
    /**
     * Filter which Product to delete.
     */
    where: ProductWhereUniqueInput
  }


  /**
   * Product deleteMany
   */
  export type ProductDeleteManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Products to delete
     */
    where?: ProductWhereInput
  }


  /**
   * Product.orderItems
   */
  export type Product$orderItemsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderItemInclude<ExtArgs> | null
    where?: OrderItemWhereInput
    orderBy?: OrderItemOrderByWithRelationInput | OrderItemOrderByWithRelationInput[]
    cursor?: OrderItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }


  /**
   * Product.mcpConfigurations
   */
  export type Product$mcpConfigurationsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MCPConfiguration
     */
    select?: MCPConfigurationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: MCPConfigurationInclude<ExtArgs> | null
    where?: MCPConfigurationWhereInput
    orderBy?: MCPConfigurationOrderByWithRelationInput | MCPConfigurationOrderByWithRelationInput[]
    cursor?: MCPConfigurationWhereUniqueInput
    take?: number
    skip?: number
    distinct?: MCPConfigurationScalarFieldEnum | MCPConfigurationScalarFieldEnum[]
  }


  /**
   * Product.cartItems
   */
  export type Product$cartItemsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartItem
     */
    select?: CartItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartItemInclude<ExtArgs> | null
    where?: CartItemWhereInput
    orderBy?: CartItemOrderByWithRelationInput | CartItemOrderByWithRelationInput[]
    cursor?: CartItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CartItemScalarFieldEnum | CartItemScalarFieldEnum[]
  }


  /**
   * Product without action
   */
  export type ProductArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
  }



  /**
   * Model Order
   */


  export type AggregateOrder = {
    _count: OrderCountAggregateOutputType | null
    _avg: OrderAvgAggregateOutputType | null
    _sum: OrderSumAggregateOutputType | null
    _min: OrderMinAggregateOutputType | null
    _max: OrderMaxAggregateOutputType | null
  }

  export type OrderAvgAggregateOutputType = {
    total: number | null
  }

  export type OrderSumAggregateOutputType = {
    total: number | null
  }

  export type OrderMinAggregateOutputType = {
    id: string | null
    userId: string | null
    total: number | null
    status: OrderStatus | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type OrderMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    total: number | null
    status: OrderStatus | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type OrderCountAggregateOutputType = {
    id: number
    userId: number
    total: number
    status: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type OrderAvgAggregateInputType = {
    total?: true
  }

  export type OrderSumAggregateInputType = {
    total?: true
  }

  export type OrderMinAggregateInputType = {
    id?: true
    userId?: true
    total?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type OrderMaxAggregateInputType = {
    id?: true
    userId?: true
    total?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type OrderCountAggregateInputType = {
    id?: true
    userId?: true
    total?: true
    status?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type OrderAggregateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Order to aggregate.
     */
    where?: OrderWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Orders to fetch.
     */
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: OrderWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Orders from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Orders.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Orders
    **/
    _count?: true | OrderCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: OrderAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: OrderSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: OrderMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: OrderMaxAggregateInputType
  }

  export type GetOrderAggregateType<T extends OrderAggregateArgs> = {
        [P in keyof T & keyof AggregateOrder]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOrder[P]>
      : GetScalarType<T[P], AggregateOrder[P]>
  }




  export type OrderGroupByArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: OrderWhereInput
    orderBy?: OrderOrderByWithAggregationInput | OrderOrderByWithAggregationInput[]
    by: OrderScalarFieldEnum[] | OrderScalarFieldEnum
    having?: OrderScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: OrderCountAggregateInputType | true
    _avg?: OrderAvgAggregateInputType
    _sum?: OrderSumAggregateInputType
    _min?: OrderMinAggregateInputType
    _max?: OrderMaxAggregateInputType
  }


  export type OrderGroupByOutputType = {
    id: string
    userId: string
    total: number
    status: OrderStatus
    createdAt: Date
    updatedAt: Date
    _count: OrderCountAggregateOutputType | null
    _avg: OrderAvgAggregateOutputType | null
    _sum: OrderSumAggregateOutputType | null
    _min: OrderMinAggregateOutputType | null
    _max: OrderMaxAggregateOutputType | null
  }

  type GetOrderGroupByPayload<T extends OrderGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<OrderGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof OrderGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OrderGroupByOutputType[P]>
            : GetScalarType<T[P], OrderGroupByOutputType[P]>
        }
      >
    >


  export type OrderSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    total?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserArgs<ExtArgs>
    items?: boolean | Order$itemsArgs<ExtArgs>
    _count?: boolean | OrderCountOutputTypeArgs<ExtArgs>
  }, ExtArgs["result"]["order"]>

  export type OrderSelectScalar = {
    id?: boolean
    userId?: boolean
    total?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type OrderInclude<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    user?: boolean | UserArgs<ExtArgs>
    items?: boolean | Order$itemsArgs<ExtArgs>
    _count?: boolean | OrderCountOutputTypeArgs<ExtArgs>
  }


  type OrderGetPayload<S extends boolean | null | undefined | OrderArgs> = $Types.GetResult<OrderPayload, S>

  type OrderCountArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = 
    Omit<OrderFindManyArgs, 'select' | 'include'> & {
      select?: OrderCountAggregateInputType | true
    }

  export interface OrderDelegate<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Order'], meta: { name: 'Order' } }
    /**
     * Find zero or one Order that matches the filter.
     * @param {OrderFindUniqueArgs} args - Arguments to find a Order
     * @example
     * // Get one Order
     * const order = await prisma.order.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends OrderFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, OrderFindUniqueArgs<ExtArgs>>
    ): Prisma__OrderClient<$Types.GetResult<OrderPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one Order that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {OrderFindUniqueOrThrowArgs} args - Arguments to find a Order
     * @example
     * // Get one Order
     * const order = await prisma.order.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends OrderFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, OrderFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__OrderClient<$Types.GetResult<OrderPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first Order that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderFindFirstArgs} args - Arguments to find a Order
     * @example
     * // Get one Order
     * const order = await prisma.order.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends OrderFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, OrderFindFirstArgs<ExtArgs>>
    ): Prisma__OrderClient<$Types.GetResult<OrderPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first Order that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderFindFirstOrThrowArgs} args - Arguments to find a Order
     * @example
     * // Get one Order
     * const order = await prisma.order.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends OrderFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, OrderFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__OrderClient<$Types.GetResult<OrderPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more Orders that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Orders
     * const orders = await prisma.order.findMany()
     * 
     * // Get first 10 Orders
     * const orders = await prisma.order.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const orderWithIdOnly = await prisma.order.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends OrderFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, OrderFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Types.GetResult<OrderPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a Order.
     * @param {OrderCreateArgs} args - Arguments to create a Order.
     * @example
     * // Create one Order
     * const Order = await prisma.order.create({
     *   data: {
     *     // ... data to create a Order
     *   }
     * })
     * 
    **/
    create<T extends OrderCreateArgs<ExtArgs>>(
      args: SelectSubset<T, OrderCreateArgs<ExtArgs>>
    ): Prisma__OrderClient<$Types.GetResult<OrderPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many Orders.
     *     @param {OrderCreateManyArgs} args - Arguments to create many Orders.
     *     @example
     *     // Create many Orders
     *     const order = await prisma.order.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends OrderCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, OrderCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Order.
     * @param {OrderDeleteArgs} args - Arguments to delete one Order.
     * @example
     * // Delete one Order
     * const Order = await prisma.order.delete({
     *   where: {
     *     // ... filter to delete one Order
     *   }
     * })
     * 
    **/
    delete<T extends OrderDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, OrderDeleteArgs<ExtArgs>>
    ): Prisma__OrderClient<$Types.GetResult<OrderPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one Order.
     * @param {OrderUpdateArgs} args - Arguments to update one Order.
     * @example
     * // Update one Order
     * const order = await prisma.order.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends OrderUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, OrderUpdateArgs<ExtArgs>>
    ): Prisma__OrderClient<$Types.GetResult<OrderPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more Orders.
     * @param {OrderDeleteManyArgs} args - Arguments to filter Orders to delete.
     * @example
     * // Delete a few Orders
     * const { count } = await prisma.order.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends OrderDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, OrderDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Orders.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Orders
     * const order = await prisma.order.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends OrderUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, OrderUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Order.
     * @param {OrderUpsertArgs} args - Arguments to update or create a Order.
     * @example
     * // Update or create a Order
     * const order = await prisma.order.upsert({
     *   create: {
     *     // ... data to create a Order
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Order we want to update
     *   }
     * })
    **/
    upsert<T extends OrderUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, OrderUpsertArgs<ExtArgs>>
    ): Prisma__OrderClient<$Types.GetResult<OrderPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of Orders.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderCountArgs} args - Arguments to filter Orders to count.
     * @example
     * // Count the number of Orders
     * const count = await prisma.order.count({
     *   where: {
     *     // ... the filter for the Orders we want to count
     *   }
     * })
    **/
    count<T extends OrderCountArgs>(
      args?: Subset<T, OrderCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], OrderCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Order.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends OrderAggregateArgs>(args: Subset<T, OrderAggregateArgs>): Prisma.PrismaPromise<GetOrderAggregateType<T>>

    /**
     * Group by Order.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends OrderGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OrderGroupByArgs['orderBy'] }
        : { orderBy?: OrderGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, OrderGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOrderGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Order model
   */
  readonly fields: OrderFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Order.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__OrderClient<T, Null = never, ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> implements Prisma.PrismaPromise<T> {
    private readonly _dmmf;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);

    user<T extends UserArgs<ExtArgs> = {}>(args?: Subset<T, UserArgs<ExtArgs>>): Prisma__UserClient<$Types.GetResult<UserPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    items<T extends Order$itemsArgs<ExtArgs> = {}>(args?: Subset<T, Order$itemsArgs<ExtArgs>>): Prisma.PrismaPromise<$Types.GetResult<OrderItemPayload<ExtArgs>, T, 'findMany'>| Null>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }



  /**
   * Fields of the Order model
   */ 
  interface OrderFieldRefs {
    readonly id: FieldRef<"Order", 'String'>
    readonly userId: FieldRef<"Order", 'String'>
    readonly total: FieldRef<"Order", 'Float'>
    readonly status: FieldRef<"Order", 'OrderStatus'>
    readonly createdAt: FieldRef<"Order", 'DateTime'>
    readonly updatedAt: FieldRef<"Order", 'DateTime'>
  }
    

  // Custom InputTypes

  /**
   * Order findUnique
   */
  export type OrderFindUniqueArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Order to fetch.
     */
    where: OrderWhereUniqueInput
  }


  /**
   * Order findUniqueOrThrow
   */
  export type OrderFindUniqueOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Order to fetch.
     */
    where: OrderWhereUniqueInput
  }


  /**
   * Order findFirst
   */
  export type OrderFindFirstArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Order to fetch.
     */
    where?: OrderWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Orders to fetch.
     */
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Orders.
     */
    cursor?: OrderWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Orders from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Orders.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Orders.
     */
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }


  /**
   * Order findFirstOrThrow
   */
  export type OrderFindFirstOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Order to fetch.
     */
    where?: OrderWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Orders to fetch.
     */
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Orders.
     */
    cursor?: OrderWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Orders from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Orders.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Orders.
     */
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }


  /**
   * Order findMany
   */
  export type OrderFindManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter, which Orders to fetch.
     */
    where?: OrderWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Orders to fetch.
     */
    orderBy?: OrderOrderByWithRelationInput | OrderOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Orders.
     */
    cursor?: OrderWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Orders from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Orders.
     */
    skip?: number
    distinct?: OrderScalarFieldEnum | OrderScalarFieldEnum[]
  }


  /**
   * Order create
   */
  export type OrderCreateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * The data needed to create a Order.
     */
    data: XOR<OrderCreateInput, OrderUncheckedCreateInput>
  }


  /**
   * Order createMany
   */
  export type OrderCreateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Orders.
     */
    data: OrderCreateManyInput | OrderCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * Order update
   */
  export type OrderUpdateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * The data needed to update a Order.
     */
    data: XOR<OrderUpdateInput, OrderUncheckedUpdateInput>
    /**
     * Choose, which Order to update.
     */
    where: OrderWhereUniqueInput
  }


  /**
   * Order updateMany
   */
  export type OrderUpdateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Orders.
     */
    data: XOR<OrderUpdateManyMutationInput, OrderUncheckedUpdateManyInput>
    /**
     * Filter which Orders to update
     */
    where?: OrderWhereInput
  }


  /**
   * Order upsert
   */
  export type OrderUpsertArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * The filter to search for the Order to update in case it exists.
     */
    where: OrderWhereUniqueInput
    /**
     * In case the Order found by the `where` argument doesn't exist, create a new Order with this data.
     */
    create: XOR<OrderCreateInput, OrderUncheckedCreateInput>
    /**
     * In case the Order was found with the provided `where` argument, update it with this data.
     */
    update: XOR<OrderUpdateInput, OrderUncheckedUpdateInput>
  }


  /**
   * Order delete
   */
  export type OrderDeleteArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderInclude<ExtArgs> | null
    /**
     * Filter which Order to delete.
     */
    where: OrderWhereUniqueInput
  }


  /**
   * Order deleteMany
   */
  export type OrderDeleteManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Orders to delete
     */
    where?: OrderWhereInput
  }


  /**
   * Order.items
   */
  export type Order$itemsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderItemInclude<ExtArgs> | null
    where?: OrderItemWhereInput
    orderBy?: OrderItemOrderByWithRelationInput | OrderItemOrderByWithRelationInput[]
    cursor?: OrderItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }


  /**
   * Order without action
   */
  export type OrderArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: OrderSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderInclude<ExtArgs> | null
  }



  /**
   * Model OrderItem
   */


  export type AggregateOrderItem = {
    _count: OrderItemCountAggregateOutputType | null
    _avg: OrderItemAvgAggregateOutputType | null
    _sum: OrderItemSumAggregateOutputType | null
    _min: OrderItemMinAggregateOutputType | null
    _max: OrderItemMaxAggregateOutputType | null
  }

  export type OrderItemAvgAggregateOutputType = {
    quantity: number | null
    price: number | null
  }

  export type OrderItemSumAggregateOutputType = {
    quantity: number | null
    price: number | null
  }

  export type OrderItemMinAggregateOutputType = {
    id: string | null
    orderId: string | null
    productId: string | null
    quantity: number | null
    price: number | null
  }

  export type OrderItemMaxAggregateOutputType = {
    id: string | null
    orderId: string | null
    productId: string | null
    quantity: number | null
    price: number | null
  }

  export type OrderItemCountAggregateOutputType = {
    id: number
    orderId: number
    productId: number
    quantity: number
    price: number
    _all: number
  }


  export type OrderItemAvgAggregateInputType = {
    quantity?: true
    price?: true
  }

  export type OrderItemSumAggregateInputType = {
    quantity?: true
    price?: true
  }

  export type OrderItemMinAggregateInputType = {
    id?: true
    orderId?: true
    productId?: true
    quantity?: true
    price?: true
  }

  export type OrderItemMaxAggregateInputType = {
    id?: true
    orderId?: true
    productId?: true
    quantity?: true
    price?: true
  }

  export type OrderItemCountAggregateInputType = {
    id?: true
    orderId?: true
    productId?: true
    quantity?: true
    price?: true
    _all?: true
  }

  export type OrderItemAggregateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which OrderItem to aggregate.
     */
    where?: OrderItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OrderItems to fetch.
     */
    orderBy?: OrderItemOrderByWithRelationInput | OrderItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: OrderItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OrderItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OrderItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned OrderItems
    **/
    _count?: true | OrderItemCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: OrderItemAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: OrderItemSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: OrderItemMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: OrderItemMaxAggregateInputType
  }

  export type GetOrderItemAggregateType<T extends OrderItemAggregateArgs> = {
        [P in keyof T & keyof AggregateOrderItem]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOrderItem[P]>
      : GetScalarType<T[P], AggregateOrderItem[P]>
  }




  export type OrderItemGroupByArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: OrderItemWhereInput
    orderBy?: OrderItemOrderByWithAggregationInput | OrderItemOrderByWithAggregationInput[]
    by: OrderItemScalarFieldEnum[] | OrderItemScalarFieldEnum
    having?: OrderItemScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: OrderItemCountAggregateInputType | true
    _avg?: OrderItemAvgAggregateInputType
    _sum?: OrderItemSumAggregateInputType
    _min?: OrderItemMinAggregateInputType
    _max?: OrderItemMaxAggregateInputType
  }


  export type OrderItemGroupByOutputType = {
    id: string
    orderId: string
    productId: string
    quantity: number
    price: number
    _count: OrderItemCountAggregateOutputType | null
    _avg: OrderItemAvgAggregateOutputType | null
    _sum: OrderItemSumAggregateOutputType | null
    _min: OrderItemMinAggregateOutputType | null
    _max: OrderItemMaxAggregateOutputType | null
  }

  type GetOrderItemGroupByPayload<T extends OrderItemGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<OrderItemGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof OrderItemGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OrderItemGroupByOutputType[P]>
            : GetScalarType<T[P], OrderItemGroupByOutputType[P]>
        }
      >
    >


  export type OrderItemSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orderId?: boolean
    productId?: boolean
    quantity?: boolean
    price?: boolean
    order?: boolean | OrderArgs<ExtArgs>
    product?: boolean | ProductArgs<ExtArgs>
  }, ExtArgs["result"]["orderItem"]>

  export type OrderItemSelectScalar = {
    id?: boolean
    orderId?: boolean
    productId?: boolean
    quantity?: boolean
    price?: boolean
  }

  export type OrderItemInclude<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    order?: boolean | OrderArgs<ExtArgs>
    product?: boolean | ProductArgs<ExtArgs>
  }


  type OrderItemGetPayload<S extends boolean | null | undefined | OrderItemArgs> = $Types.GetResult<OrderItemPayload, S>

  type OrderItemCountArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = 
    Omit<OrderItemFindManyArgs, 'select' | 'include'> & {
      select?: OrderItemCountAggregateInputType | true
    }

  export interface OrderItemDelegate<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['OrderItem'], meta: { name: 'OrderItem' } }
    /**
     * Find zero or one OrderItem that matches the filter.
     * @param {OrderItemFindUniqueArgs} args - Arguments to find a OrderItem
     * @example
     * // Get one OrderItem
     * const orderItem = await prisma.orderItem.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends OrderItemFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, OrderItemFindUniqueArgs<ExtArgs>>
    ): Prisma__OrderItemClient<$Types.GetResult<OrderItemPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one OrderItem that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {OrderItemFindUniqueOrThrowArgs} args - Arguments to find a OrderItem
     * @example
     * // Get one OrderItem
     * const orderItem = await prisma.orderItem.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends OrderItemFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, OrderItemFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__OrderItemClient<$Types.GetResult<OrderItemPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first OrderItem that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemFindFirstArgs} args - Arguments to find a OrderItem
     * @example
     * // Get one OrderItem
     * const orderItem = await prisma.orderItem.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends OrderItemFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, OrderItemFindFirstArgs<ExtArgs>>
    ): Prisma__OrderItemClient<$Types.GetResult<OrderItemPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first OrderItem that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemFindFirstOrThrowArgs} args - Arguments to find a OrderItem
     * @example
     * // Get one OrderItem
     * const orderItem = await prisma.orderItem.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends OrderItemFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, OrderItemFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__OrderItemClient<$Types.GetResult<OrderItemPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more OrderItems that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all OrderItems
     * const orderItems = await prisma.orderItem.findMany()
     * 
     * // Get first 10 OrderItems
     * const orderItems = await prisma.orderItem.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const orderItemWithIdOnly = await prisma.orderItem.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends OrderItemFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, OrderItemFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Types.GetResult<OrderItemPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a OrderItem.
     * @param {OrderItemCreateArgs} args - Arguments to create a OrderItem.
     * @example
     * // Create one OrderItem
     * const OrderItem = await prisma.orderItem.create({
     *   data: {
     *     // ... data to create a OrderItem
     *   }
     * })
     * 
    **/
    create<T extends OrderItemCreateArgs<ExtArgs>>(
      args: SelectSubset<T, OrderItemCreateArgs<ExtArgs>>
    ): Prisma__OrderItemClient<$Types.GetResult<OrderItemPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many OrderItems.
     *     @param {OrderItemCreateManyArgs} args - Arguments to create many OrderItems.
     *     @example
     *     // Create many OrderItems
     *     const orderItem = await prisma.orderItem.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends OrderItemCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, OrderItemCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a OrderItem.
     * @param {OrderItemDeleteArgs} args - Arguments to delete one OrderItem.
     * @example
     * // Delete one OrderItem
     * const OrderItem = await prisma.orderItem.delete({
     *   where: {
     *     // ... filter to delete one OrderItem
     *   }
     * })
     * 
    **/
    delete<T extends OrderItemDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, OrderItemDeleteArgs<ExtArgs>>
    ): Prisma__OrderItemClient<$Types.GetResult<OrderItemPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one OrderItem.
     * @param {OrderItemUpdateArgs} args - Arguments to update one OrderItem.
     * @example
     * // Update one OrderItem
     * const orderItem = await prisma.orderItem.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends OrderItemUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, OrderItemUpdateArgs<ExtArgs>>
    ): Prisma__OrderItemClient<$Types.GetResult<OrderItemPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more OrderItems.
     * @param {OrderItemDeleteManyArgs} args - Arguments to filter OrderItems to delete.
     * @example
     * // Delete a few OrderItems
     * const { count } = await prisma.orderItem.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends OrderItemDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, OrderItemDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more OrderItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many OrderItems
     * const orderItem = await prisma.orderItem.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends OrderItemUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, OrderItemUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one OrderItem.
     * @param {OrderItemUpsertArgs} args - Arguments to update or create a OrderItem.
     * @example
     * // Update or create a OrderItem
     * const orderItem = await prisma.orderItem.upsert({
     *   create: {
     *     // ... data to create a OrderItem
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the OrderItem we want to update
     *   }
     * })
    **/
    upsert<T extends OrderItemUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, OrderItemUpsertArgs<ExtArgs>>
    ): Prisma__OrderItemClient<$Types.GetResult<OrderItemPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of OrderItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemCountArgs} args - Arguments to filter OrderItems to count.
     * @example
     * // Count the number of OrderItems
     * const count = await prisma.orderItem.count({
     *   where: {
     *     // ... the filter for the OrderItems we want to count
     *   }
     * })
    **/
    count<T extends OrderItemCountArgs>(
      args?: Subset<T, OrderItemCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], OrderItemCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a OrderItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends OrderItemAggregateArgs>(args: Subset<T, OrderItemAggregateArgs>): Prisma.PrismaPromise<GetOrderItemAggregateType<T>>

    /**
     * Group by OrderItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends OrderItemGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OrderItemGroupByArgs['orderBy'] }
        : { orderBy?: OrderItemGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, OrderItemGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOrderItemGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the OrderItem model
   */
  readonly fields: OrderItemFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for OrderItem.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__OrderItemClient<T, Null = never, ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> implements Prisma.PrismaPromise<T> {
    private readonly _dmmf;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);

    order<T extends OrderArgs<ExtArgs> = {}>(args?: Subset<T, OrderArgs<ExtArgs>>): Prisma__OrderClient<$Types.GetResult<OrderPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    product<T extends ProductArgs<ExtArgs> = {}>(args?: Subset<T, ProductArgs<ExtArgs>>): Prisma__ProductClient<$Types.GetResult<ProductPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }



  /**
   * Fields of the OrderItem model
   */ 
  interface OrderItemFieldRefs {
    readonly id: FieldRef<"OrderItem", 'String'>
    readonly orderId: FieldRef<"OrderItem", 'String'>
    readonly productId: FieldRef<"OrderItem", 'String'>
    readonly quantity: FieldRef<"OrderItem", 'Int'>
    readonly price: FieldRef<"OrderItem", 'Float'>
  }
    

  // Custom InputTypes

  /**
   * OrderItem findUnique
   */
  export type OrderItemFindUniqueArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * Filter, which OrderItem to fetch.
     */
    where: OrderItemWhereUniqueInput
  }


  /**
   * OrderItem findUniqueOrThrow
   */
  export type OrderItemFindUniqueOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * Filter, which OrderItem to fetch.
     */
    where: OrderItemWhereUniqueInput
  }


  /**
   * OrderItem findFirst
   */
  export type OrderItemFindFirstArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * Filter, which OrderItem to fetch.
     */
    where?: OrderItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OrderItems to fetch.
     */
    orderBy?: OrderItemOrderByWithRelationInput | OrderItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for OrderItems.
     */
    cursor?: OrderItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OrderItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OrderItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of OrderItems.
     */
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }


  /**
   * OrderItem findFirstOrThrow
   */
  export type OrderItemFindFirstOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * Filter, which OrderItem to fetch.
     */
    where?: OrderItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OrderItems to fetch.
     */
    orderBy?: OrderItemOrderByWithRelationInput | OrderItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for OrderItems.
     */
    cursor?: OrderItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OrderItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OrderItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of OrderItems.
     */
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }


  /**
   * OrderItem findMany
   */
  export type OrderItemFindManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * Filter, which OrderItems to fetch.
     */
    where?: OrderItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OrderItems to fetch.
     */
    orderBy?: OrderItemOrderByWithRelationInput | OrderItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing OrderItems.
     */
    cursor?: OrderItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OrderItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OrderItems.
     */
    skip?: number
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }


  /**
   * OrderItem create
   */
  export type OrderItemCreateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * The data needed to create a OrderItem.
     */
    data: XOR<OrderItemCreateInput, OrderItemUncheckedCreateInput>
  }


  /**
   * OrderItem createMany
   */
  export type OrderItemCreateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many OrderItems.
     */
    data: OrderItemCreateManyInput | OrderItemCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * OrderItem update
   */
  export type OrderItemUpdateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * The data needed to update a OrderItem.
     */
    data: XOR<OrderItemUpdateInput, OrderItemUncheckedUpdateInput>
    /**
     * Choose, which OrderItem to update.
     */
    where: OrderItemWhereUniqueInput
  }


  /**
   * OrderItem updateMany
   */
  export type OrderItemUpdateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to update OrderItems.
     */
    data: XOR<OrderItemUpdateManyMutationInput, OrderItemUncheckedUpdateManyInput>
    /**
     * Filter which OrderItems to update
     */
    where?: OrderItemWhereInput
  }


  /**
   * OrderItem upsert
   */
  export type OrderItemUpsertArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * The filter to search for the OrderItem to update in case it exists.
     */
    where: OrderItemWhereUniqueInput
    /**
     * In case the OrderItem found by the `where` argument doesn't exist, create a new OrderItem with this data.
     */
    create: XOR<OrderItemCreateInput, OrderItemUncheckedCreateInput>
    /**
     * In case the OrderItem was found with the provided `where` argument, update it with this data.
     */
    update: XOR<OrderItemUpdateInput, OrderItemUncheckedUpdateInput>
  }


  /**
   * OrderItem delete
   */
  export type OrderItemDeleteArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderItemInclude<ExtArgs> | null
    /**
     * Filter which OrderItem to delete.
     */
    where: OrderItemWhereUniqueInput
  }


  /**
   * OrderItem deleteMany
   */
  export type OrderItemDeleteManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which OrderItems to delete
     */
    where?: OrderItemWhereInput
  }


  /**
   * OrderItem without action
   */
  export type OrderItemArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItem
     */
    select?: OrderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: OrderItemInclude<ExtArgs> | null
  }



  /**
   * Model Cart
   */


  export type AggregateCart = {
    _count: CartCountAggregateOutputType | null
    _min: CartMinAggregateOutputType | null
    _max: CartMaxAggregateOutputType | null
  }

  export type CartMinAggregateOutputType = {
    id: string | null
    userId: string | null
  }

  export type CartMaxAggregateOutputType = {
    id: string | null
    userId: string | null
  }

  export type CartCountAggregateOutputType = {
    id: number
    userId: number
    _all: number
  }


  export type CartMinAggregateInputType = {
    id?: true
    userId?: true
  }

  export type CartMaxAggregateInputType = {
    id?: true
    userId?: true
  }

  export type CartCountAggregateInputType = {
    id?: true
    userId?: true
    _all?: true
  }

  export type CartAggregateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Cart to aggregate.
     */
    where?: CartWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Carts to fetch.
     */
    orderBy?: CartOrderByWithRelationInput | CartOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CartWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Carts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Carts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Carts
    **/
    _count?: true | CartCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CartMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CartMaxAggregateInputType
  }

  export type GetCartAggregateType<T extends CartAggregateArgs> = {
        [P in keyof T & keyof AggregateCart]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCart[P]>
      : GetScalarType<T[P], AggregateCart[P]>
  }




  export type CartGroupByArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: CartWhereInput
    orderBy?: CartOrderByWithAggregationInput | CartOrderByWithAggregationInput[]
    by: CartScalarFieldEnum[] | CartScalarFieldEnum
    having?: CartScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CartCountAggregateInputType | true
    _min?: CartMinAggregateInputType
    _max?: CartMaxAggregateInputType
  }


  export type CartGroupByOutputType = {
    id: string
    userId: string
    _count: CartCountAggregateOutputType | null
    _min: CartMinAggregateOutputType | null
    _max: CartMaxAggregateOutputType | null
  }

  type GetCartGroupByPayload<T extends CartGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CartGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CartGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CartGroupByOutputType[P]>
            : GetScalarType<T[P], CartGroupByOutputType[P]>
        }
      >
    >


  export type CartSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    user?: boolean | UserArgs<ExtArgs>
    items?: boolean | Cart$itemsArgs<ExtArgs>
    _count?: boolean | CartCountOutputTypeArgs<ExtArgs>
  }, ExtArgs["result"]["cart"]>

  export type CartSelectScalar = {
    id?: boolean
    userId?: boolean
  }

  export type CartInclude<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    user?: boolean | UserArgs<ExtArgs>
    items?: boolean | Cart$itemsArgs<ExtArgs>
    _count?: boolean | CartCountOutputTypeArgs<ExtArgs>
  }


  type CartGetPayload<S extends boolean | null | undefined | CartArgs> = $Types.GetResult<CartPayload, S>

  type CartCountArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = 
    Omit<CartFindManyArgs, 'select' | 'include'> & {
      select?: CartCountAggregateInputType | true
    }

  export interface CartDelegate<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Cart'], meta: { name: 'Cart' } }
    /**
     * Find zero or one Cart that matches the filter.
     * @param {CartFindUniqueArgs} args - Arguments to find a Cart
     * @example
     * // Get one Cart
     * const cart = await prisma.cart.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends CartFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, CartFindUniqueArgs<ExtArgs>>
    ): Prisma__CartClient<$Types.GetResult<CartPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one Cart that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {CartFindUniqueOrThrowArgs} args - Arguments to find a Cart
     * @example
     * // Get one Cart
     * const cart = await prisma.cart.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends CartFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, CartFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__CartClient<$Types.GetResult<CartPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first Cart that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartFindFirstArgs} args - Arguments to find a Cart
     * @example
     * // Get one Cart
     * const cart = await prisma.cart.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends CartFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, CartFindFirstArgs<ExtArgs>>
    ): Prisma__CartClient<$Types.GetResult<CartPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first Cart that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartFindFirstOrThrowArgs} args - Arguments to find a Cart
     * @example
     * // Get one Cart
     * const cart = await prisma.cart.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends CartFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, CartFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__CartClient<$Types.GetResult<CartPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more Carts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Carts
     * const carts = await prisma.cart.findMany()
     * 
     * // Get first 10 Carts
     * const carts = await prisma.cart.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const cartWithIdOnly = await prisma.cart.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends CartFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, CartFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Types.GetResult<CartPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a Cart.
     * @param {CartCreateArgs} args - Arguments to create a Cart.
     * @example
     * // Create one Cart
     * const Cart = await prisma.cart.create({
     *   data: {
     *     // ... data to create a Cart
     *   }
     * })
     * 
    **/
    create<T extends CartCreateArgs<ExtArgs>>(
      args: SelectSubset<T, CartCreateArgs<ExtArgs>>
    ): Prisma__CartClient<$Types.GetResult<CartPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many Carts.
     *     @param {CartCreateManyArgs} args - Arguments to create many Carts.
     *     @example
     *     // Create many Carts
     *     const cart = await prisma.cart.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends CartCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, CartCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a Cart.
     * @param {CartDeleteArgs} args - Arguments to delete one Cart.
     * @example
     * // Delete one Cart
     * const Cart = await prisma.cart.delete({
     *   where: {
     *     // ... filter to delete one Cart
     *   }
     * })
     * 
    **/
    delete<T extends CartDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, CartDeleteArgs<ExtArgs>>
    ): Prisma__CartClient<$Types.GetResult<CartPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one Cart.
     * @param {CartUpdateArgs} args - Arguments to update one Cart.
     * @example
     * // Update one Cart
     * const cart = await prisma.cart.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends CartUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, CartUpdateArgs<ExtArgs>>
    ): Prisma__CartClient<$Types.GetResult<CartPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more Carts.
     * @param {CartDeleteManyArgs} args - Arguments to filter Carts to delete.
     * @example
     * // Delete a few Carts
     * const { count } = await prisma.cart.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends CartDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, CartDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Carts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Carts
     * const cart = await prisma.cart.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends CartUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, CartUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Cart.
     * @param {CartUpsertArgs} args - Arguments to update or create a Cart.
     * @example
     * // Update or create a Cart
     * const cart = await prisma.cart.upsert({
     *   create: {
     *     // ... data to create a Cart
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Cart we want to update
     *   }
     * })
    **/
    upsert<T extends CartUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, CartUpsertArgs<ExtArgs>>
    ): Prisma__CartClient<$Types.GetResult<CartPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of Carts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartCountArgs} args - Arguments to filter Carts to count.
     * @example
     * // Count the number of Carts
     * const count = await prisma.cart.count({
     *   where: {
     *     // ... the filter for the Carts we want to count
     *   }
     * })
    **/
    count<T extends CartCountArgs>(
      args?: Subset<T, CartCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CartCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Cart.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CartAggregateArgs>(args: Subset<T, CartAggregateArgs>): Prisma.PrismaPromise<GetCartAggregateType<T>>

    /**
     * Group by Cart.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CartGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CartGroupByArgs['orderBy'] }
        : { orderBy?: CartGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CartGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCartGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Cart model
   */
  readonly fields: CartFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Cart.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__CartClient<T, Null = never, ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> implements Prisma.PrismaPromise<T> {
    private readonly _dmmf;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);

    user<T extends UserArgs<ExtArgs> = {}>(args?: Subset<T, UserArgs<ExtArgs>>): Prisma__UserClient<$Types.GetResult<UserPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    items<T extends Cart$itemsArgs<ExtArgs> = {}>(args?: Subset<T, Cart$itemsArgs<ExtArgs>>): Prisma.PrismaPromise<$Types.GetResult<CartItemPayload<ExtArgs>, T, 'findMany'>| Null>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }



  /**
   * Fields of the Cart model
   */ 
  interface CartFieldRefs {
    readonly id: FieldRef<"Cart", 'String'>
    readonly userId: FieldRef<"Cart", 'String'>
  }
    

  // Custom InputTypes

  /**
   * Cart findUnique
   */
  export type CartFindUniqueArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cart
     */
    select?: CartSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartInclude<ExtArgs> | null
    /**
     * Filter, which Cart to fetch.
     */
    where: CartWhereUniqueInput
  }


  /**
   * Cart findUniqueOrThrow
   */
  export type CartFindUniqueOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cart
     */
    select?: CartSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartInclude<ExtArgs> | null
    /**
     * Filter, which Cart to fetch.
     */
    where: CartWhereUniqueInput
  }


  /**
   * Cart findFirst
   */
  export type CartFindFirstArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cart
     */
    select?: CartSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartInclude<ExtArgs> | null
    /**
     * Filter, which Cart to fetch.
     */
    where?: CartWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Carts to fetch.
     */
    orderBy?: CartOrderByWithRelationInput | CartOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Carts.
     */
    cursor?: CartWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Carts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Carts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Carts.
     */
    distinct?: CartScalarFieldEnum | CartScalarFieldEnum[]
  }


  /**
   * Cart findFirstOrThrow
   */
  export type CartFindFirstOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cart
     */
    select?: CartSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartInclude<ExtArgs> | null
    /**
     * Filter, which Cart to fetch.
     */
    where?: CartWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Carts to fetch.
     */
    orderBy?: CartOrderByWithRelationInput | CartOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Carts.
     */
    cursor?: CartWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Carts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Carts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Carts.
     */
    distinct?: CartScalarFieldEnum | CartScalarFieldEnum[]
  }


  /**
   * Cart findMany
   */
  export type CartFindManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cart
     */
    select?: CartSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartInclude<ExtArgs> | null
    /**
     * Filter, which Carts to fetch.
     */
    where?: CartWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Carts to fetch.
     */
    orderBy?: CartOrderByWithRelationInput | CartOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Carts.
     */
    cursor?: CartWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Carts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Carts.
     */
    skip?: number
    distinct?: CartScalarFieldEnum | CartScalarFieldEnum[]
  }


  /**
   * Cart create
   */
  export type CartCreateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cart
     */
    select?: CartSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartInclude<ExtArgs> | null
    /**
     * The data needed to create a Cart.
     */
    data: XOR<CartCreateInput, CartUncheckedCreateInput>
  }


  /**
   * Cart createMany
   */
  export type CartCreateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Carts.
     */
    data: CartCreateManyInput | CartCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * Cart update
   */
  export type CartUpdateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cart
     */
    select?: CartSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartInclude<ExtArgs> | null
    /**
     * The data needed to update a Cart.
     */
    data: XOR<CartUpdateInput, CartUncheckedUpdateInput>
    /**
     * Choose, which Cart to update.
     */
    where: CartWhereUniqueInput
  }


  /**
   * Cart updateMany
   */
  export type CartUpdateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Carts.
     */
    data: XOR<CartUpdateManyMutationInput, CartUncheckedUpdateManyInput>
    /**
     * Filter which Carts to update
     */
    where?: CartWhereInput
  }


  /**
   * Cart upsert
   */
  export type CartUpsertArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cart
     */
    select?: CartSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartInclude<ExtArgs> | null
    /**
     * The filter to search for the Cart to update in case it exists.
     */
    where: CartWhereUniqueInput
    /**
     * In case the Cart found by the `where` argument doesn't exist, create a new Cart with this data.
     */
    create: XOR<CartCreateInput, CartUncheckedCreateInput>
    /**
     * In case the Cart was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CartUpdateInput, CartUncheckedUpdateInput>
  }


  /**
   * Cart delete
   */
  export type CartDeleteArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cart
     */
    select?: CartSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartInclude<ExtArgs> | null
    /**
     * Filter which Cart to delete.
     */
    where: CartWhereUniqueInput
  }


  /**
   * Cart deleteMany
   */
  export type CartDeleteManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which Carts to delete
     */
    where?: CartWhereInput
  }


  /**
   * Cart.items
   */
  export type Cart$itemsArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartItem
     */
    select?: CartItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartItemInclude<ExtArgs> | null
    where?: CartItemWhereInput
    orderBy?: CartItemOrderByWithRelationInput | CartItemOrderByWithRelationInput[]
    cursor?: CartItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CartItemScalarFieldEnum | CartItemScalarFieldEnum[]
  }


  /**
   * Cart without action
   */
  export type CartArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Cart
     */
    select?: CartSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartInclude<ExtArgs> | null
  }



  /**
   * Model CartItem
   */


  export type AggregateCartItem = {
    _count: CartItemCountAggregateOutputType | null
    _avg: CartItemAvgAggregateOutputType | null
    _sum: CartItemSumAggregateOutputType | null
    _min: CartItemMinAggregateOutputType | null
    _max: CartItemMaxAggregateOutputType | null
  }

  export type CartItemAvgAggregateOutputType = {
    quantity: number | null
  }

  export type CartItemSumAggregateOutputType = {
    quantity: number | null
  }

  export type CartItemMinAggregateOutputType = {
    id: string | null
    cartId: string | null
    productId: string | null
    quantity: number | null
  }

  export type CartItemMaxAggregateOutputType = {
    id: string | null
    cartId: string | null
    productId: string | null
    quantity: number | null
  }

  export type CartItemCountAggregateOutputType = {
    id: number
    cartId: number
    productId: number
    quantity: number
    _all: number
  }


  export type CartItemAvgAggregateInputType = {
    quantity?: true
  }

  export type CartItemSumAggregateInputType = {
    quantity?: true
  }

  export type CartItemMinAggregateInputType = {
    id?: true
    cartId?: true
    productId?: true
    quantity?: true
  }

  export type CartItemMaxAggregateInputType = {
    id?: true
    cartId?: true
    productId?: true
    quantity?: true
  }

  export type CartItemCountAggregateInputType = {
    id?: true
    cartId?: true
    productId?: true
    quantity?: true
    _all?: true
  }

  export type CartItemAggregateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which CartItem to aggregate.
     */
    where?: CartItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CartItems to fetch.
     */
    orderBy?: CartItemOrderByWithRelationInput | CartItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CartItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CartItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CartItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CartItems
    **/
    _count?: true | CartItemCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CartItemAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CartItemSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CartItemMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CartItemMaxAggregateInputType
  }

  export type GetCartItemAggregateType<T extends CartItemAggregateArgs> = {
        [P in keyof T & keyof AggregateCartItem]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCartItem[P]>
      : GetScalarType<T[P], AggregateCartItem[P]>
  }




  export type CartItemGroupByArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: CartItemWhereInput
    orderBy?: CartItemOrderByWithAggregationInput | CartItemOrderByWithAggregationInput[]
    by: CartItemScalarFieldEnum[] | CartItemScalarFieldEnum
    having?: CartItemScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CartItemCountAggregateInputType | true
    _avg?: CartItemAvgAggregateInputType
    _sum?: CartItemSumAggregateInputType
    _min?: CartItemMinAggregateInputType
    _max?: CartItemMaxAggregateInputType
  }


  export type CartItemGroupByOutputType = {
    id: string
    cartId: string
    productId: string
    quantity: number
    _count: CartItemCountAggregateOutputType | null
    _avg: CartItemAvgAggregateOutputType | null
    _sum: CartItemSumAggregateOutputType | null
    _min: CartItemMinAggregateOutputType | null
    _max: CartItemMaxAggregateOutputType | null
  }

  type GetCartItemGroupByPayload<T extends CartItemGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CartItemGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CartItemGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CartItemGroupByOutputType[P]>
            : GetScalarType<T[P], CartItemGroupByOutputType[P]>
        }
      >
    >


  export type CartItemSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    cartId?: boolean
    productId?: boolean
    quantity?: boolean
    cart?: boolean | CartArgs<ExtArgs>
    product?: boolean | ProductArgs<ExtArgs>
  }, ExtArgs["result"]["cartItem"]>

  export type CartItemSelectScalar = {
    id?: boolean
    cartId?: boolean
    productId?: boolean
    quantity?: boolean
  }

  export type CartItemInclude<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    cart?: boolean | CartArgs<ExtArgs>
    product?: boolean | ProductArgs<ExtArgs>
  }


  type CartItemGetPayload<S extends boolean | null | undefined | CartItemArgs> = $Types.GetResult<CartItemPayload, S>

  type CartItemCountArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = 
    Omit<CartItemFindManyArgs, 'select' | 'include'> & {
      select?: CartItemCountAggregateInputType | true
    }

  export interface CartItemDelegate<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CartItem'], meta: { name: 'CartItem' } }
    /**
     * Find zero or one CartItem that matches the filter.
     * @param {CartItemFindUniqueArgs} args - Arguments to find a CartItem
     * @example
     * // Get one CartItem
     * const cartItem = await prisma.cartItem.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends CartItemFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, CartItemFindUniqueArgs<ExtArgs>>
    ): Prisma__CartItemClient<$Types.GetResult<CartItemPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one CartItem that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {CartItemFindUniqueOrThrowArgs} args - Arguments to find a CartItem
     * @example
     * // Get one CartItem
     * const cartItem = await prisma.cartItem.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends CartItemFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, CartItemFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__CartItemClient<$Types.GetResult<CartItemPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first CartItem that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartItemFindFirstArgs} args - Arguments to find a CartItem
     * @example
     * // Get one CartItem
     * const cartItem = await prisma.cartItem.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends CartItemFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, CartItemFindFirstArgs<ExtArgs>>
    ): Prisma__CartItemClient<$Types.GetResult<CartItemPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first CartItem that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartItemFindFirstOrThrowArgs} args - Arguments to find a CartItem
     * @example
     * // Get one CartItem
     * const cartItem = await prisma.cartItem.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends CartItemFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, CartItemFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__CartItemClient<$Types.GetResult<CartItemPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more CartItems that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartItemFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CartItems
     * const cartItems = await prisma.cartItem.findMany()
     * 
     * // Get first 10 CartItems
     * const cartItems = await prisma.cartItem.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const cartItemWithIdOnly = await prisma.cartItem.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends CartItemFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, CartItemFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Types.GetResult<CartItemPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a CartItem.
     * @param {CartItemCreateArgs} args - Arguments to create a CartItem.
     * @example
     * // Create one CartItem
     * const CartItem = await prisma.cartItem.create({
     *   data: {
     *     // ... data to create a CartItem
     *   }
     * })
     * 
    **/
    create<T extends CartItemCreateArgs<ExtArgs>>(
      args: SelectSubset<T, CartItemCreateArgs<ExtArgs>>
    ): Prisma__CartItemClient<$Types.GetResult<CartItemPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many CartItems.
     *     @param {CartItemCreateManyArgs} args - Arguments to create many CartItems.
     *     @example
     *     // Create many CartItems
     *     const cartItem = await prisma.cartItem.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends CartItemCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, CartItemCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a CartItem.
     * @param {CartItemDeleteArgs} args - Arguments to delete one CartItem.
     * @example
     * // Delete one CartItem
     * const CartItem = await prisma.cartItem.delete({
     *   where: {
     *     // ... filter to delete one CartItem
     *   }
     * })
     * 
    **/
    delete<T extends CartItemDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, CartItemDeleteArgs<ExtArgs>>
    ): Prisma__CartItemClient<$Types.GetResult<CartItemPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one CartItem.
     * @param {CartItemUpdateArgs} args - Arguments to update one CartItem.
     * @example
     * // Update one CartItem
     * const cartItem = await prisma.cartItem.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends CartItemUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, CartItemUpdateArgs<ExtArgs>>
    ): Prisma__CartItemClient<$Types.GetResult<CartItemPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more CartItems.
     * @param {CartItemDeleteManyArgs} args - Arguments to filter CartItems to delete.
     * @example
     * // Delete a few CartItems
     * const { count } = await prisma.cartItem.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends CartItemDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, CartItemDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CartItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartItemUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CartItems
     * const cartItem = await prisma.cartItem.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends CartItemUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, CartItemUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one CartItem.
     * @param {CartItemUpsertArgs} args - Arguments to update or create a CartItem.
     * @example
     * // Update or create a CartItem
     * const cartItem = await prisma.cartItem.upsert({
     *   create: {
     *     // ... data to create a CartItem
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CartItem we want to update
     *   }
     * })
    **/
    upsert<T extends CartItemUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, CartItemUpsertArgs<ExtArgs>>
    ): Prisma__CartItemClient<$Types.GetResult<CartItemPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of CartItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartItemCountArgs} args - Arguments to filter CartItems to count.
     * @example
     * // Count the number of CartItems
     * const count = await prisma.cartItem.count({
     *   where: {
     *     // ... the filter for the CartItems we want to count
     *   }
     * })
    **/
    count<T extends CartItemCountArgs>(
      args?: Subset<T, CartItemCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CartItemCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CartItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartItemAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CartItemAggregateArgs>(args: Subset<T, CartItemAggregateArgs>): Prisma.PrismaPromise<GetCartItemAggregateType<T>>

    /**
     * Group by CartItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CartItemGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CartItemGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CartItemGroupByArgs['orderBy'] }
        : { orderBy?: CartItemGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CartItemGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCartItemGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CartItem model
   */
  readonly fields: CartItemFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CartItem.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__CartItemClient<T, Null = never, ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> implements Prisma.PrismaPromise<T> {
    private readonly _dmmf;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);

    cart<T extends CartArgs<ExtArgs> = {}>(args?: Subset<T, CartArgs<ExtArgs>>): Prisma__CartClient<$Types.GetResult<CartPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    product<T extends ProductArgs<ExtArgs> = {}>(args?: Subset<T, ProductArgs<ExtArgs>>): Prisma__ProductClient<$Types.GetResult<ProductPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }



  /**
   * Fields of the CartItem model
   */ 
  interface CartItemFieldRefs {
    readonly id: FieldRef<"CartItem", 'String'>
    readonly cartId: FieldRef<"CartItem", 'String'>
    readonly productId: FieldRef<"CartItem", 'String'>
    readonly quantity: FieldRef<"CartItem", 'Int'>
  }
    

  // Custom InputTypes

  /**
   * CartItem findUnique
   */
  export type CartItemFindUniqueArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartItem
     */
    select?: CartItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartItemInclude<ExtArgs> | null
    /**
     * Filter, which CartItem to fetch.
     */
    where: CartItemWhereUniqueInput
  }


  /**
   * CartItem findUniqueOrThrow
   */
  export type CartItemFindUniqueOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartItem
     */
    select?: CartItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartItemInclude<ExtArgs> | null
    /**
     * Filter, which CartItem to fetch.
     */
    where: CartItemWhereUniqueInput
  }


  /**
   * CartItem findFirst
   */
  export type CartItemFindFirstArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartItem
     */
    select?: CartItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartItemInclude<ExtArgs> | null
    /**
     * Filter, which CartItem to fetch.
     */
    where?: CartItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CartItems to fetch.
     */
    orderBy?: CartItemOrderByWithRelationInput | CartItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CartItems.
     */
    cursor?: CartItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CartItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CartItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CartItems.
     */
    distinct?: CartItemScalarFieldEnum | CartItemScalarFieldEnum[]
  }


  /**
   * CartItem findFirstOrThrow
   */
  export type CartItemFindFirstOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartItem
     */
    select?: CartItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartItemInclude<ExtArgs> | null
    /**
     * Filter, which CartItem to fetch.
     */
    where?: CartItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CartItems to fetch.
     */
    orderBy?: CartItemOrderByWithRelationInput | CartItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CartItems.
     */
    cursor?: CartItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CartItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CartItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CartItems.
     */
    distinct?: CartItemScalarFieldEnum | CartItemScalarFieldEnum[]
  }


  /**
   * CartItem findMany
   */
  export type CartItemFindManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartItem
     */
    select?: CartItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartItemInclude<ExtArgs> | null
    /**
     * Filter, which CartItems to fetch.
     */
    where?: CartItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CartItems to fetch.
     */
    orderBy?: CartItemOrderByWithRelationInput | CartItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CartItems.
     */
    cursor?: CartItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CartItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CartItems.
     */
    skip?: number
    distinct?: CartItemScalarFieldEnum | CartItemScalarFieldEnum[]
  }


  /**
   * CartItem create
   */
  export type CartItemCreateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartItem
     */
    select?: CartItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartItemInclude<ExtArgs> | null
    /**
     * The data needed to create a CartItem.
     */
    data: XOR<CartItemCreateInput, CartItemUncheckedCreateInput>
  }


  /**
   * CartItem createMany
   */
  export type CartItemCreateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CartItems.
     */
    data: CartItemCreateManyInput | CartItemCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * CartItem update
   */
  export type CartItemUpdateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartItem
     */
    select?: CartItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartItemInclude<ExtArgs> | null
    /**
     * The data needed to update a CartItem.
     */
    data: XOR<CartItemUpdateInput, CartItemUncheckedUpdateInput>
    /**
     * Choose, which CartItem to update.
     */
    where: CartItemWhereUniqueInput
  }


  /**
   * CartItem updateMany
   */
  export type CartItemUpdateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CartItems.
     */
    data: XOR<CartItemUpdateManyMutationInput, CartItemUncheckedUpdateManyInput>
    /**
     * Filter which CartItems to update
     */
    where?: CartItemWhereInput
  }


  /**
   * CartItem upsert
   */
  export type CartItemUpsertArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartItem
     */
    select?: CartItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartItemInclude<ExtArgs> | null
    /**
     * The filter to search for the CartItem to update in case it exists.
     */
    where: CartItemWhereUniqueInput
    /**
     * In case the CartItem found by the `where` argument doesn't exist, create a new CartItem with this data.
     */
    create: XOR<CartItemCreateInput, CartItemUncheckedCreateInput>
    /**
     * In case the CartItem was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CartItemUpdateInput, CartItemUncheckedUpdateInput>
  }


  /**
   * CartItem delete
   */
  export type CartItemDeleteArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartItem
     */
    select?: CartItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartItemInclude<ExtArgs> | null
    /**
     * Filter which CartItem to delete.
     */
    where: CartItemWhereUniqueInput
  }


  /**
   * CartItem deleteMany
   */
  export type CartItemDeleteManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which CartItems to delete
     */
    where?: CartItemWhereInput
  }


  /**
   * CartItem without action
   */
  export type CartItemArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CartItem
     */
    select?: CartItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: CartItemInclude<ExtArgs> | null
  }



  /**
   * Model MCPConfiguration
   */


  export type AggregateMCPConfiguration = {
    _count: MCPConfigurationCountAggregateOutputType | null
    _min: MCPConfigurationMinAggregateOutputType | null
    _max: MCPConfigurationMaxAggregateOutputType | null
  }

  export type MCPConfigurationMinAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    status: ConfigStatus | null
    userId: string | null
    productId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MCPConfigurationMaxAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    status: ConfigStatus | null
    userId: string | null
    productId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type MCPConfigurationCountAggregateOutputType = {
    id: number
    name: number
    description: number
    configData: number
    status: number
    userId: number
    productId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type MCPConfigurationMinAggregateInputType = {
    id?: true
    name?: true
    description?: true
    status?: true
    userId?: true
    productId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MCPConfigurationMaxAggregateInputType = {
    id?: true
    name?: true
    description?: true
    status?: true
    userId?: true
    productId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type MCPConfigurationCountAggregateInputType = {
    id?: true
    name?: true
    description?: true
    configData?: true
    status?: true
    userId?: true
    productId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type MCPConfigurationAggregateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which MCPConfiguration to aggregate.
     */
    where?: MCPConfigurationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MCPConfigurations to fetch.
     */
    orderBy?: MCPConfigurationOrderByWithRelationInput | MCPConfigurationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MCPConfigurationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MCPConfigurations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MCPConfigurations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MCPConfigurations
    **/
    _count?: true | MCPConfigurationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MCPConfigurationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MCPConfigurationMaxAggregateInputType
  }

  export type GetMCPConfigurationAggregateType<T extends MCPConfigurationAggregateArgs> = {
        [P in keyof T & keyof AggregateMCPConfiguration]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMCPConfiguration[P]>
      : GetScalarType<T[P], AggregateMCPConfiguration[P]>
  }




  export type MCPConfigurationGroupByArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    where?: MCPConfigurationWhereInput
    orderBy?: MCPConfigurationOrderByWithAggregationInput | MCPConfigurationOrderByWithAggregationInput[]
    by: MCPConfigurationScalarFieldEnum[] | MCPConfigurationScalarFieldEnum
    having?: MCPConfigurationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MCPConfigurationCountAggregateInputType | true
    _min?: MCPConfigurationMinAggregateInputType
    _max?: MCPConfigurationMaxAggregateInputType
  }


  export type MCPConfigurationGroupByOutputType = {
    id: string
    name: string
    description: string | null
    configData: JsonValue
    status: ConfigStatus
    userId: string
    productId: string | null
    createdAt: Date
    updatedAt: Date
    _count: MCPConfigurationCountAggregateOutputType | null
    _min: MCPConfigurationMinAggregateOutputType | null
    _max: MCPConfigurationMaxAggregateOutputType | null
  }

  type GetMCPConfigurationGroupByPayload<T extends MCPConfigurationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MCPConfigurationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MCPConfigurationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MCPConfigurationGroupByOutputType[P]>
            : GetScalarType<T[P], MCPConfigurationGroupByOutputType[P]>
        }
      >
    >


  export type MCPConfigurationSelect<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    description?: boolean
    configData?: boolean
    status?: boolean
    userId?: boolean
    productId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserArgs<ExtArgs>
    product?: boolean | MCPConfiguration$productArgs<ExtArgs>
  }, ExtArgs["result"]["mCPConfiguration"]>

  export type MCPConfigurationSelectScalar = {
    id?: boolean
    name?: boolean
    description?: boolean
    configData?: boolean
    status?: boolean
    userId?: boolean
    productId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type MCPConfigurationInclude<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    user?: boolean | UserArgs<ExtArgs>
    product?: boolean | MCPConfiguration$productArgs<ExtArgs>
  }


  type MCPConfigurationGetPayload<S extends boolean | null | undefined | MCPConfigurationArgs> = $Types.GetResult<MCPConfigurationPayload, S>

  type MCPConfigurationCountArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = 
    Omit<MCPConfigurationFindManyArgs, 'select' | 'include'> & {
      select?: MCPConfigurationCountAggregateInputType | true
    }

  export interface MCPConfigurationDelegate<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MCPConfiguration'], meta: { name: 'MCPConfiguration' } }
    /**
     * Find zero or one MCPConfiguration that matches the filter.
     * @param {MCPConfigurationFindUniqueArgs} args - Arguments to find a MCPConfiguration
     * @example
     * // Get one MCPConfiguration
     * const mCPConfiguration = await prisma.mCPConfiguration.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUnique<T extends MCPConfigurationFindUniqueArgs<ExtArgs>>(
      args: SelectSubset<T, MCPConfigurationFindUniqueArgs<ExtArgs>>
    ): Prisma__MCPConfigurationClient<$Types.GetResult<MCPConfigurationPayload<ExtArgs>, T, 'findUnique'> | null, null, ExtArgs>

    /**
     * Find one MCPConfiguration that matches the filter or throw an error  with `error.code='P2025'` 
     *     if no matches were found.
     * @param {MCPConfigurationFindUniqueOrThrowArgs} args - Arguments to find a MCPConfiguration
     * @example
     * // Get one MCPConfiguration
     * const mCPConfiguration = await prisma.mCPConfiguration.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findUniqueOrThrow<T extends MCPConfigurationFindUniqueOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, MCPConfigurationFindUniqueOrThrowArgs<ExtArgs>>
    ): Prisma__MCPConfigurationClient<$Types.GetResult<MCPConfigurationPayload<ExtArgs>, T, 'findUniqueOrThrow'>, never, ExtArgs>

    /**
     * Find the first MCPConfiguration that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MCPConfigurationFindFirstArgs} args - Arguments to find a MCPConfiguration
     * @example
     * // Get one MCPConfiguration
     * const mCPConfiguration = await prisma.mCPConfiguration.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirst<T extends MCPConfigurationFindFirstArgs<ExtArgs>>(
      args?: SelectSubset<T, MCPConfigurationFindFirstArgs<ExtArgs>>
    ): Prisma__MCPConfigurationClient<$Types.GetResult<MCPConfigurationPayload<ExtArgs>, T, 'findFirst'> | null, null, ExtArgs>

    /**
     * Find the first MCPConfiguration that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MCPConfigurationFindFirstOrThrowArgs} args - Arguments to find a MCPConfiguration
     * @example
     * // Get one MCPConfiguration
     * const mCPConfiguration = await prisma.mCPConfiguration.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
    **/
    findFirstOrThrow<T extends MCPConfigurationFindFirstOrThrowArgs<ExtArgs>>(
      args?: SelectSubset<T, MCPConfigurationFindFirstOrThrowArgs<ExtArgs>>
    ): Prisma__MCPConfigurationClient<$Types.GetResult<MCPConfigurationPayload<ExtArgs>, T, 'findFirstOrThrow'>, never, ExtArgs>

    /**
     * Find zero or more MCPConfigurations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MCPConfigurationFindManyArgs=} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MCPConfigurations
     * const mCPConfigurations = await prisma.mCPConfiguration.findMany()
     * 
     * // Get first 10 MCPConfigurations
     * const mCPConfigurations = await prisma.mCPConfiguration.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const mCPConfigurationWithIdOnly = await prisma.mCPConfiguration.findMany({ select: { id: true } })
     * 
    **/
    findMany<T extends MCPConfigurationFindManyArgs<ExtArgs>>(
      args?: SelectSubset<T, MCPConfigurationFindManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<$Types.GetResult<MCPConfigurationPayload<ExtArgs>, T, 'findMany'>>

    /**
     * Create a MCPConfiguration.
     * @param {MCPConfigurationCreateArgs} args - Arguments to create a MCPConfiguration.
     * @example
     * // Create one MCPConfiguration
     * const MCPConfiguration = await prisma.mCPConfiguration.create({
     *   data: {
     *     // ... data to create a MCPConfiguration
     *   }
     * })
     * 
    **/
    create<T extends MCPConfigurationCreateArgs<ExtArgs>>(
      args: SelectSubset<T, MCPConfigurationCreateArgs<ExtArgs>>
    ): Prisma__MCPConfigurationClient<$Types.GetResult<MCPConfigurationPayload<ExtArgs>, T, 'create'>, never, ExtArgs>

    /**
     * Create many MCPConfigurations.
     *     @param {MCPConfigurationCreateManyArgs} args - Arguments to create many MCPConfigurations.
     *     @example
     *     // Create many MCPConfigurations
     *     const mCPConfiguration = await prisma.mCPConfiguration.createMany({
     *       data: {
     *         // ... provide data here
     *       }
     *     })
     *     
    **/
    createMany<T extends MCPConfigurationCreateManyArgs<ExtArgs>>(
      args?: SelectSubset<T, MCPConfigurationCreateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Delete a MCPConfiguration.
     * @param {MCPConfigurationDeleteArgs} args - Arguments to delete one MCPConfiguration.
     * @example
     * // Delete one MCPConfiguration
     * const MCPConfiguration = await prisma.mCPConfiguration.delete({
     *   where: {
     *     // ... filter to delete one MCPConfiguration
     *   }
     * })
     * 
    **/
    delete<T extends MCPConfigurationDeleteArgs<ExtArgs>>(
      args: SelectSubset<T, MCPConfigurationDeleteArgs<ExtArgs>>
    ): Prisma__MCPConfigurationClient<$Types.GetResult<MCPConfigurationPayload<ExtArgs>, T, 'delete'>, never, ExtArgs>

    /**
     * Update one MCPConfiguration.
     * @param {MCPConfigurationUpdateArgs} args - Arguments to update one MCPConfiguration.
     * @example
     * // Update one MCPConfiguration
     * const mCPConfiguration = await prisma.mCPConfiguration.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    update<T extends MCPConfigurationUpdateArgs<ExtArgs>>(
      args: SelectSubset<T, MCPConfigurationUpdateArgs<ExtArgs>>
    ): Prisma__MCPConfigurationClient<$Types.GetResult<MCPConfigurationPayload<ExtArgs>, T, 'update'>, never, ExtArgs>

    /**
     * Delete zero or more MCPConfigurations.
     * @param {MCPConfigurationDeleteManyArgs} args - Arguments to filter MCPConfigurations to delete.
     * @example
     * // Delete a few MCPConfigurations
     * const { count } = await prisma.mCPConfiguration.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
    **/
    deleteMany<T extends MCPConfigurationDeleteManyArgs<ExtArgs>>(
      args?: SelectSubset<T, MCPConfigurationDeleteManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MCPConfigurations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MCPConfigurationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MCPConfigurations
     * const mCPConfiguration = await prisma.mCPConfiguration.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
    **/
    updateMany<T extends MCPConfigurationUpdateManyArgs<ExtArgs>>(
      args: SelectSubset<T, MCPConfigurationUpdateManyArgs<ExtArgs>>
    ): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one MCPConfiguration.
     * @param {MCPConfigurationUpsertArgs} args - Arguments to update or create a MCPConfiguration.
     * @example
     * // Update or create a MCPConfiguration
     * const mCPConfiguration = await prisma.mCPConfiguration.upsert({
     *   create: {
     *     // ... data to create a MCPConfiguration
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MCPConfiguration we want to update
     *   }
     * })
    **/
    upsert<T extends MCPConfigurationUpsertArgs<ExtArgs>>(
      args: SelectSubset<T, MCPConfigurationUpsertArgs<ExtArgs>>
    ): Prisma__MCPConfigurationClient<$Types.GetResult<MCPConfigurationPayload<ExtArgs>, T, 'upsert'>, never, ExtArgs>

    /**
     * Count the number of MCPConfigurations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MCPConfigurationCountArgs} args - Arguments to filter MCPConfigurations to count.
     * @example
     * // Count the number of MCPConfigurations
     * const count = await prisma.mCPConfiguration.count({
     *   where: {
     *     // ... the filter for the MCPConfigurations we want to count
     *   }
     * })
    **/
    count<T extends MCPConfigurationCountArgs>(
      args?: Subset<T, MCPConfigurationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MCPConfigurationCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MCPConfiguration.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MCPConfigurationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MCPConfigurationAggregateArgs>(args: Subset<T, MCPConfigurationAggregateArgs>): Prisma.PrismaPromise<GetMCPConfigurationAggregateType<T>>

    /**
     * Group by MCPConfiguration.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MCPConfigurationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MCPConfigurationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MCPConfigurationGroupByArgs['orderBy'] }
        : { orderBy?: MCPConfigurationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MCPConfigurationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMCPConfigurationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MCPConfiguration model
   */
  readonly fields: MCPConfigurationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MCPConfiguration.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export class Prisma__MCPConfigurationClient<T, Null = never, ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> implements Prisma.PrismaPromise<T> {
    private readonly _dmmf;
    private readonly _queryType;
    private readonly _rootField;
    private readonly _clientMethod;
    private readonly _args;
    private readonly _dataPath;
    private readonly _errorFormat;
    private readonly _measurePerformance?;
    private _isList;
    private _callsite;
    private _requestPromise?;
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    constructor(_dmmf: runtime.DMMFClass, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);

    user<T extends UserArgs<ExtArgs> = {}>(args?: Subset<T, UserArgs<ExtArgs>>): Prisma__UserClient<$Types.GetResult<UserPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    product<T extends MCPConfiguration$productArgs<ExtArgs> = {}>(args?: Subset<T, MCPConfiguration$productArgs<ExtArgs>>): Prisma__ProductClient<$Types.GetResult<ProductPayload<ExtArgs>, T, 'findUnique'> | Null, never, ExtArgs>;

    private get _document();
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
  }



  /**
   * Fields of the MCPConfiguration model
   */ 
  interface MCPConfigurationFieldRefs {
    readonly id: FieldRef<"MCPConfiguration", 'String'>
    readonly name: FieldRef<"MCPConfiguration", 'String'>
    readonly description: FieldRef<"MCPConfiguration", 'String'>
    readonly configData: FieldRef<"MCPConfiguration", 'Json'>
    readonly status: FieldRef<"MCPConfiguration", 'ConfigStatus'>
    readonly userId: FieldRef<"MCPConfiguration", 'String'>
    readonly productId: FieldRef<"MCPConfiguration", 'String'>
    readonly createdAt: FieldRef<"MCPConfiguration", 'DateTime'>
    readonly updatedAt: FieldRef<"MCPConfiguration", 'DateTime'>
  }
    

  // Custom InputTypes

  /**
   * MCPConfiguration findUnique
   */
  export type MCPConfigurationFindUniqueArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MCPConfiguration
     */
    select?: MCPConfigurationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: MCPConfigurationInclude<ExtArgs> | null
    /**
     * Filter, which MCPConfiguration to fetch.
     */
    where: MCPConfigurationWhereUniqueInput
  }


  /**
   * MCPConfiguration findUniqueOrThrow
   */
  export type MCPConfigurationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MCPConfiguration
     */
    select?: MCPConfigurationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: MCPConfigurationInclude<ExtArgs> | null
    /**
     * Filter, which MCPConfiguration to fetch.
     */
    where: MCPConfigurationWhereUniqueInput
  }


  /**
   * MCPConfiguration findFirst
   */
  export type MCPConfigurationFindFirstArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MCPConfiguration
     */
    select?: MCPConfigurationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: MCPConfigurationInclude<ExtArgs> | null
    /**
     * Filter, which MCPConfiguration to fetch.
     */
    where?: MCPConfigurationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MCPConfigurations to fetch.
     */
    orderBy?: MCPConfigurationOrderByWithRelationInput | MCPConfigurationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MCPConfigurations.
     */
    cursor?: MCPConfigurationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MCPConfigurations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MCPConfigurations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MCPConfigurations.
     */
    distinct?: MCPConfigurationScalarFieldEnum | MCPConfigurationScalarFieldEnum[]
  }


  /**
   * MCPConfiguration findFirstOrThrow
   */
  export type MCPConfigurationFindFirstOrThrowArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MCPConfiguration
     */
    select?: MCPConfigurationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: MCPConfigurationInclude<ExtArgs> | null
    /**
     * Filter, which MCPConfiguration to fetch.
     */
    where?: MCPConfigurationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MCPConfigurations to fetch.
     */
    orderBy?: MCPConfigurationOrderByWithRelationInput | MCPConfigurationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MCPConfigurations.
     */
    cursor?: MCPConfigurationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MCPConfigurations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MCPConfigurations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MCPConfigurations.
     */
    distinct?: MCPConfigurationScalarFieldEnum | MCPConfigurationScalarFieldEnum[]
  }


  /**
   * MCPConfiguration findMany
   */
  export type MCPConfigurationFindManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MCPConfiguration
     */
    select?: MCPConfigurationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: MCPConfigurationInclude<ExtArgs> | null
    /**
     * Filter, which MCPConfigurations to fetch.
     */
    where?: MCPConfigurationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MCPConfigurations to fetch.
     */
    orderBy?: MCPConfigurationOrderByWithRelationInput | MCPConfigurationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MCPConfigurations.
     */
    cursor?: MCPConfigurationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MCPConfigurations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MCPConfigurations.
     */
    skip?: number
    distinct?: MCPConfigurationScalarFieldEnum | MCPConfigurationScalarFieldEnum[]
  }


  /**
   * MCPConfiguration create
   */
  export type MCPConfigurationCreateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MCPConfiguration
     */
    select?: MCPConfigurationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: MCPConfigurationInclude<ExtArgs> | null
    /**
     * The data needed to create a MCPConfiguration.
     */
    data: XOR<MCPConfigurationCreateInput, MCPConfigurationUncheckedCreateInput>
  }


  /**
   * MCPConfiguration createMany
   */
  export type MCPConfigurationCreateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MCPConfigurations.
     */
    data: MCPConfigurationCreateManyInput | MCPConfigurationCreateManyInput[]
    skipDuplicates?: boolean
  }


  /**
   * MCPConfiguration update
   */
  export type MCPConfigurationUpdateArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MCPConfiguration
     */
    select?: MCPConfigurationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: MCPConfigurationInclude<ExtArgs> | null
    /**
     * The data needed to update a MCPConfiguration.
     */
    data: XOR<MCPConfigurationUpdateInput, MCPConfigurationUncheckedUpdateInput>
    /**
     * Choose, which MCPConfiguration to update.
     */
    where: MCPConfigurationWhereUniqueInput
  }


  /**
   * MCPConfiguration updateMany
   */
  export type MCPConfigurationUpdateManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MCPConfigurations.
     */
    data: XOR<MCPConfigurationUpdateManyMutationInput, MCPConfigurationUncheckedUpdateManyInput>
    /**
     * Filter which MCPConfigurations to update
     */
    where?: MCPConfigurationWhereInput
  }


  /**
   * MCPConfiguration upsert
   */
  export type MCPConfigurationUpsertArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MCPConfiguration
     */
    select?: MCPConfigurationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: MCPConfigurationInclude<ExtArgs> | null
    /**
     * The filter to search for the MCPConfiguration to update in case it exists.
     */
    where: MCPConfigurationWhereUniqueInput
    /**
     * In case the MCPConfiguration found by the `where` argument doesn't exist, create a new MCPConfiguration with this data.
     */
    create: XOR<MCPConfigurationCreateInput, MCPConfigurationUncheckedCreateInput>
    /**
     * In case the MCPConfiguration was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MCPConfigurationUpdateInput, MCPConfigurationUncheckedUpdateInput>
  }


  /**
   * MCPConfiguration delete
   */
  export type MCPConfigurationDeleteArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MCPConfiguration
     */
    select?: MCPConfigurationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: MCPConfigurationInclude<ExtArgs> | null
    /**
     * Filter which MCPConfiguration to delete.
     */
    where: MCPConfigurationWhereUniqueInput
  }


  /**
   * MCPConfiguration deleteMany
   */
  export type MCPConfigurationDeleteManyArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Filter which MCPConfigurations to delete
     */
    where?: MCPConfigurationWhereInput
  }


  /**
   * MCPConfiguration.product
   */
  export type MCPConfiguration$productArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Product
     */
    select?: ProductSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: ProductInclude<ExtArgs> | null
    where?: ProductWhereInput
  }


  /**
   * MCPConfiguration without action
   */
  export type MCPConfigurationArgs<ExtArgs extends $Extensions.Args = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MCPConfiguration
     */
    select?: MCPConfigurationSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well.
     */
    include?: MCPConfigurationInclude<ExtArgs> | null
  }



  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const ClientScalarFieldEnum: {
    id: 'id',
    name: 'name',
    domain: 'domain',
    apiKeys: 'apiKeys',
    settings: 'settings',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ClientScalarFieldEnum = (typeof ClientScalarFieldEnum)[keyof typeof ClientScalarFieldEnum]


  export const ModuleScalarFieldEnum: {
    id: 'id',
    name: 'name',
    description: 'description',
    version: 'version'
  };

  export type ModuleScalarFieldEnum = (typeof ModuleScalarFieldEnum)[keyof typeof ModuleScalarFieldEnum]


  export const ModuleOnClientScalarFieldEnum: {
    id: 'id',
    clientId: 'clientId',
    moduleId: 'moduleId',
    enabled: 'enabled'
  };

  export type ModuleOnClientScalarFieldEnum = (typeof ModuleOnClientScalarFieldEnum)[keyof typeof ModuleOnClientScalarFieldEnum]


  export const EnvironmentVariableScalarFieldEnum: {
    id: 'id',
    key: 'key',
    value: 'value',
    environment: 'environment',
    clientId: 'clientId'
  };

  export type EnvironmentVariableScalarFieldEnum = (typeof EnvironmentVariableScalarFieldEnum)[keyof typeof EnvironmentVariableScalarFieldEnum]


  export const UserScalarFieldEnum: {
    id: 'id',
    email: 'email',
    name: 'name',
    avatar: 'avatar',
    role: 'role',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const CategoryScalarFieldEnum: {
    id: 'id',
    name: 'name',
    description: 'description',
    createdAt: 'createdAt'
  };

  export type CategoryScalarFieldEnum = (typeof CategoryScalarFieldEnum)[keyof typeof CategoryScalarFieldEnum]


  export const ProductScalarFieldEnum: {
    id: 'id',
    name: 'name',
    description: 'description',
    price: 'price',
    image: 'image',
    categoryId: 'categoryId',
    sellerId: 'sellerId',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ProductScalarFieldEnum = (typeof ProductScalarFieldEnum)[keyof typeof ProductScalarFieldEnum]


  export const OrderScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    total: 'total',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type OrderScalarFieldEnum = (typeof OrderScalarFieldEnum)[keyof typeof OrderScalarFieldEnum]


  export const OrderItemScalarFieldEnum: {
    id: 'id',
    orderId: 'orderId',
    productId: 'productId',
    quantity: 'quantity',
    price: 'price'
  };

  export type OrderItemScalarFieldEnum = (typeof OrderItemScalarFieldEnum)[keyof typeof OrderItemScalarFieldEnum]


  export const CartScalarFieldEnum: {
    id: 'id',
    userId: 'userId'
  };

  export type CartScalarFieldEnum = (typeof CartScalarFieldEnum)[keyof typeof CartScalarFieldEnum]


  export const CartItemScalarFieldEnum: {
    id: 'id',
    cartId: 'cartId',
    productId: 'productId',
    quantity: 'quantity'
  };

  export type CartItemScalarFieldEnum = (typeof CartItemScalarFieldEnum)[keyof typeof CartItemScalarFieldEnum]


  export const MCPConfigurationScalarFieldEnum: {
    id: 'id',
    name: 'name',
    description: 'description',
    configData: 'configData',
    status: 'status',
    userId: 'userId',
    productId: 'productId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type MCPConfigurationScalarFieldEnum = (typeof MCPConfigurationScalarFieldEnum)[keyof typeof MCPConfigurationScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Environment'
   */
  export type EnumEnvironmentFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Environment'>
    


  /**
   * Reference to a field of type 'Environment[]'
   */
  export type ListEnumEnvironmentFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Environment[]'>
    


  /**
   * Reference to a field of type 'Role'
   */
  export type EnumRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Role'>
    


  /**
   * Reference to a field of type 'Role[]'
   */
  export type ListEnumRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Role[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'Status'
   */
  export type EnumStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Status'>
    


  /**
   * Reference to a field of type 'Status[]'
   */
  export type ListEnumStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Status[]'>
    


  /**
   * Reference to a field of type 'OrderStatus'
   */
  export type EnumOrderStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'OrderStatus'>
    


  /**
   * Reference to a field of type 'OrderStatus[]'
   */
  export type ListEnumOrderStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'OrderStatus[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'ConfigStatus'
   */
  export type EnumConfigStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ConfigStatus'>
    


  /**
   * Reference to a field of type 'ConfigStatus[]'
   */
  export type ListEnumConfigStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ConfigStatus[]'>
    
  /**
   * Deep Input Types
   */


  export type ClientWhereInput = {
    AND?: ClientWhereInput | ClientWhereInput[]
    OR?: ClientWhereInput[]
    NOT?: ClientWhereInput | ClientWhereInput[]
    id?: StringFilter<"Client"> | string
    name?: StringFilter<"Client"> | string
    domain?: StringNullableFilter<"Client"> | string | null
    apiKeys?: JsonFilter<"Client">
    settings?: JsonNullableFilter<"Client">
    createdAt?: DateTimeFilter<"Client"> | Date | string
    updatedAt?: DateTimeFilter<"Client"> | Date | string
    modules?: ModuleOnClientListRelationFilter
    environmentVariables?: EnvironmentVariableListRelationFilter
  }

  export type ClientOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    domain?: SortOrderInput | SortOrder
    apiKeys?: SortOrder
    settings?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    modules?: ModuleOnClientOrderByRelationAggregateInput
    environmentVariables?: EnvironmentVariableOrderByRelationAggregateInput
  }

  export type ClientWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name?: string
    domain?: string
    AND?: ClientWhereInput | ClientWhereInput[]
    OR?: ClientWhereInput[]
    NOT?: ClientWhereInput | ClientWhereInput[]
    apiKeys?: JsonFilter<"Client">
    settings?: JsonNullableFilter<"Client">
    createdAt?: DateTimeFilter<"Client"> | Date | string
    updatedAt?: DateTimeFilter<"Client"> | Date | string
    modules?: ModuleOnClientListRelationFilter
    environmentVariables?: EnvironmentVariableListRelationFilter
  }, "id" | "name" | "domain">

  export type ClientOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    domain?: SortOrderInput | SortOrder
    apiKeys?: SortOrder
    settings?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ClientCountOrderByAggregateInput
    _max?: ClientMaxOrderByAggregateInput
    _min?: ClientMinOrderByAggregateInput
  }

  export type ClientScalarWhereWithAggregatesInput = {
    AND?: ClientScalarWhereWithAggregatesInput | ClientScalarWhereWithAggregatesInput[]
    OR?: ClientScalarWhereWithAggregatesInput[]
    NOT?: ClientScalarWhereWithAggregatesInput | ClientScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Client"> | string
    name?: StringWithAggregatesFilter<"Client"> | string
    domain?: StringNullableWithAggregatesFilter<"Client"> | string | null
    apiKeys?: JsonWithAggregatesFilter<"Client">
    settings?: JsonNullableWithAggregatesFilter<"Client">
    createdAt?: DateTimeWithAggregatesFilter<"Client"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Client"> | Date | string
  }

  export type ModuleWhereInput = {
    AND?: ModuleWhereInput | ModuleWhereInput[]
    OR?: ModuleWhereInput[]
    NOT?: ModuleWhereInput | ModuleWhereInput[]
    id?: StringFilter<"Module"> | string
    name?: StringFilter<"Module"> | string
    description?: StringNullableFilter<"Module"> | string | null
    version?: StringNullableFilter<"Module"> | string | null
    clients?: ModuleOnClientListRelationFilter
  }

  export type ModuleOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    version?: SortOrderInput | SortOrder
    clients?: ModuleOnClientOrderByRelationAggregateInput
  }

  export type ModuleWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name?: string
    AND?: ModuleWhereInput | ModuleWhereInput[]
    OR?: ModuleWhereInput[]
    NOT?: ModuleWhereInput | ModuleWhereInput[]
    description?: StringNullableFilter<"Module"> | string | null
    version?: StringNullableFilter<"Module"> | string | null
    clients?: ModuleOnClientListRelationFilter
  }, "id" | "name">

  export type ModuleOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    version?: SortOrderInput | SortOrder
    _count?: ModuleCountOrderByAggregateInput
    _max?: ModuleMaxOrderByAggregateInput
    _min?: ModuleMinOrderByAggregateInput
  }

  export type ModuleScalarWhereWithAggregatesInput = {
    AND?: ModuleScalarWhereWithAggregatesInput | ModuleScalarWhereWithAggregatesInput[]
    OR?: ModuleScalarWhereWithAggregatesInput[]
    NOT?: ModuleScalarWhereWithAggregatesInput | ModuleScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Module"> | string
    name?: StringWithAggregatesFilter<"Module"> | string
    description?: StringNullableWithAggregatesFilter<"Module"> | string | null
    version?: StringNullableWithAggregatesFilter<"Module"> | string | null
  }

  export type ModuleOnClientWhereInput = {
    AND?: ModuleOnClientWhereInput | ModuleOnClientWhereInput[]
    OR?: ModuleOnClientWhereInput[]
    NOT?: ModuleOnClientWhereInput | ModuleOnClientWhereInput[]
    id?: StringFilter<"ModuleOnClient"> | string
    clientId?: StringFilter<"ModuleOnClient"> | string
    moduleId?: StringFilter<"ModuleOnClient"> | string
    enabled?: BoolFilter<"ModuleOnClient"> | boolean
    client?: XOR<ClientRelationFilter, ClientWhereInput>
    module?: XOR<ModuleRelationFilter, ModuleWhereInput>
  }

  export type ModuleOnClientOrderByWithRelationInput = {
    id?: SortOrder
    clientId?: SortOrder
    moduleId?: SortOrder
    enabled?: SortOrder
    client?: ClientOrderByWithRelationInput
    module?: ModuleOrderByWithRelationInput
  }

  export type ModuleOnClientWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    clientId_moduleId?: ModuleOnClientClientIdModuleIdCompoundUniqueInput
    AND?: ModuleOnClientWhereInput | ModuleOnClientWhereInput[]
    OR?: ModuleOnClientWhereInput[]
    NOT?: ModuleOnClientWhereInput | ModuleOnClientWhereInput[]
    clientId?: StringFilter<"ModuleOnClient"> | string
    moduleId?: StringFilter<"ModuleOnClient"> | string
    enabled?: BoolFilter<"ModuleOnClient"> | boolean
    client?: XOR<ClientRelationFilter, ClientWhereInput>
    module?: XOR<ModuleRelationFilter, ModuleWhereInput>
  }, "id" | "clientId_moduleId">

  export type ModuleOnClientOrderByWithAggregationInput = {
    id?: SortOrder
    clientId?: SortOrder
    moduleId?: SortOrder
    enabled?: SortOrder
    _count?: ModuleOnClientCountOrderByAggregateInput
    _max?: ModuleOnClientMaxOrderByAggregateInput
    _min?: ModuleOnClientMinOrderByAggregateInput
  }

  export type ModuleOnClientScalarWhereWithAggregatesInput = {
    AND?: ModuleOnClientScalarWhereWithAggregatesInput | ModuleOnClientScalarWhereWithAggregatesInput[]
    OR?: ModuleOnClientScalarWhereWithAggregatesInput[]
    NOT?: ModuleOnClientScalarWhereWithAggregatesInput | ModuleOnClientScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ModuleOnClient"> | string
    clientId?: StringWithAggregatesFilter<"ModuleOnClient"> | string
    moduleId?: StringWithAggregatesFilter<"ModuleOnClient"> | string
    enabled?: BoolWithAggregatesFilter<"ModuleOnClient"> | boolean
  }

  export type EnvironmentVariableWhereInput = {
    AND?: EnvironmentVariableWhereInput | EnvironmentVariableWhereInput[]
    OR?: EnvironmentVariableWhereInput[]
    NOT?: EnvironmentVariableWhereInput | EnvironmentVariableWhereInput[]
    id?: StringFilter<"EnvironmentVariable"> | string
    key?: StringFilter<"EnvironmentVariable"> | string
    value?: StringFilter<"EnvironmentVariable"> | string
    environment?: EnumEnvironmentFilter<"EnvironmentVariable"> | Environment
    clientId?: StringFilter<"EnvironmentVariable"> | string
    client?: XOR<ClientRelationFilter, ClientWhereInput>
  }

  export type EnvironmentVariableOrderByWithRelationInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    environment?: SortOrder
    clientId?: SortOrder
    client?: ClientOrderByWithRelationInput
  }

  export type EnvironmentVariableWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    key_environment_clientId?: EnvironmentVariableKeyEnvironmentClientIdCompoundUniqueInput
    AND?: EnvironmentVariableWhereInput | EnvironmentVariableWhereInput[]
    OR?: EnvironmentVariableWhereInput[]
    NOT?: EnvironmentVariableWhereInput | EnvironmentVariableWhereInput[]
    key?: StringFilter<"EnvironmentVariable"> | string
    value?: StringFilter<"EnvironmentVariable"> | string
    environment?: EnumEnvironmentFilter<"EnvironmentVariable"> | Environment
    clientId?: StringFilter<"EnvironmentVariable"> | string
    client?: XOR<ClientRelationFilter, ClientWhereInput>
  }, "id" | "key_environment_clientId">

  export type EnvironmentVariableOrderByWithAggregationInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    environment?: SortOrder
    clientId?: SortOrder
    _count?: EnvironmentVariableCountOrderByAggregateInput
    _max?: EnvironmentVariableMaxOrderByAggregateInput
    _min?: EnvironmentVariableMinOrderByAggregateInput
  }

  export type EnvironmentVariableScalarWhereWithAggregatesInput = {
    AND?: EnvironmentVariableScalarWhereWithAggregatesInput | EnvironmentVariableScalarWhereWithAggregatesInput[]
    OR?: EnvironmentVariableScalarWhereWithAggregatesInput[]
    NOT?: EnvironmentVariableScalarWhereWithAggregatesInput | EnvironmentVariableScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"EnvironmentVariable"> | string
    key?: StringWithAggregatesFilter<"EnvironmentVariable"> | string
    value?: StringWithAggregatesFilter<"EnvironmentVariable"> | string
    environment?: EnumEnvironmentWithAggregatesFilter<"EnvironmentVariable"> | Environment
    clientId?: StringWithAggregatesFilter<"EnvironmentVariable"> | string
  }

  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    name?: StringNullableFilter<"User"> | string | null
    avatar?: StringNullableFilter<"User"> | string | null
    role?: EnumRoleFilter<"User"> | Role
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    orders?: OrderListRelationFilter
    cart?: XOR<CartNullableRelationFilter, CartWhereInput> | null
    mcpConfigurations?: MCPConfigurationListRelationFilter
    products?: ProductListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrderInput | SortOrder
    avatar?: SortOrderInput | SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    orders?: OrderOrderByRelationAggregateInput
    cart?: CartOrderByWithRelationInput
    mcpConfigurations?: MCPConfigurationOrderByRelationAggregateInput
    products?: ProductOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    name?: StringNullableFilter<"User"> | string | null
    avatar?: StringNullableFilter<"User"> | string | null
    role?: EnumRoleFilter<"User"> | Role
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    orders?: OrderListRelationFilter
    cart?: XOR<CartNullableRelationFilter, CartWhereInput> | null
    mcpConfigurations?: MCPConfigurationListRelationFilter
    products?: ProductListRelationFilter
  }, "id" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrderInput | SortOrder
    avatar?: SortOrderInput | SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    name?: StringNullableWithAggregatesFilter<"User"> | string | null
    avatar?: StringNullableWithAggregatesFilter<"User"> | string | null
    role?: EnumRoleWithAggregatesFilter<"User"> | Role
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type CategoryWhereInput = {
    AND?: CategoryWhereInput | CategoryWhereInput[]
    OR?: CategoryWhereInput[]
    NOT?: CategoryWhereInput | CategoryWhereInput[]
    id?: StringFilter<"Category"> | string
    name?: StringFilter<"Category"> | string
    description?: StringNullableFilter<"Category"> | string | null
    createdAt?: DateTimeFilter<"Category"> | Date | string
    products?: ProductListRelationFilter
  }

  export type CategoryOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    products?: ProductOrderByRelationAggregateInput
  }

  export type CategoryWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: CategoryWhereInput | CategoryWhereInput[]
    OR?: CategoryWhereInput[]
    NOT?: CategoryWhereInput | CategoryWhereInput[]
    name?: StringFilter<"Category"> | string
    description?: StringNullableFilter<"Category"> | string | null
    createdAt?: DateTimeFilter<"Category"> | Date | string
    products?: ProductListRelationFilter
  }, "id">

  export type CategoryOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: CategoryCountOrderByAggregateInput
    _max?: CategoryMaxOrderByAggregateInput
    _min?: CategoryMinOrderByAggregateInput
  }

  export type CategoryScalarWhereWithAggregatesInput = {
    AND?: CategoryScalarWhereWithAggregatesInput | CategoryScalarWhereWithAggregatesInput[]
    OR?: CategoryScalarWhereWithAggregatesInput[]
    NOT?: CategoryScalarWhereWithAggregatesInput | CategoryScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Category"> | string
    name?: StringWithAggregatesFilter<"Category"> | string
    description?: StringNullableWithAggregatesFilter<"Category"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Category"> | Date | string
  }

  export type ProductWhereInput = {
    AND?: ProductWhereInput | ProductWhereInput[]
    OR?: ProductWhereInput[]
    NOT?: ProductWhereInput | ProductWhereInput[]
    id?: StringFilter<"Product"> | string
    name?: StringFilter<"Product"> | string
    description?: StringFilter<"Product"> | string
    price?: FloatFilter<"Product"> | number
    image?: StringNullableFilter<"Product"> | string | null
    categoryId?: StringFilter<"Product"> | string
    sellerId?: StringFilter<"Product"> | string
    status?: EnumStatusFilter<"Product"> | Status
    createdAt?: DateTimeFilter<"Product"> | Date | string
    updatedAt?: DateTimeFilter<"Product"> | Date | string
    category?: XOR<CategoryRelationFilter, CategoryWhereInput>
    seller?: XOR<UserRelationFilter, UserWhereInput>
    orderItems?: OrderItemListRelationFilter
    mcpConfigurations?: MCPConfigurationListRelationFilter
    cartItems?: CartItemListRelationFilter
  }

  export type ProductOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    price?: SortOrder
    image?: SortOrderInput | SortOrder
    categoryId?: SortOrder
    sellerId?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    category?: CategoryOrderByWithRelationInput
    seller?: UserOrderByWithRelationInput
    orderItems?: OrderItemOrderByRelationAggregateInput
    mcpConfigurations?: MCPConfigurationOrderByRelationAggregateInput
    cartItems?: CartItemOrderByRelationAggregateInput
  }

  export type ProductWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ProductWhereInput | ProductWhereInput[]
    OR?: ProductWhereInput[]
    NOT?: ProductWhereInput | ProductWhereInput[]
    name?: StringFilter<"Product"> | string
    description?: StringFilter<"Product"> | string
    price?: FloatFilter<"Product"> | number
    image?: StringNullableFilter<"Product"> | string | null
    categoryId?: StringFilter<"Product"> | string
    sellerId?: StringFilter<"Product"> | string
    status?: EnumStatusFilter<"Product"> | Status
    createdAt?: DateTimeFilter<"Product"> | Date | string
    updatedAt?: DateTimeFilter<"Product"> | Date | string
    category?: XOR<CategoryRelationFilter, CategoryWhereInput>
    seller?: XOR<UserRelationFilter, UserWhereInput>
    orderItems?: OrderItemListRelationFilter
    mcpConfigurations?: MCPConfigurationListRelationFilter
    cartItems?: CartItemListRelationFilter
  }, "id">

  export type ProductOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    price?: SortOrder
    image?: SortOrderInput | SortOrder
    categoryId?: SortOrder
    sellerId?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ProductCountOrderByAggregateInput
    _avg?: ProductAvgOrderByAggregateInput
    _max?: ProductMaxOrderByAggregateInput
    _min?: ProductMinOrderByAggregateInput
    _sum?: ProductSumOrderByAggregateInput
  }

  export type ProductScalarWhereWithAggregatesInput = {
    AND?: ProductScalarWhereWithAggregatesInput | ProductScalarWhereWithAggregatesInput[]
    OR?: ProductScalarWhereWithAggregatesInput[]
    NOT?: ProductScalarWhereWithAggregatesInput | ProductScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Product"> | string
    name?: StringWithAggregatesFilter<"Product"> | string
    description?: StringWithAggregatesFilter<"Product"> | string
    price?: FloatWithAggregatesFilter<"Product"> | number
    image?: StringNullableWithAggregatesFilter<"Product"> | string | null
    categoryId?: StringWithAggregatesFilter<"Product"> | string
    sellerId?: StringWithAggregatesFilter<"Product"> | string
    status?: EnumStatusWithAggregatesFilter<"Product"> | Status
    createdAt?: DateTimeWithAggregatesFilter<"Product"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Product"> | Date | string
  }

  export type OrderWhereInput = {
    AND?: OrderWhereInput | OrderWhereInput[]
    OR?: OrderWhereInput[]
    NOT?: OrderWhereInput | OrderWhereInput[]
    id?: StringFilter<"Order"> | string
    userId?: StringFilter<"Order"> | string
    total?: FloatFilter<"Order"> | number
    status?: EnumOrderStatusFilter<"Order"> | OrderStatus
    createdAt?: DateTimeFilter<"Order"> | Date | string
    updatedAt?: DateTimeFilter<"Order"> | Date | string
    user?: XOR<UserRelationFilter, UserWhereInput>
    items?: OrderItemListRelationFilter
  }

  export type OrderOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    total?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
    items?: OrderItemOrderByRelationAggregateInput
  }

  export type OrderWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: OrderWhereInput | OrderWhereInput[]
    OR?: OrderWhereInput[]
    NOT?: OrderWhereInput | OrderWhereInput[]
    userId?: StringFilter<"Order"> | string
    total?: FloatFilter<"Order"> | number
    status?: EnumOrderStatusFilter<"Order"> | OrderStatus
    createdAt?: DateTimeFilter<"Order"> | Date | string
    updatedAt?: DateTimeFilter<"Order"> | Date | string
    user?: XOR<UserRelationFilter, UserWhereInput>
    items?: OrderItemListRelationFilter
  }, "id">

  export type OrderOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    total?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: OrderCountOrderByAggregateInput
    _avg?: OrderAvgOrderByAggregateInput
    _max?: OrderMaxOrderByAggregateInput
    _min?: OrderMinOrderByAggregateInput
    _sum?: OrderSumOrderByAggregateInput
  }

  export type OrderScalarWhereWithAggregatesInput = {
    AND?: OrderScalarWhereWithAggregatesInput | OrderScalarWhereWithAggregatesInput[]
    OR?: OrderScalarWhereWithAggregatesInput[]
    NOT?: OrderScalarWhereWithAggregatesInput | OrderScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Order"> | string
    userId?: StringWithAggregatesFilter<"Order"> | string
    total?: FloatWithAggregatesFilter<"Order"> | number
    status?: EnumOrderStatusWithAggregatesFilter<"Order"> | OrderStatus
    createdAt?: DateTimeWithAggregatesFilter<"Order"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Order"> | Date | string
  }

  export type OrderItemWhereInput = {
    AND?: OrderItemWhereInput | OrderItemWhereInput[]
    OR?: OrderItemWhereInput[]
    NOT?: OrderItemWhereInput | OrderItemWhereInput[]
    id?: StringFilter<"OrderItem"> | string
    orderId?: StringFilter<"OrderItem"> | string
    productId?: StringFilter<"OrderItem"> | string
    quantity?: IntFilter<"OrderItem"> | number
    price?: FloatFilter<"OrderItem"> | number
    order?: XOR<OrderRelationFilter, OrderWhereInput>
    product?: XOR<ProductRelationFilter, ProductWhereInput>
  }

  export type OrderItemOrderByWithRelationInput = {
    id?: SortOrder
    orderId?: SortOrder
    productId?: SortOrder
    quantity?: SortOrder
    price?: SortOrder
    order?: OrderOrderByWithRelationInput
    product?: ProductOrderByWithRelationInput
  }

  export type OrderItemWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: OrderItemWhereInput | OrderItemWhereInput[]
    OR?: OrderItemWhereInput[]
    NOT?: OrderItemWhereInput | OrderItemWhereInput[]
    orderId?: StringFilter<"OrderItem"> | string
    productId?: StringFilter<"OrderItem"> | string
    quantity?: IntFilter<"OrderItem"> | number
    price?: FloatFilter<"OrderItem"> | number
    order?: XOR<OrderRelationFilter, OrderWhereInput>
    product?: XOR<ProductRelationFilter, ProductWhereInput>
  }, "id">

  export type OrderItemOrderByWithAggregationInput = {
    id?: SortOrder
    orderId?: SortOrder
    productId?: SortOrder
    quantity?: SortOrder
    price?: SortOrder
    _count?: OrderItemCountOrderByAggregateInput
    _avg?: OrderItemAvgOrderByAggregateInput
    _max?: OrderItemMaxOrderByAggregateInput
    _min?: OrderItemMinOrderByAggregateInput
    _sum?: OrderItemSumOrderByAggregateInput
  }

  export type OrderItemScalarWhereWithAggregatesInput = {
    AND?: OrderItemScalarWhereWithAggregatesInput | OrderItemScalarWhereWithAggregatesInput[]
    OR?: OrderItemScalarWhereWithAggregatesInput[]
    NOT?: OrderItemScalarWhereWithAggregatesInput | OrderItemScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"OrderItem"> | string
    orderId?: StringWithAggregatesFilter<"OrderItem"> | string
    productId?: StringWithAggregatesFilter<"OrderItem"> | string
    quantity?: IntWithAggregatesFilter<"OrderItem"> | number
    price?: FloatWithAggregatesFilter<"OrderItem"> | number
  }

  export type CartWhereInput = {
    AND?: CartWhereInput | CartWhereInput[]
    OR?: CartWhereInput[]
    NOT?: CartWhereInput | CartWhereInput[]
    id?: StringFilter<"Cart"> | string
    userId?: StringFilter<"Cart"> | string
    user?: XOR<UserRelationFilter, UserWhereInput>
    items?: CartItemListRelationFilter
  }

  export type CartOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    user?: UserOrderByWithRelationInput
    items?: CartItemOrderByRelationAggregateInput
  }

  export type CartWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    userId?: string
    AND?: CartWhereInput | CartWhereInput[]
    OR?: CartWhereInput[]
    NOT?: CartWhereInput | CartWhereInput[]
    user?: XOR<UserRelationFilter, UserWhereInput>
    items?: CartItemListRelationFilter
  }, "id" | "userId">

  export type CartOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    _count?: CartCountOrderByAggregateInput
    _max?: CartMaxOrderByAggregateInput
    _min?: CartMinOrderByAggregateInput
  }

  export type CartScalarWhereWithAggregatesInput = {
    AND?: CartScalarWhereWithAggregatesInput | CartScalarWhereWithAggregatesInput[]
    OR?: CartScalarWhereWithAggregatesInput[]
    NOT?: CartScalarWhereWithAggregatesInput | CartScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Cart"> | string
    userId?: StringWithAggregatesFilter<"Cart"> | string
  }

  export type CartItemWhereInput = {
    AND?: CartItemWhereInput | CartItemWhereInput[]
    OR?: CartItemWhereInput[]
    NOT?: CartItemWhereInput | CartItemWhereInput[]
    id?: StringFilter<"CartItem"> | string
    cartId?: StringFilter<"CartItem"> | string
    productId?: StringFilter<"CartItem"> | string
    quantity?: IntFilter<"CartItem"> | number
    cart?: XOR<CartRelationFilter, CartWhereInput>
    product?: XOR<ProductRelationFilter, ProductWhereInput>
  }

  export type CartItemOrderByWithRelationInput = {
    id?: SortOrder
    cartId?: SortOrder
    productId?: SortOrder
    quantity?: SortOrder
    cart?: CartOrderByWithRelationInput
    product?: ProductOrderByWithRelationInput
  }

  export type CartItemWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: CartItemWhereInput | CartItemWhereInput[]
    OR?: CartItemWhereInput[]
    NOT?: CartItemWhereInput | CartItemWhereInput[]
    cartId?: StringFilter<"CartItem"> | string
    productId?: StringFilter<"CartItem"> | string
    quantity?: IntFilter<"CartItem"> | number
    cart?: XOR<CartRelationFilter, CartWhereInput>
    product?: XOR<ProductRelationFilter, ProductWhereInput>
  }, "id">

  export type CartItemOrderByWithAggregationInput = {
    id?: SortOrder
    cartId?: SortOrder
    productId?: SortOrder
    quantity?: SortOrder
    _count?: CartItemCountOrderByAggregateInput
    _avg?: CartItemAvgOrderByAggregateInput
    _max?: CartItemMaxOrderByAggregateInput
    _min?: CartItemMinOrderByAggregateInput
    _sum?: CartItemSumOrderByAggregateInput
  }

  export type CartItemScalarWhereWithAggregatesInput = {
    AND?: CartItemScalarWhereWithAggregatesInput | CartItemScalarWhereWithAggregatesInput[]
    OR?: CartItemScalarWhereWithAggregatesInput[]
    NOT?: CartItemScalarWhereWithAggregatesInput | CartItemScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"CartItem"> | string
    cartId?: StringWithAggregatesFilter<"CartItem"> | string
    productId?: StringWithAggregatesFilter<"CartItem"> | string
    quantity?: IntWithAggregatesFilter<"CartItem"> | number
  }

  export type MCPConfigurationWhereInput = {
    AND?: MCPConfigurationWhereInput | MCPConfigurationWhereInput[]
    OR?: MCPConfigurationWhereInput[]
    NOT?: MCPConfigurationWhereInput | MCPConfigurationWhereInput[]
    id?: StringFilter<"MCPConfiguration"> | string
    name?: StringFilter<"MCPConfiguration"> | string
    description?: StringNullableFilter<"MCPConfiguration"> | string | null
    configData?: JsonFilter<"MCPConfiguration">
    status?: EnumConfigStatusFilter<"MCPConfiguration"> | ConfigStatus
    userId?: StringFilter<"MCPConfiguration"> | string
    productId?: StringNullableFilter<"MCPConfiguration"> | string | null
    createdAt?: DateTimeFilter<"MCPConfiguration"> | Date | string
    updatedAt?: DateTimeFilter<"MCPConfiguration"> | Date | string
    user?: XOR<UserRelationFilter, UserWhereInput>
    product?: XOR<ProductNullableRelationFilter, ProductWhereInput> | null
  }

  export type MCPConfigurationOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    configData?: SortOrder
    status?: SortOrder
    userId?: SortOrder
    productId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
    product?: ProductOrderByWithRelationInput
  }

  export type MCPConfigurationWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: MCPConfigurationWhereInput | MCPConfigurationWhereInput[]
    OR?: MCPConfigurationWhereInput[]
    NOT?: MCPConfigurationWhereInput | MCPConfigurationWhereInput[]
    name?: StringFilter<"MCPConfiguration"> | string
    description?: StringNullableFilter<"MCPConfiguration"> | string | null
    configData?: JsonFilter<"MCPConfiguration">
    status?: EnumConfigStatusFilter<"MCPConfiguration"> | ConfigStatus
    userId?: StringFilter<"MCPConfiguration"> | string
    productId?: StringNullableFilter<"MCPConfiguration"> | string | null
    createdAt?: DateTimeFilter<"MCPConfiguration"> | Date | string
    updatedAt?: DateTimeFilter<"MCPConfiguration"> | Date | string
    user?: XOR<UserRelationFilter, UserWhereInput>
    product?: XOR<ProductNullableRelationFilter, ProductWhereInput> | null
  }, "id">

  export type MCPConfigurationOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    configData?: SortOrder
    status?: SortOrder
    userId?: SortOrder
    productId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: MCPConfigurationCountOrderByAggregateInput
    _max?: MCPConfigurationMaxOrderByAggregateInput
    _min?: MCPConfigurationMinOrderByAggregateInput
  }

  export type MCPConfigurationScalarWhereWithAggregatesInput = {
    AND?: MCPConfigurationScalarWhereWithAggregatesInput | MCPConfigurationScalarWhereWithAggregatesInput[]
    OR?: MCPConfigurationScalarWhereWithAggregatesInput[]
    NOT?: MCPConfigurationScalarWhereWithAggregatesInput | MCPConfigurationScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"MCPConfiguration"> | string
    name?: StringWithAggregatesFilter<"MCPConfiguration"> | string
    description?: StringNullableWithAggregatesFilter<"MCPConfiguration"> | string | null
    configData?: JsonWithAggregatesFilter<"MCPConfiguration">
    status?: EnumConfigStatusWithAggregatesFilter<"MCPConfiguration"> | ConfigStatus
    userId?: StringWithAggregatesFilter<"MCPConfiguration"> | string
    productId?: StringNullableWithAggregatesFilter<"MCPConfiguration"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"MCPConfiguration"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"MCPConfiguration"> | Date | string
  }

  export type ClientCreateInput = {
    id?: string
    name: string
    domain?: string | null
    apiKeys: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    modules?: ModuleOnClientCreateNestedManyWithoutClientInput
    environmentVariables?: EnvironmentVariableCreateNestedManyWithoutClientInput
  }

  export type ClientUncheckedCreateInput = {
    id?: string
    name: string
    domain?: string | null
    apiKeys: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    modules?: ModuleOnClientUncheckedCreateNestedManyWithoutClientInput
    environmentVariables?: EnvironmentVariableUncheckedCreateNestedManyWithoutClientInput
  }

  export type ClientUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: NullableStringFieldUpdateOperationsInput | string | null
    apiKeys?: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    modules?: ModuleOnClientUpdateManyWithoutClientNestedInput
    environmentVariables?: EnvironmentVariableUpdateManyWithoutClientNestedInput
  }

  export type ClientUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: NullableStringFieldUpdateOperationsInput | string | null
    apiKeys?: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    modules?: ModuleOnClientUncheckedUpdateManyWithoutClientNestedInput
    environmentVariables?: EnvironmentVariableUncheckedUpdateManyWithoutClientNestedInput
  }

  export type ClientCreateManyInput = {
    id?: string
    name: string
    domain?: string | null
    apiKeys: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ClientUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: NullableStringFieldUpdateOperationsInput | string | null
    apiKeys?: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClientUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: NullableStringFieldUpdateOperationsInput | string | null
    apiKeys?: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ModuleCreateInput = {
    id?: string
    name: string
    description?: string | null
    version?: string | null
    clients?: ModuleOnClientCreateNestedManyWithoutModuleInput
  }

  export type ModuleUncheckedCreateInput = {
    id?: string
    name: string
    description?: string | null
    version?: string | null
    clients?: ModuleOnClientUncheckedCreateNestedManyWithoutModuleInput
  }

  export type ModuleUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    version?: NullableStringFieldUpdateOperationsInput | string | null
    clients?: ModuleOnClientUpdateManyWithoutModuleNestedInput
  }

  export type ModuleUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    version?: NullableStringFieldUpdateOperationsInput | string | null
    clients?: ModuleOnClientUncheckedUpdateManyWithoutModuleNestedInput
  }

  export type ModuleCreateManyInput = {
    id?: string
    name: string
    description?: string | null
    version?: string | null
  }

  export type ModuleUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    version?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type ModuleUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    version?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type ModuleOnClientCreateInput = {
    id?: string
    enabled?: boolean
    client: ClientCreateNestedOneWithoutModulesInput
    module: ModuleCreateNestedOneWithoutClientsInput
  }

  export type ModuleOnClientUncheckedCreateInput = {
    id?: string
    clientId: string
    moduleId: string
    enabled?: boolean
  }

  export type ModuleOnClientUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
    client?: ClientUpdateOneRequiredWithoutModulesNestedInput
    module?: ModuleUpdateOneRequiredWithoutClientsNestedInput
  }

  export type ModuleOnClientUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    clientId?: StringFieldUpdateOperationsInput | string
    moduleId?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ModuleOnClientCreateManyInput = {
    id?: string
    clientId: string
    moduleId: string
    enabled?: boolean
  }

  export type ModuleOnClientUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ModuleOnClientUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    clientId?: StringFieldUpdateOperationsInput | string
    moduleId?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
  }

  export type EnvironmentVariableCreateInput = {
    id?: string
    key: string
    value: string
    environment?: Environment
    client: ClientCreateNestedOneWithoutEnvironmentVariablesInput
  }

  export type EnvironmentVariableUncheckedCreateInput = {
    id?: string
    key: string
    value: string
    environment?: Environment
    clientId: string
  }

  export type EnvironmentVariableUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    environment?: EnumEnvironmentFieldUpdateOperationsInput | Environment
    client?: ClientUpdateOneRequiredWithoutEnvironmentVariablesNestedInput
  }

  export type EnvironmentVariableUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    environment?: EnumEnvironmentFieldUpdateOperationsInput | Environment
    clientId?: StringFieldUpdateOperationsInput | string
  }

  export type EnvironmentVariableCreateManyInput = {
    id?: string
    key: string
    value: string
    environment?: Environment
    clientId: string
  }

  export type EnvironmentVariableUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    environment?: EnumEnvironmentFieldUpdateOperationsInput | Environment
  }

  export type EnvironmentVariableUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    environment?: EnumEnvironmentFieldUpdateOperationsInput | Environment
    clientId?: StringFieldUpdateOperationsInput | string
  }

  export type UserCreateInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    role?: Role
    createdAt?: Date | string
    updatedAt?: Date | string
    orders?: OrderCreateNestedManyWithoutUserInput
    cart?: CartCreateNestedOneWithoutUserInput
    mcpConfigurations?: MCPConfigurationCreateNestedManyWithoutUserInput
    products?: ProductCreateNestedManyWithoutSellerInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    role?: Role
    createdAt?: Date | string
    updatedAt?: Date | string
    orders?: OrderUncheckedCreateNestedManyWithoutUserInput
    cart?: CartUncheckedCreateNestedOneWithoutUserInput
    mcpConfigurations?: MCPConfigurationUncheckedCreateNestedManyWithoutUserInput
    products?: ProductUncheckedCreateNestedManyWithoutSellerInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orders?: OrderUpdateManyWithoutUserNestedInput
    cart?: CartUpdateOneWithoutUserNestedInput
    mcpConfigurations?: MCPConfigurationUpdateManyWithoutUserNestedInput
    products?: ProductUpdateManyWithoutSellerNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orders?: OrderUncheckedUpdateManyWithoutUserNestedInput
    cart?: CartUncheckedUpdateOneWithoutUserNestedInput
    mcpConfigurations?: MCPConfigurationUncheckedUpdateManyWithoutUserNestedInput
    products?: ProductUncheckedUpdateManyWithoutSellerNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    role?: Role
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryCreateInput = {
    id?: string
    name: string
    description?: string | null
    createdAt?: Date | string
    products?: ProductCreateNestedManyWithoutCategoryInput
  }

  export type CategoryUncheckedCreateInput = {
    id?: string
    name: string
    description?: string | null
    createdAt?: Date | string
    products?: ProductUncheckedCreateNestedManyWithoutCategoryInput
  }

  export type CategoryUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    products?: ProductUpdateManyWithoutCategoryNestedInput
  }

  export type CategoryUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    products?: ProductUncheckedUpdateManyWithoutCategoryNestedInput
  }

  export type CategoryCreateManyInput = {
    id?: string
    name: string
    description?: string | null
    createdAt?: Date | string
  }

  export type CategoryUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductCreateInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
    category: CategoryCreateNestedOneWithoutProductsInput
    seller: UserCreateNestedOneWithoutProductsInput
    orderItems?: OrderItemCreateNestedManyWithoutProductInput
    mcpConfigurations?: MCPConfigurationCreateNestedManyWithoutProductInput
    cartItems?: CartItemCreateNestedManyWithoutProductInput
  }

  export type ProductUncheckedCreateInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    categoryId: string
    sellerId: string
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
    orderItems?: OrderItemUncheckedCreateNestedManyWithoutProductInput
    mcpConfigurations?: MCPConfigurationUncheckedCreateNestedManyWithoutProductInput
    cartItems?: CartItemUncheckedCreateNestedManyWithoutProductInput
  }

  export type ProductUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    category?: CategoryUpdateOneRequiredWithoutProductsNestedInput
    seller?: UserUpdateOneRequiredWithoutProductsNestedInput
    orderItems?: OrderItemUpdateManyWithoutProductNestedInput
    mcpConfigurations?: MCPConfigurationUpdateManyWithoutProductNestedInput
    cartItems?: CartItemUpdateManyWithoutProductNestedInput
  }

  export type ProductUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    categoryId?: StringFieldUpdateOperationsInput | string
    sellerId?: StringFieldUpdateOperationsInput | string
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orderItems?: OrderItemUncheckedUpdateManyWithoutProductNestedInput
    mcpConfigurations?: MCPConfigurationUncheckedUpdateManyWithoutProductNestedInput
    cartItems?: CartItemUncheckedUpdateManyWithoutProductNestedInput
  }

  export type ProductCreateManyInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    categoryId: string
    sellerId: string
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProductUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    categoryId?: StringFieldUpdateOperationsInput | string
    sellerId?: StringFieldUpdateOperationsInput | string
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OrderCreateInput = {
    id?: string
    total: number
    status?: OrderStatus
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutOrdersInput
    items?: OrderItemCreateNestedManyWithoutOrderInput
  }

  export type OrderUncheckedCreateInput = {
    id?: string
    userId: string
    total: number
    status?: OrderStatus
    createdAt?: Date | string
    updatedAt?: Date | string
    items?: OrderItemUncheckedCreateNestedManyWithoutOrderInput
  }

  export type OrderUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    total?: FloatFieldUpdateOperationsInput | number
    status?: EnumOrderStatusFieldUpdateOperationsInput | OrderStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutOrdersNestedInput
    items?: OrderItemUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    total?: FloatFieldUpdateOperationsInput | number
    status?: EnumOrderStatusFieldUpdateOperationsInput | OrderStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    items?: OrderItemUncheckedUpdateManyWithoutOrderNestedInput
  }

  export type OrderCreateManyInput = {
    id?: string
    userId: string
    total: number
    status?: OrderStatus
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type OrderUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    total?: FloatFieldUpdateOperationsInput | number
    status?: EnumOrderStatusFieldUpdateOperationsInput | OrderStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OrderUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    total?: FloatFieldUpdateOperationsInput | number
    status?: EnumOrderStatusFieldUpdateOperationsInput | OrderStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OrderItemCreateInput = {
    id?: string
    quantity: number
    price: number
    order: OrderCreateNestedOneWithoutItemsInput
    product: ProductCreateNestedOneWithoutOrderItemsInput
  }

  export type OrderItemUncheckedCreateInput = {
    id?: string
    orderId: string
    productId: string
    quantity: number
    price: number
  }

  export type OrderItemUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    price?: FloatFieldUpdateOperationsInput | number
    order?: OrderUpdateOneRequiredWithoutItemsNestedInput
    product?: ProductUpdateOneRequiredWithoutOrderItemsNestedInput
  }

  export type OrderItemUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderId?: StringFieldUpdateOperationsInput | string
    productId?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    price?: FloatFieldUpdateOperationsInput | number
  }

  export type OrderItemCreateManyInput = {
    id?: string
    orderId: string
    productId: string
    quantity: number
    price: number
  }

  export type OrderItemUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    price?: FloatFieldUpdateOperationsInput | number
  }

  export type OrderItemUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderId?: StringFieldUpdateOperationsInput | string
    productId?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    price?: FloatFieldUpdateOperationsInput | number
  }

  export type CartCreateInput = {
    id?: string
    user: UserCreateNestedOneWithoutCartInput
    items?: CartItemCreateNestedManyWithoutCartInput
  }

  export type CartUncheckedCreateInput = {
    id?: string
    userId: string
    items?: CartItemUncheckedCreateNestedManyWithoutCartInput
  }

  export type CartUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    user?: UserUpdateOneRequiredWithoutCartNestedInput
    items?: CartItemUpdateManyWithoutCartNestedInput
  }

  export type CartUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    items?: CartItemUncheckedUpdateManyWithoutCartNestedInput
  }

  export type CartCreateManyInput = {
    id?: string
    userId: string
  }

  export type CartUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
  }

  export type CartUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
  }

  export type CartItemCreateInput = {
    id?: string
    quantity: number
    cart: CartCreateNestedOneWithoutItemsInput
    product: ProductCreateNestedOneWithoutCartItemsInput
  }

  export type CartItemUncheckedCreateInput = {
    id?: string
    cartId: string
    productId: string
    quantity: number
  }

  export type CartItemUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    cart?: CartUpdateOneRequiredWithoutItemsNestedInput
    product?: ProductUpdateOneRequiredWithoutCartItemsNestedInput
  }

  export type CartItemUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    cartId?: StringFieldUpdateOperationsInput | string
    productId?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type CartItemCreateManyInput = {
    id?: string
    cartId: string
    productId: string
    quantity: number
  }

  export type CartItemUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type CartItemUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    cartId?: StringFieldUpdateOperationsInput | string
    productId?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type MCPConfigurationCreateInput = {
    id?: string
    name: string
    description?: string | null
    configData: JsonNullValueInput | InputJsonValue
    status?: ConfigStatus
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutMcpConfigurationsInput
    product?: ProductCreateNestedOneWithoutMcpConfigurationsInput
  }

  export type MCPConfigurationUncheckedCreateInput = {
    id?: string
    name: string
    description?: string | null
    configData: JsonNullValueInput | InputJsonValue
    status?: ConfigStatus
    userId: string
    productId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MCPConfigurationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    configData?: JsonNullValueInput | InputJsonValue
    status?: EnumConfigStatusFieldUpdateOperationsInput | ConfigStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutMcpConfigurationsNestedInput
    product?: ProductUpdateOneWithoutMcpConfigurationsNestedInput
  }

  export type MCPConfigurationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    configData?: JsonNullValueInput | InputJsonValue
    status?: EnumConfigStatusFieldUpdateOperationsInput | ConfigStatus
    userId?: StringFieldUpdateOperationsInput | string
    productId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MCPConfigurationCreateManyInput = {
    id?: string
    name: string
    description?: string | null
    configData: JsonNullValueInput | InputJsonValue
    status?: ConfigStatus
    userId: string
    productId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MCPConfigurationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    configData?: JsonNullValueInput | InputJsonValue
    status?: EnumConfigStatusFieldUpdateOperationsInput | ConfigStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MCPConfigurationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    configData?: JsonNullValueInput | InputJsonValue
    status?: EnumConfigStatusFieldUpdateOperationsInput | ConfigStatus
    userId?: StringFieldUpdateOperationsInput | string
    productId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }
  export type JsonFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }
  export type JsonNullableFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type ModuleOnClientListRelationFilter = {
    every?: ModuleOnClientWhereInput
    some?: ModuleOnClientWhereInput
    none?: ModuleOnClientWhereInput
  }

  export type EnvironmentVariableListRelationFilter = {
    every?: EnvironmentVariableWhereInput
    some?: EnvironmentVariableWhereInput
    none?: EnvironmentVariableWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type ModuleOnClientOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type EnvironmentVariableOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ClientCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    apiKeys?: SortOrder
    settings?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ClientMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ClientMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    domain?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type ModuleCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    version?: SortOrder
  }

  export type ModuleMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    version?: SortOrder
  }

  export type ModuleMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    version?: SortOrder
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type ClientRelationFilter = {
    is?: ClientWhereInput
    isNot?: ClientWhereInput
  }

  export type ModuleRelationFilter = {
    is?: ModuleWhereInput
    isNot?: ModuleWhereInput
  }

  export type ModuleOnClientClientIdModuleIdCompoundUniqueInput = {
    clientId: string
    moduleId: string
  }

  export type ModuleOnClientCountOrderByAggregateInput = {
    id?: SortOrder
    clientId?: SortOrder
    moduleId?: SortOrder
    enabled?: SortOrder
  }

  export type ModuleOnClientMaxOrderByAggregateInput = {
    id?: SortOrder
    clientId?: SortOrder
    moduleId?: SortOrder
    enabled?: SortOrder
  }

  export type ModuleOnClientMinOrderByAggregateInput = {
    id?: SortOrder
    clientId?: SortOrder
    moduleId?: SortOrder
    enabled?: SortOrder
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type EnumEnvironmentFilter<$PrismaModel = never> = {
    equals?: Environment | EnumEnvironmentFieldRefInput<$PrismaModel>
    in?: Environment[] | ListEnumEnvironmentFieldRefInput<$PrismaModel>
    notIn?: Environment[] | ListEnumEnvironmentFieldRefInput<$PrismaModel>
    not?: NestedEnumEnvironmentFilter<$PrismaModel> | Environment
  }

  export type EnvironmentVariableKeyEnvironmentClientIdCompoundUniqueInput = {
    key: string
    environment: Environment
    clientId: string
  }

  export type EnvironmentVariableCountOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    environment?: SortOrder
    clientId?: SortOrder
  }

  export type EnvironmentVariableMaxOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    environment?: SortOrder
    clientId?: SortOrder
  }

  export type EnvironmentVariableMinOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    value?: SortOrder
    environment?: SortOrder
    clientId?: SortOrder
  }

  export type EnumEnvironmentWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Environment | EnumEnvironmentFieldRefInput<$PrismaModel>
    in?: Environment[] | ListEnumEnvironmentFieldRefInput<$PrismaModel>
    notIn?: Environment[] | ListEnumEnvironmentFieldRefInput<$PrismaModel>
    not?: NestedEnumEnvironmentWithAggregatesFilter<$PrismaModel> | Environment
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumEnvironmentFilter<$PrismaModel>
    _max?: NestedEnumEnvironmentFilter<$PrismaModel>
  }

  export type EnumRoleFilter<$PrismaModel = never> = {
    equals?: Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleFilter<$PrismaModel> | Role
  }

  export type OrderListRelationFilter = {
    every?: OrderWhereInput
    some?: OrderWhereInput
    none?: OrderWhereInput
  }

  export type CartNullableRelationFilter = {
    is?: CartWhereInput | null
    isNot?: CartWhereInput | null
  }

  export type MCPConfigurationListRelationFilter = {
    every?: MCPConfigurationWhereInput
    some?: MCPConfigurationWhereInput
    none?: MCPConfigurationWhereInput
  }

  export type ProductListRelationFilter = {
    every?: ProductWhereInput
    some?: ProductWhereInput
    none?: ProductWhereInput
  }

  export type OrderOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type MCPConfigurationOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ProductOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    avatar?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    avatar?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    avatar?: SortOrder
    role?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleWithAggregatesFilter<$PrismaModel> | Role
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleFilter<$PrismaModel>
    _max?: NestedEnumRoleFilter<$PrismaModel>
  }

  export type CategoryCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
  }

  export type CategoryMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
  }

  export type CategoryMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type EnumStatusFilter<$PrismaModel = never> = {
    equals?: Status | EnumStatusFieldRefInput<$PrismaModel>
    in?: Status[] | ListEnumStatusFieldRefInput<$PrismaModel>
    notIn?: Status[] | ListEnumStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumStatusFilter<$PrismaModel> | Status
  }

  export type CategoryRelationFilter = {
    is?: CategoryWhereInput
    isNot?: CategoryWhereInput
  }

  export type UserRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type OrderItemListRelationFilter = {
    every?: OrderItemWhereInput
    some?: OrderItemWhereInput
    none?: OrderItemWhereInput
  }

  export type CartItemListRelationFilter = {
    every?: CartItemWhereInput
    some?: CartItemWhereInput
    none?: CartItemWhereInput
  }

  export type OrderItemOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CartItemOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ProductCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    price?: SortOrder
    image?: SortOrder
    categoryId?: SortOrder
    sellerId?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProductAvgOrderByAggregateInput = {
    price?: SortOrder
  }

  export type ProductMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    price?: SortOrder
    image?: SortOrder
    categoryId?: SortOrder
    sellerId?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProductMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    price?: SortOrder
    image?: SortOrder
    categoryId?: SortOrder
    sellerId?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProductSumOrderByAggregateInput = {
    price?: SortOrder
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type EnumStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Status | EnumStatusFieldRefInput<$PrismaModel>
    in?: Status[] | ListEnumStatusFieldRefInput<$PrismaModel>
    notIn?: Status[] | ListEnumStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumStatusWithAggregatesFilter<$PrismaModel> | Status
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumStatusFilter<$PrismaModel>
    _max?: NestedEnumStatusFilter<$PrismaModel>
  }

  export type EnumOrderStatusFilter<$PrismaModel = never> = {
    equals?: OrderStatus | EnumOrderStatusFieldRefInput<$PrismaModel>
    in?: OrderStatus[] | ListEnumOrderStatusFieldRefInput<$PrismaModel>
    notIn?: OrderStatus[] | ListEnumOrderStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderStatusFilter<$PrismaModel> | OrderStatus
  }

  export type OrderCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    total?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type OrderAvgOrderByAggregateInput = {
    total?: SortOrder
  }

  export type OrderMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    total?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type OrderMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    total?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type OrderSumOrderByAggregateInput = {
    total?: SortOrder
  }

  export type EnumOrderStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: OrderStatus | EnumOrderStatusFieldRefInput<$PrismaModel>
    in?: OrderStatus[] | ListEnumOrderStatusFieldRefInput<$PrismaModel>
    notIn?: OrderStatus[] | ListEnumOrderStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderStatusWithAggregatesFilter<$PrismaModel> | OrderStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumOrderStatusFilter<$PrismaModel>
    _max?: NestedEnumOrderStatusFilter<$PrismaModel>
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type OrderRelationFilter = {
    is?: OrderWhereInput
    isNot?: OrderWhereInput
  }

  export type ProductRelationFilter = {
    is?: ProductWhereInput
    isNot?: ProductWhereInput
  }

  export type OrderItemCountOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    productId?: SortOrder
    quantity?: SortOrder
    price?: SortOrder
  }

  export type OrderItemAvgOrderByAggregateInput = {
    quantity?: SortOrder
    price?: SortOrder
  }

  export type OrderItemMaxOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    productId?: SortOrder
    quantity?: SortOrder
    price?: SortOrder
  }

  export type OrderItemMinOrderByAggregateInput = {
    id?: SortOrder
    orderId?: SortOrder
    productId?: SortOrder
    quantity?: SortOrder
    price?: SortOrder
  }

  export type OrderItemSumOrderByAggregateInput = {
    quantity?: SortOrder
    price?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type CartCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
  }

  export type CartMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
  }

  export type CartMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
  }

  export type CartRelationFilter = {
    is?: CartWhereInput
    isNot?: CartWhereInput
  }

  export type CartItemCountOrderByAggregateInput = {
    id?: SortOrder
    cartId?: SortOrder
    productId?: SortOrder
    quantity?: SortOrder
  }

  export type CartItemAvgOrderByAggregateInput = {
    quantity?: SortOrder
  }

  export type CartItemMaxOrderByAggregateInput = {
    id?: SortOrder
    cartId?: SortOrder
    productId?: SortOrder
    quantity?: SortOrder
  }

  export type CartItemMinOrderByAggregateInput = {
    id?: SortOrder
    cartId?: SortOrder
    productId?: SortOrder
    quantity?: SortOrder
  }

  export type CartItemSumOrderByAggregateInput = {
    quantity?: SortOrder
  }

  export type EnumConfigStatusFilter<$PrismaModel = never> = {
    equals?: ConfigStatus | EnumConfigStatusFieldRefInput<$PrismaModel>
    in?: ConfigStatus[] | ListEnumConfigStatusFieldRefInput<$PrismaModel>
    notIn?: ConfigStatus[] | ListEnumConfigStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumConfigStatusFilter<$PrismaModel> | ConfigStatus
  }

  export type ProductNullableRelationFilter = {
    is?: ProductWhereInput | null
    isNot?: ProductWhereInput | null
  }

  export type MCPConfigurationCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    configData?: SortOrder
    status?: SortOrder
    userId?: SortOrder
    productId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MCPConfigurationMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    status?: SortOrder
    userId?: SortOrder
    productId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type MCPConfigurationMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    status?: SortOrder
    userId?: SortOrder
    productId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumConfigStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: ConfigStatus | EnumConfigStatusFieldRefInput<$PrismaModel>
    in?: ConfigStatus[] | ListEnumConfigStatusFieldRefInput<$PrismaModel>
    notIn?: ConfigStatus[] | ListEnumConfigStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumConfigStatusWithAggregatesFilter<$PrismaModel> | ConfigStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumConfigStatusFilter<$PrismaModel>
    _max?: NestedEnumConfigStatusFilter<$PrismaModel>
  }

  export type ModuleOnClientCreateNestedManyWithoutClientInput = {
    create?: XOR<ModuleOnClientCreateWithoutClientInput, ModuleOnClientUncheckedCreateWithoutClientInput> | ModuleOnClientCreateWithoutClientInput[] | ModuleOnClientUncheckedCreateWithoutClientInput[]
    connectOrCreate?: ModuleOnClientCreateOrConnectWithoutClientInput | ModuleOnClientCreateOrConnectWithoutClientInput[]
    createMany?: ModuleOnClientCreateManyClientInputEnvelope
    connect?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
  }

  export type EnvironmentVariableCreateNestedManyWithoutClientInput = {
    create?: XOR<EnvironmentVariableCreateWithoutClientInput, EnvironmentVariableUncheckedCreateWithoutClientInput> | EnvironmentVariableCreateWithoutClientInput[] | EnvironmentVariableUncheckedCreateWithoutClientInput[]
    connectOrCreate?: EnvironmentVariableCreateOrConnectWithoutClientInput | EnvironmentVariableCreateOrConnectWithoutClientInput[]
    createMany?: EnvironmentVariableCreateManyClientInputEnvelope
    connect?: EnvironmentVariableWhereUniqueInput | EnvironmentVariableWhereUniqueInput[]
  }

  export type ModuleOnClientUncheckedCreateNestedManyWithoutClientInput = {
    create?: XOR<ModuleOnClientCreateWithoutClientInput, ModuleOnClientUncheckedCreateWithoutClientInput> | ModuleOnClientCreateWithoutClientInput[] | ModuleOnClientUncheckedCreateWithoutClientInput[]
    connectOrCreate?: ModuleOnClientCreateOrConnectWithoutClientInput | ModuleOnClientCreateOrConnectWithoutClientInput[]
    createMany?: ModuleOnClientCreateManyClientInputEnvelope
    connect?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
  }

  export type EnvironmentVariableUncheckedCreateNestedManyWithoutClientInput = {
    create?: XOR<EnvironmentVariableCreateWithoutClientInput, EnvironmentVariableUncheckedCreateWithoutClientInput> | EnvironmentVariableCreateWithoutClientInput[] | EnvironmentVariableUncheckedCreateWithoutClientInput[]
    connectOrCreate?: EnvironmentVariableCreateOrConnectWithoutClientInput | EnvironmentVariableCreateOrConnectWithoutClientInput[]
    createMany?: EnvironmentVariableCreateManyClientInputEnvelope
    connect?: EnvironmentVariableWhereUniqueInput | EnvironmentVariableWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type ModuleOnClientUpdateManyWithoutClientNestedInput = {
    create?: XOR<ModuleOnClientCreateWithoutClientInput, ModuleOnClientUncheckedCreateWithoutClientInput> | ModuleOnClientCreateWithoutClientInput[] | ModuleOnClientUncheckedCreateWithoutClientInput[]
    connectOrCreate?: ModuleOnClientCreateOrConnectWithoutClientInput | ModuleOnClientCreateOrConnectWithoutClientInput[]
    upsert?: ModuleOnClientUpsertWithWhereUniqueWithoutClientInput | ModuleOnClientUpsertWithWhereUniqueWithoutClientInput[]
    createMany?: ModuleOnClientCreateManyClientInputEnvelope
    set?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    disconnect?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    delete?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    connect?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    update?: ModuleOnClientUpdateWithWhereUniqueWithoutClientInput | ModuleOnClientUpdateWithWhereUniqueWithoutClientInput[]
    updateMany?: ModuleOnClientUpdateManyWithWhereWithoutClientInput | ModuleOnClientUpdateManyWithWhereWithoutClientInput[]
    deleteMany?: ModuleOnClientScalarWhereInput | ModuleOnClientScalarWhereInput[]
  }

  export type EnvironmentVariableUpdateManyWithoutClientNestedInput = {
    create?: XOR<EnvironmentVariableCreateWithoutClientInput, EnvironmentVariableUncheckedCreateWithoutClientInput> | EnvironmentVariableCreateWithoutClientInput[] | EnvironmentVariableUncheckedCreateWithoutClientInput[]
    connectOrCreate?: EnvironmentVariableCreateOrConnectWithoutClientInput | EnvironmentVariableCreateOrConnectWithoutClientInput[]
    upsert?: EnvironmentVariableUpsertWithWhereUniqueWithoutClientInput | EnvironmentVariableUpsertWithWhereUniqueWithoutClientInput[]
    createMany?: EnvironmentVariableCreateManyClientInputEnvelope
    set?: EnvironmentVariableWhereUniqueInput | EnvironmentVariableWhereUniqueInput[]
    disconnect?: EnvironmentVariableWhereUniqueInput | EnvironmentVariableWhereUniqueInput[]
    delete?: EnvironmentVariableWhereUniqueInput | EnvironmentVariableWhereUniqueInput[]
    connect?: EnvironmentVariableWhereUniqueInput | EnvironmentVariableWhereUniqueInput[]
    update?: EnvironmentVariableUpdateWithWhereUniqueWithoutClientInput | EnvironmentVariableUpdateWithWhereUniqueWithoutClientInput[]
    updateMany?: EnvironmentVariableUpdateManyWithWhereWithoutClientInput | EnvironmentVariableUpdateManyWithWhereWithoutClientInput[]
    deleteMany?: EnvironmentVariableScalarWhereInput | EnvironmentVariableScalarWhereInput[]
  }

  export type ModuleOnClientUncheckedUpdateManyWithoutClientNestedInput = {
    create?: XOR<ModuleOnClientCreateWithoutClientInput, ModuleOnClientUncheckedCreateWithoutClientInput> | ModuleOnClientCreateWithoutClientInput[] | ModuleOnClientUncheckedCreateWithoutClientInput[]
    connectOrCreate?: ModuleOnClientCreateOrConnectWithoutClientInput | ModuleOnClientCreateOrConnectWithoutClientInput[]
    upsert?: ModuleOnClientUpsertWithWhereUniqueWithoutClientInput | ModuleOnClientUpsertWithWhereUniqueWithoutClientInput[]
    createMany?: ModuleOnClientCreateManyClientInputEnvelope
    set?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    disconnect?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    delete?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    connect?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    update?: ModuleOnClientUpdateWithWhereUniqueWithoutClientInput | ModuleOnClientUpdateWithWhereUniqueWithoutClientInput[]
    updateMany?: ModuleOnClientUpdateManyWithWhereWithoutClientInput | ModuleOnClientUpdateManyWithWhereWithoutClientInput[]
    deleteMany?: ModuleOnClientScalarWhereInput | ModuleOnClientScalarWhereInput[]
  }

  export type EnvironmentVariableUncheckedUpdateManyWithoutClientNestedInput = {
    create?: XOR<EnvironmentVariableCreateWithoutClientInput, EnvironmentVariableUncheckedCreateWithoutClientInput> | EnvironmentVariableCreateWithoutClientInput[] | EnvironmentVariableUncheckedCreateWithoutClientInput[]
    connectOrCreate?: EnvironmentVariableCreateOrConnectWithoutClientInput | EnvironmentVariableCreateOrConnectWithoutClientInput[]
    upsert?: EnvironmentVariableUpsertWithWhereUniqueWithoutClientInput | EnvironmentVariableUpsertWithWhereUniqueWithoutClientInput[]
    createMany?: EnvironmentVariableCreateManyClientInputEnvelope
    set?: EnvironmentVariableWhereUniqueInput | EnvironmentVariableWhereUniqueInput[]
    disconnect?: EnvironmentVariableWhereUniqueInput | EnvironmentVariableWhereUniqueInput[]
    delete?: EnvironmentVariableWhereUniqueInput | EnvironmentVariableWhereUniqueInput[]
    connect?: EnvironmentVariableWhereUniqueInput | EnvironmentVariableWhereUniqueInput[]
    update?: EnvironmentVariableUpdateWithWhereUniqueWithoutClientInput | EnvironmentVariableUpdateWithWhereUniqueWithoutClientInput[]
    updateMany?: EnvironmentVariableUpdateManyWithWhereWithoutClientInput | EnvironmentVariableUpdateManyWithWhereWithoutClientInput[]
    deleteMany?: EnvironmentVariableScalarWhereInput | EnvironmentVariableScalarWhereInput[]
  }

  export type ModuleOnClientCreateNestedManyWithoutModuleInput = {
    create?: XOR<ModuleOnClientCreateWithoutModuleInput, ModuleOnClientUncheckedCreateWithoutModuleInput> | ModuleOnClientCreateWithoutModuleInput[] | ModuleOnClientUncheckedCreateWithoutModuleInput[]
    connectOrCreate?: ModuleOnClientCreateOrConnectWithoutModuleInput | ModuleOnClientCreateOrConnectWithoutModuleInput[]
    createMany?: ModuleOnClientCreateManyModuleInputEnvelope
    connect?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
  }

  export type ModuleOnClientUncheckedCreateNestedManyWithoutModuleInput = {
    create?: XOR<ModuleOnClientCreateWithoutModuleInput, ModuleOnClientUncheckedCreateWithoutModuleInput> | ModuleOnClientCreateWithoutModuleInput[] | ModuleOnClientUncheckedCreateWithoutModuleInput[]
    connectOrCreate?: ModuleOnClientCreateOrConnectWithoutModuleInput | ModuleOnClientCreateOrConnectWithoutModuleInput[]
    createMany?: ModuleOnClientCreateManyModuleInputEnvelope
    connect?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
  }

  export type ModuleOnClientUpdateManyWithoutModuleNestedInput = {
    create?: XOR<ModuleOnClientCreateWithoutModuleInput, ModuleOnClientUncheckedCreateWithoutModuleInput> | ModuleOnClientCreateWithoutModuleInput[] | ModuleOnClientUncheckedCreateWithoutModuleInput[]
    connectOrCreate?: ModuleOnClientCreateOrConnectWithoutModuleInput | ModuleOnClientCreateOrConnectWithoutModuleInput[]
    upsert?: ModuleOnClientUpsertWithWhereUniqueWithoutModuleInput | ModuleOnClientUpsertWithWhereUniqueWithoutModuleInput[]
    createMany?: ModuleOnClientCreateManyModuleInputEnvelope
    set?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    disconnect?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    delete?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    connect?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    update?: ModuleOnClientUpdateWithWhereUniqueWithoutModuleInput | ModuleOnClientUpdateWithWhereUniqueWithoutModuleInput[]
    updateMany?: ModuleOnClientUpdateManyWithWhereWithoutModuleInput | ModuleOnClientUpdateManyWithWhereWithoutModuleInput[]
    deleteMany?: ModuleOnClientScalarWhereInput | ModuleOnClientScalarWhereInput[]
  }

  export type ModuleOnClientUncheckedUpdateManyWithoutModuleNestedInput = {
    create?: XOR<ModuleOnClientCreateWithoutModuleInput, ModuleOnClientUncheckedCreateWithoutModuleInput> | ModuleOnClientCreateWithoutModuleInput[] | ModuleOnClientUncheckedCreateWithoutModuleInput[]
    connectOrCreate?: ModuleOnClientCreateOrConnectWithoutModuleInput | ModuleOnClientCreateOrConnectWithoutModuleInput[]
    upsert?: ModuleOnClientUpsertWithWhereUniqueWithoutModuleInput | ModuleOnClientUpsertWithWhereUniqueWithoutModuleInput[]
    createMany?: ModuleOnClientCreateManyModuleInputEnvelope
    set?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    disconnect?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    delete?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    connect?: ModuleOnClientWhereUniqueInput | ModuleOnClientWhereUniqueInput[]
    update?: ModuleOnClientUpdateWithWhereUniqueWithoutModuleInput | ModuleOnClientUpdateWithWhereUniqueWithoutModuleInput[]
    updateMany?: ModuleOnClientUpdateManyWithWhereWithoutModuleInput | ModuleOnClientUpdateManyWithWhereWithoutModuleInput[]
    deleteMany?: ModuleOnClientScalarWhereInput | ModuleOnClientScalarWhereInput[]
  }

  export type ClientCreateNestedOneWithoutModulesInput = {
    create?: XOR<ClientCreateWithoutModulesInput, ClientUncheckedCreateWithoutModulesInput>
    connectOrCreate?: ClientCreateOrConnectWithoutModulesInput
    connect?: ClientWhereUniqueInput
  }

  export type ModuleCreateNestedOneWithoutClientsInput = {
    create?: XOR<ModuleCreateWithoutClientsInput, ModuleUncheckedCreateWithoutClientsInput>
    connectOrCreate?: ModuleCreateOrConnectWithoutClientsInput
    connect?: ModuleWhereUniqueInput
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type ClientUpdateOneRequiredWithoutModulesNestedInput = {
    create?: XOR<ClientCreateWithoutModulesInput, ClientUncheckedCreateWithoutModulesInput>
    connectOrCreate?: ClientCreateOrConnectWithoutModulesInput
    upsert?: ClientUpsertWithoutModulesInput
    connect?: ClientWhereUniqueInput
    update?: XOR<XOR<ClientUpdateToOneWithWhereWithoutModulesInput, ClientUpdateWithoutModulesInput>, ClientUncheckedUpdateWithoutModulesInput>
  }

  export type ModuleUpdateOneRequiredWithoutClientsNestedInput = {
    create?: XOR<ModuleCreateWithoutClientsInput, ModuleUncheckedCreateWithoutClientsInput>
    connectOrCreate?: ModuleCreateOrConnectWithoutClientsInput
    upsert?: ModuleUpsertWithoutClientsInput
    connect?: ModuleWhereUniqueInput
    update?: XOR<XOR<ModuleUpdateToOneWithWhereWithoutClientsInput, ModuleUpdateWithoutClientsInput>, ModuleUncheckedUpdateWithoutClientsInput>
  }

  export type ClientCreateNestedOneWithoutEnvironmentVariablesInput = {
    create?: XOR<ClientCreateWithoutEnvironmentVariablesInput, ClientUncheckedCreateWithoutEnvironmentVariablesInput>
    connectOrCreate?: ClientCreateOrConnectWithoutEnvironmentVariablesInput
    connect?: ClientWhereUniqueInput
  }

  export type EnumEnvironmentFieldUpdateOperationsInput = {
    set?: Environment
  }

  export type ClientUpdateOneRequiredWithoutEnvironmentVariablesNestedInput = {
    create?: XOR<ClientCreateWithoutEnvironmentVariablesInput, ClientUncheckedCreateWithoutEnvironmentVariablesInput>
    connectOrCreate?: ClientCreateOrConnectWithoutEnvironmentVariablesInput
    upsert?: ClientUpsertWithoutEnvironmentVariablesInput
    connect?: ClientWhereUniqueInput
    update?: XOR<XOR<ClientUpdateToOneWithWhereWithoutEnvironmentVariablesInput, ClientUpdateWithoutEnvironmentVariablesInput>, ClientUncheckedUpdateWithoutEnvironmentVariablesInput>
  }

  export type OrderCreateNestedManyWithoutUserInput = {
    create?: XOR<OrderCreateWithoutUserInput, OrderUncheckedCreateWithoutUserInput> | OrderCreateWithoutUserInput[] | OrderUncheckedCreateWithoutUserInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutUserInput | OrderCreateOrConnectWithoutUserInput[]
    createMany?: OrderCreateManyUserInputEnvelope
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
  }

  export type CartCreateNestedOneWithoutUserInput = {
    create?: XOR<CartCreateWithoutUserInput, CartUncheckedCreateWithoutUserInput>
    connectOrCreate?: CartCreateOrConnectWithoutUserInput
    connect?: CartWhereUniqueInput
  }

  export type MCPConfigurationCreateNestedManyWithoutUserInput = {
    create?: XOR<MCPConfigurationCreateWithoutUserInput, MCPConfigurationUncheckedCreateWithoutUserInput> | MCPConfigurationCreateWithoutUserInput[] | MCPConfigurationUncheckedCreateWithoutUserInput[]
    connectOrCreate?: MCPConfigurationCreateOrConnectWithoutUserInput | MCPConfigurationCreateOrConnectWithoutUserInput[]
    createMany?: MCPConfigurationCreateManyUserInputEnvelope
    connect?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
  }

  export type ProductCreateNestedManyWithoutSellerInput = {
    create?: XOR<ProductCreateWithoutSellerInput, ProductUncheckedCreateWithoutSellerInput> | ProductCreateWithoutSellerInput[] | ProductUncheckedCreateWithoutSellerInput[]
    connectOrCreate?: ProductCreateOrConnectWithoutSellerInput | ProductCreateOrConnectWithoutSellerInput[]
    createMany?: ProductCreateManySellerInputEnvelope
    connect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
  }

  export type OrderUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<OrderCreateWithoutUserInput, OrderUncheckedCreateWithoutUserInput> | OrderCreateWithoutUserInput[] | OrderUncheckedCreateWithoutUserInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutUserInput | OrderCreateOrConnectWithoutUserInput[]
    createMany?: OrderCreateManyUserInputEnvelope
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
  }

  export type CartUncheckedCreateNestedOneWithoutUserInput = {
    create?: XOR<CartCreateWithoutUserInput, CartUncheckedCreateWithoutUserInput>
    connectOrCreate?: CartCreateOrConnectWithoutUserInput
    connect?: CartWhereUniqueInput
  }

  export type MCPConfigurationUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<MCPConfigurationCreateWithoutUserInput, MCPConfigurationUncheckedCreateWithoutUserInput> | MCPConfigurationCreateWithoutUserInput[] | MCPConfigurationUncheckedCreateWithoutUserInput[]
    connectOrCreate?: MCPConfigurationCreateOrConnectWithoutUserInput | MCPConfigurationCreateOrConnectWithoutUserInput[]
    createMany?: MCPConfigurationCreateManyUserInputEnvelope
    connect?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
  }

  export type ProductUncheckedCreateNestedManyWithoutSellerInput = {
    create?: XOR<ProductCreateWithoutSellerInput, ProductUncheckedCreateWithoutSellerInput> | ProductCreateWithoutSellerInput[] | ProductUncheckedCreateWithoutSellerInput[]
    connectOrCreate?: ProductCreateOrConnectWithoutSellerInput | ProductCreateOrConnectWithoutSellerInput[]
    createMany?: ProductCreateManySellerInputEnvelope
    connect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
  }

  export type EnumRoleFieldUpdateOperationsInput = {
    set?: Role
  }

  export type OrderUpdateManyWithoutUserNestedInput = {
    create?: XOR<OrderCreateWithoutUserInput, OrderUncheckedCreateWithoutUserInput> | OrderCreateWithoutUserInput[] | OrderUncheckedCreateWithoutUserInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutUserInput | OrderCreateOrConnectWithoutUserInput[]
    upsert?: OrderUpsertWithWhereUniqueWithoutUserInput | OrderUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: OrderCreateManyUserInputEnvelope
    set?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    disconnect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    delete?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    update?: OrderUpdateWithWhereUniqueWithoutUserInput | OrderUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: OrderUpdateManyWithWhereWithoutUserInput | OrderUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: OrderScalarWhereInput | OrderScalarWhereInput[]
  }

  export type CartUpdateOneWithoutUserNestedInput = {
    create?: XOR<CartCreateWithoutUserInput, CartUncheckedCreateWithoutUserInput>
    connectOrCreate?: CartCreateOrConnectWithoutUserInput
    upsert?: CartUpsertWithoutUserInput
    disconnect?: CartWhereInput | boolean
    delete?: CartWhereInput | boolean
    connect?: CartWhereUniqueInput
    update?: XOR<XOR<CartUpdateToOneWithWhereWithoutUserInput, CartUpdateWithoutUserInput>, CartUncheckedUpdateWithoutUserInput>
  }

  export type MCPConfigurationUpdateManyWithoutUserNestedInput = {
    create?: XOR<MCPConfigurationCreateWithoutUserInput, MCPConfigurationUncheckedCreateWithoutUserInput> | MCPConfigurationCreateWithoutUserInput[] | MCPConfigurationUncheckedCreateWithoutUserInput[]
    connectOrCreate?: MCPConfigurationCreateOrConnectWithoutUserInput | MCPConfigurationCreateOrConnectWithoutUserInput[]
    upsert?: MCPConfigurationUpsertWithWhereUniqueWithoutUserInput | MCPConfigurationUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: MCPConfigurationCreateManyUserInputEnvelope
    set?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    disconnect?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    delete?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    connect?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    update?: MCPConfigurationUpdateWithWhereUniqueWithoutUserInput | MCPConfigurationUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: MCPConfigurationUpdateManyWithWhereWithoutUserInput | MCPConfigurationUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: MCPConfigurationScalarWhereInput | MCPConfigurationScalarWhereInput[]
  }

  export type ProductUpdateManyWithoutSellerNestedInput = {
    create?: XOR<ProductCreateWithoutSellerInput, ProductUncheckedCreateWithoutSellerInput> | ProductCreateWithoutSellerInput[] | ProductUncheckedCreateWithoutSellerInput[]
    connectOrCreate?: ProductCreateOrConnectWithoutSellerInput | ProductCreateOrConnectWithoutSellerInput[]
    upsert?: ProductUpsertWithWhereUniqueWithoutSellerInput | ProductUpsertWithWhereUniqueWithoutSellerInput[]
    createMany?: ProductCreateManySellerInputEnvelope
    set?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    disconnect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    delete?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    connect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    update?: ProductUpdateWithWhereUniqueWithoutSellerInput | ProductUpdateWithWhereUniqueWithoutSellerInput[]
    updateMany?: ProductUpdateManyWithWhereWithoutSellerInput | ProductUpdateManyWithWhereWithoutSellerInput[]
    deleteMany?: ProductScalarWhereInput | ProductScalarWhereInput[]
  }

  export type OrderUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<OrderCreateWithoutUserInput, OrderUncheckedCreateWithoutUserInput> | OrderCreateWithoutUserInput[] | OrderUncheckedCreateWithoutUserInput[]
    connectOrCreate?: OrderCreateOrConnectWithoutUserInput | OrderCreateOrConnectWithoutUserInput[]
    upsert?: OrderUpsertWithWhereUniqueWithoutUserInput | OrderUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: OrderCreateManyUserInputEnvelope
    set?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    disconnect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    delete?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    connect?: OrderWhereUniqueInput | OrderWhereUniqueInput[]
    update?: OrderUpdateWithWhereUniqueWithoutUserInput | OrderUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: OrderUpdateManyWithWhereWithoutUserInput | OrderUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: OrderScalarWhereInput | OrderScalarWhereInput[]
  }

  export type CartUncheckedUpdateOneWithoutUserNestedInput = {
    create?: XOR<CartCreateWithoutUserInput, CartUncheckedCreateWithoutUserInput>
    connectOrCreate?: CartCreateOrConnectWithoutUserInput
    upsert?: CartUpsertWithoutUserInput
    disconnect?: CartWhereInput | boolean
    delete?: CartWhereInput | boolean
    connect?: CartWhereUniqueInput
    update?: XOR<XOR<CartUpdateToOneWithWhereWithoutUserInput, CartUpdateWithoutUserInput>, CartUncheckedUpdateWithoutUserInput>
  }

  export type MCPConfigurationUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<MCPConfigurationCreateWithoutUserInput, MCPConfigurationUncheckedCreateWithoutUserInput> | MCPConfigurationCreateWithoutUserInput[] | MCPConfigurationUncheckedCreateWithoutUserInput[]
    connectOrCreate?: MCPConfigurationCreateOrConnectWithoutUserInput | MCPConfigurationCreateOrConnectWithoutUserInput[]
    upsert?: MCPConfigurationUpsertWithWhereUniqueWithoutUserInput | MCPConfigurationUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: MCPConfigurationCreateManyUserInputEnvelope
    set?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    disconnect?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    delete?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    connect?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    update?: MCPConfigurationUpdateWithWhereUniqueWithoutUserInput | MCPConfigurationUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: MCPConfigurationUpdateManyWithWhereWithoutUserInput | MCPConfigurationUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: MCPConfigurationScalarWhereInput | MCPConfigurationScalarWhereInput[]
  }

  export type ProductUncheckedUpdateManyWithoutSellerNestedInput = {
    create?: XOR<ProductCreateWithoutSellerInput, ProductUncheckedCreateWithoutSellerInput> | ProductCreateWithoutSellerInput[] | ProductUncheckedCreateWithoutSellerInput[]
    connectOrCreate?: ProductCreateOrConnectWithoutSellerInput | ProductCreateOrConnectWithoutSellerInput[]
    upsert?: ProductUpsertWithWhereUniqueWithoutSellerInput | ProductUpsertWithWhereUniqueWithoutSellerInput[]
    createMany?: ProductCreateManySellerInputEnvelope
    set?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    disconnect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    delete?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    connect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    update?: ProductUpdateWithWhereUniqueWithoutSellerInput | ProductUpdateWithWhereUniqueWithoutSellerInput[]
    updateMany?: ProductUpdateManyWithWhereWithoutSellerInput | ProductUpdateManyWithWhereWithoutSellerInput[]
    deleteMany?: ProductScalarWhereInput | ProductScalarWhereInput[]
  }

  export type ProductCreateNestedManyWithoutCategoryInput = {
    create?: XOR<ProductCreateWithoutCategoryInput, ProductUncheckedCreateWithoutCategoryInput> | ProductCreateWithoutCategoryInput[] | ProductUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: ProductCreateOrConnectWithoutCategoryInput | ProductCreateOrConnectWithoutCategoryInput[]
    createMany?: ProductCreateManyCategoryInputEnvelope
    connect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
  }

  export type ProductUncheckedCreateNestedManyWithoutCategoryInput = {
    create?: XOR<ProductCreateWithoutCategoryInput, ProductUncheckedCreateWithoutCategoryInput> | ProductCreateWithoutCategoryInput[] | ProductUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: ProductCreateOrConnectWithoutCategoryInput | ProductCreateOrConnectWithoutCategoryInput[]
    createMany?: ProductCreateManyCategoryInputEnvelope
    connect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
  }

  export type ProductUpdateManyWithoutCategoryNestedInput = {
    create?: XOR<ProductCreateWithoutCategoryInput, ProductUncheckedCreateWithoutCategoryInput> | ProductCreateWithoutCategoryInput[] | ProductUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: ProductCreateOrConnectWithoutCategoryInput | ProductCreateOrConnectWithoutCategoryInput[]
    upsert?: ProductUpsertWithWhereUniqueWithoutCategoryInput | ProductUpsertWithWhereUniqueWithoutCategoryInput[]
    createMany?: ProductCreateManyCategoryInputEnvelope
    set?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    disconnect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    delete?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    connect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    update?: ProductUpdateWithWhereUniqueWithoutCategoryInput | ProductUpdateWithWhereUniqueWithoutCategoryInput[]
    updateMany?: ProductUpdateManyWithWhereWithoutCategoryInput | ProductUpdateManyWithWhereWithoutCategoryInput[]
    deleteMany?: ProductScalarWhereInput | ProductScalarWhereInput[]
  }

  export type ProductUncheckedUpdateManyWithoutCategoryNestedInput = {
    create?: XOR<ProductCreateWithoutCategoryInput, ProductUncheckedCreateWithoutCategoryInput> | ProductCreateWithoutCategoryInput[] | ProductUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: ProductCreateOrConnectWithoutCategoryInput | ProductCreateOrConnectWithoutCategoryInput[]
    upsert?: ProductUpsertWithWhereUniqueWithoutCategoryInput | ProductUpsertWithWhereUniqueWithoutCategoryInput[]
    createMany?: ProductCreateManyCategoryInputEnvelope
    set?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    disconnect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    delete?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    connect?: ProductWhereUniqueInput | ProductWhereUniqueInput[]
    update?: ProductUpdateWithWhereUniqueWithoutCategoryInput | ProductUpdateWithWhereUniqueWithoutCategoryInput[]
    updateMany?: ProductUpdateManyWithWhereWithoutCategoryInput | ProductUpdateManyWithWhereWithoutCategoryInput[]
    deleteMany?: ProductScalarWhereInput | ProductScalarWhereInput[]
  }

  export type CategoryCreateNestedOneWithoutProductsInput = {
    create?: XOR<CategoryCreateWithoutProductsInput, CategoryUncheckedCreateWithoutProductsInput>
    connectOrCreate?: CategoryCreateOrConnectWithoutProductsInput
    connect?: CategoryWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutProductsInput = {
    create?: XOR<UserCreateWithoutProductsInput, UserUncheckedCreateWithoutProductsInput>
    connectOrCreate?: UserCreateOrConnectWithoutProductsInput
    connect?: UserWhereUniqueInput
  }

  export type OrderItemCreateNestedManyWithoutProductInput = {
    create?: XOR<OrderItemCreateWithoutProductInput, OrderItemUncheckedCreateWithoutProductInput> | OrderItemCreateWithoutProductInput[] | OrderItemUncheckedCreateWithoutProductInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutProductInput | OrderItemCreateOrConnectWithoutProductInput[]
    createMany?: OrderItemCreateManyProductInputEnvelope
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
  }

  export type MCPConfigurationCreateNestedManyWithoutProductInput = {
    create?: XOR<MCPConfigurationCreateWithoutProductInput, MCPConfigurationUncheckedCreateWithoutProductInput> | MCPConfigurationCreateWithoutProductInput[] | MCPConfigurationUncheckedCreateWithoutProductInput[]
    connectOrCreate?: MCPConfigurationCreateOrConnectWithoutProductInput | MCPConfigurationCreateOrConnectWithoutProductInput[]
    createMany?: MCPConfigurationCreateManyProductInputEnvelope
    connect?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
  }

  export type CartItemCreateNestedManyWithoutProductInput = {
    create?: XOR<CartItemCreateWithoutProductInput, CartItemUncheckedCreateWithoutProductInput> | CartItemCreateWithoutProductInput[] | CartItemUncheckedCreateWithoutProductInput[]
    connectOrCreate?: CartItemCreateOrConnectWithoutProductInput | CartItemCreateOrConnectWithoutProductInput[]
    createMany?: CartItemCreateManyProductInputEnvelope
    connect?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
  }

  export type OrderItemUncheckedCreateNestedManyWithoutProductInput = {
    create?: XOR<OrderItemCreateWithoutProductInput, OrderItemUncheckedCreateWithoutProductInput> | OrderItemCreateWithoutProductInput[] | OrderItemUncheckedCreateWithoutProductInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutProductInput | OrderItemCreateOrConnectWithoutProductInput[]
    createMany?: OrderItemCreateManyProductInputEnvelope
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
  }

  export type MCPConfigurationUncheckedCreateNestedManyWithoutProductInput = {
    create?: XOR<MCPConfigurationCreateWithoutProductInput, MCPConfigurationUncheckedCreateWithoutProductInput> | MCPConfigurationCreateWithoutProductInput[] | MCPConfigurationUncheckedCreateWithoutProductInput[]
    connectOrCreate?: MCPConfigurationCreateOrConnectWithoutProductInput | MCPConfigurationCreateOrConnectWithoutProductInput[]
    createMany?: MCPConfigurationCreateManyProductInputEnvelope
    connect?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
  }

  export type CartItemUncheckedCreateNestedManyWithoutProductInput = {
    create?: XOR<CartItemCreateWithoutProductInput, CartItemUncheckedCreateWithoutProductInput> | CartItemCreateWithoutProductInput[] | CartItemUncheckedCreateWithoutProductInput[]
    connectOrCreate?: CartItemCreateOrConnectWithoutProductInput | CartItemCreateOrConnectWithoutProductInput[]
    createMany?: CartItemCreateManyProductInputEnvelope
    connect?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type EnumStatusFieldUpdateOperationsInput = {
    set?: Status
  }

  export type CategoryUpdateOneRequiredWithoutProductsNestedInput = {
    create?: XOR<CategoryCreateWithoutProductsInput, CategoryUncheckedCreateWithoutProductsInput>
    connectOrCreate?: CategoryCreateOrConnectWithoutProductsInput
    upsert?: CategoryUpsertWithoutProductsInput
    connect?: CategoryWhereUniqueInput
    update?: XOR<XOR<CategoryUpdateToOneWithWhereWithoutProductsInput, CategoryUpdateWithoutProductsInput>, CategoryUncheckedUpdateWithoutProductsInput>
  }

  export type UserUpdateOneRequiredWithoutProductsNestedInput = {
    create?: XOR<UserCreateWithoutProductsInput, UserUncheckedCreateWithoutProductsInput>
    connectOrCreate?: UserCreateOrConnectWithoutProductsInput
    upsert?: UserUpsertWithoutProductsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutProductsInput, UserUpdateWithoutProductsInput>, UserUncheckedUpdateWithoutProductsInput>
  }

  export type OrderItemUpdateManyWithoutProductNestedInput = {
    create?: XOR<OrderItemCreateWithoutProductInput, OrderItemUncheckedCreateWithoutProductInput> | OrderItemCreateWithoutProductInput[] | OrderItemUncheckedCreateWithoutProductInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutProductInput | OrderItemCreateOrConnectWithoutProductInput[]
    upsert?: OrderItemUpsertWithWhereUniqueWithoutProductInput | OrderItemUpsertWithWhereUniqueWithoutProductInput[]
    createMany?: OrderItemCreateManyProductInputEnvelope
    set?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    disconnect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    delete?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    update?: OrderItemUpdateWithWhereUniqueWithoutProductInput | OrderItemUpdateWithWhereUniqueWithoutProductInput[]
    updateMany?: OrderItemUpdateManyWithWhereWithoutProductInput | OrderItemUpdateManyWithWhereWithoutProductInput[]
    deleteMany?: OrderItemScalarWhereInput | OrderItemScalarWhereInput[]
  }

  export type MCPConfigurationUpdateManyWithoutProductNestedInput = {
    create?: XOR<MCPConfigurationCreateWithoutProductInput, MCPConfigurationUncheckedCreateWithoutProductInput> | MCPConfigurationCreateWithoutProductInput[] | MCPConfigurationUncheckedCreateWithoutProductInput[]
    connectOrCreate?: MCPConfigurationCreateOrConnectWithoutProductInput | MCPConfigurationCreateOrConnectWithoutProductInput[]
    upsert?: MCPConfigurationUpsertWithWhereUniqueWithoutProductInput | MCPConfigurationUpsertWithWhereUniqueWithoutProductInput[]
    createMany?: MCPConfigurationCreateManyProductInputEnvelope
    set?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    disconnect?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    delete?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    connect?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    update?: MCPConfigurationUpdateWithWhereUniqueWithoutProductInput | MCPConfigurationUpdateWithWhereUniqueWithoutProductInput[]
    updateMany?: MCPConfigurationUpdateManyWithWhereWithoutProductInput | MCPConfigurationUpdateManyWithWhereWithoutProductInput[]
    deleteMany?: MCPConfigurationScalarWhereInput | MCPConfigurationScalarWhereInput[]
  }

  export type CartItemUpdateManyWithoutProductNestedInput = {
    create?: XOR<CartItemCreateWithoutProductInput, CartItemUncheckedCreateWithoutProductInput> | CartItemCreateWithoutProductInput[] | CartItemUncheckedCreateWithoutProductInput[]
    connectOrCreate?: CartItemCreateOrConnectWithoutProductInput | CartItemCreateOrConnectWithoutProductInput[]
    upsert?: CartItemUpsertWithWhereUniqueWithoutProductInput | CartItemUpsertWithWhereUniqueWithoutProductInput[]
    createMany?: CartItemCreateManyProductInputEnvelope
    set?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    disconnect?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    delete?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    connect?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    update?: CartItemUpdateWithWhereUniqueWithoutProductInput | CartItemUpdateWithWhereUniqueWithoutProductInput[]
    updateMany?: CartItemUpdateManyWithWhereWithoutProductInput | CartItemUpdateManyWithWhereWithoutProductInput[]
    deleteMany?: CartItemScalarWhereInput | CartItemScalarWhereInput[]
  }

  export type OrderItemUncheckedUpdateManyWithoutProductNestedInput = {
    create?: XOR<OrderItemCreateWithoutProductInput, OrderItemUncheckedCreateWithoutProductInput> | OrderItemCreateWithoutProductInput[] | OrderItemUncheckedCreateWithoutProductInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutProductInput | OrderItemCreateOrConnectWithoutProductInput[]
    upsert?: OrderItemUpsertWithWhereUniqueWithoutProductInput | OrderItemUpsertWithWhereUniqueWithoutProductInput[]
    createMany?: OrderItemCreateManyProductInputEnvelope
    set?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    disconnect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    delete?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    update?: OrderItemUpdateWithWhereUniqueWithoutProductInput | OrderItemUpdateWithWhereUniqueWithoutProductInput[]
    updateMany?: OrderItemUpdateManyWithWhereWithoutProductInput | OrderItemUpdateManyWithWhereWithoutProductInput[]
    deleteMany?: OrderItemScalarWhereInput | OrderItemScalarWhereInput[]
  }

  export type MCPConfigurationUncheckedUpdateManyWithoutProductNestedInput = {
    create?: XOR<MCPConfigurationCreateWithoutProductInput, MCPConfigurationUncheckedCreateWithoutProductInput> | MCPConfigurationCreateWithoutProductInput[] | MCPConfigurationUncheckedCreateWithoutProductInput[]
    connectOrCreate?: MCPConfigurationCreateOrConnectWithoutProductInput | MCPConfigurationCreateOrConnectWithoutProductInput[]
    upsert?: MCPConfigurationUpsertWithWhereUniqueWithoutProductInput | MCPConfigurationUpsertWithWhereUniqueWithoutProductInput[]
    createMany?: MCPConfigurationCreateManyProductInputEnvelope
    set?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    disconnect?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    delete?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    connect?: MCPConfigurationWhereUniqueInput | MCPConfigurationWhereUniqueInput[]
    update?: MCPConfigurationUpdateWithWhereUniqueWithoutProductInput | MCPConfigurationUpdateWithWhereUniqueWithoutProductInput[]
    updateMany?: MCPConfigurationUpdateManyWithWhereWithoutProductInput | MCPConfigurationUpdateManyWithWhereWithoutProductInput[]
    deleteMany?: MCPConfigurationScalarWhereInput | MCPConfigurationScalarWhereInput[]
  }

  export type CartItemUncheckedUpdateManyWithoutProductNestedInput = {
    create?: XOR<CartItemCreateWithoutProductInput, CartItemUncheckedCreateWithoutProductInput> | CartItemCreateWithoutProductInput[] | CartItemUncheckedCreateWithoutProductInput[]
    connectOrCreate?: CartItemCreateOrConnectWithoutProductInput | CartItemCreateOrConnectWithoutProductInput[]
    upsert?: CartItemUpsertWithWhereUniqueWithoutProductInput | CartItemUpsertWithWhereUniqueWithoutProductInput[]
    createMany?: CartItemCreateManyProductInputEnvelope
    set?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    disconnect?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    delete?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    connect?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    update?: CartItemUpdateWithWhereUniqueWithoutProductInput | CartItemUpdateWithWhereUniqueWithoutProductInput[]
    updateMany?: CartItemUpdateManyWithWhereWithoutProductInput | CartItemUpdateManyWithWhereWithoutProductInput[]
    deleteMany?: CartItemScalarWhereInput | CartItemScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutOrdersInput = {
    create?: XOR<UserCreateWithoutOrdersInput, UserUncheckedCreateWithoutOrdersInput>
    connectOrCreate?: UserCreateOrConnectWithoutOrdersInput
    connect?: UserWhereUniqueInput
  }

  export type OrderItemCreateNestedManyWithoutOrderInput = {
    create?: XOR<OrderItemCreateWithoutOrderInput, OrderItemUncheckedCreateWithoutOrderInput> | OrderItemCreateWithoutOrderInput[] | OrderItemUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutOrderInput | OrderItemCreateOrConnectWithoutOrderInput[]
    createMany?: OrderItemCreateManyOrderInputEnvelope
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
  }

  export type OrderItemUncheckedCreateNestedManyWithoutOrderInput = {
    create?: XOR<OrderItemCreateWithoutOrderInput, OrderItemUncheckedCreateWithoutOrderInput> | OrderItemCreateWithoutOrderInput[] | OrderItemUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutOrderInput | OrderItemCreateOrConnectWithoutOrderInput[]
    createMany?: OrderItemCreateManyOrderInputEnvelope
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
  }

  export type EnumOrderStatusFieldUpdateOperationsInput = {
    set?: OrderStatus
  }

  export type UserUpdateOneRequiredWithoutOrdersNestedInput = {
    create?: XOR<UserCreateWithoutOrdersInput, UserUncheckedCreateWithoutOrdersInput>
    connectOrCreate?: UserCreateOrConnectWithoutOrdersInput
    upsert?: UserUpsertWithoutOrdersInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutOrdersInput, UserUpdateWithoutOrdersInput>, UserUncheckedUpdateWithoutOrdersInput>
  }

  export type OrderItemUpdateManyWithoutOrderNestedInput = {
    create?: XOR<OrderItemCreateWithoutOrderInput, OrderItemUncheckedCreateWithoutOrderInput> | OrderItemCreateWithoutOrderInput[] | OrderItemUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutOrderInput | OrderItemCreateOrConnectWithoutOrderInput[]
    upsert?: OrderItemUpsertWithWhereUniqueWithoutOrderInput | OrderItemUpsertWithWhereUniqueWithoutOrderInput[]
    createMany?: OrderItemCreateManyOrderInputEnvelope
    set?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    disconnect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    delete?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    update?: OrderItemUpdateWithWhereUniqueWithoutOrderInput | OrderItemUpdateWithWhereUniqueWithoutOrderInput[]
    updateMany?: OrderItemUpdateManyWithWhereWithoutOrderInput | OrderItemUpdateManyWithWhereWithoutOrderInput[]
    deleteMany?: OrderItemScalarWhereInput | OrderItemScalarWhereInput[]
  }

  export type OrderItemUncheckedUpdateManyWithoutOrderNestedInput = {
    create?: XOR<OrderItemCreateWithoutOrderInput, OrderItemUncheckedCreateWithoutOrderInput> | OrderItemCreateWithoutOrderInput[] | OrderItemUncheckedCreateWithoutOrderInput[]
    connectOrCreate?: OrderItemCreateOrConnectWithoutOrderInput | OrderItemCreateOrConnectWithoutOrderInput[]
    upsert?: OrderItemUpsertWithWhereUniqueWithoutOrderInput | OrderItemUpsertWithWhereUniqueWithoutOrderInput[]
    createMany?: OrderItemCreateManyOrderInputEnvelope
    set?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    disconnect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    delete?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    connect?: OrderItemWhereUniqueInput | OrderItemWhereUniqueInput[]
    update?: OrderItemUpdateWithWhereUniqueWithoutOrderInput | OrderItemUpdateWithWhereUniqueWithoutOrderInput[]
    updateMany?: OrderItemUpdateManyWithWhereWithoutOrderInput | OrderItemUpdateManyWithWhereWithoutOrderInput[]
    deleteMany?: OrderItemScalarWhereInput | OrderItemScalarWhereInput[]
  }

  export type OrderCreateNestedOneWithoutItemsInput = {
    create?: XOR<OrderCreateWithoutItemsInput, OrderUncheckedCreateWithoutItemsInput>
    connectOrCreate?: OrderCreateOrConnectWithoutItemsInput
    connect?: OrderWhereUniqueInput
  }

  export type ProductCreateNestedOneWithoutOrderItemsInput = {
    create?: XOR<ProductCreateWithoutOrderItemsInput, ProductUncheckedCreateWithoutOrderItemsInput>
    connectOrCreate?: ProductCreateOrConnectWithoutOrderItemsInput
    connect?: ProductWhereUniqueInput
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type OrderUpdateOneRequiredWithoutItemsNestedInput = {
    create?: XOR<OrderCreateWithoutItemsInput, OrderUncheckedCreateWithoutItemsInput>
    connectOrCreate?: OrderCreateOrConnectWithoutItemsInput
    upsert?: OrderUpsertWithoutItemsInput
    connect?: OrderWhereUniqueInput
    update?: XOR<XOR<OrderUpdateToOneWithWhereWithoutItemsInput, OrderUpdateWithoutItemsInput>, OrderUncheckedUpdateWithoutItemsInput>
  }

  export type ProductUpdateOneRequiredWithoutOrderItemsNestedInput = {
    create?: XOR<ProductCreateWithoutOrderItemsInput, ProductUncheckedCreateWithoutOrderItemsInput>
    connectOrCreate?: ProductCreateOrConnectWithoutOrderItemsInput
    upsert?: ProductUpsertWithoutOrderItemsInput
    connect?: ProductWhereUniqueInput
    update?: XOR<XOR<ProductUpdateToOneWithWhereWithoutOrderItemsInput, ProductUpdateWithoutOrderItemsInput>, ProductUncheckedUpdateWithoutOrderItemsInput>
  }

  export type UserCreateNestedOneWithoutCartInput = {
    create?: XOR<UserCreateWithoutCartInput, UserUncheckedCreateWithoutCartInput>
    connectOrCreate?: UserCreateOrConnectWithoutCartInput
    connect?: UserWhereUniqueInput
  }

  export type CartItemCreateNestedManyWithoutCartInput = {
    create?: XOR<CartItemCreateWithoutCartInput, CartItemUncheckedCreateWithoutCartInput> | CartItemCreateWithoutCartInput[] | CartItemUncheckedCreateWithoutCartInput[]
    connectOrCreate?: CartItemCreateOrConnectWithoutCartInput | CartItemCreateOrConnectWithoutCartInput[]
    createMany?: CartItemCreateManyCartInputEnvelope
    connect?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
  }

  export type CartItemUncheckedCreateNestedManyWithoutCartInput = {
    create?: XOR<CartItemCreateWithoutCartInput, CartItemUncheckedCreateWithoutCartInput> | CartItemCreateWithoutCartInput[] | CartItemUncheckedCreateWithoutCartInput[]
    connectOrCreate?: CartItemCreateOrConnectWithoutCartInput | CartItemCreateOrConnectWithoutCartInput[]
    createMany?: CartItemCreateManyCartInputEnvelope
    connect?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
  }

  export type UserUpdateOneRequiredWithoutCartNestedInput = {
    create?: XOR<UserCreateWithoutCartInput, UserUncheckedCreateWithoutCartInput>
    connectOrCreate?: UserCreateOrConnectWithoutCartInput
    upsert?: UserUpsertWithoutCartInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutCartInput, UserUpdateWithoutCartInput>, UserUncheckedUpdateWithoutCartInput>
  }

  export type CartItemUpdateManyWithoutCartNestedInput = {
    create?: XOR<CartItemCreateWithoutCartInput, CartItemUncheckedCreateWithoutCartInput> | CartItemCreateWithoutCartInput[] | CartItemUncheckedCreateWithoutCartInput[]
    connectOrCreate?: CartItemCreateOrConnectWithoutCartInput | CartItemCreateOrConnectWithoutCartInput[]
    upsert?: CartItemUpsertWithWhereUniqueWithoutCartInput | CartItemUpsertWithWhereUniqueWithoutCartInput[]
    createMany?: CartItemCreateManyCartInputEnvelope
    set?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    disconnect?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    delete?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    connect?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    update?: CartItemUpdateWithWhereUniqueWithoutCartInput | CartItemUpdateWithWhereUniqueWithoutCartInput[]
    updateMany?: CartItemUpdateManyWithWhereWithoutCartInput | CartItemUpdateManyWithWhereWithoutCartInput[]
    deleteMany?: CartItemScalarWhereInput | CartItemScalarWhereInput[]
  }

  export type CartItemUncheckedUpdateManyWithoutCartNestedInput = {
    create?: XOR<CartItemCreateWithoutCartInput, CartItemUncheckedCreateWithoutCartInput> | CartItemCreateWithoutCartInput[] | CartItemUncheckedCreateWithoutCartInput[]
    connectOrCreate?: CartItemCreateOrConnectWithoutCartInput | CartItemCreateOrConnectWithoutCartInput[]
    upsert?: CartItemUpsertWithWhereUniqueWithoutCartInput | CartItemUpsertWithWhereUniqueWithoutCartInput[]
    createMany?: CartItemCreateManyCartInputEnvelope
    set?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    disconnect?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    delete?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    connect?: CartItemWhereUniqueInput | CartItemWhereUniqueInput[]
    update?: CartItemUpdateWithWhereUniqueWithoutCartInput | CartItemUpdateWithWhereUniqueWithoutCartInput[]
    updateMany?: CartItemUpdateManyWithWhereWithoutCartInput | CartItemUpdateManyWithWhereWithoutCartInput[]
    deleteMany?: CartItemScalarWhereInput | CartItemScalarWhereInput[]
  }

  export type CartCreateNestedOneWithoutItemsInput = {
    create?: XOR<CartCreateWithoutItemsInput, CartUncheckedCreateWithoutItemsInput>
    connectOrCreate?: CartCreateOrConnectWithoutItemsInput
    connect?: CartWhereUniqueInput
  }

  export type ProductCreateNestedOneWithoutCartItemsInput = {
    create?: XOR<ProductCreateWithoutCartItemsInput, ProductUncheckedCreateWithoutCartItemsInput>
    connectOrCreate?: ProductCreateOrConnectWithoutCartItemsInput
    connect?: ProductWhereUniqueInput
  }

  export type CartUpdateOneRequiredWithoutItemsNestedInput = {
    create?: XOR<CartCreateWithoutItemsInput, CartUncheckedCreateWithoutItemsInput>
    connectOrCreate?: CartCreateOrConnectWithoutItemsInput
    upsert?: CartUpsertWithoutItemsInput
    connect?: CartWhereUniqueInput
    update?: XOR<XOR<CartUpdateToOneWithWhereWithoutItemsInput, CartUpdateWithoutItemsInput>, CartUncheckedUpdateWithoutItemsInput>
  }

  export type ProductUpdateOneRequiredWithoutCartItemsNestedInput = {
    create?: XOR<ProductCreateWithoutCartItemsInput, ProductUncheckedCreateWithoutCartItemsInput>
    connectOrCreate?: ProductCreateOrConnectWithoutCartItemsInput
    upsert?: ProductUpsertWithoutCartItemsInput
    connect?: ProductWhereUniqueInput
    update?: XOR<XOR<ProductUpdateToOneWithWhereWithoutCartItemsInput, ProductUpdateWithoutCartItemsInput>, ProductUncheckedUpdateWithoutCartItemsInput>
  }

  export type UserCreateNestedOneWithoutMcpConfigurationsInput = {
    create?: XOR<UserCreateWithoutMcpConfigurationsInput, UserUncheckedCreateWithoutMcpConfigurationsInput>
    connectOrCreate?: UserCreateOrConnectWithoutMcpConfigurationsInput
    connect?: UserWhereUniqueInput
  }

  export type ProductCreateNestedOneWithoutMcpConfigurationsInput = {
    create?: XOR<ProductCreateWithoutMcpConfigurationsInput, ProductUncheckedCreateWithoutMcpConfigurationsInput>
    connectOrCreate?: ProductCreateOrConnectWithoutMcpConfigurationsInput
    connect?: ProductWhereUniqueInput
  }

  export type EnumConfigStatusFieldUpdateOperationsInput = {
    set?: ConfigStatus
  }

  export type UserUpdateOneRequiredWithoutMcpConfigurationsNestedInput = {
    create?: XOR<UserCreateWithoutMcpConfigurationsInput, UserUncheckedCreateWithoutMcpConfigurationsInput>
    connectOrCreate?: UserCreateOrConnectWithoutMcpConfigurationsInput
    upsert?: UserUpsertWithoutMcpConfigurationsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutMcpConfigurationsInput, UserUpdateWithoutMcpConfigurationsInput>, UserUncheckedUpdateWithoutMcpConfigurationsInput>
  }

  export type ProductUpdateOneWithoutMcpConfigurationsNestedInput = {
    create?: XOR<ProductCreateWithoutMcpConfigurationsInput, ProductUncheckedCreateWithoutMcpConfigurationsInput>
    connectOrCreate?: ProductCreateOrConnectWithoutMcpConfigurationsInput
    upsert?: ProductUpsertWithoutMcpConfigurationsInput
    disconnect?: ProductWhereInput | boolean
    delete?: ProductWhereInput | boolean
    connect?: ProductWhereUniqueInput
    update?: XOR<XOR<ProductUpdateToOneWithWhereWithoutMcpConfigurationsInput, ProductUpdateWithoutMcpConfigurationsInput>, ProductUncheckedUpdateWithoutMcpConfigurationsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }
  export type NestedJsonFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedEnumEnvironmentFilter<$PrismaModel = never> = {
    equals?: Environment | EnumEnvironmentFieldRefInput<$PrismaModel>
    in?: Environment[] | ListEnumEnvironmentFieldRefInput<$PrismaModel>
    notIn?: Environment[] | ListEnumEnvironmentFieldRefInput<$PrismaModel>
    not?: NestedEnumEnvironmentFilter<$PrismaModel> | Environment
  }

  export type NestedEnumEnvironmentWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Environment | EnumEnvironmentFieldRefInput<$PrismaModel>
    in?: Environment[] | ListEnumEnvironmentFieldRefInput<$PrismaModel>
    notIn?: Environment[] | ListEnumEnvironmentFieldRefInput<$PrismaModel>
    not?: NestedEnumEnvironmentWithAggregatesFilter<$PrismaModel> | Environment
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumEnvironmentFilter<$PrismaModel>
    _max?: NestedEnumEnvironmentFilter<$PrismaModel>
  }

  export type NestedEnumRoleFilter<$PrismaModel = never> = {
    equals?: Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleFilter<$PrismaModel> | Role
  }

  export type NestedEnumRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleWithAggregatesFilter<$PrismaModel> | Role
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleFilter<$PrismaModel>
    _max?: NestedEnumRoleFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedEnumStatusFilter<$PrismaModel = never> = {
    equals?: Status | EnumStatusFieldRefInput<$PrismaModel>
    in?: Status[] | ListEnumStatusFieldRefInput<$PrismaModel>
    notIn?: Status[] | ListEnumStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumStatusFilter<$PrismaModel> | Status
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type NestedEnumStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Status | EnumStatusFieldRefInput<$PrismaModel>
    in?: Status[] | ListEnumStatusFieldRefInput<$PrismaModel>
    notIn?: Status[] | ListEnumStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumStatusWithAggregatesFilter<$PrismaModel> | Status
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumStatusFilter<$PrismaModel>
    _max?: NestedEnumStatusFilter<$PrismaModel>
  }

  export type NestedEnumOrderStatusFilter<$PrismaModel = never> = {
    equals?: OrderStatus | EnumOrderStatusFieldRefInput<$PrismaModel>
    in?: OrderStatus[] | ListEnumOrderStatusFieldRefInput<$PrismaModel>
    notIn?: OrderStatus[] | ListEnumOrderStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderStatusFilter<$PrismaModel> | OrderStatus
  }

  export type NestedEnumOrderStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: OrderStatus | EnumOrderStatusFieldRefInput<$PrismaModel>
    in?: OrderStatus[] | ListEnumOrderStatusFieldRefInput<$PrismaModel>
    notIn?: OrderStatus[] | ListEnumOrderStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumOrderStatusWithAggregatesFilter<$PrismaModel> | OrderStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumOrderStatusFilter<$PrismaModel>
    _max?: NestedEnumOrderStatusFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedEnumConfigStatusFilter<$PrismaModel = never> = {
    equals?: ConfigStatus | EnumConfigStatusFieldRefInput<$PrismaModel>
    in?: ConfigStatus[] | ListEnumConfigStatusFieldRefInput<$PrismaModel>
    notIn?: ConfigStatus[] | ListEnumConfigStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumConfigStatusFilter<$PrismaModel> | ConfigStatus
  }

  export type NestedEnumConfigStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: ConfigStatus | EnumConfigStatusFieldRefInput<$PrismaModel>
    in?: ConfigStatus[] | ListEnumConfigStatusFieldRefInput<$PrismaModel>
    notIn?: ConfigStatus[] | ListEnumConfigStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumConfigStatusWithAggregatesFilter<$PrismaModel> | ConfigStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumConfigStatusFilter<$PrismaModel>
    _max?: NestedEnumConfigStatusFilter<$PrismaModel>
  }

  export type ModuleOnClientCreateWithoutClientInput = {
    id?: string
    enabled?: boolean
    module: ModuleCreateNestedOneWithoutClientsInput
  }

  export type ModuleOnClientUncheckedCreateWithoutClientInput = {
    id?: string
    moduleId: string
    enabled?: boolean
  }

  export type ModuleOnClientCreateOrConnectWithoutClientInput = {
    where: ModuleOnClientWhereUniqueInput
    create: XOR<ModuleOnClientCreateWithoutClientInput, ModuleOnClientUncheckedCreateWithoutClientInput>
  }

  export type ModuleOnClientCreateManyClientInputEnvelope = {
    data: ModuleOnClientCreateManyClientInput | ModuleOnClientCreateManyClientInput[]
    skipDuplicates?: boolean
  }

  export type EnvironmentVariableCreateWithoutClientInput = {
    id?: string
    key: string
    value: string
    environment?: Environment
  }

  export type EnvironmentVariableUncheckedCreateWithoutClientInput = {
    id?: string
    key: string
    value: string
    environment?: Environment
  }

  export type EnvironmentVariableCreateOrConnectWithoutClientInput = {
    where: EnvironmentVariableWhereUniqueInput
    create: XOR<EnvironmentVariableCreateWithoutClientInput, EnvironmentVariableUncheckedCreateWithoutClientInput>
  }

  export type EnvironmentVariableCreateManyClientInputEnvelope = {
    data: EnvironmentVariableCreateManyClientInput | EnvironmentVariableCreateManyClientInput[]
    skipDuplicates?: boolean
  }

  export type ModuleOnClientUpsertWithWhereUniqueWithoutClientInput = {
    where: ModuleOnClientWhereUniqueInput
    update: XOR<ModuleOnClientUpdateWithoutClientInput, ModuleOnClientUncheckedUpdateWithoutClientInput>
    create: XOR<ModuleOnClientCreateWithoutClientInput, ModuleOnClientUncheckedCreateWithoutClientInput>
  }

  export type ModuleOnClientUpdateWithWhereUniqueWithoutClientInput = {
    where: ModuleOnClientWhereUniqueInput
    data: XOR<ModuleOnClientUpdateWithoutClientInput, ModuleOnClientUncheckedUpdateWithoutClientInput>
  }

  export type ModuleOnClientUpdateManyWithWhereWithoutClientInput = {
    where: ModuleOnClientScalarWhereInput
    data: XOR<ModuleOnClientUpdateManyMutationInput, ModuleOnClientUncheckedUpdateManyWithoutClientInput>
  }

  export type ModuleOnClientScalarWhereInput = {
    AND?: ModuleOnClientScalarWhereInput | ModuleOnClientScalarWhereInput[]
    OR?: ModuleOnClientScalarWhereInput[]
    NOT?: ModuleOnClientScalarWhereInput | ModuleOnClientScalarWhereInput[]
    id?: StringFilter<"ModuleOnClient"> | string
    clientId?: StringFilter<"ModuleOnClient"> | string
    moduleId?: StringFilter<"ModuleOnClient"> | string
    enabled?: BoolFilter<"ModuleOnClient"> | boolean
  }

  export type EnvironmentVariableUpsertWithWhereUniqueWithoutClientInput = {
    where: EnvironmentVariableWhereUniqueInput
    update: XOR<EnvironmentVariableUpdateWithoutClientInput, EnvironmentVariableUncheckedUpdateWithoutClientInput>
    create: XOR<EnvironmentVariableCreateWithoutClientInput, EnvironmentVariableUncheckedCreateWithoutClientInput>
  }

  export type EnvironmentVariableUpdateWithWhereUniqueWithoutClientInput = {
    where: EnvironmentVariableWhereUniqueInput
    data: XOR<EnvironmentVariableUpdateWithoutClientInput, EnvironmentVariableUncheckedUpdateWithoutClientInput>
  }

  export type EnvironmentVariableUpdateManyWithWhereWithoutClientInput = {
    where: EnvironmentVariableScalarWhereInput
    data: XOR<EnvironmentVariableUpdateManyMutationInput, EnvironmentVariableUncheckedUpdateManyWithoutClientInput>
  }

  export type EnvironmentVariableScalarWhereInput = {
    AND?: EnvironmentVariableScalarWhereInput | EnvironmentVariableScalarWhereInput[]
    OR?: EnvironmentVariableScalarWhereInput[]
    NOT?: EnvironmentVariableScalarWhereInput | EnvironmentVariableScalarWhereInput[]
    id?: StringFilter<"EnvironmentVariable"> | string
    key?: StringFilter<"EnvironmentVariable"> | string
    value?: StringFilter<"EnvironmentVariable"> | string
    environment?: EnumEnvironmentFilter<"EnvironmentVariable"> | Environment
    clientId?: StringFilter<"EnvironmentVariable"> | string
  }

  export type ModuleOnClientCreateWithoutModuleInput = {
    id?: string
    enabled?: boolean
    client: ClientCreateNestedOneWithoutModulesInput
  }

  export type ModuleOnClientUncheckedCreateWithoutModuleInput = {
    id?: string
    clientId: string
    enabled?: boolean
  }

  export type ModuleOnClientCreateOrConnectWithoutModuleInput = {
    where: ModuleOnClientWhereUniqueInput
    create: XOR<ModuleOnClientCreateWithoutModuleInput, ModuleOnClientUncheckedCreateWithoutModuleInput>
  }

  export type ModuleOnClientCreateManyModuleInputEnvelope = {
    data: ModuleOnClientCreateManyModuleInput | ModuleOnClientCreateManyModuleInput[]
    skipDuplicates?: boolean
  }

  export type ModuleOnClientUpsertWithWhereUniqueWithoutModuleInput = {
    where: ModuleOnClientWhereUniqueInput
    update: XOR<ModuleOnClientUpdateWithoutModuleInput, ModuleOnClientUncheckedUpdateWithoutModuleInput>
    create: XOR<ModuleOnClientCreateWithoutModuleInput, ModuleOnClientUncheckedCreateWithoutModuleInput>
  }

  export type ModuleOnClientUpdateWithWhereUniqueWithoutModuleInput = {
    where: ModuleOnClientWhereUniqueInput
    data: XOR<ModuleOnClientUpdateWithoutModuleInput, ModuleOnClientUncheckedUpdateWithoutModuleInput>
  }

  export type ModuleOnClientUpdateManyWithWhereWithoutModuleInput = {
    where: ModuleOnClientScalarWhereInput
    data: XOR<ModuleOnClientUpdateManyMutationInput, ModuleOnClientUncheckedUpdateManyWithoutModuleInput>
  }

  export type ClientCreateWithoutModulesInput = {
    id?: string
    name: string
    domain?: string | null
    apiKeys: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    environmentVariables?: EnvironmentVariableCreateNestedManyWithoutClientInput
  }

  export type ClientUncheckedCreateWithoutModulesInput = {
    id?: string
    name: string
    domain?: string | null
    apiKeys: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    environmentVariables?: EnvironmentVariableUncheckedCreateNestedManyWithoutClientInput
  }

  export type ClientCreateOrConnectWithoutModulesInput = {
    where: ClientWhereUniqueInput
    create: XOR<ClientCreateWithoutModulesInput, ClientUncheckedCreateWithoutModulesInput>
  }

  export type ModuleCreateWithoutClientsInput = {
    id?: string
    name: string
    description?: string | null
    version?: string | null
  }

  export type ModuleUncheckedCreateWithoutClientsInput = {
    id?: string
    name: string
    description?: string | null
    version?: string | null
  }

  export type ModuleCreateOrConnectWithoutClientsInput = {
    where: ModuleWhereUniqueInput
    create: XOR<ModuleCreateWithoutClientsInput, ModuleUncheckedCreateWithoutClientsInput>
  }

  export type ClientUpsertWithoutModulesInput = {
    update: XOR<ClientUpdateWithoutModulesInput, ClientUncheckedUpdateWithoutModulesInput>
    create: XOR<ClientCreateWithoutModulesInput, ClientUncheckedCreateWithoutModulesInput>
    where?: ClientWhereInput
  }

  export type ClientUpdateToOneWithWhereWithoutModulesInput = {
    where?: ClientWhereInput
    data: XOR<ClientUpdateWithoutModulesInput, ClientUncheckedUpdateWithoutModulesInput>
  }

  export type ClientUpdateWithoutModulesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: NullableStringFieldUpdateOperationsInput | string | null
    apiKeys?: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    environmentVariables?: EnvironmentVariableUpdateManyWithoutClientNestedInput
  }

  export type ClientUncheckedUpdateWithoutModulesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: NullableStringFieldUpdateOperationsInput | string | null
    apiKeys?: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    environmentVariables?: EnvironmentVariableUncheckedUpdateManyWithoutClientNestedInput
  }

  export type ModuleUpsertWithoutClientsInput = {
    update: XOR<ModuleUpdateWithoutClientsInput, ModuleUncheckedUpdateWithoutClientsInput>
    create: XOR<ModuleCreateWithoutClientsInput, ModuleUncheckedCreateWithoutClientsInput>
    where?: ModuleWhereInput
  }

  export type ModuleUpdateToOneWithWhereWithoutClientsInput = {
    where?: ModuleWhereInput
    data: XOR<ModuleUpdateWithoutClientsInput, ModuleUncheckedUpdateWithoutClientsInput>
  }

  export type ModuleUpdateWithoutClientsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    version?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type ModuleUncheckedUpdateWithoutClientsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    version?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type ClientCreateWithoutEnvironmentVariablesInput = {
    id?: string
    name: string
    domain?: string | null
    apiKeys: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    modules?: ModuleOnClientCreateNestedManyWithoutClientInput
  }

  export type ClientUncheckedCreateWithoutEnvironmentVariablesInput = {
    id?: string
    name: string
    domain?: string | null
    apiKeys: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    modules?: ModuleOnClientUncheckedCreateNestedManyWithoutClientInput
  }

  export type ClientCreateOrConnectWithoutEnvironmentVariablesInput = {
    where: ClientWhereUniqueInput
    create: XOR<ClientCreateWithoutEnvironmentVariablesInput, ClientUncheckedCreateWithoutEnvironmentVariablesInput>
  }

  export type ClientUpsertWithoutEnvironmentVariablesInput = {
    update: XOR<ClientUpdateWithoutEnvironmentVariablesInput, ClientUncheckedUpdateWithoutEnvironmentVariablesInput>
    create: XOR<ClientCreateWithoutEnvironmentVariablesInput, ClientUncheckedCreateWithoutEnvironmentVariablesInput>
    where?: ClientWhereInput
  }

  export type ClientUpdateToOneWithWhereWithoutEnvironmentVariablesInput = {
    where?: ClientWhereInput
    data: XOR<ClientUpdateWithoutEnvironmentVariablesInput, ClientUncheckedUpdateWithoutEnvironmentVariablesInput>
  }

  export type ClientUpdateWithoutEnvironmentVariablesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: NullableStringFieldUpdateOperationsInput | string | null
    apiKeys?: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    modules?: ModuleOnClientUpdateManyWithoutClientNestedInput
  }

  export type ClientUncheckedUpdateWithoutEnvironmentVariablesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    domain?: NullableStringFieldUpdateOperationsInput | string | null
    apiKeys?: JsonNullValueInput | InputJsonValue
    settings?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    modules?: ModuleOnClientUncheckedUpdateManyWithoutClientNestedInput
  }

  export type OrderCreateWithoutUserInput = {
    id?: string
    total: number
    status?: OrderStatus
    createdAt?: Date | string
    updatedAt?: Date | string
    items?: OrderItemCreateNestedManyWithoutOrderInput
  }

  export type OrderUncheckedCreateWithoutUserInput = {
    id?: string
    total: number
    status?: OrderStatus
    createdAt?: Date | string
    updatedAt?: Date | string
    items?: OrderItemUncheckedCreateNestedManyWithoutOrderInput
  }

  export type OrderCreateOrConnectWithoutUserInput = {
    where: OrderWhereUniqueInput
    create: XOR<OrderCreateWithoutUserInput, OrderUncheckedCreateWithoutUserInput>
  }

  export type OrderCreateManyUserInputEnvelope = {
    data: OrderCreateManyUserInput | OrderCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type CartCreateWithoutUserInput = {
    id?: string
    items?: CartItemCreateNestedManyWithoutCartInput
  }

  export type CartUncheckedCreateWithoutUserInput = {
    id?: string
    items?: CartItemUncheckedCreateNestedManyWithoutCartInput
  }

  export type CartCreateOrConnectWithoutUserInput = {
    where: CartWhereUniqueInput
    create: XOR<CartCreateWithoutUserInput, CartUncheckedCreateWithoutUserInput>
  }

  export type MCPConfigurationCreateWithoutUserInput = {
    id?: string
    name: string
    description?: string | null
    configData: JsonNullValueInput | InputJsonValue
    status?: ConfigStatus
    createdAt?: Date | string
    updatedAt?: Date | string
    product?: ProductCreateNestedOneWithoutMcpConfigurationsInput
  }

  export type MCPConfigurationUncheckedCreateWithoutUserInput = {
    id?: string
    name: string
    description?: string | null
    configData: JsonNullValueInput | InputJsonValue
    status?: ConfigStatus
    productId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MCPConfigurationCreateOrConnectWithoutUserInput = {
    where: MCPConfigurationWhereUniqueInput
    create: XOR<MCPConfigurationCreateWithoutUserInput, MCPConfigurationUncheckedCreateWithoutUserInput>
  }

  export type MCPConfigurationCreateManyUserInputEnvelope = {
    data: MCPConfigurationCreateManyUserInput | MCPConfigurationCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type ProductCreateWithoutSellerInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
    category: CategoryCreateNestedOneWithoutProductsInput
    orderItems?: OrderItemCreateNestedManyWithoutProductInput
    mcpConfigurations?: MCPConfigurationCreateNestedManyWithoutProductInput
    cartItems?: CartItemCreateNestedManyWithoutProductInput
  }

  export type ProductUncheckedCreateWithoutSellerInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    categoryId: string
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
    orderItems?: OrderItemUncheckedCreateNestedManyWithoutProductInput
    mcpConfigurations?: MCPConfigurationUncheckedCreateNestedManyWithoutProductInput
    cartItems?: CartItemUncheckedCreateNestedManyWithoutProductInput
  }

  export type ProductCreateOrConnectWithoutSellerInput = {
    where: ProductWhereUniqueInput
    create: XOR<ProductCreateWithoutSellerInput, ProductUncheckedCreateWithoutSellerInput>
  }

  export type ProductCreateManySellerInputEnvelope = {
    data: ProductCreateManySellerInput | ProductCreateManySellerInput[]
    skipDuplicates?: boolean
  }

  export type OrderUpsertWithWhereUniqueWithoutUserInput = {
    where: OrderWhereUniqueInput
    update: XOR<OrderUpdateWithoutUserInput, OrderUncheckedUpdateWithoutUserInput>
    create: XOR<OrderCreateWithoutUserInput, OrderUncheckedCreateWithoutUserInput>
  }

  export type OrderUpdateWithWhereUniqueWithoutUserInput = {
    where: OrderWhereUniqueInput
    data: XOR<OrderUpdateWithoutUserInput, OrderUncheckedUpdateWithoutUserInput>
  }

  export type OrderUpdateManyWithWhereWithoutUserInput = {
    where: OrderScalarWhereInput
    data: XOR<OrderUpdateManyMutationInput, OrderUncheckedUpdateManyWithoutUserInput>
  }

  export type OrderScalarWhereInput = {
    AND?: OrderScalarWhereInput | OrderScalarWhereInput[]
    OR?: OrderScalarWhereInput[]
    NOT?: OrderScalarWhereInput | OrderScalarWhereInput[]
    id?: StringFilter<"Order"> | string
    userId?: StringFilter<"Order"> | string
    total?: FloatFilter<"Order"> | number
    status?: EnumOrderStatusFilter<"Order"> | OrderStatus
    createdAt?: DateTimeFilter<"Order"> | Date | string
    updatedAt?: DateTimeFilter<"Order"> | Date | string
  }

  export type CartUpsertWithoutUserInput = {
    update: XOR<CartUpdateWithoutUserInput, CartUncheckedUpdateWithoutUserInput>
    create: XOR<CartCreateWithoutUserInput, CartUncheckedCreateWithoutUserInput>
    where?: CartWhereInput
  }

  export type CartUpdateToOneWithWhereWithoutUserInput = {
    where?: CartWhereInput
    data: XOR<CartUpdateWithoutUserInput, CartUncheckedUpdateWithoutUserInput>
  }

  export type CartUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    items?: CartItemUpdateManyWithoutCartNestedInput
  }

  export type CartUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    items?: CartItemUncheckedUpdateManyWithoutCartNestedInput
  }

  export type MCPConfigurationUpsertWithWhereUniqueWithoutUserInput = {
    where: MCPConfigurationWhereUniqueInput
    update: XOR<MCPConfigurationUpdateWithoutUserInput, MCPConfigurationUncheckedUpdateWithoutUserInput>
    create: XOR<MCPConfigurationCreateWithoutUserInput, MCPConfigurationUncheckedCreateWithoutUserInput>
  }

  export type MCPConfigurationUpdateWithWhereUniqueWithoutUserInput = {
    where: MCPConfigurationWhereUniqueInput
    data: XOR<MCPConfigurationUpdateWithoutUserInput, MCPConfigurationUncheckedUpdateWithoutUserInput>
  }

  export type MCPConfigurationUpdateManyWithWhereWithoutUserInput = {
    where: MCPConfigurationScalarWhereInput
    data: XOR<MCPConfigurationUpdateManyMutationInput, MCPConfigurationUncheckedUpdateManyWithoutUserInput>
  }

  export type MCPConfigurationScalarWhereInput = {
    AND?: MCPConfigurationScalarWhereInput | MCPConfigurationScalarWhereInput[]
    OR?: MCPConfigurationScalarWhereInput[]
    NOT?: MCPConfigurationScalarWhereInput | MCPConfigurationScalarWhereInput[]
    id?: StringFilter<"MCPConfiguration"> | string
    name?: StringFilter<"MCPConfiguration"> | string
    description?: StringNullableFilter<"MCPConfiguration"> | string | null
    configData?: JsonFilter<"MCPConfiguration">
    status?: EnumConfigStatusFilter<"MCPConfiguration"> | ConfigStatus
    userId?: StringFilter<"MCPConfiguration"> | string
    productId?: StringNullableFilter<"MCPConfiguration"> | string | null
    createdAt?: DateTimeFilter<"MCPConfiguration"> | Date | string
    updatedAt?: DateTimeFilter<"MCPConfiguration"> | Date | string
  }

  export type ProductUpsertWithWhereUniqueWithoutSellerInput = {
    where: ProductWhereUniqueInput
    update: XOR<ProductUpdateWithoutSellerInput, ProductUncheckedUpdateWithoutSellerInput>
    create: XOR<ProductCreateWithoutSellerInput, ProductUncheckedCreateWithoutSellerInput>
  }

  export type ProductUpdateWithWhereUniqueWithoutSellerInput = {
    where: ProductWhereUniqueInput
    data: XOR<ProductUpdateWithoutSellerInput, ProductUncheckedUpdateWithoutSellerInput>
  }

  export type ProductUpdateManyWithWhereWithoutSellerInput = {
    where: ProductScalarWhereInput
    data: XOR<ProductUpdateManyMutationInput, ProductUncheckedUpdateManyWithoutSellerInput>
  }

  export type ProductScalarWhereInput = {
    AND?: ProductScalarWhereInput | ProductScalarWhereInput[]
    OR?: ProductScalarWhereInput[]
    NOT?: ProductScalarWhereInput | ProductScalarWhereInput[]
    id?: StringFilter<"Product"> | string
    name?: StringFilter<"Product"> | string
    description?: StringFilter<"Product"> | string
    price?: FloatFilter<"Product"> | number
    image?: StringNullableFilter<"Product"> | string | null
    categoryId?: StringFilter<"Product"> | string
    sellerId?: StringFilter<"Product"> | string
    status?: EnumStatusFilter<"Product"> | Status
    createdAt?: DateTimeFilter<"Product"> | Date | string
    updatedAt?: DateTimeFilter<"Product"> | Date | string
  }

  export type ProductCreateWithoutCategoryInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
    seller: UserCreateNestedOneWithoutProductsInput
    orderItems?: OrderItemCreateNestedManyWithoutProductInput
    mcpConfigurations?: MCPConfigurationCreateNestedManyWithoutProductInput
    cartItems?: CartItemCreateNestedManyWithoutProductInput
  }

  export type ProductUncheckedCreateWithoutCategoryInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    sellerId: string
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
    orderItems?: OrderItemUncheckedCreateNestedManyWithoutProductInput
    mcpConfigurations?: MCPConfigurationUncheckedCreateNestedManyWithoutProductInput
    cartItems?: CartItemUncheckedCreateNestedManyWithoutProductInput
  }

  export type ProductCreateOrConnectWithoutCategoryInput = {
    where: ProductWhereUniqueInput
    create: XOR<ProductCreateWithoutCategoryInput, ProductUncheckedCreateWithoutCategoryInput>
  }

  export type ProductCreateManyCategoryInputEnvelope = {
    data: ProductCreateManyCategoryInput | ProductCreateManyCategoryInput[]
    skipDuplicates?: boolean
  }

  export type ProductUpsertWithWhereUniqueWithoutCategoryInput = {
    where: ProductWhereUniqueInput
    update: XOR<ProductUpdateWithoutCategoryInput, ProductUncheckedUpdateWithoutCategoryInput>
    create: XOR<ProductCreateWithoutCategoryInput, ProductUncheckedCreateWithoutCategoryInput>
  }

  export type ProductUpdateWithWhereUniqueWithoutCategoryInput = {
    where: ProductWhereUniqueInput
    data: XOR<ProductUpdateWithoutCategoryInput, ProductUncheckedUpdateWithoutCategoryInput>
  }

  export type ProductUpdateManyWithWhereWithoutCategoryInput = {
    where: ProductScalarWhereInput
    data: XOR<ProductUpdateManyMutationInput, ProductUncheckedUpdateManyWithoutCategoryInput>
  }

  export type CategoryCreateWithoutProductsInput = {
    id?: string
    name: string
    description?: string | null
    createdAt?: Date | string
  }

  export type CategoryUncheckedCreateWithoutProductsInput = {
    id?: string
    name: string
    description?: string | null
    createdAt?: Date | string
  }

  export type CategoryCreateOrConnectWithoutProductsInput = {
    where: CategoryWhereUniqueInput
    create: XOR<CategoryCreateWithoutProductsInput, CategoryUncheckedCreateWithoutProductsInput>
  }

  export type UserCreateWithoutProductsInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    role?: Role
    createdAt?: Date | string
    updatedAt?: Date | string
    orders?: OrderCreateNestedManyWithoutUserInput
    cart?: CartCreateNestedOneWithoutUserInput
    mcpConfigurations?: MCPConfigurationCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutProductsInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    role?: Role
    createdAt?: Date | string
    updatedAt?: Date | string
    orders?: OrderUncheckedCreateNestedManyWithoutUserInput
    cart?: CartUncheckedCreateNestedOneWithoutUserInput
    mcpConfigurations?: MCPConfigurationUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutProductsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutProductsInput, UserUncheckedCreateWithoutProductsInput>
  }

  export type OrderItemCreateWithoutProductInput = {
    id?: string
    quantity: number
    price: number
    order: OrderCreateNestedOneWithoutItemsInput
  }

  export type OrderItemUncheckedCreateWithoutProductInput = {
    id?: string
    orderId: string
    quantity: number
    price: number
  }

  export type OrderItemCreateOrConnectWithoutProductInput = {
    where: OrderItemWhereUniqueInput
    create: XOR<OrderItemCreateWithoutProductInput, OrderItemUncheckedCreateWithoutProductInput>
  }

  export type OrderItemCreateManyProductInputEnvelope = {
    data: OrderItemCreateManyProductInput | OrderItemCreateManyProductInput[]
    skipDuplicates?: boolean
  }

  export type MCPConfigurationCreateWithoutProductInput = {
    id?: string
    name: string
    description?: string | null
    configData: JsonNullValueInput | InputJsonValue
    status?: ConfigStatus
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutMcpConfigurationsInput
  }

  export type MCPConfigurationUncheckedCreateWithoutProductInput = {
    id?: string
    name: string
    description?: string | null
    configData: JsonNullValueInput | InputJsonValue
    status?: ConfigStatus
    userId: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MCPConfigurationCreateOrConnectWithoutProductInput = {
    where: MCPConfigurationWhereUniqueInput
    create: XOR<MCPConfigurationCreateWithoutProductInput, MCPConfigurationUncheckedCreateWithoutProductInput>
  }

  export type MCPConfigurationCreateManyProductInputEnvelope = {
    data: MCPConfigurationCreateManyProductInput | MCPConfigurationCreateManyProductInput[]
    skipDuplicates?: boolean
  }

  export type CartItemCreateWithoutProductInput = {
    id?: string
    quantity: number
    cart: CartCreateNestedOneWithoutItemsInput
  }

  export type CartItemUncheckedCreateWithoutProductInput = {
    id?: string
    cartId: string
    quantity: number
  }

  export type CartItemCreateOrConnectWithoutProductInput = {
    where: CartItemWhereUniqueInput
    create: XOR<CartItemCreateWithoutProductInput, CartItemUncheckedCreateWithoutProductInput>
  }

  export type CartItemCreateManyProductInputEnvelope = {
    data: CartItemCreateManyProductInput | CartItemCreateManyProductInput[]
    skipDuplicates?: boolean
  }

  export type CategoryUpsertWithoutProductsInput = {
    update: XOR<CategoryUpdateWithoutProductsInput, CategoryUncheckedUpdateWithoutProductsInput>
    create: XOR<CategoryCreateWithoutProductsInput, CategoryUncheckedCreateWithoutProductsInput>
    where?: CategoryWhereInput
  }

  export type CategoryUpdateToOneWithWhereWithoutProductsInput = {
    where?: CategoryWhereInput
    data: XOR<CategoryUpdateWithoutProductsInput, CategoryUncheckedUpdateWithoutProductsInput>
  }

  export type CategoryUpdateWithoutProductsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryUncheckedUpdateWithoutProductsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUpsertWithoutProductsInput = {
    update: XOR<UserUpdateWithoutProductsInput, UserUncheckedUpdateWithoutProductsInput>
    create: XOR<UserCreateWithoutProductsInput, UserUncheckedCreateWithoutProductsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutProductsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutProductsInput, UserUncheckedUpdateWithoutProductsInput>
  }

  export type UserUpdateWithoutProductsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orders?: OrderUpdateManyWithoutUserNestedInput
    cart?: CartUpdateOneWithoutUserNestedInput
    mcpConfigurations?: MCPConfigurationUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutProductsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orders?: OrderUncheckedUpdateManyWithoutUserNestedInput
    cart?: CartUncheckedUpdateOneWithoutUserNestedInput
    mcpConfigurations?: MCPConfigurationUncheckedUpdateManyWithoutUserNestedInput
  }

  export type OrderItemUpsertWithWhereUniqueWithoutProductInput = {
    where: OrderItemWhereUniqueInput
    update: XOR<OrderItemUpdateWithoutProductInput, OrderItemUncheckedUpdateWithoutProductInput>
    create: XOR<OrderItemCreateWithoutProductInput, OrderItemUncheckedCreateWithoutProductInput>
  }

  export type OrderItemUpdateWithWhereUniqueWithoutProductInput = {
    where: OrderItemWhereUniqueInput
    data: XOR<OrderItemUpdateWithoutProductInput, OrderItemUncheckedUpdateWithoutProductInput>
  }

  export type OrderItemUpdateManyWithWhereWithoutProductInput = {
    where: OrderItemScalarWhereInput
    data: XOR<OrderItemUpdateManyMutationInput, OrderItemUncheckedUpdateManyWithoutProductInput>
  }

  export type OrderItemScalarWhereInput = {
    AND?: OrderItemScalarWhereInput | OrderItemScalarWhereInput[]
    OR?: OrderItemScalarWhereInput[]
    NOT?: OrderItemScalarWhereInput | OrderItemScalarWhereInput[]
    id?: StringFilter<"OrderItem"> | string
    orderId?: StringFilter<"OrderItem"> | string
    productId?: StringFilter<"OrderItem"> | string
    quantity?: IntFilter<"OrderItem"> | number
    price?: FloatFilter<"OrderItem"> | number
  }

  export type MCPConfigurationUpsertWithWhereUniqueWithoutProductInput = {
    where: MCPConfigurationWhereUniqueInput
    update: XOR<MCPConfigurationUpdateWithoutProductInput, MCPConfigurationUncheckedUpdateWithoutProductInput>
    create: XOR<MCPConfigurationCreateWithoutProductInput, MCPConfigurationUncheckedCreateWithoutProductInput>
  }

  export type MCPConfigurationUpdateWithWhereUniqueWithoutProductInput = {
    where: MCPConfigurationWhereUniqueInput
    data: XOR<MCPConfigurationUpdateWithoutProductInput, MCPConfigurationUncheckedUpdateWithoutProductInput>
  }

  export type MCPConfigurationUpdateManyWithWhereWithoutProductInput = {
    where: MCPConfigurationScalarWhereInput
    data: XOR<MCPConfigurationUpdateManyMutationInput, MCPConfigurationUncheckedUpdateManyWithoutProductInput>
  }

  export type CartItemUpsertWithWhereUniqueWithoutProductInput = {
    where: CartItemWhereUniqueInput
    update: XOR<CartItemUpdateWithoutProductInput, CartItemUncheckedUpdateWithoutProductInput>
    create: XOR<CartItemCreateWithoutProductInput, CartItemUncheckedCreateWithoutProductInput>
  }

  export type CartItemUpdateWithWhereUniqueWithoutProductInput = {
    where: CartItemWhereUniqueInput
    data: XOR<CartItemUpdateWithoutProductInput, CartItemUncheckedUpdateWithoutProductInput>
  }

  export type CartItemUpdateManyWithWhereWithoutProductInput = {
    where: CartItemScalarWhereInput
    data: XOR<CartItemUpdateManyMutationInput, CartItemUncheckedUpdateManyWithoutProductInput>
  }

  export type CartItemScalarWhereInput = {
    AND?: CartItemScalarWhereInput | CartItemScalarWhereInput[]
    OR?: CartItemScalarWhereInput[]
    NOT?: CartItemScalarWhereInput | CartItemScalarWhereInput[]
    id?: StringFilter<"CartItem"> | string
    cartId?: StringFilter<"CartItem"> | string
    productId?: StringFilter<"CartItem"> | string
    quantity?: IntFilter<"CartItem"> | number
  }

  export type UserCreateWithoutOrdersInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    role?: Role
    createdAt?: Date | string
    updatedAt?: Date | string
    cart?: CartCreateNestedOneWithoutUserInput
    mcpConfigurations?: MCPConfigurationCreateNestedManyWithoutUserInput
    products?: ProductCreateNestedManyWithoutSellerInput
  }

  export type UserUncheckedCreateWithoutOrdersInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    role?: Role
    createdAt?: Date | string
    updatedAt?: Date | string
    cart?: CartUncheckedCreateNestedOneWithoutUserInput
    mcpConfigurations?: MCPConfigurationUncheckedCreateNestedManyWithoutUserInput
    products?: ProductUncheckedCreateNestedManyWithoutSellerInput
  }

  export type UserCreateOrConnectWithoutOrdersInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutOrdersInput, UserUncheckedCreateWithoutOrdersInput>
  }

  export type OrderItemCreateWithoutOrderInput = {
    id?: string
    quantity: number
    price: number
    product: ProductCreateNestedOneWithoutOrderItemsInput
  }

  export type OrderItemUncheckedCreateWithoutOrderInput = {
    id?: string
    productId: string
    quantity: number
    price: number
  }

  export type OrderItemCreateOrConnectWithoutOrderInput = {
    where: OrderItemWhereUniqueInput
    create: XOR<OrderItemCreateWithoutOrderInput, OrderItemUncheckedCreateWithoutOrderInput>
  }

  export type OrderItemCreateManyOrderInputEnvelope = {
    data: OrderItemCreateManyOrderInput | OrderItemCreateManyOrderInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutOrdersInput = {
    update: XOR<UserUpdateWithoutOrdersInput, UserUncheckedUpdateWithoutOrdersInput>
    create: XOR<UserCreateWithoutOrdersInput, UserUncheckedCreateWithoutOrdersInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutOrdersInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutOrdersInput, UserUncheckedUpdateWithoutOrdersInput>
  }

  export type UserUpdateWithoutOrdersInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cart?: CartUpdateOneWithoutUserNestedInput
    mcpConfigurations?: MCPConfigurationUpdateManyWithoutUserNestedInput
    products?: ProductUpdateManyWithoutSellerNestedInput
  }

  export type UserUncheckedUpdateWithoutOrdersInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    cart?: CartUncheckedUpdateOneWithoutUserNestedInput
    mcpConfigurations?: MCPConfigurationUncheckedUpdateManyWithoutUserNestedInput
    products?: ProductUncheckedUpdateManyWithoutSellerNestedInput
  }

  export type OrderItemUpsertWithWhereUniqueWithoutOrderInput = {
    where: OrderItemWhereUniqueInput
    update: XOR<OrderItemUpdateWithoutOrderInput, OrderItemUncheckedUpdateWithoutOrderInput>
    create: XOR<OrderItemCreateWithoutOrderInput, OrderItemUncheckedCreateWithoutOrderInput>
  }

  export type OrderItemUpdateWithWhereUniqueWithoutOrderInput = {
    where: OrderItemWhereUniqueInput
    data: XOR<OrderItemUpdateWithoutOrderInput, OrderItemUncheckedUpdateWithoutOrderInput>
  }

  export type OrderItemUpdateManyWithWhereWithoutOrderInput = {
    where: OrderItemScalarWhereInput
    data: XOR<OrderItemUpdateManyMutationInput, OrderItemUncheckedUpdateManyWithoutOrderInput>
  }

  export type OrderCreateWithoutItemsInput = {
    id?: string
    total: number
    status?: OrderStatus
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutOrdersInput
  }

  export type OrderUncheckedCreateWithoutItemsInput = {
    id?: string
    userId: string
    total: number
    status?: OrderStatus
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type OrderCreateOrConnectWithoutItemsInput = {
    where: OrderWhereUniqueInput
    create: XOR<OrderCreateWithoutItemsInput, OrderUncheckedCreateWithoutItemsInput>
  }

  export type ProductCreateWithoutOrderItemsInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
    category: CategoryCreateNestedOneWithoutProductsInput
    seller: UserCreateNestedOneWithoutProductsInput
    mcpConfigurations?: MCPConfigurationCreateNestedManyWithoutProductInput
    cartItems?: CartItemCreateNestedManyWithoutProductInput
  }

  export type ProductUncheckedCreateWithoutOrderItemsInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    categoryId: string
    sellerId: string
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
    mcpConfigurations?: MCPConfigurationUncheckedCreateNestedManyWithoutProductInput
    cartItems?: CartItemUncheckedCreateNestedManyWithoutProductInput
  }

  export type ProductCreateOrConnectWithoutOrderItemsInput = {
    where: ProductWhereUniqueInput
    create: XOR<ProductCreateWithoutOrderItemsInput, ProductUncheckedCreateWithoutOrderItemsInput>
  }

  export type OrderUpsertWithoutItemsInput = {
    update: XOR<OrderUpdateWithoutItemsInput, OrderUncheckedUpdateWithoutItemsInput>
    create: XOR<OrderCreateWithoutItemsInput, OrderUncheckedCreateWithoutItemsInput>
    where?: OrderWhereInput
  }

  export type OrderUpdateToOneWithWhereWithoutItemsInput = {
    where?: OrderWhereInput
    data: XOR<OrderUpdateWithoutItemsInput, OrderUncheckedUpdateWithoutItemsInput>
  }

  export type OrderUpdateWithoutItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    total?: FloatFieldUpdateOperationsInput | number
    status?: EnumOrderStatusFieldUpdateOperationsInput | OrderStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutOrdersNestedInput
  }

  export type OrderUncheckedUpdateWithoutItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    total?: FloatFieldUpdateOperationsInput | number
    status?: EnumOrderStatusFieldUpdateOperationsInput | OrderStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductUpsertWithoutOrderItemsInput = {
    update: XOR<ProductUpdateWithoutOrderItemsInput, ProductUncheckedUpdateWithoutOrderItemsInput>
    create: XOR<ProductCreateWithoutOrderItemsInput, ProductUncheckedCreateWithoutOrderItemsInput>
    where?: ProductWhereInput
  }

  export type ProductUpdateToOneWithWhereWithoutOrderItemsInput = {
    where?: ProductWhereInput
    data: XOR<ProductUpdateWithoutOrderItemsInput, ProductUncheckedUpdateWithoutOrderItemsInput>
  }

  export type ProductUpdateWithoutOrderItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    category?: CategoryUpdateOneRequiredWithoutProductsNestedInput
    seller?: UserUpdateOneRequiredWithoutProductsNestedInput
    mcpConfigurations?: MCPConfigurationUpdateManyWithoutProductNestedInput
    cartItems?: CartItemUpdateManyWithoutProductNestedInput
  }

  export type ProductUncheckedUpdateWithoutOrderItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    categoryId?: StringFieldUpdateOperationsInput | string
    sellerId?: StringFieldUpdateOperationsInput | string
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    mcpConfigurations?: MCPConfigurationUncheckedUpdateManyWithoutProductNestedInput
    cartItems?: CartItemUncheckedUpdateManyWithoutProductNestedInput
  }

  export type UserCreateWithoutCartInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    role?: Role
    createdAt?: Date | string
    updatedAt?: Date | string
    orders?: OrderCreateNestedManyWithoutUserInput
    mcpConfigurations?: MCPConfigurationCreateNestedManyWithoutUserInput
    products?: ProductCreateNestedManyWithoutSellerInput
  }

  export type UserUncheckedCreateWithoutCartInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    role?: Role
    createdAt?: Date | string
    updatedAt?: Date | string
    orders?: OrderUncheckedCreateNestedManyWithoutUserInput
    mcpConfigurations?: MCPConfigurationUncheckedCreateNestedManyWithoutUserInput
    products?: ProductUncheckedCreateNestedManyWithoutSellerInput
  }

  export type UserCreateOrConnectWithoutCartInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutCartInput, UserUncheckedCreateWithoutCartInput>
  }

  export type CartItemCreateWithoutCartInput = {
    id?: string
    quantity: number
    product: ProductCreateNestedOneWithoutCartItemsInput
  }

  export type CartItemUncheckedCreateWithoutCartInput = {
    id?: string
    productId: string
    quantity: number
  }

  export type CartItemCreateOrConnectWithoutCartInput = {
    where: CartItemWhereUniqueInput
    create: XOR<CartItemCreateWithoutCartInput, CartItemUncheckedCreateWithoutCartInput>
  }

  export type CartItemCreateManyCartInputEnvelope = {
    data: CartItemCreateManyCartInput | CartItemCreateManyCartInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutCartInput = {
    update: XOR<UserUpdateWithoutCartInput, UserUncheckedUpdateWithoutCartInput>
    create: XOR<UserCreateWithoutCartInput, UserUncheckedCreateWithoutCartInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutCartInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutCartInput, UserUncheckedUpdateWithoutCartInput>
  }

  export type UserUpdateWithoutCartInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orders?: OrderUpdateManyWithoutUserNestedInput
    mcpConfigurations?: MCPConfigurationUpdateManyWithoutUserNestedInput
    products?: ProductUpdateManyWithoutSellerNestedInput
  }

  export type UserUncheckedUpdateWithoutCartInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orders?: OrderUncheckedUpdateManyWithoutUserNestedInput
    mcpConfigurations?: MCPConfigurationUncheckedUpdateManyWithoutUserNestedInput
    products?: ProductUncheckedUpdateManyWithoutSellerNestedInput
  }

  export type CartItemUpsertWithWhereUniqueWithoutCartInput = {
    where: CartItemWhereUniqueInput
    update: XOR<CartItemUpdateWithoutCartInput, CartItemUncheckedUpdateWithoutCartInput>
    create: XOR<CartItemCreateWithoutCartInput, CartItemUncheckedCreateWithoutCartInput>
  }

  export type CartItemUpdateWithWhereUniqueWithoutCartInput = {
    where: CartItemWhereUniqueInput
    data: XOR<CartItemUpdateWithoutCartInput, CartItemUncheckedUpdateWithoutCartInput>
  }

  export type CartItemUpdateManyWithWhereWithoutCartInput = {
    where: CartItemScalarWhereInput
    data: XOR<CartItemUpdateManyMutationInput, CartItemUncheckedUpdateManyWithoutCartInput>
  }

  export type CartCreateWithoutItemsInput = {
    id?: string
    user: UserCreateNestedOneWithoutCartInput
  }

  export type CartUncheckedCreateWithoutItemsInput = {
    id?: string
    userId: string
  }

  export type CartCreateOrConnectWithoutItemsInput = {
    where: CartWhereUniqueInput
    create: XOR<CartCreateWithoutItemsInput, CartUncheckedCreateWithoutItemsInput>
  }

  export type ProductCreateWithoutCartItemsInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
    category: CategoryCreateNestedOneWithoutProductsInput
    seller: UserCreateNestedOneWithoutProductsInput
    orderItems?: OrderItemCreateNestedManyWithoutProductInput
    mcpConfigurations?: MCPConfigurationCreateNestedManyWithoutProductInput
  }

  export type ProductUncheckedCreateWithoutCartItemsInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    categoryId: string
    sellerId: string
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
    orderItems?: OrderItemUncheckedCreateNestedManyWithoutProductInput
    mcpConfigurations?: MCPConfigurationUncheckedCreateNestedManyWithoutProductInput
  }

  export type ProductCreateOrConnectWithoutCartItemsInput = {
    where: ProductWhereUniqueInput
    create: XOR<ProductCreateWithoutCartItemsInput, ProductUncheckedCreateWithoutCartItemsInput>
  }

  export type CartUpsertWithoutItemsInput = {
    update: XOR<CartUpdateWithoutItemsInput, CartUncheckedUpdateWithoutItemsInput>
    create: XOR<CartCreateWithoutItemsInput, CartUncheckedCreateWithoutItemsInput>
    where?: CartWhereInput
  }

  export type CartUpdateToOneWithWhereWithoutItemsInput = {
    where?: CartWhereInput
    data: XOR<CartUpdateWithoutItemsInput, CartUncheckedUpdateWithoutItemsInput>
  }

  export type CartUpdateWithoutItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    user?: UserUpdateOneRequiredWithoutCartNestedInput
  }

  export type CartUncheckedUpdateWithoutItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
  }

  export type ProductUpsertWithoutCartItemsInput = {
    update: XOR<ProductUpdateWithoutCartItemsInput, ProductUncheckedUpdateWithoutCartItemsInput>
    create: XOR<ProductCreateWithoutCartItemsInput, ProductUncheckedCreateWithoutCartItemsInput>
    where?: ProductWhereInput
  }

  export type ProductUpdateToOneWithWhereWithoutCartItemsInput = {
    where?: ProductWhereInput
    data: XOR<ProductUpdateWithoutCartItemsInput, ProductUncheckedUpdateWithoutCartItemsInput>
  }

  export type ProductUpdateWithoutCartItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    category?: CategoryUpdateOneRequiredWithoutProductsNestedInput
    seller?: UserUpdateOneRequiredWithoutProductsNestedInput
    orderItems?: OrderItemUpdateManyWithoutProductNestedInput
    mcpConfigurations?: MCPConfigurationUpdateManyWithoutProductNestedInput
  }

  export type ProductUncheckedUpdateWithoutCartItemsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    categoryId?: StringFieldUpdateOperationsInput | string
    sellerId?: StringFieldUpdateOperationsInput | string
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orderItems?: OrderItemUncheckedUpdateManyWithoutProductNestedInput
    mcpConfigurations?: MCPConfigurationUncheckedUpdateManyWithoutProductNestedInput
  }

  export type UserCreateWithoutMcpConfigurationsInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    role?: Role
    createdAt?: Date | string
    updatedAt?: Date | string
    orders?: OrderCreateNestedManyWithoutUserInput
    cart?: CartCreateNestedOneWithoutUserInput
    products?: ProductCreateNestedManyWithoutSellerInput
  }

  export type UserUncheckedCreateWithoutMcpConfigurationsInput = {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    role?: Role
    createdAt?: Date | string
    updatedAt?: Date | string
    orders?: OrderUncheckedCreateNestedManyWithoutUserInput
    cart?: CartUncheckedCreateNestedOneWithoutUserInput
    products?: ProductUncheckedCreateNestedManyWithoutSellerInput
  }

  export type UserCreateOrConnectWithoutMcpConfigurationsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutMcpConfigurationsInput, UserUncheckedCreateWithoutMcpConfigurationsInput>
  }

  export type ProductCreateWithoutMcpConfigurationsInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
    category: CategoryCreateNestedOneWithoutProductsInput
    seller: UserCreateNestedOneWithoutProductsInput
    orderItems?: OrderItemCreateNestedManyWithoutProductInput
    cartItems?: CartItemCreateNestedManyWithoutProductInput
  }

  export type ProductUncheckedCreateWithoutMcpConfigurationsInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    categoryId: string
    sellerId: string
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
    orderItems?: OrderItemUncheckedCreateNestedManyWithoutProductInput
    cartItems?: CartItemUncheckedCreateNestedManyWithoutProductInput
  }

  export type ProductCreateOrConnectWithoutMcpConfigurationsInput = {
    where: ProductWhereUniqueInput
    create: XOR<ProductCreateWithoutMcpConfigurationsInput, ProductUncheckedCreateWithoutMcpConfigurationsInput>
  }

  export type UserUpsertWithoutMcpConfigurationsInput = {
    update: XOR<UserUpdateWithoutMcpConfigurationsInput, UserUncheckedUpdateWithoutMcpConfigurationsInput>
    create: XOR<UserCreateWithoutMcpConfigurationsInput, UserUncheckedCreateWithoutMcpConfigurationsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutMcpConfigurationsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutMcpConfigurationsInput, UserUncheckedUpdateWithoutMcpConfigurationsInput>
  }

  export type UserUpdateWithoutMcpConfigurationsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orders?: OrderUpdateManyWithoutUserNestedInput
    cart?: CartUpdateOneWithoutUserNestedInput
    products?: ProductUpdateManyWithoutSellerNestedInput
  }

  export type UserUncheckedUpdateWithoutMcpConfigurationsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    avatar?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orders?: OrderUncheckedUpdateManyWithoutUserNestedInput
    cart?: CartUncheckedUpdateOneWithoutUserNestedInput
    products?: ProductUncheckedUpdateManyWithoutSellerNestedInput
  }

  export type ProductUpsertWithoutMcpConfigurationsInput = {
    update: XOR<ProductUpdateWithoutMcpConfigurationsInput, ProductUncheckedUpdateWithoutMcpConfigurationsInput>
    create: XOR<ProductCreateWithoutMcpConfigurationsInput, ProductUncheckedCreateWithoutMcpConfigurationsInput>
    where?: ProductWhereInput
  }

  export type ProductUpdateToOneWithWhereWithoutMcpConfigurationsInput = {
    where?: ProductWhereInput
    data: XOR<ProductUpdateWithoutMcpConfigurationsInput, ProductUncheckedUpdateWithoutMcpConfigurationsInput>
  }

  export type ProductUpdateWithoutMcpConfigurationsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    category?: CategoryUpdateOneRequiredWithoutProductsNestedInput
    seller?: UserUpdateOneRequiredWithoutProductsNestedInput
    orderItems?: OrderItemUpdateManyWithoutProductNestedInput
    cartItems?: CartItemUpdateManyWithoutProductNestedInput
  }

  export type ProductUncheckedUpdateWithoutMcpConfigurationsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    categoryId?: StringFieldUpdateOperationsInput | string
    sellerId?: StringFieldUpdateOperationsInput | string
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orderItems?: OrderItemUncheckedUpdateManyWithoutProductNestedInput
    cartItems?: CartItemUncheckedUpdateManyWithoutProductNestedInput
  }

  export type ModuleOnClientCreateManyClientInput = {
    id?: string
    moduleId: string
    enabled?: boolean
  }

  export type EnvironmentVariableCreateManyClientInput = {
    id?: string
    key: string
    value: string
    environment?: Environment
  }

  export type ModuleOnClientUpdateWithoutClientInput = {
    id?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
    module?: ModuleUpdateOneRequiredWithoutClientsNestedInput
  }

  export type ModuleOnClientUncheckedUpdateWithoutClientInput = {
    id?: StringFieldUpdateOperationsInput | string
    moduleId?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ModuleOnClientUncheckedUpdateManyWithoutClientInput = {
    id?: StringFieldUpdateOperationsInput | string
    moduleId?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
  }

  export type EnvironmentVariableUpdateWithoutClientInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    environment?: EnumEnvironmentFieldUpdateOperationsInput | Environment
  }

  export type EnvironmentVariableUncheckedUpdateWithoutClientInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    environment?: EnumEnvironmentFieldUpdateOperationsInput | Environment
  }

  export type EnvironmentVariableUncheckedUpdateManyWithoutClientInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    value?: StringFieldUpdateOperationsInput | string
    environment?: EnumEnvironmentFieldUpdateOperationsInput | Environment
  }

  export type ModuleOnClientCreateManyModuleInput = {
    id?: string
    clientId: string
    enabled?: boolean
  }

  export type ModuleOnClientUpdateWithoutModuleInput = {
    id?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
    client?: ClientUpdateOneRequiredWithoutModulesNestedInput
  }

  export type ModuleOnClientUncheckedUpdateWithoutModuleInput = {
    id?: StringFieldUpdateOperationsInput | string
    clientId?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
  }

  export type ModuleOnClientUncheckedUpdateManyWithoutModuleInput = {
    id?: StringFieldUpdateOperationsInput | string
    clientId?: StringFieldUpdateOperationsInput | string
    enabled?: BoolFieldUpdateOperationsInput | boolean
  }

  export type OrderCreateManyUserInput = {
    id?: string
    total: number
    status?: OrderStatus
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type MCPConfigurationCreateManyUserInput = {
    id?: string
    name: string
    description?: string | null
    configData: JsonNullValueInput | InputJsonValue
    status?: ConfigStatus
    productId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProductCreateManySellerInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    categoryId: string
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type OrderUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    total?: FloatFieldUpdateOperationsInput | number
    status?: EnumOrderStatusFieldUpdateOperationsInput | OrderStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    items?: OrderItemUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    total?: FloatFieldUpdateOperationsInput | number
    status?: EnumOrderStatusFieldUpdateOperationsInput | OrderStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    items?: OrderItemUncheckedUpdateManyWithoutOrderNestedInput
  }

  export type OrderUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    total?: FloatFieldUpdateOperationsInput | number
    status?: EnumOrderStatusFieldUpdateOperationsInput | OrderStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MCPConfigurationUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    configData?: JsonNullValueInput | InputJsonValue
    status?: EnumConfigStatusFieldUpdateOperationsInput | ConfigStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    product?: ProductUpdateOneWithoutMcpConfigurationsNestedInput
  }

  export type MCPConfigurationUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    configData?: JsonNullValueInput | InputJsonValue
    status?: EnumConfigStatusFieldUpdateOperationsInput | ConfigStatus
    productId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MCPConfigurationUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    configData?: JsonNullValueInput | InputJsonValue
    status?: EnumConfigStatusFieldUpdateOperationsInput | ConfigStatus
    productId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductUpdateWithoutSellerInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    category?: CategoryUpdateOneRequiredWithoutProductsNestedInput
    orderItems?: OrderItemUpdateManyWithoutProductNestedInput
    mcpConfigurations?: MCPConfigurationUpdateManyWithoutProductNestedInput
    cartItems?: CartItemUpdateManyWithoutProductNestedInput
  }

  export type ProductUncheckedUpdateWithoutSellerInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    categoryId?: StringFieldUpdateOperationsInput | string
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orderItems?: OrderItemUncheckedUpdateManyWithoutProductNestedInput
    mcpConfigurations?: MCPConfigurationUncheckedUpdateManyWithoutProductNestedInput
    cartItems?: CartItemUncheckedUpdateManyWithoutProductNestedInput
  }

  export type ProductUncheckedUpdateManyWithoutSellerInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    categoryId?: StringFieldUpdateOperationsInput | string
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProductCreateManyCategoryInput = {
    id?: string
    name: string
    description: string
    price: number
    image?: string | null
    sellerId: string
    status?: Status
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProductUpdateWithoutCategoryInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    seller?: UserUpdateOneRequiredWithoutProductsNestedInput
    orderItems?: OrderItemUpdateManyWithoutProductNestedInput
    mcpConfigurations?: MCPConfigurationUpdateManyWithoutProductNestedInput
    cartItems?: CartItemUpdateManyWithoutProductNestedInput
  }

  export type ProductUncheckedUpdateWithoutCategoryInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    sellerId?: StringFieldUpdateOperationsInput | string
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orderItems?: OrderItemUncheckedUpdateManyWithoutProductNestedInput
    mcpConfigurations?: MCPConfigurationUncheckedUpdateManyWithoutProductNestedInput
    cartItems?: CartItemUncheckedUpdateManyWithoutProductNestedInput
  }

  export type ProductUncheckedUpdateManyWithoutCategoryInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    image?: NullableStringFieldUpdateOperationsInput | string | null
    sellerId?: StringFieldUpdateOperationsInput | string
    status?: EnumStatusFieldUpdateOperationsInput | Status
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OrderItemCreateManyProductInput = {
    id?: string
    orderId: string
    quantity: number
    price: number
  }

  export type MCPConfigurationCreateManyProductInput = {
    id?: string
    name: string
    description?: string | null
    configData: JsonNullValueInput | InputJsonValue
    status?: ConfigStatus
    userId: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CartItemCreateManyProductInput = {
    id?: string
    cartId: string
    quantity: number
  }

  export type OrderItemUpdateWithoutProductInput = {
    id?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    price?: FloatFieldUpdateOperationsInput | number
    order?: OrderUpdateOneRequiredWithoutItemsNestedInput
  }

  export type OrderItemUncheckedUpdateWithoutProductInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderId?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    price?: FloatFieldUpdateOperationsInput | number
  }

  export type OrderItemUncheckedUpdateManyWithoutProductInput = {
    id?: StringFieldUpdateOperationsInput | string
    orderId?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    price?: FloatFieldUpdateOperationsInput | number
  }

  export type MCPConfigurationUpdateWithoutProductInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    configData?: JsonNullValueInput | InputJsonValue
    status?: EnumConfigStatusFieldUpdateOperationsInput | ConfigStatus
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutMcpConfigurationsNestedInput
  }

  export type MCPConfigurationUncheckedUpdateWithoutProductInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    configData?: JsonNullValueInput | InputJsonValue
    status?: EnumConfigStatusFieldUpdateOperationsInput | ConfigStatus
    userId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MCPConfigurationUncheckedUpdateManyWithoutProductInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    configData?: JsonNullValueInput | InputJsonValue
    status?: EnumConfigStatusFieldUpdateOperationsInput | ConfigStatus
    userId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CartItemUpdateWithoutProductInput = {
    id?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    cart?: CartUpdateOneRequiredWithoutItemsNestedInput
  }

  export type CartItemUncheckedUpdateWithoutProductInput = {
    id?: StringFieldUpdateOperationsInput | string
    cartId?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type CartItemUncheckedUpdateManyWithoutProductInput = {
    id?: StringFieldUpdateOperationsInput | string
    cartId?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type OrderItemCreateManyOrderInput = {
    id?: string
    productId: string
    quantity: number
    price: number
  }

  export type OrderItemUpdateWithoutOrderInput = {
    id?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    price?: FloatFieldUpdateOperationsInput | number
    product?: ProductUpdateOneRequiredWithoutOrderItemsNestedInput
  }

  export type OrderItemUncheckedUpdateWithoutOrderInput = {
    id?: StringFieldUpdateOperationsInput | string
    productId?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    price?: FloatFieldUpdateOperationsInput | number
  }

  export type OrderItemUncheckedUpdateManyWithoutOrderInput = {
    id?: StringFieldUpdateOperationsInput | string
    productId?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    price?: FloatFieldUpdateOperationsInput | number
  }

  export type CartItemCreateManyCartInput = {
    id?: string
    productId: string
    quantity: number
  }

  export type CartItemUpdateWithoutCartInput = {
    id?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    product?: ProductUpdateOneRequiredWithoutCartItemsNestedInput
  }

  export type CartItemUncheckedUpdateWithoutCartInput = {
    id?: StringFieldUpdateOperationsInput | string
    productId?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type CartItemUncheckedUpdateManyWithoutCartInput = {
    id?: StringFieldUpdateOperationsInput | string
    productId?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}