/* Where the Worker is served. This is Vite's `?worker&url` import, which docs, Storybook and most apps use. With
   another bundler, replace the line below with whatever gives you the bundled Worker's URL. */
import url from './runtime.worker?worker&url';

export default url;
