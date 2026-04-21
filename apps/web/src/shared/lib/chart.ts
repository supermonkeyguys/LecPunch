import type { CSSProperties } from 'react';

export const CHART_COLORS = {
  duration: '#2563EB',
  goal: '#7C3AED',
  income: '#15803D',
  expense: '#B45309',
  net: '#1D4ED8',
  axisText: '#6B7280',
  grid: '#E5E7EB',
  tooltipBorder: '#E5E7EB',
  tooltipBackground: '#FFFFFF'
} as const;

export const CHART_TOOLTIP_CONTENT_STYLE: CSSProperties = {
  border: `1px solid ${CHART_COLORS.tooltipBorder}`,
  borderRadius: 12,
  backgroundColor: CHART_COLORS.tooltipBackground,
  boxShadow: '0 10px 20px rgba(15, 23, 42, 0.12)',
  padding: '10px 12px'
};

export const CHART_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: '#0F172A',
  fontWeight: 600,
  marginBottom: 6
};

export const CHART_TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: '#334155',
  fontSize: 12
};

export const formatSecondsAsHours = (seconds: number, maxFractionDigits = 1) => {
  const safeSeconds = Math.max(seconds, 0);
  const hours = safeSeconds / 3600;
  return `${hours.toLocaleString('zh-CN', { maximumFractionDigits: maxFractionDigits })}h`;
};

export const formatCentsAsYuan = (cents: number, maxFractionDigits = 2) => {
  const amount = cents / 100;
  return `¥${amount.toLocaleString('zh-CN', { maximumFractionDigits: maxFractionDigits })}`;
};

export const formatWeekKeyForAxis = (weekKey: string) => {
  if (!weekKey || weekKey.length !== 10) {
    return weekKey;
  }

  return weekKey.slice(5);
};

