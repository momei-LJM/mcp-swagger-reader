/**
 * 根据mock.json生成的TypeScript接口类型
 * 命名规范: T{Url最后一段}Params 和 T{Url最后一段}Response
 * PascalCase命名
 */

// ========== /access/packageUnit/queryPackageInfos - POST ==========
export interface TQueryPackageInfosParams {
  packageNameEn: string;
  packageCode: string;
}

export interface TQueryPackageInfosResponse {
  id?: number;
  disabled?: boolean;
  createTime?: string;
  createBy?: string;
  updateTime?: string;
  updateBy?: string;
  packageUnitCode?: string;
  packageUnitNameEn?: string;
  packageUnitNameCn?: string;
}

// ========== /access/packageUnit/queryPackageInfo - GET ==========
export interface TQueryPackageInfoParams {
  packageCode: string;
  packageName: string;
}

export interface TQueryPackageInfoResponse {
  id?: number;
  disabled?: boolean;
  createTime?: string;
  createBy?: string;
  updateTime?: string;
  updateBy?: string;
  packageUnitCode?: string;
  packageUnitNameEn?: string;
  packageUnitNameCn?: string;
}

// ========== /access/packageUnit/queryList - GET ==========
export interface TQueryListParams {
  disabled?: boolean;
}

export interface TQueryListResponse {
  id?: number;
  disabled?: boolean;
  createTime?: string;
  createBy?: string;
  updateTime?: string;
  updateBy?: string;
  packageUnitCode?: string;
  packageUnitNameEn?: string;
  packageUnitNameCn?: string;
}

// ========== /access/resource/update/roleResource - PUT ==========
export interface TRoleResourceParams {
  roleId: number;
  resourceIds?: number[];
}

export type TRoleResourceResponse = boolean;

// ========== /access/port/validPortDisableStatus - POST ==========
export interface TValidPortDisableStatusParams {
  standardCodes: string[];
}

export type TValidPortDisableStatusResponse = boolean;
