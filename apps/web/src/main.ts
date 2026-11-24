import {createApp} from 'vue';
import {createPinia} from 'pinia';
import App from '@/App.vue';
import router from '@/router';
import {primeVue} from '@/plugins/primevue';
import {useThemeStore} from '@/stores/theme';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/overpass/latin-400.css';
import '@fontsource/overpass/latin-700.css';
import '@fontsource/overpass/latin-800.css';
import '@fontsource/philosopher/latin-700.css';
import 'primeicons/primeicons.css';
import '@/styles/main.scss';

const app = createApp(App)
  .use(createPinia())
  .use(router)
  .use(...primeVue);

useThemeStore().init();
app.mount('#app');
