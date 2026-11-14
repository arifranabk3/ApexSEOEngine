import { IKeywordDomainRepository } from "./keyword-repository.types";
import { MongoKeywordDomainRepository } from "./mongo-keyword-repository";

let keywordRepoInstance: IKeywordDomainRepository | null = null;

export function getKeywordDomainRepository(): IKeywordDomainRepository {
  if (!keywordRepoInstance) {
    keywordRepoInstance = new MongoKeywordDomainRepository();
  }
  return keywordRepoInstance;
}
