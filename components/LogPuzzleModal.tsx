import { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { parseNYTResult, ParsedGame } from '../services/nyt-parser';
import { awardXp } from '../services/xp-engine';
import { awardStatSp, puzzleIntelligenceSp } from '../services/stat-engine';

interface Props {
  visible: boolean;
  onClose: () => void;
  heroId: string;
  primaryStat: any;
  secondaryStat: any;
  currentTotalXp: number;
  currentLevel: number;
  streakDays: number;
  longestStreak: number;
  lastActiveDate: string | null;
  userId: string;
  accentColor: string;
  onSuccess: (result: any) => void;
}

export function LogPuzzleModal({
  visible, onClose, heroId, primaryStat, secondaryStat,
  currentTotalXp, currentLevel, streakDays, longestStreak,
  lastActiveDate, userId, accentColor, onSuccess,
}: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const parsed: ParsedGame | null = parseNYTResult(text);

  function handleClose() {
    setText('');
    onClose();
  }

  async function handleSubmit() {
    if (!parsed) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setLoading(true);
    const puzzleAccuracy = parsed.guesses ?? parsed.mistakes;
    const result = await awardXp(
      userId, heroId, primaryStat, secondaryStat,
      currentTotalXp, currentLevel, streakDays, longestStreak, lastActiveDate,
      { puzzle: { xp: parsed.xp, rawValue: 1 } },
      timezone, parsed.game, 'manual',
      undefined, false, parsed.sessionId,
      1, puzzleAccuracy,
    );
    const today = new Date().toLocaleDateString('en-CA');
    const intelligenceSp = puzzleIntelligenceSp(parsed.game, puzzleAccuracy);
    await awardStatSp(userId, heroId, 'intelligence', intelligenceSp, 'puzzle', parsed.sessionId, today);
    setLoading(false);
    setText('');
    onSuccess(result);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-end bg-black/70">
        <View className="bg-[#12121E] rounded-t-2xl p-6 border-t border-[#1E1E35]">
          <View className="flex-row justify-between items-center mb-5">
            <View>
              <Text className="text-white text-lg font-bold">Log Puzzle</Text>
              <Text className="text-gray-400 text-xs mt-0.5">Paste your NYT share result</Text>
            </View>
            <TouchableOpacity onPress={handleClose}>
              <Text className="text-gray-400 text-lg">✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            className="bg-[#1A1A2E] text-white border border-[#1E1E35] rounded-xl px-4 py-3 text-sm mb-4"
            value={text}
            onChangeText={setText}
            placeholder="Paste Wordle, Connections, Mini, or Strands result…"
            placeholderTextColor="#374151"
            multiline
            numberOfLines={4}
            style={{ minHeight: 90, textAlignVertical: 'top' }}
          />

          {/* Preview */}
          {text.length > 0 && (
            <View
              className="rounded-xl px-4 py-3 mb-4 flex-row items-center justify-between"
              style={{ backgroundColor: parsed ? '#0F1F0F' : '#1A0F0F', borderWidth: 1, borderColor: parsed ? '#166534' : '#7F1D1D' }}
            >
              {parsed ? (
                <>
                  <View>
                    <Text className="text-white font-semibold text-sm">🧠 {parsed.displayName}</Text>
                    <Text className="text-gray-400 text-xs mt-0.5">
                      {parsed.solved ? '✓ Solved' : '✗ Not solved'}
                      {parsed.guesses != null ? `  ·  ${parsed.guesses}/6 guesses` : ''}
                      {parsed.mistakes != null ? `  ·  ${parsed.mistakes} mistake${parsed.mistakes !== 1 ? 's' : ''}` : ''}
                    </Text>
                  </View>
                  <Text style={{ color: accentColor }} className="font-bold text-base">+{parsed.xp} XP</Text>
                </>
              ) : (
                <Text className="text-red-400 text-sm">Couldn't recognise this result</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            className="rounded-xl py-4 items-center"
            style={{ backgroundColor: parsed ? accentColor : '#1E1E35' }}
            onPress={handleSubmit}
            disabled={!parsed || loading}
          >
            {loading
              ? <ActivityIndicator color="#09090F" />
              : <Text style={{ color: parsed ? '#09090F' : '#4B5563' }} className="font-bold tracking-widest">LOG PUZZLE</Text>
            }
          </TouchableOpacity>
        </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
