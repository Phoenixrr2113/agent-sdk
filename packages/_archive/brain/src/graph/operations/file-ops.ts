/**
 * File-level graph operations: upsert, delete, batch, clear.
 */

import type { GraphClient } from '../client';
import {
  fileToNodeProps,
  functionToNodeProps,
  classToNodeProps,
  interfaceToNodeProps,
  variableToNodeProps,
  typeToNodeProps,
  componentToNodeProps,
  type ParsedFileEntities,
  type FileEntity,
  type FunctionEntity,
  type ClassEntity,
  type InterfaceEntity,
  type VariableEntity,
  type TypeEntity,
  type ComponentEntity,
} from '../schema';
import { CYPHER } from './cypher';
import { toParams } from './shared';

export interface FileOps {
  upsertFile(file: FileEntity): Promise<void>;
  upsertFunction(fn: FunctionEntity): Promise<void>;
  upsertClass(cls: ClassEntity): Promise<void>;
  upsertInterface(iface: InterfaceEntity): Promise<void>;
  upsertVariable(variable: VariableEntity): Promise<void>;
  upsertType(type: TypeEntity): Promise<void>;
  upsertComponent(component: ComponentEntity): Promise<void>;

  createCallEdge(
    callerName: string, callerFile: string,
    calleeName: string, calleeFile: string,
    line: number
  ): Promise<void>;
  createImportsEdge(fromPath: string, toPath: string, specifiers?: string[]): Promise<void>;
  createExtendsEdge(childName: string, childFile: string, parentName: string, parentFile?: string): Promise<void>;
  createImplementsEdge(className: string, classFile: string, interfaceName: string, interfaceFile?: string): Promise<void>;
  createRendersEdge(parentName: string, parentFile: string, childName: string, line: number): Promise<void>;

  deleteFileEntities(filePath: string): Promise<void>;
  clearAll(): Promise<void>;
  batchUpsert(entities: ParsedFileEntities): Promise<void>;
}

export class FileOpsImpl implements FileOps {
  constructor(private readonly client: GraphClient) {}

  async upsertFile(file: FileEntity): Promise<void> {
    const props = fileToNodeProps(file);
    await this.client.query(CYPHER.UPSERT_FILE, { params: toParams(props) });
  }

  async upsertFunction(fn: FunctionEntity): Promise<void> {
    const props = functionToNodeProps(fn);
    await this.client.query(CYPHER.UPSERT_FUNCTION, { params: toParams(props) });
  }

  async upsertClass(cls: ClassEntity): Promise<void> {
    const props = classToNodeProps(cls);
    await this.client.query(CYPHER.UPSERT_CLASS, { params: toParams(props) });
  }

  async upsertInterface(iface: InterfaceEntity): Promise<void> {
    const props = interfaceToNodeProps(iface);
    await this.client.query(CYPHER.UPSERT_INTERFACE, { params: toParams(props) });
  }

  async upsertVariable(variable: VariableEntity): Promise<void> {
    const props = variableToNodeProps(variable);
    await this.client.query(CYPHER.UPSERT_VARIABLE, { params: toParams(props) });
  }

  async upsertType(type: TypeEntity): Promise<void> {
    const props = typeToNodeProps(type);
    await this.client.query(CYPHER.UPSERT_TYPE, { params: toParams(props) });
  }

  async upsertComponent(component: ComponentEntity): Promise<void> {
    const props = componentToNodeProps(component);
    await this.client.query(CYPHER.UPSERT_COMPONENT, { params: toParams(props) });
  }

  async createCallEdge(
    callerName: string, callerFile: string,
    calleeName: string, calleeFile: string,
    line: number
  ): Promise<void> {
    await this.client.query(CYPHER.CREATE_CALLS_EDGE, {
      params: { callerName, callerFile, calleeName, calleeFile, line },
    });
  }

  async createImportsEdge(fromPath: string, toPath: string, specifiers?: string[]): Promise<void> {
    await this.client.query(CYPHER.CREATE_IMPORTS_EDGE, {
      params: { fromPath, toPath, specifiers: specifiers ?? null },
    });
  }

  async createExtendsEdge(childName: string, childFile: string, parentName: string, parentFile?: string): Promise<void> {
    await this.client.query(CYPHER.CREATE_EXTENDS_EDGE, {
      params: { childName, childFile, parentName, parentFile: parentFile ?? null },
    });
  }

  async createImplementsEdge(className: string, classFile: string, interfaceName: string, interfaceFile?: string): Promise<void> {
    await this.client.query(CYPHER.CREATE_IMPLEMENTS_EDGE, {
      params: { className, classFile, interfaceName, interfaceFile: interfaceFile ?? null },
    });
  }

  async createRendersEdge(parentName: string, parentFile: string, childName: string, line: number): Promise<void> {
    await this.client.query(CYPHER.CREATE_RENDERS_EDGE, {
      params: { parentName, parentFile, childName, line },
    });
  }

  async deleteFileEntities(filePath: string): Promise<void> {
    await this.client.query(CYPHER.DELETE_FILE_ENTITIES, { params: { path: filePath } });
  }

  async clearAll(): Promise<void> {
    await this.client.query(CYPHER.CLEAR_ALL, { params: {} });
  }

  async batchUpsert(entities: ParsedFileEntities): Promise<void> {
    await this.upsertFile(entities.file);

    await Promise.all([
      ...entities.functions.map((fn) => this.upsertFunction(fn)),
      ...entities.classes.map((cls) => this.upsertClass(cls)),
      ...entities.interfaces.map((iface) => this.upsertInterface(iface)),
      ...entities.variables.map((v) => this.upsertVariable(v)),
      ...entities.types.map((t) => this.upsertType(t)),
      ...entities.components.map((comp) => this.upsertComponent(comp)),
    ]);

    await Promise.all([
      ...entities.callEdges.map((edge) =>
        this.createCallEdge(
          edge.callerId.split(':')[2] ?? '',
          edge.callerId.split(':')[1] ?? '',
          edge.calleeId.split(':')[2] ?? '',
          edge.calleeId.split(':')[1] ?? '',
          edge.line
        )
      ),
      ...entities.importsEdges.map((edge) =>
        this.createImportsEdge(edge.fromFilePath, edge.toFilePath, edge.specifiers)
      ),
      ...entities.extendsEdges.map((edge) => {
        const parentParts = edge.parentId.split(':');
        const parentFile = parentParts[1] !== 'external' ? parentParts[1] : undefined;
        return this.createExtendsEdge(
          edge.childId.split(':')[2] ?? '',
          edge.childId.split(':')[1] ?? '',
          parentParts[2] ?? parentParts[1] ?? '',
          parentFile
        );
      }),
      ...entities.implementsEdges.map((edge) => {
        const ifaceParts = edge.interfaceId.split(':');
        const ifaceFile = ifaceParts[1] !== 'external' ? ifaceParts[1] : undefined;
        return this.createImplementsEdge(
          edge.classId.split(':')[2] ?? '',
          edge.classId.split(':')[1] ?? '',
          ifaceParts[2] ?? ifaceParts[1] ?? '',
          ifaceFile
        );
      }),
      ...entities.rendersEdges.map((edge) =>
        this.createRendersEdge(
          edge.parentId.split(':')[2] ?? '',
          edge.parentId.split(':')[1] ?? '',
          edge.childId.split(':')[2] ?? '',
          edge.line
        )
      ),
    ]);
  }
}
