import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { websocketMask, websocketUnmask } = __require("http");
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (websocketMask) {
      module.exports.mask = function(source, mask, output, offset, length) {
        if (length < 24) _mask(source, mask, output, offset, length);
        else websocketMask(source, mask, output, offset, length);
      };
      module.exports.unmask = function(buffer, mask) {
        if (buffer.length < 24) _unmask(buffer, mask);
        else websocketUnmask(buffer, mask);
      };
    } else if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone");
    var kRun = /* @__PURE__ */ Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate");
    var kTotalLength = /* @__PURE__ */ Symbol("total-length");
    var kCallback = /* @__PURE__ */ Symbol("callback");
    var kBuffers = /* @__PURE__ */ Symbol("buffers");
    var kError = /* @__PURE__ */ Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && (typeof params.client_max_window_bits === "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin2, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin2, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin2, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin2, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin2, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin2) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin2 && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin2, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin2) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin2 && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._numFragments = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        this._mask = void 0;
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          const error = this.createError(
            RangeError,
            "Too many message fragments",
            false,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._numFragments = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var {
      types: { isUint8Array }
    } = __require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = /* @__PURE__ */ Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) {
          return dataLength ? [target, data] : [target];
        }
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (!dataLength) return [target];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = /* @__PURE__ */ Symbol("kCode");
    var kData = /* @__PURE__ */ Symbol("kData");
    var kError = /* @__PURE__ */ Symbol("kError");
    var kMessage = /* @__PURE__ */ Symbol("kMessage");
    var kReason = /* @__PURE__ */ Symbol("kReason");
    var kTarget = /* @__PURE__ */ Symbol("kTarget");
    var kType = /* @__PURE__ */ Symbol("kType");
    var kWasClean = /* @__PURE__ */ Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var https = __require("https");
    var http = __require("http");
    var net = __require("net");
    var querystring = __require("querystring");
    var tls = __require("tls");
    var { randomBytes: randomBytes3, createHash: createHash2 } = __require("crypto");
    var { Duplex, Readable } = __require("stream");
    var { URL: URL2 } = __require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = /* @__PURE__ */ Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            if (!options || options.protocols === void 0) {
              protocols = [];
            } else if (Array.isArray(options.protocols)) {
              protocols = options.protocols;
            } else {
              protocols = [options.protocols];
            }
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              if (options.protocols === void 0) {
                protocols = [];
              } else if (Array.isArray(options.protocols)) {
                protocols = options.protocols;
              } else {
                protocols = [options.protocols];
              }
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        this._readyState = _WebSocket.CLOSING;
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 256 * 1024,
        maxFragments: 16 * 1024,
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        protocols: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        parsedUrl = new URL2(parsedUrl);
        parsedUrl.protocol = parsedUrl.protocol === "http:" ? "ws:" : "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes3(16).toString("base64");
      const request = isSecure ? https.request : http.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        const username = querystring.unescape(parsedUrl.username);
        const password = querystring.unescape(parsedUrl.password);
        opts.auth = `${username}:${password}`;
      }
      if (isIpcUrl) {
        const i = opts.path.indexOf(":");
        if (i === -1) {
          opts.socketPath = opts.path;
          opts.path = "";
        } else {
          opts.socketPath = opts.path.slice(0, i);
          opts.path = opts.path.slice(i + 1);
        }
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash2("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeCode = code;
      if (reason.length === 0) {
        websocket._closeMessage = EMPTY_BUFFER;
      } else {
        websocket._closeMessage = Buffer.allocUnsafeSlow(reason.length);
        websocket._closeMessage.set(reason);
      }
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var http = __require("http");
    var { Duplex } = __require("stream");
    var { createHash: createHash2 } = __require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http.createServer((req, res) => {
            const body = http.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash2("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// server/src/main.ts
import { pathToFileURL } from "node:url";

// plugins/lunajam/src/protocol.ts
var PROTOCOL_VERSION = 2;
var DEFAULT_SERVER_URL = "https://lunajam.sn0w13.de";
var CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
var MAX_QUEUE_TRACKS = 200;
var ROOM_RE = /^[0-9A-HJKMNP-TV-Z]{8}$/;
var STANDBY_RE = /^s_[A-Za-z0-9_-]{8,24}$/;
function normalizeCode(raw) {
  return raw.trim().toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
}
function formatCode(code) {
  const clean = normalizeCode(code);
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}
function isRoomCode(raw) {
  return ROOM_RE.test(normalizeCode(raw));
}
function isStandbyToken(raw) {
  return STANDBY_RE.test(raw.trim());
}
function encode(msg) {
  return JSON.stringify(msg);
}
function isObj(x) {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
var COVER_DOMAINS = [
  "tidal.com",
  "scdn.co",
  "spotifycdn.com",
  "sndcdn.com",
  "ytimg.com",
  "ggpht.com",
  "googleusercontent.com",
  "mzstatic.com",
  "dzcdn.net",
  "bcbits.com",
  "coverartarchive.org",
  "archive.org",
  "discordapp.com",
  "discordapp.net",
  "githubusercontent.com",
  "imgur.com",
  "catbox.moe"
];
var AVATAR_DOMAINS = [
  "tidal.com",
  "gravatar.com",
  "discordapp.com",
  "discordapp.net",
  "githubusercontent.com",
  "imgur.com",
  "catbox.moe",
  "googleusercontent.com",
  "twimg.com",
  "bsky.app"
];
function sanitizeText(raw) {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c >= 32 && c < 127 || c > 159 && (c < 8234 || c > 8238) && (c < 8294 || c > 8297)) {
      out += raw[i];
    }
  }
  return out.trim();
}
function str(x, max) {
  if (typeof x !== "string") return null;
  const t = sanitizeText(x);
  return t.length > 0 && t.length <= max ? t : null;
}
function optStr(x, max) {
  if (x === void 0 || x === null) return void 0;
  if (typeof x !== "string") return void 0;
  const t = sanitizeText(x);
  return t.length <= max ? t : t.slice(0, max);
}
function matchesDomain(host, allowed) {
  const h = host.toLowerCase();
  return allowed.some((d) => h === d || h.endsWith(`.${d}`));
}
function safeHttpsUrl(x, allowedDomains) {
  if (x === null || x === void 0 || x === "") return null;
  if (typeof x !== "string" || x.length > 512) return null;
  try {
    const u = new URL(x.trim());
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    return matchesDomain(u.hostname, allowedDomains) ? u.href : null;
  } catch {
    return null;
  }
}
function safeCoverUrl(x) {
  return safeHttpsUrl(x, COVER_DOMAINS);
}
function safeAvatarUrl(x) {
  return safeHttpsUrl(x, AVATAR_DOMAINS);
}
function fin(x, min = 0, max = 1e14) {
  return typeof x === "number" && Number.isFinite(x) && x >= min && x <= max ? x : null;
}
function int(x, min = 0, max = 1e4) {
  return typeof x === "number" && Number.isInteger(x) && x >= min && x <= max ? x : null;
}
var TIDAL_USER_RE = /^\d{1,20}$/;
var PROFILE_PATH_RE = /^\/(?:@[A-Za-z0-9._-]{1,64}|artist\/\d{1,20})$/;
var PEER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
function parseProfile(x) {
  if (!isObj(x)) return null;
  const name = str(x.name, 80) ?? "Listener";
  const cid = typeof x.cid === "string" && x.cid.length <= 64 ? x.cid : "";
  const rawUid = typeof x.tidalUserId === "string" ? x.tidalUserId.trim() : "";
  const tidalUserId = TIDAL_USER_RE.test(rawUid) ? rawUid : void 0;
  const rawPath = typeof x.profilePath === "string" ? x.profilePath.trim() : "";
  const profilePath = PROFILE_PATH_RE.test(rawPath) ? rawPath : void 0;
  return {
    cid,
    name,
    avatarUrl: safeAvatarUrl(x.avatarUrl),
    ...tidalUserId ? { tidalUserId } : {},
    ...profilePath ? { profilePath } : {}
  };
}
function parseQueueInput(x) {
  if (!isObj(x)) return null;
  const trackId = str(x.trackId, 64);
  if (!trackId) return null;
  const title = optStr(x.title, 200) ?? "";
  const artist = optStr(x.artist, 200) ?? "";
  const album = optStr(x.album, 200);
  const coverUrl = safeCoverUrl(x.coverUrl) ?? void 0;
  const durationSec = typeof x.durationSec === "number" && Number.isFinite(x.durationSec) && x.durationSec >= 0 && x.durationSec <= 86400 ? x.durationSec : void 0;
  return { trackId, title, artist, ...album ? { album } : {}, ...coverUrl ? { coverUrl } : {}, ...durationSec !== void 0 ? { durationSec } : {} };
}
function parseQueueTrackReplace(x) {
  if (!isObj(x)) return null;
  const base = parseQueueInput(x);
  const uid = str(x.uid, 64);
  if (!base || !uid) return null;
  return { ...base, uid };
}
function parseQueueTrack(x) {
  const rep = parseQueueTrackReplace(x);
  if (!rep || !isObj(x)) return null;
  const addedBy = parseProfile(x.addedBy);
  if (!addedBy) return null;
  return { ...rep, addedBy };
}
function parsePlaybackInput(x) {
  if (!isObj(x)) return null;
  const trackId = x.trackId === null ? null : str(x.trackId, 64);
  if (x.trackId !== null && trackId === null) return null;
  const queueUid = x.queueUid === null || x.queueUid === void 0 ? null : str(x.queueUid, 64);
  const posMs = fin(x.posMs, 0, 864e5);
  if (posMs === null || typeof x.playing !== "boolean") return null;
  const durationSec = typeof x.durationSec === "number" && Number.isFinite(x.durationSec) && x.durationSec >= 0 && x.durationSec <= 86400 ? x.durationSec : void 0;
  return { trackId, queueUid, posMs, playing: x.playing, ...durationSec !== void 0 ? { durationSec } : {} };
}
function parseControlAction(x) {
  if (!isObj(x) || typeof x.kind !== "string") return null;
  switch (x.kind) {
    case "play":
    case "pause":
    case "next":
    case "prev":
      return { kind: x.kind };
    case "seek": {
      const posMs = fin(x.posMs, 0, 864e5);
      return posMs === null ? null : { kind: "seek", posMs };
    }
    case "select": {
      const uid = str(x.uid, 64);
      return uid ? { kind: "select", uid } : null;
    }
    default:
      return null;
  }
}
function parseArray(x, max, fn) {
  if (!Array.isArray(x) || x.length > max) return null;
  const out = [];
  for (const item of x) {
    const parsed = fn(item);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}
function parseMetaUpdate(x) {
  if (!isObj(x)) return null;
  const trackId = str(x.trackId, 64);
  const title = str(x.title, 200);
  const artist = optStr(x.artist, 200) ?? "";
  if (!trackId || !title) return null;
  const album = optStr(x.album, 200);
  const coverUrl = safeCoverUrl(x.coverUrl) ?? void 0;
  const durationSec = typeof x.durationSec === "number" && Number.isFinite(x.durationSec) && x.durationSec >= 0 && x.durationSec <= 86400 ? x.durationSec : void 0;
  return { trackId, title, artist, ...album ? { album } : {}, ...coverUrl ? { coverUrl } : {}, ...durationSec !== void 0 ? { durationSec } : {} };
}
function decodeClient(raw) {
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(obj) || obj.v !== PROTOCOL_VERSION || typeof obj.t !== "string") return null;
  switch (obj.t) {
    case "ping": {
      const clientTs = fin(obj.clientTs, 0, 1e16);
      return clientTs === null ? null : { v: 2, t: "ping", clientTs };
    }
    case "room.create": {
      const profile = parseProfile(obj.profile);
      const queue = parseArray(obj.queue, MAX_QUEUE_TRACKS, parseQueueTrack);
      const currentIndex = int(obj.currentIndex, -1, MAX_QUEUE_TRACKS);
      if (!profile || !queue || currentIndex === null || typeof obj.allowGuestControl !== "boolean") return null;
      if (obj.allowGuestAdd !== void 0 && typeof obj.allowGuestAdd !== "boolean") return null;
      const playback = obj.playback === null ? null : parsePlaybackInput(obj.playback);
      if (obj.playback !== null && playback === null) return null;
      const hostToken = str(obj.hostToken, 128) ?? void 0;
      const code = typeof obj.code === "string" && isRoomCode(obj.code) ? normalizeCode(obj.code) : void 0;
      return {
        v: 2,
        t: "room.create",
        profile,
        allowGuestControl: obj.allowGuestControl,
        ...obj.allowGuestAdd !== void 0 ? { allowGuestAdd: obj.allowGuestAdd } : {},
        queue,
        currentIndex,
        playback,
        ...hostToken ? { hostToken } : {},
        ...code ? { code } : {}
      };
    }
    case "room.join": {
      const code = typeof obj.code === "string" && isRoomCode(obj.code) ? normalizeCode(obj.code) : null;
      const profile = parseProfile(obj.profile);
      if (!code || !profile || obj.audioMode !== "remote" && obj.audioMode !== "speaker") return null;
      const peerId = typeof obj.peerId === "string" && PEER_ID_RE.test(obj.peerId.trim()) ? obj.peerId.trim() : void 0;
      return { v: 2, t: "room.join", code, profile, audioMode: obj.audioMode, ...peerId ? { peerId } : {} };
    }
    case "room.leave":
    case "room.end":
    case "room.kickAll":
    case "standby.close":
      return { v: 2, t: obj.t };
    case "room.kick": {
      const targetCid = str(obj.targetCid, 64);
      return targetCid ? { v: 2, t: "room.kick", targetCid } : null;
    }
    case "room.permissions": {
      const allowGuestControl = typeof obj.allowGuestControl === "boolean" ? obj.allowGuestControl : void 0;
      const allowGuestAdd = typeof obj.allowGuestAdd === "boolean" ? obj.allowGuestAdd : void 0;
      if (allowGuestControl === void 0 && allowGuestAdd === void 0) return null;
      return {
        v: 2,
        t: "room.permissions",
        ...allowGuestControl !== void 0 ? { allowGuestControl } : {},
        ...allowGuestAdd !== void 0 ? { allowGuestAdd } : {}
      };
    }
    case "room.memberPermission": {
      const targetCid = str(obj.targetCid, 64);
      if (!targetCid || typeof obj.canAddTracks !== "boolean") return null;
      return { v: 2, t: "room.memberPermission", targetCid, canAddTracks: obj.canAddTracks };
    }
    case "room.mode":
      return obj.audioMode === "remote" || obj.audioMode === "speaker" ? { v: 2, t: "room.mode", audioMode: obj.audioMode } : null;
    case "playback.sync": {
      const playback = parsePlaybackInput(obj.playback);
      const currentIndex = int(obj.currentIndex, -1, MAX_QUEUE_TRACKS);
      return playback && currentIndex !== null ? { v: 2, t: "playback.sync", playback, currentIndex } : null;
    }
    case "playback.control": {
      const action = parseControlAction(obj.action);
      return action ? { v: 2, t: "playback.control", action } : null;
    }
    case "queue.add": {
      const tracks = parseArray(obj.tracks, 50, parseQueueInput);
      const insert = obj.insert === "next" || obj.insert === "last" ? obj.insert : int(obj.insert, 0, MAX_QUEUE_TRACKS);
      return tracks && tracks.length > 0 && insert !== null ? { v: 2, t: "queue.add", tracks, insert } : null;
    }
    case "queue.move": {
      const uid = str(obj.uid, 64);
      const toIndex = int(obj.toIndex, 0, MAX_QUEUE_TRACKS);
      return uid && toIndex !== null ? { v: 2, t: "queue.move", uid, toIndex } : null;
    }
    case "queue.remove": {
      const uid = str(obj.uid, 64);
      return uid ? { v: 2, t: "queue.remove", uid } : null;
    }
    case "queue.replace": {
      const queue = parseArray(obj.queue, MAX_QUEUE_TRACKS, parseQueueTrackReplace);
      const currentIndex = int(obj.currentIndex, -1, MAX_QUEUE_TRACKS);
      return queue && currentIndex !== null ? { v: 2, t: "queue.replace", queue, currentIndex } : null;
    }
    case "queue.meta": {
      const updates = parseArray(obj.updates, 50, parseMetaUpdate);
      return updates && updates.length > 0 ? { v: 2, t: "queue.meta", updates } : null;
    }
    case "standby.open": {
      const profile = parseProfile(obj.profile);
      const queue = parseArray(obj.queue, MAX_QUEUE_TRACKS, parseQueueInput);
      const currentIndex = int(obj.currentIndex, -1, MAX_QUEUE_TRACKS);
      if (!profile || !queue || currentIndex === null || typeof obj.allowGuestControl !== "boolean") return null;
      if (obj.allowGuestAdd !== void 0 && typeof obj.allowGuestAdd !== "boolean") return null;
      const playback = obj.playback === null ? null : parsePlaybackInput(obj.playback);
      if (obj.playback !== null && playback === null) return null;
      return {
        v: 2,
        t: "standby.open",
        profile,
        queue,
        currentIndex,
        playback,
        allowGuestControl: obj.allowGuestControl,
        ...obj.allowGuestAdd !== void 0 ? { allowGuestAdd: obj.allowGuestAdd } : {}
      };
    }
    case "standby.update": {
      const queue = obj.queue === void 0 ? void 0 : parseArray(obj.queue, MAX_QUEUE_TRACKS, parseQueueInput);
      if (queue === null) return null;
      const currentIndex = obj.currentIndex === void 0 ? void 0 : int(obj.currentIndex, -1, MAX_QUEUE_TRACKS);
      if (currentIndex === null) return null;
      const playback = obj.playback === void 0 ? void 0 : obj.playback === null ? null : parsePlaybackInput(obj.playback);
      if (obj.playback !== void 0 && obj.playback !== null && playback === null) return null;
      return {
        v: 2,
        t: "standby.update",
        ...queue !== void 0 ? { queue } : {},
        ...currentIndex !== void 0 ? { currentIndex } : {},
        ...playback !== void 0 ? { playback } : {}
      };
    }
    case "profile.update": {
      const profile = parseProfile(obj.profile);
      return profile ? { v: 2, t: "profile.update", profile } : null;
    }
    default:
      return null;
  }
}

// server/src/config.ts
function intEnv(name, fallback, min = 1) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}
function boolEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const norm = raw.trim().toLowerCase();
  if (norm === "0" || norm === "false" || norm === "no") return false;
  if (norm === "1" || norm === "true" || norm === "yes") return true;
  return fallback;
}
function loadConfig() {
  const publicUrl = (process.env.LUNAJAM_PUBLIC_URL ?? DEFAULT_SERVER_URL).trim().replace(/\/+$/, "") || DEFAULT_SERVER_URL;
  return {
    port: intEnv("LUNAJAM_PORT", 8642),
    host: (process.env.LUNAJAM_HOST ?? "0.0.0.0").trim() || "0.0.0.0",
    publicUrl,
    maxParticipants: intEnv("LUNAJAM_MAX_PARTICIPANTS", 32),
    hostGraceMs: intEnv("LUNAJAM_HOST_GRACE_MS", 2e4, 100),
    roomTtlMs: intEnv("LUNAJAM_ROOM_TTL_MS", 9e5, 1e3),
    rateLimitPerSec: intEnv("LUNAJAM_RATE_LIMIT", 60),
    maxConnections: intEnv("LUNAJAM_MAX_CONNECTIONS", 512),
    idleTimeoutMs: intEnv("LUNAJAM_IDLE_MS", 9e4, 1e3),
    maxRooms: intEnv("LUNAJAM_MAX_ROOMS", 256),
    roomsPerConn: intEnv("LUNAJAM_ROOMS_PER_CONN", 4, 1),
    maxConnsPerIp: intEnv("LUNAJAM_MAX_CONNS_PER_IP", 24, 1),
    trustProxy: boolEnv("LUNAJAM_TRUST_PROXY", true)
  };
}

// server/src/hub.ts
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { isIP } from "node:net";

// node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_extension = __toESM(require_extension(), 1);
var import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_subprotocol = __toESM(require_subprotocol(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);

// server/src/joinPage.ts
function escapeHtml(raw) {
  return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function safeJsonForScript(val) {
  return JSON.stringify(val).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
function renderJoinPage(summary, publicOrigin, nonce = "") {
  if (!summary) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LunaJam \u2014 Room not found</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0a0a0c;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif}
.panel{width:100%;max-width:420px;padding:24px;border-radius:12px;background:#141519;border:1px solid rgba(255,255,255,0.1)}
h1{margin:0 0 8px;font-size:18px;font-weight:600}
p{margin:0;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.64)}
</style>
</head>
<body>
<main class="panel">
<h1>Session ended or not found</h1>
<p>This Jam link is no longer active. Ask the host for a fresh link or room code.</p>
</main>
</body>
</html>`;
  }
  const formattedCode = isRoomCode(summary.code) ? formatCode(summary.code) : "Solo Jam";
  const hostTitle = `${summary.hostName}'s Jam`;
  const trackText = summary.track ? `${summary.track.title}${summary.track.artist ? ` \u2014 ${summary.track.artist}` : ""}` : "Waiting for track";
  const coverHtml = summary.track?.coverUrl ? `<img class="cover" src="${escapeHtml(summary.track.coverUrl)}" alt="" width="64" height="64" referrerpolicy="no-referrer" decoding="async">` : `<div class="cover cover-empty" aria-hidden="true"></div>`;
  const deepLink = `tidaluna://lunajam/join?code=${encodeURIComponent(summary.code)}&server=${encodeURIComponent(publicOrigin)}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(hostTitle)} \u2014 LunaJam</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0a0a0c;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif}
.panel{width:100%;max-width:440px;padding:24px;border-radius:12px;background:#141519;border:1px solid rgba(255,255,255,0.1)}
.head{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.cover{width:64px;height:64px;border-radius:6px;object-fit:cover;background:#1d1f26;flex-shrink:0}
.meta{min-width:0}
h1{margin:0 0 4px;font-size:18px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.track{margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.live{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-variant-numeric:tabular-nums;color:#2ee6d6}
.dot{width:8px;height:8px;border-radius:9999px;background:#2ee6d6}
.actions{display:flex;gap:8px;margin-bottom:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 16px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;cursor:pointer;border:1px solid transparent;font-family:inherit;transition:transform 140ms cubic-bezier(0.16,1,0.3,1),background-color 140ms ease}
.btn:active{transform:scale(0.97)}
.btn-primary{background:#ffffff;color:#0a0a0c;flex:1}
.btn-secondary{background:#1d1f26;color:#ffffff;border-color:rgba(255,255,255,0.12)}
.status{margin:0;font-size:12px;color:rgba(255,255,255,0.52);min-height:18px}
</style>
</head>
<body>
<main class="panel">
<div class="head">
${coverHtml}
<div class="meta">
<h1>${escapeHtml(hostTitle)}</h1>
<p class="track">${escapeHtml(trackText)}</p>
<div class="live"><span class="dot"></span><span>${summary.participantCount} of ${summary.maxParticipants} listening \xB7 ${escapeHtml(formattedCode)}</span></div>
</div>
</div>
<div class="actions">
<a class="btn btn-primary" id="open-btn" href="${escapeHtml(deepLink)}">Open in TIDAL</a>
<button class="btn btn-secondary" id="copy-btn" type="button">Copy code</button>
</div>
<p class="status" id="status-line">Connecting to TidaLuna on this device...</p>
</main>
<script${nonce ? ` nonce="${escapeHtml(nonce)}"` : ""}>
(function(){
  var code=${safeJsonForScript(summary.code)};
  var formatted=${safeJsonForScript(formattedCode)};
  var server=${safeJsonForScript(publicOrigin)};
  var deepLink=${safeJsonForScript(deepLink)};
  var statusEl=document.getElementById("status-line");
  var copyBtn=document.getElementById("copy-btn");
  copyBtn.addEventListener("click",function(){
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(formatted).then(function(){copyBtn.textContent="Copied";setTimeout(function(){copyBtn.textContent="Copy code"},1800)});
    }
  });
  var done=false;
  var ports=[];
  for(var p=24860;p<=24869;p++)ports.push(p);
  var fallbackTimer=setTimeout(function(){
    if(done)return;
    statusEl.textContent="Opening via tidaluna:// link. If TIDAL does not open, copy the code above.";
    window.location.href=deepLink;
  },700);
  ports.forEach(function(port){
    var url="http://127.0.0.1:"+port+"/lunajam-join?code="+encodeURIComponent(code)+"&server="+encodeURIComponent(server);
    fetch(url,{method:"POST",mode:"cors",headers:{"X-LunaJam-Join":"1"}}).then(function(r){
      if(!r.ok)throw new Error("bad status");
      return r.json();
    }).then(function(body){
      if(!done&&body&&body.ok){
        done=true;
        clearTimeout(fallbackTimer);
        statusEl.textContent="Joined Jam in TIDAL. You can close this tab.";
      }
    }).catch(function(){});
  });
})();
</script>
</body>
</html>`;
}

// server/src/hub.ts
var MAX_MESSAGE_BYTES = 262144;
var MAX_WIRE_BYTES = MAX_MESSAGE_BYTES + 16384;
var MAX_BUFFERED_BYTES = 2097152;
var HTTP_RATE_WINDOW_MS = 1e4;
var HTTP_RATE_LIMIT = 60;
var MAX_HTTP_RATE_ENTRIES = 4096;
var BOT_UA_RE = /Discordbot|TelegramBot|Slackbot|Twitterbot|WhatsApp|facebookexternalhit|LinkedInBot|Embedly|crawler|spider|preview/i;
var RFC1918_172_RE = /^172\.(1[6-9]|2\d|3[01])\./;
var COVER_IMG_SRC = ["https://resources.tidal.com", ...COVER_DOMAINS.map((d) => `https://${d} https://*.${d}`)].join(" ");
function buildJoinCsp(nonce) {
  const scriptSrc = nonce ? `'nonce-${nonce}'` : "'none'";
  return `default-src 'none'; img-src ${COVER_IMG_SRC}; style-src 'unsafe-inline'; script-src ${scriptSrc}; connect-src http://127.0.0.1:*; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
}
var BASE_SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer"
};
function isTrustedProxyRemote(addr) {
  return addr === "127.0.0.1" || addr === "::1" || addr.startsWith("10.") || addr.startsWith("192.168.") || RFC1918_172_RE.test(addr);
}
function parseCandidateIp(raw) {
  let s = raw.trim();
  if (!s) return null;
  if (s.startsWith("[")) {
    const end = s.indexOf("]");
    if (end > 1) s = s.slice(1, end);
  } else if (s.includes(".") && s.includes(":")) {
    s = s.slice(0, s.lastIndexOf(":"));
  }
  s = s.replace(/^::ffff:/, "");
  return isIP(s) !== 0 ? s : null;
}
function expandIpv6Words(ip) {
  const parts = ip.split("::");
  if (parts.length > 2) return null;
  const parseSide = (raw) => {
    if (!raw) return [];
    const tokens = raw.split(":");
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.includes(".")) {
        if (i !== tokens.length - 1 || isIP(tok) !== 4) return null;
        const octets = tok.split(".").map((o) => Number.parseInt(o, 10));
        if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
        out.push(octets[0] << 8 | octets[1], octets[2] << 8 | octets[3]);
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(tok)) return null;
        out.push(Number.parseInt(tok, 16));
      }
    }
    return out;
  };
  const left = parseSide(parts[0] ?? "");
  if (!left) return null;
  if (parts.length === 1) {
    return left.length === 8 ? left : null;
  }
  const right = parseSide(parts[1] ?? "");
  if (!right) return null;
  const missing = 8 - (left.length + right.length);
  if (missing < 1) return null;
  return [...left, ...Array(missing).fill(0), ...right];
}
function normalizeIpKey(rawIp) {
  const s = rawIp.trim().replace(/^::ffff:/, "");
  const ver = isIP(s);
  if (ver === 4) return s;
  if (ver === 6) {
    const words = expandIpv6Words(s);
    if (!words) return s.toLowerCase();
    if (words[0] === 0 && words[1] === 0 && words[2] === 0 && words[3] === 0 && words[4] === 0 && words[5] === 0 && words[6] === 0 && words[7] === 1) {
      return "::1";
    }
    return `${words.slice(0, 4).map((w) => w.toString(16).padStart(4, "0")).join(":")}::/64`;
  }
  return s;
}
function extractClientIp(req, trustProxy = true) {
  const cleanRemote = (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
  if (trustProxy && isTrustedProxyRemote(cleanRemote)) {
    const fwd = req.headers["x-forwarded-for"];
    const fwdRaw = Array.isArray(fwd) ? fwd[fwd.length - 1] : fwd;
    if (fwdRaw) {
      const parts = fwdRaw.split(",");
      for (let i = parts.length - 1; i >= 0; i--) {
        const seg = parts[i].trim();
        if (!seg) continue;
        const candidate = parseCandidateIp(seg);
        return normalizeIpKey(candidate ?? cleanRemote);
      }
    }
  }
  return normalizeIpKey(cleanRemote);
}
function safeDecodeSegment(raw) {
  if (!raw || raw.length > 96) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}
function rawByteLength(data) {
  if (typeof data === "string") return Buffer.byteLength(data);
  if (Buffer.isBuffer(data)) return data.length;
  if (Array.isArray(data)) return data.reduce((sum, buf) => sum + buf.length, 0);
  return data.byteLength;
}
var Hub = class {
  constructor(cfg) {
    this.cfg = cfg;
    this.server = createServer((req, res) => {
      try {
        this.onHttp(req, res);
      } catch {
        if (!res.headersSent) {
          res.writeHead(400, { ...BASE_SECURITY_HEADERS, "content-type": "text/plain" }).end("bad request");
        } else {
          res.destroy();
        }
      }
    });
    this.server.headersTimeout = 1e4;
    this.server.requestTimeout = 1e4;
    this.server.keepAliveTimeout = 5e3;
    this.server.on("upgrade", (req, socket, head) => {
      const ip = extractClientIp(req, this.cfg.trustProxy ?? true);
      if (this.conns.size >= this.cfg.maxConnections) {
        socket.write("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      if ((this.ipConnCount.get(ip) ?? 0) >= this.cfg.maxConnsPerIp) {
        socket.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => this.attach(ws, ip));
    });
    const idleMs = this.cfg.idleTimeoutMs;
    this.reaper = setInterval(
      () => {
        const now = Date.now();
        for (const c of [...this.conns.values()]) {
          if (now - c.lastSeen > idleMs) c.ws.terminate();
        }
        for (const [ip, entry2] of this.httpRate) {
          if (now - entry2.windowStart >= HTTP_RATE_WINDOW_MS) this.httpRate.delete(ip);
        }
      },
      Math.max(50, Math.min(2e3, Math.floor(idleMs / 3)))
    );
    this.reaper.unref();
  }
  cfg;
  conns = /* @__PURE__ */ new Map();
  ipConnCount = /* @__PURE__ */ new Map();
  httpRate = /* @__PURE__ */ new Map();
  reaper;
  server;
  wss = new import_websocket_server.default({ noServer: true, maxPayload: MAX_WIRE_BYTES });
  handler;
  setHandler(handler) {
    this.handler = handler;
  }
  now() {
    return performance.now();
  }
  peerIp(cid) {
    return this.conns.get(cid)?.ip;
  }
  getHttpRateSize() {
    return this.httpRate.size;
  }
  send(cid, msg) {
    const conn = this.conns.get(cid);
    if (!conn || conn.ws.readyState !== import_websocket.default.OPEN) return;
    if (conn.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
      conn.ws.terminate();
      return;
    }
    conn.ws.send(encode(msg));
  }
  broadcast(cids, msg) {
    const wire = encode(msg);
    for (const cid of cids) {
      const conn = this.conns.get(cid);
      if (!conn || conn.ws.readyState !== import_websocket.default.OPEN) continue;
      if (conn.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        conn.ws.terminate();
        continue;
      }
      conn.ws.send(wire);
    }
  }
  listen() {
    return new Promise((resolve) => {
      this.server.listen(this.cfg.port, this.cfg.host, () => {
        const addr = this.server.address();
        resolve(typeof addr === "object" && addr !== null ? addr.port : this.cfg.port);
      });
    });
  }
  async close() {
    clearInterval(this.reaper);
    for (const conn of this.conns.values()) conn.ws.terminate();
    this.conns.clear();
    this.ipConnCount.clear();
    this.httpRate.clear();
    this.wss.close();
    await new Promise((resolve) => {
      this.server.close(() => resolve());
      this.server.closeIdleConnections();
      setTimeout(() => this.server.closeAllConnections(), 500).unref();
    });
  }
  allowHttp(ip) {
    const now = Date.now();
    let entry2 = this.httpRate.get(ip);
    if (entry2 && now - entry2.windowStart >= HTTP_RATE_WINDOW_MS) {
      this.httpRate.delete(ip);
      entry2 = void 0;
    }
    if (!entry2) {
      if (this.httpRate.size >= MAX_HTTP_RATE_ENTRIES) {
        for (const [k, existing] of this.httpRate) {
          if (now - existing.windowStart >= HTTP_RATE_WINDOW_MS) {
            this.httpRate.delete(k);
          }
        }
        while (this.httpRate.size >= MAX_HTTP_RATE_ENTRIES) {
          const oldest = this.httpRate.keys().next().value;
          if (oldest === void 0) break;
          this.httpRate.delete(oldest);
        }
      }
      entry2 = { windowStart: now, count: 0 };
      this.httpRate.set(ip, entry2);
    }
    entry2.count += 1;
    return entry2.count <= HTTP_RATE_LIMIT;
  }
  onHttp(req, res) {
    const method = req.method ?? "GET";
    const urlPath = (req.url ?? "/").split("?")[0] ?? "/";
    if (method === "OPTIONS") {
      res.writeHead(204, {
        ...BASE_SECURITY_HEADERS,
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "*"
      });
      res.end();
      return;
    }
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, {
        ...BASE_SECURITY_HEADERS,
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
        "content-type": "text/plain"
      }).end("method not allowed");
      return;
    }
    if (urlPath === "/healthz") {
      res.writeHead(200, { ...BASE_SECURITY_HEADERS, "content-type": "text/plain" }).end("ok");
      return;
    }
    if (urlPath === "/") {
      res.writeHead(200, {
        ...BASE_SECURITY_HEADERS,
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
        "content-type": "text/html; charset=utf-8"
      }).end('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>LunaJam</title></head><body><h1>LunaJam relay</h1></body></html>');
      return;
    }
    if (urlPath.startsWith("/api/resolve/")) {
      const ip = extractClientIp(req, this.cfg.trustProxy ?? true);
      const jsonHeaders = {
        ...BASE_SECURITY_HEADERS,
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "no-store"
      };
      if (!this.allowHttp(ip)) {
        res.writeHead(429, { ...jsonHeaders, "retry-after": "10" }).end(JSON.stringify({ error: "rate_limited" }));
        return;
      }
      const token = safeDecodeSegment(urlPath.slice("/api/resolve/".length));
      if (!token) {
        res.writeHead(400, jsonHeaders).end(JSON.stringify({ error: "bad_request" }));
        return;
      }
      const summary = this.handler?.resolveToken(token) ?? null;
      if (!summary) {
        res.writeHead(404, jsonHeaders).end(JSON.stringify({ error: "not_found" }));
        return;
      }
      res.writeHead(200, jsonHeaders).end(JSON.stringify(summary));
      return;
    }
    if (urlPath.startsWith("/join/")) {
      const ip = extractClientIp(req, this.cfg.trustProxy ?? true);
      if (!this.allowHttp(ip)) {
        res.writeHead(429, { ...BASE_SECURITY_HEADERS, "content-type": "text/plain", "retry-after": "10" }).end("too many requests");
        return;
      }
      const token = safeDecodeSegment(urlPath.slice("/join/".length));
      if (!token) {
        res.writeHead(400, {
          ...BASE_SECURITY_HEADERS,
          "content-security-policy": buildJoinCsp(),
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        }).end(renderJoinPage(null, this.cfg.publicUrl));
        return;
      }
      const ua = String(req.headers["user-agent"] ?? "");
      const isPreview = method === "HEAD" || BOT_UA_RE.test(ua);
      const summary = isPreview ? this.handler?.peekToken(token) ?? null : this.handler?.resolveToken(token) ?? null;
      const nonce = summary ? randomBytes(16).toString("base64") : void 0;
      const htmlHeaders = {
        ...BASE_SECURITY_HEADERS,
        "content-security-policy": buildJoinCsp(nonce),
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      };
      res.writeHead(summary ? 200 : 404, htmlHeaders).end(method === "HEAD" ? void 0 : renderJoinPage(summary, this.cfg.publicUrl, nonce));
      return;
    }
    res.writeHead(404, {
      ...BASE_SECURITY_HEADERS,
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "content-type": "text/plain"
    }).end("not found");
  }
  attach(ws, ip) {
    const cid = randomUUID();
    const conn = { cid, ws, ip, windowStart: Date.now(), count: 0, lastSeen: Date.now() };
    this.conns.set(cid, conn);
    this.ipConnCount.set(ip, (this.ipConnCount.get(ip) ?? 0) + 1);
    ws.on("message", (data) => {
      conn.lastSeen = Date.now();
      if (rawByteLength(data) > MAX_MESSAGE_BYTES) {
        this.send(cid, { v: 2, t: "error", code: "message_too_large", message: "Payload limit exceeded" });
        ws.close(1009);
        return;
      }
      if (!this.tickRate(conn)) return;
      try {
        const raw = typeof data === "string" ? data : data.toString("utf8");
        const msg = decodeClient(raw);
        if (!msg) return;
        this.handler?.onMessage(cid, msg);
      } catch {
        return;
      }
    });
    ws.on("close", () => {
      this.conns.delete(cid);
      const prev = this.ipConnCount.get(ip) ?? 0;
      if (prev <= 1) this.ipConnCount.delete(ip);
      else this.ipConnCount.set(ip, prev - 1);
      this.handler?.onDisconnect(cid);
    });
    ws.on("error", () => ws.terminate());
    this.send(cid, { v: 2, t: "welcome", cid, serverTs: this.now() });
  }
  tickRate(conn) {
    const now = Date.now();
    if (now - conn.windowStart >= 1e3) {
      conn.windowStart = now;
      conn.count = 0;
    }
    conn.count += 1;
    if (conn.count > this.cfg.rateLimitPerSec) {
      this.send(conn.cid, { v: 2, t: "error", code: "rate_limited", message: "Too many requests" });
      return false;
    }
    return true;
  }
};

// server/src/rooms.ts
import { createHash, randomBytes as randomBytes2, randomUUID as randomUUID2, timingSafeEqual } from "node:crypto";
function generateRoomCode(existing) {
  for (let attempt = 0; attempt < 32; attempt++) {
    const bytes = randomBytes2(8);
    let out = "";
    for (let i = 0; i < 8; i++) out += CROCKFORD_ALPHABET[bytes[i] % CROCKFORD_ALPHABET.length];
    if (!existing.has(out)) return out;
  }
  return randomBytes2(4).toString("hex").toUpperCase();
}
function generateStandbyId() {
  return `s_${randomBytes2(9).toString("base64url")}`;
}
function makeUid() {
  return randomUUID2().replace(/-/g, "").slice(0, 12);
}
function withServerTs(playback, now) {
  if (!playback) return null;
  return { ...playback, serverTs: now };
}
function hashPeerId(peerId) {
  if (!peerId) return void 0;
  return createHash("sha256").update(peerId).digest("hex").slice(0, 24);
}
function safeTokenEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
function toProfile(p, cid = p.cid) {
  return {
    cid,
    name: p.name,
    avatarUrl: p.avatarUrl,
    ...p.tidalUserId ? { tidalUserId: p.tidalUserId } : {},
    ...p.profilePath ? { profilePath: p.profilePath } : {}
  };
}
function toRoomSnapshot(room, includeToken = false) {
  return {
    code: room.code,
    hostCid: room.hostCid,
    ...includeToken ? { hostToken: room.hostToken } : {},
    allowGuestControl: room.allowGuestControl,
    allowGuestAdd: room.allowGuestAdd,
    participants: [...room.participants.values()],
    queue: room.queue,
    currentIndex: room.currentIndex,
    playback: room.playback
  };
}
var Rooms = class {
  constructor(hub, cfg) {
    this.hub = hub;
    this.cfg = cfg;
    this.sweeper = setInterval(() => this.sweep(), Math.max(500, Math.min(3e4, Math.floor(cfg.roomTtlMs / 4))));
    this.sweeper.unref();
  }
  hub;
  cfg;
  rooms = /* @__PURE__ */ new Map();
  connRoom = /* @__PURE__ */ new Map();
  standbys = /* @__PURE__ */ new Map();
  connStandby = /* @__PURE__ */ new Map();
  promoted = /* @__PURE__ */ new Map();
  roomCreates = /* @__PURE__ */ new Map();
  sweeper;
  stop() {
    clearInterval(this.sweeper);
    for (const room of this.rooms.values()) {
      if (room.graceTimer) clearTimeout(room.graceTimer);
    }
    this.rooms.clear();
    this.connRoom.clear();
    this.standbys.clear();
    this.connStandby.clear();
    this.promoted.clear();
    this.roomCreates.clear();
  }
  onMessage(cid, msg) {
    switch (msg.t) {
      case "ping":
        this.hub.send(cid, { v: 2, t: "pong", clientTs: msg.clientTs, serverTs: this.hub.now() });
        return;
      case "room.create":
        this.handleCreate(cid, msg);
        return;
      case "room.join":
        this.handleJoin(cid, msg);
        return;
      case "room.leave":
        this.leaveRoom(cid);
        return;
      case "room.end":
        this.handleEnd(cid);
        return;
      case "room.kick":
        this.handleKick(cid, msg.targetCid);
        return;
      case "room.kickAll":
        this.handleKickAll(cid);
        return;
      case "room.permissions":
        this.handlePermissions(cid, msg.allowGuestControl, msg.allowGuestAdd);
        return;
      case "room.memberPermission":
        this.handleMemberPermission(cid, msg.targetCid, msg.canAddTracks);
        return;
      case "room.mode":
        this.handleMode(cid, msg.audioMode);
        return;
      case "playback.sync":
        this.handlePlaybackSync(cid, msg.playback, msg.currentIndex);
        return;
      case "playback.control":
        this.handlePlaybackControl(cid, msg.action);
        return;
      case "queue.add":
        this.handleQueueAdd(cid, msg.tracks, msg.insert);
        return;
      case "queue.move":
        this.handleQueueMove(cid, msg.uid, msg.toIndex);
        return;
      case "queue.remove":
        this.handleQueueRemove(cid, msg.uid);
        return;
      case "queue.replace":
        this.handleQueueReplace(cid, msg.queue, msg.currentIndex);
        return;
      case "queue.meta":
        this.handleQueueMeta(cid, msg.updates);
        return;
      case "standby.open":
        this.handleStandbyOpen(cid, msg);
        return;
      case "standby.update":
        this.handleStandbyUpdate(cid, msg);
        return;
      case "standby.close":
        this.closeStandby(cid);
        return;
      case "profile.update":
        this.handleProfileUpdate(cid, msg.profile);
        return;
    }
  }
  onDisconnect(cid) {
    this.closeStandby(cid);
    this.roomCreates.delete(cid);
    const code = this.connRoom.get(cid);
    if (!code) return;
    this.connRoom.delete(cid);
    const room = this.rooms.get(code);
    if (!room) return;
    if (cid === room.hostCid) {
      if (room.graceTimer) clearTimeout(room.graceTimer);
      room.graceTimer = setTimeout(() => {
        room.graceTimer = null;
        if (this.rooms.has(room.code)) this.destroyRoom(room.code, "host_timeout");
      }, this.cfg.hostGraceMs);
      room.graceTimer.unref();
      return;
    }
    if (room.participants.delete(cid)) {
      room.peerMeta.delete(cid);
      room.lastActivity = Date.now();
      this.broadcastState(room);
    }
  }
  resolveOrPromote(rawToken) {
    const token = rawToken.trim();
    if (isRoomCode(token)) {
      const room = this.rooms.get(normalizeCode(token));
      return room ? this.summarizeRoom(token, room) : null;
    }
    if (isStandbyToken(token)) {
      const cached = this.promoted.get(token);
      if (cached && cached.expiresAt > Date.now()) {
        const room2 = this.rooms.get(cached.code);
        if (room2) return this.summarizeRoom(token, room2);
      }
      const standby = this.standbys.get(token);
      if (!standby) return null;
      const room = this.promoteStandby(standby);
      if (!room) return null;
      this.promoted.set(token, { code: room.code, expiresAt: Date.now() + 6e4 });
      return this.summarizeRoom(token, room);
    }
    return null;
  }
  peekToken(rawToken) {
    const token = rawToken.trim();
    if (isRoomCode(token)) {
      const room = this.rooms.get(normalizeCode(token));
      return room ? this.summarizeRoom(token, room) : null;
    }
    if (isStandbyToken(token)) {
      const cached = this.promoted.get(token);
      if (cached && cached.expiresAt > Date.now()) {
        const room = this.rooms.get(cached.code);
        if (room) return this.summarizeRoom(token, room);
      }
      const standby = this.standbys.get(token);
      if (!standby) return null;
      const active = standby.currentIndex >= 0 && standby.currentIndex < standby.queue.length ? standby.queue[standby.currentIndex] : null;
      return {
        token,
        code: standby.id,
        hostName: standby.profile.name,
        participantCount: 1,
        maxParticipants: this.cfg.maxParticipants,
        track: active ? { title: active.title || "Untitled", artist: active.artist || "", ...active.coverUrl ? { coverUrl: active.coverUrl } : {} } : null
      };
    }
    return null;
  }
  getRoomCount() {
    return this.rooms.size;
  }
  summarizeRoom(token, room) {
    const host = room.participants.get(room.hostCid);
    const active = room.currentIndex >= 0 && room.currentIndex < room.queue.length ? room.queue[room.currentIndex] : null;
    return {
      token,
      code: room.code,
      hostName: host?.name ?? "Host",
      participantCount: room.participants.size,
      maxParticipants: this.cfg.maxParticipants,
      track: active ? { title: active.title || "Untitled", artist: active.artist || "", ...active.coverUrl ? { coverUrl: active.coverUrl } : {} } : null
    };
  }
  promoteStandby(standby) {
    if (this.rooms.size >= this.cfg.maxRooms) return null;
    this.standbys.delete(standby.id);
    this.connStandby.delete(standby.cid);
    this.leaveRoom(standby.cid);
    const code = generateRoomCode(this.rooms);
    const hostToken = randomUUID2();
    const profile = { ...standby.profile, cid: standby.cid };
    const queue = standby.queue.slice(0, MAX_QUEUE_TRACKS).map((t) => ({
      ...t,
      uid: makeUid(),
      addedBy: profile
    }));
    const currentIndex = queue.length === 0 ? -1 : Math.max(-1, Math.min(queue.length - 1, standby.currentIndex));
    const activeTrack = currentIndex >= 0 ? queue[currentIndex] : void 0;
    const playback = standby.playback ? { ...standby.playback, queueUid: activeTrack?.uid ?? standby.playback.queueUid, serverTs: this.hub.now() } : null;
    const participants = /* @__PURE__ */ new Map();
    participants.set(standby.cid, { ...profile, role: "host", audioMode: "remote", canAddTracks: true });
    const peerMeta = /* @__PURE__ */ new Map();
    const ip = this.hub.peerIp?.(standby.cid);
    if (ip) peerMeta.set(standby.cid, { ip });
    const room = {
      code,
      hostCid: standby.cid,
      hostToken,
      allowGuestControl: standby.allowGuestControl,
      allowGuestAdd: standby.allowGuestAdd,
      participants,
      peerMeta,
      bannedPeerHashes: /* @__PURE__ */ new Set(),
      bannedTidalUserIds: /* @__PURE__ */ new Set(),
      bannedIps: /* @__PURE__ */ new Set(),
      queue,
      currentIndex,
      playback,
      lastActivity: Date.now(),
      graceTimer: null
    };
    this.rooms.set(code, room);
    this.connRoom.set(standby.cid, code);
    this.hub.send(standby.cid, {
      v: 2,
      t: "standby.promoted",
      hostToken,
      state: toRoomSnapshot(room, true)
    });
    return room;
  }
  handleCreate(cid, msg) {
    this.closeStandby(cid);
    if (msg.code && msg.hostToken) {
      const existing = this.rooms.get(msg.code);
      if (existing && safeTokenEqual(existing.hostToken, msg.hostToken)) {
        if (existing.graceTimer) {
          clearTimeout(existing.graceTimer);
          existing.graceTimer = null;
        }
        const prevHostCid = existing.hostCid;
        existing.participants.delete(prevHostCid);
        existing.peerMeta.delete(prevHostCid);
        existing.hostCid = cid;
        const hostProfile = toProfile(msg.profile, cid);
        existing.participants.set(cid, { ...hostProfile, role: "host", audioMode: "remote", canAddTracks: true });
        const hostIp = this.hub.peerIp?.(cid);
        if (hostIp) existing.peerMeta.set(cid, { ip: hostIp });
        for (const item of existing.queue) {
          if (item.addedBy.cid === prevHostCid) item.addedBy = hostProfile;
        }
        this.connRoom.set(cid, existing.code);
        existing.lastActivity = Date.now();
        this.hub.send(cid, {
          v: 2,
          t: "room.joined",
          role: "host",
          hostToken: existing.hostToken,
          state: toRoomSnapshot(existing, true)
        });
        this.broadcastState(existing);
        return;
      }
    }
    const now = Date.now();
    let createEntry = this.roomCreates.get(cid);
    if (!createEntry || now - createEntry.windowStart >= 6e4) {
      createEntry = { windowStart: now, count: 0 };
      this.roomCreates.set(cid, createEntry);
    }
    createEntry.count += 1;
    if (createEntry.count > Math.max(2, this.cfg.roomsPerConn)) {
      this.hub.send(cid, { v: 2, t: "error", code: "room_rate_limit", message: "Creating rooms too quickly" });
      return;
    }
    if (this.rooms.size >= this.cfg.maxRooms) {
      this.hub.send(cid, { v: 2, t: "error", code: "room_limit", message: "Server room limit reached" });
      return;
    }
    this.leaveRoom(cid);
    const code = generateRoomCode(this.rooms);
    const hostToken = randomUUID2();
    const profile = toProfile(msg.profile, cid);
    const participants = /* @__PURE__ */ new Map();
    participants.set(cid, { ...profile, role: "host", audioMode: "remote", canAddTracks: true });
    const peerMeta = /* @__PURE__ */ new Map();
    const ip = this.hub.peerIp?.(cid);
    if (ip) peerMeta.set(cid, { ip });
    const queue = msg.queue.slice(0, MAX_QUEUE_TRACKS).map((t) => ({
      ...t,
      uid: t.uid || makeUid(),
      addedBy: profile
    }));
    const currentIndex = queue.length === 0 ? -1 : Math.max(-1, Math.min(queue.length - 1, msg.currentIndex));
    const allowGuestAdd = msg.allowGuestAdd ?? true;
    const room = {
      code,
      hostCid: cid,
      hostToken,
      allowGuestControl: msg.allowGuestControl,
      allowGuestAdd,
      participants,
      peerMeta,
      bannedPeerHashes: /* @__PURE__ */ new Set(),
      bannedTidalUserIds: /* @__PURE__ */ new Set(),
      bannedIps: /* @__PURE__ */ new Set(),
      queue,
      currentIndex,
      playback: withServerTs(msg.playback, this.hub.now()),
      lastActivity: Date.now(),
      graceTimer: null
    };
    this.rooms.set(code, room);
    this.connRoom.set(cid, code);
    this.hub.send(cid, {
      v: 2,
      t: "room.joined",
      role: "host",
      hostToken,
      state: toRoomSnapshot(room, true)
    });
  }
  handleJoin(cid, msg) {
    this.closeStandby(cid);
    const room = this.rooms.get(msg.code);
    if (!room) {
      this.hub.send(cid, { v: 2, t: "error", code: "room_not_found", message: "Jam session not found" });
      return;
    }
    if (this.connRoom.get(cid) === room.code && room.participants.has(cid)) {
      this.hub.send(cid, { v: 2, t: "room.joined", role: cid === room.hostCid ? "host" : "guest", state: toRoomSnapshot(room) });
      return;
    }
    const peerHash = hashPeerId(msg.peerId);
    const ip = this.hub.peerIp?.(cid);
    const tidalUserId = msg.profile.tidalUserId;
    if (peerHash && room.bannedPeerHashes.has(peerHash) || tidalUserId && room.bannedTidalUserIds.has(tidalUserId) || ip && room.bannedIps.has(ip)) {
      this.hub.send(cid, {
        v: 2,
        t: "error",
        code: "room_banned",
        message: "You are banned from this Jam until a new room is created"
      });
      return;
    }
    if (room.participants.size >= this.cfg.maxParticipants) {
      this.hub.send(cid, { v: 2, t: "error", code: "room_full", message: "Jam session is full" });
      return;
    }
    this.leaveRoom(cid);
    const participant = {
      ...toProfile(msg.profile, cid),
      role: "guest",
      audioMode: msg.audioMode,
      canAddTracks: room.allowGuestAdd
    };
    room.participants.set(cid, participant);
    room.peerMeta.set(cid, { ...peerHash ? { peerHash } : {}, ...ip ? { ip } : {} });
    room.lastActivity = Date.now();
    this.connRoom.set(cid, room.code);
    this.hub.send(cid, { v: 2, t: "room.joined", role: "guest", state: toRoomSnapshot(room) });
    this.broadcastState(room, cid);
  }
  leaveRoom(cid) {
    const code = this.connRoom.get(cid);
    if (!code) return;
    this.connRoom.delete(cid);
    const room = this.rooms.get(code);
    if (!room) return;
    if (cid === room.hostCid) {
      this.destroyRoom(code, "host_ended");
      return;
    }
    if (room.participants.delete(cid)) {
      room.peerMeta.delete(cid);
      room.lastActivity = Date.now();
      this.broadcastState(room);
    }
  }
  handleEnd(cid) {
    const room = this.hostRoom(cid);
    if (!room) return;
    this.destroyRoom(room.code, "host_ended");
  }
  banFromRoom(room, targetCid, target) {
    const meta = room.peerMeta.get(targetCid);
    room.participants.delete(targetCid);
    room.peerMeta.delete(targetCid);
    this.connRoom.delete(targetCid);
    if (meta?.peerHash) room.bannedPeerHashes.add(meta.peerHash);
    if (target.tidalUserId) room.bannedTidalUserIds.add(target.tidalUserId);
    if (meta?.ip) {
      const sharedIp = [...room.peerMeta.values()].some((m) => m.ip === meta.ip);
      if (!sharedIp) room.bannedIps.add(meta.ip);
    }
    const isBannedTrack = (t) => t.addedBy.cid === targetCid || Boolean(target.tidalUserId && t.addedBy.tidalUserId === target.tidalUserId);
    const prevQueue = room.queue;
    const prevIdx = room.currentIndex;
    const nextQueue = prevQueue.filter((t) => !isBannedTrack(t));
    if (nextQueue.length !== prevQueue.length) {
      if (nextQueue.length === 0) {
        room.queue = [];
        room.currentIndex = -1;
        room.playback = null;
      } else {
        const prevActive = prevIdx >= 0 ? prevQueue[prevIdx] : void 0;
        if (prevActive && !isBannedTrack(prevActive)) {
          room.queue = nextQueue;
          room.currentIndex = nextQueue.findIndex((t) => t.uid === prevActive.uid);
        } else if (prevIdx < 0) {
          room.queue = nextQueue;
          room.currentIndex = -1;
        } else {
          const survivingBefore = prevQueue.slice(0, prevIdx).filter((t) => !isBannedTrack(t)).length;
          const nextIdx = Math.min(survivingBefore, nextQueue.length - 1);
          const nextTrack = nextQueue[nextIdx];
          room.queue = nextQueue;
          room.currentIndex = nextIdx;
          if (room.playback) {
            room.playback = {
              trackId: nextTrack.trackId,
              queueUid: nextTrack.uid,
              posMs: 0,
              serverTs: this.hub.now(),
              playing: room.playback.playing,
              ...nextTrack.durationSec !== void 0 ? { durationSec: nextTrack.durationSec } : {}
            };
          }
        }
      }
    }
  }
  handleKick(cid, targetCid) {
    const room = this.hostRoom(cid);
    if (!room || targetCid === room.hostCid) return;
    const target = room.participants.get(targetCid);
    if (!target) return;
    this.banFromRoom(room, targetCid, target);
    room.lastActivity = Date.now();
    this.hub.send(targetCid, { v: 2, t: "room.ended", reason: "banned" });
    this.broadcastState(room);
  }
  handleKickAll(cid) {
    const room = this.hostRoom(cid);
    if (!room) return;
    const removed = [];
    for (const [pid, p] of [...room.participants.entries()]) {
      if (p.role === "guest") {
        this.banFromRoom(room, pid, p);
        removed.push(pid);
      }
    }
    if (removed.length === 0) return;
    room.lastActivity = Date.now();
    this.hub.broadcast(removed, { v: 2, t: "room.ended", reason: "banned" });
    this.broadcastState(room);
  }
  handlePermissions(cid, allowGuestControl, allowGuestAdd) {
    const room = this.hostRoom(cid);
    if (!room) return;
    let changed = false;
    if (allowGuestControl !== void 0 && room.allowGuestControl !== allowGuestControl) {
      room.allowGuestControl = allowGuestControl;
      changed = true;
    }
    if (allowGuestAdd !== void 0 && room.allowGuestAdd !== allowGuestAdd) {
      room.allowGuestAdd = allowGuestAdd;
      for (const p of room.participants.values()) {
        if (p.role === "guest") p.canAddTracks = allowGuestAdd;
      }
      changed = true;
    }
    if (!changed) return;
    room.lastActivity = Date.now();
    this.broadcastState(room);
  }
  handleMemberPermission(cid, targetCid, canAddTracks) {
    const room = this.hostRoom(cid);
    if (!room || targetCid === room.hostCid) return;
    const target = room.participants.get(targetCid);
    if (!target || target.role !== "guest" || target.canAddTracks === canAddTracks) return;
    target.canAddTracks = canAddTracks;
    room.lastActivity = Date.now();
    this.broadcastState(room);
  }
  handleMode(cid, audioMode) {
    const room = this.memberRoom(cid);
    if (!room) return;
    const p = room.participants.get(cid);
    if (!p || p.audioMode === audioMode) return;
    p.audioMode = audioMode;
    room.lastActivity = Date.now();
    this.broadcastState(room);
  }
  handlePlaybackSync(cid, playback, currentIndex) {
    const room = this.hostRoom(cid);
    if (!room) return;
    room.playback = withServerTs(playback, this.hub.now());
    if (room.queue.length > 0 && currentIndex >= -1 && currentIndex < room.queue.length) {
      room.currentIndex = currentIndex;
    }
    room.lastActivity = Date.now();
    if (room.participants.size <= 1 || !room.playback) return;
    const recipients = [...room.participants.keys()].filter((pid) => pid !== cid);
    if (recipients.length > 0) {
      this.hub.broadcast(recipients, {
        v: 2,
        t: "playback.tick",
        playback: room.playback,
        currentIndex: room.currentIndex
      });
    }
  }
  handlePlaybackControl(cid, action) {
    const room = this.memberRoom(cid);
    if (!room) return;
    const isHost = cid === room.hostCid;
    if (!isHost && !room.allowGuestControl) {
      this.hub.send(cid, { v: 2, t: "error", code: "forbidden", message: "Host restricted playback controls" });
      return;
    }
    const sender = room.participants.get(cid);
    if (!sender) return;
    room.lastActivity = Date.now();
    if (!isHost) {
      this.hub.send(room.hostCid, { v: 2, t: "playback.command", from: sender, action });
    }
  }
  handleQueueAdd(cid, tracks, insert) {
    const room = this.memberRoom(cid);
    if (!room) return;
    const sender = room.participants.get(cid);
    if (!sender) return;
    if (sender.role !== "host" && !sender.canAddTracks) {
      this.hub.send(cid, { v: 2, t: "error", code: "add_forbidden", message: "Host disabled adding tracks for you" });
      return;
    }
    if (room.queue.length >= MAX_QUEUE_TRACKS) {
      this.hub.send(cid, { v: 2, t: "error", code: "queue_full", message: "Queue limit reached" });
      return;
    }
    const available = MAX_QUEUE_TRACKS - room.queue.length;
    const senderProfile = toProfile(sender);
    const additions = tracks.slice(0, available).map((t) => ({
      ...t,
      uid: makeUid(),
      addedBy: senderProfile
    }));
    let idx;
    if (insert === "next") {
      idx = room.currentIndex >= 0 ? Math.min(room.queue.length, room.currentIndex + 1) : 0;
    } else if (insert === "last") {
      idx = room.queue.length;
    } else {
      idx = Math.max(0, Math.min(room.queue.length, insert));
    }
    room.queue.splice(idx, 0, ...additions);
    if (room.currentIndex >= idx) {
      room.currentIndex += additions.length;
    } else if (room.currentIndex === -1 && room.queue.length > 0) {
      room.currentIndex = 0;
    }
    room.lastActivity = Date.now();
    this.broadcastState(room);
  }
  handleQueueMove(cid, uid, toIndex) {
    const room = this.memberRoom(cid);
    if (!room) return;
    if (cid !== room.hostCid && !room.allowGuestControl) {
      this.hub.send(cid, { v: 2, t: "error", code: "forbidden", message: "Host restricted queue reordering" });
      return;
    }
    const fromIndex = room.queue.findIndex((t) => t.uid === uid);
    if (fromIndex === -1) return;
    const clampedTo = Math.max(0, Math.min(room.queue.length - 1, toIndex));
    if (fromIndex === clampedTo) return;
    const activeUid = room.currentIndex >= 0 ? room.queue[room.currentIndex]?.uid : void 0;
    const [moved] = room.queue.splice(fromIndex, 1);
    if (!moved) return;
    room.queue.splice(clampedTo, 0, moved);
    if (activeUid) {
      room.currentIndex = room.queue.findIndex((t) => t.uid === activeUid);
    }
    room.lastActivity = Date.now();
    this.broadcastState(room);
  }
  handleQueueRemove(cid, uid) {
    const room = this.memberRoom(cid);
    if (!room) return;
    const idx = room.queue.findIndex((t) => t.uid === uid);
    if (idx === -1) return;
    const target = room.queue[idx];
    const canRemove = cid === room.hostCid || room.allowGuestControl || target.addedBy.cid === cid;
    if (!canRemove) {
      this.hub.send(cid, { v: 2, t: "error", code: "forbidden", message: "Cannot remove track added by another listener" });
      return;
    }
    room.queue.splice(idx, 1);
    if (room.queue.length === 0) {
      room.currentIndex = -1;
    } else if (idx < room.currentIndex) {
      room.currentIndex -= 1;
    } else if (idx === room.currentIndex && room.currentIndex >= room.queue.length) {
      room.currentIndex = room.queue.length - 1;
    }
    room.lastActivity = Date.now();
    this.broadcastState(room);
  }
  handleQueueReplace(cid, nextQueue, currentIndex) {
    const room = this.hostRoom(cid);
    if (!room) return;
    const host = room.participants.get(cid);
    if (!host) return;
    const hostProfile = toProfile(host);
    const existingByUid = new Map(room.queue.map((t) => [t.uid, t.addedBy]));
    room.queue = nextQueue.slice(0, MAX_QUEUE_TRACKS).map((t) => ({
      ...t,
      addedBy: existingByUid.get(t.uid) ?? hostProfile
    }));
    room.currentIndex = room.queue.length === 0 ? -1 : Math.max(-1, Math.min(room.queue.length - 1, currentIndex));
    room.lastActivity = Date.now();
    this.broadcastState(room);
  }
  handleQueueMeta(cid, updates) {
    const room = this.memberRoom(cid);
    if (!room) return;
    const sender = room.participants.get(cid);
    if (!sender) return;
    const restrictOwn = sender.role !== "host" && !sender.canAddTracks;
    const byId = new Map(updates.map((u) => [u.trackId, u]));
    let changed = false;
    for (const item of room.queue) {
      if (restrictOwn && item.addedBy.cid !== cid) continue;
      const u = byId.get(item.trackId);
      if (!u) continue;
      if (!item.title && u.title) {
        item.title = u.title;
        changed = true;
      }
      if (!item.artist && u.artist) {
        item.artist = u.artist;
        changed = true;
      }
      if (!item.album && u.album) {
        item.album = u.album;
        changed = true;
      }
      if (!item.coverUrl && u.coverUrl) {
        item.coverUrl = u.coverUrl;
        changed = true;
      }
      if (item.durationSec === void 0 && u.durationSec !== void 0) {
        item.durationSec = u.durationSec;
        changed = true;
      }
    }
    if (changed) {
      room.lastActivity = Date.now();
      this.broadcastState(room);
    }
  }
  handleStandbyOpen(cid, msg) {
    if (this.connRoom.has(cid)) return;
    const existingId = this.connStandby.get(cid);
    if (!existingId && this.standbys.size >= this.cfg.maxRooms * 2) return;
    const id = existingId ?? generateStandbyId();
    const standby = {
      id,
      cid,
      profile: toProfile(msg.profile, cid),
      queue: msg.queue.slice(0, MAX_QUEUE_TRACKS),
      currentIndex: msg.currentIndex,
      playback: withServerTs(msg.playback, this.hub.now()),
      allowGuestControl: msg.allowGuestControl,
      allowGuestAdd: msg.allowGuestAdd ?? true,
      updatedAt: Date.now()
    };
    this.standbys.set(id, standby);
    this.connStandby.set(cid, id);
    this.hub.send(cid, { v: 2, t: "standby.ready", standbyId: id });
  }
  handleStandbyUpdate(cid, msg) {
    const id = this.connStandby.get(cid);
    if (!id) return;
    const standby = this.standbys.get(id);
    if (!standby) return;
    if (msg.queue !== void 0) standby.queue = msg.queue.slice(0, MAX_QUEUE_TRACKS);
    if (msg.currentIndex !== void 0) standby.currentIndex = msg.currentIndex;
    if (msg.playback !== void 0) standby.playback = withServerTs(msg.playback, this.hub.now());
    standby.updatedAt = Date.now();
  }
  closeStandby(cid) {
    const id = this.connStandby.get(cid);
    if (!id) return;
    this.connStandby.delete(cid);
    this.standbys.delete(id);
  }
  handleProfileUpdate(cid, rawProfile) {
    const next = toProfile(rawProfile, cid);
    const standbyId = this.connStandby.get(cid);
    if (standbyId) {
      const standby = this.standbys.get(standbyId);
      if (standby) standby.profile = next;
    }
    const room = this.memberRoom(cid);
    if (!room) return;
    const participant = room.participants.get(cid);
    if (!participant) return;
    if (participant.role === "guest" && next.tidalUserId && room.bannedTidalUserIds.has(next.tidalUserId)) {
      this.banFromRoom(room, cid, participant);
      this.hub.send(cid, { v: 2, t: "room.ended", reason: "banned" });
      this.broadcastState(room);
      return;
    }
    const changed = participant.name !== next.name || participant.avatarUrl !== next.avatarUrl || participant.tidalUserId !== next.tidalUserId || participant.profilePath !== next.profilePath;
    if (!changed) return;
    room.participants.set(cid, {
      ...next,
      role: participant.role,
      audioMode: participant.audioMode,
      canAddTracks: participant.canAddTracks
    });
    for (const item of room.queue) {
      if (item.addedBy.cid === cid) item.addedBy = next;
    }
    room.lastActivity = Date.now();
    this.broadcastState(room);
  }
  hostRoom(cid) {
    const code = this.connRoom.get(cid);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room || room.hostCid !== cid) return null;
    return room;
  }
  memberRoom(cid) {
    const code = this.connRoom.get(cid);
    if (!code) return null;
    return this.rooms.get(code) ?? null;
  }
  broadcastState(room, excludeCid) {
    const recipients = [...room.participants.keys()].filter((id) => id !== excludeCid);
    if (recipients.length === 0) return;
    this.hub.broadcast(recipients, { v: 2, t: "room.state", state: toRoomSnapshot(room) });
  }
  destroyRoom(code, reason) {
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.graceTimer) clearTimeout(room.graceTimer);
    this.rooms.delete(code);
    const recipients = [];
    for (const pid of room.participants.keys()) {
      this.connRoom.delete(pid);
      recipients.push(pid);
    }
    if (recipients.length > 0) {
      this.hub.broadcast(recipients, { v: 2, t: "room.ended", reason });
    }
  }
  sweep() {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      if (now - room.lastActivity > this.cfg.roomTtlMs) {
        this.destroyRoom(room.code, "host_timeout");
      }
    }
    for (const [token, entry2] of this.promoted) {
      if (entry2.expiresAt <= now) this.promoted.delete(token);
    }
    for (const [id, sb] of this.standbys) {
      if (now - sb.updatedAt > this.cfg.roomTtlMs) {
        this.standbys.delete(id);
        this.connStandby.delete(sb.cid);
      }
    }
    for (const [cid, entry2] of this.roomCreates) {
      if (now - entry2.windowStart >= 6e4) this.roomCreates.delete(cid);
    }
  }
};

// server/src/main.ts
async function startServer(cfg) {
  const hub = new Hub(cfg);
  const rooms = new Rooms(hub, cfg);
  hub.setHandler({
    onMessage: (cid, msg) => rooms.onMessage(cid, msg),
    onDisconnect: (cid) => rooms.onDisconnect(cid),
    resolveToken: (token) => rooms.resolveOrPromote(token),
    peekToken: (token) => rooms.peekToken(token)
  });
  const port = await hub.listen();
  return {
    port,
    close: async () => {
      rooms.stop();
      await hub.close();
    }
  };
}
var entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  startServer(loadConfig()).then((s) => console.log(`lunajam server listening on port ${s.port}`)).catch((err) => {
    console.error(String(err));
    process.exit(1);
  });
}
export {
  startServer
};
