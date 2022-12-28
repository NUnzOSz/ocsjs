import { uuid } from '../utils/common';
import {
	deleteValue,
	setValue,
	addConfigChangeListener,
	removeConfigChangeListener,
	getValue,
	getTab,
	listValues
} from '../utils/tampermonkey';

/**
 * 跨域脚本事件通讯
 */
export class CorsEventEmitter {
	eventMap: Map<string, number> = new Map();

	private eventKey(name: string) {
		return 'cors.events.' + name;
	}

	tempKey(...args: string[]) {
		return ['_temp_', ...args].join('.');
	}

	keyOfReturn(id: string) {
		return this.tempKey('event', id, 'return');
	}

	keyOfArguments(id: string) {
		return this.tempKey('event', id, 'arguments');
	}

	keyOfState(id: string) {
		return this.tempKey('event', id, 'state');
	}

	/**
	 * 提交事件
	 * @param name 事件名
	 * @param args 事件参数
	 * @param callback 事件回调，可以接收返回值
	 */
	emit(name: string, args: any[], callback: (returnValue: any, remote: boolean) => void): void {
		getTab(({ tabId }) => {
			const id = uuid().replace(/-/g, '');
			const key = tabId + '.' + this.eventKey(name);

			/** 状态, 0 等待交互 ， 1 确定 , 2 取消 ， 后面紧跟着模态框中获取到的值，如果模态框类型是 prompt 则有值，否则为空字符串 */
			setValue(this.keyOfState(id), 0);
			/** 模态框所需参数 */
			setValue(this.keyOfArguments(id), args);

			const listenerId = addConfigChangeListener(this.keyOfState(id), (pre, curr, remote) => {
				// 移除此监听器
				removeConfigChangeListener(listenerId);
				// 执行回调
				callback(getValue(this.keyOfReturn(id)), remote);
				// 移除冗余的本地临时存储变量
				deleteValue(this.keyOfState(id));
				deleteValue(this.keyOfReturn(id));
				deleteValue(this.keyOfArguments(id));
			});

			/** 添加 id 到监听队列 */
			setValue(key, (getValue(key) ? String(getValue(key)).split(',') : []).concat(id).join(','));
		});
	}

	/**
	 * 监听跨域事件
	 * @param name 事件名
	 * @param handler 处理器，可以通过处理器返回任意值作为另外一端的回调值
	 * @returns
	 */
	on(name: string, handler: (args: any[]) => any) {
		return new Promise<number>((resolve) => {
			getTab(({ tabId }) => {
				const key = tabId + '.' + this.eventKey(name);
				const originId = this.eventMap.get(key);

				if (originId) {
					resolve(originId);
				} else {
					// 清空未处理的事件
					setValue(key, '');

					// 添加 models 监听队列
					const id = addConfigChangeListener(key, async (pre, curr, remote) => {
						if (remote) {
							const list = String(curr).split(',');
							// 处理队列
							const id = list.pop();

							if (id) {
								// 设置返回参数
								setValue(this.keyOfReturn(id), await handler(getValue(this.keyOfArguments(id))));

								// 更新队列
								setTimeout(() => {
									// 这里改变参数，可以触发另一端的监听
									setValue(this.keyOfState(id), 1);
									// 完成监听，删除id
									setValue(key, list.join(','));
								}, 100);
							}
						}
					});
					this.eventMap.set(key, id);

					resolve(id);
				}
			});
		});
	}

	off(name: string) {
		const key = this.eventKey(name);
		const originId = this.eventMap.get(key);
		if (originId) {
			this.eventMap.delete(key);
			removeConfigChangeListener(originId);
		}
	}
}

if (typeof GM_listValues !== 'undefined') {
	// 离开页面后
	window.onload = () => {
		// 删除全部未处理的模态框临时变量，以及监听队列
		listValues().forEach((key) => {
			if (/_temp_.event.[0-9a-z]{32}.(state|return|arguments)/.test(key)) {
				deleteValue(key);
			}

			if (/[0-9a-z]{32}.cors.events.model/.test(key)) {
				deleteValue(key);
			}
		});
	};
}

/**
 * 全局跨域对象
 */
export const cors = new CorsEventEmitter();