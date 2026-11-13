export type PaymentSession = {
  id: string;
  status: "requires_action" | "pending" | "paid" | "failed" | "cancelled";
  redirectUrl?: string;
};

export interface PaymentProvider {
  readonly name: string;
  /** Idempotency key prevents double charges / duplicate orders. */
  createSession(input: { orderId: string; amount: number; currency: string; idempotencyKey: string; method?: string }): Promise<PaymentSession>;
  /** Never trust the browser return alone: confirm server-side or via webhook. */
  getSession(sessionId: string): Promise<PaymentSession>;
  refund(sessionId: string, amount?: number): Promise<{ ok: boolean }>;
  verifyWebhook(payload: string, signature: string | null): boolean;
}
