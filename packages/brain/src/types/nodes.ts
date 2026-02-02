/**
 * @agent/brain - Code Entity Types
 * Node types for code entities in the knowledge graph
 */

export type BaseEntity = {
  id?: string;
  name: string;
  filePath: string;
};

export type RangeEntity = BaseEntity & {
  startLine: number;
  endLine: number;
};

export type FileEntity = {
  id?: string;
  path: string;
  name: string;
  extension: string;
  loc: number;
  lastModified: string;
  hash: string;
};

export type ClassEntity = RangeEntity & {
  isExported: boolean;
  isAbstract: boolean;
  extends?: string;
  implements?: string[];
  docstring?: string;
};

export type InterfaceEntity = RangeEntity & {
  isExported: boolean;
  extends?: string[];
  docstring?: string;
};

export type FunctionParam = {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
  isRest?: boolean;
};

export type FunctionEntity = RangeEntity & {
  isExported: boolean;
  isAsync: boolean;
  isArrow: boolean;
  isGenerator?: boolean;
  params: FunctionParam[];
  returnType?: string;
  docstring?: string;
  complexity?: number;
  cognitiveComplexity?: number;
  nestingDepth?: number;
};

export type VariableKind = 'const' | 'let' | 'var';

export type VariableEntity = {
  id?: string;
  name: string;
  filePath: string;
  line: number;
  kind: VariableKind;
  isExported: boolean;
  type?: string;
};

export type ImportSpecifier = {
  name: string;
  alias?: string;
};

export type ImportEntity = {
  id?: string;
  source: string;
  filePath: string;
  isDefault: boolean;
  isNamespace: boolean;
  specifiers: ImportSpecifier[];
  namespaceAlias?: string;
  defaultAlias?: string;
  resolvedPath?: string;
};

export type TypeKind = 'type' | 'enum';

export type TypeEntity = RangeEntity & {
  isExported: boolean;
  kind: TypeKind;
  docstring?: string;
};

export type ComponentProp = {
  name: string;
  type?: string;
  required?: boolean;
};

export type ComponentEntity = RangeEntity & {
  isExported: boolean;
  props?: ComponentProp[];
  propsType?: string;
};

export type CommitEntity = {
  id?: string;
  hash: string;
  message: string;
  author: string;
  email: string;
  date: string;
};

export type ProjectEntity = {
  id: string;
  name: string;
  rootPath: string;
  createdAt: string;
  lastParsed: string;
  fileCount?: number;
};

export type Entity =
  | FileEntity
  | ClassEntity
  | InterfaceEntity
  | FunctionEntity
  | VariableEntity
  | ImportEntity
  | TypeEntity
  | ComponentEntity
  | CommitEntity;

export type NodeLabel =
  | 'File'
  | 'Class'
  | 'Interface'
  | 'Function'
  | 'Variable'
  | 'Import'
  | 'Type'
  | 'Component'
  | 'Commit'
  | 'MarkdownDocument'
  | 'Section'
  | 'CodeBlock'
  | 'Link';
