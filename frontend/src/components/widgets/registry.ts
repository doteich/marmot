import type { Component } from 'vue'
import SvgMachineWidget, { SvgMachineConfig } from './SvgMachineWidget.vue'
import GaugeWidget, { GaugeConfig } from './GaugeWidget.vue'

export interface WidgetDefinition {
  type: string
  name: string
  widgetComponent: Component
  configComponent?: Component
}

export const widgetRegistry: Record<string, WidgetDefinition> = {
  'svg-machine': {
    type: 'svg-machine',
    name: 'Machine Layout',
    widgetComponent: SvgMachineWidget,
    configComponent: SvgMachineConfig,
  },
  gauge: {
    type: 'gauge',
    name: 'Gauge Indicator',
    widgetComponent: GaugeWidget,
    configComponent: GaugeConfig,
  },
}

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return widgetRegistry[type]
}

export function getWidgetComponent(type: string): Component {
  return widgetRegistry[type]?.widgetComponent || SvgMachineWidget
}

export function getWidgetConfigComponent(type: string): Component | undefined {
  return widgetRegistry[type]?.configComponent
}
