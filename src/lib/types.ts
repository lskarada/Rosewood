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
  spine: Array<{ label: string; vs: string; image: string }>;
  recommendations: BriefRecommendation[];
  confidencePhrase: string;
  signoff: string;
  topAxes: Array<{ axis: Axis; score: number; label: string }>;
  confidence: number;
  answeredCount: number;
  maxStreak: number;
  // Feed-mode extras (optional so audio path still compiles)
  liked?: Array<{ cardId: string; image: string; label: string }>;
  bounced?: Array<{ cardId: string; image: string; label: string }>;
  inTheirWords?: WrapAnswers;
  engagement?: 'high' | 'medium' | 'quick';
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

// === Feed-mode types (spec §6) =============================================

export type Reaction = 'like' | 'dislike' | 'lingered' | 'bounced' | 'neutral';

export interface FeedCardRef {
  cardId: string;        // <pair-id>-<a|b>
  pairId: string;
  side: 'a' | 'b';
  axes: Axis[];
  weights: Partial<Record<Axis, number>>;
  image: string;
  label: string;
  audioPrompt: string;
}

export interface CardEvent {
  cardId: string;
  reaction: Reaction;
  dwellMs: number;
  enteredAt: number;
}

export interface WrapAnswers {
  partySize?: string;
  constraints?: string;
  perfectTrip?: string;
}

export interface FeedState {
  token: string;
  deck: FeedCardRef[];   // length 10
  cursor: number;        // 0..deck.length
  events: CardEvent[];
  wrap: WrapAnswers;
  isComplete: boolean;
}

// Extension of GuestBrief for feed-mode renderBrief (spec §6, §11).
// New optional fields — keeps the existing brief type backward compatible.
export interface FeedBriefExtras {
  liked: Array<{ cardId: string; image: string; label: string }>;
  bounced: Array<{ cardId: string; image: string; label: string }>;
  inTheirWords: WrapAnswers;
  engagement: 'high' | 'medium' | 'quick';
}
