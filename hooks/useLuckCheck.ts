import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useUserStore } from '../stores/user-store';
import { awardStatSp, GLOBAL_HERO } from '../services/stat-engine';
import { LUCK_SP_PER_LUCKY_DAY } from '../constants/stats';
import { useRefreshPlayerStats } from './usePlayerStats';

const LUCK_CHANCE = 1 / 3;

export function useLuckCheck() {
  const { user } = useUserStore();
  const refreshStats = useRefreshPlayerStats();
  const [luckyToday, setLuckyToday] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkDailyLuck(user.id);
  }, [user?.id]);

  async function checkDailyLuck(userId: string) {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

    const { data: profile } = await supabase
      .from('profiles')
      .select('last_luck_check')
      .eq('id', userId)
      .single();

    if (profile?.last_luck_check === today) {
      console.log(`[Luck] already checked today (${today}) — skipping`);
      return;
    }

    const won = Math.random() < LUCK_CHANCE;
    console.log(`[Luck] daily check date=${today} chance=${LUCK_CHANCE.toFixed(2)} won=${won} sp=${won ? LUCK_SP_PER_LUCKY_DAY : 0}`);

    await Promise.all([
      supabase.from('profiles').update({ last_luck_check: today }).eq('id', userId),
      supabase.from('luck_checks').insert({ user_id: userId, checked_on: today, won }),
    ]);

    if (won) {
      await awardStatSp(userId, GLOBAL_HERO, 'luck', LUCK_SP_PER_LUCKY_DAY, 'lucky_day', `lucky_day_${today}`, today);
      refreshStats();
      setLuckyToday(true);
      console.log(`[Luck] modal shown — awarded ${LUCK_SP_PER_LUCKY_DAY} luck SP`);
    }
  }

  return { luckyToday, dismissLuck: () => setLuckyToday(false) };
}
