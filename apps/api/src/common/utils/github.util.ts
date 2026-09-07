// A repository may not begin with a dot. Besides being an invalid GitHub
// repository name, dot-prefixed segments made it possible to derive raw URLs
// containing `../` and thereby escape the configured repository.
const GITHUB_REPOSITORY_URL_PATTERN = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}))\/((?![A-Za-z0-9._-]*\.git$)[A-Za-z0-9_-][A-Za-z0-9._-]*)$/;

export const GITHUB_REPOSITORY_URL_REGEX = GITHUB_REPOSITORY_URL_PATTERN;
export const GITHUB_REF_REGEX = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/;
export const GITHUB_REPOSITORY_PATH_REGEX = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;

export function parseGitHubRepositoryUrl(repoUrl: string) {
  const match = GITHUB_REPOSITORY_URL_PATTERN.exec(repoUrl);
  if (!match) {
    return null;
  }

  return { owner: match[1], repository: match[2] };
}

export function isSafeGitHubRef(value: string) {
  return GITHUB_REF_REGEX.test(value) && !value.includes('..') && !value.includes('://');
}

export function isSafeGitHubRepositoryPath(value: string) {
  return GITHUB_REPOSITORY_PATH_REGEX.test(value) && !value.includes('..') && !value.includes('://');
}

export function buildRawGitHubUrl(repoUrl: string, branch: string, githubPath: string) {
  const repository = parseGitHubRepositoryUrl(repoUrl);
  if (!repository || !isSafeGitHubRef(branch) || !isSafeGitHubRepositoryPath(githubPath)) {
    return null;
  }

  return `https://raw.githubusercontent.com/${repository.owner}/${repository.repository}/${branch}/${githubPath}`;
}
