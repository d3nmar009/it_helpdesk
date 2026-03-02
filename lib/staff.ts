import { prisma } from "@/lib/prisma";

export type StaffOption = { id: string; name: string };

/**
 * Returns all active staff (direct + indirect) under a boss.
 * Uses an iterative BFS to avoid recursion limits and prevents cycles via `seen`.
 */
export async function getAllActiveStaffUnderBoss(bossId: string): Promise<StaffOption[]> {
  const seen = new Set<string>();
  const results: StaffOption[] = [];

  // queue contains "boss ids" to expand (starting from the root boss)
  const queue: string[] = [bossId];

  while (queue.length) {
    const batch = queue.splice(0, 50);
    const direct = await prisma.users.findMany({
      where: { isActive: true, reportsToId: { in: batch } },
      select: { id: true, name: true },
    });

    for (const u of direct) {
      if (u.id === bossId) continue;
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      results.push({ id: u.id, name: u.name });
      queue.push(u.id);
    }
  }

  results.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  return results;
}

export async function getAllActiveStaffUnderBossIds(bossId: string): Promise<string[]> {
  const staff = await getAllActiveStaffUnderBoss(bossId);
  return staff.map((s) => s.id);
}

