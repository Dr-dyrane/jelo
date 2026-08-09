export type DeploymentStep =
  | 'verify-release'
  | 'build-next'
  | 'verify-search-bundle'
  | 'promote-staged-assets';

export type DeploymentPhase = DeploymentStep[];

type DeploymentPlanInput = {
  isVercelProduction: boolean;
};

export function createDeploymentPlan({
  isVercelProduction,
}: DeploymentPlanInput): DeploymentPhase[] {
  if (!isVercelProduction) {
    return [['build-next'], ['verify-search-bundle']];
  }
  return [
    ['promote-staged-assets'],
    ['verify-release'],
    ['build-next'],
    ['verify-search-bundle'],
  ];
}
