var app = (function () {
	'use strict';

	function noop() {}

	function assign(tar, src) {
		for (var k in src) tar[k] = src[k];
		return tar;
	}

	function assignTrue(tar, src) {
		for (var k in src) tar[k] = 1;
		return tar;
	}

	function callAfter(fn, i) {
		if (i === 0) fn();
		return () => {
			if (!--i) fn();
		};
	}

	function addLoc(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function exclude(src, prop) {
		const tar = {};
		for (const k in src) k === prop || (tar[k] = src[k]);
		return tar;
	}

	function run(fn) {
		fn();
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor);
	}

	function detachNode(node) {
		node.parentNode.removeChild(node);
	}

	function destroyEach(iterations, detach) {
		for (var i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detach);
		}
	}

	function createElement(name) {
		return document.createElement(name);
	}

	function createText(data) {
		return document.createTextNode(data);
	}

	function createComment() {
		return document.createComment('');
	}

	function addListener(node, event, handler, options) {
		node.addEventListener(event, handler, options);
	}

	function removeListener(node, event, handler, options) {
		node.removeEventListener(event, handler, options);
	}

	function setAttribute(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else node.setAttribute(attribute, value);
	}

	function setData(text, data) {
		text.data = '' + data;
	}

	function setStyle(node, key, value) {
		node.style.setProperty(key, value);
	}

	function destroyBlock(block, lookup) {
		block.d(1);
		lookup[block.key] = null;
	}

	function outroAndDestroyBlock(block, lookup) {
		block.o(function() {
			destroyBlock(block, lookup);
		});
	}

	function updateKeyedEach(old_blocks, component, changed, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, intro_method, next, get_context) {
		var o = old_blocks.length;
		var n = list.length;

		var i = o;
		var old_indexes = {};
		while (i--) old_indexes[old_blocks[i].key] = i;

		var new_blocks = [];
		var new_lookup = {};
		var deltas = {};

		var i = n;
		while (i--) {
			var child_ctx = get_context(ctx, list, i);
			var key = get_key(child_ctx);
			var block = lookup[key];

			if (!block) {
				block = create_each_block(component, key, child_ctx);
				block.c();
			} else if (dynamic) {
				block.p(changed, child_ctx);
			}

			new_blocks[i] = new_lookup[key] = block;

			if (key in old_indexes) deltas[key] = Math.abs(i - old_indexes[key]);
		}

		var will_move = {};
		var did_move = {};

		function insert(block) {
			block[intro_method](node, next);
			lookup[block.key] = block;
			next = block.first;
			n--;
		}

		while (o && n) {
			var new_block = new_blocks[n - 1];
			var old_block = old_blocks[o - 1];
			var new_key = new_block.key;
			var old_key = old_block.key;

			if (new_block === old_block) {
				// do nothing
				next = new_block.first;
				o--;
				n--;
			}

			else if (!new_lookup[old_key]) {
				// remove old block
				destroy(old_block, lookup);
				o--;
			}

			else if (!lookup[new_key] || will_move[new_key]) {
				insert(new_block);
			}

			else if (did_move[old_key]) {
				o--;

			} else if (deltas[new_key] > deltas[old_key]) {
				did_move[new_key] = true;
				insert(new_block);

			} else {
				will_move[old_key] = true;
				o--;
			}
		}

		while (o--) {
			var old_block = old_blocks[o];
			if (!new_lookup[old_block.key]) destroy(old_block, lookup);
		}

		while (n) insert(new_blocks[n - 1]);

		return new_blocks;
	}

	function blankObject() {
		return Object.create(null);
	}

	function destroy(detach) {
		this.destroy = noop;
		this.fire('destroy');
		this.set = noop;

		this._fragment.d(detach !== false);
		this._fragment = null;
		this._state = {};
	}

	function destroyDev(detach) {
		destroy.call(this, detach);
		this.destroy = function() {
			console.warn('Component was already destroyed');
		};
	}

	function _differs(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function fire(eventName, data) {
		var handlers =
			eventName in this._handlers && this._handlers[eventName].slice();
		if (!handlers) return;

		for (var i = 0; i < handlers.length; i += 1) {
			var handler = handlers[i];

			if (!handler.__calling) {
				try {
					handler.__calling = true;
					handler.call(this, data);
				} finally {
					handler.__calling = false;
				}
			}
		}
	}

	function flush(component) {
		component._lock = true;
		callAll(component._beforecreate);
		callAll(component._oncreate);
		callAll(component._aftercreate);
		component._lock = false;
	}

	function get() {
		return this._state;
	}

	function init(component, options) {
		component._handlers = blankObject();
		component._slots = blankObject();
		component._bind = options._bind;
		component._staged = {};

		component.options = options;
		component.root = options.root || component;
		component.store = options.store || component.root.store;

		if (!options.root) {
			component._beforecreate = [];
			component._oncreate = [];
			component._aftercreate = [];
		}
	}

	function on(eventName, handler) {
		var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
		handlers.push(handler);

		return {
			cancel: function() {
				var index = handlers.indexOf(handler);
				if (~index) handlers.splice(index, 1);
			}
		};
	}

	function set(newState) {
		this._set(assign({}, newState));
		if (this.root._lock) return;
		flush(this.root);
	}

	function _set(newState) {
		var oldState = this._state,
			changed = {},
			dirty = false;

		newState = assign(this._staged, newState);
		this._staged = {};

		for (var key in newState) {
			if (this._differs(newState[key], oldState[key])) changed[key] = dirty = true;
		}
		if (!dirty) return;

		this._state = assign(assign({}, oldState), newState);
		this._recompute(changed, this._state);
		if (this._bind) this._bind(changed, this._state);

		if (this._fragment) {
			this.fire("state", { changed: changed, current: this._state, previous: oldState });
			this._fragment.p(changed, this._state);
			this.fire("update", { changed: changed, current: this._state, previous: oldState });
		}
	}

	function _stage(newState) {
		assign(this._staged, newState);
	}

	function setDev(newState) {
		if (typeof newState !== 'object') {
			throw new Error(
				this._debugName + '.set was called without an object of data key-values to update.'
			);
		}

		this._checkReadOnly(newState);
		set.call(this, newState);
	}

	function callAll(fns) {
		while (fns && fns.length) fns.shift()();
	}

	function _mount(target, anchor) {
		this._fragment[this._fragment.i ? 'i' : 'm'](target, anchor || null);
	}

	var protoDev = {
		destroy: destroyDev,
		get,
		fire,
		on,
		set: setDev,
		_recompute: noop,
		_set,
		_stage,
		_mount,
		_differs
	};

	//-------------------- Color utilities --------------------

	// Obtained from https://stackoverflow.com/a/9493060/2342681
	function hsl2rgb(h, s, l) {
		let r, g, b;
		if (s === 0) {
			r = g = b = l; // achromatic
		} else {
			let hue2rgb = (p, q, t) => {
				if (t < 0) t += 1;
				if (t > 1) t -= 1;
				if (t < 1 / 6) return p + (q - p) * 6 * t
				if (t < 1 / 2) return q
				if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
				return p
			};
			let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			let p = 2 * l - q;
			r = hue2rgb(p, q, h + 1 / 3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1 / 3);
		}
		return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
	}

	function rgb2hex(r, g, b) {
		let d2h = d => {
			let h = d.toString(16);
			return h.length > 1 ? h : '0' + h
		};
		return `#${d2h(r)}${d2h(g)}${d2h(b)}`
	}

	function randomColor() {
		let [r, g, b] = hsl2rgb(Math.random(), 1, 0.5);
		return rgb2hex(r, g, b)
	}

	function parseHexColor(hexcol) {
		let rgb = parseInt(hexcol.substr(1), 16);
		return [rgb & 255, (rgb >> 8) & 255, (rgb >> 16) & 255]
	}

	function isDarkColor(r, g, b) {
		let luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 256;
		return luminance < 0.6
	}

	function getContrastingColor(color) {
		let [r, g, b] = parseHexColor(color);
		return isDarkColor(r, g, b) ? '#ffffff' : '#000000'
	}


	//-------------------- Date utilities --------------------

	function date2html(d) {
		let yy = d.getFullYear();
		let mm = d.getMonth() + 1;
		let dd = d.getDate();
		return `${yy}-${mm}-${dd}`
	}

	function daysInMonth(month, year) {
		return new Date(year, month + 1, 0).getDate()
	}

	function dayOfWeek(date) {
		let dow = date.getDay();
		if (dow === 0) dow = 7;	// Adjust week to Mon ... Sun pattern
		return dow - 1
	}

	function getMonthWeeks(month, year) {
		let dim = daysInMonth(month, year);
		let dow = dayOfWeek(new Date(year, month, 1));
		return Math.ceil((dim + dow) / 7)
	}

	/* src/form-group.html generated by Svelte v2.15.1 */

	function c_type(props) {
		return props.type || 'text';
	}

	function c_after(props) {
		return props.after || '';
	}

	var methods = {
		changed(evt) {
			let { type } = this.get();
			let value = evt.target.value;
			if (type == 'number' && value)
				value = parseInt(value);
			this.set({ value });
		}
	};

	function oncreate() {
		let { attrs, focus } = this.get();
		if (focus)
			this.refs.input.focus();
		if (attrs)
			for (let aname in attrs)
				this.refs.input.setAttribute(aname, attrs[aname]);
	}
	const file = "src/form-group.html";

	function create_main_fragment(component, ctx) {
		var div, label, text0, text1, input, text2, text3, current;

		function input_handler(event) {
			component.changed(event);
		}

		return {
			c: function create() {
				div = createElement("div");
				label = createElement("label");
				text0 = createText(ctx.label);
				text1 = createText("\n\t");
				input = createElement("input");
				text2 = createText("\n\t ");
				text3 = createText(ctx.c_after);
				label.className = "svelte-m01gom";
				addLoc(label, file, 1, 1, 26);
				addListener(input, "input", input_handler);
				setAttribute(input, "type", ctx.c_type);
				input.value = ctx.value;
				input.className = "form-control svelte-m01gom";
				addLoc(input, file, 2, 1, 50);
				div.className = "form-group svelte-m01gom";
				addLoc(div, file, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, label);
				append(label, text0);
				append(div, text1);
				append(div, input);
				component.refs.input = input;
				append(div, text2);
				append(div, text3);
				current = true;
			},

			p: function update(changed, ctx) {
				if (changed.label) {
					setData(text0, ctx.label);
				}

				if (changed.c_type) {
					setAttribute(input, "type", ctx.c_type);
				}

				if (changed.value) {
					input.value = ctx.value;
				}

				if (changed.c_after) {
					setData(text3, ctx.c_after);
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: run,

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				removeListener(input, "input", input_handler);
				if (component.refs.input === input) component.refs.input = null;
			}
		};
	}

	function Form_group(options) {
		this._debugName = '<Form_group>';
		if (!options || (!options.target && !options.root)) {
			throw new Error("'target' is a required option");
		}

		init(this, options);
		this.refs = {};
		this._state = assign({}, options.data);

		this._recompute({  }, this._state);
		if (!('label' in this._state)) console.warn("<Form_group> was created without expected data property 'label'");

		if (!('value' in this._state)) console.warn("<Form_group> was created without expected data property 'value'");
		this._intro = !!options.intro;

		this._fragment = create_main_fragment(this, this._state);

		this.root._oncreate.push(() => {
			oncreate.call(this);
			this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
		});

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(Form_group.prototype, protoDev);
	assign(Form_group.prototype, methods);

	Form_group.prototype._checkReadOnly = function _checkReadOnly(newState) {
		if ('c_type' in newState && !this._updatingReadonlyProperty) throw new Error("<Form_group>: Cannot set read-only property 'c_type'");
		if ('c_after' in newState && !this._updatingReadonlyProperty) throw new Error("<Form_group>: Cannot set read-only property 'c_after'");
	};

	Form_group.prototype._recompute = function _recompute(changed, state) {
		if (this._differs(state.c_type, (state.c_type = c_type(exclude(state, "c_type"))))) changed.c_type = true;
		if (this._differs(state.c_after, (state.c_after = c_after(exclude(state, "c_after"))))) changed.c_after = true;
	};

	/* src/event.html generated by Svelte v2.15.1 */

	var methods$1 = {
		fireDeleteEvent() {
			let { event } = this.get();
			this.fire('deleteEvent', event);
		},
		fireUpdateEvent() {
			let { event } = this.get();
			this.fire('updateEvent', event);
		}
	};

	function onupdate({ current, previous }) {
		if (previous)
			this.fireUpdateEvent();
	}
	const file$1 = "src/event.html";

	function create_main_fragment$1(component, ctx) {
		var div1, hr, text0, formgroup0_updating = {}, text1, formgroup1_updating = {}, text2, formgroup2_updating = {}, text3, formgroup3_updating = {}, text4, formgroup4_updating = {}, text5, formgroup5_updating = {}, text6, div0, button, current;

		var formgroup0_initial_data = { label: "Name", name: "name", focus: true };
		if (ctx.event.name !== void 0) {
			formgroup0_initial_data.value = ctx.event.name;
			formgroup0_updating.value = true;
		}
		var formgroup0 = new Form_group({
			root: component.root,
			store: component.store,
			data: formgroup0_initial_data,
			_bind(changed, childState) {
				var newState = {};
				if (!formgroup0_updating.value && changed.value) {
					ctx.event.name = childState.value;
					newState.event = ctx.event;
				}
				component._set(newState);
				formgroup0_updating = {};
			}
		});

		component.root._beforecreate.push(() => {
			formgroup0._bind({ value: 1 }, formgroup0.get());
		});

		var formgroup1_initial_data = {
		 	label: "Color",
		 	type: "color",
		 	name: "color"
		 };
		if (ctx.event.color !== void 0) {
			formgroup1_initial_data.value = ctx.event.color;
			formgroup1_updating.value = true;
		}
		var formgroup1 = new Form_group({
			root: component.root,
			store: component.store,
			data: formgroup1_initial_data,
			_bind(changed, childState) {
				var newState = {};
				if (!formgroup1_updating.value && changed.value) {
					ctx.event.color = childState.value;
					newState.event = ctx.event;
				}
				component._set(newState);
				formgroup1_updating = {};
			}
		});

		component.root._beforecreate.push(() => {
			formgroup1._bind({ value: 1 }, formgroup1.get());
		});

		var formgroup2_initial_data = {
		 	label: "Start",
		 	type: "date",
		 	name: "start"
		 };
		if (ctx.event.start !== void 0) {
			formgroup2_initial_data.value = ctx.event.start;
			formgroup2_updating.value = true;
		}
		var formgroup2 = new Form_group({
			root: component.root,
			store: component.store,
			data: formgroup2_initial_data,
			_bind(changed, childState) {
				var newState = {};
				if (!formgroup2_updating.value && changed.value) {
					ctx.event.start = childState.value;
					newState.event = ctx.event;
				}
				component._set(newState);
				formgroup2_updating = {};
			}
		});

		component.root._beforecreate.push(() => {
			formgroup2._bind({ value: 1 }, formgroup2.get());
		});

		var formgroup3_initial_data = {
		 	label: "Duration",
		 	type: "number",
		 	name: "duration",
		 	after: "day(s)",
		 	attrs: { min: 1, step: 1 }
		 };
		if (ctx.event.duration !== void 0) {
			formgroup3_initial_data.value = ctx.event.duration;
			formgroup3_updating.value = true;
		}
		var formgroup3 = new Form_group({
			root: component.root,
			store: component.store,
			data: formgroup3_initial_data,
			_bind(changed, childState) {
				var newState = {};
				if (!formgroup3_updating.value && changed.value) {
					ctx.event.duration = childState.value;
					newState.event = ctx.event;
				}
				component._set(newState);
				formgroup3_updating = {};
			}
		});

		component.root._beforecreate.push(() => {
			formgroup3._bind({ value: 1 }, formgroup3.get());
		});

		var formgroup4_initial_data = {
		 	label: "Every",
		 	type: "number",
		 	name: "every",
		 	after: "day(s)",
		 	attrs: { min: 1, step: 1 }
		 };
		if (ctx.event.every !== void 0) {
			formgroup4_initial_data.value = ctx.event.every;
			formgroup4_updating.value = true;
		}
		var formgroup4 = new Form_group({
			root: component.root,
			store: component.store,
			data: formgroup4_initial_data,
			_bind(changed, childState) {
				var newState = {};
				if (!formgroup4_updating.value && changed.value) {
					ctx.event.every = childState.value;
					newState.event = ctx.event;
				}
				component._set(newState);
				formgroup4_updating = {};
			}
		});

		component.root._beforecreate.push(() => {
			formgroup4._bind({ value: 1 }, formgroup4.get());
		});

		var formgroup5_initial_data = {
		 	label: "Repeat",
		 	type: "number",
		 	name: "repeat",
		 	after: "time(s)",
		 	attrs: { min: 1, step: 1 }
		 };
		if (ctx.event.repeat !== void 0) {
			formgroup5_initial_data.value = ctx.event.repeat;
			formgroup5_updating.value = true;
		}
		var formgroup5 = new Form_group({
			root: component.root,
			store: component.store,
			data: formgroup5_initial_data,
			_bind(changed, childState) {
				var newState = {};
				if (!formgroup5_updating.value && changed.value) {
					ctx.event.repeat = childState.value;
					newState.event = ctx.event;
				}
				component._set(newState);
				formgroup5_updating = {};
			}
		});

		component.root._beforecreate.push(() => {
			formgroup5._bind({ value: 1 }, formgroup5.get());
		});

		function click_handler(event) {
			component.fireDeleteEvent();
		}

		return {
			c: function create() {
				div1 = createElement("div");
				hr = createElement("hr");
				text0 = createText("\n\t");
				formgroup0._fragment.c();
				text1 = createText("\n\t");
				formgroup1._fragment.c();
				text2 = createText("\n\t");
				formgroup2._fragment.c();
				text3 = createText("\n\t");
				formgroup3._fragment.c();
				text4 = createText("\n\t");
				formgroup4._fragment.c();
				text5 = createText("\n\t");
				formgroup5._fragment.c();
				text6 = createText("\n\t");
				div0 = createElement("div");
				button = createElement("button");
				button.textContent = "Remove event";
				addLoc(hr, file$1, 1, 1, 7);
				addListener(button, "click", click_handler);
				button.className = "btn btn-sm btn-warning svelte-hj9mtw";
				addLoc(button, file$1, 18, 2, 673);
				div0.className = "form-group";
				addLoc(div0, file$1, 17, 1, 646);
				addLoc(div1, file$1, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div1, anchor);
				append(div1, hr);
				append(div1, text0);
				formgroup0._mount(div1, null);
				append(div1, text1);
				formgroup1._mount(div1, null);
				append(div1, text2);
				formgroup2._mount(div1, null);
				append(div1, text3);
				formgroup3._mount(div1, null);
				append(div1, text4);
				formgroup4._mount(div1, null);
				append(div1, text5);
				formgroup5._mount(div1, null);
				append(div1, text6);
				append(div1, div0);
				append(div0, button);
				current = true;
			},

			p: function update(changed, _ctx) {
				ctx = _ctx;
				var formgroup0_changes = {};
				if (!formgroup0_updating.value && changed.event) {
					formgroup0_changes.value = ctx.event.name;
					formgroup0_updating.value = ctx.event.name !== void 0;
				}
				formgroup0._set(formgroup0_changes);
				formgroup0_updating = {};

				var formgroup1_changes = {};
				if (!formgroup1_updating.value && changed.event) {
					formgroup1_changes.value = ctx.event.color;
					formgroup1_updating.value = ctx.event.color !== void 0;
				}
				formgroup1._set(formgroup1_changes);
				formgroup1_updating = {};

				var formgroup2_changes = {};
				if (!formgroup2_updating.value && changed.event) {
					formgroup2_changes.value = ctx.event.start;
					formgroup2_updating.value = ctx.event.start !== void 0;
				}
				formgroup2._set(formgroup2_changes);
				formgroup2_updating = {};

				var formgroup3_changes = {};
				if (!formgroup3_updating.value && changed.event) {
					formgroup3_changes.value = ctx.event.duration;
					formgroup3_updating.value = ctx.event.duration !== void 0;
				}
				formgroup3._set(formgroup3_changes);
				formgroup3_updating = {};

				var formgroup4_changes = {};
				if (!formgroup4_updating.value && changed.event) {
					formgroup4_changes.value = ctx.event.every;
					formgroup4_updating.value = ctx.event.every !== void 0;
				}
				formgroup4._set(formgroup4_changes);
				formgroup4_updating = {};

				var formgroup5_changes = {};
				if (!formgroup5_updating.value && changed.event) {
					formgroup5_changes.value = ctx.event.repeat;
					formgroup5_updating.value = ctx.event.repeat !== void 0;
				}
				formgroup5._set(formgroup5_changes);
				formgroup5_updating = {};
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				outrocallback = callAfter(outrocallback, 6);

				if (formgroup0) formgroup0._fragment.o(outrocallback);
				if (formgroup1) formgroup1._fragment.o(outrocallback);
				if (formgroup2) formgroup2._fragment.o(outrocallback);
				if (formgroup3) formgroup3._fragment.o(outrocallback);
				if (formgroup4) formgroup4._fragment.o(outrocallback);
				if (formgroup5) formgroup5._fragment.o(outrocallback);
				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div1);
				}

				formgroup0.destroy();
				formgroup1.destroy();
				formgroup2.destroy();
				formgroup3.destroy();
				formgroup4.destroy();
				formgroup5.destroy();
				removeListener(button, "click", click_handler);
			}
		};
	}

	function Event(options) {
		this._debugName = '<Event>';
		if (!options || (!options.target && !options.root)) {
			throw new Error("'target' is a required option");
		}

		init(this, options);
		this._state = assign({}, options.data);
		if (!('event' in this._state)) console.warn("<Event> was created without expected data property 'event'");
		this._intro = !!options.intro;
		this._handlers.update = [onupdate];

		this._fragment = create_main_fragment$1(this, this._state);

		this.root._oncreate.push(() => {
			this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
		});

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(Event.prototype, protoDev);
	assign(Event.prototype, methods$1);

	Event.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	/* src/events.html generated by Svelte v2.15.1 */

	const file$2 = "src/events.html";

	function get_each_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.event = list[i];
		return child_ctx;
	}

	function create_main_fragment$2(component, ctx) {
		var div2, div0, button, text_1, div1, each_blocks_1 = [], each_lookup = blankObject(), current;

		function click_handler(event) {
			component.fire('addEvent');
		}

		var each_value = ctx.events;

		const get_key = ctx => ctx.event.id;

		for (var i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context(ctx, each_value, i);
			let key = get_key(child_ctx);
			each_blocks_1[i] = each_lookup[key] = create_each_block(component, key, child_ctx);
		}

		return {
			c: function create() {
				div2 = createElement("div");
				div0 = createElement("div");
				button = createElement("button");
				button.textContent = "Add event";
				text_1 = createText("\n\t");
				div1 = createElement("div");

				for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].c();
				addListener(button, "click", click_handler);
				button.className = "btn btn-primary";
				addLoc(button, file$2, 2, 2, 54);
				setStyle(div0, "text-align", "center");
				addLoc(div0, file$2, 1, 1, 19);
				div1.id = "event-list";
				addLoc(div1, file$2, 6, 1, 149);
				div2.id = "events";
				div2.className = "svelte-nq3at1";
				addLoc(div2, file$2, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div2, anchor);
				append(div2, div0);
				append(div0, button);
				append(div2, text_1);
				append(div2, div1);

				for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].i(div1, null);

				current = true;
			},

			p: function update(changed, ctx) {
				const each_value = ctx.events;
				each_blocks_1 = updateKeyedEach(each_blocks_1, component, changed, get_key, 1, ctx, each_value, each_lookup, div1, outroAndDestroyBlock, create_each_block, "i", null, get_each_context);
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				const countdown = callAfter(outrocallback, each_blocks_1.length);
				for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].o(countdown);

				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div2);
				}

				removeListener(button, "click", click_handler);

				for (i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].d();
			}
		};
	}

	// (8:2) {#each events as event (event.id)}
	function create_each_block(component, key_1, ctx) {
		var first, current;

		var event_initial_data = { event: ctx.event };
		var event = new Event({
			root: component.root,
			store: component.store,
			data: event_initial_data
		});

		event.on("deleteEvent", function(event) {
			component.fire("deleteEvent", event);
		});
		event.on("updateEvent", function(event) {
			component.fire("updateEvent", event);
		});

		return {
			key: key_1,

			first: null,

			c: function create() {
				first = createComment();
				event._fragment.c();
				this.first = first;
			},

			m: function mount(target, anchor) {
				insert(target, first, anchor);
				event._mount(target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var event_changes = {};
				if (changed.events) event_changes.event = ctx.event;
				event._set(event_changes);
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				if (event) event._fragment.o(outrocallback);
				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(first);
				}

				event.destroy(detach);
			}
		};
	}

	function Events(options) {
		this._debugName = '<Events>';
		if (!options || (!options.target && !options.root)) {
			throw new Error("'target' is a required option");
		}

		init(this, options);
		this._state = assign({}, options.data);
		if (!('events' in this._state)) console.warn("<Events> was created without expected data property 'events'");
		this._intro = !!options.intro;

		this._fragment = create_main_fragment$2(this, this._state);

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(Events.prototype, protoDev);

	Events.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	/* src/month.html generated by Svelte v2.15.1 */

	function initDays(mnum, year) {
		let days = [];
		let totalDays = getMonthWeeks(mnum, year) * 7;
		let daynum = 1 - dayOfWeek(new Date(year, mnum, 1));
		let dim = daysInMonth(mnum, year);
		for (let i = 1; i <= totalDays; i++) {
			let isEmpty = daynum <= 0 || daynum > dim;
			days.push({ daynum, dim, mnum, year, isEmpty });
			daynum++;
		}
		return days
	}

	function days({ month, year }) {
		return initDays(month, year);
	}

	function data() {
		return {
			weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
		}
	}
	function getEvents(daynum, year, month, eventMap) {
		let dayId = date2html(new Date(year, month, daynum));
		let events = eventMap[dayId];
		if (!events) events = [];
		return events
	}
	function eventStyle(event) {
		return `background-color: ${event.color}; color: ${event.txtcolor}`
	}
	const file$3 = "src/month.html";

	function get_each_context$1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.event = list[i];
		return child_ctx;
	}

	function get_each1_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.day = list[i];
		return child_ctx;
	}

	function get_each0_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.weekday = list[i];
		return child_ctx;
	}

	function create_main_fragment$3(component, ctx) {
		var div1, h2, text0, text1, div0, text2, current;

		var each0_value = ctx.weekdays;

		var each0_blocks = [];

		for (var i = 0; i < each0_value.length; i += 1) {
			each0_blocks[i] = create_each_block_2(component, get_each0_context(ctx, each0_value, i));
		}

		var each1_value = ctx.days;

		var each1_blocks = [];

		for (var i = 0; i < each1_value.length; i += 1) {
			each1_blocks[i] = create_each_block$1(component, get_each1_context(ctx, each1_value, i));
		}

		return {
			c: function create() {
				div1 = createElement("div");
				h2 = createElement("h2");
				text0 = createText(ctx.name);
				text1 = createText("\n\t");
				div0 = createElement("div");

				for (var i = 0; i < each0_blocks.length; i += 1) {
					each0_blocks[i].c();
				}

				text2 = createText("\n\t\t");

				for (var i = 0; i < each1_blocks.length; i += 1) {
					each1_blocks[i].c();
				}
				addLoc(h2, file$3, 1, 1, 31);
				div0.className = "cal-month svelte-1u408in";
				addLoc(div0, file$3, 2, 1, 48);
				div1.className = "cal-month-block svelte-1u408in";
				addLoc(div1, file$3, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div1, anchor);
				append(div1, h2);
				append(h2, text0);
				append(div1, text1);
				append(div1, div0);

				for (var i = 0; i < each0_blocks.length; i += 1) {
					each0_blocks[i].m(div0, null);
				}

				append(div0, text2);

				for (var i = 0; i < each1_blocks.length; i += 1) {
					each1_blocks[i].m(div0, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (changed.name) {
					setData(text0, ctx.name);
				}

				if (changed.weekdays) {
					each0_value = ctx.weekdays;

					for (var i = 0; i < each0_value.length; i += 1) {
						const child_ctx = get_each0_context(ctx, each0_value, i);

						if (each0_blocks[i]) {
							each0_blocks[i].p(changed, child_ctx);
						} else {
							each0_blocks[i] = create_each_block_2(component, child_ctx);
							each0_blocks[i].c();
							each0_blocks[i].m(div0, text2);
						}
					}

					for (; i < each0_blocks.length; i += 1) {
						each0_blocks[i].d(1);
					}
					each0_blocks.length = each0_value.length;
				}

				if (changed.days || changed.year || changed.month || changed.eventMap) {
					each1_value = ctx.days;

					for (var i = 0; i < each1_value.length; i += 1) {
						const child_ctx = get_each1_context(ctx, each1_value, i);

						if (each1_blocks[i]) {
							each1_blocks[i].p(changed, child_ctx);
						} else {
							each1_blocks[i] = create_each_block$1(component, child_ctx);
							each1_blocks[i].c();
							each1_blocks[i].m(div0, null);
						}
					}

					for (; i < each1_blocks.length; i += 1) {
						each1_blocks[i].d(1);
					}
					each1_blocks.length = each1_value.length;
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: run,

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div1);
				}

				destroyEach(each0_blocks, detach);

				destroyEach(each1_blocks, detach);
			}
		};
	}

	// (4:2) {#each weekdays as weekday}
	function create_each_block_2(component, ctx) {
		var span, text_value = ctx.weekday, text;

		return {
			c: function create() {
				span = createElement("span");
				text = createText(text_value);
				span.className = "cal-weekday svelte-1u408in";
				addLoc(span, file$3, 4, 3, 105);
			},

			m: function mount(target, anchor) {
				insert(target, span, anchor);
				append(span, text);
			},

			p: function update(changed, ctx) {
				if ((changed.weekdays) && text_value !== (text_value = ctx.weekday)) {
					setData(text, text_value);
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(span);
				}
			}
		};
	}

	// (9:4) {#if !day.isEmpty}
	function create_if_block(component, ctx) {
		var div, text0_value = ctx.day.daynum, text0, text1;

		var each_value = getEvents(ctx.day.daynum, ctx.year, ctx.month, ctx.eventMap);

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block_1(component, get_each_context$1(ctx, each_value, i));
		}

		return {
			c: function create() {
				div = createElement("div");
				text0 = createText(text0_value);
				text1 = createText("\n\t\t\t\t\t\t");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				div.className = "cal-cell svelte-1u408in";
				addLoc(div, file$3, 9, 5, 266);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, text0);
				append(div, text1);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div, null);
				}
			},

			p: function update(changed, ctx) {
				if ((changed.days) && text0_value !== (text0_value = ctx.day.daynum)) {
					setData(text0, text0_value);
				}

				if (changed.days || changed.year || changed.month || changed.eventMap) {
					each_value = getEvents(ctx.day.daynum, ctx.year, ctx.month, ctx.eventMap);

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$1(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_1(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				destroyEach(each_blocks, detach);
			}
		};
	}

	// (12:6) {#each getEvents(day.daynum, year, month, eventMap) as event}
	function create_each_block_1(component, ctx) {
		var div, text_value = ctx.event.name, text, div_style_value;

		return {
			c: function create() {
				div = createElement("div");
				text = createText(text_value);
				div.className = "cal-event svelte-1u408in";
				div.style.cssText = div_style_value = eventStyle(ctx.event);
				addLoc(div, file$3, 12, 7, 383);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, text);
			},

			p: function update(changed, ctx) {
				if ((changed.days || changed.year || changed.month || changed.eventMap) && text_value !== (text_value = ctx.event.name)) {
					setData(text, text_value);
				}

				if ((changed.days || changed.year || changed.month || changed.eventMap) && div_style_value !== (div_style_value = eventStyle(ctx.event))) {
					div.style.cssText = div_style_value;
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}
			}
		};
	}

	// (7:2) {#each days as day}
	function create_each_block$1(component, ctx) {
		var div, text, div_class_value;

		var if_block = (!ctx.day.isEmpty) && create_if_block(component, ctx);

		return {
			c: function create() {
				div = createElement("div");
				if (if_block) if_block.c();
				text = createText("\n\t\t\t");
				div.className = div_class_value = "cal-day " + (ctx.day.isEmpty ? 'cal-empty' : '') + " svelte-1u408in";
				addLoc(div, file$3, 7, 3, 183);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				if (if_block) if_block.m(div, null);
				append(div, text);
			},

			p: function update(changed, ctx) {
				if (!ctx.day.isEmpty) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block(component, ctx);
						if_block.c();
						if_block.m(div, text);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if ((changed.days) && div_class_value !== (div_class_value = "cal-day " + (ctx.day.isEmpty ? 'cal-empty' : '') + " svelte-1u408in")) {
					div.className = div_class_value;
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				if (if_block) if_block.d();
			}
		};
	}

	function Month(options) {
		this._debugName = '<Month>';
		if (!options || (!options.target && !options.root)) {
			throw new Error("'target' is a required option");
		}

		init(this, options);
		this._state = assign(data(), options.data);

		this._recompute({ month: 1, year: 1 }, this._state);
		if (!('month' in this._state)) console.warn("<Month> was created without expected data property 'month'");
		if (!('year' in this._state)) console.warn("<Month> was created without expected data property 'year'");
		if (!('name' in this._state)) console.warn("<Month> was created without expected data property 'name'");
		if (!('weekdays' in this._state)) console.warn("<Month> was created without expected data property 'weekdays'");

		if (!('eventMap' in this._state)) console.warn("<Month> was created without expected data property 'eventMap'");
		this._intro = !!options.intro;

		this._fragment = create_main_fragment$3(this, this._state);

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);
		}

		this._intro = true;
	}

	assign(Month.prototype, protoDev);

	Month.prototype._checkReadOnly = function _checkReadOnly(newState) {
		if ('days' in newState && !this._updatingReadonlyProperty) throw new Error("<Month>: Cannot set read-only property 'days'");
	};

	Month.prototype._recompute = function _recompute(changed, state) {
		if (changed.month || changed.year) {
			if (this._differs(state.days, (state.days = days(state)))) changed.days = true;
		}
	};

	/* src/calendar.html generated by Svelte v2.15.1 */

	let MONTHS = [
		'January', 'February', 'March', 'April',
		'May', 'June', 'July', 'August',
		'September', 'October', 'November', 'December'
	];

	function initMonths() {
		let months = [];
		let today = new Date();
		let month = today.getMonth();
		let year = today.getFullYear();
		for (let i = 0; i < 12; i++) {
			let j = month + i;
			if (j === 12) year++;
			let mnum = j % 12;
			let name = `${MONTHS[mnum]} ${year}`;
			months.push({ name, mnum, year });
		}
		return months
	}

	function initEventMap(events) {
		let eventMap = {};
		for (let event of events) {
			let startDate = new Date(event.start);
			for (let i = 0; i < event.repeat; i++) {
				let d = new Date(startDate.getTime());
				for (let j = 0; j < event.duration; j++) {
					let dayId = date2html(d);
					if (eventMap[dayId] === undefined) eventMap[dayId] = [];
					eventMap[dayId].push(event);
					d.setDate(d.getDate() + 1);
				}
				startDate.setDate(startDate.getDate() + event.every);
			}
		}
		return eventMap
	}

	function eventMap({ events }) {
		return initEventMap(events);
	}

	function data$1() {
		return {
			months: initMonths()
		}
	}
	const file$4 = "src/calendar.html";

	function get_each_context$2(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.month = list[i];
		return child_ctx;
	}

	function create_main_fragment$4(component, ctx) {
		var div, current;

		var each_value = ctx.months;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$2(component, get_each_context$2(ctx, each_value, i));
		}

		function outroBlock(i, detach, fn) {
			if (each_blocks[i]) {
				each_blocks[i].o(() => {
					if (detach) {
						each_blocks[i].d(detach);
						each_blocks[i] = null;
					}
					if (fn) fn();
				});
			}
		}

		return {
			c: function create() {
				div = createElement("div");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				div.id = "calendar";
				div.className = "svelte-bnngkq";
				addLoc(div, file$4, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].i(div, null);
				}

				current = true;
			},

			p: function update(changed, ctx) {
				if (changed.months || changed.eventMap) {
					each_value = ctx.months;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$2(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block$2(component, child_ctx);
							each_blocks[i].c();
						}
						each_blocks[i].i(div, null);
					}
					for (; i < each_blocks.length; i += 1) outroBlock(i, 1);
				}
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				each_blocks = each_blocks.filter(Boolean);
				const countdown = callAfter(outrocallback, each_blocks.length);
				for (let i = 0; i < each_blocks.length; i += 1) outroBlock(i, 0, countdown);

				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				destroyEach(each_blocks, detach);
			}
		};
	}

	// (2:1) {#each months as month}
	function create_each_block$2(component, ctx) {
		var current;

		var month_initial_data = {
		 	name: ctx.month.name,
		 	month: ctx.month.mnum,
		 	year: ctx.month.year,
		 	eventMap: ctx.eventMap
		 };
		var month = new Month({
			root: component.root,
			store: component.store,
			data: month_initial_data
		});

		return {
			c: function create() {
				month._fragment.c();
			},

			m: function mount(target, anchor) {
				month._mount(target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var month_changes = {};
				if (changed.months) month_changes.name = ctx.month.name;
				if (changed.months) month_changes.month = ctx.month.mnum;
				if (changed.months) month_changes.year = ctx.month.year;
				if (changed.eventMap) month_changes.eventMap = ctx.eventMap;
				month._set(month_changes);
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				if (month) month._fragment.o(outrocallback);
				current = false;
			},

			d: function destroy$$1(detach) {
				month.destroy(detach);
			}
		};
	}

	function Calendar(options) {
		this._debugName = '<Calendar>';
		if (!options || (!options.target && !options.root)) {
			throw new Error("'target' is a required option");
		}

		init(this, options);
		this._state = assign(data$1(), options.data);

		this._recompute({ events: 1 }, this._state);
		if (!('events' in this._state)) console.warn("<Calendar> was created without expected data property 'events'");
		if (!('months' in this._state)) console.warn("<Calendar> was created without expected data property 'months'");
		this._intro = !!options.intro;

		this._fragment = create_main_fragment$4(this, this._state);

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(Calendar.prototype, protoDev);

	Calendar.prototype._checkReadOnly = function _checkReadOnly(newState) {
		if ('eventMap' in newState && !this._updatingReadonlyProperty) throw new Error("<Calendar>: Cannot set read-only property 'eventMap'");
	};

	Calendar.prototype._recompute = function _recompute(changed, state) {
		if (changed.events) {
			if (this._differs(state.eventMap, (state.eventMap = eventMap(state)))) changed.eventMap = true;
		}
	};

	/* src/App.html generated by Svelte v2.15.1 */

	function data$2() {
	    return {
	        events: []
	    }
	}
	var methods$2 = {
	    addEvent() {
	        let { events } = this.get();
	        let newEvent = {
	            id: Date.now(),
	            name: '',
	            color: randomColor(),
	            start: date2html(new Date()),
	            duration: 1,
	            every: 1,
	            repeat: 1
	        };
	        events = [newEvent, ...events];
	        this.set({ events });
	    },
	    updateEvent(event) {
	        let { events } = this.get();
	        event.txtcolor = getContrastingColor(event.color);
	        this.set({ events });
	    },
	    deleteEvent(event) {
	        let { events } = this.get();
	        let newEvents = events.filter(e => e != event);
	        this.set({ events: newEvents });
	    }
	};

	const file$5 = "src/App.html";

	function create_main_fragment$5(component, ctx) {
		var div, text, current;

		var events_initial_data = { events: ctx.events };
		var events = new Events({
			root: component.root,
			store: component.store,
			data: events_initial_data
		});

		events.on("addEvent", function(event) {
			component.addEvent();
		});
		events.on("updateEvent", function(event) {
			component.updateEvent(event);
		});
		events.on("deleteEvent", function(event) {
			component.deleteEvent(event);
		});

		var calendar_initial_data = { events: ctx.events };
		var calendar = new Calendar({
			root: component.root,
			store: component.store,
			data: calendar_initial_data
		});

		return {
			c: function create() {
				div = createElement("div");
				events._fragment.c();
				text = createText("\n    ");
				calendar._fragment.c();
				div.id = "main";
				div.className = "svelte-za6ii8";
				addLoc(div, file$5, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				events._mount(div, null);
				append(div, text);
				calendar._mount(div, null);
				current = true;
			},

			p: function update(changed, ctx) {
				var events_changes = {};
				if (changed.events) events_changes.events = ctx.events;
				events._set(events_changes);

				var calendar_changes = {};
				if (changed.events) calendar_changes.events = ctx.events;
				calendar._set(calendar_changes);
			},

			i: function intro(target, anchor) {
				if (current) return;

				this.m(target, anchor);
			},

			o: function outro(outrocallback) {
				if (!current) return;

				outrocallback = callAfter(outrocallback, 2);

				if (events) events._fragment.o(outrocallback);
				if (calendar) calendar._fragment.o(outrocallback);
				current = false;
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				events.destroy();
				calendar.destroy();
			}
		};
	}

	function App(options) {
		this._debugName = '<App>';
		if (!options || (!options.target && !options.root)) {
			throw new Error("'target' is a required option");
		}

		init(this, options);
		this._state = assign(data$2(), options.data);
		if (!('events' in this._state)) console.warn("<App> was created without expected data property 'events'");
		this._intro = !!options.intro;

		this._fragment = create_main_fragment$5(this, this._state);

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(App.prototype, protoDev);
	assign(App.prototype, methods$2);

	App.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	// @ts-ignore

	var app = new App({
		target: document.body
	});


	// @ts-ignore
	if (window.module && module.hot) {
		// @ts-ignore
		const { configure, register, reload } = require('/home/travis/build/sveltejs/svelte.technology/node_modules/svelte-loader/lib/hot-api.js');

		// @ts-ignore
		module.hot.accept();

		// @ts-ignore
		if (!module.hot.data) {
			// initial load
			configure({});
			app = register("src/routes/repl/_components/AppControls.html", app);
		} else {
			// hot update
			app = reload("src/routes/repl/_components/AppControls.html", app);
		}
	}

	var app$1 = app;

	return app$1;

}());
//# sourceMappingURL=bundle.js.map
