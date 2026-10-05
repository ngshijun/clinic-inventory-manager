/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as lib_aggregates from "../lib/aggregates.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_demand from "../lib/demand.js";
import type * as lib_names from "../lib/names.js";
import type * as lib_orders from "../lib/orders.js";
import type * as lib_price from "../lib/price.js";
import type * as lib_stock from "../lib/stock.js";
import type * as lib_telegram from "../lib/telegram.js";
import type * as lib_units from "../lib/units.js";
import type * as migration from "../migration.js";
import type * as movements from "../movements.js";
import type * as payroll from "../payroll.js";
import type * as payrollRuns from "../payrollRuns.js";
import type * as requests from "../requests.js";
import type * as stock from "../stock.js";
import type * as summary from "../summary.js";
import type * as suppliers from "../suppliers.js";
import type * as telegram from "../telegram.js";
import type * as units from "../units.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  http: typeof http;
  inventory: typeof inventory;
  "lib/aggregates": typeof lib_aggregates;
  "lib/auth": typeof lib_auth;
  "lib/demand": typeof lib_demand;
  "lib/names": typeof lib_names;
  "lib/orders": typeof lib_orders;
  "lib/price": typeof lib_price;
  "lib/stock": typeof lib_stock;
  "lib/telegram": typeof lib_telegram;
  "lib/units": typeof lib_units;
  migration: typeof migration;
  movements: typeof movements;
  payroll: typeof payroll;
  payrollRuns: typeof payrollRuns;
  requests: typeof requests;
  stock: typeof stock;
  summary: typeof summary;
  suppliers: typeof suppliers;
  telegram: typeof telegram;
  units: typeof units;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  movementsByType: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"movementsByType">;
};
