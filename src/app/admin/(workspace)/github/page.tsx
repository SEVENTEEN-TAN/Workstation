import { GitHubWorkspace } from "@/components/admin/GitHubWorkspace";
import { getGitHubSyncState } from "@/lib/services/github-sync";

export default async function AdminGitHubPage() {
  return <GitHubWorkspace initialState={await getGitHubSyncState()} />;
}
