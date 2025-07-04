
import * as api from './api.js';
import { setState, subscribe } from './store.js';
import { render } from './ui.js';
import { initializeEventListeners } from './eventHandlers.js';

// =========================================================================
// Main Application Entry Point
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const authCheckingScreen = document.getElementById('authCheckingScreen');
    const mainContent = document.getElementById('mainContent');

    // 1. Check for JWT Token
    if (!localStorage.getItem('jwt_token')) {
        window.location.href = '/login';
        return;
    }

    // 2. Initialize WebSocket connection
    const socket = io();
    socket.on('connect', () => console.log('Socket.IO Connected!'));
    
    // When the server pushes an update, refetch all data to ensure consistency
    const refetchAndSetState = async () => {
        try {
            console.log('Socket event received, refetching data...');
            const data = await api.getInitialData();
            setState({
                assignments: data._debug_all_assignments || [],
                materials: data._debug_all_materials || [],
                groups: data._debug_all_groups || [],
                settings: data.settings || {},
            });
        } catch (error) {
            console.error('Failed to refetch data after socket event:', error);
        }
    };
    socket.on('media_updated', refetchAndSetState);
    socket.on('settings_updated', refetchAndSetState);

    // 3. Subscribe the main render function to state changes
    subscribe(render);

    // 4. Initialize all event listeners
    initializeEventListeners();

    // 5. Fetch initial data and populate the store
    async function initialize() {
        try {
            // Fetch data from the server
            const data = await api.getInitialData();
            
            // Fetch users data
            let usersData = [];
            try {
                const usersResponse = await api.getUsers();
                usersData = usersResponse.data || [];
            } catch (usersError) {
                console.error('Failed to fetch users data:', usersError);
                // Don't fail the entire initialization if users fetch fails
                // This allows non-admin users to still use the system
            }
            
            // Get data passed from Flask template
            // This is the only place we rely on this global variable.
            // In a full SPA, this would also be fetched via API.
            const available_sections = typeof available_sections_for_js !== 'undefined' ? available_sections_for_js : {};

            // Update the central state
            setState({
                assignments: data._debug_all_assignments || [],
                materials: data._debug_all_materials || [],
                groups: data._debug_all_groups || [],
                settings: data.settings || {},
                available_sections: available_sections,
                users: usersData
            });

            // Hide loading screen and show main content
            if (authCheckingScreen) authCheckingScreen.style.display = 'none';
            if (mainContent) mainContent.style.display = 'block';

        } catch (error) {
            console.error('Failed to initialize application:', error);
            if (error.message !== 'Unauthorized') {
                alert('應用程式初始化失敗，請檢查網路連線或聯絡管理員。');
            }
        }
    }

    initialize();
});
