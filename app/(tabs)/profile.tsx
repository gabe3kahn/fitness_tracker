import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { recalculateStats } from '../../services/recalculate-stats';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useUserStore } from '../../stores/user-store';
import { useActiveHero, useActiveHeroDef } from '../../hooks/useHeroProgression';
import { signOut } from '../../services/auth';
import { supabase } from '../../services/supabase';
import { CLASS_COLORS, CLASS_SYMBOLS } from '../../constants/ui';
import { isHealthKitAvailable } from '../../services/health/healthkit';
import { useHealthSync } from '../../hooks/useHealthSync';
import { useUnits } from '../../hooks/useUnits';
import { isAdminUser } from '../../constants/admin';

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, paddingHorizontal: 4 }}>
      {label}
    </Text>
  );
}

function SettingsRow({
  icon, label, value, onPress, destructive, right,
}: {
  icon?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#111120' }}
    >
      {icon && <Text style={{ fontSize: 18, width: 32 }}>{icon}</Text>}
      <Text style={{ flex: 1, fontSize: 15, color: destructive ? '#F87171' : '#DDD', fontWeight: '500' }}>{label}</Text>
      {right ?? (value ? <Text style={{ fontSize: 12, color: '#6B7280' }}>{value}</Text> : null)}
      {onPress && !right && !destructive && (
        <Text style={{ color: '#444', fontSize: 14, marginLeft: 6 }}>›</Text>
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useUserStore();
  const { data: activeHero } = useActiveHero();
  const heroDef = useActiveHeroDef(activeHero?.hero_id);
  const colors = heroDef ? CLASS_COLORS[heroDef.heroClass] : CLASS_COLORS.warrior;
  const [signingOut, setSigningOut] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [healthConnection, setHealthConnection] = useState<{ last_sync_at: string; is_active: boolean } | null | undefined>(undefined);
  const { connectHealth, sleepEnabled, enableSleepTracking, disableSleepTracking } = useHealthSync();
  const { isImperial, distanceUnit } = useUnits();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('health_connections')
      .select('last_sync_at, is_active')
      .eq('user_id', user.id)
      .eq('platform', 'apple_health')
      .maybeSingle()
      .then(({ data }) => setHealthConnection(data));
  }, [user?.id]);

  const { data: stats } = useQuery({
    queryKey: ['profile-stats', user?.id],
    queryFn: async () => {
      const [profileRes, heroesRes, eventsRes] = await Promise.all([
        supabase.from('profiles').select('created_at').eq('id', user!.id).single(),
        supabase.from('user_heroes').select('total_xp, longest_streak').eq('user_id', user!.id),
        supabase
          .from('xp_events')
          .select('session_id, source, raw_value')
          .eq('user_id', user!.id)
          .not('activity_type', 'eq', 'steps'),
      ]);

      const totalXp = (heroesRes.data ?? []).reduce((s, h) => s + (h.total_xp ?? 0), 0);
      const bestStreak = Math.max(0, ...(heroesRes.data ?? []).map(h => h.longest_streak ?? 0));

      const sessionSet = new Set<string>();
      const distanceSessionSet = new Set<string>();
      let distanceMi = 0;
      for (const e of eventsRes.data ?? []) {
        sessionSet.add(e.session_id);
        if (e.source === 'distanceRun' || e.source === 'distanceCycle' || e.source === 'distanceSwim') {
          const key = `${e.source}:${e.session_id}`;
          if (!distanceSessionSet.has(key)) {
            distanceSessionSet.add(key);
            distanceMi += (e.raw_value ?? 0);
          }
        }
      }

      const createdAt = profileRes.data?.created_at;
      const memberSince = createdAt
        ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : null;

      return { totalXp, bestStreak, workouts: sessionSet.size, distanceMi, memberSince };
    },
    enabled: !!user,
  });

  const displayName = user?.email?.split('@')[0] ?? 'Hero';
  const distDisplay = stats
    ? isImperial
      ? `${stats.distanceMi.toFixed(0)} ${distanceUnit}`
      : `${(stats.distanceMi * 1.60934).toFixed(0)} ${distanceUnit}`
    : '—';

  async function handleDisconnectHealth() {
    if (!user) return;
    Alert.alert(
      'Disconnect Apple Health',
      'This will stop syncing workouts. Your existing XP will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect', style: 'destructive',
          onPress: async () => {
            await supabase.from('health_connections').delete().eq('user_id', user.id).eq('platform', 'apple_health');
            setHealthConnection(null);
          },
        },
      ]
    );
  }

  async function handleReconnectHealth() {
    await connectHealth();
    const { data } = await supabase
      .from('health_connections').select('last_sync_at, is_active').eq('user_id', user!.id).eq('platform', 'apple_health').maybeSingle();
    setHealthConnection(data);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setUser(null);
    setSigningOut(false);
  }

  const statTiles = [
    { icon: '⭐', val: stats?.totalXp.toLocaleString() ?? '—', lbl: 'Total XP' },
    { icon: '🏃', val: stats?.workouts.toLocaleString() ?? '—', lbl: 'Workouts' },
    { icon: '📍', val: distDisplay, lbl: 'Distance' },
    { icon: '🔥', val: String(stats?.bestStreak ?? '—'), lbl: 'Best Streak' },
  ];

  const lastSyncedText = healthConnection?.last_sync_at
    ? new Date(healthConnection.last_sync_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#09090F' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Profile header */}
        <LinearGradient
          colors={[colors.dimBg, '#09090F']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Text style={{ fontSize: 30 }}>{CLASS_SYMBOLS[heroDef?.id ?? ''] ?? '⚔️'}</Text>
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{displayName}</Text>
            <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2 }}>{user?.email}</Text>
            {stats?.memberSince && (
              <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 3 }}>Member since {stats.memberSince}</Text>
            )}
          </View>
        </LinearGradient>

        {/* All-time stats */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, margin: 20 }}>
          {statTiles.map(({ icon, val, lbl }) => (
            <View key={lbl} style={{ width: '47%', backgroundColor: '#12121E', borderWidth: 1, borderColor: '#1E1E35', borderRadius: 16, padding: 14 }}>
              <Text style={{ fontSize: 20, marginBottom: 6 }}>{icon}</Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{val}</Text>
              <Text style={{ color: '#555', fontSize: 11, marginTop: 3 }}>{lbl}</Text>
            </View>
          ))}
        </View>

        {/* Health */}
        {isHealthKitAvailable() && (
          <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <SectionLabel label="Health" />
            <View style={{ backgroundColor: '#12121E', borderWidth: 1, borderColor: '#1E1E35', borderRadius: 16, overflow: 'hidden' }}>
              <SettingsRow
                icon="🍎"
                label="Apple Health"
                right={
                  healthConnection === undefined ? (
                    <ActivityIndicator size="small" color="#6B7280" />
                  ) : healthConnection ? (
                    <TouchableOpacity onPress={handleDisconnectHealth}>
                      <Text style={{ color: '#F87171', fontSize: 13, fontWeight: '600' }}>Disconnect</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={handleReconnectHealth}>
                      <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Connect</Text>
                    </TouchableOpacity>
                  )
                }
              />
              <SettingsRow
                icon="🌙"
                label="Sleep Tracking"
                right={
                  <Switch
                    value={sleepEnabled}
                    onValueChange={(val) => { if (val) enableSleepTracking(); else disableSleepTracking(); }}
                    trackColor={{ false: '#333', true: colors.accent }}
                    thumbColor="#fff"
                  />
                }
              />
              {lastSyncedText && (
                <SettingsRow icon="🕐" label="Last Synced" value={lastSyncedText} />
              )}
            </View>
          </View>
        )}

        {/* Account */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <SectionLabel label="Account" />
          <View style={{ backgroundColor: '#12121E', borderWidth: 1, borderColor: '#1E1E35', borderRadius: 16, overflow: 'hidden' }}>
            <SettingsRow icon="👤" label="Email" value={user?.email ?? '—'} />
            {isAdminUser(user?.email) && <SettingsRow icon="⚔️" label="Switch Hero" onPress={() => router.push('/hero-select')} />}
          </View>
        </View>

        {/* Recalculate stats — dev only */}
        {isAdminUser(user?.email) && <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={async () => {
              if (!user) return;
              setRecalculating(true);
              try {
                await recalculateStats(user.id);
                Alert.alert('Done', 'Stats recalculated from event history.');
              } catch (e) {
                Alert.alert('Error', String(e));
              } finally {
                setRecalculating(false);
              }
            }}
            disabled={recalculating}
            style={{ backgroundColor: '#12121E', borderWidth: 1, borderColor: '#1E1E35', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            {recalculating
              ? <ActivityIndicator color="#6B7280" />
              : <Text style={{ color: '#6B7280', fontSize: 15, fontWeight: '600' }}>Recalculate Stats</Text>
            }
          </TouchableOpacity>
        </View>}

        {/* Sign out */}
        <View style={{ paddingHorizontal: 20 }}>
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={signingOut}
            style={{ backgroundColor: '#12121E', borderWidth: 1, borderColor: '#1E1E35', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            {signingOut
              ? <ActivityIndicator color="#F87171" />
              : <Text style={{ color: '#F87171', fontSize: 15, fontWeight: '600' }}>Sign Out</Text>
            }
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
