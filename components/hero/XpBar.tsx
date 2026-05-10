import { View, Text } from 'react-native';
import { xpProgressInLevel } from '../../constants/xp-config';

interface XpBarProps {
  totalXp: number;
  level: number;
  accentColor: string;
  compact?: boolean;
}

export function XpBar({ totalXp, level, accentColor, compact = false }: XpBarProps) {
  const { progress, needed, percent } = xpProgressInLevel(totalXp, level);

  return (
    <View>
      {!compact && (
        <View className="flex-row justify-between mb-1.5">
          <Text className="text-gray-400 text-xs uppercase tracking-wider">
            Level {level}
          </Text>
          <Text className="text-gray-400 text-xs">
            {progress.toLocaleString()} / {needed.toLocaleString()} XP
          </Text>
        </View>
      )}
      <View className="h-2 bg-[#1E1E35] rounded-full overflow-hidden">
        <View
          style={{ width: `${Math.round(percent * 100)}%`, backgroundColor: accentColor }}
          className="h-full rounded-full"
        />
      </View>
      {!compact && (
        <Text className="text-gray-600 text-xs mt-1 text-right">
          {(needed - progress).toLocaleString()} XP to Level {level + 1}
        </Text>
      )}
    </View>
  );
}
