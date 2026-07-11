/**
 * ActivityService — the public participation ticker. Full wallet addresses
 * are stored; truncation happens only at DTO mapping time.
 */
import { truncAddr, type ActivityEventDTO, type Project } from '@apogee/shared';
import { ActivityEventModel } from '../models/ActivityEvent';
import type { ProjectDoc } from '../models/Project';

interface ActivityLike {
  _id: unknown;
  wallet: string;
  amountUsd: number;
  ts: Date;
}

type ProjectLike = Pick<Project, 'slug' | 'name' | 'ticker'>;

export function toActivityDTO(event: ActivityLike, project: ProjectLike): ActivityEventDTO {
  return {
    id: String(event._id),
    wallet: truncAddr(event.wallet),
    projectSlug: project.slug,
    projectName: project.name,
    ticker: project.ticker,
    amountUsd: event.amountUsd,
    ts: event.ts.toISOString(),
  };
}

/** Latest events, newest first (contract: 20). */
export async function latestEvents(limit = 20): Promise<ActivityEventDTO[]> {
  const docs = await ActivityEventModel.find()
    .sort({ ts: -1 })
    .limit(limit)
    .populate<{ projectId: ProjectDoc }>('projectId');
  return docs
    .filter((doc) => Boolean(doc.projectId))
    .map((doc) => toActivityDTO(doc, doc.projectId));
}

/** Record a participation event and return its DTO (for the socket broadcast). */
export async function recordEvent(
  wallet: string,
  project: ProjectDoc,
  amountUsd: number,
): Promise<ActivityEventDTO> {
  const doc = await ActivityEventModel.create({
    wallet,
    projectId: project._id,
    amountUsd,
    ts: new Date(),
  });
  return toActivityDTO(doc, project);
}
