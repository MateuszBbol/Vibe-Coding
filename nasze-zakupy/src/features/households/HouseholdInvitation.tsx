import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';

import { authStyles } from '@/features/auth/AuthFrame';
import { getFeatureErrorMessage } from '@/features/errors';
import type { Household } from '@/features/households/data';
import { createHouseholdInvitation } from '@/features/households/data';
import { invitationEmailFormSchema } from '@/features/households/schemas';
import type { InvitationEmail, InvitationEmailInput } from '@/features/households/schemas';
import { Colors, Spacing } from '@/constants/theme';
import { strings } from '@/localization';

type HouseholdInvitationProps = {
  household: Household;
};

export function HouseholdInvitation({ household }: HouseholdInvitationProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const text = strings.pl.household;
  const [invitationCode, setInvitationCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<InvitationEmailInput, unknown, InvitationEmail>({
    resolver: zodResolver(invitationEmailFormSchema),
    defaultValues: { email: '' },
  });
  const mutation = useMutation({
    mutationFn: (email: string) => createHouseholdInvitation(household.id, email),
    onSuccess: (code) => {
      setInvitationCode(code);
      setErrorMessage(null);
    },
    onError: (error: unknown) => setErrorMessage(getFeatureErrorMessage(error)),
  });

  const createInvite = (values: InvitationEmail) => {
    setInvitationCode(null);
    setErrorMessage(null);
    mutation.mutate(values.email);
  };

  const shareInvite = async () => {
    if (!invitationCode) {
      return;
    }

    try {
      await Share.share(
        {
          title: text.invitationShareTitle,
          message: invitationCode,
        },
        { tintColor: colors.accent },
      );
    } catch {
      setErrorMessage(strings.pl.featureErrors.actionFailed);
    }
  };

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {text.inviteTitle}
      </Text>
      <Text style={[styles.description, { color: colors.secondaryText }]}>
        {text.inviteDescription}
      </Text>
      <Text style={[authStyles.label, { color: colors.text }]}>{text.inviteEmailLabel}</Text>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            accessibilityLabel={text.inviteEmailLabel}
            testID="household-invitation-email-input"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!mutation.isPending}
            keyboardType="email-address"
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder={text.inviteEmailPlaceholder}
            placeholderTextColor={colors.secondaryText}
            returnKeyType="done"
            style={[
              authStyles.input,
              {
                backgroundColor: colors.background,
                borderColor: errors.email ? '#B42318' : colors.border,
                color: colors.text,
              },
            ]}
            value={value}
            onSubmitEditing={() => void handleSubmit(createInvite)()}
          />
        )}
      />
      {errors.email?.message ? (
        <Text
          accessibilityRole="alert"
          testID="household-invitation-email-error-message"
          style={styles.error}
        >
          {errors.email.message}
        </Text>
      ) : null}
      {errorMessage ? (
        <Text
          accessibilityRole="alert"
          testID="household-invitation-error-message"
          style={styles.error}
        >
          {errorMessage}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        testID="household-invitation-create-button"
        accessibilityState={{ disabled: mutation.isPending }}
        disabled={mutation.isPending}
        onPress={() => void handleSubmit(createInvite)()}
        style={({ pressed }) => [
          styles.secondaryButton,
          { borderColor: colors.accent, opacity: pressed || mutation.isPending ? 0.65 : 1 },
        ]}
      >
        <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>
          {mutation.isPending ? text.creatingInvite : text.createInviteButton}
        </Text>
      </Pressable>
      {invitationCode ? (
        <View style={[styles.codeContainer, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.description, { color: colors.text }]}>{text.inviteCodeReady}</Text>
          <Text
            selectable
            testID="household-invitation-code"
            style={[styles.code, { color: colors.text }]}
          >
            {invitationCode}
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="household-invitation-share-button"
            onPress={() => void shareInvite()}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: colors.accent,
                opacity: pressed ? 0.65 : 1,
              },
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>
              {text.shareInviteButton}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
    marginTop: Spacing.four,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.three,
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  codeContainer: {
    borderRadius: 14,
    padding: Spacing.three,
    marginTop: Spacing.three,
  },
  code: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: Spacing.two,
  },
  error: {
    color: '#B42318',
    fontSize: 14,
    lineHeight: 21,
    marginTop: Spacing.two,
  },
});
