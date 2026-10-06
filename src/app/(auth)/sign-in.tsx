import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field, Logo } from '@/components/ui';
import { Alert } from '@/lib/alert';
import { isDemo, signIn, signUp as signUpWithEmail } from '@/lib/api';
import { colors } from '@/lib/theme';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);

  const signUp = mode === 'signUp';

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      return Alert.alert('Almost there', 'Enter your email and a password of at least 6 characters.');
    }
    if (signUp && !/^[a-z0-9._]{3,24}$/.test(username)) {
      return Alert.alert('Pick a username', 'Use 3–24 lowercase letters, numbers, dots or underscores.');
    }
    setBusy(true);
    try {
      if (signUp) {
        const signedIn = await signUpWithEmail(email.trim(), password, username);
        if (!signedIn) {
          Alert.alert('Check your inbox', 'We sent you a link to confirm your email. Open it, then sign in here.');
          setMode('signIn');
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e) {
      Alert.alert(signUp ? 'Sign up failed' : 'Sign in failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={['rgba(139,92,246,0.45)', 'transparent']} style={styles.glow} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Logo size={40} />
            <Text style={styles.title}>{signUp ? 'Join the vibe.' : 'Welcome back.'}</Text>
            <Text style={styles.subtitle}>
              {signUp ? 'Create an account to post, follow creators and save what you love.' : 'Sign in to pick up where you left off.'}
            </Text>

            <View style={{ gap: 12, marginTop: 28 }}>
              {signUp && (
                <Field
                  icon="at"
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={username}
                  onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                />
              )}
              <Field icon="mail-outline" placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
              <Field icon="lock-closed-outline" placeholder="Password" secureTextEntry autoComplete={signUp ? 'new-password' : 'current-password'} value={password} onChangeText={setPassword} onSubmitEditing={submit} />
              <Button title={signUp ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} style={{ marginTop: 8 }} />
            </View>

            {isDemo && (
              <View style={styles.demo}>
                <Text style={styles.demoTitle}>Demo mode</Text>
                <Text style={styles.demoBody}>
                  No backend is connected yet, so the app runs on sample data that resets when you reload. Any email and password works.
                </Text>
                <Button
                  title="Explore the demo"
                  variant="lime"
                  icon="sparkles"
                  onPress={() => {
                    setBusy(true);
                    signIn('you@vybe.demo', 'demo').finally(() => setBusy(false));
                  }}
                />
              </View>
            )}

            <Pressable onPress={() => setMode(signUp ? 'signIn' : 'signUp')} style={{ marginTop: 24, alignSelf: 'center' }}>
              <Text style={{ color: colors.textMuted }}>
                {signUp ? 'Already have an account? ' : 'New to VYBE? '}
                <Text style={{ color: colors.lime, fontWeight: '700' }}>{signUp ? 'Sign in' : 'Create one'}</Text>
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 380 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 28 },
  demo: { marginTop: 24, padding: 16, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(198,244,50,0.35)', backgroundColor: 'rgba(198,244,50,0.06)' },
  demoTitle: { color: colors.lime, fontWeight: '800', fontSize: 15 },
  demoBody: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 8 },
});
