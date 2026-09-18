import { GitHubWorkspace } from "@/components/admin/GitHubWorkspace";
import type { GitHubSyncStateData } from "@/components/admin/types";
import { getGitHubSyncState } from "@/lib/services/github-sync";

export default async function AdminGitHubPage() {
  const state = JSON.parse(JSON.stringify(await getGitHubSyncState())) as GitHubSyncStateData;
  return <GitHubWorkspace initialState={state} />;
}
