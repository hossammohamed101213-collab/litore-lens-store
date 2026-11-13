import { DbCommerceProvider } from "./db-provider";
import { MockCommerceProvider } from "./mock-provider";
import type { CommerceProvider } from "./types";

/** Single entry point. UI never imports a vendor SDK directly. */
export function getCommerce(): CommerceProvider {
  switch (process.env.COMMERCE_PROVIDER) {
    case "mock":
      return new MockCommerceProvider();
    case "db":
    default:
      return new DbCommerceProvider();
  }
}

export * from "./types";
