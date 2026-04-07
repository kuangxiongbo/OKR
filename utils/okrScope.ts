import { OKR, OKRLevel } from '../types';

/** 审批与提示用：公司/部门级为团队 OKR，个人级为个人 OKR */
export function isTeamOKR(okr: OKR): boolean {
  return okr.level !== OKRLevel.PERSONAL;
}

export function getOKRScopeTypeLabel(okr: OKR): string {
  return isTeamOKR(okr) ? '团队 OKR' : '个人 OKR';
}
