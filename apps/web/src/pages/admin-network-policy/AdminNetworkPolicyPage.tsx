import { useCallback, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Shield } from 'lucide-react';
import { Badge, Button } from '@lecpunch/ui';
import { z } from 'zod';
import {
  getAdminNetworkPolicyDebug,
  getAdminNetworkPolicy,
  updateAdminNetworkPolicy,
  type AdminNetworkPolicy,
  type AdminNetworkPolicyDebug
} from '@/features/network-policy/network-policy.api';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { formatDateTime } from '@/shared/lib/time';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';
import { showToast } from '@/shared/ui/toast';

const networkPolicyFormSchema = z.object({
  allowAnyNetwork: z.boolean(),
  allowedPublicIps: z.string(),
  allowedCidrs: z.string(),
  trustProxy: z.boolean(),
  trustedProxyHops: z.number().int().min(1, '受信任代理层数至少为 1')
});

type NetworkPolicyFormValues = z.infer<typeof networkPolicyFormSchema>;

const emptyForm: NetworkPolicyFormValues = {
  allowAnyNetwork: true,
  allowedPublicIps: '',
  allowedCidrs: '',
  trustProxy: false,
  trustedProxyHops: 1
};

const listToTextarea = (items: string[]) => items.join('\n');

const textareaToList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const toFormState = (policy: AdminNetworkPolicy): NetworkPolicyFormValues => ({
  allowAnyNetwork: policy.allowAnyNetwork,
  allowedPublicIps: listToTextarea(policy.allowedPublicIps),
  allowedCidrs: listToTextarea(policy.allowedCidrs),
  trustProxy: policy.trustProxy,
  trustedProxyHops: policy.trustedProxyHops
});

const isLoopbackIp = (ip: string) =>
  ip === '::1' ||
  ip === '0:0:0:0:0:0:0:1' ||
  ip.startsWith('127.');

interface AdminNetworkPolicyPageData {
  policy: AdminNetworkPolicy | null;
  debugInfo: AdminNetworkPolicyDebug | null;
  debugError: string | null;
}

export const AdminNetworkPolicyPage = () => {
  const [source, setSource] = useState<AdminNetworkPolicy['source']>('environment');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<AdminNetworkPolicyDebug | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [isFormHydrated, setIsFormHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<NetworkPolicyFormValues>({
    resolver: zodResolver(networkPolicyFormSchema),
    defaultValues: emptyForm
  });
  const allowAnyNetwork = watch('allowAnyNetwork');
  const fetchPolicyData = useCallback(async (_signal: AbortSignal): Promise<AdminNetworkPolicyPageData> => {
    const [policyResult, debugResult] = await Promise.allSettled([
      getAdminNetworkPolicy(),
      getAdminNetworkPolicyDebug()
    ]);

    if (policyResult.status === 'rejected') {
      throw policyResult.reason;
    }

    return {
      policy: policyResult.value,
      debugInfo: debugResult.status === 'fulfilled' ? debugResult.value : null,
      debugError:
        debugResult.status === 'rejected'
          ? getApiErrorMessage(debugResult.reason, '加载当前请求 IP 失败')
          : null
    };
  }, []);
  const { data, loading, error, refresh } = useAsyncData(fetchPolicyData, [], {
    initialData: {
      policy: null,
      debugInfo: null,
      debugError: null
    }
  });
  const loadError = error ? getApiErrorMessage(error, '加载网络策略失败') : null;

  useEffect(() => {
    if (!data.policy) {
      setIsFormHydrated(false);
      return;
    }

    reset(toFormState(data.policy));
    setSource(data.policy.source);
    setUpdatedAt(data.policy.updatedAt);
    setDebugInfo(data.debugInfo);
    setDebugError(data.debugError);
    setIsFormHydrated(true);
  }, [data, reset]);

  const handleSubmitForm = handleSubmit(async (values) => {
    setSaving(true);

    try {
      const updated = await updateAdminNetworkPolicy({
        allowAnyNetwork: values.allowAnyNetwork,
        allowedPublicIps: textareaToList(values.allowedPublicIps),
        allowedCidrs: textareaToList(values.allowedCidrs),
        trustProxy: values.trustProxy,
        trustedProxyHops: values.trustedProxyHops
      });
      const nextDebug = await getAdminNetworkPolicyDebug().catch(() => null);

      reset(toFormState(updated));
      setSource(updated.source);
      setUpdatedAt(updated.updatedAt);
      setDebugInfo(nextDebug);
      setDebugError(nextDebug ? null : '刷新当前请求 IP 失败');
      showToast('网络策略已更新');
    } catch (error) {
      showToast(getApiErrorMessage(error, '更新网络策略失败'), 'error');
    } finally {
      setSaving(false);
    }
  });

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-blue-700">
            <Shield className="h-4 w-4" />
            管理后台
          </div>
          <h1 className="text-2xl font-bold text-gray-900">网络策略管理</h1>
          <p className="mt-1 text-sm text-gray-500">保存后会立即影响服务端打卡网络校验，无需重启前端页面。</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={source === 'database' ? 'success' : 'info'}>
            {source === 'database' ? '数据库策略' : '环境变量兜底'}
          </Badge>
          {updatedAt ? <span className="text-sm text-gray-500">最近更新 {formatDateTime(updatedAt)}</span> : null}
        </div>
      </div>

      <PageSection padded>
        {loadError ? (
          <PageState
            tone="error"
            title={loadError}
            description="请确认当前账号具备管理员权限，然后重新加载网络策略。"
            action={
              <Button variant="outline" size="sm" onClick={refresh}>
                重新加载
              </Button>
            }
          />
        ) : loading || !isFormHydrated ? (
          <PageState
            tone="loading"
            title="正在加载网络策略"
            description="正在读取当前团队的生效配置。"
          />
        ) : (
          <form className="space-y-6" onSubmit={handleSubmitForm}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">生效方式</p>
                <p className="mt-2 text-sm text-gray-600">
                  关闭“允许任意网络”后，服务端会只放行下面配置的 IP 与 CIDR。
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">代理信任</p>
                <p className="mt-2 text-sm text-gray-600">
                  只有请求一定会经过自有反向代理时才应启用，否则不要信任 `X-Forwarded-For`。
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold text-slate-900">当前请求诊断</p>
                {debugInfo ? (
                  <Badge variant={debugInfo.isAllowed ? 'success' : 'warning'}>
                    {debugInfo.isAllowed ? '当前请求已放行' : '当前请求未放行'}
                  </Badge>
                ) : null}
              </div>

              {debugInfo ? (
                <>
                  <p className="mt-2 text-sm text-slate-700">
                    服务端当前识别到的客户端 IP：<span className="font-mono">{debugInfo.clientIp || '未识别'}</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    保存后可直接刷新本页，确认当前请求是否已经被白名单放行。
                  </p>
                  {isLoopbackIp(debugInfo.clientIp) ? (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      当前看到的是 loopback 地址。这通常表示你正在本机通过 `localhost` 或本地 Vite 代理访问页面。
                      这种情况下切换 WiFi 往往不会改变服务端看到的 IP；要验证某个 WiFi 是否生效，请改用机器的局域网地址访问前端/API，或放到真实反向代理环境下测试。
                    </p>
                  ) : null}
                </>
              ) : debugError ? (
                <p className="mt-2 text-sm text-amber-700">{debugError}</p>
              ) : (
                <p className="mt-2 text-sm text-slate-600">正在读取当前请求的服务端识别 IP。</p>
              )}
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4">
              <Controller
                control={control}
                name="allowAnyNetwork"
                render={({ field }) => (
                  <input
                    type="checkbox"
                    aria-label="允许任意网络"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                )}
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">允许任意网络</span>
                <span className="mt-1 block text-sm text-gray-500">
                  仅建议本地开发启用。生产环境应关闭，并明确填写允许打卡的出口 IP 或网段。
                </span>
              </span>
            </label>

            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-900">允许的公网 IP</span>
                <Controller
                  control={control}
                  name="allowedPublicIps"
                  render={({ field }) => (
                    <textarea
                      aria-label="允许的公网 IP"
                      rows={8}
                      value={field.value}
                      disabled={allowAnyNetwork}
                      onChange={field.onChange}
                      placeholder={'203.0.113.10\n198.51.100.8'}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  )}
                />
                <span className="mt-2 block text-sm text-gray-500">每行一个 IP，也支持逗号分隔。</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-900">允许的 CIDR 网段</span>
                <Controller
                  control={control}
                  name="allowedCidrs"
                  render={({ field }) => (
                    <textarea
                      aria-label="允许的 CIDR 网段"
                      rows={8}
                      value={field.value}
                      disabled={allowAnyNetwork}
                      onChange={field.onChange}
                      placeholder={'192.168.0.0/16\n10.0.0.0/8'}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  )}
                />
                <span className="mt-2 block text-sm text-gray-500">用于办公 LAN、VPN 或宿舍网段白名单。</span>
              </label>
            </div>

            <div className="grid gap-6 rounded-2xl border border-gray-200 p-4 md:grid-cols-[1fr_220px]">
              <label className="flex items-start gap-3">
                <Controller
                  control={control}
                  name="trustProxy"
                  render={({ field }) => (
                    <input
                      type="checkbox"
                      aria-label="信任反向代理"
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                  )}
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">信任反向代理</span>
                  <span className="mt-1 block text-sm text-gray-500">
                    启用后会按 `X-Forwarded-For` 和受信任代理层数解析客户端 IP。
                  </span>
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-900">受信任代理层数</span>
                <Controller
                  control={control}
                  name="trustedProxyHops"
                  render={({ field }) => (
                    <input
                      type="number"
                      aria-label="受信任代理层数"
                      min={1}
                      value={field.value}
                      onChange={(event) => field.onChange(Math.max(1, Number(event.target.value) || 1))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  )}
                />
                {errors.trustedProxyHops?.message ? (
                  <span className="mt-2 block text-xs text-red-600">{errors.trustedProxyHops.message}</span>
                ) : null}
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={refresh}
              >
                从服务端重载
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? '保存中...' : '保存网络策略'}
              </Button>
            </div>
          </form>
        )}
      </PageSection>
    </div>
  );
};
