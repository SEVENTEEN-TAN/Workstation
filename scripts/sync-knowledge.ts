import { readKnowledgeSyncConfig, syncKnowledge } from "../src/lib/knowledge/sync-client";
import { scanVault } from "../src/lib/knowledge/vault-scanner";

try {
  const summary = await syncKnowledge(readKnowledgeSyncConfig(), scanVault);
  console.log(`知识库同步完成：新增 ${summary.addedCount}，修改 ${summary.modifiedCount}，移动 ${summary.movedCount}，缺失 ${summary.missingCount}，未变 ${summary.unchangedCount}`);
} catch {
  console.error("知识库同步失败");
  process.exitCode = 1;
}
