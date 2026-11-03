import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useColorScheme } from 'react-native';

import { AuthFrame, authStyles } from '@/features/auth/AuthFrame';
import { getAuthErrorMessage } from '@/features/auth/errors';
import { profileSchema } from '@/features/auth/profileSchema';
import type { ProfileFormValues } from '@/features/auth/profileSchema';
import { useSession } from '@/features/auth/SessionProvider';
import { Colors } from '@/constants/theme';
import { strings } from '@/localization';
import { supabase } from '@/lib/supabase/client';

export function ProfileSetupForm() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: '' },
  });
  const mutation = useMutation({
    mutationFn: async ({ displayName }: ProfileFormValues) => {
      if (!supabase || !session) {
        throw new Error('Brak aktywnej sesji.');
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', session.user.id)
        .select('id')
        .maybeSingle();

      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error('Nie znaleziono profilu użytkownika.');
      }
      return displayName;
    },
    onSuccess: (displayName) => {
      setErrorMessage(null);
      queryClient.setQueryData(['profile', session?.user.id], displayName);
    },
    onError: (error: unknown) => setErrorMessage(getAuthErrorMessage(error)),
  });

  const submit = (values: ProfileFormValues) => {
    setErrorMessage(null);
    mutation.mutate(values);
  };
  const text = strings.pl.auth;

  return (
    <AuthFrame
      title={text.profileTitle}
      description={text.profileDescription}
      testID="profile-setup-screen"
    >
      <Text style={[authStyles.label, { color: colors.text }]}>{text.profileNameLabel}</Text>
      <Controller
        control={control}
        name="displayName"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            accessibilityLabel={text.profileNameLabel}
            testID="profile-name-input"
            autoCapitalize="words"
            autoComplete="name"
            editable={!mutation.isPending}
            maxLength={80}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder={text.profileNamePlaceholder}
            placeholderTextColor={colors.secondaryText}
            returnKeyType="done"
            style={[
              authStyles.input,
              {
                backgroundColor: colors.card,
                borderColor: errors.displayName ? '#B42318' : colors.border,
                color: colors.text,
              },
            ]}
            value={value}
            onSubmitEditing={() => void handleSubmit(submit)()}
          />
        )}
      />
      {errors.displayName?.message ? (
        <Text
          accessibilityRole="alert"
          testID="profile-name-error-message"
          style={[authStyles.message, styles.error]}
        >
          {errors.displayName.message}
        </Text>
      ) : null}
      {errorMessage ? (
        <Text
          accessibilityRole="alert"
          testID="profile-error-message"
          style={[authStyles.message, styles.error]}
        >
          {errorMessage}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        testID="profile-save-button"
        accessibilityState={{ disabled: mutation.isPending }}
        disabled={mutation.isPending}
        onPress={() => void handleSubmit(submit)()}
        style={({ pressed }) => [
          authStyles.button,
          { backgroundColor: colors.accent, opacity: pressed || mutation.isPending ? 0.8 : 1 },
        ]}
      >
        <Text
          style={[authStyles.buttonText, { color: colorScheme === 'dark' ? '#151915' : '#FFFFFF' }]}
        >
          {mutation.isPending ? text.profileSaving : text.profileSave}
        </Text>
      </Pressable>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#B42318',
  },
});
