import { $P } from '@/libraries/point';

function mouseEvent($event) {
    const code = { left: 0, right: 2 };
    return () => new Promise((resolve) => {
        $event.el.addEventListener($event.type, function stop(event) {
            if (event.button === code[$event.which]) {
                $event.el.removeEventListener($event.name, stop);
                resolve();
            }
        }, true);
    });
}

/**
 * 事件回调队列类
 * @class Handlers
 */
class Handlers {
    constructor(component, args) {
        const queue = (args instanceof Array)
            ? args : [args];

        this.component = component;
        this.handlers = queue.map((obj) => {
            if (obj instanceof Function) {
                return {
                    capture: false,
                    type: 'mousemove',
                    callback: component.toHandler(obj, 'mousemove'),
                };
            } else {
                obj.capture = !!obj.capture;
                obj.callback = component.toHandler(obj.callback, obj.type);
                return obj;
            }
        });
    }
    bind() {
        const component = this.component;
        this.handlers.forEach((obj) => {
            if (obj.delegate) {
                component.$$on(obj.type, obj.select, obj.callback);
            } else {
                component.$el.addEventListener(obj.type, obj.callback, obj.capture);
            }
        });
    }
    unbind() {
        const component = this.component;
        this.handlers.forEach((obj) => {
            if (obj.delegate) {
                component.$$off(obj.type, obj.select, obj.callback);
            } else {
                component.$el.removeEventListener(obj.type, obj.callback, obj.capture);
            }
        });
    }
}

export default {
    data() {
        return {
            exclusion: false,
        };
    },
    methods: {
        /**
         * 对事件回调函数进行封装
         * 在运行回调之前插入一段矫正鼠标坐标的操作，并将结果传入实际的回调中
         * @param {function} fn
         * @returns {function} callback
         */
        toHandler(fn, type) {
            let last = false;
            const callbackOutter = (e) => {
                const origin = $P(e.pageX, e.pageY),
                    mouse = origin.add(-1, this.position).mul(1 / this.zoom),
                    bias = last
                        ? origin.add(-1, last).mul(1 / this.zoom)
                        : $P(0, 0);

                last = origin;
                e.$mouse = mouse;
                e.$bias = bias;
                fn(e);
            };

            // TODO: 生产环境时，mousemove 事件不需要异步调用
            return (type !== 'mousemove')
                ? callbackOutter
                : (e) => setTimeout(() => callbackOutter(e));
        },
        EventControler({ exclusion = true, cursor, handlers, beforeEvent, stopEvent, afterEvent }) {
            // 如果有互斥事件在运行，且当前事件也是互斥的，那么忽略当前事件
            if (this.exclusion && exclusion) {
                return (false);
            } else {
                this.exclusion = !!exclusion;
            }

            // 设定鼠标指针
            cursor = cursor ? `url(/cur/${cursor}.cur), crosshair` : 'default';
            // 回调事件队列
            handlers = new Handlers(this, handlers);

            // 起始事件
            beforeEvent = new Promise(beforeEvent || ((res) => res()));
            // 生成终止事件
            if (!(this.stopEvent instanceof Function)) {
                stopEvent = mouseEvent(stopEvent);
            }

            // 事件回调生命周期
            beforeEvent
                // 绑定事件本身和结束条件
                .then(() => {
                    handlers.bind();
                    this.$el.style.cursor = cursor;
                    return stopEvent();
                })
                // 事件结束，解除事件绑定
                .then(() => {
                    handlers.unbind();
                    this.exclusion = false;
                    afterEvent && afterEvent();
                    this.$el.style.cursor = 'default';
                });
        },
    },
};
