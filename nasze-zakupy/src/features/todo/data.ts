import { supabase } from '@/lib/supabase/client';

export type TodoItem = {
  id: string;
  household_id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error('Brak konfiguracji Supabase.');
  }
  return supabase;
}

export function normalizeTodoDueDate(value: string): string | null {
  const date = value.trim();
  if (!date) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Wpisz prawidłowy termin w formacie RRRR-MM-DD.');
  }
  const [yearText, monthText, dayText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1) {
    throw new Error('Wpisz prawidłowy termin w formacie RRRR-MM-DD.');
  }
  const parsedDate = new Date(0);
  parsedDate.setUTCHours(0, 0, 0, 0);
  parsedDate.setUTCFullYear(year, month - 1, day);
  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error('Wpisz prawidłowy termin w formacie RRRR-MM-DD.');
  }
  return date;
}

export async function fetchTodoItems(householdId: string): Promise<TodoItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('todo_items')
    .select('id, household_id, title, completed, due_date, created_at, updated_at, created_by')
    .eq('household_id', householdId)
    .order('completed', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function addTodoItem(
  householdId: string,
  userId: string,
  title: string,
  dueDate: string,
): Promise<void> {
  const client = requireSupabase();
  const trimmedTitle = title.trim();
  if (!trimmedTitle || trimmedTitle.length > 200) {
    throw new Error('Wpisz nazwę zadania.');
  }
  const normalizedDueDate = normalizeTodoDueDate(dueDate);
  const { error } = await client.from('todo_items').insert({
    household_id: householdId,
    title: trimmedTitle,
    due_date: normalizedDueDate,
    created_by: userId,
  });

  if (error) {
    throw error;
  }
}

export async function updateTodoItem(
  householdId: string,
  itemId: string,
  values: { title: string; dueDate: string; completed?: boolean },
): Promise<void> {
  const client = requireSupabase();
  const title = values.title.trim();
  if (!title || title.length > 200) {
    throw new Error('Wpisz nazwę zadania.');
  }
  const { data, error } = await client
    .from('todo_items')
    .update({
      title,
      due_date: normalizeTodoDueDate(values.dueDate),
      ...(values.completed === undefined ? {} : { completed: values.completed }),
    })
    .eq('household_id', householdId)
    .eq('id', itemId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('Nie znaleziono zadania.');
  }
}

export async function deleteTodoItem(householdId: string, itemId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('todo_items')
    .delete()
    .eq('household_id', householdId)
    .eq('id', itemId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('Nie znaleziono zadania.');
  }
}
