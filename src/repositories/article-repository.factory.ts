import { IArticleRepository } from "./article-repository.types";
import { MongoArticleRepository } from "./mongo-article-repository";

let articleRepoInstance: IArticleRepository | null = null;

export function getArticleRepository(): IArticleRepository {
  if (!articleRepoInstance) {
    articleRepoInstance = new MongoArticleRepository();
  }
  return articleRepoInstance;
}
