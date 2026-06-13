// Flat delivery fee, in integer cents. Single source of truth for the fee the
// customer pays and the driver later earns. Snapshotted onto Order.deliveryFeeCents
// at checkout so later changes never affect past orders. (CLAUDE.md: money = cents.)
export const FLAT_DELIVERY_FEE_CENTS = 299;
