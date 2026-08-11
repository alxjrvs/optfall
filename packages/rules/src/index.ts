/**
 * `optfall-rules` — the Flesh and Blood Comprehensive Rules, made addressable.
 *
 * `docs/PLAN.md`, Phase 4: **"The permalink is the product."** Legend Story
 * Studios already publishes a stable hierarchy — `1.0.`, `1.0.1.`, `1.0.1a` —
 * and this package preserves it rather than inventing an addressing scheme of
 * its own. `cr:1.0.1a` is a citation that exists today and will keep meaning
 * the same thing as long as LSS's numbering does.
 *
 * Everything exported here is pure: give it text, get back sections. The fetch
 * and `pdftotext` half lives at `optfall-rules/extract` so that nothing which
 * touches the network or spawns a process can be pulled into a browser bundle
 * by accident.
 *
 * @packageDocumentation
 */

export type {
  ParseResult,
  ParseWarning,
  RuleLevel,
  RuleSection,
  RulesDocument,
} from "./types";
export { RULE_ID_NAMESPACE } from "./types";

export type { ParseOptions } from "./parse";
export {
  COMPREHENSIVE_RULES_URL,
  childrenOf,
  indexById,
  parseComprehensiveRules,
  pathOf,
  sectionById,
} from "./parse";
