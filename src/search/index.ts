export { PgVectorRepository } from './pgvector.repository';
export {
  SemanticSearchService,
  type SearchRequest,
  type SearchResponse,
} from './semantic-search.service';
export {
  VECTOR_REPOSITORY,
  type SemanticSearchHit,
  type SemanticSearchQuery,
  type VectorRepository,
} from './types';
export { cosineDistanceToScore, toVectorLiteral } from './vector-format';
