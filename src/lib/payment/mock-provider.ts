import type { PaymentProvider, PaymentSession } from "./types";

/** Mock only. Stores no card data. A real gateway needs merchant keys. */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  private sessions = new Map<string, PaymentSession>();

  async createSession(input: { orderId: string; idempotencyKey: string; method?: string }) {
    const existing = this.sessions.get(input.idempotencyKey);
    if (existing) return existing;
    // "mock-fail" lets us test the failed-payment + retry flow.
    const session: PaymentSession = {
      id: `mock_${input.orderId}`,
      status: input.method === "mock-fail" ? "failed" : "paid",
    };
    this.sessions.set(input.idempotencyKey, session);
    return session;
  }

  async getSession(sessionId: string): Promise<PaymentSession> {
    return { id: sessionId, status: "paid" };
  }

  async refund() {
    return { ok: true };
  }

  verifyWebhook() {
    return false;
  }
}
