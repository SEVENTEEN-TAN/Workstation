export type { DashboardData, DashboardObjectiveData } from "../../lib/services/okr";

export type { AuditLogData } from "../../lib/services/audit-logs";

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

export type { AssetData, AssetReferenceData } from "../../lib/services/assets";

export type { CareerActivityData } from "../../lib/services/career-activities";

export type { PortfolioProjectData } from "../../lib/services/portfolio-projects";

export type { ExperienceRecordData } from "../../lib/services/experience-records";

export type {
  ArticleSkillEvidenceData,
  ProjectSkillEvidenceData,
  SkillAreaData,
  SkillData,
  SkillEvidenceData,
} from "../../lib/services/skill-capabilities";

export type { ResumeFileData } from "../../lib/services/resume-files";

export interface KnowledgeNoteData {
  id: string;
  vaultId: string;
  relativePath: string;
  fileName: string;
  directoryPath: string;
  sizeBytes: number;
  modifiedAt: string;
  contentHash: string;
  visibility: "PRIVATE" | "PUBLIC";
  hasFrontmatter: boolean;
  hasWikilinks: boolean;
  hasEmbeds: boolean;
  hasCallouts: boolean;
  hasDataview: boolean;
  hasTasks: boolean;
  isMoc: boolean;
  frontmatterJson: string | null;
  indexedAt: string;
}

export type {
  GitHubContributionEventData,
  GitHubRepositorySnapshotData,
  GitHubSyncConfigData,
  GitHubSyncStateData,
} from "../../lib/services/github-sync";

export type {
  AiProviderData,
  AiProviderStateData,
  AiRequestLogData,
  AiUseCaseSettingData,
} from "../../lib/services/ai-providers";

export type {
  AiContentDraftData,
  OkrAiContentDraftData,
  ProjectAiContentDraftData,
} from "../../lib/services/ai-content-drafts";

export type { WeeklyActivityDraftData } from "../../lib/services/weekly-activity-drafts";

export type { OkrMilestoneDraftData } from "../../lib/services/okr-milestone-drafts";

export type { CareerTimelineDraftData } from "../../lib/services/career-timeline-drafts";

export interface KnowledgeSyncChangeData {
  id: string;
  type: "ADDED" | "MODIFIED" | "MOVED" | "MISSING";
  previousRelativePath: string | null;
  currentRelativePath: string | null;
  previousContentHash: string | null;
  currentContentHash: string | null;
  previousModifiedAt: string | null;
  currentModifiedAt: string | null;
  reviewDecision: "ACKNOWLEDGED" | "IGNORED" | null;
  reviewedAt: string | null;
}

export interface KnowledgeNoteLinkData {
  id: string;
  kind: "LINK" | "EMBED";
  sourceRelativePath: string;
  targetRaw: string;
  targetRelativePath: string | null;
  targetHeading: string | null;
  displayLabel: string | null;
  isResolved: boolean;
}

export interface KnowledgePublicationDraftData {
  id: string;
  sourceRevisionId: string;
  sourceHash: string;
  title: string;
  summary: string | null;
  tags: string[];
  status: "DRAFT";
  createdAt: string;
  updatedAt: string;
  attachments: KnowledgePublicationDraftAttachmentData[];
  article: KnowledgeArticleData | null;
}

export interface KnowledgePublicationDraftAttachmentData {
  id: string;
  target: string;
  assetId: string;
}

export interface KnowledgeArticleData {
  id: string;
  draftId: string;
  slug: string;
  publishedAt: string;
}

export type {
  KnowledgeCollectionArticleData,
  KnowledgeCollectionData,
} from "../../lib/services/knowledge-collections";

export interface KnowledgeSourceRevisionData {
  id: string;
  vaultId: string;
  relativePath: string;
  contentHash: string;
  origin: "LOCAL_SCAN" | "WINDOWS_SYNC";
  capturedAt: string;
  draft: KnowledgePublicationDraftData | null;
}

export interface KnowledgeSyncReportData {
  id: string;
  scannedAt: string;
  addedCount: number;
  modifiedCount: number;
  movedCount: number;
  missingCount: number;
  unchangedCount: number;
  changes: KnowledgeSyncChangeData[];
}

export interface KnowledgeVaultData {
  id: string;
  name: string;
  rootPath: string;
  enabled: boolean;
  ignorePatterns: string[];
  lastScanStatus: "NEVER" | "SUCCESS" | "FAILED";
  lastScannedAt: string | null;
  lastScanFileCount: number;
  lastScanError: string | null;
  createdAt: string;
  updatedAt: string;
  notes: KnowledgeNoteData[];
  noteLinks: KnowledgeNoteLinkData[];
  sourceRevisions: KnowledgeSourceRevisionData[];
  syncReports: KnowledgeSyncReportData[];
}
import type { SiteContent } from "../../lib/content/schema";
