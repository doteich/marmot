import type { Component } from 'vue'
import {
  iconEngine,
  iconSpeedometer,
  iconTrafficLight,
  iconChart,
  iconBarGraph,
  iconToolText,
} from '@sit-onyx/icons'

import SvgMachineWidget, { SvgMachineConfig } from './SvgMachineWidget.vue'
import GaugeWidget, { GaugeConfig } from './GaugeWidget.vue'
import TextLabelWidget, { TextLabelConfig } from './TextLabelWidget.vue'
import TrafficLightWidget, { TrafficLightConfig } from './TrafficLightWidget.vue'
import TrendChartWidget, { TrendChartConfig } from './TrendChartWidget.vue'
import BarChartWidget, { BarChartConfig } from './BarChartWidget.vue'

export type WidgetCategory = 'layout' | 'indicator' | 'chart' | 'annotation' | 'custom'

export interface WidgetManifest<TProps = Record<string, unknown>> {
  type: string
  name: string
  category: WidgetCategory
  description: string
  icon: string
  defaultSize: {
    width: number
    height: number
  }
  defaultProps: TProps
  widgetComponent: Component
  configComponent?: Component
}

export const widgetRegistry: Record<string, WidgetManifest> = {
  'svg-machine': {
    type: 'svg-machine',
    name: 'Machine Layout',
    category: 'layout',
    description: '2D digital twin SVG model with dynamic element coloring',
    icon: iconEngine,
    defaultSize: { width: 500, height: 350 },
    defaultProps: {
      bindings: [],
    },
    widgetComponent: SvgMachineWidget,
    configComponent: SvgMachineConfig,
  },
  gauge: {
    type: 'gauge',
    name: 'Circular Gauge',
    category: 'indicator',
    description: 'Radial metric dial for temperatures, pressure & speeds',
    icon: iconSpeedometer,
    defaultSize: { width: 220, height: 220 },
    defaultProps: {
      title: 'Pressure / Temp',
      min: 0,
      max: 100,
      unit: '°C',
      value: 65,
      dataPoint: '',
      backgroundColor: 'glass',
    },
    widgetComponent: GaugeWidget,
    configComponent: GaugeConfig,
  },
  'traffic-light': {
    type: 'traffic-light',
    name: 'Traffic Light',
    category: 'indicator',
    description: '3-bulb industrial status signal (Run, Warning, Fault)',
    icon: iconTrafficLight,
    defaultSize: { width: 140, height: 260 },
    defaultProps: {
      title: 'Machine Status',
      orientation: 'vertical',
      showLabels: true,
      ruleMode: 'discrete',
      activeState: 'green',
      dataPoint: '',
      backgroundColor: 'glass',
    },
    widgetComponent: TrafficLightWidget,
    configComponent: TrafficLightConfig,
  },
  'trend-chart': {
    type: 'trend-chart',
    name: 'Trend Chart',
    category: 'chart',
    description: 'TimescaleDB historical telemetry curve with live tail',
    icon: iconChart,
    defaultSize: { width: 480, height: 260 },
    defaultProps: {
      title: 'Trend Curve',
      lineColor: '#0284c7',
      showArea: true,
      showGrid: true,
      dataPoint: '',
      backgroundColor: 'glass',
    },
    widgetComponent: TrendChartWidget,
    configComponent: TrendChartConfig,
  },
  // Alias for backward compatibility
  chart: {
    type: 'chart',
    name: 'Trend Chart',
    category: 'chart',
    description: 'TimescaleDB historical telemetry curve with live tail',
    icon: iconChart,
    defaultSize: { width: 480, height: 260 },
    defaultProps: {
      title: 'Trend Curve',
      lineColor: '#0284c7',
      showArea: true,
      showGrid: true,
      dataPoint: '',
      backgroundColor: 'glass',
    },
    widgetComponent: TrendChartWidget,
    configComponent: TrendChartConfig,
  },
  'bar-chart': {
    type: 'bar-chart',
    name: 'Bar Chart',
    category: 'chart',
    description: 'Bucketed throughput, shift output and scrap counts',
    icon: iconBarGraph,
    defaultSize: { width: 480, height: 260 },
    defaultProps: {
      title: 'Output / Throughput',
      barColor: '#10b981',
      unit: 'pcs',
      showTargetLine: false,
      dataPoint: '',
      backgroundColor: 'glass',
    },
    widgetComponent: BarChartWidget,
    configComponent: BarChartConfig,
  },
  'text-label': {
    type: 'text-label',
    name: 'Text Label',
    category: 'annotation',
    description: 'Customizable canvas annotation or live tag readout badge',
    icon: iconToolText,
    defaultSize: { width: 240, height: 60 },
    defaultProps: {
      text: 'Zone Label',
      fontSize: 14,
      fontWeight: '600',
      textColor: '',
      backgroundColor: 'glass',
      borderColor: '',
      borderRadius: 6,
      textAlign: 'center',
      padding: 8,
    },
    widgetComponent: TextLabelWidget,
    configComponent: TextLabelConfig,
  },
}

/**
 * Register or dynamically extend a widget manifest at runtime (e.g. from ESM plugin)
 */
export function registerWidget(manifest: WidgetManifest): void {
  widgetRegistry[manifest.type] = manifest
}

export function getWidgetManifest(type: string): WidgetManifest | undefined {
  return widgetRegistry[type]
}

export function getAllWidgets(): WidgetManifest[] {
  // Filter out aliases like 'chart' to avoid duplicates in palettes
  return Object.values(widgetRegistry).filter(
    (w, idx, self) => self.findIndex((item) => item.type === w.type) === idx && w.type !== 'chart'
  )
}

export function getWidgetsByCategory(category: WidgetCategory): WidgetManifest[] {
  return getAllWidgets().filter((w) => w.category === category)
}

export function getWidgetComponent(type: string): Component {
  return widgetRegistry[type]?.widgetComponent || SvgMachineWidget
}

export function getWidgetConfigComponent(type: string): Component | undefined {
  return widgetRegistry[type]?.configComponent
}
