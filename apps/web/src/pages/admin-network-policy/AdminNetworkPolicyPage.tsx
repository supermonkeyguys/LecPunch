import { type FormEvent, useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { Badge, Button } from '@lecpunch/ui';
import {
  getAdminNetworkPolicy,
  updateAdminNetworkPolicy,
  type AdminNetworkPolicy
} from '@/features/network-policy/network-policy.api';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { formatDateTime } from '@/shared/lib/time';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';
import { showToast } from '@/shared/ui/toast';

interface NetworkPolicyFormState {
  allowAnyNetwork: boolean;
  allowedPublicIps: string;
  allowedCidrs: string;
  trustProxy: boolean;
  trustedProxyHops: number;
}

const emptyForm: NetworkPolicyFormState = {
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

const toFormState = (policy: AdminNetworkPolicy): NetworkPolicyFormState => ({
  allowAnyNetwork: policy.allowAnyNetwork,
  allowedPublicIps: listToTextarea(policy.allowedPublicIps),
  allowedCidrs: listToTextarea(policy.allowedCidrs),
  trustProxy: policy.trustProxy,
  trustedProxyHops: policy.trustedProxyHops
});

export const AdminNetworkPolicyPage = () => {
  const [form, setForm] = useState<NetworkPolicyFormState>(emptyForm);
  const [source, setSource] = useState<AdminNetworkPolicy['source']>('environment');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadPolicy = async () => {
      setLoading(true);
      setError(null);

      try {
        const policy = await getAdminNetworkPolicy();
        if (!cancelled) {
          setForm(toFormState(policy));
          setSource(policy.source);
          setUpdatedAt(policy.updatedAt);
        }
      } catch (error) {
        if (!cancelled) {
          setError(getApiErrorMessage(error, '加载网络策略失败'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPolicy();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      const updated = await updateAdminNetworkPolicy({
        allowAnyNetwork: form.allowAnyNetwork,
        allowedPublicIps: textareaToList(form.allowedPublicIps),
        allowedCidrs: textareaToList(form.allowedCidrs),
        trustProxy: form.trustProxy,
        trustedProxyHops: form.trustedProxyHops
      });

      setForm(toFormState(updated));
      setSource(updated.source);
      setUpdatedAt(updated.updatedAt);
      showToast('网络策略已更新');
    } catch (error) {
      showToast(getApiErrorMessage(error, '更新网络策略失败'), 'error');
    } finally {
      setSaving(false);
    }
  };

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
        {loading ? (
          <PageState
            tone="loading"
            title="正在加载网络策略"
            description="正在读取当前团队的生效配置。"
          />
        ) : error ? (
          <PageState
            tone="error"
            title={error}
            description="请确认当前账号具备管理员权限，然后重新加载网络策略。"
            action={
              <Button variant="outline" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
                重新加载
              </Button>
            }
          />
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
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

            <label className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4">
              <input
                type="checkbox"
                aria-label="允许任意网络"
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                checked={form.allowAnyNetwork}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    allowAnyNetwork: event.target.checked
                  }))
                }
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
                <textarea
                  aria-label="允许的公网 IP"
                  rows={8}
                  value={form.allowedPublicIps}
                  disabled={form.allowAnyNetwork}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      allowedPublicIps: event.target.value
                    }))
                  }
                  placeholder={'203.0.113.10\n198.51.100.8'}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <span className="mt-2 block text-sm text-gray-500">每行一个 IP，也支持逗号分隔。</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-900">允许的 CIDR 网段</span>
                <textarea
                  aria-label="允许的 CIDR 网段"
                  rows={8}
                  value={form.allowedCidrs}
                  disabled={form.allowAnyNetwork}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      allowedCidrs: event.target.value
                    }))
                  }
                  placeholder={'192.168.0.0/16\n10.0.0.0/8'}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <span className="mt-2 block text-sm text-gray-500">用于办公 LAN、VPN 或宿舍网段白名单。</span>
              </label>
            </div>

            <div className="grid gap-6 rounded-2xl border border-gray-200 p-4 md:grid-cols-[1fr_220px]">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label="信任反向代理"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                  checked={form.trustProxy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      trustProxy: event.target.checked
                    }))
                  }
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
                <input
                  type="number"
                  aria-label="受信任代理层数"
                  min={1}
                  value={form.trustedProxyHops}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      trustedProxyHops: Math.max(1, Number(event.target.value) || 1)
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setReloadToken((value) => value + 1)}
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
