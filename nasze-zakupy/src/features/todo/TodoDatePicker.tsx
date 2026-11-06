import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { formatDateForStorage, parseTodoDate } from '@/features/todo/data';
import { strings } from '@/localization';

type TodoDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  testID: string;
  // Content shown in the same row as the calendar button (e.g. the assignee picker);
  // the calendar itself still opens below at full width.
  accessory?: ReactNode;
};

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function TodoDatePicker({
  value,
  onChange,
  disabled = false,
  testID,
  accessory,
}: TodoDatePickerProps) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.shopping;
  const [isOpen, setIsOpen] = useState(false);
  const [displayedMonth, setDisplayedMonth] = useState(() =>
    monthStart(value ? parseTodoDate(value) : new Date()),
  );

  const days = useMemo(() => {
    const first = monthStart(displayedMonth);
    const offset = (first.getDay() + 6) % 7;
    const numberOfDays = new Date(
      displayedMonth.getFullYear(),
      displayedMonth.getMonth() + 1,
      0,
    ).getDate();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: numberOfDays }, (_, index) => index + 1),
    ];
  }, [displayedMonth]);

  const selectedLabel = value
    ? new Intl.DateTimeFormat('pl-PL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(parseTodoDate(value))
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.fieldRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.todoDatePickerLabel}
          accessibilityState={{ disabled, expanded: isOpen }}
          testID={testID}
          disabled={disabled}
          onPress={() => setIsOpen((open) => !open)}
          // The deadline is optional: just a calendar icon until a date is picked.
          style={({ pressed }) => [
            styles.field,
            selectedLabel ? null : styles.iconOnly,
            {
              backgroundColor: value ? colors.accentSoft : colors.background,
              borderColor: isOpen || value ? colors.accent : colors.border,
              opacity: disabled || pressed ? 0.65 : 1,
            },
          ]}
        >
          <SymbolView
            name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
            tintColor={colors.accent}
            size={20}
          />
          {selectedLabel ? (
            <Text numberOfLines={1} style={[styles.fieldText, { color: colors.text }]}>
              {selectedLabel}
            </Text>
          ) : null}
        </Pressable>
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text.todoDateClear}
            testID={`${testID}-clear`}
            disabled={disabled}
            onPress={() => onChange('')}
            style={styles.clearButton}
          >
            <Text style={[styles.clearText, { color: colors.secondaryText }]}>×</Text>
          </Pressable>
        ) : null}
        {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      </View>
      {isOpen ? (
        <View
          testID={`${testID}-calendar`}
          style={[
            styles.calendar,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <View style={styles.monthHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text.todoDatePreviousMonth}
              testID={`${testID}-previous-month`}
              onPress={() => setDisplayedMonth((month) => addMonths(month, -1))}
              style={styles.monthButton}
            >
              <Text style={[styles.monthArrow, { color: colors.accent }]}>‹</Text>
            </Pressable>
            <Text style={[styles.monthTitle, { color: colors.text }]}>
              {new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(
                displayedMonth,
              )}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text.todoDateNextMonth}
              testID={`${testID}-next-month`}
              onPress={() => setDisplayedMonth((month) => addMonths(month, 1))}
              style={styles.monthButton}
            >
              <Text style={[styles.monthArrow, { color: colors.accent }]}>›</Text>
            </Pressable>
          </View>
          <View style={styles.daysGrid}>
            {['P', 'W', 'Ś', 'C', 'P', 'S', 'N'].map((day, index) => (
              <Text
                key={`${day}-${index}`}
                style={[styles.weekday, { color: colors.secondaryText }]}
              >
                {day}
              </Text>
            ))}
            {days.map((day, index) => {
              if (day === null) return <View key={`empty-${index}`} style={styles.dayCell} />;
              const date = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), day);
              const dateValue = formatDateForStorage(date);
              const selected = dateValue === value;
              return (
                <Pressable
                  key={dateValue}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${day} ${new Intl.DateTimeFormat('pl-PL', {
                    month: 'long',
                  }).format(displayedMonth)}`}
                  testID={`${testID}-day-${dateValue}`}
                  onPress={() => {
                    onChange(dateValue);
                    setIsOpen(false);
                  }}
                  style={[styles.dayCell, selected ? { backgroundColor: colors.accent } : null]}
                >
                  <Text
                    style={[styles.dayText, { color: selected ? colors.background : colors.text }]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            testID={`${testID}-today`}
            onPress={() => {
              const date = new Date();
              onChange(formatDateForStorage(date));
              setDisplayedMonth(monthStart(date));
              setIsOpen(false);
            }}
            style={styles.todayButton}
          >
            <Text style={[styles.todayText, { color: colors.accent }]}>{text.todoDateToday}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  accessory: { flex: 1, minWidth: 0 },
  field: {
    flexShrink: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconOnly: { width: 44, paddingHorizontal: 0, justifyContent: 'center' },
  fieldText: { flexShrink: 1, fontSize: 14, fontWeight: '600' },
  clearButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 23, lineHeight: 27 },
  calendar: { borderWidth: 1, borderRadius: 12, padding: Spacing.two, marginTop: Spacing.one },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center' },
  monthArrow: { fontSize: 27, lineHeight: 30 },
  monthTitle: { fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: {
    width: '14.2857%',
    minHeight: 34,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  dayCell: {
    width: '14.2857%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  dayText: { fontSize: 14 },
  todayButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  todayText: { fontSize: 14, fontWeight: '600' },
});
