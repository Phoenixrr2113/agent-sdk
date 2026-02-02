/**
 * @agent/brain - Edge Types
 * Relationship types for the knowledge graph
 */

export type BaseEdge = {
  from: string;
  to: string;
};

export type ContainsEdge = BaseEdge & {
  type: 'CONTAINS';
};

export type ImportsEdge = BaseEdge & {
  type: 'IMPORTS';
  specifiers?: string[];
};

export type ImportsSymbolEdge = BaseEdge & {
  type: 'IMPORTS_SYMBOL';
  alias?: string;
  isDefault: boolean;
};

export type ExportsEdge = BaseEdge & {
  type: 'EXPORTS';
  asName?: string;
  isDefault?: boolean;
};

export type CallsEdge = BaseEdge & {
  type: 'CALLS';
  line: number;
  count?: number;
};

export type InstantiatesEdge = BaseEdge & {
  type: 'INSTANTIATES';
  line: number;
};

export type ExtendsEdge = BaseEdge & {
  type: 'EXTENDS';
};

export type ImplementsEdge = BaseEdge & {
  type: 'IMPLEMENTS';
};

export type UsesTypeEdge = BaseEdge & {
  type: 'USES_TYPE';
};

export type ReturnsEdge = BaseEdge & {
  type: 'RETURNS';
};

export type HasParamEdge = BaseEdge & {
  type: 'HAS_PARAM';
  paramName: string;
  position: number;
};

export type Visibility = 'public' | 'private' | 'protected';

export type HasMethodEdge = BaseEdge & {
  type: 'HAS_METHOD';
  visibility: Visibility;
};

export type HasPropertyEdge = BaseEdge & {
  type: 'HAS_PROPERTY';
  visibility: Visibility;
};

export type RendersEdge = BaseEdge & {
  type: 'RENDERS';
  line: number;
};

export type UsesHookEdge = BaseEdge & {
  type: 'USES_HOOK';
  hookName: string;
};

export type IntroducedInEdge = BaseEdge & {
  type: 'INTRODUCED_IN';
};

export type ModifiedInEdge = BaseEdge & {
  type: 'MODIFIED_IN';
  linesAdded?: number;
  linesRemoved?: number;
  complexityDelta?: number;
};

export type DeletedInEdge = BaseEdge & {
  type: 'DELETED_IN';
};

export type ReadsEdge = BaseEdge & {
  type: 'READS';
  line?: number;
};

export type WritesEdge = BaseEdge & {
  type: 'WRITES';
  line?: number;
};

export type FlowsToEdge = BaseEdge & {
  type: 'FLOWS_TO';
  transformation?: string;
  tainted?: boolean;
  sanitized?: boolean;
};

export type HasSectionEdge = BaseEdge & {
  type: 'HAS_SECTION';
};

export type ParentSectionEdge = BaseEdge & {
  type: 'PARENT_SECTION';
};

export type ContainsCodeEdge = BaseEdge & {
  type: 'CONTAINS_CODE';
};

export type LinksToEdge = BaseEdge & {
  type: 'LINKS_TO';
  anchor?: string;
};

export type Edge =
  | ContainsEdge
  | ImportsEdge
  | ImportsSymbolEdge
  | CallsEdge
  | ExtendsEdge
  | ImplementsEdge
  | UsesTypeEdge
  | ReturnsEdge
  | HasParamEdge
  | HasMethodEdge
  | HasPropertyEdge
  | RendersEdge
  | UsesHookEdge
  | IntroducedInEdge
  | ModifiedInEdge
  | DeletedInEdge
  | ReadsEdge
  | WritesEdge
  | FlowsToEdge
  | ExportsEdge
  | InstantiatesEdge
  | HasSectionEdge
  | ParentSectionEdge
  | ContainsCodeEdge
  | LinksToEdge;

export type EdgeLabel =
  | 'CONTAINS'
  | 'IMPORTS'
  | 'IMPORTS_SYMBOL'
  | 'CALLS'
  | 'EXTENDS'
  | 'IMPLEMENTS'
  | 'USES_TYPE'
  | 'RETURNS'
  | 'HAS_PARAM'
  | 'HAS_METHOD'
  | 'HAS_PROPERTY'
  | 'RENDERS'
  | 'USES_HOOK'
  | 'INTRODUCED_IN'
  | 'MODIFIED_IN'
  | 'DELETED_IN'
  | 'READS'
  | 'WRITES'
  | 'FLOWS_TO'
  | 'EXPORTS'
  | 'INSTANTIATES'
  | 'HAS_SECTION'
  | 'PARENT_SECTION'
  | 'CONTAINS_CODE'
  | 'LINKS_TO';
