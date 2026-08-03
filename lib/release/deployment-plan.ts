export type DeploymentStep =
  | 'verify-release'
  | 'build-next'
  | 'promote-staged-assets'
  | 'migrate-database'
  | 'seed-catalogue'
  | 'seed-external-catalogue'
  | 'seed-product-assets'
  | 'seed-editorial-assets';

type DeploymentPlanInput = {
  isVercelProduction: boolean;
  migrationsDisabled: boolean;
  seedExternalCatalogue: boolean;
};

export function createDeploymentPlan({
  isVercelProduction,
  migrationsDisabled,
  seedExternalCatalogue,
}: DeploymentPlanInput): DeploymentStep[] {
  if (!isVercelProduction) return ['build-next'];

  const plan: DeploymentStep[] = ['verify-release', 'build-next'];
  if (migrationsDisabled) return plan;

  plan.push('promote-staged-assets', 'migrate-database', 'seed-catalogue');
  if (seedExternalCatalogue) plan.push('seed-external-catalogue');
  plan.push('seed-product-assets', 'seed-editorial-assets');
  // The first build proves the revision before external mutations. Rebuild the
  // final artifact after catalogue reconciliation so ISR/SSG routes contain
  // the same offer evidence that this production release just seeded.
  plan.push('build-next');
  return plan;
}
