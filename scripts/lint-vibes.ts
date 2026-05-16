import vibes from '../src/content/vibes.json' with { type: 'json' };
import { AXIS_GROUPS } from '../src/lib/types';

interface VibesShape {
  pairs: Array<{
    id: string;
    axes: string[];
    a: { weights: Record<string, number> };
    b: { weights: Record<string, number> };
  }>;
}

const errors: string[] = [];
const groupCoverage = new Set<string>();

for (const pair of (vibes as unknown as VibesShape).pairs) {
  if (!pair.axes?.length) errors.push(`${pair.id}: no axes declared`);
  for (const side of ['a', 'b'] as const) {
    const weightAxes = Object.keys(pair[side].weights);
    if (weightAxes.length === 0) errors.push(`${pair.id}.${side}: no weights`);
    for (const a of weightAxes) {
      if (!pair.axes.includes(a)) errors.push(`${pair.id}.${side}: weight on '${a}' not in axes`);
    }
  }
  for (const a of pair.axes) {
    for (const [g, axes] of Object.entries(AXIS_GROUPS)) {
      if ((axes as readonly string[]).includes(a)) groupCoverage.add(g);
    }
  }
}

const missingGroups = ['vibe', 'pace', 'taste'].filter(g => !groupCoverage.has(g));
if (missingGroups.length) errors.push(`axis groups not covered: ${missingGroups.join(', ')}`);

if (errors.length) {
  console.error('❌ vibes.json lint errors:');
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
}
console.log(`✅ vibes.json clean: ${(vibes as unknown as VibesShape).pairs.length} pairs, all 3 axis groups covered`);
