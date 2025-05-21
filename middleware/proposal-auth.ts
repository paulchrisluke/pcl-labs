export default defineNuxtRouteMiddleware((to, from) => {
  // Only protect proposal routes
  if (!to.path.startsWith('/proposals')) {
    return;
  }

  // Skip middleware on server
  if (process.server) {
    return;
  }

  // If accessing the login page itself, allow
  if (to.path === '/proposals') {
    return;
  }

  // Check if user is authenticated
  const isAuthenticated = () => {
    return localStorage.getItem('proposal_auth') === 'true';
  };

  // If not authenticated and trying to access a proposal, redirect to login
  if (!isAuthenticated()) {
    return navigateTo('/proposals');
  }
}); 