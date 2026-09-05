import { readFileSync, existsSync, appendFileSync } from 'node:fs';

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const resultPath = '.ci-results/result.json';
const result = existsSync(resultPath)
  ? JSON.parse(readFileSync(resultPath, 'utf8'))
  : { status: 1, stage: 'Validation did not produce a result' };
const diagnostic = existsSync('.ci-results/diagnostic.txt')
  ? readFileSync('.ci-results/diagnostic.txt', 'utf8').trim()
  : 'The validation entrypoint did not run. Inspect the failed checkout or Node setup step.';
const marker = '<!-- portfolio-baseline-ci -->';
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const runUrl = `${process.env.GITHUB_SERVER_URL}/${owner}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const revision = event.pull_request?.head.sha || process.env.GITHUB_SHA;
// Lead with the failing stage's actual output. Installation logs stay in the
// complete artifact instead of burying the actionable browser error.
const stageMarker = `[stage] ${result.stage}\n`;
const stageStart = result.status !== 0 ? diagnostic.lastIndexOf(stageMarker) : -1;
const focusedDiagnostic = stageStart >= 0 ? diagnostic.slice(stageStart) : diagnostic;
const excerpt = focusedDiagnostic.length > 18000
  ? `${focusedDiagnostic.slice(0, 1000)}\n\n[Middle omitted; complete output is attached to this run.]\n\n${focusedDiagnostic.slice(-16000)}`
  : focusedDiagnostic;
// Escape accidental Markdown fences from tool output without changing the log.
const fence = '`'.repeat(Math.max(3, ...[...excerpt.matchAll(/`+/g)].map(match => match[0].length + 1)));
const body = `${marker}\n## Portfolio checks: ${result.status === 0 ? 'PASS' : 'FAIL'}\n\n**${result.stage}**\n\nRevision: \`${revision}\`\nTested checkout: \`${process.env.GITHUB_SHA}\`\n[Run and complete diagnostic artifact](${runUrl})\n\n${fence}text\n${excerpt}\n${fence}`;
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, body);

async function api(path, method = 'GET', data) {
  const response = await fetch(`${process.env.GITHUB_API_URL}/repos/${owner}/${repo}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Diagnostic publication failed: ${method} ${path}: HTTP ${response.status}\n${await response.text()}`);
  return response.json();
}

const prs = event.pull_request ? [event.pull_request] : await api(`/commits/${revision}/pulls?per_page=100`);
if (!prs.length) console.log('No associated pull request. The complete diagnostic is published in the job summary and artifact.');
for (const pr of prs) {
  const current = await api(`/pulls/${pr.number}`);
  if (event.pull_request && current.head.sha !== revision) {
    console.log(`PR #${pr.number} has a newer revision; keeping its newer diagnostic.`);
    continue;
  }
  let existing;
  for (let page = 1; ; page++) {
    const comments = await api(`/issues/${pr.number}/comments?per_page=100&page=${page}`);
    existing = comments.find(comment => comment.user?.type === 'Bot' && comment.body?.includes(marker));
    if (existing || comments.length < 100) break;
  }
  if (existing) await api(`/issues/comments/${existing.id}`, 'PATCH', { body });
  else await api(`/issues/${pr.number}/comments`, 'POST', { body });
  console.log(`Published ${result.status === 0 ? 'PASS' : 'FAIL'} diagnostic on PR #${pr.number}.`);
}
