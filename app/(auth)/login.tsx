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
import { signIn } from '../../services/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    const { error: authError } = await signIn(email.trim(), password);
    setLoading(false);
    if (authError) setError(authError.message);
    // On success, _layout.tsx auth guard handles the redirect
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
            {/* Header */}
            <Text className="text-amber-400 text-5xl font-bold text-center tracking-widest">
              ARETE
            </Text>
            <Text className="text-gray-400 text-center mt-2 mb-12">
              Train like a legend. Become one.
            </Text>

            {/* Email */}
            <Text className="text-gray-400 text-xs tracking-widest uppercase mb-2">
              Email
            </Text>
            <TextInput
              className="bg-[#12121E] text-white border border-[#1E1E35] rounded-lg text-base"
              style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, minHeight: 52 }}
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
              autoComplete="password"
            />

            {/* Error */}
            {error ? (
              <Text className="text-red-400 text-sm mt-3">{error}</Text>
            ) : null}

            {/* Login button */}
            <TouchableOpacity
              className="bg-amber-500 rounded-lg py-4 mt-7 items-center"
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#09090F" />
              ) : (
                <Text className="text-[#09090F] font-bold text-base tracking-widest">
                  ENTER THE REALM
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center my-8">
              <View className="flex-1 h-px bg-[#1E1E35]" />
              <Text className="text-gray-400 mx-4 text-xs tracking-widest uppercase">
                New here?
              </Text>
              <View className="flex-1 h-px bg-[#1E1E35]" />
            </View>

            {/* Register link */}
            <TouchableOpacity
              className="border border-[#1E1E35] rounded-lg py-4 items-center"
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.8}
            >
              <Text className="text-amber-400 font-semibold tracking-widest text-sm">
                BEGIN YOUR LEGEND
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
