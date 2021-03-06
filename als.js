/*! @preserve https://github.com/wusfen/als.js */

! function(window) {

    // 
    // 模拟数据库
    // 
    var db = {
        store: window.localStorage || {},
        name: 'als:table',
        table: function(name) {
            this.name = 'als:' + name
            return this
        },
        read: function() {
            try {
                return JSON.parse(this.store[this.name]) || []
            } catch (e) {
                return []
            }
        },
        write: function(data) {
            try {
                this.store[this.name] = JSON.stringify(data, null, ' ')
            } catch (e) {
                console.error('[als]', e)
            }
        },
        cid: function() {
            var id = this.store['als.id'] || '0'
            id = +id + 1
            return this.store['als.id'] = id
        },
        insert: function(data, pk) {
            pk = pk || 'id'
            var list = this.read()
            data[pk] = this.cid()
            list.push(data)
            this.write(list)
        },
        update: function(data, pk) {
            pk = pk || 'id'
            var list = this.read()
            var where = {}
            where[pk] = data[pk]
            for (var i = 0, length = list.length; i < length; i++) {
                var item = list[i]
                if (this.match(item, where)) {
                    list[i] = data
                }
            }
            this.write(list)
        },
        save: function(data, pk) {
            pk = pk || 'id'
            if (data[pk]) {
                this.update(data, pk)
            } else {
                this.insert(data, pk)
            }
        },
        delete: function(where) {
            var list = this.read()
            for (var i = 0, length = list.length; i < length; i++) {
                var item = list[i]
                if (this.match(item, where)) {
                    list.splice(i, 1), i--, length--
                }
            }
            this.write(list)
        },
        page: function(pageNo, pageSize) {
            this.pageNo = pageNo
            this.pageSize = pageSize
            return this
        },
        select: function(where) {
            var list = this.read()
            var arr = []
            for (var i = 0; i < list.length; i++) {
                var item = list[i]
                if (this.match(item, where)) {
                    arr.push(item)
                }
            }

            if (this.pageNo) {
                var pageNo = this.pageNo
                var pageSize = this.pageSize || 10
                var start = (pageNo - 1) * pageSize
                var end = start + pageSize
                delete this.pageNo
                return arr.slice(start, end)
            }

            return arr
        },
        match: function(obj, where) {
            if (obj === where) {
                return true
            }

            var isMatch = true
            for (var key in where) {
                var ov = obj[key]
                var wv = where[key]

                if (typeof ov == 'object') continue
                if (typeof wv == 'object') continue
                if (!(key in obj)) continue
                if (wv === '' || wv === undefined || wv === null) continue

                // search
                if (typeof ov == 'string' && ov.match(wv)) continue

                if (ov != wv) {
                    isMatch = false
                    break
                }
            }
            return isMatch
        },
        isAction: function(action) {
            return ['select', 'insert', 'update', 'save', 'delete'].indexOf(action) != -1
        }
    }


    // 
    // XMLHttpRequest 冒充
    // 
    function fakeXHR(XHR) {

        // 真·太子 
        var XHR = XHR
        var PRO = XHR.prototype

        // 冒充者
        var _XHR = function() {
            this.xhr = new XHR
        }
        var _PRO = _XHR.prototype

        // 冒充者继承家产
        for (var key in PRO) {
            (function(key) {
                var fun = (function() { try { return PRO[key] } catch (e) {} }())
                // 假·方法 ***
                _PRO[key] = typeof(fun) != 'function' ? fun : function() {
                    // console.log(key, fun)
                    // 真·方法
                    fun.apply(this.xhr, arguments)
                }
            })(key)
        }

        // 假·发送 <- 用户
        _PRO.send = function(data) {
            var _xhr = this
            var xhr = this.xhr
            // console.info('[als]', type, url, data)

            // 真·变化
            xhr.onreadystatechange = function() {
                // 假·信息 <- 真·信息
                for (var k in xhr) {
                    var v = xhr[k]
                    if (typeof v != 'function') {
                        _xhr[k] = v
                    }
                }

                // 假·变化 -> 用户
                var _orc = _xhr.onreadystatechange
                _orc && _orc.apply(_xhr, arguments)
            }
            // 真·完成
            xhr.onload = function() {
                // 假·完成 -> 用户
                _xhr.onload && _xhr.onload.apply(_xhr, arguments)
            }

            // 真·发送
            xhr.send.apply(xhr, arguments)
        }

        // 冒充者
        return _XHR
    }


    // application/x-www-form-urlencoded => {}
    // k=v&obj[arr][0][]
    function parseXWWWFormUrlencoded(params) {
        if (!params) { return {} }

        var data = {}
        params = params.replace(/\+/g, ' ')
        var kvs = params.split('&')

        for (var i = 0; i < kvs.length; i++) {
            var kkv = kvs[i]
            var kk_v = kkv.split('=')
            var kk = decodeURIComponent(kk_v[0]) // obj[a][0][ak]
            var value = decodeURIComponent(kk_v[1]) // 1

            set(data, kk, convertValue(value))
        }

        function set(data, kk, value) {
            var path = kk.replace(/\]/g, '').split('[') // ["obj", "a", "0", "ak"]

            var parent = data

            for (var i = 0; i < path.length; i++) {
                var key = path[i] // a
                var nextKey = path[i + 1] // 0

                // ["obj", "a", "0"
                // last = obj.a[0] = []  || obj.a[0] = {}
                // last.push(value)      || last[key] = value
                if (i == path.length - 1) break

                // 下个key决定当前是对象还是数组
                var cur = parent[key] || (isNaN(nextKey) ? {} : []) // '0' ''
                parent[key] = cur
                parent = cur

            }

            // last key
            // obj.a[0]  ['ak'] = 1
            parent instanceof Array ? parent.push(value) : parent[key] = value

            return data
        }

        function convertValue(value) {
            if (value == 'undefined' || value == 'null') value = null
            if (value == 'true') value = true
            if (value == 'false') value = false
            if (value && typeof value == 'string' && !isNaN(value)) value = Number(value)
            return value
        }

        return data
    }


    // parse data
    // json, application/x-www-form-urlencoded, FormData
    function parseData(params, cb) {
        var data = {}

        // json, application/x-www-form-urlencoded
        if (typeof params == 'string') {
            data = params.match('{') ? JSON.parse(params) : parseXWWWFormUrlencoded(params)
        }

        // FormData
        var fileCount = 0
        if (window.FormData && params instanceof FormData) {
            var keys = params.keys()

            for (var item; item = keys.next(), !item.done;) {

                var key = item.value
                var value = params.get(key)
                data[key] = value

                if (window.File && value instanceof File) {
                    fileCount += 1

                    var reader = new FileReader
                    reader.onload = function(e) {
                        fileCount -= 1
                        data[key] = e.target.result

                        if (!fileCount) {
                            cb && cb(data)
                        }
                    }
                    reader.readAsDataURL(value)
                }

            }
        }
        if (!fileCount) {
            cb && cb(data)
        }

        return data
    }


    function extend() {
        var obj = arguments[0]
        for (var i = 1; i < arguments.length; i++) {
            var _obj = arguments[i]
            for(var k in _obj){
                obj[k] = _obj[k]
            }
        }
        return arguments[0]
    }


    // ajax监听处理器
    // {url:'',handler:fn, delay:1}
    var rules = []


    // 注入监听
    function inject(_XHR) {

        var XHR = _XHR
        var PRO = XHR.prototype
        var PRO_open = PRO.open

        PRO.open = function(type, url) {
            PRO_open.apply(this, arguments)

            var xhr = this
            xhr.send = function(params) {

                // ?search
                var search = parseData((url.match(/\?(.*)/)||[])[1]) || {}

                // parse data
                parseData(params, function(data) {
                    data = extend({}, search, data)

                    // 监听处理
                    var rs
                    var delay = 1
                    var _delay
                    try {
                        for (var i = 0; i < rules.length; i++) {
                            var rule = rules[i]
                            var match = url.match(rule.url)
                            if (match) {

                                var handler = rule.handler
                                var _rs = handler(type, url, data, match)
                                if (_rs) {
                                    rs = _rs
                                    _delay = rule.delay || delay
                                }
                            }
                        }
                        delay = _delay
                    } catch (e) {
                        console.error(e)
                    }

                    // 拦截
                    if (rs) {

                        // 覆盖
                        // PRO_open.apply(xhr, [type, url + '?__@[als]'])

                        // 取消用户注册的回调
                        var onload = xhr.onload
                        var orc = xhr.onreadystatechange
                        xhr.onload = null
                        xhr.onreadystatechange = null

                        // 模拟成功
                        setTimeout(function() {
                            var res = JSON.stringify(rs)
                            xhr.readyState = 4
                            xhr.status = 200
                            xhr.response = xhr.responseText = res

                            // 手动触发用户回调
                            onload && onload.apply(xhr, [{}])
                            orc && orc.apply(xhr, [{}])
                        }, delay)

                        // log
                        console.info('\n', '[als]', type, url, '\n', data, '\n', rs, '\n\n')

                    } else {
                        PRO.send.apply(xhr, [params])
                    }

                })
            }
        }

    }


    // 真假切换
    var XHR = window.XMLHttpRequest
    var _XHR = fakeXHR(XHR)
    inject(_XHR)


    // api
    function als(url, handler, delay) {
        if (typeof url == 'function') {
            delay = handler
            handler = url
            url = ''
        }
        if (typeof handler == 'object') {
            var response = handler
            handler = function() {
                return response
            }
        }

        rules.push({
            url: url,
            handler: handler,
            delay: delay
        })
        return als
    }
    als.open = function() {
        window.XMLHttpRequest = _XHR
        return this
    }
    als.close = function() {
        window.XMLHttpRequest = XHR
        return this
    }
    als.table = function(name, action, data, pageNo, pageSize, pk) {
        if (als.isAction(action)) {
            return db.table(name).page(pageNo, pageSize)[action](data, pk)
        }
        return db.table(name)
    }
    als.db = db
    als.isAction = db.isAction


    // export
    if (typeof module != 'undefined') {
        module.exports = als
    } else {
        window.als = als
    }

}(window)