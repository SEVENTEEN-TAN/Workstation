import { siteContentSchema, type SiteContent } from "./schema";

const projects = [
  {
    image: "/images/projects/neon-system.webp",
    en: { category: "Java + AI / 2026", title: "RAG Knowledge Hub", description: "A Spring AI knowledge platform combining document retrieval, contextual generation and tool calling for dependable domain answers.", tags: ["Spring AI", "RAG", "Elasticsearch"], alt: "Retro computer station glowing in a dark room" },
    zh: { category: "Java + AI / 2026", title: "智能知识库", description: "基于 Spring AI 构建的知识平台，整合文档检索、上下文生成与工具调用，为垂直领域提供可靠回答。", tags: ["Spring AI", "RAG", "Elasticsearch"], alt: "暗色空间中泛着光的复古电脑工作站" },
  },
  {
    image: "/images/projects/analog-archive.webp",
    en: { category: "Microservices / 2025", title: "Microservice Control Plane", description: "A resilient service platform built around Spring Cloud, with discovery, declarative calls, traffic protection and distributed transaction coordination.", tags: ["Nacos", "OpenFeign", "Sentinel"], alt: "Vintage cinema camera and film equipment" },
    zh: { category: "微服务 / 2025", title: "服务治理平台", description: "围绕 Spring Cloud 构建的高可用服务平台，覆盖服务发现、声明式调用、流量保护与分布式事务协调。", tags: ["Nacos", "OpenFeign", "Sentinel"], alt: "复古电影摄影机与胶片设备" },
  },
  {
    image: "/images/projects/signal-editorial.webp",
    en: { category: "AI Observability / 2025", title: "AI Log Intelligence", description: "An Elasticsearch-based log analysis workflow that uses AI summaries to surface anomalies, likely causes and actionable engineering signals.", tags: ["Java", "Elasticsearch", "AI"], alt: "Newspapers arranged across an editorial desk" },
    zh: { category: "AI 可观测性 / 2025", title: "智能日志洞察", description: "基于 Elasticsearch 的日志分析流程，通过 AI 摘要提炼异常、潜在根因与可执行的工程信号。", tags: ["Java", "Elasticsearch", "AI"], alt: "编辑工作台上铺开的报纸" },
  },
  {
    image: "/images/projects/vertical-habitat.webp",
    en: { category: "Cloud Native / 2024", title: "Cloud Task Orchestrator", description: "A containerized task service with Redis coordination, RocketMQ messaging and observable execution across distributed workers.", tags: ["Docker", "Redis", "RocketMQ"], alt: "Modern glass skyscraper rising into the sky" },
    zh: { category: "云原生 / 2024", title: "云端任务编排", description: "结合 Redis 协调、RocketMQ 消息与可观测执行链路的容器化任务服务，支持分布式工作节点可靠运行。", tags: ["Docker", "Redis", "RocketMQ"], alt: "向天空延伸的现代玻璃摩天楼" },
  },
] as const;

export const bootstrapSiteContent: SiteContent = siteContentSchema.parse({
  en: {
    meta: { title: "SEVENTEEN — Full-Stack Engineer", description: "SEVENTEEN — full-stack engineering focused on Java, distributed systems and practical AI." },
    nav: { brand: "ABOUT ME", about: "ABOUT", work: "WORK", contact: "CONTACT", top: "Scroll to top", goContact: "Go to contact", switchLanguage: "切换为中文", switchLabel: "中" },
    hero: { backdrop: "JAVA + AI", role: "FULL-STACK ENGINEER", lineOne: "JAVA + AI", lineTwo: "ENGINEERING", headingLabel: "Java and AI Engineering", intro: "I build reliable full-stack systems with Java at the core, combining scalable backend architecture with practical AI capabilities that solve real product problems.", work: "View Projects", contact: "Contact Me", badgeArea: "Interactive engineer badge area", badgeLabel: "SEVENTEEN, Full-Stack Engineer identity badge", portraitAlt: "Portrait of SEVENTEEN, a full-stack engineer", badgeRole: "Full-Stack Engineer", active: "ACTIVE" },
    about: { eyebrow: "01 — ABOUT ME", heading: ["BUILDING RELIABLE", "INTELLIGENT SYSTEMS"], headingLabel: "Building reliable intelligent systems.", paragraphs: ["I am a full-stack engineer focused on Java backend development, distributed systems and AI application engineering. I turn complex requirements into stable, maintainable services.", "My experience covers JVM and concurrency, Spring-based microservices, databases, caching, messaging, container delivery and practical RAG workflows—from system foundations to product-facing results."], stats: [{ value: "JAVA", accent: "+ AI", label: "Core engineering focus" }, { value: "FULL", accent: " STACK", label: "End-to-end delivery" }], toolkit: "Engineering Toolkit", skillCount: "12 CORE SKILLS", skills: ["Java", "Spring Boot", "Spring Cloud", "MyBatis-Plus", "MySQL", "Redis", "RocketMQ", "Python", "Spring AI", "Elasticsearch", "Docker", "Git"], quote: "Reliable foundations, pragmatic architecture and AI where it creates real value." },
    works: { eyebrow: "02 — JAVA + AI PROJECTS", heading: "SELECTED BUILDS.", viewAll: "View All Projects", explore: "Explore Project", navigation: "Project navigation", project: "Project", showProject: "Show project" },
    services: { eyebrow: "03 — TECHNOLOGY", headingStart: "JAVA + AI", headingOutline: "TECHNOLOGY STACK", headingLabel: "Java and AI technology stack", items: [["JAVA & JVM", "JavaSE, collections, data structures, object-oriented design, exceptions, reflection and generics; JUC concurrency, thread pools, ThreadLocal, synchronized, CAS and the Java Memory Model; JVM memory, garbage collection, class loading and diagnostics."], ["SPRING ECOSYSTEM", "Spring Boot and MyBatis-Plus for application delivery, plus practical microservice experience with Nacos, OpenFeign, Sentinel and Seata."], ["DATA & MIDDLEWARE", "MySQL schema and index design, transactions and slow-query tuning; Redis persistence, distributed locks and cache protection; RocketMQ delivery, deduplication, ordered consumption and backlog handling."], ["PYTHON & AI", "Python application development together with Elasticsearch for retrieval and log analysis, plus Spring AI integrations covering model access, prompt templates, RAG and tool calling."], ["FRONTEND & DELIVERY", "JavaScript, jQuery and Vue for product-facing interfaces, with Docker-based image builds and containerized delivery."], ["ENGINEERING FOUNDATION", "IDEA, Maven, Git, Linux and Shell, strengthened by TCP/IP, HTTP/HTTPS, operating-system fundamentals and AI-assisted development with Claude Code and Codex."]] },
    footer: { backdrop: "CONTACT", eyebrow: "04 — CONTACT", heading: ["LET’S", "CONNECT."], headingLabel: "Let’s connect.", intro: "For Java backend, full-stack delivery or AI application opportunities, reach out by email, GitHub or WeChat.", menu: "Navigation", socials: "Contact", links: ["About", "Work", "Contact"], github: "GitHub", wechat: "WeChat", wechatHint: "Show WeChat QR code", wechatAlt: "SEVENTEEN WeChat QR code", copyright: "© 2026 SEVENTEEN Portfolio. All rights reserved.", privacy: "Privacy", terms: "Terms" },
    projects: projects.map(({ image, en }) => ({ image, ...en })),
  },
  zh: {
    meta: { title: "SEVENTEEN — 全栈开发工程师", description: "SEVENTEEN——专注 Java、分布式系统与 AI 应用落地的全栈开发工程师。" },
    nav: { brand: "关于我", about: "关于", work: "作品", contact: "联系", top: "返回顶部", goContact: "前往联系区域", switchLanguage: "切换为英文", switchLabel: "EN" },
    hero: { backdrop: "JAVA + AI", role: "全栈开发工程师", lineOne: "JAVA + AI", lineTwo: "工程", headingLabel: "Java 与 AI 工程", intro: "我以 Java 为核心构建可靠的全栈系统，将可扩展的后端架构与可落地的 AI 能力结合，解决真实、复杂的产品问题。", work: "查看项目", contact: "联系我", badgeArea: "可互动的工程师胸牌区域", badgeLabel: "SEVENTEEN 全栈开发工程师身份胸牌", portraitAlt: "全栈开发工程师 SEVENTEEN 的肖像", badgeRole: "全栈开发工程师", active: "在线" },
    about: { eyebrow: "01 — 关于我", heading: ["构建可靠", "智能系统"], headingLabel: "构建可靠智能系统。", paragraphs: ["我是一名专注 Java 后端、分布式系统与 AI 应用工程的全栈开发工程师，擅长将复杂需求转化为稳定、清晰且可维护的服务。", "技术覆盖 JVM 与并发、Spring 微服务、数据库、缓存、消息队列、容器化交付和 RAG 应用，让系统基础与业务体验形成完整闭环。"], stats: [{ value: "JAVA", accent: "+ AI", label: "核心技术方向" }, { value: "FULL", accent: " STACK", label: "端到端交付" }], toolkit: "工程工具箱", skillCount: "12 项核心能力", skills: ["Java", "Spring Boot", "Spring Cloud", "MyBatis-Plus", "MySQL", "Redis", "RocketMQ", "Python", "Spring AI", "Elasticsearch", "Docker", "Git"], quote: "以可靠基础支撑业务，用务实架构推动交付，让 AI 真正创造价值。" },
    works: { eyebrow: "02 — JAVA + AI 项目", heading: "精选构建。", viewAll: "查看全部项目", explore: "探索项目", navigation: "项目导航", project: "项目", showProject: "查看项目" },
    services: { eyebrow: "03 — 技术能力", headingStart: "JAVA + AI", headingOutline: "技术栈", headingLabel: "Java 与 AI 技术栈", items: [["JAVA 与 JVM", "熟练掌握 JavaSE、集合与数据结构、面向对象、异常、反射和泛型；熟悉 JUC 并发、线程池、ThreadLocal、synchronized、CAS、JMM，以及 JVM 内存、垃圾回收、类加载与问题诊断。"], ["SPRING 生态", "熟悉 Spring Boot、MyBatis-Plus 等常用框架，并具备 Nacos、OpenFeign、Sentinel、Seata 等微服务组件的实际开发经验。"], ["数据与中间件", "熟悉 MySQL、索引、事务与慢 SQL 优化；掌握 Redis 持久化、分布式锁和缓存问题处理；熟悉 RocketMQ 可靠传输、幂等去重、顺序消费与消息堆积处理。"], ["PYTHON 与 AI", "具备 Python 项目开发经验；了解 Elasticsearch 全文检索与日志分析，并能使用 Spring AI 完成模型接入、Prompt 模板、RAG 与工具调用。"], ["前端与交付", "了解 JavaScript、jQuery 与 Vue，能够完成产品界面协作；掌握 Docker 镜像构建、容器运行与常用交付流程。"], ["工程基础", "熟练使用 IDEA、Maven、Git、Linux 与 Shell；熟悉 TCP/IP、HTTP/HTTPS、操作系统进程与线程、内存管理及 IO 模型，并使用 Claude Code、Codex 等 AI 编程工具。"]] },
    footer: { backdrop: "联系我", eyebrow: "04 — 联系我", heading: ["联系我", "开启合作。"], headingLabel: "联系我开启合作。", intro: "如果你正在寻找 Java 后端、全栈交付或 AI 应用方向的合作伙伴，欢迎通过邮箱、GitHub 或微信与我联系。", menu: "导航", socials: "联系方式", links: ["关于", "作品", "联系"], github: "GitHub", wechat: "微信", wechatHint: "查看微信二维码", wechatAlt: "SEVENTEEN 微信二维码", copyright: "© 2026 SEVENTEEN Portfolio. 保留所有权利。", privacy: "隐私", terms: "条款" },
    projects: projects.map(({ image, zh }) => ({ image, ...zh })),
  },
});
