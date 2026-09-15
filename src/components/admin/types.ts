export interface DashboardObjective {
  id: string;
  titleZh: string;
  status: string;
  progress: number;
  endDate: string | null;
}

export interface DashboardData {
  cycleCount: number;
  objectiveCount: number;
  completedObjectives: number;
  atRiskObjectives: number;
  averageProgress: number;
  objectives: DashboardObjective[];
}

export interface SiteVersionData {
  id: string;
  version: number;
  status: string;
  content: SiteContent;
  publishedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProgressUpdateData {
  id: string;
  currentValue: number | null;
  manualProgress: number | null;
  calculatedProgress: number;
  noteZh: string | null;
  noteEn: string | null;
  recordedAt: string;
}

export interface KeyResultData {
  id: string;
  objectiveId: string;
  titleZh: string;
  titleEn: string | null;
  descriptionZh: string | null;
  descriptionEn: string | null;
  progressMode: string;
  startValue: number | null;
  currentValue: number | null;
  targetValue: number | null;
  unit: string | null;
  manualProgress: number | null;
  weight: number;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  progressUpdates: ProgressUpdateData[];
  actionItems: ActionItemData[];
}

export interface ActionItemData {
  id: string;
  keyResultId: string;
  titleZh: string;
  titleEn: string | null;
  status: string;
  dueDate: string | null;
  sortOrder: number;
  recurrenceType: string;
  recurrenceInterval: number;
  recurrenceDays: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ObjectiveData {
  id: string;
  cycleId: string;
  titleZh: string;
  titleEn: string | null;
  descriptionZh: string | null;
  descriptionEn: string | null;
  status: string;
  visibility: string;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  keyResults: KeyResultData[];
}

export interface ReviewData {
  id: string;
  cycleId: string;
  objectiveId: string | null;
  achievementsZh: string;
  achievementsEn: string | null;
  problemsZh: string;
  problemsEn: string | null;
  lessonsZh: string;
  lessonsEn: string | null;
  nextActionsZh: string;
  nextActionsEn: string | null;
  score: number | null;
  visibility: string;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OkrCycleData {
  id: string;
  nameZh: string;
  nameEn: string | null;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  objectives: ObjectiveData[];
  reviews: ReviewData[];
}

export interface OkrCycleBriefData {
  id: string;
  nameZh: string;
  nameEn: string | null;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
}

export interface ObjectiveDetailData extends ObjectiveData {
  cycle: OkrCycleBriefData;
  reviews: ReviewData[];
}

export interface AssetData {
  id: string;
  originalFilename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  sha256: string;
  altTextZh: string | null;
  altTextEn: string | null;
  isReferenced: boolean;
  references: AssetReferenceData[];
  createdAt: string;
}

export interface AssetReferenceData {
  versionId: string;
  version: number;
  status: string;
  path: string;
}

export interface CareerActivityData {
  id: string;
  titleZh: string;
  titleEn: string | null;
  summaryZh: string;
  summaryEn: string | null;
  occurredAt: string;
  visibility: "PUBLIC" | "PRIVATE";
  featured: boolean;
  linkUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
import type { SiteContent } from "../../lib/content/schema";
