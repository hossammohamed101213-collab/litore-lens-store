import type { PaymentProvider, PaymentSession } from "./types";

/** Cash on delivery: no money moves online, the order waits as "pending" until the owner confirms collection. */
export class CodPaymentProvider implements PaymentProvider {
  readonly name = "cod";

  async createSession(input: { orderId: string }): Promise<PaymentSession> {
    return { id: `cod_${input.orderId}`, status: "pending" };
  }

  async getSession(sessionId: string): Promise<PaymentSession> {
    return { id: sessionId, status: "pending" };
  }

  async refund() {
    return { ok: false };
  }

  verifyWebhook() {
    return false;
  }
}
