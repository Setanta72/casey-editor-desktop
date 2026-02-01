// API Configuration
// In Electron, this will be overridden by the preload script
export const API_URL = 'http://127.0.0.1:3001';

// Helper to get API URL (async for Electron compatibility)
export async function getApiUrl(): Promise<string> {
    if (window.electronAPI) {
        return await window.electronAPI.getApiUrl();
    }
    return API_URL;
}

// Check if running in Electron
export function isElectron(): boolean {
    return !!window.electronAPI;
}

// Content Categories (from COORDINATION.md)
export const CATEGORIES = [
    { value: 'photography', label: 'Photography' },
    { value: 'ceramics', label: 'Ceramics' },
    { value: 'art', label: 'Art' },
    { value: 'code', label: 'Code' },
    { value: 'making', label: 'Making' },
    { value: 'research', label: 'Research' },
] as const;

// Project Status Options
export const PROJECT_STATUSES = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
    { value: 'archived', label: 'Archived' },
] as const;

// Content Type Definitions
export const CONTENT_TYPES = {
    posts: {
        singular: 'Post',
        plural: 'Posts',
        description: 'Blog posts and articles',
    },
    projects: {
        singular: 'Project',
        plural: 'Projects',
        description: 'Ongoing work and portfolios',
    },
    pieces: {
        singular: 'Piece',
        plural: 'Pieces',
        description: 'Photography and finished works',
    },
    notes: {
        singular: 'Note',
        plural: 'Notes',
        description: 'Quick thoughts and references',
    },
} as const;
