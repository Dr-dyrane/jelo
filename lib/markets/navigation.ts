import "server-only";

import {
  isMarketFinderPublicReadEnabled,
  marketFinderPublicMarketSlug,
  type MarketFinderActivationEnvironment,
} from "@/lib/markets/activation";
import type { MarketFinderDirectoryModel } from "@/lib/markets/domain";
import {
  isMarketFixtureEnabled,
  listMarketFixtureProducts,
  listMarketFixtures,
} from "@/lib/markets/fixture";
import {
  readMarketFinderDirectory,
  type MarketFinderRepositoryOptions,
} from "@/lib/markets/repository";

type MarketFinderDirectoryReader = (
  marketSlug: string,
  options?: MarketFinderRepositoryOptions,
) => Promise<MarketFinderDirectoryModel>;

type MarketFinderNavigationOptions = {
  nodeEnvironment?: string;
  environment?: MarketFinderActivationEnvironment;
  readDirectory?: MarketFinderDirectoryReader;
};

/**
 * Keeps optional site-wide navigation honest: the entry appears only when its
 * landing page can offer at least one exact product to choose from.
 */
export async function resolveMarketFinderNavigationHref(
  options: MarketFinderNavigationOptions = {},
): Promise<"/markets" | null> {
  const nodeEnvironment =
    options.nodeEnvironment === undefined
      ? process.env.NODE_ENV
      : options.nodeEnvironment;

  if (isMarketFixtureEnabled(nodeEnvironment)) {
    return listMarketFixtures().length > 0 &&
      listMarketFixtureProducts().length > 0
      ? "/markets"
      : null;
  }

  const environment = options.environment ?? process.env;
  const marketSlug = marketFinderPublicMarketSlug(environment);
  if (!isMarketFinderPublicReadEnabled(environment) || !marketSlug) {
    return null;
  }

  try {
    const directory = await (
      options.readDirectory ?? readMarketFinderDirectory
    )(
      marketSlug,
      options.environment ? { environment: options.environment } : undefined,
    );
    return directory.state === "current" && directory.products.length > 0
      ? "/markets"
      : null;
  } catch {
    return null;
  }
}
