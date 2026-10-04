import {
  Chart,
  registerables,
} from 'chart.js'
import 'chartjs-adapter-date-fns'

// Register all core controllers, elements, scales and plugins
Chart.register(...registerables)

// Expose on window for external ESM widgetsHot-loaded from MinIO
if (typeof window !== 'undefined') {
  (window as unknown as { Chart: typeof Chart }).Chart = Chart
}

/**
 * Returns current CSS color tokens for Chart.js rendering based on theme
 */
export function getChartThemeColors() {
  const isDark = document.documentElement.classList.contains('dark') ||
    document.body.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches

  return {
    textColor: isDark ? '#94a3b8' : '#64748b',
    textMain: isDark ? '#f8fafc' : '#0f172a',
    gridColor: isDark ? 'rgba(51, 65, 85, 0.45)' : 'rgba(226, 232, 240, 0.8)',
    borderColor: isDark ? '#334155' : '#cbd5e1',
    tooltipBg: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    tooltipText: isDark ? '#f8fafc' : '#0f172a',
    tooltipBorder: isDark ? '#475569' : '#cbd5e1',
  }
}

export default Chart
