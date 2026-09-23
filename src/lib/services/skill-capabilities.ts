import { getDatabase } from "../db";
import {
  getSkillAreaPublicIssues,
  getSkillPublicIssues,
} from "../public-readiness";
import { portfolioProjectService } from "./portfolio-projects";
import {
  skillAreaInputSchema,
  skillAreaPatchSchema,
  type SkillAreaInput,
} from "../validators/skill-capabilities";

type SkillMetadata = { id?: unknown; createdAt?: unknown; updatedAt?: unknown };

export type SkillEvidenceRecord = SkillAreaInput["skills"][number]["evidence"][number] & {
  id: string;
  skillId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SkillRecord = Omit<SkillAreaInput["skills"][number], "evidence"> & {
  id: string;
  areaId: string;
  createdAt: Date;
  updatedAt: Date;
  evidence: SkillEvidenceRecord[];
};

export type SkillAreaRecord = Omit<SkillAreaInput, "skills"> & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  skills: SkillRecord[];
};

export type ProjectSkillEvidenceData = {
  id: string;
  kind: "PROJECT";
  projectId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ArticleSkillEvidenceData = {
  id: string;
  kind: "ARTICLE";
  titleZh: string;
  titleEn: string | null;
  url: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SkillEvidenceData = ProjectSkillEvidenceData | ArticleSkillEvidenceData;

export type SkillData = Omit<SkillRecord, "createdAt" | "updatedAt" | "evidence"> & {
  createdAt: string;
  updatedAt: string;
  evidence: SkillEvidenceData[];
};

export type SkillAreaData = Omit<SkillAreaRecord, "createdAt" | "updatedAt" | "skills"> & {
  createdAt: string;
  updatedAt: string;
  skills: SkillData[];
};

export type PublicSkillEvidence = {
  id: string;
  kind: "PROJECT" | "ARTICLE";
  titleZh: string;
  titleEn: string;
  url: string;
};

export type PublicSkill = {
  id: string;
  nameZh: string;
  nameEn: string;
  summaryZh: string;
  summaryEn: string;
  evidence: PublicSkillEvidence[];
};

export type PublicSkillArea = {
  id: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  skills: PublicSkill[];
};

export type PublicProjectTarget = {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string | null;
  visibility: "PUBLIC" | "PRIVATE";
};

export type SkillAreaRepository = {
  listAreas(): Promise<SkillAreaRecord[]>;
  findArea(id: string): Promise<SkillAreaRecord | null>;
  createArea(value: SkillAreaInput): Promise<unknown>;
  replaceArea(id: string, value: SkillAreaInput): Promise<unknown>;
  deleteArea(id: string): Promise<unknown>;
};

function date(value: unknown) {
  const parsed = new Date(value as string | Date);
  if (Number.isNaN(parsed.getTime())) throw new Error("能力域记录元数据不完整");
  return parsed;
}

export function parseSkillAreaRecord(record: unknown): SkillAreaRecord {
  const value = skillAreaInputSchema.parse(record);
  const source = record as SkillMetadata & { skills?: Array<SkillMetadata & { evidence?: SkillMetadata[] }> };
  const areaId = source.id;
  if (typeof areaId !== "string" || !Array.isArray(source.skills) || source.skills.length !== value.skills.length) {
    throw new Error("能力域记录元数据不完整");
  }

  return {
    ...value,
    id: areaId,
    createdAt: date(source.createdAt),
    updatedAt: date(source.updatedAt),
    skills: value.skills.map((skill, skillIndex) => {
      const skillSource = source.skills![skillIndex]!;
      const skillId = skillSource.id;
      if (typeof skillId !== "string" || !Array.isArray(skillSource.evidence) || skillSource.evidence.length !== skill.evidence.length) {
        throw new Error("技能记录元数据不完整");
      }

      return {
        ...skill,
        id: skillId,
        areaId,
        createdAt: date(skillSource.createdAt),
        updatedAt: date(skillSource.updatedAt),
        evidence: skill.evidence.map((evidence, evidenceIndex) => {
          const evidenceSource = skillSource.evidence![evidenceIndex]!;
          const evidenceId = evidenceSource.id;
          if (typeof evidenceId !== "string") throw new Error("证据记录元数据不完整");
          return {
            ...evidence,
            id: evidenceId,
            skillId,
            createdAt: date(evidenceSource.createdAt),
            updatedAt: date(evidenceSource.updatedAt),
          };
        }),
      };
    }),
  };
}

function nestedCreate(value: SkillAreaInput) {
  return value.skills.map((skill) => ({
    ...skill,
    evidence: {
      create: skill.evidence.map((item) => item),
    },
  }));
}

function areaWrite(value: SkillAreaInput) {
  return {
    ...value,
    skills: {
      create: nestedCreate(value),
    },
  };
}

function toAdminEvidence(evidence: SkillEvidenceRecord): SkillEvidenceData {
  const base = {
    id: evidence.id,
    sortOrder: evidence.sortOrder,
    createdAt: evidence.createdAt.toISOString(),
    updatedAt: evidence.updatedAt.toISOString(),
  };

  return evidence.kind === "PROJECT"
    ? { ...base, kind: evidence.kind, projectId: evidence.projectId }
    : {
      ...base,
      kind: evidence.kind,
      titleZh: evidence.titleZh,
      titleEn: evidence.titleEn,
      url: evidence.url,
    };
}

function toAdminSkill(skill: SkillRecord): SkillData {
  return {
    ...skill,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
    evidence: skill.evidence.map(toAdminEvidence),
  };
}

function toAdminArea(area: SkillAreaRecord): SkillAreaData {
  return {
    ...area,
    createdAt: area.createdAt.toISOString(),
    updatedAt: area.updatedAt.toISOString(),
    skills: area.skills.map(toAdminSkill),
  };
}

const include = {
  skills: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      evidence: { orderBy: { sortOrder: "asc" as const } },
    },
  },
};

function defaultRepository(): SkillAreaRepository {
  return {
    async listAreas() {
      const records = await (await getDatabase()).skillArea.findMany({ include, orderBy: { sortOrder: "asc" } });
      return records.map(parseSkillAreaRecord);
    },
    async findArea(id) {
      const record = await (await getDatabase()).skillArea.findUnique({ where: { id }, include });
      return record ? parseSkillAreaRecord(record) : null;
    },
    createArea(value) {
      return getDatabase().then((database) => database.skillArea.create({ data: areaWrite(value), include }));
    },
    async replaceArea(id, value) {
      const database = await getDatabase();
      return database.skillArea.update({
        where: { id },
        data: {
          ...areaWrite(value),
          skills: {
            deleteMany: {},
            create: nestedCreate(value),
          },
        },
        include,
      });
    },
    deleteArea(id) {
      return getDatabase().then((database) => database.skillArea.delete({ where: { id } }));
    },
  };
}

export function createSkillCapabilityService(
  repository?: SkillAreaRepository,
  listProjects: () => Promise<PublicProjectTarget[]> = () => portfolioProjectService.listPublic(),
) {
  const source = repository ?? defaultRepository();

  function toPublicArea(area: SkillAreaRecord, projects: PublicProjectTarget[]) {
    const readinessProjects = projects.map((project) => ({ ...project, publicReady: project.visibility === "PUBLIC" }));
    const projectById = new Map(projects.filter((project) => project.visibility === "PUBLIC").map((project) => [project.id, project]));
    const skills = area.skills.filter((skill) => getSkillPublicIssues(skill, readinessProjects).length === 0).map((skill) => ({
      id: skill.id,
      nameZh: skill.nameZh,
      nameEn: skill.nameEn!,
      summaryZh: skill.summaryZh,
      summaryEn: skill.summaryEn!,
      evidence: skill.evidence.reduce<PublicSkillEvidence[]>((result, item) => {
        if (item.kind === "ARTICLE") {
          result.push({ id: item.id, kind: "ARTICLE", titleZh: item.titleZh, titleEn: item.titleEn!, url: item.url });
          return result;
        }

        const project = projectById.get(item.projectId);
        if (project) {
          result.push({
            id: item.id,
            kind: "PROJECT",
            titleZh: project.titleZh,
            titleEn: project.titleEn!,
            url: `/projects/${project.slug}`,
          });
        }
        return result;
      }, []),
    })).filter((skill) => skill.evidence.length > 0);

    return {
      id: area.id,
      nameZh: area.nameZh,
      nameEn: area.nameEn!,
      descriptionZh: area.descriptionZh,
      descriptionEn: area.descriptionEn!,
      skills,
    };
  }

  return {
    list: async (): Promise<SkillAreaData[]> => (await source.listAreas()).map(toAdminArea),
    create: (input: unknown) => source.createArea(skillAreaInputSchema.parse(input)),
    async update(id: string, input: unknown) {
      const patch = skillAreaPatchSchema.parse(input);
      const current = await source.findArea(id);
      if (!current) throw new Error("能力域不存在");
      const complete = skillAreaInputSchema.parse({ ...current, ...patch });
      return source.replaceArea(id, complete);
    },
    delete: (id: string) => source.deleteArea(id),
    async listPublic(): Promise<PublicSkillArea[]> {
      const [areas, projects] = await Promise.all([source.listAreas(), listProjects()]);
      const readinessProjects = projects.map((project) => ({ ...project, publicReady: project.visibility === "PUBLIC" }));
      return areas
        .filter((area) => getSkillAreaPublicIssues(area, readinessProjects).length === 0)
        .map((area) => toPublicArea(area, projects));
    },
  };
}

export const skillCapabilityService = createSkillCapabilityService();
