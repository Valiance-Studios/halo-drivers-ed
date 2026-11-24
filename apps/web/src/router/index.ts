import {createRouter, createWebHistory} from 'vue-router';
import {useAuthStore} from '@/stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    admin?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {path: '/', redirect: {name: 'courses'}},
    {path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: {public: true}},
    {path: '/courses', name: 'courses', component: () => import('@/views/CoursesView.vue')},
    {path: '/lessons', name: 'lessons', component: () => import('@/views/LessonsView.vue')},
    {path: '/schedule', name: 'schedule', component: () => import('@/views/ScheduleView.vue'), meta: {admin: true}},
    {
      path: '/schedule/:id',
      name: 'lesson-form',
      component: () => import('@/views/LessonFormView.vue'),
      props: true,
      meta: {admin: true},
    },
    {path: '/:pathMatch(.*)*', redirect: {name: 'courses'}},
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  await authStore.init();

  if (!to.meta.public && !authStore.isAllowed) {
    return {name: 'login', query: {redirect: to.fullPath}};
  }

  if (to.meta.admin && !authStore.isAdmin) {
    return {name: 'courses'};
  }

  if (to.name === 'login' && authStore.isAllowed) {
    return {name: 'courses'};
  }

  return true;
});

export default router;
