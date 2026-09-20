export type ComponentType = 'svg-machine' | 'gauge' | 'chart' | 'silo' | 'custom-plugin'

export interface ColorRule {
  value: string | number | boolean
  color: string
  label?: string
}

export interface SvgBinding {
  elementId: string // Primary draw.io cell ID or marmot-svg-id
  elementIds?: string[] // Optional array of multiple grouped element IDs
  groupName?: string // Optional friendly name for compound shape group
  action: 'fill' | 'stroke'
  dataPoint: string // format: machine_id.data_point or data_point
  colorRules: ColorRule[]
  defaultColor: string
}

export interface DashboardComponent {
  id: string
  type: ComponentType
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  props: {
    // Svg Machine props
    svgContent?: string
    svgUrl?: string
    bindings?: SvgBinding[]

    // Gauge props
    min?: number
    max?: number
    unit?: string
    dataPoint?: string
    title?: string

    // Chart props
    timeWindowMinutes?: number

    // Silo props
    capacity?: number

    // Custom plugin props
    pluginId?: string
    [key: string]: unknown
  }
}

export interface DashboardConfig {
  id: string
  name: string
  siteId?: string
  description?: string
  width: number
  height: number
  backgroundColor: string
  components: DashboardComponent[]
  createdAt: string
  updatedAt: string
}

export interface SiteInfo {
  id: string
  name: string
  description?: string
  wsUrl: string
  status?: string
  lastSeenAt?: string
  createdAt?: string
}

export interface DataPoint {
  dataPointId: string
  dataPointName: string
  machineId: string
  dataType: string
  unit?: string
}
