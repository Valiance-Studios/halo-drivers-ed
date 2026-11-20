import {createApp} from 'vue';
import {createPinia} from 'pinia';
import App from '@/App.vue';
import router from '@/router';
import {primeVue} from '@/plugins/primevue';
import {useThemeStore} from '@/stores/theme';
import 'primeicons/primeicons.css';
import '@/styles/main.scss';

const app = createApp(App)
  .use(createPinia())
  .use(router)
  .use(...primeVue);

useThemeStore().init();
app.mount('#app');
