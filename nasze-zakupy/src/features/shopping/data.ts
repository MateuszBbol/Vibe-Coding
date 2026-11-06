import { supabase } from '@/lib/supabase/client';
import type { ShoppingCategoryId } from '@/features/shopping/categories';
import type { ShoppingUnit } from '@/features/shopping/schemas';

export type ShoppingList = {
  id: string;
  name: string;
};

export type ShoppingItem = {
  id: string;
  list_id: string;
  name: string;
  quantity: number | null;
  unit: ShoppingUnit | null;
  category: ShoppingCategoryId | null;
  is_purchased: boolean;
  created_at: string;
  updated_at: string;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error('Brak konfiguracji Supabase.');
  }
  return supabase;
}

export async function fetchActiveShoppingList(householdId: string): Promise<ShoppingList | null> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('ensure_active_shopping_list', {
    target_household_id: householdId,
  });

  if (error) {
    throw error;
  }
  const activeList = Array.isArray(data) ? data[0] : null;
  if (!activeList) {
    return null;
  }
  if (typeof activeList.list_id !== 'string' || typeof activeList.list_name !== 'string') {
    throw new Error('Nie udało się otworzyć listy zakupów.');
  }
  return { id: activeList.list_id, name: activeList.list_name };
}

export async function createShoppingList(householdId: string): Promise<ShoppingList> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_shopping_list', {
    target_household_id: householdId,
  });
  if (error) {
    throw error;
  }
  const list = Array.isArray(data) ? data[0] : null;
  if (!list || typeof list.list_id !== 'string' || typeof list.list_name !== 'string') {
    throw new Error('Nie udało się utworzyć listy zakupowej.');
  }
  return { id: list.list_id, name: list.list_name };
}

export async function deleteShoppingList(listId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('delete_shopping_list', {
    target_list_id: listId,
  });
  if (error) {
    throw error;
  }
  if (data !== true) {
    throw new Error('Nie udało się usunąć listy zakupowej.');
  }
}

export async function fetchShoppingItems(listId: string): Promise<ShoppingItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('shopping_items')
    .select('id, list_id, name, quantity, unit, category, is_purchased, created_at, updated_at')
    .eq('list_id', listId)
    .is('deleted_at', null)
    .order('is_purchased', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function addShoppingItem(
  listId: string,
  userId: string,
  name: string,
  quantity: number | null,
  unit: ShoppingUnit | null,
  category: ShoppingCategoryId | null,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('shopping_items').insert({
    list_id: listId,
    name,
    quantity,
    unit,
    category,
    created_by: userId,
  });

  if (error) {
    throw error;
  }
}

export async function updateShoppingItem(
  listId: string,
  itemId: string,
  name: string,
  quantity: number | null,
  unit: ShoppingUnit | null,
  category: ShoppingCategoryId | null,
  expectedUpdatedAt: string,
): Promise<void> {
  const { error } = await requireSupabase().rpc('update_shopping_item', {
    target_list_id: listId,
    target_item_id: itemId,
    target_name: name.trim(),
    target_quantity: quantity,
    target_unit: unit,
    target_category: category,
    target_expected_updated_at: expectedUpdatedAt,
  });
  if (error) {
    throw error;
  }
}

export async function setShoppingItemPurchased(
  listId: string,
  itemId: string,
  userId: string,
  isPurchased: boolean,
): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('shopping_items')
    .update({
      is_purchased: isPurchased,
      purchased_by: isPurchased ? userId : null,
      purchased_at: isPurchased ? new Date().toISOString() : null,
    })
    .eq('list_id', listId)
    .eq('id', itemId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('Nie znaleziono produktu na liście.');
  }
}

export async function deleteShoppingItem(listId: string, itemId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('shopping_items')
    .delete()
    .eq('list_id', listId)
    .eq('id', itemId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('Nie znaleziono produktu na liście.');
  }
}

export async function deletePurchasedShoppingItems(listId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('shopping_items')
    .delete()
    .eq('list_id', listId)
    .eq('is_purchased', true)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }
}
