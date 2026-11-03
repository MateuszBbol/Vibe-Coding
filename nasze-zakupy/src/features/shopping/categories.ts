import type { ShoppingItem } from './data';

export const shoppingCategories = [
  { id: 'produce', label: 'Warzywa i owoce', emoji: '🥦', order: 1 },
  { id: 'bakery', label: 'Pieczywo', emoji: '🥖', order: 2 },
  { id: 'dairy', label: 'Nabiał i jajka', emoji: '🥛', order: 3 },
  { id: 'meat_fish', label: 'Mięso i ryby', emoji: '🥩', order: 4 },
  { id: 'groceries', label: 'Produkty spożywcze', emoji: '🍝', order: 5 },
  { id: 'frozen', label: 'Mrożonki', emoji: '❄️', order: 6 },
  { id: 'snacks', label: 'Przekąski i słodycze', emoji: '🍪', order: 7 },
  { id: 'drinks', label: 'Napoje', emoji: '🥤', order: 8 },
  { id: 'hygiene', label: 'Chemia i higiena', emoji: '🧴', order: 9 },
  { id: 'home', label: 'Dom', emoji: '🏠', order: 10 },
  { id: 'other', label: 'Inne', emoji: '📦', order: 11 },
] as const;

export type ShoppingCategoryId = (typeof shoppingCategories)[number]['id'];
export type ShoppingCategory = (typeof shoppingCategories)[number];

const categoriesById = new Map<string, ShoppingCategory>(
  shoppingCategories.map((category) => [category.id, category]),
);

export function getShoppingCategory(categoryId: string | null | undefined): ShoppingCategory {
  return categoriesById.get(categoryId ?? '') ?? shoppingCategories[10];
}

export type ShoppingCategoryGroup = {
  category: ShoppingCategory;
  items: ShoppingItem[];
};

export function groupUnpurchasedItems(items: ShoppingItem[]): ShoppingCategoryGroup[] {
  const groupedItems = new Map<ShoppingCategoryId, ShoppingItem[]>();

  for (const item of items) {
    if (item.is_purchased) {
      continue;
    }

    const category = getShoppingCategory(item.category);
    const group = groupedItems.get(category.id) ?? [];
    group.push(item);
    groupedItems.set(category.id, group);
  }

  return shoppingCategories.flatMap((category) => {
    const categoryItems = groupedItems.get(category.id);
    return categoryItems ? [{ category, items: categoryItems }] : [];
  });
}
