import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';

import { AuthFrame, authStyles } from '@/features/auth/AuthFrame';
import { getFeatureErrorMessage } from '@/features/errors';
import { acceptHouseholdInvitation, createHousehold } from '@/features/households/data';
import { householdFormSchema, invitationTokenFormSchema } from '@/features/households/schemas';
import type {
  HouseholdFormInput,
  HouseholdFormValues,
  InvitationToken,
  InvitationTokenInput,
} from '@/features/households/schemas';
import { Colors, Spacing } from '@/constants/theme';
import { strings } from '@/localization';

type HouseholdSetupProps = {
  userId: string;
  emptyState?: boolean;
  embedded?: boolean;
  showCreate?: boolean;
  showJoin?: boolean;
  createDisabled?: boolean;
  joinDisabled?: boolean;
  joinDisabledMessage?: string;
  hideEmbeddedHeading?: boolean;
  onCancel?: () => void;
  onCompleted?: (householdId: string) => void | Promise<void>;
};

export function HouseholdSetup({
  userId,
  emptyState = false,
  embedded = false,
  showCreate = true,
  showJoin = true,
  createDisabled = false,
  joinDisabled = false,
  joinDisabledMessage,
  hideEmbeddedHeading = false,
  onCancel,
  onCompleted,
}: HouseholdSetupProps) {
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const text = strings.pl.household;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    control: householdControl,
    handleSubmit: handleHouseholdSubmit,
    formState: { errors: householdErrors },
  } = useForm<HouseholdFormInput, unknown, HouseholdFormValues>({
    resolver: zodResolver(householdFormSchema),
    defaultValues: { name: 'Nasze Zakupy' },
  });
  const {
    control: invitationControl,
    handleSubmit: handleInvitationSubmit,
    formState: { errors: invitationErrors },
  } = useForm<InvitationTokenInput, unknown, InvitationToken>({
    resolver: zodResolver(invitationTokenFormSchema),
    defaultValues: { token: '' },
  });

  const refreshHouseholds = () =>
    queryClient.invalidateQueries({ queryKey: ['households', userId] });
  const createMutation = useMutation({
    mutationFn: (name: string) => createHousehold(name),
    onSuccess: async (household) => {
      await refreshHouseholds();
      await onCompleted?.(household.id);
    },
    onError: (error: unknown) => setErrorMessage(getFeatureErrorMessage(error)),
  });
  const acceptMutation = useMutation({
    mutationFn: (token: string) => acceptHouseholdInvitation(token),
    onSuccess: async (householdId) => {
      await refreshHouseholds();
      await onCompleted?.(householdId);
    },
    onError: (error: unknown) => setErrorMessage(getFeatureErrorMessage(error)),
  });
  const isPending = createMutation.isPending || acceptMutation.isPending;

  const create = (values: HouseholdFormValues) => {
    if (createDisabled) {
      return;
    }
    setErrorMessage(null);
    createMutation.mutate(values.name);
  };
  const accept = (values: InvitationToken) => {
    if (joinDisabled) {
      return;
    }
    setErrorMessage(null);
    acceptMutation.mutate(values.token);
  };

  const formContent = (
    <>
      {showCreate ? (
        <View
          style={[styles.section, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
            {text.createTitle}
          </Text>
          <Text style={[styles.sectionDescription, { color: colors.secondaryText }]}>
            {text.createDescription}
          </Text>
          <Text style={[authStyles.label, { color: colors.text }]}>{text.nameLabel}</Text>
          <Controller
            control={householdControl}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                accessibilityLabel={text.nameLabel}
                testID="household-create-name-input"
                autoCapitalize="words"
                editable={!isPending && !createDisabled}
                maxLength={80}
                onBlur={onBlur}
                onChangeText={(nextValue) => {
                  setErrorMessage(null);
                  onChange(nextValue);
                }}
                placeholder={text.namePlaceholder}
                placeholderTextColor={colors.secondaryText}
                returnKeyType="done"
                style={[
                  authStyles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: householdErrors.name ? '#B42318' : colors.border,
                    color: colors.text,
                  },
                ]}
                value={value}
                onSubmitEditing={() => void handleHouseholdSubmit(create)()}
              />
            )}
          />
          {householdErrors.name?.message ? (
            <Text
              accessibilityRole="alert"
              testID="household-create-name-error-message"
              style={styles.error}
            >
              {householdErrors.name.message}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isPending || createDisabled }}
            testID="household-create-submit-button"
            disabled={isPending || createDisabled}
            onPress={() => void handleHouseholdSubmit(create)()}
            style={({ pressed }) => [
              authStyles.button,
              {
                backgroundColor: colors.accent,
                opacity: pressed || isPending || createDisabled ? 0.5 : 1,
              },
            ]}
          >
            <Text
              style={[
                authStyles.buttonText,
                { color: colorScheme === 'dark' ? '#151915' : '#FFFFFF' },
              ]}
            >
              {createMutation.isPending ? text.creating : text.createButton}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {showCreate && showJoin ? (
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.secondaryText }]}>{text.or}</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>
      ) : null}

      {showJoin ? (
        <View
          style={[styles.section, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
            {text.joinTitle}
          </Text>
          <Text style={[styles.sectionDescription, { color: colors.secondaryText }]}>
            {text.joinDescription}
          </Text>
          <Text style={[authStyles.label, { color: colors.text }]}>{text.codeLabel}</Text>
          <Controller
            control={invitationControl}
            name="token"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                accessibilityLabel={text.codeLabel}
                testID="household-join-token-input"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isPending && !joinDisabled}
                onBlur={onBlur}
                onChangeText={(nextValue) => {
                  setErrorMessage(null);
                  onChange(nextValue);
                }}
                placeholder={text.codePlaceholder}
                placeholderTextColor={colors.secondaryText}
                returnKeyType="done"
                style={[
                  authStyles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: invitationErrors.token ? '#B42318' : colors.border,
                    color: colors.text,
                  },
                ]}
                value={value}
                onSubmitEditing={() => void handleInvitationSubmit(accept)()}
              />
            )}
          />
          {invitationErrors.token?.message ? (
            <Text
              accessibilityRole="alert"
              testID="household-join-token-error-message"
              style={styles.error}
            >
              {invitationErrors.token.message}
            </Text>
          ) : null}
          {joinDisabledMessage ? (
            <Text
              accessibilityRole="alert"
              testID="household-join-disabled-message"
              style={styles.error}
            >
              {joinDisabledMessage}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isPending || joinDisabled }}
            testID="household-join-submit-button"
            disabled={isPending || joinDisabled}
            onPress={() => void handleInvitationSubmit(accept)()}
            style={({ pressed }) => [
              authStyles.button,
              {
                backgroundColor: colors.accent,
                opacity: pressed || isPending || joinDisabled ? 0.5 : 1,
              },
            ]}
          >
            <Text
              style={[
                authStyles.buttonText,
                { color: colorScheme === 'dark' ? '#151915' : '#FFFFFF' },
              ]}
            >
              {acceptMutation.isPending ? text.joining : text.joinButton}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {errorMessage ? (
        <Text accessibilityRole="alert" testID="household-setup-error-message" style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <View>
        {!hideEmbeddedHeading ? (
          <View style={styles.embeddedHeading}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
              {text.setupTitle}
            </Text>
            {onCancel ? (
              <Pressable
                accessibilityRole="button"
                testID="household-setup-cancel-button"
                onPress={onCancel}
                style={styles.cancelButton}
              >
                <Text style={{ color: colors.accent }}>{text.close}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {!hideEmbeddedHeading ? (
          <Text style={[styles.sectionDescription, { color: colors.secondaryText }]}>
            {text.setupDescription}
          </Text>
        ) : null}
        {formContent}
      </View>
    );
  }

  return (
    <AuthFrame
      title={emptyState ? text.noHouseholdTitle : text.setupTitle}
      description={emptyState ? text.noHouseholdDescription : text.setupDescription}
    >
      {formContent}
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.three,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginVertical: Spacing.three,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 13,
  },
  error: {
    color: '#B42318',
    fontSize: 14,
    lineHeight: 21,
    marginTop: Spacing.two,
  },
  embeddedHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
  },
  cancelButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});
