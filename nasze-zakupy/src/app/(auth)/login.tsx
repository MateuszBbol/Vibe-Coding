import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';

import { AuthFrame, authStyles } from '@/features/auth/AuthFrame';
import { getAuthErrorMessage } from '@/features/auth/errors';
import { loginSchema } from '@/features/auth/schemas';
import type { LoginFormInput, LoginFormValues } from '@/features/auth/schemas';
import { useSession } from '@/features/auth/SessionProvider';
import { Colors, Spacing } from '@/constants/theme';
import { strings } from '@/localization';
import { supabase } from '@/lib/supabase/client';

export default function LoginScreen() {
  const text = strings.pl.auth;
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const { authError, clearAuthError, isConfigured } = useSession();
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signIn = async ({ email, password }: LoginFormValues) => {
    if (!supabase) {
      return;
    }

    setIsSigningIn(true);
    setRequestError(null);
    clearAuthError();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
    } catch (error) {
      setRequestError(getAuthErrorMessage(error));
    } finally {
      setIsSigningIn(false);
    }
  };

  const errorMessage = requestError ?? authError;

  return (
    <AuthFrame title={text.loginTitle} description={text.loginDescription} testID="login-screen">
      <Text style={[authStyles.label, { color: colors.text }]}>{text.emailLabel}</Text>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            accessibilityLabel={text.emailLabel}
            accessibilityHint={text.emailHint}
            testID="login-email-input"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!isSigningIn}
            keyboardType="email-address"
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder={text.emailPlaceholder}
            placeholderTextColor={colors.secondaryText}
            returnKeyType="next"
            style={[
              authStyles.input,
              {
                backgroundColor: colors.card,
                borderColor: errors.email ? '#B42318' : colors.border,
                color: colors.text,
              },
            ]}
            textContentType="emailAddress"
            value={value}
          />
        )}
      />
      {errors.email?.message ? (
        <Text
          accessibilityRole="alert"
          testID="login-email-error-message"
          style={[authStyles.message, styles.error]}
        >
          {errors.email.message}
        </Text>
      ) : null}

      <Text style={[authStyles.label, styles.passwordLabel, { color: colors.text }]}>
        {text.passwordLabel}
      </Text>
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            accessibilityLabel={text.passwordLabel}
            accessibilityHint={text.passwordHint}
            testID="login-password-input"
            autoCapitalize="none"
            autoComplete="current-password"
            autoCorrect={false}
            editable={!isSigningIn}
            onBlur={onBlur}
            onChangeText={onChange}
            onSubmitEditing={() => void handleSubmit(signIn)()}
            placeholder={text.passwordPlaceholder}
            placeholderTextColor={colors.secondaryText}
            returnKeyType="go"
            secureTextEntry
            style={[
              authStyles.input,
              {
                backgroundColor: colors.card,
                borderColor: errors.password ? '#B42318' : colors.border,
                color: colors.text,
              },
            ]}
            textContentType="password"
            value={value}
          />
        )}
      />
      {errors.password?.message ? (
        <Text
          accessibilityRole="alert"
          testID="login-password-error-message"
          style={[authStyles.message, styles.error]}
        >
          {errors.password.message}
        </Text>
      ) : null}

      {errorMessage ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="login-error-message"
          style={[authStyles.message, styles.error]}
        >
          {errorMessage}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityHint={text.loginDescription}
        testID="login-submit-button"
        accessibilityState={{ disabled: isSigningIn || !isConfigured }}
        disabled={isSigningIn || !isConfigured}
        onPress={() => void handleSubmit(signIn)()}
        style={({ pressed }) => [
          authStyles.button,
          { backgroundColor: colors.accent, opacity: pressed || isSigningIn ? 0.8 : 1 },
        ]}
      >
        <Text
          style={[authStyles.buttonText, { color: colorScheme === 'dark' ? '#151915' : '#FFFFFF' }]}
        >
          {isSigningIn ? text.signingIn : text.loginButton}
        </Text>
      </Pressable>
      {!isConfigured ? (
        <View style={[styles.notice, { backgroundColor: colors.accentSoft }]}>
          <Text style={[authStyles.message, { color: colors.text }]}>
            {text.missingConfigDescription}
          </Text>
        </View>
      ) : null}
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#B42318',
  },
  notice: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.three,
  },
  passwordLabel: {
    marginTop: Spacing.three,
  },
});
