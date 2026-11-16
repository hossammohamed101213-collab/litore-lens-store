/**
 * True when this order already has a shipment created through this courier's API.
 * Stops a second click / a retry from creating (and paying for) a second shipment.
 */
export function alreadyShippedWith(
  prev: { carrier: string | null; carrier_ref?: string | null; tracking_number?: string | null } | undefined,
  carrier: string,
): boolean {
  return !!prev && prev.carrier === carrier && !!(prev.carrier_ref || prev.tracking_number);
}
