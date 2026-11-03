export function formatShoppingItemQuantity(quantity: number | null, unit: string | null): string {
  const formattedQuantity =
    quantity === null
      ? null
      : new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 3 }).format(quantity);

  if (formattedQuantity && unit) {
    return `${formattedQuantity} ${unit}`;
  }
  return formattedQuantity ?? unit ?? '';
}
