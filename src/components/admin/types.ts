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

export interface PortfolioProjectLinkData {
  kind: "WEBSITE" | "SOURCE" | "DEMO" | "ARTICLE";
  labelZh: string;
  labelEn: string | null;
  url: string;
}

export interface PortfolioProjectData {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string | null;
  summaryZh: string;
  summaryEn: string | null;
  contextZh: string;
  contextEn: string | null;
  responsibilityZh: string;
  responsibilityEn: string | null;
  challengeZh: string;
  challengeEn: string | null;
  approachZh: string;
  approachEn: string | null;
  resultZh: string;
  resultEn: string | null;
  coverImage: string | null;
  coverAltZh: string | null;
  coverAltEn: string | null;
  technologies: string[];
  links: PortfolioProjectLinkData[];
  visibility: "PUBLIC" | "PRIVATE";
  featured: boolean;
  sortOrder: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExperienceRecordData {
  id: string;
  kind: "WORK" | "EDUCATION";
  organizationZh: string;
  organizationEn: string | null;
  titleZh: string;
  titleEn: string | null;
  descriptionZh: string;
  descriptionEn: string | null;
  locationZh: string | null;
  locationEn: string | null;
  linkUrl: string | null;
  startedAt: string;
  endedAt: string | null;
  isCurrent: boolean;
  visibility: "PUBLIC" | "PRIVATE";
  featured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSkillEvidenceData {
  id: string;
  kind: "PROJECT";
  projectId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleSkillEvidenceData {
  id: string;
  kind: "ARTICLE";
  titleZh: string;
  titleEn: string | null;
  url: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type SkillEvidenceData = ProjectSkillEvidenceData | ArticleSkillEvidenceData;

export interface SkillData {
  id: string;
  areaId: string;
  nameZh: string;
  nameEn: string | null;
  summaryZh: string;
  summaryEn: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  evidence: SkillEvidenceData[];
}

export interface SkillAreaData {
  id: string;
  nameZh: string;
  nameEn: string | null;
  descriptionZh: string;
  descriptionEn: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  skills: SkillData[];
}

export interface ResumeFileData {
  id: string;
  locale: "ZH" | "EN";
  originalFilename: string;
  mimeType: "application/pdf";
  sizeBytes: number;
  sha256: string;
  visibility: "PRIVATE" | "PUBLIC";
  createdAt: string;
  updatedAt: string;
}

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

export interface KnowledgeSyncChangeData {
  id: string;
  type: "ADDED" | "MODIFIED" | "MOVED" | "MISSING";
  previousRelativePath: string | null;
  currentRelativePath: string | null;
  previousContentHash: string | null;
  currentContentHash: string | null;
  previousModifiedAt: string | null;
  currentModifiedAt: string | null;
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
}

export interface KnowledgeSourceRevisionData {
  id: string;
  vaultId: string;
  relativePath: string;
  contentHash: string;
  origin: "LOCAL_SCAN";
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
