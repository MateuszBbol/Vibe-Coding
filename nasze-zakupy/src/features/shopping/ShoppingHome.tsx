import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { recipeRoutes } from '@/features/recipes/routes';
import type { Household } from '@/features/households/data';
import { householdRoutes } from '@/features/households/routes';
import {
  addShoppingItem,
  createShoppingList,
  deleteShoppingItem,
  deletePurchasedShoppingItems,
  fetchShoppingItems,
  setShoppingItemPurchased,
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
import { ScreenHeader } from '@/components/ScreenHeader';
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
  const [activeTab, setActiveTab] = useState<'shopping' | 'todo'>('shopping');
  const [showUnitOptions, setShowUnitOptions] = useState(false);
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);
  const channelSequence = useRef(0);
  const categoryManuallyOverridden = useRef(false);
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
  const deletePurchasedMutation = useMutation({
    mutationFn: () => {
      if (!listId) {
        throw new Error('Najpierw utwórz listę zakupową.');
      }
      return deletePurchasedShoppingItems(listId);
    },
    onSuccess: async () => {
      setActionError(null);
      await refreshItems();
    },
    onError: (error: unknown) => {
      logFeatureError('[shopping item] delete purchased failed', error);
      setActionError(getFeatureErrorMessage(error));
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => {
      if (!listId) {
        throw new Error('Najpierw utwórz listę zakupową.');
      }
      return deleteShoppingItem(listId, itemId);
    },
    onSuccess: async () => {
      setActionError(null);
      await refreshItems();
    },
    onError: (error: unknown) => {
      logFeatureError('[shopping item] delete failed', error, {
        userId,
        householdId: household.id,
        listId,
      });
      setActionError(getFeatureErrorMessage(error));
    },
  });
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
  const items = itemsQuery.data ?? [];
  const itemsToBuy = groupUnpurchasedItems(items);
  const purchasedItems = items.filter((item) => item.is_purchased);

  const renderItem = (item: ShoppingItem) => (
    <View
      key={item.id}
      testID={`shopping-item-${item.id}`}
      style={[styles.item, { borderBottomColor: colors.border }]}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.is_purchased, disabled: toggleMutation.isPending }}
        accessibilityLabel={[item.name, formatShoppingItemQuantity(item.quantity, item.unit)]
          .filter(Boolean)
          .join(', ')}
        testID={`shopping-item-checkbox-${item.id}`}
        disabled={toggleMutation.isPending}
        onPress={() => toggleMutation.mutate({ itemId: item.id, purchased: !item.is_purchased })}
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
              style={[styles.quantity, { color: colors.secondaryText }]}
            >
              {formatShoppingItemQuantity(item.quantity, item.unit)}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${text.deleteItem}: ${item.name}`}
        accessibilityState={{ disabled: deleteMutation.isPending }}
        testID={`shopping-item-delete-${item.id}`}
        disabled={deleteMutation.isPending}
        onPress={() => deleteMutation.mutate(item.id)}
        hitSlop={8}
        style={styles.deleteButton}
      >
        <SymbolView
          name={{ ios: 'trash', android: 'delete_outline', web: 'delete_outline' }}
          tintColor={colors.secondaryText}
          size={20}
        />
      </Pressable>
    </View>
  );

  const navigation = (
    <View style={styles.navigationButtons}>
      <Pressable
        accessibilityRole="button"
        testID="navigation-recipes"
        onPress={() => router.push(recipeRoutes.list(household.id))}
        style={({ pressed }) => [
          styles.navigationButton,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Text style={[styles.navigationButtonText, { color: colors.accent }]}>
          📖 {strings.pl.recipes.open}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        testID="navigation-households"
        onPress={() => router.push(householdRoutes.root())}
        style={({ pressed }) => [
          styles.navigationButton,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Text style={[styles.navigationButtonText, { color: colors.accent }]}>
          🏠 {strings.pl.household.listTitle}
        </Text>
      </Pressable>
    </View>
  );
  const tabs = (
    <View
      accessibilityRole="tablist"
      testID="home-section-tabs"
      style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'shopping' }}
        testID="home-tab-shopping"
        onPress={() => setActiveTab('shopping')}
        style={[
          styles.tab,
          activeTab === 'shopping'
            ? { backgroundColor: colors.accent, borderColor: colors.accent }
            : { borderColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.tabText,
            { color: activeTab === 'shopping' ? colors.background : colors.text },
          ]}
        >
          🛒 {strings.pl.shopping.shoppingTab}{' '}
          {itemsQuery.data?.filter((item) => !item.is_purchased).length ?? 0}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'todo' }}
        testID="home-tab-todo"
        onPress={() => setActiveTab('todo')}
        style={[
          styles.tab,
          activeTab === 'todo'
            ? { backgroundColor: colors.accent, borderColor: colors.accent }
            : { borderColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.tabText,
            { color: activeTab === 'todo' ? colors.background : colors.text },
          ]}
        >
          ✓ {strings.pl.shopping.todoTab} {todoCount}
        </Text>
      </Pressable>
    </View>
  );
  if (!list) {
    return (
      <SafeAreaView
        testID="shopping-screen"
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <ScrollView
          testID="shopping-list"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ShoppingAppHeader
            userName={displayName}
            householdName={household.name}
            title={text.title}
            signOutLabel={text.signOut}
            isSigningOut={isSigningOut}
            onSignOut={onSignOut}
          />
          {navigation}
          {tabs}
          <View style={activeTab === 'shopping' ? undefined : styles.hiddenSection}>
            <View
              testID="shopping-no-list-state"
              style={[styles.noListCard, { backgroundColor: colors.card }]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{text.noListsTitle}</Text>
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
                  styles.navigationButton,
                  styles.fullWidthNavigationButton,
                  {
                    backgroundColor: colors.accent,
                    borderColor: colors.accent,
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      testID="shopping-screen"
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView
        testID="shopping-list"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ShoppingAppHeader
          userName={displayName}
          householdName={household.name}
          title={text.title}
          signOutLabel={text.signOut}
          isSigningOut={isSigningOut}
          onSignOut={onSignOut}
        />
        {navigation}
        {tabs}
        <View style={activeTab === 'shopping' ? undefined : styles.hiddenSection}>
          <ScreenHeader title={text.listName} />
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
                  <View style={styles.selectorColumn}>
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
                      placeholder={text.quantityPlaceholder}
                      placeholderTextColor={colors.secondaryText}
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
                      onPress={() => setShowUnitOptions((visible) => !visible)}
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
                        {value ?? text.noUnit}
                      </Text>
                      <Text style={[styles.selectorChange, { color: colors.accent }]}>
                        {showUnitOptions ? '‹' : '⌄'}
                      </Text>
                    </Pressable>
                    {showUnitOptions ? (
                      <View style={styles.unitOptions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: value === null }}
                          testID="shopping-unit-option-none"
                          disabled={addMutation.isPending}
                          onPress={() => {
                            onChange(null);
                            setShowUnitOptions(false);
                          }}
                          style={[
                            styles.unitOption,
                            {
                              backgroundColor:
                                value === null ? colors.accentSoft : colors.background,
                              borderColor: value === null ? colors.accent : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.unitOptionText,
                              { color: value === null ? colors.accent : colors.text },
                            ]}
                          >
                            {text.noUnit}
                          </Text>
                        </Pressable>
                        {shoppingUnits.map((unit) => {
                          const selected = value === unit;
                          return (
                            <Pressable
                              key={unit}
                              accessibilityRole="button"
                              accessibilityLabel={`${text.unitLabel}: ${unit}`}
                              accessibilityState={{ selected }}
                              testID={`shopping-unit-option-${unit}`}
                              disabled={addMutation.isPending}
                              onPress={() => {
                                onChange(unit);
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
                  </View>
                )}
              />
              <Controller
                control={control}
                name="category"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.selectorColumn}>
                    <Text style={[styles.selectorLabel, { color: colors.secondaryText }]}>
                      {text.categoryLabel}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${text.categoryLabel}: ${getShoppingCategory(value).label}`}
                      accessibilityState={{ expanded: showCategoryOptions }}
                      testID="shopping-category-select"
                      disabled={addMutation.isPending}
                      onPress={() => setShowCategoryOptions((visible) => !visible)}
                      style={[
                        styles.selectorButton,
                        {
                          backgroundColor: colors.background,
                          borderColor: showCategoryOptions ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.selectorValue, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {getShoppingCategory(value).emoji} {getShoppingCategory(value).label}
                      </Text>
                      <Text style={[styles.selectorChange, { color: colors.accent }]}>
                        {showCategoryOptions ? '‹' : '›'}
                      </Text>
                    </Pressable>
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
                  </View>
                )}
              />
            </View>
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
                {addMutation.isPending ? text.adding : `+ ${text.addButton}`}
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
              <Text style={[styles.message, { color: colors.secondaryText }]}>{text.loading}</Text>
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
              <Text
                accessibilityRole="header"
                style={[styles.sectionTitle, styles.centeredSectionTitle, { color: colors.text }]}
              >
                {text.toBuy}
              </Text>
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
                  <Text
                    accessibilityRole="header"
                    style={[styles.sectionTitle, { color: colors.text }]}
                  >
                    {text.purchased} ({purchasedItems.length})
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: deletePurchasedMutation.isPending }}
                    testID="shopping-clear-completed-button"
                    disabled={deletePurchasedMutation.isPending}
                    onPress={() => {
                      setActionError(null);
                      deletePurchasedMutation.mutate();
                    }}
                    style={({ pressed }) => [
                      styles.deletePurchasedButton,
                      { opacity: pressed || deletePurchasedMutation.isPending ? 0.6 : 1 },
                    ]}
                  >
                    <Text style={[styles.deletePurchasedText, { color: colors.accent }]}>
                      {deletePurchasedMutation.isPending
                        ? text.deletingPurchased
                        : text.deletePurchased}
                    </Text>
                  </Pressable>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: 13,
  },
  navigationButton: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },
  navigationButtonText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  fullWidthNavigationButton: {
    width: '100%',
    flex: undefined,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.one,
    marginBottom: Spacing.three,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.one,
  },
  tabText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  hiddenSection: { display: 'none' },
  noListCard: {
    gap: Spacing.two,
    borderRadius: 18,
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
    padding: Spacing.two,
    marginBottom: 13,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
  },
  quantityInput: {
    width: '100%',
    minWidth: 0,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    textAlign: 'center',
    paddingHorizontal: Spacing.one,
    fontSize: 14,
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
    minWidth: 95,
    gap: Spacing.one,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectorButton: {
    minHeight: 36,
    width: '100%',
    minWidth: 0,
    flexShrink: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.one,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  selectorValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  selectorChange: {
    fontSize: 13,
    fontWeight: '600',
  },
  unitOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one,
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
    fontSize: 15,
    fontWeight: '500',
    fontStyle: 'italic',
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  centeredSectionTitle: {
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  deletePurchasedButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    marginTop: -Spacing.two,
    marginBottom: Spacing.one,
  },
  deletePurchasedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemsCard: {
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.four,
  },
  item: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: Spacing.three,
  },
  checkmark: {
    width: 24,
    fontSize: 23,
    textAlign: 'center',
  },
  itemTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
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
  deleteButton: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: Spacing.three,
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
