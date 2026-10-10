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
 * Returns current CSS color tokens for Chart.js rendering based on theme.
 * Dynamically queries CSS custom properties from the canvas/viewer artboard
 * so any present or future theme is automatically supported without JS if/else branches.
 */
export function getChartThemeColors(targetElement?: HTMLElement | null) {
  if (typeof window !== 'undefined') {
    const target =
      targetElement ||
      (document.querySelector('.canvas-artboard, .viewer-artboard') as HTMLElement | null)

    if (target) {
      const style = window.getComputedStyle(target)
      const chartText = style.getPropertyValue('--canvas-theme-chart-text').trim()
      const chartMain = style.getPropertyValue('--canvas-theme-text').trim()
      const chartGrid = style.getPropertyValue('--canvas-theme-chart-grid').trim()
      const chartBorder = style.getPropertyValue('--canvas-theme-border').trim()
      const surface = style.getPropertyValue('--canvas-theme-surface').trim()
      const isLight = surface === '#ffffff' || surface === 'rgb(255, 255, 255)'

      if (chartText && chartGrid) {
        return {
          textColor: chartText,
          textMain: chartMain || (isLight ? '#0f172a' : '#f8fafc'),
          gridColor: chartGrid,
          borderColor: chartBorder || (isLight ? '#cbd5e1' : '#334155'),
          tooltipBg: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.95)',
          tooltipText: isLight ? '#0f172a' : '#f8fafc',
          tooltipBorder: isLight ? '#cbd5e1' : '#475569',
        }
      }
    }
  }

  // Universal Fallback defaults
  return {
    textColor: '#94a3b8',
    textMain: '#f8fafc',
    gridColor: 'rgba(51, 65, 85, 0.45)',
    borderColor: '#334155',
    tooltipBg: 'rgba(15, 23, 42, 0.95)',
    tooltipText: '#f8fafc',
    tooltipBorder: '#475569',
  }
}

export default Chart
