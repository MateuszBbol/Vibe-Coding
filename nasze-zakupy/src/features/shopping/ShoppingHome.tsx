import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getFeatureErrorMessage, logFeatureError } from '@/features/errors';
import type { Household } from '@/features/households/data';
import {
  addShoppingItem,
  createShoppingList,
  deleteShoppingItem,
  fetchShoppingItems,
  setShoppingItemPurchased,
  updateShoppingItem,
} from '@/features/shopping/data';
import type { ShoppingItem, ShoppingList } from '@/features/shopping/data';
import {
  getShoppingCategory,
  groupUnpurchasedItems,
  shoppingCategories,
} from '@/features/shopping/categories';
import { formatShoppingItemQuantity } from '@/features/shopping/format';
import { categoryAfterProductNameChange } from '@/features/shopping/productCategories';
import {
  createShoppingItemDeleteFilters,
  getDeletedShoppingItemId,
  removeDeletedShoppingItem,
} from '@/features/shopping/realtime';
import { shoppingItemSchema, shoppingUnits } from '@/features/shopping/schemas';
import type { ShoppingItemInput, ShoppingItemValues } from '@/features/shopping/schemas';
import { Colors, Spacing } from '@/constants/theme';
import { AppBottomNav } from '@/components/AppBottomNav';
import type { HomeSection } from '@/components/AppBottomNav';
import { ShoppingAppHeader } from '@/features/shopping/ShoppingAppHeader';
import { TodoSection } from '@/features/todo/TodoSection';
import { fetchTodoItems } from '@/features/todo/data';
import { strings } from '@/localization';
import { supabase } from '@/lib/supabase/client';

type ShoppingHomeProps = {
  household: Household;
  list: ShoppingList | null;
  userId: string;
  displayName: string;
  onSignOut: () => void;
  isSigningOut: boolean;
  signOutError: string | null;
};

// How long a deleted item can be restored before the delete is sent to the server.
const UNDO_DELETE_MS = 5000;

type PendingDelete = {
  listId: string;
  ids: string[];
  message: string;
  timer: ReturnType<typeof setTimeout>;
};

type RealtimeEventPayload = {
  eventType: string;
  new?: { id?: unknown } | null;
  old?: { id?: unknown } | null;
};

function logRealtimeEvent(payload: RealtimeEventPayload): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[shopping_items realtime]', {
      eventType: payload.eventType,
      newId: payload.new?.id ?? null,
      oldId: payload.old?.id ?? null,
    });
  }
}

export function ShoppingHome({
  household,
  list,
  userId,
  displayName,
  onSignOut,
  isSigningOut,
  signOutError,
}: ShoppingHomeProps) {
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const text = strings.pl.shopping;
  const listId = list?.id;
  const queryKey = useMemo(() => ['shopping-items', listId ?? ''] as const, [listId]);
  const todoQueryKey = useMemo(() => ['todo-items', household.id] as const, [household.id]);
  const activeListQueryKey = useMemo(
    () => ['active-shopping-list', userId, household.id] as const,
    [household.id, userId],
  );
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>(
    supabase ? 'connecting' : 'error',
  );
  const [realtimeAttempt, setRealtimeAttempt] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  // The section lives in the URL so refresh and direct links keep it. Tasks are the
  // default; shopping is /home?section=shopping.
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const sectionParam = Array.isArray(params.section) ? params.section[0] : params.section;
  const activeTab: HomeSection = sectionParam === 'shopping' ? 'shopping' : 'todo';
  const selectSection = (section: HomeSection) => {
    router.setParams({ section: section === 'shopping' ? 'shopping' : undefined });
  };
  const [showUnitOptions, setShowUnitOptions] = useState(false);
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState<ShoppingItem['unit']>(null);
  const [editCategory, setEditCategory] = useState<ShoppingItem['category']>(null);
  const [editUnitOptionsOpen, setEditUnitOptionsOpen] = useState(false);
  const [editCategoryOptionsOpen, setEditCategoryOptionsOpen] = useState(false);
  const channelSequence = useRef(0);
  const categoryManuallyOverridden = useRef(false);
  const pendingDeleteRef = useRef<PendingDelete | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; message: string } | null>(
    null,
  );
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ShoppingItemInput, unknown, ShoppingItemValues>({
    resolver: zodResolver(shoppingItemSchema),
    defaultValues: { name: '', quantity: '', unit: null, category: null },
  });
  const itemsQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!listId) {
        throw new Error('Najpierw utwórz listę zakupową.');
      }
      return fetchShoppingItems(listId);
    },
    enabled: Boolean(listId),
  });
  const todoItemsQuery = useQuery({
    queryKey: todoQueryKey,
    queryFn: () => fetchTodoItems(household.id),
  });
  const todoCount = (todoItemsQuery.data ?? []).filter((item) => !item.completed).length;
  const cachedItemIds = useMemo(
    () =>
      (itemsQuery.data ?? [])
        .map((item) => item.id)
        .sort()
        .join(','),
    [itemsQuery.data],
  );

  const refreshItems = () => queryClient.invalidateQueries({ queryKey });
  const addMutation = useMutation({
    mutationFn: (values: ShoppingItemValues) => {
      if (!listId) {
        throw new Error('Najpierw utwórz listę zakupową.');
      }
      return addShoppingItem(
        listId,
        userId,
        values.name,
        values.quantity,
        values.unit,
        values.category,
      );
    },
    onSuccess: async () => {
      reset();
      categoryManuallyOverridden.current = false;
      setShowUnitOptions(false);
      setShowCategoryOptions(false);
      setActionError(null);
      await refreshItems();
    },
    onError: (error: unknown) => {
      logFeatureError('[shopping item] add failed', error);
      setActionError(getFeatureErrorMessage(error));
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      itemId,
      expectedUpdatedAt,
      values,
    }: {
      itemId: string;
      expectedUpdatedAt: string;
      values: {
        name: string;
        quantity: number | null;
        unit: ShoppingItem['unit'];
        category: ShoppingItem['category'];
      };
    }) => {
      if (!listId) {
        throw new Error('Najpierw utwórz listę zakupową.');
      }
      return updateShoppingItem(
        listId,
        itemId,
        values.name,
        values.quantity,
        values.unit,
        values.category,
        expectedUpdatedAt,
      );
    },
    onSuccess: async () => {
      setEditingItemId(null);
      setEditName('');
      setEditQuantity('');
      setEditUnit(null);
      setEditCategory(null);
      setEditUnitOptionsOpen(false);
      setEditCategoryOptionsOpen(false);
      setActionError(null);
      await refreshItems();
    },
    onError: async (error: unknown) => {
      logFeatureError('[shopping item] update failed', error, {
        userId,
        householdId: household.id,
        listId,
      });
      const errorText =
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string'
          ? error.message.toLowerCase()
          : '';
      if (errorText.includes('changed by another user')) {
        // Someone else saved first: reload so the next attempt uses the current version.
        await refreshItems();
      }
      const message = errorText.includes('cannot be safely merged')
        ? text.itemMergeConflict
        : errorText.includes('changed by another user')
          ? text.itemChangedConflict
          : getFeatureErrorMessage(error);
      setActionError(message);
    },
  });
  const toggleMutation = useMutation({
    mutationFn: ({ itemId, purchased }: { itemId: string; purchased: boolean }) => {
      if (!listId) {
        throw new Error('Najpierw utwórz listę zakupową.');
      }
      return setShoppingItemPurchased(listId, itemId, userId, purchased);
    },
    onSuccess: async () => {
      setActionError(null);
      await refreshItems();
    },
    onError: (error: unknown) => {
      logFeatureError('[shopping item] toggle bought failed', error);
      setActionError(getFeatureErrorMessage(error));
    },
  });
  // Deletes are applied after a short undo window. Until then the ids are hidden
  // locally and nothing is sent to the server, so "Cofnij" is a plain local cancel.
  const commitPendingDelete = useCallback(async () => {
    const pending = pendingDeleteRef.current;
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    pendingDeleteRef.current = null;
    setPendingDelete(null);

    const results = await Promise.allSettled(
      pending.ids.map((itemId) => deleteShoppingItem(pending.listId, itemId)),
    );
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failure) {
      logFeatureError('[shopping item] delete failed', failure.reason, {
        userId,
        householdId: household.id,
        listId: pending.listId,
      });
      setActionError(getFeatureErrorMessage(failure.reason));
    }
    await queryClient.invalidateQueries({ queryKey: ['shopping-items', pending.listId] });
  }, [household.id, queryClient, userId]);

  const scheduleDelete = (ids: string[], message: string) => {
    if (!listId || ids.length === 0) {
      return;
    }
    // A previous undo window closes now, so only one pending delete exists at a time.
    void commitPendingDelete();
    setActionError(null);
    if (editingItemId && ids.includes(editingItemId)) {
      setEditingItemId(null);
    }
    const timer = setTimeout(() => void commitPendingDelete(), UNDO_DELETE_MS);
    pendingDeleteRef.current = { listId, ids, message, timer };
    setPendingDelete({ ids, message });
  };

  const undoDelete = () => {
    const pending = pendingDeleteRef.current;
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    pendingDeleteRef.current = null;
    setPendingDelete(null);
  };

  // Leaving the screen must not drop a pending delete: send it now.
  useEffect(() => {
    return () => {
      void commitPendingDelete();
    };
  }, [commitPendingDelete]);
  const createListMutation = useMutation({
    mutationFn: () => createShoppingList(household.id),
    onSuccess: async (createdList) => {
      queryClient.setQueryData(activeListQueryKey, createdList);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: activeListQueryKey });
    },
    onError: (error: unknown) => {
      logFeatureError('[shopping list] create failed', error, {
        userId,
        householdId: household.id,
      });
      setActionError(getFeatureErrorMessage(error));
    },
  });
  useEffect(() => {
    if (itemsQuery.isError && listId) {
      logFeatureError('[shopping items] load failed', itemsQuery.error, {
        userId,
        householdId: household.id,
        listId,
      });
    }
  }, [household.id, itemsQuery.error, itemsQuery.isError, listId, userId]);

  useEffect(() => {
    const client = supabase;
    if (!client || !listId) {
      return;
    }

    let active = true;
    channelSequence.current += 1;
    const channelId = `shopping-items:${listId}:${realtimeAttempt}:${channelSequence.current}`;
    let channel = client
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shopping_items',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          logRealtimeEvent(payload);
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shopping_items',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          logRealtimeEvent(payload);
          void queryClient.invalidateQueries({ queryKey });
        },
      );

    const cachedIds = cachedItemIds ? cachedItemIds.split(',') : [];
    for (const filter of createShoppingItemDeleteFilters(cachedIds)) {
      channel = channel.on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shopping_items',
          filter,
        },
        (payload) => {
          logRealtimeEvent(payload);
          if (payload.eventType === 'DELETE') {
            void queryClient.invalidateQueries({ queryKey: ['households', userId] });
          }
          const deletedId = getDeletedShoppingItemId(payload);
          if (!deletedId) {
            return;
          }

          void (async () => {
            try {
              await queryClient.cancelQueries({ queryKey });
              let hasCachedItems = false;
              queryClient.setQueryData<ShoppingItem[]>(queryKey, (currentItems) => {
                if (!currentItems) {
                  return currentItems;
                }
                hasCachedItems = true;
                return removeDeletedShoppingItem(currentItems, deletedId);
              });
              if (!hasCachedItems) {
                await queryClient.invalidateQueries({ queryKey });
              }
            } catch (error) {
              logFeatureError('[realtime] update shopping cache failed', error, {
                userId,
                householdId: household.id,
                listId,
              });
              setActionError(getFeatureErrorMessage(error));
            }
          })();
        },
      );
    }

    channel = channel.subscribe((status) => {
      if (!active) {
        return;
      }
      if (status === 'SUBSCRIBED') {
        setRealtimeStatus('connected');
        void queryClient.invalidateQueries({ queryKey });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setRealtimeStatus('error');
        logFeatureError('[realtime] shopping items subscription failed', status, {
          userId,
          householdId: household.id,
          listId,
        });
      } else if (status === 'CLOSED') {
        setRealtimeStatus('error');
        logFeatureError('[realtime] shopping items subscription closed', status, {
          userId,
          householdId: household.id,
          listId,
        });
      }
    });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [cachedItemIds, household.id, listId, queryClient, queryKey, realtimeAttempt, userId]);

  useEffect(() => {
    if (itemsQuery.isError) {
      void queryClient.invalidateQueries({ queryKey: ['households', userId] });
    }
  }, [itemsQuery.isError, queryClient, userId]);

  const addItem = (values: ShoppingItemValues) => {
    setActionError(null);
    addMutation.mutate(values);
  };
  const beginItemEdit = (item: ShoppingItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditQuantity(item.quantity?.toString() ?? '');
    setEditUnit(item.unit);
    setEditCategory(item.category);
    setEditUnitOptionsOpen(false);
    setEditCategoryOptionsOpen(false);
    setActionError(null);
  };
  const cancelItemEdit = () => {
    setEditingItemId(null);
    setEditName('');
    setEditQuantity('');
    setEditUnit(null);
    setEditCategory(null);
    setEditUnitOptionsOpen(false);
    setEditCategoryOptionsOpen(false);
    setActionError(null);
  };
  const saveItemEdit = (item: ShoppingItem) => {
    // Quantity is required when editing, as it is when adding.
    const parsed = shoppingItemSchema.safeParse({
      name: editName,
      quantity: editQuantity,
      unit: editUnit,
      category: editCategory,
    });
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? text.actionFailed);
      return;
    }

    setActionError(null);
    updateMutation.mutate({
      itemId: item.id,
      expectedUpdatedAt: item.updated_at,
      values: parsed.data,
    });
  };
  // Items waiting in the undo window stay hidden even if a refetch returns them.
  const hiddenItemIds = new Set(pendingDelete?.ids ?? []);
  const items = (itemsQuery.data ?? []).filter((item) => !hiddenItemIds.has(item.id));
  const itemsToBuy = groupUnpurchasedItems(items);
  const purchasedItems = items.filter((item) => item.is_purchased);

  const renderItem = (item: ShoppingItem, index: number, all: ShoppingItem[]) => {
    const isEditing = editingItemId === item.id;
    const isItemActionPending = updateMutation.isPending || toggleMutation.isPending;

    return (
      <View
        key={item.id}
        testID={`shopping-item-${item.id}`}
        style={[
          styles.item,
          { borderBottomColor: colors.border },
          index === all.length - 1 && styles.lastItem,
        ]}
      >
        {isEditing ? null : (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: item.is_purchased,
              disabled: isItemActionPending || isEditing,
            }}
            aria-checked={item.is_purchased}
            accessibilityLabel={[item.name, formatShoppingItemQuantity(item.quantity, item.unit)]
              .filter(Boolean)
              .join(', ')}
            testID={`shopping-item-checkbox-${item.id}`}
            disabled={isItemActionPending || isEditing}
            onPress={() =>
              toggleMutation.mutate({ itemId: item.id, purchased: !item.is_purchased })
            }
            style={styles.itemToggle}
          >
            <Text
              style={[
                styles.checkmark,
                { color: item.is_purchased ? colors.accent : colors.secondaryText },
              ]}
            >
              {item.is_purchased ? '✓' : '○'}
            </Text>
          </Pressable>
        )}
        {isEditing ? (
          <View style={[styles.itemTextContainer, styles.editItemForm]}>
            <TextInput
              accessibilityLabel={text.editItem}
              testID={`shopping-edit-name-${item.id}`}
              editable={!updateMutation.isPending}
              maxLength={120}
              onChangeText={setEditName}
              style={[
                styles.nameInput,
                styles.editNameInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={editName}
            />
            <View style={styles.editItemSelectors}>
              <TextInput
                accessibilityLabel={text.quantityLabel}
                testID={`shopping-edit-quantity-${item.id}`}
                editable={!updateMutation.isPending}
                keyboardType="decimal-pad"
                onChangeText={setEditQuantity}
                placeholder={text.quantityPlaceholder}
                placeholderTextColor={colors.secondaryText}
                style={[
                  styles.quantityInput,
                  styles.editQuantityInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={editQuantity}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.unitLabel}
                testID={`shopping-edit-unit-${item.id}`}
                onPress={() => setEditUnitOptionsOpen((open) => !open)}
                style={[
                  styles.editSelector,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Text style={{ color: colors.text }}>{editUnit ?? ''}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.categoryLabel}
                testID={`shopping-edit-category-${item.id}`}
                onPress={() => setEditCategoryOptionsOpen((open) => !open)}
                style={[
                  styles.editSelector,
                  styles.editCategorySelector,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Text style={{ color: colors.text }} numberOfLines={1}>
                  {getShoppingCategory(editCategory).emoji}{' '}
                  {getShoppingCategory(editCategory).label}
                </Text>
              </Pressable>
            </View>
            {editUnitOptionsOpen ? (
              <View style={styles.editOptions}>
                {/* No unit = nothing selected; tapping the selected unit clears it. */}
                {shoppingUnits.map((unit) => (
                  <Pressable
                    key={unit}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: editUnit === unit }}
                    aria-checked={editUnit === unit}
                    testID={`shopping-edit-unit-option-${unit}`}
                    onPress={() => {
                      setEditUnit(editUnit === unit ? null : unit);
                      setEditUnitOptionsOpen(false);
                    }}
                    style={[
                      styles.categoryOption,
                      {
                        backgroundColor: editUnit === unit ? colors.accentSoft : colors.background,
                        borderColor: editUnit === unit ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.categoryOptionText, { color: colors.text }]}>{unit}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {editCategoryOptionsOpen ? (
              <View style={styles.editOptions}>
                {shoppingCategories.map((category) => (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: editCategory === category.id }}
                    testID={`shopping-edit-category-option-${category.id}`}
                    onPress={() => {
                      setEditCategory(category.id);
                      setEditCategoryOptionsOpen(false);
                    }}
                    style={[
                      styles.categoryOption,
                      {
                        backgroundColor:
                          editCategory === category.id ? colors.accentSoft : colors.background,
                        borderColor: editCategory === category.id ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.categoryOptionText, { color: colors.text }]}>
                      {category.emoji} {category.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.editItemActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.saveItem}
                testID={`shopping-edit-save-${item.id}`}
                disabled={updateMutation.isPending}
                onPress={() => saveItemEdit(item)}
                hitSlop={6}
                style={[styles.editIconButton, { backgroundColor: colors.accent }]}
              >
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  tintColor={colors.background}
                  size={20}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.cancelItemEdit}
                testID={`shopping-edit-cancel-${item.id}`}
                disabled={updateMutation.isPending}
                onPress={cancelItemEdit}
                hitSlop={6}
                style={[
                  styles.editIconButton,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  styles.editIconButtonSecondary,
                ]}
              >
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  tintColor={colors.secondaryText}
                  size={20}
                />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.itemTextContainer}>
            <Text
              testID={`shopping-item-name-${item.id}`}
              style={[
                styles.itemName,
                {
                  color: item.is_purchased ? colors.secondaryText : colors.text,
                  textDecorationLine: item.is_purchased ? 'line-through' : 'none',
                },
              ]}
            >
              {item.name}
            </Text>
            {formatShoppingItemQuantity(item.quantity, item.unit) ? (
              <Text
                testID={`shopping-item-quantity-${item.id}`}
                style={[
                  styles.quantity,
                  {
                    color: colors.secondaryText,
                    textDecorationLine: item.is_purchased ? 'line-through' : 'none',
                  },
                ]}
              >
                {formatShoppingItemQuantity(item.quantity, item.unit)}
              </Text>
            ) : null}
          </View>
        )}
        {/* While editing, the check and X icons in the form are the only actions. */}
        {isEditing ? null : (
          <View style={styles.itemActions}>
            {/* Only items still to buy can be edited; the spacer keeps the delete icons aligned. */}
            {item.is_purchased && !isEditing ? (
              <View style={styles.itemActionButton} />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.editItem}
                accessibilityHint={text.editItem}
                accessibilityState={{ disabled: isItemActionPending }}
                testID={`shopping-item-edit-${item.id}`}
                disabled={isItemActionPending}
                onPress={() => (isEditing ? cancelItemEdit() : beginItemEdit(item))}
                hitSlop={6}
                style={styles.itemActionButton}
              >
                <SymbolView
                  name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                  tintColor={colors.secondaryText}
                  size={18}
                />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text.deleteItem}
              accessibilityHint={text.deleteItem}
              accessibilityState={{ disabled: isItemActionPending }}
              testID={`shopping-item-delete-${item.id}`}
              disabled={isItemActionPending}
              onPress={() => scheduleDelete([item.id], text.undoDeleted(item.name))}
              hitSlop={6}
              style={styles.itemActionButton}
            >
              <SymbolView
                name={{ ios: 'trash', android: 'delete_outline', web: 'delete_outline' }}
                tintColor={colors.secondaryText}
                size={18}
              />
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const bottomNav = (
    <AppBottomNav
      active={activeTab}
      counts={{
        shopping: items.filter((item) => !item.is_purchased).length,
        todo: todoCount,
      }}
      onSelectHomeSection={selectSection}
    />
  );
  if (!list) {
    return (
      <SafeAreaView
        testID="shopping-screen"
        edges={['top', 'left', 'right']}
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <ScrollView
          testID="shopping-list"
          style={styles.body}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ShoppingAppHeader
            userName={displayName}
            activeListName={household.name}
            noActiveListLabel={text.noActiveList}
            title={text.title}
            signOutLabel={text.signOut}
            isSigningOut={isSigningOut}
            onSignOut={onSignOut}
          />
          <View style={activeTab === 'shopping' ? undefined : styles.hiddenSection}>
            <View
              testID="shopping-no-list-state"
              style={[styles.noListCard, { backgroundColor: colors.card }]}
            >
              <Text style={[styles.noListTitle, { color: colors.text }]}>{text.noListsTitle}</Text>
              <Text style={[styles.message, { color: colors.secondaryText }]}>
                {text.noListsDescription}
              </Text>
              {actionError ? (
                <Text
                  accessibilityRole="alert"
                  testID="shopping-action-error-message"
                  style={styles.error}
                >
                  {actionError}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: createListMutation.isPending }}
                testID="shopping-create-list-button"
                disabled={createListMutation.isPending}
                onPress={() => {
                  setActionError(null);
                  createListMutation.mutate();
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: colors.accent,
                    opacity: pressed || createListMutation.isPending ? 0.65 : 1,
                  },
                ]}
              >
                <Text style={[styles.createListButtonText, { color: colors.background }]}>
                  {createListMutation.isPending ? text.creatingList : text.createList}
                </Text>
              </Pressable>
            </View>
          </View>
          <TodoSection
            key={household.id}
            householdId={household.id}
            userId={userId}
            visible={activeTab === 'todo'}
          />
          {signOutError ? (
            <Text
              accessibilityRole="alert"
              testID="profile-logout-error-message"
              style={[styles.error, styles.signOutError]}
            >
              {signOutError}
            </Text>
          ) : null}
        </ScrollView>
        {bottomNav}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      testID="shopping-screen"
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.body}>
        <ScrollView
          testID="shopping-list"
          contentContainerStyle={[styles.content, pendingDelete ? styles.contentWithUndo : null]}
          keyboardShouldPersistTaps="handled"
        >
          <ShoppingAppHeader
            userName={displayName}
            activeListName={household.name}
            noActiveListLabel={text.noActiveList}
            title={text.title}
            signOutLabel={text.signOut}
            isSigningOut={isSigningOut}
            onSignOut={onSignOut}
          />
          <View style={activeTab === 'shopping' ? undefined : styles.hiddenSection}>
            {realtimeStatus !== 'connected' ? (
              <View
                testID="shopping-realtime-status"
                style={[styles.syncStatus, { backgroundColor: colors.accentSoft }]}
              >
                <View
                  style={[
                    styles.syncDot,
                    { backgroundColor: realtimeStatus === 'error' ? '#B42318' : colors.accent },
                  ]}
                />
                <Text
                  testID={
                    realtimeStatus === 'error'
                      ? 'shopping-realtime-error-message'
                      : 'shopping-realtime-connecting-message'
                  }
                  style={[styles.syncText, { color: colors.text }]}
                >
                  {realtimeStatus === 'error' ? text.realtimeError : text.realtimeConnecting}
                </Text>
                {realtimeStatus === 'error' ? (
                  <Pressable
                    accessibilityRole="button"
                    testID="shopping-realtime-retry-button"
                    onPress={() => {
                      setRealtimeStatus('connecting');
                      setRealtimeAttempt((attempt) => attempt + 1);
                    }}
                  >
                    <Text style={[styles.syncRetry, { color: colors.accent }]}>
                      {text.realtimeRetry}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View
              style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.addRow}>
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      accessibilityLabel={text.addLabel}
                      testID="shopping-product-input"
                      autoCapitalize="sentences"
                      editable={!addMutation.isPending}
                      maxLength={120}
                      onBlur={onBlur}
                      onChangeText={(name) => {
                        onChange(name);
                        setValue(
                          'category',
                          categoryAfterProductNameChange(
                            name,
                            getValues('category') ?? null,
                            categoryManuallyOverridden.current,
                          ),
                          { shouldDirty: true, shouldValidate: true },
                        );
                      }}
                      placeholder={text.addPlaceholder}
                      placeholderTextColor={colors.secondaryText}
                      returnKeyType="next"
                      style={[
                        styles.nameInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: errors.name ? '#B42318' : colors.border,
                          color: colors.text,
                        },
                      ]}
                      value={value}
                    />
                  )}
                />
              </View>
              <View style={styles.selectorsRow}>
                <Controller
                  control={control}
                  name="quantity"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={[styles.selectorColumn, styles.quantityColumn]}>
                      <Text style={[styles.selectorLabel, { color: colors.secondaryText }]}>
                        {text.quantityLabel}
                      </Text>
                      <TextInput
                        accessibilityLabel={text.quantityLabel}
                        testID="shopping-quantity-input"
                        editable={!addMutation.isPending}
                        keyboardType="decimal-pad"
                        onBlur={onBlur}
                        onChangeText={onChange}
                        returnKeyType="done"
                        style={[
                          styles.quantityInput,
                          {
                            backgroundColor: colors.background,
                            borderColor: errors.quantity ? '#B42318' : colors.border,
                            color: colors.text,
                          },
                        ]}
                        value={value}
                        onSubmitEditing={() => void handleSubmit(addItem)()}
                      />
                    </View>
                  )}
                />
                <Controller
                  control={control}
                  name="unit"
                  render={({ field: { onChange, value } }) => (
                    <View style={styles.selectorColumn}>
                      <Text style={[styles.selectorLabel, { color: colors.secondaryText }]}>
                        {text.unitLabel}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={text.unitLabel}
                        accessibilityState={{ expanded: showUnitOptions }}
                        testID="shopping-unit-select"
                        disabled={addMutation.isPending}
                        onPress={() => {
                          setShowCategoryOptions(false);
                          setShowUnitOptions((visible) => !visible);
                        }}
                        style={[
                          styles.selectorButton,
                          {
                            backgroundColor: colors.background,
                            borderColor: showUnitOptions ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.selectorValue, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {value ?? ''}
                        </Text>
                        <Text style={[styles.selectorChange, { color: colors.accent }]}>
                          {showUnitOptions ? '⌃' : '⌄'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                />
                <Controller
                  control={control}
                  name="category"
                  render={({ field: { onChange, value } }) => (
                    <View style={[styles.selectorColumn, styles.categoryColumn]}>
                      <Text style={[styles.selectorLabel, { color: colors.secondaryText }]}>
                        {text.categoryLabel}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${text.categoryLabel}: ${getShoppingCategory(value).label}`}
                        accessibilityState={{ expanded: showCategoryOptions }}
                        testID="shopping-category-select"
                        disabled={addMutation.isPending}
                        onPress={() => {
                          setShowUnitOptions(false);
                          setShowCategoryOptions((visible) => !visible);
                        }}
                        style={[
                          styles.selectorButton,
                          styles.categorySelectorButton,
                          {
                            backgroundColor: colors.background,
                            borderColor: showCategoryOptions ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.selectorValue,
                            styles.categoryValue,
                            { color: colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {getShoppingCategory(value).emoji} {getShoppingCategory(value).label}
                        </Text>
                        <Text style={[styles.selectorChange, { color: colors.accent }]}>
                          {showCategoryOptions ? '⌃' : '⌄'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                />
              </View>
              {/* Option lists open under the whole row so labels are not cut by a narrow column. */}
              <Controller
                control={control}
                name="unit"
                render={({ field: { onChange, value } }) => (
                  <>
                    {showUnitOptions ? (
                      <View style={styles.unitOptions}>
                        {/* No unit = nothing selected; tapping the selected unit clears it. */}
                        {shoppingUnits.map((unit) => {
                          const selected = value === unit;
                          return (
                            <Pressable
                              key={unit}
                              accessibilityRole="checkbox"
                              accessibilityLabel={`${text.unitLabel}: ${unit}`}
                              accessibilityState={{ checked: selected }}
                              aria-checked={selected}
                              testID={`shopping-unit-option-${unit}`}
                              disabled={addMutation.isPending}
                              onPress={() => {
                                onChange(selected ? null : unit);
                                setShowUnitOptions(false);
                              }}
                              style={[
                                styles.unitOption,
                                {
                                  backgroundColor: selected ? colors.accentSoft : colors.background,
                                  borderColor: selected ? colors.accent : colors.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.unitOptionText,
                                  { color: selected ? colors.accent : colors.text },
                                ]}
                              >
                                {unit}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </>
                )}
              />
              <Controller
                control={control}
                name="category"
                render={({ field: { onChange, value } }) => (
                  <>
                    {showCategoryOptions ? (
                      <View style={styles.categoryOptions}>
                        {shoppingCategories.map((category) => {
                          const selected = getShoppingCategory(value).id === category.id;
                          return (
                            <Pressable
                              key={category.id}
                              accessibilityRole="button"
                              accessibilityLabel={`${category.emoji} ${category.label}`}
                              accessibilityState={{ selected }}
                              testID={`shopping-category-option-${category.id}`}
                              disabled={addMutation.isPending}
                              onPress={() => {
                                categoryManuallyOverridden.current = true;
                                onChange(category.id);
                                setShowCategoryOptions(false);
                              }}
                              style={[
                                styles.categoryOption,
                                {
                                  backgroundColor: selected ? colors.accentSoft : colors.background,
                                  borderColor: selected ? colors.accent : colors.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.categoryOptionText,
                                  { color: selected ? colors.accent : colors.text },
                                ]}
                              >
                                {category.emoji} {category.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </>
                )}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: addMutation.isPending }}
                testID="shopping-add-button"
                disabled={addMutation.isPending}
                onPress={() => void handleSubmit(addItem)()}
                style={({ pressed }) => [
                  styles.addButton,
                  {
                    backgroundColor: colors.accent,
                    opacity: pressed || addMutation.isPending ? 0.7 : 1,
                  },
                ]}
              >
                {addMutation.isPending ? (
                  <ActivityIndicator
                    color={colorScheme === 'dark' ? '#151915' : '#FFFFFF'}
                    size="small"
                  />
                ) : null}
                <Text
                  style={[
                    styles.addButtonText,
                    { color: colorScheme === 'dark' ? '#151915' : '#FFFFFF' },
                  ]}
                >
                  {addMutation.isPending ? text.adding : text.addButton}
                </Text>
              </Pressable>
              {errors.name?.message ? (
                <Text
                  accessibilityRole="alert"
                  testID="shopping-product-error-message"
                  style={styles.error}
                >
                  {errors.name.message}
                </Text>
              ) : null}
              {errors.quantity?.message ? (
                <Text
                  accessibilityRole="alert"
                  testID="shopping-quantity-error-message"
                  style={styles.error}
                >
                  {errors.quantity.message}
                </Text>
              ) : null}
              {actionError ? (
                <Text
                  accessibilityRole="alert"
                  testID="shopping-action-error-message"
                  style={styles.error}
                >
                  {actionError}
                </Text>
              ) : null}
            </View>

            {itemsQuery.isPending ? (
              <View testID="shopping-loading" style={styles.loading}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={[styles.message, { color: colors.secondaryText }]}>
                  {text.loading}
                </Text>
              </View>
            ) : itemsQuery.isError ? (
              <View style={styles.queryError}>
                <Text
                  accessibilityRole="alert"
                  testID="shopping-load-error-message"
                  style={[styles.message, { color: colors.text }]}
                >
                  {text.loadError}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  testID="shopping-retry-button"
                  onPress={() => void itemsQuery.refetch()}
                >
                  <Text style={[styles.syncRetry, { color: colors.accent }]}>{text.retry}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.sectionHeader}>
                  <Text
                    accessibilityRole="header"
                    testID="shopping-to-buy-title"
                    style={[styles.sectionTitle, { color: colors.text }]}
                  >
                    {text.toBuy}
                  </Text>
                </View>
                {itemsToBuy.length > 0 ? (
                  itemsToBuy.map(({ category, items: categoryItems }) => (
                    <View key={category.id} testID={`shopping-category-${category.id}`}>
                      <Text
                        accessibilityRole="header"
                        style={[styles.categoryTitle, { color: colors.text }]}
                      >
                        {category.emoji} {category.label}
                      </Text>
                      <View style={[styles.itemsCard, { backgroundColor: colors.card }]}>
                        {categoryItems.map(renderItem)}
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={[styles.itemsCard, { backgroundColor: colors.card }]}>
                    <Text
                      testID="shopping-empty-state"
                      style={[styles.empty, { color: colors.secondaryText }]}
                    >
                      {text.empty}
                    </Text>
                  </View>
                )}

                {purchasedItems.length > 0 ? (
                  <>
                    <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
                      <Text
                        accessibilityRole="header"
                        testID="shopping-purchased-title"
                        style={[styles.sectionTitle, { color: colors.text }]}
                      >
                        {text.purchased}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={text.deletePurchased}
                        testID="shopping-clear-completed-button"
                        hitSlop={6}
                        onPress={() =>
                          scheduleDelete(
                            purchasedItems.map((item) => item.id),
                            text.undoDeletedPurchased(purchasedItems.length),
                          )
                        }
                        style={({ pressed }) => [
                          styles.deletePurchasedButton,
                          { opacity: pressed ? 0.6 : 1 },
                        ]}
                      >
                        <SymbolView
                          name={{ ios: 'trash', android: 'delete_outline', web: 'delete_outline' }}
                          tintColor={colors.secondaryText}
                          size={22}
                        />
                      </Pressable>
                    </View>
                    <View style={[styles.itemsCard, { backgroundColor: colors.card }]}>
                      {purchasedItems.map(renderItem)}
                    </View>
                  </>
                ) : null}
              </>
            )}
          </View>
          <TodoSection
            key={household.id}
            householdId={household.id}
            userId={userId}
            visible={activeTab === 'todo'}
          />

          {signOutError ? (
            <Text
              accessibilityRole="alert"
              testID="profile-logout-error-message"
              style={[styles.error, styles.signOutError]}
            >
              {signOutError}
            </Text>
          ) : null}
        </ScrollView>
        {pendingDelete ? (
          <View
            accessibilityLiveRegion="polite"
            testID="shopping-undo-bar"
            style={[styles.undoBar, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text numberOfLines={1} style={[styles.undoText, { color: colors.text }]}>
              {pendingDelete.message}
            </Text>
            <Pressable
              accessibilityRole="button"
              testID="shopping-undo-delete-button"
              onPress={undoDelete}
              hitSlop={8}
            >
              <Text style={[styles.undoAction, { color: colors.accent }]}>{text.undoAction}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {bottomNav}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  contentWithUndo: {
    paddingBottom: 96,
  },
  undoBar: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    bottom: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  undoText: {
    flex: 1,
    fontSize: 14,
  },
  undoAction: {
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: Spacing.three,
    // The header sits closer to the top edge.
    paddingTop: Spacing.one,
    paddingBottom: Spacing.six,
  },
  primaryButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  hiddenSection: { display: 'none' },
  noListCard: {
    gap: Spacing.two,
    borderRadius: 16,
    padding: Spacing.three,
  },
  createListButtonText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  syncStatus: {
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncText: {
    flex: 1,
    fontSize: 13,
  },
  syncRetry: {
    fontSize: 13,
    fontWeight: '600',
  },
  addCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  // 16 px text: smaller inputs make iOS Safari zoom in on focus and cut the layout.
  nameInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    fontSize: 16,
  },
  quantityInput: {
    width: '100%',
    minWidth: 0,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    textAlign: 'center',
    fontSize: 16,
  },
  addButton: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  addButtonText: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  selectorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  selectorColumn: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  quantityColumn: {
    flex: 0.7,
  },
  categoryColumn: {
    flex: 1.6,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectorButton: {
    height: 44,
    width: '100%',
    minWidth: 0,
    flexShrink: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorValue: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Category value sits at the left edge; the arrow stays on the right like the unit field.
  categorySelectorButton: {
    justifyContent: 'flex-start',
    paddingLeft: Spacing.two,
    paddingRight: 26,
  },
  categoryValue: {
    textAlign: 'left',
  },
  selectorChange: {
    position: 'absolute',
    right: Spacing.two,
    fontSize: 13,
    fontWeight: '600',
  },
  unitOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  unitOption: {
    minHeight: 32,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: Spacing.two,
  },
  unitOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryOptions: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  categoryOption: {
    minHeight: 34,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 19,
    paddingHorizontal: Spacing.two,
  },
  categoryOptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: Spacing.one,
  },
  // "Lista zakupów" and "Kupione" share this style so both headings look the same.
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  sectionHeaderSpaced: {
    marginTop: Spacing.two,
  },
  // Trash icon on the "Kupione" line, aligned with the delete icons of the rows below.
  deletePurchasedButton: {
    position: 'absolute',
    right: Spacing.two,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsCard: {
    borderRadius: 16,
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.three,
  },
  noListTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  item: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  itemToggle: {
    width: 34,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    width: 24,
    fontSize: 23,
    textAlign: 'center',
  },
  itemTextContainer: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  editItemForm: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  // flex: 0 collapsed the height on web; keep the natural 44 px input height.
  editNameInput: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  editQuantityInput: {
    width: undefined,
    flex: 1,
    minWidth: 72,
  },
  editItemSelectors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  editSelector: {
    flex: 1,
    minWidth: 72,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  editOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  editCategorySelector: {
    flex: 1.6,
    minWidth: 120,
  },
  editItemActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  editIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconButtonSecondary: {
    borderWidth: 1,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  quantity: {
    fontSize: 12,
    marginLeft: 'auto',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemActionButton: {
    width: 38,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },
  loading: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  queryError: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    color: '#B42318',
    fontSize: 14,
    lineHeight: 21,
    marginTop: Spacing.two,
  },
  signOutError: {
    marginTop: Spacing.three,
  },
});
