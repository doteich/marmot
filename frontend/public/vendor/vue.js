/**
 * Marmot SDK - Vue ESM Bridge
 * Maps browser dynamic ESM imports for 'vue' directly to Marmot's host Vue runtime.
 */
const v = (typeof window !== 'undefined' && window.__MARMOT_SDK__?.vue) || {};

export default v;

// Core Reactivity
export const ref = v.ref;
export const shallowRef = v.shallowRef;
export const reactive = v.reactive;
export const shallowReactive = v.shallowReactive;
export const readonly = v.readonly;
export const shallowReadonly = v.shallowReadonly;
export const computed = v.computed;
export const watch = v.watch;
export const watchEffect = v.watchEffect;
export const watchSyncEffect = v.watchSyncEffect;
export const watchPostEffect = v.watchPostEffect;
export const triggerRef = v.triggerRef;
export const customRef = v.customRef;
export const toRef = v.toRef;
export const toRefs = v.toRefs;
export const toValue = v.toValue;
export const isRef = v.isRef;
export const unref = v.unref;
export const isReactive = v.isReactive;
export const isReadonly = v.isReadonly;
export const isProxy = v.isProxy;

// Lifecycle Hooks
export const onMounted = v.onMounted;
export const onUnmounted = v.onUnmounted;
export const onUpdated = v.onUpdated;
export const onBeforeMount = v.onBeforeMount;
export const onBeforeUnmount = v.onBeforeUnmount;
export const onBeforeUpdate = v.onBeforeUpdate;
export const onErrorCaptured = v.onErrorCaptured;
export const onActivated = v.onActivated;
export const onDeactivated = v.onDeactivated;
export const onRenderTracked = v.onRenderTracked;
export const onRenderTriggered = v.onRenderTriggered;
export const onScopeDispose = v.onScopeDispose;

// Component & VNode APIs
export const defineComponent = v.defineComponent;
export const defineAsyncComponent = v.defineAsyncComponent;
export const defineCustomElement = v.defineCustomElement;
export const h = v.h;
export const createVNode = v.createVNode;
export const cloneVNode = v.cloneVNode;
export const mergeProps = v.mergeProps;
export const isVNode = v.isVNode;
export const nextTick = v.nextTick;
export const inject = v.inject;
export const provide = v.provide;
export const hasInjectionContext = v.hasInjectionContext;
export const useSlots = v.useSlots;
export const useAttrs = v.useAttrs;
export const useId = v.useId;
export const useModel = v.useModel;
export const effectScope = v.effectScope;
export const getCurrentScope = v.getCurrentScope;
export const getCurrentInstance = v.getCurrentInstance;
