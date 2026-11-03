import type { ShoppingItem } from '@/features/shopping/data';

type ShoppingItemDeletePayload = {
  eventType?: unknown;
  old?: {
    id?: unknown;
  } | null;
};

export function getDeletedShoppingItemId(payload: ShoppingItemDeletePayload): string | null {
  return payload.eventType === 'DELETE' && typeof payload.old?.id === 'string'
    ? payload.old.id
    : null;
}

export function removeDeletedShoppingItem(
  items: ShoppingItem[] | undefined,
  deletedId: string,
): ShoppingItem[] | undefined {
  return items?.filter((item) => item.id !== deletedId);
}

export function createShoppingItemDeleteFilters(itemIds: string[]): string[] {
  const filters: string[] = [];
  for (let index = 0; index < itemIds.length; index += 100) {
    filters.push(`id=in.(${itemIds.slice(index, index + 100).join(',')})`);
  }
  return filters;
}
