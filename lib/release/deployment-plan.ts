export type DeploymentStep =
  | 'verify-release'
  | 'build-next'
  | 'promote-staged-assets';

type DeploymentPlanInput = {
  isVercelProduction: boolean;
};

export function createDeploymentPlan({
  isVercelProduction,
}: DeploymentPlanInput): DeploymentStep[] {
  if (!isVercelProduction) return ['build-next'];
  return ['verify-release', 'build-next', 'promote-staged-assets'];
}
