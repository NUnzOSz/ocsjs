import defaultsDeep from 'lodash/defaultsDeep';
import { reactive, watch } from 'vue';
import { OCSLocalStorage, OCSStore } from '../core/store';
import { onReady } from '../core/utils';
import { logger } from '../logger';
import { defaultOCSSetting } from '../scripts';

/**
 * OCS 响应式存储对象, 在除油猴环境下的其他环境为 `{}`
 */
export let store: OCSStore = {} as OCSStore;

// 环境检测
if (typeof global === 'undefined') {
  if (typeof unsafeWindow !== 'undefined') {
    store = createStore();
  }

  onReady(() => {
    if (typeof unsafeWindow !== 'undefined') {
      // 统一转向顶层对象
      // eslint-disable-next-line no-undef
      store = unsafeWindow.top?.OCS.store || store;
    } else {
      logger('warn', '为了确保功能正常使用, 请在油猴环境下运行 https://www.tampermonkey.net/');
    }
  });
}

function createStore () {
  /** 默认存储数据 */
  // eslint-disable-next-line no-undef
  const defaultStore = defaultsDeep(typeof global === 'undefined' ? GM_getValue('store', {}) : {}, {
    logs: [],
    workResults: [],
    /** 是否缩小隐藏面板 */
    hide: false,
    /** 面板位置 */
    position: {
      x: 0,
      y: 0
    }
  } as Partial<OCSLocalStorage>);

  /** 本地存储数据 */
  const _localStorage: OCSLocalStorage = reactive<OCSLocalStorage>({
    setting: defaultsDeep(defaultStore.setting, defaultOCSSetting),
    ...defaultStore
  });

  // 响应式对象
  const _store = reactive<OCSStore>({
    localStorage: _localStorage,
    // @ts-ignore
    VERSION: process.env._VERSION_,
    setting: _localStorage.setting,
    currentMedia: null,
    videojs: null,
    workResults: []
  });

  /** 监听，并保存到本地 */
  watch(_localStorage, () => {
    // eslint-disable-next-line no-undef
    GM_setValue('store', JSON.parse(JSON.stringify(_localStorage)));
  });

  return _store;
}
