import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { signUp } from '../../services/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);

    // Username passed as metadata — trigger creates the profile row server-side
    const { error: signUpError } = await signUp(email.trim(), password, username.trim().toLowerCase());
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.replace('/hero-select');
  }

  return (
    <SafeAreaView className="flex-1 bg-[#09090F]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 py-12">
            {/* Back */}
            <TouchableOpacity
              className="mb-8 self-start"
              onPress={() => router.back()}
            >
              <Text className="text-gray-400 text-sm">← Back to login</Text>
            </TouchableOpacity>

            {/* Header */}
            <Text className="text-white text-3xl font-bold mb-1">
              Begin Your Legend
            </Text>
            <Text className="text-gray-400 mb-10">
              Choose your name. Your story starts now.
            </Text>

            {/* Username */}
            <Text className="text-gray-400 text-xs tracking-widest uppercase mb-2">
              Username
            </Text>
            <TextInput
              className="bg-[#12121E] text-white border border-[#1E1E35] rounded-lg text-base"
              style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, minHeight: 52 }}
              placeholder="warrior_of_legend"
              placeholderTextColor="#4B5563"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Email */}
            <Text className="text-gray-400 text-xs tracking-widest uppercase mb-2 mt-5">
              Email
            </Text>
            <TextInput
              className="bg-[#12121E] text-white border border-[#1E1E35] rounded-lg text-base"
              style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, minHeight: 52 }}
              placeholder="hero@example.com"
              placeholderTextColor="#4B5563"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            {/* Password */}
            <Text className="text-gray-400 text-xs tracking-widest uppercase mb-2 mt-5">
              Password
            </Text>
            <TextInput
              className="bg-[#12121E] text-white border border-[#1E1E35] rounded-lg text-base"
              style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, minHeight: 52 }}
              placeholder="••••••••"
              placeholderTextColor="#4B5563"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            {/* Error */}
            {error ? (
              <Text className="text-red-400 text-sm mt-3">{error}</Text>
            ) : null}

            {/* Register button */}
            <TouchableOpacity
              className="bg-amber-500 rounded-lg py-4 mt-7 items-center"
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#09090F" />
              ) : (
                <Text className="text-[#09090F] font-bold text-base tracking-widest">
                  FORGE YOUR HERO
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
