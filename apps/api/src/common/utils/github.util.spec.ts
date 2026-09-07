import { describe, expect, it } from 'vitest';
import { buildRawGitHubUrl, parseGitHubRepositoryUrl } from './github.util';

describe('GitHub repository URL validation', () => {
  it.each(['https://github.com/alice/.', 'https://github.com/alice/..'])(
    'rejects a dot-prefixed repository segment: %s',
    (repoUrl) => {
      expect(parseGitHubRepositoryUrl(repoUrl)).toBeNull();
      expect(buildRawGitHubUrl(repoUrl, 'main', 'lecpunch/reports/2026-W36.md')).toBeNull();
    }
  );
});
