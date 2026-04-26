import { Octokit } from "@octokit/rest";

let _octo: Octokit | null = null;

export function octokit(): Octokit {
  if (_octo) return _octo;
  _octo = new Octokit({ auth: process.env.GITHUB_TOKEN });
  return _octo;
}

export interface RepoMeta {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  contributors: number;
  pushedAt: string;
  createdAt: string;
  homepage: string | null;
  topics: string[];
}

export async function fetchRepoMeta(owner: string, repo: string): Promise<RepoMeta> {
  const o = octokit();
  const [{ data: r }, { data: contributors }] = await Promise.all([
    o.repos.get({ owner, repo }),
    o.repos.listContributors({ owner, repo, per_page: 1, anon: "true" }).catch(() => ({ data: [] })),
  ]);
  const contribHeader =
    contributors.length === 0
      ? 0
      : // GitHub exposes total count in the Link header when paginated
        Number(r.subscribers_count ?? 0) || contributors.length;
  return {
    owner,
    repo,
    defaultBranch: r.default_branch,
    description: r.description ?? "",
    stars: r.stargazers_count,
    forks: r.forks_count,
    openIssues: r.open_issues_count,
    contributors: contribHeader,
    pushedAt: r.pushed_at ?? "",
    createdAt: r.created_at ?? "",
    homepage: r.homepage,
    topics: r.topics ?? [],
  };
}

export async function downloadTarball(
  owner: string,
  repo: string,
  ref: string
): Promise<ArrayBuffer> {
  const o = octokit();
  const res = await o.repos.downloadTarballArchive({ owner, repo, ref });
  // Octokit returns the redirect payload as ArrayBuffer when binary
  return res.data as ArrayBuffer;
}
