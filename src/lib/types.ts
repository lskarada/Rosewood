export const AXES = [
  'social', 'evening', 'activity', 'dining',
  'aesthetic', 'format', 'environment', 'chronotype',
] as const;

export type Axis = typeof AXES[number];

export type ProfileVector = Record<Axis, number>;

export interface VibeSide {
  label: string;
  image: string;
  audioPrompt: string;
  weights: Partial<Record<Axis, number>>;
}

export interface VibePair {
  id: string;
  axes: Axis[];
  a: VibeSide;
  b: VibeSide;
}

export interface AnsweredPair {
  pairId: string;
  chose: 'a' | 'b';
  predicted?: 'a' | 'b';
  correct?: boolean;
  tMs?: number;
}

export interface SurveyState {
  token: string;
  modality: 'audio' | 'visual' | null;
  profile: ProfileVector;
  answered: AnsweredPair[];
  streak: number;
  maxStreak: number;
  exhaustedPairIds: string[];
  isComplete: boolean;
  confidence: number;
}

export interface BriefRecommendation {
  title: string;
  blurb: string;
}

export interface GuestBrief {
  token: string;
  modality: 'audio' | 'visual';
  headline: string;
  greeting: string;
  surprise?: string;
  spine: Array<{ label: string; vs: string }>;
  recommendations: BriefRecommendation[];
  confidencePhrase: string;
  signoff: string;
  topAxes: Array<{ axis: Axis; score: number; label: string }>;
  confidence: number;
  answeredCount: number;
  maxStreak: number;
}

export function emptyProfile(): ProfileVector {
  return {
    social: 0, evening: 0, activity: 0, dining: 0,
    aesthetic: 0, format: 0, environment: 0, chronotype: 0,
  };
}

export const AXIS_GROUPS = {
  vibe: ['social', 'evening', 'environment'] as Axis[],
  pace: ['activity', 'format', 'chronotype'] as Axis[],
  taste: ['dining', 'aesthetic'] as Axis[],
} as const;
