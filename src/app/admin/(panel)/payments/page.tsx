import { redirect } from "next/navigation";

/** Old address: the payment settings now live under الربط. */
export default function PaymentsMoved() {
  redirect("/admin/integrations/telr");
}
