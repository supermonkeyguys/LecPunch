import { apiClient } from '@/shared/http/api-client';

export interface AdminNetworkPolicy {
  teamId: string;
  source: 'database' | 'environment';
  allowAnyNetwork: boolean;
  allowedPublicIps: string[];
  allowedCidrs: string[];
  trustProxy: boolean;
  trustedProxyHops: number;
  updatedAt: string | null;
}

export interface UpdateAdminNetworkPolicyInput {
  allowAnyNetwork: boolean;
  allowedPublicIps: string[];
  allowedCidrs: string[];
  trustProxy: boolean;
  trustedProxyHops: number;
}

export const getAdminNetworkPolicy = async (): Promise<AdminNetworkPolicy> => {
  const response = await apiClient.get<AdminNetworkPolicy>('/network-policy/admin/current');
  return response.data;
};

export const updateAdminNetworkPolicy = async (
  input: UpdateAdminNetworkPolicyInput
): Promise<AdminNetworkPolicy> => {
  const response = await apiClient.patch<AdminNetworkPolicy>('/network-policy/admin/current', input);
  return response.data;
};
