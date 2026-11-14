import { IWebsiteRepository } from "./website-repository.types";
import { MongoWebsiteRepository } from "./mongo-website-repository";

let websiteRepoInstance: IWebsiteRepository | null = null;

export function getWebsiteRepository(): IWebsiteRepository {
  if (!websiteRepoInstance) {
    websiteRepoInstance = new MongoWebsiteRepository();
  }
  return websiteRepoInstance;
}

export function resetWebsiteRepositoryForTesting(mock?: IWebsiteRepository): void {
  websiteRepoInstance = mock || null;
}
