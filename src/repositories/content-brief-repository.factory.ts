import { IContentBriefRepository } from "./content-brief-repository.types";
import { MongoContentBriefRepository } from "./mongo-content-brief-repository";

let contentBriefRepoInstance: IContentBriefRepository | null = null;

export function getContentBriefRepository(): IContentBriefRepository {
  if (!contentBriefRepoInstance) {
    contentBriefRepoInstance = new MongoContentBriefRepository();
  }
  return contentBriefRepoInstance;
}
