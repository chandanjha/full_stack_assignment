import { AuthAPI } from "@/lib/api";

export const authService = {
  login(credentials) {
    return AuthAPI.login(credentials);
  },

  signup(payload) {
    return AuthAPI.signup(payload);
  },

  getProfile() {
    return AuthAPI.getProfile();
  },

  logout() {
    return AuthAPI.logout();
  },
};
