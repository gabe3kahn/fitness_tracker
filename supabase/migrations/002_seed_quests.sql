-- Daily quests
INSERT INTO quests (title, description, quest_type, requirements, xp_reward, sort_order) VALUES
  ('Morning Warrior',  'Walk 5,000 steps today',        'daily',  '{"metric": "steps",          "target": 5000}', 50,  1),
  ('Stay Active',      'Log 20 active minutes',          'daily',  '{"metric": "activeMinutes",  "target": 20}',   40,  2),
  ('First Blood',      'Complete any workout',            'daily',  '{"metric": "workouts",       "target": 1}',    75,  3);

-- Weekly quests
INSERT INTO quests (title, description, quest_type, requirements, xp_reward, sort_order) VALUES
  ('Road to Glory',    'Run 15 km this week',             'weekly', '{"metric": "runningDistance","target": 15}',   200, 1),
  ('Iron Will',        'Maintain a 5-day activity streak','weekly', '{"metric": "streakDays",     "target": 5}',    150, 2),
  ('Furnace',          'Burn 2,500 active calories',      'weekly', '{"metric": "caloriesBurned", "target": 2500}', 175, 3);

-- Boss battles (hero-specific and global)
INSERT INTO quests (title, description, quest_type, hero_id, requirements, xp_reward, sort_order) VALUES
  ('Defeat the Nemean Lion', 'Complete your first 10K run',       'boss', 'hercules', '{"metric": "runningDistance","target": 10}',   500,  1),
  ('The Undefeated',         'Achieve a 30-day activity streak',  'boss', NULL,       '{"metric": "streakDays",     "target": 30}',   1000, 2),
  ('Century March',          'Walk 100,000 steps in a week',      'boss', NULL,       '{"metric": "steps",          "target": 100000}',750, 3),
  ('Iron Distance',          'Cycle 100 km in a week',            'boss', 'boudicca', '{"metric": "cyclingDistance","target": 100}',  600,  4),
  ('Ten Thousand Blows',     'Complete 100 total workouts',       'boss', NULL,       '{"metric": "workouts",       "target": 100}',  800,  5);
