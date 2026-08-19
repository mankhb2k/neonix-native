/**
 * Runtime geometry validation helpers.
 *
 * Re-exports the canonical implementations from the V1 reference helpers so
 * the runtime IR and authoring schema share a single source of truth.
 */
export {
  duplicates,
  morphTopologyMismatch,
  valueAtPath,
  contourHasLength,
} from "../v1/references/helpers";
