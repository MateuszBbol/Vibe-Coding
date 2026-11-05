import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { SymbolView } from 'expo-symbols';
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
import { confirmRecipeAction } from '@/features/recipes/confirmRecipeAction';
import { getFeatureErrorMessage, logFeatureError } from '@/features/errors';
import {
  addTodoItem,
  deleteTodoItem,
  fetchTodoItems,
  fetchTodoMembers,
  formatDateForStorage,
  formatTodoDueDate,
  normalizeTodoDueDate,
  updateTodoItem,
} from '@/features/todo/data';
import type { TodoItem, TodoMember } from '@/features/todo/data';
import { TodoDatePicker } from '@/features/todo/TodoDatePicker';
import { strings } from '@/localization';
import { supabase } from '@/lib/supabase/client';

type TodoSectionProps = {
  householdId: string;
  userId: string;
  visible: boolean;
};

type DueGroup = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'noDeadline';

function getDueGroup(dueDate: string | null, today: string, tomorrow: string): DueGroup {
  if (!dueDate) return 'noDeadline';
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  if (dueDate === tomorrow) return 'tomorrow';
  return 'upcoming';
}

function sortByDeadline(left: TodoItem, right: TodoItem): number {
  if (left.due_date === right.due_date) return left.created_at.localeCompare(right.created_at);
  if (!left.due_date) return 1;
  if (!right.due_date) return -1;
  return left.due_date.localeCompare(right.due_date);
}

function formatMemberNames(names: string[]): string {
  return names.length > 2
    ? `${names.slice(0, 2).join(', ')} +${names.length - 2}`
    : names.join(', ');
}

function TodoMemberPicker({
  members,
  selectedIds,
  onChange,
  disabled,
  testID,
}: {
  members: TodoMember[];
  selectedIds: string[];
  onChange: (userIds: string[]) => void;
  disabled: boolean;
  testID: string;
}) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.shopping;
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.memberPicker}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded }}
        testID={`${testID}-toggle`}
        disabled={disabled}
        onPress={() => setExpanded((open) => !open)}
        style={[
          styles.memberPickerToggle,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.memberPickerLabel, { color: colors.text }]}>{text.todoMembers}</Text>
        <Text style={[styles.memberPickerSummary, { color: colors.secondaryText }]}>
          {selectedIds.length
            ? formatMemberNames(
                members
                  .filter((member) => selectedIds.includes(member.user_id))
                  .map(
                    (member) =>
                      member.display_name?.trim() || `Użytkownik ${member.user_id.slice(0, 8)}`,
                  ),
              )
            : text.todoNoAssignees}
        </Text>
        <Text style={[styles.memberPickerArrow, { color: colors.accent }]}>
          {expanded ? '⌃' : '⌄'}
        </Text>
      </Pressable>
      {expanded ? (
        <View
          testID={`${testID}-options`}
          style={[styles.memberOptions, { borderColor: colors.border }]}
        >
          {members.length ? (
            members.map((member) => {
              const selected = selectedIds.includes(member.user_id);
              const label =
                member.display_name?.trim() || `Użytkownik ${member.user_id.slice(0, 8)}`;
              return (
                <Pressable
                  key={member.user_id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: selected, disabled }}
                  testID={`${testID}-member-${member.user_id}`}
                  disabled={disabled}
                  onPress={() =>
                    onChange(
                      selected
                        ? selectedIds.filter((userId) => userId !== member.user_id)
                        : [...selectedIds, member.user_id],
                    )
                  }
                  style={styles.memberOption}
                >
                  <Text style={[styles.memberCheck, { color: colors.accent }]}>
                    {selected ? '☑' : '☐'}
                  </Text>
                  <Text style={[styles.memberName, { color: colors.text }]}>{label}</Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={[styles.memberEmpty, { color: colors.secondaryText }]}>
              {text.todoNoMembers}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function TodoSection({ householdId, userId, visible }: TodoSectionProps) {
  const queryClient = useQueryClient();
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.shopping;
  const queryKey = useMemo(() => ['todo-items', householdId] as const, [householdId]);
  const membersQueryKey = useMemo(
    () => ['todo-household-members', householdId] as const,
    [householdId],
  );
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [completedExpanded, setCompletedExpanded] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState(false);
  const isRealtimeError = realtimeError || !supabase;
  const itemsQuery = useQuery({
    queryKey,
    queryFn: () => fetchTodoItems(householdId),
  });
  const membersQuery = useQuery({
    queryKey: membersQueryKey,
    queryFn: () => fetchTodoMembers(householdId),
  });

  const refreshItems = () => queryClient.invalidateQueries({ queryKey });
  const addMutation = useMutation({
    mutationFn: ({
      title,
      dueDate,
      assigneeIds,
    }: {
      title: string;
      dueDate: string;
      assigneeIds: string[];
    }) => addTodoItem(householdId, title, dueDate, assigneeIds),
    onSuccess: async () => {
      setNewTitle('');
      setNewDueDate('');
      setNewAssigneeIds([]);
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
      item,
      values,
    }: {
      item: TodoItem;
      values: {
        title?: string;
        dueDate?: string;
        completed?: boolean;
        assigneeIds?: string[];
      };
    }) => updateTodoItem(householdId, item, values),
    onSuccess: async (_result, variables) => {
      if (variables.values.completed === undefined) {
        setEditingId(null);
        setEditTitle('');
        setEditDueDate('');
        setEditAssigneeIds([]);
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
    if (!client) return;

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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todo_item_assignees',
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe((status) => {
        if (!active) return;
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

  useEffect(() => {
    if (membersQuery.isError) {
      logFeatureError('[todo] member load failed', membersQuery.error, { userId, householdId });
    }
  }, [householdId, membersQuery.error, membersQuery.isError, userId]);

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
    setEditAssigneeIds(item.assignees.map(({ user_id: id }) => id));
    setActionError(null);
  };

  const confirmDelete = (item: TodoItem) => {
    setActionError(null);
    confirmRecipeAction({
      title: text.todoDeleteConfirmTitle,
      message: text.todoDeleteConfirmMessage(item.title),
      cancelLabel: text.todoCancel,
      confirmLabel: text.todoDeleteConfirm,
      onConfirm: () => deleteMutation.mutate(item.id),
    });
  };

  const items = itemsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const membersById = new Map(members.map((member) => [member.user_id, member]));
  const now = new Date();
  const today = formatDateForStorage(now);
  const tomorrow = formatDateForStorage(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
  );
  const pendingItems = items.filter((item) => !item.completed).sort(sortByDeadline);
  const completedItems = items.filter((item) => item.completed).sort(sortByDeadline);
  const groupedItems = (['overdue', 'today', 'tomorrow', 'upcoming', 'noDeadline'] as const)
    .map((key) => ({
      key,
      title: {
        overdue: text.todoOverdue,
        today: text.todoToday,
        tomorrow: text.todoTomorrow,
        upcoming: text.todoLater,
        noDeadline: text.todoNoDeadline,
      }[key],
      items: pendingItems.filter((item) => getDueGroup(item.due_date, today, tomorrow) === key),
    }))
    .filter((group) => group.items.length > 0);

  const renderItem = (item: TodoItem) => {
    const isEditing = editingId === item.id;
    const isPending = updateMutation.isPending || deleteMutation.isPending || addMutation.isPending;
    const assignedNames = item.assignees.map((assignment) => {
      const member = membersById.get(assignment.user_id);
      return member?.display_name?.trim() || `Użytkownik ${assignment.user_id.slice(0, 8)}`;
    });
    const assignmentSummary = formatMemberNames(assignedNames);

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
              item,
              values: { completed: !item.completed },
            });
          }}
          style={styles.checkbox}
        >
          <Text
            style={[styles.check, { color: item.completed ? colors.accent : colors.secondaryText }]}
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
              <TodoDatePicker
                value={editDueDate}
                onChange={setEditDueDate}
                disabled={isPending}
                testID={`todo-edit-due-date-${item.id}`}
              />
              <TodoMemberPicker
                members={members}
                selectedIds={editAssigneeIds}
                onChange={setEditAssigneeIds}
                disabled={isPending}
                testID={`todo-edit-assignees-${item.id}`}
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
                        item,
                        values: {
                          title: editTitle,
                          dueDate: editDueDate,
                          assigneeIds: editAssigneeIds,
                        },
                      });
                    }
                  }}
                  style={styles.actionButton}
                >
                  <Text style={[styles.link, { color: colors.accent }]}>{text.todoSave}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID={`todo-cancel-edit-${item.id}`}
                  disabled={isPending}
                  onPress={() => setEditingId(null)}
                  style={styles.actionButton}
                >
                  <Text style={[styles.link, { color: colors.secondaryText }]}>
                    {text.todoCancel}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.itemTitleRow}>
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
                <View style={styles.itemActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={text.todoEdit}
                    accessibilityHint={text.todoEdit}
                    testID={`todo-edit-${item.id}`}
                    disabled={isPending}
                    onPress={() => beginEdit(item)}
                    hitSlop={6}
                    style={styles.iconButton}
                  >
                    <SymbolView
                      name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                      tintColor={colors.secondaryText}
                      size={18}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={text.todoDelete}
                    accessibilityHint={text.todoDelete}
                    testID={`todo-delete-${item.id}`}
                    disabled={isPending}
                    onPress={() => confirmDelete(item)}
                    hitSlop={6}
                    style={styles.iconButton}
                  >
                    <SymbolView
                      name={{ ios: 'trash', android: 'delete_outline', web: 'delete_outline' }}
                      tintColor="#B42318"
                      size={18}
                    />
                  </Pressable>
                </View>
              </View>
              <View style={styles.itemMetadata}>
                {item.due_date ? (
                  <View style={styles.metadataItem}>
                    <SymbolView
                      name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
                      tintColor={
                        !item.completed && item.due_date < today
                          ? '#B42318'
                          : !item.completed && item.due_date === today
                            ? '#B54708'
                            : colors.secondaryText
                      }
                      size={14}
                    />
                    <Text
                      testID={`todo-item-due-date-${item.id}`}
                      style={[
                        styles.dueDate,
                        {
                          color:
                            !item.completed && item.due_date < today
                              ? '#B42318'
                              : !item.completed && item.due_date === today
                                ? '#B54708'
                                : colors.secondaryText,
                        },
                      ]}
                    >
                      {text.todoDueDate(formatTodoDueDate(item.due_date, now))}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.metadataItem}>
                  <SymbolView
                    name={{ ios: 'person.2', android: 'group', web: 'group' }}
                    tintColor={colors.secondaryText}
                    size={14}
                  />
                  <Text
                    testID={`todo-item-assignees-${item.id}`}
                    style={[styles.assignmentSummary, { color: colors.secondaryText }]}
                  >
                    {assignmentSummary
                      ? text.todoAssignedTo(assignmentSummary)
                      : text.todoNoAssignees}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View
      testID="todo-section"
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.section,
        { backgroundColor: colors.card, borderColor: colors.border },
        !visible ? styles.hidden : null,
      ]}
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
            addMutation.mutate({
              title: newTitle,
              dueDate: newDueDate,
              assigneeIds: newAssigneeIds,
            });
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
      <TodoDatePicker
        value={newDueDate}
        onChange={setNewDueDate}
        disabled={addMutation.isPending}
        testID="todo-due-date-input"
      />
      <TodoMemberPicker
        members={members}
        selectedIds={newAssigneeIds}
        onChange={setNewAssigneeIds}
        disabled={addMutation.isPending || membersQuery.isError}
        testID="todo-add-assignees"
      />
      {membersQuery.isError ? (
        <Text accessibilityRole="alert" testID="todo-members-error-message" style={styles.error}>
          {text.todoMembersLoadFailed}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: addMutation.isPending }}
        testID="todo-add-button"
        disabled={addMutation.isPending}
        onPress={() => {
          setActionError(null);
          if (validateInput(newTitle, newDueDate)) {
            addMutation.mutate({
              title: newTitle,
              dueDate: newDueDate,
              assigneeIds: newAssigneeIds,
            });
          }
        }}
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: colors.accent, opacity: pressed || addMutation.isPending ? 0.6 : 1 },
        ]}
      >
        {addMutation.isPending ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : (
          <Text style={[styles.addButtonText, { color: colors.background }]}>{text.todoAdd}</Text>
        )}
      </Pressable>
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
        <>
          <View
            testID="todo-upcoming-panel"
            style={[
              styles.upcomingPanel,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Text
              accessibilityRole="header"
              testID="todo-upcoming-count"
              style={[styles.panelHeading, { color: colors.text }]}
            >
              {text.todoUpcoming} ({pendingItems.length})
            </Text>
            {pendingItems.length ? (
              groupedItems.map((group) => (
                <View key={group.key} testID={`todo-group-${group.key}`}>
                  <Text
                    accessibilityRole="header"
                    style={[
                      styles.groupHeading,
                      {
                        color:
                          group.key === 'overdue'
                            ? '#B42318'
                            : group.key === 'today'
                              ? '#B54708'
                              : colors.secondaryText,
                      },
                    ]}
                  >
                    {group.title} ({group.items.length})
                  </Text>
                  <View style={styles.items}>{group.items.map(renderItem)}</View>
                </View>
              ))
            ) : (
              <Text style={[styles.panelEmpty, { color: colors.secondaryText }]}>
                {text.todoNoUpcoming}
              </Text>
            )}
          </View>
          <View
            testID="todo-group-completed"
            style={[
              styles.completedPanel,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: completedExpanded }}
              testID="todo-completed-toggle"
              onPress={() => setCompletedExpanded((expanded) => !expanded)}
              style={styles.completedToggle}
            >
              <Text
                accessibilityRole="header"
                style={[styles.panelHeading, { color: colors.secondaryText }]}
              >
                {text.todoCompletedSection} ({completedItems.length})
              </Text>
              <Text style={[styles.completedArrow, { color: colors.secondaryText }]}>
                {completedExpanded ? '⌃' : '⌄'}
              </Text>
            </Pressable>
            {completedExpanded ? (
              completedItems.length ? (
                <View style={styles.items}>{completedItems.map(renderItem)}</View>
              ) : (
                <Text style={[styles.panelEmpty, { color: colors.secondaryText }]}>
                  {text.todoNoCompleted}
                </Text>
              )
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  hidden: { display: 'none' },
  heading: { fontSize: 20, fontWeight: '700' },
  input: {
    minHeight: 44,
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    fontSize: 15,
  },
  addButton: {
    minHeight: 44,
    width: '100%',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  addButtonText: { fontSize: 15, fontWeight: '700' },
  memberPicker: { width: '100%' },
  memberPickerToggle: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  memberPickerLabel: { fontSize: 14, fontWeight: '600' },
  memberPickerSummary: { flex: 1, fontSize: 13, textAlign: 'right' },
  memberPickerArrow: { fontSize: 17 },
  memberOptions: { borderWidth: 1, borderRadius: 10, padding: Spacing.one, marginTop: Spacing.one },
  memberOption: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  memberCheck: { width: 24, textAlign: 'center', fontSize: 17 },
  memberName: { flex: 1, fontSize: 14 },
  memberEmpty: { padding: Spacing.two, fontSize: 13 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 21, marginTop: Spacing.one },
  empty: { fontSize: 14, lineHeight: 21, paddingVertical: Spacing.three },
  message: { fontSize: 14, lineHeight: 21 },
  link: { fontSize: 14, fontWeight: '600' },
  items: { marginTop: -Spacing.one },
  upcomingPanel: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    marginBottom: Spacing.three,
  },
  completedPanel: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    opacity: 0.82,
  },
  panelHeading: { fontSize: 14, fontWeight: '700' },
  panelEmpty: { paddingVertical: Spacing.two, fontSize: 13 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: { width: 36, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  check: { fontSize: 22 },
  itemContent: { flex: 1, minWidth: 0, paddingVertical: Spacing.two, gap: Spacing.one },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  itemTitle: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '500' },
  itemMetadata: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  metadataItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  dueDate: { fontSize: 12, fontWeight: '600' },
  assignmentSummary: { flexShrink: 1, fontSize: 12 },
  itemActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  actionButton: { minHeight: 36, justifyContent: 'center' },
  groupHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.one,
    marginBottom: Spacing.one,
  },
  completedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  completedArrow: { fontSize: 18, paddingHorizontal: Spacing.two },
});
