import { apiClient } from '@/shared/http/api-client';
export const login = async ({ username, password, displayName, mode = 'login' }) => {
    if (mode === 'register') {
        const response = await apiClient.post('/auth/register', {
            username,
            password,
            displayName: displayName?.trim() || username
        });
        return response.data;
    }
    const response = await apiClient.post('/auth/login', {
        username,
        password
    });
    return response.data;
};
export const fetchCurrentUser = async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
};
