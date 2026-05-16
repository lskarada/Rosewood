// One-shot preview of the redesigned brief.
// Run: pnpm tsx scripts/preview-brief.ts
import { renderBrief } from '../src/lib/inference';
import { loadPairs } from '../src/lib/content';
import { emptyProfile, type SurveyState } from '../src/lib/types';

const pool = loadPairs();

// Realistic visual run: 8 answers, one miss on pair 5, final streak 3
const answered = [
  { pairId: 'pool-vs-cabana',         chose: 'b' as const, predicted: undefined,        correct: undefined },
  { pairId: 'rooftop-vs-fireplace',   chose: 'b' as const, predicted: undefined,        correct: undefined },
  { pairId: 'trail-vs-spa',           chose: 'a' as const, predicted: undefined,        correct: undefined },
  { pairId: 'local-vs-onproperty',    chose: 'a' as const, predicted: 'a' as const,     correct: true },
  { pairId: 'ramen-vs-market',        chose: 'a' as const, predicted: 'a' as const,     correct: true },
  { pairId: 'minimal-vs-maximal',     chose: 'b' as const, predicted: 'a' as const,     correct: false }, // miss
  { pairId: 'beach-vs-forest',        chose: 'b' as const, predicted: 'b' as const,     correct: true },
  { pairId: 'solo-vs-group',          chose: 'a' as const, predicted: 'a' as const,     correct: true },
];

// Profile shaped by those choices: quiet (social-), late-night (evening-?), but they picked rooftop... hmm
// Easier: just hand-set a realistic profile vector.
const state: SurveyState = {
  token: 'demo',
  modality: 'visual',
  profile: {
    ...emptyProfile(),
    social:      -0.7,  // quiet base
    evening:     -0.5,  // early-evening
    activity:    +0.4,  // high-activity mornings
    dining:      +0.6,  // hidden local spot
    aesthetic:   -0.3,  // maximalist
    format:      +0.4,  // solo
    environment: -0.5,  // forested
    chronotype:  +0.3,  // night-owl
  },
  answered,
  streak: 3,
  maxStreak: 4,
  exhaustedPairIds: answered.map(a => a.pairId),
  isComplete: true,
  confidence: 0.78,
};

const brief = renderBrief(state, pool);

const line = '─'.repeat(72);
console.log('\n' + line);
console.log(`  ${brief.headline.toUpperCase()}                             via ${brief.modality}`);
console.log(line);
console.log();
console.log('  ' + brief.greeting.replace(/(.{0,68})\s/g, '$1\n  '));
console.log();
if (brief.surprise) {
  console.log('  ⚠ ONE TO NOTE');
  console.log('  ' + brief.surprise.replace(/(.{0,68})\s/g, '$1\n  '));
  console.log();
}
console.log('  WHERE YOU CAN ACT');
brief.recommendations.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.title}`);
  console.log(`     ${r.blurb}`);
});
console.log();
console.log('  ' + brief.confidencePhrase);
console.log();
console.log(`  ${brief.signoff}`);
console.log(`  (${brief.answeredCount} answers · max streak ${brief.maxStreak} · ${Math.round(brief.confidence * 100)}% confidence)`);
console.log(line + '\n');
