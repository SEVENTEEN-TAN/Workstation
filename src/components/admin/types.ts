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

export interface AuditLogData {
  id: string;
  userId: string;
  method: string;
  path: string;
  targetId: string | null;
  statusCode: number;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
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
  source: "SITE_VERSION" | "KNOWLEDGE_DRAFT";
  versionId: string;
  version: number | null;
  status: string;
  path: string;
  label: string;
}

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

export interface GitHubSyncConfigData {
  id: string;
  username: string;
  enabled: boolean;
  selectedRepositories: string[];
  lastSyncStatus: "NEVER" | "SUCCESS" | "FAILED";
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubRepositorySnapshotData {
  id: string;
  githubId: string;
  fullName: string;
  name: string;
  description: string | null;
  htmlUrl: string;
  homepageUrl: string | null;
  primaryLanguage: string | null;
  topics: string[];
  stars: number;
  forks: number;
  isFork: boolean;
  isArchived: boolean;
  selected: boolean;
  pushedAt: string | null;
  syncedAt: string;
}

export interface GitHubContributionEventData {
  id: string;
  githubId: string;
  type: string;
  repository: string;
  url: string | null;
  occurredAt: string;
  syncedAt: string;
}

export interface GitHubSyncStateData {
  config: GitHubSyncConfigData | null;
  repositories: GitHubRepositorySnapshotData[];
  events: GitHubContributionEventData[];
}

export interface AiProviderData {
  id: string;
  name: string;
  adapterKind: "OPENAI_COMPATIBLE" | "ANTHROPIC_MESSAGES" | "CUSTOM_JSON";
  baseUrl: string;
  generationEndpoint: string;
  modelEndpoint: string | null;
  authType: "NONE" | "BEARER" | "X_API_KEY" | "CUSTOM_HEADER";
  authHeaderName: string | null;
  authScheme: string | null;
  adapterConfig: Record<string, unknown>;
  manualModels: string[];
  cachedModels: string[];
  enabled: boolean;
  lastTestStatus: "NEVER" | "SUCCESS" | "FAILED";
  lastTestedAt: string | null;
  modelsRefreshedAt: string | null;
  credentialConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiUseCaseSettingData {
  useCase: "PROJECT_DESCRIPTION" | "WEEKLY_UPDATE" | "OKR_REVIEW";
  providerId: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiRequestLogData {
  id: string;
  providerId: string | null;
  useCase: string;
  model: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  outcome: string;
  failureReason: string | null;
  createdAt: string;
}

export interface AiProviderStateData {
  providers: AiProviderData[];
  defaults: AiUseCaseSettingData[];
  requestLogs: AiRequestLogData[];
}

export type {
  AiContentDraftData,
  OkrAiContentDraftData,
  ProjectAiContentDraftData,
} from "../../lib/services/ai-content-drafts";

export interface WeeklyActivityDraftData {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: "DRAFT" | "CONVERTED";
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  sourceSnapshot: {
    github: unknown[];
    progress: unknown[];
    actions: unknown[];
    projects: unknown[];
    articles: unknown[];
    activities: unknown[];
  };
  convertedActivityId: string | null;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OkrMilestoneDraftData {
  id: string;
  sourceKey: string;
  kind: "KR_PROGRESS" | "KEY_RESULT_COMPLETED" | "OBJECTIVE_COMPLETED";
  status: "DRAFT" | "CONVERTED";
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  occurredAt: string;
  sourceSnapshot: Record<string, unknown>;
  convertedActivityId: string | null;
  createdAt: string;
  updatedAt: string;
}

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

export interface KnowledgeCollectionArticleData {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  tags: string[];
  publishedAt: string;
}

export interface KnowledgeCollectionData {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  visibility: "PRIVATE" | "PUBLIC";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  articles: KnowledgeCollectionArticleData[];
}

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
