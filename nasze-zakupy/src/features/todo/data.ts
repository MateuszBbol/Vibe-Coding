import { supabase } from '@/lib/supabase/client';

function requireSupabase() {
  if (!supabase) throw new Error('Brak konfiguracji Supabase.');
  return supabase;
}

export type TodoMember = {
  user_id: string;
  display_name: string | null;
};

export type TodoItem = {
  id: string;
  household_id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  assignees: TodoMember[];
};

export type TodoItemValues = {
  title: string;
  dueDate: string;
  assigneeIds: string[];
};

export function normalizeTodoDueDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) throw new Error('Wpisz prawidłowy termin w formacie RRRR-MM-DD.');

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('Wpisz prawidłowy termin w formacie RRRR-MM-DD.');
  }
  return trimmed;
}

export function formatDateForStorage(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseTodoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatTodoDueDate(value: string, today = new Date()): string {
  const date = parseTodoDate(value);
  const todayValue = formatDateForStorage(today);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (value === todayValue) return 'Dzisiaj';
  if (value === formatDateForStorage(tomorrow)) return 'Jutro';
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(date);
}

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function fetchTodoItems(householdId: string): Promise<TodoItem[]> {
  const client = requireSupabase();
  const [itemsResult, assigneesResult] = await Promise.all([
    client
      .from('todo_items')
      .select('id, household_id, title, completed, due_date, created_at, updated_at, created_by')
      .eq('household_id', householdId)
      .order('completed', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false }),
    client
      .from('todo_item_assignees')
      .select('todo_item_id, user_id')
      .eq('household_id', householdId),
  ]);
  throwOnError(itemsResult.error);
  throwOnError(assigneesResult.error);

  const assigneesByItem = new Map<string, TodoMember[]>();
  for (const assignment of assigneesResult.data ?? []) {
    const members = assigneesByItem.get(assignment.todo_item_id) ?? [];
    members.push({ user_id: assignment.user_id, display_name: null });
    assigneesByItem.set(assignment.todo_item_id, members);
  }
  return (itemsResult.data ?? []).map((item) => ({
    ...item,
    assignees: assigneesByItem.get(item.id) ?? [],
  }));
}

export async function fetchTodoMembers(householdId: string): Promise<TodoMember[]> {
  const { data, error } = await requireSupabase().rpc('fetch_todo_household_members', {
    target_household_id: householdId,
  });
  throwOnError(error);
  return data ?? [];
}

export async function addTodoItem(
  householdId: string,
  title: string,
  dueDate: string,
  assigneeIds: string[],
): Promise<void> {
  const { error } = await requireSupabase().rpc('create_todo_item', {
    target_household_id: householdId,
    target_title: title.trim(),
    target_due_date: normalizeTodoDueDate(dueDate),
    target_user_ids: assigneeIds,
  });
  throwOnError(error);
}

export async function updateTodoItem(
  householdId: string,
  item: TodoItem,
  values: Partial<TodoItemValues> & { completed?: boolean },
): Promise<void> {
  const { error } = await requireSupabase().rpc('update_todo_item', {
    target_household_id: householdId,
    target_item_id: item.id,
    target_title: values.title?.trim() ?? item.title,
    target_due_date:
      values.dueDate === undefined ? item.due_date : normalizeTodoDueDate(values.dueDate),
    target_completed: values.completed ?? item.completed,
    target_user_ids: values.assigneeIds ?? item.assignees.map(({ user_id }) => user_id),
  });
  throwOnError(error);
}

export async function deleteTodoItem(householdId: string, itemId: string): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('todo_items')
    .delete()
    .eq('household_id', householdId)
    .eq('id', itemId)
    .select('id')
    .maybeSingle();
  throwOnError(error);
  if (!data) throw new Error('Nie znaleziono zadania.');
}
