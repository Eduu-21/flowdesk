import { toMinutes } from './dates';

interface Timed {
  startTime: string;
  endTime: string;
}

export interface Placed<T> {
  item: T;
  lane: number;
  lanes: number;
}

/** Places overlapping appointments side by side inside one day column. */
export function layoutDay<T extends Timed>(items: T[]): Placed<T>[] {
  const sorted = [...items].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || toMinutes(b.endTime) - toMinutes(a.endTime),
  );
  const result: Placed<T>[] = [];
  let cluster: { item: T; lane: number }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = cluster.reduce((max, c) => Math.max(max, c.lane + 1), 1);
    for (const c of cluster) result.push({ item: c.item, lane: c.lane, lanes });
    cluster = [];
  };

  for (const item of sorted) {
    const start = toMinutes(item.startTime);
    if (cluster.length && start >= clusterEnd) flush();
    const taken = new Set(
      cluster.filter((c) => toMinutes(c.item.endTime) > start).map((c) => c.lane),
    );
    let lane = 0;
    while (taken.has(lane)) lane += 1;
    cluster.push({ item, lane });
    clusterEnd = Math.max(clusterEnd, toMinutes(item.endTime));
  }
  flush();
  return result;
}
