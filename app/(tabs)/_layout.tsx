import { Tabs } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#09090F',
          borderTopColor: '#1E1E35',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: '#4B5563',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="house.fill" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="hero"
        options={{
          title: 'Hero',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="shield.fill" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="figure.run" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="person.crop.circle.fill" size={size} color={color} />
          ),
        }}
      />
      {/* Quests kept as a hidden route — not shown in tab bar */}
      <Tabs.Screen name="quests" options={{ href: null }} />
    </Tabs>
  );
}
