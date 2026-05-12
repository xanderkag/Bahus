import { createProductKey } from "../state/initial-state.js";

export function mapApiProductToEntity(product) {
  // Backend returns import_batch_id; frontend uses import_id everywhere
  const import_id = product.import_id || product.import_batch_id;
  return {
    ...product,
    import_id,
    id: createProductKey(import_id, product),
    review_status: product.review_status || "pending",
    excluded: Boolean(product.excluded),
    manual_match_id: product.manual_match_id || null,
    manual_match_result: product.manual_match_result || null,
    manual_normalized_name: product.manual_normalized_name || null,
    normalization_note: product.normalization_note || "",
    article: product.article || "",
    note: product.note || "",
  };
}
