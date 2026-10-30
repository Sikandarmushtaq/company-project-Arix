/**
 * PROTOTYPE LOCAL STATE DEFINITIONS FOR /org/numbers
 *
 * Frontend prototype phase: runs using robust local state with all production
 * workflows and behaviors preserved.
 */

export type NumberType = 'local' | 'toll_free' | 'national';
export type NumberStatus = 'active' | 'inactive';

export interface NumberHistoryInfo {
  sms: number;
  calls: number;
  hasHistory: boolean;
  pendingRetirement: boolean;
}

export interface OrgNumberItem {
  id: number;
  phoneNumber: string; // e.g. "+19458880868"
  countryCode: 'US' | 'CA';
  locality?: string;
  region?: string;
  numberType: NumberType;
  assignedUserId: number | null;
  assignedUserName: string | null;
  assignedUserRole?: 'owner' | 'manager' | 'user';
  isActive: boolean;
  callerIdName: string | null;
  inboundCnamEnabled: boolean;
  monthlyCostCents: number;
  createdAt: string;
  history: NumberHistoryInfo;
}

export interface AvailableNumberItem {
  phoneNumber: string;
  countryCode: 'US' | 'CA';
  locality?: string;
  region?: string;
  numberType: NumberType;
  features: string[]; // ['voice', 'sms', 'mms']
  monthlyCostCents: number;
  upfrontCostCents: number;
}

export interface OrgMemberOption {
  id: number;
  fullName: string;
  email: string;
  role: 'owner' | 'manager' | 'user';
  hasNumber: boolean;
  assignedPhone?: string;
}

export interface OrganizationNumberConfig {
  id: number;
  name: string;
  maxPhoneNumbers: number;
}

export interface NumberFilters {
  search: string;
  assignment: 'all' | 'assigned' | 'unassigned';
  type: 'all' | 'local' | 'toll_free' | 'national';
  status: 'all' | 'active' | 'inactive';
}
