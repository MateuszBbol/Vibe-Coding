import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { getFeatureErrorMessage, logFeatureError } from '@/features/errors';
import {
  addTodoItem,
  deleteTodoItem,
  fetchTodoItems,
  normalizeTodoDueDate,
  updateTodoItem,
} from '@/features/todo/data';
import type { TodoItem } from '@/features/todo/data';
import { strings } from '@/localization';
import { supabase } from '@/lib/supabase/client';

type TodoSectionProps = {
  householdId: string;
  userId: string;
};

function formatDueDate(value: string): string {
  return value.split('-').reverse().join('.');
}

export function TodoSection({ householdId, userId }: TodoSectionProps) {
  const queryClient = useQueryClient();
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.shopping;
  const queryKey = useMemo(() => ['todo-items', householdId] as const, [householdId]);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState(false);
  const isRealtimeError = realtimeError || !supabase;
  const itemsQuery = useQuery({
    queryKey,
    queryFn: () => fetchTodoItems(householdId),
  });

  const refreshItems = () => queryClient.invalidateQueries({ queryKey });
  const addMutation = useMutation({
    mutationFn: ({ title, dueDate }: { title: string; dueDate: string }) =>
      addTodoItem(householdId, userId, title, dueDate),
    onSuccess: async () => {
      setNewTitle('');
      setNewDueDate('');
      setActionError(null);
      await refreshItems();
    },
    onError: (error: unknown) => {
      logFeatureError('[todo] add failed', error, { userId, householdId });
      setActionError(getFeatureErrorMessage(error));
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({
      itemId,
      values,
    }: {
      itemId: string;
      values: { title: string; dueDate: string; completed?: boolean };
    }) => updateTodoItem(householdId, itemId, values),
    onSuccess: async (_result, variables) => {
      if (variables.values.completed === undefined) {
        setEditingId(null);
        setEditTitle('');
        setEditDueDate('');
      }
      setActionError(null);
      await refreshItems();
    },
    onError: (error: unknown) => {
      logFeatureError('[todo] update failed', error, { userId, householdId });
      setActionError(getFeatureErrorMessage(error));
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteTodoItem(householdId, itemId),
    onSuccess: async () => {
      setActionError(null);
      setEditingId(null);
      await refreshItems();
    },
    onError: (error: unknown, itemId) => {
      logFeatureError('[todo] delete failed', error, { userId, householdId, itemId });
      setActionError(getFeatureErrorMessage(error));
    },
  });

  useEffect(() => {
    const client = supabase;
    if (!client) {
      return;
    }

    let active = true;
    const channel = client
      .channel(`todo-items:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todo_items',
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe((status) => {
        if (!active) {
          return;
        }
        if (status === 'SUBSCRIBED') {
          setRealtimeError(false);
          void queryClient.invalidateQueries({ queryKey });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeError(true);
          logFeatureError('[realtime] todo subscription failed', status, {
            userId,
            householdId,
          });
        }
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [householdId, queryClient, queryKey, userId]);

  useEffect(() => {
    if (itemsQuery.isError) {
      logFeatureError('[todo] load failed', itemsQuery.error, { userId, householdId });
    }
  }, [householdId, itemsQuery.error, itemsQuery.isError, userId]);

  const validateInput = (title: string, dueDate: string): boolean => {
    if (!title.trim()) {
      setActionError(text.todoTitleRequired);
      return false;
    }
    if (title.trim().length > 200) {
      setActionError(text.todoTitleTooLong);
      return false;
    }
    try {
      normalizeTodoDueDate(dueDate);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : text.actionFailed);
      return false;
    }
    return true;
  };

  const beginEdit = (item: TodoItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDueDate(item.due_date ?? '');
    setActionError(null);
  };

  const items = itemsQuery.data ?? [];
  return (
    <View
      testID="todo-section"
      style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
        {text.todoTitle}
      </Text>
      <TextInput
        accessibilityLabel={text.todoAdd}
        testID="todo-title-input"
        editable={!addMutation.isPending}
        onChangeText={setNewTitle}
        onSubmitEditing={() => {
          if (!addMutation.isPending && validateInput(newTitle, newDueDate)) {
            addMutation.mutate({ title: newTitle, dueDate: newDueDate });
          }
        }}
        placeholder={text.todoAddPlaceholder}
        placeholderTextColor={colors.secondaryText}
        returnKeyType="done"
        style={[
          styles.input,
          { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
        ]}
        value={newTitle}
      />
      <View style={styles.addRow}>
        <TextInput
          accessibilityLabel={text.todoDueDatePlaceholder}
          testID="todo-due-date-input"
          editable={!addMutation.isPending}
          onChangeText={setNewDueDate}
          placeholder={text.todoDueDatePlaceholder}
          placeholderTextColor={colors.secondaryText}
          style={[
            styles.input,
            styles.dateInput,
            { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
          ]}
          value={newDueDate}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: addMutation.isPending }}
          testID="todo-add-button"
          disabled={addMutation.isPending}
          onPress={() => {
            setActionError(null);
            if (validateInput(newTitle, newDueDate)) {
              addMutation.mutate({ title: newTitle, dueDate: newDueDate });
            }
          }}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.accent, opacity: pressed || addMutation.isPending ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.addButtonText, { color: colors.background }]}>+</Text>
        </Pressable>
      </View>
      {isRealtimeError ? (
        <Text accessibilityRole="alert" testID="todo-realtime-error-message" style={styles.error}>
          {text.todoRealtimeFailed}
        </Text>
      ) : null}
      {actionError ? (
        <Text accessibilityRole="alert" testID="todo-action-error-message" style={styles.error}>
          {actionError}
        </Text>
      ) : null}
      {itemsQuery.isPending ? (
        <ActivityIndicator testID="todo-loading" color={colors.accent} size="small" />
      ) : itemsQuery.isError ? (
        <View style={styles.empty}>
          <Text accessibilityRole="alert" testID="todo-load-error-message" style={styles.message}>
            {text.todoLoadFailed}
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="todo-retry-button"
            onPress={() => void itemsQuery.refetch()}
          >
            <Text style={[styles.link, { color: colors.accent }]}>{text.retry}</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <Text testID="todo-empty-state" style={[styles.empty, { color: colors.secondaryText }]}>
          {text.todoEmpty}
        </Text>
      ) : (
        <View style={styles.items}>
          {items.map((item) => {
            const isEditing = editingId === item.id;
            const isPending =
              updateMutation.isPending || deleteMutation.isPending || addMutation.isPending;
            return (
              <View
                key={item.id}
                testID={`todo-item-${item.id}`}
                style={[styles.item, { borderBottomColor: colors.border }]}
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.completed, disabled: isPending }}
                  accessibilityLabel={item.title}
                  testID={`todo-checkbox-${item.id}`}
                  disabled={isPending}
                  onPress={() => {
                    setActionError(null);
                    updateMutation.mutate({
                      itemId: item.id,
                      values: {
                        title: item.title,
                        dueDate: item.due_date ?? '',
                        completed: !item.completed,
                      },
                    });
                  }}
                  style={styles.checkbox}
                >
                  <Text
                    style={[
                      styles.check,
                      { color: item.completed ? colors.accent : colors.secondaryText },
                    ]}
                  >
                    {item.completed ? '☑' : '☐'}
                  </Text>
                </Pressable>
                <View style={styles.itemContent}>
                  {isEditing ? (
                    <>
                      <TextInput
                        accessibilityLabel={`${text.todoEdit}: ${item.title}`}
                        testID={`todo-edit-title-${item.id}`}
                        editable={!isPending}
                        onChangeText={setEditTitle}
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        value={editTitle}
                      />
                      <TextInput
                        accessibilityLabel={text.todoDueDatePlaceholder}
                        testID={`todo-edit-due-date-${item.id}`}
                        editable={!isPending}
                        onChangeText={setEditDueDate}
                        placeholder={text.todoDueDatePlaceholder}
                        placeholderTextColor={colors.secondaryText}
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        value={editDueDate}
                      />
                      <View style={styles.itemActions}>
                        <Pressable
                          accessibilityRole="button"
                          testID={`todo-save-${item.id}`}
                          disabled={isPending}
                          onPress={() => {
                            setActionError(null);
                            if (validateInput(editTitle, editDueDate)) {
                              updateMutation.mutate({
                                itemId: item.id,
                                values: { title: editTitle, dueDate: editDueDate },
                              });
                            }
                          }}
                        >
                          <Text style={[styles.link, { color: colors.accent }]}>
                            {text.todoSave}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          testID={`todo-cancel-edit-${item.id}`}
                          disabled={isPending}
                          onPress={() => setEditingId(null)}
                        >
                          <Text style={[styles.link, { color: colors.secondaryText }]}>
                            {text.todoCancel}
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text
                        testID={`todo-item-title-${item.id}`}
                        style={[
                          styles.itemTitle,
                          {
                            color: item.completed ? colors.secondaryText : colors.text,
                            textDecorationLine: item.completed ? 'line-through' : 'none',
                          },
                        ]}
                      >
                        {item.title}
                      </Text>
                      {item.due_date ? (
                        <Text
                          testID={`todo-item-due-date-${item.id}`}
                          style={[styles.dueDate, { color: colors.secondaryText }]}
                        >
                          {text.todoDueDate(formatDueDate(item.due_date))}
                        </Text>
                      ) : null}
                      <View style={styles.itemActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${text.todoEdit}: ${item.title}`}
                          testID={`todo-edit-${item.id}`}
                          disabled={isPending}
                          onPress={() => beginEdit(item)}
                        >
                          <Text style={[styles.link, { color: colors.accent }]}>
                            {text.todoEdit}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${text.todoDelete}: ${item.title}`}
                          testID={`todo-delete-${item.id}`}
                          disabled={isPending}
                          onPress={() => {
                            setActionError(null);
                            deleteMutation.mutate(item.id);
                          }}
                        >
                          <Text style={[styles.link, { color: '#B42318' }]}>{text.todoDelete}</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  heading: { fontSize: 20, fontWeight: '700' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    fontSize: 15,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dateInput: { flex: 1 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { fontSize: 26, lineHeight: 30, fontWeight: '700' },
  empty: { fontSize: 14, lineHeight: 21, paddingVertical: Spacing.two, textAlign: 'center' },
  items: { gap: Spacing.one },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  checkbox: { width: 32, minHeight: 42, justifyContent: 'center', alignItems: 'center' },
  check: { fontSize: 23 },
  itemContent: { flex: 1, gap: Spacing.one },
  itemTitle: { fontSize: 16, lineHeight: 22 },
  dueDate: { fontSize: 13 },
  itemActions: { flexDirection: 'row', gap: Spacing.three, minHeight: 28, alignItems: 'center' },
  link: { fontSize: 13, fontWeight: '600' },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  error: { color: '#B42318', fontSize: 14, lineHeight: 20 },
});
