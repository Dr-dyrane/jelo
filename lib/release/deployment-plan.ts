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
  return plan;
}
