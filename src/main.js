// @ts-ignore
import App from './App.html';

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

export default app;
