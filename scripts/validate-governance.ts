import path from 'node:path';
import { runGovernanceAudit } from '../packages/governance/src/index';

(async () => {
  const root = process.cwd();
  const report = await runGovernanceAudit(root);
  const errors = report.issues.filter((issue) => issue.level === 'error');
  const warnings = report.issues.filter((issue) => issue.level === 'warning');

  if (warnings.length > 0) {
    console.warn(`Governance warnings: ${warnings.length}`);
    warnings.slice(0, 30).forEach((warning) => {
      console.warn(
        `- [${warning.code}] ${warning.message}${warning.source ? ` (${path.relative(root, warning.source)})` : ''}`
      );
    });
  }

  if (errors.length > 0) {
    console.error(`Governance errors: ${errors.length}`);
    errors.forEach((issue) => {
      console.error(`- [${issue.code}] ${issue.message}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log('Governance validation: OK');
})();
