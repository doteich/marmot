import Widget from './{{WIDGET_PASCAL}}.vue'
import WidgetConfig from './{{WIDGET_PASCAL}}Config.vue'

/**
 * Marmot extension entry contract.
 *
 * The host dynamically imports this module inside an error boundary and reads
 * these two named exports:
 *   - widgetComponent: rendered on the canvas / viewer
 *   - configComponent: rendered inside the property inspector
 */
export default {
  widgetComponent: Widget,
  configComponent: WidgetConfig,
}
