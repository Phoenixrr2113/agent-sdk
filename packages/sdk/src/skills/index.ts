/**
 * @fileoverview Skills module public API.
 */

export type { SkillMeta, SkillContent, SkillsConfig } from './types';
export {
  discoverSkills,
  loadSkillContent,
  loadSkills,
  loadSkillsFromPaths,
  parseSkillFrontmatter,
  buildSkillsSystemPrompt,
} from './loader';
