import { IPublishingRepository } from "./publishing-repository.types";
import { MongoPublishingRepository } from "./mongo-publishing-repository";

let publishingRepoInstance: IPublishingRepository | null = null;

export function getPublishingRepository(): IPublishingRepository {
  if (!publishingRepoInstance) {
    publishingRepoInstance = new MongoPublishingRepository();
  }
  return publishingRepoInstance;
}
